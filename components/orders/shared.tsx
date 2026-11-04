"use client";

import React from "react";
import { Snowflake, Truck, Zap } from "lucide-react";
import { Order, OrderItem, OrderStatus, PaymentChannel } from "@/lib/types";
import { ORDER_STATUS_META, RETURN_REASON_META, acceptedQty } from "@/lib/orders";
import { plural } from "@/lib/inventory";
import { OPS_TODAY } from "@/lib/db/operations-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";

/** Demo "today" (seeded orders are anchored to this date). */
export const ORDERS_TODAY = OPS_TODAY;

/** YYYY-MM-DD in Dhaka time. */
export const dhakaDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

/* ------------------------------------------------------------------ */
/* Status groups (list filters)                                        */
/* ------------------------------------------------------------------ */

export type StatusGroup = "ALL" | "TO_CONFIRM" | "PROCESSING" | "READY" | "IN_TRANSIT" | "DELIVERED" | "PARTIAL" | "FAILED";

export const STATUS_GROUPS: { id: StatusGroup; label: string; statuses: OrderStatus[] }[] = [
  { id: "ALL", label: "All", statuses: [] },
  { id: "TO_CONFIRM", label: "To confirm", statuses: ["PLACED"] },
  { id: "PROCESSING", label: "Processing / packing", statuses: ["CONFIRMED", "PROCESSING"] },
  { id: "READY", label: "Ready to dispatch", statuses: ["PACKED"] },
  { id: "IN_TRANSIT", label: "In transit", statuses: ["DISPATCHED", "OUT_FOR_DELIVERY"] },
  { id: "DELIVERED", label: "Delivered", statuses: ["DELIVERED"] },
  { id: "PARTIAL", label: "Partial", statuses: ["PARTIALLY_DELIVERED"] },
  { id: "FAILED", label: "Failed / cancelled", statuses: ["FAILED_DELIVERY", "CANCELLED", "RETURNED"] },
];

export const inGroup = (o: Order, g: StatusGroup) =>
  g === "ALL" || (STATUS_GROUPS.find((x) => x.id === g)?.statuses.includes(o.orderStatus) ?? false);

/** Statuses before dispatch: the order can still be cancelled from the office. */
export const PRE_DISPATCH: OrderStatus[] = ["PLACED", "CONFIRMED", "PROCESSING", "PACKED"];

/** Next forward step an office user can take, with its button label. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  PLACED: { to: "CONFIRMED", label: "Confirm order" },
  CONFIRMED: { to: "PROCESSING", label: "Start processing" },
  PROCESSING: { to: "PACKED", label: "Mark packed" },
};

/* ------------------------------------------------------------------ */
/* Payment                                                             */
/* ------------------------------------------------------------------ */

