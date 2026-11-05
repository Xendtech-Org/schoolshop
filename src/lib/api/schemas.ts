import { z } from "zod"

/*
 * Runtime contracts for the Django REST Framework API.
 *
 * The backend renders camelCase JSON (djangorestframework-camel-case) and
 * stores money as integer KES cents. Every response is parsed with these
 * schemas so a contract drift fails loudly at the boundary instead of deep
 * inside a component.
 */

export const roleSchema = z.enum(["parent", "school_admin", "teacher", "publisher", "platform_admin"])
export type Role = z.infer<typeof roleSchema>

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })
const cents = z.number().int().nonnegative()

export const membershipSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  orgType: z.enum(["school", "publisher", "platform"]),
  role: roleSchema,
  /** The staff role inside the organisation (see lib/access), e.g. "bursar". */
  staffRole: z.string().default(""),
  /** What this person may do there; the API enforces the same list. */
  permissions: z.array(z.string()).default([]),
  /** Teachers: the classes they hand out packs for. */
  classNames: z.array(z.string()).default([]),
})
export type Membership = z.infer<typeof membershipSchema>

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.email().nullable(),
  roles: z.array(roleSchema).min(1),
  memberships: z.array(membershipSchema),
})
export type User = z.infer<typeof userSchema>

export const authTokensSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  user: userSchema,
})
export type AuthTokens = z.infer<typeof authTokensSchema>

/** Where a one-time code went, e.g. { channel: "sms", destination: "0712 ••• 678" }. */
export const codeSentSchema = z.object({
  sent: z.literal(true),
  channel: z.enum(["sms", "email"]),
  destination: z.string(),
})
export type CodeSent = z.infer<typeof codeSentSchema>

export const orgApplicationSchema = z.object({
  id: z.string(),
  orgType: z.enum(["school", "publisher"]),
  orgName: z.string(),
  status: z.enum(["pending_review", "approved", "rejected"]),
})
export type OrgApplication = z.infer<typeof orgApplicationSchema>

/** The applicant's own view of their documents, from the link SchoolShop texts them. */
export const applicationDocumentsSchema = z.object({
  orgName: z.string(),
  orgType: z.enum(["school", "publisher"]),
  status: z.enum(["pending", "info_requested", "live", "suspended", "rejected"]),
  /** False once SchoolShop has decided: nothing more to send. */
  open: z.boolean(),
  documents: z.array(
    z.object({ key: z.string(), label: z.string(), state: z.enum(["verified", "uploaded", "missing", "failed"]), fileName: z.string().nullable(), canUpload: z.boolean() })
  ),
})
export type ApplicationDocuments = z.infer<typeof applicationDocumentsSchema>

export const schoolSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  town: z.string(),
  county: z.string(),
  verified: z.boolean(),
})
export type School = z.infer<typeof schoolSchema>

export const booklistStatusSchema = z.enum(["draft", "published", "closed"])

export const booklistItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  title: z.string(),
  publisherName: z.string(),
  subject: z.string(),
  unitPriceCents: cents,
  qtyPerStudent: z.number().int().positive(),
  required: z.boolean(),
  /** The teacher's note to parents, e.g. "Last year's copy is fine if it's in good condition". */
  note: z.string().nullable().default(null),
})
export type BooklistItem = z.infer<typeof booklistItemSchema>

export const booklistSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  termName: z.string(),
  gradeName: z.string(),
  classNames: z.array(z.string()),
  orderDeadline: isoDate,
  deliverBy: isoDate,
  status: booklistStatusSchema,
  items: z.array(booklistItemSchema),
})
export type Booklist = z.infer<typeof booklistSchema>

export const booklistSummarySchema = booklistSchema
  .omit({ items: true })
  .extend({ itemCount: z.number().int(), requiredTotalCents: cents })
export type BooklistSummary = z.infer<typeof booklistSummarySchema>

/** A grade at the school, whether or not it has a booklist yet. */
export const schoolGradeSchema = z.object({
  gradeName: z.string(),
  classNames: z.array(z.string()),
  students: z.number().int(),
})
export type SchoolGrade = z.infer<typeof schoolGradeSchema>

export const schoolBooklistsSchema = z.object({
  termName: z.string(),
  lists: z.array(booklistSummarySchema.extend({ ordered: z.number().int(), students: z.number().int() })),
  /** Grades that have no list this term yet. */
  gradesWithoutList: z.array(schoolGradeSchema),
})
export type SchoolBooklists = z.infer<typeof schoolBooklistsSchema>

