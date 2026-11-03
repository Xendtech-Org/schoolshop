import { useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { AlertTriangle, CheckCircle2, ChevronLeft, X, XCircle } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type * as endpoints from "@/lib/api/endpoints"
import { useCatalogSubmissions, useDecideSubmission } from "@/lib/api/queries"
import type { CatalogSubmission } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { cn } from "@/lib/utils"

/*
 * New titles and price changes from publishers. Nothing reaches schools'
 * booklists until someone here has looked: the ISBN is real and unused, the
 * price is in line with similar titles, the grade is a CBC grade.
 */

type Tab = CatalogSubmission["status"]
const tabs: { id: Tab; label: string }[] = [
  { id: "pending", label: "Waiting for review" },
  { id: "changes_requested", label: "Waiting on publisher" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
]
const resultIcon = {
  pass: { icon: CheckCircle2, tone: "text-success-fg", label: "Passed" },
  warn: { icon: AlertTriangle, tone: "text-warn-fg", label: "Look at this" },
  fail: { icon: XCircle, tone: "text-destructive", label: "Failed" },
} as const

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 2) return "just now"
  if (mins < 60) return relative.format(-mins, "minute")
  const hours = Math.round(mins / 60)
  return hours < 24 ? relative.format(-hours, "hour") : relative.format(-Math.round(hours / 24), "day")
}

export function AdminCatalogPage() {
  const list = useCatalogSubmissions()
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <>
      <PageHeader eyebrow="Schools only see titles someone here has checked" title="Catalog review" />
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-4.5 shrink-0" aria-hidden /> <span className="grow">{notice}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss" onClick={() => setNotice(null)}><X aria-hidden /></Button>
        </p>
      )}
      <QueryBoundary query={list}>{(subs) => <Review subs={subs} onNotice={setNotice} />}</QueryBoundary>
    </>
  )
}

