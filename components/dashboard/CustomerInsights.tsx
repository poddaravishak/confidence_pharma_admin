"use client";

import React, { useMemo } from "react";
import { Customer } from "@/lib/types";
import { AGING_BUCKETS, DailyPoint, agingTotals, duesAging, topCustomers } from "@/lib/db/analytics-data";
import { ChartCard, ChartLegend, HBarList, SegmentedBar } from "@/components/analytics/primitives";
import { AGING_COLORS } from "@/components/analytics/theme";
import { num, pct, taka, takaCompact } from "@/components/analytics/format";
import { useNameLookup } from "@/components/analytics/useAnalytics";

export function TopCustomers({ points, n = 6 }: { points: DailyPoint[]; n?: number }) {
  const names = useNameLookup();
  const rows = useMemo(() => topCustomers(points, n), [points, n]);
  return (
    <ChartCard title="Top customers" description="Named accounts by net sales" footerLink={{ href: "/analytics?tab=customers", label: "Customer analytics" }}>
      <HBarList
        items={rows.map((c) => ({
          id: c.customerId,
          label: names.customer(c.customerId),
          value: c.revenue,
          display: takaCompact(c.revenue),
          sub: `${num(c.orders)} orders · ${pct(c.share, 1)}`,
        }))}
        emptyText="No named-account sales in this period"
      />
    </ChartCard>
  );
}

const agingParts = (values: Record<string, number>) =>
  AGING_BUCKETS.map((b, i) => ({ id: b.id, label: b.label, value: values[b.id] ?? 0, color: AGING_COLORS[i] }));

/** Customer dues aging: the whole book as one tall bar, then each account as a thin bar. */
export function DuesAging({ customers, limit = 6 }: { customers: Customer[]; limit?: number }) {
  const rows = useMemo(() => duesAging(customers), [customers]);
  const totals = useMemo(() => agingTotals(rows), [rows]);
  const total = totals.reduce((n, t) => n + t.value, 0);
  const overdue = totals.slice(1).reduce((n, t) => n + t.value, 0);

  return (
    <ChartCard
      title="Customer dues aging"
      description={`${taka(total)} outstanding · ${total ? pct((overdue / total) * 100, 0) : "0%"} older than 30 days`}
      footerLink={{ href: "/customers", label: "Customer ledgers" }}
    >
      <ChartLegend
        className="mb-2.5"
        items={totals.map((t, i) => ({ label: t.label, color: AGING_COLORS[i], value: takaCompact(t.value) }))}
      />
      <SegmentedBar tall label="All customer dues by age" formatValue={taka} parts={agingParts(Object.fromEntries(totals.map((t) => [t.id, t.value])))} />

      <ul className="mt-4 space-y-3">
        {rows.slice(0, limit).map((r) => (
          <li key={r.customerId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-apptext-primary">{r.customerName}</span>
              <span className="shrink-0 font-semibold tabular-nums text-apptext-primary">{taka(r.total)}</span>
            </div>
            <div className="mt-1">
              <SegmentedBar label={`${r.customerName} dues by age`} formatValue={taka} parts={agingParts(r as unknown as Record<string, number>)} />
            </div>
          </li>
        ))}
        {!rows.length && <li className="py-6 text-center text-sm text-apptext-secondary">No outstanding customer dues</li>}
      </ul>
    </ChartCard>
  );
}
