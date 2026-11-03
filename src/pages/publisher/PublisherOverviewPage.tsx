import { Link } from "react-router"
import { ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePublisherOverview } from "@/lib/api/queries"
import type { PublisherOverview } from "@/lib/api/schemas"
import { formatDay, formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"

const dot = { high: "bg-flame", medium: "bg-sun", info: "bg-info-fg" } as const
const count = (n: number, word: string) => `${n.toLocaleString("en-KE")} ${word}${n === 1 ? "" : "s"}`

export function PublisherOverviewPage() {
  const overview = usePublisherOverview()
  return <QueryBoundary query={overview}>{(o) => <Overview o={o} />}</QueryBoundary>
}

function Overview({ o }: { o: PublisherOverview }) {
  const rate = Math.round(o.commissionRate * 1000) / 10
  return (
    <>
      <PageHeader eyebrow={o.termName} title={`${o.publisherName} overview`} />
      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Sales this term" value={formatKes(o.salesCents)} hint={`${count(o.packs, "pack")} for ${count(o.schools, "school")}`} />
        <StatCard label="Ready to dispatch" value={count(o.batches.readyToPack, "school")} hint={`${o.batches.collecting} still collecting orders`} />
        <StatCard label="On the way" value={count(o.batches.dispatched, "delivery")} hint={`${o.batches.received} received by schools`} />
        <StatCard label="Live titles" value={o.catalog.live.toLocaleString("en-KE")} hint={`SchoolShop keeps ${rate}% of sales`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
          <CardContent>
            {o.alerts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nothing needs you right now.</p>
            ) : (
              <ul>
                {o.alerts.map((a) => (
                  <li key={a.id}>
                    <Link to={a.href} className="flex items-center gap-3 border-b border-secondary py-3">
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot[a.severity])} />
                      <span className="flex grow flex-col">
                        <span className="text-[15px] font-semibold">{a.title}</span>
                        <span className="text-[13px] text-muted-foreground">{a.detail}</span>
                      </span>
                      <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Schools to dispatch to</CardTitle>
            {o.toDispatch.length > 0 && <Button asChild size="sm" variant="outline"><Link to="/publisher/dispatches">Dispatch</Link></Button>}
          </CardHeader>
          <CardContent>
            {o.toDispatch.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                {o.batches.collecting ? `${count(o.batches.collecting, "school")} still collecting orders. They're ready to pack after each school's order deadline.` : "No schools are waiting for a delivery."}
              </p>
            ) : (
              <ul>
                {o.toDispatch.map((b) => (
                  <li key={b.id}>
                    <Link to={`/publisher/dispatches?batch=${b.id}`} className="flex items-center gap-3 border-b border-secondary py-3">
                      <span className="flex grow flex-col">
                        <span className="text-[15px] font-semibold">{b.schoolName}</span>
                        <span className="text-[13px] text-muted-foreground">{b.town} · {count(b.packs, "pack")}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">Due {formatDay(b.dueAtSchool)}</span>
                      <ChevronRight className="size-4.5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Best sellers this term</CardTitle></CardHeader>
          <CardContent>
            {o.topTitles.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No paid orders yet this term.</p>
            ) : (
              <ol>
                {o.topTitles.map((t) => (
                  <li key={t.title} className="flex items-center gap-3 border-b border-secondary py-3 text-[15px]">
                    <span className="grow font-semibold">{t.title}</span>
                    <span className="text-muted-foreground">{t.qty.toLocaleString("en-KE")} {t.qty === 1 ? "copy" : "copies"}</span>
                    <span className="w-28 text-right tabular-nums">{formatKes(t.salesCents)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Catalog</CardTitle>
            <Button asChild size="sm" variant="outline"><Link to="/publisher/catalog">Open catalog</Link></Button>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Live", o.catalog.live],
                ["In review", o.catalog.inReview],
                ["Changes asked for", o.catalog.changesRequested],
                ["Low on stock", o.catalog.lowStock],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl bg-paper p-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-display text-2xl font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
