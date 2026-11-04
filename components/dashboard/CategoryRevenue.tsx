"use client";

import React, { useMemo } from "react";
import { DailyPoint, categoryTotals, topProducts } from "@/lib/db/analytics-data";
import { ChartCard, Delta, HBarList, SegmentedBar } from "@/components/analytics/primitives";
import { CATEGORY_COLORS } from "@/components/analytics/theme";
import { num, pct, takaCompact } from "@/components/analytics/format";
import { useNameLookup } from "@/components/analytics/useAnalytics";

/** Category mix as one whole (tall segmented bar) plus a ranked list with change. */
export function CategoryRevenue({ points, previous, comparable }: { points: DailyPoint[]; previous: DailyPoint[]; comparable: boolean }) {
  const rows = useMemo(() => {
    const cur = categoryTotals(points);
    const prev = Object.fromEntries(categoryTotals(previous).map((c) => [c.category, c.revenue]));
    return cur.map((c) => ({
      ...c,
      change: comparable && prev[c.category] ? ((c.revenue - prev[c.category]) / prev[c.category]) * 100 : null,
    }));
  }, [points, previous, comparable]);

  return (
    <ChartCard title="Sales by category" description="Share of net sales in the period" footerLink={{ href: "/analytics?tab=products", label: "Product analytics" }}>
      <SegmentedBar
        tall
        label="Net sales by category"
        formatValue={takaCompact}
        parts={rows.map((r) => ({ id: r.category, label: r.category, value: r.revenue, color: CATEGORY_COLORS[r.category] }))}
      />
      <ul className="mt-4 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.category} className="flex items-center gap-3 py-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS[r.category] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-apptext-primary" title={r.category}>{r.category}</span>
            <span className="w-9 text-right text-xs tabular-nums text-apptext-secondary">{pct(r.share, 0)}</span>
            <span className="w-14 text-right font-semibold tabular-nums text-apptext-primary">{takaCompact(r.revenue)}</span>
            <Delta value={r.change} className="hidden w-16 justify-end sm:inline-flex lg:hidden 2xl:inline-flex" />
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function TopProducts({ points, n = 10, showMargin }: { points: DailyPoint[]; n?: number; showMargin: boolean }) {
  const names = useNameLookup();
  const items = useMemo(() => topProducts(points, n), [points, n]);
  return (
    <ChartCard title={`Top ${n} products`} description="Ranked by net sales" footerLink={{ href: "/analytics?tab=products", label: "All products" }}>
      <HBarList
        items={items.map((p) => ({
          id: p.productId,
          label: names.product(p.productId),
          value: p.revenue,
          display: takaCompact(p.revenue),
          sub: showMargin ? `${num(p.units)} packs · ${pct(p.margin)}` : `${num(p.units)} packs`,
        }))}
      />
    </ChartCard>
  );
}
