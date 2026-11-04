"use client";

import React, { useMemo, useState } from "react";
import { FilterPills } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives";
import { TimeSeriesChart, labelRows, SeriesDef } from "@/components/analytics/charts";
import { SERIES } from "@/components/analytics/theme";
import { pct, rangeLabel } from "@/components/analytics/format";
import { DailyPoint, DateRange, addDays, bucketize, getSeries, rangeLength } from "@/lib/db/analytics-data";

/** The range the trend shows: at least 14 days so "Today" and "7 days" still have a shape. */
export function trendWindow(range: DateRange): Pick<DateRange, "from" | "to"> {
  return rangeLength(range) < 14 ? { from: addDays(range.to, -13), to: range.to } : range;
}

export function SalesTrend({
  history,
  range,
  showFinance,
  height = 280,
}: {
  history: DailyPoint[];
  range: DateRange;
  /** COGS and gross profit lines need the accounts permission. */
  showFinance: boolean;
  height?: number;
}) {
  const [gran, setGran] = useState<"day" | "week">("day");
  const win = trendWindow(range);
  const widened = win.from !== range.from;
  const weeklyAllowed = rangeLength(win) >= 21;
  const granularity = weeklyAllowed ? gran : "day";

  const data = useMemo(
    () => labelRows(bucketize(getSeries(trendWindow(range), history), granularity), granularity),
    [history, range, granularity]
  );

  const series: SeriesDef[] = [
    { key: "revenue", label: "Net sales", color: SERIES.revenue, kind: "area" },
    ...(showFinance
      ? ([
          { key: "cogs", label: "COGS", color: SERIES.cogs, kind: "line" },
          { key: "grossProfit", label: "Gross profit", color: SERIES.profit, kind: "line" },
        ] as SeriesDef[])
      : []),
  ];

  return (
    <ChartCard
      title={showFinance ? "Sales and profit trend" : "Sales trend"}
      description={
        <>
          {rangeLabel(win)}
          {widened && <span className="text-apptext-muted"> · widened to 14 days for context</span>}
        </>
      }
      actions={
        <FilterPills
          label="Trend granularity"
          value={granularity}
          onChange={(v) => setGran(v)}
          options={[
            { id: "day", label: "Daily" },
            ...(weeklyAllowed ? [{ id: "week" as const, label: "Weekly" }] : []),
          ]}
        />
      }
      footerLink={{ href: "/analytics", label: "Open sales analytics" }}
    >
      <TimeSeriesChart
        data={data}
        series={series}
        height={height}
        label={`${showFinance ? "Net sales, COGS and gross profit" : "Net sales"} by ${granularity}, ${rangeLabel(win)}`}
        footer={showFinance ? (row) => `Gross margin ${pct(Number(row.margin ?? 0))} · ${Math.round(Number(row.orders ?? 0))} orders` : (row) => `${Math.round(Number(row.orders ?? 0))} orders`}
      />
    </ChartCard>
  );
}
