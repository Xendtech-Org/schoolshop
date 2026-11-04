import { useDeferredValue, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "react-router"
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, FileUp, MessageSquare, Plus, Search, UserPlus, X } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/common/PageHeader"
import { Sheet } from "@/components/common/Sheet"
import { QueryBoundary } from "@/components/common/QueryBoundary"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import * as endpoints from "@/lib/api/endpoints"
import { useRoster, useRosterMutation } from "@/lib/api/queries"
import type { ClassRoster, Student, StudentImportResult } from "@/lib/api/schemas"
import { normaliseKenyanPhone } from "@/lib/format"
import { errorText } from "@/lib/settings"
import { cn } from "@/lib/utils"

type Show = "all" | "unlinked" | "nophone"
const shows: { id: Show; label: string }[] = [
  { id: "all", label: "All students" },
  { id: "unlinked", label: "Parent not on SchoolShop" },
  { id: "nophone", label: "No parent phone" },
]
const PAGE = 25

export function SchoolStudentsPage() {
  const roster = useRoster()
  return <QueryBoundary query={roster}>{(data) => <Students data={data} />}</QueryBoundary>
}

function Students({ data }: { data: ClassRoster }) {
  const [params, setParams] = useSearchParams()
  const className = params.get("class") ?? ""
  const [show, setShow] = useState<Show>("all")
  const [search, setSearch] = useState("")
  const q = useDeferredValue(search.trim().toLowerCase())
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Student | "new" | null>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const invite = useRosterMutation(endpoints.inviteParents)

  const scoped = useMemo(
    () => data.students.filter((s) => (!className || s.className === className) && (!q || `${s.name} ${s.admissionNo} ${s.parentName ?? ""}`.toLowerCase().includes(q))),
    [data.students, className, q]
  )
  const counts = { all: scoped.length, unlinked: scoped.filter((s) => !s.parentLinked).length, nophone: scoped.filter((s) => !s.parentPhone).length }
  const shown = show === "all" ? scoped : show === "unlinked" ? scoped.filter((s) => !s.parentLinked) : scoped.filter((s) => !s.parentPhone)
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages - 1)

  const total = data.students.length
  const linkedAll = data.students.filter((s) => s.parentLinked).length
  const noPhone = data.students.filter((s) => !s.parentPhone).length
  const toInvite = data.students.filter((s) => s.parentPhone && !s.parentLinked && (!className || s.className === className)).length
  const emptyClasses = data.classes.filter((c) => c.students === 0)
  const grades = [...new Set(data.classes.map((c) => c.gradeName))]
  const gradesWithStudents = grades.filter((g) => data.classes.some((c) => c.gradeName === g && c.students > 0))

  const pickClass = (c: string) => {
    setParams(c ? { class: c } : {}, { replace: true })
    setPage(0)
  }

  return (
    <>
      <PageHeader
        eyebrow={`${total} students in ${data.classes.length - emptyClasses.length} classes`}
        title="Classes & students"
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}><FileUp aria-hidden /> Import from spreadsheet</Button>
            <Button onClick={() => setEditing("new")}><UserPlus aria-hidden /> Add student</Button>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard label="Students" value={total} hint={emptyClasses.length ? `${emptyClasses.length} classes still empty` : "Every class has students"} />
        <StatCard label="Parents on SchoolShop" value={<>{linkedAll} <span className="text-base font-medium text-muted-foreground">of {total}</span></>} hint={`${Math.round((linkedAll / Math.max(total, 1)) * 100)}% have linked their child`} />
        <StatCard label="No parent phone" value={noPhone} hint="They can't get reminders or codes" />
        <StatCard label="Classes" value={data.classes.length} hint={`${grades.length} grades this year`} />
      </section>

      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-success-bg p-4 text-success-fg">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="grow text-[15px]">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="-m-2 flex size-10 items-center justify-center rounded-lg hover:bg-white/50"><X className="size-4" aria-hidden /></button>
        </div>
      )}

      <section aria-labelledby="code-h" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-teal-light p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="code-h" className="font-semibold">Parents link their children with your school code</h2>
          <span className="flex items-center gap-3">
            <span className="font-display text-2xl font-semibold tracking-[0.12em] text-accent-text">{data.joinCode}</span>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(data.joinCode).then(() => setNotice("School code copied."))}><Copy aria-hidden /> Copy</Button>
          </span>
          <span className="text-sm text-ink-2">They also need their child's admission number.</span>
        </div>
        <Button
          variant="outline"
          className="h-auto min-h-11 max-w-full shrink bg-surface py-2 text-left whitespace-normal"
          disabled={toInvite === 0 || invite.isPending}
          onClick={() => invite.mutate(className || null, { onSuccess: (r) => setNotice(`Sent the school code to ${r.sent} parent${r.sent === 1 ? "" : "s"}${className ? ` in ${className}` : ""}.`) })}
        >
          <MessageSquare aria-hidden /> SMS the code to {toInvite} parent{toInvite === 1 ? "" : "s"} not on SchoolShop{className ? ` in ${className}` : ""}
        </Button>
      </section>

      <section aria-labelledby="classes-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="classes-h" className="font-display text-xl font-semibold">Classes</h2>
          <AddClass onDone={setNotice} />
        </div>
        {data.classes.length === 0 && (
          <p className="rounded-2xl border border-dashed bg-card p-4 text-[15px]">Add your classes first, like 4 East in Grade 4. Then add or import the students in each.</p>
        )}
        <div className="flex flex-col gap-4">
          {gradesWithStudents.map((g) => (
            <div key={g} className="flex flex-col gap-2">
              <span className="text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{g}</span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-2.5">
                {data.classes.filter((c) => c.gradeName === g && c.students > 0).map((c) => {
                  const on = className === c.className
                  return (
                    <button
                      key={c.className}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickClass(on ? "" : c.className)}
                      className={cn("flex flex-col gap-1.5 rounded-2xl border bg-card p-3.5 text-left transition-colors hover:border-line-strong", on && "border-primary ring-1 ring-primary")}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{c.className}</span>
                        <span className="text-sm text-muted-foreground">{c.students} students</span>
                      </span>
                      <span className="text-[13px] text-muted-foreground">{c.teacher ? `Teacher: ${c.teacher}` : "No teacher on SchoolShop"}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.linked / c.students) * 100}%` }} />
                      </span>
                      <span className="text-[13px] text-muted-foreground">{c.linked} of {c.students} parents on SchoolShop</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {emptyClasses.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-semibold">{emptyClasses.length} classes have no students yet</span>
                  <span className="text-sm text-muted-foreground">Parents in these classes can't link their children until they're on the roll.</span>
                </span>
                <Button variant="outline" onClick={() => setImporting(true)}><FileUp aria-hidden /> Import class lists</Button>
              </div>
              <div role="group" aria-label="Empty classes" className="flex flex-wrap gap-1.5">
                {emptyClasses.map((c) => <EmptyClass key={c.className} className={c.className} onDone={setNotice} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="students-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="students-h" className="font-display text-xl font-semibold">{className || "All"} students</h2>
          {className && <Button variant="link" className="h-auto px-0" onClick={() => pickClass("")}>Show every class</Button>}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="relative">
              <span className="sr-only">Search students</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Name, admission no. or parent" className="pl-10" />
            </label>
            <NativeSelect aria-label="Class" value={className} onChange={(e) => pickClass(e.target.value)}>
              <option value="">All classes</option>
              {data.classes.map((c) => <option key={c.className}>{c.className}</option>)}
            </NativeSelect>
          </div>
          <div role="group" aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {shows.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={show === s.id}
                onClick={() => { setShow(s.id); setPage(0) }}
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap", show === s.id ? "bg-primary text-primary-foreground" : "border bg-surface hover:bg-paper")}
              >
                {s.label}
                <span className={cn("rounded-full px-1.5 text-xs", show === s.id ? "bg-white/20" : "bg-secondary")}>{counts[s.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-5 py-10 text-center text-muted-foreground">
            {className && data.classes.find((c) => c.className === className)?.students === 0 ? (
              <>
                <p>{className} has no students yet.</p>
                <Button variant="outline" onClick={() => setImporting(true)}><FileUp aria-hidden /> Import the class list</Button>
              </>
            ) : (
              <p>No students match.</p>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>On SchoolShop</TableHead>
                    <TableHead><span className="sr-only">Action</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.slice(current * PAGE, (current + 1) * PAGE).map((s) => (
                    <TableRow key={s.studentId}>
                      <TableCell><span className="flex flex-col"><span className="font-semibold">{s.name}</span><span className="text-[13px] text-muted-foreground">{s.admissionNo}</span></span></TableCell>
                      <TableCell>{s.className}</TableCell>
                      <TableCell><Parent s={s} onAdd={() => setEditing(s)} /></TableCell>
                      <TableCell>{s.parentLinked ? <Badge variant="success">Linked</Badge> : <Badge variant="secondary">Not yet</Badge>}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col gap-2.5 md:hidden">
              {shown.slice(current * PAGE, (current + 1) * PAGE).map((s) => (
                <li key={s.studentId} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col"><span className="font-semibold">{s.name}</span><span className="text-[13px] text-muted-foreground">{s.className} · {s.admissionNo}</span></span>
                    {s.parentLinked ? <Badge variant="success">Linked</Badge> : <Badge variant="secondary">Not yet</Badge>}
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <Parent s={s} onAdd={() => setEditing(s)} />
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</Button>
                  </div>
                </li>
              ))}
            </ul>
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Showing {current * PAGE + 1}–{Math.min((current + 1) * PAGE, shown.length)} of {shown.length}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden /></Button>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden /></Button>
              </div>
            </nav>
          </>
        )}
      </section>

      <StudentSheet
        student={editing}
        classes={data.classes.map((c) => c.className)}
        defaultClass={className}
        onClose={() => setEditing(null)}
        onDone={(text) => { setEditing(null); setNotice(text) }}
      />
      <ImportSheet open={importing} classes={data.classes.map((c) => c.className)} onClose={() => setImporting(false)} onDone={(text) => { setImporting(false); setNotice(text) }} />
    </>
  )
}

function Parent({ s, onAdd }: { s: Student; onAdd: () => void }) {
  if (!s.parentPhone) {
    return (
      <span className="flex flex-col items-start">
        {s.parentName && <span>{s.parentName}</span>}
        <Button variant="link" className="h-auto px-0 text-warn-fg" onClick={onAdd}>Add parent phone</Button>
      </span>
    )
  }
  return (
    <span className="flex flex-col">
      <span>{s.parentName ?? "Parent"}</span>
      <span className="text-[13px] text-muted-foreground">{s.parentPhone}</span>
    </span>
  )
}

/* ── Add / edit one student ── */

const studentFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the student's full name"),
  admissionNo: z.string().trim().min(2, "Enter their admission number"),
  className: z.string().min(1, "Choose a class"),
  parentName: z.string().trim(),
  parentPhone: z.string().trim().refine((v) => v === "" || normaliseKenyanPhone(v) !== null, "Enter a Kenyan mobile number"),
})
type StudentValues = z.infer<typeof studentFormSchema>

function StudentSheet({ student, classes, defaultClass, onClose, onDone }: { student: Student | "new" | null; classes: string[]; defaultClass: string; onClose: () => void; onDone: (text: string) => void }) {
  const isNew = student === "new"
  return (
    <Sheet
      open={student !== null}
      onClose={onClose}
      title={isNew ? "Add a student" : student ? student.name : ""}
      description={isNew ? "They show up in parent orders and collection straight away." : student ? `${student.className} · ${student.admissionNo}` : ""}
    >
      {student !== null && <StudentForm key={isNew ? "new" : student.studentId} student={isNew ? null : student} classes={classes} defaultClass={defaultClass} onDone={onDone} />}
    </Sheet>
  )
}

function StudentForm({ student, classes, defaultClass, onDone }: { student: Student | null; classes: string[]; defaultClass: string; onDone: (text: string) => void }) {
  const form = useForm<StudentValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { name: student?.name ?? "", admissionNo: student?.admissionNo ?? "", className: student?.className ?? defaultClass, parentName: student?.parentName ?? "", parentPhone: "" },
  })
  const save = useRosterMutation((v: StudentValues) => {
    const phone = v.parentPhone ? normaliseKenyanPhone(v.parentPhone) : null
    return student
      ? endpoints.updateStudent(student.studentId, { name: v.name, className: v.className, parentName: v.parentName || null, ...(phone ? { parentPhone: phone } : {}) })
      : endpoints.addStudent({ name: v.name, admissionNo: v.admissionNo, className: v.className, parentName: v.parentName || null, parentPhone: phone })
  })
  const remove = useRosterMutation(endpoints.removeStudent)
  const fail = (e: Error) => {
    const f = e instanceof ApiError ? e.fieldErrors : {}
    const field = (["name", "admissionNo", "className", "parentPhone"] as const).find((k) => f[k])
    form.setError(field ?? "root", { message: field ? f[field][0] : errorText(e) })
  }

  return (
    <Form {...form}>
      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v, { onSuccess: () => onDone(student ? `${v.name} updated.` : `${v.name} added to ${v.className}.`), onError: fail }))}>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="off" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="admissionNo" render={({ field }) => (
            <FormItem><FormLabel>Admission number</FormLabel><FormControl><Input disabled={!!student} autoCapitalize="characters" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="className" render={({ field }) => (
            <FormItem><FormLabel>Class</FormLabel><FormControl>
              <NativeSelect {...field}><option value="">Choose a class</option>{classes.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="parentName" render={({ field }) => (
          <FormItem><FormLabel>Parent or guardian (optional)</FormLabel><FormControl><Input autoComplete="off" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="parentPhone" render={({ field }) => (
          <FormItem>
            <FormLabel>Parent's phone{student?.parentPhone ? " (new number)" : ""}</FormLabel>
            <FormControl><Input type="tel" inputMode="tel" placeholder={student?.parentPhone ?? "0712 345 678"} {...field} /></FormControl>
            <FormDescription>{student?.parentPhone ? "Leave empty to keep the number on file." : "For order reminders and the collection code."}</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        {form.formState.errors.root && <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : student ? "Save" : "Add student"}</Button>
          {student && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              disabled={remove.isPending}
              onClick={() => window.confirm(`Remove ${student.name} from the school roll?`) && remove.mutate(student.studentId, { onSuccess: () => onDone(`${student.name} removed.`), onError: fail })}
            >
              Remove from roll
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}

/* ── Import from a spreadsheet ── */

type ImportRow = { name: string; admissionNo: string; className: string; parentPhone: string | null }

/** Splits CSV text into rows, honouring quoted fields. */
function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === "," || ch === "\t") { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

/** Finds the name, admission, class and phone columns by their header text. */
function toImportRows(text: string): { rows: ImportRow[]; missing: string[] } {
  const [header = [], ...body] = parseCsv(text)
  const find = (re: RegExp) => header.findIndex((h) => re.test(h.trim().toLowerCase()))
  const cols = { name: find(/name|student/), admissionNo: find(/adm/), className: find(/class|stream/), parentPhone: find(/phone|mobile|tel/) }
  const missing = (["name", "admissionNo", "className"] as const).filter((k) => cols[k] < 0).map((k) => ({ name: "name", admissionNo: "admission number", className: "class" })[k])
  const rows = body.map((r) => {
    const raw = cols.parentPhone >= 0 ? (r[cols.parentPhone] ?? "").trim() : ""
    return {
      name: (r[cols.name] ?? "").trim(),
      admissionNo: (r[cols.admissionNo] ?? "").trim(),
      className: (r[cols.className] ?? "").trim(),
      parentPhone: raw ? (normaliseKenyanPhone(raw) ?? raw) : null,
    }
  })
  return { rows, missing }
}

const template = "Name,Admission number,Class,Parent phone\nWanjiru Kamau,GH/2027/0601,5 East,0712 345 678\nBaraka Otieno,GH/2027/0602,5 East,\n"

function ImportSheet({ open, classes, onClose, onDone }: { open: boolean; classes: string[]; onClose: () => void; onDone: (text: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Import from a spreadsheet" description="Paste or upload a CSV with a name, admission number and class for each student.">
      {open && <ImportForm classes={classes} onDone={onDone} />}
    </Sheet>
  )
}

function ImportForm({ classes, onDone }: { classes: string[]; onDone: (text: string) => void }) {
  const [text, setText] = useState("")
  const [checked, setChecked] = useState<StudentImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useRosterMutation(({ rows, dryRun }: { rows: ImportRow[]; dryRun: boolean }) => endpoints.importStudents(rows, dryRun))
  const parsed = text.trim() ? toImportRows(text) : null

  const check = () => {
    setError(null)
    if (!parsed) return setError("Paste the list or choose a file first.")
    if (parsed.missing.length) return setError(`The first row needs column headings for ${parsed.missing.join(", ")}.`)
    run.mutate({ rows: parsed.rows, dryRun: true }, { onSuccess: setChecked, onError: (e) => setError(errorText(e, "rows")) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border bg-surface px-4 text-[15px] font-semibold hover:bg-paper">
          <FileUp className="size-4" aria-hidden /> Choose a CSV file
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) f.text().then((t) => { setText(t); setChecked(null) })
            }}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            const a = document.createElement("a")
            a.href = URL.createObjectURL(new Blob([template], { type: "text/csv" }))
            a.download = "students-template.csv"
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          <Download aria-hidden /> Template
        </Button>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Or paste it here</span>
        <Textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); setChecked(null) }} placeholder={template} className="font-mono text-[13px]" />
      </label>
      <p className="text-[13px] text-muted-foreground">Classes must match exactly: {classes.slice(0, 6).join(", ")}…</p>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

      {checked && parsed && (
        <div className="flex flex-col gap-3 rounded-xl bg-paper p-4">
          <p className="font-semibold">{checked.valid} of {parsed.rows.length} rows are ready to import.</p>
          {checked.errors.length > 0 && (
            <ul aria-label="Rows to fix" className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm text-warn-fg">
              {checked.errors.map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
            </ul>
          )}
          {checked.errors.length > 0 && <p className="text-sm text-muted-foreground">Rows with problems are skipped. Fix them and import again later.</p>}
        </div>
      )}

      {checked && parsed && checked.valid > 0 ? (
        <Button
          size="lg"
          disabled={run.isPending}
          onClick={() => run.mutate({ rows: parsed.rows, dryRun: false }, { onSuccess: (r) => onDone(`Imported ${r.created} student${r.created === 1 ? "" : "s"}.${r.errors.length ? ` ${r.errors.length} rows skipped.` : ""}`), onError: (e) => setError(errorText(e, "rows")) })}
        >
          {run.isPending ? "Importing…" : `Import ${checked.valid} student${checked.valid === 1 ? "" : "s"}`}
        </Button>
      ) : (
        <Button size="lg" onClick={check} disabled={run.isPending}>{run.isPending ? "Checking…" : "Check the list"}</Button>
      )}
    </div>
  )
}

/* ── Classes ── */

const GRADES = ["PP1", "PP2", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)]

function AddClass({ onDone }: { onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [grade, setGrade] = useState("Grade 1")
  const [name, setName] = useState("")
  const add = useRosterMutation(endpoints.addClass)
  const error = add.error ? errorText(add.error, "className") : null
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden /> Add a class</Button>
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault()
        add.mutate({ gradeName: grade, className: name.trim() }, { onSuccess: () => { onDone(`Added ${name.trim()}.`); setName(""); setOpen(false) } })
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Grade
        <NativeSelect value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32">{GRADES.map((g) => <option key={g}>{g}</option>)}</NativeSelect>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Class name
        <Input value={name} onChange={(e) => { setName(e.target.value); add.reset() }} placeholder="e.g. 4 East" className="w-40" autoFocus />
      </label>
      <Button type="submit" disabled={!name.trim() || add.isPending}>Add</Button>
      <Button type="button" variant="ghost" onClick={() => { setOpen(false); add.reset() }}>Cancel</Button>
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </form>
  )
}

/** A class with no students yet; it can be removed. */
function EmptyClass({ className, onDone }: { className: string; onDone: (text: string) => void }) {
  const remove = useRosterMutation(endpoints.removeClass)
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {className}
      <button
        type="button"
        aria-label={`Remove ${className}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(className, { onSuccess: () => onDone(`Removed ${className}.`), onError: (e) => onDone(errorText(e)) })}
        className="flex size-5 items-center justify-center rounded-full hover:bg-ink/10"
      >
        <X className="size-3" aria-hidden />
      </button>
    </Badge>
  )
}
