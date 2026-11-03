import { z } from "zod"

import { api } from "@/lib/api/client"
import type { PlatformSettings, PublisherSettings, SchoolSettings, SettingsSection } from "@/lib/api/schemas"
import {
  accountSchema,
  adminMoneySchema,
  adminOrderSchema,
  adminRefundsSchema,
  platformSettingsSchema,
  auditEntrySchema,
  catalogSubmissionSchema,
  collectionSchema,
  adminOrderSummarySchema,
  adminOrgSchema,
  adminOrgSummarySchema,
  adminOverviewSchema,
  authTokensSchema,
  booklistSchema,
  catalogImportResultSchema,
  catalogItemSchema,
  childSchema,
  codeSentSchema,
  orderSchema,
  orgApplicationSchema,
  paginated,
  paymentSchema,
  payoutAccountSchema,
  publisherPayoutsSchema,
  publisherSettingsSchema,
  productDetailSchema,
  productSchema,
  remindResultSchema,
  collectionRowSchema,
  schoolBatchSchema,
  schoolBooklistsSchema,
  schoolCatalogItemSchema,
  schoolDeliverySchema,
  schoolOrderDetailSchema,
  schoolOrdersSchema,
  schoolOverviewSchema,
  schoolSchema,
  classRosterSchema,
  schoolSettingsSchema,
  studentImportResultSchema,
  studentSchema,
  staffDirectorySchema,
  userSchema,
} from "@/lib/api/schemas"

/*
 * One function per DRF endpoint. Components never call axios directly: they use
 * the TanStack Query hooks in ./queries.ts, which wrap these.
 */

async function get<T extends z.ZodType>(url: string, schema: T, params?: object) {
  const { data } = await api.get(url, { params })
  return schema.parse(data) as z.infer<T>
}

async function post<T extends z.ZodType>(url: string, schema: T, body?: object) {
  const { data } = await api.post(url, body)
  return schema.parse(data) as z.infer<T>
}

// Auth. Parents sign in with phone + password (or an SMS code); staff can also use their email.
export const signInWithPassword = (input: { identifier: string; password: string }) =>
  post("/auth/login/", authTokensSchema, input)
export const requestOtp = (phone: string) =>
  post("/auth/otp/request/", codeSentSchema, { phone })
export const verifyOtp = (phone: string, code: string) =>
  post("/auth/otp/verify/", authTokensSchema, { phone, code })

/** Parent sign-up: creates an unverified account and texts a code to the phone. */
export const registerParent = (input: { name: string; phone: string; password: string }) =>
  post("/auth/register/", codeSentSchema, input)
export const verifyRegistration = (phone: string, code: string) =>
  post("/auth/register/verify/", authTokensSchema, { phone, code })
export const resendRegistrationCode = (phone: string) =>
  post("/auth/register/resend/", codeSentSchema, { phone })

/** identifier is a 2547… phone number or an email address. */
export const requestPasswordReset = (identifier: string) =>
  post("/auth/password/forgot/", codeSentSchema, { identifier })
export const resetPassword = (input: { identifier: string; code: string; password: string }) =>
  post("/auth/password/reset/", z.object({ reset: z.literal(true) }), input)

export type OrgApplicationInput = {
  orgType: "school" | "publisher"
  orgName: string
  county: string
  registrationNo: string
  contactName: string
  contactRole: string
  email: string
  phone: string
  password: string
}
/** School or publisher sign-up. Lands in the platform admin verification queue. */
export const applyForOrganisation = (input: OrgApplicationInput) =>
  post("/organisations/applications/", orgApplicationSchema, input)
export const getMe = () => get("/me/", userSchema)

// Public
export const searchSchools = (search: string) =>
  get("/schools/", paginated(schoolSchema), { search })
export const getSchool = (slug: string) => get(`/schools/${slug}/`, schoolSchema)
export const listSchoolBooklists = (slug: string) =>
  get(`/schools/${slug}/booklists/`, z.array(booklistSchema))
