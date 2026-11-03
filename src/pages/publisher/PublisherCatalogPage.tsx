import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "radix-ui"
import { AlertTriangle, Pencil, Plus, Search, Upload, X } from "lucide-react"
import { z } from "zod"

import { TitleUploads } from "@/components/catalog/TitleUploads"
import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import type { CatalogItemInput } from "@/lib/api/endpoints"
import { useCatalog, useImportPriceList, useSaveCatalogItem } from "@/lib/api/queries"
import type { CatalogImportResult, CatalogItem } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"

/* ── Stock state ─────────────────────────────────────────────── */

type StockState = "live" | "low" | "out" | "draft"

function stockState(item: CatalogItem): StockState {
  if (item.status === "draft") return "draft"
  if (item.stock === 0) return "out"
  if (item.stock <= item.lowStockAt) return "low"
  return "live"
}

const stateBadge: Record<StockState, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  live: { label: "Live", variant: "success" },
  low: { label: "Low stock", variant: "warning" },
  out: { label: "Out of stock", variant: "destructive" },
  draft: { label: "Draft", variant: "secondary" },
}

const reviewBadge = {
  pending: { label: "In review", variant: "info" },
  changes_requested: { label: "Changes asked", variant: "warning" },
  rejected: { label: "Not approved", variant: "destructive" },
} as const

/** New titles show where they are in SchoolShop's review until they go live. */
function ItemBadge({ item, st }: { item: CatalogItem; st: StockState }) {
  const b = item.review ? reviewBadge[item.review.state] : stateBadge[st]
  return <Badge variant={b.variant}>{b.label}</Badge>
}

const filters: { id: "all" | StockState; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "low", label: "Low stock" },
  { id: "out", label: "Out of stock" },
  { id: "draft", label: "Drafts" },
]

/** Grade options and the shop's grade band each belongs to. */
const grades = [
  ["PP1", "pp"], ["PP2", "pp"],
  ["Grade 1", "1-3"], ["Grade 2", "1-3"], ["Grade 3", "1-3"],
  ["Grade 4", "4-6"], ["Grade 5", "4-6"], ["Grade 6", "4-6"],
  ["Grade 7", "7-9"], ["Grade 8", "7-9"], ["Grade 9", "7-9"],
  ["All grades", "all"],
] as const
const bandFor = (label: string) => grades.find(([l]) => l === label)?.[1] ?? "all"

const bandFilters = [
  { id: "all", name: "All grades" },
  { id: "pp", name: "PP1–PP2" },
  { id: "1-3", name: "Grade 1–3" },
  { id: "4-6", name: "Grade 4–6" },
  { id: "7-9", name: "Grade 7–9" },
]

const formats = ["Paperback, A4", "Paperback, A5", "Hardback", "Pack"]
const coverTones = ["bg-teal", "bg-orange", "bg-sun", "bg-teal-light", "bg-orange-light"]

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/* ── Page ────────────────────────────────────────────────────── */

export function PublisherCatalogPage() {
  const catalog = useCatalog()
  return <QueryBoundary query={catalog}>{(items) => <Catalog items={items} />}</QueryBoundary>
}

