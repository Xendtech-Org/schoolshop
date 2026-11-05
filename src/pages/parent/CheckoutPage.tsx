import { Link, useNavigate } from "react-router"
import { Minus, Plus, School } from "lucide-react"

import { CheckoutSteps } from "@/components/common/CheckoutSteps"
import { PayOptions } from "@/components/common/PayOptions"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { SectionLabel } from "@/components/common/SectionLabel"
import { ParentPageHeader } from "@/components/layout/ParentLayout"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useBooklist, useChildren, useCreateOrder, useProductsByIds, useStartPayment } from "@/lib/api/queries"
import type { Booklist, Product } from "@/lib/api/schemas"
import { formatDay, formatKes } from "@/lib/format"
import { useAuthStore } from "@/stores/auth"
import { useCartStore } from "@/stores/cart"


export function CheckoutPage() {
  const { booklistId } = useCartStore()
  const booklist = useBooklist(booklistId)

  if (!booklistId) {
    return (
      <>
        <ParentPageHeader back="/parent" title="Checkout" />
        <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Your cart is empty</p>
          <p className="text-sm text-muted-foreground">Open your child's school list to start an order.</p>
          <Button asChild>
            <Link to="/parent">Go to my children</Link>
          </Button>
        </div>
      </>
    )
  }

  return <QueryBoundary query={booklist}>{(list) => <Checkout list={list} />}</QueryBoundary>
}

function Checkout({ list }: { list: Booklist }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const cart = useCartStore()
  const children = useChildren()
  const products = useProductsByIds(Object.keys(cart.extras))
  const createOrder = useCreateOrder()
  const startPayment = useStartPayment()

  const child = children.data?.find((c) => c.id === cart.studentId)
  const listLines = list.items.filter((i) => !cart.excludedItemIds.includes(i.id))
  const listTotal = listLines.reduce((s, i) => s + i.unitPriceCents * i.qtyPerStudent, 0)
  const extras = Object.entries(cart.extras).flatMap(([id, qty]) => {
    const p = products.data.find((x) => x.id === id)
    return p ? [{ product: p, qty }] : []
  })
  const unavailableExtraIds = !products.isPending
    ? Object.keys(cart.extras).filter((id) => !products.data.some((product) => product.id === id))
    : []
  const extrasTotal = extras.reduce((s, e) => s + e.product.priceCents * e.qty, 0)
  const total = listTotal + extrasTotal

  /** Save the order, then start paying for it. A card payer leaves for the provider's page. */
  async function pay(how: { method: "mpesa"; phone: string } | { method: "card" }) {
    if (!cart.studentId || !cart.booklistId) return
    const order = await createOrder.mutateAsync({
      studentId: cart.studentId,
      booklistId: cart.booklistId,
      excludedItemIds: cart.excludedItemIds,
      extraItems: extras.map((e) => ({ productId: e.product.id, qty: e.qty })),
    })
    const payment = await startPayment.mutateAsync({ orderId: order.id, ...how })
    cart.clear()
    if (payment.method === "card" && payment.redirectUrl) window.location.assign(payment.redirectUrl)
    else navigate(`/parent/orders/${order.id}/payments/${payment.id}`, { replace: true })
  }

  return (
    <>
      <ParentPageHeader back={`/parent/lists/${list.id}?student=${cart.studentId}`} title="Checkout" />
      <CheckoutSteps current={1} />
      <div className="parent-split mt-5 flex flex-col gap-3.5">
        <div className="parent-col flex flex-col gap-3.5" style={{ "--col-gap": "14px" } as React.CSSProperties}>
        <section aria-label="School list" className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <SectionLabel as="span" className="text-xs">
                For {child?.name ?? "your child"} · {child?.className ?? list.gradeName}
              </SectionLabel>
              <span className="font-semibold">{list.termName.split(",")[0]} school list</span>
              <span className="text-sm text-muted-foreground">
                {listLines.length} of {list.items.length} items
              </span>
            </span>
            <span className="font-bold whitespace-nowrap">{formatKes(listTotal)}</span>
          </div>
          <Link
            to={`/parent/lists/${list.id}?student=${cart.studentId}`}
            className="self-start py-1 text-sm font-semibold text-accent-text hover:underline"
          >
            Change items
          </Link>
        </section>

        {extras.length > 0 && (
          <section aria-label="Extra shop items" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <SectionLabel as="span" className="text-xs">Extra from the shop</SectionLabel>
            {extras.map(({ product, qty }) => (
              <ExtraRow key={product.id} product={product} qty={qty} onChange={(n) => cart.setExtraQty(product.id, n)} />
            ))}
          </section>
        )}
        {unavailableExtraIds.length > 0 && (
          <div role="alert" className="text-sm text-destructive">
            <p>Some extra shop items could not be loaded. Remove them to continue:</p>
            <ul className="mt-1 flex flex-wrap gap-x-3">
              {unavailableExtraIds.map((id) => (
                <li key={id}>
                  <Button type="button" variant="link" className="h-auto p-0 text-destructive" onClick={() => cart.setExtraQty(id, 0)}>
                    Remove unavailable item
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <section aria-label="Delivery" className="flex items-start gap-3 rounded-2xl border bg-card p-4">
          <School className="mt-0.5 size-5.5 shrink-0" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Delivered to {list.schoolName}</span>
            <span className="text-sm leading-snug text-muted-foreground">
              Everything arrives together in one labelled pack, by {formatDay(list.deliverBy)}.
            </span>
          </span>
        </section>

        </div>

        <div className="parent-col parent-col--sticky flex flex-col gap-3.5" style={{ "--col-gap": "14px" } as React.CSSProperties}>
        <dl className="flex flex-col gap-2 px-1 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">School list</dt><dd>{formatKes(listTotal)}</dd></div>
          {extras.length > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Shop items</dt><dd>{formatKes(extrasTotal)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Delivery to school</dt><dd className="font-semibold text-success-fg">Free</dd></div>
          <Separator className="my-1" />
          <div className="flex justify-between text-[17px] font-bold"><dt>Total</dt><dd>{formatKes(total)}</dd></div>
        </dl>

        <PayOptions
          amountCents={total}
          defaultPhone={user?.phone ? user.phone.replace(/^254/, "0") : ""}
          disabled={createOrder.isPending || products.isPending || products.isError || extras.length !== Object.keys(cart.extras).length || listLines.length + extras.length === 0}
          onMpesa={(phone) => pay({ method: "mpesa", phone })}
          onCard={() => pay({ method: "card" })}
        />
        </div>
      </div>
    </>
  )
}

function ExtraRow({ product, qty, onChange }: { product: Product; qty: number; onChange: (qty: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-semibold">{product.title}</span>
        <span className="text-sm text-muted-foreground">{formatKes(product.priceCents)}</span>
      </span>
      <div role="group" aria-label={`Quantity of ${product.title}`} className="flex h-11 items-center rounded-lg border border-input">
        <button type="button" aria-label="Decrease" onClick={() => onChange(qty - 1)} className="flex h-full w-9 items-center justify-center">
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="min-w-5 text-center font-bold" aria-live="polite">{qty}</span>
        <button type="button" aria-label="Increase" onClick={() => onChange(qty + 1)} className="flex h-full w-9 items-center justify-center">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
