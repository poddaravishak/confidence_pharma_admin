"use client";

import React from "react";
import { mockAuditLogs } from "@/lib/db/mock-data";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Lock, Eye, AlertCircle } from "lucide-react";

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Audit Trail & System Security Logs
          </h1>
          <p className="text-xs text-slate-500">
            Immutable tracking for approvals, stock adjustments, price overrides, and financial entries (SRS §42 & §43)
          </p>
        </div>
      </div>

      {/* Security Guarantee Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-900">
              Cryptographic Audit Compliance
            </h3>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              All staff actions modifying customer status, inventory count, or cash registers are timestamped and preserved to prevent discrepancy and ensure full business accountability.
            </p>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
            <tr>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Domain Module</th>
              <th className="py-3 px-4">Authorized User</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Audit Record Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockAuditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/60 transition">
                <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-800">
                    {log.action}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-600">
                  {log.module}
                </td>
                <td className="py-3.5 px-4 font-bold text-slate-800">
                  {log.performedBy}
                </td>
                <td className="py-3.5 px-4 text-slate-500 font-mono">
                  {formatDate(log.timestamp)}
                </td>
                <td className="py-3.5 px-4 text-slate-700 max-w-md">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

