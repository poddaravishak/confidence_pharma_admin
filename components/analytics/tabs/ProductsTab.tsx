"use client";

import React, { useId, useMemo, useState } from "react";
import { ProductTotal, bucketize, getSeries, productTotals } from "@/lib/db/analytics-data";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { CategoryRevenue } from "@/components/dashboard/CategoryRevenue";
import { inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ChartCard, HBarList } from "../primitives";
import { TimeSeriesChart, labelRows } from "../charts";
import { DataTable, Column } from "../DataTable";
import { CATEGORY_COLORS, SERIES } from "../theme";
import { num, pct, rangeLabel, taka, takaCompact } from "../format";
import { useNameLookup } from "../useAnalytics";
import { GranularityPills, TabProps, fileStamp, useGranularity } from "./shared";

export function ProductsTab({ history, range, cmp, canExport, showFinance }: TabProps) {
  const names = useNameLookup();
  const selectId = useId();
  const totals = useMemo(() => productTotals(cmp.currentPoints), [cmp.currentPoints]);
  const [productId, setProductId] = useState<string>("");
  const selected = productId || totals[0]?.productId || "prod-01";

  const win = trendWindow(range);
  const gran = useGranularity(win);
  const productRows = useMemo(() => {
    const pts = getSeries(trendWindow(range), history);
    const rows = bucketize(pts, gran.value);
    return labelRows(rows, gran.value).map((r) => {
      let units = 0;
      let revenue = 0;
      for (const p of pts) {
        if (p.date < r.from || p.date > r.to) continue;
        units += p.products[selected]?.units ?? 0;
        revenue += p.products[selected]?.revenue ?? 0;
      }
      return { ...r, units, productRevenue: revenue };
    });
  }, [history, range, gran.value, selected]);

  const marginRanked = useMemo(() => [...totals].sort((a, b) => b.margin - a.margin), [totals]);

  const columns: Column<ProductTotal>[] = [
    {
      key: "name",
      label: "Product",
      value: (r) => names.product(r.productId),
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS[r.category] }} aria-hidden />
          <span className="truncate font-medium">{names.product(r.productId)}</span>
        </span>
      ),
    },
    { key: "category", label: "Category", value: (r) => r.category, hideOnMobile: true },
    { key: "units", label: "Packs sold", align: "right", value: (r) => Math.round(r.units), render: (r) => num(r.units) },
    { key: "revenue", label: "Net sales", align: "right", value: (r) => Math.round(r.revenue), render: (r) => taka(r.revenue) },
    { key: "share", label: "Share", align: "right", value: (r) => Number(r.share.toFixed(1)), render: (r) => pct(r.share), hideOnMobile: true },
    ...(showFinance
      ? ([
          { key: "grossProfit", label: "Gross profit", align: "right", value: (r) => Math.round(r.grossProfit), render: (r) => taka(r.grossProfit), hideOnMobile: true },
          { key: "margin", label: "Margin", align: "right", value: (r) => Number(r.margin.toFixed(1)), render: (r) => pct(r.margin) },
        ] as Column<ProductTotal>[])
      : []),
    { key: "returnsValue", label: "Returns", align: "right", value: (r) => Math.round(r.returnsValue), render: (r) => taka(r.returnsValue), hideOnMobile: true },
    { key: "returnRate", label: "Return rate", align: "right", value: (r) => Number(r.returnRate.toFixed(2)), render: (r) => pct(r.returnRate) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top 10 products" description="Ranked by net sales">
          <HBarList
            items={totals.slice(0, 10).map((p) => ({
              id: p.productId,
              label: names.product(p.productId),
              value: p.revenue,
              display: takaCompact(p.revenue),
              sub: `${num(p.units)} packs`,
            }))}
          />
        </ChartCard>
        {showFinance ? (
          <ChartCard title="Gross margin by product" description="Highest margin first; the bar shows margin %">
            <HBarList
              color={SERIES.profit}
              max={Math.max(25, ...marginRanked.map((p) => p.margin))}
              items={marginRanked.slice(0, 10).map((p) => ({
                id: p.productId,
                label: names.product(p.productId),
                value: Math.max(0, p.margin),
                display: pct(p.margin),
                sub: takaCompact(p.grossProfit),
              }))}
            />
          </ChartCard>
        ) : (
          <CategoryRevenue points={cmp.currentPoints} previous={cmp.previousPoints} comparable={cmp.comparable} />
        )}
      </div>

      <ChartCard
        title="Product trend"
        description={`${names.product(selected)} · ${rangeLabel(win)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={selectId} className="sr-only">
              Product
            </label>
            <select id={selectId} value={selected} onChange={(e) => setProductId(e.target.value)} className={cn(inputClass, "w-56 py-1.5")}>
              {totals.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {names.product(p.productId)}
                </option>
              ))}
            </select>
            <GranularityPills value={gran.value} options={gran.options} onChange={gran.set} />
          </div>
        }
      >
        <TimeSeriesChart
          data={productRows}
          series={[{ key: "units", label: "Packs sold", color: SERIES.revenue, kind: "bar" }]}
          height={240}
          label={`Packs sold of ${names.product(selected)}`}
          yFormat={(v) => num(v)}
          valueFormat={(v) => `${num(v)} packs`}
          footer={(r) => `Net sales ${taka(Number(r.productRevenue ?? 0))}`}
        />
      </ChartCard>

      {showFinance && <CategoryRevenue points={cmp.currentPoints} previous={cmp.previousPoints} comparable={cmp.comparable} />}

      <ChartCard title="Product performance" description={rangeLabel(range)}>
        <DataTable
          caption="Product sales, margin and returns in the period"
          columns={columns}
          rows={totals}
          rowKey={(r) => r.productId}
          initialSort={{ key: "revenue", dir: "desc" }}
          exportName={`products_${fileStamp(range)}`}
          canExport={canExport}
        />
      </ChartCard>
    </div>
  );
}
