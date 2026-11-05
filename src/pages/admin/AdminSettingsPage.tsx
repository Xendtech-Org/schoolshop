import { useState, type ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Saved, SectionChips, SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { NativeSelect } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiError } from "@/lib/api/client"
import { useAdminMoney, usePlatformSettings, useSavePlatformSettings } from "@/lib/api/queries"
import type { EmailInput, PaymentsInput, PlatformSettings, SettingsSection as Section } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { cn } from "@/lib/utils"

/*
 * How SchoolShop runs: what it charges publishers, when money moves, the
 * term calendar and how parents reach support. Only super admins change
 * these; every save is written to the audit log.
 */

const sections = [
  { id: "commission", label: "Commission" },
  { id: "payouts", label: "Payouts" },
  { id: "refunds", label: "Refunds" },
  { id: "mpesa", label: "M-Pesa" },
  { id: "payments", label: "Payment providers" },
  { id: "email", label: "Email delivery" },
  { id: "terms", label: "Term calendar" },
  { id: "support", label: "Parent support" },
]

const when = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
/** "8" ⇄ 0.08, keeping halves like 7.5. */
const toPct = (rate: number) => String(Math.round(rate * 1000) / 10)
const fromPct = (pct: string) => Math.round(Number(pct) * 10) / 1000
const validPct = (pct: string) => pct.trim() !== "" && Number.isFinite(Number(pct)) && Number(pct) >= 0 && Number(pct) <= 30

export function AdminSettingsPage() {
  const settings = usePlatformSettings()
  return (
    <>
      <PageHeader eyebrow="Changes apply straight away and are written to the audit log" title="Fees & settings" />
      <SectionChips sections={sections} />
      <QueryBoundary query={settings}>
        {(s) => (
          <div className="flex max-w-4xl flex-col gap-6">
            <CommissionSection s={s} />
            <PayoutsSection s={s} />
            <RefundsSection s={s} />
            <MpesaSection s={s} />
            <PaymentsSection s={s} />
            <EmailSection s={s} />
            <TermsSection s={s} />
            <SupportSection s={s} />
          </div>
        )}
      </QueryBoundary>
    </>
  )
}

/** Save and undo for one section, with who changed it last. */
function useSection<T>(section: Section, value: T) {
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  // A save elsewhere (or this one) refreshes the server copy: start again from it.
  if (shown !== value) { setShown(value); setDraft(value) }
  const save = useSavePlatformSettings()
  const dirty = JSON.stringify(draft) !== JSON.stringify(value)
  return { draft, setDraft, save, dirty, submit: (v: unknown) => save.mutate({ section, value: v }) }
}

/** invalid blocks saving; a refusal from the server is only shown, so the next edit can be saved. */
function Footer({ s, section, dirty, save, onSave, onUndo, invalid, fieldsShowErrors }: { s: PlatformSettings; section: Section; dirty: boolean; save: ReturnType<typeof useSavePlatformSettings>; onSave: () => void; onUndo: () => void; invalid?: string | null; fieldsShowErrors?: boolean }) {
  const updated = s.updated[section]
  const fieldError = save.error instanceof ApiError ? Object.values(save.error.fieldErrors)[0]?.[0] : undefined
  const error = invalid ?? (save.error && !(fieldsShowErrors && fieldError) ? (fieldError ?? errorText(save.error)) : null)
  return (
    <>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!dirty || save.isPending || !!invalid} onClick={onSave}>{save.isPending ? "Saving…" : "Save"}</Button>
        {dirty && <Button variant="ghost" onClick={onUndo}>Undo changes</Button>}
        <Saved show={save.isSuccess && !dirty} />
        {updated && <span className="ml-auto text-[13px] text-muted-foreground">Last changed {when(updated.at)} by {updated.by}</span>}
      </div>
    </>
  )
}

