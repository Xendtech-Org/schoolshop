import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import * as endpoints from "@/lib/api/endpoints"
import type { Account, AdminMoney, AdminRefunds, SettingsSection, AdminOrder, AdminOrg, CollectionRow, PublisherSettings, SchoolSettings, StaffDirectory } from "@/lib/api/schemas"
import { useAuthStore } from "@/stores/auth"

export const queryKeys = {
  me: ["me"] as const,
  schools: (search: string) => ["schools", search] as const,
  school: (slug: string) => ["school", slug] as const,
  schoolBooklists: (slug: string) => ["school", slug, "booklists"] as const,
  products: (filters?: Record<string, string>) => ["products", filters ?? {}] as const,
  product: (id: string) => ["product", id] as const,
  children: ["children"] as const,
  booklist: (id: string) => ["booklist", id] as const,
  order: (id: string) => ["order", id] as const,
  orders: ["orders"] as const,
  payment: (id: string) => ["payment", id] as const,
  schoolOverview: ["school-overview"] as const,
  myBooklists: ["school-booklists"] as const,
  schoolOrders: ["school-orders"] as const,
  schoolDeliveries: ["school-deliveries"] as const,
  collection: ["school-collection"] as const,
  schoolSettings: ["school-settings"] as const,
  account: ["account"] as const,
  roster: ["school-roster"] as const,
  adminOrgs: ["admin-orgs"] as const,
  adminOrders: ["admin-orders"] as const,
  adminMoney: ["admin-money"] as const,
  adminRefunds: ["admin-refunds"] as const,
  audit: ["admin-audit"] as const,
  platformSettings: ["admin-settings"] as const,
  collections: ["admin-collections"] as const,
  staff: (scope: string) => ["staff", scope] as const,
  schoolOrder: (id: string) => ["school-orders", id] as const,
  publisherBatches: ["publisher-batches"] as const,
  publisherOverview: ["publisher-overview"] as const,
  catalog: ["publisher-catalog"] as const,
  payouts: ["publisher-payouts"] as const,
  settings: ["publisher-settings"] as const,
  adminOverview: ["admin-overview"] as const,
}

export const useSchools = (search: string) =>
  useQuery({
    queryKey: queryKeys.schools(search),
    queryFn: () => endpoints.searchSchools(search),
    enabled: true,
    placeholderData: (prev) => prev,
  })

export const useSchool = (slug: string) =>
  useQuery({ queryKey: queryKeys.school(slug), queryFn: () => endpoints.getSchool(slug) })

export const useSchoolBooklists = (slug: string) =>
  useQuery({
    queryKey: queryKeys.schoolBooklists(slug),
    queryFn: () => endpoints.listSchoolBooklists(slug),
  })

export type ProductFilters = {
  gradeBand?: string
  category?: string
  curriculum?: string
  audience?: string
  department?: string
  search?: string
  subject?: string
  publisher?: string
  sort?: string
}

export const useProducts = (filters: ProductFilters = {}) => {
  const keyFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => !!v))
  return useQuery({
    queryKey: queryKeys.products(keyFilters),
    queryFn: () => endpoints.listProducts(keyFilters),
  })
}

export const useProduct = (id: string) =>
  useQuery({ queryKey: queryKeys.product(id), queryFn: () => endpoints.getProduct(id) })

export const useChildren = () =>
  useQuery({ queryKey: queryKeys.children, queryFn: endpoints.listChildren })

export const useBooklist = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.booklist(id ?? ""),
    queryFn: () => endpoints.getBooklist(id!),
    enabled: !!id,
  })

export const useOrders = () => useQuery({ queryKey: queryKeys.orders, queryFn: endpoints.listOrders })

export const useOrder = (id: string) =>
  useQuery({ queryKey: queryKeys.order(id), queryFn: () => endpoints.getOrder(id) })

export const useCreateOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.createOrder,
    onSuccess: (order) => {
      qc.setQueryData(queryKeys.order(order.id), order)
      qc.invalidateQueries({ queryKey: queryKeys.children })
    },
  })
}

