import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { Check, FileText, Paperclip, X } from "lucide-react"
import { z } from "zod"

import { PasswordInput } from "@/components/auth/PasswordInput"
import { PasswordStrength } from "@/components/auth/PasswordStrength"
import { AuthHeading, AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { ApiError } from "@/lib/api/client"
import { applyForOrganisation, type OrgApplicationInput } from "@/lib/api/endpoints"
import { formatBytes, normaliseKenyanPhone } from "@/lib/format"
import { orgDocumentAccept, orgDocumentMaxBytes, orgDocuments } from "@/lib/orgDocuments"
import { newPasswordSchema } from "@/lib/password"
import { cn } from "@/lib/utils"

const counties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
  "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
]

const copy = {
  school: {
    orgName: "School name",
    orgPlaceholder: "e.g. Kilimani Primary",
    regNo: "MoE registration no.",
    regPlaceholder: "e.g. 12345-NBI",
    roles: ["Head teacher", "Deputy head teacher", "Bursar", "Director or owner", "Class teacher"],
  },
  publisher: {
    orgName: "Company name",
    orgPlaceholder: "e.g. Longhorn Publishers",
    regNo: "KRA PIN",
    regPlaceholder: "e.g. P051234567X",
    roles: ["Director", "Sales manager", "Operations manager", "Finance"],
  },
} as const

const schema = z.object({
  orgName: z.string().trim().min(3, "Enter the organisation's name"),
  county: z.string().min(1, "Choose a county"),
  registrationNo: z.string().trim().min(4, "Enter the registration number"),
  contactName: z.string().trim().min(2, "Enter your name"),
  contactRole: z.string().min(1, "Choose your role"),
  email: z.email("Enter a work email, like name@school.ac.ke"),
  phone: z.string().trim().refine((v) => normaliseKenyanPhone(v) !== null, "Enter a Kenyan mobile number"),
  password: newPasswordSchema,
})
type Values = z.infer<typeof schema>

