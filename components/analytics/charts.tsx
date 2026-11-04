"use client";

import React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeriesRow } from "@/lib/db/analytics-data";
import { ChartFrame, ChartLegend, ChartTooltip } from "./primitives";
import { CHROME, activeDot, gridProps, xAxisProps, yAxisProps } from "./theme";
import { dayLabel, monthLabel, taka, takaCompact } from "./format";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  kind: "area" | "line" | "bar";
  stackId?: string;
  /** Per-bar colour (e.g. green for profit, rose for loss). */
  colorFor?: (value: number) => string;
}

/** Any row with an x-axis label; other fields are read by `dataKey`. */
export type ChartRow = { label: string };

/** Label rows from bucketed history for the x axis. */
export function labelRows(rows: SeriesRow[], granularity: "day" | "week" | "month"): (SeriesRow & { label: string; tooltipLabel: string })[] {
  return rows.map((r) => ({
    ...r,
    label: granularity === "month" ? monthLabel(r.key) : dayLabel(r.from),
    tooltipLabel:
      granularity === "day"
        ? `${dayLabel(r.from)}${r.incomplete ? " (so far today)" : ""}`
        : granularity === "week"
          ? `Week of ${dayLabel(r.from)}${r.incomplete ? " (to date)" : ""}`
          : `${monthLabel(r.key, true)}${r.incomplete ? " (to date)" : ""}`,
  }));
}

/** Round axis ticks (1, 2, 2.5, 5 × 10^n steps) covering min..max (and 0 unless told otherwise). */
export function niceTicks(min: number, max: number, target = 4, includeZero = true): number[] {
  const lo = includeZero ? Math.min(0, min) : min;
  const hi = includeZero ? Math.max(0, max) : max;
  if (hi - lo <= 0) return [0, 1];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/**
 * One-axis time series built on a ComposedChart: areas, lines and (stacked)
 * columns share a single y scale. Never pass series with different units.
 */
export function TimeSeriesChart({
  data,
  series,
  height = 260,
  label,
  yFormat = takaCompact,
  valueFormat = taka,
  yDomain,
  footer,
  legend = true,
  zeroLine = false,
  includeZero = true,
}: {
  data: ChartRow[];
  series: SeriesDef[];
  height?: number;
  label: string;
  yFormat?: (v: number) => string;
  valueFormat?: (v: number) => string;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  footer?: (row: Record<string, unknown>) => React.ReactNode;
  legend?: boolean;
  zeroLine?: boolean;
  /** Let the axis start near the data instead of at zero (levels, not flows). */
  includeZero?: boolean;
}) {
  const hasBars = series.some((s) => s.kind === "bar");
  let ticks: number[] | undefined;
  if (!yDomain) {
    let lo = includeZero ? 0 : Infinity;
    let hi = includeZero ? 0 : -Infinity;
    for (const row of data as Record<string, unknown>[]) {
      const stacks: Record<string, number> = {};
      for (const s of series) {
        const v = Number(row[s.key] ?? 0);
        if (!Number.isFinite(v)) continue;
        if (s.stackId) stacks[s.stackId] = (stacks[s.stackId] ?? 0) + v;
        else {
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      }
      for (const v of Object.values(stacks)) hi = Math.max(hi, v);
    }
    if (Number.isFinite(lo) && Number.isFinite(hi)) ticks = niceTicks(lo, hi, 4, includeZero);
  }
  const stackTop: Record<string, string> = {};
  for (const s of series) if (s.kind === "bar" && s.stackId) stackTop[s.stackId] = s.key;

  return (
    <div className="space-y-3">
      {legend && series.length > 1 && (
        <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, shape: s.kind === "line" ? "line" : "rect" }))} />
      )}
      <ChartFrame height={height} label={label}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...xAxisProps} minTickGap={18} interval="preserveStartEnd" />
          <YAxis
            {...yAxisProps}
            tickFormatter={(v: number) => yFormat(v)}
            domain={yDomain ?? (ticks ? [ticks[0], ticks[ticks.length - 1]] : undefined)}
            ticks={ticks}
            allowDecimals={false}
          />
          {zeroLine && <ReferenceLine y={0} stroke={CHROME.axis} />}
          <Tooltip
            cursor={hasBars ? { fill: "rgba(148,163,184,0.12)" } : { stroke: CHROME.cursor, strokeWidth: 1 }}
            content={
              <ChartTooltip
                formatValue={(v) => valueFormat(v)}
                formatLabel={(l, row) => String(row?.tooltipLabel ?? l)}
                footer={footer}
              />
            }
          />
          {series.map((s) => {
            if (s.kind === "area")
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={activeDot}
                  isAnimationActive={false}
                />
              );
            if (s.kind === "line")
              return (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={activeDot}
                  isAnimationActive={false}
                />
              );
            const top = !s.stackId || stackTop[s.stackId] === s.key;
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId={s.stackId}
                maxBarSize={24}
                radius={top ? [4, 4, 0, 0] : 0}
                stroke={s.stackId ? CHROME.surface : undefined}
                strokeWidth={s.stackId ? 1 : 0}
                isAnimationActive={false}
              >
                {s.colorFor && data.map((row, i) => <Cell key={i} fill={s.colorFor!(Number((row as Record<string, unknown>)[s.key] ?? 0))} />)}
              </Bar>
            );
          })}
        </ComposedChart>
      </ChartFrame>
    </div>
  );
}
