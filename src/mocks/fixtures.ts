import type {
  AdminOrder,
  AdminOrg,
  AuditCategory,
  AdminOverview,
  Booklist,
  CatalogItem,
  Child,
  Order,
  Product,
  PublisherPayouts,
  PublisherSettings,
  ProductDetail,
  School,
  SchoolBatch,
  SchoolCatalogItem,
  SchoolGrade,
  SchoolDelivery,
  SchoolOrderDetail,
  SchoolSettings,
  SchoolOverview,
  StudentOrderRow,
  User,
} from "@/lib/api/schemas"

/*
 * Sample data for building the UI before the DRF backend exists. Names and
 * figures are illustrative only. Money is in cents (KES 650 → 65000).
 */

const k = (shillings: number) => shillings * 100

export const schools: School[] = [
  { id: "sch-greenhill", slug: "greenhill-academy", name: "Greenhill Academy", town: "Nakuru", county: "Nakuru", verified: true },
  { id: "sch-stmarys", slug: "st-marys-primary", name: "St. Mary's Primary", town: "Eldoret", county: "Uasin Gishu", verified: true },
  { id: "sch-kilimani", slug: "kilimani-primary", name: "Kilimani Primary", town: "Nairobi", county: "Nairobi", verified: true },
  { id: "sch-riverside", slug: "riverside-junior", name: "Riverside Junior School", town: "Kisumu", county: "Kisumu", verified: true },
]

const item = (
  id: string,
  title: string,
  publisherName: string,
  subject: string,
  price: number,
  required = true,
  qtyPerStudent = 1,
  note: string | null = null
) => ({ id, productId: `prd-${id}`, title, publisherName, subject, unitPriceCents: k(price), qtyPerStudent, required, note })

const greenhillBase = {
  schoolId: "sch-greenhill",
  schoolName: "Greenhill Academy",
  termName: "Term 1, 2027",
  orderDeadline: "2027-01-10",
  deliverBy: "2027-01-20",
  status: "published" as const,
}

export const booklists: Booklist[] = [
  {
    ...greenhillBase,
    id: "bl-g4",
    gradeName: "Grade 4",
    classNames: ["4 East", "4 West", "4 North"],
    items: [
      item("g4-math", "Mathematics Activities Grade 4", "Longhorn", "Mathematics", 650),
      item("g4-eng", "English Activities Grade 4", "KLB", "English", 620),
      item("g4-kis", "Kiswahili Shughuli Gredi 4", "Oxford", "Kiswahili", 640, true, 1, "New 2027 edition. Older editions don't match the lessons."),
      item("g4-sci", "Science & Technology Grade 4", "Moran", "Science", 690),
      item("g4-sst", "Social Studies Grade 4", "Longhorn", "Social Studies", 600),
      item("g4-books", "A4 exercise books, 96 pg (×10)", "Kasuku", "Stationery", 550, true, 1, "Covered and labelled with your child's name before delivery."),
      item("g4-dict", "Primary Dictionary", "Oxford", "Reference", 1250, false, 1, "Last year's copy is fine if it's in good condition."),
      item("g4-readers", "Class readers set (4 books)", "Storymoja", "Readers", 1400, false, 1, "Read at home over the term, then swapped in class."),
    ],
  },
  {
    ...greenhillBase,
    id: "bl-g7",
    gradeName: "Grade 7",
    classNames: ["7 Blue", "7 Green", "7 Red"],
    items: [
      item("g7-math", "Mathematics Grade 7", "Longhorn", "Mathematics", 720),
      item("g7-sci", "Integrated Science Grade 7", "Longhorn", "Science", 760),
      item("g7-pts", "Pre-Technical Studies Grade 7", "Longhorn", "Pre-Technical", 700),
      item("g7-eng", "English Grade 7", "KLB", "English", 690),
      item("g7-geo", "Geometry set", "Kasuku", "Stationery", 300),
    ],
  },
  {
    ...greenhillBase,
    id: "bl-g1",
    gradeName: "Grade 1",
    classNames: ["1 Sun", "1 Moon"],
    items: [
      item("g1-eng", "English Activities Grade 1", "KLB", "English", 540),
      item("g1-math", "Mathematics Activities Grade 1", "Longhorn", "Mathematics", 540),
      item("g1-kis", "Kiswahili Shughuli Gredi 1", "Oxford", "Kiswahili", 520),
      item("g1-books", "A5 exercise books (×10)", "Kasuku", "Stationery", 400),
      item("g1-dict", "Picture dictionary", "Oxford", "Reference", 900, false),
    ],
  },
  {
    ...greenhillBase,
    id: "bl-pp2",
    gradeName: "PP2",
    classNames: ["PP2 Rose", "PP2 Lily"],
    items: [
      item("pp2-lang", "Language Activities PP2", "Moran", "Language", 480),
      item("pp2-math", "Mathematical Activities PP2", "Longhorn", "Mathematics", 480),
      item("pp2-env", "Environmental Activities PP2", "KLB", "Environmental", 460),
      item("pp2-crayons", "Wax crayons, 12 colours", "Kasuku", "Stationery", 250),
      item("pp2-draw", "Drawing book A4", "Kasuku", "Stationery", 200, false),
    ],
  },
  {
    ...greenhillBase,
    id: "bl-g8",
    gradeName: "Grade 8",
    classNames: ["8 Blue", "8 Green", "8 Red"],
    status: "draft",
    items: [
      item("g8-math", "Mathematics Grade 8", "Longhorn", "Mathematics", 760),
      item("g8-sci", "Integrated Science Grade 8", "Longhorn", "Science", 790),
      item("g8-eng", "English Grade 8", "KLB", "English", 720),
    ],
  },
]

const publisherCatalogTitles = [
  { title: "Mathematics Activities Grade 4", isbn: "978-9966-36-412-8" },
  { title: "Social Studies Grade 4", isbn: "978-9966-36-430-2" },
  { title: "Mathematics Grade 7", isbn: "978-9966-36-701-3" },
  { title: "Integrated Science Grade 7", isbn: "978-9966-36-715-0" },
]

/** Greenhill's grades this year. PP1 to Grade 6 (other than PP2, 1 and 4) have no list yet. */
export const schoolGrades: SchoolGrade[] = [
  { gradeName: "PP1", classNames: ["PP1 Rose", "PP1 Lily"], students: 56 },
  { gradeName: "PP2", classNames: ["PP2 Rose", "PP2 Lily"], students: 60 },
  { gradeName: "Grade 1", classNames: ["1 Sun", "1 Moon"], students: 90 },
  { gradeName: "Grade 2", classNames: ["2 Sun", "2 Moon"], students: 84 },
  { gradeName: "Grade 3", classNames: ["3 Sun", "3 Moon"], students: 88 },
  { gradeName: "Grade 4", classNames: ["4 East", "4 West", "4 North"], students: 120 },
  { gradeName: "Grade 5", classNames: ["5 East", "5 West", "5 North"], students: 114 },
  { gradeName: "Grade 6", classNames: ["6 East", "6 West", "6 North"], students: 109 },
  { gradeName: "Grade 7", classNames: ["7 Blue", "7 Green", "7 Red"], students: 270 },
  { gradeName: "Grade 8", classNames: ["8 Blue", "8 Green", "8 Red"], students: 252 },
]

/** Everything a school can add to a list: titles already on lists, extra publisher titles, stationery. */
export const schoolCatalog: SchoolCatalogItem[] = (() => {
  const category = (subject: string): SchoolCatalogItem["category"] =>
    /stationery|supplies|exercise/i.test(subject) ? "stationery" : /reader/i.test(subject) ? "reader" : /reference|dictionary/i.test(subject) ? "reference" : "textbook"
  const gradeOf = (title: string) => {
    const n = title.match(/(?:Grade|Gredi) (\d)/)?.[1]
    return n ? `Grade ${n}` : (title.match(/PP\d/)?.[0] ?? "All grades")
  }
  const items = new Map<string, SchoolCatalogItem>()
  for (const b of booklists) {
    for (const i of b.items) {
      items.set(i.productId, { productId: i.productId, title: i.title, publisherName: i.publisherName, subject: i.subject, gradeLabel: gradeOf(i.title), category: category(i.subject), isbn: null, priceCents: i.unitPriceCents })
    }
  }
  const extra: [string, string, string, string, number, string | null][] = [
    ["g4-cre", "CRE Activities Grade 4", "KLB", "CRE", 580, "978-9966-44-120-3"],
    ["g4-art", "Creative Arts Grade 4", "Moran", "Creative Arts", 610, "978-9966-63-218-1"],
    ["g4-agri", "Agriculture & Nutrition Grade 4", "Longhorn", "Agriculture", 590, "978-9966-36-455-5"],
    ["g5-math", "Mathematics Activities Grade 5", "Longhorn", "Mathematics", 680, "978-9966-36-470-8"],
    ["g5-eng", "English Activities Grade 5", "KLB", "English", 650, "978-9966-44-135-7"],
    ["g6-math", "Mathematics Activities Grade 6", "Longhorn", "Mathematics", 700, "978-9966-36-488-3"],
    ["g6-sci", "Science & Technology Grade 6", "Moran", "Science", 720, "978-9966-63-240-2"],
    ["g2-math", "Mathematics Activities Grade 2", "Longhorn", "Mathematics", 560, "978-9966-36-401-2"],
    ["g3-eng", "English Activities Grade 3", "KLB", "English", 590, "978-9966-44-108-1"],
    ["pp1-lang", "Language Activities PP1", "Moran", "Language", 460, "978-9966-63-201-3"],
    ["rd-kidogo", "Kidogo na Kubwa (reader)", "Storymoja", "Readers", 350, "978-9966-75-012-9"],
    ["rd-safari", "The Long Safari (reader)", "Storymoja", "Readers", 380, "978-9966-75-031-0"],
    ["ref-atlas", "Primary Atlas for Kenya", "Oxford", "Reference", 990, "978-0-19-573412-6"],
    ["st-pencils", "HB pencils, pack of 12", "Kasuku", "Stationery", 240, null],
    ["st-geometry", "Geometry set", "Kasuku", "Stationery", 300, null],
    ["st-a5", "A5 exercise books (×10)", "Kasuku", "Stationery", 400, null],
  ]
  for (const [id, title, publisherName, subject, price, isbn] of extra) {
    if ([...items.values()].some((i) => i.title === title && i.publisherName === publisherName)) continue
    items.set(`prd-${id}`, { productId: `prd-${id}`, title, publisherName, subject, gradeLabel: gradeOf(title), category: category(subject), isbn, priceCents: k(price) })
  }
  for (const c of publisherCatalogTitles) {
    const found = [...items.values()].find((i) => i.title === c.title)
    if (found) found.isbn = c.isbn
  }
  return [...items.values()]
})()

export const summarise = (b: Booklist) => {
  const { items, ...rest } = b
  return {
    ...rest,
    itemCount: items.length,
    requiredTotalCents: items.filter((i) => i.required).reduce((s, i) => s + i.unitPriceCents * i.qtyPerStudent, 0),
  }
}

