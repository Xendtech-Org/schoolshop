import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { CheckCircle2, Clock, FileText, Paperclip, Phone, XCircle } from "lucide-react"

import { AuthHeading, AuthLayout } from "@/components/layout/AuthLayout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { getApplicationDocuments, sendApplicationDocument } from "@/lib/api/endpoints"
import type { ApplicationDocuments } from "@/lib/api/schemas"
import { orgDocumentAccept, orgDocumentMaxBytes } from "@/lib/orgDocuments"

type Doc = ApplicationDocuments["documents"][number]

const stateBadge: Record<Doc["state"], { label: string; variant: "success" | "info" | "destructive" | "secondary"; icon: typeof Clock }> = {
  verified: { label: "Checked", variant: "success", icon: CheckCircle2 },
  uploaded: { label: "Waiting to be checked", variant: "info", icon: Clock },
  failed: { label: "Send it again", variant: "destructive", icon: XCircle },
  missing: { label: "Not sent yet", variant: "secondary", icon: FileText },
}

/**
 * Where a school or publisher sends or replaces the documents SchoolShop needs,
 * from the link texted to them. They can't sign in until they're approved, so
 * the link's token is what lets them in.
 */
export function ApplicationDocumentsPage() {
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const docs = useQuery({ queryKey: ["application-documents", token], queryFn: () => getApplicationDocuments(token), enabled: !!token, retry: false })

  return (
    <AuthLayout title="Documents" back="/">
      {!token || docs.isError ? (
        <div className="flex flex-col gap-4">
          <AuthHeading title="This link doesn't work">
            {docs.error instanceof ApiError && docs.error.status !== 404 ? docs.error.message : "Open the link from SchoolShop's text message again, or ask SchoolShop to send a new one."}
          </AuthHeading>
          <Button asChild variant="outline" size="lg"><Link to="/">Back to SchoolShop</Link></Button>
        </div>
      ) : !docs.data ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Documents token={token} data={docs.data} />
      )}
    </AuthLayout>
  )
}

function Documents({ token, data }: { token: string; data: ApplicationDocuments }) {
  const outstanding = data.documents.filter((d) => d.canUpload && d.state !== "uploaded").length
  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={data.orgName}>
        {!data.open
          ? data.status === "live"
            ? "You're approved. There's nothing more to send."
            : "SchoolShop has decided on this application, so there's nothing more to send."
          : outstanding
            ? `SchoolShop needs ${outstanding === 1 ? "one more document" : `${outstanding} more documents`} before ${data.orgName} can go live.`
            : "Thanks, we have everything. We'll text you once we've checked it, usually within 2 working days."}
      </AuthHeading>
      <ul className="flex flex-col gap-3">
        {data.documents.map((d) => <DocumentRow key={d.key} token={token} doc={d} open={data.open} />)}
      </ul>
      <p className="text-sm text-muted-foreground">PDF, photo (JPG or PNG), CSV or Excel, up to 10 MB each. You can replace anything that hasn't been checked yet.</p>
    </div>
  )
}

function DocumentRow({ token, doc, open }: { token: string; doc: Doc; open: boolean }) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const send = useMutation({
    mutationFn: (file: File) => sendApplicationDocument(token, doc.key, file),
    onSuccess: (data) => qc.setQueryData(["application-documents", token], data),
    onError: (e) => setError(e instanceof ApiError ? (e.fieldErrors.file?.[0] ?? e.message) : "Couldn't send it. Try again."),
  })
  const phone = doc.key === "phone"
  const badge = stateBadge[doc.state]

  return (
    <li className="flex flex-col gap-2 rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        {phone ? <Phone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : <badge.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="flex min-w-0 grow flex-col">
          <span className="font-medium">{doc.label}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {phone ? (doc.state === "verified" ? "SchoolShop confirmed your number." : "SchoolShop will call you to confirm.") : (doc.fileName ?? "Nothing sent yet")}
          </span>
        </span>
        {!phone && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      {open && doc.canUpload && (
        <Button type="button" variant={doc.state === "missing" || doc.state === "failed" ? "default" : "outline"} size="sm" className="self-start" disabled={send.isPending} asChild>
          <label className="cursor-pointer">
            <Paperclip aria-hidden /> {send.isPending ? "Sending…" : doc.state === "missing" ? "Choose file" : "Replace file"}
            <input
              type="file"
              accept={orgDocumentAccept}
              className="sr-only"
              aria-label={`Send ${doc.label}`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                setError(null)
                if (!file) return
                if (file.size > orgDocumentMaxBytes) return setError(`${file.name} is over 10 MB. Save a smaller copy and choose that.`)
                send.mutate(file)
              }}
            />
          </label>
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </li>
  )
}