/** M-Pesa when a phone is given, otherwise a card checkout (the caller sends the browser to its redirectUrl). */
export const useStartPayment = () =>
  useMutation({
    mutationFn: ({ orderId, phone, method = "mpesa" }: { orderId: string; phone?: string; method?: "mpesa" | "card" }) =>
      endpoints.startPayment(orderId, method === "card" ? { method: "card" } : { method: "mpesa", phone: phone ?? "" }),
  })

export const useRequestRefund = (orderId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { itemIds: string[]; reason: string }) => endpoints.requestRefund(orderId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.order(orderId) }),
  })
}

export const usePaymentOptions = () =>
  useQuery({ queryKey: ["payment-options"], queryFn: endpoints.getPaymentOptions, staleTime: 60_000 })

/**
 * Polls a payment until the provider has answered (SasaPay callback, card webhook,
 * or the server asking the provider). The order is only ever marked paid server-side.
 */
export const usePaymentStatus = (id: string | null) => {
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.payment(id ?? ""),
    queryFn: async () => {
      const payment = await endpoints.getPayment(id!)
      if (payment.status === "succeeded") {
        qc.invalidateQueries({ queryKey: queryKeys.order(payment.orderId) })
        qc.invalidateQueries({ queryKey: queryKeys.children })
      }
      return payment
    },
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "initiated" ? 2_000 : false),
  })
}

export const useSchoolOverview = () =>
  useQuery({ queryKey: queryKeys.schoolOverview, queryFn: endpoints.getSchoolOverview })

export const useMyBooklists = () => useQuery({ queryKey: queryKeys.myBooklists, queryFn: endpoints.listMyBooklists })

export const useSchoolCatalog = (search: string, category: string) =>
  useQuery({
    queryKey: ["school-catalog", search, category],
    queryFn: () => endpoints.searchSchoolCatalog(search, category),
    placeholderData: (prev) => prev,
  })

export const useCreateBooklist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.createBooklist,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myBooklists }),
  })
}

/** Save the list, and publish it too when asked. Keeps the list, index and overview in step. */
export const useSaveBooklist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input, publish }: { id: string; input: endpoints.BooklistInput; publish?: boolean }) => {
      const saved = await endpoints.saveBooklist(id, input)
      return publish ? endpoints.publishBooklist(id) : saved
    },
    onSuccess: (list) => {
      qc.setQueryData(queryKeys.booklist(list.id), list)
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.myBooklists }),
        qc.invalidateQueries({ queryKey: queryKeys.schoolOverview }),
      ])
    },
  })
}

export const useAddChild = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: endpoints.addChild, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.children }) })
}

export const useRemoveChild = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: endpoints.removeChild, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.children }) })
}

export const useStaff = (scope: endpoints.StaffScope) => useQuery({ queryKey: queryKeys.staff(scope), queryFn: () => endpoints.getStaff(scope) })

/** Wraps a staff call that returns the whole directory, and caches it. */
export function useStaffMutation<V>(scope: endpoints.StaffScope, fn: (vars: V) => Promise<StaffDirectory>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (data) => qc.setQueryData(queryKeys.staff(scope), data) })
}

/** The signed-in user as the API sees them now, so a role change applies without signing in again. */
export const useMe = (enabled: boolean) => useQuery({ queryKey: queryKeys.me, queryFn: endpoints.getMe, enabled, refetchOnWindowFocus: true, retry: false })

export const useAccount = () => useQuery({ queryKey: queryKeys.account, queryFn: endpoints.getAccount })

/** Caches the saved account and keeps the signed-in user's name and email in step. */
export function useAccountMutation<V>(fn: (vars: V) => Promise<Account>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (account) => {
      qc.setQueryData(queryKeys.account, account)
      const { user } = useAuthStore.getState()
      if (user) useAuthStore.setState({ user: { ...user, name: account.name, email: account.email } })
    },
  })
}

export const useRequestDeletion = () => useMutation({ mutationFn: endpoints.requestAccountDeletion })

export const usePlatformSettings = () => useQuery({ queryKey: queryKeys.platformSettings, queryFn: endpoints.getPlatformSettings })

/** A commission change reprices payouts still waiting for delivery, so money pages refresh too. */
export function useSavePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ section, value }: { section: SettingsSection; value: unknown }) => endpoints.savePlatformSettings(section, value as never),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.platformSettings, data)
      return Promise.all([queryKeys.adminMoney, queryKeys.payouts, queryKeys.audit].map((queryKey) => qc.invalidateQueries({ queryKey })))
    },
  })
}