/** A title a school can put on a list: every live publisher title, plus stationery. */
export const schoolCatalogItemSchema = z.object({
  productId: z.string(),
  title: z.string(),
  publisherName: z.string(),
  subject: z.string(),
  gradeLabel: z.string(),
  category: z.enum(["textbook", "reader", "reference", "stationery"]),
  isbn: z.string().nullable(),
  priceCents: cents,
})
export type SchoolCatalogItem = z.infer<typeof schoolCatalogItemSchema>

export const orderStatusSchema = z.enum([
  "pending_payment",
  "payment_failed",
  "paid",
  "in_fulfilment",
  "at_school",
  "collected",
  "cancelled",
  "partially_refunded",
  "refunded",
])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderRefSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  expectedAtSchool: isoDate.nullable(),
})

export const childSchema = z.object({
  id: z.string(),
  name: z.string(),
  admissionNo: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  gradeName: z.string(),
  className: z.string(),
  openBooklist: booklistSummarySchema.nullable(),
  latestOrder: orderRefSchema.nullable(),
})
export type Child = z.infer<typeof childSchema>

export const shipmentStatusSchema = z.enum(["collecting", "ready_to_pack", "dispatched", "received"])

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  /** The school term the order is for, e.g. "Term 1, 2027". */
  termName: z.string().default("Term 1, 2027"),
  studentName: z.string(),
  schoolName: z.string(),
  className: z.string(),
  subtotalCents: cents,
  totalCents: cents,
  collectionCode: z.string().nullable(),
  paidAt: isoDateTime.nullable(),
  mpesaReceipt: z.string().nullable(),
  expectedAtSchool: isoDate.nullable(),
  collectedAt: isoDateTime.nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      publisherName: z.string(),
      qty: z.number().int().positive(),
      unitPriceCents: cents,
      status: z.enum(["active", "unavailable", "refunded"]),
      /** Downloads that come with the title, once it's paid for. Only on the parent's own order. */
      resources: z.array(z.object({ id: z.string(), label: z.string(), name: z.string(), sizeBytes: z.number().int().nonnegative() })).optional(),
    })
  ),
  shipments: z.array(
    z.object({
      publisherName: z.string(),
      summary: z.string(),
      status: shipmentStatusSchema,
    })
  ),
  /** Lines the parent can still ask to have refunded. Only on the parent's own order. */
  refundableItemIds: z.array(z.string()).optional(),
  /** A refund on this order is waiting for SchoolShop. */
  refundWaiting: z.boolean().optional(),
})
export type Order = z.infer<typeof orderSchema>

export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  method: z.enum(["mpesa", "card"]),
  status: z.enum(["initiated", "succeeded", "failed"]),
  amountCents: cents,
  phone: z.string().nullable(),
  failureReason: z.enum(["timeout", "cancelled", "insufficient_funds", "declined"]).nullable(),
  /** Card payments: the provider's hosted checkout page (Stripe or Paystack) to send the parent to. */
  redirectUrl: z.string().nullable().default(null),
})

/** Which ways to pay SchoolShop has switched on. */
export const paymentOptionsSchema = z.object({
  mpesa: z.boolean(),
  card: z.boolean(),
  cardProvider: z.enum(["stripe", "paystack"]).nullable(),
})
export type PaymentOptions = z.infer<typeof paymentOptionsSchema>
export type Payment = z.infer<typeof paymentSchema>

export const productSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Optional thumbnail used by mock fixtures and future publisher uploads. */
  imageUrl: z.url().optional(),
  publisherName: z.string(),
  subject: z.string(),
  gradeLabel: z.string(),
  gradeBand: z.enum(["pp", "1-3", "4-6", "7-9", "all"]),
  priceCents: cents,
  schoolListCount: z.number().int().nonnegative(),
  /** Optional catalogue facets; existing backend records remain valid while migrated. */
  category: z.enum(["textbook", "reader", "reference", "revision", "stationery", "college"]).optional(),
  curricula: z.array(z.string()).optional(),
  audience: z.enum(["school", "college", "all"]).optional(),
  department: z.string().optional(),
  faculty: z.string().optional(),
  gradeIds: z.array(z.string()).optional(),
})
export type Product = z.infer<typeof productSchema>

