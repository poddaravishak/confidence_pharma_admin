"use client";

import React from "react";
import { Printer } from "lucide-react";
import { DeliveryRun, Order } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { amountToCollect } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { btn, Modal } from "@/components/ui";

function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
      {[left, right].map((t) => (
        <div key={t}>
          <div className="h-10 border-b border-dashed border-slate-300" />
          <p className="mt-2 font-medium text-slate-700">{t}</p>
        </div>
      ))}
    </div>
  );
}

function CompanyBlock({ title, number }: { title: string; number: string }) {
  const { settings } = useAppStore();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/confidence-pharma-logo.jpg" alt="" className="h-9 w-auto" />
        <p className="mt-1 text-xs text-apptext-secondary">{settings.company.address}</p>
        <p className="text-xs text-apptext-secondary">Drug licence {settings.company.drugLicenseNo}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-primary">{title}</p>
        <p className="font-mono text-xs text-apptext-secondary">{number}</p>
      </div>
    </div>
  );
}

export function ChallanModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { batchById } = useInventory();
  return (
    <Modal
      size="lg"
      title={`Delivery challan ${order.deliveryChallanNumber ?? "(draft)"}`}
      subtitle={`${order.orderNumber} · ${order.customerName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Close
          </button>
          <button onClick={() => window.print()} className={btn.primary}>
            <Printer className="size-4" aria-hidden /> Print challan
          </button>
        </>
      }
    >
      <div className="print-area space-y-4 bg-white">
        <CompanyBlock title="Delivery challan" number={order.deliveryChallanNumber ?? order.orderNumber} />
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-apptext-secondary">Deliver to</p>
            <p className="font-semibold text-apptext-primary">{order.customerName}</p>
            <p className="text-apptext-secondary">{order.address}</p>
            <p className="text-apptext-secondary">{order.phone}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-apptext-secondary">Dispatch</p>
            <p className="text-apptext-primary">Rider: {order.assignedRider?.name ?? "Not assigned"}</p>
            <p className="text-apptext-secondary">{order.assignedRider?.vehiclePlateNo}</p>
            {order.dispatchedAt && <p className="text-apptext-secondary">{formatDateTime(order.dispatchedAt)}</p>}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-200 bg-surface text-xs text-apptext-secondary">
            <tr>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Batch / expiry</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-2">
                  <p className="font-medium text-apptext-primary">{l.productName}</p>
                  <p className="text-xs text-apptext-secondary">{l.packSizeName}</p>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-apptext-secondary">
                  {(l.batchAllocations ?? []).map((a) => batchById[a.batchId]).filter(Boolean).map((b) => `${b!.batchNumber} (${b!.expiryDate.slice(0, 7)})`).join(", ") || "—"}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{l.quantity}</td>
                <td className="px-2 py-2 text-right">
                  <span className="inline-block h-5 w-10 border-b border-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 text-sm">
            <tr>
              <td colSpan={3} className="px-2 py-2 text-apptext-secondary">
                Amount to collect ({order.paymentMethod.replace(/_/g, " ").toLowerCase()})
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(amountToCollect(order))}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-xs text-apptext-secondary">
          If the customer keeps fewer packs, write the quantity received in the last column. Goods not accepted go back with the rider.
        </p>
        <Signatures left="Rider signature" right="Customer seal & signature" />
      </div>
    </Modal>
  );
}

export function LoadSheetModal({ run, onClose }: { run: DeliveryRun; onClose: () => void }) {
  const { orderById, riderById } = useAppStore();
  const { batchById } = useInventory();
  const rider = riderById[run.riderId];
  const orders = run.orderIds.map((id) => orderById[id]).filter(Boolean);
  const cash = orders.reduce((s, o) => s + (o.paymentMethod.includes("CREDIT") ? 0 : amountToCollect(o)), 0);

  return (
    <Modal
      size="xl"
      title={`Load sheet ${run.runNumber}`}
      subtitle={`${rider?.name} · ${orders.length} stop(s)`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Close
          </button>
          <button onClick={() => window.print()} className={btn.primary}>
            <Printer className="size-4" aria-hidden /> Print load sheet
          </button>
        </>
      }
    >
      <div className="print-area space-y-4 bg-white">
        <CompanyBlock title="Rider load sheet" number={run.runNumber} />
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <p>
            Rider: <span className="font-semibold">{rider?.name}</span> ({rider?.employeeCode}) · {rider?.vehiclePlateNo}
          </p>
          <p>
            Created {formatDateTime(run.createdAt)} by {run.createdBy}
          </p>
        </div>
        {orders.map((o, i) => (
          <div key={o.id} className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-surface px-3 py-2 text-sm">
              <p className="font-semibold text-apptext-primary">
                Stop {i + 1} · {o.customerName}
              </p>
              <p className="font-mono text-xs text-apptext-secondary">{o.orderNumber}</p>
            </div>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {o.items.map((l) => (
                  <tr key={l.id}>
                    <td className="w-8 px-3 py-1.5">
                      <span className="inline-block size-4 rounded border border-slate-300" />
                    </td>
                    <td className="px-2 py-1.5">{l.productName}</td>
                    <td className="px-2 py-1.5 text-xs text-apptext-secondary">{l.packSizeName}</td>
                    <td className="px-2 py-1.5 font-mono text-xs text-apptext-secondary">
                      {(l.batchAllocations ?? []).map((a) => batchById[a.batchId]?.batchNumber).filter(Boolean).join(", ")}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{l.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-right text-sm">
          Cash to collect on this run: <span className="font-bold tabular-nums">{formatCurrency(cash)}</span>
        </p>
        <Signatures left="Store keeper (loaded)" right="Rider (received load)" />
      </div>
    </Modal>
  );
}
