"use client";

import React, { useMemo } from "react";
import { Clock, PackageMinus, RotateCcw, XCircle } from "lucide-react";
import { DeliveryPersonnel } from "@/lib/types";
import { DailyPoint, RiderTotal, Summary, riderTotals } from "@/lib/db/analytics-data";
import { ChartCard, MiniStat } from "@/components/analytics/primitives";
import { DataTable, Column } from "@/components/analytics/DataTable";
import { num, pct, taka } from "@/components/analytics/format";

export type RiderRow = RiderTotal & { name: string; vehicle: string; cashInHand: number; status: DeliveryPersonnel["status"] };

export function useRiderRows(points: DailyPoint[], riders: DeliveryPersonnel[]): RiderRow[] {
  return useMemo(() => {
    const totals = riderTotals(points);
    return riders.map((r) => {
      const t = totals.find((x) => x.riderId === r.id);
      return {
        riderId: r.id,
        deliveries: t?.deliveries ?? 0,
        partial: t?.partial ?? 0,
        failed: t?.failed ?? 0,
        onTime: t?.onTime ?? 0,
        cash: t?.cash ?? 0,
        returnsValue: t?.returnsValue ?? 0,
        attempts: t?.attempts ?? 0,
        onTimeRate: t?.onTimeRate ?? 0,
        partialRate: t?.partialRate ?? 0,
        failedRate: t?.failedRate ?? 0,
        name: r.name,
        vehicle: r.vehicleType === "VAN" ? "Van" : r.vehicleType === "BICYCLE" ? "Bicycle" : "Motorbike",
        cashInHand: r.cashInHand,
        status: r.status,
      };
    });
  }, [points, riders]);
}

export const riderColumns = (opts: { cashInHand?: boolean } = {}): Column<RiderRow>[] => [
  {
    key: "name",
    label: "Rider",
    value: (r) => r.name,
    render: (r) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium">{r.name}</span>
        <span className="block text-xs text-apptext-secondary">{r.vehicle}</span>
      </span>
    ),
  },
  { key: "deliveries", label: "Deliveries", align: "right", value: (r) => r.deliveries, render: (r) => num(r.deliveries) },
  { key: "partial", label: "Partial", align: "right", value: (r) => r.partial, render: (r) => num(r.partial) },
  { key: "failed", label: "Failed", align: "right", value: (r) => r.failed, render: (r) => num(r.failed) },
  { key: "onTimeRate", label: "On time", align: "right", value: (r) => Number(r.onTimeRate.toFixed(1)), render: (r) => pct(r.onTimeRate, 0), hideOnMobile: true },
  { key: "cash", label: "Cash collected", align: "right", value: (r) => Math.round(r.cash), render: (r) => taka(r.cash) },
  ...(opts.cashInHand
    ? [
        {
          key: "cashInHand",
          label: "In hand now",
          align: "right" as const,
          value: (r: RiderRow) => r.cashInHand,
          render: (r: RiderRow) => <span className={r.cashInHand > 0 ? "font-semibold text-amber-700" : "text-apptext-muted"}>{taka(r.cashInHand)}</span>,
        },
      ]
    : []),
];

export function DeliveryPerformance({ summary, points, riders }: { summary: Summary; points: DailyPoint[]; riders: DeliveryPersonnel[] }) {
  const rows = useRiderRows(points, riders);
  const columns = useMemo(() => riderColumns({ cashInHand: true }), []);
  return (
    <ChartCard
      title="Delivery performance"
      description={`${num(summary.attempts)} delivery attempts in the period`}
      footerLink={{ href: "/analytics?tab=delivery", label: "Delivery analytics" }}
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MiniStat label="On-time delivery" value={pct(summary.onTimeRate)} tone={summary.onTimeRate >= 90 ? "good" : "warning"} icon={Clock} hint="Within promised window" />
        <MiniStat label="Partial deliveries" value={pct(summary.partialRate)} tone={summary.partialRate > 6 ? "warning" : "default"} icon={PackageMinus} hint={`${num(summary.partial)} orders`} />
        <MiniStat label="Failed deliveries" value={pct(summary.failedRate)} tone={summary.failedRate > 3 ? "critical" : "default"} icon={XCircle} hint={`${num(summary.failed)} orders`} />
        <MiniStat label="Return rate" value={pct(summary.returnRate)} tone={summary.returnRate > 2.5 ? "warning" : "default"} icon={RotateCcw} hint="Of gross sales" />
      </div>
      <div className="mt-4">
        <DataTable
          caption="Deliveries per rider in the selected period"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.riderId}
          initialSort={{ key: "deliveries", dir: "desc" }}
        />
      </div>
    </ChartCard>
  );
}
