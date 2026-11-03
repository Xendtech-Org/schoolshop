import { Link, useNavigate, useParams } from "react-router"

import { SectionLabel } from "@/components/common/SectionLabel"
import { ShipmentStatusBadge } from "@/components/common/StatusBadge"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { ParentPageHeader } from "@/components/layout/ParentLayout"
import { Button } from "@/components/ui/button"
import { PayOptions } from "@/components/common/PayOptions"
import { useOrder, useStartPayment } from "@/lib/api/queries"
import type { Order, OrderStatus } from "@/lib/api/schemas"
import { formatDay, formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"

const progress: OrderStatus[] = ["paid", "in_fulfilment", "at_school", "collected"]

function timeline(order: Order) {
  const reached = progress.indexOf(order.status)
  const dispatched = order.shipments.filter((s) => s.status === "dispatched" || s.status === "received").length
  return [
    { title: order.paidAt && !order.mpesaReceipt ? "Paid by card" : "Paid with M-Pesa", detail: order.paidAt ? `${formatDay(order.paidAt)}${order.mpesaReceipt ? ` · ref ${order.mpesaReceipt}` : ""}` : "Waiting for payment" },
    { title: "On the way to school", detail: `${dispatched} of ${order.shipments.length} shipments dispatched` },
    { title: "Arrived at school", detail: order.expectedAtSchool ? `Expected by ${formatDay(order.expectedAtSchool)}` : "" },
    { title: `Collected by ${order.studentName}`, detail: "Teacher confirms with the code" },
  ].map((step, i) => ({ ...step, state: i <= reached ? "done" : i === reached + 1 ? "now" : "todo" }))
}

/** An order saved but not paid: pay for it here, by M-Pesa or card. */
function PayOrder({ order }: { order: Order }) {
  const navigate = useNavigate()
  const start = useStartPayment()
  const user = useAuthStore((s) => s.user)
  async function pay(how: { method: "mpesa"; phone: string } | { method: "card" }) {
    const payment = await start.mutateAsync({ orderId: order.id, ...how })
    if (payment.method === "card" && payment.redirectUrl) window.location.assign(payment.redirectUrl)
    else navigate(`/parent/orders/${order.id}/payments/${payment.id}`)
  }
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="rounded-2xl border bg-card p-4 font-semibold">
        {order.status === "payment_failed" ? "The last payment didn't go through. Try again:" : "This order isn't paid yet."}
      </p>
      <PayOptions
        amountCents={order.totalCents}
        defaultPhone={user?.phone ? user.phone.replace(/^254/, "0") : ""}
        onMpesa={(phone) => pay({ method: "mpesa", phone })}
        onCard={() => pay({ method: "card" })}
      />
      <Button asChild variant="link" className="self-start"><Link to="/parent">Back to home</Link></Button>
    </div>
  )
}

export function OrderPage() {
  const { orderId = "" } = useParams()
  const order = useOrder(orderId)
  return (
    <QueryBoundary query={order}>
      {(o) => (
        <>
          <ParentPageHeader back="/parent" title={`Order #${o.number}`} subtitle={`${o.studentName} · ${o.className} · ${formatKes(o.totalCents)}`} />
          {o.status === "pending_payment" || o.status === "payment_failed" ? (
            <PayOrder order={o} />
          ) : (
            <div className="parent-split flex flex-col gap-4">
              <div className="parent-col flex flex-col gap-4">
              {o.collectionCode && o.status !== "collected" && (
                <section aria-label="Collection code" className="flex flex-col gap-1.5 rounded-2xl bg-ink p-4.5 text-white">
                  <SectionLabel as="span" className="text-sun">Collection code</SectionLabel>
                  <span className="font-display text-[40px] font-semibold tracking-[0.18em]">{o.collectionCode}</span>
                  <span className="text-sm leading-snug text-white/80">
                    {o.studentName} gives this code to the class teacher when the pack arrives.
                  </span>
                </section>
              )}
              <section aria-label="Progress" className="rounded-2xl border bg-card p-4.5">
                <ol>
                  {timeline(o).map((s, i, all) => (
                    <li key={s.title} className="flex gap-3.5">
                      <div className="flex w-5.5 flex-col items-center">
                        <span
                          className={cn(
                            "mt-0.5 size-4 shrink-0 rounded-full",
                            s.state === "done" && "bg-ink",
                            s.state === "now" && "bg-flame ring-4 ring-orange-light",
                            s.state === "todo" && "border-2 border-line-strong bg-surface"
                          )}
                        />
                        {i < all.length - 1 && <span className={cn("min-h-6 w-0.5 grow", s.state === "done" ? "bg-ink" : "bg-border")} />}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4.5">
                        <span className={cn("text-[15px]", s.state === "todo" ? "font-medium text-muted-foreground" : "font-semibold")}>{s.title}</span>
                        <span className="text-[13px] text-muted-foreground">{s.detail}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              </div>
              <section aria-label="Shipments" className="flex flex-col gap-2">
                <SectionLabel>From {o.shipments.length} publishers</SectionLabel>
                {o.shipments.map((s) => (
                  <div key={s.publisherName} className="flex items-center justify-between rounded-xl border bg-card px-3.5 py-3">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold">{s.publisherName}</span>
                      <span className="text-[13px] text-muted-foreground">{s.summary}</span>
                    </span>
                    <ShipmentStatusBadge status={s.status} />
                  </div>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </QueryBoundary>
  )
}
