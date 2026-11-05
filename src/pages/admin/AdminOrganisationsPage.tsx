import { useDeferredValue, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { Dialog } from "radix-ui"
import { AlertTriangle, CheckCircle2, ChevronLeft, CircleDashed, Download, FileText, Search, Send, X, XCircle } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Sheet } from "@/components/common/Sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import * as endpoints from "@/lib/api/endpoints"
import { useAdminOrg, useAdminOrgs, useOrgMutation } from "@/lib/api/queries"
import type { AdminOrg, AdminOrgSummary, OrgCheck, OrgStatus } from "@/lib/api/schemas"
import { errorText } from "@/lib/settings"
import { useAccess } from "@/lib/useAccess"
import { cn } from "@/lib/utils"

/*
 * Schools and publishers. Applications wait here until someone at SchoolShop
 * checks every document; live organisations can be paused and turned back on.
 * Support can look but not decide (orgs.verify).
 */

type Tab = "review" | "schools" | "publishers" | "suspended" | "rejected"
const tabs: { id: Tab; label: string; match: (o: AdminOrgSummary) => boolean }[] = [
  { id: "review", label: "Waiting for review", match: (o) => o.status === "pending" || o.status === "info_requested" },
  { id: "schools", label: "Schools", match: (o) => o.type === "school" && o.status === "live" },
  { id: "publishers", label: "Publishers", match: (o) => o.type === "publisher" && o.status === "live" },
  { id: "suspended", label: "Paused", match: (o) => o.status === "suspended" },
  { id: "rejected", label: "Rejected", match: (o) => o.status === "rejected" },
]

const statusBadge: Record<OrgStatus, { label: string; variant: "success" | "warning" | "info" | "secondary" | "destructive" }> = {
  pending: { label: "New application", variant: "info" },
  info_requested: { label: "Waiting on applicant", variant: "warning" },
  live: { label: "Live", variant: "success" },
  suspended: { label: "Paused", variant: "destructive" },
  rejected: { label: "Rejected", variant: "secondary" },
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 2) return "just now"
  if (mins < 60) return relative.format(-mins, "minute")
  const hours = Math.round(mins / 60)
  if (hours < 24) return relative.format(-hours, "hour")
  const days = Math.round(hours / 24)
  return days < 60 ? relative.format(-days, "day") : new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

export function AdminOrganisationsPage() {
  const orgs = useAdminOrgs()
  const [inviting, setInviting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { can } = useAccess()
  return (
    <>
      <PageHeader
        eyebrow="Nobody can sell or publish a booklist until they're verified"
        title="Schools & publishers"
        actions={can("orgs.verify") && <Button onClick={() => setInviting(true)}><Send aria-hidden /> Invite organisation</Button>}
      />
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-4.5 shrink-0" aria-hidden /> <span className="grow">{notice}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss" onClick={() => setNotice(null)}><X aria-hidden /></Button>
        </p>
      )}
      <QueryBoundary query={orgs}>{(list) => <Organisations list={list} onNotice={setNotice} />}</QueryBoundary>
      <InviteSheet open={inviting} onClose={() => setInviting(false)} onDone={(text) => { setInviting(false); setNotice(text) }} />
    </>
  )
}

