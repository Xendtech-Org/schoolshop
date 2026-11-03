import { useDeferredValue, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Search, Send, Smartphone } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Sheet } from "@/components/common/Sheet"
import { OrderStatusBadge, ShipmentStatusBadge } from "@/components/common/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import * as endpoints from "@/lib/api/endpoints"
import { useAdminOrder, useAdminOrderMutation, useAdminOrders } from "@/lib/api/queries"
import type { AdminOrder, AdminOrderSummary, OrderIssue } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { useAccess } from "@/lib/useAccess"
import { cn } from "@/lib/utils"

/*
 * Every order on SchoolShop. Support finds an order from whatever the parent
 * has to hand (order number, M-Pesa receipt, phone or child's name), and the
 * "Needs attention" view collects what a person has to sort out: payments
 * M-Pesa never confirmed, short deliveries and refunds for items that ran out.
 */

type Show = "attention" | "all" | "unpaid" | "failed" | "paid" | "at_school" | "collected" | "refunds"
const shows: { id: Show; label: string; match: (o: AdminOrderSummary) => boolean }[] = [
  { id: "attention", label: "Needs attention", match: (o) => !!o.issue },
  { id: "all", label: "All orders", match: () => true },
  { id: "unpaid", label: "Awaiting payment", match: (o) => o.status === "pending_payment" },
  { id: "failed", label: "Payment failed", match: (o) => o.status === "payment_failed" },
  { id: "paid", label: "Paid, on the way", match: (o) => o.status === "paid" || o.status === "in_fulfilment" },
  { id: "at_school", label: "At school", match: (o) => o.status === "at_school" },
  { id: "collected", label: "Collected", match: (o) => o.status === "collected" },
  { id: "refunds", label: "Refunded", match: (o) => o.status === "partially_refunded" || o.status === "refunded" },
]
const PAGE = 25

const issueLabel: Record<OrderIssue, string> = {
  payment_unconfirmed: "M-Pesa not confirmed",
  short_delivery: "Delivery problem",
  refund_due: "Refund to approve",
}

const when = (iso: string) => new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
const day = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" })

export function AdminOrdersPage() {
  const orders = useAdminOrders()
  return (
    <>
      <PageHeader eyebrow="Term 1, 2027 · every school" title="Orders" />
      <QueryBoundary query={orders}>{(list) => <Orders list={list} />}</QueryBoundary>
    </>
  )
}

