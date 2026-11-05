import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Dialog } from "radix-ui"
import { CheckCircle2, PackageX, RotateCcw, X } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import * as endpoints from "@/lib/api/endpoints"
import { useAdminRefunds, useRefundsMutation } from "@/lib/api/queries"
import type { AdminRefunds, Dispute, RefundQueueItem } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { useAccess } from "@/lib/useAccess"
import { cn } from "@/lib/utils"

/*
 * Money going back to parents. Refunds wait here when a publisher can't
 * supply an item or a parent asks; delivery disputes wait until the
 * publisher replaces the packs or the parents are refunded (and the
 * publisher's payout pays for it). Support can look, not decide.
 */

type Tab = "approve" | "disputes" | "refunded"
const when = (iso: string) => new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const total = (rs: { amountCents: number }[]) => rs.reduce((t, r) => t + r.amountCents, 0)

export function AdminRefundsPage() {
  const data = useAdminRefunds()
  return (
    <>
      <PageHeader eyebrow="Term 1, 2027 · money goes back to the M-Pesa number that paid" title="Refunds & disputes" />
      <QueryBoundary query={data}>{(d) => <Refunds data={d} />}</QueryBoundary>
    </>
  )
}

function Refunds({ data }: { data: AdminRefunds }) {
  const { can } = useAccess()
  const mayDecide = can("refunds.approve")
  const [params, setParams] = useSearchParams()
  const tab = (["approve", "disputes", "refunded"].includes(params.get("tab") ?? "") ? params.get("tab") : "approve") as Tab
  const [notice, setNotice] = useState<string | null>(null)
  const open = data.disputes.filter((d) => d.status === "open")
  const tabs: [Tab, string, number | null][] = [["approve", "To approve", data.requests.length], ["disputes", "Delivery disputes", open.length], ["refunded", "Refunded", null]]

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Waiting for approval" value={formatKes(total(data.requests))} hint={plural(data.requests.length, "refund")} />
        <StatCard label="Open delivery disputes" value={String(open.length)} hint={`${open.reduce((t, d) => t + d.packs, 0)} packs short or damaged`} />
        <StatCard label="Refunded this term" value={formatKes(total(data.refunded))} hint={plural(data.refunded.length, "refund")} />
      </section>

      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-4.5 shrink-0" aria-hidden /> <span className="grow">{notice}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss" onClick={() => setNotice(null)}><X aria-hidden /></Button>
        </p>
      )}
      {!mayDecide && <p className="rounded-xl bg-info-bg px-4 py-3 text-sm">You can look up refunds and disputes. Finance or a super admin approves refunds and settles disputes.</p>}

      <div role="tablist" aria-label="Refunds" className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams((p) => { p.set("tab", id); return p })}
            className={cn("-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-[15px] font-semibold whitespace-nowrap", tab === id ? "border-ink" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label}
            {n !== null && <span className={cn("rounded-full px-1.5 text-xs", n ? "bg-sun text-ink" : "bg-secondary")}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === "approve" && <ApproveTab requests={data.requests} mayDecide={mayDecide} onNotice={setNotice} />}
      {tab === "disputes" && <DisputesTab disputes={data.disputes} mayDecide={mayDecide} onNotice={setNotice} />}
      {tab === "refunded" && <RefundedTab data={data} />}
    </div>
  )
}

/* ── To approve ── */