export const orders: Order[] = [
  {
    id: "ord-18877",
    number: "SS-18877",
    termName: "Term 3, 2026",
    status: "collected",
    studentName: "Amani",
    schoolName: "Greenhill Academy",
    className: "3 Sun",
    subtotalCents: k(2960),
    totalCents: k(2960),
    collectionCode: "6120",
    paidAt: "2026-08-21T19:04:00+03:00",
    mpesaReceipt: "QHT2K8LM1B",
    expectedAtSchool: "2026-09-01",
    collectedAt: "2026-09-02T10:20:00+03:00",
    items: [
      { id: "oh-1", title: "Mathematics Activities Grade 3", publisherName: "Longhorn", qty: 1, unitPriceCents: k(600), status: "active" },
      { id: "oh-2", title: "English Activities Grade 3", publisherName: "KLB", qty: 1, unitPriceCents: k(590), status: "active" },
      { id: "oh-3", title: "Kiswahili Shughuli Gredi 3", publisherName: "Oxford", qty: 1, unitPriceCents: k(620), status: "active" },
      { id: "oh-4", title: "Environmental Activities Grade 3", publisherName: "Moran", qty: 1, unitPriceCents: k(600), status: "active" },
      { id: "oh-5", title: "A5 exercise books (×10)", publisherName: "Kasuku", qty: 1, unitPriceCents: k(400), status: "active" },
      { id: "oh-6", title: "Wax crayons, 12 colours", publisherName: "Kasuku", qty: 1, unitPriceCents: k(150), status: "active" },
    ],
    shipments: [
      { publisherName: "Longhorn", summary: "1 item", status: "received" },
      { publisherName: "KLB", summary: "1 item", status: "received" },
      { publisherName: "Oxford", summary: "1 item", status: "received" },
      { publisherName: "Moran", summary: "1 item", status: "received" },
      { publisherName: "Kasuku", summary: "2 items", status: "received" },
    ],
  },
  {
    id: "ord-18902",
    number: "SS-18902",
    termName: "Term 3, 2026",
    status: "partially_refunded",
    studentName: "Zawadi",
    schoolName: "Greenhill Academy",
    className: "6 East",
    subtotalCents: k(4260),
    totalCents: k(4260),
    collectionCode: "2291",
    paidAt: "2026-08-22T08:41:00+03:00",
    mpesaReceipt: "QHU7Z3PQ4C",
    expectedAtSchool: "2026-09-01",
    collectedAt: "2026-09-03T09:05:00+03:00",
    items: [
      { id: "oz-1", title: "Mathematics Activities Grade 6", publisherName: "Longhorn", qty: 1, unitPriceCents: k(700), status: "active" },
      { id: "oz-2", title: "Science & Technology Grade 6", publisherName: "Moran", qty: 1, unitPriceCents: k(720), status: "active" },
      { id: "oz-3", title: "English Activities Grade 6", publisherName: "KLB", qty: 1, unitPriceCents: k(680), status: "active" },
      { id: "oz-4", title: "Social Studies Grade 6", publisherName: "Longhorn", qty: 1, unitPriceCents: k(650), status: "active" },
      { id: "oz-5", title: "Primary Atlas for Kenya", publisherName: "Oxford", qty: 1, unitPriceCents: k(990), status: "refunded" },
      { id: "oz-6", title: "A4 exercise books, 96 pg (×10)", publisherName: "Kasuku", qty: 1, unitPriceCents: k(520), status: "active" },
    ],
    shipments: [
      { publisherName: "Longhorn", summary: "2 items", status: "received" },
      { publisherName: "Moran", summary: "1 item", status: "received" },
      { publisherName: "KLB", summary: "1 item", status: "received" },
      { publisherName: "Kasuku", summary: "1 item", status: "received" },
    ],
  },
  {
    id: "ord-20418",
    number: "SS-20418",
    termName: "Term 1, 2027",
    status: "in_fulfilment",
    studentName: "Zawadi",
    schoolName: "Greenhill Academy",
    className: "7 Blue",
    subtotalCents: k(5980),
    totalCents: k(5980),
    collectionCode: "4829",
    paidAt: "2027-01-05T09:12:00+03:00",
    mpesaReceipt: "QAB4X7K2LM",
    expectedAtSchool: "2027-01-20",
    collectedAt: null,
    items: [
      { id: "oi-1", title: "Mathematics Grade 7", publisherName: "Longhorn", qty: 1, unitPriceCents: k(720), status: "active" },
      { id: "oi-2", title: "Integrated Science Grade 7", publisherName: "Longhorn", qty: 1, unitPriceCents: k(760), status: "active" },
      { id: "oi-3", title: "Pre-Technical Studies Grade 7", publisherName: "Longhorn", qty: 1, unitPriceCents: k(700), status: "active" },
      { id: "oi-4", title: "Social Studies Grade 7", publisherName: "Longhorn", qty: 1, unitPriceCents: k(690), status: "active" },
      { id: "oi-5", title: "English Grade 7", publisherName: "KLB", qty: 1, unitPriceCents: k(690), status: "active" },
      { id: "oi-6", title: "Kiswahili Grade 7", publisherName: "KLB", qty: 1, unitPriceCents: k(680), status: "active" },
      { id: "oi-7", title: "CRE Grade 7", publisherName: "KLB", qty: 1, unitPriceCents: k(650), status: "active" },
      { id: "oi-8", title: "A4 exercise books, 96 pg (×10)", publisherName: "Kasuku", qty: 1, unitPriceCents: k(550), status: "active" },
      { id: "oi-9", title: "Geometry set", publisherName: "Kasuku", qty: 1, unitPriceCents: k(300), status: "active" },
      { id: "oi-10", title: "HB pencils, pack of 12", publisherName: "Kasuku", qty: 1, unitPriceCents: k(240), status: "active" },
    ],
    shipments: [
      { publisherName: "Longhorn", summary: "4 textbooks", status: "dispatched" },
      { publisherName: "KLB", summary: "3 textbooks", status: "dispatched" },
      { publisherName: "Kasuku", summary: "Exercise books, geometry set, pencils", status: "ready_to_pack" },
    ],
  },
]

/** The code each school gives parents to link their children. */
export const schoolJoinCodes: Record<string, string> = {
  "GRN-2027": "sch-greenhill",
  "SMP-2027": "sch-stmarys",
  "KLM-2027": "sch-kilimani",
  "RVJ-2027": "sch-riverside",
}

export const parentAccount = {
  name: "Achieng Otieno",
  phone: "254712345678",
  email: null as string | null,
  mpesaPhone: "254712345678",
  memberSince: "2026-07-30",
  notifications: { reminders: true, emailReceipts: false, offers: false },
}

export const children: Child[] = [
  {
    id: "stu-amani",
    name: "Amani",
    admissionNo: "GA-2291",
    schoolId: "sch-greenhill",
    schoolName: "Greenhill Academy",
    gradeName: "Grade 4",
    className: "4 East",
    openBooklist: summarise(booklists[0]),
    latestOrder: null,
  },
  {
    id: "stu-zawadi",
    name: "Zawadi",
    admissionNo: "GA-1870",
    schoolId: "sch-greenhill",
    schoolName: "Greenhill Academy",
    gradeName: "Grade 7",
    className: "7 Blue",
    openBooklist: null,
    latestOrder: { id: "ord-20418", number: "SS-20418", status: "in_fulfilment", expectedAtSchool: "2027-01-20" },
  },
]