function Catalog({ items }: { items: CatalogItem[] }) {
  const [filter, setFilter] = useState<"all" | StockState>("all")
  const [band, setBand] = useState("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null)

  const counts = useMemo(() => {
    const c = { all: items.length, live: 0, low: 0, out: 0, draft: 0 }
    for (const i of items) c[stockState(i)] += 1
    return c
  }, [items])

  const q = search.trim().toLowerCase()
  const shown = items.filter(
    (i) =>
      (filter === "all" || stockState(i) === filter) &&
      (band === "all" || i.gradeBand === band) &&
      (!q || i.title.toLowerCase().includes(q) || (i.isbn ?? "").replace(/-/g, "").includes(q.replace(/-/g, "")))
  )

  const atRisk = items.filter((i) => (stockState(i) === "out" || stockState(i) === "low") && i.schoolListCount > 0)
  const placements = items.reduce((s, i) => s + i.schoolListCount, 0)

  return (
    <>
      <PageHeader
        eyebrow="Schools pick from this list when they build booklists"
        title="Catalog & stock"
        actions={
          <>
            <PriceListUpload />
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add product
            </Button>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live titles" value={counts.live + counts.low} hint={plural(counts.draft, "draft")} />
        <StatCard label="Low stock" value={counts.low} hint="At or below your alert level" />
        <StatCard label="Out of stock" value={counts.out} hint="Parents can't order these" />
        <StatCard label="On school lists" value={placements} hint="Booklists using your titles" />
      </section>

      {atRisk.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-warn-bg p-4 text-warn-fg">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px] leading-relaxed">
            <span className="font-semibold">{plural(atRisk.length, "title")} on school lists need stock: </span>
            {atRisk.map((i) => i.title).join(", ")}. Out-of-stock titles can't be ordered, and parents are refunded
            for them.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-0 grow basis-64">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search by title or ISBN"
              placeholder="Search by title or ISBN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-52">
            <NativeSelect aria-label="Grade" value={band} onChange={(e) => setBand(e.target.value)}>
              {bandFilters.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div role="group" aria-label="Status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
                filter === f.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper"
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs", filter === f.id ? "bg-white/20" : "bg-secondary")}>{counts[f.id]}</span>
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">{plural(shown.length, "title")}</p>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
            No titles match. Try another search or filter.
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="text-right">On lists</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((item) => {
                    const st = stockState(item)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Cover item={item} />
                            <span className="flex min-w-0 flex-col">
                              <span className="font-semibold">{item.title}</span>
                              <span className="text-[13px] text-muted-foreground">{item.format}</span>
                              {item.review?.note && <span className="text-[13px] text-warn-fg">SchoolShop: {item.review.note}</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-muted-foreground">{item.isbn ?? "—"}</TableCell>
                        <TableCell>{item.gradeLabel}</TableCell>
                        <TableCell className="text-right">{formatKes(item.priceCents)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", st === "out" && "text-destructive", st === "low" && "text-warn-fg")}>
                          {item.stock.toLocaleString("en-KE")}
                        </TableCell>
                        <TableCell className="text-right">{item.schoolListCount}</TableCell>
                        <TableCell><ItemBadge item={item} st={st} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`}>
                            <Pencil aria-hidden /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="flex flex-col gap-3 md:hidden">
              {shown.map((item) => {
                const st = stockState(item)
                return (
                  <li key={item.id} className="flex flex-col gap-3 rounded-2xl border p-4">
                    <div className="flex items-start gap-3">
                      <Cover item={item} />
                      <span className="flex min-w-0 grow flex-col">
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-[13px] text-muted-foreground">{item.gradeLabel} · {item.format}</span>
                        {item.review?.note && <span className="text-[13px] text-warn-fg">SchoolShop: {item.review.note}</span>}
                      </span>
                      <ItemBadge item={item} st={st} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div><dt className="text-muted-foreground">Price</dt><dd className="font-semibold">{formatKes(item.priceCents)}</dd></div>
                      <div><dt className="text-muted-foreground">In stock</dt><dd className={cn("font-semibold", st === "out" && "text-destructive", st === "low" && "text-warn-fg")}>{item.stock.toLocaleString("en-KE")}</dd></div>
                      <div><dt className="text-muted-foreground">On lists</dt><dd className="font-semibold">{item.schoolListCount}</dd></div>
                    </dl>
                    <Button variant="outline" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`}>
                      <Pencil aria-hidden /> Edit
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <TitleSheet editing={editing} onClose={() => setEditing(null)} onCreated={setEditing} />
    </>
  )
}

function Cover({ item }: { item: CatalogItem }) {
  if (item.coverUrl) return <img src={item.coverUrl} alt="" className="h-12 w-9 shrink-0 rounded-md border object-cover" />
  const tone = coverTones[[...item.subject].reduce((s, ch) => s + ch.charCodeAt(0), 0) % coverTones.length]
  return <span aria-hidden className={cn("h-12 w-9 shrink-0 rounded-md", tone)} />
}

/* ── Add / edit sheet ────────────────────────────────────────── */

const isbnSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^(97[89]\d{10}|\d{9}[\dX])$/.test(v.replace(/[-\s]/g, "")), "Enter a 13-digit ISBN, like 978-9966-36-412-8")

const wholeNumber = z.string().trim().regex(/^\d+$/, "Enter a whole number, 0 or more")

const titleSchema = z.object({
  title: z.string().trim().min(3, "Enter the title as it appears on the cover"),
  subject: z.string().trim().min(2, "Enter the subject"),
  gradeLabel: z.string().min(1, "Choose a grade"),
  isbn: isbnSchema,
  format: z.string().min(1),
  price: z.string().trim().regex(/^[1-9]\d*$/, "Enter a price in whole shillings"),
  stock: wholeNumber,
  lowStockAt: wholeNumber,
  visible: z.boolean(),
})
type TitleValues = z.infer<typeof titleSchema>

function toValues(item: CatalogItem | null): TitleValues {
  return item
    ? {
        title: item.title,
        subject: item.subject,
        gradeLabel: item.gradeLabel,
        isbn: item.isbn ?? "",
        format: item.format,
        price: String(item.priceCents / 100),
        stock: String(item.stock),
        lowStockAt: String(item.lowStockAt),
        visible: item.status === "live",
      }
    : { title: "", subject: "", gradeLabel: "", isbn: "", format: formats[0], price: "", stock: "0", lowStockAt: "100", visible: true }
}

function TitleSheet({ editing, onClose, onCreated }: { editing: CatalogItem | "new" | null; onClose: () => void; onCreated: (item: CatalogItem) => void }) {
  const item = editing && editing !== "new" ? editing : null
  return (
    <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface outline-none",
            "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-3xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 md:data-[state=open]:slide-in-from-right-8"
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-surface px-6 py-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-xl font-semibold">{item ? "Edit product" : "Add a product"}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {item ? `On ${plural(item.schoolListCount, "school list")}.` : "Schools can add it to their booklists once it's live."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button>
            </Dialog.Close>
          </div>
          {editing !== null && <TitleForm key={item?.id ?? "new"} item={item} onDone={onClose} onCreated={onCreated} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TitleForm({ item, onDone, onCreated }: { item: CatalogItem | null; onDone: () => void; onCreated: (item: CatalogItem) => void }) {
  const form = useForm<TitleValues>({ resolver: zodResolver(titleSchema), defaultValues: toValues(item) })
  const save = useSaveCatalogItem()

  const submit = form.handleSubmit((v) => {
    const input: CatalogItemInput = {
      title: v.title,
      subject: v.subject,
      gradeLabel: v.gradeLabel,
      gradeBand: bandFor(v.gradeLabel),
      isbn: v.isbn ? v.isbn : null,
      format: v.format,
      priceCents: Number(v.price) * 100,
      stock: Number(v.stock),
      lowStockAt: Number(v.lowStockAt),
      status: v.visible ? "live" : "draft",
    }
    save.mutate(
      { id: item?.id, input },
      {
        onSuccess: (saved) => (item ? onDone() : onCreated(saved)),
        onError: (e) => {
          const fields = e instanceof ApiError ? e.fieldErrors : {}
          if (fields.isbn) form.setError("isbn", { message: fields.isbn[0] })
          else form.setError("root", { message: e.message })
        },
      }
    )
  })

  return (
    <Form {...form}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-6 py-5">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="subject" render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl><Input placeholder="e.g. Mathematics" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="gradeLabel" render={({ field }) => (
            <FormItem>
              <FormLabel>Grade</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  <option value="" disabled>Choose…</option>
                  {grades.map(([label]) => <option key={label}>{label}</option>)}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="isbn" render={({ field }) => (
            <FormItem>
              <FormLabel>ISBN <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
              <FormControl><Input inputMode="numeric" placeholder="978-…" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="format" render={({ field }) => (
            <FormItem>
              <FormLabel>Format</FormLabel>
              <FormControl>
                <NativeSelect {...field}>{formats.map((f) => <option key={f}>{f}</option>)}</NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="price" render={({ field }) => (
            <FormItem>
              <FormLabel>Price (KES)</FormLabel>
              <FormControl><Input inputMode="numeric" {...field} /></FormControl>
              <FormDescription>What parents pay. No delivery fee is added.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="stock" render={({ field }) => (
            <FormItem>
              <FormLabel>In stock</FormLabel>
              <FormControl><Input inputMode="numeric" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="lowStockAt" render={({ field }) => (
          <FormItem>
            <FormLabel>Low-stock alert at</FormLabel>
            <FormControl><Input inputMode="numeric" className="sm:w-1/2" {...field} /></FormControl>
            <FormDescription>The title is flagged when stock falls to this number.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="visible" render={({ field }) => (
          <FormItem>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5">
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} className="mt-0.5 size-5 accent-[var(--teal)]" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">Live</span>
                <span className="text-sm text-muted-foreground">Schools can find it and add it to booklists. Anything new goes live once SchoolShop has checked it, usually within a working day. Untick to keep it as a draft.</span>
              </span>
            </label>
          </FormItem>
        )} />
        {item ? (
          <TitleUploads itemId={item.id} />
        ) : (
          <p className="text-sm text-muted-foreground">After you add the product you can upload its cover, documents for SchoolShop's review, and digital resources.</p>
        )}
        {form.formState.errors.root && (
          <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
        )}
        <div className="sticky bottom-0 -mx-6 mt-2 flex gap-3 border-t bg-surface px-6 py-4">
          <Dialog.Close asChild>
            <Button type="button" variant="outline" size="lg" className="grow">Cancel</Button>
          </Dialog.Close>
          <Button type="submit" size="lg" className="grow" disabled={save.isPending}>
            {save.isPending ? "Saving…" : item ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/* ── Price list upload ───────────────────────────────────────── */

const templateCsv =
  "title,subject,grade,isbn,price,stock\n" +
  "Mathematics Activities Grade 5,Mathematics,Grade 5,978-9966-36-470-8,650,500\n" +
  '"Exercise books, 96 pages (×10)",Stationery,All grades,,550,1000\n'

/**
 * Adds titles from a CSV price list (columns: title, subject, grade, isbn,
 * price, stock). SchoolShop checks the whole file first and shows any problem
 * rows; the good rows are then added as drafts so the publisher can review them.
 */
function PriceListUpload() {
  const input = useRef<HTMLInputElement>(null)
  const run = useImportPriceList()
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<CatalogImportResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setFile(null)
    setCheck(null)
    setError(null)
  }
  const onFile = (f: File) => {
    setMessage(null)
    setError(null)
    setFile(f)
    run.mutate({ file: f, dryRun: true }, { onSuccess: setCheck, onError: (e) => setError(errorOf(e)) })
  }
  const importRows = () => {
    if (!file) return
    run.mutate(
      { file, dryRun: false },
      {
        onSuccess: (r) => {
          setMessage(`Added ${plural(r.created, "title")} as drafts${r.errors.length ? `, skipped ${plural(new Set(r.errors.map((x) => x.line)).size, "row")}` : ""}.`)
          close()
        },
        onError: (e) => setError(errorOf(e)),
      }
    )
  }
  const badRows = check ? new Set(check.errors.map((x) => x.line)).size : 0

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (f) onFile(f)
        }}
      />
      <Button variant="outline" onClick={() => input.current?.click()} disabled={run.isPending}>
        <Upload aria-hidden /> {run.isPending && !check ? "Checking…" : "Upload price list"}
      </Button>
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
        download="schoolshop-price-list.csv"
        className="text-xs font-semibold text-accent-text hover:underline"
      >
        Download CSV template
      </a>
      {message && <p role="status" className="max-w-xs text-right text-xs text-muted-foreground">{message}</p>}
      {error && !file && <p role="alert" className="max-w-xs text-right text-xs text-destructive">{error}</p>}

      <Dialog.Root open={file !== null && (check !== null || error !== null)} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 outline-none">
            <Dialog.Title className="font-display text-xl font-semibold">{file?.name}</Dialog.Title>
            {check && (
              <Dialog.Description className="text-sm text-muted-foreground">
                {check.valid > 0 ? `${plural(check.valid, "title")} ready to add as drafts.` : "No titles in this file can be added yet."}
                {badRows > 0 && ` ${plural(badRows, "row")} ${badRows === 1 ? "has" : "have"} a problem and will be skipped. Fix ${badRows === 1 ? "it" : "them"} and upload the file again to add ${badRows === 1 ? "it" : "them"} too.`}
              </Dialog.Description>
            )}
            {check && check.errors.length > 0 && (
              <ul className="divide-y rounded-xl border text-sm">
                {check.errors.map((x, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2.5">
                    <span className="shrink-0 font-semibold">Row {x.line}</span>
                    <span className="text-muted-foreground">{x.message}</span>
                  </li>
                ))}
              </ul>
            )}
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <Button variant="outline" className="grow">Cancel</Button>
              </Dialog.Close>
              {check && check.valid > 0 && (
                <Button className="grow" onClick={importRows} disabled={run.isPending}>
                  {run.isPending ? "Adding…" : `Add ${plural(check.valid, "product")}`}
                </Button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

const errorOf = (e: unknown) => (e instanceof ApiError ? (e.fieldErrors.file?.[0] ?? e.message) : "Something went wrong.")