function Organisations({ list, onNotice }: { list: AdminOrgSummary[]; onNotice: (text: string) => void }) {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.find((t) => t.id === params.get("tab"))?.id ?? "review") as Tab
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim().toLowerCase())
  const inTab = list.filter(tabs.find((t) => t.id === tab)!.match).sort((a, b) => (tab === "review" ? a.appliedAt.localeCompare(b.appliedAt) : a.name.localeCompare(b.name)))
  const shown = q ? inTab.filter((o) => `${o.name} ${o.town} ${o.county}`.toLowerCase().includes(q)) : inTab
  const chosen = params.get("org")
  // On wide screens the first organisation is open by default; on phones the list comes first.
  const openId = chosen ?? shown[0]?.id ?? null

  const go = (next: { tab?: Tab; org?: string | null }) =>
    setParams((p) => {
      if (next.tab) { p.set("tab", next.tab); p.delete("org") }
      if (next.org !== undefined) { if (next.org) p.set("org", next.org); else p.delete("org") }
      return p
    })

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex flex-col gap-3", chosen && "max-lg:hidden")}>
        <div role="tablist" aria-label="Organisations" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const count = list.filter(t.match).length
            if (t.id === "rejected" && !count) return null
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => go({ tab: t.id })}
                className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium", tab === t.id ? "border-ink bg-ink text-white" : "bg-surface hover:bg-secondary")}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-xs", tab === t.id ? "bg-white/20" : t.id === "review" && count ? "bg-sun text-ink" : "bg-secondary")}>{count}</span>
              </button>
            )
          })}
        </div>
        <label className="relative block max-w-sm">
          <span className="sr-only">Search organisations</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or town" className="pl-9" />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <section aria-label="Organisation list" className={cn("flex flex-col overflow-hidden rounded-2xl border bg-surface", chosen && "max-lg:hidden")}>
          {shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">{q ? "No organisations match that search." : tab === "review" ? "Nothing waiting. Every application has been reviewed." : "Nothing here."}</p>
          ) : (
            <ul className="divide-y">
              {shown.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => go({ org: o.id })}
                    aria-current={o.id === openId ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/60", o.id === openId && "lg:bg-teal-light")}
                  >
                    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold", o.type === "school" ? "bg-info-bg" : "bg-warn-bg text-warn-fg")}>
                      {o.type === "school" ? "SCH" : "PUB"}
                    </span>
                    <span className="flex min-w-0 grow flex-col">
                      <span className="truncate font-semibold">{o.name}</span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {o.type === "school" ? "School" : "Publisher"} · {o.town}
                        {tab === "review" && ` · applied ${ago(o.appliedAt)}`}
                      </span>
                    </span>
                    {tab === "review" &&
                      (o.status === "info_requested" ? <Badge variant="warning">Waiting on them</Badge> : o.openChecks ? <Badge variant="secondary">{o.openChecks} to check</Badge> : <Badge variant="success">Ready</Badge>)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className={cn("min-w-0", !chosen && "max-lg:hidden")}>
          {chosen && (
            <Button variant="ghost" className="mb-2 -ml-3 lg:hidden" onClick={() => go({ org: null })}>
              <ChevronLeft aria-hidden /> All organisations
            </Button>
          )}
          {openId ? <OrgPanel key={openId} id={openId} onNotice={onNotice} /> : <div className="hidden rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:block">Choose an organisation to see its details.</div>}
        </div>
      </div>
    </div>
  )
}

function OrgPanel({ id, onNotice }: { id: string; onNotice: (text: string) => void }) {
  const org = useAdminOrg(id)
  return <QueryBoundary query={org}>{(o) => <OrgDetail org={o} onNotice={onNotice} />}</QueryBoundary>
}

function OrgDetail({ org, onNotice }: { org: AdminOrg; onNotice: (text: string) => void }) {
  const { can } = useAccess()
  const allowed = can("orgs.verify")
  const isApplication = org.status === "pending" || org.status === "info_requested"
  const kind = org.type === "school" ? "school" : "publisher"
  const badge = statusBadge[org.status]

  return (
    <article aria-labelledby="org-name" className="flex flex-col gap-5 rounded-2xl border bg-surface p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {isApplication ? `${kind} application · applied ${ago(org.appliedAt)}` : org.status === "rejected" ? `${kind} application` : `${kind}${org.verifiedAt ? ` · verified ${ago(org.verifiedAt)}` : ""}`}
          </span>
          <h2 id="org-name" className="font-display text-2xl font-semibold">{org.name}</h2>
          <span className="text-sm text-muted-foreground">{org.town}, {org.county} County</span>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </header>

      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
        <Fact term="Contact" value={org.contactName} />
        <Fact term="Phone" value={`+${org.contactPhone}`} />
        <Fact term="Email" value={org.contactEmail} />
        <Fact term={org.type === "school" ? "MOE registration" : "Company registration"} value={org.registrationNo} />
        <Fact term="KRA PIN" value={org.kraPin} />
      </dl>

      {org.uncheckedDetails.map((field) => <UncheckedDetail key={field} org={org} field={field} allowed={allowed} />)}

      {!allowed && (
        <p className="flex gap-2 rounded-xl bg-info-bg px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          You can view organisations. Approving, rejecting or pausing needs the Operations or Super admin role.
        </p>
      )}

      {isApplication ? (
        <Review org={org} allowed={allowed} onNotice={onNotice} />
      ) : (
        <>
          {org.status === "suspended" && (
            <div className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-fg">
              <p className="font-semibold">Paused. {org.type === "school" ? "Parents can't find or order from this school." : "Their titles are hidden from every booklist."}</p>
              {org.suspendedReason && <p className="mt-1">Reason: {org.suspendedReason}</p>}
            </div>
          )}
          {org.status === "rejected" && <p className="rounded-xl bg-secondary px-4 py-3 text-sm">This application was turned down. They can apply again with new documents.</p>}
          {org.stats.length > 0 && (
            <section aria-label="This term" className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {org.stats.map((s) => (
                <div key={s.label} className="rounded-xl border p-3">
                  <div className="text-[13px] text-muted-foreground">{s.label}</div>
                  <div className="font-display text-lg font-semibold">{s.value}</div>
                </div>
              ))}
            </section>
          )}
          <Documents org={org} />
          {org.status === "live" && <PauseControl org={org} allowed={allowed} onNotice={onNotice} />}
          {org.status === "suspended" && <ReactivateControl org={org} allowed={allowed} onNotice={onNotice} />}
        </>
      )}

      <section aria-labelledby="org-history">
        <h3 id="org-history" className="mb-2 font-semibold">History</h3>
        <ol className="flex flex-col gap-2 text-sm">
          {org.history.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="w-28 shrink-0 text-muted-foreground">{ago(h.at)}</span>
              <span className="min-w-0"><span className="font-medium">{h.actor}</span> {h.text}</span>
            </li>
          ))}
          {org.history.length === 0 && <li className="text-muted-foreground">Nothing recorded yet.</li>}
        </ol>
      </section>
    </article>
  )
}

