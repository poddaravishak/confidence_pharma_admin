"use client";

import React, { useMemo } from "react";
import { Clock, PackageMinus, Truck, XCircle } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import { bucketize, getSeries } from "@/lib/db/analytics-data";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { RiderRow, riderColumns, useRiderRows } from "@/components/dashboard/DeliveryPerformance";
import { ChartCard, HBarList, KpiCard } from "../primitives";
import { TimeSeriesChart, labelRows } from "../charts";
import { DataTable, Column } from "../DataTable";
import { SERIES, STATUS } from "../theme";
import { num, pct, rangeLabel, taka } from "../format";
import { GranularityPills, MiniStatGrid, TabProps, fileStamp, useGranularity } from "./shared";

export function DeliveryTab({ history, range, cmp, canExport, compareLabel }: TabProps) {
  const { riders } = useAppStore();
  const s = cmp.period;
  const win = trendWindow(range);
  const gran = useGranularity(win);
  const rows = useMemo(
    () =>
      labelRows(bucketize(getSeries(trendWindow(range), history), gran.value), gran.value).map((r) => ({
        ...r,
        fullDelivered: r.delivered,
      })),
    [history, range, gran.value]
  );
  const riderRows = useRiderRows(cmp.currentPoints, riders);

  const columns: Column<RiderRow>[] = useMemo(
    () => [
      ...riderColumns({ cashInHand: true }),
      { key: "failedRate", label: "Fail rate", align: "right", value: (r) => Number(r.failedRate.toFixed(1)), render: (r) => pct(r.failedRate), hideOnMobile: true },
      { key: "returnsValue", label: "Goods returned", align: "right", value: (r) => Math.round(r.returnsValue), render: (r) => taka(r.returnsValue), hideOnMobile: true },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <MiniStatGrid>
        <KpiCard label="Delivery attempts" icon={Truck} value={num(s.attempts)} delta={cmp.change("attempts")} compareLabel={compareLabel} />
        <KpiCard label="On time" icon={Clock} value={pct(s.onTimeRate)} delta={cmp.change("onTimeRate")} compareLabel={compareLabel} />
        <KpiCard label="Partial deliveries" icon={PackageMinus} value={pct(s.partialRate)} delta={cmp.change("partialRate")} upIsGood={false} compareLabel={compareLabel} />
        <KpiCard label="Failed deliveries" icon={XCircle} value={pct(s.failedRate)} delta={cmp.change("failedRate")} upIsGood={false} compareLabel={compareLabel} />
      </MiniStatGrid>

      <ChartCard
        title="Delivery outcomes"
        description={`Full, partial and failed drops per ${gran.value} · ${rangeLabel(win)}`}
        actions={<GranularityPills value={gran.value} options={gran.options} onChange={gran.set} />}
      >
        <TimeSeriesChart
          data={rows}
          series={[
            { key: "fullDelivered", label: "Delivered in full", color: STATUS.good, kind: "bar", stackId: "o" },
            { key: "partial", label: "Partial", color: STATUS.warning, kind: "bar", stackId: "o" },
            { key: "failed", label: "Failed", color: STATUS.critical, kind: "bar", stackId: "o" },
          ]}
          height={260}
          label="Delivery outcomes over time"
          yFormat={(v) => num(v)}
          valueFormat={(v) => `${num(v)} orders`}
          footer={(r) => `On time ${pct(Number(r.onTimeRate ?? 0), 0)}`}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="On-time rate" description="Share of completed drops inside the promised window">
          <TimeSeriesChart
            data={rows}
            series={[{ key: "onTimeRate", label: "On time", color: SERIES.revenue, kind: "line" }]}
            height={220}
            label="On-time delivery rate over time"
            includeZero={false}
            yFormat={(v) => `${v}%`}
            valueFormat={(v) => pct(v)}
          />
        </ChartCard>
        <ChartCard title="Deliveries by rider" description="Completed drops in the period">
          <HBarList
            items={[...riderRows]
              .sort((a, b) => b.deliveries - a.deliveries)
              .map((r) => ({ id: r.riderId, label: r.name, value: r.deliveries, display: num(r.deliveries), sub: `${pct(r.onTimeRate, 0)} on time` }))}
          />
        </ChartCard>
      </div>

      <ChartCard title="Rider leaderboard" description={rangeLabel(range)}>
        <DataTable
          caption="Rider deliveries, exceptions and cash"
          columns={columns}
          rows={riderRows}
          rowKey={(r) => r.riderId}
          initialSort={{ key: "deliveries", dir: "desc" }}
          exportName={`riders_${fileStamp(range)}`}
          canExport={canExport}
        />
      </ChartCard>
    </div>
  );
}
