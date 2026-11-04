"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  PackageSearch,
  PackageX,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCheck,
} from "lucide-react";
import { PermissionModule } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { batchState } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/analytics/primitives";
import { taka } from "@/components/analytics/format";
import { useInventoryHealth } from "./InventoryHealth";

interface Task {
  id: string;
  module: PermissionModule;
  icon: React.ElementType;
  tone: string;
  count: number;
  /** Phrase that follows the count, e.g. "orders waiting for confirmation". */
  title: string;
  detail: string;
  href: string;
  /** Higher sorts first. */
  priority: number;
}

/** Today's to-do list built from live data, filtered to what the role can act on. */
export function NeedsAttention() {
  const { customers, orders, returns, riders, can } = useAppStore();
  const { adjustments, batches } = useInventory();
  const health = useInventoryHealth();

  const tasks = useMemo(() => {
    const list: Task[] = [];
    const kyc = customers.filter((c) => c.verificationStatus === "PENDING" || c.verificationStatus === "UNDER_REVIEW");
    if (kyc.length)
      list.push({
        id: "kyc",
        module: "customers",
        icon: UserCheck,
        tone: "bg-amber-50 text-amber-700",
        count: kyc.length,
        title: `KYC ${kyc.length === 1 ? "application" : "applications"} to review`,
        detail: kyc.map((c) => c.businessName.split(" (")[0]).slice(0, 2).join(", "),
        href: "/customers",
        priority: 70,
      });
    const placed = orders.filter((o) => o.orderStatus === "PLACED");
    if (placed.length)
      list.push({
        id: "confirm",
        module: "orders",
        icon: ShoppingCart,
        tone: "bg-brand-light text-brand-primary",
        count: placed.length,
        title: `${placed.length === 1 ? "order" : "orders"} waiting for confirmation`,
        detail: `${taka(placed.reduce((n, o) => n + o.grandTotal, 0))} in new orders`,
        href: "/orders?status=TO_CONFIRM",
        priority: 90,
      });
    const packed = orders.filter((o) => o.orderStatus === "PACKED");
    if (packed.length)
      list.push({
        id: "dispatch",
        module: "delivery",
        icon: Truck,
        tone: "bg-brand-light text-brand-primary",
        count: packed.length,
        title: `packed ${packed.length === 1 ? "order" : "orders"} ready to dispatch`,
        detail: "Assign to a delivery run",
        href: "/delivery",
        priority: 60,
      });
    const toInspect = returns.filter((r) => r.status === "RECEIVED");
    if (toInspect.length)
      list.push({
        id: "inspect",
        module: "returns",
        icon: ClipboardCheck,
        tone: "bg-violet-50 text-violet-700",
        count: toInspect.length,
        title: `${toInspect.length === 1 ? "return" : "returns"} awaiting inspection`,
        detail: `${taka(toInspect.reduce((n, r) => n + r.totalValue, 0))} of goods in the returns bay`,
        href: "/returns",
        priority: 80,
      });
    const rmas = returns.filter((r) => r.source === "CUSTOMER_RMA" && r.status === "REQUESTED");
    if (rmas.length)
      list.push({
        id: "rma",
        module: "returns",
        icon: RotateCcw,
        tone: "bg-amber-50 text-amber-700",
        count: rmas.length,
        title: `customer return ${rmas.length === 1 ? "request" : "requests"} to approve`,
        detail: rmas.map((r) => r.customerName.split(" (")[0]).slice(0, 2).join(", "),
        href: "/returns",
        priority: 75,
      });
    const inTransit = returns.filter((r) => r.status === "IN_TRANSIT");
    if (inTransit.length)
      list.push({
        id: "transit",
        module: "delivery",
        icon: PackageSearch,
        tone: "bg-amber-50 text-amber-700",
        count: inTransit.length,
        title: `${inTransit.length === 1 ? "return" : "returns"} in rider custody`,
        detail: "Collect at end-of-day settlement",
        href: "/delivery",
        priority: 50,
      });
    const cashRiders = riders.filter((r) => r.cashInHand > 0);
    if (cashRiders.length)
      list.push({
        id: "settle",
        module: "delivery",
        icon: Bike,
        tone: "bg-amber-50 text-amber-700",
        count: cashRiders.length,
        title: `${cashRiders.length === 1 ? "rider" : "riders"} with cash to settle`,
        detail: `${taka(cashRiders.reduce((n, r) => n + r.cashInHand, 0))} in hand`,
        href: "/delivery",
        priority: 65,
      });
    const pendingAdj = adjustments.filter((a) => a.status === "PENDING");
    if (pendingAdj.length)
      list.push({
        id: "adjust",
        module: "inventory",
        icon: ShieldAlert,
        tone: "bg-amber-50 text-amber-700",
        count: pendingAdj.length,
        title: `stock ${pendingAdj.length === 1 ? "adjustment needs" : "adjustments need"} approval`,
        detail: `${taka(pendingAdj.reduce((n, a) => n + Math.abs(a.costImpact), 0))} cost impact`,
        href: "/inventory/adjustments?status=PENDING",
        priority: 72,
      });
    const reorder = health.out.length + health.low.length;
    if (reorder)
      list.push({
        id: "reorder",
        module: "inventory",
        icon: ShoppingBag,
        tone: "bg-rose-50 text-rose-700",
        count: reorder,
        title: "products at or below reorder level",
        detail: `${health.out.length} out of stock`,
        href: "/inventory/reorder",
        priority: 68,
      });
    const expired = batches.filter((b) => b.availableQuantity > 0 && batchState(b) === "EXPIRED").length;
    if (expired)
      list.push({
        id: "expired",
        module: "inventory",
        icon: PackageX,
        tone: "bg-rose-50 text-rose-700",
        count: expired,
        title: `expired ${expired === 1 ? "batch" : "batches"} still on the shelf`,
        detail: "Quarantine and dispose",
        href: "/inventory/batches?view=EXPIRED",
        priority: 55,
      });
    return list.filter((t) => can(t.module)).sort((a, b) => b.priority - a.priority);
  }, [customers, orders, returns, riders, adjustments, batches, health, can]);

  const total = tasks.reduce((n, t) => n + t.count, 0);

  return (
    <ChartCard title="Needs attention" description={tasks.length ? `${total} items across ${tasks.length} queues` : "Nothing waiting on you"} bodyClassName="px-2 py-2 sm:px-3">
      {tasks.length ? (
        <ul className="space-y-0.5">
          {tasks.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.id}>
                <Link href={t.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
                  <span className={cn("rounded-lg p-2", t.tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-apptext-primary">
                      <span className="tabular-nums">{t.count}</span> {t.title}
                    </span>
                    <span className="block truncate text-xs text-apptext-secondary">{t.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-primary" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
          <p className="text-sm text-apptext-secondary">All queues are clear.</p>
        </div>
      )}
    </ChartCard>
  );
}