/** A detail a verified publisher added. They can edit it until it's marked as checked here. */
function UncheckedDetail({ org, field, allowed }: { org: AdminOrg; field: AdminOrg["uncheckedDetails"][number]; allowed: boolean }) {
  const value = (field === "kra_pin" ? org.kraPin : org.registrationNo) ?? ""
  const mark = useOrgMutation(() => endpoints.checkOrgDetail(org.id, field, value))
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-info-bg px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{field === "kra_pin" ? "KRA PIN" : "Company registration"} <span className="font-semibold">{value}</span> was added after verification and isn't checked yet.</span>
        </p>
        {allowed && <Button size="sm" onClick={() => mark.mutate()} disabled={mark.isPending}><CheckCircle2 aria-hidden /> Mark as checked</Button>}
      </div>
      {mark.error && <p role="alert" className="text-destructive">{errorText(mark.error)}</p>}
    </div>
  )
}

function Fact({ term, value }: { term: string; value: string | null }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[13px] text-muted-foreground">{term}</dt>
      <dd className={cn("truncate font-medium", !value && "font-normal text-warn-fg")}>{value ?? "Not provided"}</dd>
    </div>
  )
}

/* ── Applications: check each document, then decide ── */

const checkState: Record<OrgCheck["state"], { label: string; icon: typeof CheckCircle2; tone: string }> = {
  verified: { label: "Checked", icon: CheckCircle2, tone: "text-success-fg" },
  uploaded: { label: "Uploaded, not checked", icon: CircleDashed, tone: "text-info-fg" },
  missing: { label: "Not sent", icon: AlertTriangle, tone: "text-warn-fg" },
  failed: { label: "Doesn't match", icon: XCircle, tone: "text-destructive" },
}

