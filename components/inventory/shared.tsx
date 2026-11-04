"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ClipboardCheck,
  History,
  LayoutGrid,
  Layers,
  ShoppingBag,
  SlidersHorizontal,
  Snowflake,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { InventoryItem } from "@/lib/types";
import {
  EXPIRY_META,
  ItemStock,
  STOCK_STATUS_META,
  daysUntil,
  expiryBucket,
  expiryText,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { useInventory } from "./InventoryProvider";

/* ------------------------------------------------------------------ */
/* Section navigation                                                  */
/* ------------------------------------------------------------------ */

export function InventoryNav() {
  const pathname = usePathname();
  const { adjustments, transfers, items, stockByItem, counts } = useInventory();

  const pendingApprovals = adjustments.filter((a) => a.status === "PENDING").length;
  const openTransfers = transfers.filter((t) => t.status === "REQUESTED" || t.status === "IN_TRANSIT").length;
  const toReorder = items.filter((i) => stockByItem[i.id]?.status !== "IN_STOCK").length;
  const openCounts = counts.filter((c) => c.status === "IN_PROGRESS").length;

  const tabs = [
    { href: "/inventory", label: "Overview", icon: LayoutGrid },
    { href: "/inventory/batches", label: "Batches & expiry", icon: Layers },
    { href: "/inventory/movements", label: "Stock movements", icon: History },
    { href: "/inventory/adjustments", label: "Adjustments", icon: SlidersHorizontal, badge: pendingApprovals, tone: "amber" },
    { href: "/inventory/stock-count", label: "Stock count", icon: ClipboardCheck, badge: openCounts, tone: "blue" },
    { href: "/inventory/reorder", label: "Reorder", icon: ShoppingBag, badge: toReorder, tone: "rose" },
    { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight, badge: openTransfers, tone: "blue" },
  ];

  return (
    <nav aria-label="Inventory sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const active = t.href === "/inventory" ? pathname === "/inventory" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-apptext-secondary hover:border-slate-300 hover:text-apptext-primary"
                )}
              >
                <t.icon className="size-4" aria-hidden />
                {t.label}
                {!!t.badge && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
                      t.tone === "amber" && "bg-amber-100 text-amber-800",
                      t.tone === "rose" && "bg-rose-100 text-rose-700",
                      t.tone === "blue" && "bg-brand-light text-brand-primary"
                    )}
                  >
                    {t.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function WarehouseSwitcher() {
  const { warehouses, warehouseFilter, setWarehouseFilter } = useInventory();
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <WarehouseIcon className="size-4 text-brand-blue" aria-hidden />
      <span className="sr-only">Warehouse</span>
      <select
        value={warehouseFilter}
        onChange={(e) => setWarehouseFilter(e.target.value)}
        className="bg-transparent pr-1 font-medium text-apptext-primary focus:outline-none"
      >
        <option value="ALL">All warehouses</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & bars                                                       */
/* ------------------------------------------------------------------ */

export function ExpiryBadge({ date, showDate = false }: { date: string; showDate?: boolean }) {
  const days = daysUntil(date);
  const meta = EXPIRY_META[expiryBucket(days)];
  return (
    <span className="inline-flex flex-col">
      <Badge className={meta.badge}>
        <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
        {expiryText(days)}
      </Badge>
      {showDate && <span className="mt-0.5 pl-1 text-xs text-slate-500">{date}</span>}
    </span>
  );
}

export function StockStatusBadge({ status }: { status: ItemStock["status"] }) {
  const meta = STOCK_STATUS_META[status];
  return <Badge className={meta.badge}>{meta.label}</Badge>;
}

/** Bar showing sellable stock against 2× the reorder level, with a tick at the reorder point. */
export function StockLevelBar({ stock, item }: { stock: ItemStock; item: InventoryItem }) {
  const max = Math.max(item.reorderLevel * 2.5, stock.sellable, 1);
  const pct = Math.min(100, (stock.sellable / max) * 100);
  const reorderPct = (item.reorderLevel / max) * 100;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
      <div className={cn("h-full rounded-full", STOCK_STATUS_META[stock.status].bar)} style={{ width: `${pct}%` }} />
      <div className="absolute -top-0.5 h-2.5 w-px bg-slate-500" style={{ left: `${reorderPct}%` }} />
    </div>
  );
}

export function ColdChainTag() {
  return (
    <Badge className="border-sky-200 bg-sky-50 text-sky-800">
      <Snowflake className="size-3" aria-hidden />
      Cold chain
    </Badge>
  );
}

export function ItemCell({ item, sub }: { item: InventoryItem; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-apptext-primary">{item.name}</p>
      <p className="truncate text-xs text-apptext-secondary">{sub ?? `${item.genericName} · ${item.brand}`}</p>
    </div>
  );
}