/** Every admin action writes to the log, so it's fetched fresh each time the page opens. */
export const useAudit = () => useQuery({ queryKey: queryKeys.audit, queryFn: endpoints.listAudit, refetchOnMount: "always" })

export const useAdminRefunds = () => useQuery({ queryKey: queryKeys.adminRefunds, queryFn: endpoints.getAdminRefunds })

/** Refunds touch orders, payouts and the overview, so everything money-related refreshes. */
export function useRefundsMutation<V>(fn: (vars: V) => Promise<AdminRefunds>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.adminRefunds, data)
      return Promise.all([queryKeys.adminOrders, queryKeys.adminMoney, queryKeys.adminOverview, queryKeys.payouts].map((queryKey) => qc.invalidateQueries({ queryKey })))
    },
  })
}

export const useAdminMoney = () => useQuery({ queryKey: queryKeys.adminMoney, queryFn: endpoints.getAdminMoney })
export const useCollections = () => useQuery({ queryKey: queryKeys.collections, queryFn: endpoints.listCollections })

/** Payout actions return the whole money page; the publisher's own payouts refresh too. */
export function useMoneyMutation<V>(fn: (vars: V) => Promise<AdminMoney>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (money) => {
      qc.setQueryData(queryKeys.adminMoney, money)
      return qc.invalidateQueries({ queryKey: queryKeys.payouts })
    },
  })
}

export const useAdminOrders = () => useQuery({ queryKey: queryKeys.adminOrders, queryFn: endpoints.listAdminOrders })
export const useAdminOrder = (id: string | null) =>
  useQuery({ queryKey: [...queryKeys.adminOrders, id], queryFn: () => endpoints.getAdminOrder(id!), enabled: !!id })

/** Order actions return the order; the list behind it refreshes. */
export function useAdminOrderMutation<V>(fn: (vars: V) => Promise<AdminOrder>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData([...queryKeys.adminOrders, order.id], order)
      return qc.invalidateQueries({ queryKey: queryKeys.adminOrders, exact: true })
    },
  })
}

export const useAdminOrgs = (enabled = true) => useQuery({ queryKey: queryKeys.adminOrgs, queryFn: endpoints.listAdminOrgs, enabled })
export const useAdminOrg = (id: string | null) =>
  useQuery({ queryKey: [...queryKeys.adminOrgs, id], queryFn: () => endpoints.getAdminOrg(id!), enabled: !!id })

/** Decisions and check changes return the organisation; the list and overview refresh behind it. */
export function useOrgMutation<V>(fn: (vars: V) => Promise<AdminOrg>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (org) => {
      qc.setQueryData([...queryKeys.adminOrgs, org.id], org)
      return Promise.all([qc.invalidateQueries({ queryKey: queryKeys.adminOrgs, exact: true }), qc.invalidateQueries({ queryKey: queryKeys.adminOverview })])
    },
  })
}

export const useRoster = () => useQuery({ queryKey: queryKeys.roster, queryFn: endpoints.getRoster })

/** Any change to students also changes parent orders and collection lists. */
export function useRosterMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.roster }),
        qc.invalidateQueries({ queryKey: queryKeys.schoolOrders }),
      ]),
  })
}

export const useCollection = () => useQuery({ queryKey: queryKeys.collection, queryFn: endpoints.listCollection })

/** Marks the pack collected in the cached list straight away, then refreshes the overview. */
export const useHandOverPack = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.handOverPack,
    onSuccess: (row) => {
      qc.setQueryData(queryKeys.collection, (rows: CollectionRow[] | undefined) => rows?.map((r) => (r.orderId === row.orderId ? row : r)))
      return Promise.all([qc.invalidateQueries({ queryKey: queryKeys.schoolOverview }), qc.invalidateQueries({ queryKey: queryKeys.schoolOrders })])
    },
  })
}

export const useResendCode = () => useMutation({ mutationFn: endpoints.resendCollectionCode })

export const useSchoolSettings = () => useQuery({ queryKey: queryKeys.schoolSettings, queryFn: endpoints.getSchoolSettings })

