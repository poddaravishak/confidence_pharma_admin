"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Pill,
  Users,
  ShoppingCart,
  Truck,
  Building2,
  DollarSign,
  TrendingUp,
  Search,
  MessageSquare,
  ShieldCheck,
  FileText,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavGroup {
  label: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main Operations",
    items: [
      { label: "Executive Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Orders & Pipeline", href: "/orders", icon: ShoppingCart, badge: "3", badgeColor: "bg-brand-blue" },
      { label: "Delivery & Fleet Logistics", href: "/delivery", icon: Truck, badge: "Live", badgeColor: "bg-brand-green" },
      { label: "Catalog & Pricing Tiers", href: "/catalog", icon: Pill },
      { label: "B2B Customers & KYC", href: "/customers", icon: Users, badge: "2", badgeColor: "bg-amber-500" },
    ],
  },
  {
    label: "Inventory & Purchasing",
    items: [
      { label: "Purchase Entry (OCR)", href: "/purchases", icon: FileText },
      { label: "Stock & FEFO Batches", href: "/inventory", icon: AlertCircle, badge: "Alert", badgeColor: "bg-rose-500" },
      { label: "Suppliers & Payables", href: "/suppliers", icon: Building2 },
    ],
  },
  {
    label: "Financials & Management",
    items: [
      { label: "Cash, Bank & MFS", href: "/accounts", icon: DollarSign },
      { label: "Real-Time Profit & Loss", href: "/accounts/profit-loss", icon: TrendingUp },
    ],
  },
  {
    label: "Intelligence & Security",
    items: [
      { label: "Search Analytics (BI)", href: "/analytics/searches", icon: Search },
      { label: "Customer Inquiries", href: "/messages", icon: MessageSquare, badge: "1", badgeColor: "bg-brand-blue" },
      { label: "Audit Logs & Security", href: "/settings/audit-logs", icon: ShieldCheck },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-dvh w-64 flex-col border-r border-slate-200/80 bg-white">
      {/* Official Brand Header with Logo */}
      <div className="flex h-24 items-center justify-center border-b border-slate-100 px-4 py-3 bg-white">
        <Link href="/" className="flex items-center justify-center w-full" aria-label="Confidence Pharma Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/confidence-pharma-logo.jpg"
            alt="Confidence Pharma • B2B Healthcare Marketplace"
            className="w-full h-auto max-h-16 max-w-[216px] object-contain transition duration-200 hover:scale-[1.02]"
          />
        </Link>
      </div>

      {/* Nav Link Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <p className="px-2.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-apptext-secondary/70">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-brand-light/70 text-brand-primary font-bold shadow-xs border border-brand-light"
                        : "text-apptext-secondary hover:bg-surface hover:text-apptext-primary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive
                            ? "text-brand-primary"
                            : "text-slate-400 group-hover:text-brand-blue"
                        )}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={cn(
                          "flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[9px] font-bold text-white tabular-nums shadow-xs",
                          item.badgeColor || "bg-brand-primary"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Footer Details */}
      <div className="border-t border-slate-100 p-4 bg-surface/50">
        <div className="flex items-center justify-between text-[11px] text-apptext-secondary">
          <span className="font-medium">Confidence Pharma Core</span>
          <span className="flex items-center gap-1 font-bold text-brand-green">
            <span className="size-2 rounded-full bg-brand-green animate-pulse" />
            Online
          </span>
        </div>
      </div>
    </aside>
  );
};
