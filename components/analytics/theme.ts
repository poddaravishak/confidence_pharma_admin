import type { CategoryKey } from "@/lib/db/analytics-data";

/**
 * Chart colour roles, adapted from the dataviz method to the Confidence Pharma
 * brand and checked with its palette validator (light surface #FFFFFF):
 * - Series trio (revenue / COGS / gross profit) passes all-pairs CVD checks.
 * - Category order passes adjacent-pair CVD checks and >= 3:1 contrast.
 * - Delivery outcomes (good / warning / critical) pass adjacent checks and
 *   always ship with a legend and labels, never colour alone.
 * Brand navy #073783 is darker than the categorical lightness band, so data
 * marks use the lighter navy step #1752B8; #073783 stays for UI chrome.
 */
export const SERIES = {
  revenue: "#1752B8",
  cogs: "#0799E6",
  profit: "#16A34A",
  netProfit: "#0F7A3A",
  loss: "#E11D48",
  returns: "#E11D48",
  neutral: "#94A3B8",
} as const;

export const STATUS = {
  good: "#0F7A3A",
  warning: "#F59E0B",
  critical: "#E11D48",
  neutral: "#94A3B8",
} as const;

export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  Allopathic: "#1752B8",
  Surgical: "#EA6A1F",
  Diagnostic: "#0799E6",
  "IV Fluids": "#7C5CD6",
};

/** Ordinal rose ramp for dues aging (light → dark = older), validated with --ordinal. */
export const AGING_COLORS = ["#FB7185", "#E11D48", "#BE123C", "#881337"] as const;

export const CHROME = {
  grid: "#E2E8F0",
  axis: "#CBD5E1",
  muted: "#64748B",
  ink: "#172B4D",
  surface: "#FFFFFF",
  cursor: "#94A3B8",
} as const;

export const axisTick = { fontSize: 11, fill: CHROME.muted } as const;

/** Shared props for a recessive x axis. */
export const xAxisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: { stroke: CHROME.axis },
  tickMargin: 8,
} as const;

/** Shared props for a recessive y axis (no rule, ticks only). */
export const yAxisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: false,
  width: 56,
} as const;

export const gridProps = { stroke: CHROME.grid, vertical: false } as const;

/** 2px surface ring on active markers. */
export const activeDot = { r: 4, stroke: CHROME.surface, strokeWidth: 2 } as const;
