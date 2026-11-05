import { Link, useSearchParams } from "react-router"
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Library, PencilRuler, School } from "lucide-react"

import { ProductCard } from "@/components/common/ProductCard"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/select"
import { useProducts, type ProductFilters } from "@/lib/api/queries"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart"

const gradeBands = [
  { id: "all", name: "All grades" },
  { id: "pp", name: "PP1–PP2" },
  { id: "1-3", name: "Grade 1–3" },
  { id: "4-6", name: "Grade 4–6" },
  { id: "7-9", name: "Grade 7–9" },
]

const shopPaths = [
  { label: "Shop by School", description: "Buy your school's approved list", to: "/schools", icon: School },
  { label: "Shop by Grade", description: "Find books for a learning level", to: "/shop?view=grade", icon: GraduationCap },
  { label: "Shop by Curriculum", description: "CBE, IGCSE, IB and more", to: "/shop?view=curriculum", icon: BookOpen },
  { label: "College & University", description: "Books for higher education", to: "/shop?category=college", icon: Library },
  { label: "Stationery & Supplies", description: "Everyday learning essentials", to: "/shop?category=stationery", icon: PencilRuler },
]

const curriculumNames: Record<string, string> = { cbe: "CBE (Kenya)", igcse: "IGCSE", ib: "International Baccalaureate (IB)" }

const titles: Record<string, string> = {
  all: "Shop all products",
  grade: "Shop by grade",
  curriculum: "Shop by curriculum",
  college: "College & University",
  stationery: "Stationery & Supplies",
  textbook: "Textbooks & Readers",
}
const PRODUCTS_PER_PAGE = 24

