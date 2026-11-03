import { useDeferredValue, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Download, Search } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { useAudit } from "@/lib/api/queries"
import type { AuditCategory, AuditEntry } from "@/lib/api/schemas"
import { cn } from "@/lib/utils"

/*
 * Who did what, when. Every decision SchoolShop staff make (approving a
 * school, refunding a parent, releasing a payout, changing someone's role)
 * is written here by the server. Nobody can edit or delete an entry.
 */

const categories: { id: AuditCategory; label: string }[] = [
  { id: "organisations", label: "Schools & publishers" },
  { id: "orders", label: "Orders" },
  { id: "money", label: "Money" },
  { id: "catalog", label: "Catalog" },
  { id: "staff", label: "Staff & access" },
  { id: "settings", label: "Fees & settings" },
]
const label = Object.fromEntries(categories.map((c) => [c.id, c.label])) as Record<AuditCategory, string>
const PAGE = 50
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })

export function AdminAuditPage() {
  const audit = useAudit()
  return (
    <QueryBoundary query={audit}>{(entries) => <Audit entries={entries} />}</QueryBoundary>
  )
}

function Audit({ entries }: { entries: AuditEntry[] }) {
  const [params, setParams] = useSearchParams()
  const category = (categories.find((c) => c.id === params.get("category"))?.id ?? "") as AuditCategory | ""
  const person = params.get("person") ?? ""
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim().toLowerCase())
  const [limit, setLimit] = useState(PAGE)
  const set = (k: string, v: string) => { setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p }); setLimit(PAGE) }

  const people = useMemo(() => [...new Set(entries.map((e) => e.actor))].sort(), [entries])
  const scoped = entries.filter((e) => (!person || e.actor === person) && (!q || `${e.actor} ${e.text} ${e.target?.label ?? ""}`.toLowerCase().includes(q)))
  const shown = category ? scoped.filter((e) => e.category === category) : scoped
  const days = [...new Map(shown.slice(0, limit).map((e) => [dayKey(e.at), [] as AuditEntry[]])).entries()]
  for (const e of shown.slice(0, limit)) days.find(([d]) => d === dayKey(e.at))![1].push(e)

  return (
    <>
      <PageHeader
        eyebrow="Every decision anyone at SchoolShop makes. Entries can't be changed or deleted."
        title="Audit log"
        actions={<Button variant="outline" onClick={() => downloadAudit(shown)}><Download aria-hidden /> Export</Button>}
      />
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="relative">
            <span className="sr-only">Search the log</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE) }} placeholder="Order number, school, publisher or what was done" className="pl-10" />
          </label>
          <NativeSelect aria-label="Person" value={person} onChange={(e) => set("person", e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </NativeSelect>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Area">
          {[{ id: "" as const, label: "Everything" }, ...categories].map((c) => {
            const n = c.id ? scoped.filter((e) => e.category === c.id).length : scoped.length
            return (
              <button
                key={c.id || "all"}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => set("category", c.id)}
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap", category === c.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
              >
                {c.label}
                <span className={cn("rounded-full px-1.5 text-xs", category === c.id ? "bg-white/20" : "bg-secondary")}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">Nothing matches. Try a different person or area.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {days.map(([day, rows]) => (
            <section key={day} aria-label={day} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
              <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
                {rows.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                    <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{time(e.at)}</span>
                    <span className="flex min-w-0 grow flex-col gap-1">
                      <span className="text-[15px] break-words"><span className="font-semibold">{e.actor}</span> <span className="text-muted-foreground">({e.role})</span> {e.text}</span>
                      {e.target && <Link to={e.target.href} className="self-start text-[13px] font-semibold text-accent-text hover:underline">{e.target.label}</Link>}
                    </span>
                    <Badge variant="secondary" className="self-start">{label[e.category]}</Badge>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {shown.length > limit && <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</Button>}
        </div>
      )}
    </>
  )
}

function downloadAudit(rows: AuditEntry[]) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [["When", "Person", "Role", "Area", "What", "About"], ...rows.map((e) => [e.at, e.actor, e.role, label[e.category], e.text, e.target?.label ?? ""])].map((r) => r.map(cell).join(",")).join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  a.download = "schoolshop-audit-log.csv"
  a.click()
  URL.revokeObjectURL(a.href)
}