function Review({ org, allowed, onNotice }: { org: AdminOrg; allowed: boolean; onNotice: (text: string) => void }) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<OrgCheck | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const decide = useOrgMutation(({ decision, note }: { decision: endpoints.OrgDecision; note: string }) => endpoints.decideOrg(org.id, decision, note))
  const open = org.checks.filter((c) => c.state !== "verified")

  const run = (decision: endpoints.OrgDecision) => {
    setError(null)
    if (decision !== "approve" && !note.trim()) {
      setError(decision === "reject" ? "Give the reason. The applicant sees it." : "Tell them what you need.")
      noteRef.current?.focus()
      return
    }
    // mutateAsync: an approval or rejection unmounts this section before per-call callbacks would run.
    decide.mutateAsync({ decision, note: note.trim() }).then(
      (o) => {
          setNote("")
          onNotice(decision === "approve" ? `${o.name} is live. ${o.type === "school" ? "Parents can now find it and order." : "They can now list titles."}` : decision === "reject" ? `${o.name}'s application was rejected. They've been told why.` : `We've asked ${o.contactName} for more information.`)
      },
      (e) => setError(errorText(e, "note"))
    )
  }

  const request = (c: OrgCheck) => {
    const line = c.state === "failed" ? `The ${c.label} you sent doesn't match your details. Please upload it again.` : `Please upload your ${c.label}.`
    setNote((n) => (n.includes(line) ? n : n ? `${n} ${line}` : line))
    noteRef.current?.focus()
  }

  return (
    <>
      <section aria-labelledby="org-checks" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="org-checks" className="font-semibold">Checks</h3>
          <span className="text-sm text-muted-foreground">{org.checks.length - open.length} of {org.checks.length} done</span>
        </div>
        <ul className="divide-y rounded-xl border">
          {org.checks.map((c) => {
            const s = checkState[c.state]
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <s.icon className={cn("size-5 shrink-0", s.tone)} aria-hidden />
                <span className="flex min-w-0 grow basis-48 flex-col">
                  <span className="font-medium">{c.label}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{s.label}{c.fileName && c.state !== "missing" ? ` · ${c.fileName}` : ""}</span>
                </span>
                <span className="flex gap-2">
                  {c.fileName && <Button variant="outline" size="sm" onClick={() => setViewing(c)} aria-label={`View ${c.label}`}>View</Button>}
                  {(c.state === "missing" || c.state === "failed") && allowed && (
                    <Button variant="ghost" size="sm" onClick={() => request(c)} aria-label={`Request ${c.label}`}>Request</Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {allowed && (
        <section aria-label="Decision" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Note to applicant (sent by SMS and email)
            <Textarea ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Needed if you ask for more information or reject" aria-invalid={!!error} aria-describedby={error ? "decision-error" : undefined} />
          </label>
          {error && <p id="decision-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("approve")} disabled={open.length > 0 || decide.isPending} aria-describedby={open.length ? "approve-hint" : undefined}>
              <CheckCircle2 aria-hidden /> Approve & go live
            </Button>
            <Button variant="outline" onClick={() => run("request-info")} disabled={decide.isPending}>Ask for more info</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => run("reject")} disabled={decide.isPending}>Reject</Button>
          </div>
          {open.length > 0 && <p id="approve-hint" className="text-[13px] text-muted-foreground">Approve once every check is done. {open.length} still to go.</p>}
        </section>
      )}

      <DocumentDialog org={org} check={viewing} allowed={allowed} onClose={() => setViewing(null)} />
    </>
  )
}

/** Live and paused organisations: the documents they were approved on, read only. */
function Documents({ org }: { org: AdminOrg }) {
  if (org.status === "rejected") return null
  return (
    <section aria-labelledby="org-docs">
      <h3 id="org-docs" className="mb-2 font-semibold">Documents</h3>
      <ul className="flex flex-wrap gap-2">
        {org.checks.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[13px]">
            <CheckCircle2 className="size-3.5 text-success-fg" aria-hidden /> {c.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DocumentDialog({ org, check, allowed, onClose }: { org: AdminOrg; check: OrgCheck | null; allowed: boolean; onClose: () => void }) {
  const mark = useOrgMutation(({ checkId, state }: { checkId: string; state: "verified" | "failed" }) => endpoints.setOrgCheck(org.id, checkId, state))
  const [error, setError] = useState<string | null>(null)
  const set = (state: "verified" | "failed") =>
    check && mark.mutate({ checkId: check.id, state }, { onSuccess: () => { setError(null); onClose() }, onError: (e) => setError(errorText(e)) })
  return (
    <Dialog.Root open={!!check} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] max-w-lg -translate-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 outline-none">
          {check && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Dialog.Title className="font-display text-xl font-semibold">{check.label}</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">Compare it with what {org.name} told us.</Dialog.Description>
                </div>
                <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button></Dialog.Close>
              </div>
              <DocumentPreview org={org} check={check} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact term="Name on application" value={org.name} />
                <Fact term={check.label.includes("KRA") ? "KRA PIN given" : org.type === "school" ? "MOE number given" : "Registration given"} value={check.label.includes("KRA") ? org.kraPin : org.registrationNo} />
              </dl>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {allowed && check.state !== "missing" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => set("verified")} disabled={mark.isPending || check.state === "verified"}><CheckCircle2 aria-hidden /> Mark as checked</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => set("failed")} disabled={mark.isPending || check.state === "failed"}>Doesn't match</Button>
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The file the applicant sent: shown when the browser can (images, PDFs), and always downloadable. */
function DocumentPreview({ org, check }: { org: AdminOrg; check: OrgCheck }) {
  const blob = useQuery({
    queryKey: ["org-document", org.id, check.id, check.uploadedAt],
    queryFn: () => endpoints.fetchOrgDocument(org.id, check.id),
    enabled: check.hasFile,
    staleTime: Infinity,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob.data) return
    const href = URL.createObjectURL(blob.data)
    setUrl(href)
    return () => URL.revokeObjectURL(href)
  }, [blob.data])

  if (!check.hasFile) {
    return (
      <p className="flex items-start gap-2 rounded-xl border bg-secondary/50 p-4 text-sm">
        <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{check.fileName ?? "Nothing sent yet."}{/phone/i.test(check.label) && check.state !== "verified" ? ` Call ${org.contactName} on ${org.contactPhone.replace(/^254/, "0")}, then mark it as checked.` : ""}</span>
      </p>
    )
  }
  const type = blob.data?.type ?? ""
  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-secondary/50 p-4">
      <figcaption className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" aria-hidden /> <span className="truncate">{check.fileName}</span></span>
        <Button variant="outline" size="sm" onClick={() => void endpoints.downloadOrgDocument(org.id, check.id, check.fileName ?? "document")}>
          <Download aria-hidden /> Download
        </Button>
      </figcaption>
      {blob.isPending && <p className="text-sm text-muted-foreground">Opening…</p>}
      {blob.isError && <p role="alert" className="text-sm text-destructive">Couldn't open the file. Try downloading it.</p>}
      {url && type.startsWith("image/") && <img src={url} alt={`${check.label} sent by ${org.name}`} className="max-h-[50vh] w-full rounded-lg bg-surface object-contain" />}
      {url && type === "application/pdf" && <iframe src={url} title={check.label} className="h-[50vh] w-full rounded-lg bg-surface" />}
      {url && !type.startsWith("image/") && type !== "application/pdf" && <p className="text-sm text-muted-foreground">This type of file can't be shown here. Download it to open it.</p>}
    </figure>
  )
}

/* ── Live and paused organisations ── */

function PauseControl({ org, allowed, onNotice }: { org: AdminOrg; allowed: boolean; onNotice: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const pause = useOrgMutation((note: string) => endpoints.decideOrg(org.id, "suspend", note))
  if (!allowed) return null
  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">Pausing hides {org.type === "school" ? "the school from parents" : "their titles"} straight away. Paid orders still go through.</p>
        <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>Pause {org.type}</Button>
      </div>
    )
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason.trim()) return setError("Give the reason. Their admins see it.")
        pause.mutateAsync(reason.trim()).then((o) => onNotice(`${o.name} is paused.`), (e) => setError(errorText(e, "note")))
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Why are you pausing {org.name}?
        <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} rows={2} aria-invalid={!!error} autoFocus />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pause.isPending}>Pause now</Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null) }}>Cancel</Button>
      </div>
    </form>
  )
}

function ReactivateControl({ org, allowed, onNotice }: { org: AdminOrg; allowed: boolean; onNotice: (text: string) => void }) {
  const resume = useOrgMutation(() => endpoints.decideOrg(org.id, "reactivate", ""))
  if (!allowed) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">Turning it back on makes {org.type === "school" ? "the school visible to parents" : "their titles available"} again.</p>
      <Button onClick={() => resume.mutateAsync().then((o) => onNotice(`${o.name} is live again.`), () => undefined)} disabled={resume.isPending}>Turn back on</Button>
    </div>
  )
}

/* ── Invite ── */

const inviteSchema = z.object({
  type: z.enum(["school", "publisher"]),
  name: z.string().trim().min(2, "Enter the organisation's name"),
  contact: z.string().trim().min(5, "Enter a phone number or email"),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { type: "school", name: "", contact: "" } })
  const [error, setError] = useState<string | null>(null)
  const submit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      await endpoints.inviteOrg(v)
      form.reset()
      onDone(`Invitation sent to ${v.contact}. ${v.name} will show up under "Waiting for review" once they apply.`)
    } catch (e) {
      setError(errorText(e))
    }
  })
  return (
    <Sheet open={open} onClose={onClose} title="Invite an organisation" description="We'll send a link to apply. They still need to upload documents before going live.">
      <Form {...form}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem><FormLabel>Type</FormLabel><FormControl><NativeSelect {...field}><option value="school">School</option><option value="publisher">Publisher</option></NativeSelect></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Amani Primary School" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="contact" render={({ field }) => (
            <FormItem><FormLabel>Phone or email</FormLabel><FormControl><Input {...field} placeholder="0712 345 678 or head@school.ac.ke" /></FormControl><FormMessage /></FormItem>
          )} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}><Send aria-hidden /> Send invitation</Button>
        </form>
      </Form>
    </Sheet>
  )
}
