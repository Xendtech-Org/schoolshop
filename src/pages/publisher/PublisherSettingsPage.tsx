import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router"
import { BadgeCheck, ImagePlus, Lock, Trash2, Upload } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { ChangePasswordSection, Saved, SectionChips, SettingsSection } from "@/components/settings/SettingsSection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import * as endpoints from "@/lib/api/endpoints"
import { usePublisherSettings, useSettingsMutation } from "@/lib/api/queries"
import type { NotificationEvent, PublisherSettings } from "@/lib/api/schemas"
import { formatDayLong, normaliseKenyanPhone } from "@/lib/format"
import { counties, errorText, showContact } from "@/lib/settings"

const events: { id: NotificationEvent; label: string; hint: string; smsAllowed: boolean }[] = [
  { id: "batch_ready", label: "A school's order is ready to pack", hint: "When a school's order window closes", smsAllowed: true },
  { id: "delivery_issue", label: "A school flags a delivery issue", hint: "Short, damaged or wrong items", smsAllowed: true },
  { id: "payout_sent", label: "A payout is sent", hint: "With the amount and reference", smsAllowed: true },
  { id: "low_stock", label: "A title runs low on stock", hint: "At the alert level you set per title", smsAllowed: true },
  { id: "weekly_summary", label: "Weekly summary", hint: "Orders, dispatches and payouts for the week", smsAllowed: false },
]