export const listProducts = (filters: Record<string, string> = {}) =>
  get("/products/", paginated(productSchema), filters)
export const getProduct = (id: string) => get(`/products/${id}/`, productDetailSchema)

// Parent
export const listChildren = () => get("/children/", z.array(childSchema))
/** Link a child using the code their school gives parents and the child's admission number. */
export const addChild = (input: { schoolCode: string; admissionNo: string; name: string }) => post("/children/", childSchema, input)
export const removeChild = async (id: string) => {
  await api.delete(`/children/${id}/`)
}

export const getAccount = () => get("/account/", accountSchema)
export const updateAccount = async (input: { name: string; email: string | null; mpesaPhone: string }) => {
  const { data } = await api.patch("/account/", input)
  return accountSchema.parse(data)
}
export const updateAccountNotifications = async (input: z.infer<typeof accountSchema>["notifications"]) => {
  const { data } = await api.put("/account/notifications/", input)
  return accountSchema.parse(data)
}
/** Asks SchoolShop to close the account. Refused while an order is in progress. */
export const requestAccountDeletion = () => post("/account/deletion/", z.object({ requested: z.boolean() }))
export const getBooklist = (id: string) => get(`/booklists/${id}/`, booklistSchema)
export type CreateOrderInput = {
  studentId: string
  booklistId: string
  excludedItemIds: string[]
  extraItems: { productId: string; qty: number }[]
}
export const createOrder = (input: CreateOrderInput) =>
  post("/orders/", orderSchema, input)
export const getOrder = (id: string) => get(`/orders/${id}/`, orderSchema)
export const listOrders = () => get("/orders/", paginated(orderSchema))
export const startPayment = (orderId: string, input: { method: "mpesa"; phone: string }) =>
  post(`/orders/${orderId}/payments/`, paymentSchema, input)
export const getPayment = (id: string) => get(`/payments/${id}/`, paymentSchema)

// School
export const getSchoolOverview = () => get("/school/overview/", schoolOverviewSchema)
export const listMyBooklists = () => get("/school/booklists/", schoolBooklistsSchema)
export const createBooklist = (gradeName: string) => post("/school/booklists/", booklistSchema, { gradeName })
export type BooklistInput = {
  orderDeadline: string
  deliverBy: string
  items: { productId: string; required: boolean; qtyPerStudent: number; note: string | null }[]
}
export const saveBooklist = async (id: string, input: BooklistInput) => {
  const { data } = await api.put(`/school/booklists/${id}/`, input)
  return booklistSchema.parse(data)
}
/** Publishing SMSes the parents of every student in the grade's classes. */
export const publishBooklist = (id: string) => post(`/school/booklists/${id}/publish/`, booklistSchema)
export const searchSchoolCatalog = (search: string, category: string) =>
  get("/school/catalog/", z.array(schoolCatalogItemSchema), { search, category })
export const getRoster = () => get("/school/students/", classRosterSchema)
export type StudentInput = { name: string; admissionNo: string; className: string; parentName: string | null; parentPhone: string | null }
export const addStudent = (input: StudentInput) => post("/school/students/", studentSchema, input)
/** Leave parentPhone out to keep the number on file. */
export const updateStudent = async (id: string, input: Partial<StudentInput>) => {
  const { data } = await api.patch(`/school/students/${id}/`, input)
  return studentSchema.parse(data)
}
export const removeStudent = async (id: string) => {
  await api.delete(`/school/students/${id}/`)
}
/** Check rows first with dryRun, then import the valid ones. */
export const importStudents = (rows: Omit<StudentInput, "parentName">[], dryRun: boolean) =>
  post("/school/students/import/", studentImportResultSchema, { rows, dryRun })
/** SMS the school code to parents with a phone on file who haven't linked their child yet. */
export const inviteParents = (className: string | null) => post("/school/students/invite/", z.object({ sent: z.number().int() }), { className })

export const listCollection = () => get("/school/collection/", z.array(collectionRowSchema))
/** Hand over a pack: the code the student or parent reads out must match an order in this class. */
export const handOverPack = (input: { className: string; code: string }) =>
  post("/school/collection/handover/", collectionRowSchema, input)
