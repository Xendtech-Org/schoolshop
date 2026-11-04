import { useDeferredValue, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Dialog } from "radix-ui"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Search, Send, ShieldCheck, X } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Sheet } from "@/components/common/Sheet"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import * as endpoints from "@/lib/api/endpoints"
import { useAdminMoney, useCollections, useMoneyMutation } from "@/lib/api/queries"
import type { AdminMoney, AdminPayout, Collection } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { useAccess } from "@/lib/useAccess"
import { cn } from "@/lib/utils"

/*
 * Money in and money out. Parents' M-Pesa payments are held until the school
 * confirms a delivery; then the publisher's payout (less commission and any
 * refunds) is ready for finance to release. Support can look, not release.
 */

type Tab = "payouts" | "collections"
type PayoutShow = "queued" | "on_hold" | "held" | "paid" | "all"
const payoutShows: { id: PayoutShow; label: string }[] = [
  { id: "queued", label: "Ready to release" },
  { id: "on_hold", label: "On hold" },
  { id: "held", label: "Waiting for delivery" },
  { id: "paid", label: "Paid" },
  { id: "all", label: "All" },
]
const payoutStatus: Record<AdminPayout["status"], [string, "success" | "warning" | "info" | "secondary"]> = {
  queued: ["Ready", "success"],
  on_hold: ["On hold", "warning"],
  held: ["Waiting for delivery", "info"],
  paid: ["Paid", "secondary"],
}
const day = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
const when = (iso: string) => new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
const sum = (ps: AdminPayout[], key: "netCents" | "grossCents" | "commissionCents" = "netCents") => ps.reduce((t, p) => t + p[key], 0)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const releasable = (p: AdminPayout) => p.status === "queued" && p.account.status === "verified"