function Field({ id, label, hint, children, className }: { id: string; label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** A number input with a unit beside it, e.g. "% of the sale" or "days". */
function Unit({ unit, ...props }: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <span className="flex items-center gap-2">
      <Input inputMode="decimal" {...props} className={cn("w-28", props.className)} />
      <span className="text-sm text-muted-foreground">{unit}</span>
    </span>
  )
}

/* ── Commission ── */

type CommissionDraft = { defaultRate: string; overrides: { publisherId: string; rate: string; note: string }[] }
const commissionDraft = (c: PlatformSettings["commission"]): CommissionDraft => ({ defaultRate: toPct(c.defaultRate), overrides: c.overrides.map((o) => ({ publisherId: o.publisherId, rate: toPct(o.rate), note: o.note })) })

function CommissionSection({ s }: { s: PlatformSettings }) {
  const base = useStable(commissionDraft(s.commission))
  const { draft, setDraft, save, dirty, submit } = useSection("commission", base)
  const money = useAdminMoney()
  const name = (id: string) => s.publishers.find((p) => p.id === id)?.name ?? id
  const used = new Set(draft.overrides.map((o) => o.publisherId))
  const invalid =
    !validPct(draft.defaultRate) ? "The default commission must be between 0% and 30%."
    : draft.overrides.some((o) => !o.publisherId) ? "Choose a publisher for each rate."
    : draft.overrides.find((o) => !validPct(o.rate)) ? `${name(draft.overrides.find((o) => !validPct(o.rate))!.publisherId)}'s rate must be between 0% and 30%.`
    : draft.overrides.find((o) => !o.note.trim()) ? `Say why ${name(draft.overrides.find((o) => !o.note.trim())!.publisherId)} has its own rate.`
    : null
  const setOverride = (i: number, patch: Partial<CommissionDraft["overrides"][number]>) => setDraft({ ...draft, overrides: draft.overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)) })

  // What saving would do to payouts still waiting for delivery (the only ones a new rate touches).
  const rate = (id: string) => fromPct(draft.overrides.find((o) => o.publisherId === id)?.rate ?? draft.defaultRate)
  const waiting = invalid ? [] : (money.data?.payouts ?? []).filter((p) => p.status === "held").map((p) => ({ p, next: Math.round(p.grossCents * rate(p.publisherId)) })).filter(({ p, next }) => next !== p.commissionCents)
  const delta = waiting.reduce((t, { p, next }) => t + (p.commissionCents - next), 0)

  return (
    <SettingsSection id="commission" title="Commission" description="SchoolShop's share of what parents pay. It's fixed when the school confirms a delivery, so a new rate only changes payouts still on their way.">
      <Field id="default-rate" label="Default commission" hint="Every publisher pays this unless they have their own rate below.">
        <Unit id="default-rate" unit="% of each sale" value={draft.defaultRate} onChange={(e) => setDraft({ ...draft, defaultRate: e.target.value })} aria-invalid={!validPct(draft.defaultRate)} />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Publishers with their own rate</legend>
        {draft.overrides.length === 0 && <p className="text-sm text-muted-foreground">None. Everyone pays the default.</p>}
        {draft.overrides.map((o, i) => (
          <div key={i} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)_auto] sm:items-end">
            <Field id={`ov-pub-${i}`} label="Publisher">
              <NativeSelect id={`ov-pub-${i}`} value={o.publisherId} onChange={(e) => setOverride(i, { publisherId: e.target.value })}>
                <option value="">Choose…</option>
                {s.publishers.filter((p) => p.id === o.publisherId || !used.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </Field>
            <Field id={`ov-rate-${i}`} label="Rate">
              <Unit id={`ov-rate-${i}`} unit="%" className="w-20" value={o.rate} onChange={(e) => setOverride(i, { rate: e.target.value })} aria-invalid={!validPct(o.rate)} />
            </Field>
            <Field id={`ov-note-${i}`} label="Why">
              <Input id={`ov-note-${i}`} value={o.note} onChange={(e) => setOverride(i, { note: e.target.value })} placeholder="e.g. Agreed in the 2027 contract" />
            </Field>
            <Button variant="ghost" size="icon" aria-label={`Remove ${o.publisherId ? name(o.publisherId) : "this"} rate`} onClick={() => setDraft({ ...draft, overrides: draft.overrides.filter((_, j) => j !== i) })}><Trash2 aria-hidden /></Button>
          </div>
        ))}
        <Button variant="outline" className="self-start" disabled={used.size >= s.publishers.length} onClick={() => setDraft({ ...draft, overrides: [...draft.overrides, { publisherId: "", rate: draft.defaultRate, note: "" }] })}>
          <Plus aria-hidden /> Give a publisher its own rate
        </Button>
      </fieldset>

      {dirty && !invalid && (
        <div role="note" aria-label="What changes" className="rounded-xl bg-info-bg px-4 py-3 text-sm">
          {waiting.length === 0 ? (
            "No payouts are on their way right now, so this applies from the next delivery."
          ) : (
            <>
              <p className="font-semibold">{waiting.length} payout{waiting.length === 1 ? "" : "s"} on the way will use the new rate. Publishers get {formatKes(Math.abs(delta))} {delta >= 0 ? "more" : "less"} in total.</p>
              <ul className="mt-1 text-[13px]">
                {waiting.map(({ p, next }) => <li key={p.id}>{p.publisherName} · {p.schoolName}: commission {formatKes(p.commissionCents)} → {formatKes(next)}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      <Footer
        s={s} section="commission" dirty={dirty} save={save} invalid={dirty ? invalid : null}
        onUndo={() => setDraft(base)}
        onSave={() => submit({ defaultRate: fromPct(draft.defaultRate), overrides: draft.overrides.map((o) => ({ publisherId: o.publisherId, publisherName: name(o.publisherId), rate: fromPct(o.rate), note: o.note })) })}
      />
    </SettingsSection>
  )
}

/* ── Payouts ── */

function PayoutsSection({ s }: { s: PlatformSettings }) {
  const base = useStable({ holdDays: String(s.payouts.holdDays), minimum: String(s.payouts.minimumCents / 100), autoRelease: s.payouts.autoRelease })
  const { draft, setDraft, save, dirty, submit } = useSection("payouts", base)
  const days = Number(draft.holdDays), min = Number(draft.minimum)
  const invalid = !(Number.isInteger(days) && days >= 0 && days <= 14) ? "Hold for between 0 and 14 days." : !(Number.isFinite(min) && min >= 0 && min <= 100_000) ? "The minimum payout must be between KES 0 and KES 100,000." : null
  return (
    <SettingsSection id="payouts" title="Payouts" description="Set when payouts become eligible, and whether eligible verified M-Pesa mobile accounts are paid automatically through SasaPay.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="hold-days" label="Wait after delivery" hint="Gives the school time to report missing or damaged packs.">
          <Unit id="hold-days" unit="days" value={draft.holdDays} onChange={(e) => setDraft({ ...draft, holdDays: e.target.value })} />
        </Field>
        <Field id="minimum" label="Smallest payout" hint="Smaller amounts wait and go out with the next delivery.">
          <Unit id="minimum" unit="KES" value={draft.minimum} onChange={(e) => setDraft({ ...draft, minimum: e.target.value })} />
        </Field>
      </div>
      <label htmlFor="auto-release" className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4">
        <span className="flex flex-col">
          <span className="font-medium">Release eligible payouts automatically</span>
          <span className="text-sm text-muted-foreground">Only verified M-Pesa mobile accounts are sent automatically. Bank, Paybill, and Till payouts stay queued for finance to send manually. Transfers are recorded as paid only after SasaPay confirms them.</span>
        </span>
        <Switch id="auto-release" checked={draft.autoRelease} onCheckedChange={(on) => setDraft({ ...draft, autoRelease: on })} />
      </label>
      {draft.autoRelease && s.payments.fake && (
        <p role="status" className="rounded-xl bg-warn-bg px-4 py-3 text-sm font-medium">
          This server uses fake payments. Automatic payouts will be simulated and no money will move.
        </p>
      )}
      {draft.autoRelease && !s.payments.fake && !s.payments.mpesaReady && (
        <p role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-sm font-medium">
          Configure and verify SasaPay in Payment providers before automatic payouts can be sent.
        </p>
      )}
      <Footer s={s} section="payouts" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit({ holdDays: days, minimumCents: Math.round(min * 100), autoRelease: draft.autoRelease })} />
    </SettingsSection>
  )
}

/* ── Refunds ── */

function RefundsSection({ s }: { s: PlatformSettings }) {
  const base = useStable({ autoUpTo: String(s.refunds.autoApproveUpToCents / 100), until: s.refunds.parentRequestsUntil })
  const { draft, setDraft, save, dirty, submit } = useSection("refunds", base)
  const upTo = Number(draft.autoUpTo)
  const invalid = !(Number.isFinite(upTo) && upTo >= 0 && upTo <= 5000) ? "Automatic refunds go up to KES 5,000 at most." : null
  return (
    <SettingsSection id="refunds" title="Refunds" description="Money always goes back to the M-Pesa number that paid.">
      <Field id="auto-up-to" label="Refund out-of-stock items without approval" hint={upTo > 0 ? `When a publisher can't supply an item, orders refunding up to KES ${upTo.toLocaleString("en-KE")} go back straight away. Larger ones wait in Refunds & disputes.` : "Set to 0 to have someone approve every refund."}>
        <Unit id="auto-up-to" unit="KES per order" value={draft.autoUpTo} onChange={(e) => setDraft({ ...draft, autoUpTo: e.target.value })} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Parents can ask for a refund</legend>
        <RadioGroup value={draft.until} onValueChange={(v) => setDraft({ ...draft, until: v as typeof draft.until })} className="grid gap-2 sm:grid-cols-2">
          {([
            ["dispatched", "Until the publisher dispatches", "After that, the pack is on its way to school."],
            ["at_school", "Until the pack reaches school", "Publishers may have packed it already."],
          ] as const).map(([id, label, hint]) => (
            <label key={id} htmlFor={`until-${id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-teal-light/40">
              <RadioGroupItem id={`until-${id}`} value={id} className="mt-0.5" />
              <span className="flex flex-col"><span className="font-medium">{label}</span><span className="text-sm text-muted-foreground">{hint}</span></span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Footer s={s} section="refunds" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit({ autoApproveUpToCents: Math.round(upTo * 100), parentRequestsUntil: draft.until })} />
    </SettingsSection>
  )
}

/* ── M-Pesa ── */

function MpesaSection({ s }: { s: PlatformSettings }) {
  const base = useStable({ paybill: s.mpesa.paybill, timeout: String(s.mpesa.callbackTimeoutMinutes) })
  const { draft, setDraft, save, dirty, submit } = useSection("mpesa", base)
  const t = Number(draft.timeout)
  const invalid = !/^\d{5,7}$/.test(draft.paybill) ? "A Paybill number has 5 to 7 digits." : !(Number.isInteger(t) && t >= 1 && t <= 10) ? "Wait between 1 and 10 minutes." : null
  return (
    <SettingsSection id="mpesa" title="M-Pesa" description="How parents pay.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="paybill" label="Paybill number" hint="Shown to parents who pay from the M-Pesa menu instead of the prompt.">
          <Input id="paybill" inputMode="numeric" className="w-40" value={draft.paybill} onChange={(e) => setDraft({ ...draft, paybill: e.target.value.trim() })} />
        </Field>
        <Field id="timeout" label="Flag a payment with no answer after" hint="It shows under Orders, Needs attention, for someone to check.">
          <Unit id="timeout" unit="minutes" value={draft.timeout} onChange={(e) => setDraft({ ...draft, timeout: e.target.value })} />
        </Field>
      </div>
      <Footer s={s} section="mpesa" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit({ paybill: draft.paybill, callbackTimeoutMinutes: t })} />
    </SettingsSection>
  )
}

/* ── Payment providers ── */

type PaymentsDraft = PaymentsInput
const paymentsDraft = (p: PlatformSettings["payments"]): PaymentsDraft => ({
  sasapay: { enabled: p.sasapay.enabled, mode: p.sasapay.mode, merchantCode: p.sasapay.merchantCode, clientId: "", clientSecret: "" },
  cardProvider: p.cardProvider,
  stripe: { secretKey: "", webhookSecret: "" },
  paystack: { secretKey: "" },
})

/** A secret field: never shows the saved key, only that one is saved. Empty keeps it. */
function KeyField({ id, label, saved, value, onChange, placeholder }: { id: string; label: string; saved: string | null; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field id={id} label={label} hint={saved ? `Saved (${saved}). Leave empty to keep it.` : "Not set."}>
      <Input id={id} type="password" autoComplete="off" spellCheck={false} placeholder={saved ? "Enter a new key to replace it" : placeholder} value={value} onChange={(e) => onChange(e.target.value.trim())} />
    </Field>
  )
}

function Copyable({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-paper p-3 text-sm">
      <span className="font-semibold">{label}</span>
      <code className="break-all text-[13px]">{url}</code>
    </div>
  )
}

function PaymentsSection({ s }: { s: PlatformSettings }) {
  const p = s.payments
  const base = useStable(paymentsDraft(p))
  const { draft, setDraft, save, dirty, submit } = useSection("payments", base)
  const sasa = (patch: Partial<PaymentsDraft["sasapay"]>) => setDraft({ ...draft, sasapay: { ...draft.sasapay, ...patch } })
  const invalid = draft.sasapay.merchantCode && !/^\d{3,10}$/.test(draft.sasapay.merchantCode) ? "SasaPay's merchant code is 3 to 10 digits." : null
  return (
    <SettingsSection id="payments" title="Payment providers" description="Parents pay by M-Pesa through SasaPay, and by card through Stripe or Paystack. Keys are encrypted and never shown again; new keys are checked with the provider when you save.">
      {p.fake && (
        <p role="status" className="rounded-xl bg-warn-bg px-4 py-3 text-sm font-medium">
          This server runs with fake payments (PAYMENTS_GATEWAY=fake): no money moves, whatever is set here.
        </p>
      )}

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">M-Pesa · SasaPay</legend>
        <label htmlFor="sasapay-on" className="flex items-center justify-between gap-4">
          <span className="flex flex-col"><span className="font-medium">Take M-Pesa payments</span><span className="text-sm text-muted-foreground">Parents get a prompt on their phone to enter their PIN.</span></span>
          <Switch id="sasapay-on" checked={draft.sasapay.enabled} onCheckedChange={(on) => sasa({ enabled: on })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sasapay-mode" label="Environment" hint="Sandbox for testing; live takes real money.">
            <NativeSelect id="sasapay-mode" value={draft.sasapay.mode} onChange={(e) => sasa({ mode: e.target.value as "sandbox" | "live" })}>
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </NativeSelect>
          </Field>
          <Field id="sasapay-merchant" label="Merchant code">
            <Input id="sasapay-merchant" inputMode="numeric" value={draft.sasapay.merchantCode} onChange={(e) => sasa({ merchantCode: e.target.value.trim() })} />
          </Field>
          <KeyField id="sasapay-client-id" label="Client ID" saved={p.sasapay.clientId} value={draft.sasapay.clientId} onChange={(v) => sasa({ clientId: v })} placeholder="From SasaPay's developer portal" />
          <KeyField id="sasapay-client-secret" label="Client secret" saved={p.sasapay.clientSecret} value={draft.sasapay.clientSecret} onChange={(v) => sasa({ clientSecret: v })} placeholder="From SasaPay's developer portal" />
        </div>
        <Copyable label="Callback URL (sent with each payment; nothing to set in SasaPay)" url={p.sasapay.callbackUrl} />
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Cards</legend>
        <RadioGroup value={draft.cardProvider} onValueChange={(v) => setDraft({ ...draft, cardProvider: v as PaymentsDraft["cardProvider"] })} className="grid gap-2 sm:grid-cols-3">
          {([
            ["none", "No card payments", "Parents pay by M-Pesa only."],
            ["stripe", "Stripe", "Stripe Checkout, Stripe's own page."],
            ["paystack", "Paystack", "Paystack's own checkout page."],
          ] as const).map(([id, label, hint]) => (
            <label key={id} htmlFor={`card-${id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-teal-light/40">
              <RadioGroupItem id={`card-${id}`} value={id} className="mt-0.5" />
              <span className="flex flex-col"><span className="font-medium">{label}</span><span className="text-sm text-muted-foreground">{hint}</span></span>
            </label>
          ))}
        </RadioGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <KeyField id="stripe-secret" label="Stripe secret key" saved={p.stripe.secretKey} value={draft.stripe.secretKey} onChange={(v) => setDraft({ ...draft, stripe: { ...draft.stripe, secretKey: v } })} placeholder="sk_live_… or sk_test_…" />
          <KeyField id="stripe-webhook" label="Stripe webhook signing secret" saved={p.stripe.webhookSecret} value={draft.stripe.webhookSecret} onChange={(v) => setDraft({ ...draft, stripe: { ...draft.stripe, webhookSecret: v } })} placeholder="whsec_…" />
          <Copyable label="Stripe webhook endpoint (checkout.session.* events)" url={p.stripe.webhookUrl} />
          <span />
          <KeyField id="paystack-secret" label="Paystack secret key" saved={p.paystack.secretKey} value={draft.paystack.secretKey} onChange={(v) => setDraft({ ...draft, paystack: { secretKey: v } })} placeholder="sk_live_… or sk_test_…" />
          <Copyable label="Paystack webhook URL" url={p.paystack.webhookUrl} />
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Now: M-Pesa {p.mpesaReady ? "on" : "off"} · cards {p.cardReady ? `on (${p.cardProvider === "paystack" ? "Paystack" : "Stripe"})` : "off"}.
      </p>
      <Footer s={s} section="payments" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit(draft)} />
    </SettingsSection>
  )
}

/* ── Email delivery ── */

function EmailSection({ s }: { s: PlatformSettings }) {
  const base = useStable<EmailInput>({
    provider: s.email.provider,
    resendApiKey: "",
    fromEmail: s.email.fromEmail,
    fromName: s.email.fromName,
  })
  const { draft, setDraft, save, dirty, submit } = useSection("email", base)
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const invalid =
    draft.provider === "resend" && !s.email.resendReady && !draft.resendApiKey
      ? "Enter the Resend API key before switching email to Resend."
      : draft.resendApiKey && !draft.resendApiKey.startsWith("re_")
        ? "Resend API keys start with re_."
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.fromEmail)
          ? "Enter a valid sender email address."
          : !draft.fromName.trim() || draft.fromName.length > 120
            ? "Enter a sender name of 1 to 120 characters."
            : null
  const update = (patch: Partial<EmailInput>) => setDraft({ ...draft, ...patch })

  return (
    <SettingsSection id="email" title="Email delivery" description="Choose how SchoolShop sends account, order, invitation, and payout emails. Resend credentials are encrypted and never shown again; the API key is checked when mail is sent.">
      <RadioGroup value={draft.provider} onValueChange={(v) => update({ provider: v as EmailInput["provider"] })} className="grid gap-2 sm:grid-cols-2">
        {([
          ["django", "Use server email", "Use the email backend configured on the server."],
          ["resend", "Use Resend", "Send transactional email using Resend's API."],
        ] as const).map(([id, label, hint]) => (
          <label key={id} htmlFor={`email-${id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-teal-light/40">
            <RadioGroupItem id={`email-${id}`} value={id} className="mt-0.5" />
            <span className="flex flex-col"><span className="font-medium">{label}</span><span className="text-sm text-muted-foreground">{hint}</span></span>
          </label>
        ))}
      </RadioGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <KeyField id="resend-api-key" label="Resend API key" saved={s.email.resendApiKey} value={draft.resendApiKey} onChange={(v) => update({ resendApiKey: v })} placeholder="re_…" />
        <span />
        <Field id="resend-from-name" label="Sender name" hint={errors.fromName?.[0]}>
          <Input id="resend-from-name" value={draft.fromName} onChange={(e) => update({ fromName: e.target.value })} aria-invalid={!!errors.fromName} />
        </Field>
        <Field id="resend-from-email" label="Sender email" hint={errors.fromEmail?.[0] ?? "This address must use a domain verified in your Resend account."}>
          <Input id="resend-from-email" type="email" autoComplete="email" value={draft.fromEmail} onChange={(e) => update({ fromEmail: e.target.value.trim() })} aria-invalid={!!errors.fromEmail} />
        </Field>
      </div>
      {draft.provider === "resend" && !s.email.resendReady && !draft.resendApiKey && (
        <p role="status" className="rounded-xl bg-warn-bg px-4 py-3 text-sm font-medium">Resend is not configured yet. Add the API key and a verified sender address to activate email delivery.</p>
      )}
      <Footer s={s} section="email" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit(draft)} />
    </SettingsSection>
  )
}

/* ── Terms ── */

function TermsSection({ s }: { s: PlatformSettings }) {
  const base = useStable(s.terms)
  const { draft, setDraft, save, dirty, submit } = useSection("terms", base)
  const setTerm = (i: number, patch: Partial<PlatformSettings["terms"][number]>) => setDraft(draft.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const invalid = draft.find((t) => !t.name.trim()) ? "Give each term a name." : draft.find((t) => t.startsOn && t.endsOn && t.startsOn >= t.endsOn) ? `${draft.find((t) => t.startsOn >= t.endsOn)!.name} has to end after it starts.` : null
  return (
    <SettingsSection id="terms" title="Term calendar" description="Schools build booklists for these terms. Ordering opens on the date set here.">
      <div className="flex flex-col gap-3">
        {draft.map((t, i) => (
          <div key={t.id || i} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
            <Field id={`term-name-${i}`} label="Term"><Input id={`term-name-${i}`} value={t.name} onChange={(e) => setTerm(i, { name: e.target.value })} /></Field>
            <Field id={`term-open-${i}`} label="Ordering opens"><Input id={`term-open-${i}`} type="date" value={t.orderingOpensOn} onChange={(e) => setTerm(i, { orderingOpensOn: e.target.value })} /></Field>
            <Field id={`term-start-${i}`} label="Starts"><Input id={`term-start-${i}`} type="date" value={t.startsOn} onChange={(e) => setTerm(i, { startsOn: e.target.value })} /></Field>
            <Field id={`term-end-${i}`} label="Ends"><Input id={`term-end-${i}`} type="date" value={t.endsOn} onChange={(e) => setTerm(i, { endsOn: e.target.value })} /></Field>
            <Button variant="ghost" size="icon" aria-label={`Remove ${t.name || "this term"}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>
          </div>
        ))}
        <Button variant="outline" className="self-start" onClick={() => setDraft([...draft, { id: "", name: nextTermName(draft), orderingOpensOn: "", startsOn: "", endsOn: "" }])}><Plus aria-hidden /> Add a term</Button>
      </div>
      <Footer s={s} section="terms" dirty={dirty} save={save} invalid={dirty ? invalid : null} onUndo={() => setDraft(base)} onSave={() => submit({ terms: draft })} />
    </SettingsSection>
  )
}

/** "Term 3, 2027" → "Term 1, 2028". */
function nextTermName(terms: PlatformSettings["terms"]) {
  const last = terms.at(-1)?.name.match(/Term (\d), (\d{4})/)
  if (!last) return ""
  const [n, y] = [Number(last[1]), Number(last[2])]
  return n >= 3 ? `Term 1, ${y + 1}` : `Term ${n + 1}, ${y}`
}

/* ── Support ── */

function SupportSection({ s }: { s: PlatformSettings }) {
  const base = useStable(s.support)
  const { draft, setDraft, save, dirty, submit } = useSection("support", base)
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const field = (k: keyof PlatformSettings["support"], label: string, hint?: string, type = "text") => (
    <Field id={`support-${k}`} label={label} hint={fe[k]?.[0] ? <span className="text-destructive">{fe[k][0]}</span> : hint}>
      <Input id={`support-${k}`} type={type} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} aria-invalid={!!fe[k]} />
    </Field>
  )
  return (
    <SettingsSection id="support" title="Parent support" description="Shown to parents on receipts, SMSes and the help page.">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("phone", "Phone")}
        {field("whatsapp", "WhatsApp", "Leave empty to hide it.")}
        {field("email", "Email", undefined, "email")}
        {field("hours", "Hours")}
      </div>
      <Footer s={s} section="support" dirty={dirty} save={save} fieldsShowErrors onUndo={() => setDraft(base)} onSave={() => submit(draft)} />
    </SettingsSection>
  )
}

/** Keeps the same object while its contents don't change, so a section only resets when the saved value really changes. */
function useStable<T>(value: T): T {
  const [kept, setKept] = useState(value)
  if (JSON.stringify(kept) !== JSON.stringify(value)) { setKept(value); return value }
  return kept
}
