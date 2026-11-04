"use client";

import React, { useState } from "react";
import { mockSuppliers, mockProducts } from "@/lib/db/mock-data";
import { Supplier } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { 
  Building2, 
  FileSpreadsheet, 
  Share2, 
  Plus, 
  Phone, 
  MapPin, 
  X, 
  Printer, 
  CheckCircle2 
} from "lucide-react";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderSheetSupplier, setOrderSheetSupplier] = useState<Supplier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Supplier Form
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const lowStockItems = mockProducts.filter((p) => p.totalStockUnits <= p.reorderLevel);

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !phone.trim()) return;

    const newSup: Supplier = {
      id: `sup-${Date.now().toString().slice(-4)}`,
      name: `${companyName} Depot`,
      companyName,
      contactPerson,
      phone,
      address,
      currentPayable: 0,
      totalPurchased: 0,
    };

    setSuppliers((prev) => [newSup, ...prev]);
    setShowAddModal(false);
    setSuccessMessage(`Supplier "${companyName}" added successfully!`);
    setTimeout(() => setSuccessMessage(null), 4000);

    setCompanyName("");
    setContactPerson("");
    setPhone("");
    setAddress("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
            Supplier Management & Payables
          </h1>
          <p className="text-xs text-apptext-secondary text-pretty">
            Pharmaceutical company depot profiles, payable balances, and automated re-order sheets (SRS §21 & §22)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
        >
          <Plus className="size-4 text-brand-light" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-brand-green">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-green" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {suppliers.map((sup) => (
          <div
            key={sup.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-primary">{sup.companyName}</h3>
                  <p className="text-xs text-apptext-secondary">{sup.contactPerson}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs text-apptext-secondary">
              <p className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-brand-blue" />
                <span className="font-mono">{sup.phone}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-slate-400" />
                <span>{sup.address}</span>
              </p>
            </div>

            <div className="rounded-xl bg-surface p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-apptext-secondary">Total Purchases:</span>
                <span className="font-bold text-apptext-primary font-mono tabular-nums">
                  {formatCurrency(sup.totalPurchased)}
                </span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-rose-600">Current Payable Due:</span>
                <span className="font-mono text-rose-700 tabular-nums">
                  {formatCurrency(sup.currentPayable)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setOrderSheetSupplier(sup)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-brand-primary hover:bg-surface transition"
              >
                <FileSpreadsheet className="size-3.5 text-brand-blue" />
                <span>Generate Order Sheet</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-brand-primary">Register New Supplier Depot</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-apptext-primary mb-1">Company / Manufacturer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACI Pharmaceuticals Ltd."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">Contact Person (ASM / Representative)</label>
                <input
                  type="text"
                  placeholder="e.g. Mizanur Rahman"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +8801711223344"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">Depot Address</label>
                <input
                  type="text"
                  placeholder="e.g. Tejgaon Industrial Area, Dhaka"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-primary px-5 py-2 font-bold text-white hover:bg-brand-hover shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE RE-ORDER SHEET MODAL */}
      {orderSheetSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-blue">
                  CONFIDENCE PHARMA • REORDER SHEET
                </span>
                <h3 className="text-base font-bold text-brand-primary">
                  Purchase Reorder Sheet: {orderSheetSupplier.companyName}
                </h3>
              </div>
              <button onClick={() => setOrderSheetSupplier(null)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl bg-surface p-4 text-xs space-y-1">
              <p className="font-bold text-brand-primary">Supplier Details:</p>
              <p className="text-apptext-secondary">Depot: {orderSheetSupplier.companyName} • Contact: {orderSheetSupplier.contactPerson}</p>
              <p className="text-apptext-secondary font-mono">Phone: {orderSheetSupplier.phone}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Automated Inventory Replenishment Requirements (Low Stock Items)
              </p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b border-slate-200 text-apptext-secondary font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Required Medicine</th>
                      <th className="p-3">Current Stock</th>
                      <th className="p-3">Reorder Threshold</th>
                      <th className="p-3 font-bold text-brand-primary">Recommended Order Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockItems.length > 0 ? (
                      lowStockItems.map((p) => (
                        <tr key={p.id}>
                          <td className="p-3 font-bold text-apptext-primary">
                            {p.nameEn}
                            <span className="block text-[10px] text-apptext-secondary font-normal">{p.genericName}</span>
                          </td>
                          <td className="p-3 font-mono text-rose-600 font-bold tabular-nums">
                            {p.totalStockUnits} {p.baseUnit}s
                          </td>
                          <td className="p-3 font-mono text-slate-500 tabular-nums">
                            {p.reorderLevel} {p.baseUnit}s
                          </td>
                          <td className="p-3 font-mono font-black text-brand-primary tabular-nums">
                            {(p.reorderLevel * 2 - p.totalStockUnits).toLocaleString()} {p.baseUnit}s (Replenish)
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          All products currently meet safety stock threshold.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                onClick={() => alert(`Printing official Purchase Order Sheet for ${orderSheetSupplier.companyName}`)}
                className="flex items-center gap-1.5 rounded-xl border border-brand-primary bg-white px-4 py-2 text-xs font-bold text-brand-primary hover:bg-brand-light/30 transition"
              >
                <Printer className="size-4" />
                <span>Print Order Sheet</span>
              </button>

              <button
                onClick={() => setOrderSheetSupplier(null)}
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
