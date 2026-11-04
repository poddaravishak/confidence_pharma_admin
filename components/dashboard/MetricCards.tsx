"use client";

import React from "react";
import { Boxes, HandCoins, Percent, ReceiptText, ShoppingCart, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/analytics/primitives";
import { num, pct, taka, takaCompact } from "@/components/analytics/format";
import { SERIES } from "@/components/analytics/theme";
import { cn } from "@/lib/utils";

export interface KpiDatum {
  value: number;
  change: number | null;
  spark: number[];
}

export interface MetricCardsProps {
  compareLabel: string;
  revenue?: KpiDatum;
  grossProfit?: KpiDatum & { margin: number };
  orders?: KpiDatum;
  aov?: KpiDatum;
  dues?: KpiDatum & { accounts: number; overdueShare: number };
  inventory?: KpiDatum & { skus: number };
}

/** Column layout per number of visible tiles, so a row never ends with an orphan. */
const GRID: Record<number, string> = {
  1: "min-[420px]:grid-cols-1",
  2: "",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3 2xl:grid-cols-5",
  6: "lg:grid-cols-3 2xl:grid-cols-6",
};

/** Executive KPI row. Pass only the KPIs the signed-in role may see. */
export function MetricCards({ compareLabel, revenue, grossProfit, orders, aov, dues, inventory }: MetricCardsProps) {
  const cards: React.ReactNode[] = [];
  if (revenue)
    cards.push(
      <KpiCard
        key="revenue"
        label="Net sales"
        icon={TrendingUp}
        value={<span title={taka(revenue.value)}>{takaCompact(revenue.value)}</span>}
        delta={revenue.change}
        compareLabel={compareLabel}
        spark={revenue.spark}
        sparkColor={SERIES.revenue}
        href="/analytics"
      />
    );
  if (grossProfit)
    cards.push(
      <KpiCard
        key="gp"
        label="Gross profit"
        icon={Percent}
        value={
          <span>
            <span title={taka(grossProfit.value)}>{takaCompact(grossProfit.value)}</span>
            <span className="ml-1.5 text-sm font-medium text-apptext-secondary">{pct(grossProfit.margin)} margin</span>
          </span>
        }
        delta={grossProfit.change}
        compareLabel={compareLabel}
        spark={grossProfit.spark}
        sparkColor={SERIES.profit}
        href="/accounts/profit-loss"
      />
    );
  if (orders)
    cards.push(
      <KpiCard
        key="orders"
        label="Orders"
        icon={ShoppingCart}
        value={num(orders.value)}
        delta={orders.change}
        compareLabel={compareLabel}
        spark={orders.spark}
        href="/orders"
      />
    );
  if (aov)
    cards.push(
      <KpiCard
        key="aov"
        label="Avg order value"
        icon={ReceiptText}
        value={taka(aov.value)}
        delta={aov.change}
        compareLabel={compareLabel}
        spark={aov.spark}
      />
    );
  if (dues)
    cards.push(
      <KpiCard
        key="dues"
        label="Customer dues"
        icon={HandCoins}
        value={<span title={taka(dues.value)}>{takaCompact(dues.value)}</span>}
        delta={dues.change}
        upIsGood={false}
        hint={`${dues.accounts} accounts · ${pct(dues.overdueShare, 0)} over 30 days`}
        spark={dues.spark}
        sparkColor={SERIES.loss}
        href="/customers"
      />
    );
  if (inventory)
    cards.push(
      <KpiCard
        key="inv"
        label="Inventory value"
        icon={Boxes}
        value={<span title={taka(inventory.value)}>{takaCompact(inventory.value)}</span>}
        delta={inventory.change}
        compareLabel={compareLabel}
        spark={inventory.spark}
        sparkColor={SERIES.cogs}
        href="/inventory"
      />
    );

  if (!cards.length) return null;
  return <div className={cn("grid grid-cols-1 gap-3 min-[420px]:grid-cols-2", GRID[cards.length])}>{cards}</div>;
}
