"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { EXPIRY_META, batchState, daysUntil, expiryBucket, expiryText, formatPacks } from "@/lib/inventory";
import { Badge } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives";
import { useInventoryHealth } from "./InventoryHealth";

/** The most urgent stock problems: out-of-stock and low items, then the batches expiring first. */
export function StockAlerts({ limit = 6 }: { limit?: number }) {
  const { batches, itemById } = useInventory();
  const health = useInventoryHealth();

  const rows = useMemo(() => {
    const list: { id: string; title: string; detail: string; badge: React.ReactNode; href: string }[] = [];
    for (const s of health.out)
      list.push({
        id: `out-${s.item.id}`,
        title: s.item.name,
        detail: `Reorder level ${formatPacks(s.item.reorderLevel, s.item)}`,
        badge: <Badge className="border-rose-200 bg-rose-50 text-rose-700">Out of stock</Badge>,
        href: "/inventory/reorder",
      });
    for (const s of health.low)
      list.push({
        id: `low-${s.item.id}`,
        title: s.item.name,
        detail: `${formatPacks(s.stock.sellable, s.item)} left${s.stock.daysOfCover !== null ? ` · ${s.stock.daysOfCover} days of cover` : ""}`,
        badge: <Badge className="border-amber-200 bg-amber-50 text-amber-800">Low stock</Badge>,
        href: "/inventory/reorder",
      });
    const expiring = batches
      .filter((b) => b.availableQuantity > 0 && batchState(b) === "AVAILABLE" && daysUntil(b.expiryDate) <= 90)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    for (const b of expiring) {
      const item = itemById[b.itemId];
      if (!item) continue;
      const d = daysUntil(b.expiryDate);
      const meta = EXPIRY_META[expiryBucket(d)];
      list.push({
        id: `exp-${b.id}`,
        title: item.name,
        detail: `Batch ${b.batchNumber} · ${formatPacks(b.availableQuantity, item)}`,
        badge: <Badge className={meta.badge}>{expiryText(d)}</Badge>,
        href: `/inventory/batches?view=${expiryBucket(d)}`,
      });
    }
    return list.slice(0, limit);
  }, [health, batches, itemById, limit]);

  return (
    <ChartCard title="Stock alerts" description="Reorder and FEFO priorities" footerLink={{ href: "/inventory/batches", label: "Batch register" }} bodyClassName="py-2">
      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex items-start justify-between gap-3 py-2.5 hover:bg-surface/60">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-apptext-primary">{r.title}</span>
                  <span className="block truncate text-xs text-apptext-secondary">{r.detail}</span>
                </span>
                <span className="shrink-0">{r.badge}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-apptext-secondary">No stock alerts. Every product is above reorder level.</p>
      )}
    </ChartCard>
  );
}
