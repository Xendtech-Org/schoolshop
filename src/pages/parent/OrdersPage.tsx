import { useState } from "react"
import { Link } from "react-router"
import { ChevronRight, KeyRound, PackageOpen } from "lucide-react"

import { OrderStatusBadge } from "@/components/common/StatusBadge"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Button } from "@/components/ui/button"
import { useChildren, useOrders } from "@/lib/api/queries"
import type { Order, OrderStatus } from "@/lib/api/schemas"
import { formatDay, formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"

const done: OrderStatus[] = ["collected", "cancelled", "refunded", "partially_refunded"]
const steps = ["Ordered", "Paid", "At school", "Collected"]
const reached: Partial<Record<OrderStatus, number>> = { pending_payment: 0, payment_failed: 0, paid: 1, in_fulfilment: 1, at_school: 2, collected: 3 }
/** "Term 3, 2026" → "term-3-2026": ids can't hold spaces when used in aria-labelledby. */
const termId = (term: string) => term.toLowerCase().replace(/[^a-z0-9]+/g, "-")
const paidOn = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" })

export function OrdersPage() {
  const orders = useOrders()
  const children = useChildren()
  const [child, setChild] = useState("all")
  const names = children.data?.map((c) => c.name) ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-semibold">Orders</h1>
        <p className="text-[15px] text-muted-foreground">Everything you've ordered for your children, and where it is.</p>
      </div>
      {names.length > 1 && (
        <div role="group" aria-label="Child" className="flex flex-wrap gap-2">
          {["all", ...names].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={child === n}
              onClick={() => setChild(n)}
              className={cn("h-10 rounded-full px-4 text-sm font-semibold", child === n ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
            >
              {n === "all" ? "All children" : n}
            </button>
          ))}
        </div>
      )}
      <QueryBoundary query={orders}>
        {(data) => {
          const list = data.results.filter((o) => child === "all" || o.studentName === child)
          const active = list.filter((o) => !done.includes(o.status))
          const past = list.filter((o) => done.includes(o.status))
          const terms = [...new Set(past.map((o) => o.termName))]
          if (!list.length) {
            return (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
                <PackageOpen className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-muted-foreground">No orders yet. Open your child's booklist to start one.</p>
                <Button asChild variant="outline"><Link to="/parent">Go to my children</Link></Button>
              </div>
            )
          }
          return (
            <>
              <section aria-labelledby="active-h" className="flex flex-col gap-3">
                <h2 id="active-h" className="font-display text-xl font-semibold">In progress</h2>
                {active.length ? (
                  <div className="grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">{active.map((o) => <ActiveOrder key={o.id} order={o} />)}</div>
                ) : (
                  <p className="rounded-2xl border bg-card p-4 text-[15px] text-muted-foreground">Nothing in progress. Every pack has been collected.</p>
                )}
              </section>
              {terms.map((term) => (
                <section key={term} aria-labelledby={termId(term)} className="flex flex-col gap-3">
                  <h2 id={termId(term)} className="font-display text-xl font-semibold">{term}</h2>
                  <ul className="flex flex-col gap-2">
                    {past.filter((o) => o.termName === term).map((o) => (
                      <li key={o.id}>
                        <Link to={`/parent/orders/${o.id}`} className="parent-row flex items-center gap-3 rounded-xl border bg-card p-3.5">
                          <span className="flex min-w-0 grow flex-col gap-0.5">
                            <span className="font-semibold">{o.studentName} · {o.number}</span>
                            <span className="text-sm text-muted-foreground">
                              {o.items.length} items · {formatKes(o.totalCents)}
                              {o.collectedAt && ` · collected ${paidOn.format(new Date(o.collectedAt))}`}
                            </span>
                          </span>
                          <OrderStatusBadge status={o.status} />
                          <ChevronRight className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )
        }}
      </QueryBoundary>
    </div>
  )
}

function ActiveOrder({ order }: { order: Order }) {
  const step = reached[order.status] ?? -1
  const unpaid = order.status === "pending_payment" || order.status === "payment_failed"
  const sent = order.shipments.filter((s) => s.status === "dispatched" || s.status === "received").length
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[17px] font-semibold">{order.studentName}'s {order.termName.split(",")[0]} pack</span>
          <span className="text-sm text-muted-foreground">{order.number} · {order.className} · {order.schoolName}</span>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label={`Progress of ${order.number}`}>
        {steps.map((s, i) => (
          <li key={s} className="flex flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-secondary")} />
            <span className={cn("text-xs", i <= step ? "font-semibold text-ink" : "text-muted-foreground")}>
              {s}<span className="sr-only">{i <= step ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ol>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex flex-col gap-0.5"><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{formatKes(order.totalCents)}</dd></div>
        <div className="flex flex-col gap-0.5"><dt className="text-muted-foreground">Publishers sent</dt><dd className="font-semibold">{sent} of {order.shipments.length}</dd></div>
        <div className="flex flex-col gap-0.5"><dt className="text-muted-foreground">At school by</dt><dd className="font-semibold">{order.expectedAtSchool ? formatDay(order.expectedAtSchool) : "—"}</dd></div>
      </dl>
      {order.collectionCode && !unpaid && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white">
          <span className="flex items-center gap-2 text-sm text-line-strong"><KeyRound className="size-4 text-sun" aria-hidden /> Collection code</span>
          <span className="font-display text-2xl font-semibold tracking-[0.18em]">{order.collectionCode}</span>
        </div>
      )}
      <div className="flex gap-2.5">
        {unpaid ? (
          <Button asChild className="grow"><Link to={`/parent/orders/${order.id}`}>{order.status === "payment_failed" ? "Try paying again" : "Pay now"}</Link></Button>
        ) : (
          <Button asChild variant="outline" className="grow"><Link to={`/parent/orders/${order.id}`}>Track order</Link></Button>
        )}
      </div>
    </article>
  )
}
