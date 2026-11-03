import { useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useSearchParams } from "react-router"
import { Dialog } from "radix-ui"
import { AlertTriangle, CalendarClock, CheckCircle2, PackageCheck, Phone, Truck, X } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { ApiError } from "@/lib/api/client"
import { useDispatchBatch, usePublisherBatches } from "@/lib/api/queries"
import type { SchoolBatch } from "@/lib/api/schemas"
import { formatDay, formatKes, normaliseKenyanPhone } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tab = "ready" | "transit" | "delivered"

const tabs: { id: Tab; label: string }[] = [
  { id: "ready", label: "Ready to dispatch" },
  { id: "transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
]

const carriers = ["Own vehicle", "G4S Courier", "Wells Fargo", "Sendy", "Other courier"]
/** 254711222333 → "0711 222 333" */
const localPhone = (e164: string) => e164.replace(/^254(\d{3})(\d{3})(\d{3})$/, "0$1 $2 $3")
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const dayTime = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export function PublisherDispatchesPage() {
  const batches = usePublisherBatches()
  return (
    <>
      <PageHeader eyebrow="One delivery per school. Payout is released when the school confirms receipt." title="Dispatches" />
      <QueryBoundary query={batches}>{(data) => <Dispatches batches={data} />}</QueryBoundary>
    </>
  )
}

function Dispatches({ batches }: { batches: SchoolBatch[] }) {
  const [params, setParams] = useSearchParams()
  const tab = (params.get("tab") as Tab | null) ?? "ready"
  const [dispatching, setDispatching] = useState<SchoolBatch | null>(
    () => batches.find((b) => b.id === params.get("batch") && b.status === "ready_to_pack") ?? null
  )
  const [justSent, setJustSent] = useState<string | null>(null)

  const ready = batches.filter((b) => b.status === "ready_to_pack").sort((a, b) => a.dueAtSchool.localeCompare(b.dueAtSchool))
  const transit = batches.filter((b) => b.status === "dispatched")
  const delivered = batches.filter((b) => b.status === "received")
  const pendingPayout = transit.reduce((s, b) => s + b.valueCents, 0) + delivered.filter((b) => b.receipt?.payout === "queued").reduce((s, b) => s + b.valueCents, 0)
  const lists: Record<Tab, SchoolBatch[]> = { ready, transit, delivered }
  const setTab = (t: Tab) => setParams(t === "ready" ? {} : { tab: t }, { replace: true })

  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ready to dispatch" value={plural(ready.length, "school")} hint={`${ready.reduce((s, b) => s + b.packs, 0)} packs`} />
        <StatCard label="In transit" value={plural(transit.length, "school")} hint="Waiting for the school to confirm" />
        <StatCard label="Delivered" value={plural(delivered.length, "school")} hint={`${delivered.filter((b) => b.receipt?.issue).length} with an issue`} />
        <StatCard label="Payout pending" value={formatKes(pendingPayout)} hint="Released on confirmed receipt" />
      </section>

      {justSent && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-success-bg p-4 text-success-fg">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="grow text-[15px]">{justSent}</p>
          <button type="button" onClick={() => setJustSent(null)} aria-label="Dismiss" className="-m-2 flex size-10 items-center justify-center rounded-lg hover:bg-white/50">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Dispatch status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap",
              tab === t.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper"
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", tab === t.id ? "bg-white/20" : "bg-secondary")}>{lists[t.id].length}</span>
          </button>
        ))}
      </div>

      <section id={`panel-${tab}`} role="tabpanel" aria-label={tabs.find((t) => t.id === tab)?.label} className="flex flex-col gap-3">
        {lists[tab].length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">
            {tab === "ready" ? "Nothing to dispatch. Schools appear here after their order deadline." : tab === "transit" ? "No deliveries on the road." : "No deliveries confirmed yet."}
          </div>
        )}
        {tab === "ready" && ready.map((b) => <ReadyCard key={b.id} batch={b} onDispatch={() => setDispatching(b)} />)}
        {tab === "transit" && transit.map((b) => <TransitCard key={b.id} batch={b} />)}
        {tab === "delivered" && delivered.map((b) => <DeliveredCard key={b.id} batch={b} />)}
      </section>

      <DispatchSheet
        batch={dispatching}
        onClose={() => setDispatching(null)}
        onDone={(b) => {
          setDispatching(null)
          setJustSent(`${b.schoolName} dispatched with delivery note ${b.dispatch?.deliveryNoteNo}. The school has been told to expect it on ${b.dispatch ? formatDay(b.dispatch.expectedAt) : "the date you set"}.`)
          setTab("transit")
        }}
      />
    </>
  )
}

