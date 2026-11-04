"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ClipboardList, Percent, RotateCcw, Undo2 } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import { RETURN_REASON_META, RETURN_SOURCE_META, RETURN_STATUS_META } from "@/lib/orders";
import { ProductTotal, bucketize, getSeries, productTotals, returnsByReason, riderTotals } from "@/lib/db/analytics-data";
import { formatDateTime } from "@/lib/inventory";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { Badge } from "@/components/ui";
import { ChartCard, HBarList, KpiCard } from "../primitives";
import { TimeSeriesChart, labelRows } from "../charts";
import { DataTable, Column } from "../DataTable";
import { SERIES } from "../theme";
import { num, pct, rangeLabel, taka, takaCompact } from "../format";
import { useNameLookup } from "../useAnalytics";
import { GranularityPills, MiniStatGrid, TabProps, fileStamp, useGranularity } from "./shared";

export function ReturnsTab({ history, range, cmp, canExport, compareLabel }: TabProps) {
  const { returns } = useAppStore();
  const names = useNameLookup();
  const s = cmp.period;
  const win = trendWindow(range);
  const gran = useGranularity(win);

  const trend = useMemo(() => labelRows(bucketize(getSeries(trendWindow(range), history), gran.value), gran.value), [history, range, gran.value]);
  const reasons = useMemo(() => returnsByReason(cmp.currentPoints), [cmp.currentPoints]);
  const products = useMemo(() => productTotals(cmp.currentPoints).filter((p) => p.returnsValue > 0), [cmp.currentPoints]);
  const riders = useMemo(() => riderTotals(cmp.currentPoints).filter((r) => r.returnsValue > 0), [cmp.currentPoints]);
  const open = returns.filter((r) => r.status !== "COMPLETED" && r.status !== "REJECTED");
  const recent = useMemo(() => [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [returns]);

  const columns: Column<ProductTotal>[] = [
    { key: "name", label: "Product", value: (r) => names.product(r.productId), render: (r) => <span className="font-medium">{names.product(r.productId)}</span> },
    { key: "category", label: "Category", value: (r) => r.category, hideOnMobile: true },
    { key: "returnsValue", label: "Returned value", align: "right", value: (r) => Math.round(r.returnsValue), render: (r) => taka(r.returnsValue) },
    { key: "returnRate", label: "Return rate", align: "right", value: (r) => Number(r.returnRate.toFixed(2)), render: (r) => <span className={r.returnRate > 3 ? "font-semibold text-rose-700" : undefined}>{pct(r.returnRate)}</span> },
    { key: "revenue", label: "Net sales", align: "right", value: (r) => Math.round(r.revenue), render: (r) => taka(r.revenue), hideOnMobile: true },
  ];

  return (
    <div className="space-y-6">
      <MiniStatGrid>
        <KpiCard label="Returned value" icon={RotateCcw} value={takaCompact(s.returnsValue)} delta={cmp.change("returnsValue")} upIsGood={false} compareLabel={compareLabel} />
        <KpiCard label="Return rate" icon={Percent} value={pct(s.returnRate, 2)} delta={cmp.change("returnRate")} upIsGood={false} compareLabel={compareLabel} hint="of gross sales" />
        <KpiCard label="Return cases" icon={Undo2} value={num(s.returnsCount)} delta={cmp.change("returnsCount")} upIsGood={false} compareLabel={compareLabel} />
        <KpiCard label="Open right now" icon={ClipboardList} value={num(open.length)} hint={`${taka(open.reduce((n, r) => n + r.totalValue, 0))} in the pipeline`} href="/returns" />
      </MiniStatGrid>

      <ChartCard
        title="Returned value"
        description={`Partial and failed deliveries plus customer RMAs · ${rangeLabel(win)}`}
        actions={<GranularityPills value={gran.value} options={gran.options} onChange={gran.set} />}
      >
        <TimeSeriesChart
          data={trend}
          series={[{ key: "returnsValue", label: "Returned value", color: SERIES.returns, kind: "area" }]}
          height={240}
          label="Returned value over time"
          footer={(r) => `${pct(Number(r.returnRate ?? 0), 2)} of gross sales · ${num(Number(r.returnsCount ?? 0))} cases`}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="By reason" description="Share of returned value">
          <HBarList
            color={SERIES.returns}
            items={reasons.map((r) => ({ id: r.reason, label: RETURN_REASON_META[r.reason].label, value: r.value, display: takaCompact(r.value), sub: pct(r.share, 0) }))}
          />
        </ChartCard>
        <ChartCard title="By product" description="Top returned products">
          <HBarList
            color={SERIES.returns}
            items={[...products]
              .sort((a, b) => b.returnsValue - a.returnsValue)
              .slice(0, 7)
              .map((p) => ({ id: p.productId, label: names.product(p.productId), value: p.returnsValue, display: takaCompact(p.returnsValue), sub: `${pct(p.returnRate)} rate` }))}
          />
        </ChartCard>
        <ChartCard title="By rider" description="Goods brought back from the door">
          <HBarList
            color={SERIES.returns}
            items={riders.map((r) => ({
              id: r.riderId,
              label: names.rider(r.riderId),
              value: r.returnsValue,
              display: takaCompact(r.returnsValue),
              sub: `${num(r.partial)} partial · ${num(r.failed)} failed`,
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard title="Returns by product" description={rangeLabel(range)}>
        <DataTable
          caption="Returned value and return rate by product"
          columns={columns}
          rows={products}
          rowKey={(r) => r.productId}
          initialSort={{ key: "returnsValue", dir: "desc" }}
          exportName={`returns_by_product_${fileStamp(range)}`}
          canExport={canExport}
        />
      </ChartCard>

      <ChartCard title="Latest return cases" description="Live records from the returns desk" footerLink={{ href: "/returns", label: "Open returns" }} bodyClassName="px-0 py-0 sm:px-0">
        <ul className="divide-y divide-slate-100">
          {recent.map((r) => (
            <li key={r.id}>
              <Link href={`/returns/${r.id}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-surface/70 sm:px-5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-primary">{r.returnNumber}</span>
                    <Badge className={RETURN_SOURCE_META[r.source].badge}>{RETURN_SOURCE_META[r.source].label}</Badge>
                    <Badge className={RETURN_STATUS_META[r.status].badge}>{RETURN_STATUS_META[r.status].label}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-apptext-primary">{r.customerName}</span>
                  <span className="block text-xs text-apptext-secondary">
                    {formatDateTime(r.createdAt)} · {r.lines.map((l) => `${l.quantity} × ${l.productName}`).join(", ")}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-apptext-primary">{taka(r.totalValue)}</span>
              </Link>
            </li>
          ))}
          {!recent.length && <li className="px-5 py-8 text-center text-sm text-apptext-secondary">No return cases yet.</li>}
        </ul>
      </ChartCard>
    </div>
  );
}
