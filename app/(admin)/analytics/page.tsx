"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, LineChart, Package, RotateCcw, Search, Truck, Users } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import { comparePrevious } from "@/lib/db/analytics-data";
import { PageHeader, Tabs, btn } from "@/components/ui";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { compareLabel } from "@/components/analytics/format";
import { useDateRange, useLiveHistory } from "@/components/analytics/useAnalytics";
import { SalesTab } from "@/components/analytics/tabs/SalesTab";
import { ProductsTab } from "@/components/analytics/tabs/ProductsTab";
import { CustomersTab } from "@/components/analytics/tabs/CustomersTab";
import { DeliveryTab } from "@/components/analytics/tabs/DeliveryTab";
import { ReturnsTab } from "@/components/analytics/tabs/ReturnsTab";
import { InventoryTab } from "@/components/analytics/tabs/InventoryTab";
import { TabProps } from "@/components/analytics/tabs/shared";
import { PermissionModule } from "@/lib/types";

type TabId = "sales" | "products" | "customers" | "delivery" | "returns" | "inventory";

const TABS: { id: TabId; label: string; icon: React.ElementType; module?: PermissionModule; Component: React.ComponentType<TabProps> }[] = [
  { id: "sales", label: "Sales", icon: LineChart, Component: SalesTab },
  { id: "products", label: "Products", icon: Package, Component: ProductsTab },
  { id: "customers", label: "Customers", icon: Users, module: "customers", Component: CustomersTab },
  { id: "delivery", label: "Delivery", icon: Truck, module: "delivery", Component: DeliveryTab },
  { id: "returns", label: "Returns", icon: RotateCcw, module: "returns", Component: ReturnsTab },
  { id: "inventory", label: "Inventory", icon: Boxes, module: "inventory", Component: InventoryTab },
];

function AnalyticsHub() {
  const { can } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const history = useLiveHistory();
  const [range, setRange] = useDateRange("30d");

  const tabs = TABS.filter((t) => !t.module || can(t.module));
  const requested = params.get("tab") as TabId | null;
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  const cmp = useMemo(() => comparePrevious(range, history), [range, history]);
  const props: TabProps = {
    history,
    range,
    cmp,
    canExport: can("analytics", "export"),
    showFinance: can("accounts"),
    compareLabel: compareLabel(range),
  };

  const selectTab = (id: TabId) => router.replace(`${pathname}?tab=${id}`, { scroll: false });
  const Active = active.Component;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics and reports"
        description="Sales, product, customer, delivery, returns and stock performance. Every chart follows the date range."
        actions={
          <>
            <Link href="/analytics/searches" className={btn.secondary}>
              <Search className="size-4" aria-hidden />
              Search analytics
            </Link>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />
      <Tabs label="Report" value={active.id} onChange={selectTab} tabs={tabs.map(({ id, label, icon }) => ({ id, label, icon }))} />
      <div role="tabpanel" aria-label={`${active.label} report`}>
        <Active {...props} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-xl bg-white" aria-busy="true" />}>
      <AnalyticsHub />
    </Suspense>
  );
}
