import type { ComponentType } from "react"
import { createBrowserRouter } from "react-router"

import { DashboardLayout, type DashboardNavItem } from "@/components/layout/DashboardLayout"
import { ParentLayout } from "@/components/layout/ParentLayout"
import { PublicLayout } from "@/components/layout/PublicLayout"
import { RequireRole } from "@/components/layout/RequireRole"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { RegisterOrganisationPage } from "@/pages/auth/RegisterOrganisationPage"
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage"
import { SignInPage } from "@/pages/auth/SignInPage"
import { SignUpPage } from "@/pages/auth/SignUpPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { HomePage } from "@/pages/public/HomePage"
import { SchoolPage } from "@/pages/public/SchoolPage"
import { SchoolsPage } from "@/pages/public/SchoolsPage"
import { ShopPage } from "@/pages/public/ShopPage"

/** Route-level code splitting: each role's pages load only when visited. */
function page<M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M) {
  return async () => ({ Component: (await load())[name] })
}

const schoolNav: DashboardNavItem[] = [
  { to: "/school", label: "Overview", end: true, permission: "overview.view" },
  { to: "/school/booklists", label: "Booklists", permission: "booklists.manage" },
  { to: "/school/orders", label: "Parent orders", permission: "orders.view" },
  { to: "/school/deliveries", label: "Deliveries", permission: "deliveries.receive" },
  { to: "/school/collection", label: "Collection", permission: "collection.handout" },
  { to: "/school/students", label: "Classes & students", permission: "settings.manage" },
  { to: "/school/staff", label: "Staff", permission: "staff.manage" },
  { to: "/school/settings", label: "Settings", permission: "settings.manage" },
]

const publisherNav: DashboardNavItem[] = [
  { to: "/publisher", label: "Overview", end: true, permission: "orders.view" },
  { to: "/publisher/orders", label: "School orders", permission: "orders.view" },
  { to: "/publisher/catalog", label: "Catalog & stock", permission: "catalog.manage" },
  { to: "/publisher/dispatches", label: "Dispatches", permission: "dispatch.manage" },
  { to: "/publisher/payouts", label: "Payouts", permission: "payouts.view" },
  { to: "/publisher/team", label: "Team", permission: "staff.manage" },
  { to: "/publisher/settings", label: "Settings", permission: "settings.manage" },
]

