"use client";

import React from "react";
import Link from "next/link";
import { InventoryBatch } from "@/lib/types";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";

interface StockAlertsProps {
  batches: InventoryBatch[];
}

export const StockAlerts: React.FC<StockAlertsProps> = ({ batches }) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-primary">Urgent FEFO & Stock Alerts</h2>
            <p className="text-xs text-apptext-secondary">First-Expiry, First-Out alerts</p>
          </div>
        </div>
        <Link
          href="/inventory"
          className="text-xs font-bold text-brand-blue hover:text-brand-primary flex items-center gap-1 transition"
        >
          <span>Batch Matrix</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {batches.map((batch) => {
          const isNearExpiry = batch.status === "NEAR_EXPIRY";
          return (
            <div
              key={batch.id}
              className={`flex items-start justify-between rounded-xl border p-3 ${
                isNearExpiry
                  ? "border-amber-200 bg-amber-50/40"
                  : "border-slate-200 bg-surface/50"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-apptext-primary">{batch.productName}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-apptext-secondary">
                  <span className="font-mono font-bold text-brand-primary">Batch: {batch.batchNumber}</span>
                  <span>•</span>
                  <span>Stock: {batch.availableQuantity} units</span>
                </div>
              </div>

              <div className="text-right">
                {isNearExpiry ? (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Exp in {batch.daysUntilExpiry} days</span>
                  </div>
                ) : (
                  <span className="inline-block rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    Low Stock
                  </span>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Exp: {batch.expiryDate}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
