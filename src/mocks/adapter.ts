import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"

import type { PaymentsInput } from "@/lib/api/schemas"
import type { AdminOrder, AdminOrg, AdminPayout, AdminRefunds, AuditCategory, AuditEntry, CatalogFile, CatalogSubmission, PlatformSettings, Collection, Dispute, RefundRecord, Booklist, CatalogItem, CollectionRow, Order, Payment, PublisherPayouts, SchoolOrderDetail, StudentOrderRow } from "@/lib/api/schemas"
import { ownerRole, permissionsFor, roleDef, type OrgType } from "@/lib/access"
import { formatKes, normaliseKenyanPhone } from "@/lib/format"
import * as db from "@/mocks/fixtures"

/*
 * In-browser stand-in for the DRF API (VITE_USE_MOCKS=true). It follows the
 * same URLs, status codes and error shapes the backend will use, so switching
 * to the real API is a config change.
 *
 * Mock-only behaviour:
 *   - the one-time code is 123456 and demo accounts use the password "schoolshop1";
 *   - an M-Pesa number ending in 000 fails with "insufficient funds";
 *   - a payment succeeds on the second status check (~4 s of polling).
 */

/** userId comes from the mock bearer token ("mock-access-<userId>"). */
type Ctx = { params: Record<string, string>; query: Record<string, string>; body: Record<string, unknown>; userId: string | null }
type Handler = (ctx: Ctx) => unknown

const DEMO_CODE = "123456"
const passwords = new Map(Object.keys(db.demoUsers).map((phone) => [phone, "schoolshop1"]))
const pendingSignups = new Map<string, { name: string; password: string }>()
let userSeq = 100

const maskPhone = (e164: string) => { const l = e164.replace(/^254/, "0"); return `${l.slice(0, 4)} ••• ${l.slice(-3)}` }
const maskEmail = (email: string) => email.replace(/^(.)[^@]*/, "$1•••")
const findUser = (identifier: string) =>
  db.demoUsers[identifier] ?? Object.values(db.demoUsers).find((u) => u.email && u.email.toLowerCase() === identifier.toLowerCase())
const tokensFor = (user: (typeof db.demoUsers)[string]) => ({ access: `mock-access-${user.id}`, refresh: `mock-refresh-${user.id}`, user: withAccess(user, true) })

const batches = new Map(db.publisherBatches.map((b) => [b.id, structuredClone(b)]))
let deliveryNoteSeq = 1042

const payouts = structuredClone(db.publisherPayouts)
const otherPayouts = db.adminPayouts.map((p) => structuredClone(p))
const publisherAccounts = structuredClone(db.publisherAccounts)
/** Holds and the finance team's actions, per payout (Longhorn's and everyone else's). */
const payoutNotes = new Map<string, { holdReason: string | null; events: AdminPayout["events"] }>()
const settings = structuredClone(db.publisherSettings)

const catalog = new Map(db.publisherCatalog.map((c) => [c.id, structuredClone(c)]))
let catalogSeq = 100

const booklists = new Map(db.booklists.map((b) => [b.id, structuredClone(b)]))
let children = db.children.map((c) => structuredClone(c))
const account = structuredClone(db.parentAccount)
let childSeq = 1
const catalogById = new Map(db.schoolCatalog.map((c) => [c.productId, c]))
const isoDay = /^\d{4}-\d{2}-\d{2}$/
/** Check a list's dates and items; `forPublish` adds the rules parents depend on. */
function checkBooklist(list: Booklist, forPublish: boolean) {
  const errors: Record<string, string[]> = {}
  if (!isoDay.test(list.orderDeadline)) errors.orderDeadline = ["Choose the last day parents can order."]
  if (!isoDay.test(list.deliverBy)) errors.deliverBy = ["Choose when packs must be at school."]
  else if (list.deliverBy <= list.orderDeadline) errors.deliverBy = ["Give publishers time to pack: this must be after the order deadline."]
  if (forPublish && !list.items.some((i) => i.required)) errors.items = ["Mark at least one item as required before publishing."]
  if (Object.keys(errors).length) throw new HttpError(400, errors)
}

const schoolSettings = structuredClone(db.schoolSettings)
/** Wrong-code attempts per class; five in a row locks that class for a minute. */
const codeAttempts = new Map<string, { wrong: number; lockedUntil: number }>()

/** Which students' parents have linked them on SchoolShop: everyone who ordered, and two in three of the rest. */
const linked = new Set(db.schoolOrderRows.filter((r, i) => r.order || (r.parentPhone && i % 3 !== 0)).map((r) => r.studentId))
let studentSeq = 5000
const mask = (e164: string) => { const l = e164.replace(/^254/, "0"); return `${l.slice(0, 4)} ••• ${l.slice(-3)}` }
const allClasses = () => db.schoolGrades.flatMap((g) => g.classNames.map((className) => ({ className, gradeName: g.gradeName })))

const adminOrgs = new Map(db.adminOrgs.map((o) => [o.id, structuredClone(o)]))
const orgSummary = ({ id, type, name, town, county, status, appliedAt, checks }: AdminOrg) => ({ id, type, name, town, county, status, appliedAt, openChecks: checks.filter((c) => c.state !== "verified").length })

const schoolRows = db.schoolOrderRows.map((r) => structuredClone(r))
const schoolOrders = new Map(db.schoolOrderDetails.map((o) => [o.id, structuredClone(o)]))
const schoolDeliveries = new Map(db.schoolDeliveries.map((d) => [d.id, structuredClone(d)]))

const orders = new Map(db.orders.map((o) => [o.id, structuredClone(o)]))
const otherSchoolOrders = new Map(db.adminExtraOrders.map((o) => [o.id, structuredClone(o)]))
const orderExtras = new Map(Object.entries(db.adminOrderExtras).map(([id, x]) => [id, structuredClone(x)]))
const payments = new Map<string, Payment & { checks: number }>()
let orderSeq = 20430

function studentView(r: StudentOrderRow) {
  return {
    studentId: r.studentId,
    name: r.studentName,
    admissionNo: r.admissionNo,
    gradeName: r.gradeName,
    className: r.className,
    parentName: r.parentName,
    parentPhone: r.parentPhone,
    parentLinked: linked.has(r.studentId),
    hasOrder: !!r.order,
  }
}

function createStudent(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim()
  const admissionNo = String(body.admissionNo ?? "").trim().toUpperCase()
  if (name.length < 2) throw new HttpError(400, { name: ["Enter the student's full name."] })
  if (!admissionNo) throw new HttpError(400, { admissionNo: ["Enter their admission number."] })
  if (schoolRows.some((r) => r.admissionNo === admissionNo)) throw new HttpError(400, { admissionNo: [`${admissionNo} is already on the roll.`] })
  const cls = allClasses().find((c) => c.className === body.className) ?? raise(new HttpError(400, { className: ["Choose a class."] }))
  const phone = body.parentPhone ? String(body.parentPhone) : null
  if (phone && !/^254[17]\d{8}$/.test(phone)) throw new HttpError(400, { parentPhone: ["Enter a Kenyan mobile number."] })
  const row: StudentOrderRow = {
    studentId: `stu-${++studentSeq}`,
    studentName: name,
    admissionNo,
    gradeName: cls.gradeName,
    className: cls.className,
    parentName: body.parentName ? String(body.parentName).trim() : null,
    parentPhone: phone ? mask(phone) : null,
    order: null,
    remindedAt: null,
  }
  schoolRows.push(row)
  return row
}

/* ── Orders as SchoolShop admins see them: every school, the payments behind them and what needs a person. ── */

const allOrders = (): Order[] => [...schoolOrders.values(), ...otherSchoolOrders.values(), ...orders.values()]
const findOrder = (id: string): Order => schoolOrders.get(id) ?? otherSchoolOrders.get(id) ?? orders.get(id) ?? raise(notFound())
const stamp = (d = new Date()) => d.toISOString().replace(/\.\d+Z$/, "+00:00")
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function orderExtra(o: Order): db.AdminOrderExtra {
  let x = orderExtras.get(o.id)
  if (!x) {
    const own = orders.has(o.id)
    const masked = (o as Partial<SchoolOrderDetail>).parentPhone
    // Greenhill's staff see "0712 ••• 345"; admins see the whole number.
    const phone = own ? "254712345678" : masked ? `254${masked.slice(1, 4)}${String(hash(o.id) % 1000).padStart(3, "0")}${masked.slice(-3)}` : null
    const created = o.paidAt ? stamp(new Date(Date.parse(o.paidAt) - 4 * 60_000)) : stamp(new Date(Date.parse("2026-12-28T09:00:00+03:00") + (hash(o.id) % 2000) * 60_000))
    x = { schoolId: db.schools.find((sc) => sc.name === o.schoolName)?.id ?? "sch-greenhill", parentPhone: phone, createdAt: created, issue: null, issueDetail: null, payments: [], events: [] }
    orderExtras.set(o.id, x)
  }
  // Orders without seeded payments follow the order itself, so parents paying in this session show up.
  if (!db.adminOrderExtras[o.id] && x.parentPhone) {
    const failed = o.status === "payment_failed"
    x.payments = o.paidAt || failed ? [{ id: `${o.id}-p1`, at: o.paidAt ?? x.createdAt, phone: x.parentPhone, amountCents: o.totalCents, status: failed ? "failed" : "succeeded", receipt: o.mpesaReceipt, failureReason: failed ? "The parent cancelled on their phone" : null }] : []
  }
  return x
}

const parentNameOf = (o: Order) => (orders.has(o.id) ? db.demoUsers["254712345678"].name : ((o as Partial<SchoolOrderDetail>).parentName ?? null))
const refundedCents = (o: Order) => o.items.filter((i) => i.status === "refunded").reduce((t, i) => t + i.unitPriceCents * i.qty, 0)
const display = (e164: string | null) => (e164 ? e164.replace(/^254(\d{3})(\d{3})(\d{3})$/, "0$1 $2 $3") : null)

function adminOrderSummary(o: Order) {
  const x = orderExtra(o)
  return {
    id: o.id, number: o.number, status: o.status, studentName: o.studentName, className: o.className, schoolId: x.schoolId, schoolName: o.schoolName,
    parentName: parentNameOf(o), parentPhone: display(x.parentPhone), totalCents: o.totalCents, refundedCents: refundedCents(o), createdAt: x.createdAt, mpesaReceipt: o.mpesaReceipt, issue: x.issue,
  }
}

function adminOrder(o: Order): AdminOrder {
  const x = orderExtra(o)
  const parent = parentNameOf(o) ?? "The parent"
  const kes = (c: number) => `KES ${(c / 100).toLocaleString("en-KE")}`
  // The story so far, newest first: what happened to the order, then what people at SchoolShop did.
  const derived = [
    { id: "placed", at: x.createdAt, actor: parent, text: `placed the order for ${o.studentName}` },
    ...x.payments.map((p) => p.status === "unconfirmed"
      ? { id: `pay-${p.id}`, at: p.at, actor: "SchoolShop", text: `sent an M-Pesa request for ${kes(p.amountCents)} to ${display(p.phone)}. M-Pesa hasn't answered.` }
      : { id: `pay-${p.id}`, at: p.at, actor: "M-Pesa", text: p.status === "succeeded" ? `confirmed ${kes(p.amountCents)} from ${display(p.phone)} · ${p.receipt}` : `payment failed: ${p.failureReason}` }),
    ...(o.collectedAt ? [{ id: "collected", at: o.collectedAt, actor: o.schoolName, text: `handed the pack to ${o.studentName}` }] : []),
  ]
  return {
    ...o, schoolId: x.schoolId, admissionNo: (o as Partial<SchoolOrderDetail>).admissionNo ?? null, parentName: parentNameOf(o), parentPhone: display(x.parentPhone),
    createdAt: x.createdAt, refundedCents: refundedCents(o), issue: x.issue, issueDetail: x.issueDetail, refundRequest: x.refundRequest ?? null,
    payments: x.payments.map((p) => ({ ...p, phone: display(p.phone)! })),
    events: [...x.events, ...derived].sort((a, b) => b.at.localeCompare(a.at)),
  }
}

function logOrder(o: Order, userId: string | null, text: string) {
  const x = orderExtra(o)
  x.events.unshift({ id: `ev-${Date.now()}-${x.events.length}`, at: stamp(), actor: usersById().find((u) => u.id === userId)?.name ?? "SchoolShop", text })
  audit(userId, text.startsWith("refunded") ? "money" : "orders", text, { label: o.number, href: `/admin/orders?show=all&order=${o.id}` })
}

/* ── Audit log: every decision SchoolShop staff make, newest first. Append-only. ── */

