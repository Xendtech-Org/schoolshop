import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CreditCard, Lock } from "lucide-react"
import { z } from "zod"

import { SectionLabel } from "@/components/common/SectionLabel"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import { usePaymentOptions } from "@/lib/api/queries"
import { formatKes, normaliseKenyanPhone } from "@/lib/format"

const payFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => normaliseKenyanPhone(v) !== null, "Enter the M-Pesa number, like 0712 345 678"),
})
type PayForm = z.infer<typeof payFormSchema>

const providerName = { stripe: "Stripe", paystack: "Paystack" } as const

/**
 * How a parent pays: an M-Pesa prompt to their phone, or a card on Stripe's or
 * Paystack's own page. Only the ways SchoolShop has switched on are offered.
 * onMpesa / onCard do the work and throw ApiError to show a message here.
 */
export function PayOptions({
  amountCents,
  defaultPhone,
  disabled,
  onMpesa,
  onCard,
}: {
  amountCents: number
  defaultPhone: string
  disabled?: boolean
  onMpesa: (phone: string) => Promise<void>
  onCard: () => Promise<void>
}) {
  const options = usePaymentOptions()
  const [busy, setBusy] = useState<"mpesa" | "card" | null>(null)
  const form = useForm<PayForm>({ resolver: zodResolver(payFormSchema), defaultValues: { phone: defaultPhone } })
  // Until we know, offer M-Pesa: the server says clearly if it isn't on.
  const mpesa = options.data?.mpesa ?? true
  const card = options.data?.card ?? false

  async function run(kind: "mpesa" | "card", fn: () => Promise<void>) {
    setBusy(kind)
    form.clearErrors()
    try {
      await fn()
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      form.setError(err?.fieldErrors.phone ? "phone" : "root", {
        message: err?.fieldErrors.phone?.[0] ?? err?.message ?? "Couldn't start the payment. Try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  if (options.data && !mpesa && !card) {
    return (
      <p role="status" className="rounded-2xl border bg-card p-4 text-[15px]">
        Payments aren't switched on yet. Your order is saved, and you can pay for it from Orders once they are.
      </p>
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ phone }) => run("mpesa", () => onMpesa(normaliseKenyanPhone(phone)!)))}
        className="flex flex-col gap-3.5 rounded-2xl border bg-card p-4"
      >
        {mpesa && (
          <>
            <SectionLabel as="span" className="text-xs">Pay with M-Pesa</SectionLabel>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>M-Pesa phone number</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormDescription>We'll send a payment prompt to this number.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" disabled={disabled || busy !== null}>
              {busy === "mpesa" ? "Sending prompt…" : `Pay ${formatKes(amountCents)} with M-Pesa`}
            </Button>
          </>
        )}
        {card && (
          <>
            {mpesa && <span className="text-center text-sm text-muted-foreground">or</span>}
            <Button type="button" size="lg" variant={mpesa ? "outline" : "default"} disabled={disabled || busy !== null} onClick={() => run("card", onCard)}>
              <CreditCard aria-hidden /> {busy === "card" ? "Opening the card page…" : `Pay ${formatKes(amountCents)} by card`}
            </Button>
            <span className="text-center text-[13px] text-muted-foreground">
              You'll enter your card on {options.data?.cardProvider ? providerName[options.data.cardProvider] : "the card provider"}'s secure page, then come back here.
            </span>
          </>
        )}
        {form.formState.errors.root && (
          <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
        )}
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Full refund for any item the publisher can't supply.
        </p>
      </form>
    </Form>
  )
}