function Orders({ list }: { list: AdminOrderSummary[] }) {
  const [params, setParams] = useSearchParams()
  const show = (shows.find((s) => s.id === params.get("show"))?.id ?? "attention") as Show
  const school = params.get("school") ?? ""
  const openId = params.get("order")
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim().toLowerCase())
  const [page, setPage] = useState(0)

  const set = (next: Record<string, string>) => {
    setParams((p) => {
      for (const [k, v] of Object.entries(next)) if (v) p.set(k, v); else p.delete(k)
      return p
    })
    setPage(0)
  }

  const schools = useMemo(() => [...new Map(list.map((o) => [o.schoolId, o.schoolName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [list])
  // Search matches anything a parent might read out on the phone; digits match phone numbers however they're typed.
  const scoped = useMemo(() => {
    const digits = q.replace(/\D/g, "").replace(/^254/, "0")
    return list.filter((o) => {
      if (school && o.schoolId !== school) return false
      if (!q) return true
      const phone = o.parentPhone?.replace(/\D/g, "") ?? ""
      return `${o.number} ${o.mpesaReceipt ?? ""} ${o.studentName} ${o.parentName ?? ""}`.toLowerCase().includes(q) || (digits.length >= 4 && phone.includes(digits))
    })
  }, [list, q, school])
  const counts = Object.fromEntries(shows.map((s) => [s.id, scoped.filter(s.match).length])) as Record<Show, number>
  const shown = scoped.filter(shows.find((s) => s.id === show)!.match)
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages - 1)
  const rows = shown.slice(current * PAGE, (current + 1) * PAGE)
  const open = (id: string | null) => setParams((p) => { if (id) p.set("order", id); else p.delete("order"); return p })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="relative">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Order no., M-Pesa receipt, parent's phone or student" className="pl-10" />
          </label>
          <NativeSelect aria-label="School" value={school} onChange={(e) => set({ school: e.target.value })}>
            <option value="">All schools</option>
            {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </NativeSelect>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Show">
          {shows.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={show === s.id}
              onClick={() => set({ show: s.id })}
              className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap", show === s.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
            >
              {s.label}
              <span className={cn("rounded-full px-1.5 text-xs", show === s.id ? "bg-white/20" : s.id === "attention" && counts.attention ? "bg-sun text-ink" : "bg-secondary")}>{counts[s.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">
          {q ? "No orders match that search. Try the order number or the phone that paid." : show === "attention" ? "Nothing needs a person right now." : "No orders here."}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-semibold">{o.number}</span>
                        <span className="text-[13px] text-muted-foreground">{day(o.createdAt)}{o.mpesaReceipt ? ` · ${o.mpesaReceipt}` : ""}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium">{o.studentName}</span>
                        <span className="text-[13px] text-muted-foreground">{o.className} · {o.schoolName}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <span>{o.parentName ?? "—"}</span>
                        <span className="text-[13px] text-muted-foreground">{o.parentPhone}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex flex-col">
                        <span className="font-medium">{formatKes(o.totalCents)}</span>
                        {o.refundedCents > 0 && <span className="text-[13px] text-muted-foreground">{formatKes(o.refundedCents)} back</span>}
                      </span>
                    </TableCell>
                    <TableCell><RowStatus o={o} /></TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => open(o.id)} aria-label={`Open ${o.number}`}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => open(o.id)} aria-label={`Open ${o.number}`} className="flex w-full flex-col gap-2.5 rounded-2xl border bg-card p-4 text-left">
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{o.studentName}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{o.className} · {o.schoolName}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatKes(o.totalCents)}</span>
                  </span>
                  <span className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-muted-foreground">{o.number} · {day(o.createdAt)}</span>
                    <RowStatus o={o} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Showing {current * PAGE + 1}–{Math.min((current + 1) * PAGE, shown.length)} of {shown.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden /></Button>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden /></Button>
            </div>
          </nav>
        </>
      )}

      <Sheet open={!!openId} onClose={() => open(null)} title={list.find((o) => o.id === openId)?.number ?? "Order"} description="Everything about this order, newest first in the history.">
        {openId && <OrderPanel key={openId} id={openId} />}
      </Sheet>
    </div>
  )
}

function RowStatus({ o }: { o: AdminOrderSummary }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <OrderStatusBadge status={o.status} />
      {o.issue && <Badge variant="warning">{issueLabel[o.issue]}</Badge>}
    </span>
  )
}

function OrderPanel({ id }: { id: string }) {
  const order = useAdminOrder(id)
  return <QueryBoundary query={order}>{(o) => <OrderDetail order={o} />}</QueryBoundary>
}

