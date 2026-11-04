"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, CircleSlash, Clock, PackageX } from "lucide-react";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { batchState, computeItemStock, daysUntil, expiryBucket } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { ChartCard, MiniStat } from "@/components/analytics/primitives";
import { num, takaCompact } from "@/components/analytics/format";

export const EXPIRY_WINDOWS = [
  { id: "UNDER_30", label: "≤ 30 days", tone: "critical" as const, bar: "bg-rose-500", text: "text-rose-700" },
  { id: "UNDER_60", label: "31–60 days", tone: "warning" as const, bar: "bg-amber-500", text: "text-amber-700" },
  { id: "UNDER_90", label: "61–90 days", tone: "warning" as const, bar: "bg-yellow-400", text: "text-yellow-800" },
];

/** Live stock figures across every warehouse. */
export function useInventoryHealth() {
  const { items, batches } = useInventory();
  return useMemo(() => {
    let value = 0;
    let expiredValue = 0;
    let holdValue = 0;
    const expiry: Record<string, { batches: number; value: number }> = {
      UNDER_30: { batches: 0, value: 0 },
      UNDER_60: { batches: 0, value: 0 },
      UNDER_90: { batches: 0, value: 0 },
    };
    for (const b of batches) {
      if (b.availableQuantity <= 0) continue;
      const v = b.availableQuantity * b.unitCost;
      value += v;
      const st = batchState(b);
      if (st === "EXPIRED") expiredValue += v;
      else if (st === "ON_HOLD") holdValue += v;
      else {
        const bucket = expiryBucket(daysUntil(b.expiryDate));
        if (expiry[bucket]) {
          expiry[bucket].batches++;
          expiry[bucket].value += v;
        }
      }
    }
    const stock = items.filter((i) => i.isActive !== false).map((i) => ({ item: i, stock: computeItemStock(i, batches) }));
    const out = stock.filter((s) => s.stock.status === "OUT_OF_STOCK");
    const low = stock.filter((s) => s.stock.status === "LOW_STOCK");
    const byCategory: Record<string, number> = {};
    for (const s of stock) byCategory[s.item.category] = (byCategory[s.item.category] ?? 0) + s.stock.value;
    return { value, expiredValue, holdValue, expiry, out, low, stock, byCategory, skus: stock.length };
  }, [items, batches]);
}

export function InventoryHealth() {
  const h = useInventoryHealth();
  const expiringValue = EXPIRY_WINDOWS.reduce((n, w) => n + h.expiry[w.id].value, 0);

  return (
    <ChartCard title="Inventory health" description={`${h.skus} active products across all warehouses`} footerLink={{ href: "/inventory", label: "Inventory overview" }}>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Stock value at cost" value={takaCompact(h.value)} icon={Boxes} />
        <MiniStat
          label="Low or out of stock"
          value={num(h.low.length + h.out.length)}
          hint={`${h.out.length} out · ${h.low.length} low`}
          tone={h.out.length ? "critical" : h.low.length ? "warning" : "good"}
          icon={AlertTriangle}
        />
        <MiniStat label="Expired on shelf" value={takaCompact(h.expiredValue)} tone={h.expiredValue > 0 ? "critical" : "default"} icon={PackageX} />
        <MiniStat label="On hold (QC)" value={takaCompact(h.holdValue)} icon={CircleSlash} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium text-apptext-primary">Expiring soon</span>
          <span className="tabular-nums text-apptext-secondary">{takaCompact(expiringValue)} at cost</span>
        </div>
        <ul className="space-y-2">
          {EXPIRY_WINDOWS.map((w) => {
            const e = h.expiry[w.id];
            const share = expiringValue ? (e.value / expiringValue) * 100 : 0;
            return (
              <li key={w.id}>
                <Link
                  href={`/inventory/batches?view=${w.id}`}
                  className="block rounded-md text-sm hover:bg-surface"
                  title={`${w.label}: ${e.batches} batches, ${takaCompact(e.value)}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("flex items-center gap-1 whitespace-nowrap font-medium", w.text)}>
                      <Clock className="size-3.5" aria-hidden />
                      {w.label}
                    </span>
                    <span className="whitespace-nowrap text-xs tabular-nums text-apptext-secondary">
                      {e.batches} {e.batches === 1 ? "batch" : "batches"} · <span className="font-semibold text-apptext-primary">{takaCompact(e.value)}</span>
                    </span>
                  </span>
                  <span className="mt-1 block h-2 rounded-full bg-slate-100">
                    <span className={cn("block h-2 rounded-full", w.bar)} style={{ width: e.value ? `${Math.max(3, share)}%` : 0 }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
