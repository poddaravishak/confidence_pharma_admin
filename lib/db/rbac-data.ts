/**
 * Demo roles and staff accounts. Every login on /login maps to one of these users,
 * and the user's role decides which modules and actions are available.
 */
import { Role, StaffUser } from "@/lib/types";
import { allPermissions } from "@/lib/rbac";

export const demoRoles: Role[] = [
  {
    id: "role-super",
    name: "Super Admin",
    description: "Owner access to every module, approvals and system configuration.",
    isSystem: true,
    color: "bg-brand-primary text-white border-brand-primary",
    homePath: "/",
    permissions: allPermissions(),
  },
  {
    id: "role-manager",
    name: "Operations Manager",
    description: "Runs daily operations. Everything except deleting users and changing roles.",
    isSystem: true,
    color: "bg-sky-50 text-sky-700 border-sky-200",
    homePath: "/",
    permissions: {
      dashboard: ["view"],
      orders: ["view", "create", "edit", "delete", "approve", "export"],
      delivery: ["view", "create", "edit", "approve", "export"],
      returns: ["view", "create", "edit", "approve", "export"],
      customers: ["view", "create", "edit", "approve", "export"],
      catalog: ["view", "create", "edit", "export"],
      inventory: ["view", "create", "edit", "approve", "export"],
      purchases: ["view", "create", "edit", "approve"],
      suppliers: ["view", "create", "edit", "export"],
      accounts: ["view", "export"],
      analytics: ["view", "export"],
      messages: ["view", "create"],
      settings: ["view", "edit"],
      users: ["view"],
      audit: ["view"],
    },
  },
  {
    id: "role-inventory",
    name: "Inventory Manager",
    description: "Owns stock: catalog, batches, purchases, adjustments and return inspection.",
    isSystem: true,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    homePath: "/inventory",
    permissions: {
      dashboard: ["view"],
      orders: ["view"],
      delivery: ["view"],
      returns: ["view", "edit", "approve"],
      catalog: ["view", "create", "edit", "delete", "export"],
      inventory: ["view", "create", "edit", "approve", "export"],
      purchases: ["view", "create", "edit"],
      suppliers: ["view", "create", "edit"],
      analytics: ["view"],
    },
  },
  {
    id: "role-warehouse",
    name: "Warehouse Staff",
    description: "Picks and packs orders, receives returned goods, records counts.",
    isSystem: true,
    color: "bg-teal-50 text-teal-700 border-teal-200",
    homePath: "/returns",
    permissions: {
      orders: ["view", "edit"],
      delivery: ["view"],
      returns: ["view", "edit"],
      catalog: ["view"],
      inventory: ["view", "create"],
    },
  },
  {
    id: "role-sales",
    name: "Sales Executive",
    description: "Takes phone and WhatsApp orders, manages customers and return requests.",
    isSystem: true,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    homePath: "/orders",
    permissions: {
      dashboard: ["view"],
      orders: ["view", "create", "edit", "export"],
      returns: ["view", "create"],
      customers: ["view", "create", "edit"],
      catalog: ["view"],
      inventory: ["view"],
      analytics: ["view"],
      messages: ["view", "create"],
    },
  },
  {
    id: "role-accountant",
    name: "Accountant",
    description: "Cash, bank and MFS, rider cash settlement, credit notes and P&L.",
    isSystem: true,
    color: "bg-amber-50 text-amber-800 border-amber-200",
    homePath: "/accounts",
    permissions: {
      dashboard: ["view"],
      orders: ["view", "export"],
      delivery: ["view", "approve"],
      returns: ["view", "approve", "export"],
      customers: ["view", "export"],
      purchases: ["view", "approve"],
      suppliers: ["view", "create", "edit", "export"],
      accounts: ["view", "create", "edit", "approve", "export"],
      analytics: ["view", "export"],
      audit: ["view"],
    },
  },
  {
    id: "role-dispatch",
    name: "Dispatch Coordinator",
    description: "Builds delivery runs, assigns riders and settles riders at day end.",
    isSystem: false,
    color: "bg-violet-50 text-violet-700 border-violet-200",
    homePath: "/delivery",
    permissions: {
      dashboard: ["view"],
      orders: ["view", "edit"],
      delivery: ["view", "create", "edit", "approve", "export"],
      returns: ["view", "create", "edit"],
      customers: ["view"],
    },
  },
  {
    id: "role-rider",
    name: "Delivery Rider",
    description: "Mobile rider panel only: today's run, deliveries, returns and cash.",
    isSystem: true,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    homePath: "/rider",
    permissions: {
      rider_app: ["view", "edit"],
    },
  },
];