export const resendCollectionCode = (orderId: string) =>
  post(`/school/collection/${orderId}/resend/`, z.object({ sentTo: z.string() }))

export const getSchoolSettings = () => get("/school/settings/", schoolSettingsSchema)
export type SchoolProfileInput = Pick<SchoolSettings["profile"], "contactName" | "phone" | "email" | "county" | "deliveryAddress" | "deliveryHours">
export const updateSchoolProfile = async (input: SchoolProfileInput) => {
  const { data } = await api.patch("/school/settings/profile/", input)
  return schoolSettingsSchema.parse(data)
}
export const updateParentSettings = async (input: SchoolSettings["parents"]) => {
  const { data } = await api.put("/school/settings/parents/", input)
  return schoolSettingsSchema.parse(data)
}

export const listSchoolDeliveries = () => get("/school/deliveries/", z.array(schoolDeliverySchema))
export const getSchoolDelivery = (id: string) => get(`/school/deliveries/${id}/`, schoolDeliverySchema)
export type ReceiveInput = {
  classes: { className: string; received: number }[]
  issues: ("damaged" | "wrong_items")[]
  notes: string
}
/** Confirm a delivery. Releases the publisher's payment for the packs received; short or damaged packs open a claim. */
export const receiveDelivery = (id: string, input: ReceiveInput) =>
  post(`/school/deliveries/${id}/receive/`, schoolDeliverySchema, input)
export const getSchoolOrders = () => get("/school/orders/", schoolOrdersSchema)
export const getSchoolOrder = (id: string) => get(`/school/orders/${id}/`, schoolOrderDetailSchema)
/** SMS the parents of these students. Students without a phone, or reminded in the last 24 h, are skipped. */
export const remindParents = (studentIds: string[]) =>
  post("/school/orders/remind/", remindResultSchema, { studentIds })

// Publisher
export type CatalogItemInput = Omit<z.infer<typeof catalogItemSchema>, "id" | "schoolListCount" | "coverUrl" | "files" | "review">
export const listCatalog = () => get("/publisher/catalog/", z.array(catalogItemSchema))
export const createCatalogItem = (input: CatalogItemInput) =>
  post("/publisher/catalog/", catalogItemSchema, input)
export const updateCatalogItem = async (id: string, input: Partial<CatalogItemInput>) => {
  const { data } = await api.patch(`/publisher/catalog/${id}/`, input)
  return catalogItemSchema.parse(data)
}

async function upload<T extends z.ZodType>(url: string, schema: T, fields: Record<string, string | Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  const { data } = await api.post(url, form)
  return schema.parse(data) as z.infer<T>
}

/** JPG, PNG or WebP, up to 5 MB. Replaces any earlier cover. */
export const uploadCover = (id: string, file: File) => upload(`/publisher/catalog/${id}/cover/`, catalogItemSchema, { file })
export const removeCover = async (id: string) => {
  const { data } = await api.delete(`/publisher/catalog/${id}/cover/`)
  return catalogItemSchema.parse(data)
}
export type CatalogFileKind = "document" | "resource"
/** document: PDF, JPG or PNG up to 10 MB, for SchoolShop's review. resource: up to 50 MB, comes with the title. */
export const uploadCatalogFile = (id: string, input: { kind: CatalogFileKind; label: string; file: File }) =>
  upload(`/publisher/catalog/${id}/files/`, catalogItemSchema, input)