export function AdminMoneyPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "collections" ? "collections" : "payouts"
  return (
    <>
      <PageHeader eyebrow="Term 1, 2027 · money is held until the school confirms delivery" title="Payments & payouts" />
      <div role="tablist" aria-label="Money" className="flex gap-1 border-b">
        {([["payouts", "Publisher payouts"], ["collections", "M-Pesa collections"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams((p) => { p.set("tab", id); p.delete("show"); p.delete("payout"); return p })}
            className={cn("-mb-px h-11 border-b-2 px-4 text-[15px] font-semibold", tab === id ? "border-ink" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "payouts" ? <PayoutsTab /> : <CollectionsTab />}
    </>
  )
}

/* ── Payouts ── */

function PayoutsTab() {
  const money = useAdminMoney()
  return <QueryBoundary query={money}>{(m) => <Payouts money={m} />}</QueryBoundary>
}

function Payouts({ money }: { money: AdminMoney }) {
  const { can } = useAccess()
  const mayRelease = can("payouts.release")
  const [params, setParams] = useSearchParams()
  const show = (payoutShows.find((s) => s.id === params.get("show"))?.id ?? "queued") as PayoutShow
  const openId = params.get("payout")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const ps = money.payouts
  const by = (s: AdminPayout["status"]) => ps.filter((p) => p.status === s)
  const shown = show === "all" ? ps : by(show)
  const ready = by("queued").filter(releasable)
  const selected = ps.filter((p) => picked.has(p.id) && releasable(p))
  const unverified = [...new Map(ps.filter((p) => p.account.status !== "verified" && p.status !== "paid").map((p) => [p.publisherId, p])).values()]
  const set = (k: string, v: string | null) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p })
  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard label="Ready to release" value={formatKes(sum(by("queued")))} hint={`${plural(by("queued").length, "payout")}, delivery confirmed`} />
        <StatCard label="On hold" value={formatKes(sum(by("on_hold")))} hint={`${by("on_hold").length} with an issue`} />
        <StatCard label="Waiting for delivery" value={formatKes(sum(by("held")))} hint={`${by("held").length} on the way to schools`} />
        <StatCard label="Paid out this term" value={formatKes(sum(by("paid")))} hint={`Commission ${formatKes(sum(ps, "commissionCents"))} at ${Math.round(money.commissionRate * 100)}%`} />
      </section>

      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-4.5 shrink-0" aria-hidden /> <span className="grow">{notice}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss" onClick={() => setNotice(null)}><X aria-hidden /></Button>
        </p>
      )}

      {unverified.map((p) => <AccountCheck key={p.publisherId} payout={p} mayRelease={mayRelease} onDone={setNotice} />)}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="Show">
          {payoutShows.map((s) => {
            const n = s.id === "all" ? ps.length : by(s.id).length
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={show === s.id}
                onClick={() => set("show", s.id)}
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap", show === s.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
              >
                {s.label}
                <span className={cn("rounded-full px-1.5 text-xs", show === s.id ? "bg-white/20" : "bg-secondary")}>{n}</span>
              </button>
            )
          })}
        </div>
        {mayRelease ? (
          <Button onClick={() => setConfirming(true)} disabled={!selected.length}>
            <Send aria-hidden /> {selected.length ? `Release ${selected.length} · ${formatKes(sum(selected))}` : "Release payouts"}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Finance or a super admin releases payouts.</span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">{show === "queued" ? "Nothing ready. Payouts appear here once a school confirms its delivery." : "Nothing here."}</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {mayRelease && (
                    <TableHead className="w-10">
                      {show === "queued" && ready.length > 0 && (
                        <Checkbox
                          aria-label="Select every payout ready to release"
                          checked={ready.every((p) => picked.has(p.id)) ? true : ready.some((p) => picked.has(p.id)) ? "indeterminate" : false}
                          onCheckedChange={(v) => setPicked(v ? new Set(ready.map((p) => p.id)) : new Set())}
                        />
                      )}
                    </TableHead>
                  )}
                  <TableHead>Publisher</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Less</TableHead>
                  <TableHead className="text-right">To pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id} data-state={picked.has(p.id) ? "selected" : undefined}>
                    {mayRelease && (
                      <TableCell>
                        {releasable(p) && <Checkbox aria-label={`Select ${p.publisherName}, ${p.schoolName}`} checked={picked.has(p.id)} onCheckedChange={(v) => toggle(p.id, !!v)} />}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-semibold">{p.publisherName}</span>
                        <span className={cn("text-[13px]", p.account.status === "verified" ? "text-muted-foreground" : "text-warn-fg")}>{p.account.status === "verified" ? p.account.masked : "Account not confirmed"}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <span>{p.schoolName}</span>
                        <span className="text-[13px] text-muted-foreground">{p.deliveryNoteNo} · {p.packs} packs{p.receivedAt ? ` · received ${day(p.receivedAt)}` : ""}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatKes(p.grossCents)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatKes(p.commissionCents + p.deductionsCents)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatKes(p.netCents)}</TableCell>
                    <TableCell><Badge variant={payoutStatus[p.status][1]}>{payoutStatus[p.status][0]}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => set("payout", p.id)} aria-label={`Open ${p.publisherName}, ${p.schoolName}`}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-2.5 md:hidden">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  {mayRelease && releasable(p) && <Checkbox className="mt-0.5" aria-label={`Select ${p.publisherName}, ${p.schoolName}`} checked={picked.has(p.id)} onCheckedChange={(v) => toggle(p.id, !!v)} />}
                  <span className="flex min-w-0 grow flex-col">
                    <span className="font-semibold">{p.publisherName}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{p.schoolName} · {p.deliveryNoteNo}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatKes(p.netCents)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={payoutStatus[p.status][1]}>{payoutStatus[p.status][0]}</Badge>
                  <Button variant="outline" size="sm" onClick={() => set("payout", p.id)} aria-label={`Open ${p.publisherName}, ${p.schoolName}`}>Open</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ReleaseDialog
        open={confirming}
        payouts={selected}
        onClose={() => setConfirming(false)}
        onDone={(text) => { setConfirming(false); setPicked(new Set()); setNotice(text) }}
      />
      <Sheet open={!!openId} onClose={() => set("payout", null)} title={ps.find((p) => p.id === openId)?.publisherName ?? "Payout"} description={ps.find((p) => p.id === openId)?.schoolName ?? ""}>
        {openId && ps.find((p) => p.id === openId) && <PayoutDetail key={openId} payout={ps.find((p) => p.id === openId)!} mayRelease={mayRelease} />}
      </Sheet>
    </div>
  )
}