function OrderDetail({ order: o }: { order: AdminOrder }) {
  const { can } = useAccess()
  const mayRefund = can("refunds.approve")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refunding, setRefunding] = useState<Set<string> | null>(null)
  const act = useAdminOrderMutation((fn: () => Promise<AdminOrder>) => fn())
  const run = (fn: () => Promise<AdminOrder>, done: (o: AdminOrder) => string) => {
    setError(null)
    act.mutateAsync(fn).then((next) => setNotice(done(next)), (e) => setError(errorText(e)))
  }

  const refundable = o.paidAt ? o.items.filter((i) => i.status !== "refunded") : []
  const startRefund = (pick: (i: AdminOrder["items"][number]) => boolean) => { setNotice(null); setRefunding(new Set(refundable.filter(pick).map((i) => i.id))) }
  const canResend = !!o.collectionCode && ["paid", "in_fulfilment", "at_school", "partially_refunded"].includes(o.status)
  const publishers = [...new Set(o.items.map((i) => i.publisherName))]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={o.status} />
        <span className="text-sm text-muted-foreground">Placed {when(o.createdAt)} · {o.termName}</span>
      </div>

      {notice && <p role="status" className="flex gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {o.issue && (
        <section aria-label="Needs attention" className="flex flex-col gap-3 rounded-xl bg-warn-bg p-4 text-warn-fg">
          <p className="flex gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span><span className="font-semibold">{issueLabel[o.issue]}.</span> {o.issueDetail}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {o.issue === "payment_unconfirmed" && (
              <Button size="sm" disabled={act.isPending} onClick={() => run(() => endpoints.checkOrderPayment(o.id), (n) => (n.status === "paid" ? `M-Pesa confirmed the payment (${n.mpesaReceipt}). ${n.parentName ?? "The parent"} has their collection code.` : "M-Pesa says it wasn't paid. The parent can try again from their phone."))}>
                <Smartphone aria-hidden /> Check with M-Pesa
              </Button>
            )}
            {o.issue === "refund_due" && mayRefund && (
              <Button size="sm" onClick={() => startRefund((i) => (o.refundRequest ? o.refundRequest.itemIds.includes(i.id) : i.status === "unavailable"))}>
                <RotateCcw aria-hidden /> {o.refundRequest?.from === "parent" ? "Refund what they asked for" : "Refund out-of-stock items"}
              </Button>
            )}
            {o.issue === "short_delivery" && mayRefund && (
              <>
                <Button size="sm" onClick={() => startRefund((i) => i.publisherName === "Moran")}><RotateCcw aria-hidden /> Refund missing items</Button>
                <ResolveButton orderId={o.id} onDone={() => setNotice("Marked as sorted.")} />
              </>
            )}
            {(o.issue === "refund_due" || o.issue === "short_delivery") && !mayRefund && <span className="text-sm">Finance or a super admin approves refunds.</span>}
          </div>
        </section>
      )}

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
        <Fact term="Student" value={o.studentName} sub={o.admissionNo} />
        <Fact term="Class and school" value={o.className} sub={o.schoolName} />
        <Fact term="Parent" value={o.parentName ?? "—"} sub={o.parentPhone} />
        <Fact term="Collection code" value={o.collectionCode ? (o.status === "collected" ? "Used" : "Sent by SMS") : "Not yet, unpaid"} sub={o.expectedAtSchool ? `Due at school ${day(o.expectedAtSchool)}` : null} />
      </dl>

      <section aria-labelledby="order-payments" className="flex flex-col gap-2">
        <h3 id="order-payments" className="font-semibold">Payment</h3>
        {o.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment started yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border text-sm">
            {o.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-medium">M-Pesa · {p.phone}</span>
                  <span className="text-[13px] text-muted-foreground">{when(p.at)}{p.receipt ? ` · ${p.receipt}` : ""}{p.failureReason ? ` · ${p.failureReason}` : ""}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{formatKes(p.amountCents)}</span>
                  <Badge variant={p.status === "succeeded" ? "success" : p.status === "failed" ? "destructive" : "warning"}>{p.status === "succeeded" ? "Paid" : p.status === "failed" ? "Failed" : "No result yet"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="order-items" className="flex flex-col gap-2">
        <h3 id="order-items" className="font-semibold">Items</h3>
        <div className="flex flex-col gap-3">
          {publishers.map((pub) => (
            <div key={pub} className="rounded-xl border">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                <span className="text-sm font-semibold">{pub}</span>
                {o.paidAt && <ShipmentStatusBadge status={o.shipments.find((s) => s.publisherName === pub)?.status ?? "collecting"} />}
              </div>
              <ul className="divide-y text-sm">
                {o.items.filter((i) => i.publisherName === pub).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    {refunding && i.status !== "refunded" && (
                      <Checkbox
                        aria-label={`Refund ${i.title}`}
                        checked={refunding.has(i.id)}
                        onCheckedChange={(v) => setRefunding((s) => { const n = new Set(s); if (v) n.add(i.id); else n.delete(i.id); return n })}
                      />
                    )}
                    <span className={cn("min-w-0 grow", i.status === "refunded" && "text-muted-foreground line-through")}>{i.qty > 1 ? `${i.qty} × ` : ""}{i.title}</span>
                    {i.status === "unavailable" && <Badge variant="warning">Out of stock</Badge>}
                    {i.status === "refunded" && <Badge variant="secondary">Refunded</Badge>}
                    <span className="shrink-0 font-medium">{formatKes(i.unitPriceCents * i.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-sm">
          <span>Total <span className="font-semibold">{formatKes(o.totalCents)}</span></span>
          {o.refundedCents > 0 && <span className="text-muted-foreground">Refunded {formatKes(o.refundedCents)}</span>}
        </div>
      </section>

      {refunding ? (
        <RefundForm order={o} selected={refunding} onCancel={() => setRefunding(null)} onDone={(text) => { setRefunding(null); setNotice(text) }} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {canResend && (
            <Button variant="outline" disabled={act.isPending} onClick={() => run(() => endpoints.resendOrderCode(o.id), () => `Collection code sent again to ${o.parentPhone}.`)}>
              <Send aria-hidden /> Resend collection code
            </Button>
          )}
          {mayRefund && refundable.length > 0 && !o.issue && <Button variant="outline" onClick={() => startRefund(() => false)}><RotateCcw aria-hidden /> Refund items</Button>}
        </div>
      )}

      <NoteBox orderId={o.id} />

      <section aria-labelledby="order-history">
        <h3 id="order-history" className="mb-2 font-semibold">History</h3>
        <ol className="flex flex-col gap-2.5 text-sm">
          {o.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted-foreground">{when(e.at)}</span>
              <span className="min-w-0"><span className="font-medium">{e.actor}</span> {e.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Fact({ term, value, sub }: { term: string; value: string; sub?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[13px] text-muted-foreground">{term}</dt>
      <dd className="truncate font-medium">{value}</dd>
      {sub && <dd className="truncate text-[13px] text-muted-foreground">{sub}</dd>}
    </div>
  )
}

function RefundForm({ order: o, selected, onCancel, onDone }: { order: AdminOrder; selected: Set<string>; onCancel: () => void; onDone: (text: string) => void }) {
  const [reason, setReason] = useState(o.refundRequest?.reason ?? (o.issue === "short_delivery" ? "Missing or damaged in the school's delivery." : ""))
  const [error, setError] = useState<string | null>(null)
  const refund = useAdminOrderMutation((v: { ids: string[]; reason: string }) => endpoints.refundOrderItems(o.id, v.ids, v.reason))
  const amount = o.items.filter((i) => selected.has(i.id)).reduce((t, i) => t + i.unitPriceCents * i.qty, 0)
  return (
    <form
      aria-label="Refund"
      className="flex flex-col gap-3 rounded-xl border border-primary/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!selected.size) return setError("Tick the items to refund above.")
        if (!reason.trim()) return setError("Give the reason. The parent sees it.")
        refund.mutateAsync({ ids: [...selected], reason: reason.trim() }).then(
          () => onDone(`Refunded ${formatKes(amount)} to ${o.parentPhone ?? "the parent"} by M-Pesa.`),
          (err) => setError(errorText(err, "reason"))
        )
      }}
    >
      <p className="text-sm">Tick the items to refund above. The money goes back to the M-Pesa number that paid{o.parentPhone ? `, ${o.parentPhone}` : ""}.</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Reason (the parent sees this)
        <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} rows={2} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={refund.isPending || !selected.size}>Refund {formatKes(amount)}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function ResolveButton({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const resolve = useAdminOrderMutation((n: string) => endpoints.resolveOrderIssue(orderId, n))
  if (!open) return <Button size="sm" variant="outline" className="bg-surface" onClick={() => setOpen(true)}>Replacement sent</Button>
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!note.trim()) return setError("Say how it was sorted out.")
        resolve.mutateAsync(note.trim()).then(onDone, (err) => setError(errorText(err, "note")))
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        How was it sorted out?
        <Input value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} placeholder="e.g. Moran delivered the missing packs on 18 Jan" className="bg-surface" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={resolve.isPending}>Mark sorted</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

function NoteBox({ orderId }: { orderId: string }) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = useAdminOrderMutation((n: string) => endpoints.addOrderNote(orderId, n))
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!note.trim()) return setError("Write the note first.")
        save.mutateAsync(note.trim()).then(() => setNote(""), (err) => setError(errorText(err, "note")))
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Add a note for the team
        <Textarea value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} rows={2} placeholder="e.g. Parent called, will collect on Friday" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="outline" className="self-start" disabled={save.isPending}>Save note</Button>
    </form>
  )
}
