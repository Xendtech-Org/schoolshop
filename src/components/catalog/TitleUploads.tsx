import { useId, useRef, useState } from "react"
import { ImagePlus, Trash2, Upload } from "lucide-react"

import { FileList } from "@/components/catalog/FileList"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import type { CatalogFileKind } from "@/lib/api/endpoints"
import { useCatalog, useCatalogUploads } from "@/lib/api/queries"
import type { CatalogFile, CatalogItem } from "@/lib/api/schemas"

/** The first message the API sent for one of these fields, or its general message. */
const messageFor = (e: unknown, ...fields: string[]) => {
  if (e instanceof ApiError) return fields.map((f) => e.fieldErrors[f]?.[0]).find(Boolean) ?? e.message
  return e instanceof Error ? e.message : "Something went wrong."
}

/**
 * A title's cover, the documents SchoolShop asks for when it reviews the title,
 * and the digital resources that come with it. Each upload saves straight away.
 */
export function TitleUploads({ itemId }: { itemId: string }) {
  const catalog = useCatalog()
  const item = catalog.data?.find((i) => i.id === itemId)
  if (!item) return null
  return (
    <section aria-labelledby="uploads-title" className="flex flex-col gap-5 border-t pt-5">
      <div className="flex flex-col gap-1">
        <h3 id="uploads-title" className="font-semibold">Cover and files</h3>
        <p className="text-sm text-muted-foreground">These save as soon as you upload them.</p>
      </div>
      <CoverUpload item={item} />
      <FilesUpload
        item={item}
        kind="document"
        title="For SchoolShop's review"
        hint="E.g. the KICD approval letter or sample pages. Only SchoolShop sees these. PDF, JPG or PNG, up to 10 MB."
        placeholder="KICD approval letter"
        accept=".pdf,.jpg,.jpeg,.png"
      />
      <FilesUpload
        item={item}
        kind="resource"
        title="Digital resources"
        hint="Comes with the title, e.g. an e-book or worksheets. Parents can download them once they've bought it. PDF, EPUB, ZIP, Office, MP3 or MP4, up to 50 MB."
        placeholder="Teacher's guide"
        accept=".pdf,.epub,.zip,.docx,.xlsx,.pptx,.mp3,.mp4"
      />
    </section>
  )
}

function CoverUpload({ item }: { item: CatalogItem }) {
  const input = useRef<HTMLInputElement>(null)
  const { uploadCover, removeCover } = useCatalogUploads()
  const [error, setError] = useState<string | null>(null)
  const busy = uploadCover.isPending || removeCover.isPending

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Cover</span>
      <div className="flex items-center gap-4">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={`Cover of ${item.title}`} className="h-24 w-[72px] shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Shown in the shop and on booklists. JPG, PNG or WebP, up to 5 MB.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Upload aria-hidden /> {uploadCover.isPending ? "Uploading…" : item.coverUrl ? "Replace cover" : "Upload cover"}
            </Button>
            {item.coverUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  removeCover.mutate(item.id, { onError: (e) => setError(messageFor(e)) })
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
          uploadCover.mutate({ id: item.id, file }, { onError: (err) => setError(messageFor(err, "file")) })
        }}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function FilesUpload({ item, kind, title, hint, placeholder, accept }: { item: CatalogItem; kind: CatalogFileKind; title: string; hint: string; placeholder: string; accept: string }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const { uploadFile, removeFile } = useCatalogUploads()
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const files = item.files.filter((f) => f.kind === kind)

  const pick = () => {
    setError(null)
    if (label.trim().length < 2) {
      setError(`Name the file, like ${placeholder}.`)
      return
    }
    input.current?.click()
  }
  const remove = (f: CatalogFile) => {
    setError(null)
    removeFile.mutate({ id: item.id, fileId: f.id }, { onError: (e) => setError(messageFor(e)) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </div>
      <FileList files={files} onRemove={remove} removingId={removeFile.isPending ? removeFile.variables?.fileId : null} />
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">Name for the {kind === "document" ? "document" : "resource"}</label>
        <Input id={id} value={label} placeholder={placeholder} onChange={(e) => { setLabel(e.target.value); setError(null) }}
          onKeyDown={(e) => {
            // It sits inside the title form: Enter picks the file instead of saving the title.
            if (e.key === "Enter") {
              e.preventDefault()
              pick()
            }
          }}
          aria-invalid={!!error} className="h-9" />
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={uploadFile.isPending} onClick={pick}>
          <Upload aria-hidden /> {uploadFile.isPending && uploadFile.variables?.kind === kind ? "Uploading…" : "Add file"}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          uploadFile.mutate(
            { id: item.id, kind, label: label.trim(), file },
            { onSuccess: () => setLabel(""), onError: (err) => setError(messageFor(err, "file", "label", "kind")) }
          )
        }}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