/** A file a publisher attached to a title. Downloaded through the API, never linked directly. */
export const catalogFileSchema = z.object({
  id: z.string(),
  /** document: for SchoolShop's review (e.g. KICD approval letter) · resource: comes with the title (e-book, worksheets) */
  kind: z.enum(["document", "resource"]),
  label: z.string(),
  /** The file name as uploaded. */
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  contentType: z.string(),
  uploadedAt: isoDateTime,
})
export type CatalogFile = z.infer<typeof catalogFileSchema>

export const productDetailSchema = productSchema.extend({
  description: z.string(),
  isbn: z.string().nullable(),
  pages: z.number().int().positive().nullable(),
  format: z.string(),
  kicdApproved: z.boolean(),
  /** A few schools whose published lists include this item, for reassurance. */
  onSchoolLists: z.array(z.object({ slug: z.string(), name: z.string(), town: z.string() })),
  related: z.array(productSchema),
  /** Downloads that come with the title, available to parents once they've bought it. */
  resources: z.array(z.object({ id: z.string(), label: z.string(), name: z.string(), sizeBytes: z.number().int().nonnegative() })).default([]),
})
export type ProductDetail = z.infer<typeof productDetailSchema>

export const gradeBandSchema = z.enum(["pp", "1-3", "4-6", "7-9", "all"])

/** A title in a publisher's own catalog, with stock. Parents see it as a Product. */
export const catalogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  gradeLabel: z.string(),
  gradeBand: gradeBandSchema,
  isbn: z.string().nullable(),
  format: z.string(),
  priceCents: cents,
  stock: z.number().int().nonnegative(),
  /** At or below this, the title shows as low stock. */
  lowStockAt: z.number().int().nonnegative(),
  status: z.enum(["live", "draft"]),
  schoolListCount: z.number().int().nonnegative(),
  /** The uploaded cover, or null to show a coloured placeholder. */
  coverUrl: z.url().nullable().default(null),
  files: z.array(catalogFileSchema).default([]),
  /** New titles wait for SchoolShop to check them before schools can see them. */
  review: z
    .object({ state: z.enum(["pending", "changes_requested", "rejected"]), note: z.string().nullable(), submittedAt: isoDateTime })
    .nullish(),
})
export type CatalogItem = z.infer<typeof catalogItemSchema>

/** Products on a school's booklist can't be deleted; they come back in kept with the reason. */
export const catalogDeleteResultSchema = z.object({
  deleted: z.number().int().nonnegative(),
  kept: z.array(z.object({ id: z.string(), title: z.string(), reason: z.string() })),
})
export type CatalogDeleteResult = z.infer<typeof catalogDeleteResultSchema>

export const schoolOverviewSchema = z.object({
  schoolName: z.string(),
  termName: z.string(),
  studentsOrdered: z.number().int(),
  studentsTotal: z.number().int(),
  orderDeadline: isoDate,
  deliveriesReceived: z.number().int(),
  deliveriesExpected: z.number().int(),
  packsCollected: z.number().int(),
  booklists: z.array(
    booklistSummarySchema.extend({ ordered: z.number().int(), students: z.number().int() })
  ),
  deliveries: z.array(
    z.object({
      id: z.string(),
      publisherName: z.string(),
      packs: z.number().int(),
      status: shipmentStatusSchema,
      date: isoDate.nullable(),
    })
  ),
})
export type SchoolOverview = z.infer<typeof schoolOverviewSchema>

/** One row per enrolled student, whether or not their parent has ordered. */
export const studentOrderRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  admissionNo: z.string(),
  gradeName: z.string(),
  className: z.string(),
  parentName: z.string().nullable(),
  /** Masked ("0712 ••• 678"); SchoolShop sends reminders, the school never sees the full number. */
  parentPhone: z.string().nullable(),
  order: z
    .object({
      id: z.string(),
      number: z.string(),
      status: orderStatusSchema,
      totalCents: cents,
      itemCount: z.number().int(),
      paidAt: isoDateTime.nullable(),
    })
    .nullable(),
  remindedAt: isoDateTime.nullable(),
})
export type StudentOrderRow = z.infer<typeof studentOrderRowSchema>

export const schoolOrdersSchema = z.object({
  termName: z.string(),
  orderDeadline: isoDate,
  rows: z.array(studentOrderRowSchema),
})
export type SchoolOrders = z.infer<typeof schoolOrdersSchema>

