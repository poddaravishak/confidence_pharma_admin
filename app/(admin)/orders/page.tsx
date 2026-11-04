"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCheck,
  CircleAlert,
  ClipboardList,
  Download,
  PackageCheck,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { Order } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { formatDateTime } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, EmptyState, FilterPills, PageHeader, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import {
  ORDERS_TODAY,
  STATUS_GROUPS,
  StatusGroup,
  DeliveryTypeTag,
  OrderStatusBadge,
  PaymentStatusBadge,
  customerTypeLabel,
  dhakaDay,
  exportOrdersCsv,
  inGroup,
  isCreditMethod,
  paymentMethodLabel,
} from "@/components/orders/shared";

type PaymentFilter = "ALL" | "PENDING" | "PAID_COD" | "PARTIALLY_PAID" | "DUE" | "M_COD" | "M_CREDIT" | "M_MFS";
type DateFilter = "ALL" | "TODAY" | "7D" | "MONTH";
type SortKey = "created" | "number" | "customer" | "total";

const DAY_MS = 86_400_000;

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}

function OrdersList() {
  const router = useRouter();
  const params = useSearchParams();
  const { orders, can, advanceOrder, notify } = useAppStore();

  const initialGroup = (params.get("status") ?? "ALL").toUpperCase() as StatusGroup;
  const [group, setGroup] = useState<StatusGroup>(STATUS_GROUPS.some((g) => g.id === initialGroup) ? initialGroup : "ALL");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [payment, setPayment] = useState<PaymentFilter>("ALL");
  const [date, setDate] = useState<DateFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ---------- filtering (everything except the status group) ---------- */
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const today = new Date(`${ORDERS_TODAY}T00:00:00+06:00`).getTime();
    return orders.filter((o) => {
      if (q) {
        const hay = `${o.orderNumber} ${o.customerName}`.toLowerCase();
        const phoneHit = qDigits.length >= 3 && o.phone.replace(/\D/g, "").includes(qDigits);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      if (payment !== "ALL") {
        if (payment === "M_COD" && o.paymentMethod !== "CASH_ON_DELIVERY") return false;
        if (payment === "M_CREDIT" && !isCreditMethod(o.paymentMethod)) return false;
        if (payment === "M_MFS" && !["BKASH", "NAGAD"].includes(o.paymentMethod)) return false;
        if (!payment.startsWith("M_") && o.paymentStatus !== payment) return false;
      }
      if (date !== "ALL") {
        const day = dhakaDay(o.createdAt);
        if (date === "TODAY" && day !== ORDERS_TODAY) return false;
        if (date === "7D" && new Date(`${day}T00:00:00+06:00`).getTime() < today - 6 * DAY_MS) return false;
        if (date === "MONTH" && day.slice(0, 7) !== ORDERS_TODAY.slice(0, 7)) return false;
      }
      return true;
    });
  }, [orders, query, payment, date]);

  const groupCounts = useMemo(() => {
    const c = {} as Record<StatusGroup, number>;
    for (const g of STATUS_GROUPS) c[g.id] = base.filter((o) => inGroup(o, g.id)).length;
    return c;
  }, [base]);

  const rows = useMemo(() => {
    const list = base.filter((o) => inGroup(o, group));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case "number":
          return a.orderNumber.localeCompare(b.orderNumber) * dir;
        case "customer":
          return a.customerName.localeCompare(b.customerName) * dir;
        case "total":
          return (a.grandTotal - b.grandTotal) * dir;
        default:
          return a.createdAt.localeCompare(b.createdAt) * dir;
      }
    });
  }, [base, group, sort]);

  /* ---------- KPIs ---------- */
  const kpi = useMemo(() => {
    const k = { placed: 0, fulfilment: 0, transit: 0, deliveredToday: 0, partialFailed: 0 };
    for (const o of orders) {
      const s = o.orderStatus;
      if (s === "PLACED") k.placed++;
      else if (s === "CONFIRMED" || s === "PROCESSING" || s === "PACKED") k.fulfilment++;
      else if (s === "DISPATCHED" || s === "OUT_FOR_DELIVERY") k.transit++;
      else if (s === "PARTIALLY_DELIVERED" || s === "FAILED_DELIVERY") k.partialFailed++;
      if ((s === "DELIVERED" || s === "PARTIALLY_DELIVERED") && o.deliveredAt && dhakaDay(o.deliveredAt) === ORDERS_TODAY) k.deliveredToday++;
    }
    return k;
  }, [orders]);

  const revenue = rows
    .filter((o) => o.orderStatus !== "CANCELLED" && o.orderStatus !== "FAILED_DELIVERY")
    .reduce((s, o) => s + o.grandTotal, 0);

  /* ---------- selection ---------- */
  const selectedRows = rows.filter((o) => selected.has(o.id));
  const confirmable = selectedRows.filter((o) => o.orderStatus === "PLACED");
  const allSelected = rows.length > 0 && rows.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((o) => o.id)));

  const confirmSelected = () => {
    for (const o of confirmable) advanceOrder(o.id, "CONFIRMED", "Bulk confirmed from the order list");
    notify(`${confirmable.length} ${confirmable.length === 1 ? "order" : "orders"} confirmed.`);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const list = selectedRows.length ? selectedRows : rows;
    exportOrdersCsv(list);
    notify(`Exported ${list.length} ${list.length === 1 ? "order" : "orders"} to CSV.`);
  };

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "customer" || key === "number" ? "asc" : "desc" }));

  const canEdit = can("orders", "edit");
  const filtersActive = query || payment !== "ALL" || date !== "ALL" || group !== "ALL";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Phone, WhatsApp and app orders from confirmation to delivery."
        actions={
          <>
            <Link href="/delivery" className={btn.secondary}>
              <Truck className="size-4" aria-hidden />
              Delivery board
            </Link>
            {can("orders", "create") && (
              <Link href="/orders/new" className={btn.primary}>
                <Plus className="size-4" aria-hidden />
                New order
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="New orders" value={kpi.placed} hint="Waiting for confirmation" icon={ShoppingCart} tone="slate" active={group === "TO_CONFIRM"} onClick={() => setGroup(group === "TO_CONFIRM" ? "ALL" : "TO_CONFIRM")} />
        <StatCard label="In fulfilment" value={kpi.fulfilment} hint="Confirmed, picking or packed" icon={ClipboardList} tone="violet" active={group === "PROCESSING"} onClick={() => setGroup(group === "PROCESSING" ? "ALL" : "PROCESSING")} />
        <StatCard label="Out for delivery" value={kpi.transit} hint="With riders now" icon={Truck} tone="amber" active={group === "IN_TRANSIT"} onClick={() => setGroup(group === "IN_TRANSIT" ? "ALL" : "IN_TRANSIT")} />
        <StatCard label="Delivered today" value={kpi.deliveredToday} hint="Full and partial" icon={PackageCheck} tone="green" active={group === "DELIVERED"} onClick={() => setGroup(group === "DELIVERED" ? "ALL" : "DELIVERED")} />
        <StatCard label="Partial / failed" value={kpi.partialFailed} hint="Goods came back with the rider" icon={CircleAlert} tone="rose" />
        <StatCard label="Revenue in view" value={formatCurrency(Math.round(revenue))} hint={`${rows.length} ${rows.length === 1 ? "order" : "orders"}, excl. cancelled`} icon={Wallet} tone="blue" />
      </div>

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4 sm:px-5">
          <FilterPills
            label="Order status"
            value={group}
            onChange={(g) => {
              setGroup(g);
              setSelected(new Set());
            }}
            options={STATUS_GROUPS.map((g) => ({ id: g.id, label: g.label, count: groupCounts[g.id] }))}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search order no., customer or phone" className="sm:flex-1" />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <label className="sr-only" htmlFor="order-payment">
                Payment
              </label>
              <select id="order-payment" className={cn(inputClass, "sm:w-44")} value={payment} onChange={(e) => setPayment(e.target.value as PaymentFilter)}>
                <option value="ALL">All payments</option>
                <optgroup label="Payment status">
                  <option value="PENDING">Pending</option>
                  <option value="PAID_COD">Paid</option>
                  <option value="PARTIALLY_PAID">Partly paid</option>
                  <option value="DUE">Due</option>
                </optgroup>
                <optgroup label="Payment method">
                  <option value="M_COD">Cash on delivery</option>
                  <option value="M_MFS">bKash / Nagad</option>
                  <option value="M_CREDIT">Credit</option>
                </optgroup>
              </select>
              <label className="sr-only" htmlFor="order-date">
                Date
              </label>
              <select id="order-date" className={cn(inputClass, "sm:w-36")} value={date} onChange={(e) => setDate(e.target.value as DateFilter)}>
                <option value="ALL">Any date</option>
                <option value="TODAY">Today</option>
                <option value="7D">Last 7 days</option>
                <option value="MONTH">This month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk bar */}
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3 text-sm text-apptext-secondary">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-brand-primary focus:ring-brand-blue"
                checked={allSelected}
                onChange={toggleAll}
                disabled={!rows.length}
                aria-label="Select all orders in view"
              />
              <span className="tabular-nums">{selectedRows.length ? `${selectedRows.length} selected` : `${rows.length} ${rows.length === 1 ? "order" : "orders"}`}</span>
            </label>
            {filtersActive && (
              <button
                className="text-sm font-medium text-brand-primary hover:underline"
                onClick={() => {
                  setQuery("");
                  setPayment("ALL");
                  setDate("ALL");
                  setGroup("ALL");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button className={btn.small} disabled={!confirmable.length} onClick={confirmSelected}>
                <CheckCheck className="size-3.5" aria-hidden />
                Confirm selected{confirmable.length ? ` (${confirmable.length})` : ""}
              </button>
            )}
            {can("orders", "export") && (
              <button className={btn.small} onClick={exportCsv} disabled={!rows.length}>
                <Download className="size-3.5" aria-hidden />
                Export CSV{selectedRows.length ? ` (${selectedRows.length})` : ""}
              </button>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No orders match"
            description={filtersActive ? "Try another status, date or search." : "Orders placed by customers or staff appear here."}
            action={
              can("orders", "create") ? (
                <Link href="/orders/new" className={btn.primary}>
                  <Plus className="size-4" aria-hidden />
                  New order
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="w-10 py-2.5 pl-5 pr-2">
                      <span className="sr-only">Select</span>
                    </th>
                    <SortTh label="Order" k="number" sort={sort} onSort={setSortKey} />
                    <SortTh label="Customer" k="customer" sort={sort} onSort={setSortKey} />
                    <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Items</th>
                    <SortTh label="Total" k="total" sort={sort} onSort={setSortKey} align="right" />
                    <th className="px-3 py-2.5 font-medium">Payment</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="hidden px-3 py-2.5 font-medium xl:table-cell">Rider</th>
                    <SortTh label="Created" k="created" sort={sort} onSort={setSortKey} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((o) => (
                    <tr
                      key={o.id}
                      className={cn("cursor-pointer transition hover:bg-surface/70", selected.has(o.id) && "bg-brand-light/30")}
                      onClick={() => router.push(`/orders/${o.id}`)}
                    >
                      <td className="py-3 pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-brand-primary focus:ring-brand-blue"
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                          aria-label={`Select ${o.orderNumber}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="whitespace-nowrap font-mono text-xs font-semibold text-brand-primary hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                        <div className="mt-0.5">
                          <DeliveryTypeTag type={o.deliveryType} />
                        </div>
                      </td>
                      <td className="max-w-[14rem] px-3 py-3">
                        <p className="truncate font-medium text-apptext-primary">{o.customerName}</p>
                        <p className="text-xs text-apptext-secondary">{customerTypeLabel(o.customerType)}</p>
                      </td>
                      <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">{o.items.length}</td>
                      <td className="px-3 py-3 text-right">
                        <Total o={o} />
                      </td>
                      <td className="px-3 py-3">
                        <PaymentStatusBadge status={o.paymentStatus} />
                        <p className="mt-0.5 text-xs text-apptext-secondary">{paymentMethodLabel(o.paymentMethod)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <OrderStatusBadge status={o.orderStatus} />
                      </td>
                      <td className="hidden px-3 py-3 text-sm xl:table-cell">
                        {o.assignedRider ? o.assignedRider.name : <span className="text-apptext-secondary">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 pr-5 text-xs tabular-nums text-apptext-secondary">{formatDateTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((o) => (
                <li key={o.id} className={cn("flex gap-3 px-4 py-3", selected.has(o.id) && "bg-brand-light/30")}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-slate-300 text-brand-primary focus:ring-brand-blue"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    aria-label={`Select ${o.orderNumber}`}
                  />
                  <Link href={`/orders/${o.id}`} className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-brand-primary">{o.orderNumber}</p>
                        <p className="truncate font-medium text-apptext-primary">{o.customerName}</p>
                      </div>
                      <Total o={o} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <OrderStatusBadge status={o.orderStatus} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <DeliveryTypeTag type={o.deliveryType} />
                    </div>
                    <p className="mt-1.5 text-xs text-apptext-secondary">
                      <span className="tabular-nums">{o.items.length}</span> {o.items.length === 1 ? "item" : "items"} ·{" "}
                      {o.assignedRider?.name ?? "No rider"} · <span className="tabular-nums">{formatDateTime(o.createdAt)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function Total({ o }: { o: Order }) {
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(o.grandTotal)}</p>
      {o.originalGrandTotal !== undefined && (
        <p className="text-xs tabular-nums text-apptext-secondary line-through" title="Total before the delivery revision">
          {formatCurrency(o.originalGrandTotal)}
        </p>
      )}
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("px-3 py-2.5 font-medium", align === "right" && "text-right")}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-apptext-primary", active && "text-apptext-primary", align === "right" && "flex-row-reverse")}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </th>
  );
}