export function ShopPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get("view") ?? "all"
  const category = params.get("category") ?? "all"
  const grade = params.get("grade") ?? "all"
  const curriculum = params.get("curriculum") ?? "cbe"
  const search = params.get("search") ?? ""
  const subject = params.get("subject") ?? ""
  const publisher = params.get("publisher") ?? ""
  const department = params.get("department") ?? ""
  const sort = params.get("sort") ?? "popular"
  const parsedPage = Number(params.get("page") ?? "1")
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const productsFilters: ProductFilters = {
    ...(view === "grade" && grade !== "all" ? { gradeBand: grade } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(view === "curriculum" ? { curriculum } : {}),
    ...(search ? { search } : {}),
    ...(subject ? { subject } : {}),
    ...(publisher ? { publisher } : {}),
    ...(department ? { department } : {}),
    ...(sort ? { sort } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }
  const products = useProducts(productsFilters)
  const extras = useCartStore((s) => s.extras)
  const setExtraQty = useCartStore((s) => s.setExtraQty)
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === "all") next.delete(key)
    else next.set(key, value)
    if (key !== "page") next.delete("page")
    setParams(next)
  }
  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(params)
    if (nextPage > 1) next.set("page", String(nextPage))
    else next.delete("page")
    setParams(next)
  }
  const title = view === "curriculum" ? `${curriculum.toUpperCase()} curriculum` : (category !== "all" ? (titles[category] ?? titles.all) : (titles[view] ?? titles.all))
  const curriculumLabel = curriculumNames[curriculum] ?? curriculum.toUpperCase()

  return (
    <div className="mx-auto max-w-site px-5 lg:px-10 pt-6 pb-16 md:pt-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-bold tracking-[0.08em] text-accent-text uppercase">The SchoolShop catalogue</p>
        <h1 className="text-[clamp(30px,5vw,40px)] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="max-w-3xl text-ink/80">Shop school books, curriculum resources and supplies from one catalogue. You can shop independently or find your school's approved list.</p>
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-8">
        <aside aria-label="Filters" className="flex w-full shrink-0 flex-col gap-4 lg:w-[250px]">
          <nav aria-label="Shop categories" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:gap-0.5">
            {shopPaths.map((path) => {
              const Icon = path.icon
              const active = path.to === "/shop" ? category === "all" && view === "all" : path.to.includes("/schools") ? false : path.to.includes("view=grade") ? view === "grade" : path.to.includes("view=curriculum") ? view === "curriculum" : path.to.includes("college") ? category === "college" : category === "stationery"
              return (
                <Link key={path.label} to={path.to} aria-current={active ? "page" : undefined} className={cn("flex min-h-28 flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-ink/40 hover:bg-paper lg:min-h-0 lg:flex-row lg:items-center lg:gap-2.5 lg:border-transparent lg:px-2.5 lg:py-2", active && "border-ink bg-paper lg:border-ink")}>
                  <Icon className="size-5 shrink-0 text-accent-text lg:size-4.5" aria-hidden />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold leading-tight">{path.label}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{path.description}</span>
                  </span>
                </Link>
              )
            })}
          </nav>

          {view === "grade" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="grade-filter" className="text-sm font-semibold">Learning level</label>
              <NativeSelect className="h-10 text-sm" id="grade-filter" value={grade} onChange={(e) => update("grade", e.target.value)}>
                {gradeBands.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </NativeSelect>
            </div>
          )}

          {view === "curriculum" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="curriculum-filter" className="text-sm font-semibold">Curriculum</label>
              <NativeSelect className="h-10 text-sm" id="curriculum-filter" value={curriculum} onChange={(e) => update("curriculum", e.target.value)}>
                <option value="cbe">CBE (Kenya)</option>
                <option value="igcse">IGCSE</option>
                <option value="ib">International Baccalaureate (IB)</option>
              </NativeSelect>
              <p className="text-sm text-muted-foreground">Selected: {curriculumLabel}. Results depend on the curricula assigned to products in the catalogue.</p>
            </div>
          )}

          {category === "stationery" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="department-filter" className="text-sm font-semibold">Stationery department</label>
              <NativeSelect className="h-10 text-sm" id="department-filter" value={params.get("department") ?? ""} onChange={(e) => update("department", e.target.value)}>
                <option value="">All stationery</option>
                <option value="writing">Writing & exercise books</option>
                <option value="maths">Maths & geometry</option>
                <option value="art">Art supplies</option>
              </NativeSelect>
            </div>
          )}

          <div className="flex flex-col gap-2 lg:mt-1 lg:border-t lg:pt-4">
            <NativeSelect className="h-10 text-sm" aria-label="Filter by subject" value={subject} onChange={(e) => update("subject", e.target.value)}>
              <option value="">All subjects</option>
              {(products.data?.subjects ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
            </NativeSelect>
            <NativeSelect className="h-10 text-sm" aria-label="Filter by publisher" value={publisher} onChange={(e) => update("publisher", e.target.value)}>
              <option value="">All publishers</option>
              {(products.data?.publishers ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
            </NativeSelect>
            <NativeSelect className="h-10 text-sm" aria-label="Sort products" value={sort} onChange={(e) => update("sort", e.target.value)}>
              <option value="popular">Most popular</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="title">Name: A–Z</option>
            </NativeSelect>
          </div>

          {view === "all" && category === "all" && !search && (
            <p className="rounded-xl bg-paper p-4 text-sm text-ink/80">Buying for a school list? <Link to="/schools" className="font-semibold text-accent-text hover:underline">Find your school</Link> for the complete approved list.</p>
          )}
        </aside>

        <section aria-label="Catalogue results" className="flex min-w-0 grow flex-col gap-4">
          <QueryBoundary query={products}>
            {(data) => (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {data.count
                      ? `Showing ${(page - 1) * PRODUCTS_PER_PAGE + 1}–${(page - 1) * PRODUCTS_PER_PAGE + data.results.length} of ${data.count} products`
                      : "0 products"}
                  </p>
                  {(search || subject || publisher || params.get("department")) && <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams([...params].filter(([key]) => !["search", "subject", "publisher", "department", "page"].includes(key))))}>Clear filters</Button>}
                </div>
                {data.results.length ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
                    {data.results.map((product, index) => {
                      const added = !!extras[product.id]
                      return <ProductCard key={product.id} product={product} index={index} action={<Button size="sm" variant={added ? "secondary" : "outline"} aria-pressed={added} onClick={() => setExtraQty(product.id, added ? 0 : 1)}>{added ? "Added" : "Add"}</Button>} />
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-14 text-center">
                    <Library className="size-8 text-muted-foreground" aria-hidden />
                    <h2 className="text-lg font-semibold">No products found</h2>
                    <p className="max-w-md text-sm text-muted-foreground">Try changing your search or filters. More products can be added to this catalogue without duplicating existing listings.</p>
                    <Button variant="outline" onClick={() => setParams(view === "curriculum" ? { view, curriculum } : view === "grade" ? { view } : {})}>Reset filters</Button>
                  </div>
                )}
                {data.count > PRODUCTS_PER_PAGE && (
                  <ProductPagination count={data.count} page={page} onPageChange={setPage} />
                )}
              </>
            )}
          </QueryBoundary>
        </section>
      </div>
    </div>
  )
}

function ProductPagination({ count, page, onPageChange }: { count: number; page: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(count / PRODUCTS_PER_PAGE)
  const visiblePages = [...new Set([1, page - 1, page, page + 1, totalPages].filter((n) => n >= 1 && n <= totalPages))].sort((a, b) => a - b)
  const items: (number | "ellipsis")[] = []
  visiblePages.forEach((n, i) => {
    if (i > 0 && n - visiblePages[i - 1] > 1) items.push("ellipsis")
    items.push(n)
  })

  return (
    <nav aria-label="Product catalog pages" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden /> Previous
      </Button>
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} aria-hidden className="px-2 text-muted-foreground">…</span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "secondary" : "ghost"}
            size="sm"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        )
      )}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}
