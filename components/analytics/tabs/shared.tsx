"use client";

import React from "react";
import { FilterPills } from "@/components/ui";
import { DailyPoint, DateRange, Granularity, comparePrevious, rangeLength } from "@/lib/db/analytics-data";

export interface TabProps {
  history: DailyPoint[];
  range: DateRange;
  cmp: ReturnType<typeof comparePrevious>;
  canExport: boolean;
  /** Margins, COGS and profit need the accounts permission. */
  showFinance: boolean;
  compareLabel: string;
}

export function defaultGranularity(days: number): Granularity {
  return days <= 35 ? "day" : days <= 120 ? "week" : "month";
}

/** Granularities that make sense for a window of `days`. */
export function granularityOptions(days: number) {
  const opts: { id: Granularity; label: string }[] = [{ id: "day", label: "Daily" }];
  if (days >= 21) opts.push({ id: "week", label: "Weekly" });
  if (days >= 75) opts.push({ id: "month", label: "Monthly" });
  return opts;
}

export function useGranularity(window: Pick<DateRange, "from" | "to">) {
  const days = rangeLength(window);
  const [picked, setPicked] = React.useState<Granularity | null>(null);
  const options = granularityOptions(days);
  const value = picked && options.some((o) => o.id === picked) ? picked : defaultGranularity(days);
  return { value, options, set: setPicked };
}

export function GranularityPills({ value, options, onChange }: { value: Granularity; options: { id: Granularity; label: string }[]; onChange: (g: Granularity) => void }) {
  if (options.length < 2) return null;
  return <FilterPills label="Granularity" value={value} onChange={onChange} options={options} />;
}

export function MiniStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export const fileStamp = (r: Pick<DateRange, "from" | "to">) => `${r.from}_to_${r.to}`;