export const schoolOrderDetailSchema = orderSchema.extend({
  admissionNo: z.string(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
})
export type SchoolOrderDetail = z.infer<typeof schoolOrderDetailSchema>

export const remindResultSchema = z.object({ sent: z.number().int(), skipped: z.number().int() })

export const deliveryIssueSchema = z.enum(["damaged", "wrong_items"])

/** One publisher's delivery to the school for the term: every pack for every class, in one drop. */
export const schoolDeliverySchema = z.object({
  id: z.string(),
  publisherName: z.string(),
  status: shipmentStatusSchema,
  packs: z.number().int(),
  expectedAt: isoDate.nullable(),
  classes: z.array(z.object({ className: z.string(), expected: z.number().int(), received: z.number().int().nullable() })),
  dispatch: z
    .object({
      deliveryNoteNo: z.string(),
      carrier: z.string(),
      driverName: z.string(),
      driverPhone: z.string(),
      vehicleReg: z.string(),
      cartons: z.number().int(),
      dispatchedAt: isoDateTime,
    })
    .nullable(),
  receipt: z
    .object({
      receivedAt: isoDateTime,
      receivedBy: z.string(),
      packsReceived: z.number().int(),
      issues: z.array(deliveryIssueSchema),
      notes: z.string(),
      /** Read out to the driver as proof of delivery. */
      signOffCode: z.string(),
    })
    .nullable(),
})
export type SchoolDelivery = z.infer<typeof schoolDeliverySchema>

export const schoolBatchSchema = z.object({
  id: z.string(),
  schoolName: z.string(),
  town: z.string(),
  packs: z.number().int(),
  valueCents: cents,
  dueAtSchool: isoDate,
  status: shipmentStatusSchema,
  collectingUntil: isoDate.nullable(),
  lines: z.array(z.object({ title: z.string(), qty: z.number().int() })),
  /** Titles the publisher could not supply; parents are refunded for these lines. */
  unavailableLines: z.array(z.string()).default([]),
  dispatch: z
    .object({
      deliveryNoteNo: z.string(),
      carrier: z.string(),
      driverName: z.string(),
      driverPhone: z.string(),
      vehicleReg: z.string(),
      cartons: z.number().int().positive(),
      dispatchedAt: isoDateTime,
      expectedAt: isoDate,
    })
    .nullable()
    .default(null),
  receipt: z
    .object({
      receivedAt: isoDateTime,
      receivedBy: z.string(),
      /** What the school flagged on receipt, e.g. a short delivery. */
      issue: z.string().nullable(),
      payout: z.enum(["queued", "paid"]),
    })
    .nullable()
    .default(null),
})
export type SchoolBatch = z.infer<typeof schoolBatchSchema>

export const payoutAccountSchema = z.object({
  method: z.enum(["mpesa_paybill", "mpesa_till", "bank"]),
  accountName: z.string(),
  /** Display string with the number partly hidden, e.g. "Paybill 522 *** 11 · Account LONGHORN". */
  masked: z.string(),
  status: z.enum(["verified", "pending_verification"]),
})
export type PayoutAccount = z.infer<typeof payoutAccountSchema>

export const payoutSchema = z.object({
  id: z.string(),
  termName: z.string(),
  schoolName: z.string(),
  town: z.string(),
  deliveryNoteNo: z.string(),
  /** When the school confirmed the delivery; null while it's still on the way. */
  receivedAt: isoDateTime.nullable(),
  grossCents: cents,
  commissionCents: cents,
  /** Refunds taken off before payout, e.g. a short delivery. */
  deductionsCents: cents,
  deductionNote: z.string().nullable(),
  netCents: cents,
  /** held: not yet received · on_hold: the school flagged an issue · queued: approved, not sent · paid */
  status: z.enum(["held", "on_hold", "queued", "paid"]),
  paidAt: isoDateTime.nullable(),
  reference: z.string().nullable(),
})
export type Payout = z.infer<typeof payoutSchema>

/** A publisher's payout as SchoolShop finance sees it, across every publisher. */
export const adminPayoutSchema = payoutSchema.extend({
  publisherId: z.string(),
  publisherName: z.string(),
  account: payoutAccountSchema,
  packs: z.number().int(),
  holdReason: z.string().nullable(),
  /** Ready, but the publisher's total is under the smallest payout, so it waits for their next delivery. */
  belowMinimum: z.boolean().optional(),
  events: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
})
export type AdminPayout = z.infer<typeof adminPayoutSchema>

export const adminMoneySchema = z.object({
  termName: z.string(),
  commissionRate: z.number(),
  payouts: z.array(adminPayoutSchema),
})
export type AdminMoney = z.infer<typeof adminMoneySchema>

/** One M-Pesa payment from a parent, for reconciling against the Paybill statement. */
export const collectionSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  orderId: z.string(),
  orderNumber: z.string(),
  schoolName: z.string(),
  phone: z.string(),
  amountCents: cents,
  receipt: z.string().nullable(),
  status: z.enum(["succeeded", "failed", "unconfirmed"]),
})
export type Collection = z.infer<typeof collectionSchema>

