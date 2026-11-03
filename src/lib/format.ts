const kes = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 })

/** 375000 → "KES 3,750". Prices are integer cents; KES is shown without decimals. */
export function formatKes(cents: number) {
  return `KES ${kes.format(Math.round(cents / 100))}`
}

const day = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short" })
const dayLong = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric" })

/** "2027-01-10" → "10 Jan". Date-only strings are treated as calendar dates, not UTC instants. */
export function formatDay(isoDate: string) {
  return day.format(parseDate(isoDate))
}

export function formatDayLong(isoDate: string) {
  return dayLong.format(parseDate(isoDate))
}

/** Whole days from today to a "YYYY-MM-DD" date (negative once it has passed). */
export function daysUntil(isoDate: string) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parseDate(isoDate).getTime() - start.getTime()) / 86_400_000)
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

/** Kenyan mobile numbers: 07XX / 01XX, or with 254 / +254. Returns 2547XXXXXXXX. */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "")
  const m = digits.match(/^(?:254|0)?([17]\d{8})$/)
  return m ? `254${m[1]}` : null
}

export function maskPhone(e164: string) {
  const local = e164.replace(/^254/, "0")
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`
}

/** Sign-in identifier: an email (lower-cased) or a Kenyan phone number as 2547XXXXXXXX. */
export function normaliseIdentifier(input: string): string | null {
  const v = input.trim()
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : null
  return normaliseKenyanPhone(v)
}

/** 1536 → "1.5 KB", 2_400_000 → "2.3 MB". */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
