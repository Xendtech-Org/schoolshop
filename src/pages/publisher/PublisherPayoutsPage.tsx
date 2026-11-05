import { useState, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "radix-ui"
import { AlertTriangle, BadgeCheck, Clock, Download, Landmark, Smartphone, X } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { usePublisherPayouts, useUpdatePayoutAccount } from "@/lib/api/queries"
import type { Payout, PayoutAccount, PublisherPayouts } from "@/lib/api/schemas"
import { formatDay, formatKes } from "@/lib/format"
import { cn } from "@/lib/utils"

type Status = Payout["status"]

const statusMeta: Record<Status, { label: string; variant: "info" | "warning" | "success" | "secondary" }> = {
  held: { label: "On the way", variant: "secondary" },
  on_hold: { label: "On hold", variant: "warning" },
  queued: { label: "Queued", variant: "info" },
  processing: { label: "Processing", variant: "info" },
  paid: { label: "Paid", variant: "success" },
}

const filters: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "All" },
  { id: "queued", label: "Queued" },
  { id: "processing", label: "Processing" },
  { id: "on_hold", label: "On hold" },
  { id: "held", label: "On the way" },
  { id: "paid", label: "Paid" },
]

const methodLabel: Record<PayoutAccount["method"], string> = {
  mpesa_paybill: "M-Pesa Paybill",
  mpesa_till: "M-Pesa Till",
  mpesa_mobile: "M-Pesa mobile",
  bank: "Bank transfer",
}

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`
const sum = (list: Payout[], key: "netCents" | "grossCents" | "commissionCents") => list.reduce((s, p) => s + p[key], 0)

export function PublisherPayoutsPage() {
  const payouts = usePublisherPayouts()
  return <QueryBoundary query={payouts}>{(data) => <Payouts data={data} />}</QueryBoundary>
}

function Payouts({ data }: { data: PublisherPayouts }) {
  const [filter, setFilter] = useState<"all" | Status>("all")
  const [open, setOpen] = useState<Payout | null>(null)
  const [editingAccount, setEditingAccount] = useState(false)
  const { payouts, account, commissionRate } = data

  const by = (s: Status) => payouts.filter((p) => p.status === s)
  const shown = filter === "all" ? payouts : by(filter)
  const terms = [...new Set(shown.map((p) => p.termName))]

  return (
    <>
      <PageHeader
        eyebrow="Paid per school once the school confirms the delivery"
        title="Payouts"
        actions={
          <Button variant="outline" onClick={() => downloadStatement(payouts, commissionRate)}>
            <Download aria-hidden /> Download statement
          </Button>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Paid out" value={formatKes(sum(by("paid"), "netCents"))} hint={`${by("paid").length} payouts`} />
        <StatCard label="Queued" value={formatKes(sum(by("queued"), "netCents"))} hint="Ready for release" />
        <StatCard label="Processing" value={formatKes(sum(by("processing"), "netCents"))} hint="Waiting for M-Pesa confirmation" />
        <StatCard label="On hold" value={formatKes(sum(by("on_hold"), "netCents"))} hint="A school flagged an issue" />
        <StatCard label="On the way" value={formatKes(sum(by("held"), "netCents"))} hint="Released when the school confirms" />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <AccountCard account={account} onChange={() => setEditingAccount(true)} />
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">How a payout is worked out</h2>
          <dl className="flex flex-col gap-2">
            <div className="flex justify-between gap-3"><dt>Sales to parents</dt><dd className="font-semibold">Gross</dd></div>
            <div className="flex justify-between gap-3 text-muted-foreground"><dt>SchoolShop commission</dt><dd>−{pct(commissionRate)}</dd></div>
            <div className="flex justify-between gap-3 text-muted-foreground"><dt>Refunds for short or damaged items</dt><dd>−Deductions</dd></div>
            <div className="flex justify-between gap-3 border-t pt-2"><dt className="font-semibold">Paid to you</dt><dd className="font-semibold">Net</dd></div>
          </dl>
          <p className="leading-relaxed text-muted-foreground">
            Titles you marked as unavailable before dispatch are never charged to parents, so they aren't in the gross.
          </p>
        </div>
      </div>

      <section aria-label="Payouts" className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
        <div role="group" aria-label="Status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {filters.map((f) => {
            const count = f.id === "all" ? payouts.length : by(f.id).length
            return (
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
                <span className={cn("rounded-full px-1.5 text-xs", filter === f.id ? "bg-white/20" : "bg-secondary")}>{count}</span>
              </button>
            )
          })}
        </div>

        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">No payouts here.</p>
        )}

        {terms.map((term) => {
          const rows = shown.filter((p) => p.termName === term)
          return (
            <div key={term} className="flex flex-col gap-2">
              <h2 className="text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{term}</h2>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead><span className="sr-only">Details</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="flex flex-col">
                            <span className="font-semibold">{p.schoolName}</span>
                            <span className="text-[13px] text-muted-foreground">{p.town} · {p.deliveryNoteNo}</span>
                          </span>
                        </TableCell>
                        <TableCell>{p.receivedAt ? formatDay(p.receivedAt) : "—"}</TableCell>
                        <TableCell className="text-right">{formatKes(p.grossCents)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">−{formatKes(p.commissionCents)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.deductionsCents ? `−${formatKes(p.deductionsCents)}` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{formatKes(p.netCents)}</TableCell>
                        <TableCell><Badge variant={statusMeta[p.status].variant}>{statusMeta[p.status].label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setOpen(p)} aria-label={`Details for ${p.schoolName}`}>Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden">
                {rows.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setOpen(p)} className="flex w-full flex-col gap-3 rounded-2xl border p-4 text-left hover:bg-paper">
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{p.schoolName}</span>
                          <span className="text-[13px] text-muted-foreground">{p.deliveryNoteNo} · {p.receivedAt ? `received ${formatDay(p.receivedAt)}` : "not yet received"}</span>
                        </span>
                        <Badge variant={statusMeta[p.status].variant}>{statusMeta[p.status].label}</Badge>
                      </span>
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Gross {formatKes(p.grossCents)}</span>
                        <span className="font-display text-lg font-semibold">{formatKes(p.netCents)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <PayoutDetails payout={open} rate={commissionRate} account={account} onClose={() => setOpen(null)} />
      <AccountSheet open={editingAccount} account={account} onClose={() => setEditingAccount(false)} />
    </>
  )
}

function AccountCard({ account, onChange }: { account: PayoutAccount; onChange: () => void }) {
  const Icon = account.method === "bank" ? Landmark : Smartphone
  return (
    <section aria-labelledby="acct-h" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="acct-h" className="text-base font-semibold">Payout account</h2>
        {account.status === "verified" ? (
          <Badge variant="success"><BadgeCheck aria-hidden /> Verified</Badge>
        ) : (
          <Badge variant="warning"><Clock aria-hidden /> Being checked</Badge>
        )}
      </div>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-light">
          <Icon className="size-5 text-accent-text" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{methodLabel[account.method]}</span>
          <span className="text-sm break-words text-muted-foreground">{account.masked}</span>
          <span className="text-sm text-muted-foreground">{account.accountName}</span>
        </span>
      </div>
      {account.status === "pending_verification" && (
        <p className="text-sm text-warn-fg">Payouts keep going to your previous account until SchoolShop has checked the new one.</p>
      )}
      <Button variant="outline" onClick={onChange}>Change payout account</Button>
    </section>
  )
}

/* ── Statement details ───────────────────────────────────────── */

function Sheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface outline-none",
            "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-3xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 md:data-[state=open]:slide-in-from-right-8"
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-surface px-6 py-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-xl font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden /></Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PayoutDetails({ payout: p, rate, account, onClose }: { payout: Payout | null; rate: number; account: PayoutAccount; onClose: () => void }) {
  const steps: { label: string; done: boolean; when?: string }[] = p
    ? [
        { label: "Delivered and confirmed by the school", done: !!p.receivedAt, when: p.receivedAt ? formatDay(p.receivedAt) : undefined },
        { label: p.status === "on_hold" ? "Waiting for the issue to be resolved" : "Approved for payout", done: p.status === "queued" || p.status === "processing" || p.status === "paid" },
        { label: `Sent to your ${methodLabel[account.method]}`, done: p.status === "paid", when: p.paidAt ? formatDay(p.paidAt) : undefined },
      ]
    : []
  return (
    <Sheet open={p !== null} onClose={onClose} title={p?.schoolName ?? ""} description={p ? `${p.town} · delivery note ${p.deliveryNoteNo} · ${p.termName}` : ""}>
      {p && (
        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-[32px] leading-none font-semibold">{formatKes(p.netCents)}</span>
            <Badge variant={statusMeta[p.status].variant}>{statusMeta[p.status].label}</Badge>
          </div>
          <dl className="flex flex-col divide-y rounded-2xl border text-[15px]">
            <div className="flex justify-between gap-3 px-4 py-3"><dt>Sales to parents</dt><dd className="font-semibold">{formatKes(p.grossCents)}</dd></div>
            <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-muted-foreground">Commission ({pct(rate)})</dt><dd>−{formatKes(p.commissionCents)}</dd></div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Deductions</dt><dd>{p.deductionsCents ? `−${formatKes(p.deductionsCents)}` : "None"}</dd></div>
              {p.deductionNote && <p className="text-sm text-muted-foreground">{p.deductionNote}</p>}
            </div>
            <div className="flex justify-between gap-3 bg-paper px-4 py-3"><dt className="font-semibold">Paid to you</dt><dd className="font-semibold">{formatKes(p.netCents)}</dd></div>
          </dl>
          {p.status === "on_hold" && (
            <p className="flex items-start gap-2.5 rounded-xl bg-warn-bg p-3.5 text-sm text-warn-fg">
              <AlertTriangle className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              The school reported a problem with this delivery. SchoolShop will contact you, and the payout is released once it's resolved.
            </p>
          )}
          {p.status === "processing" && (
            <p className="rounded-xl bg-info-bg p-3.5 text-sm">
              SasaPay is processing this automatic payout. It will show as paid after M-Pesa confirms the transfer.
            </p>
          )}
          <ol className="flex flex-col gap-3" aria-label="Progress">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-3 text-[15px]">
                <span aria-hidden className={cn("mt-1 size-3 shrink-0 rounded-full", s.done ? "bg-primary" : "border-2 border-line-strong")} />
                <span className="flex grow justify-between gap-3">
                  <span className={s.done ? "font-semibold" : "text-muted-foreground"}>
                    {s.label}<span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span>
                  </span>
                  {s.when && <span className="text-muted-foreground">{s.when}</span>}
                </span>
              </li>
            ))}
          </ol>
          {p.reference && (
            <p className="text-sm text-muted-foreground">
              Transaction reference <span className="font-mono font-semibold text-ink">{p.reference}</span>
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}

/* ── Change payout account ───────────────────────────────────── */

const accountSchema = z
  .object({
    method: z.enum(["mpesa_paybill", "mpesa_till", "mpesa_mobile", "bank"]),
    accountName: z.string().trim().min(3, "Enter the registered account name"),
    number: z.string().trim(),
    reference: z.string().trim(),
  })
  .refine((v) => v.method === "mpesa_till" || v.method === "mpesa_mobile" || v.reference.length >= 2, {
    path: ["reference"],
    message: "This is required",
  })
  .refine((v) => v.method === "mpesa_mobile" ? /^(?:\+?254|0)?[17]\d{8}$/.test(v.number) : /^\d{5,16}$/.test(v.number), {
    path: ["number"],
    message: "Enter a valid Kenyan mobile number, e.g. 0712345678",
  })
type AccountValues = z.infer<typeof accountSchema>

const methodFields: Record<AccountValues["method"], { number: string; reference: string | null; hint: string }> = {
  mpesa_paybill: { number: "Paybill number", reference: "Account number", hint: "We pay by M-Pesa B2B to your Paybill." },
  mpesa_till: { number: "Till number", reference: null, hint: "We pay by M-Pesa B2B to your Buy Goods till." },
  mpesa_mobile: { number: "M-Pesa mobile number", reference: null, hint: "Eligible verified mobile accounts can receive automatic payouts through SasaPay." },
  bank: { number: "Account number", reference: "Bank and branch", hint: "Bank transfers can take a working day longer." },
}

function AccountSheet({ open, account, onClose }: { open: boolean; account: PayoutAccount; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change payout account" description="SchoolShop checks new details before using them. Payouts keep going to the current account until then.">
      {open && <AccountForm account={account} onDone={onClose} />}
    </Sheet>
  )
}

function AccountForm({ account, onDone }: { account: PayoutAccount; onDone: () => void }) {
  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { method: account.method, accountName: account.accountName, number: "", reference: "" },
  })
  const method = useWatch({ control: form.control, name: "method" })
  const fields = methodFields[method]
  const save = useUpdatePayoutAccount()

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-4 px-6 py-5"
        onSubmit={form.handleSubmit((v) =>
          save.mutate(v, {
            onSuccess: onDone,
            onError: (e) => {
              const f = e instanceof ApiError ? e.fieldErrors : {}
              form.setError(f.number ? "number" : "root", { message: f.number?.[0] ?? e.message })
            },
          })
        )}
      >
        <FormField control={form.control} name="method" render={({ field }) => (
          <FormItem>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Pay me by</legend>
              {(Object.keys(methodLabel) as AccountValues["method"][]).map((m) => (
                <label key={m} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5", field.value === m && "border-2 border-primary bg-teal-light")}>
                  <input type="radio" name={field.name} value={m} checked={field.value === m} onChange={() => field.onChange(m)} className="size-4.5 accent-[var(--teal)]" />
                  <span className="font-semibold">{methodLabel[m]}</span>
                </label>
              ))}
            </fieldset>
            <FormDescription>{fields.hint}</FormDescription>
          </FormItem>
        )} />
        <FormField control={form.control} name="accountName" render={({ field }) => (
          <FormItem>
            <FormLabel>Registered name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormDescription>Must match your company name with Safaricom or the bank.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="number" render={({ field }) => (
          <FormItem>
            <FormLabel>{fields.number}</FormLabel>
            <FormControl><Input inputMode="numeric" autoComplete="off" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {fields.reference && (
          <FormField control={form.control} name="reference" render={({ field }) => (
            <FormItem>
              <FormLabel>{fields.reference}</FormLabel>
              <FormControl><Input autoComplete="off" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {form.formState.errors.root && <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>}
        <div className="sticky bottom-0 -mx-6 mt-2 flex gap-3 border-t bg-surface px-6 py-4">
          <Dialog.Close asChild>
            <Button type="button" variant="outline" size="lg" className="grow">Cancel</Button>
          </Dialog.Close>
          <Button type="submit" size="lg" className="grow" disabled={save.isPending}>{save.isPending ? "Sending…" : "Send for checking"}</Button>
        </div>
      </form>
    </Form>
  )
}

/* ── CSV statement ───────────────────────────────────────────── */

function downloadStatement(payouts: Payout[], rate: number) {
  const kes = (c: number) => (c / 100).toFixed(2)
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const header = ["Term", "School", "Town", "Delivery note", "Received", "Gross (KES)", `Commission ${pct(rate)} (KES)`, "Deductions (KES)", "Deduction note", "Net (KES)", "Status", "Paid on", "Reference"]
  const rows = payouts.map((p) => [
    p.termName, p.schoolName, p.town, p.deliveryNoteNo, p.receivedAt?.slice(0, 10) ?? "", kes(p.grossCents), kes(p.commissionCents),
    kes(p.deductionsCents), p.deductionNote ?? "", kes(p.netCents), statusMeta[p.status].label, p.paidAt?.slice(0, 10) ?? "", p.reference ?? "",
  ])
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "schoolshop-payouts.csv"
  a.click()
  URL.revokeObjectURL(url)
}