export const publisherPayoutsSchema = z.object({
  commissionRate: z.number().min(0).max(1),
  account: payoutAccountSchema,
  payouts: z.array(payoutSchema),
})
export type PublisherPayouts = z.infer<typeof publisherPayoutsSchema>


export const notificationEventSchema = z.enum(["batch_ready", "delivery_issue", "payout_sent", "low_stock", "weekly_summary"])
export type NotificationEvent = z.infer<typeof notificationEventSchema>

export const publisherSettingsSchema = z.object({
  profile: z.object({
    companyName: z.string(),
    kraPin: z.string(),
    verifiedAt: isoDateTime.nullable(),
    contactName: z.string(),
    phone: z.string(),
    email: z.email(),
    dispatchAddress: z.string(),
    county: z.string(),
  }),
  /** Which channels each event is sent on. */
  notifications: z.record(notificationEventSchema, z.object({ sms: z.boolean(), email: z.boolean() })),
})
export type PublisherSettings = z.infer<typeof publisherSettingsSchema>

/** One paid order's pack, as the school hands it out. */
export const collectionRowSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  studentName: z.string(),
  admissionNo: z.string(),
  gradeName: z.string(),
  className: z.string(),
  itemCount: z.number().int(),
  /** ready: every publisher's part is at school; waiting: some are still on the way. */
  status: z.enum(["ready", "waiting", "collected"]),
  waitingFor: z.array(z.string()),
  collectedAt: isoDateTime.nullable(),
  /** Masked parent phone the collection code was sent to. */
  parentPhone: z.string().nullable(),
})
export type CollectionRow = z.infer<typeof collectionRowSchema>


export const schoolSettingsSchema = z.object({
  profile: z.object({
    schoolName: z.string(),
    /** Ministry of Education registration number, checked when the school joined. */
    registrationNo: z.string(),
    verifiedAt: isoDateTime.nullable(),
    contactName: z.string(),
    phone: z.string(),
    /** Empty until the school fills it in: not every school gave one when it joined. */
    email: z.email().or(z.literal("")),
    county: z.string(),
    deliveryAddress: z.string(),
    deliveryHours: z.string(),
  }),
  parents: z.object({
    /** Days before the order deadline that unpaid parents get an automatic reminder (0 = off). */
    reminderDays: z.number().int(),
    smsWhenAtSchool: z.boolean(),
    collectionPoint: z.enum(["class_teacher", "school_office"]),
  }),
})
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>

export const accountSchema = z.object({
  name: z.string(),
  /** Verified at sign-up; changing it needs a new one-time code. */
  phone: z.string(),
  email: z.email().nullable(),
  /** Number pre-filled at M-Pesa checkout. */
  mpesaPhone: z.string(),
  memberSince: isoDate,
  notifications: z.object({
    /** Order and collection SMSes always go out; these are the optional ones. */
    reminders: z.boolean(),
    emailReceipts: z.boolean(),
    offers: z.boolean(),
  }),
})
export type Account = z.infer<typeof accountSchema>

export const studentSchema = z.object({
  studentId: z.string(),
  name: z.string(),
  admissionNo: z.string(),
  gradeName: z.string(),
  className: z.string(),
  parentName: z.string().nullable(),
  /** Masked once saved: the school typed it in, but staff screens never show it in full. */
  parentPhone: z.string().nullable(),
  /** A parent has linked this child on SchoolShop with the school code. */
  parentLinked: z.boolean(),
  hasOrder: z.boolean(),
})
export type Student = z.infer<typeof studentSchema>

export const classRosterSchema = z.object({
  /** Parents enter this to link their children. */
  joinCode: z.string(),
  classes: z.array(z.object({ className: z.string(), gradeName: z.string(), teacher: z.string().nullable(), students: z.number().int(), linked: z.number().int() })),
  students: z.array(studentSchema),
})
export type ClassRoster = z.infer<typeof classRosterSchema>

