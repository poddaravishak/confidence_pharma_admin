"use client";

import React from "react";
import Link from "next/link";
import { Order } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowUpRight, Truck, MapPin } from "lucide-react";

interface RecentOrdersProps {
  orders: Order[];
}

export const RecentOrders: React.FC<RecentOrdersProps> = ({ orders }) => {
  const getStatusBadge = (status: Order["orderStatus"]) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-50 text-brand-green border-emerald-200";
      case "OUT_FOR_DELIVERY":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "PROCESSING":
      case "DISPATCHED":
        return "bg-blue-50 text-brand-blue border-blue-200";
      case "PACKED":
      case "PLACED":
        return "bg-brand-light/60 text-brand-primary border-brand-blue/30";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-brand-primary">Live Orders & Delivery Dispatch</h2>
          <p className="text-xs text-apptext-secondary">Recent orders and delivery tracking</p>
        </div>
        <Link
          href="/delivery"
          className="flex items-center gap-1 text-xs font-bold text-brand-blue hover:text-brand-primary transition"
        >
          <span>Delivery Board</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 divide-y divide-slate-100 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-apptext-secondary font-semibold uppercase text-[11px]">
              <th className="pb-3 font-semibold">Order No</th>
              <th className="pb-3 font-semibold">Pharmacy / Consignee</th>
              <th className="pb-3 font-semibold">Delivery & Rider</th>
              <th className="pb-3 font-semibold">Fulfillment</th>
              <th className="pb-3 font-semibold text-right">Grand Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((ord) => (
              <tr key={ord.id} className="hover:bg-surface/80 transition">
                <td className="py-3.5 font-mono font-bold text-brand-primary">
                  {ord.orderNumber}
                </td>
                <td className="py-3.5">
                  <p className="font-bold text-apptext-primary">{ord.customerName}</p>
                  <p className="text-[11px] text-apptext-secondary flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-brand-blue" />
                    {ord.address}
                  </p>
                </td>
                <td className="py-3.5">
                  {ord.assignedRider ? (
                    <span className="flex items-center gap-1 font-semibold text-brand-primary text-[11px]">
                      <Truck className="h-3 w-3 text-brand-green" />
                      {ord.assignedRider.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Pending Rider</span>
                  )}
                </td>
                <td className="py-3.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${getStatusBadge(
                      ord.orderStatus
                    )}`}
                  >
                    {ord.orderStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3.5 text-right font-black text-brand-primary font-mono">
                  {formatCurrency(ord.grandTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
