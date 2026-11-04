"use client";

import React, { useMemo, useState } from "react";
import { Download, ScrollText, ShieldCheck } from "lucide-react";
import { AuditLogItem } from "@/lib/types";
import { formatDateTime } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, SearchInput, btn, inputClass } from "@/components/ui";
import { SettingsHeader } from "@/components/settings/shared";

const PAGE = 50;

const MODULE_TONE: Record<string, string> = {
  ORDERS: "border-sky-200 bg-sky-50 text-sky-700",
  DELIVERY: "border-orange-200 bg-orange-50 text-orange-700",
  RETURNS: "border-amber-200 bg-amber-50 text-amber-800",
  INVENTORY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ACCOUNTS: "border-teal-200 bg-teal-50 text-teal-700",
  USERS: "border-brand-light bg-brand-light/60 text-brand-primary",
  SETTINGS: "border-slate-200 bg-slate-100 text-slate-700",
  SECURITY: "border-rose-200 bg-rose-50 text-rose-700",
};
const toneFor = (m: string) => MODULE_TONE[m.toUpperCase()] ?? "border-slate-200 bg-white text-slate-600";

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function downloadCsv(rows: AuditLogItem[]) {
  const header = ["Timestamp", "Action", "Module", "Performed by", "Details"];
  const lines = [header, ...rows.map((r) => [r.timestamp, r.action, r.module, r.performedBy, r.details])].map((l) => l.map(csvCell).join(","));
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const { auditLogs, can, notify, logAudit } = useAppStore();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("ALL");
  const [limit, setLimit] = useState(PAGE);

  const modules = useMemo(() => Array.from(new Set(auditLogs.map((l) => l.module))).sort(), [auditLogs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return auditLogs
      .filter((l) => {
        if (module !== "ALL" && l.module !== module) return false;
        if (!q) return true;
        return [l.action, l.details, l.performedBy, l.module].some((f) => f.toLowerCase().includes(q));
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [auditLogs, module, query]);

  const visible = rows.slice(0, limit);

  const exportCsv = () => {
    downloadCsv(rows);
    logAudit("AUDIT_EXPORTED", "SECURITY", `Exported ${rows.length} audit record(s)${module !== "ALL" ? ` for ${module}` : ""}.`);
    notify(`Exported ${rows.length} record${rows.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <>
      <SettingsHeader
        title="Audit logs"
        description="Every approval, stock change, price override, settings change and financial entry, newest first."
        actions={
          can("audit", "export") && (
            <button className={btn.secondary} onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </button>
          )
        }
      />

      <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Records are append-only. Nobody, including Super Admin, can edit or delete them.
      </p>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:p-4">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setLimit(PAGE);
            }}
            placeholder="Search action, details or person"
            className="flex-1"
          />
          <select
            aria-label="Module"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setLimit(PAGE);
            }}
            className={cn(inputClass, "sm:w-52")}
          >
            <option value="ALL">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No records" description="Nothing matches these filters." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-surface text-xs text-apptext-secondary">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Module</th>
                    <th className="px-4 py-2.5 font-medium">Performed by</th>
                    <th className="px-4 py-2.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-apptext-secondary">{formatDateTime(l.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{l.action}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={toneFor(l.module)}>{l.module.charAt(0) + l.module.slice(1).toLowerCase()}</Badge>
                      </td>
                      <td className="px-4 py-3 text-apptext-primary">{l.performedBy}</td>
                      <td className="max-w-md px-4 py-3 text-pretty text-apptext-secondary">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {visible.map((l) => (
                <li key={l.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{l.action}</span>
                    <Badge className={toneFor(l.module)}>{l.module.charAt(0) + l.module.slice(1).toLowerCase()}</Badge>
                  </div>
                  <p className="text-pretty text-sm text-apptext-primary">{l.details}</p>
                  <p className="text-xs text-apptext-secondary">
                    {l.performedBy} · <span className="tabular-nums">{formatDateTime(l.timestamp)}</span>
                  </p>
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-apptext-secondary sm:flex-row sm:justify-between">
              <span className="tabular-nums">
                Showing {visible.length} of {rows.length}
              </span>
              {visible.length < rows.length && (
                <button className={btn.small} onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, rows.length - visible.length)} more
                </button>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