export const studentImportResultSchema = z.object({
  valid: z.number().int(),
  created: z.number().int(),
  errors: z.array(z.object({ line: z.number().int(), message: z.string() })),
})
export type StudentImportResult = z.infer<typeof studentImportResultSchema>

/** A CSV price list, checked (dry run) or imported. Same shape as the student import. */
export const catalogImportResultSchema = studentImportResultSchema
export type CatalogImportResult = StudentImportResult

export const staffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Phone (2547…) or email the invite went to. */
  contact: z.string(),
  role: z.string(),
  classNames: z.array(z.string()),
  status: z.enum(["active", "invited", "suspended"]),
  isYou: z.boolean(),
  lastActiveAt: isoDateTime.nullable(),
})
export type StaffMember = z.infer<typeof staffMemberSchema>

export const staffDirectorySchema = z.object({
  members: z.array(staffMemberSchema),
  /** Most recent first: who changed what. */
  activity: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
  /** Schools only: classes a teacher can be given. */
  classNames: z.array(z.string()),
})
export type StaffDirectory = z.infer<typeof staffDirectorySchema>

/** Why an order needs someone at SchoolShop to look at it. */
export const orderIssueSchema = z.enum(["payment_unconfirmed", "short_delivery", "refund_due"])
export type OrderIssue = z.infer<typeof orderIssueSchema>

export const adminOrderSummarySchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  studentName: z.string(),
  className: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  parentName: z.string().nullable(),
  /** Admins see the full number so support can find a parent who calls in. */
  parentPhone: z.string().nullable(),
  totalCents: cents,
  refundedCents: cents,
  createdAt: isoDateTime,
  mpesaReceipt: z.string().nullable(),
  issue: orderIssueSchema.nullable(),
})
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>

/** Who asked for money back on an order, why, and for which items. */
export const refundRequestSchema = z.object({
  from: z.enum(["publisher", "parent"]),
  reason: z.string(),
  itemIds: z.array(z.string()),
  requestedAt: isoDateTime,
})

export const adminOrderSchema = orderSchema.extend({
  schoolId: z.string(),
  admissionNo: z.string().nullable(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
  createdAt: isoDateTime,
  refundedCents: cents,
  issue: orderIssueSchema.nullable(),
  issueDetail: z.string().nullable(),
  refundRequest: refundRequestSchema.nullable(),
  payments: z.array(
    z.object({
      id: z.string(),
      at: isoDateTime,
      phone: z.string(),
      amountCents: cents,
      /** unconfirmed: STK push sent, no callback from M-Pesa yet. */
      status: z.enum(["succeeded", "failed", "unconfirmed"]),
      receipt: z.string().nullable(),
      failureReason: z.string().nullable(),
    })
  ),
  events: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
})
export type AdminOrder = z.infer<typeof adminOrderSchema>

export const refundQueueItemSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  studentName: z.string(),
  schoolName: z.string(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
  from: z.enum(["publisher", "parent"]),
  reason: z.string(),
  items: z.array(z.object({ id: z.string(), title: z.string(), publisherName: z.string(), amountCents: cents })),
  amountCents: cents,
  requestedAt: isoDateTime,
})
export type RefundQueueItem = z.infer<typeof refundQueueItemSchema>

/** A school says a publisher's delivery came short or damaged. Settled by refunding parents or a replacement. */
export const disputeSchema = z.object({
  id: z.string(),
  kind: z.enum(["short", "damaged"]),
  schoolName: z.string(),
  publisherName: z.string(),
  deliveryNoteNo: z.string(),
  packs: z.number().int(),
  detail: z.string(),
  reportedAt: isoDateTime,
  reportedBy: z.string(),
  status: z.enum(["open", "resolved"]),
  resolution: z.string().nullable(),
  /** Parents' orders missing the publisher's items, with what refunding them would cost. */
  orders: z.array(z.object({ id: z.string(), number: z.string(), studentName: z.string(), className: z.string(), amountCents: cents, open: z.boolean(), refunded: z.boolean() })),
  refundCents: cents,
  payout: z.object({ id: z.string(), status: z.enum(["held", "on_hold", "queued", "paid"]), netCents: cents }).nullable(),
  events: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
})
export type Dispute = z.infer<typeof disputeSchema>