function ApproveTab({ requests, mayDecide, onNotice }: { requests: RefundQueueItem[]; mayDecide: boolean; onNotice: (t: string) => void }) {
  const [confirming, setConfirming] = useState<RefundQueueItem[] | null>(null)
  if (!requests.length) return <Empty text="No refunds waiting. They appear here when a publisher can't supply an item or a parent asks for money back." />
  // Publisher shortfalls share one reason, so they're approved together; parents' requests are each their own call.
  const groups = [...new Map(requests.filter((r) => r.from === "publisher").map((r) => [r.reason, requests.filter((x) => x.from === "publisher" && x.reason === r.reason)])).entries()]
  const parents = requests.filter((r) => r.from === "parent")
  return (
    <>
      {groups.map(([reason, rows]) => (
        <section key={reason} aria-label={reason} className="overflow-hidden rounded-2xl border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 font-semibold"><PackageX className="size-4.5 shrink-0 text-warn-fg" aria-hidden />{reason}</span>
              <span className="text-[13px] text-muted-foreground">{plural(rows.length, "order")} · {formatKes(total(rows))} · already taken off the publisher's payout</span>
            </div>
            {mayDecide && <Button onClick={() => setConfirming(rows)}><RotateCcw aria-hidden /> Refund all {rows.length}</Button>}
          </header>
          <ul className="divide-y">
            {rows.map((r) => <RequestRow key={r.orderId} r={r} mayDecide={mayDecide} onRefund={() => setConfirming([r])} onNotice={onNotice} />)}
          </ul>
        </section>
      ))}
      {parents.length > 0 && (
        <section aria-label="Asked by parents" className="overflow-hidden rounded-2xl border bg-card">
          <header className="border-b px-4 py-3.5">
            <span className="font-semibold">Asked by parents</span>
            <p className="text-[13px] text-muted-foreground">Refund before the publisher packs the order. Decline if it's already been handed out.</p>
          </header>
          <ul className="divide-y">
            {parents.map((r) => <RequestRow key={r.orderId} r={r} mayDecide={mayDecide} onRefund={() => setConfirming([r])} onNotice={onNotice} />)}
          </ul>
        </section>
      )}
      <ConfirmRefund rows={confirming} onClose={() => setConfirming(null)} onDone={(t) => { setConfirming(null); onNotice(t) }} />
    </>
  )
}

function RequestRow({ r, mayDecide, onRefund, onNotice }: { r: RefundQueueItem; mayDecide: boolean; onRefund: () => void; onNotice: (t: string) => void }) {
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const decline = useRefundsMutation((why: string) => endpoints.declineRefund(r.orderId, why))
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex min-w-0 grow basis-60 flex-col">
          <span className="font-medium">
            <Link to={`/admin/orders?show=all&order=${r.orderId}`} className="text-accent-text hover:underline">{r.orderNumber}</Link> · {r.studentName}
          </span>
          <span className="text-[13px] text-muted-foreground">{r.schoolName} · {r.parentName ?? "Parent"} {r.parentPhone}</span>
          {r.from === "parent" && <span className="mt-1 text-sm">“{r.reason}”</span>}
          <span className="mt-1 text-[13px] text-muted-foreground">{r.items.map((i) => i.title).join(", ")} · asked {when(r.requestedAt)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-semibold">{formatKes(r.amountCents)}</span>
          {mayDecide && !declining && (
            <>
              <Button size="sm" variant="outline" onClick={onRefund} aria-label={`Refund ${r.orderNumber}`}>Refund</Button>
              {r.from === "parent" && <Button size="sm" variant="ghost" onClick={() => setDeclining(true)} aria-label={`Decline ${r.orderNumber}`}>Decline</Button>}
            </>
          )}
        </span>
      </div>
      {declining && (
        <form
          className="flex flex-col gap-2 rounded-xl border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!reason.trim()) return setError("Tell the parent why. They get this by SMS.")
            decline.mutateAsync(reason.trim()).then(() => onNotice(`Declined ${r.orderNumber}. ${r.parentName ?? "The parent"} has been told why.`), (err) => setError(errorText(err, "reason")))
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Why not? (sent to the parent)
            <Input value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} placeholder="e.g. The pack was handed out on 15 Jan" autoFocus />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={decline.isPending}>Decline refund</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDeclining(false); setError(null) }}>Cancel</Button>
          </div>
        </form>
      )}
    </li>
  )
}

