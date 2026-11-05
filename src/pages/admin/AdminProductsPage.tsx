import { useState } from "react"
import { Dialog } from "radix-ui"
import { RotateCcw, Search, ShieldOff } from "lucide-react"

import { PageHeader } from "@/components/common/PageHeader"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import * as endpoints from "@/lib/api/endpoints"
import { useAdminProductAction, useAdminProducts } from "@/lib/api/queries"
import type { AdminProduct } from "@/lib/api/schemas"
import { formatKes } from "@/lib/format"
import { errorText } from "@/lib/settings"

/** Products publish without anyone approving them, so this is where staff take a bad one out of the shop. */
export function AdminProductsPage() {
  const [search, setSearch] = useState("")
  const products = useAdminProducts(search.trim())
  const [takingDown, setTakingDown] = useState<AdminProduct | null>(null)
  return (
    <>
      <PageHeader eyebrow="Publishers publish without approval. Take down anything that shouldn't be in the shop" title="Products" />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search by title, ISBN or publisher" placeholder="Search by title, ISBN or publisher" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <QueryBoundary query={products}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center text-muted-foreground">No products match.</div>
          ) : (
            <div className="rounded-2xl border bg-card p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => <Row key={p.id} p={p} onTakeDown={() => setTakingDown(p)} />)}
                </TableBody>
              </Table>
            </div>
          )
        }
      </QueryBoundary>
      <TakeDownDialog key={takingDown?.id ?? "none"} product={takingDown} onClose={() => setTakingDown(null)} />
    </>
  )
}

function Row({ p, onTakeDown }: { p: AdminProduct; onTakeDown: () => void }) {
  const restore = useAdminProductAction(() => endpoints.restoreProduct(p.id))
  return (
    <TableRow>
      <TableCell>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{p.title}</span>
          <span className="text-[13px] text-muted-foreground">{p.gradeLabel}{p.isbn ? ` · ${p.isbn}` : ""}</span>
          {p.takenDown && <span className="text-[13px] text-destructive">{p.takenDown.reason}</span>}
          {restore.error && <span role="alert" className="text-[13px] font-medium text-destructive">{errorText(restore.error)}</span>}
        </span>
      </TableCell>
      <TableCell>{p.publisherName}</TableCell>
      <TableCell className="text-right">{formatKes(p.priceCents)}</TableCell>
      <TableCell>{p.takenDown ? <Badge variant="destructive">Taken down</Badge> : <Badge variant="success">In the shop</Badge>}</TableCell>
      <TableCell className="text-right">
        {p.takenDown ? (
          <Button variant="outline" size="sm" disabled={restore.isPending} onClick={() => restore.mutate(undefined)} aria-label={`Restore ${p.title}`}>
            <RotateCcw aria-hidden /> {restore.isPending ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-destructive" onClick={onTakeDown} aria-label={`Take down ${p.title}`}>
            <ShieldOff aria-hidden /> Take down
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function TakeDownDialog({ product, onClose }: { product: AdminProduct | null; onClose: () => void }) {
  const [reason, setReason] = useState("")
  const takeDown = useAdminProductAction((vars: { id: string; reason: string }) => endpoints.takeDownProduct(vars.id, vars.reason))
  return (
    <Dialog.Root open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-3xl bg-surface p-6 outline-none">
          <Dialog.Title className="font-display text-xl font-semibold">Take down {product?.title}?</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            It leaves the shop straight away and can't be ordered from school lists, and {product?.publisherName} can't publish it until you restore it. Orders already paid for aren't affected.
          </Dialog.Description>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Reason (the publisher sees this)
            <Input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {takeDown.error && <p role="alert" className="text-sm font-medium text-destructive">{errorText(takeDown.error)}</p>}
          <div className="flex gap-3">
            <Dialog.Close asChild><Button variant="outline" className="grow">Keep it in the shop</Button></Dialog.Close>
            <Button
              variant="destructive"
              className="grow"
              disabled={!reason.trim() || takeDown.isPending}
              onClick={() => product && takeDown.mutate({ id: product.id, reason: reason.trim() }, { onSuccess: onClose })}
            >
              {takeDown.isPending ? "Taking down…" : "Take down"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