export const refundRecordSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  orderId: z.string().nullable(),
  orderNumber: z.string(),
  schoolName: z.string(),
  phone: z.string().nullable(),
  amountCents: cents,
  reason: z.string(),
  actor: z.string(),
})
export type RefundRecord = z.infer<typeof refundRecordSchema>

export const adminRefundsSchema = z.object({
  requests: z.array(refundQueueItemSchema),
  disputes: z.array(disputeSchema),
  refunded: z.array(refundRecordSchema),
})
export type AdminRefunds = z.infer<typeof adminRefundsSchema>

/** A title (or a price change) a publisher sent for SchoolShop to check. */
export const catalogSubmissionSchema = z.object({
  id: z.string(),
  publisherId: z.string(),
  publisherName: z.string(),
  kind: z.enum(["new_title", "price_change"]),
  title: z.string(),
  subject: z.string(),
  gradeLabel: z.string(),
  isbn: z.string().nullable(),
  format: z.string(),
  priceCents: cents,
  previousPriceCents: cents.nullable(),
  submittedAt: isoDateTime,
  status: z.enum(["pending", "changes_requested", "approved", "rejected"]),
  note: z.string().nullable(),
  /** Checked automatically when the title comes in. */
  checks: z.array(z.object({ id: z.string(), label: z.string(), result: z.enum(["pass", "warn", "fail"]), detail: z.string() })),
  similar: z.array(z.object({ title: z.string(), publisherName: z.string(), priceCents: cents })),
  /** The title's cover and attached files, for the reviewer to check. */
  coverUrl: z.url().nullable().default(null),
  files: z.array(catalogFileSchema).default([]),
  history: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
})
export type CatalogSubmission = z.infer<typeof catalogSubmissionSchema>

