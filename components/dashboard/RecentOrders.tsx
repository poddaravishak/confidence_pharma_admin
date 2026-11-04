"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { Order } from "@/lib/types";
import { ORDER_STATUS_META } from "@/lib/orders";
import { formatDateTime } from "@/lib/inventory";
import { Badge } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives";
import { taka } from "@/components/analytics/format";

/** Latest live orders from the store. */
export function RecentOrders({ orders, limit = 7 }: { orders: Order[]; limit?: number }) {
  const rows = useMemo(() => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit), [orders, limit]);

  return (
    <ChartCard title="Recent orders" description="Newest first, live" footerLink={{ href: "/orders", label: "All orders" }} bodyClassName="px-0 py-0 sm:px-0">
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-apptext-secondary">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((o) => {
            const meta = ORDER_STATUS_META[o.orderStatus];
            const delivered = o.items.reduce((n, l) => n + (l.deliveredQuantity ?? 0), 0);
            const ordered = o.items.reduce((n, l) => n + l.quantity, 0);
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface/70 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-brand-primary">{o.orderNumber}</span>
                      <Badge className={meta.badge}>{meta.label}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-apptext-primary">{o.customerName}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-apptext-secondary">
                      <span>{formatDateTime(o.createdAt)}</span>
                      {o.assignedRider && (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="size-3" aria-hidden />
                          {o.assignedRider.name}
                        </span>
                      )}
                      {o.orderStatus === "PARTIALLY_DELIVERED" && (
                        <span className="tabular-nums">
                          {delivered} of {ordered} packs accepted
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-apptext-primary">{taka(o.grandTotal)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