export const PAYMENT_STATUS_META: Record<Order["paymentStatus"], { label: string; badge: string }> = {
  PENDING: { label: "Pending", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  PAID_COD: { label: "Paid", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PARTIALLY_PAID: { label: "Partly paid", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  DUE: { label: "Due", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const METHOD_LABEL: Record<string, string> = {
  CASH_ON_DELIVERY: "Cash on delivery",
  CASH: "Cash on delivery",
  BKASH: "bKash",
  NAGAD: "Nagad",
  BANK_TRANSFER: "Bank transfer",
  BANK: "Bank transfer",
};

export const isCreditMethod = (m: string) => m.startsWith("CREDIT");

export function paymentMethodLabel(m: string): string {
  if (METHOD_LABEL[m]) return METHOD_LABEL[m];
  const credit = /^CREDIT_(\d+)_DAYS$/.exec(m);
  if (credit) return `Credit ${credit[1]} days`;
  if (m === "CREDIT") return "Credit";
  return m
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Order.paymentMethod value stored for a payment channel picked at order entry. */
export function methodForChannel(ch: PaymentChannel, termsDays: number): string {
  switch (ch) {
    case "CASH":
      return "CASH_ON_DELIVERY";
    case "BANK":
      return "BANK_TRANSFER";
    case "CREDIT":
      return `CREDIT_${termsDays}_DAYS`;
    default:
      return ch;
  }
}

/* ------------------------------------------------------------------ */
/* Delivery type                                                       */
/* ------------------------------------------------------------------ */

export const DELIVERY_TYPE_META: Record<NonNullable<Order["deliveryType"]>, { label: string; hint: string; icon: React.ElementType }> = {
  STANDARD: { label: "Standard", hint: "Same-day before cut-off, otherwise next day", icon: Truck },
  EXPRESS: { label: "Express", hint: "Priority rider, 2–3 hours inside the zone", icon: Zap },
  COLD_CHAIN: { label: "Cold chain", hint: "Insulated box with ice packs, 2–8 °C", icon: Snowflake },
};

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const m = ORDER_STATUS_META[status];
  return (
    <Badge className={cn(m.badge, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: Order["paymentStatus"] }) {
  const m = PAYMENT_STATUS_META[status];
  return <Badge className={m.badge}>{m.label}</Badge>;
}

export function DeliveryTypeTag({ type }: { type?: Order["deliveryType"] }) {
  if (!type || type === "STANDARD") return null;
  const m = DELIVERY_TYPE_META[type];
  const Icon = m.icon;
  return (
    <Badge className={type === "COLD_CHAIN" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
      <Icon className="size-3" aria-hidden />
      {m.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Line helpers                                                        */
/* ------------------------------------------------------------------ */

/** "Box" from "1 Box (240 Tablets)". */
export function packUnitOf(line: Pick<OrderItem, "packSizeName">): string {
  const m = /^1\s+([^(]+?)(\s*\(|$)/.exec(line.packSizeName);
  return m ? m[1].trim() : "pack";
}

export const packs = (n: number, unit: string) => `${n.toLocaleString("en-US")} ${plural(unit, n)}`;

/** "8 of 10 delivered · 2 returned — Ordered too many" (null before delivery). */
export function deliveryLineText(line: OrderItem): string | null {
  if (line.deliveredQuantity === undefined) return null;
  const parts = [`${line.deliveredQuantity} of ${line.quantity} delivered`];
  if ((line.returnedQuantity ?? 0) > 0) {
    parts.push(
      `${line.returnedQuantity} returned${line.returnReason ? ` — ${RETURN_REASON_META[line.returnReason].label}` : ""}`
    );
  }
  return parts.join(" · ");
}

/** "2 Boxes, 1 Carton" returned at the door. */
export function returnedSummary(items: OrderItem[]): string {
  const byUnit = new Map<string, number>();
  for (const l of items) {
    const r = l.returnedQuantity ?? 0;
    if (r <= 0) continue;
    const u = packUnitOf(l);
    byUnit.set(u, (byUnit.get(u) ?? 0) + r);
  }
  return Array.from(byUnit.entries())
    .map(([u, n]) => packs(n, u))
    .join(", ");
}

/** Billed value of a line after delivery (net pack price × accepted packs). */
export function billedLineTotal(line: OrderItem): number {
  const acc = acceptedQty(line);
  if (acc === line.quantity) return line.lineTotal;
  return Math.round(line.unitPrice * (1 - line.discountPct / 100) * acc * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportOrdersCsv(orders: Order[]) {
  const rows: (string | number | undefined)[][] = [
    [
      "Order no.",
      "Created",
      "Customer",
      "Customer type",
      "Phone",
      "Items",
      "Status",
      "Payment method",
      "Payment status",
      "Original total",
      "Grand total",
      "Paid",
      "Due",
      "Rider",
      "Delivery type",
    ],
    ...orders.map((o) => [
      o.orderNumber,
      o.createdAt,
      o.customerName,
      o.customerType,
      o.phone,
      o.items.length,
      ORDER_STATUS_META[o.orderStatus].label,
      paymentMethodLabel(o.paymentMethod),
      PAYMENT_STATUS_META[o.paymentStatus].label,
      o.originalGrandTotal ?? "",
      o.grandTotal,
      o.paidAmount,
      o.dueAmount,
      o.assignedRider?.name ?? "",
      o.deliveryType ?? "STANDARD",
    ]),
  ];
  downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export const customerTypeLabel = (t: string) =>
  t
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