export const auditCategorySchema = z.enum(["organisations", "orders", "money", "catalog", "staff", "settings"])
export type AuditCategory = z.infer<typeof auditCategorySchema>
/** One thing someone at SchoolShop did. Written by the server; nobody can edit or delete it. */
export const auditEntrySchema = z.object({
  id: z.string(),
  at: isoDateTime,
  actor: z.string(),
  role: z.string(),
  category: auditCategorySchema,
  text: z.string(),
  target: z.object({ label: z.string(), href: z.string() }).nullable(),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

/** How SchoolShop runs: what it charges publishers, when money moves, and what parents see. */
export const platformSettingsSchema = z.object({
  commission: z.object({
    /** Share of what parents pay that SchoolShop keeps, 0–1. */
    defaultRate: z.number(),
    overrides: z.array(z.object({ publisherId: z.string(), publisherName: z.string(), rate: z.number(), note: z.string() })),
  }),
  payouts: z.object({
    /** Days after the school confirms delivery before a payout is ready, so schools can report problems. */
    holdDays: z.number().int(),
    minimumCents: cents,
    autoRelease: z.boolean(),
  }),
  refunds: z.object({
    /** Out-of-stock refunds up to this per order go back without anyone approving them. 0 turns it off. */
    autoApproveUpToCents: cents,
    parentRequestsUntil: z.enum(["dispatched", "at_school"]),
  }),
  mpesa: z.object({ paybill: z.string(), callbackTimeoutMinutes: z.number().int() }),
  terms: z.array(z.object({ id: z.string(), name: z.string(), orderingOpensOn: isoDate, startsOn: isoDate, endsOn: isoDate })),
  support: z.object({ phone: z.string(), whatsapp: z.string(), email: z.string(), hours: z.string() }),
  /** Payment providers. Saved keys only ever come back as their last four characters ("••••4f2a"), or null. */
  payments: z.object({
    /** The server is running with fake providers (demos): no money moves. */
    fake: z.boolean(),
    mpesaReady: z.boolean(),
    cardReady: z.boolean(),
    sasapay: z.object({
      enabled: z.boolean(),
      mode: z.enum(["sandbox", "live"]),
      merchantCode: z.string(),
      clientId: z.string().nullable(),
      clientSecret: z.string().nullable(),
      callbackUrl: z.string(),
    }),
    cardProvider: z.enum(["none", "stripe", "paystack"]),
    stripe: z.object({ secretKey: z.string().nullable(), webhookSecret: z.string().nullable(), webhookUrl: z.string() }),
    paystack: z.object({ secretKey: z.string().nullable(), webhookUrl: z.string() }),
  }),
  publishers: z.array(z.object({ id: z.string(), name: z.string() })),
  updated: z.record(z.string(), z.object({ at: isoDateTime, by: z.string() })),
})
export type PlatformSettings = z.infer<typeof platformSettingsSchema>
export type SettingsSection = "commission" | "payouts" | "refunds" | "mpesa" | "terms" | "support" | "payments"
/** What the admin sends to save the providers. Empty key fields keep the saved key. */
export type PaymentsInput = {
  sasapay: { enabled: boolean; mode: "sandbox" | "live"; merchantCode: string; clientId: string; clientSecret: string }
  cardProvider: "none" | "stripe" | "paystack"
  stripe: { secretKey: string; webhookSecret: string }
  paystack: { secretKey: string }
}

/** A publisher's term at a glance. */
export const publisherOverviewSchema = z.object({
  publisherName: z.string(),
  termName: z.string(),
  /** What parents paid for this publisher's titles this term, less anything it couldn't supply. */
  salesCents: cents,
  packs: z.number().int(),
  schools: z.number().int(),
  /** Share SchoolShop keeps, 0–1: the publisher's own rate or the default. */
  commissionRate: z.number(),
  batches: z.object({ collecting: z.number().int(), readyToPack: z.number().int(), dispatched: z.number().int(), received: z.number().int() }),
  /** Schools whose packs are ready to go, soonest due first. */
  toDispatch: z.array(z.object({ id: z.string(), schoolName: z.string(), town: z.string(), packs: z.number().int(), dueAtSchool: isoDate })),
  catalog: z.object({ live: z.number().int(), inReview: z.number().int(), changesRequested: z.number().int(), lowStock: z.number().int() }),
  /** Best sellers this term, by sales. */
  topTitles: z.array(z.object({ title: z.string(), qty: z.number().int(), salesCents: cents })),
  alerts: z.array(z.object({ id: z.string(), severity: z.enum(["high", "medium", "info"]), title: z.string(), detail: z.string(), href: z.string() })),
})
export type PublisherOverview = z.infer<typeof publisherOverviewSchema>

export const orgStatusSchema = z.enum(["pending", "info_requested", "live", "suspended", "rejected"])
export type OrgStatus = z.infer<typeof orgStatusSchema>

export const adminOrgSummarySchema = z.object({
  id: z.string(),
  type: z.enum(["school", "publisher"]),
  name: z.string(),
  town: z.string(),
  county: z.string(),
  status: orgStatusSchema,
  appliedAt: isoDateTime,
  /** Checks still open, for applications. */
  openChecks: z.number().int(),
})
export type AdminOrgSummary = z.infer<typeof adminOrgSummarySchema>

export const orgCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** verified: someone at SchoolShop checked it; uploaded: waiting to be checked; missing: not sent yet. */
  state: z.enum(["verified", "uploaded", "missing", "failed"]),
  fileName: z.string().nullable(),
  uploadedAt: isoDateTime.nullable(),
  /** The applicant sent a file for this check, which staff can download. */
  hasFile: z.boolean().default(false),
})
export type OrgCheck = z.infer<typeof orgCheckSchema>

export const adminOrgSchema = adminOrgSummarySchema.extend({
  contactName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string().nullable(),
  /** Ministry of Education number for schools, company registration for publishers. */
  registrationNo: z.string().nullable(),
  kraPin: z.string().nullable(),
  verifiedAt: isoDateTime.nullable(),
  suspendedReason: z.string().nullable(),
  checks: z.array(orgCheckSchema),
  /** Live organisations: this term at a glance. */
  stats: z.array(z.object({ label: z.string(), value: z.string() })),
  history: z.array(z.object({ id: z.string(), at: isoDateTime, actor: z.string(), text: z.string() })),
})
export type AdminOrg = z.infer<typeof adminOrgSchema>

export const adminOverviewSchema = z.object({
  termName: z.string(),
  salesCents: cents,
  paidOrders: z.number().int(),
  heldCents: cents,
  mpesaSuccessRate: z.number().min(0).max(1),
  liveSchools: z.number().int(),
  livePublishers: z.number().int(),
  alerts: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["high", "medium", "info"]),
      title: z.string(),
      detail: z.string(),
      href: z.string(),
    })
  ),
})
export type AdminOverview = z.infer<typeof adminOverviewSchema>

/** DRF paginated list envelope. */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    count: z.number().int(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })
