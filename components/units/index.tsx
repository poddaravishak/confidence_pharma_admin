"use client";

/**
 * UI for the Base Unit + Conversion model (lib/units.ts).
 * Every component takes and returns quantities in BASE units unless noted,
 * so callers never do unit maths themselves.
 */
import React, { useId, useMemo, useState } from "react";
import { ArrowRightLeft, Layers } from "lucide-react";
import type { InventoryItem } from "@/lib/types";
import {
  UnitLevel,
  availableIn,
  conversionChain,
  pluralUnit,
  qtyText,
  splitBase,
  sumToBase,
  toBase,
  unitLevels,
} from "@/lib/units";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Unit select                                                         */
/* ------------------------------------------------------------------ */

export function UnitSelect({
  item,
  value,
  onChange,
  levels,
  className,
  ariaLabel,
  disabled,
}: {
  item: InventoryItem;
  /** Level id */
  value: string;
  onChange: (levelId: string) => void;
  /** Restrict choices (default: every level). */
  levels?: UnitLevel[];
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const options = levels ?? unitLevels(item);
  return (
    <select
      aria-label={ariaLabel ?? `Unit for ${item.name}`}
      value={value}
      disabled={disabled || options.length <= 1}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, "w-auto pr-8 disabled:bg-white disabled:text-apptext-primary", className)}
    >
      {options.map((l) => (
        <option key={l.id} value={l.id}>
          {l.isBase ? l.name : `${l.name} (×${l.factor.toLocaleString("en-US")})`}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Quantity + unit                                                     */
/* ------------------------------------------------------------------ */

export interface UnitQty {
  qty: number;
  levelId: string;
}

/** Base units for a {qty, levelId} pair. */
export function unitQtyToBase(item: InventoryItem, v: UnitQty): number {
  const level = unitLevels(item).find((l) => l.id === v.levelId) ?? unitLevels(item)[0];
  return toBase(Math.max(0, v.qty || 0), level);
}

/**
 * Number field with a unit picker. Shows the base-unit equivalent underneath
 * ("= 480 Tablets") so the conversion is never hidden.
 */
export function UnitQuantityInput({
  item,
  value,
  onChange,
  levels,
  label,
  invalid,
  maxBase,
  className,
}: {
  item: InventoryItem;
  value: UnitQty;
  onChange: (v: UnitQty) => void;
  levels?: UnitLevel[];
  label?: string;
  invalid?: boolean;
  /** Show a hint when the entered quantity exceeds this many base units. */
  maxBase?: number;
  className?: string;
}) {
  const id = useId();
  const all = levels ?? unitLevels(item);
  const level = all.find((l) => l.id === value.levelId) ?? all[0];
  const base = toBase(Math.max(0, value.qty || 0), level);
  const over = maxBase !== undefined && base > maxBase;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-apptext-secondary">
          {label}
        </label>
      )}
      <div className="flex">
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          value={value.qty ? value.qty : ""}
          placeholder="0"
          onChange={(e) => onChange({ ...value, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          className={cn(
            inputClass,
            "min-w-0 flex-1 rounded-r-none tabular-nums",
            (invalid || over) && "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
          )}
        />
        <UnitSelect
          item={item}
          levels={all}
          value={level.id}
          onChange={(levelId) => onChange({ ...value, levelId })}
          className="-ml-px rounded-l-none bg-surface"
        />
      </div>
      <p className={cn("mt-1 text-xs tabular-nums", over ? "text-rose-600" : "text-apptext-secondary")}>
        {level.isBase ? "Base unit" : `= ${qtyText(base, item.baseUnit)}`}
        {over && maxBase !== undefined && ` · only ${qtyText(maxBase, item.baseUnit)} available`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-level counter (count Boxes + Strips + loose Tablets)          */
/* ------------------------------------------------------------------ */

export type LevelCounts = Record<string, number>;

/** Counts for a base quantity, largest unit first (12 Box, 1 Strip, 4 Tablet). */
export function countsFromBase(item: InventoryItem, base: number): LevelCounts {
  return Object.fromEntries(splitBase(base, unitLevels(item)).map((p) => [p.level.id, p.qty]));
}

/**
 * One field per unit level. Staff count what they see on the shelf (full
 * cartons, boxes, loose strips, loose tablets) and the total is converted to
 * base units.
 */
export function PackCounter({
  item,
  counts,
  onChange,
  compact,
}: {
  item: InventoryItem;
  counts: LevelCounts;
  onChange: (counts: LevelCounts, base: number) => void;
  compact?: boolean;
}) {
  const levels = useMemo(() => [...unitLevels(item)].reverse(), [item]);
  const total = sumToBase(levels, counts);
  return (
    <div>
      <div className={cn("grid gap-2", compact ? "grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))]" : "grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]")}>
        {levels.map((l) => (
          <label key={l.id} className="block min-w-0">
            <span className="mb-1 block truncate text-[11px] font-medium text-apptext-secondary">
              {l.isBase ? `Loose ${pluralUnit(l.name, 2).toLowerCase()}` : pluralUnit(l.name, 2)}
              {!l.isBase && <span className="font-normal text-slate-400"> ×{l.factor.toLocaleString("en-US")}</span>}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`${l.name} count`}
              value={counts[l.id] ? counts[l.id] : ""}
              placeholder="0"
              onChange={(e) => {
                const next = { ...counts, [l.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) };
                onChange(next, sumToBase(levels, next));
              }}
              className={cn(inputClass, "tabular-nums", compact && "py-1.5")}
            />
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-apptext-secondary">
        Total <span className="font-semibold tabular-nums text-apptext-primary">{qtyText(total, item.baseUnit)}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only displays                                                  */
/* ------------------------------------------------------------------ */

/** Chips: [12 Boxes] [1 Strip] [4 Tablets] */
export function QtyBreakdown({ base, item, className }: { base: number; item: InventoryItem; className?: string }) {
  const parts = splitBase(base, unitLevels(item)).filter((p) => p.qty !== 0);
  if (!parts.length) return <span className={cn("text-xs text-slate-400", className)}>{qtyText(0, item.baseUnit)}</span>;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {parts.map((p) => (
        <span
          key={p.level.id}
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            p.level.isBase ? "border-slate-200 bg-white text-slate-600" : "border-blue-100 bg-brand-light/50 text-brand-primary"
          )}
        >
          {qtyText(p.qty, p.level.name)}
        </span>
      ))}
    </span>
  );
}

/** Visual ladder: Carton ▸ 50 Boxes ▸ 2 Strips ▸ 10 Tablets */
export function ConversionLadder({ item, className }: { item: InventoryItem; className?: string }) {
  const levels = unitLevels(item);
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)} aria-label={conversionChain(item)}>
      {[...levels].reverse().map((l, i) => (
        <React.Fragment key={l.id}>
          {i > 0 && <span className="text-slate-300" aria-hidden>▸</span>}
          <span
            className={cn(
              "rounded-md border px-2 py-1",
              l.isBase ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-apptext-primary"
            )}
          >
            <span className="font-semibold">{l.name}</span>
            {l.childName && (
              <span className="text-apptext-secondary">
                {" "}
                = {qtyText(l.perChild, l.childName)}
              </span>
            )}
            {l.isBase && <span className="text-emerald-700"> · base</span>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Conversion table with live converter: type a quantity in any unit and see
 * it in every other unit, plus how much of each the current stock covers.
 */
export function UnitConverter({ item, stockBase }: { item: InventoryItem; stockBase?: number }) {
  const levels = useMemo(() => unitLevels(item), [item]);
  const [v, setV] = useState<UnitQty>({ qty: 1, levelId: levels[levels.length - 1].id });
  const from = levels.find((l) => l.id === v.levelId) ?? levels[0];
  const base = toBase(v.qty || 0, from);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <UnitQuantityInput item={item} value={v} onChange={setV} label="Convert" className="w-56" />
        <ArrowRightLeft className="mb-7 size-4 text-slate-400" aria-hidden />
        <ul className="mb-6 flex flex-1 flex-wrap gap-1.5">
          {levels
            .filter((l) => l.id !== from.id)
            .map((l) => {
              const n = base / l.factor;
              return (
                <li key={l.id} className="rounded-md bg-surface px-2 py-1 text-xs tabular-nums text-apptext-primary">
                  {Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                  {pluralUnit(l.name, n)}
                </li>
              );
            })}
        </ul>
      </div>
      {stockBase !== undefined && (
        <p className="flex items-center gap-1.5 text-xs text-apptext-secondary">
          <Layers className="size-3.5" aria-hidden />
          Sellable stock covers{" "}
          {[...levels]
            .reverse()
            .map((l) => qtyText(availableIn(stockBase, l), l.name))
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
