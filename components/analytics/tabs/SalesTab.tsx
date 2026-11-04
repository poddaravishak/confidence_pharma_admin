"use client";

import React, { useMemo } from "react";
import { Percent, ReceiptText, RotateCcw, ShoppingCart, TrendingUp } from "lucide-react";
import { CATEGORIES, SeriesRow, bucketize, getSeries, weekdayProfile } from "@/lib/db/analytics-data";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { ChartCard, KpiCard } from "../primitives";
import { TimeSeriesChart, labelRows, SeriesDef } from "../charts";
import { DataTable, Column } from "../DataTable";
import { CATEGORY_COLORS, SERIES } from "../theme";
import { dayLabel, monthLabel, num, pct, rangeLabel, taka, takaCompact } from "../format";
import { GranularityPills, MiniStatGrid, TabProps, fileStamp, useGranularity } from "./shared";

export function SalesTab({ history, range, cmp, canExport, showFinance, compareLabel }: TabProps) {
  const win = trendWindow(range);
  const gran = useGranularity(win);
  const s = cmp.period;

  const rows = useMemo(() => bucketize(getSeries(trendWindow(range), history), gran.value), [history, range, gran.value]);
  const chartRows = useMemo(() => labelRows(rows, gran.value), [rows, gran.value]);
  const weekdays = useMemo(
    () => weekdayProfile(cmp.currentPoints.length >= 7 ? cmp.currentPoints : getSeries(trendWindow(range), history)).map((w) => ({ ...w, tooltipLabel: `Average ${w.label}` })),
    [cmp.currentPoints, range, history]
  );

  const trendSeries: SeriesDef[] = [
    { key: "revenue", label: "Net sales", color: SERIES.revenue, kind: "area" },
    ...(showFinance
      ? ([
          { key: "cogs", label: "COGS", color: SERIES.cogs, kind: "line" },
          { key: "grossProfit", label: "Gross profit", color: SERIES.profit, kind: "line" },
        ] as SeriesDef[])
      : []),
  ];
  const categorySeries: SeriesDef[] = CATEGORIES.map((c) => ({ key: c, label: c, color: CATEGORY_COLORS[c], kind: "bar", stackId: "cat" }));
  const categoryRows = useMemo(() => chartRows.map((r) => ({ ...r, ...r.byCategory })), [chartRows]);

  const periodLabel = (r: SeriesRow) =>
    gran.value === "day" ? dayLabel(r.from) : gran.value === "week" ? `Week of ${dayLabel(r.from)}` : monthLabel(r.key, true);

  const columns: Column<SeriesRow>[] = [
    { key: "period", label: gran.value === "day" ? "Date" : gran.value === "week" ? "Week" : "Month", value: (r) => r.from, render: (r) => `${periodLabel(r)}${r.incomplete ? " *" : ""}` },
    { key: "orders", label: "Orders", align: "right", value: (r) => Math.round(r.orders), render: (r) => num(r.orders) },
    { key: "grossSales", label: "Gross sales", align: "right", value: (r) => Math.round(r.grossSales), render: (r) => taka(r.grossSales), hideOnMobile: true },
    { key: "returnsValue", label: "Returns", align: "right", value: (r) => Math.round(r.returnsValue), render: (r) => taka(r.returnsValue), hideOnMobile: true },
    { key: "revenue", label: "Net sales", align: "right", value: (r) => Math.round(r.revenue), render: (r) => taka(r.revenue) },
    { key: "aov", label: "Avg order", align: "right", value: (r) => Math.round(r.aov), render: (r) => taka(r.aov), hideOnMobile: true },
    ...(showFinance
      ? ([
          { key: "cogs", label: "COGS", align: "right", value: (r) => Math.round(r.cogs), render: (r) => taka(r.cogs), hideOnMobile: true },
          { key: "grossProfit", label: "Gross profit", align: "right", value: (r) => Math.round(r.grossProfit), render: (r) => taka(r.grossProfit) },
          { key: "margin", label: "Margin", align: "right", value: (r) => Number(r.margin.toFixed(1)), render: (r) => pct(r.margin) },
        ] as Column<SeriesRow>[])
      : []),
  ];

  return (
    <div className="space-y-6">
      <MiniStatGrid>
        <KpiCard label="Net sales" icon={TrendingUp} value={takaCompact(s.revenue)} delta={cmp.change("revenue")} compareLabel={compareLabel} />
        <KpiCard label="Orders" icon={ShoppingCart} value={num(s.orders)} delta={cmp.change("orders")} compareLabel={compareLabel} />
        <KpiCard label="Avg order value" icon={ReceiptText} value={taka(s.aov)} delta={cmp.change("aov")} compareLabel={compareLabel} />
        {showFinance ? (
          <KpiCard label="Gross margin" icon={Percent} value={pct(s.margin)} hint={`${takaCompact(s.grossProfit)} gross profit`} />
        ) : (
          <KpiCard label="Returns" icon={RotateCcw} value={takaCompact(s.returnsValue)} delta={cmp.change("returnsValue")} upIsGood={false} compareLabel={compareLabel} />
        )}
      </MiniStatGrid>

      <ChartCard
        title={showFinance ? "Net sales, COGS and gross profit" : "Net sales"}
        description={rangeLabel(win)}
        actions={<GranularityPills value={gran.value} options={gran.options} onChange={gran.set} />}
      >
        <TimeSeriesChart
          data={chartRows}
          series={trendSeries}
          height={300}
          label={`Net sales trend, ${rangeLabel(win)}`}
          footer={(r) => `${num(Number(r.orders ?? 0))} orders${showFinance ? ` · margin ${pct(Number(r.margin ?? 0))}` : ""}`}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Orders" description={`Orders booked per ${gran.value}`}>
          <TimeSeriesChart
            data={chartRows}
            series={[{ key: "orders", label: "Orders", color: SERIES.revenue, kind: "bar" }]}
            height={240}
            label="Orders per period"
            yFormat={(v) => num(v)}
            valueFormat={(v) => `${num(v)} orders`}
            footer={(r) => `Avg order ${taka(Number(r.aov ?? 0))}`}
          />
        </ChartCard>
        <ChartCard title="Sales by weekday" description="Average net sales per trading day; Friday is the weekly holiday">
          <TimeSeriesChart
            data={weekdays}
            series={[{ key: "avgRevenue", label: "Average net sales", color: SERIES.revenue, kind: "bar" }]}
            height={240}
            label="Average net sales by weekday"
            footer={(r) => `${num(Number(r.days ?? 0))} days in sample`}
          />
        </ChartCard>
      </div>

      <ChartCard title="Category mix" description={`Net sales by category per ${gran.value}`}>
        <TimeSeriesChart data={categoryRows} series={categorySeries} height={260} label="Net sales by category over time" />
      </ChartCard>

      <ChartCard title="Sales register" description={`${rows.length} ${gran.value === "day" ? "days" : gran.value === "week" ? "weeks" : "months"} · * period still open`}>
        <DataTable
          caption="Sales by period"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          initialSort={{ key: "period", dir: "desc" }}
          exportName={`sales_${gran.value}_${fileStamp(win)}`}
          canExport={canExport}
          maxHeight={480}
        />
      </ChartCard>
    </div>
  );
}
