"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, CircleSlash, PackageCheck, RotateCcw, XCircle } from "lucide-react";
import { Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_META } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/analytics/primitives";
import { takaCompact } from "@/components/analytics/format";

const OPEN_STAGES: OrderStatus[] = ["PLACED", "CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY"];

const OUTCOMES: { status: OrderStatus; icon: React.ElementType; tone: string }[] = [
  { status: "DELIVERED", icon: CheckCircle2, tone: "text-emerald-700" },
  { status: "PARTIALLY_DELIVERED", icon: PackageCheck, tone: "text-teal-700" },
  { status: "FAILED_DELIVERY", icon: XCircle, tone: "text-rose-700" },
  { status: "RETURNED", icon: RotateCcw, tone: "text-rose-700" },
  { status: "CANCELLED", icon: CircleSlash, tone: "text-slate-500" },
];

/** Order list filter group for each status (see /orders). */
const ORDER_GROUP: Record<OrderStatus, string> = {
  PLACED: "TO_CONFIRM",
  CONFIRMED: "PROCESSING",
  PROCESSING: "PROCESSING",
  PACKED: "READY",
  DISPATCHED: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  PARTIALLY_DELIVERED: "PARTIAL",
  FAILED_DELIVERY: "FAILED",
  CANCELLED: "FAILED",
  RETURNED: "FAILED",
};

/** Live order pipeline: open stages as a funnel, closed outcomes as counts. */
export function OrdersPipeline({ orders }: { orders: Order[] }) {
  const stats = useMemo(() => {
    const count = {} as Record<OrderStatus, number>;
    const value = {} as Record<OrderStatus, number>;
    for (const o of orders) {
      count[o.orderStatus] = (count[o.orderStatus] ?? 0) + 1;
      value[o.orderStatus] = (value[o.orderStatus] ?? 0) + o.grandTotal;
    }
    const open = OPEN_STAGES.reduce((n, s) => n + (count[s] ?? 0), 0);
    const openValue = OPEN_STAGES.reduce((n, s) => n + (value[s] ?? 0), 0);
    const max = Math.max(1, ...OPEN_STAGES.map((s) => count[s] ?? 0));
    const attempted = (count.DELIVERED ?? 0) + (count.PARTIALLY_DELIVERED ?? 0) + (count.FAILED_DELIVERY ?? 0);
    const fulfilled = (count.DELIVERED ?? 0) + (count.PARTIALLY_DELIVERED ?? 0);
    return { count, value, open, openValue, max, attempted, fulfilled };
  }, [orders]);

  return (
    <ChartCard
      title="Order pipeline"
      description={`${stats.open} open orders worth ${takaCompact(stats.openValue)}`}
      footerLink={{ href: "/orders", label: "Manage orders" }}
    >
      <ol className="space-y-2" aria-label="Open orders by stage">
        {OPEN_STAGES.map((s) => {
          const n = stats.count[s] ?? 0;
          return (
            <li key={s}>
              <Link
                href={`/orders?status=${ORDER_GROUP[s]}`}
                className="group grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                title={`${ORDER_STATUS_META[s].label}: ${n} orders, ${takaCompact(stats.value[s] ?? 0)}`}
              >
                <span className="truncate text-apptext-secondary group-hover:text-apptext-primary">{ORDER_STATUS_META[s].label}</span>
                <span className="h-2 rounded-full bg-slate-100">
                  <span
                    className="block h-2 rounded-full bg-[#1752B8] transition group-hover:brightness-110"
                    style={{ width: n ? `${Math.max(4, (n / stats.max) * 100)}%` : 0 }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums text-apptext-primary">{n}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-medium text-apptext-secondary">
          Closed orders · {stats.attempted ? Math.round((stats.fulfilled / stats.attempted) * 100) : 0}% of delivery attempts fulfilled
        </p>
        <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {OUTCOMES.map(({ status, icon: Icon, tone }) => (
            <li key={status}>
              <Link
                href={`/orders?status=${ORDER_GROUP[status]}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs transition hover:bg-surface"
              >
                <Icon className={cn("size-3.5 shrink-0", tone)} aria-hidden />
                <span className="truncate text-apptext-secondary">{ORDER_STATUS_META[status].label}</span>
                <span className="ml-auto font-semibold tabular-nums text-apptext-primary">{stats.count[status] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