const auditLog: AuditEntry[] = db.auditSeeds.map((e, i) => ({ id: `au-seed-${i}`, at: new Date(Date.now() - e.hoursAgo * 3_600_000).toISOString().replace(/\.\d+Z$/, "+00:00"), actor: e.actor, role: e.role, category: e.category, text: e.text, target: e.target }))
let auditSeq = 0
function audit(userId: string | null, category: AuditCategory, text: string, target: AuditEntry["target"]) {
  const rec = staffRecord(userId, "platform")
  if (!rec) return
  auditLog.unshift({ id: `au-${++auditSeq}`, at: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"), actor: rec.user.name, role: roleDef("platform", rec.member.role)?.label ?? rec.member.role, category, text, target })
}

/** Keep the school's own order list in step with what admins change. */
function syncSchoolRow(o: Order) {
  const row = schoolRows.find((r) => r.order?.id === o.id)
  if (row?.order) row.order.status = o.status
}

/* ── Refunds and delivery disputes ── */

const refundLog: RefundRecord[] = db.refundLogSeed.map((r) => ({ ...r }))
const actorName = (userId: string | null) => usersById().find((u) => u.id === userId)?.name ?? "SchoolShop"

/** Pay back items on an order to the number that paid, and close whatever asked for it. */
function refundItems(o: Order, itemIds: string[], reason: string, userId: string | null) {
  const x = orderExtra(o)
  const ids = new Set(itemIds)
  const lines = o.items.filter((i) => ids.has(i.id) && i.status !== "refunded")
  if (!lines.length) return 0
  for (const i of lines) i.status = "refunded"
  const amount = lines.reduce((t, i) => t + i.unitPriceCents * i.qty, 0)
  o.status = o.items.every((i) => i.status === "refunded") ? "refunded" : "partially_refunded"
  if (x.issue === "refund_due" || x.issue === "short_delivery") Object.assign(x, { issue: null, issueDetail: null, refundRequest: undefined })
  logOrder(o, userId, `refunded ${formatKes(amount)} to ${display(x.parentPhone) ?? "the parent"} for ${lines.map((i) => i.title).join(", ")}: "${reason}"`)
  refundLog.unshift({ id: `rf-${Date.now()}-${refundLog.length}`, at: stamp(), orderId: o.id, orderNumber: o.number, schoolName: o.schoolName, phone: display(x.parentPhone), amountCents: amount, reason, actor: actorName(userId) })
  syncSchoolRow(o)
  return amount
}

// Greenhill's cases: two PP2 Rose packs from Moran arrived soaked, and two parents asked for money back.
const greenhillPaid = [...schoolOrders.values()].filter((o) => ["in_fulfilment", "at_school"].includes(o.status))
const soaked = greenhillPaid.filter((o) => o.className === "PP2 Rose" && o.items.some((i) => i.publisherName === "Moran")).slice(0, 2)
for (const o of soaked) Object.assign(orderExtra(o), { issue: "short_delivery", issueDetail: `${o.studentName}'s Moran pack arrived soaked through and can't be used.` })
const asking = greenhillPaid.filter((o) => o.status === "in_fulfilment" && !soaked.includes(o)).slice(0, 2)
if (asking[0]) Object.assign(orderExtra(asking[0]), {
  issue: "refund_due", issueDetail: `${asking[0].parentName ?? "The parent"} asked for a full refund: the family is moving to Mombasa before term starts.`,
  refundRequest: { from: "parent", reason: "Moving to a school in Mombasa before term starts.", itemIds: asking[0].items.map((i) => i.id), requestedAt: "2027-01-13T19:20:00+03:00" },
})
if (asking[1]) {
  const item = asking[1].items.find((i) => i.publisherName !== "Moran") ?? asking[1].items[0]
  Object.assign(orderExtra(asking[1]), {
    issue: "refund_due", issueDetail: `${asking[1].parentName ?? "The parent"} asked for ${item.title} back: they already have a copy from an older sibling.`,
    refundRequest: { from: "parent", reason: `Already have ${item.title} from an older sibling.`, itemIds: [item.id], requestedAt: "2027-01-12T08:45:00+03:00" },
  })
}

const disputes = new Map(db.disputeSeeds.map((d) => [d.id, {
  ...d,
  status: "open" as Dispute["status"], resolution: null as string | null,
  orderIds: (d.id === "disp-greenhill" ? soaked : allOrders().filter((o) => orderExtra(o).schoolId === d.schoolId && orderExtra(o).issue === "short_delivery")).map((o) => o.id),
  events: [{ id: "reported", at: d.reportedAt, actor: d.reportedBy, text: d.kind === "short" ? `reported the delivery ${d.packs} packs short` : `reported ${d.packs} packs damaged` }] as Dispute["events"],
}]))
const publisherItems = (o: Order, publisher: string) => o.items.filter((i) => i.publisherName === publisher && i.status !== "refunded")

function disputeView(d: NonNullable<ReturnType<typeof disputes.get>>): Dispute {
  const orders = d.orderIds.map(findOrder).map((o) => {
    const lines = o.items.filter((i) => i.publisherName === d.publisherName)
    return {
      id: o.id, number: o.number, studentName: o.studentName, className: o.className,
      amountCents: lines.reduce((t, i) => t + i.unitPriceCents * i.qty, 0), open: orderExtra(o).issue === "short_delivery", refunded: lines.length > 0 && lines.every((i) => i.status === "refunded"),
    }
  })
  const payout = d.payoutId ? findPayout(d.payoutId) : null
  return {
    id: d.id, kind: d.kind, schoolName: d.schoolName, publisherName: d.publisherName, deliveryNoteNo: d.deliveryNoteNo, packs: d.packs, detail: d.detail,
    reportedAt: d.reportedAt, reportedBy: d.reportedBy, status: d.status, resolution: d.resolution, orders,
    refundCents: orders.filter((o) => o.open && !o.refunded).reduce((t, o) => t + o.amountCents, 0),
    payout: payout ? { id: payout.id, status: payout.status, netCents: payout.netCents } : null,
    events: [...d.events].sort((a, b) => b.at.localeCompare(a.at)),
  }
}

function refundsView(): AdminRefunds {
  const requests = allOrders().flatMap((o) => {
    const x = orderExtra(o)
    if (x.issue !== "refund_due" || !x.refundRequest) return []
    const want = new Set(x.refundRequest.itemIds)
    const items = o.items.filter((i) => want.has(i.id) && i.status !== "refunded").map((i) => ({ id: i.id, title: i.title, publisherName: i.publisherName, amountCents: i.unitPriceCents * i.qty }))
    return [{ orderId: o.id, orderNumber: o.number, studentName: o.studentName, schoolName: o.schoolName, parentName: parentNameOf(o), parentPhone: display(x.parentPhone),
      from: x.refundRequest.from, reason: x.refundRequest.reason, items, amountCents: items.reduce((t, i) => t + i.amountCents, 0), requestedAt: x.refundRequest.requestedAt }]
  }).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  return { requests, disputes: [...disputes.values()].map(disputeView).sort((a, b) => (a.status === b.status ? a.reportedAt.localeCompare(b.reportedAt) : a.status === "open" ? -1 : 1)), refunded: refundLog }
}

/** resolution is shown on its own ("Refunded KES 3,900 to 6 parents."); the history line reads after the actor's name. */
function settleDispute(d: NonNullable<ReturnType<typeof disputes.get>>, resolution: string, userId: string | null) {
  d.status = "resolved"
  d.resolution = resolution
  d.events.unshift({ id: `de-${Date.now()}`, at: stamp(), actor: actorName(userId), text: `settled it. ${resolution}` })
  audit(userId, "money", `settled ${d.schoolName}'s dispute with ${d.publisherName}. ${resolution}`, { label: `${d.schoolName} · ${d.publisherName}`, href: "/admin/refunds?tab=disputes" })
  if (d.payoutId) {
    const p = findPayout(d.payoutId)
    if (p.status === "on_hold") {
      p.status = p.receivedAt ? "queued" : "held"
      payoutNote(p).holdReason = null
      logPayout(p.id, userId, `took the hold off: dispute settled. ${resolution}`)
    }
  }
}

/* ── Payouts across every publisher. Longhorn's are the same records its own Payouts page reads. ── */

type PayoutRecord = (typeof payouts.payouts)[number]
const longhornHold = (p: PayoutRecord) => (p.status === "on_hold" ? `${p.schoolName} reported a short delivery. ${p.deductionNote ?? ""}`.trim() : null)
function payoutNote(p: PayoutRecord & { holdReason?: string | null }) {
  let n = payoutNotes.get(p.id)
  if (!n) payoutNotes.set(p.id, (n = { holdReason: p.holdReason !== undefined ? p.holdReason : longhornHold(p), events: [] }))
  return n
}
const accountFor = (publisherId: string) => (publisherId === "pub-longhorn" ? payouts.account : publisherAccounts[publisherId].account)

function adminPayouts(): AdminPayout[] {
  const all = [
    ...payouts.payouts.filter((p) => p.termName === "Term 1, 2027").map((p) => ({ ...p, publisherId: "pub-longhorn", packs: Math.round(p.grossCents / 60_000) })),
    ...otherPayouts.map(({ holdReason: _h, ...p }) => p),
  ]
  const order = { queued: 0, on_hold: 1, held: 2, paid: 3 }
  return all
    .map((p) => {
      const rec = findPayout(p.id)
      const note = payoutNote(rec)
      const derived = [
        ...(p.receivedAt ? [{ id: "received", at: p.receivedAt, actor: p.schoolName, text: `confirmed the delivery (${p.deliveryNoteNo})` }] : []),
        ...(p.paidAt && !note.events.some((e) => e.text.startsWith("released")) ? [{ id: "paid", at: p.paidAt, actor: "SchoolShop Finance", text: `released the payout · ${p.reference}` }] : []),
      ]
      return {
        ...p, publisherName: p.publisherId === "pub-longhorn" ? "Longhorn Publishers" : publisherAccounts[p.publisherId].name, account: accountFor(p.publisherId),
        holdReason: p.status === "on_hold" ? note.holdReason : null, events: [...note.events, ...derived].sort((a, b) => b.at.localeCompare(a.at)),
      }
    })
    .sort((a, b) => order[a.status] - order[b.status] || (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""))
}
function findPayout(id: string): PayoutRecord & { publisherId?: string; holdReason?: string | null } {
  return payouts.payouts.find((p) => p.id === id) ?? otherPayouts.find((p) => p.id === id) ?? raise(notFound())
}
const publisherOf = (id: string) => (payouts.payouts.some((p) => p.id === id) ? "pub-longhorn" : findPayout(id).publisherId!)
function logPayout(id: string, userId: string | null, text: string) {
  const p = findPayout(id)
  payoutNote(p).events.unshift({ id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: stamp(), actor: usersById().find((u) => u.id === userId)?.name ?? "SchoolShop", text })
  const publisher = publisherOf(id) === "pub-longhorn" ? "Longhorn Publishers" : publisherAccounts[publisherOf(id)].name
  audit(userId, "money", text, { label: `${publisher} · ${p.schoolName}`, href: `/admin/payments?show=all&payout=${id}` })
}
const money = () => ({ termName: "Term 1, 2027", commissionRate: platform.commission.defaultRate, payouts: adminPayouts() })

/** The API's key for each check (apps/accounts/organisations.py). */
const checkKey = (label: string) =>
  ({ "Ministry of Education registration": "registration", "Certificate of incorporation": "registration", "KRA PIN certificate": "kra_pin", "Head teacher's phone verified": "phone", "Class list": "class_list", "Payout account": "payout_account", "Catalog sample": "catalog_sample" })[label] ?? label
const documentsView = (org: AdminOrg) => ({
  orgName: org.name, orgType: org.type, status: org.status, open: org.status === "pending" || org.status === "info_requested",
  documents: [...org.checks].sort((a, b) => a.label.localeCompare(b.label)).map((c) => ({ key: checkKey(c.label), label: c.label, state: c.state, fileName: c.fileName, canUpload: checkKey(c.label) !== "phone" && c.state !== "verified" })),
})

function logOrg(org: AdminOrg, userId: string | null, text: string) {
  const actor = usersById().find((u) => u.id === userId)?.name ?? "SchoolShop"
  org.history.unshift({ id: `h-${Date.now()}-${org.history.length}`, at: new Date().toISOString().replace("Z", "+00:00"), actor, text })
  audit(userId, "organisations", text, { label: org.name, href: `/admin/organisations?org=${org.id}` })
}

/* ── Catalog review: publishers' new titles and price changes wait for a check. ── */

/** Files publishers attached in this session, for downloads. */
const mockFiles = new Map<string, File>()

/** Rows of a CSV file, with quoted fields ("A4 books, 96 pg") kept whole. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") { row.push(field); field = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field); rows.push(row); row = []; field = ""
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.map((r) => r.map((v) => v.replace(/^\uFEFF/, "")))
}

const gradeBandOf = (label: string): CatalogItem["gradeBand"] => {
  if (/^PP/i.test(label)) return "pp"
  const n = Number(label.match(/\d+/)?.[0])
  return !n ? "all" : n <= 3 ? "1-3" : n <= 6 ? "4-6" : "7-9"
}
/** "Moran's", but "Longhorn Publishers'". */
const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`)
const isbnValid = (isbn: string) => {
  const d = isbn.replace(/[^\d]/g, "")
  if (d.length !== 13) return false
  const sum = [...d.slice(0, 12)].reduce((t, c, i) => t + Number(c) * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(d[12])
}
type SubmissionRecord = Omit<CatalogSubmission, "checks" | "similar" | "coverUrl" | "files"> & { catalogId?: string }
const submissions = new Map<string, SubmissionRecord>(db.catalogSubmissionSeeds.map((x) => {
  const at = new Date(Date.now() - x.hoursAgo * 3_600_000).toISOString().replace(/\.\d+Z$/, "+00:00")
  const decided = x.status && x.status !== "pending"
  return [x.id, {
    id: x.id, publisherId: x.publisherId, publisherName: x.publisherName, kind: x.kind, title: x.title, subject: x.subject, gradeLabel: x.gradeLabel, isbn: x.isbn, format: x.format,
    priceCents: x.price * 100, previousPriceCents: x.previous ? x.previous * 100 : null, submittedAt: at, status: x.status ?? "pending", note: x.note ?? null,
    history: [
      ...(decided ? [{ id: "decided", at: new Date(Date.parse(at) + 3 * 3_600_000).toISOString().replace(/\.\d+Z$/, "+00:00"), actor: x.status === "approved" ? "SchoolShop Ops" : "Kevin Mutai", text: x.status === "approved" ? "approved it" : x.status === "rejected" ? `rejected it: "${x.note}"` : `asked for changes: "${x.note}"` }] : []),
      { id: "sent", at, actor: x.publisherName, text: x.kind === "new_title" ? "sent a new title" : `asked to change the price from ${formatKes((x.previous ?? 0) * 100)} to ${formatKes(x.price * 100)}` },
    ],
  }]
}))

/** The automatic checks: a real ISBN nobody else uses, a price in line with similar titles, a CBC grade. */
function submissionView(x: SubmissionRecord): CatalogSubmission {
  const similar = db.products
    .filter((p) => p.subject.toLowerCase().split(" ")[0] === x.subject.toLowerCase().split(" ")[0] && (gradeBandOf(x.gradeLabel) === "all" || p.gradeBand === gradeBandOf(x.gradeLabel)) && p.title !== x.title)
    .slice(0, 4)
    .map((p) => ({ title: p.title, publisherName: p.publisherName, priceCents: p.priceCents }))
  const checks: CatalogSubmission["checks"] = []
  if (x.kind === "new_title" || x.isbn) {
    const others = [
      ...db.products.filter((p) => p.title !== x.title).map((p) => ({ isbn: db.productExtras[p.id]?.isbn, owner: `${p.publisherName}'s ${p.title}` })),
      ...[...catalog.values()].filter((c) => c.id !== x.catalogId).map((c) => ({ isbn: c.isbn, owner: `Longhorn's ${c.title}` })),
    ]
    const clash = x.isbn ? others.find((o) => o.isbn && o.isbn.replace(/\D/g, "") === x.isbn!.replace(/\D/g, "")) : undefined
    checks.push(
      !x.isbn ? { id: "isbn", label: "ISBN", result: x.subject === "Stationery" ? "pass" : "warn", detail: x.subject === "Stationery" ? "Not needed for stationery." : "No ISBN, so schools can't check the edition." }
      : !isbnValid(x.isbn) ? { id: "isbn", label: "ISBN", result: "fail", detail: `${x.isbn} isn't a valid ISBN-13. The last digit doesn't match.` }
      : clash ? { id: "isbn", label: "ISBN", result: "fail", detail: `${x.isbn} is already used by ${clash.owner}.` }
      : { id: "isbn", label: "ISBN", result: "pass", detail: `${x.isbn} is valid and not used by any other title.` },
    )
  }
  if (x.kind === "price_change" && x.previousPriceCents) {
    const up = (x.priceCents - x.previousPriceCents) / x.previousPriceCents
    checks.push({ id: "price", label: "Price change", result: up > 0.1 ? "warn" : "pass", detail: `${up >= 0 ? "Up" : "Down"} ${Math.round(Math.abs(up) * 100)}%, from ${formatKes(x.previousPriceCents)}.${up > 0.1 ? " Parents with open orders keep the old price." : ""}` })
  } else if (similar.length) {
    const sorted = similar.map((p) => p.priceCents).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const over = (x.priceCents - median) / median
    checks.push({ id: "price", label: "Price", result: over > 1 ? "fail" : over > 0.2 ? "warn" : "pass", detail: over > 0.2 ? `${Math.round(over * 100)}% above similar titles (around ${formatKes(median)}).` : `In line with similar titles (around ${formatKes(median)}).` })
  } else checks.push({ id: "price", label: "Price", result: "pass", detail: "No similar titles on SchoolShop to compare with." })
  const grade = /^(PP[12]|Grade [1-9])$/.test(x.gradeLabel) || x.gradeLabel === "All grades"
  checks.push({ id: "grade", label: "CBC grade", result: grade ? "pass" : "warn", detail: x.gradeLabel === "All grades" ? "For every grade, like stationery." : grade ? `${x.gradeLabel} is a CBC grade.` : `"${x.gradeLabel}" isn't a CBC grade. Check where it belongs.` })
  const org = adminOrgs.get(x.publisherId)
  checks.push({ id: "publisher", label: "Publisher", result: org?.status === "live" ? "pass" : "fail", detail: org?.status === "live" ? `${x.publisherName} is verified.` : `${x.publisherName} isn't verified or is paused.` })
  const { catalogId: _c, ...rest } = x
  const linked = x.catalogId ? catalog.get(x.catalogId) : undefined
  return { ...rest, checks, similar, coverUrl: linked?.coverUrl ?? null, files: linked?.files ?? [] }
}
/* ── Platform settings ── */

