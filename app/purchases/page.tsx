"use client";

import React, { useState } from "react";
import { mockSuppliers, mockProducts } from "@/lib/db/mock-data";
import { formatCurrency } from "@/lib/utils";
import { 
  FileText, 
  Camera, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2,
  CheckCircle2,
  X
} from "lucide-react";

interface PurchaseRow {
  id: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  rate: number;
  isOcr?: boolean;
}

export default function PurchasesPage() {
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(mockSuppliers[0].id);
  const [invoiceNo, setInvoiceNo] = useState("INV-2026-0041");
  const [purchaseDate, setPurchaseDate] = useState("2026-11-03");

  const [items, setItems] = useState<PurchaseRow[]>([
    {
      id: "1",
      productName: "Napa Extra 500+65mg",
      packSize: "1 Box (20 Strips)",
      batchNo: "BEX-NX-2601",
      expiryDate: "2028-05-30",
      quantity: 50,
      rate: 528.0,
      isOcr: false,
    },
  ]);

  const simulateOCR = () => {
    setOcrScanning(true);
    setTimeout(() => {
      setOcrScanning(false);
      setOcrSuccess(true);
      setInvoiceNo("BEX-89012");
      // Add OCR extracted rows
      setItems((prev) => [
        ...prev,
        {
          id: `ocr-${Date.now()}`,
          productName: "Monas 10mg Tablet",
          packSize: "1 Box (3 Strips)",
          batchNo: "INP-MN-9921",
          expiryDate: "2027-11-15",
          quantity: 30,
          rate: 380.0,
          isOcr: true,
        },
      ]);
    }, 1500);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        productName: "Seclo 20mg Capsule",
        packSize: "1 Box (10 Strips)",
        batchNo: `SQ-B-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate: "2027-08-30",
        quantity: 20,
        rate: 420.0,
        isOcr: false,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  const grandTotal = items.reduce((sum, it) => sum + it.quantity * it.rate, 0);

  const handleSavePurchase = () => {
    setSuccessBanner(
      `Purchase invoice ${invoiceNo} for ${formatCurrency(
        grandTotal
      )} saved! Warehouse stock automatically incremented by ${items.reduce(
        (sum, it) => sum + it.quantity,
        0
      )} boxes.`
    );
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
            Purchase Management & Assisted OCR Scanner
          </h1>
          <p className="text-xs text-apptext-secondary text-pretty">
            Supplier procurement entry with camera/PDF OCR assisted line extraction (SRS §19 & §20)
          </p>
        </div>

        <button
          onClick={simulateOCR}
          disabled={ocrScanning}
          className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-600 disabled:opacity-50 transition"
        >
          <Camera className="size-4" />
          <span>{ocrScanning ? "Scanning Invoice via OCR..." : "Scan Paper Invoice (OCR)"}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-brand-green">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-green" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* OCR Scanner Feedback Card */}
      {ocrSuccess && (
        <div className="rounded-2xl border border-brand-blue/30 bg-brand-light/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-light p-2 text-brand-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-brand-primary">
                Assisted OCR Extracted Data from Supplier Challan #BEX-89012
              </h4>
              <p className="text-[11px] text-apptext-secondary mt-0.5">
                Lines automatically populated below. Review and edit values before committing to inventory.
              </p>
            </div>
            <button
              onClick={() => setOcrSuccess(false)}
              className="text-xs font-bold text-brand-blue hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Purchase Entry Form */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          New Purchase Invoice Header
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-apptext-primary mb-1">Select Supplier Depot:</label>
            <select 
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-apptext-primary"
            >
              {mockSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName} ({s.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-apptext-primary mb-1">Invoice / Challan Number:</label>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-brand-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-apptext-primary mb-1">Purchase Date:</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-apptext-primary"
            />
          </div>
        </div>

        {/* Purchase Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Purchased Medicine Items & Batches
            </h3>
            <button 
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-xs font-bold text-brand-blue hover:text-brand-primary transition"
            >
              <Plus className="size-3.5" />
              <span>Add Another Item</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-slate-200 text-apptext-secondary font-semibold uppercase text-[11px]">
                <tr>
                  <th className="p-3">Medicine Description</th>
                  <th className="p-3">Batch No</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Rate (৳)</th>
                  <th className="p-3 text-right">Line Total</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => (
                  <tr key={it.id} className={it.isOcr ? "bg-brand-light/20" : ""}>
                    <td className="p-3 font-bold text-apptext-primary">
                      {it.productName}
                      <span className="block text-[11px] text-apptext-secondary font-normal">
                        {it.packSize} {it.isOcr && "• ★ OCR Extracted"}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-brand-primary">{it.batchNo}</td>
                    <td className="p-3 font-semibold text-slate-700">{it.expiryDate}</td>
                    <td className="p-3 font-bold font-mono tabular-nums">{it.quantity} Boxes</td>
                    <td className="p-3 font-mono tabular-nums">৳{it.rate}</td>
                    <td className="p-3 text-right font-black text-brand-primary font-mono tabular-nums">
                      {formatCurrency(it.quantity * it.rate)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(it.id)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Grand Total */}
        <div className="flex justify-end pt-2">
          <div className="rounded-xl bg-surface p-4 w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-apptext-secondary">
              <span>Items Total:</span>
              <span className="font-mono tabular-nums">{items.length} Lines</span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-black text-brand-primary">
              <span>Total Invoice Cost:</span>
              <span className="font-mono text-base tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={handleSavePurchase}
            className="rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
          >
            Save Purchase & Auto-Increment Warehouse Stock
          </button>
        </div>
      </div>
    </div>
  );
}
