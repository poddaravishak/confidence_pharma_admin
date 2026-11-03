"use client";

import React, { useState } from "react";
import { mockBatches, mockProducts } from "@/lib/db/mock-data";
import { InventoryBatch } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { 
  AlertTriangle, 
  Clock, 
  Layers, 
  SlidersHorizontal, 
  PackageCheck, 
  RotateCcw,
  Plus
} from "lucide-react";

export default function InventoryPage() {
  const [batches, setBatches] = useState<InventoryBatch[]>(mockBatches);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");

  const handleAdjustSubmit = () => {
    if (!selectedBatch || adjustQty === 0 || !adjustReason.trim()) return;

    setBatches((prev) =>
      prev.map((b) =>
        b.id === selectedBatch.id
          ? {
              ...b,
              availableQuantity: Math.max(0, b.availableQuantity + adjustQty),
            }
          : b
      )
    );

    alert(
      `Stock adjustment logged in Audit Log: ${adjustQty > 0 ? "+" : ""}${adjustQty} units for ${
        selectedBatch.productName
      }. Reason: ${adjustReason}`
    );
    setShowAdjustModal(false);
    setSelectedBatch(null);
    setAdjustQty(0);
    setAdjustReason("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Inventory & FEFO Batch Expiry Matrix
          </h1>
          <p className="text-xs text-slate-500">
            First-Expiry, First-Out (FEFO) dispensing logic and audit-logged stock adjustments (SRS §23 & §24)
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedBatch(batches[0]);
            setShowAdjustModal(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <span>Manual Stock Adjustment</span>
        </button>
      </div>

      {/* Stock Formula Banner (SRS §23) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
        <p className="font-extrabold uppercase tracking-wide text-[11px] text-emerald-800 mb-1">
          SRS Mathematical Stock Valuation Formula
        </p>
        <p className="font-mono text-emerald-700">
          Opening Stock + Purchases + Warehouse In + Customer Returns − Sales − Supplier Returns − Damaged/Expired − Adjustments = Current Stock
        </p>
      </div>

      {/* Batches Table (FEFO) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase">
            Active Warehouse Batches (FEFO Prioritized)
          </span>
          <span className="text-xs text-slate-500">
            Sorted by earliest expiry date first
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
            <tr>
              <th className="py-3 px-4">Medicine & Product</th>
              <th className="py-3 px-4">Batch Number</th>
              <th className="py-3 px-4">Expiry Date</th>
              <th className="py-3 px-4">Available Units</th>
              <th className="py-3 px-4">Unit Purchase Cost</th>
              <th className="py-3 px-4">FEFO Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((batch) => {
              const isUrgent = batch.status === "NEAR_EXPIRY";
              return (
                <tr
                  key={batch.id}
                  className={`hover:bg-slate-50 transition ${
                    isUrgent ? "bg-amber-50/30" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {batch.productName}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                    {batch.batchNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800">{batch.expiryDate}</span>
                    <span
                      className={`block text-[10px] font-bold ${
                        batch.daysUntilExpiry < 30
                          ? "text-rose-600"
                          : batch.daysUntilExpiry < 90
                          ? "text-amber-600"
                          : "text-slate-400"
                      }`}
                    >
                      {batch.daysUntilExpiry} days remaining
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900">
                    {batch.availableQuantity.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">
                    {formatCurrency(batch.unitPurchaseCost)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        batch.status === "NEAR_EXPIRY"
                          ? "bg-amber-100 text-amber-800"
                          : batch.status === "LOW_STOCK"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {batch.status === "NEAR_EXPIRY" && <Clock className="h-3 w-3" />}
                      {batch.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedBatch(batch);
                        setShowAdjustModal(true);
                      }}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Audit-Logged Stock Adjustment (SRS §25)
            </h3>
            <p className="text-xs text-slate-500">
              Adjusting: <strong>{selectedBatch.productName}</strong> (Batch: {selectedBatch.batchNumber})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity Delta (+ for arrival/found, - for damaged/disposed):
              </label>
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Current: {selectedBatch.availableQuantity} $\rightarrow$ New:{" "}
                {Math.max(0, selectedBatch.availableQuantity + adjustQty)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Reason for Stock Adjustment:
              </label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Broken vial during warehouse handling / Supplier carton miscount..."
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={adjustQty === 0 || !adjustReason.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                Commit Adjustment to Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

