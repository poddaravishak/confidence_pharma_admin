import { PermissionAction, PermissionModule, PermissionSet, Role } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Module & action catalogue (drives the permission matrix UI)         */
/* ------------------------------------------------------------------ */

export const PERMISSION_ACTIONS: { id: PermissionAction; label: string }[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
  { id: "approve", label: "Approve" },
  { id: "export", label: "Export" },
];

export const PERMISSION_MODULES: {
  id: PermissionModule;
  label: string;
  group: string;
  description: string;
  /** Actions that make sense for this module (others are greyed out). */
  actions: PermissionAction[];
}[] = [
  { id: "dashboard", label: "Dashboard", group: "Operations", description: "Executive KPIs and charts", actions: ["view"] },
  { id: "orders", label: "Orders", group: "Operations", description: "Create, confirm, pack and cancel orders", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { id: "delivery", label: "Delivery & fleet", group: "Operations", description: "Dispatch runs, riders, settlements", actions: ["view", "create", "edit", "approve", "export"] },
  { id: "returns", label: "Returns", group: "Operations", description: "Delivery returns, RMAs, inspection, credit notes", actions: ["view", "create", "edit", "approve", "export"] },
  { id: "customers", label: "Customers & KYC", group: "Operations", description: "B2B accounts, KYC review, credit limits", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { id: "catalog", label: "Catalog & pricing", group: "Inventory", description: "Products, pack sizes, price tiers, master data", actions: ["view", "create", "edit", "delete", "export"] },
  { id: "inventory", label: "Inventory", group: "Inventory", description: "Batches, adjustments, counts, transfers", actions: ["view", "create", "edit", "approve", "export"] },
  { id: "purchases", label: "Purchases", group: "Inventory", description: "Purchase entry and OCR", actions: ["view", "create", "edit", "delete", "approve"] },
  { id: "suppliers", label: "Suppliers & payables", group: "Inventory", description: "Supplier accounts and payments", actions: ["view", "create", "edit", "delete", "export"] },
  { id: "accounts", label: "Accounts & P&L", group: "Finance", description: "Cash, bank, MFS, expenses, profit & loss", actions: ["view", "create", "edit", "approve", "export"] },
  { id: "analytics", label: "Analytics & reports", group: "Finance", description: "Sales, product, customer and delivery reports", actions: ["view", "export"] },
  { id: "messages", label: "Customer inquiries", group: "Finance", description: "In-app messages from customers", actions: ["view", "create"] },
  { id: "settings", label: "System settings", group: "Administration", description: "Company, tax, invoice, delivery and return policy", actions: ["view", "edit"] },
  { id: "users", label: "Users & roles", group: "Administration", description: "Staff accounts, roles and permissions", actions: ["view", "create", "edit", "delete"] },
  { id: "audit", label: "Audit logs", group: "Administration", description: "Immutable activity trail", actions: ["view", "export"] },
  { id: "rider_app", label: "Rider app", group: "Field", description: "Mobile delivery panel for riders", actions: ["view", "edit"] },
];

export const MODULE_LABEL = Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, m.label])) as Record<
  PermissionModule,
  string
>;

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

export function hasPermission(
  permissions: PermissionSet | undefined,
  module: PermissionModule,
  action: PermissionAction = "view"
): boolean {
  return Boolean(permissions?.[module]?.includes(action));
}

export function countPermissions(role: Pick<Role, "permissions">): number {
  return Object.values(role.permissions).reduce((n, list) => n + (list?.length ?? 0), 0);
}

/** Route prefixes → module that gates them. Longest prefix wins. */
const ROUTE_MODULES: [string, PermissionModule][] = [
  ["/settings/audit-logs", "audit"],
  ["/settings/users", "users"],
  ["/settings/roles", "users"],
  ["/settings", "settings"],
  ["/orders", "orders"],
  ["/delivery", "delivery"],
  ["/returns", "returns"],
  ["/catalog", "catalog"],
  ["/inventory", "inventory"],
  ["/purchases", "purchases"],
  ["/suppliers", "suppliers"],
  ["/customers", "customers"],
  ["/accounts", "accounts"],
  ["/analytics", "analytics"],
  ["/messages", "messages"],
  ["/rider", "rider_app"],
];

export function moduleForPath(pathname: string): PermissionModule {
  if (pathname === "/") return "dashboard";
  const hit = ROUTE_MODULES.filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return hit ? hit[1] : "dashboard";
}

/** Full access for every module (used by the Super Admin role). */
export function allPermissions(): PermissionSet {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, [...m.actions]])) as PermissionSet;
}