const platform = structuredClone(db.platformSettings)
const settingsUpdated: PlatformSettings["updated"] = {
  commission: { at: "2026-08-01T09:00:00+03:00", by: "SchoolShop Ops" },
  payouts: { at: "2026-08-01T09:00:00+03:00", by: "SchoolShop Ops" },
  terms: { at: "2026-09-15T11:30:00+03:00", by: "Kevin Mutai" },
}
const rateFor = (publisherId: string) => platform.commission.overrides.find((o) => o.publisherId === publisherId)?.rate ?? platform.commission.defaultRate
/** Commission is fixed when the school confirms delivery, so only payouts still waiting for delivery take a new rate. */
function repriceWaiting() {
  for (const p of [...payouts.payouts, ...otherPayouts]) {
    if (p.status !== "held") continue
    p.commissionCents = Math.round(p.grossCents * rateFor(publisherOf(p.id)))
    p.netCents = p.grossCents - p.commissionCents - p.deductionsCents
  }
  payouts.commissionRate = rateFor("pub-longhorn")
}
repriceWaiting()
const settingsView = (): PlatformSettings => ({
  ...structuredClone(platform),
  publishers: [...adminOrgs.values()].filter((o) => o.type === "publisher" && o.status === "live").map((o) => ({ id: o.id, name: o.name })),
  updated: settingsUpdated,
})
const pct = (r: number) => `${Math.round(r * 1000) / 10}%`

/** Check a section and say in words what changed, for the audit log. */
function applySettings(section: string, body: Record<string, unknown>): string[] {
  const bad = (field: string, msg: string): never => { throw new HttpError(400, { [field]: [msg] }) }
  const changes: string[] = []
  const was = <T,>(label: string, a: T, b: T, show: (v: T) => string = String) => { if (a !== b) changes.push(`changed ${label} from ${show(a)} to ${show(b)}`) }
  switch (section) {
    case "commission": {
      const next = body as PlatformSettings["commission"]
      if (!(next.defaultRate >= 0 && next.defaultRate <= 0.3)) bad("defaultRate", "Commission must be between 0% and 30%.")
      const seen = new Set<string>()
      for (const o of next.overrides) {
        if (!adminOrgs.get(o.publisherId)) bad("overrides", "Choose a publisher.")
        if (seen.has(o.publisherId)) bad("overrides", `${o.publisherName} has two rates. Keep one.`)
        seen.add(o.publisherId)
        if (!(o.rate >= 0 && o.rate <= 0.3)) bad("overrides", `${o.publisherName}'s rate must be between 0% and 30%.`)
        if (!o.note.trim()) bad("overrides", `Say why ${o.publisherName} has its own rate.`)
      }
      was("the default commission", platform.commission.defaultRate, next.defaultRate, pct)
      for (const o of next.overrides) {
        const before = platform.commission.overrides.find((x) => x.publisherId === o.publisherId)
        if (!before) changes.push(`gave ${o.publisherName} its own rate of ${pct(o.rate)}`)
        else was(`${o.publisherName}'s rate`, before.rate, o.rate, pct)
      }
      for (const o of platform.commission.overrides) if (!seen.has(o.publisherId)) changes.push(`put ${o.publisherName} back on the default rate`)
      platform.commission = { defaultRate: next.defaultRate, overrides: next.overrides.map((o) => ({ ...o, publisherName: adminOrgs.get(o.publisherId)!.name, note: o.note.trim() })) }
      repriceWaiting()
      break
    }
    case "payouts": {
      const next = body as PlatformSettings["payouts"]
      if (!(Number.isInteger(next.holdDays) && next.holdDays >= 0 && next.holdDays <= 14)) bad("holdDays", "Between 0 and 14 days.")
      if (!(next.minimumCents >= 0 && next.minimumCents <= 10_000_000)) bad("minimumCents", "Between KES 0 and KES 100,000.")
      was("the hold after delivery", platform.payouts.holdDays, next.holdDays, (d) => `${d} day${d === 1 ? "" : "s"}`)
      was("the minimum payout", platform.payouts.minimumCents, next.minimumCents, formatKes)
      was("automatic release", platform.payouts.autoRelease, next.autoRelease, (v) => (v ? "on" : "off"))
      platform.payouts = { holdDays: next.holdDays, minimumCents: next.minimumCents, autoRelease: !!next.autoRelease }
      break
    }
    case "refunds": {
      const next = body as PlatformSettings["refunds"]
      if (!(next.autoApproveUpToCents >= 0 && next.autoApproveUpToCents <= 500_000)) bad("autoApproveUpToCents", "Between KES 0 and KES 5,000.")
      was("automatic out-of-stock refunds", platform.refunds.autoApproveUpToCents, next.autoApproveUpToCents, (c) => (c ? `up to ${formatKes(c)}` : "off"))
      was("parents' refund requests", platform.refunds.parentRequestsUntil, next.parentRequestsUntil, (v) => (v === "dispatched" ? "until dispatch" : "until the pack reaches school"))
      platform.refunds = { autoApproveUpToCents: next.autoApproveUpToCents, parentRequestsUntil: next.parentRequestsUntil }
      break
    }
    case "mpesa": {
      const next = body as PlatformSettings["mpesa"]
      if (!/^\d{5,7}$/.test(next.paybill)) bad("paybill", "A Paybill number has 5 to 7 digits.")
      if (!(Number.isInteger(next.callbackTimeoutMinutes) && next.callbackTimeoutMinutes >= 1 && next.callbackTimeoutMinutes <= 10)) bad("callbackTimeoutMinutes", "Between 1 and 10 minutes.")
      was("the Paybill", platform.mpesa.paybill, next.paybill)
      was("the M-Pesa wait", platform.mpesa.callbackTimeoutMinutes, next.callbackTimeoutMinutes, (m) => `${m} min`)
      platform.mpesa = { paybill: next.paybill, callbackTimeoutMinutes: next.callbackTimeoutMinutes }
      break
    }
    case "terms": {
      const next = (body as unknown as { terms: PlatformSettings["terms"] }).terms
      const iso = /^\d{4}-\d{2}-\d{2}$/
      next.forEach((t, i) => {
        if (!t.name.trim()) bad(`terms.${i}.name`, "Give the term a name.")
        if (![t.orderingOpensOn, t.startsOn, t.endsOn].every((d) => iso.test(d))) bad(`terms.${i}.startsOn`, "Enter all three dates.")
        if (t.orderingOpensOn > t.startsOn) bad(`terms.${i}.orderingOpensOn`, "Ordering has to open before the term starts.")
        if (t.startsOn >= t.endsOn) bad(`terms.${i}.endsOn`, "The term has to end after it starts.")
        const clash = next.find((o, j) => j !== i && o.startsOn <= t.endsOn && t.startsOn <= o.endsOn)
        if (clash) bad(`terms.${i}.startsOn`, `${t.name} overlaps ${clash.name}.`)
      })
      for (const t of next) {
        const before = platform.terms.find((x) => x.id === t.id)
        if (!before) changes.push(`added ${t.name} (${t.startsOn} to ${t.endsOn})`)
        else if (before.startsOn !== t.startsOn || before.endsOn !== t.endsOn || before.orderingOpensOn !== t.orderingOpensOn || before.name !== t.name) changes.push(`changed ${t.name}'s dates`)
      }
      for (const t of platform.terms) if (!next.some((x) => x.id === t.id)) changes.push(`removed ${t.name}`)
      platform.terms = next.map((t, i) => ({ ...t, id: t.id || `t-new-${Date.now()}-${i}`, name: t.name.trim() })).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      break
    }
    case "support": {
      const next = body as PlatformSettings["support"]
      if (!normaliseKenyanPhone(next.phone)) bad("phone", "Enter a Kenyan phone number.")
      if (next.whatsapp && !normaliseKenyanPhone(next.whatsapp)) bad("whatsapp", "Enter a Kenyan phone number.")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) bad("email", "Enter an email address.")
      if (!next.hours.trim()) bad("hours", "Say when parents can reach you.")
      for (const [k, label] of [["phone", "the support phone"], ["whatsapp", "WhatsApp"], ["email", "the support email"], ["hours", "support hours"]] as const) was(label, platform.support[k], next[k].trim())
      platform.support = { phone: next.phone.trim(), whatsapp: next.whatsapp.trim(), email: next.email.trim(), hours: next.hours.trim() }
      break
    }
    case "payments": {
      // Mock mode keeps only the last four characters of a key, like the server shows them.
      const next = body as unknown as PaymentsInput
      const hint = (v: string, kept: string | null) => (v ? `••••${v.slice(-4)}` : kept)
      if (next.sasapay.merchantCode && !/^\d{3,10}$/.test(next.sasapay.merchantCode)) bad("sasapay.merchantCode", "SasaPay's merchant code is 3 to 10 digits.")
      const p = platform.payments
      if (next.sasapay.enabled !== p.sasapay.enabled) changes.push(`switched M-Pesa (SasaPay) ${next.sasapay.enabled ? "on" : "off"}`)
      if (next.cardProvider !== p.cardProvider) changes.push(next.cardProvider === "none" ? "switched card payments off" : `sent card payments through ${next.cardProvider === "stripe" ? "Stripe" : "Paystack"}`)
      platform.payments = {
        ...p,
        sasapay: { ...p.sasapay, enabled: next.sasapay.enabled, mode: next.sasapay.mode, merchantCode: next.sasapay.merchantCode, clientId: hint(next.sasapay.clientId, p.sasapay.clientId), clientSecret: hint(next.sasapay.clientSecret, p.sasapay.clientSecret) },
        cardProvider: next.cardProvider,
        stripe: { ...p.stripe, secretKey: hint(next.stripe.secretKey, p.stripe.secretKey), webhookSecret: hint(next.stripe.webhookSecret, p.stripe.webhookSecret) },
        paystack: { ...p.paystack, secretKey: hint(next.paystack.secretKey, p.paystack.secretKey) },
        mpesaReady: next.sasapay.enabled,
        cardReady: next.cardProvider !== "none",
      }
      break
    }
    default:
      throw notFound()
  }
  return changes
}

