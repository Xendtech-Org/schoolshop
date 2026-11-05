import { useEffect, type ReactNode } from "react"
import { Link, Navigate, useParams, useSearchParams } from "react-router"
import { ArrowRight, CalendarClock, Info, PackageCheck, ShoppingBag, Truck } from "lucide-react"

import { QueryBoundary } from "@/components/common/QueryBoundary"
import { SectionLabel } from "@/components/common/SectionLabel"
import { ParentPageHeader } from "@/components/layout/ParentLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useBooklist, useChildren, useProductsByIds } from "@/lib/api/queries"
import type { Booklist, BooklistItem, Child } from "@/lib/api/schemas"
import { daysUntil, formatDay, formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart"

const lineTotal = (i: BooklistItem) => i.unitPriceCents * i.qtyPerStudent

export function BooklistPage() {
  const { booklistId = "" } = useParams()
  const studentId = useSearchParams()[0].get("student")
  const booklist = useBooklist(booklistId)
  const children = useChildren()
  const child = children.data?.find((c) => c.id === studentId)
  const start = useCartStore((s) => s.start)

  const optionalIds = booklist.data?.items.filter((i) => !i.required).map((i) => i.id)
  useEffect(() => {
    if (studentId && optionalIds) start(studentId, booklistId, optionalIds)
    // optionalIds is derived from the fetched list; re-run only when that list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, booklistId, booklist.data, start])

  if (!studentId) return <Navigate to="/parent" replace />

  return <QueryBoundary query={booklist}>{(list) => <ListView list={list} child={child} />}</QueryBoundary>
}

function ListView({ list, child }: { list: Booklist; child: Child | undefined }) {
  const { excludedItemIds, toggleItem, extras } = useCartStore()
  const products = useProductsByIds(Object.keys(extras))
  const name = child?.name ?? "your child"

  const isOn = (i: BooklistItem) => !excludedItemIds.includes(i.id)
  const required = list.items.filter((i) => i.required)
  const optional = list.items.filter((i) => !i.required)
  const requiredOn = required.filter(isOn)
  const optionalOn = optional.filter(isOn)
  const requiredTotal = requiredOn.reduce((s, i) => s + lineTotal(i), 0)
  const optionalTotal = optionalOn.reduce((s, i) => s + lineTotal(i), 0)
  const shopLines = Object.entries(extras).flatMap(([id, qty]) => {
    const p = products.data.find((x) => x.id === id)
    return p ? [{ product: p, qty }] : []
  })
  const shopTotal = shopLines.reduce((s, l) => s + l.product.priceCents * l.qty, 0)
  const total = requiredTotal + optionalTotal + shopTotal
  const chosen = requiredOn.length + optionalOn.length

  const daysLeft = daysUntil(list.orderDeadline)
  const closed = list.status === "closed" || daysLeft < 0
  const order = child?.latestOrder
  const ordered = order && !["cancelled", "refunded", "payment_failed"].includes(order.status)

  const tickAllRequired = () => required.filter((i) => !isOn(i)).forEach((i) => toggleItem(i.id))

  return (
    <>
      <ParentPageHeader
        back="/parent"
        title={child ? `${child.name}'s ${list.termName.split(",")[0]} list` : `${list.gradeName} list`}
        subtitle={`${child?.className ?? list.gradeName} · ${list.schoolName}`}
      />
      <div className="parent-split">
        <div className="flex min-w-0 flex-col gap-4">
          {ordered && order && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-info-bg p-4 text-info-fg">
              <span className="flex items-start gap-2.5 text-[15px]">
                <PackageCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                {order.status === "pending_payment"
                  ? `You started an order for ${name} (${order.number}) but haven't paid yet.`
                  : `You've already ordered for ${name} (${order.number}). Ordering again creates a second order.`}
              </span>
              <Button asChild size="sm" variant="outline" className="bg-surface">
                <Link to={`/parent/orders/${order.id}`}>{order.status === "pending_payment" ? "Finish paying" : "View order"}</Link>
              </Button>
            </div>
          )}

          <dl className="grid grid-cols-3 gap-2">
            <KeyDate
              icon={<CalendarClock aria-hidden />}
              label="Order by"
              value={formatDay(list.orderDeadline)}
              hint={closed ? "Closed" : daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
              urgent={!closed && daysLeft <= 3}
            />
            <KeyDate icon={<Truck aria-hidden />} label="At school" value={formatDay(list.deliverBy)} hint="Collect in class" />
            <KeyDate icon={<PackageCheck aria-hidden />} label="Delivery" value="Free" hint="To the school" />
          </dl>

          <p className="flex items-start gap-2.5 rounded-xl bg-teal-light p-3.5 text-sm leading-snug text-ink">
            <Info className="mt-0.5 size-4.5 shrink-0 text-accent-text" aria-hidden />
            Set by {list.schoolName}. Untick anything {name} already has, and tick any optional extras you want. The total updates as you go.
          </p>

          <Group
            id="required"
            title="Required by the school"
            hint={`${requiredOn.length} of ${required.length} ticked`}
            action={requiredOn.length < required.length ? <Button variant="link" className="h-auto px-0" onClick={tickAllRequired}>Tick all</Button> : null}
          >
            {required.map((i) => <ItemRow key={i.id} item={i} on={isOn(i)} name={name} onToggle={() => toggleItem(i.id)} disabled={closed} />)}
          </Group>

          {optional.length > 0 && (
            <Group id="optional" title="Optional extras" hint="Recommended by the teacher. Add only if you'd like.">
              {optional.map((i) => <ItemRow key={i.id} item={i} on={isOn(i)} name={name} onToggle={() => toggleItem(i.id)} disabled={closed} />)}
            </Group>
          )}

          <Link
            to="/shop"
            className="parent-row flex items-center gap-3 rounded-xl border border-dashed bg-card p-3.5 text-[15px] hover:border-line-strong"
          >
            <ShoppingBag className="size-5 shrink-0 text-accent-text" aria-hidden />
            <span className="flex grow flex-col">
              <span className="font-semibold">Need anything else?</span>
              <span className="text-[13px] text-muted-foreground">Pens, bags and revision books from the shop arrive in the same pack.</span>
            </span>
            <ArrowRight className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>

        <aside aria-label="Order summary" className="parent-summary fixed inset-x-0 bottom-[76px] z-10 mx-auto flex max-w-lg flex-col gap-2.5 border-t bg-surface px-5 py-3.5 md:border-x">
          <dl className="hidden flex-col gap-2 text-[15px] lg:flex">
            <span className="font-display text-lg font-semibold">Summary</span>
            <SummaryRow label={`Required items (${requiredOn.length})`} value={formatKes(requiredTotal)} />
            <SummaryRow label={`Optional extras (${optionalOn.length})`} value={formatKes(optionalTotal)} />
            {shopLines.length > 0 && <SummaryRow label={`Shop items (${shopLines.length})`} value={formatKes(shopTotal)} />}
            <SummaryRow label="Delivery to school" value="Free" />
            <div className="my-1 border-t" />
          </dl>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              <span className="lg:hidden">{chosen} of {list.items.length} selected</span>
              <span className="hidden lg:inline">Total</span>
            </span>
            <span className="font-display text-[22px] font-semibold">{formatKes(total)}</span>
          </div>
          {closed ? (
            <Button size="lg" disabled>Ordering closed {formatDay(list.orderDeadline)}</Button>
          ) : chosen ? (
            products.isError ? (
              <p role="alert" className="text-sm text-destructive">Couldn't load your extra products. Refresh and try again.</p>
            ) : (
              <Button asChild size="lg" disabled={products.isPending || shopLines.length !== Object.keys(extras).length}>
                <Link to="/parent/checkout">Continue to checkout</Link>
              </Button>
            )
          ) : (
            <Button size="lg" disabled>Choose at least one item</Button>
          )}
          <span className="hidden text-[13px] text-muted-foreground lg:block">You'll pay with M-Pesa on the next step.</span>
        </aside>
      </div>
      <div className="parent-spacer h-32" aria-hidden />
    </>
  )
}

function KeyDate({ icon, label, value, hint, urgent }: { icon: ReactNode; label: string; value: string; hint: string; urgent?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-3 [&_svg]:size-4", urgent && "border-warn-fg/30 bg-warn-bg")}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span className="truncate">{label}</span></dt>
      <dd className="font-display text-lg leading-tight font-semibold">{value}</dd>
      <dd className={cn("text-xs", urgent ? "font-semibold text-warn-fg" : "text-muted-foreground")}>{hint}</dd>
    </div>
  )
}

function Group({ id, title, hint, action, children }: { id: string; title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <SectionLabel><span id={`${id}-h`}>{title}</span></SectionLabel>
          <span className="text-[13px] text-muted-foreground">{hint}</span>
        </div>
        {action}
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

function ItemRow({ item, on, name, onToggle, disabled }: { item: BooklistItem; on: boolean; name: string; onToggle: () => void; disabled?: boolean }) {
  const id = `item-${item.id}`
  // An unticked required item is a deliberate "already have it"; an unticked extra is just not chosen.
  const dropped = item.required && !on
  return (
    <li className={cn("parent-row rounded-xl border bg-card", dropped && "bg-paper-2")}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 p-3.5">
        <Checkbox id={id} checked={on} onCheckedChange={onToggle} disabled={disabled} className="mt-0.5" />
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className={cn("text-[15px] leading-snug font-semibold", dropped && "text-muted-foreground")}>
            {item.title}
            {item.qtyPerStudent > 1 && <span className="font-normal text-muted-foreground"> × {item.qtyPerStudent}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            {item.subject} · {item.publisherName}
            {item.required && <Badge variant="secondary" className="px-1.5 py-0.5 text-[11px]">Required</Badge>}
          </span>
          {item.note && <span className="mt-1 text-[13px] leading-snug text-ink-2">“{item.note}”</span>}
          {dropped && <span className="mt-1 text-[13px] font-semibold text-warn-fg">Not buying: {name} already has it</span>}
        </span>
        <span className={cn("text-[15px] font-semibold whitespace-nowrap", dropped && "text-muted-foreground line-through", !item.required && !on && "text-muted-foreground")}>{formatKes(lineTotal(item))}</span>
      </label>
    </li>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