const adminNav: DashboardNavItem[] = [
  { to: "/admin", label: "Overview", end: true, permission: "overview.view" },
  { to: "/admin/organisations", label: "Schools & publishers", permission: "orgs.view" },
  { to: "/admin/orders", label: "Orders", permission: "orders.view" },
  { to: "/admin/payments", label: "Payments & payouts", permission: "money.view" },
  { to: "/admin/refunds", label: "Refunds & disputes", permission: "money.view" },
  { to: "/admin/catalog", label: "Catalog review", permission: "catalog.review" },
  { to: "/admin/settings", label: "Fees & settings", permission: "settings.fees" },
  { to: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { to: "/admin/staff", label: "Staff & roles", permission: "staff.manage" },
]

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "shop", element: <ShopPage /> },
      { path: "schools", element: <SchoolsPage /> },
      { path: "for-schools", lazy: page(() => import("@/pages/public/ForSchoolsPage"), "ForSchoolsPage") },
      { path: "for-publishers", lazy: page(() => import("@/pages/public/ForPublishersPage"), "ForPublishersPage") },
      { path: "shop/:productId", lazy: page(() => import("@/pages/public/ProductPage"), "ProductPage") },
      { path: "schools/:slug", element: <SchoolPage /> },
    ],
  },
  { path: "sign-in", element: <SignInPage /> },
  { path: "sign-up", element: <SignUpPage /> },
  { path: "forgot-password", element: <ForgotPasswordPage /> },
  { path: "reset-password", element: <ResetPasswordPage /> },
  { path: "register", element: <RegisterOrganisationPage /> },
  { path: "register/documents", lazy: page(() => import("@/pages/auth/ApplicationDocumentsPage"), "ApplicationDocumentsPage") },
  {
    path: "parent",
    element: <RequireRole roles={["parent"]} />,
    children: [
      {
        element: <ParentLayout />,
        children: [
          { index: true, lazy: page(() => import("@/pages/parent/ParentHomePage"), "ParentHomePage") },
          { path: "lists/:booklistId", lazy: page(() => import("@/pages/parent/BooklistPage"), "BooklistPage") },
          { path: "checkout", lazy: page(() => import("@/pages/parent/CheckoutPage"), "CheckoutPage") },
          { path: "orders", lazy: page(() => import("@/pages/parent/OrdersPage"), "OrdersPage") },
          { path: "orders/:orderId", lazy: page(() => import("@/pages/parent/OrderPage"), "OrderPage") },
          { path: "orders/:orderId/payments/:paymentId", lazy: page(() => import("@/pages/parent/PaymentPage"), "PaymentPage") },
          { path: "children", lazy: page(() => import("@/pages/parent/ChildrenPage"), "ChildrenPage") },
          { path: "account", lazy: page(() => import("@/pages/parent/AccountPage"), "AccountPage") },
        ],
      },
    ],
  },
  {
    path: "school",
    element: <RequireRole roles={["school_admin", "teacher"]} />,
    children: [
      {
        element: <DashboardLayout nav={schoolNav} orgLabel="School admin" />,
        children: [
          { index: true, lazy: page(() => import("@/pages/school/SchoolOverviewPage"), "SchoolOverviewPage") },
          { path: "booklists", lazy: page(() => import("@/pages/school/SchoolBooklistsPage"), "SchoolBooklistsPage") },
          { path: "booklists/:id", lazy: page(() => import("@/pages/school/SchoolBooklistBuilderPage"), "SchoolBooklistBuilderPage") },
          { path: "orders", lazy: page(() => import("@/pages/school/SchoolOrdersPage"), "SchoolOrdersPage") },
          { path: "staff", lazy: page(() => import("@/pages/school/SchoolStaffPage"), "SchoolStaffPage") },
          { path: "students", lazy: page(() => import("@/pages/school/SchoolStudentsPage"), "SchoolStudentsPage") },
          { path: "collection", lazy: page(() => import("@/pages/school/SchoolCollectionPage"), "SchoolCollectionPage") },
          { path: "settings", lazy: page(() => import("@/pages/school/SchoolSettingsPage"), "SchoolSettingsPage") },
          { path: "deliveries", lazy: page(() => import("@/pages/school/SchoolDeliveriesPage"), "SchoolDeliveriesPage") },
          { path: "deliveries/:id", lazy: page(() => import("@/pages/school/SchoolReceiveDeliveryPage"), "SchoolReceiveDeliveryPage") },
        ],
      },
    ],
  },
  {
    path: "publisher",
    element: <RequireRole roles={["publisher"]} />,
    children: [
      {
        element: <DashboardLayout nav={publisherNav} tone="dark" tag="PUBLISHER" />,
        children: [
          { index: true, lazy: page(() => import("@/pages/publisher/PublisherOverviewPage"), "PublisherOverviewPage") },
          { path: "orders", lazy: page(() => import("@/pages/publisher/PublisherOrdersPage"), "PublisherOrdersPage") },
          { path: "catalog", lazy: page(() => import("@/pages/publisher/PublisherCatalogPage"), "PublisherCatalogPage") },
          { path: "dispatches", lazy: page(() => import("@/pages/publisher/PublisherDispatchesPage"), "PublisherDispatchesPage") },
          { path: "payouts", lazy: page(() => import("@/pages/publisher/PublisherPayoutsPage"), "PublisherPayoutsPage") },
          { path: "team", lazy: page(() => import("@/pages/publisher/PublisherTeamPage"), "PublisherTeamPage") },
          { path: "settings", lazy: page(() => import("@/pages/publisher/PublisherSettingsPage"), "PublisherSettingsPage") },
        ],
      },
    ],
  },
  {
    path: "admin",
    element: <RequireRole roles={["platform_admin"]} />,
    children: [
      {
        element: <DashboardLayout nav={adminNav} tone="dark" tag="ADMIN" />,
        children: [
          { index: true, lazy: page(() => import("@/pages/admin/AdminOverviewPage"), "AdminOverviewPage") },
          { path: "staff", lazy: page(() => import("@/pages/admin/AdminStaffPage"), "AdminStaffPage") },
          { path: "organisations", lazy: page(() => import("@/pages/admin/AdminOrganisationsPage"), "AdminOrganisationsPage") },
          { path: "orders", lazy: page(() => import("@/pages/admin/AdminOrdersPage"), "AdminOrdersPage") },
          { path: "payments", lazy: page(() => import("@/pages/admin/AdminMoneyPage"), "AdminMoneyPage") },
          { path: "refunds", lazy: page(() => import("@/pages/admin/AdminRefundsPage"), "AdminRefundsPage") },
          { path: "catalog", lazy: page(() => import("@/pages/admin/AdminCatalogPage"), "AdminCatalogPage") },
          { path: "audit", lazy: page(() => import("@/pages/admin/AdminAuditPage"), "AdminAuditPage") },
          { path: "settings", lazy: page(() => import("@/pages/admin/AdminSettingsPage"), "AdminSettingsPage") },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