function ConfirmRefund({ rows, onClose, onDone }: { rows: RefundQueueItem[] | null; onClose: () => void; onDone: (t: string) => void }) {
  const approve = useRefundsMutation((ids: string[]) => endpoints.approveRefunds(ids))
  const [error, setError] = useState<string | null>(null)
  const amount = total(rows ?? [])
  return (
    <Dialog.Root open={!!rows} onOpenChange={(o) => { if (!o) { setError(null); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] max-w-lg -translate-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 outline-none">
          {rows && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Dialog.Title className="font-display text-xl font-semibold">Refund {formatKes(amount)}?</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {rows.length === 1 ? "The money goes" : `${rows.length} refunds go`} back by M-Pesa now. Each parent gets an SMS with the amount.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button></Dialog.Close>
              </div>
              <ul className="divide-y rounded-xl border text-sm">
                {rows.map((r) => (
                  <li key={r.orderId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 flex-col"><span className="font-medium">{r.orderNumber} · {r.studentName}</span><span className="truncate text-[13px] text-muted-foreground">{r.parentPhone}</span></span>
                    <span className="shrink-0 font-semibold">{formatKes(r.amountCents)}</span>
                  </li>
                ))}
              </ul>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button disabled={approve.isPending} onClick={() => approve.mutateAsync(rows.map((r) => r.orderId)).then(() => onDone(`Refunded ${formatKes(amount)} to ${plural(rows.length, "parent")}.`), (e) => setError(errorText(e)))}>
                  <RotateCcw aria-hidden /> Refund {formatKes(amount)}
                </Button>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ── Delivery disputes ── */

function DisputesTab({ disputes, mayDecide, onNotice }: { disputes: Dispute[]; mayDecide: boolean; onNotice: (t: string) => void }) {
  if (!disputes.length) return <Empty text="No delivery disputes. Schools raise one when they receive a delivery short or damaged." />
  return <>{disputes.map((d) => <DisputeCard key={d.id} d={d} mayDecide={mayDecide} onNotice={onNotice} />)}</>
}

const payoutLabel = { held: "waiting for delivery", on_hold: "on hold", queued: "ready to release", processing: "transfer processing", paid: "already paid" } as const

function DisputeCard({ d, mayDecide, onNotice }: { d: Dispute; mayDecide: boolean; onNotice: (t: string) => void }) {
  const [replacing, setReplacing] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const act = useRefundsMutation((fn: () => Promise<AdminRefunds>) => fn())
  // The school counts packs per class, so whoever settles ticks the students actually missing one.
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const toggle = (id: string, on: boolean) => setTicked((t) => { const n = new Set(t); if (on) n.add(id); else n.delete(id); return n })
  const tickedCents = d.orders.filter((o) => ticked.has(o.id)).reduce((t, o) => t + o.amountCents, 0)
  const run = (fn: () => Promise<AdminRefunds>, text: string) => { setError(null); act.mutateAsync(fn).then(() => onNotice(text), (e) => setError(errorText(e, "note"))) }
  const resolved = d.status === "resolved"
  return (
    <article aria-label={`${d.schoolName} · ${d.publisherName}`} className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5", resolved && "opacity-80")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={resolved ? "secondary" : "warning"}>{resolved ? "Settled" : d.kind === "short" ? `${d.packs} packs short` : `${d.packs} packs damaged`}</Badge>
            <span className="text-[13px] text-muted-foreground">{d.deliveryNoteNo} · reported by {d.reportedBy}, {when(d.reportedAt)}</span>
          </span>
          <h2 className="font-display text-xl font-semibold">{d.schoolName} · {d.publisherName}</h2>
          <p className="text-sm">{d.detail}</p>
        </div>
        {!resolved && <span className="text-right text-sm"><span className="block text-[13px] text-muted-foreground">Refunding every order listed costs</span><span className="font-display text-lg font-semibold">{formatKes(d.refundCents)}</span></span>}
      </header>

      {resolved && d.resolution && <p className="rounded-xl bg-success-bg px-4 py-3 text-sm"><span className="font-semibold">Settled.</span> {d.resolution}</p>}

      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Affected orders" className="min-w-0 rounded-xl border">
          <h3 className="border-b px-4 py-2.5 text-sm font-semibold">
            {plural(d.orders.length, "order")} in the affected classes
            {!resolved && mayDecide && <span className="block text-[13px] font-normal text-muted-foreground">Tick the students {d.schoolName} says are missing a pack.</span>}
          </h3>
          <ul className="divide-y text-sm">
            {d.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                {!resolved && mayDecide && o.open && <Checkbox aria-label={`Refund ${o.studentName}`} checked={ticked.has(o.id)} onCheckedChange={(v) => toggle(o.id, !!v)} />}
                <span className="min-w-0 grow truncate"><Link to={`/admin/orders?show=all&order=${o.id}`} className="font-medium text-accent-text hover:underline">{o.number}</Link> · {o.studentName}, {o.className}</span>
                <span className="flex shrink-0 items-center gap-2">{o.refunded ? <Badge variant="secondary">Refunded</Badge> : !o.open && <Badge variant="secondary">Replaced</Badge>}<span className={cn(!o.open && "text-muted-foreground")}>{formatKes(o.amountCents)}</span></span>
              </li>
            ))}
          </ul>
        </section>
        {d.payout && (
          <section aria-label="Publisher payout" className="flex min-w-0 flex-col gap-1 rounded-xl bg-secondary/60 p-4 text-sm">
            <span className="text-[13px] text-muted-foreground">{d.publisherName}'s payout for this delivery</span>
            <span className="font-semibold">{formatKes(d.payout.netCents)} · {payoutLabel[d.payout.status]}</span>
            <span className="text-[13px] text-muted-foreground">{resolved ? "" : d.payout.status === "paid" ? "A refund comes off their next payout." : d.payout.status === "processing" ? "Reconcile the in-progress transfer with SasaPay before attempting another release." : "A refund comes off this payout. Settling takes it off hold."}</span>
            <Link to={`/admin/payments?show=all&payout=${d.payout.id}`} className="mt-1 text-[13px] font-semibold text-accent-text hover:underline">Open the payout</Link>
          </section>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!resolved && mayDecide && (
        replacing ? (
          <form className="flex flex-col gap-2 rounded-xl border p-3" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return setError("Say what the publisher sent and when."); run(() => endpoints.settleDisputeByReplacement(d.id, note.trim()), `${d.schoolName}'s dispute is settled. ${d.publisherName}'s payout is free to go.`) }}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              What did {d.publisherName} send?
              <Input value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} placeholder={`e.g. ${d.packs} replacement packs delivered on 18 Jan`} autoFocus />
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={act.isPending}>Mark settled</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setReplacing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={act.isPending || !ticked.size} onClick={() => run(() => endpoints.settleDisputeByRefund(d.id, [...ticked]), `Refunded ${formatKes(tickedCents)} to ${plural(ticked.size, "parent")}. It comes off ${d.publisherName}'s payout.`)}>
              <RotateCcw aria-hidden /> {ticked.size ? `Refund ${plural(ticked.size, "parent")} · ${formatKes(tickedCents)}` : "Tick who to refund"}
            </Button>
            <Button variant="outline" onClick={() => setReplacing(true)}>Replacement delivered</Button>
          </div>
        )
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">History</summary>
        <ol className="mt-2 flex flex-col gap-2">
          {d.events.map((e) => (
            <li key={e.id} className="flex gap-3"><span className="w-24 shrink-0 text-muted-foreground">{when(e.at)}</span><span className="min-w-0"><span className="font-medium">{e.actor}</span> {e.text}</span></li>
          ))}
        </ol>
      </details>
    </article>
  )
}

/* ── Refunded ── */

function RefundedTab({ data }: { data: AdminRefunds }) {
  const rows = data.refunded
  if (!rows.length) return <Empty text="No refunds this term yet." />
  const link = (r: AdminRefunds["refunded"][number]) => (r.orderId ? <Link to={`/admin/orders?show=all&order=${r.orderId}`} className="font-medium text-accent-text hover:underline">{r.orderNumber}</Link> : <span className="font-medium">{r.orderNumber}</span>)
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Why</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{when(r.at)}</TableCell>
                <TableCell><span className="flex flex-col">{link(r)}<span className="text-[13px] text-muted-foreground">{r.schoolName}{r.phone ? ` · ${r.phone}` : ""}</span></span></TableCell>
                <TableCell className="max-w-80 whitespace-normal">{r.reason}</TableCell>
                <TableCell>{r.actor}</TableCell>
                <TableCell className="text-right font-medium">{formatKes(r.amountCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-2xl border bg-card p-4 text-sm">
            <span className="flex items-start justify-between gap-3"><span className="min-w-0">{link(r)} <span className="text-muted-foreground">· {r.schoolName}</span></span><span className="shrink-0 font-semibold">{formatKes(r.amountCents)}</span></span>
            <span>{r.reason}</span>
            <span className="text-[13px] text-muted-foreground">{when(r.at)} · {r.actor}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">{text}</div>
}
