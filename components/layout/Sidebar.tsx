"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  HandCoins,
  Receipt,
  LayoutDashboard,
  MessageSquare,
  Pill,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { PermissionModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module: PermissionModule;
  badgeKey?: "orders" | "delivery" | "returns" | "customers" | "inventory" | "messages";
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" },
      { label: "Analytics & reports", href: "/analytics", icon: BarChart3, module: "analytics" },
    ],
  },
  {
    label: "Sales & delivery",
    items: [
      { label: "Orders", href: "/orders", icon: ShoppingCart, module: "orders", badgeKey: "orders" },
      { label: "Delivery & riders", href: "/delivery", icon: Truck, module: "delivery", badgeKey: "delivery" },
      { label: "Returns", href: "/returns", icon: RotateCcw, module: "returns", badgeKey: "returns" },
      { label: "Customers & KYC", href: "/customers", icon: Users, module: "customers", badgeKey: "customers" },
    ],
  },
  {
    label: "Inventory & purchasing",
    items: [
      { label: "Products & catalog", href: "/catalog", icon: Pill, module: "catalog" },
      { label: "Inventory", href: "/inventory", icon: Boxes, module: "inventory", badgeKey: "inventory" },
      { label: "Purchase entry", href: "/purchases", icon: FileText, module: "purchases" },
      { label: "Suppliers & payables", href: "/suppliers", icon: Building2, module: "suppliers" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Cash, bank & MFS", href: "/accounts", icon: Wallet, module: "accounts" },
      { label: "Customer dues", href: "/accounts/receivables", icon: HandCoins, module: "accounts" },
      { label: "Expenses & payroll", href: "/accounts/expenses", icon: Receipt, module: "accounts" },
      { label: "Profit & loss", href: "/accounts/profit-loss", icon: TrendingUp, module: "accounts" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Search analytics", href: "/analytics/searches", icon: Search, module: "analytics" },
      { label: "Customer inquiries", href: "/messages", icon: MessageSquare, module: "messages", badgeKey: "messages" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, module: "settings" },
      { label: "Users & roles", href: "/settings/users", icon: UserCog, module: "users" },
      { label: "Audit logs", href: "/settings/audit-logs", icon: ShieldCheck, module: "audit" },
    ],
  },
];

const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

/** The most specific nav link matching the current path (so /inventory/batches highlights Inventory). */
function activeHref(pathname: string): string | undefined {
  const special = pathname.startsWith("/settings/roles") ? "/settings/users" : undefined;
  if (special) return special;
  return allHrefs
    .filter((href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const { can, orders, runs, returns, customers, currentRole, settings } = useAppStore();
  const { items, stockByItem } = useInventory();

  useEffect(() => {
    onClose();
    // Close the mobile drawer on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const badges: Record<NonNullable<NavItem["badgeKey"]>, { value: number; tone: string }> = {
    orders: { value: orders.filter((o) => o.orderStatus === "PLACED").length, tone: "bg-brand-blue" },
    delivery: { value: runs.filter((r) => r.status !== "SETTLED").length, tone: "bg-brand-green" },
    returns: {
      value: returns.filter((r) => r.status === "REQUESTED" || r.status === "RECEIVED" || r.status === "IN_TRANSIT").length,
      tone: "bg-amber-500",
    },
    customers: {
      value: customers.filter((c) => c.verificationStatus === "PENDING" || c.verificationStatus === "UNDER_REVIEW").length,
      tone: "bg-amber-500",
    },
    inventory: { value: items.filter((i) => stockByItem[i.id]?.status !== "IN_STOCK").length, tone: "bg-rose-500" },
    messages: { value: 1, tone: "bg-brand-blue" },
  };

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.module)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn("fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-slate-200/80 bg-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-4">
          <Link href="/" className="flex min-w-0 items-center" aria-label={`${settings.company.tradeName} home`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/confidence-pharma-logo.jpg" alt={settings.company.tradeName} className="h-10 w-auto max-w-[190px] object-contain" />
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = current === item.href;
                  const Icon = item.icon;
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                          isActive ? "bg-brand-light/70 text-brand-primary" : "text-slate-600 hover:bg-surface hover:text-apptext-primary"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={cn("size-4", isActive ? "text-brand-primary" : "text-slate-400 group-hover:text-brand-blue")} />
                          {item.label}
                        </span>
                        {badge && badge.value > 0 && (
                          <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums text-white", badge.tone)}>
                            {badge.value}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 bg-surface/60 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-apptext-secondary">
            <span>
              Signed in as <span className="font-medium text-apptext-primary">{currentRole?.name}</span>
            </span>
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
