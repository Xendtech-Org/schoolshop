import { useState } from "react"
import { Download, FileText, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { downloadCatalogFile } from "@/lib/api/endpoints"
import type { CatalogFile } from "@/lib/api/schemas"
import { formatBytes } from "@/lib/format"

/**
 * Files attached to a title. They aren't public, so "Download" fetches each one
 * with the signed-in person's token rather than linking to it.
 */
export function FileList({ files, onRemove, removingId }: { files: CatalogFile[]; onRemove?: (file: CatalogFile) => void; removingId?: string | null }) {
  const [error, setError] = useState<string | null>(null)
  if (files.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="divide-y rounded-xl border text-sm">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
            <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate font-medium">{f.label}</span>
              <span className="truncate text-[13px] text-muted-foreground">{f.name} · {formatBytes(f.sizeBytes)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Download ${f.label}`}
              onClick={() => {
                setError(null)
                downloadCatalogFile(f.id, f.name).catch((e: Error) => setError(e.message))
              }}
            >
              <Download aria-hidden />
            </Button>
            {onRemove && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" aria-label={`Remove ${f.label}`} disabled={removingId === f.id} onClick={() => onRemove(f)}>
                <Trash2 aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
