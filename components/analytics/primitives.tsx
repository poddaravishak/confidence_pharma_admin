"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import { deltaText } from "./format";

/* ------------------------------------------------------------------ */
/* Client-only chart frame                                             */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** True after hydration; false during SSR and the hydration pass. */
export function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Fixed-height box that renders a Recharts chart only on the client.
 * The height includes the axis band so the card never scrolls internally.
 */
export function ChartFrame({
  height,
  label,
  children,
  className,
}: {
  height: number;
  /** Accessible summary of what the chart shows. */
  label: string;
  children: React.ReactElement;
  className?: string;
}) {
  const isClient = useIsClient();
  return (
    <figure aria-label={label} className={cn("relative w-full min-w-0", className)} style={{ height }}>
      {isClient ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="size-full rounded-lg bg-slate-50" aria-hidden />
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

interface TooltipItem {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/** Recharts tooltip content: value first, series keyed with a short line in its colour. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  footer,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  formatValue: (v: number, item: TooltipItem) => string;
  formatLabel?: (label: string, row?: Record<string, unknown>) => string;
  footer?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      {label !== undefined && (
        <p className="mb-1.5 font-medium text-apptext-secondary">{formatLabel ? formatLabel(String(label), row) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((item, i) => (
          <li key={`${String(item.dataKey)}-${i}`} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: item.color ?? item.stroke ?? item.fill }} aria-hidden />
            <span className="font-semibold tabular-nums text-apptext-primary">{formatValue(Number(item.value ?? 0), item)}</span>
            <span className="truncate text-apptext-secondary">{item.name}</span>
          </li>
        ))}
      </ul>
      {footer && row && <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-apptext-secondary">{footer(row)}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */

export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; shape?: "line" | "rect"; value?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-apptext-secondary", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.shape === "line" ? (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} aria-hidden />
          ) : (
            <span className="size-2.5 rounded-sm" style={{ background: it.color }} aria-hidden />
          )}
          <span>{it.label}</span>
          {it.value !== undefined && <span className="font-medium tabular-nums text-apptext-primary">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Card wrapper                                                        */
/* ------------------------------------------------------------------ */

export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  footerLink,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footerLink?: { href: string; label: string };
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-apptext-primary">{title}</h2>
          {description && <p className="text-pretty text-sm text-apptext-secondary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={cn("min-w-0 flex-1 px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
      {footerLink && (
        <div className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
          <Link href={footerLink.href} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:text-brand-primary">
            {footerLink.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Delta chip                                                          */
/* ------------------------------------------------------------------ */

export function Delta({ value, upIsGood = true, className }: { value: number | null; upIsGood?: boolean; className?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-xs text-apptext-muted", className)}>No comparison</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === upIsGood;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        good === null ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-700",
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {deltaText(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({ data, color = "#1752B8", height = 36 }: { data: number[]; color?: string; height?: number }) {
  const isClient = useIsClient();
  const rows = data.map((v, i) => ({ i, v }));
  const id = React.useId().replace(/:/g, "");
  return (
    <div className="w-full" style={{ height }} aria-hidden>
      {isClient && rows.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#spark-${id})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI tile                                                            */
/* ------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  delta,
  upIsGood = true,
  compareLabel,
  hint,
  spark,
  sparkColor,
  icon: Icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  upIsGood?: boolean;
  compareLabel?: string;
  hint?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  icon: React.ElementType;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-apptext-secondary">{label}</span>
        <span className="rounded-lg bg-brand-light p-1.5 text-brand-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1.5 truncate text-2xl font-bold text-apptext-primary">{value}</p>
      <div className="mt-0.5 flex min-h-[18px] flex-wrap items-center gap-x-1.5 text-xs text-apptext-secondary">
        {delta !== undefined && <Delta value={delta} upIsGood={upIsGood} />}
        {delta !== undefined && delta !== null && compareLabel && <span className="truncate">{compareLabel}</span>}
        {hint && <span className="truncate">{hint}</span>}
      </div>
      {spark && (
        <div className="mt-2">
          <Sparkline data={spark} color={sparkColor} />
        </div>
      )}
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-brand-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars (HTML, responsive down to 360px)             */
/* ------------------------------------------------------------------ */

export interface HBarItem {
  id: string;
  label: React.ReactNode;
  value: number;
  display: string;
  sub?: React.ReactNode;
  color?: string;
  href?: string;
}

export function HBarList({
  items,
  color = "#1752B8",
  ranked = true,
  max,
  emptyText = "No data for this period",
}: {
  items: HBarItem[];
  color?: string;
  ranked?: boolean;
  max?: number;
  emptyText?: string;
}) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  if (!items.length || top <= 0) return <p className="py-8 text-center text-sm text-apptext-secondary">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {items.map((it, i) => {
        const w = Math.max(1.5, (it.value / top) * 100);
        const labelNode = it.href ? (
          <Link href={it.href} className="hover:text-brand-primary hover:underline">
            {it.label}
          </Link>
        ) : (
          it.label
        );
        return (
          <li key={it.id} className="group" title={`${typeof it.label === "string" ? it.label : ""} ${it.display}`.trim()}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                {ranked && <span className="w-5 shrink-0 text-right text-xs tabular-nums text-apptext-muted">{i + 1}</span>}
                <span className="truncate font-medium text-apptext-primary">{labelNode}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-apptext-primary">{it.display}</span>
            </div>
            <div className={cn("mt-1 flex items-center gap-2", ranked && "pl-7")}>
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full transition-[filter] group-hover:brightness-110"
                  style={{ width: `${w}%`, background: it.color ?? color }}
                />
              </div>
              {it.sub && <span className="shrink-0 text-xs tabular-nums text-apptext-secondary">{it.sub}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented bar (one whole split into parts)                          */
/* ------------------------------------------------------------------ */

export function SegmentedBar({
  parts,
  tall = false,
  formatValue,
  label,
}: {
  parts: { id: string; label: string; value: number; color: string; dark?: boolean }[];
  tall?: boolean;
  formatValue: (v: number) => string;
  label: string;
}) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total <= 0) return <div className={cn("rounded-full bg-slate-100", tall ? "h-7" : "h-2")} aria-label={`${label}: nothing outstanding`} />;
  return (
    <div className={cn("flex w-full gap-0.5", tall ? "h-7" : "h-2")} role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${formatValue(p.value)}`).join(", ")}`}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => {
          const share = (p.value / total) * 100;
          return (
            <div
              key={p.id}
              title={`${p.label}: ${formatValue(p.value)} (${share.toFixed(0)}%)`}
              className={cn("flex min-w-[3px] items-center overflow-hidden", tall ? "rounded px-2" : "rounded-full")}
              style={{ width: `${share}%`, background: p.color }}
            >
              {tall && share >= 14 && (
                <span className={cn("whitespace-nowrap text-[11px] font-semibold tabular-nums", p.dark ? "text-slate-900" : "text-white")}>
                  {share.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small inline metric                                                 */
/* ------------------------------------------------------------------ */

export function MiniStat({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warning" | "critical";
  icon?: React.ElementType;
}) {
  const toneCls = {
    default: "text-apptext-primary",
    good: "text-emerald-700",
    warning: "text-amber-700",
    critical: "text-rose-700",
  }[tone];
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-surface/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-apptext-secondary">
        {Icon && <Icon className={cn("size-3.5 shrink-0", toneCls)} aria-hidden />}
        {label}
      </p>
      <p className={cn("mt-0.5 truncate text-lg font-semibold tabular-nums", toneCls)}>{value}</p>
      {hint && <p className="truncate text-xs text-apptext-secondary">{hint}</p>}
    </div>
  );
}