function SchoolTitle({ batch, children }: { batch: SchoolBatch; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[17px] font-semibold">{batch.schoolName}</span>
        <span className="text-sm text-muted-foreground">
          {batch.town} · {batch.packs} packs · {formatKes(batch.valueCents)}
        </span>
      </div>
      {children}
    </div>
  )
}

function ReadyCard({ batch, onDispatch }: { batch: SchoolBatch; onDispatch: () => void }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
      <SchoolTitle batch={batch}>
        <span className="flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1 text-xs font-bold text-warn-fg">
          <CalendarClock className="size-3.5" aria-hidden /> Due at school {formatDay(batch.dueAtSchool)}
        </span>
      </SchoolTitle>
      <ul className="grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-2">
        {batch.lines.map((l) => (
          <li key={l.title} className="flex justify-between gap-3 border-b border-secondary py-1.5">
            <span className="min-w-0">{l.title}</span>
            <span className="font-semibold">× {l.qty}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={onDispatch}>
          <Truck aria-hidden /> Dispatch
        </Button>
        <Button asChild variant="outline">
          <Link to="/publisher/orders">Pick list &amp; labels</Link>
        </Button>
      </div>
    </article>
  )
}

function TransitCard({ batch }: { batch: SchoolBatch }) {
  const d = batch.dispatch
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
      <SchoolTitle batch={batch}>
        <Badge variant="info">Awaiting school confirmation</Badge>
      </SchoolTitle>
      {d && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
          <Fact label="Delivery note" value={d.deliveryNoteNo} />
          <Fact label="Carrier" value={`${d.carrier} · ${d.vehicleReg}`} />
          <Fact
            label="Driver"
            value={
              <a href={`tel:+${d.driverPhone}`} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {d.driverName}, {localPhone(d.driverPhone)}
              </a>
            }
          />
          <Fact label="Dispatched → expected" value={`${dayTime.format(new Date(d.dispatchedAt))} → ${formatDay(d.expectedAt)}`} />
        </dl>
      )}
      <Steps reached={1} />
      {batch.unavailableLines.length > 0 && <Unavailable lines={batch.unavailableLines} />}
    </article>
  )
}

function DeliveredCard({ batch }: { batch: SchoolBatch }) {
  const r = batch.receipt
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
      <SchoolTitle batch={batch}>
        {r?.payout === "paid" ? <Badge variant="success">Payout sent</Badge> : <Badge variant="warning">Payout queued</Badge>}
      </SchoolTitle>
      {r && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
          <Fact label="Received" value={dayTime.format(new Date(r.receivedAt))} />
          <Fact label="Signed for by" value={r.receivedBy} />
          <Fact label="Delivery note" value={batch.dispatch?.deliveryNoteNo ?? "—"} />
          <Fact label="Cartons" value={String(batch.dispatch?.cartons ?? "—")} />
        </dl>
      )}
      <Steps reached={r?.payout === "paid" ? 3 : 2} />
      {r?.issue && (
        <p className="flex items-start gap-2.5 rounded-xl bg-warn-bg p-3.5 text-sm text-warn-fg">
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          <span><span className="font-semibold">School flagged: </span>{r.issue}. SchoolShop will contact you to resolve it before the payout.</span>
        </p>
      )}
      {batch.unavailableLines.length > 0 && <Unavailable lines={batch.unavailableLines} />}
    </article>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold break-words">{value}</dd>
    </div>
  )
}

/** Packed → Dispatched → Received → Paid, with `reached` the index of the last step done. */
function Steps({ reached }: { reached: number }) {
  const steps = ["Packed", "Dispatched", "Received", "Paid out"]
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-col gap-1.5">
          <span className={cn("h-1.5 rounded-full", i <= reached ? "bg-primary" : "bg-secondary")} />
          <span className={cn("text-xs", i <= reached ? "font-semibold text-ink" : "text-muted-foreground")}>
            {s}
            <span className="sr-only">{i <= reached ? " (done)" : " (not yet)"}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Unavailable({ lines }: { lines: string[] }) {
  return (
    <p className="text-sm text-muted-foreground">
      Not supplied, parents refunded: <span className="font-semibold text-ink">{lines.join(", ")}</span>
    </p>
  )
}

/* ── Dispatch sheet ──────────────────────────────────────────── */

const todayIso = () => new Date().toISOString().slice(0, 10)

const dispatchSchema = z.object({
  carrier: z.string().min(1),
  driverName: z.string().trim().min(2, "Enter the driver's name"),
  driverPhone: z.string().trim().refine((v) => normaliseKenyanPhone(v) !== null, "Enter a Kenyan mobile number, like 0711 222 333"),
  vehicleReg: z.string().trim().regex(/^K[A-Z]{2}\s?\d{3}[A-Z]?$/i, "Enter a Kenyan plate, like KDA 412K"),
  cartons: z.string().trim().regex(/^[1-9]\d*$/, "Enter how many cartons"),
  expectedAt: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= todayIso(), "Choose today or a later date"),
  unavailable: z.array(z.string()),
})
type DispatchValues = z.infer<typeof dispatchSchema>