export const products: Product[] = [
  { id: "prd-g4-math", title: "Mathematics Activities Grade 4", imageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=640&q=80", publisherName: "Longhorn", subject: "Mathematics", gradeLabel: "Grade 4", gradeBand: "4-6", priceCents: k(650), schoolListCount: 38, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-g4-eng", title: "English Activities Grade 4", imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=640&q=80", publisherName: "KLB", subject: "English", gradeLabel: "Grade 4", gradeBand: "4-6", priceCents: k(620), schoolListCount: 31, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-g4-kis", title: "Kiswahili Shughuli Gredi 4", imageUrl: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=640&q=80", publisherName: "Oxford", subject: "Kiswahili", gradeLabel: "Grade 4", gradeBand: "4-6", priceCents: k(640), schoolListCount: 29, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-g7-sci", title: "Integrated Science Grade 7", imageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=640&q=80", publisherName: "Longhorn", subject: "Integrated Science", gradeLabel: "Grade 7", gradeBand: "7-9", priceCents: k(760), schoolListCount: 27, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-g7-math", title: "Mathematics Grade 7", imageUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=640&q=80", publisherName: "Longhorn", subject: "Mathematics", gradeLabel: "Grade 7", gradeBand: "7-9", priceCents: k(720), schoolListCount: 44, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-g1-eng", title: "English Activities Grade 1", imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=640&q=80", publisherName: "KLB", subject: "English", gradeLabel: "Grade 1", gradeBand: "1-3", priceCents: k(540), schoolListCount: 22, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-pp2-lang", title: "Language Activities PP2", imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=640&q=80", publisherName: "Moran", subject: "Language Activities", gradeLabel: "PP2", gradeBand: "pp", priceCents: k(480), schoolListCount: 15, category: "textbook", curricula: ["cbe"], audience: "school" },
  { id: "prd-books", title: "A4 exercise books, 96 pg (×10)", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=640&q=80", publisherName: "Kasuku", subject: "Exercise books", gradeLabel: "All grades", gradeBand: "all", priceCents: k(550), schoolListCount: 41, category: "stationery", audience: "all", department: "writing" },
  { id: "prd-geometry", title: "Geometry set", imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=640&q=80", publisherName: "Kasuku", subject: "Maths supplies", gradeLabel: "All grades", gradeBand: "all", priceCents: k(300), schoolListCount: 12, category: "stationery", audience: "all", department: "maths" },
  { id: "prd-pencils", title: "HB pencils, pack of 12", imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=640&q=80", publisherName: "Kasuku", subject: "Writing supplies", gradeLabel: "All grades", gradeBand: "all", priceCents: k(240), schoolListCount: 9, category: "stationery", audience: "all", department: "writing" },
  { id: "prd-calculator", title: "Scientific calculator", imageUrl: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=640&q=80", publisherName: "Oxford", subject: "Calculators", gradeLabel: "Grade 7+", gradeBand: "7-9", priceCents: k(1450), schoolListCount: 4, category: "stationery", audience: "all", department: "maths" },
  { id: "prd-college-business", title: "Introduction to Business Management", imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=640&q=80", publisherName: "Oxford", subject: "Business Management", gradeLabel: "College", gradeBand: "all", priceCents: k(1850), schoolListCount: 0, category: "college", audience: "college", faculty: "business", curricula: [] },
  { id: "prd-college-computing", title: "Foundations of Computing", imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=640&q=80", publisherName: "Pearson", subject: "Computing & IT", gradeLabel: "College", gradeBand: "all", priceCents: k(2200), schoolListCount: 0, category: "college", audience: "college", faculty: "ict", curricula: [] },
]

type ProductExtra = Pick<ProductDetail, "description" | "isbn" | "pages" | "format">

export const productExtras: Record<string, ProductExtra> = {
  "prd-g4-math": { description: "CBC-aligned learner's book with a worked example and practice activity for every lesson: numbers to 100,000, fractions, measurement, geometry and data handling.", isbn: "978-9966-36-412-8", pages: 184, format: "Paperback, A4" },
  "prd-g4-eng": { description: "Reading passages, grammar and writing activities for the Grade 4 English curriculum, with listening and speaking tasks for class work.", isbn: "978-9966-44-218-3", pages: 168, format: "Paperback, A4" },
  "prd-g4-kis": { description: "Kitabu cha mwanafunzi kinachofuata mtaala wa CBC: kusoma, sarufi, kuandika na mazoezi ya kusikiliza na kuzungumza.", isbn: "978-0-19-573904-1", pages: 160, format: "Paperback, A4" },
  "prd-g7-sci": { description: "Junior School Integrated Science covering scientific investigation, mixtures, living things, the human body and force and energy, with practical activities.", isbn: "978-9966-36-655-9", pages: 248, format: "Paperback, A4" },
  "prd-g7-math": { description: "Grade 7 Mathematics for Junior School: integers, algebraic expressions, linear equations, geometry and probability, with end-of-strand assessments.", isbn: "978-9966-36-640-5", pages: 236, format: "Paperback, A4" },
  "prd-g1-eng": { description: "Colourful early-reading activities: phonics, picture reading, letter formation and short stories for Grade 1 learners.", isbn: "978-9966-44-102-5", pages: 112, format: "Paperback, A4" },
  "prd-pp2-lang": { description: "Pre-primary language activities with tracing, sound recognition, songs and picture talk, designed for PP2 classrooms.", isbn: "978-9966-63-311-7", pages: 96, format: "Paperback, A4" },
  "prd-books": { description: "Pack of ten A4 exercise books, 96 pages each, ruled with margin. The standard exercise book on most school lists.", isbn: null, pages: 96, format: "Pack of 10" },
}

export function productDetail(product: Product): ProductDetail {
  const extra = productExtras[product.id] ?? { description: "", isbn: null, pages: null, format: "Paperback" }
  const related = products
    .filter((p) => p.id !== product.id && (p.gradeLabel === product.gradeLabel || p.subject === product.subject || p.gradeBand === "all"))
    .slice(0, 4)
  return {
    ...product,
    ...extra,
    kicdApproved: product.gradeBand !== "all",
    onSchoolLists: schools.slice(0, 3).map(({ slug, name, town }) => ({ slug, name, town })),
    related,
  }
}

export const schoolOverview: SchoolOverview = {
  schoolName: "Greenhill Academy",
  termName: "Term 1, 2027",
  studentsOrdered: 312,
  studentsTotal: 540,
  orderDeadline: "2027-01-10",
  deliveriesReceived: 2,
  deliveriesExpected: 5,
  packsCollected: 0,
  booklists: [
    { ...summarise(booklists[3]), ordered: 41, students: 60 },
    { ...summarise(booklists[2]), ordered: 58, students: 90 },
    { ...summarise(booklists[0]), ordered: 63, students: 120 },
    { ...summarise(booklists[1]), ordered: 150, students: 270 },
  ],
  deliveries: [
    { id: "dl-1", publisherName: "Longhorn", packs: 312, status: "received", date: "2027-01-09" },
    { id: "dl-2", publisherName: "Moran", packs: 120, status: "received", date: "2027-01-09" },
    { id: "dl-3", publisherName: "KLB", packs: 270, status: "dispatched", date: "2027-01-14" },
    { id: "dl-4", publisherName: "Oxford", packs: 183, status: "dispatched", date: "2027-01-15" },
    { id: "dl-5", publisherName: "Kasuku", packs: 312, status: "ready_to_pack", date: null },
  ],
}

/*
 * Greenhill's parent orders: one row per enrolled student (540), generated
 * from a fixed seed so the numbers match the overview (312 paid).
 */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const firstNames = ["Zawadi", "Baraka", "Imani", "Kiprono", "Wanjiru", "Otieno", "Akinyi", "Kamau", "Njeri", "Mutua", "Chebet", "Odhiambo", "Wambui", "Kiptoo", "Nyambura", "Omondi", "Atieno", "Mwangi", "Jepkosgei", "Kibet", "Muthoni", "Ochieng", "Wairimu", "Cheruiyot", "Auma", "Njoroge", "Nekesa", "Wekesa", "Makena", "Kirui"]
const surnames = ["Otieno", "Kamau", "Wanjiku", "Kiprop", "Mwangi", "Achieng", "Njoroge", "Mutiso", "Koech", "Odera", "Maina", "Chepkemoi", "Owino", "Gitau", "Rotich", "Wafula", "Nduta", "Kimani", "Barasa", "Langat"]
const parentFirst = ["Achieng", "Grace", "Peter", "Mary", "John", "Faith", "David", "Esther", "Joseph", "Lucy", "Samuel", "Ruth", "James", "Mercy", "Daniel"]
/**
 * Where each publisher's Greenhill delivery stands. Moran's arrived with two damaged packs. With
 * Longhorn, Moran, KLB and Kasuku in, PP2 and Grade 7 packs are complete; Grades 1 and 4 wait for Oxford.
 */
type DeliveryPlan = Pick<SchoolDelivery, "status" | "expectedAt"> & { noteNo?: string; driver?: [name: string, phone: string, reg: string]; carrier?: string }
const deliveryPlan: Record<string, DeliveryPlan> = {
  Longhorn: { status: "received", expectedAt: "2027-01-09", noteNo: "LH-DN-1038", driver: ["Joseph Mwangi", "254711222333", "KCX 412M"], carrier: "Own vehicle" },
  Moran: { status: "received", expectedAt: "2027-01-09", noteNo: "MOR-55120", driver: ["Kevin Ouma", "254722431908", "KDA 201K"], carrier: "G4S Courier" },
  KLB: { status: "received", expectedAt: "2027-01-14", noteNo: "KLB-DN-08812", driver: ["Daniel Kiprotich", "254733118220", "KCZ 908T"], carrier: "Own vehicle" },
  Oxford: { status: "dispatched", expectedAt: "2027-01-15", noteNo: "OUP-KE-30471", driver: ["Brian Mutai", "254701556781", "KDB 377Q"], carrier: "Sendy" },
  Kasuku: { status: "received", expectedAt: "2027-01-12", noteNo: "KSK-4471", driver: ["Peter Njoroge", "254720664512", "KCT 553L"], carrier: "Own vehicle" },
  Storymoja: { status: "ready_to_pack", expectedAt: null },
}
const shipmentByPublisher = Object.fromEntries(Object.entries(deliveryPlan).map(([name, d]) => [name, d.status]))

const gradePlan = [
  { list: booklists[3], classes: [30, 30], paid: 41, pending: 2, failed: 1, year: 2025 },
  { list: booklists[2], classes: [45, 45], paid: 58, pending: 4, failed: 1, year: 2026 },
  { list: booklists[0], classes: [40, 40, 40], paid: 63, pending: 7, failed: 2, year: 2023 },
  { list: booklists[1], classes: [90, 90, 90], paid: 150, pending: 5, failed: 1, year: 2020 },
]

export const schoolOrderRows: StudentOrderRow[] = []
export const schoolOrderDetails: SchoolOrderDetail[] = []
{
  const rand = seeded(2027)
  // Separate stream so collection codes don't shift the generated names and orders.
  const codeRand = seeded(4242)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  let adm = 1, orderNo = 19000
  for (const g of gradePlan) {
    const students = g.list.classNames.flatMap((className, ci) => Array.from({ length: g.classes[ci] }, () => className))
    // Spread paid / pending / failed orders across the grade's classes.
    const statuses: Array<"paid" | "pending_payment" | "payment_failed" | null> = students.map((_, i) => (i < g.paid ? "paid" : i < g.paid + g.pending ? "pending_payment" : i < g.paid + g.pending + g.failed ? "payment_failed" : null))
    for (let i = statuses.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[statuses[i], statuses[j]] = [statuses[j], statuses[i]]
    }
    students.forEach((className, i) => {
      const first = g.list.gradeName === "Grade 7" && i === 0 ? "Zawadi" : pick(firstNames)
      const last = pick(surnames)
      const hasParent = statuses[i] !== null || rand() > 0.09
      const status = statuses[i]
      const row: StudentOrderRow = {
        studentId: `stu-${adm}`,
        studentName: `${first} ${last}`,
        admissionNo: `GH/${g.year}/${String(adm).padStart(4, "0")}`,
        gradeName: g.list.gradeName,
        className,
        parentName: hasParent ? `${pick(parentFirst)} ${last}` : null,
        parentPhone: hasParent ? `07${Math.floor(rand() * 10)}${Math.floor(rand() * 10)} ••• ${String(Math.floor(rand() * 1000)).padStart(3, "0")}` : null,
        order: null,
        remindedAt: !status && hasParent && rand() < 0.15 ? new Date(Date.now() - (1 + rand() * 5) * 3_600_000).toISOString() : null,
      }
      adm++
      if (status) {
        const items = g.list.items
          .filter((it) => it.required || rand() < 0.4)
          .map((it, n) => ({ id: `${row.studentId}-${n}`, title: it.title, publisherName: it.publisherName, qty: it.qtyPerStudent, unitPriceCents: it.unitPriceCents, status: "active" as const }))
        const total = items.reduce((t, it) => t + it.unitPriceCents * it.qty, 0)
        const paid = status === "paid"
        const paidAt = paid ? `2026-12-${String(10 + Math.floor(rand() * 21)).padStart(2, "0")}T${String(7 + Math.floor(rand() * 13)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00+03:00` : null
        const number = `SS-${orderNo++}`
        const id = `ord-${number.slice(3)}`
        const publishers = [...new Set(items.map((it) => it.publisherName))]
        const complete = paid && publishers.every((p) => shipmentByPublisher[p] === "received")
        // Handing out began on 15 Jan: about a third of each complete class has collected so far.
        const collected = complete && codeRand() < 0.35
        row.order = { id, number, status: collected ? "collected" : complete ? "at_school" : paid ? "in_fulfilment" : status, totalCents: total, itemCount: items.length, paidAt }
        schoolOrderDetails.push({
          id,
          number,
          termName: g.list.termName,
          status: row.order.status,
          studentName: row.studentName,
          schoolName: g.list.schoolName,
          className,
          subtotalCents: total,
          totalCents: total,
          collectionCode: paid ? String(1000 + Math.floor(codeRand() * 9000)) : null,
          paidAt,
          mpesaReceipt: paid ? "Q" + Array.from({ length: 9 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("") : null,
          expectedAtSchool: paid ? g.list.deliverBy : null,
          collectedAt: collected ? `2027-01-15T${String(8 + Math.floor(codeRand() * 7)).padStart(2, "0")}:${String(Math.floor(codeRand() * 60)).padStart(2, "0")}:00+03:00` : null,
          items,
          shipments: publishers.map((publisherName) => {
            const n = items.filter((it) => it.publisherName === publisherName).length
            return { publisherName, summary: `${n} item${n === 1 ? "" : "s"}`, status: paid ? (shipmentByPublisher[publisherName] ?? "collecting") : "collecting" }
          }),
          admissionNo: row.admissionNo,
          parentName: row.parentName,
          parentPhone: row.parentPhone,
        })
      }
      schoolOrderRows.push(row)
    })
  }
}

/** Greenhill's deliveries, built from the paid orders: one pack per student per publisher. */
export const schoolDeliveries: SchoolDelivery[] = Object.entries(deliveryPlan).map(([publisherName, plan], i) => {
  const perClass = new Map<string, number>()
  for (const o of schoolOrderDetails) {
    if (!["in_fulfilment", "at_school", "collected"].includes(o.status) || !o.items.some((it) => it.publisherName === publisherName)) continue
    perClass.set(o.className, (perClass.get(o.className) ?? 0) + 1)
  }
  const packs = [...perClass.values()].reduce((a, b) => a + b, 0)
  const received = plan.status === "received"
  const damaged = publisherName === "Moran"
  return {
    id: `dl-${i + 1}`,
    publisherName,
    status: plan.status,
    packs,
    expectedAt: plan.expectedAt,
    classes: [...perClass].map(([className, expected]) => ({ className, expected, received: received ? expected : null })),
    dispatch:
      plan.noteNo && plan.driver
        ? {
            deliveryNoteNo: plan.noteNo,
            carrier: plan.carrier ?? "Own vehicle",
            driverName: plan.driver[0],
            driverPhone: plan.driver[1],
            vehicleReg: plan.driver[2],
            cartons: Math.ceil(packs / 12),
            dispatchedAt: `${received ? "2027-01-08" : "2027-01-12"}T15:20:00+03:00`,
          }
        : null,
    receipt: received
      ? {
          receivedAt: `${plan.expectedAt}T${damaged ? "14:05" : "10:40"}:00+03:00`,
          receivedBy: "Grace Wambui",
          packsReceived: packs,
          issues: damaged ? ["damaged"] : [],
          notes: damaged ? "2 PP2 Rose packs soaked through, books unusable. Replacements requested." : "",
          signOffCode: damaged ? "8130" : "2764",
        }
      : null,
  }
})
schoolOverview.deliveries = schoolDeliveries.map((d) => ({ id: d.id, publisherName: d.publisherName, packs: d.packs, status: d.status, date: d.expectedAt }))
schoolOverview.deliveriesExpected = schoolDeliveries.length
schoolOverview.deliveriesReceived = schoolDeliveries.filter((d) => d.status === "received").length
schoolOverview.packsCollected = schoolOrderDetails.filter((o) => o.status === "collected").length

export const schoolSettings: SchoolSettings = {
  profile: {
    schoolName: "Greenhill Academy",
    registrationNo: "MOE/NKR/P/1187",
    verifiedAt: "2026-08-02T10:15:00+03:00",
    contactName: "Grace Wambui",
    phone: "254722000111",
    email: "office@greenhill.ac.ke",
    county: "Nakuru",
    deliveryAddress: "Greenhill Academy, Kabarak Road, Nakuru. Deliveries via the back gate.",
    deliveryHours: "Mon–Fri, 8am–4pm",
  },
  parents: { reminderDays: 3, smsWhenAtSchool: true, collectionPoint: "class_teacher" },
}

/** Longhorn's own catalog, as the demo publisher sees it. */
export const publisherCatalog: CatalogItem[] = [
  { id: "cat-g4-math", title: "Mathematics Activities Grade 4", subject: "Mathematics", gradeLabel: "Grade 4", gradeBand: "4-6", isbn: "978-9966-36-412-8", format: "Paperback, A4", priceCents: k(650), stock: 1240, lowStockAt: 200, status: "live", schoolListCount: 38 },
  { id: "cat-g4-sst", title: "Social Studies Grade 4", subject: "Social Studies", gradeLabel: "Grade 4", gradeBand: "4-6", isbn: "978-9966-36-418-0", format: "Paperback, A4", priceCents: k(600), stock: 140, lowStockAt: 200, status: "live", schoolListCount: 26 },
  { id: "cat-g7-math", title: "Mathematics Grade 7", subject: "Mathematics", gradeLabel: "Grade 7", gradeBand: "7-9", isbn: "978-9966-36-640-5", format: "Paperback, A4", priceCents: k(720), stock: 2100, lowStockAt: 300, status: "live", schoolListCount: 44 },
  { id: "cat-g7-sci", title: "Integrated Science Grade 7", subject: "Integrated Science", gradeLabel: "Grade 7", gradeBand: "7-9", isbn: "978-9966-36-655-9", format: "Paperback, A4", priceCents: k(760), stock: 0, lowStockAt: 300, status: "live", schoolListCount: 27 },
  { id: "cat-g7-pts", title: "Pre-Technical Studies Grade 7", subject: "Pre-Technical Studies", gradeLabel: "Grade 7", gradeBand: "7-9", isbn: "978-9966-36-662-7", format: "Paperback, A4", priceCents: k(690), stock: 880, lowStockAt: 200, status: "live", schoolListCount: 12 },
  { id: "cat-g1-math", title: "Mathematics Activities Grade 1", subject: "Mathematics", gradeLabel: "Grade 1", gradeBand: "1-3", isbn: "978-9966-36-301-5", format: "Paperback, A4", priceCents: k(520), stock: 95, lowStockAt: 150, status: "live", schoolListCount: 19 },
  { id: "cat-g8-math", title: "Mathematics Grade 8", subject: "Mathematics", gradeLabel: "Grade 8", gradeBand: "7-9", isbn: null, format: "Paperback, A4", priceCents: k(740), stock: 0, lowStockAt: 300, status: "draft", schoolListCount: 0 },
]

export const publisherBatches: SchoolBatch[] = [
  { id: "bt-1", schoolName: "Greenhill Academy", town: "Nakuru", packs: 312, valueCents: k(187200), dueAtSchool: "2027-01-20", status: "ready_to_pack", collectingUntil: null, unavailableLines: [], dispatch: null, receipt: null,
    lines: [{ title: "Mathematics Activities Grade 4", qty: 63 }, { title: "Social Studies Grade 4", qty: 63 }, { title: "Mathematics Grade 7", qty: 150 }, { title: "Integrated Science Grade 7", qty: 150 }] },
  { id: "bt-2", schoolName: "St. Mary's Primary", town: "Eldoret", packs: 204, valueCents: k(118300), dueAtSchool: "2027-01-18", status: "ready_to_pack", collectingUntil: null, unavailableLines: [], dispatch: null, receipt: null,
    lines: [{ title: "Mathematics Activities Grade 1", qty: 88 }, { title: "English Activities Grade 1", qty: 88 }, { title: "Social Studies Grade 4", qty: 116 }] },
  { id: "bt-3", schoolName: "Riverside Junior School", town: "Kisumu", packs: 178, valueCents: k(107100), dueAtSchool: "2027-01-22", status: "ready_to_pack", collectingUntil: null, unavailableLines: [], dispatch: null, receipt: null,
    lines: [{ title: "Mathematics Grade 7", qty: 178 }, { title: "Pre-Technical Studies Grade 7", qty: 178 }] },
  { id: "bt-4", schoolName: "Kilimani Primary", town: "Nairobi", packs: 96, valueCents: k(52800), dueAtSchool: "2027-01-24", status: "collecting", collectingUntil: "2027-01-12", unavailableLines: [], dispatch: null, receipt: null,
    lines: [{ title: "Mathematics Activities Grade 4", qty: 96 }] },
  { id: "bt-5", schoolName: "Hillcrest Prep", town: "Nyeri", packs: 140, valueCents: k(84000), dueAtSchool: "2027-01-09", status: "dispatched", collectingUntil: null, unavailableLines: [], receipt: null,
    dispatch: { deliveryNoteNo: "DN-1042", carrier: "Own vehicle", driverName: "Joseph Mwangi", driverPhone: "254711222333", vehicleReg: "KDA 412K", cartons: 18, dispatchedAt: "2027-01-07T07:30:00+03:00", expectedAt: "2027-01-08" },
    lines: [{ title: "Mathematics Activities Grade 4", qty: 70 }, { title: "Social Studies Grade 4", qty: 70 }] },
  { id: "bt-6", schoolName: "Sunrise Academy", town: "Machakos", packs: 120, valueCents: k(73200), dueAtSchool: "2027-01-08", status: "received", collectingUntil: null, unavailableLines: [],
    dispatch: { deliveryNoteNo: "DN-1038", carrier: "G4S Courier", driverName: "Kevin Otieno", driverPhone: "254722444555", vehicleReg: "KCZ 908T", cartons: 15, dispatchedAt: "2027-01-05T08:10:00+03:00", expectedAt: "2027-01-06" },
    receipt: { receivedAt: "2027-01-06T11:20:00+03:00", receivedBy: "Mary Wanjiku, deputy head", issue: "6 packs short: Social Studies Grade 4", payout: "queued" },
    lines: [{ title: "Mathematics Activities Grade 4", qty: 60 }, { title: "Social Studies Grade 4", qty: 60 }] },
  { id: "bt-7", schoolName: "Lakeview Primary", town: "Naivasha", packs: 88, valueCents: k(57200), dueAtSchool: "2027-01-07", status: "received", collectingUntil: null, unavailableLines: ["Pre-Technical Studies Grade 7"],
    dispatch: { deliveryNoteNo: "DN-1031", carrier: "Own vehicle", driverName: "Joseph Mwangi", driverPhone: "254711222333", vehicleReg: "KDA 412K", cartons: 11, dispatchedAt: "2027-01-04T07:45:00+03:00", expectedAt: "2027-01-04" },
    receipt: { receivedAt: "2027-01-04T14:05:00+03:00", receivedBy: "Daniel Kiprop, head teacher", issue: null, payout: "paid" },
    lines: [{ title: "Mathematics Grade 7", qty: 88 }, { title: "Pre-Technical Studies Grade 7", qty: 88 }] },
]

/** Commission rate used by the mock only; the real rate is agreed per publisher. */
const DEMO_COMMISSION = 0.08
const payout = (p: Omit<PublisherPayouts["payouts"][number], "commissionCents" | "netCents">) => {
  const commissionCents = Math.round(p.grossCents * DEMO_COMMISSION)
  return { ...p, commissionCents, netCents: p.grossCents - commissionCents - p.deductionsCents }
}

export const publisherPayouts: PublisherPayouts = {
  commissionRate: DEMO_COMMISSION,
  account: { method: "mpesa_paybill", accountName: "Longhorn Publishers Ltd", masked: "Paybill 522 *** 11 · Account LONGHORN", status: "verified" },
  payouts: [
    payout({ id: "po-7", termName: "Term 1, 2027", schoolName: "Hillcrest Prep", town: "Nyeri", deliveryNoteNo: "DN-1042", receivedAt: null, grossCents: k(84000), deductionsCents: 0, deductionNote: null, status: "held", paidAt: null, reference: null }),
    payout({ id: "po-6", termName: "Term 1, 2027", schoolName: "Sunrise Academy", town: "Machakos", deliveryNoteNo: "DN-1038", receivedAt: "2027-01-06T11:20:00+03:00", grossCents: k(73200), deductionsCents: k(3600), deductionNote: "6 packs short: Social Studies Grade 4, refunded to parents", status: "on_hold", paidAt: null, reference: null }),
    payout({ id: "po-5", termName: "Term 1, 2027", schoolName: "Kitale Hills School", town: "Kitale", deliveryNoteNo: "DN-1035", receivedAt: "2027-01-05T15:40:00+03:00", grossCents: k(66000), deductionsCents: 0, deductionNote: null, status: "queued", paidAt: null, reference: null }),
    payout({ id: "po-4", termName: "Term 1, 2027", schoolName: "Lakeview Primary", town: "Naivasha", deliveryNoteNo: "DN-1031", receivedAt: "2027-01-04T14:05:00+03:00", grossCents: k(57200), deductionsCents: 0, deductionNote: null, status: "paid", paidAt: "2027-01-05T10:00:00+03:00", reference: "QBR7X2K9LM" }),
    payout({ id: "po-3", termName: "Term 3, 2026", schoolName: "Greenhill Academy", town: "Nakuru", deliveryNoteNo: "DN-0988", receivedAt: "2026-09-08T09:30:00+03:00", grossCents: k(142500), deductionsCents: 0, deductionNote: null, status: "paid", paidAt: "2026-09-10T10:00:00+03:00", reference: "QIH4M8T2PA" }),
    payout({ id: "po-2", termName: "Term 3, 2026", schoolName: "St. Mary's Primary", town: "Eldoret", deliveryNoteNo: "DN-0979", receivedAt: "2026-09-06T12:10:00+03:00", grossCents: k(96800), deductionsCents: k(1240), deductionNote: "2 copies damaged: Mathematics Activities Grade 1, refunded to parents", status: "paid", paidAt: "2026-09-08T10:00:00+03:00", reference: "QIF2L7R5WD" }),
    payout({ id: "po-1", termName: "Term 3, 2026", schoolName: "Kilimani Primary", town: "Nairobi", deliveryNoteNo: "DN-0971", receivedAt: "2026-09-03T08:45:00+03:00", grossCents: k(41250), deductionsCents: 0, deductionNote: null, status: "paid", paidAt: "2026-09-05T10:00:00+03:00", reference: "QIC9P3D6NE" }),
  ],
}

/** Other publishers' payout accounts and payouts, for SchoolShop finance. Longhorn's come from publisherPayouts. */
export type AdminPayoutSeed = PublisherPayouts["payouts"][number] & { publisherId: string; packs: number; holdReason: string | null }
export const publisherAccounts: Record<string, { name: string; account: PublisherPayouts["account"] }> = {
  "pub-moran": { name: "Moran Publishers", account: { method: "bank", accountName: "Moran (E.A.) Publishers Ltd", masked: "Equity Bank · Account *** 4410", status: "verified" } },
  "pub-klb": { name: "Kenya Literature Bureau", account: { method: "bank", accountName: "Kenya Literature Bureau", masked: "KCB · Account *** 0042", status: "verified" } },
  "pub-oxford": { name: "Oxford University Press East Africa", account: { method: "bank", accountName: "OUP East Africa Ltd", masked: "Stanbic · Account *** 7781", status: "verified" } },
  "pub-spotlight": { name: "Spotlight Publishers", account: { method: "mpesa_paybill", accountName: "Spotlight Publishers (EA) Ltd", masked: "Paybill 247 *** 47 · Account SPOTLIGHT", status: "verified" } },
  "pub-mentor": { name: "Mentor Publishers", account: { method: "mpesa_till", accountName: "Mentor Publishers", masked: "Till 881 *** 20", status: "verified" } },
  // Changed their account two days ago: nothing goes out until someone confirms it with them.
  "pub-kasuku": { name: "Kasuku Stationers", account: { method: "mpesa_paybill", accountName: "Kasuku Stationers Ltd", masked: "Paybill 400 *** 93 · Account KASUKU", status: "pending_verification" } },
  "pub-storymoja": { name: "Storymoja", account: { method: "mpesa_till", accountName: "Storymoja Africa", masked: "Till 552 *** 08", status: "verified" } },
}
export const adminPayouts: AdminPayoutSeed[] = [
  ["pub-moran", "Greenhill Academy", "Nakuru", 120, 82800, "2027-01-09T10:40:00+03:00", "queued"],
  ["pub-moran", "Hillcrest Prep", "Nyeri", 180, 117000, "2027-01-12T14:00:00+03:00", "on_hold"],
  ["pub-klb", "Greenhill Academy", "Nakuru", 312, 190320, "2027-01-08T11:15:00+03:00", "queued"],
  ["pub-klb", "St. Mary's Primary", "Eldoret", 204, 124440, null, "held"],
  ["pub-oxford", "Greenhill Academy", "Nakuru", 312, 215280, "2027-01-08T11:15:00+03:00", "paid"],
  ["pub-oxford", "Kilimani Primary", "Nairobi", 96, 66240, "2027-01-10T09:30:00+03:00", "queued"],
  ["pub-spotlight", "Riverside Junior School", "Kisumu", 178, 138840, "2027-01-11T12:20:00+03:00", "queued"],
  ["pub-spotlight", "Sunrise Academy", "Machakos", 150, 117000, null, "held"],
  ["pub-mentor", "St. Mary's Primary", "Eldoret", 64, 85120, "2027-01-10T15:00:00+03:00", "queued"],
  ["pub-kasuku", "Greenhill Academy", "Nakuru", 312, 140400, "2027-01-08T11:15:00+03:00", "queued"],
  ["pub-kasuku", "Kitale Hills Academy", "Kitale", 88, 39600, "2027-01-07T10:00:00+03:00", "queued"],
  ["pub-storymoja", "Lakeview Primary", "Naivasha", 70, 36400, "2027-01-05T13:00:00+03:00", "paid"],
].map(([publisherId, schoolName, town, packs, gross, receivedAt, status], i) => {
  const mentor = publisherId === "pub-mentor"
  const base = payout({
    id: `apo-${i + 1}`, termName: "Term 1, 2027", schoolName: schoolName as string, town: town as string, deliveryNoteNo: `DN-${2100 + i}`,
    receivedAt: receivedAt as string | null, grossCents: k(gross as number),
    // The atlas sold out after these were paid: refunds to parents come off Mentor's payout.
    deductionsCents: mentor ? k(7980) : 0, deductionNote: mentor ? "6 × Kenya Primary Atlas out of stock, refunded to parents" : null,
    status: status as AdminPayoutSeed["status"], paidAt: status === "paid" ? "2027-01-10T10:00:00+03:00" : null, reference: status === "paid" ? `QJ${(i * 7919).toString(36).toUpperCase().padStart(6, "0")}X` : null,
  })
  return { ...base, publisherId: publisherId as string, packs: packs as number, holdReason: status === "on_hold" ? "Hillcrest Prep received 6 packs short. Hold until the missing packs arrive or parents are refunded." : null }
})

export const publisherSettings: PublisherSettings = {
  profile: {
    companyName: "Longhorn Publishers Ltd",
    kraPin: "P051234567X",
    verifiedAt: "2026-08-14T10:00:00+03:00",
    contactName: "Peter Kamau",
    phone: "254700000444",
    email: "orders@longhorn.co.ke",
    dispatchAddress: "Funzi Road, Industrial Area, Nairobi",
    county: "Nairobi",
  },
  notifications: {
    batch_ready: { sms: true, email: true },
    delivery_issue: { sms: true, email: true },
    payout_sent: { sms: false, email: true },
    low_stock: { sms: false, email: true },
    weekly_summary: { sms: false, email: true },
  },
}

/** What only SchoolShop admins see about an order: who paid, the payment attempts and anything that needs a person. */
export type AdminOrderExtra = {
  schoolId: string
  parentPhone: string | null
  createdAt: string
  issue: AdminOrder["issue"]
  issueDetail: string | null
  payments: AdminOrder["payments"]
  events: AdminOrder["events"]
  /** Mock only: what M-Pesa answers when an admin checks an unconfirmed payment. */
  confirmsOnCheck?: boolean
  refundRequest?: AdminOrder["refundRequest"]
}

/*
 * Orders at schools other than Greenhill, so admins have the whole platform
 * to search, including the cases on the overview: four M-Pesa payments with
 * no callback, Hillcrest's short delivery from Moran and six refunds for an
 * out-of-stock atlas (KES 7,980).
 */
export const adminExtraOrders: SchoolOrderDetail[] = []
export const adminOrderExtras: Record<string, AdminOrderExtra> = {}
{
  const rand = seeded(909)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  // Same clock as Greenhill's orders: the term's handout week, mid-January 2027.
  const now = Date.parse("2027-01-14T10:00:00+03:00")
  const ago = (mins: number) => new Date(now - mins * 60_000).toISOString().replace(/\.\d+Z$/, "+00:00")
  const receipt = () => "Q" + Array.from({ length: 9 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("")
  const phone = () => `2547${Math.floor(10 + rand() * 89)}${String(Math.floor(rand() * 1_000_000)).padStart(6, "0")}`
  const shelf = [
    ["Spotlight Mathematics", "Spotlight Publishers", 780], ["Excel & Ace English", "Longhorn", 720], ["Kiswahili Mufti", "Oxford", 690],
    ["Primary Science Activities", "Moran", 650], ["Social Studies Explorer", "KLB", 610], ["Exercise books, 96 pages ×10", "Kasuku", 450],
    ["Creative Arts Workbook", "Storymoja", 520], ["Kenya Primary Atlas", "Mentor Publishers", 1330],
  ] as const
  const schools = [["sch-stmarys", "St. Mary's Primary", "SM"], ["sch-kilimani", "Kilimani Primary", "KP"], ["sch-riverside", "Riverside Junior School", "RJ"], ["sch-hillcrest", "Hillcrest Prep", "HP"], ["sch-sunrise", "Sunrise Academy", "SA"]] as const
  const classes = ["4 Blue", "5 Green", "6 Red", "7 East", "3 West"]
  let no = 21000
  const make = (school: (typeof schools)[number], status: SchoolOrderDetail["status"], opts: { lines?: (typeof shelf)[number][]; minsAgo?: number; extra?: Partial<AdminOrderExtra>; itemStatus?: (title: string) => "active" | "unavailable" } = {}) => {
    const lines = opts.lines ?? shelf.filter((_, i) => i < 5 || rand() < 0.35)
    const number = `SS-${no++}`
    const id = `ord-${number.slice(3)}`
    const last = pick(surnames)
    const items = lines.map(([title, publisherName, price], n) => ({ id: `${id}-${n}`, title, publisherName, qty: 1, unitPriceCents: k(price), status: opts.itemStatus?.(title) ?? ("active" as const) }))
    const total = items.reduce((t, it) => t + it.unitPriceCents, 0)
    const minsAgo = opts.minsAgo ?? Math.floor(60 * 24 * (2 + rand() * 30))
    const paid = !["pending_payment", "payment_failed", "cancelled"].includes(status)
    const created = ago(minsAgo)
    const paidAt = paid ? ago(minsAgo - 3) : null
    const parentPhone = phone()
    const mpesa = paid ? receipt() : null
    const publishers = [...new Set(items.map((it) => it.publisherName))]
    const shipment = status === "at_school" || status === "collected" ? "received" : status === "in_fulfilment" ? pick(["collecting", "ready_to_pack", "dispatched"] as const) : "collecting"
    adminExtraOrders.push({
      id, number, termName: "Term 1, 2027", status, studentName: `${pick(firstNames)} ${last}`, schoolName: school[1], className: pick(classes),
      subtotalCents: total, totalCents: total, collectionCode: paid ? String(1000 + Math.floor(rand() * 9000)) : null, paidAt, mpesaReceipt: mpesa,
      expectedAtSchool: paid ? "2027-01-22" : null, collectedAt: status === "collected" ? ago(60 * 24) : null, items,
      shipments: publishers.map((publisherName) => {
        const n = items.filter((it) => it.publisherName === publisherName).length
        return { publisherName, summary: `${n} item${n === 1 ? "" : "s"}`, status: paid ? shipment : "collecting" }
      }),
      admissionNo: `${school[2]}/2027/${String(100 + no).slice(-4)}`, parentName: `${pick(parentFirst)} ${last}`, parentPhone: null,
    })
    adminOrderExtras[id] = {
      schoolId: school[0], parentPhone, createdAt: created, issue: null, issueDetail: null,
      payments: status === "pending_payment" ? [] : [{ id: `${id}-p1`, at: paidAt ?? ago(minsAgo - 2), phone: parentPhone, amountCents: total, status: paid ? "succeeded" : "failed", receipt: mpesa, failureReason: paid ? null : pick(["The parent cancelled on their phone", "Not enough money in M-Pesa", "No PIN entered in time"]) }],
      events: [],
      ...opts.extra,
    }
    return id
  }
  // Ordinary orders across five schools.
  const mix: SchoolOrderDetail["status"][] = ["in_fulfilment", "in_fulfilment", "at_school", "collected", "collected", "paid", "pending_payment", "payment_failed"]
  for (let i = 0; i < 48; i++) make(schools[i % schools.length], mix[i % mix.length])
  // No callback from M-Pesa yet.
  ;[[0, 6, true], [1, 11, true], [2, 18, false], [4, 34, true]].forEach(([si, mins, ok]) => {
    const id = make(schools[si as number], "pending_payment", { minsAgo: (mins as number) + 2 })
    const o = adminExtraOrders.at(-1)!
    const x = adminOrderExtras[id]
    Object.assign(x, {
      issue: "payment_unconfirmed", issueDetail: `M-Pesa sent no result for ${mins} minutes. Check the payment before telling the parent to pay again.`, confirmsOnCheck: ok,
      payments: [{ id: `${id}-p1`, at: ago(mins as number), phone: x.parentPhone, amountCents: o.totalCents, status: "unconfirmed", receipt: null, failureReason: null }],
    })
  })
  // Hillcrest: Moran's delivery came six packs short.
  for (let i = 0; i < 6; i++) {
    const id = make(schools[3], "at_school", { lines: [shelf[3], shelf[0], shelf[4]] })
    const o = adminExtraOrders.at(-1)!
    o.className = "5 Green"
    Object.assign(adminOrderExtras[id], { issue: "short_delivery", issueDetail: "Hillcrest Prep received Moran's delivery 6 packs short. This student's Primary Science Activities pack is missing.", events: [{ id: `${id}-e1`, at: ago(60 * 26), actor: "Hillcrest Prep", text: "reported Moran's delivery 6 packs short" }] })
  }
  // The atlas sold out at Mentor after these were paid: refund the atlas, keep the rest.
  for (let i = 0; i < 6; i++) {
    const id = make(schools[i % 2], "in_fulfilment", { lines: [shelf[0], shelf[1], shelf[7]], itemStatus: (t) => (t === "Kenya Primary Atlas" ? "unavailable" : "active") })
    Object.assign(adminOrderExtras[id], {
      issue: "refund_due", issueDetail: "Mentor Publishers can't supply Kenya Primary Atlas. Refund KES 1,330 to the parent.",
      refundRequest: { from: "publisher", reason: "Kenya Primary Atlas is out of stock at Mentor Publishers.", itemIds: adminExtraOrders.at(-1)!.items.filter((it) => it.status === "unavailable").map((it) => it.id), requestedAt: ago(60 * 5) },
      events: [{ id: `${id}-e1`, at: ago(60 * 5), actor: "Mentor Publishers", text: "marked Kenya Primary Atlas out of stock" }],
    })
  }
}

/*
 * Titles and price changes publishers sent for checking. Longhorn's own new
 * titles join this queue when its team adds them; these are everyone else's.
 */
type SubmissionSeed = { id: string; publisherId: string; publisherName: string; kind: "new_title" | "price_change"; title: string; subject: string; gradeLabel: string; isbn: string | null; format: string; price: number; previous?: number; hoursAgo: number; status?: "pending" | "changes_requested" | "approved" | "rejected"; note?: string }
export const catalogSubmissionSeeds: SubmissionSeed[] = [
  { id: "sub-1", publisherId: "pub-spotlight", publisherName: "Spotlight Publishers", kind: "new_title", title: "Spotlight Mathematics Grade 5", subject: "Mathematics", gradeLabel: "Grade 5", isbn: "978-9966-25-118-3", format: "Paperback, A4 · 192 pages", price: 760, hoursAgo: 30 },
  { id: "sub-2", publisherId: "pub-moran", publisherName: "Moran", kind: "new_title", title: "Science & Technology Grade 5", subject: "Science", gradeLabel: "Grade 5", isbn: "978-9966-36-655-9", format: "Paperback, A4 · 176 pages", price: 700, hoursAgo: 20 },
  { id: "sub-3", publisherId: "pub-mentor", publisherName: "Mentor Publishers", kind: "new_title", title: "Kenya Primary Atlas, 2027 edition", subject: "Social Studies", gradeLabel: "Grade 4", isbn: "978-9966-47-305-9", format: "Hardback, A4 · 96 pages", price: 1650, hoursAgo: 9 },
  { id: "sub-4", publisherId: "pub-kasuku", publisherName: "Kasuku Stationers", kind: "price_change", title: "Exercise books, 96 pages ×10", subject: "Stationery", gradeLabel: "All grades", isbn: null, format: "Pack of 10", price: 520, previous: 450, hoursAgo: 6 },
  { id: "sub-5", publisherId: "pub-oxford", publisherName: "Oxford University Press East Africa", kind: "new_title", title: "Kiswahili Mufti Grade 5", subject: "Kiswahili", gradeLabel: "Grade 5", isbn: "978-0-19-573904-9", format: "Paperback, A4 · 160 pages", price: 690, hoursAgo: 4 },
  { id: "sub-6", publisherId: "pub-storymoja", publisherName: "Storymoja", kind: "new_title", title: "Hadithi za Bibi (reader)", subject: "Kiswahili", gradeLabel: "Grade 3", isbn: "978-9966-41-022-1", format: "Paperback, A5 · 48 pages", price: 350, hoursAgo: 2 },
  { id: "sub-7", publisherId: "pub-klb", publisherName: "Kenya Literature Bureau", kind: "new_title", title: "Social Studies Grade 8", subject: "Social Studies", gradeLabel: "Grade 8", isbn: "978-9966-44-301-4", format: "Paperback, A4 · 220 pages", price: 840, hoursAgo: 52, status: "changes_requested", note: "The cover says Grade 7. Please upload the Grade 8 cover and the KICD approval letter." },
  { id: "sub-8", publisherId: "pub-spotlight", publisherName: "Spotlight Publishers", kind: "price_change", title: "Spotlight English Grade 4", subject: "English", gradeLabel: "Grade 4", isbn: "978-9966-10-772-5", format: "Paperback, A4", price: 700, previous: 680, hoursAgo: 70, status: "approved" },
  { id: "sub-9", publisherId: "pub-kasuku", publisherName: "Kasuku Stationers", kind: "new_title", title: "Geometry set (no brand)", subject: "Stationery", gradeLabel: "All grades", isbn: null, format: "Tin, 9 pieces", price: 950, hoursAgo: 96, status: "rejected", note: "KES 950 is more than twice what schools pay elsewhere for the same set." },
]

/** What SchoolShop staff did before the demo starts. Newer entries are written as people act. */
export const auditSeeds: { hoursAgo: number; actor: string; role: string; category: AuditCategory; text: string; target: { label: string; href: string } | null }[] = [
  { hoursAgo: 0.6, actor: "Kevin Mutai", role: "Operations", category: "orders", text: "noted on the order: \"Parent called, collecting Friday\"", target: { label: "SS-20418", href: "/admin/orders?show=all&order=ord-20418" } },
  { hoursAgo: 2.2, actor: "Daniel Otieno", role: "Finance", category: "money", text: "released KES 57,200 to Longhorn Publishers · QBR7X2K9LM", target: { label: "Longhorn · Lakeview Primary", href: "/admin/payments?show=all&payout=po-4" } },
  { hoursAgo: 3.5, actor: "Kevin Mutai", role: "Operations", category: "organisations", text: "asked Tumaini Primary for more information", target: { label: "Tumaini Primary", href: "/admin/organisations?org=app-tumaini" } },
  { hoursAgo: 5, actor: "Kevin Mutai", role: "Operations", category: "catalog", text: "asked Kenya Literature Bureau to change Social Studies Grade 8: \"The cover says Grade 7.\"", target: { label: "Social Studies Grade 8", href: "/admin/catalog?tab=changes_requested&sub=sub-7" } },
  { hoursAgo: 8, actor: "Daniel Otieno", role: "Finance", category: "money", text: "put Moran's Hillcrest Prep payout on hold: \"6 packs short\"", target: { label: "Moran · Hillcrest Prep", href: "/admin/payments?show=all&payout=apo-2" } },
  { hoursAgo: 12, actor: "SchoolShop Ops", role: "Super admin", category: "staff", text: "invited Janet Wairimu as Support", target: { label: "Staff & roles", href: "/admin/staff" } },
  { hoursAgo: 26, actor: "SchoolShop Ops", role: "Super admin", category: "catalog", text: "approved Spotlight English Grade 4 at KES 700 (was KES 680)", target: { label: "Spotlight English Grade 4", href: "/admin/catalog?tab=approved&sub=sub-8" } },
  { hoursAgo: 30, actor: "Daniel Otieno", role: "Finance", category: "money", text: "refunded KES 3,600 to 6 Sunrise Academy parents: Social Studies Grade 4 missing", target: { label: "Refunded", href: "/admin/refunds?tab=refunded" } },
  { hoursAgo: 44, actor: "Kevin Mutai", role: "Operations", category: "catalog", text: "rejected Kasuku Stationers' Geometry set: \"More than twice what schools pay elsewhere\"", target: { label: "Geometry set (no brand)", href: "/admin/catalog?tab=rejected&sub=sub-9" } },
  { hoursAgo: 50, actor: "Kevin Mutai", role: "Operations", category: "organisations", text: "rejected QuickBooks Kenya Ltd's application", target: { label: "QuickBooks Kenya Ltd", href: "/admin/organisations?tab=rejected&org=app-quickbooks" } },
  { hoursAgo: 90, actor: "SchoolShop Ops", role: "Super admin", category: "staff", text: "made Daniel Otieno Finance", target: { label: "Staff & roles", href: "/admin/staff" } },
  { hoursAgo: 144, actor: "Kevin Mutai", role: "Operations", category: "organisations", text: "paused Brightstar School: \"Parents report paid packs not handed out\"", target: { label: "Brightstar School", href: "/admin/organisations?tab=suspended&org=sch-brightstar" } },
]

/** Deliveries a school has disputed. The adapter links each to the affected parents' orders and the publisher's payout. */
export const disputeSeeds = [
  { id: "disp-hillcrest", kind: "short" as const, schoolId: "sch-hillcrest", schoolName: "Hillcrest Prep", publisherName: "Moran", deliveryNoteNo: "DN-2101", packs: 6, payoutId: "apo-2",
    detail: "Moran's delivery arrived 6 Primary Science Activities packs short for 5 Green.", reportedAt: "2027-01-13T08:00:00+03:00", reportedBy: "Hillcrest Prep office" },
  { id: "disp-greenhill", kind: "damaged" as const, schoolId: "sch-greenhill", schoolName: "Greenhill Academy", publisherName: "Moran", deliveryNoteNo: "DN-2100", packs: 2, payoutId: "apo-1",
    detail: "2 PP2 Rose packs soaked through, books unusable. Replacements requested.", reportedAt: "2027-01-09T14:05:00+03:00", reportedBy: "Grace Wambui" },
]

/** Refunds already paid this term, before the demo starts: Sunrise's short Longhorn delivery. */
export const refundLogSeed = Array.from({ length: 6 }, (_, i) => ({
  id: `rf-seed-${i + 1}`, at: `2027-01-06T1${i < 3 ? 2 : 3}:${String(10 + i * 7).padStart(2, "0")}:00+03:00`, orderId: null, orderNumber: `SS-1870${i + 2}`, schoolName: "Sunrise Academy",
  phone: null, amountCents: k(600), reason: "Social Studies Grade 4 missing from Longhorn's delivery", actor: "Kevin Mutai",
}))

/*
 * Every school and publisher, as SchoolShop admins see them: 41 live schools,
 * 9 live publishers, 5 applications waiting, one suspended school and one
 * rejected application.
 */
export const adminOrgs: AdminOrg[] = (() => {
  const day = (d: number, h = 9) => new Date(Date.now() - d * 86_400_000 - (h % 6) * 3_600_000).toISOString().replace(/\.\d+Z$/, "+00:00")
  const verified = (label: string, file: string, d = 120): AdminOrg["checks"][number] => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label, state: "verified", fileName: file, uploadedAt: day(d) })
  const check = (label: string, state: AdminOrg["checks"][number]["state"], file: string | null, d = 2): AdminOrg["checks"][number] => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label, state, fileName: state === "missing" ? null : file, uploadedAt: state === "missing" ? null : day(d) })
  const schoolChecks = (name: string, d = 120) => [
    verified("Ministry of Education registration", `${name} MOE certificate.pdf`, d),
    verified("KRA PIN certificate", "KRA PIN.pdf", d),
    verified("Head teacher's phone verified", "Call on file", d),
    verified("Class list", "Class list.csv", d),
  ]
  const pubChecks = (d = 300) => [
    verified("Certificate of incorporation", "Incorporation.pdf", d),
    verified("KRA PIN certificate", "KRA PIN.pdf", d),
    verified("Payout account", "Bank letter.pdf", d),
    verified("Catalog sample", "Catalog.csv", d),
  ]
  const orgs: AdminOrg[] = []
  const add = (o: Partial<AdminOrg> & Pick<AdminOrg, "id" | "type" | "name" | "town" | "county" | "status">) => {
    const checks = o.checks ?? (o.type === "school" ? schoolChecks(o.name) : pubChecks())
    orgs.push({
      appliedAt: day(200),
      contactName: "—",
      contactPhone: "254700000000",
      contactEmail: null,
      registrationNo: null,
      kraPin: null,
      verifiedAt: o.status === "live" || o.status === "suspended" ? day(150) : null,
      suspendedReason: null,
      stats: [],
      history: [],
      ...o,
      checks,
      openChecks: checks.filter((c) => c.state !== "verified").length,
    })
  }

  // Live schools we already know from the rest of the demo.
  add({ id: "sch-greenhill", type: "school", name: "Greenhill Academy", town: "Nakuru", county: "Nakuru", status: "live", contactName: "Grace Wambui", contactPhone: "254722000111", contactEmail: "office@greenhill.ac.ke", registrationNo: "MOE/NKR/P/1187", kraPin: "P051887120K", verifiedAt: "2026-08-02T10:15:00+03:00",
    stats: [{ label: "Students", value: "540" }, { label: "Paid orders this term", value: "312" }, { label: "Sales this term", value: "KES 1,006,520" }, { label: "Booklists", value: "5 published, 1 draft" }],
    history: [{ id: "h1", at: "2026-08-02T10:15:00+03:00", actor: "SchoolShop Ops", text: "approved Greenhill Academy" }] })
  for (const [id, name, town, county] of [
    ["sch-stmarys", "St. Mary's Primary", "Eldoret", "Uasin Gishu"], ["sch-kilimani", "Kilimani Primary", "Nairobi", "Nairobi"], ["sch-riverside", "Riverside Junior School", "Kisumu", "Kisumu"],
    ["sch-hillcrest", "Hillcrest Prep", "Nyeri", "Nyeri"], ["sch-sunrise", "Sunrise Academy", "Machakos", "Machakos"], ["sch-lakeview", "Lakeview Primary", "Naivasha", "Nakuru"], ["sch-kitale", "Kitale Hills Academy", "Kitale", "Trans Nzoia"],
  ]) add({ id, type: "school", name, town, county, status: "live", stats: [{ label: "Paid orders this term", value: String(90 + name.length * 7) }] })
  // The rest of the 41 live schools.
  const first = ["Upendo", "Neema", "Jabali", "Mlima", "Bidii", "Faraja", "Imani", "Nuru", "Tumaini", "Baraka", "Shujaa", "Uzima", "Pendo", "Kesho", "Juhudi", "Heri", "Wema"]
  const kinds = ["Primary", "Academy", "Junior School"]
  const places: [string, string][] = [["Thika", "Kiambu"], ["Kericho", "Kericho"], ["Embu", "Embu"], ["Meru", "Meru"], ["Kakamega", "Kakamega"], ["Nanyuki", "Laikipia"], ["Kisii", "Kisii"], ["Malindi", "Kilifi"], ["Bungoma", "Bungoma"], ["Kitui", "Kitui"], ["Ruiru", "Kiambu"]]
  for (let i = 0; orgs.length < 41; i++) {
    const [town, county] = places[i % places.length]
    add({ id: `sch-gen-${i}`, type: "school", name: `${first[i % first.length]} ${kinds[i % kinds.length]}${i >= first.length ? ` ${town}` : ""}`, town, county, status: "live", stats: [{ label: "Paid orders this term", value: String(40 + ((i * 37) % 260)) }] })
  }
  // Live publishers.
  for (const [id, name, town] of [["pub-longhorn", "Longhorn Publishers", "Nairobi"], ["pub-klb", "Kenya Literature Bureau", "Nairobi"], ["pub-oxford", "Oxford University Press East Africa", "Nairobi"], ["pub-moran", "Moran Publishers", "Nairobi"], ["pub-kasuku", "Kasuku Stationers", "Nairobi"], ["pub-storymoja", "Storymoja", "Nairobi"], ["pub-spotlight", "Spotlight Publishers", "Nairobi"], ["pub-mentor", "Mentor Publishers", "Nairobi"], ["pub-phoenix", "Phoenix Publishers", "Nairobi"]])
    add({ id, type: "publisher", name, town, county: "Nairobi", status: "live", contactName: id === "pub-longhorn" ? "Peter Kamau" : "—", contactPhone: id === "pub-longhorn" ? "254700000444" : "254700000000",
      stats: id === "pub-longhorn" ? [{ label: "Live titles", value: "7" }, { label: "Schools supplied", value: "7" }, { label: "Paid out this term", value: "KES 2,187,200" }] : [] })

  // Waiting for review: three schools, two publishers.
  add({ id: "app-mwangaza", type: "school", name: "Mwangaza Academy", town: "Thika", county: "Kiambu", status: "pending", appliedAt: day(1, 15), contactName: "Joyce Wairimu", contactPhone: "254733000222", contactEmail: "head@mwangaza.ac.ke", registrationNo: null, kraPin: "P052209981Q",
    checks: [check("Ministry of Education registration", "missing", null), check("KRA PIN certificate", "uploaded", "KRA PIN certificate.pdf", 1), check("Head teacher's phone verified", "verified", "Verified by one-time code", 1), check("Class list", "uploaded", "Mwangaza class lists 2027.csv", 1)],
    history: [{ id: "h1", at: day(1, 15), actor: "Joyce Wairimu", text: "applied as a school" }] })
  add({ id: "app-bahari", type: "school", name: "Bahari Junior School", town: "Mombasa", county: "Mombasa", status: "pending", appliedAt: day(0, 6), contactName: "Hassan Ali", contactPhone: "254711000333", contactEmail: "admin@baharijunior.sc.ke", registrationNo: "MOE/MSA/P/2214", kraPin: "P051774409M",
    checks: [check("Ministry of Education registration", "uploaded", "MOE certificate.pdf", 0), check("KRA PIN certificate", "uploaded", "KRA PIN.pdf", 0), check("Head teacher's phone verified", "verified", "Verified by one-time code", 0), check("Class list", "uploaded", "Classes.csv", 0)],
    history: [{ id: "h1", at: day(0, 6), actor: "Hassan Ali", text: "applied as a school" }] })
  add({ id: "app-tumaini", type: "school", name: "Tumaini Primary", town: "Machakos", county: "Machakos", status: "info_requested", appliedAt: day(4), contactName: "Peter Musyoka", contactPhone: "254722550101", contactEmail: null, registrationNo: "MOE/MKS/P/0931", kraPin: null,
    checks: [check("Ministry of Education registration", "verified", "MOE.pdf", 4), check("KRA PIN certificate", "failed", "KRA PIN.jpg", 4), check("Head teacher's phone verified", "verified", "Verified by one-time code", 4), check("Class list", "missing", null)],
    history: [{ id: "h2", at: day(2), actor: "Kevin Mutai", text: "asked for more information: \"The KRA PIN photo is unreadable. Please upload the PDF from iTax, and your class lists.\"" }, { id: "h1", at: day(4), actor: "Peter Musyoka", text: "applied as a school" }] })
  add({ id: "app-jamii", type: "publisher", name: "Jamii Educational Books", town: "Nairobi", county: "Nairobi", status: "pending", appliedAt: day(3), contactName: "Esther Njoki", contactPhone: "254700000555", contactEmail: "esther@jamiibooks.co.ke", registrationNo: "PVT-2019-0048812", kraPin: "P051998201L",
    checks: [check("Certificate of incorporation", "uploaded", "CR12 and incorporation.pdf", 3), check("KRA PIN certificate", "uploaded", "KRA PIN.pdf", 3), check("Payout account", "missing", null), check("Catalog sample", "uploaded", "Jamii catalog 2027.csv", 3)],
    history: [{ id: "h1", at: day(3), actor: "Esther Njoki", text: "applied as a publisher" }] })
  add({ id: "app-uhuru", type: "publisher", name: "Uhuru Stationers", town: "Kisumu", county: "Kisumu", status: "pending", appliedAt: day(1), contactName: "Otieno Ochieng", contactPhone: "254790000555", contactEmail: null, registrationNo: "BN-2016-771204", kraPin: "A009812214Z",
    checks: [check("Certificate of incorporation", "uploaded", "Business name certificate.pdf", 1), check("KRA PIN certificate", "uploaded", "KRA PIN.pdf", 1), check("Payout account", "uploaded", "M-Pesa till confirmation.png", 1), check("Catalog sample", "uploaded", "Price list.csv", 1)],
    history: [{ id: "h1", at: day(1), actor: "Otieno Ochieng", text: "applied as a publisher" }] })
  // Suspended and rejected.
  add({ id: "sch-brightstar", type: "school", name: "Brightstar School", town: "Eldoret", county: "Uasin Gishu", status: "suspended", contactName: "Daniel Rono", contactPhone: "254722909090", suspendedReason: "Parents report paid packs not handed out. Paused while we investigate.",
    history: [{ id: "h2", at: day(6), actor: "SchoolShop Ops", text: "paused Brightstar School: \"Parents report paid packs not handed out. Paused while we investigate.\"" }, { id: "h1", at: day(200), actor: "SchoolShop Ops", text: "approved Brightstar School" }] })
  add({ id: "app-quickbooks", type: "publisher", name: "QuickBooks Kenya Ltd", town: "Nairobi", county: "Nairobi", status: "rejected", appliedAt: day(9), contactName: "J. Doe", contactPhone: "254701000999",
    checks: [check("Certificate of incorporation", "failed", "certificate.jpg", 9), check("KRA PIN certificate", "missing", null), check("Payout account", "missing", null), check("Catalog sample", "missing", null)],
    history: [{ id: "h2", at: day(8), actor: "Kevin Mutai", text: "rejected the application: \"The incorporation certificate doesn't match the company name and no KRA PIN was provided.\"" }, { id: "h1", at: day(9), actor: "J. Doe", text: "applied as a publisher" }] })
  return orgs
})()

export const adminOverview: AdminOverview = {
  termName: "Term 1, 2027",
  salesCents: k(4_820_000),
  paidOrders: 1284,
  heldCents: k(2_100_000),
  mpesaSuccessRate: 0.961,
  liveSchools: 41,
  livePublishers: 9,
  alerts: [
    { id: "al-1", severity: "high", title: "3 schools waiting for verification", detail: "Oldest: 2 days ago", href: "/admin/organisations" },
    { id: "al-2", severity: "high", title: "2 publisher applications", detail: "Documents uploaded", href: "/admin/organisations" },
    { id: "al-3", severity: "medium", title: "4 M-Pesa payments not confirmed", detail: "No callback after 2 minutes, status check queued", href: "/admin/orders?show=attention" },
    { id: "al-4", severity: "medium", title: "1 short-delivery dispute", detail: "Hillcrest Prep · Moran · 6 packs", href: "/admin/orders?show=attention" },
    { id: "al-5", severity: "info", title: "6 refunds to approve", detail: "Out-of-stock lines, KES 7,980", href: "/admin/orders?show=attention" },
  ],
}

type MembershipSeed = Pick<User["memberships"][number], "orgId" | "orgName" | "orgType" | "role">
const user = (id: string, name: string, phone: string, roles: User["roles"], memberships: MembershipSeed[] = [], email: string | null = null): User => ({
  id, name, phone, email, roles, memberships: memberships.map((m) => ({ ...m, staffRole: "", permissions: [], classNames: [] })),
})

/** Staff at each organisation, with their role. Contact is how they sign in (phone or email). */
type StaffSeed = { id: string; name: string; contact: string; role: string; classNames: string[]; status: "active" | "invited" | "suspended"; lastActiveAt: string | null }
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
export const staffDirectories: Record<"school" | "publisher" | "platform", { orgId: string; members: StaffSeed[]; activity: { id: string; at: string; actor: string; text: string }[] }> = {
  school: {
    orgId: "sch-greenhill",
    members: [
      { id: "st-1", name: "Grace Wambui", contact: "254722000111", role: "school_admin", classNames: [], status: "active", lastActiveAt: hoursAgo(0.2) },
      { id: "st-2", name: "Samuel Kiprop", contact: "254711908765", role: "bursar", classNames: [], status: "active", lastActiveAt: hoursAgo(3) },
      { id: "st-3", name: "Mercy Achieng", contact: "254733200411", role: "teacher", classNames: ["4 East", "PP2 Rose"], status: "active", lastActiveAt: hoursAgo(26) },
      { id: "st-4", name: "John Mwangi", contact: "j.mwangi@greenhill.ac.ke", role: "teacher", classNames: ["7 Blue", "7 Green"], status: "active", lastActiveAt: hoursAgo(50) },
      { id: "st-5", name: "Lucy Chebet", contact: "254799331200", role: "teacher", classNames: ["PP2 Lily"], status: "invited", lastActiveAt: null },
    ],
    activity: [
      { id: "a-3", at: hoursAgo(20), actor: "Grace Wambui", text: "invited Lucy Chebet as Teacher for PP2 Lily" },
      { id: "a-2", at: hoursAgo(70), actor: "Grace Wambui", text: "gave Mercy Achieng PP2 Rose as well as 4 East" },
      { id: "a-1", at: hoursAgo(300), actor: "Grace Wambui", text: "made Samuel Kiprop Bursar" },
    ],
  },
  publisher: {
    orgId: "pub-longhorn",
    members: [
      { id: "tm-1", name: "Peter Kamau", contact: "254700000444", role: "admin", classNames: [], status: "active", lastActiveAt: hoursAgo(0.1) },
      { id: "tm-2", name: "Joseph Mwangi", contact: "254711222333", role: "warehouse", classNames: [], status: "active", lastActiveAt: hoursAgo(5) },
      { id: "tm-3", name: "Ann Njeri", contact: "ann.njeri@longhorn.co.ke", role: "finance", classNames: [], status: "active", lastActiveAt: hoursAgo(28) },
      { id: "tm-4", name: "Brian Otieno", contact: "254733111222", role: "warehouse", classNames: [], status: "invited", lastActiveAt: null },
      { id: "tm-5", name: "Moses Kibet", contact: "254720555901", role: "warehouse", classNames: [], status: "suspended", lastActiveAt: hoursAgo(400) },
    ],
    activity: [
      { id: "a-2", at: hoursAgo(30), actor: "Peter Kamau", text: "invited Brian Otieno as Warehouse" },
      { id: "a-1", at: hoursAgo(200), actor: "Peter Kamau", text: "paused Moses Kibet's access" },
    ],
  },
  platform: {
    orgId: "platform",
    members: [
      { id: "ps-1", name: "SchoolShop Ops", contact: "254799000999", role: "super_admin", classNames: [], status: "active", lastActiveAt: hoursAgo(0.1) },
      { id: "ps-2", name: "Kevin Mutai", contact: "254799000333", role: "operations", classNames: [], status: "active", lastActiveAt: hoursAgo(2) },
      { id: "ps-3", name: "Daniel Otieno", contact: "254799000111", role: "finance", classNames: [], status: "active", lastActiveAt: hoursAgo(7) },
      { id: "ps-4", name: "Lilian Achieng", contact: "254799000222", role: "support", classNames: [], status: "active", lastActiveAt: hoursAgo(1) },
      { id: "ps-5", name: "Janet Wairimu", contact: "janet@schoolshop.co.ke", role: "support", classNames: [], status: "invited", lastActiveAt: null },
    ],
    activity: [
      { id: "a-2", at: hoursAgo(12), actor: "SchoolShop Ops", text: "invited Janet Wairimu as Support" },
      { id: "a-1", at: hoursAgo(90), actor: "SchoolShop Ops", text: "made Daniel Otieno Finance" },
    ],
  },
}

/**
 * Demo accounts, keyed by phone (2547XXXXXXXX). In mock mode every one-time
 * code is 123456 and every demo password is "schoolshop1".
 */
export const demoUsers: Record<string, User> = {
  "254712345678": user("usr-parent", "Achieng Otieno", "254712345678", ["parent"]),
  "254722000111": user("usr-school", "Grace Wambui", "254722000111", ["school_admin"], [
    { orgId: "sch-greenhill", orgName: "Greenhill Academy", orgType: "school", role: "school_admin" },
  ], "grace@greenhill.ac.ke"),
  "254700000444": user("usr-pub", "Peter Kamau", "254700000444", ["publisher"], [
    { orgId: "pub-longhorn", orgName: "Longhorn Publishers", orgType: "publisher", role: "publisher" },
  ]),
  "254799000999": user("usr-admin", "SchoolShop Ops", "254799000999", ["platform_admin"], [
    { orgId: "platform", orgName: "SchoolShop", orgType: "platform", role: "platform_admin" },
  ]),
  // Staff with narrower roles, for trying out access control.
  "254711908765": user("usr-bursar", "Samuel Kiprop", "254711908765", ["school_admin"], [
    { orgId: "sch-greenhill", orgName: "Greenhill Academy", orgType: "school", role: "school_admin" },
  ]),
  "254733200411": user("usr-teacher", "Mercy Achieng", "254733200411", ["teacher"], [
    { orgId: "sch-greenhill", orgName: "Greenhill Academy", orgType: "school", role: "teacher" },
  ]),
  "254711222333": user("usr-warehouse", "Joseph Mwangi", "254711222333", ["publisher"], [
    { orgId: "pub-longhorn", orgName: "Longhorn Publishers", orgType: "publisher", role: "publisher" },
  ]),
  "254722118844": user("usr-pubfinance", "Ann Njeri", "254722118844", ["publisher"], [
    { orgId: "pub-longhorn", orgName: "Longhorn Publishers", orgType: "publisher", role: "publisher" },
  ], "ann.njeri@longhorn.co.ke"),
  "254799000111": user("usr-adminfinance", "Daniel Otieno", "254799000111", ["platform_admin"], [
    { orgId: "platform", orgName: "SchoolShop", orgType: "platform", role: "platform_admin" },
  ]),
  "254799000222": user("usr-support", "Lilian Achieng", "254799000222", ["platform_admin"], [
    { orgId: "platform", orgName: "SchoolShop", orgType: "platform", role: "platform_admin" },
  ]),
}
