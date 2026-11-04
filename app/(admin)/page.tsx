"use client";

import React, { useMemo } from "react";
import { useAppStore } from "@/lib/store/AppStore";
import { comparePrevious, duesAging, getSeries } from "@/lib/db/analytics-data";
import { cn } from "@/lib/utils";
import { compareLabel } from "@/components/analytics/format";
import { useDateRange, useLiveHistory } from "@/components/analytics/useAnalytics";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { SalesTrend, trendWindow } from "@/components/dashboard/SalesTrend";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { OrdersPipeline } from "@/components/dashboard/OrdersPipeline";
import { CategoryRevenue, TopProducts } from "@/components/dashboard/CategoryRevenue";
import { DuesAging, TopCustomers } from "@/components/dashboard/CustomerInsights";
import { DeliveryPerformance } from "@/components/dashboard/DeliveryPerformance";
import { InventoryHealth, useInventoryHealth } from "@/components/dashboard/InventoryHealth";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { CashPosition } from "@/components/dashboard/CashPosition";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { SearchIntelligence } from "@/components/dashboard/SearchIntelligence";

const COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/** A responsive row that spreads whichever widgets the role can see. */
function Row({ children, max = 3 }: { children: React.ReactNode[]; max?: number }) {
  const visible = children.filter(Boolean);
  if (!visible.length) return null;
  return <div className={cn("grid grid-cols-1 gap-6", COLS[Math.min(visible.length, max)])}>{visible}</div>;
}

export default function DashboardPage() {
  const { currentUser, currentRole, can, orders, customers, riders } = useAppStore();
  const history = useLiveHistory();
  const [range, setRange] = useDateRange("30d");
  const inventory = useInventoryHealth();

  const show = {
    sales: can("analytics") || can("accounts"),
    finance: can("accounts"),
    orders: can("orders"),
    customers: can("customers"),
    delivery: can("delivery"),
    inventory: can("inventory"),
    searches: can("analytics") || can("catalog"),
  };

  const cmp = useMemo(() => comparePrevious(range, history), [range, history]);
  const spark = useMemo(() => getSeries(trendWindow(range), history), [history, range]);

  const kpis = useMemo(() => {
    const at = (date: string) => history.find((p) => p.date === date);
    const indexChange = (key: "stockIndex" | "duesIndex") => {
      const a = at(cmp.range.to)?.[key];
      const b = at(cmp.prevRange.to)?.[key];
      return a && b && cmp.comparable ? ((a - b) / b) * 100 : null;
    };
    const duesTotal = customers.reduce((n, c) => n + c.currentDue, 0);
    const aging = duesAging(customers);
    const over30 = aging.reduce((n, r) => n + r.d31_60 + r.d61_90 + r.d90p, 0);
    const todayIdx = (key: "stockIndex" | "duesIndex") => at(cmp.range.to)?.[key] ?? 1;
    return {
      revenue: { value: cmp.period.revenue, change: cmp.change("revenue"), spark: spark.map((p) => p.revenue) },
      grossProfit: {
        value: cmp.period.grossProfit,
        margin: cmp.period.margin,
        change: cmp.change("grossProfit"),
        spark: spark.map((p) => p.grossProfit),
      },
      orders: { value: cmp.period.orders, change: cmp.change("orders"), spark: spark.map((p) => p.orders) },
      aov: { value: cmp.period.aov, change: cmp.change("aov"), spark: spark.map((p) => (p.orders ? p.revenue / p.orders : 0)) },
      dues: {
        value: duesTotal * todayIdx("duesIndex"),
        change: indexChange("duesIndex"),
        spark: spark.map((p) => p.duesIndex * duesTotal),
        accounts: aging.length,
        overdueShare: duesTotal ? (over30 / duesTotal) * 100 : 0,
      },
      inventory: {
        value: inventory.value * todayIdx("stockIndex"),
        change: indexChange("stockIndex"),
        spark: spark.map((p) => p.stockIndex * inventory.value),
        skus: inventory.skus,
      },
    };
  }, [cmp, spark, history, customers, inventory]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        name={currentUser?.name ?? "there"}
        roleName={currentRole?.name}
        range={range}
        onRangeChange={setRange}
        can={can}
      />

      <MetricCards
        compareLabel={compareLabel(range)}
        revenue={show.sales ? kpis.revenue : undefined}
        grossProfit={show.finance ? kpis.grossProfit : undefined}
        orders={show.sales || show.orders ? kpis.orders : undefined}
        aov={show.sales ? kpis.aov : undefined}
        dues={show.finance || show.customers ? kpis.dues : undefined}
        inventory={show.inventory ? kpis.inventory : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {show.sales && (
          <div className="min-w-0 lg:col-span-2">
            <SalesTrend history={history} range={range} showFinance={show.finance} />
          </div>
        )}
        <div className={cn("min-w-0", !show.sales && "lg:col-span-3")}>
          <NeedsAttention />
        </div>
      </div>

      <Row>
        {[
          show.orders && <OrdersPipeline key="pipeline" orders={orders} />,
          show.sales && <CategoryRevenue key="cat" points={cmp.currentPoints} previous={cmp.previousPoints} comparable={cmp.comparable} />,
          show.sales && <TopProducts key="top" points={cmp.currentPoints} showMargin={show.finance} />,
        ]}
      </Row>

      <Row max={2}>
        {[
          show.sales && show.customers && <TopCustomers key="cust" points={cmp.currentPoints} />,
          (show.finance || show.customers) && <DuesAging key="aging" customers={customers} />,
        ]}
      </Row>

      {show.delivery && <DeliveryPerformance summary={cmp.period} points={cmp.currentPoints} riders={riders} />}

      <Row>
        {[
          show.inventory && <InventoryHealth key="inv" />,
          show.inventory && <StockAlerts key="alerts" />,
          show.finance && <CashPosition key="cash" riders={riders} />,
        ]}
      </Row>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {show.orders && (
          <div className={cn("min-w-0", show.searches ? "lg:col-span-2" : "lg:col-span-3")}>
            <RecentOrders orders={orders} />
          </div>
        )}
        {show.searches && (
          <div className={cn("min-w-0", !show.orders && "lg:col-span-3")}>
            <SearchIntelligence />
          </div>
        )}
      </div>
    </div>
  );
}
