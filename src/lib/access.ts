/*
 * Role-based access for staff at schools, publishers and SchoolShop itself.
 *
 * Each organisation type has a fixed set of permissions and built-in roles
 * that bundle them. The API sends each membership's role and permissions at
 * sign-in (and on /me/), and enforces them on every request; the app uses the
 * same table to hide what a role can't open and explain why.
 */

export type OrgType = "school" | "publisher" | "platform"

export type PermissionDef = { id: string; label: string; group: string }
export type RoleDef = {
  id: string
  label: string
  description: string
  permissions: string[]
  /** Teachers only see the classes they're assigned to. */
  scopedToClasses?: boolean
}

export const permissionCatalog: Record<OrgType, PermissionDef[]> = {
  school: [
    { id: "overview.view", label: "See the school overview", group: "General" },
    { id: "booklists.manage", label: "Create, edit and publish booklists", group: "Booklists" },
    { id: "orders.view", label: "See parent orders", group: "Parent orders" },
    { id: "orders.remind", label: "Send SMS reminders to parents", group: "Parent orders" },
    { id: "deliveries.receive", label: "Count and confirm deliveries", group: "Deliveries" },
    { id: "collection.handout", label: "Hand out packs with collection codes", group: "Collection" },
    { id: "settings.manage", label: "Change school details and parent messages", group: "Administration" },
    { id: "staff.manage", label: "Invite staff and change their roles", group: "Administration" },
  ],
  publisher: [
    { id: "orders.view", label: "See school orders", group: "Orders" },
    { id: "catalog.manage", label: "Add titles and update prices and stock", group: "Catalog" },
    { id: "dispatch.manage", label: "Dispatch deliveries to schools", group: "Dispatches" },
    { id: "payouts.view", label: "See payouts and statements", group: "Money" },
    { id: "payouts.manage", label: "Change payout account details", group: "Money" },
    { id: "settings.manage", label: "Change company details and notifications", group: "Administration" },
    { id: "staff.manage", label: "Invite team members and change their roles", group: "Administration" },
  ],
  platform: [
    { id: "overview.view", label: "See the platform overview", group: "General" },
    { id: "orgs.view", label: "See schools and publishers", group: "Organisations" },
    { id: "orgs.verify", label: "Verify, pause or reject organisations", group: "Organisations" },
    { id: "orders.view", label: "See any order", group: "Orders" },
    { id: "money.view", label: "See payments, refunds and payouts", group: "Money" },
    { id: "refunds.approve", label: "Approve refunds and settle disputes", group: "Money" },
    { id: "payouts.release", label: "Release publisher payouts", group: "Money" },
    { id: "settings.fees", label: "Change fees and platform settings", group: "Administration" },
    { id: "audit.view", label: "Read the audit log", group: "Administration" },
    { id: "staff.manage", label: "Invite SchoolShop staff and change their roles", group: "Administration" },
  ],
}

const all = (t: OrgType) => permissionCatalog[t].map((p) => p.id)

export const roleCatalog: Record<OrgType, RoleDef[]> = {
  school: [
    { id: "school_admin", label: "Admin", description: "Runs SchoolShop for the school: everything, including staff.", permissions: all("school") },
    { id: "bursar", label: "Bursar", description: "Follows orders and payments, chases parents and receives deliveries.", permissions: ["overview.view", "orders.view", "orders.remind", "deliveries.receive"] },
    { id: "teacher", label: "Teacher", description: "Hands out packs for their own classes only.", permissions: ["collection.handout"], scopedToClasses: true },
  ],
  publisher: [
    { id: "admin", label: "Admin", description: "Everything, including the team and payout details.", permissions: all("publisher") },
    { id: "warehouse", label: "Warehouse", description: "Keeps the catalog and stock up to date and dispatches to schools.", permissions: ["orders.view", "catalog.manage", "dispatch.manage"] },
    { id: "finance", label: "Finance", description: "Payouts, statements and the payout account.", permissions: ["orders.view", "payouts.view", "payouts.manage"] },
  ],
  platform: [
    { id: "super_admin", label: "Super admin", description: "Full access, including SchoolShop staff and fees.", permissions: all("platform") },
    { id: "operations", label: "Operations", description: "Verifies schools and publishers and follows orders.", permissions: ["overview.view", "orgs.view", "orgs.verify", "orders.view"] },
    { id: "finance", label: "Finance", description: "Payments, refunds and publisher payouts.", permissions: ["overview.view", "orders.view", "money.view", "refunds.approve", "payouts.release", "audit.view"] },
    { id: "support", label: "Support", description: "Helps parents and schools: can look things up but not change money or verification.", permissions: ["overview.view", "orgs.view", "orders.view", "money.view"] },
  ],
}

/** The role that must always keep at least one active holder. */
export const ownerRole: Record<OrgType, string> = { school: "school_admin", publisher: "admin", platform: "super_admin" }

export function roleDef(orgType: OrgType, roleId: string) {
  return roleCatalog[orgType].find((r) => r.id === roleId)
}

export function permissionsFor(orgType: OrgType, roleId: string) {
  return roleDef(orgType, roleId)?.permissions ?? []
}
