"use client";

import React from "react";
import { mockSearchIntelligence } from "@/lib/db/mock-data";
import { Search, Sparkles, AlertTriangle, TrendingUp, Download } from "lucide-react";

export default function SearchAnalyticsPage() {
  const zeroResultList = mockSearchIntelligence.filter((s) => s.isZeroResult);
  const popularList = mockSearchIntelligence.filter((s) => !s.isZeroResult);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Customer Search Analytics & Procurement BI
          </h1>
          <p className="text-xs text-slate-500">
            Real-time market demand tracking and missing inventory gap analysis (SRS §11 & §41)
          </p>
        </div>

        <button
          onClick={() => alert("Exported Zero-Result Procurement Intelligence Report as CSV")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export Procurement Report (CSV)</span>
        </button>
      </div>

      {/* Strategic Notice */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-indigo-900">
              Procurement Decision Engine
            </h3>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Zero-result searches reveal exact medicines and diagnostic kits that visiting pharmacies searched for on the app but could not purchase because they are not yet in the catalog.
            </p>
          </div>
        </div>
      </div>

      {/* Zero Result Searches (Top Priority for Purchasing) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Unmet Market Demand: Zero-Result Searches
            </h2>
            <p className="text-xs text-slate-500">
              High-intent queries with 0 catalog matches
            </p>
          </div>
          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
            {zeroResultList.length} Unstocked Medicine Demands
          </span>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold uppercase">
                <th className="pb-3">Customer Search Query</th>
                <th className="pb-3">Search Frequency</th>
                <th className="pb-3">Suggested Category</th>
                <th className="pb-3">Procurement Urgency</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {zeroResultList.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 font-bold text-slate-900">{item.query}</td>
                  <td className="py-3 font-mono font-bold text-slate-700">
                    {item.searchCount} searches
                  </td>
                  <td className="py-3 text-slate-600">{item.categorySuggestion}</td>
                  <td className="py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        item.demandUrgency === "HIGH"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.demandUrgency} PRIORITY
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() =>
                        alert(`Opening Product Creation pre-filled with "${item.query}"`)
                      }
                      className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      Add to Catalog
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

