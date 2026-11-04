"use client";

import React from "react";
import { SearchX } from "lucide-react";
import { SearchIntelligenceItem } from "@/lib/types";
import { mockSearchIntelligence } from "@/lib/db/mock-data";
import { Badge } from "@/components/ui";
import { ChartCard, HBarList } from "@/components/analytics/primitives";

const URGENCY: Record<SearchIntelligenceItem["demandUrgency"], string> = {
  HIGH: "border-rose-200 bg-rose-50 text-rose-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
};

/**
 * Searches that returned nothing in the customer app: unmet demand to source.
 * Search logs are not part of the demo store yet, so this reads the seed list.
 */
export function SearchIntelligence({ searches = mockSearchIntelligence, limit = 5 }: { searches?: SearchIntelligenceItem[]; limit?: number }) {
  const zero = searches
    .filter((s) => s.isZeroResult)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, limit);

  return (
    <ChartCard title="Zero-result searches" description="What customers looked for and could not find" footerLink={{ href: "/analytics/searches", label: "Search analytics" }}>
      {zero.length ? (
        <HBarList
          ranked={false}
          color="#94A3B8"
          items={zero.map((s) => ({
            id: s.query,
            label: s.query,
            value: s.searchCount,
            display: `${s.searchCount} searches`,
            sub: <Badge className={URGENCY[s.demandUrgency]}>{s.demandUrgency === "HIGH" ? "High demand" : s.demandUrgency === "MEDIUM" ? "Medium" : "Low"}</Badge>,
          }))}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-apptext-secondary">
          <SearchX className="size-6 text-slate-400" aria-hidden />
          Every search found a product.
        </div>
      )}
    </ChartCard>
  );
}