/** Wraps a school settings call that returns the whole settings object, and caches the result. */
export function useSchoolSettingsMutation<V>(fn: (vars: V) => Promise<SchoolSettings>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (data) => qc.setQueryData(queryKeys.schoolSettings, data) })
}

export const useSchoolDeliveries = () =>
  useQuery({ queryKey: queryKeys.schoolDeliveries, queryFn: endpoints.listSchoolDeliveries })

export const useSchoolDelivery = (id: string) =>
  useQuery({ queryKey: [...queryKeys.schoolDeliveries, id], queryFn: () => endpoints.getSchoolDelivery(id) })

/** Receiving changes the overview counts and parents' order statuses too. */
export const useReceiveDelivery = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: endpoints.ReceiveInput }) => endpoints.receiveDelivery(id, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.schoolDeliveries }),
        qc.invalidateQueries({ queryKey: queryKeys.schoolOverview }),
        qc.invalidateQueries({ queryKey: queryKeys.schoolOrders }),
      ]),
  })
}

export const useSchoolOrders = () => useQuery({ queryKey: queryKeys.schoolOrders, queryFn: endpoints.getSchoolOrders })

export const useSchoolOrder = (id: string | null) =>
  useQuery({ queryKey: queryKeys.schoolOrder(id ?? ""), queryFn: () => endpoints.getSchoolOrder(id!), enabled: !!id })

export const useRemindParents = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.remindParents,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.schoolOrders }),
  })
}

export const usePublisherOverview = () =>
  useQuery({ queryKey: queryKeys.publisherOverview, queryFn: endpoints.getPublisherOverview })
export const usePublisherBatches = () =>
  useQuery({ queryKey: queryKeys.publisherBatches, queryFn: endpoints.listPublisherBatches })

export const useAdminOverview = () =>
  useQuery({ queryKey: queryKeys.adminOverview, queryFn: endpoints.getAdminOverview })

export const useCatalog = () => useQuery({ queryKey: queryKeys.catalog, queryFn: endpoints.listCatalog })

/** Create a title (no id) or update one (with id); refreshes the catalog either way. */
export const useSaveCatalogItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: endpoints.CatalogItemInput }) =>
      id ? endpoints.updateCatalogItem(id, input) : endpoints.createCatalogItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalog }),
  })
}

/** Covers, files and price lists. Each returns the updated title (or import result) and refreshes the catalog. */
export const useCatalogUploads = () => {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.catalog })
  return {
    uploadCover: useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => endpoints.uploadCover(id, file), onSuccess: refresh }),
    removeCover: useMutation({ mutationFn: (id: string) => endpoints.removeCover(id), onSuccess: refresh }),
    uploadFile: useMutation({
      mutationFn: ({ id, ...input }: { id: string; kind: endpoints.CatalogFileKind; label: string; file: File }) => endpoints.uploadCatalogFile(id, input),
      onSuccess: refresh,
    }),
    removeFile: useMutation({ mutationFn: ({ id, fileId }: { id: string; fileId: string }) => endpoints.removeCatalogFile(id, fileId), onSuccess: refresh }),
  }
}

export const useDeleteCatalogItems = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: endpoints.deleteCatalogItems, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalog }) })
}

export const usePublishCatalogItems = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: endpoints.publishCatalogItems, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalog }) })
}

export const useImportPriceList = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) => endpoints.importPriceList(file, dryRun),
    onSuccess: (_, { dryRun }) => {
      if (!dryRun) void qc.invalidateQueries({ queryKey: queryKeys.catalog })
    },
  })
}

export const useDispatchBatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: endpoints.DispatchInput }) => endpoints.dispatchBatch(id, input),
    onSuccess: () => Promise.all([queryKeys.publisherBatches, queryKeys.publisherOverview].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const usePublisherPayouts = () =>
  useQuery({ queryKey: queryKeys.payouts, queryFn: endpoints.getPublisherPayouts })

export const useUpdatePayoutAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.updatePayoutAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payouts }),
  })
}

export const usePublisherSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: endpoints.getPublisherSettings })

/** Wraps a settings call that returns the whole settings object, and caches the result. */
export function useSettingsMutation<V>(fn: (vars: V) => Promise<PublisherSettings>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: (data) => qc.setQueryData(queryKeys.settings, data) })
}

export const useChangePassword = () => useMutation({ mutationFn: endpoints.changePassword })
