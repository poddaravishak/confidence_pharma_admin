"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { btn } from "@/components/ui";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Value used for sorting and CSV export. */
  value: (row: T) => string | number;
  /** Cell content (defaults to the value). */
  render?: (row: T) => React.ReactNode;
  /** Hide below the sm breakpoint to keep 360px screens readable. */
  hideOnMobile?: boolean;
  sortable?: boolean;
}

/** Download rows as a UTF-8 CSV (with BOM so Excel shows ৳ and Bangla correctly). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({ onClick, disabled, label = "Export CSV" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={btn.small}>
      <Download className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/** Sortable table with an optional CSV export of exactly what is shown. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  caption,
  exportName,
  canExport,
  footer,
  emptyText = "No rows for this period",
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  caption: string;
  /** File name for CSV export. Omit to hide the button. */
  exportName?: string;
  canExport?: boolean;
  footer?: React.ReactNode;
  emptyText?: string;
  maxHeight?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>(initialSort ?? { key: columns[0]?.key ?? "", dir: "asc" });

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const exportCsv = () =>
    downloadCsv(
      exportName ?? "export",
      columns.map((c) => c.label),
      sorted.map((r) => columns.map((c) => c.value(r)))
    );

  return (
    <div className="min-w-0">
      {exportName && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-apptext-secondary">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </p>
          {canExport ? (
            <ExportButton onClick={exportCsv} disabled={!rows.length} />
          ) : (
            <span className="text-xs text-apptext-muted">Your role cannot export this report</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-100" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full min-w-[520px] text-left text-sm sm:min-w-0">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] bg-surface text-xs text-apptext-secondary">
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key;
                const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("whitespace-nowrap px-3 py-2 font-medium", c.align === "right" && "text-right", c.hideOnMobile && "hidden sm:table-cell")}
                  >
                    {c.sortable === false ? (
                      c.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn("inline-flex items-center gap-1 hover:text-apptext-primary", c.align === "right" && "flex-row-reverse", active && "text-apptext-primary")}
                      >
                        {c.label}
                        <Icon className="size-3" aria-hidden />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-apptext-secondary">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={rowKey(r)} className="hover:bg-surface/70">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2 text-apptext-primary",
                        c.align === "right" && "whitespace-nowrap text-right tabular-nums",
                        c.hideOnMobile && "hidden sm:table-cell"
                      )}
                    >
                      {c.render ? c.render(r) : c.value(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && <tfoot className="border-t border-slate-200 bg-surface/60 font-semibold">{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}