function DispatchSheet({ batch, onClose, onDone }: { batch: SchoolBatch | null; onClose: () => void; onDone: (b: SchoolBatch) => void }) {
  return (
    <Dialog.Root open={batch !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface outline-none",
            "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[500px] md:rounded-none md:rounded-l-3xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 md:data-[state=open]:slide-in-from-right-8"
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-surface px-6 py-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-xl font-semibold">Dispatch to {batch?.schoolName}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {batch ? `${batch.packs} packs, due at school ${formatDay(batch.dueAtSchool)}. The school gets an SMS to expect it.` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button>
            </Dialog.Close>
          </div>
          {batch && <DispatchForm key={batch.id} batch={batch} onDone={onDone} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DispatchForm({ batch, onDone }: { batch: SchoolBatch; onDone: (b: SchoolBatch) => void }) {
  const form = useForm<DispatchValues>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: { carrier: carriers[0], driverName: "", driverPhone: "", vehicleReg: "", cartons: "", expectedAt: batch.dueAtSchool, unavailable: [] },
  })
  const dispatch = useDispatchBatch()

  const submit = form.handleSubmit((v) =>
    dispatch.mutate(
      {
        id: batch.id,
        input: {
          carrier: v.carrier,
          driverName: v.driverName,
          driverPhone: normaliseKenyanPhone(v.driverPhone)!,
          vehicleReg: v.vehicleReg.toUpperCase().replace(/^(K[A-Z]{2})\s?/, "$1 "),
          cartons: Number(v.cartons),
          expectedAt: v.expectedAt,
          unavailableLines: v.unavailable,
        },
      },
      {
        onSuccess: onDone,
        onError: (e) => {
          const fields = e instanceof ApiError ? e.fieldErrors : {}
          form.setError(fields.unavailableLines ? "unavailable" : "root", { message: fields.unavailableLines?.[0] ?? e.message })
        },
      }
    )
  )

  return (
    <Form {...form}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-6 py-5">
        <FormField control={form.control} name="carrier" render={({ field }) => (
          <FormItem>
            <FormLabel>Carrier</FormLabel>
            <FormControl>
              <NativeSelect {...field}>{carriers.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="driverName" render={({ field }) => (
            <FormItem>
              <FormLabel>Driver's name</FormLabel>
              <FormControl><Input autoComplete="off" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="driverPhone" render={({ field }) => (
            <FormItem>
              <FormLabel>Driver's phone</FormLabel>
              <FormControl><Input type="tel" inputMode="tel" placeholder="0711 222 333" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="vehicleReg" render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle registration</FormLabel>
              <FormControl><Input placeholder="KDA 412K" autoCapitalize="characters" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="cartons" render={({ field }) => (
            <FormItem>
              <FormLabel>Cartons</FormLabel>
              <FormControl><Input inputMode="numeric" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="expectedAt" render={({ field }) => (
          <FormItem>
            <FormLabel>Expected at school</FormLabel>
            <FormControl><Input type="date" min={todayIso()} className="sm:w-1/2" {...field} /></FormControl>
            <FormDescription>The school is due its delivery by {formatDay(batch.dueAtSchool)}.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="unavailable" render={({ field }) => (
          <FormItem>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">What's in the delivery</legend>
              <p className="text-sm text-muted-foreground">Untick anything you can't supply. Parents are refunded for those items automatically.</p>
              <ul className="flex flex-col divide-y rounded-xl border">
                {batch.lines.map((l) => {
                  const included = !field.value.includes(l.title)
                  return (
                    <li key={l.title}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => field.onChange(included ? [...field.value, l.title] : field.value.filter((t) => t !== l.title))}
                          className="size-5 shrink-0 accent-[var(--teal)]"
                        />
                        <span className={cn("grow text-[15px]", !included && "text-muted-foreground line-through")}>{l.title}</span>
                        <span className="font-semibold">× {l.qty}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
            <FormMessage />
          </FormItem>
        )} />
        {form.formState.errors.root && (
          <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
        )}
        <div className="sticky bottom-0 -mx-6 mt-2 flex gap-3 border-t bg-surface px-6 py-4">
          <Dialog.Close asChild>
            <Button type="button" variant="outline" size="lg" className="grow">Cancel</Button>
          </Dialog.Close>
          <Button type="submit" size="lg" className="grow" disabled={dispatch.isPending}>
            <PackageCheck aria-hidden /> {dispatch.isPending ? "Dispatching…" : "Confirm dispatch"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
