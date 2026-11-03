"use client";

import React from "react";
import Link from "next/link";
import { SearchIntelligenceItem } from "@/lib/types";
import { Search, Sparkles, TrendingUp, AlertCircle } from "lucide-react";

interface SearchIntelligenceProps {
  searches: SearchIntelligenceItem[];
}

export const SearchIntelligence: React.FC<SearchIntelligenceProps> = ({ searches }) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-brand-light p-2 text-brand-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-primary">Procurement Search Intelligence</h2>
            <p className="text-xs text-apptext-secondary">Unmet market demand & frequent pharmacy searches</p>
          </div>
        </div>
        <Link
          href="/analytics/searches"
          className="text-xs font-bold text-brand-blue hover:text-brand-primary transition"
        >
          View Full BI Report
        </Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {searches.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-surface transition"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-light/60 text-brand-primary">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-apptext-primary">{item.query}</p>
                <span className="text-[11px] text-apptext-secondary">{item.categorySuggestion}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-brand-primary">
                {item.searchCount} searches
              </span>

              {item.isZeroResult ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  <AlertCircle className="h-3 w-3" />
                  Not Stocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                  <TrendingUp className="h-3 w-3" />
                  Popular
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
