"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Boxes, Clock, PackageX } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { ItemStock, STOCK_STATUS_META, expiryText, formatPacks } from "@/lib/inventory";
import { CATEGORIES, CategoryKey, bucketize, getSeries, productTotals } from "@/lib/db/analytics-data";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { EXPIRY_WINDOWS, useInventoryHealth } from "@/components/dashboard/InventoryHealth";
import { Badge } from "@/components/ui";
import { ChartCard, HBarList, KpiCard } from "../primitives";
import { TimeSeriesChart, labelRows } from "../charts";
import { DataTable, Column } from "../DataTable";
import { CATEGORY_COLORS, SERIES, STATUS } from "../theme";
import { num, rangeLabel, taka, takaCompact } from "../format";
import { MiniStatGrid, TabProps, fileStamp } from "./shared";

interface ItemRow {
  item: InventoryItem;
  stock: ItemStock;
  sold: number;
}

export function InventoryTab({ history, range, cmp, canExport }: TabProps) {
  const h = useInventoryHealth();
  const win = trendWindow(range);

  const trend = useMemo(
    () => labelRows(bucketize(getSeries(trendWindow(range), history), "day"), "day").map((r) => ({ ...r, stockValue: r.stockIndex * h.value })),
    [history, range, h.value]
  );

  const sold = useMemo(() => Object.fromEntries(productTotals(cmp.currentPoints).map((p) => [p.productId, p.units])), [cmp.currentPoints]);
  const rows: ItemRow[] = useMemo(() => h.stock.map((s) => ({ ...s, sold: sold[s.item.id] ?? 0 })), [h.stock, sold]);
  const expiringValue = EXPIRY_WINDOWS.reduce((n, w) => n + h.expiry[w.id].value, 0);

  const columns: Column<ItemRow>[] = [
    { key: "name", label: "Product", value: (r) => r.item.name, render: (r) => <span className="font-medium">{r.item.name}</span> },
    { key: "category", label: "Category", value: (r) => r.item.category, hideOnMobile: true },
    { key: "sellable", label: "Sellable", align: "right", value: (r) => r.stock.sellable, render: (r) => formatPacks(r.stock.sellable, r.item) },
    { key: "value", label: "Value at cost", align: "right", value: (r) => Math.round(r.stock.value), render: (r) => taka(r.stock.value) },
    { key: "sold", label: "Packs sold", align: "right", value: (r) => Math.round(r.sold), render: (r) => num(r.sold), hideOnMobile: true },
    {
      key: "cover",
      label: "Days of cover",
      align: "right",
      value: (r) => r.stock.daysOfCover ?? -1,
      render: (r) => (r.stock.daysOfCover === null ? "—" : num(r.stock.daysOfCover)),
      hideOnMobile: true,
    },
    {
      key: "expiry",
      label: "Nearest expiry",
      align: "right",
      value: (r) => r.stock.nearestExpiryDays ?? 99999,
      render: (r) => (r.stock.nearestExpiryDays === null ? "—" : expiryText(r.stock.nearestExpiryDays)),
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Status",
      value: (r) => STOCK_STATUS_META[r.stock.status].label,
      render: (r) => <Badge className={STOCK_STATUS_META[r.stock.status].badge}>{STOCK_STATUS_META[r.stock.status].label}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <MiniStatGrid>
        <KpiCard label="Stock value at cost" icon={Boxes} value={takaCompact(h.value)} hint={`${h.skus} active products`} href="/inventory" />
        <KpiCard label="Low or out of stock" icon={AlertTriangle} value={num(h.low.length + h.out.length)} hint={`${h.out.length} out of stock`} href="/inventory/reorder" />
        <KpiCard label="Expiring in 90 days" icon={Clock} value={takaCompact(expiringValue)} hint={`${EXPIRY_WINDOWS.reduce((n, w) => n + h.expiry[w.id].batches, 0)} batches`} href="/inventory/batches" />
        <KpiCard label="Expired on shelf" icon={PackageX} value={takaCompact(h.expiredValue)} hint="Needs disposal" href="/inventory/batches?view=EXPIRED" />
      </MiniStatGrid>

      <ChartCard title="Stock value trend" description={`Closing stock at cost · ${rangeLabel(win)}`}>
        <TimeSeriesChart
          data={trend}
          series={[{ key: "stockValue", label: "Stock value", color: SERIES.cogs, kind: "area" }]}
          height={240}
          label="Stock value at cost over time"
          includeZero={false}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Stock value by category" description="At weighted-average cost">
          <HBarList
            ranked={false}
            items={CATEGORIES.filter((c) => h.byCategory[c]).map((c: CategoryKey) => ({
              id: c,
              label: c,
              value: h.byCategory[c],
              display: takaCompact(h.byCategory[c]),
              color: CATEGORY_COLORS[c],
              sub: `${((h.byCategory[c] / Math.max(1, h.value)) * 100).toFixed(0)}%`,
            }))}
          />
        </ChartCard>
        <ChartCard title="Expiry exposure" description="Sellable stock by time to expiry">
          <HBarList
            ranked={false}
            items={[
              ...EXPIRY_WINDOWS.map((w) => ({
                id: w.id,
                label: w.label,
                value: h.expiry[w.id].value,
                display: takaCompact(h.expiry[w.id].value),
                color: w.id === "UNDER_30" ? STATUS.critical : STATUS.warning,
                sub: `${h.expiry[w.id].batches} batches`,
              })),
              { id: "EXPIRED", label: "Already expired", value: h.expiredValue, display: takaCompact(h.expiredValue), color: STATUS.critical, sub: "write off" },
            ]}
          />
        </ChartCard>
      </div>

      <ChartCard title="Stock register" description="Live stock with sales velocity in the selected period">
        <DataTable
          caption="Stock, value, cover and expiry by product"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.item.id}
          initialSort={{ key: "value", dir: "desc" }}
          exportName={`inventory_${fileStamp(range)}`}
          canExport={canExport}
        />
      </ChartCard>
    </div>
  );
}