const sections = [
  { id: "company", label: "Company" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
]

export function PublisherSettingsPage() {
  const settings = usePublisherSettings()
  return (
    <>
      <PageHeader eyebrow="Your company, team and how we reach you" title="Settings" />
      <SectionChips sections={sections} />
      <QueryBoundary query={settings}>
        {(data) => (
          <div className="flex max-w-4xl flex-col gap-6">
            <CompanySection data={data} />
            <NotificationsSection value={data.notifications} />
            <ChangePasswordSection description="Your own sign-in. Each team member has their own password." />
          </div>
        )}
      </QueryBoundary>
    </>
  )
}

/* ── Company ─────────────────────────────────────────────────── */

/** Locked details aren't sent or checked: they stay as SchoolShop verified them. */
const profileSchema = (locked: { companyName: boolean; kraPin: boolean; registrationNo: boolean }) => z.object({
  companyName: locked.companyName ? z.string() : z.string().trim().min(2, "Enter the registered company name").max(160, "Keep it under 160 characters."),
  kraPin: locked.kraPin ? z.string() : z.string().trim().refine((v) => !v || /^[a-z]\d{9}[a-z]$/i.test(v), "Enter a KRA PIN, like P051234567X"),
  registrationNo: locked.registrationNo ? z.string() : z.string().trim().max(60, "Keep it under 60 characters.").refine((v) => !v || v.length >= 4, "Enter the registration number"),
  website: z.string().trim().max(200, "Keep it under 200 characters.").refine((v) => !v || /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i.test(v), "Enter a website, like longhorn.co.ke"),
  about: z.string().trim().max(500, "Keep it under 500 characters."),
  contactName: z.string().trim().min(2, "Enter a contact name"),
  phone: z.string().trim().refine((v) => normaliseKenyanPhone(v) !== null, "Enter a Kenyan mobile number"),
  email: z.email("Enter an email for order notices"),
  dispatchAddress: z.string().trim().min(5, "Enter the address schools and carriers use"),
  county: z.string().min(1, "Choose a county"),
})
type ProfileValues = z.infer<ReturnType<typeof profileSchema>>

function CompanySection({ data }: { data: PublisherSettings }) {
  const p = data.profile
  // Verified details are locked. One that was never given can still be added.
  const locked = {
    companyName: p.verified && !!p.companyName,
    kraPin: p.verified && !!p.kraPin,
    registrationNo: p.verified && !!p.registrationNo,
  }
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema(locked)),
    defaultValues: {
      companyName: p.companyName, kraPin: p.kraPin, registrationNo: p.registrationNo, website: p.website, about: p.about,
      contactName: p.contactName, phone: showContact(p.phone), email: p.email, dispatchAddress: p.dispatchAddress, county: p.county,
    },
  })
  const save = useSettingsMutation(endpoints.updatePublisherProfile)
  const anyLocked = locked.companyName || locked.kraPin || locked.registrationNo

  return (
    <SettingsSection id="company" title="Company profile" description="Schools see your company name. Order notices go to the contact details below.">
      <LogoUpload logoUrl={p.logoUrl} companyName={p.companyName} />
      {anyLocked && (
        <div className="grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2">
          {locked.companyName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">Registered name</span>
              <span className="flex items-center gap-2 font-semibold">
                {p.companyName}
                <Badge variant="success"><BadgeCheck aria-hidden /> Verified</Badge>
              </span>
            </div>
          )}
          {locked.kraPin && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">KRA PIN</span>
              <span className="font-mono font-semibold">{p.kraPin}</span>
            </div>
          )}
          {locked.registrationNo && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">Registration number</span>
              <span className="font-mono font-semibold">{p.registrationNo}</span>
            </div>
          )}
          <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <Lock className="size-4 shrink-0" aria-hidden />
            {p.verifiedAt ? `Verified on ${formatDayLong(p.verifiedAt.slice(0, 10))}. ` : ""}To change these, contact SchoolShop support.
          </p>
        </div>
      )}
      <Form {...form}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((v) =>
            save.mutate(
              {
                website: v.website, about: v.about, contactName: v.contactName, dispatchAddress: v.dispatchAddress, county: v.county,
                phone: normaliseKenyanPhone(v.phone)!, email: v.email.toLowerCase(),
                ...(!locked.companyName && { companyName: v.companyName }),
                ...(!locked.kraPin && { kraPin: v.kraPin.toUpperCase() }),
                ...(!locked.registrationNo && { registrationNo: v.registrationNo }),
              },
              { onSuccess: () => form.reset(v), onError: (e) => form.setError("root", { message: errorText(e) }) }
            )
          )}
        >
          {!(locked.companyName && locked.kraPin && locked.registrationNo) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {!locked.companyName && (
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Registered company name</FormLabel><FormControl><Input autoComplete="organization" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              {!locked.kraPin && (
                <FormField control={form.control} name="kraPin" render={({ field }) => (
                  <FormItem><FormLabel>KRA PIN</FormLabel><FormControl><Input placeholder="P051234567X" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              {!locked.registrationNo && (
                <FormField control={form.control} name="registrationNo" render={({ field }) => (
                  <FormItem><FormLabel>Registration number</FormLabel><FormControl><Input placeholder="PVT-2019-0048812" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>
          )}
          <FormField control={form.control} name="website" render={({ field }) => (
            <FormItem><FormLabel>Website</FormLabel><FormControl><Input inputMode="url" placeholder="longhorn.co.ke" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="about" render={({ field }) => (
            <FormItem>
              <FormLabel>About your company</FormLabel>
              <FormControl><Textarea rows={3} {...field} /></FormControl>
              <FormDescription>A few sentences, up to 500 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="contactName" render={({ field }) => (
              <FormItem><FormLabel>Contact person</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" inputMode="tel" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email for orders</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="county" render={({ field }) => (
              <FormItem><FormLabel>County</FormLabel><FormControl>
                <NativeSelect {...field}>{counties.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="dispatchAddress" render={({ field }) => (
            <FormItem>
              <FormLabel>Dispatch address</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormDescription>Printed on delivery notes, and where SchoolShop sends returns.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          {form.formState.errors.root && <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending ? "Saving…" : "Save changes"}</Button>
            <Saved show={save.isSuccess && !form.formState.isDirty} />
          </div>
        </form>
      </Form>
      <p className="text-sm text-muted-foreground">
        Payout details are on the <Link to="/publisher/payouts" className="font-semibold text-accent-text hover:underline">Payouts</Link> page.
      </p>
    </SettingsSection>
  )
}

function LogoUpload({ logoUrl, companyName }: { logoUrl: string | null; companyName: string }) {
  const input = useRef<HTMLInputElement>(null)
  const uploadLogo = useSettingsMutation(endpoints.uploadPublisherLogo)
  const removeLogo = useSettingsMutation(endpoints.removePublisherLogo)
  const [error, setError] = useState<string | null>(null)
  const busy = uploadLogo.isPending || removeLogo.isPending

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Company logo</span>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={`${companyName} logo`} className="size-20 shrink-0 rounded-lg border object-contain p-1" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB. It saves as soon as you upload it.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Upload aria-hidden /> {uploadLogo.isPending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  removeLogo.mutate(undefined, { onError: (e) => setError(errorText(e)) })
                }}
              >
                <Trash2 aria-hidden /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          setError(null)
          uploadLogo.mutate(file, { onError: (err) => setError(errorText(err, "file")) })
        }}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/* ── Notifications ───────────────────────────────────────────── */

function NotificationsSection({ value }: { value: PublisherSettings["notifications"] }) {
  const [draft, setDraft] = useState(value)
  const save = useSettingsMutation(endpoints.updateNotifications)
  const dirty = JSON.stringify(draft) !== JSON.stringify(value)
  const set = (id: NotificationEvent, ch: "sms" | "email", on: boolean) => setDraft((d) => ({ ...d, [id]: { ...d[id], [ch]: on } }))

  return (
    <SettingsSection id="notifications" title="Notifications" description="Sent to the company phone and email above. SMS is for things that need action today.">
      <div className="overflow-hidden rounded-xl border">
        <div className="hidden grid-cols-[1fr_80px_80px] gap-3 bg-paper px-4 py-2.5 text-[13px] font-semibold text-muted-foreground sm:grid" aria-hidden>
          <span>Event</span><span className="text-center">SMS</span><span className="text-center">Email</span>
        </div>
        <ul className="divide-y">
          {events.map((ev) => (
            <li key={ev.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[1fr_80px_80px] sm:gap-x-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{ev.label}</span>
                <span className="text-sm text-muted-foreground">{ev.hint}</span>
              </span>
              {(["sms", "email"] as const).map((ch) => {
                const id = `n-${ev.id}-${ch}`
                const allowed = ch === "email" || ev.smsAllowed
                return (
                  <span key={ch} className="flex flex-col items-center gap-1">
                    <label htmlFor={id} className="text-xs text-muted-foreground sm:sr-only">
                      {ch === "sms" ? "SMS" : "Email"}<span className="sr-only"> for {ev.label}</span>
                    </label>
                    {allowed ? (
                      <Switch id={id} checked={draft[ev.id][ch]} onCheckedChange={(on) => set(ev.id, ch, on)} />
                    ) : (
                      <span id={id} className="flex h-6 items-center text-sm text-muted-foreground">—</span>
                    )}
                  </span>
                )
              })}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>{save.isPending ? "Saving…" : "Save notifications"}</Button>
        {dirty && <Button variant="ghost" onClick={() => setDraft(value)}>Undo changes</Button>}
        <Saved show={save.isSuccess && !dirty} />
      </div>
    </SettingsSection>
  )
}
