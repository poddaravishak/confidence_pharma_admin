"use client";

import React, { useMemo, useState } from "react";
import { HandCoins, Store, UserPlus, Users } from "lucide-react";
import { Customer } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { OTHER_CUSTOMER_ID, bucketize, customerTotals, duesAging, getSeries } from "@/lib/db/analytics-data";
import { trendWindow } from "@/components/dashboard/SalesTrend";
import { DuesAging } from "@/components/dashboard/CustomerInsights";
import { Badge, Switch } from "@/components/ui";
import { ChartCard, HBarList, KpiCard } from "../primitives";
import { TimeSeriesChart, labelRows } from "../charts";
import { DataTable, Column } from "../DataTable";
import { SERIES } from "../theme";
import { num, pct, rangeLabel, taka, takaCompact } from "../format";
import { useNameLookup } from "../useAnalytics";
import { MiniStatGrid, TabProps, fileStamp } from "./shared";

const TYPE_LABEL: Record<Customer["customerType"], string> = {
  PHARMACY: "Pharmacy",
  CLINIC: "Clinic",
  DIAGNOSTIC_CENTER: "Diagnostic centre",
  HOSPITAL: "Hospital",
  HEALTHCARE_BIZ: "Healthcare business",
  SURGICAL_STORE: "Surgical store",
};

const STATUS_BADGE: Record<Customer["verificationStatus"], string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  UNDER_REVIEW: "border-sky-200 bg-sky-50 text-sky-700",
  REJECTED: "border-slate-200 bg-slate-100 text-slate-500",
  SUSPENDED: "border-rose-200 bg-rose-50 text-rose-700",
};

interface CustomerRow {
  id: string;
  name: string;
  customer?: Customer;
  orders: number;
  revenue: number;
  share: number;
  due: number;
  limit: number;
  utilization: number;
}

export function CustomersTab({ history, range, cmp, canExport, compareLabel }: TabProps) {
  const { customers } = useAppStore();
  const names = useNameLookup();
  const [includeOther, setIncludeOther] = useState(false);

  const totals = useMemo(() => customerTotals(cmp.currentPoints), [cmp.currentPoints]);
  const win = trendWindow(range);
  const weekly = useMemo(() => labelRows(bucketize(getSeries(trendWindow(range), history), "week"), "week"), [history, range]);
  const aging = useMemo(() => duesAging(customers), [customers]);

  const rows: CustomerRow[] = useMemo(() => {
    const byId = Object.fromEntries(totals.map((t) => [t.customerId, t]));
    const list: CustomerRow[] = customers.map((c) => {
      const t = byId[c.id];
      return {
        id: c.id,
        name: c.businessName,
        customer: c,
        orders: t?.orders ?? 0,
        revenue: t?.revenue ?? 0,
        share: t?.share ?? 0,
        due: c.currentDue,
        limit: c.creditLimit,
        utilization: c.creditLimit ? (c.currentDue / c.creditLimit) * 100 : 0,
      };
    });
    const other = byId[OTHER_CUSTOMER_ID];
    if (other && includeOther)
      list.push({ id: OTHER_CUSTOMER_ID, name: names.customer(OTHER_CUSTOMER_ID), orders: other.orders, revenue: other.revenue, share: other.share, due: 0, limit: 0, utilization: 0 });
    return list;
  }, [customers, totals, includeOther, names]);

  const named = totals.filter((t) => t.customerId !== OTHER_CUSTOMER_ID);
  const namedShare = named.reduce((n, t) => n + t.share, 0);
  const active = named.filter((t) => t.revenue > 0).length;
  const duesTotal = aging.reduce((n, r) => n + r.total, 0);

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      label: "Customer",
      value: (r) => r.name,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{r.name}</span>
          {r.customer && <span className="block text-xs text-apptext-secondary">{TYPE_LABEL[r.customer.customerType]}</span>}
        </span>
      ),
    },
    {
      key: "status",
      label: "KYC",
      value: (r) => r.customer?.verificationStatus ?? "",
      render: (r) =>
        r.customer ? <Badge className={STATUS_BADGE[r.customer.verificationStatus]}>{r.customer.verificationStatus.replace("_", " ").toLowerCase()}</Badge> : "—",
      hideOnMobile: true,
    },
    { key: "orders", label: "Orders", align: "right", value: (r) => r.orders, render: (r) => num(r.orders) },
    { key: "revenue", label: "Net sales", align: "right", value: (r) => Math.round(r.revenue), render: (r) => taka(r.revenue) },
    { key: "share", label: "Share", align: "right", value: (r) => Number(r.share.toFixed(1)), render: (r) => pct(r.share), hideOnMobile: true },
    { key: "due", label: "Due now", align: "right", value: (r) => r.due, render: (r) => taka(r.due) },
    {
      key: "utilization",
      label: "Credit used",
      align: "right",
      value: (r) => Number(r.utilization.toFixed(1)),
      render: (r) => (r.limit ? <span className={r.utilization > 80 ? "font-semibold text-rose-700" : undefined}>{pct(r.utilization, 0)}</span> : "—"),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <MiniStatGrid>
        <KpiCard label="Active named accounts" icon={Store} value={num(active)} hint={`of ${customers.length} registered`} />
        <KpiCard label="Named-account share" icon={Users} value={pct(namedShare, 0)} hint="Rest is retail walk-in trade" />
        <KpiCard label="New accounts" icon={UserPlus} value={num(cmp.period.newCustomers)} delta={cmp.change("newCustomers")} compareLabel={compareLabel} />
        <KpiCard label="Customer dues" icon={HandCoins} value={takaCompact(duesTotal)} hint={`${aging.length} accounts owe`} />
      </MiniStatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top customers" description="Named accounts ranked by net sales">
          <HBarList
            items={named.slice(0, 8).map((c) => ({
              id: c.customerId,
              label: names.customer(c.customerId),
              value: c.revenue,
              display: takaCompact(c.revenue),
              sub: `${num(c.orders)} orders`,
            }))}
            emptyText="No named-account sales in this period"
          />
        </ChartCard>
        <DuesAging customers={customers} limit={8} />
      </div>

      <ChartCard title="New customer accounts" description={`Accounts registered per week · ${rangeLabel(win)}`}>
        <TimeSeriesChart
          data={weekly}
          series={[{ key: "newCustomers", label: "New accounts", color: SERIES.revenue, kind: "bar" }]}
          height={220}
          label="New customer accounts per week"
          yFormat={(v) => num(v)}
          valueFormat={(v) => `${num(v)} accounts`}
        />
      </ChartCard>

      <ChartCard
        title="Customer register"
        description={rangeLabel(range)}
        actions={<div className="w-64"><Switch checked={includeOther} onChange={setIncludeOther} label="Include retail walk-in trade" /></div>}
      >
        <DataTable
          caption="Customer sales and dues"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          initialSort={{ key: "revenue", dir: "desc" }}
          exportName={`customers_${fileStamp(range)}`}
          canExport={canExport}
        />
      </ChartCard>
    </div>
  );
}