const u = (
  id: string,
  name: string,
  roleId: string,
  designation: string,
  phone: string,
  email: string,
  extra: Partial<StaffUser> = {}
): StaffUser => ({
  id,
  name,
  roleId,
  designation,
  phone,
  email,
  initials: name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase(),
  status: "ACTIVE",
  twoFactorEnabled: false,
  createdAt: "2026-01-10T09:00:00Z",
  lastLoginAt: "2026-11-05T08:40:00Z",
  ...extra,
});

export const demoUsers: StaffUser[] = [
  u("usr-01", "Dr. TC Dey", "role-super", "Managing Director", "+8801711000001", "tcdey@confidencepharma.com.bd", {
    initials: "TC",
    twoFactorEnabled: true,
    createdAt: "2025-12-01T09:00:00Z",
  }),
  u("usr-02", "Ayesha Siddiqua", "role-manager", "Head of Operations", "+8801711000002", "ayesha@confidencepharma.com.bd", {
    twoFactorEnabled: true,
  }),
  u("usr-03", "Rashed Karim", "role-inventory", "Inventory Manager", "+8801711000003", "rashed@confidencepharma.com.bd", {
    warehouseId: "wh-01",
  }),
  u("usr-04", "Mitu Akter", "role-warehouse", "Store Keeper", "+8801711000004", "mitu@confidencepharma.com.bd", {
    warehouseId: "wh-01",
  }),
  u("usr-05", "Sohel Rana", "role-warehouse", "Mirpur Hub Lead", "+8801711000005", "sohel@confidencepharma.com.bd", {
    warehouseId: "wh-02",
    lastLoginAt: "2026-11-04T17:12:00Z",
  }),
  u("usr-06", "Tanvir Hasan", "role-sales", "Senior Sales Executive", "+8801711000006", "tanvir@confidencepharma.com.bd"),
  u("usr-07", "Nayeem Islam", "role-accountant", "Accounts Officer", "+8801711000007", "nayeem@confidencepharma.com.bd"),
  u("usr-08", "Jahid Hasan", "role-dispatch", "Dispatch Coordinator", "+8801711000008", "jahid@confidencepharma.com.bd"),
  u("usr-09", "Shakil Ahmed", "role-rider", "Delivery Rider (Motorbike)", "+8801712345678", "shakil.rider@confidencepharma.com.bd", {
    riderId: "rider-01",
  }),
  u("usr-10", "Kamal Hossain", "role-rider", "Delivery Rider (Motorbike)", "+8801819876543", "kamal.rider@confidencepharma.com.bd", {
    riderId: "rider-02",
  }),
  u("usr-11", "Mohammad Biplob", "role-rider", "Van Driver", "+8801911445566", "biplob.rider@confidencepharma.com.bd", {
    riderId: "rider-03",
  }),
  u("usr-12", "Rubel Mia", "role-rider", "Delivery Rider (Motorbike)", "+8801556677889", "rubel.rider@confidencepharma.com.bd", {
    riderId: "rider-04",
    lastLoginAt: "2026-11-04T19:05:00Z",
  }),
  u("usr-13", "Nusrat Jahan", "role-sales", "Sales Executive", "+8801711000013", "nusrat@confidencepharma.com.bd", {
    status: "INACTIVE",
    lastLoginAt: "2026-09-30T18:00:00Z",
  }),
  u("usr-14", "Arif Chowdhury", "role-accountant", "Junior Accountant", "+8801711000014", "arif@confidencepharma.com.bd", {
    status: "INVITED",
    lastLoginAt: undefined,
    createdAt: "2026-11-03T11:00:00Z",
  }),
];
