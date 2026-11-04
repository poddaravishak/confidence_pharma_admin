"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui";
import { ANALYTICS_TODAY, DateRange, HISTORY_START, RANGE_PRESETS, resolveRange } from "@/lib/db/analytics-data";
import { presetLabel, rangeLabel } from "@/components/analytics/format";

/**
 * Date range control shared by the dashboard, /analytics and the P&L.
 * Presets are rows with a check on the selected one; a custom range sits
 * below a hairline in the footer.
 */
export function DateRangePicker({
  value,
  onChange,
  align = "right",
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const fromId = useId();
  const toId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFrom(value.from);
      setTo(value.to);
    }
    setOpen((o) => !o);
  };

  const pick = (preset: Exclude<DateRange["preset"], "custom">) => {
    onChange(resolveRange(preset));
    setOpen(false);
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    onChange(resolveRange("custom", { from, to }));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-apptext-primary shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue sm:w-auto"
      >
        <CalendarDays className="size-4 shrink-0 text-brand-primary" aria-hidden />
        <span className="font-medium">{presetLabel(value)}</span>
        <span className="hidden truncate text-apptext-secondary sm:inline">· {rangeLabel(value)}</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-slate-400 transition sm:ml-0", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Choose a date range"
          className={cn(
            "absolute z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <ul className="py-0.5">
            {RANGE_PRESETS.map((p) => {
              const active = value.preset === p.id;
              const r = resolveRange(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    aria-pressed={active}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-50"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {active && <Check className="size-4 text-brand-primary" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className={cn("flex-1", active ? "font-semibold text-apptext-primary" : "text-apptext-primary")}>{p.label}</span>
                    <span className="text-xs tabular-nums text-apptext-secondary">{rangeLabel(r)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <form onSubmit={applyCustom} className="mt-1 border-t border-slate-100 px-2.5 pb-1.5 pt-2.5">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-apptext-primary">
              <span className="flex size-4 items-center justify-center">
                {value.preset === "custom" && <Check className="size-4 text-brand-primary" strokeWidth={3} aria-hidden />}
              </span>
              Custom range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={fromId} className="mb-1 block text-xs text-apptext-secondary">
                  From
                </label>
                <input
                  id={fromId}
                  type="date"
                  value={from}
                  min={HISTORY_START}
                  max={to || ANALYTICS_TODAY}
                  onChange={(e) => setFrom(e.target.value)}
                  className={cn(inputClass, "px-2 py-1.5 text-xs")}
                />
              </div>
              <div>
                <label htmlFor={toId} className="mb-1 block text-xs text-apptext-secondary">
                  To
                </label>
                <input
                  id={toId}
                  type="date"
                  value={to}
                  min={from || HISTORY_START}
                  max={ANALYTICS_TODAY}
                  onChange={(e) => setTo(e.target.value)}
                  className={cn(inputClass, "px-2 py-1.5 text-xs")}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!from || !to}
              className="mt-2.5 w-full rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
            >
              Apply range
            </button>
            <p className="mt-1.5 text-[11px] text-apptext-muted">History is available from {rangeLabel({ from: HISTORY_START, to: HISTORY_START })}.</p>
          </form>
        </div>
      )}
    </div>
  );
}
