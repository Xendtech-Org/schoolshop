import { useMemo, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import { Images } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useBulkCoverUpload } from "@/lib/api/queries"
import type { CatalogItem } from "@/lib/api/schemas"

type Match = { file: File; item: CatalogItem }
type Skipped = { name: string; reason: string }

const MAX_MB = 5
/** Compare names without case, spaces or punctuation: "Fayo Is Lost" matches "fayo-is-lost.png". */
const key = (text: string) => text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "")
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** Each photo goes to the product whose ISBN or exact title is its file name. A name that fits several titles is left out rather than guessed. */
function matchPhotos(files: File[], items: CatalogItem[]) {
  const byIsbn = new Map<string, CatalogItem>()
  const byTitle = new Map<string, CatalogItem[]>()
  for (const item of items) {
    if (item.isbn) byIsbn.set(key(item.isbn), item)
    const title = key(item.title)
    byTitle.set(title, [...(byTitle.get(title) ?? []), item])
  }
  const matches: Match[] = []
  const skipped: Skipped[] = []
  const taken = new Map<string, string>()
  for (const file of files) {
    const stem = key(file.name.replace(/\.[^.]+$/, ""))
    const sameTitle = byTitle.get(stem) ?? []
    const item = byIsbn.get(stem) ?? (sameTitle.length === 1 ? sameTitle[0] : undefined)
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) skipped.push({ name: file.name, reason: "Use a JPG, PNG or WebP image." })
    else if (file.size > MAX_MB * 1024 * 1024) skipped.push({ name: file.name, reason: `Keep it under ${MAX_MB} MB.` })
    else if (sameTitle.length > 1 && !item) skipped.push({ name: file.name, reason: `${sameTitle.length} products have this title. Name the photo with the ISBN instead.` })
    else if (!item) skipped.push({ name: file.name, reason: "No product has this ISBN or title." })
    else if (taken.has(item.id)) skipped.push({ name: file.name, reason: `${taken.get(item.id)} is already going on this product.` })
    else {
      taken.set(item.id, file.name)
      matches.push({ file, item })
    }
  }
  return { matches, skipped }
}

/**
 * Covers for many products at once. Nothing uploads until the publisher has seen
 * what matched. Products that already have a cover keep it unless they say
 * otherwise, so running it again after a failure only fills the gaps.
 */
export function BulkCoverUpload({ items }: { items: CatalogItem[] }) {
  const input = useRef<HTMLInputElement>(null)
  const stop = useRef(false)
  const run = useBulkCoverUpload()
  const [files, setFiles] = useState<File[] | null>(null)
  const [replace, setReplace] = useState(false)
  const [done, setDone] = useState(0)

  const { matches, skipped } = useMemo(() => matchPhotos(files ?? [], items), [files, items])
  const withCover = matches.filter((m) => m.item.coverUrl).length
  const jobs = replace ? matches : matches.filter((m) => !m.item.coverUrl)
  const result = run.data

  const close = () => {
    if (run.isPending) return
    setFiles(null)
    setReplace(false)
    setDone(0)
    run.reset()
  }
  const start = () => {
    stop.current = false
    setDone(0)
    run.mutate({
      jobs: jobs.map((m) => ({ id: m.item.id, file: m.file })),
      onProgress: setDone,
      shouldStop: () => stop.current,
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={input}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (picked.length) setFiles(picked)
        }}
      />
      <Button variant="outline" onClick={() => input.current?.click()}>
        <Images aria-hidden /> Upload photos
      </Button>
      <span className="text-xs text-muted-foreground">Name each photo with the ISBN or title</span>

      <Dialog.Root open={files !== null} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(600px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 outline-none">
            <Dialog.Title className="font-display text-xl font-semibold">{result ? "Photos uploaded" : run.isPending ? "Uploading photos…" : "Upload product photos"}</Dialog.Title>

            {result ? (
              <>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Added {plural(result.uploaded, "photo")}.
                  {result.failed.length > 0 && ` ${plural(result.failed.length, "photo")} couldn't be used.`}
                  {result.stopped > 0 && ` Stopped with ${result.stopped} still to go.`}
                </Dialog.Description>
                <Problems title="Not uploaded" rows={result.failed} />
              </>
            ) : run.isPending ? (
              <>
                <Dialog.Description className="text-sm text-muted-foreground">{done} of {jobs.length} done. Keep this page open.</Dialog.Description>
                <progress className="w-full accent-ink" value={done} max={jobs.length} aria-label="Upload progress" />
              </>
            ) : (
              <>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {plural(matches.length, "photo")} matched a product{skipped.length > 0 && `, ${skipped.length} didn't`}. Check them before uploading.
                </Dialog.Description>
                {matches.length > 0 && (
                  <ul className="max-h-60 divide-y overflow-y-auto rounded-xl border text-sm">
                    {matches.map((m) => (
                      <li key={m.item.id} className="flex flex-col px-4 py-2">
                        <span className="font-medium">{m.item.title}</span>
                        <span className="text-xs break-all text-muted-foreground">{m.file.name}{m.item.coverUrl ? " · already has a cover" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {withCover > 0 && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox className="mt-0.5" checked={replace} onCheckedChange={(v) => setReplace(v === true)} />
                    Replace the cover on {plural(withCover, "product")} that already {withCover === 1 ? "has" : "have"} one
                  </label>
                )}
                <Problems title="Left out" rows={skipped} />
              </>
            )}

            {run.error && <p role="alert" className="text-sm font-medium text-destructive">Something went wrong. Check your connection and try again.</p>}

            <div className="flex gap-3">
              {run.isPending ? (
                <Button variant="outline" className="grow" onClick={() => { stop.current = true }}>Stop</Button>
              ) : result ? (
                <Button className="grow" onClick={close}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" className="grow" onClick={close}>Cancel</Button>
                  <Button className="grow" onClick={start} disabled={jobs.length === 0}>Upload {plural(jobs.length, "photo")}</Button>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function Problems({ title, rows }: { title: string; rows: { name: string; reason: string }[] }) {
  if (!rows.length) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col px-4 py-2">
            <span className="font-medium break-all">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
