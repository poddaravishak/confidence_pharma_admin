"use client";

import React from "react";
import { Bike, Building2, Smartphone, Wallet } from "lucide-react";
import { DeliveryPersonnel, FinancialAccount } from "@/lib/types";
import { mockFinancialAccounts } from "@/lib/db/mock-data";
import { ChartCard, ChartLegend, SegmentedBar } from "@/components/analytics/primitives";
import { taka, takaCompact } from "@/components/analytics/format";

const TYPE_META: Record<FinancialAccount["accountType"] | "RIDERS", { label: string; icon: React.ElementType; color: string }> = {
  BANK: { label: "Bank", icon: Building2, color: "#1752B8" },
  MFS_BKASH: { label: "bKash", icon: Smartphone, color: "#EA6A1F" },
  MFS_NAGAD: { label: "Nagad", icon: Smartphone, color: "#0799E6" },
  CASH: { label: "Cash till", icon: Wallet, color: "#7C5CD6" },
  RIDERS: { label: "With riders", icon: Bike, color: "#94A3B8" },
};

const ORDER: (FinancialAccount["accountType"] | "RIDERS")[] = ["BANK", "MFS_BKASH", "MFS_NAGAD", "CASH", "RIDERS"];

/** Liquidity across Cash / Bank / bKash / Nagad, plus cash riders are still carrying. */
export function CashPosition({ riders, accounts = mockFinancialAccounts }: { riders: DeliveryPersonnel[]; accounts?: FinancialAccount[] }) {
  const riderCash = riders.reduce((n, r) => n + r.cashInHand, 0);
  const holding = riders.filter((r) => r.cashInHand > 0).length;
  const byType = ORDER.map((t) => ({
    id: t,
    ...TYPE_META[t],
    value: t === "RIDERS" ? riderCash : accounts.filter((a) => a.accountType === t).reduce((n, a) => n + a.currentBalance, 0),
  }));
  const total = byType.reduce((n, t) => n + t.value, 0);

  return (
    <ChartCard title="Cash position" description={`${taka(total)} available across accounts`} footerLink={{ href: "/accounts", label: "Accounts and ledgers" }}>
      <ChartLegend className="mb-2.5" items={byType.map((t) => ({ label: t.label, color: t.color }))} />
      <SegmentedBar tall label="Cash by account type" formatValue={taka} parts={byType.map((t) => ({ id: t.id, label: t.label, value: t.value, color: t.color }))} />
      <ul className="mt-4 divide-y divide-slate-100">
        {accounts.map((a) => {
          const meta = TYPE_META[a.accountType];
          const Icon = meta.icon;
          return (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <span className="rounded-lg bg-brand-light p-1.5 text-brand-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-apptext-primary">{a.accountName}</span>
                <span className="block text-xs text-apptext-secondary">{meta.label}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-apptext-primary" title={taka(a.currentBalance)}>
                {takaCompact(a.currentBalance)}
              </span>
            </li>
          );
        })}
        <li className="flex items-center gap-3 py-2">
          <span className="rounded-lg bg-amber-50 p-1.5 text-amber-700">
            <Bike className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-apptext-primary">Cash held by riders</span>
            <span className="block text-xs text-apptext-secondary">
              {holding ? `${holding} ${holding === 1 ? "rider" : "riders"} to settle today` : "All riders settled"}
            </span>
          </span>
          <span className="text-sm font-semibold tabular-nums text-apptext-primary" title={taka(riderCash)}>
            {takaCompact(riderCash)}
          </span>
        </li>
      </ul>
    </ChartCard>
  );
}