export const removeCatalogFile = async (id: string, fileId: string) => {
  const { data } = await api.delete(`/publisher/catalog/${id}/files/${fileId}/`)
  return catalogItemSchema.parse(data)
}
/** Files aren't public, so they're fetched with the signed-in person's token and saved from memory. */
export async function downloadCatalogFile(fileId: string, name: string) {
  const { data } = await api.get(`/catalog/files/${fileId}/`, { responseType: "blob" })
  const href = URL.createObjectURL(data as Blob)
  const a = Object.assign(document.createElement("a"), { href, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1_000)
}
/** A CSV price list. dryRun checks every row and saves nothing; otherwise the good rows are added as drafts. */
export const importPriceList = (file: File, dryRun: boolean) =>
  upload("/publisher/catalog/import/", catalogImportResultSchema, { file, dryRun: String(dryRun) })

export const listPublisherBatches = () => get("/publisher/batches/", z.array(schoolBatchSchema))
export type DispatchInput = {
  carrier: string
  driverName: string
  driverPhone: string
  vehicleReg: string
  cartons: number
  expectedAt: string
  unavailableLines: string[]
}
/** Hand a school's packed batch to the carrier. The school is notified to expect it. */
export const dispatchBatch = (id: string, input: DispatchInput) =>
  post(`/publisher/batches/${id}/dispatch/`, schoolBatchSchema, input)

export const getPublisherPayouts = () => get("/publisher/payouts/", publisherPayoutsSchema)
export type PayoutAccountInput = {
  method: "mpesa_paybill" | "mpesa_till" | "bank"
  accountName: string
  /** Paybill / till number, or bank account number. */
  number: string
  /** Paybill account reference, or bank name and branch. */
  reference: string
}
/** New payout details are checked by SchoolShop before the next payout uses them. */
export const updatePayoutAccount = async (input: PayoutAccountInput) => {
  const { data } = await api.put("/publisher/payout-account/", input)
  return payoutAccountSchema.parse(data)
}

export const getPublisherSettings = () => get("/publisher/settings/", publisherSettingsSchema)
export type ProfileInput = Pick<PublisherSettings["profile"], "contactName" | "phone" | "email" | "dispatchAddress" | "county">
export const updatePublisherProfile = async (input: ProfileInput) => {
  const { data } = await api.patch("/publisher/settings/profile/", input)
  return publisherSettingsSchema.parse(data)
}
export const updateNotifications = async (input: PublisherSettings["notifications"]) => {
  const { data } = await api.put("/publisher/settings/notifications/", input)
  return publisherSettingsSchema.parse(data)
}
/** contact is a 2547… phone number or an email; they get an SMS or email invite. */
export const changePassword = (input: { currentPassword: string; newPassword: string }) =>
  post("/auth/password/change/", z.object({ changed: z.literal(true) }), input)

// Platform admin
export const getAdminOverview = () => get("/admin/overview/", adminOverviewSchema)
export const getPlatformSettings = () => get("/admin/settings/", platformSettingsSchema)
/** Saves one section. Every change is written to the audit log. */
export async function savePlatformSettings<K extends SettingsSection>(section: K, value: PlatformSettings[K]) {
  const { data } = await api.put(`/admin/settings/${section}/`, value)
  return platformSettingsSchema.parse(data)
}
export const listCatalogSubmissions = () => get("/admin/catalog/", z.array(catalogSubmissionSchema))
export type CatalogDecision = "approve" | "request-changes" | "reject"
/** Approving puts the title (or new price) in front of schools; the publisher hears either way. */
export const decideSubmission = (id: string, decision: CatalogDecision, note: string) =>
  post(`/admin/catalog/${id}/${decision}/`, z.array(catalogSubmissionSchema), { note })
export const listAudit = () => get("/admin/audit/", z.array(auditEntrySchema))
export const getAdminRefunds = () => get("/admin/refunds/", adminRefundsSchema)
/** Pays back each order's requested items to the M-Pesa number that paid. */
export const approveRefunds = (orderIds: string[]) => post("/admin/refunds/approve/", adminRefundsSchema, { orderIds })
export const declineRefund = (orderId: string, reason: string) => post(`/admin/refunds/${orderId}/decline/`, adminRefundsSchema, { reason })
/** Refund every affected parent; the amount comes off the publisher's payout. */
export const settleDisputeByRefund = (id: string) => post(`/admin/disputes/${id}/refund/`, adminRefundsSchema, {})
/** The publisher sent the missing packs: close the dispute and free the payout. */
export const settleDisputeByReplacement = (id: string, note: string) => post(`/admin/disputes/${id}/replace/`, adminRefundsSchema, { note })
export const getAdminMoney = () => get("/admin/money/", adminMoneySchema)
export const listCollections = () => get("/admin/collections/", z.array(collectionSchema))
/** Sends the money. Only approved payouts to a verified account go. */
export const releasePayouts = (ids: string[]) => post("/admin/payouts/release/", adminMoneySchema, { ids })
export const holdPayout = (id: string, reason: string) => post(`/admin/payouts/${id}/hold/`, adminMoneySchema, { reason })
export const unholdPayout = (id: string, note: string) => post(`/admin/payouts/${id}/unhold/`, adminMoneySchema, { note })
/** Confirms a publisher's new payout account after calling them on the number we already had. */
export const verifyPayoutAccount = (publisherId: string) => post(`/admin/payout-accounts/${publisherId}/verify/`, adminMoneySchema, {})
export const listAdminOrders = () => get("/admin/orders/", z.array(adminOrderSummarySchema))
export const getAdminOrder = (id: string) => get(`/admin/orders/${id}/`, adminOrderSchema)
/** Ask M-Pesa for the result of a payment whose callback never arrived. */
export const checkOrderPayment = (id: string) => post(`/admin/orders/${id}/check-payment/`, adminOrderSchema, {})
export const resendOrderCode = (id: string) => post(`/admin/orders/${id}/resend-code/`, adminOrderSchema, {})
export const addOrderNote = (id: string, note: string) => post(`/admin/orders/${id}/note/`, adminOrderSchema, { note })
/** Refunds go back to the M-Pesa number that paid. */
export const refundOrderItems = (id: string, itemIds: string[], reason: string) => post(`/admin/orders/${id}/refund/`, adminOrderSchema, { itemIds, reason })
export const resolveOrderIssue = (id: string, note: string) => post(`/admin/orders/${id}/resolve/`, adminOrderSchema, { note })
export const listAdminOrgs = () => get("/admin/organisations/", z.array(adminOrgSummarySchema))
export const getAdminOrg = (id: string) => get(`/admin/organisations/${id}/`, adminOrgSchema)
export type OrgDecision = "approve" | "request-info" | "reject" | "suspend" | "reactivate"
/** Every decision is logged and the organisation's contact gets the note by SMS and email. */
export const decideOrg = (id: string, decision: OrgDecision, note: string) =>
  post(`/admin/organisations/${id}/${decision}/`, adminOrgSchema, { note })
export const setOrgCheck = (id: string, checkId: string, state: "verified" | "failed") =>
  post(`/admin/organisations/${id}/checks/${checkId}/`, adminOrgSchema, { state })
export const inviteOrg = (input: { type: "school" | "publisher"; name: string; contact: string }) =>
  post("/admin/organisations/invite/", z.object({ sent: z.boolean() }), input)

// Staff and roles, the same shape for schools, publishers and SchoolShop itself.
export type StaffScope = "school" | "publisher" | "admin"
export type StaffChange = { role?: string; classNames?: string[]; status?: "active" | "suspended" }
export const getStaff = (scope: StaffScope) => get(`/${scope}/staff/`, staffDirectorySchema)
export const inviteStaff = (scope: StaffScope, input: { name: string; contact: string; role: string; classNames: string[] }) =>
  post(`/${scope}/staff/`, staffDirectorySchema, input)
export const updateStaff = async (scope: StaffScope, id: string, input: StaffChange) => {
  const { data } = await api.patch(`/${scope}/staff/${id}/`, input)
  return staffDirectorySchema.parse(data)
}
export const removeStaff = async (scope: StaffScope, id: string) => {
  const { data } = await api.delete(`/${scope}/staff/${id}/`)
  return staffDirectorySchema.parse(data)
}
export const resendStaffInvite = (scope: StaffScope, id: string) => post(`/${scope}/staff/${id}/resend/`, staffDirectorySchema)
