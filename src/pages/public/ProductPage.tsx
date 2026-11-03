import { Link, useParams } from "react-router"
import { BadgeCheck, ChevronRight, Download, Minus, Plus, School, Truck } from "lucide-react"

import { BookCover, ProductCard } from "@/components/common/ProductCard"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProduct } from "@/lib/api/queries"
import type { ProductDetail } from "@/lib/api/schemas"
import { formatBytes, formatKes } from "@/lib/format"
import { useCartStore } from "@/stores/cart"

const bandNames: Record<ProductDetail["gradeBand"], string> = {
  pp: "PP1–PP2",
  "1-3": "Grade 1–3",
  "4-6": "Grade 4–6",
  "7-9": "Grade 7–9",
  all: "All grades",
}

export function ProductPage() {
  const { productId = "" } = useParams()
  const product = useProduct(productId)

  return (
    <div className="mx-auto flex max-w-site flex-col gap-6 px-5 lg:px-10 pt-5 pb-32 md:pt-8 md:pb-16">
      <QueryBoundary query={product} fallback={<ProductSkeleton />}>
        {(p) => <ProductDetailView product={p} />}
      </QueryBoundary>
    </div>
  )
}

function ProductDetailView({ product: p }: { product: ProductDetail }) {
  const qty = useCartStore((s) => s.extras[p.id] ?? 0)
  const setExtraQty = useCartStore((s) => s.setExtraQty)

  const facts = [
    ["Publisher", p.publisherName],
    ["Grade", p.gradeLabel],
    ["Subject", p.subject],
    ["Format", p.format],
    p.pages ? ["Pages", String(p.pages)] : null,
    p.isbn ? ["ISBN", p.isbn] : null,
  ].filter((f): f is [string, string] => f !== null)

  return (
    <>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          <li className="shrink-0">
            <Link to="/shop" className="hover:text-ink hover:underline">Shop</Link>
          </li>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <li className="shrink-0">
            <Link to={p.gradeBand === "all" ? "/shop" : `/shop?grade=${p.gradeBand}`} className="hover:text-ink hover:underline">
              {bandNames[p.gradeBand]}
            </Link>
          </li>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <li aria-current="page" className="truncate font-medium text-ink">{p.title}</li>
        </ol>
      </nav>

      <div className="grid gap-x-12 gap-y-7 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <div className="mx-auto w-full max-w-[240px] md:sticky md:top-6 md:max-w-none md:self-start">
          {p.imageUrl ? (
            <>
              <img
                src={p.imageUrl}
                alt={`Cover image for ${p.title}`}
                loading="eager"
                onError={(event) => {
                  event.currentTarget.style.display = "none"
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                  if (fallback) fallback.style.display = "flex"
                }}
                className="aspect-[3/4] w-full rounded-2xl bg-paper object-cover shadow-[0_24px_48px_-24px_rgb(20_20_20/0.35)]"
              />
              <span style={{ display: "none" }}>
                <BookCover product={p} className="p-6 shadow-[0_24px_48px_-24px_rgb(20_20_20/0.35)] md:p-8 [&>span:last-child]:text-3xl" />
              </span>
            </>
          ) : (
            <BookCover product={p} className="p-6 shadow-[0_24px_48px_-24px_rgb(20_20_20/0.35)] md:p-8 [&>span:last-child]:text-3xl" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold tracking-[0.08em] text-accent-text uppercase">
              {p.gradeLabel} · {p.subject}
            </span>
            <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.1] font-semibold tracking-tight">{p.title}</h1>
            <span className="text-muted-foreground">by {p.publisherName}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.kicdApproved && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-[13px] font-semibold text-success-fg">
                <BadgeCheck className="size-4" aria-hidden /> KICD approved
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1.5 text-[13px] font-semibold text-info-fg">
              <School className="size-4" aria-hidden /> On {p.schoolListCount} school lists
            </span>
          </div>

          {/* Purchase block: inline from md, a sticky bar at the bottom of the screen on phones. */}
          <div className="z-20 flex flex-wrap items-center gap-x-5 gap-y-3 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:border-t max-md:bg-surface max-md:px-5 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:rounded-2xl md:border md:bg-surface md:p-5">
            <div className="flex flex-col">
              <span className="font-display text-[26px] leading-none font-semibold md:text-[32px]">{formatKes(p.priceCents)}</span>
              <span className="mt-1 text-xs text-muted-foreground max-md:hidden">Price set by the publisher. No delivery fee.</span>
            </div>
            <div className="ml-auto flex items-center gap-2.5 md:ml-0 md:w-full">
              {qty > 0 && (
                <div className="flex items-center rounded-xl border" role="group" aria-label="Quantity">
                  <button type="button" aria-label="One fewer" onClick={() => setExtraQty(p.id, qty - 1)} className="flex size-11 items-center justify-center">
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-6 text-center font-semibold" aria-live="polite">{qty}</span>
                  <button type="button" aria-label="One more" onClick={() => setExtraQty(p.id, qty + 1)} disabled={qty >= 20} className="flex size-11 items-center justify-center disabled:opacity-40">
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              )}
              {qty > 0 ? (
                <Button asChild size="lg" className="md:grow">
                  <Link to="/parent/checkout">Go to checkout</Link>
                </Button>
              ) : (
                <Button size="lg" className="md:grow" onClick={() => setExtraQty(p.id, 1)}>
                  Add to my child's pack
                </Button>
              )}
            </div>
          </div>

          <p className="flex items-start gap-3 rounded-2xl bg-paper p-4 text-sm leading-normal text-ink/85">
            <Truck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              Delivered to your child's school with the next {p.publisherName} delivery, packed and labelled with their name.
              Buying the full list?{" "}
              <Link to="/schools/greenhill-academy" className="font-semibold text-accent-text underline underline-offset-4">Find your school</Link>.
            </span>
          </p>

          {p.description && (
            <section className="flex flex-col gap-2" aria-labelledby="about">
              <h2 id="about" className="text-xl font-semibold">About this book</h2>
              <p className="leading-relaxed text-ink/85">{p.description}</p>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="details">
            <h2 id="details" className="text-xl font-semibold">Details</h2>
            <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b px-4 py-3 text-[15px] sm:odd:border-r">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {p.resources.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="resources">
              <h2 id="resources" className="text-xl font-semibold">Comes with downloads</h2>
              <ul className="divide-y rounded-2xl border">
                {p.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                    <Download className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 grow font-medium">{r.label}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{formatBytes(r.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">You can download these from your order once you've paid.</p>
            </section>
          )}

          {p.onSchoolLists.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="lists">
              <h2 id="lists" className="text-xl font-semibold">On these school lists</h2>
              <ul className="flex flex-col divide-y rounded-2xl border">
                {p.onSchoolLists.map((s) => (
                  <li key={s.slug}>
                    <Link to={`/schools/${s.slug}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="text-sm text-muted-foreground">{s.town}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {p.schoolListCount > p.onSchoolLists.length && (
                <p className="text-sm text-muted-foreground">and {p.schoolListCount - p.onSchoolLists.length} more schools</p>
              )}
            </section>
          )}
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="mt-6 flex flex-col gap-4" aria-labelledby="related">
          <h2 id="related" className="text-2xl font-semibold">Often bought with this</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {p.related.map((r, i) => (
              <ProductCard key={r.id} product={r} index={i + 1} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 md:grid-cols-[4fr_7fr]" aria-busy="true" aria-label="Loading">
      <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[240px] rounded-xl md:max-w-none" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}
