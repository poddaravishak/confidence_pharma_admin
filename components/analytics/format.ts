import { formatCurrency } from "@/lib/utils";
import { DateRange, RANGE_PRESETS, rangeLength } from "@/lib/db/analytics-data";

/** Whole-taka currency with Bangladeshi digit grouping (৳12,34,567). */
export const taka = (n: number) => formatCurrency(Math.round(n));

/** Compact taka for axis ticks and tight tiles: ৳850, ৳45K, ৳2.4L, ৳1.25Cr. */
export function takaCompact(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}৳${trim(a / 1e7, a >= 1e8 ? 1 : 2)}Cr`;
  if (a >= 1e5) return `${sign}৳${trim(a / 1e5, a >= 1e6 ? 1 : 2)}L`;
  if (a >= 1e3) return `${sign}৳${trim(a / 1e3, a >= 1e4 ? 0 : 1)}K`;
  return `${sign}৳${Math.round(a)}`;
}

function trim(n: number, digits: number) {
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export const num = (n: number) => Math.round(n).toLocaleString("en-US");

export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

/** Signed % change, e.g. +12.4% / −3.1%. */
export function deltaText(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const v = Math.abs(n) < 0.05 ? 0 : n;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "5 Nov" */
export function dayLabel(iso: string): string {
  return `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
}

/** "5 Nov 2026" */
export function dayLabelLong(iso: string): string {
  return `${dayLabel(iso)} ${iso.slice(0, 4)}`;
}

/** "Oct 2026" from "2026-10" or a date */
export function monthLabel(iso: string, withYear = false): string {
  const m = MONTHS[+iso.slice(5, 7) - 1];
  return withYear ? `${m} ${iso.slice(0, 4)}` : m;
}

export function rangeLabel(r: Pick<DateRange, "from" | "to">): string {
  if (r.from === r.to) return dayLabelLong(r.from);
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${sameYear ? dayLabel(r.from) : dayLabelLong(r.from)} – ${dayLabelLong(r.to)}`;
}

export function presetLabel(r: DateRange): string {
  if (r.preset === "custom") return `${rangeLength(r)} days`;
  return RANGE_PRESETS.find((p) => p.id === r.preset)?.label ?? "";
}

/** "vs yesterday", "vs previous 30 days", "vs same days last month" */
export function compareLabel(r: DateRange): string {
  if (r.preset === "today") return "vs yesterday, same time";
  if (r.preset === "mtd") return "vs same days last month";
  const n = rangeLength(r);
  return n === 1 ? "vs previous day" : `vs previous ${n} days`;
}