export function RegisterOrganisationPage() {
  const [params, setParams] = useSearchParams()
  const orgType = params.get("type") === "publisher" ? "publisher" : "school"
  const text = copy[orgType]
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { orgName: "", county: "", registrationNo: "", contactName: "", contactRole: "", email: "", phone: "", password: "" },
  })
  const [docs, setDocs] = useState<Record<string, File | null>>({})
  const [docError, setDocError] = useState<string | null>(null)
  const apply = useMutation({
    mutationFn: ({ input, files }: { input: OrgApplicationInput; files: Record<string, File | null> }) => applyForOrganisation(input, files),
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          form.setError(field in schema.shape ? (field as keyof Values) : "root", { message: messages[0] })
        }
      } else form.setError("root", { message: e instanceof Error ? e.message : "Couldn't send your application" })
    },
  })
  const password = useWatch({ control: form.control, name: "password" })

  const aside = {
    headline: "Bring your school or catalog to SchoolShop.",
    numbered: true,
    points: [
      { title: "Apply", detail: "Tell us who you are. It takes 3 minutes." },
      { title: "Get verified", detail: "We check your registration documents, usually within 2 working days." },
      { title: "Go live", detail: orgType === "school" ? "Publish booklists for each grade." : "List your catalog and receive school orders." },
    ],
  }

  if (apply.isSuccess) {
    return (
      <AuthLayout aside={aside}>
        <div className="flex flex-col items-start gap-4">
          <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-ink text-sun">
            <Check className="size-8" strokeWidth={2.6} />
          </span>
          <h1 className="text-[28px] leading-tight font-semibold">Application received</h1>
          <p className="text-muted-foreground">
            Thanks. We'll review <span className="font-semibold text-ink">{apply.data.orgName}</span> and email{" "}
            <span className="font-semibold break-all text-ink">{apply.variables.input.email}</span>, usually within 2 working days.
          </p>
          <ol className="flex w-full flex-col gap-2 rounded-2xl bg-paper p-4 text-sm text-ink/85">
            <li>1. We'll call {apply.variables.input.contactName.split(" ")[0]} on {apply.variables.input.phone.replace(/^254/, "0")} to confirm details.</li>
            <li>
              2. {sentCount(apply.variables.files) === orgDocuments[orgType].length
                ? "We have all your documents."
                : "We've texted you a link to send any documents you haven't sent yet."}
            </li>
            <li>3. Once verified, you can sign in with this email and password.</li>
          </ol>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/">Back to SchoolShop</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout back="/sign-up" title="Register" aside={aside} wide>
      <Form {...form}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((v) => apply.mutate({ input: { ...v, orgType, phone: normaliseKenyanPhone(v.phone)! }, files: docs }))}
        >
          <AuthHeading title="Register your organisation">Parents don't need this. They can sign up on their phone.</AuthHeading>

          <div role="tablist" aria-label="Organisation type" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["school", "publisher"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={t === orgType}
                onClick={() => {
                  setParams({ type: t }, { replace: true })
                  setDocs({})
                  setDocError(null)
                }}
                className={cn(
                  "h-10 rounded-[9px] px-2 text-sm font-semibold",
                  t === orgType ? "bg-surface text-ink shadow-xs" : "text-muted-foreground hover:text-ink"
                )}
              >
                {t === "school" ? "School" : "Publisher or supplier"}
              </button>
            ))}
          </div>

          <FormField
            control={form.control}
            name="orgName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{text.orgName}</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" placeholder={text.orgPlaceholder} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="county"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="" disabled>Choose…</option>
                      {counties.map((c) => <option key={c}>{c}</option>)}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="registrationNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{text.regNo}</FormLabel>
                  <FormControl>
                    <Input placeholder={text.regPlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your role</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="" disabled>Choose…</option>
                      {text.roles.map((r) => <option key={r}>{r}</option>)}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="0722 000 111" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <PasswordStrength value={password} />
                <FormMessage />
              </FormItem>
            )}
          />
          <fieldset className="flex flex-col gap-3 rounded-2xl border p-4">
            <legend className="px-1 text-sm font-semibold">Documents <span className="font-normal text-muted-foreground">(optional now)</span></legend>
            <p className="text-sm text-muted-foreground">
              We check these before you go live. Send what you have; we'll text you a link for the rest. PDF, photo, CSV or Excel, up to 10 MB each.
            </p>
            {orgDocuments[orgType].map((d) => (
              <DocumentPicker
                key={`${orgType}-${d.key}`}
                label={d.label}
                hint={"hint" in d ? d.hint : undefined}
                file={docs[d.key] ?? null}
                onChange={(file) => {
                  setDocError(null)
                  if (file && file.size > orgDocumentMaxBytes) {
                    setDocError(`${file.name} is over 10 MB. Save a smaller copy and choose that.`)
                    return
                  }
                  setDocs((prev) => ({ ...prev, [d.key]: file }))
                }}
              />
            ))}
            {docError && <p role="alert" className="text-sm font-medium text-destructive">{docError}</p>}
          </fieldset>
          {form.formState.errors.root && (
            <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
          )}
          <Button type="submit" size="lg" className="mt-1" disabled={apply.isPending}>
            {apply.isPending ? "Sending…" : "Submit for verification"}
          </Button>
          <p className="text-center text-[15px] text-muted-foreground">
            Already registered?{" "}
            <Link to="/sign-in" className="font-semibold text-accent-text underline underline-offset-4">Sign in</Link>
          </p>
        </form>
      </Form>
    </AuthLayout>
  )
}

const sentCount = (files: Record<string, File | null>) => Object.values(files).filter(Boolean).length

function DocumentPicker({ label, hint, file, onChange }: { label: string; hint?: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 grow flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="truncate text-[13px] text-muted-foreground">{file ? `${file.name} · ${formatBytes(file.size)}` : (hint ?? "Not chosen yet")}</span>
      </span>
      {file ? (
        <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${label}`} onClick={() => onChange(null)}>
          <X aria-hidden />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            <Paperclip aria-hidden /> Choose
            <input
              type="file"
              accept={orgDocumentAccept}
              className="sr-only"
              aria-label={label}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) onChange(f)
              }}
            />
          </label>
        </Button>
      )}
    </div>
  )
}
