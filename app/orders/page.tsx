"use client";

import React, { useState } from "react";
import Link from "next/link";
import { mockOrders } from "@/lib/db/mock-data";
import { Order, OrderStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  ShoppingCart, 
  MapPin, 
  Printer, 
  Receipt, 
  FileText, 
  CheckCircle, 
  Clock, 
  X,
  Truck,
  ExternalLink,
  Snowflake,
  Zap,
  Navigation
} from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, orderStatus: newStatus } : null));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl">
            Order Fulfillment & Delivery Invoicing
          </h1>
          <p className="text-xs text-apptext-secondary">
            B2B order processing, rider assignment links, and dual-format printing (SRS §12, §14 & §36)
          </p>
        </div>

        <Link
          href="/delivery"
          className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
        >
          <Truck className="h-4 w-4 text-brand-light" />
          <span>Open Fleet Dispatch Board</span>
        </Link>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface border-b border-slate-200 text-apptext-secondary font-semibold uppercase text-[11px]">
            <tr>
              <th className="py-3 px-4">Order ID & Date</th>
              <th className="py-3 px-4">Pharmacy & Address</th>
              <th className="py-3 px-4">Delivery & Rider</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Total Payable</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((ord) => (
              <tr key={ord.id} className="hover:bg-surface/70 transition">
                <td className="py-3.5 px-4 font-mono">
                  <p className="font-bold text-brand-primary">{ord.orderNumber}</p>
                  <p className="text-[10px] text-apptext-secondary font-sans">
                    {formatDate(ord.createdAt)}
                  </p>
                </td>
                <td className="py-3.5 px-4">
                  <p className="font-bold text-apptext-primary">{ord.customerName}</p>
                  <p className="text-[11px] text-apptext-secondary flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-brand-blue" />
                    {ord.address}
                  </p>
                </td>
                <td className="py-3.5 px-4">
                  {ord.assignedRider ? (
                    <div>
                      <p className="font-bold text-brand-primary flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 text-brand-green" />
                        {ord.assignedRider.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">{ord.assignedRider.phone}</p>
                    </div>
                  ) : (
                    <span className="text-amber-700 font-semibold text-[11px]">Pending Rider</span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                      ord.orderStatus === "DELIVERED"
                        ? "bg-emerald-50 text-brand-green border-emerald-200"
                        : ord.orderStatus === "OUT_FOR_DELIVERY"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-brand-blue border-blue-200"
                    }`}
                  >
                    {ord.orderStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <p className="font-black text-brand-primary font-mono">{formatCurrency(ord.grandTotal)}</p>
                  <p className="text-[10px] text-apptext-secondary">COD: {ord.paymentStatus}</p>
                </td>
                <td className="py-3.5 px-4 text-right space-x-2">
                  <button
                    onClick={() => setSelectedOrder(ord)}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-surface px-3 py-1.5 text-xs font-bold text-brand-primary transition"
                  >
                    Inspect & Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Detail & Invoice Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-blue">
                  CONFIDENCE PHARMA • ORDER FULFILLMENT
                </span>
                <h3 className="text-base font-bold text-brand-primary">
                  Order Details: {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-apptext-secondary">
                  Consignee: {selectedOrder.customerName} • Phone: {selectedOrder.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status Update Pipeline */}
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Fulfillment Status Pipeline (SRS §12)
              </p>
              <div className="flex flex-wrap gap-2">
                {(["PLACED", "CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"] as OrderStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => updateOrderStatus(selectedOrder.id, st)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        selectedOrder.orderStatus === st
                          ? "bg-brand-primary text-white shadow-xs"
                          : "border border-slate-200 bg-white text-apptext-secondary hover:bg-surface"
                      }`}
                    >
                      {st.replace(/_/g, " ")}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Purchased Medicines & Applied Quantity Pricing
              </p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Medicine & Pack Size</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Tier Rate</th>
                      <th className="p-3">Discount</th>
                      <th className="p-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-bold text-apptext-primary">
                          {it.productName}
                          <span className="block text-[11px] text-apptext-secondary font-normal">
                            {it.packSizeName}
                          </span>
                        </td>
                        <td className="p-3 font-bold font-mono">{it.quantity}</td>
                        <td className="p-3 font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-3 text-brand-green font-bold">
                          {it.discountPct > 0 ? `${it.discountPct}%` : "—"}
                        </td>
                        <td className="p-3 text-right font-black text-brand-primary font-mono">
                          {formatCurrency(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Charge Rule & Totals */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 rounded-xl bg-surface p-4 text-xs">
              <div>
                <p className="font-bold text-brand-primary">Delivery Charge Details:</p>
                <p className="text-apptext-secondary mt-0.5">
                  Rule: {selectedOrder.deliveryRuleName || "Dhaka Metro Core (Zone 1)"}
                </p>
                <p className="text-apptext-secondary">
                  Delivery Fee: <strong className="text-slate-800">{formatCurrency(selectedOrder.deliveryCharge)}</strong>
                </p>
              </div>

              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-apptext-secondary">
                  <span>Subtotal:</span>
                  <span className="font-bold font-mono">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-brand-green font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono">- {formatCurrency(selectedOrder.discount)}</span>
                </div>
                <div className="flex justify-between text-apptext-secondary">
                  <span>Delivery Charge:</span>
                  <span className="font-mono">{formatCurrency(selectedOrder.deliveryCharge)}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-black text-brand-primary">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base">{formatCurrency(selectedOrder.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Print Invoicing Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => alert(`Printing Official A4 Tax Invoice for ${selectedOrder.orderNumber}`)}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-primary bg-white px-3.5 py-2 text-xs font-bold text-brand-primary shadow-xs hover:bg-brand-light/30 transition"
                >
                  <FileText className="h-4 w-4 text-brand-blue" />
                  <span>Print A4 Invoice</span>
                </button>
                <button
                  onClick={() => alert(`Printing 80mm POS Thermal Receipt for Rider dispatch (${selectedOrder.orderNumber})`)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-surface transition"
                >
                  <Receipt className="h-4 w-4 text-brand-green" />
                  <span>80mm Thermal Receipt</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-brand-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