const submissionList = () => [...submissions.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(submissionView)

function collectionRow(o: SchoolOrderDetail): CollectionRow {
  const waitingFor = o.shipments.filter((s) => s.status !== "received").map((s) => s.publisherName)
  return {
    orderId: o.id,
    orderNumber: o.number,
    studentName: o.studentName,
    admissionNo: o.admissionNo,
    gradeName: o.className.startsWith("PP") ? o.className.split(" ")[0] : `Grade ${o.className.split(" ")[0]}`,
    className: o.className,
    itemCount: o.items.length,
    status: o.status === "collected" ? "collected" : o.status === "at_school" ? "ready" : "waiting",
    waitingFor: o.status === "in_fulfilment" ? waitingFor : [],
    collectedAt: o.collectedAt,
    parentPhone: o.parentPhone,
  }
}

/* ── Staff and access ─────────────────────────────────────────── */

const directories = structuredClone(db.staffDirectories)
let staffSeq = 100
const scopeOrg: Record<string, OrgType> = { school: "school", publisher: "publisher", admin: "platform" }
const sameContact = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase()
const usersById = () => Object.values(db.demoUsers)

/** The staff record behind a signed-in user at one kind of organisation. */
function staffRecord(userId: string | null, orgType: OrgType) {
  const user = usersById().find((u) => u.id === userId)
  if (!user) return null
  const member = directories[orgType].members.find((m) => sameContact(m.contact, user.phone) || sameContact(m.contact, user.email))
  return member ? { user, member } : null
}

/** The user with each membership's current role, permissions and classes. Suspended staff can't sign in. */
function withAccess(user: (typeof db.demoUsers)[string], signingIn = false) {
  const memberships = user.memberships.map((m) => {
    const rec = staffRecord(user.id, m.orgType)
    if (rec?.member.status === "suspended" && signingIn) throw new HttpError(403, { password: ["Your access has been paused by your admin. Ask them to turn it back on."] })
    if (rec && rec.member.status === "invited") rec.member.status = "active"
    return { ...m, staffRole: rec?.member.role ?? "", permissions: rec ? permissionsFor(m.orgType, rec.member.role) : [], classNames: rec?.member.classNames ?? [] }
  })
  return { ...user, memberships }
}

/** Which permission each API call needs. First match wins. */
const guards: Array<[method: string, path: RegExp, orgType: OrgType, permission: string]> = [
  ["get", /^\/school\/overview\/$/, "school", "overview.view"],
  ["*", /^\/school\/(booklists|catalog)\//, "school", "booklists.manage"],
  ["post", /^\/school\/orders\/remind\/$/, "school", "orders.remind"],
  ["get", /^\/school\/orders\//, "school", "orders.view"],
  ["*", /^\/school\/deliveries\//, "school", "deliveries.receive"],
  ["*", /^\/school\/collection\//, "school", "collection.handout"],
  ["*", /^\/school\/settings\//, "school", "settings.manage"],
  ["*", /^\/school\/students\//, "school", "settings.manage"],
  ["*", /^\/school\/staff\//, "school", "staff.manage"],
  ["post", /^\/publisher\/batches\/[^/]+\/dispatch\/$/, "publisher", "dispatch.manage"],
  ["get", /^\/publisher\/(batches|overview)\/$/, "publisher", "orders.view"],
  ["*", /^\/publisher\/catalog\//, "publisher", "catalog.manage"],
  ["put", /^\/publisher\/payout-account\/$/, "publisher", "payouts.manage"],
  ["get", /^\/publisher\/payouts\/$/, "publisher", "payouts.view"],
  ["*", /^\/publisher\/settings\//, "publisher", "settings.manage"],
  ["*", /^\/publisher\/staff\//, "publisher", "staff.manage"],
  ["get", /^\/admin\/overview\/$/, "platform", "overview.view"],
  ["get", /^\/admin\/organisations\//, "platform", "orgs.view"],
  ["post", /^\/admin\/orders\/[^/]+\/(refund|resolve)\/$/, "platform", "refunds.approve"],
  ["get", /^\/admin\/(money|collections|refunds)\//, "platform", "money.view"],
  ["*", /^\/admin\/catalog\//, "platform", "catalog.review"],
  ["get", /^\/admin\/audit\//, "platform", "audit.view"],
  ["*", /^\/admin\/settings\//, "platform", "settings.fees"],
  ["post", /^\/admin\/(refunds|disputes)\//, "platform", "refunds.approve"],
  ["post", /^\/admin\/(payouts|payout-accounts)\//, "platform", "payouts.release"],
  ["*", /^\/admin\/orders\//, "platform", "orders.view"],
  ["post", /^\/admin\/organisations\//, "platform", "orgs.verify"],
  ["*", /^\/admin\/staff\//, "platform", "staff.manage"],
]

function checkAccess(method: string, path: string, userId: string | null) {
  const guard = guards.find(([m, re]) => (m === "*" || m === method) && re.test(path))
  if (!guard) return
  const [, , orgType, permission] = guard
  const rec = staffRecord(userId, orgType)
  if (!rec) throw new HttpError(401, { detail: "Sign in again." })
  if (rec.member.status === "suspended") throw new HttpError(403, { detail: "Your access has been paused by your admin." })
  if (!permissionsFor(orgType, rec.member.role).includes(permission)) {
    throw new HttpError(403, { detail: `Your role (${roleDef(orgType, rec.member.role)?.label ?? rec.member.role}) can't do this. Ask an admin if you need it.` })
  }
}

/** Teachers see and hand out packs only for their classes. */
function classScope(userId: string | null) {
  const rec = staffRecord(userId, "school")
  return rec && roleDef("school", rec.member.role)?.scopedToClasses ? new Set(rec.member.classNames) : null
}

function directoryFor(scope: string, userId: string | null) {
  const orgType = scopeOrg[scope]
  const me = staffRecord(userId, orgType)
  const d = directories[orgType]
  return {
    members: d.members.map((m) => ({ ...m, isYou: m.id === me?.member.id })),
    activity: d.activity.slice(0, 12),
    classNames: orgType === "school" ? db.schoolGrades.flatMap((g) => g.classNames) : [],
  }
}

function logStaff(orgType: OrgType, userId: string | null, text: string) {
  const actor = usersById().find((u) => u.id === userId)?.name ?? "Someone"
  directories[orgType].activity.unshift({ id: `a-${++staffSeq}`, at: new Date().toISOString(), actor, text })
  if (orgType === "platform") audit(userId, "staff", text, { label: "Staff & roles", href: "/admin/staff" })
}

const staffRoutes: Array<[method: string, pattern: string, handler: (ctx: { params: Record<string, string>; body: Record<string, unknown>; userId: string | null }) => unknown]> = [
  ["get", "/:scope/staff/", ({ params, userId }) => directoryFor(params.scope, userId)],
  ["post", "/:scope/staff/", ({ params, body, userId }) => {
    const orgType = scopeOrg[params.scope]
    const d = directories[orgType]
    const name = String(body.name ?? "").trim()
    const contact = String(body.contact ?? "").trim()
    const role = roleDef(orgType, String(body.role ?? "")) ?? raise(new HttpError(400, { role: ["Choose a role."] }))
    if (name.length < 2) throw new HttpError(400, { name: ["Enter their name."] })
    if (d.members.some((m) => sameContact(m.contact, contact))) throw new HttpError(400, { contact: ["Someone here already uses this."] })
    const classNames = role.scopedToClasses ? validClasses(body.classNames) : []
    if (role.scopedToClasses && classNames.length === 0) throw new HttpError(400, { classNames: ["Choose at least one class."] })
    d.members.push({ id: `sm-${++staffSeq}`, name, contact, role: role.id, classNames, status: "invited", lastActiveAt: null })
    logStaff(orgType, userId, `invited ${name} as ${role.label}${classNames.length ? ` for ${classNames.join(", ")}` : ""}`)
    return directoryFor(params.scope, userId)
  }],
  ["patch", "/:scope/staff/:id/", ({ params, body, userId }) => {
    const orgType = scopeOrg[params.scope]
    const d = directories[orgType]
    const member = d.members.find((m) => m.id === params.id) ?? raise(notFound())
    const me = staffRecord(userId, orgType)?.member
    const owners = () => d.members.filter((m) => m.role === ownerRole[orgType] && m.status === "active")
    if (member.id === me?.id && (body.role !== undefined || body.status !== undefined)) throw new HttpError(400, { detail: "You can't change your own role or access. Ask another admin." })
    if (body.role !== undefined) {
      const role = roleDef(orgType, String(body.role)) ?? raise(new HttpError(400, { role: ["Choose a role."] }))
      if (member.role === ownerRole[orgType] && role.id !== member.role && owners().length === 1) throw new HttpError(400, { role: [`Keep at least one ${roleDef(orgType, ownerRole[orgType])!.label}.`] })
      if (role.id !== member.role) logStaff(orgType, userId, `made ${member.name} ${role.label}`)
      member.role = role.id
      if (!role.scopedToClasses) member.classNames = []
    }
    if (body.classNames !== undefined) {
      const classNames = validClasses(body.classNames)
      if (roleDef(orgType, member.role)?.scopedToClasses && classNames.length === 0) throw new HttpError(400, { classNames: ["Choose at least one class."] })
      member.classNames = classNames
      logStaff(orgType, userId, `set ${member.name}'s classes to ${classNames.join(", ")}`)
    }
    if (body.status === "suspended" || body.status === "active") {
      if (body.status === "suspended" && member.role === ownerRole[orgType] && owners().length === 1) throw new HttpError(400, { detail: `Keep at least one ${roleDef(orgType, ownerRole[orgType])!.label}.` })
      if (member.status === "invited" && body.status === "active") throw new HttpError(400, { detail: "They need to accept the invite first." })
      member.status = body.status
      logStaff(orgType, userId, body.status === "suspended" ? `paused ${member.name}'s access` : `turned ${member.name}'s access back on`)
    }
    return directoryFor(params.scope, userId)
  }],
  ["delete", "/:scope/staff/:id/", ({ params, userId }) => {
    const orgType = scopeOrg[params.scope]
    const d = directories[orgType]
    const member = d.members.find((m) => m.id === params.id) ?? raise(notFound())
    if (member.id === staffRecord(userId, orgType)?.member.id) throw new HttpError(400, { detail: "You can't remove yourself." })
    if (member.role === ownerRole[orgType] && d.members.filter((m) => m.role === member.role && m.status === "active").length === 1 && member.status === "active")
      throw new HttpError(400, { detail: `Keep at least one ${roleDef(orgType, ownerRole[orgType])!.label}.` })
    d.members = d.members.filter((m) => m.id !== member.id)
    logStaff(orgType, userId, `removed ${member.name}`)
    return directoryFor(params.scope, userId)
  }],
  ["post", "/:scope/staff/:id/resend/", ({ params, userId }) => {
    const orgType = scopeOrg[params.scope]
    const member = directories[orgType].members.find((m) => m.id === params.id) ?? raise(notFound())
    if (member.status !== "invited") throw new HttpError(400, { detail: `${member.name} has already joined.` })
    logStaff(orgType, userId, `resent ${member.name}'s invite`)
    return directoryFor(params.scope, userId)
  }],
]

function validClasses(names: unknown) {
  const all = db.schoolGrades.flatMap((g) => g.classNames)
  const list = Array.isArray(names) ? names.map(String) : []
  const bad = list.find((c) => !all.includes(c))
  if (bad) throw new HttpError(400, { classNames: [`${bad} isn't a class at this school.`] })
  return list
}

class HttpError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    super(`HTTP ${status}`)
    this.status = status
    this.data = data
  }
}
const notFound = () => new HttpError(404, { detail: "Not found." })

const routes: Array<[method: string, pattern: string, handler: Handler]> = [
  ["post", "/auth/login/", ({ body }) => {
    const user = findUser(String(body.identifier ?? ""))
    if (!user || passwords.get(user.phone) !== body.password) {
      throw new HttpError(400, { password: ["That password doesn't match this account. Try again or reset it."] })
    }
    return tokensFor(user)
  }],
  ["post", "/auth/otp/request/", ({ body }) => {
    const phone = String(body.phone)
    if (!db.demoUsers[phone]) throw new HttpError(400, { phone: ["No SchoolShop account uses this number yet."] })
    return { sent: true, channel: "sms", destination: maskPhone(phone) }
  }],
  ["post", "/auth/otp/verify/", ({ body }) => {
    const user = db.demoUsers[String(body.phone)]
    if (!user || body.code !== DEMO_CODE) throw new HttpError(400, { code: ["That code is wrong or has expired."] })
    return tokensFor(user)
  }],
  ["post", "/auth/register/", ({ body }) => {
    const phone = String(body.phone ?? "")
    if (db.demoUsers[phone]) throw new HttpError(400, { phone: ["An account already uses this number. Sign in instead."] })
    pendingSignups.set(phone, { name: String(body.name ?? ""), password: String(body.password ?? "") })
    return { sent: true, channel: "sms", destination: maskPhone(phone) }
  }],
  ["post", "/auth/register/resend/", ({ body }) => {
    const phone = String(body.phone ?? "")
    if (!pendingSignups.has(phone)) throw new HttpError(400, { phone: ["Start sign-up again."] })
    return { sent: true, channel: "sms", destination: maskPhone(phone) }
  }],
  ["post", "/auth/register/verify/", ({ body }) => {
    const phone = String(body.phone ?? "")
    const pending = pendingSignups.get(phone)
    if (!pending || body.code !== DEMO_CODE) throw new HttpError(400, { code: ["That code is wrong or has expired."] })
    pendingSignups.delete(phone)
    const created = { id: `usr-${++userSeq}`, name: pending.name, phone, email: null, roles: ["parent" as const], memberships: [] }
    db.demoUsers[phone] = created
    passwords.set(phone, pending.password)
    return tokensFor(created)
  }],
  ["post", "/auth/password/forgot/", ({ body }) => {
    const identifier = String(body.identifier ?? "")
    const user = findUser(identifier)
    if (!user) throw new HttpError(400, { identifier: ["We couldn't find an account with that phone number or email."] })
    return identifier.includes("@")
      ? { sent: true, channel: "email", destination: maskEmail(identifier) }
      : { sent: true, channel: "sms", destination: maskPhone(user.phone) }
  }],
  ["post", "/auth/password/reset/", ({ body }) => {
    const user = findUser(String(body.identifier ?? ""))
    if (!user || body.code !== DEMO_CODE) throw new HttpError(400, { code: ["That code is wrong or has expired."] })
    if (passwords.get(user.phone) === body.password) throw new HttpError(400, { password: ["Choose a password you haven't used before."] })
    passwords.set(user.phone, String(body.password))
    return { reset: true }
  }],
  ["post", "/auth/password/change/", ({ body, userId }) => {
    const user = Object.values(db.demoUsers).find((u) => u.id === userId) ?? raise(new HttpError(401, { detail: "Sign in again." }))
    if (passwords.get(user.phone) !== body.currentPassword) throw new HttpError(400, { currentPassword: ["That isn't your current password."] })
    if (body.currentPassword === body.newPassword) throw new HttpError(400, { newPassword: ["Choose a password you haven't used before."] })
    passwords.set(user.phone, String(body.newPassword))
    return { changed: true }
  }],
  // In the mock, the texted link's token is simply the organisation's id (e.g. app-mwangaza).
  ["get", "/organisations/applications/documents/", ({ query }) => documentsView(adminOrgs.get(query.token ?? "") ?? raise(notFound()))],
  ["post", "/organisations/applications/documents/", ({ body }) => {
    const org = adminOrgs.get(String(body.token ?? "")) ?? raise(notFound())
    if (org.status !== "pending" && org.status !== "info_requested") throw new HttpError(409, { detail: "SchoolShop has already decided on this application." })
    const check = org.checks.find((c) => checkKey(c.label) === body.key && checkKey(c.label) !== "phone") ?? raise(new HttpError(400, { key: ["Choose which document this is."] }))
    if (check.state === "verified") throw new HttpError(409, { detail: "SchoolShop has already checked this one." })
    const file = body.file as File | undefined
    if (!file) throw new HttpError(400, { file: ["Choose a file to upload."] })
    if (!/\.(pdf|jpe?g|png|csv|xlsx)$/i.test(file.name)) throw new HttpError(400, { file: ["Upload a PDF, a photo (JPG or PNG), or a CSV or Excel file."] })
    if (file.size > 10 * 1024 * 1024) throw new HttpError(400, { file: ["Keep it under 10 MB."] })
    Object.assign(check, { state: "uploaded", fileName: file.name, uploadedAt: stamp() })
    org.openChecks = org.checks.filter((c) => c.state !== "verified").length
    org.history.unshift({ id: `h-${Date.now()}`, at: stamp(), actor: org.contactName, text: `sent ${check.label}` })
    return documentsView(org)
  }],
  ["post", "/organisations/applications/", ({ body }) => {
    const phone = String(body.phone ?? "")
    if (db.demoUsers[phone]) throw new HttpError(400, { phone: ["An account already uses this number."] })
    return { id: `app-${Date.now()}`, orgType: body.orgType, orgName: body.orgName, status: "pending_review" }
  }],

  ["get", "/schools/", ({ query }) => {
    const q = (query.search ?? "").toLowerCase()
    const results = db.schools.filter((s) => adminOrgs.get(s.id)?.status !== "suspended" && `${s.name} ${s.town}`.toLowerCase().includes(q))
    return { count: results.length, next: null, previous: null, results }
  }],
  ["get", "/schools/:slug/", ({ params }) => db.schools.find((s) => s.slug === params.slug) ?? raise(notFound())],
  ["get", "/schools/:slug/booklists/", ({ params }) => {
    const school = db.schools.find((s) => s.slug === params.slug) ?? raise(notFound())
    return [...booklists.values()].filter((b) => b.schoolId === school.id && b.status === "published")
  }],
  ["get", "/products/", ({ query }) => {
    let results = [...db.products]
    if (query.gradeBand && query.gradeBand !== "all") results = results.filter((p) => p.gradeBand === query.gradeBand || p.gradeBand === "all")
    if (query.category && query.category !== "all") results = results.filter((p) => p.category === query.category || (query.category === "textbook" && !p.category && p.gradeBand !== "all"))
    if (query.curriculum) results = results.filter((p) => p.curricula?.includes(query.curriculum!) ?? query.curriculum === "cbe")
    if (query.audience) results = results.filter((p) => p.audience === query.audience || p.audience === "all")
    if (query.department) results = results.filter((p) => p.department === query.department)
    if (query.subject) results = results.filter((p) => p.subject.toLowerCase() === query.subject!.toLowerCase())
    if (query.publisher) results = results.filter((p) => p.publisherName.toLowerCase() === query.publisher!.toLowerCase())
    if (query.search) results = results.filter((p) => `${p.title} ${p.publisherName} ${p.subject}`.toLowerCase().includes(query.search!.toLowerCase()))
    if (query.sort === "price_asc") results.sort((a, b) => a.priceCents - b.priceCents)
    else if (query.sort === "price_desc") results.sort((a, b) => b.priceCents - a.priceCents)
    else if (query.sort === "title") results.sort((a, b) => a.title.localeCompare(b.title))
    else results.sort((a, b) => b.schoolListCount - a.schoolListCount)
    return { count: results.length, next: null, previous: null, results }
  }],
  ["get", "/products/:id/", ({ params }) => db.productDetail(db.products.find((p) => p.id === params.id) ?? raise(notFound()))],

  ["get", "/children/", () => children.map((c) => {
    // Only this term's orders count; last term's collected ones are history.
    const latest = [...orders.values()].filter((o) => o.studentName === c.name && o.termName === "Term 1, 2027").at(-1)
    return latest
      ? { ...c, openBooklist: latest.status === "pending_payment" ? c.openBooklist : null, latestOrder: { id: latest.id, number: latest.number, status: latest.status, expectedAtSchool: latest.expectedAtSchool } }
      : c
  })],
  ["post", "/children/", ({ body }) => {
    const schoolId = db.schoolJoinCodes[String(body.schoolCode ?? "").trim().toUpperCase()]
    if (!schoolId) throw new HttpError(400, { schoolCode: ["That school code isn't right. It's on the letter or SMS from the school."] })
    const school = db.schools.find((s) => s.id === schoolId)!
    const name = String(body.name ?? "").trim()
    if (name.length < 2) throw new HttpError(400, { name: ["Enter your child's first name."] })
    const admissionNo = String(body.admissionNo ?? "").trim().toUpperCase()
    if (children.some((c) => c.schoolId === schoolId && c.admissionNo.toUpperCase() === admissionNo)) throw new HttpError(400, { admissionNo: ["This child is already on your account."] })
    const student = schoolId === "sch-greenhill" ? schoolRows.find((r) => r.admissionNo === admissionNo) : undefined
    if (!student) throw new HttpError(400, { admissionNo: [`We couldn't find that admission number at ${school.name}. Check it with the school office.`] })
    const list = [...booklists.values()].find((b) => b.schoolId === schoolId && b.gradeName === student.gradeName && b.status === "published")
    const child = { id: `stu-new-${++childSeq}`, name, admissionNo, schoolId, schoolName: school.name, gradeName: student.gradeName, className: student.className, openBooklist: list ? db.summarise(list) : null, latestOrder: null }
    children = [...children, child]
    return child
  }],
  ["delete", "/children/:id/", ({ params }) => {
    const child = children.find((c) => c.id === params.id) ?? raise(notFound())
    const active = [...orders.values()].some((o) => o.studentName === child.name && !["collected", "cancelled", "refunded", "partially_refunded"].includes(o.status))
    if (active) throw new HttpError(409, { detail: `${child.name} has an order in progress. You can remove them once it's collected.` })
    children = children.filter((c) => c.id !== child.id)
    return null
  }],
  ["get", "/account/", () => account],
  ["patch", "/account/", ({ body }) => {
    const name = String(body.name ?? "").trim()
    if (name.length < 2) throw new HttpError(400, { name: ["Enter your name."] })
    const email = body.email ? String(body.email).trim().toLowerCase() : null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, { email: ["Enter a valid email or leave it empty."] })
    const mpesaPhone = String(body.mpesaPhone ?? "")
    if (!/^254[17]\d{8}$/.test(mpesaPhone)) throw new HttpError(400, { mpesaPhone: ["Enter a Kenyan mobile number."] })
    Object.assign(account, { name, email, mpesaPhone })
    if (!email) account.notifications.emailReceipts = false
    return account
  }],
  ["put", "/account/notifications/", ({ body }) => {
    if (body.emailReceipts && !account.email) throw new HttpError(400, { emailReceipts: ["Add an email address first."] })
    account.notifications = { reminders: !!body.reminders, emailReceipts: !!body.emailReceipts, offers: !!body.offers }
    return account
  }],
  ["post", "/account/deletion/", () => {
    const active = [...orders.values()].some((o) => !["collected", "cancelled", "refunded", "partially_refunded", "payment_failed"].includes(o.status))
    if (active) throw new HttpError(409, { detail: "You have an order in progress. You can close your account once it's collected." })
    return { requested: true }
  }],
  ["get", "/booklists/:id/", ({ params }) => booklists.get(params.id) ?? raise(notFound())],
  ["get", "/orders/", () => {
    const results = [...orders.values()].reverse()
    return { count: results.length, next: null, previous: null, results }
  }],
  ["post", "/orders/", ({ body }) => {
    const child = children.find((c) => c.id === body.studentId)
    const list = booklists.get(String(body.booklistId))
    if (!child || !list) throw new HttpError(400, { nonFieldErrors: ["This list is no longer open for orders."] })
    const excluded = new Set((body.excludedItemIds as string[]) ?? [])
    const extras = ((body.extraItems as { productId: string; qty: number }[]) ?? []).flatMap(({ productId, qty }) => {
      const p = db.products.find((x) => x.id === productId)
      return p ? [{ id: `x-${p.id}`, title: p.title, publisherName: p.publisherName, unitPriceCents: p.priceCents, qtyPerStudent: qty }] : []
    })
    const lines = [...list.items.filter((i) => !excluded.has(i.id)), ...extras]
    if (!lines.length) throw new HttpError(400, { nonFieldErrors: ["Choose at least one item."] })
    const subtotal = lines.reduce((s, i) => s + i.unitPriceCents * i.qtyPerStudent, 0)
    const id = `ord-${++orderSeq}`
    const publishers = [...new Set(lines.map((l) => l.publisherName))]
    const order: Order = {
      id,
      number: `SS-${orderSeq}`,
      termName: list.termName,
      status: "pending_payment",
      studentName: child.name,
      schoolName: child.schoolName,
      className: child.className,
      subtotalCents: subtotal,
      totalCents: subtotal,
      collectionCode: null,
      paidAt: null,
      mpesaReceipt: null,
      expectedAtSchool: list.deliverBy,
      collectedAt: null,
      items: lines.map((l) => ({ id: `oi-${l.id}`, title: l.title, publisherName: l.publisherName, qty: l.qtyPerStudent, unitPriceCents: l.unitPriceCents, status: "active" })),
      shipments: publishers.map((p) => ({ publisherName: p, summary: plural(lines.filter((l) => l.publisherName === p).length, "item"), status: "collecting" })),
    }
    orders.set(id, order)
    return order
  }],
  ["get", "/orders/:id/", ({ params }) => orders.get(params.id) ?? raise(notFound())],
  ["post", "/orders/:id/payments/", ({ params, body }) => {
    const order = orders.get(params.id) ?? raise(notFound())
    if (order.status !== "pending_payment" && order.status !== "payment_failed") throw new HttpError(409, { detail: "This order is already paid." })
    const id = `pay-${Date.now()}`
    if (body.method === "card") {
      // Mock mode has no card provider page: "come back" straight to the payment page, already paid.
      const payment = { id, orderId: order.id, method: "card" as const, status: "initiated" as const, amountCents: order.totalCents, phone: null, failureReason: null, redirectUrl: `/parent/orders/${order.id}/payments/${id}`, checks: 1 }
      payments.set(id, payment)
      order.status = "pending_payment"
      return strip(payment)
    }
    const phone = String(body.phone ?? "")
    if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) throw new HttpError(400, { phone: ["Enter a Kenyan mobile number."] })
    const payment = { id, orderId: order.id, method: "mpesa" as const, status: "initiated" as const, amountCents: order.totalCents, phone, failureReason: null, redirectUrl: null, checks: 0 }
    payments.set(payment.id, payment)
    order.status = "pending_payment"
    return strip(payment)
  }],
  ["get", "/payments/options/", () => ({ mpesa: true, card: true, cardProvider: "stripe" })],
  ["get", "/payments/:id/", ({ params }) => {
    const p = payments.get(params.id) ?? raise(notFound())
    p.checks += 1
    if (p.status === "initiated" && p.checks >= 2) {
      const order = orders.get(p.orderId)!
      if (p.phone?.endsWith("000")) {
        Object.assign(p, { status: "failed", failureReason: "insufficient_funds" })
        order.status = "payment_failed"
      } else {
        p.status = "succeeded"
        Object.assign(order, {
          status: "paid",
          paidAt: new Date().toISOString().replace("Z", "+00:00"),
          mpesaReceipt: p.method === "card" ? null : "QK" + Math.random().toString(36).slice(2, 10).toUpperCase(),
          collectionCode: String(1000 + Math.floor(Math.random() * 9000)),
        })
      }
    }
    return strip(p)
  }],

  ["get", "/school/overview/", () => {
    const deliveries = [...schoolDeliveries.values()]
    return {
      ...db.schoolOverview,
      packsCollected: [...schoolOrders.values()].filter((o) => o.status === "collected").length,
      deliveriesReceived: deliveries.filter((d) => d.status === "received").length,
      deliveries: deliveries.map((d) => ({ id: d.id, publisherName: d.publisherName, packs: d.packs, status: d.status, date: d.receipt?.receivedAt.slice(0, 10) ?? d.expectedAt })),
    }
  }],
  ["get", "/school/booklists/", () => {
    const lists = [...booklists.values()].map((b) => {
      const rows = schoolRows.filter((r) => r.gradeName === b.gradeName)
      const grade = db.schoolGrades.find((g) => g.gradeName === b.gradeName)
      return { ...db.summarise(b), ordered: rows.filter((r) => r.order && !["pending_payment", "payment_failed"].includes(r.order.status)).length, students: rows.length || grade?.students || 0 }
    })
    const taken = new Set(lists.map((l) => l.gradeName))
    return { termName: db.schoolOverview.termName, lists, gradesWithoutList: db.schoolGrades.filter((g) => !taken.has(g.gradeName)) }
  }],
  ["post", "/school/booklists/", ({ body }) => {
    const grade = db.schoolGrades.find((g) => g.gradeName === body.gradeName) ?? raise(new HttpError(400, { gradeName: ["Choose a grade."] }))
    if ([...booklists.values()].some((b) => b.gradeName === grade.gradeName)) throw new HttpError(409, { detail: `${grade.gradeName} already has a list this term.` })
    const list: Booklist = {
      id: `bl-${grade.gradeName.toLowerCase().replace(/\s+/g, "")}-${Date.now().toString(36)}`,
      schoolId: "sch-greenhill",
      schoolName: "Greenhill Academy",
      termName: db.schoolOverview.termName,
      gradeName: grade.gradeName,
      classNames: grade.classNames,
      orderDeadline: db.schoolOverview.orderDeadline,
      deliverBy: "2027-01-20",
      status: "draft",
      items: [],
    }
    booklists.set(list.id, list)
    return list
  }],
  ["put", "/school/booklists/:id/", ({ params, body }) => {
    const list = booklists.get(params.id) ?? raise(notFound())
    const input = (body.items as { productId: string; required: boolean; qtyPerStudent: number; note: string | null }[] | undefined) ?? []
    const seen = new Set<string>()
    const items = input.map((i) => {
      const c = catalogById.get(i.productId) ?? raise(new HttpError(400, { items: ["One of these titles is no longer in the catalog."] }))
      if (seen.has(i.productId)) throw new HttpError(400, { items: [`${c.title} is on the list twice.`] })
      seen.add(i.productId)
      if (!Number.isInteger(i.qtyPerStudent) || i.qtyPerStudent < 1 || i.qtyPerStudent > 20) throw new HttpError(400, { items: [`Quantity for ${c.title} must be 1 to 20.`] })
      const note = i.note?.trim() || null
      if (note && note.length > 140) throw new HttpError(400, { items: [`Keep the note on ${c.title} under 140 characters.`] })
      return { id: `${list.id}-${c.productId}`, productId: c.productId, title: c.title, publisherName: c.publisherName, subject: c.subject, unitPriceCents: c.priceCents, qtyPerStudent: i.qtyPerStudent, required: !!i.required, note }
    })
    const next = { ...list, orderDeadline: String(body.orderDeadline ?? ""), deliverBy: String(body.deliverBy ?? ""), items }
    checkBooklist(next, list.status === "published")
    booklists.set(list.id, next)
    return next
  }],
  ["post", "/school/booklists/:id/publish/", ({ params }) => {
    const list = booklists.get(params.id) ?? raise(notFound())
    if (list.status === "published") throw new HttpError(409, { detail: "This list is already published." })
    checkBooklist(list, true)
    list.status = "published"
    return list
  }],
  ["get", "/school/catalog/", ({ query }) => {
    const q = (query.search ?? "").trim().toLowerCase()
    return db.schoolCatalog.filter(
      (c) =>
        (!query.category || query.category === "all" || c.category === query.category) &&
        (!q || `${c.title} ${c.publisherName} ${c.subject} ${c.isbn ?? ""} ${c.gradeLabel}`.toLowerCase().includes(q))
    )
  }],
  ["get", "/me/", ({ userId }) => withAccess(usersById().find((u) => u.id === userId) ?? raise(new HttpError(401, { detail: "Sign in again." })))],
  ["get", "/school/collection/", ({ userId }) => {
    const scope = classScope(userId)
    return [...schoolOrders.values()]
      .filter((o) => ["in_fulfilment", "at_school", "collected"].includes(o.status) && (!scope || scope.has(o.className)))
      .map(collectionRow)
  }],
  ["post", "/school/collection/handover/", ({ body, userId }) => {
    const className = String(body.className ?? "")
    const scope = classScope(userId)
    if (scope && !scope.has(className)) throw new HttpError(403, { code: [`You hand out packs for ${[...scope].join(", ")} only.`] })
    const code = String(body.code ?? "").trim()
    if (!/^\d{4}$/.test(code)) throw new HttpError(400, { code: ["Collection codes are 4 digits."] })
    const attempts = codeAttempts.get(className) ?? { wrong: 0, lockedUntil: 0 }
    if (attempts.lockedUntil > Date.now()) throw new HttpError(429, { detail: "Too many wrong codes. Wait a minute, then try again." })
    const order = [...schoolOrders.values()].find((o) => o.className === className && o.collectionCode === code)
    if (!order) {
      attempts.wrong += 1
      if (attempts.wrong >= 5) Object.assign(attempts, { wrong: 0, lockedUntil: Date.now() + 60_000 })
      codeAttempts.set(className, attempts)
      throw new HttpError(404, { code: [`No pack in ${className} has that code. Check the number again.`] })
    }
    codeAttempts.delete(className)
    if (order.status === "collected") throw new HttpError(409, { code: [`${order.studentName}'s pack was already collected.`] })
    if (order.status !== "at_school") {
      const waiting = order.shipments.filter((s) => s.status !== "received").map((s) => s.publisherName)
      throw new HttpError(409, { code: [`${order.studentName}'s pack isn't complete yet: waiting for ${waiting.join(" and ")}.`] })
    }
    Object.assign(order, { status: "collected", collectedAt: new Date().toISOString().replace("Z", "+00:00") })
    const row = schoolRows.find((r) => r.order?.id === order.id)
    if (row?.order) row.order.status = "collected"
    return collectionRow(order)
  }],
  ["post", "/school/collection/:id/resend/", ({ params }) => {
    const order = schoolOrders.get(params.id) ?? raise(notFound())
    if (!order.parentPhone) throw new HttpError(400, { detail: "There's no parent phone on file for this student." })
    return { sentTo: order.parentPhone }
  }],

  ["get", "/school/settings/", () => schoolSettings],
  ["patch", "/school/settings/profile/", ({ body }) => {
    const phone = String(body.phone ?? "")
    if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) throw new HttpError(400, { phone: ["Enter a Kenyan mobile number."] })
    Object.assign(schoolSettings.profile, {
      contactName: String(body.contactName),
      phone,
      email: String(body.email).toLowerCase(),
      county: String(body.county),
      deliveryAddress: String(body.deliveryAddress),
      deliveryHours: String(body.deliveryHours),
    })
    return schoolSettings
  }],
  ["put", "/school/settings/parents/", ({ body }) => {
    const reminderDays = Number(body.reminderDays)
    if (![0, 1, 3, 5, 7].includes(reminderDays)) throw new HttpError(400, { reminderDays: ["Choose when to remind parents."] })
    schoolSettings.parents = {
      reminderDays,
      smsWhenAtSchool: !!body.smsWhenAtSchool,
      collectionPoint: body.collectionPoint === "school_office" ? "school_office" : "class_teacher",
    }
    return schoolSettings
  }],

  ["get", "/school/deliveries/", () => [...schoolDeliveries.values()]],
  ["get", "/school/deliveries/:id/", ({ params }) => schoolDeliveries.get(params.id) ?? raise(notFound())],
  ["post", "/school/deliveries/:id/receive/", ({ params, body, userId }) => {
    const delivery = schoolDeliveries.get(params.id) ?? raise(notFound())
    if (delivery.status !== "dispatched") throw new HttpError(409, { detail: "This delivery isn't on its way, so it can't be received yet." })
    const counts = new Map(((body.classes as { className: string; received: number }[] | undefined) ?? []).map((c) => [c.className, c.received]))
    for (const c of delivery.classes) {
      const n = counts.get(c.className)
      if (n === undefined || !Number.isInteger(n) || n < 0) throw new HttpError(400, { classes: [`Enter how many packs arrived for ${c.className}.`] })
      if (n > c.expected) throw new HttpError(400, { classes: [`${c.className} has more packs than were sent. Check the labels: a pack may belong to another class.`] })
    }
    const packsReceived = delivery.classes.reduce((t, c) => t + counts.get(c.className)!, 0)
    if (packsReceived === 0) throw new HttpError(400, { classes: ["Nothing counted. If the delivery didn't arrive, don't confirm it."] })
    const issues = ((body.issues as string[] | undefined) ?? []).filter((i): i is "damaged" | "wrong_items" => i === "damaged" || i === "wrong_items")
    const notes = String(body.notes ?? "").trim()
    if ((issues.length > 0 || packsReceived < delivery.packs) && !notes) throw new HttpError(400, { notes: [`Tell ${delivery.publisherName} what's wrong so they can fix it.`] })
    const user = Object.values(db.demoUsers).find((u) => u.id === userId)
    Object.assign(delivery, {
      status: "received",
      classes: delivery.classes.map((c) => ({ ...c, received: counts.get(c.className)! })),
      receipt: { receivedAt: new Date().toISOString().replace("Z", "+00:00"), receivedBy: user?.name ?? "School admin", packsReceived, issues, notes, signOffCode: String(1000 + Math.floor(Math.random() * 9000)) },
    })
    // Parents' orders: this publisher's part is now at school; once every part is, the order is ready to collect.
    for (const order of schoolOrders.values()) {
      const shipment = order.shipments.find((sh) => sh.publisherName === delivery.publisherName)
      if (!shipment || order.status !== "in_fulfilment") continue
      shipment.status = "received"
      if (order.shipments.every((sh) => sh.status === "received")) {
        order.status = "at_school"
        const row = schoolRows.find((r) => r.order?.id === order.id)
        if (row?.order) row.order.status = "at_school"
      }
    }
    return delivery
  }],
  ["get", "/school/orders/", () => ({ termName: db.schoolOverview.termName, orderDeadline: db.schoolOverview.orderDeadline, rows: schoolRows })],
  ["get", "/school/orders/:id/", ({ params }) => schoolOrders.get(params.id) ?? raise(notFound())],
  ["get", "/admin/settings/", () => settingsView()],
  ["put", "/admin/settings/:section/", ({ params, body, userId }) => {
    const changes = applySettings(params.section, body)
    if (changes.length) {
      settingsUpdated[params.section] = { at: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"), by: actorName(userId) }
      audit(userId, "settings", changes.join("; "), { label: "Fees & settings", href: `/admin/settings#${params.section}` })
    }
    return settingsView()
  }],
  ["get", "/admin/catalog/", () => submissionList()],
  ["post", "/admin/catalog/:id/:decision/", ({ params, body, userId }) => {
    const x = submissions.get(params.id) ?? raise(notFound())
    if (x.status !== "pending" && x.status !== "changes_requested") throw new HttpError(409, { detail: "This has already been decided." })
    const note = String(body.note ?? "").trim()
    const linked = x.catalogId ? catalog.get(x.catalogId) : undefined
    const target = { label: x.title, href: `/admin/catalog?sub=${x.id}` }
    let text: string, own: string
    if (params.decision === "approve") {
      const fails = submissionView(x).checks.filter((c) => c.result === "fail")
      if (fails.length) throw new HttpError(400, { detail: `Can't approve with a failed check: ${fails.map((c) => c.label).join(", ")}. Ask for changes instead.` })
      x.status = "approved"
      if (x.kind === "new_title") {
        db.products.push({ id: `prd-${x.id}`, title: x.title, publisherName: x.publisherId === "pub-longhorn" ? "Longhorn" : x.publisherName, subject: x.subject, gradeLabel: x.gradeLabel, gradeBand: gradeBandOf(x.gradeLabel), priceCents: x.priceCents, schoolListCount: 0, category: x.subject === "Stationery" ? "stationery" : "textbook", audience: "school" })
        if (x.isbn) db.productExtras[`prd-${x.id}`] = { description: "", isbn: x.isbn, pages: null, format: x.format }
      } else {
        const product = db.products.find((p) => p.title === x.title)
        if (product) product.priceCents = x.priceCents
      }
      if (linked) Object.assign(linked, { status: "live", review: null })
      own = x.kind === "new_title" ? `approved it at ${formatKes(x.priceCents)}. Schools can add it to booklists.` : `approved the new price, ${formatKes(x.priceCents)}`
      text = x.kind === "new_title" ? `approved ${possessive(x.publisherName)} ${x.title} at ${formatKes(x.priceCents)}` : `approved ${x.title} at ${formatKes(x.priceCents)} (was ${formatKes(x.previousPriceCents ?? 0)})`
    } else if (params.decision === "request-changes" || params.decision === "reject") {
      if (!note) throw new HttpError(400, { note: ["Tell the publisher what to fix. They see this."] })
      const changes = params.decision === "request-changes"
      x.status = changes ? "changes_requested" : "rejected"
      x.note = note
      if (linked) linked.review = { state: changes ? "changes_requested" : "rejected", note, submittedAt: linked.review?.submittedAt ?? x.submittedAt }
      own = changes ? `asked for changes: "${note}"` : `rejected it: "${note}"`
      text = changes ? `asked ${x.publisherName} to change ${x.title}: "${note}"` : `rejected ${possessive(x.publisherName)} ${x.title}: "${note}"`
    } else throw notFound()
    x.history.unshift({ id: `sh-${Date.now()}`, at: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"), actor: actorName(userId), text: own })
    audit(userId, "catalog", text, target)
    return submissionList()
  }],
  ["get", "/admin/audit/", () => auditLog],
  ["get", "/admin/refunds/", () => refundsView()],
  ["post", "/admin/refunds/approve/", ({ body, userId }) => {
    const ids = (body.orderIds as string[]) ?? []
    const orders = ids.map(findOrder)
    const missing = orders.filter((o) => orderExtra(o).issue !== "refund_due" || !orderExtra(o).refundRequest)
    if (!ids.length || missing.length) throw new HttpError(409, { detail: missing.length ? `No refund is waiting on ${missing.map((o) => o.number).join(", ")}.` : "Choose the refunds to approve." })
    for (const o of orders) { const r = orderExtra(o).refundRequest!; refundItems(o, r.itemIds, r.reason, userId) }
    return refundsView()
  }],
  ["post", "/admin/refunds/:orderId/decline/", ({ params, body, userId }) => {
    const o = findOrder(params.orderId)
    const x = orderExtra(o)
    if (x.issue !== "refund_due" || !x.refundRequest) throw new HttpError(409, { detail: "No refund is waiting on this order." })
    if (x.refundRequest.from === "publisher") throw new HttpError(409, { detail: "The publisher can't supply these items, so the parent has to get their money back." })
    const reason = String(body.reason ?? "").trim()
    if (!reason) throw new HttpError(400, { reason: ["Tell the parent why. They get this by SMS."] })
    Object.assign(x, { issue: null, issueDetail: null, refundRequest: undefined })
    logOrder(o, userId, `declined the refund request: "${reason}"`)
    return refundsView()
  }],
  ["post", "/admin/disputes/:id/refund/", ({ params, body, userId }) => {
    const d = disputes.get(params.id) ?? raise(notFound())
    if (d.status !== "open") throw new HttpError(409, { detail: "This dispute is already settled." })
    const picked = new Set((body.orderIds as string[] | undefined) ?? [])
    if (!picked.size || [...picked].some((id) => !d.orderIds.includes(id))) throw new HttpError(400, { orderIds: ["Tick the students the school says are missing a pack."] })
    const open = d.orderIds.filter((id) => picked.has(id)).map(findOrder)
    const reason = d.kind === "short" ? `Missing from ${d.publisherName}'s delivery to ${d.schoolName}` : `Damaged in ${d.publisherName}'s delivery to ${d.schoolName}`
    const total = open.reduce((t, o) => t + refundItems(o, publisherItems(o, d.publisherName).map((i) => i.id), reason, userId), 0)
    let where = ""
    if (d.payoutId) {
      const p = findPayout(d.payoutId)
      if (p.status === "paid") where = ` Taken off ${d.publisherName}'s next payout.`
      else {
        Object.assign(p, { deductionsCents: p.deductionsCents + total, netCents: p.netCents - total, deductionNote: [p.deductionNote, `${open.length} packs ${d.kind === "short" ? "short" : "damaged"} at ${d.schoolName}, refunded to parents`].filter(Boolean).join("; ") })
        where = ` Taken off ${d.publisherName}'s payout (${p.deliveryNoteNo}).`
      }
    }
    settleDispute(d, `Refunded ${formatKes(total)} to ${open.length} parent${open.length === 1 ? "" : "s"}.${where}`, userId)
    return refundsView()
  }],
  ["post", "/admin/disputes/:id/replace/", ({ params, body, userId }) => {
    const d = disputes.get(params.id) ?? raise(notFound())
    if (d.status !== "open") throw new HttpError(409, { detail: "This dispute is already settled." })
    const note = String(body.note ?? "").trim()
    if (!note) throw new HttpError(400, { note: ["Say what the publisher sent and when."] })
    for (const o of d.orderIds.map(findOrder)) {
      const x = orderExtra(o)
      if (x.issue === "short_delivery") { Object.assign(x, { issue: null, issueDetail: null }); logOrder(o, userId, `marked it sorted: "${note}"`) }
    }
    settleDispute(d, `Replacement delivered: "${note}"`, userId)
    return refundsView()
  }],
  ["get", "/admin/money/", () => money()],
  ["get", "/admin/collections/", (): Collection[] =>
    allOrders()
      .flatMap((o) => orderExtra(o).payments.map((p) => ({ id: p.id, at: p.at, orderId: o.id, orderNumber: o.number, schoolName: o.schoolName, phone: display(p.phone)!, amountCents: p.amountCents, receipt: p.receipt, status: p.status })))
      .sort((a, b) => b.at.localeCompare(a.at))],
  ["post", "/admin/payouts/release/", ({ body, userId }) => {
    const rows = (body.payouts as { id: string; reference: string }[] | undefined) ?? []
    if (!rows.length) throw new HttpError(400, { payouts: ["Choose the payouts to release."] })
    if (rows.some((r) => !String(r.reference ?? "").trim())) throw new HttpError(400, { payouts: ["Enter the transaction reference for each payout."] })
    const refs = new Map(rows.map((r) => [r.id, String(r.reference).trim().toUpperCase()]))
    const ids = rows.map((r) => r.id)
    const blocked = ids.map(findPayout).filter((p) => p.status !== "queued" || accountFor(publisherOf(p.id)).status !== "verified")
    if (blocked.length) throw new HttpError(409, { detail: `Can't release ${blocked.map((p) => p.deliveryNoteNo).join(", ")}: not ready or the payout account isn't verified.` })
    for (const id of ids) {
      const p = findPayout(id)
      Object.assign(p, { status: "paid", paidAt: stamp(), reference: refs.get(id)! })
      logPayout(id, userId, `released ${formatKes(p.netCents)} to ${accountFor(publisherOf(id)).masked} · ${p.reference}`)
    }
    return money()
  }],
  ["post", "/admin/payouts/:id/hold/", ({ params, body, userId }) => {
    const p = findPayout(params.id)
    if (p.status !== "queued" && p.status !== "held") throw new HttpError(409, { detail: "Only payouts that haven't gone out can be held." })
    const reason = String(body.reason ?? "").trim()
    if (!reason) throw new HttpError(400, { reason: ["Give the reason. The publisher sees it."] })
    p.status = "on_hold"
    payoutNote(p).holdReason = reason
    logPayout(p.id, userId, `put the payout on hold: "${reason}"`)
    return money()
  }],
  ["post", "/admin/payouts/:id/unhold/", ({ params, body, userId }) => {
    const p = findPayout(params.id)
    if (p.status !== "on_hold") throw new HttpError(409, { detail: "This payout isn't on hold." })
    p.status = p.receivedAt ? "queued" : "held"
    payoutNote(p).holdReason = null
    const note = String(body.note ?? "").trim()
    logPayout(p.id, userId, `took the hold off${note ? `: "${note}"` : ""}`)
    return money()
  }],
  ["post", "/admin/payout-accounts/:publisherId/verify/", ({ params, userId }) => {
    const account = params.publisherId === "pub-longhorn" ? payouts.account : (publisherAccounts[params.publisherId] ?? raise(notFound())).account
    if (account.status === "verified") throw new HttpError(409, { detail: "This account is already verified." })
    account.status = "verified"
    for (const p of adminPayouts().filter((x) => x.publisherId === params.publisherId && x.status !== "paid")) logPayout(p.id, userId, `confirmed the new payout account ${account.masked}`)
    return money()
  }],
  ["get", "/admin/orders/", () => allOrders().map(adminOrderSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))],
  ["get", "/admin/orders/:id/", ({ params }) => adminOrder(findOrder(params.id))],
  ["post", "/admin/orders/:id/check-payment/", ({ params, userId }) => {
    const o = findOrder(params.id)
    const x = orderExtra(o)
    const p = x.payments.find((pay) => pay.status === "unconfirmed")
    if (!p) throw new HttpError(409, { detail: "There's no payment waiting on M-Pesa for this order." })
    if (x.confirmsOnCheck) {
      Object.assign(p, { status: "succeeded", receipt: "QK" + hash(o.id + "r").toString(36).toUpperCase().slice(0, 8) })
      Object.assign(o, { status: "paid", paidAt: p.at, mpesaReceipt: p.receipt, collectionCode: String(1000 + (hash(o.id) % 9000)), expectedAtSchool: "2027-01-22" })
      logOrder(o, userId, `checked with M-Pesa: paid, receipt ${p.receipt}. The parent was sent their collection code.`)
    } else {
      Object.assign(p, { status: "failed", failureReason: "The parent cancelled on their phone" })
      o.status = "payment_failed"
      logOrder(o, userId, "checked with M-Pesa: not paid. The parent was told they can try again.")
    }
    Object.assign(x, { issue: null, issueDetail: null })
    syncSchoolRow(o)
    return adminOrder(o)
  }],
  ["post", "/admin/orders/:id/resend-code/", ({ params, userId }) => {
    const o = findOrder(params.id)
    if (!o.collectionCode || o.status === "collected" || o.status === "refunded") throw new HttpError(409, { detail: "This order has no collection code to send." })
    logOrder(o, userId, `resent the collection code to ${display(orderExtra(o).parentPhone) ?? "the parent"}`)
    return adminOrder(o)
  }],
  ["post", "/admin/orders/:id/note/", ({ params, body, userId }) => {
    const o = findOrder(params.id)
    const note = String(body.note ?? "").trim()
    if (!note) throw new HttpError(400, { note: ["Write the note first."] })
    logOrder(o, userId, `noted: "${note}"`)
    return adminOrder(o)
  }],
  ["post", "/admin/orders/:id/refund/", ({ params, body, userId }) => {
    const o = findOrder(params.id)
    if (!o.paidAt) throw new HttpError(409, { detail: "Nothing has been paid on this order." })
    const ids = new Set((body.itemIds as string[]) ?? [])
    const lines = o.items.filter((i) => ids.has(i.id) && i.status !== "refunded")
    if (!lines.length) throw new HttpError(400, { itemIds: ["Choose what to refund."] })
    const reason = String(body.reason ?? "").trim()
    if (!reason) throw new HttpError(400, { reason: ["Give the reason. The parent sees it."] })
    refundItems(o, lines.map((i) => i.id), reason, userId)
    return adminOrder(o)
  }],
  ["post", "/admin/orders/:id/resolve/", ({ params, body, userId }) => {
    const o = findOrder(params.id)
    const x = orderExtra(o)
    if (!x.issue) throw new HttpError(409, { detail: "Nothing is open on this order." })
    const note = String(body.note ?? "").trim()
    if (!note) throw new HttpError(400, { note: ["Say how it was sorted out."] })
    Object.assign(x, { issue: null, issueDetail: null })
    logOrder(o, userId, `marked it sorted: "${note}"`)
    return adminOrder(o)
  }],
  ["get", "/admin/organisations/", () => [...adminOrgs.values()].map(orgSummary)],
  ["post", "/admin/organisations/invite/", ({ body }) => {
    if (String(body.name ?? "").trim().length < 2) throw new HttpError(400, { name: ["Enter the organisation's name."] })
    if (!String(body.contact ?? "").trim()) throw new HttpError(400, { contact: ["Enter a phone number or email."] })
    return { sent: true }
  }],
  ["get", "/admin/organisations/:id/", ({ params }) => adminOrgs.get(params.id) ?? raise(notFound())],
  ["post", "/admin/organisations/:id/checks/:checkId/", ({ params, body, userId }) => {
    const org = adminOrgs.get(params.id) ?? raise(notFound())
    const check = org.checks.find((c) => c.id === params.checkId) ?? raise(notFound())
    if (check.state === "missing") throw new HttpError(400, { detail: "Nothing has been uploaded for this yet. Ask the applicant for it." })
    check.state = body.state === "failed" ? "failed" : "verified"
    logOrg(org, userId, `${check.state === "verified" ? "checked" : "flagged"} ${check.label}`)
    org.openChecks = org.checks.filter((c) => c.state !== "verified").length
    return org
  }],
  ["post", "/admin/organisations/:id/:decision/", ({ params, body, userId }) => {
    const org = adminOrgs.get(params.id) ?? raise(notFound())
    const note = String(body.note ?? "").trim()
    const open = org.checks.filter((c) => c.state !== "verified")
    switch (params.decision) {
      case "approve":
        if (!["pending", "info_requested"].includes(org.status)) throw new HttpError(409, { detail: "Only applications can be approved." })
        if (open.length) throw new HttpError(400, { detail: `Still to check: ${open.map((c) => c.label).join(", ")}.` })
        Object.assign(org, { status: "live", verifiedAt: new Date().toISOString().replace("Z", "+00:00") })
        logOrg(org, userId, `approved ${org.name}${note ? `: "${note}"` : ""}`)
        if (org.type === "school" && !db.schools.some((s) => s.id === org.id)) db.schools.push({ id: org.id, slug: org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""), name: org.name, town: org.town, county: org.county, verified: true })
        break
      case "request-info":
        if (!["pending", "info_requested"].includes(org.status)) throw new HttpError(409, { detail: "Only applications can be asked for more information." })
        if (!note) throw new HttpError(400, { note: ["Tell them what you need."] })
        org.status = "info_requested"
        logOrg(org, userId, `asked for more information: "${note}"`)
        break
      case "reject":
        if (!["pending", "info_requested"].includes(org.status)) throw new HttpError(409, { detail: "Only applications can be rejected." })
        if (!note) throw new HttpError(400, { note: ["Give the reason. The applicant sees it."] })
        org.status = "rejected"
        logOrg(org, userId, `rejected the application: "${note}"`)
        break
      case "suspend":
        if (org.status !== "live") throw new HttpError(409, { detail: "Only live organisations can be paused." })
        if (!note) throw new HttpError(400, { note: ["Give the reason. Their admins see it."] })
        Object.assign(org, { status: "suspended", suspendedReason: note })
        logOrg(org, userId, `paused ${org.name}: "${note}"`)
        break
      case "reactivate":
        if (org.status !== "suspended") throw new HttpError(409, { detail: "This organisation isn't paused." })
        Object.assign(org, { status: "live", suspendedReason: null })
        logOrg(org, userId, `turned ${org.name} back on${note ? `: "${note}"` : ""}`)
        break
      default:
        throw notFound()
    }
    return org
  }],
  ["get", "/school/students/", () => {
    const teachers = directories.school.members.filter((m) => m.role === "teacher" && m.status !== "suspended")
    return {
      joinCode: "GRN-2027",
      classes: allClasses().map(({ className, gradeName }) => {
        const inClass = schoolRows.filter((r) => r.className === className)
        return {
          className,
          gradeName,
          teacher: teachers.find((t) => t.classNames.includes(className))?.name ?? null,
          students: inClass.length,
          linked: inClass.filter((r) => linked.has(r.studentId)).length,
        }
      }),
      students: schoolRows.map(studentView),
    }
  }],
  ["post", "/school/students/", ({ body }) => studentView(createStudent(body))],
  ["patch", "/school/students/:id/", ({ params, body }) => {
    const row = schoolRows.find((r) => r.studentId === params.id) ?? raise(notFound())
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (name.length < 2) throw new HttpError(400, { name: ["Enter the student's full name."] })
      row.studentName = name
    }
    if (body.className !== undefined) {
      const cls = allClasses().find((c) => c.className === body.className) ?? raise(new HttpError(400, { className: ["Choose a class."] }))
      if (row.order && cls.gradeName !== row.gradeName && !["pending_payment", "payment_failed"].includes(row.order.status))
        throw new HttpError(409, { className: [`${row.studentName} already has a paid ${row.gradeName} order. Move them within ${row.gradeName}, or ask SchoolShop support.`] })
      Object.assign(row, { className: cls.className, gradeName: cls.gradeName })
    }
    if (body.parentName !== undefined) row.parentName = body.parentName ? String(body.parentName).trim() : null
    if (body.parentPhone !== undefined && body.parentPhone !== null) {
      const phone = String(body.parentPhone)
      if (!/^254[17]\d{8}$/.test(phone)) throw new HttpError(400, { parentPhone: ["Enter a Kenyan mobile number."] })
      row.parentPhone = mask(phone)
    }
    return studentView(row)
  }],
  ["delete", "/school/students/:id/", ({ params }) => {
    const row = schoolRows.find((r) => r.studentId === params.id) ?? raise(notFound())
    if (row.order && !["pending_payment", "payment_failed"].includes(row.order.status)) throw new HttpError(409, { detail: `${row.studentName} has a paid order. Mark them as left once it's collected.` })
    schoolRows.splice(schoolRows.indexOf(row), 1)
    return null
  }],
  ["post", "/school/students/import/", ({ body }) => {
    const rows = (body.rows as Record<string, string | null>[] | undefined) ?? []
    if (rows.length === 0) throw new HttpError(400, { rows: ["The file has no students in it."] })
    if (rows.length > 2000) throw new HttpError(400, { rows: ["Import at most 2,000 students at a time."] })
    const errors: { line: number; message: string }[] = []
    const seen = new Set<string>()
    const ok: Record<string, string | null>[] = []
    rows.forEach((r, i) => {
      const line = i + 2 // line 1 is the header
      const adm = String(r.admissionNo ?? "").trim().toUpperCase()
      if (String(r.name ?? "").trim().length < 2) return errors.push({ line, message: "Name is missing" })
      if (!adm) return errors.push({ line, message: "Admission number is missing" })
      if (seen.has(adm) || schoolRows.some((x) => x.admissionNo === adm)) return errors.push({ line, message: `${adm} is already on the roll` })
      if (!allClasses().some((c) => c.className === r.className)) return errors.push({ line, message: `"${r.className ?? ""}" isn't a class at this school` })
      if (r.parentPhone && !/^254[17]\d{8}$/.test(String(r.parentPhone))) return errors.push({ line, message: "Parent phone isn't a Kenyan mobile number" })
      seen.add(adm)
      ok.push(r)
    })
    if (!body.dryRun) ok.forEach((r) => createStudent(r))
    return { valid: ok.length, created: body.dryRun ? 0 : ok.length, errors }
  }],
  ["post", "/school/students/invite/", ({ body }) => {
    const targets = schoolRows.filter((r) => r.parentPhone && !linked.has(r.studentId) && (!body.className || r.className === body.className))
    return { sent: targets.length }
  }],
  ["post", "/school/orders/remind/", ({ body }) => {
    const ids = new Set((body.studentIds as string[] | undefined) ?? [])
    if (ids.size === 0) throw new HttpError(400, { studentIds: ["Choose at least one student."] })
    const dayAgo = Date.now() - 86_400_000
    let sent = 0, skipped = 0
    for (const row of schoolRows) {
      if (!ids.has(row.studentId)) continue
      const paid = row.order && !["pending_payment", "payment_failed"].includes(row.order.status)
      if (paid || !row.parentPhone || (row.remindedAt && Date.parse(row.remindedAt) > dayAgo)) skipped++
      else { row.remindedAt = new Date().toISOString(); sent++ }
    }
    return { sent, skipped }
  }],
  ["get", "/publisher/overview/", () => {
    const all = [...batches.values()]
    const live = all.filter((b) => b.status !== "collecting")
    const ready = all.filter((b) => b.status === "ready_to_pack").sort((a, b) => a.dueAtSchool.localeCompare(b.dueAtSchool))
    const titles = new Map<string, { qty: number; salesCents: number }>()
    for (const b of all) for (const l of b.lines) {
      const price = [...catalog.values()].find((c) => c.title === l.title)?.priceCents ?? 0
      const t = titles.get(l.title) ?? { qty: 0, salesCents: 0 }
      titles.set(l.title, { qty: t.qty + l.qty, salesCents: t.salesCents + l.qty * price })
    }
    const items = [...catalog.values()]
    const low = items.filter((c) => c.status === "live" && c.stock <= c.lowStockAt)
    const changes = items.filter((c) => c.review?.state === "changes_requested").length
    const inReview = items.filter((c) => c.review?.state === "pending").length
    const day = (iso: string) => new Date(`${iso}T00:00:00+03:00`).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })
    const alerts = [
      ...(ready.length ? [{ id: "pa-1", severity: "high" as const, title: plural(ready.length, "school") + " ready to dispatch", detail: `First due at ${ready[0].schoolName} on ${day(ready[0].dueAtSchool)}`, href: "/publisher/dispatches" }] : []),
      ...(changes ? [{ id: "pa-2", severity: "medium" as const, title: `${plural(changes, "title")} need changes`, detail: "SchoolShop asked for changes before they go live", href: "/publisher/catalog" }] : []),
      ...(low.length ? [{ id: "pa-3", severity: "medium" as const, title: `${plural(low.length, "title")} low on stock`, detail: low.slice(0, 3).map((c) => c.title).join(", ") + (low.length > 3 ? ` and ${low.length - 3} more` : ""), href: "/publisher/catalog" }] : []),
      ...(payouts.account.status !== "verified" ? [{ id: "pa-4", severity: "info" as const, title: "Payout account waiting for SchoolShop to confirm", detail: "SchoolShop calls you on the number they already have before paying into it", href: "/publisher/payouts" }] : []),
      ...(inReview ? [{ id: "pa-5", severity: "info" as const, title: `${plural(inReview, "title")} in review`, detail: "SchoolShop checks new titles and price changes, usually within a working day", href: "/publisher/catalog" }] : []),
    ]
    return {
      publisherName: "Longhorn",
      termName: "Term 1, 2027",
      salesCents: live.reduce((t, b) => t + b.valueCents, 0),
      packs: live.reduce((t, b) => t + b.packs, 0),
      schools: live.length,
      commissionRate: payouts.commissionRate,
      batches: { collecting: all.length - live.length, readyToPack: ready.length, dispatched: all.filter((b) => b.status === "dispatched").length, received: all.filter((b) => b.status === "received").length },
      toDispatch: ready.slice(0, 5).map((b) => ({ id: b.id, schoolName: b.schoolName, town: b.town, packs: b.packs, dueAtSchool: b.dueAtSchool })),
      catalog: { live: items.filter((c) => c.status === "live" && !c.review).length, inReview, changesRequested: changes, lowStock: low.length },
      topTitles: [...titles].map(([title, t]) => ({ title, ...t })).sort((a, b) => b.salesCents - a.salesCents).slice(0, 5),
      alerts,
    }
  }],
  ["get", "/publisher/batches/", () => [...batches.values()]],
  ["post", "/publisher/batches/:id/dispatch/", ({ params, body }) => {
    const batch = batches.get(params.id) ?? raise(notFound())
    if (batch.status !== "ready_to_pack") throw new HttpError(409, { detail: "This batch isn't ready to dispatch." })
    const unavailable = ((body.unavailableLines as string[]) ?? []).filter((t) => batch.lines.some((l) => l.title === t))
    if (unavailable.length === batch.lines.length) throw new HttpError(400, { unavailableLines: ["At least one title must be in the delivery."] })
    Object.assign(batch, {
      status: "dispatched",
      unavailableLines: unavailable,
      dispatch: {
        deliveryNoteNo: `DN-${++deliveryNoteSeq}`,
        carrier: String(body.carrier),
        driverName: String(body.driverName),
        driverPhone: String(body.driverPhone),
        vehicleReg: String(body.vehicleReg).toUpperCase(),
        cartons: Number(body.cartons),
        dispatchedAt: new Date().toISOString().replace("Z", "+00:00"),
        expectedAt: String(body.expectedAt),
      },
    })
    return batch
  }],
  ["get", "/publisher/catalog/", () => [...catalog.values()]],
  ["get", "/publisher/payouts/", () => payouts],
  ["get", "/publisher/settings/", () => settings],
  ["patch", "/publisher/settings/profile/", ({ body }) => {
    Object.assign(settings.profile, body)
    return settings
  }],
  ["put", "/publisher/settings/notifications/", ({ body }) => {
    settings.notifications = body as typeof settings.notifications
    return settings
  }],
  ["put", "/publisher/payout-account/", ({ body }) => {
    const number = String(body.number ?? "").replace(/\s/g, "")
    const method = body.method as PublisherPayouts["account"]["method"]
    if (!/^\d{5,16}$/.test(number)) throw new HttpError(400, { number: ["Enter the number without spaces or dashes."] })
    const tail = number.slice(-2)
    const masked =
      method === "bank" ? `${String(body.reference)} · Account *** ${number.slice(-4)}`
      : method === "mpesa_till" ? `Till ${number.slice(0, 3)} *** ${tail}`
      : `Paybill ${number.slice(0, 3)} *** ${tail} · Account ${String(body.reference).toUpperCase()}`
    payouts.account = { method, accountName: String(body.accountName), masked, status: "pending_verification" }
    return payouts.account
  }],
  ["post", "/publisher/catalog/delete/", ({ body }) => {
    const ids = (body.ids as string[] | undefined) ?? []
    if (!ids.length) throw new HttpError(400, { ids: ["Choose at least one product."] })
    const found = ids.map((id) => catalog.get(id)).filter((c): c is CatalogItem => !!c)
    if (!found.length) throw notFound()
    const kept = found.filter((c) => c.schoolListCount > 0).map((c) => ({ id: c.id, title: c.title, reason: "It's on a school booklist, so it can't be deleted. Untick Live to hide it instead." }))
    for (const c of found) {
      if (c.schoolListCount > 0) continue
      catalog.delete(c.id)
      for (const [id, x] of submissions) if (x.catalogId === c.id && (x.status === "pending" || x.status === "changes_requested")) submissions.delete(id)
    }
    return { deleted: found.length - kept.length, kept }
  }],
  ["post", "/publisher/catalog/import/", ({ body }) => {
    const file = body.file as File | undefined
    if (!file) throw new HttpError(400, { file: ["Choose a file to upload."] })
    if (!/\.csv$/i.test(file.name)) throw new HttpError(400, { file: ["Upload a CSV file. In Excel, use Save As › CSV."] })
    const [header, ...lines] = parseCsv(String(body.fileText ?? ""))
    const cols = (header ?? []).map((c) => c.trim().toLowerCase())
    if (!cols.includes("title") || !cols.includes("price")) throw new HttpError(400, { file: ["The first row needs the column names: title, subject, grade, isbn, price, stock."] })
    const taken = new Set([...catalog.values()].map((c) => (c.isbn ?? "").replace(/\D/g, "")).filter(Boolean))
    const errors: { line: number; message: string }[] = []
    const ready: CatalogItem[] = []
    lines.forEach((row, i) => {
      const at = (name: string) => (row[cols.indexOf(name)] ?? "").trim()
      if (!row.some((v) => v.trim())) return
      const line = i + 2
      const price = Number(at("price").replace(/,/g, ""))
      const isbn = at("isbn")
      const before = errors.length
      if (at("title").length < 3) errors.push({ line, message: "Enter the title as it appears on the cover" })
      if (!(price > 0)) errors.push({ line, message: "Enter a price in whole shillings" })
      if (!/^\d*$/.test(at("stock"))) errors.push({ line, message: "Enter a whole number, 0 or more" })
      if (isbn && !/^(97[89]\d{10}|\d{9}[\dX])$/.test(isbn.replace(/[-\s]/g, ""))) errors.push({ line, message: "Enter a 13-digit ISBN, like 978-9966-36-412-8" })
      else if (isbn && taken.has(isbn.replace(/\D/g, ""))) errors.push({ line, message: "A title with this ISBN is already in your catalog or earlier in this file." })
      if (isbn) taken.add(isbn.replace(/\D/g, ""))
      if (errors.length > before) return
      const gradeLabel = at("grade") || "All grades"
      ready.push({
        id: `cat-${++catalogSeq}`, title: at("title"), subject: at("subject") || "General", gradeLabel, gradeBand: gradeBandOf(gradeLabel), isbn: isbn || null,
        format: at("format") || "Paperback, A4", priceCents: Math.round(price * 100), stock: Number(at("stock") || 0), lowStockAt: Number(at("low_stock") || 100),
        status: "draft", schoolListCount: 0, coverUrl: null, files: [], review: null,
      })
    })
    if (!ready.length && !errors.length) throw new HttpError(400, { file: ["There are no titles in this file."] })
    const dryRun = String(body.dryRun) !== "false"
    if (!dryRun) for (const item of ready) catalog.set(item.id, item)
    return { valid: ready.length, created: dryRun ? 0 : ready.length, errors }
  }],
  ["post", "/publisher/catalog/:id/cover/", ({ params, body }) => {
    const item = catalog.get(params.id) ?? raise(notFound())
    const file = body.file as File | undefined
    if (!file) throw new HttpError(400, { file: ["Choose a file to upload."] })
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) throw new HttpError(400, { file: ["Upload a JPG, PNG or WebP image."] })
    if (file.size > 5 * 1024 * 1024) throw new HttpError(400, { file: ["Keep it under 5 MB."] })
    item.coverUrl = URL.createObjectURL(file)
    return item
  }],
  ["delete", "/publisher/catalog/:id/cover/", ({ params }) => {
    const item = catalog.get(params.id) ?? raise(notFound())
    item.coverUrl = null
    return item
  }],
  ["post", "/publisher/catalog/:id/files/", ({ params, body }) => {
    const item = catalog.get(params.id) ?? raise(notFound())
    const kind = body.kind as CatalogFile["kind"]
    const label = String(body.label ?? "").trim()
    const file = body.file as File | undefined
    if (kind !== "document" && kind !== "resource") throw new HttpError(400, { kind: ["Choose whether it's for SchoolShop's review or comes with the title."] })
    if (label.length < 2) throw new HttpError(400, { label: [`Name the file, like ${kind === "document" ? "KICD approval letter" : "Teacher's guide"}.`] })
    if (!file) throw new HttpError(400, { file: ["Choose a file to upload."] })
    const allowed = kind === "document" ? /\.(pdf|jpe?g|png)$/i : /\.(pdf|epub|zip|docx|xlsx|pptx|mp3|mp4)$/i
    if (!allowed.test(file.name)) throw new HttpError(400, { file: [kind === "document" ? "Upload a PDF, JPG or PNG." : "Upload a PDF, EPUB, ZIP, Word, Excel, PowerPoint, MP3 or MP4 file."] })
    const limit = kind === "document" ? 10 : 50
    if (file.size > limit * 1024 * 1024) throw new HttpError(400, { file: [`Keep it under ${limit} MB.`] })
    if (item.files.filter((f) => f.kind === kind).length >= 10) throw new HttpError(400, { file: ["A title can have up to 10 of these. Remove one first."] })
    const id = `file-${Date.now()}`
    mockFiles.set(id, file)
    item.files.push({ id, kind, label, name: file.name, sizeBytes: file.size, contentType: file.type || "application/octet-stream", uploadedAt: stamp() })
    return item
  }],
  ["delete", "/publisher/catalog/:id/files/:fileId/", ({ params }) => {
    const item = catalog.get(params.id) ?? raise(notFound())
    if (!item.files.some((f) => f.id === params.fileId)) throw notFound()
    item.files = item.files.filter((f) => f.id !== params.fileId)
    mockFiles.delete(params.fileId)
    return item
  }],
  ["get", "/catalog/files/:id/", ({ params }) => mockFiles.get(params.id) ?? raise(notFound())],
  ["post", "/publisher/catalog/", ({ body }) => {
    const isbn = body.isbn ? String(body.isbn) : null
    if (isbn && [...catalog.values()].some((c) => c.isbn === isbn)) throw new HttpError(400, { isbn: ["A title with this ISBN is already in your catalog."] })
    const item: CatalogItem = { ...(body as Omit<CatalogItem, "id" | "schoolListCount" | "coverUrl" | "files">), isbn, id: `cat-${++catalogSeq}`, schoolListCount: 0, coverUrl: null, files: [], review: null }
    // A title the publisher wants schools to see waits for SchoolShop to check it first.
    if (item.status === "live") {
      const at = new Date().toISOString().replace(/\.\d+Z$/, "+00:00")
      Object.assign(item, { status: "draft", review: { state: "pending", note: null, submittedAt: at } })
      submissions.set(`sub-${item.id}`, {
        id: `sub-${item.id}`, catalogId: item.id, publisherId: "pub-longhorn", publisherName: "Longhorn Publishers", kind: "new_title", title: item.title, subject: item.subject, gradeLabel: item.gradeLabel,
        isbn: item.isbn, format: item.format, priceCents: item.priceCents, previousPriceCents: null, submittedAt: at, status: "pending", note: null,
        history: [{ id: "sent", at, actor: "Longhorn Publishers", text: "sent a new title" }],
      })
    }
    catalog.set(item.id, item)
    return item
  }],
  ["patch", "/publisher/catalog/:id/", ({ params, body }) => {
    const item = catalog.get(params.id) ?? raise(notFound())
    const isbn = "isbn" in body ? (body.isbn ? String(body.isbn) : null) : item.isbn
    if (isbn && [...catalog.values()].some((c) => c.isbn === isbn && c.id !== item.id)) throw new HttpError(400, { isbn: ["Another title already uses this ISBN."] })
    Object.assign(item, body, { isbn })
    return item
  }],
  ["get", "/admin/overview/", () => {
    const orgs = [...adminOrgs.values()]
    const live = (t: string) => orgs.filter((o) => o.type === t && o.status === "live").length
    const waiting = (t: string) => orgs.filter((o) => o.type === t && (o.status === "pending" || o.status === "info_requested")).length
    const [schools, publishers] = [waiting("school"), waiting("publisher")]
    const alerts = db.adminOverview.alerts.filter((a) => a.href !== "/admin/organisations" && !a.href.startsWith("/admin/orders") && !a.href.startsWith("/admin/refunds") && !a.href.startsWith("/admin/payments"))
    const open = allOrders().filter((o) => orderExtra(o).issue)
    const byIssue = (i: string) => open.filter((o) => orderExtra(o).issue === i)
    const unconfirmed = byIssue("payment_unconfirmed")
    const href = "/admin/orders?show=attention"
    const { requests, disputes: allDisputes } = refundsView()
    const openDisputes = allDisputes.filter((d) => d.status === "open")
    const toReview = [...submissions.values()].filter((x) => x.status === "pending")
    if (toReview.length) alerts.unshift({ id: "al-6", severity: "info", title: `${toReview.length} title${toReview.length === 1 ? "" : "s"} to review`, detail: `${new Set(toReview.map((x) => x.publisherName)).size} publishers`, href: "/admin/catalog" })
    if (requests.length) alerts.unshift({ id: "al-5", severity: "info", title: `${requests.length} refund${requests.length === 1 ? "" : "s"} to approve`, detail: `${formatKes(requests.reduce((t, r) => t + r.amountCents, 0))} back to parents`, href: "/admin/refunds" })
    if (openDisputes.length) alerts.unshift({ id: "al-4", severity: "medium", title: `${openDisputes.length} delivery dispute${openDisputes.length === 1 ? "" : "s"}`, detail: openDisputes.map((d) => `${d.schoolName} · ${d.publisherName} · ${d.packs} packs`).join("; "), href: "/admin/refunds?tab=disputes" })
    if (unconfirmed.length) alerts.unshift({ id: "al-3", severity: "medium", title: `${unconfirmed.length} M-Pesa payment${unconfirmed.length === 1 ? "" : "s"} not confirmed`, detail: "No callback after 2 minutes, status check queued", href })
    if (publishers) alerts.unshift({ id: "al-2", severity: "high", title: `${publishers} publisher application${publishers === 1 ? "" : "s"}`, detail: "Documents uploaded", href: "/admin/organisations" })
    if (schools) alerts.unshift({ id: "al-1", severity: "high", title: `${schools} school${schools === 1 ? "" : "s"} waiting for verification`, detail: "Oldest: 4 days ago", href: "/admin/organisations" })
    const rank = { high: 0, medium: 1, info: 2 }
    alerts.sort((x, y) => rank[x.severity] - rank[y.severity])
    return { ...db.adminOverview, liveSchools: live("school"), livePublishers: live("publisher"), alerts }
  }],
]

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function raise(error: Error): never {
  throw error
}

function strip({ checks: _checks, ...payment }: Payment & { checks: number }): Payment {
  return payment
}

function match(pattern: string, path: string) {
  const a = pattern.split("/")
  const b = path.split("/")
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

/** Mock mode only: a code that works right now in this class, so the demo can be tried. */
/** Multipart uploads as a plain object. CSV files also come as text, since handlers are synchronous. */
async function formBody(form: FormData) {
  const body: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    body[key] = value
    if (value instanceof File && /\.csv$/i.test(value.name)) body[`${key}Text`] = await value.text()
  }
  return body
}

export function demoCollectionCode(className: string) {
  const order = [...schoolOrders.values()].find((o) => o.className === className && o.status === "at_school")
  return order?.collectionCode ? { studentName: order.studentName, code: order.collectionCode } : null
}

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 250))
  const url = new URL(config.url ?? "", "http://mock")
  const method = (config.method ?? "get").toLowerCase()
  const query: Record<string, string> = Object.fromEntries(url.searchParams)
  for (const [key, value] of Object.entries(config.params ?? {})) if (value != null) query[key] = String(value)
  const body = config.data instanceof FormData ? await formBody(config.data) : typeof config.data === "string" && config.data ? JSON.parse(config.data) : (config.data ?? {})

  const respond = (status: number, data: unknown): AxiosResponse => ({ data, status, statusText: String(status), headers: {}, config })

  const auth = String(config.headers?.Authorization ?? "")
  const userId = auth.startsWith("Bearer mock-access-") ? auth.slice("Bearer mock-access-".length) : null
  const fail = (e: unknown) => {
    if (e instanceof HttpError) throw new AxiosError(e.message, String(e.status), config, null, respond(e.status, e.data))
    throw e
  }
  try {
    checkAccess(method, url.pathname, userId)
  } catch (e) {
    fail(e)
  }
  for (const [m, pattern, handler] of staffRoutes) {
    const params = m === method ? match(pattern, url.pathname) : null
    if (!params || !(params.scope in scopeOrg)) continue
    try {
      return respond(method === "post" && !pattern.endsWith("/resend/") ? 201 : 200, structuredClone(handler({ params, body, userId })))
    } catch (e) {
      fail(e)
    }
  }

  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue
    const params = match(pattern, url.pathname)
    if (!params) continue
    try {
      const created = method === "post" && !pattern.startsWith("/auth/")
      return respond(created ? 201 : 200, structuredClone(handler({ params, query, body, userId })))
    } catch (e) {
      if (e instanceof HttpError) {
        throw new AxiosError(e.message, String(e.status), config, null, respond(e.status, e.data))
      }
      throw e
    }
  }
  const missing = respond(404, { detail: `No mock for ${method.toUpperCase()} ${url.pathname}` })
  throw new AxiosError("Not found", "404", config, null, missing)
}