function Review({ subs, onNotice }: { subs: CatalogSubmission[]; onNotice: (t: string) => void }) {
  const [params, setParams] = useSearchParams()
  const chosen = params.get("sub")
  const chosenSub = subs.find((x) => x.id === chosen)
  const tab = (tabs.find((t) => t.id === params.get("tab"))?.id ?? chosenSub?.status ?? "pending") as Tab
  // Oldest first while waiting, so nobody's title sits at the bottom of the pile.
  const shown = subs.filter((x) => x.status === tab).sort((a, b) => (tab === "pending" ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt)))
  const openSub = chosenSub ?? shown[0]
  const go = (next: { tab?: Tab; sub?: string | null }) =>
    setParams((p) => {
      if (next.tab) { p.set("tab", next.tab); p.delete("sub") }
      // Choosing from the list pins the tab, so deciding on a title doesn't jump the list to its new tab.
      if (next.sub !== undefined) { if (next.sub) { p.set("sub", next.sub); p.set("tab", tab) } else p.delete("sub") }
      return p
    })

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Submissions" className={cn("flex flex-wrap gap-2", chosen && "max-lg:hidden")}>
        {tabs.map((t) => {
          const n = subs.filter((x) => x.status === t.id).length
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => go({ tab: t.id })}
              className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium", tab === t.id ? "border-ink bg-ink text-white" : "bg-surface hover:bg-secondary")}
            >
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs", tab === t.id ? "bg-white/20" : t.id === "pending" && n ? "bg-sun text-ink" : "bg-secondary")}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <section aria-label="Submission list" className={cn("min-w-0 overflow-hidden rounded-2xl border bg-surface", chosen && "max-lg:hidden")}>
          {shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">{tab === "pending" ? "Nothing waiting. Every title has been checked." : "Nothing here."}</p>
          ) : (
            <ul className="divide-y">
              {shown.map((x) => {
                const fails = x.checks.filter((c) => c.result === "fail").length
                const warns = x.checks.filter((c) => c.result === "warn").length
                return (
                  <li key={x.id}>
                    <button
                      onClick={() => go({ sub: x.id })}
                      aria-current={x.id === openSub?.id ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/60", x.id === openSub?.id && "lg:bg-teal-light")}
                    >
                      <span className="flex min-w-0 grow flex-col">
                        <span className="truncate font-semibold">{x.title}</span>
                        <span className="truncate text-[13px] text-muted-foreground">{x.publisherName} · {x.kind === "new_title" ? "New title" : "Price change"} · {ago(x.submittedAt)}</span>
                      </span>
                      {x.status === "pending" && (fails ? <Badge variant="destructive">{fails} failed</Badge> : warns ? <Badge variant="warning">{warns} to look at</Badge> : <Badge variant="success">All clear</Badge>)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className={cn("min-w-0", !chosen && "max-lg:hidden")}>
          {chosen && <Button variant="ghost" className="mb-2 -ml-3 lg:hidden" onClick={() => go({ sub: null })}><ChevronLeft aria-hidden /> All submissions</Button>}
          {openSub ? <Detail key={openSub.id} x={openSub} onNotice={onNotice} /> : <div className="hidden rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:block">Choose a title to check it.</div>}
        </div>
      </div>
    </div>
  )
}

function Detail({ x, onNotice }: { x: CatalogSubmission; onNotice: (t: string) => void }) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const decide = useDecideSubmission()
  const open = x.status === "pending" || x.status === "changes_requested"
  const failed = x.checks.filter((c) => c.result === "fail")
  const run = (decision: endpoints.CatalogDecision) => {
    setError(null)
    if (decision !== "approve" && !note.trim()) {
      setError("Tell the publisher what to fix. They see this.")
      noteRef.current?.focus()
      return
    }
    decide.mutateAsync({ id: x.id, decision, note: note.trim() }).then(
      () => onNotice(decision === "approve" ? (x.kind === "new_title" ? `${x.title} is live. Schools can add it to booklists.` : `${x.title} now costs ${formatKes(x.priceCents)}.`) : decision === "reject" ? `${x.title} was rejected. ${x.publisherName} has been told why.` : `${x.publisherName} has been asked to change ${x.title}.`),
      (e) => setError(errorText(e, "note"))
    )
  }
  const facts: [string, string][] = [
    ["Publisher", x.publisherName],
    ["Subject and grade", `${x.subject} · ${x.gradeLabel}`],
    ["ISBN", x.isbn ?? "None given"],
    ["Format", x.format],
  ]

  return (
    <article aria-labelledby="sub-title" className="flex flex-col gap-5 rounded-2xl border bg-surface p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{x.kind === "new_title" ? "New title" : "Price change"} · sent {ago(x.submittedAt)}</span>
          <h2 id="sub-title" className="font-display text-2xl font-semibold">{x.title}</h2>
        </div>
        <span className="text-right">
          <span className="block font-display text-2xl font-semibold">{formatKes(x.priceCents)}</span>
          {x.previousPriceCents !== null && <span className="text-sm text-muted-foreground">was {formatKes(x.previousPriceCents)}</span>}
        </span>
      </header>

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
        {facts.map(([t, v]) => <div key={t} className="flex min-w-0 flex-col"><dt className="text-[13px] text-muted-foreground">{t}</dt><dd className="font-medium break-words">{v}</dd></div>)}
      </dl>

      {x.status === "changes_requested" && x.note && <p className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg"><span className="font-semibold">Waiting on {x.publisherName}.</span> You asked: “{x.note}”</p>}
      {x.status === "rejected" && x.note && <p className="rounded-xl bg-secondary px-4 py-3 text-sm"><span className="font-semibold">Rejected.</span> {x.note}</p>}
      {x.status === "approved" && <p className="rounded-xl bg-success-bg px-4 py-3 text-sm"><span className="font-semibold">Approved.</span> {x.kind === "new_title" ? "Schools can add it to booklists." : "The new price is live."}</p>}

      <section aria-labelledby="sub-checks" className="flex flex-col gap-2">
        <h3 id="sub-checks" className="font-semibold">Checks</h3>
        <ul className="divide-y rounded-xl border">
          {x.checks.map((c) => {
            const r = resultIcon[c.result]
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <r.icon className={cn("mt-0.5 size-5 shrink-0", r.tone)} aria-label={r.label} />
                <span className="flex min-w-0 flex-col"><span className="font-medium">{c.label}</span><span className="text-[13px] break-words text-muted-foreground">{c.detail}</span></span>
              </li>
            )
          })}
        </ul>
      </section>

      {x.similar.length > 0 && (
        <section aria-labelledby="sub-similar" className="flex flex-col gap-2">
          <h3 id="sub-similar" className="font-semibold">Similar titles on SchoolShop</h3>
          <ul className="divide-y rounded-xl border text-sm">
            {x.similar.map((p) => (
              <li key={p.title} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate">{p.title} <span className="text-muted-foreground">· {p.publisherName}</span></span>
                <span className="shrink-0 font-medium">{formatKes(p.priceCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <section aria-label="Decision" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Note to {x.publisherName}
            <Textarea ref={noteRef} value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} rows={3} placeholder="Needed if you ask for changes or reject" aria-invalid={!!error} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("approve")} disabled={decide.isPending || failed.length > 0}><CheckCircle2 aria-hidden /> {x.kind === "new_title" ? "Approve & publish" : "Approve new price"}</Button>
            <Button variant="outline" onClick={() => run("request-changes")} disabled={decide.isPending}>Ask for changes</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => run("reject")} disabled={decide.isPending}>Reject</Button>
          </div>
          {failed.length > 0 && <p className="text-[13px] text-muted-foreground">Can't approve while {failed.map((c) => c.label).join(" and ")} failed. Ask {x.publisherName} to fix it.</p>}
        </section>
      )}

      <section aria-labelledby="sub-history">
        <h3 id="sub-history" className="mb-2 font-semibold">History</h3>
        <ol className="flex flex-col gap-2 text-sm">
          {x.history.map((h) => (
            <li key={h.id} className="flex gap-3"><span className="w-28 shrink-0 text-muted-foreground">{ago(h.at)}</span><span className="min-w-0"><span className="font-medium">{h.actor}</span> {h.text}</span></li>
          ))}
        </ol>
      </section>
    </article>
  )
}