function AccountCheck({ payout: p, mayRelease, onDone }: { payout: AdminPayout; mayRelease: boolean; onDone: (text: string) => void }) {
  const verify = useMoneyMutation(() => endpoints.verifyPayoutAccount(p.publisherId))
  const [error, setError] = useState<string | null>(null)
  return (
    <section aria-label={`${p.publisherName} payout account`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-warn-fg">
      <AlertTriangle className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 grow basis-64 text-sm">
        <span className="font-semibold">{p.publisherName} changed their payout account</span> to {p.account.masked} ({p.account.accountName}). Nothing goes to them until someone calls them on the number we already had and confirms it.
      </p>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
      {mayRelease && (
        <Button size="sm" variant="outline" className="bg-surface" disabled={verify.isPending} onClick={() => verify.mutateAsync(undefined).then(() => onDone(`The new payout account for ${p.publisherName} is confirmed. Their payouts can go.`), (e) => setError(errorText(e)))}>
          <ShieldCheck aria-hidden /> I've confirmed it with them
        </Button>
      )}
    </section>
  )
}

function ReleaseDialog({ open, payouts, onClose, onDone }: { open: boolean; payouts: AdminPayout[]; onClose: () => void; onDone: (text: string) => void }) {
  const release = useMoneyMutation((rows: { id: string; reference: string }[]) => endpoints.releasePayouts(rows))
  const [error, setError] = useState<string | null>(null)
  const [refs, setRefs] = useState<Record<string, string>>({})
  const total = sum(payouts)
  const missing = payouts.some((p) => !refs[p.id]?.trim())
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { setError(null); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] max-w-lg -translate-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 outline-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-xl font-semibold">Record {formatKes(total)} as paid</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">Send each payout from the bank or M-Pesa business account first, then enter its transaction reference. Each publisher gets an SMS and email with it.</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button></Dialog.Close>
          </div>
          <ul className="divide-y rounded-xl border text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{p.publisherName} · {p.schoolName}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{p.account.masked}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatKes(p.netCents)}</span>
                </span>
                <Input aria-label={`Transaction reference for ${p.publisherName}, ${p.schoolName}`} placeholder="Transaction reference, e.g. QK7H2M9X" value={refs[p.id] ?? ""} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} />
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={release.isPending || !payouts.length || missing} onClick={() => release.mutateAsync(payouts.map((p) => ({ id: p.id, reference: refs[p.id].trim() }))).then(() => { setRefs({}); onDone(`Recorded ${formatKes(total)} paid to ${plural(new Set(payouts.map((p) => p.publisherId)).size, "publisher")}.`) }, (e) => setError(errorText(e)))}>
              <Send aria-hidden /> Record {formatKes(total)} as paid
            </Button>
            <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PayoutDetail({ payout: p, mayRelease }: { payout: AdminPayout; mayRelease: boolean }) {
  const [holding, setHolding] = useState(false)
  const [paying, setPaying] = useState(false)
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const act = useMoneyMutation((fn: () => Promise<AdminMoney>) => fn())
  const run = (fn: () => Promise<AdminMoney>) => { setError(null); act.mutateAsync(fn).then(() => { setHolding(false); setPaying(false); setReason(""); setReference("") }, (e) => setError(errorText(e, "reason"))) }
  const rows: [string, number, string?][] = [
    ["Parents paid for these packs", p.grossCents],
    [`SchoolShop commission`, -p.commissionCents],
    ...(p.deductionsCents ? [["Refunded to parents", -p.deductionsCents, p.deductionNote ?? undefined] as [string, number, string?]] : []),
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={payoutStatus[p.status][1]}>{payoutStatus[p.status][0]}</Badge>
        <span className="text-sm text-muted-foreground">{p.deliveryNoteNo} · {p.packs} packs · {p.termName}</span>
      </div>
      {p.status === "on_hold" && p.holdReason && <p className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg"><span className="font-semibold">On hold.</span> {p.holdReason}</p>}
      {p.status === "held" && <p className="rounded-xl bg-info-bg px-4 py-3 text-sm">{p.receivedAt ? `${p.schoolName} confirmed the delivery. It's ready to release once the hold days set in Fees & settings have passed.` : `This becomes ready to release once ${p.schoolName} confirms the delivery.`}</p>}

      <section aria-label="Breakdown" className="rounded-xl border">
        <dl className="divide-y text-sm">
          {rows.map(([label, cents, note]) => (
            <div key={label} className="flex items-start justify-between gap-3 px-4 py-3">
              <dt className="flex flex-col"><span>{label}</span>{note && <span className="text-[13px] text-muted-foreground">{note}</span>}</dt>
              <dd className="shrink-0">{cents < 0 ? `− ${formatKes(-cents)}` : formatKes(cents)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 px-4 py-3 font-semibold"><dt>{p.status === "paid" ? "Paid to publisher" : "To pay the publisher"}</dt><dd>{formatKes(p.netCents)}</dd></div>
        </dl>
      </section>

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 flex-col"><dt className="text-[13px] text-muted-foreground">Pay to</dt><dd className="font-medium">{p.account.masked}</dd><dd className="text-[13px] text-muted-foreground">{p.account.accountName}</dd></div>
        <div className="flex min-w-0 flex-col"><dt className="text-[13px] text-muted-foreground">Account</dt><dd className={cn("font-medium", p.account.status !== "verified" && "text-warn-fg")}>{p.account.status === "verified" ? "Confirmed" : "Changed, not confirmed yet"}</dd></div>
        <div className="flex min-w-0 flex-col"><dt className="text-[13px] text-muted-foreground">Delivery confirmed</dt><dd className="font-medium">{p.receivedAt ? when(p.receivedAt) : "Not yet"}</dd></div>
        <div className="flex min-w-0 flex-col"><dt className="text-[13px] text-muted-foreground">Reference</dt><dd className="font-medium">{p.reference ?? "—"}</dd></div>
      </dl>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {mayRelease && p.status !== "paid" && (
        paying ? (
          <form className="flex flex-col gap-3 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); if (!reference.trim()) return setError("Enter the transaction reference."); run(() => endpoints.releasePayouts([{ id: p.id, reference: reference.trim() }])) }}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Send {formatKes(p.netCents)} to {p.account.masked} first, then enter the transaction reference
              <Input value={reference} onChange={(e) => { setReference(e.target.value); setError(null) }} placeholder="e.g. QK7H2M9X" autoFocus />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={act.isPending}>Record as paid</Button>
              <Button type="button" variant="ghost" onClick={() => setPaying(false)}>Cancel</Button>
            </div>
          </form>
        ) : holding ? (
          <form className="flex flex-col gap-3 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return setError("Give the reason. The publisher sees it."); run(() => endpoints.holdPayout(p.id, reason.trim())) }}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Why hold this payout?
              <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} rows={2} autoFocus />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={act.isPending}>Put on hold</Button>
              <Button type="button" variant="ghost" onClick={() => setHolding(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {releasable(p) && <Button disabled={act.isPending} onClick={() => setPaying(true)}><Send aria-hidden /> Record {formatKes(p.netCents)} as paid</Button>}
            {p.status === "on_hold" ? (
              <Button variant="outline" disabled={act.isPending} onClick={() => run(() => endpoints.unholdPayout(p.id, ""))}>Take off hold</Button>
            ) : (
              <Button variant="outline" onClick={() => setHolding(true)}>Put on hold</Button>
            )}
          </div>
        )
      )}

      <section aria-labelledby="payout-history">
        <h3 id="payout-history" className="mb-2 font-semibold">History</h3>
        <ol className="flex flex-col gap-2.5 text-sm">
          {p.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted-foreground">{when(e.at)}</span>
              <span className="min-w-0"><span className="font-medium">{e.actor}</span> {e.text}</span>
            </li>
          ))}
          {p.events.length === 0 && <li className="text-muted-foreground">Nothing yet. The school hasn't confirmed the delivery.</li>}
        </ol>
      </section>
    </div>
  )
}

/* ── M-Pesa collections ── */

type CollShow = "all" | "succeeded" | "failed" | "unconfirmed"
const collShows: { id: CollShow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "succeeded", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "unconfirmed", label: "No result" },
]
const PAGE = 25

function CollectionsTab() {
  const collections = useCollections()
  return <QueryBoundary query={collections}>{(c) => <Collections rows={c} />}</QueryBoundary>
}

function Collections({ rows }: { rows: Collection[] }) {
  const [show, setShow] = useState<CollShow>("all")
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim().toLowerCase())
  const [page, setPage] = useState(0)
  const scoped = useMemo(() => {
    const digits = q.replace(/\D/g, "").replace(/^254/, "0")
    return rows.filter((r) => !q || `${r.receipt ?? ""} ${r.orderNumber} ${r.schoolName}`.toLowerCase().includes(q) || (digits.length >= 4 && r.phone.replace(/\D/g, "").includes(digits)))
  }, [rows, q])
  const shown = show === "all" ? scoped : scoped.filter((r) => r.status === show)
  const paid = scoped.filter((r) => r.status === "succeeded")
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages - 1)
  const pageRows = shown.slice(current * PAGE, (current + 1) * PAGE)
  const badge = (s: Collection["status"]) => (s === "succeeded" ? <Badge variant="success">Paid</Badge> : s === "failed" ? <Badge variant="destructive">Failed</Badge> : <Badge variant="warning">No result</Badge>)

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Collected" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard label="Received by M-Pesa" value={formatKes(paid.reduce((t, r) => t + r.amountCents, 0))} hint={`${paid.length} payments${q ? " matching" : ""}`} />
        <StatCard label="Failed" value={String(scoped.filter((r) => r.status === "failed").length)} hint="Parents can try again" />
        <StatCard label="No result from M-Pesa" value={String(scoped.filter((r) => r.status === "unconfirmed").length)} hint="Check them on the order" />
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-0 grow basis-72">
            <span className="sr-only">Search payments</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="M-Pesa receipt, phone, order no. or school" className="pl-10" />
          </label>
          <Button variant="outline" onClick={() => downloadReconciliation(shown)}><Download aria-hidden /> Export for reconciliation</Button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Payment status">
          {collShows.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={show === s.id}
              onClick={() => { setShow(s.id); setPage(0) }}
              className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap", show === s.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
            >
              {s.label}
              <span className={cn("rounded-full px-1.5 text-xs", show === s.id ? "bg-white/20" : "bg-secondary")}>{s.id === "all" ? scoped.length : scoped.filter((r) => r.status === s.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">No payments match. Try the receipt code from the parent's SMS.</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{when(r.at)}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.receipt ?? "—"}</TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <Link to={`/admin/orders?show=all&order=${r.orderId}`} className="font-medium text-accent-text hover:underline">{r.orderNumber}</Link>
                        <span className="text-[13px] text-muted-foreground">{r.schoolName}</span>
                      </span>
                    </TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell className="text-right font-medium">{formatKes(r.amountCents)}</TableCell>
                    <TableCell>{badge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {pageRows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <Link to={`/admin/orders?show=all&order=${r.orderId}`} className="font-semibold text-accent-text">{r.orderNumber}</Link>
                    <span className="truncate text-[13px] text-muted-foreground">{r.schoolName} · {r.phone}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatKes(r.amountCents)}</span>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
                  <span>{when(r.at)}{r.receipt ? ` · ${r.receipt}` : ""}</span>
                  {badge(r.status)}
                </span>
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
    </div>
  )
}

/** One row per payment, in the columns the Paybill statement uses, so finance can match them up in a spreadsheet. */
function downloadReconciliation(rows: Collection[]) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [
    ["Date", "Receipt", "Order", "School", "Phone", "Amount (KES)", "Status"],
    ...rows.map((r) => [r.at.slice(0, 16).replace("T", " "), r.receipt ?? "", r.orderNumber, r.schoolName, r.phone, (r.amountCents / 100).toFixed(2), r.status === "succeeded" ? "Paid" : r.status === "failed" ? "Failed" : "No result"]),
  ].map((r) => r.map(cell).join(",")).join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  a.download = "schoolshop-mpesa-collections.csv"
  a.click()
  URL.revokeObjectURL(a.href)
}
