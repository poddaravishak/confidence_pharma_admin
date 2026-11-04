"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Printer, Receipt, Truck } from "lucide-react";
import { AppSettings, Customer, Order, OrderItem, StockBatch } from "@/lib/types";
import { acceptedQty, amountToCollect, netPackPrice } from "@/lib/orders";
import { formatDay } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal, Tabs, btn } from "@/components/ui";
import { DELIVERY_TYPE_META, billedLineTotal, customerTypeLabel, paymentMethodLabel, returnedSummary } from "./shared";

export type PrintKind = "A4" | "THERMAL" | "CHALLAN";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface DocProps {
  order: Order;
  settings: AppSettings;
  batchById: Record<string, StockBatch>;
  customer?: Customer;
}

const monthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function batchText(line: OrderItem, batchById: Record<string, StockBatch>): string | null {
  if (!line.batchAllocations?.length) return null;
  return line.batchAllocations
    .map((a) => {
      const b = batchById[a.batchId];
      return b ? `${b.batchNumber} (exp ${monthYear(b.expiryDate)})` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export const invoiceNumber = (o: Order, s: AppSettings) =>
  o.orderNumber.startsWith(s.invoice.orderPrefix) ? s.invoice.invoicePrefix + o.orderNumber.slice(s.invoice.orderPrefix.length) : `INV-${o.orderNumber}`;

export const challanNumber = (o: Order, s: AppSettings) =>
  o.deliveryChallanNumber ??
  (o.orderNumber.startsWith(s.invoice.orderPrefix) ? s.invoice.challanPrefix + o.orderNumber.slice(s.invoice.orderPrefix.length) : `CHAL-${o.orderNumber}`);

/** Billed figures: delivered quantities after a partial delivery, ordered quantities otherwise. */
function billedTotals(o: Order) {
  const gross = round2(o.items.reduce((s, l) => s + l.unitPrice * acceptedQty(l), 0));
  const net = round2(o.items.reduce((s, l) => s + billedLineTotal(l), 0));
  const delivery = o.orderStatus === "FAILED_DELIVERY" ? 0 : o.deliveryCharge;
  return { gross, discount: round2(gross - net), delivery, total: o.grandTotal };
}

function vatIncluded(total: number, s: AppSettings) {
  if (!s.tax.vatEnabled || !s.tax.pricesIncludeVat) return null;
  return round2((total * s.tax.vatPct) / (100 + s.tax.vatPct));
}

/* ------------------------------------------------------------------ */
/* A4 tax invoice                                                      */
/* ------------------------------------------------------------------ */

function CompanyBlock({ s }: { s: AppSettings }) {
  const c = s.company;
  return (
    <div>
      <p className="text-xl font-bold text-brand-primary">{c.tradeName}</p>
      <p className="text-xs font-medium text-slate-700">{c.legalName}</p>
      <p className="mt-1 text-xs text-slate-600">{c.address}</p>
      <p className="text-xs text-slate-600">
        {c.phone} · {c.email}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Drug licence {c.drugLicenseNo} · Trade licence {c.tradeLicenseNo}
      </p>
      <p className="text-[11px] text-slate-500">
        BIN {c.binNo} · TIN {c.tinNo}
      </p>
    </div>
  );
}

function InvoiceA4({ order: o, settings: s, batchById, customer }: DocProps) {
  const t = billedTotals(o);
  const revised = o.originalGrandTotal !== undefined;
  const vat = vatIncluded(t.total, s);
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-6 text-slate-800 sm:p-8">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-brand-primary pb-4 sm:flex-row">
        <CompanyBlock s={s} />
        <div className="text-left sm:text-right">
          <p className="text-lg font-bold uppercase tracking-wide text-brand-primary">Tax invoice</p>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs sm:justify-end">
            <dt className="text-slate-500">Invoice no.</dt>
            <dd className="font-mono font-semibold">{invoiceNumber(o, s)}</dd>
            <dt className="text-slate-500">Order no.</dt>
            <dd className="font-mono">{o.orderNumber}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd className="tabular-nums">{formatDay(o.deliveredAt ?? o.createdAt)}</dd>
            {o.deliveryChallanNumber && (
              <>
                <dt className="text-slate-500">Challan no.</dt>
                <dd className="font-mono">{o.deliveryChallanNumber}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {o.orderStatus === "CANCELLED" && (
        <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-center text-sm font-semibold text-rose-700">
          Cancelled order — not a valid tax invoice
        </p>
      )}

      <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
        <div>
          <p className="font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
          <p className="mt-1 text-sm font-semibold">{o.customerName}</p>
          <p className="text-slate-600">
            {customerTypeLabel(o.customerType)}
            {customer?.ownerName ? ` · ${customer.ownerName}` : ""}
          </p>
          <p className="text-slate-600">{o.address}</p>
          {o.landmark && <p className="text-slate-500">Landmark: {o.landmark}</p>}
          <p className="tabular-nums text-slate-600">{o.phone}</p>
        </div>
        <div className="sm:text-right">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Delivery & payment</p>
          <p className="mt-1">{DELIVERY_TYPE_META[o.deliveryType ?? "STANDARD"].label} delivery</p>
          <p>Payment: {paymentMethodLabel(o.paymentMethod)}</p>
          {o.assignedRider && <p>Rider: {o.assignedRider.name}</p>}
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="py-2 pl-2 pr-1 font-semibold">#</th>
            <th className="px-1 py-2 font-semibold">Product</th>
            <th className="px-1 py-2 text-right font-semibold">Qty</th>
            <th className="px-1 py-2 text-right font-semibold">Unit price</th>
            <th className="px-1 py-2 text-right font-semibold">Disc.</th>
            <th className="py-2 pl-1 pr-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((l, i) => {
            const acc = acceptedQty(l);
            const batches = s.invoice.showBatchOnInvoice ? batchText(l, batchById) : null;
            return (
              <tr key={l.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pl-2 pr-1 tabular-nums">{i + 1}</td>
                <td className="px-1 py-2">
                  <p className="font-medium">{l.productName}</p>
                  <p className="text-[11px] text-slate-500">{l.packSizeName}</p>
                  {batches && <p className="text-[11px] text-slate-500">Batch: {batches}</p>}
                  {(l.returnedQuantity ?? 0) > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Ordered {l.quantity}, {l.returnedQuantity} returned at delivery
                    </p>
                  )}
                </td>
                <td className="px-1 py-2 text-right tabular-nums">{acc}</td>
                <td className="px-1 py-2 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                <td className="px-1 py-2 text-right tabular-nums">{l.discountPct ? `${l.discountPct}%` : "—"}</td>
                <td className="py-2 pl-1 pr-2 text-right font-medium tabular-nums">{formatCurrency(billedLineTotal(l))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="text-xs text-slate-600 sm:max-w-[55%]">
          {revised && (
            <p className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-teal-800">
              Revised at delivery: {returnedSummary(o.items) || "quantities changed"} returned. Original invoice value{" "}
              <span className="tabular-nums">{formatCurrency(o.originalGrandTotal!)}</span>.
            </p>
          )}
          {o.notes && <p className="mt-2">Note: {o.notes}</p>}
        </div>
        <dl className="w-full text-xs sm:w-64">
          <Row label="Subtotal" value={formatCurrency(t.gross)} />
          <Row label="Discount" value={`− ${formatCurrency(t.discount)}`} />
          <Row label="Delivery charge" value={formatCurrency(t.delivery)} />
          {vat !== null && <Row label={`VAT ${s.tax.vatPct}% (included)`} value={formatCurrency(vat)} />}
          <div className="mt-1 flex justify-between border-t-2 border-brand-primary pt-1.5 text-sm font-bold text-brand-primary">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(t.total)}</dd>
          </div>
          <Row label="Paid" value={formatCurrency(o.paidAmount)} />
          <Row label="Balance due" value={formatCurrency(o.dueAmount)} strong />
        </dl>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-slate-500">
        <p className="border-t border-slate-400 pt-1">Received by (customer)</p>
        <p className="border-t border-slate-400 pt-1">For {s.company.tradeName}</p>
      </div>
      {s.invoice.footerNote && <p className="mt-6 text-center text-[11px] text-slate-500">{s.invoice.footerNote}</p>}
      <p className="mt-1 text-center text-[10px] text-slate-400">{s.company.website}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between py-0.5", strong && "font-semibold text-slate-900")}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 80 mm thermal receipt                                               */
/* ------------------------------------------------------------------ */

function ThermalReceipt({ order: o, settings: s, batchById }: DocProps) {
  const t = billedTotals(o);
  return (
    <div className="mx-auto w-[80mm] max-w-full bg-white p-3 font-mono text-[11px] leading-snug text-black">
      <div className="text-center">
        <p className="text-sm font-bold">{s.company.tradeName}</p>
        <p>{s.company.address}</p>
        <p>{s.company.phone}</p>
        <p>BIN {s.company.binNo}</p>
      </div>
      <p className="my-2 border-y border-dashed border-black py-1 text-center font-bold">
        {o.orderStatus === "CANCELLED" ? "CANCELLED" : "INVOICE"}
      </p>
      <p>Inv: {invoiceNumber(o, s)}</p>
      <p>Ord: {o.orderNumber}</p>
      <p>Date: {formatDay(o.deliveredAt ?? o.createdAt)}</p>
      <p className="mt-1 font-bold">{o.customerName}</p>
      <p>{o.phone}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {o.items.map((l) => {
        const acc = acceptedQty(l);
        const batches = s.invoice.showBatchOnInvoice ? batchText(l, batchById) : null;
        return (
          <div key={l.id} className="mb-1.5">
            <p className="font-bold">{l.productName}</p>
            <div className="flex justify-between">
              <span>
                {acc} x {formatCurrency(netPackPrice(l))}
                {l.discountPct ? ` (-${l.discountPct}%)` : ""}
              </span>
              <span>{formatCurrency(billedLineTotal(l))}</span>
            </div>
            {(l.returnedQuantity ?? 0) > 0 && <p>  ordered {l.quantity}, returned {l.returnedQuantity}</p>}
            {batches && <p>  B: {batches}</p>}
          </div>
        );
      })}
      <div className="my-2 border-t border-dashed border-black" />
      <TRow label="Subtotal" value={formatCurrency(t.gross)} />
      <TRow label="Discount" value={`-${formatCurrency(t.discount)}`} />
      <TRow label="Delivery" value={formatCurrency(t.delivery)} />
      <div className="mt-1 flex justify-between border-t border-black pt-1 text-xs font-bold">
        <span>TOTAL</span>
        <span>{formatCurrency(t.total)}</span>
      </div>
      {o.originalGrandTotal !== undefined && <p>Revised at delivery (was {formatCurrency(o.originalGrandTotal)})</p>}
      <TRow label="Paid" value={formatCurrency(o.paidAmount)} />
      <TRow label="Due" value={formatCurrency(o.dueAmount)} />
      <p className="mt-1">Pay: {paymentMethodLabel(o.paymentMethod)}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {s.invoice.footerNote && <p className="text-center">{s.invoice.footerNote}</p>}
      <p className="mt-1 text-center">Thank you</p>
    </div>
  );
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery challan                                                    */
/* ------------------------------------------------------------------ */

function Challan({ order: o, settings: s, batchById }: DocProps) {
  const delivered = o.items.some((l) => l.deliveredQuantity !== undefined);
  const collect = amountToCollect(o);
  const credit = o.paymentMethod.startsWith("CREDIT");
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-6 text-slate-800 sm:p-8">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-brand-primary pb-4 sm:flex-row">
        <CompanyBlock s={s} />
        <div className="text-left sm:text-right">
          <p className="text-lg font-bold uppercase tracking-wide text-brand-primary">Delivery challan</p>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs sm:justify-end">
            <dt className="text-slate-500">Challan no.</dt>
            <dd className="font-mono font-semibold">{challanNumber(o, s)}</dd>
            <dt className="text-slate-500">Order no.</dt>
            <dd className="font-mono">{o.orderNumber}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd className="tabular-nums">{formatDay(o.dispatchedAt ?? o.createdAt)}</dd>
            {o.assignedRider && (
              <>
                <dt className="text-slate-500">Rider</dt>
                <dd>{o.assignedRider.name}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-4 text-xs">
        <p className="font-semibold uppercase tracking-wide text-slate-500">Deliver to</p>
        <p className="mt-1 text-sm font-semibold">{o.customerName}</p>
        <p className="text-slate-600">{o.address}</p>
        {o.landmark && <p className="text-slate-500">Landmark: {o.landmark}</p>}
        <p className="tabular-nums text-slate-600">{o.phone}</p>
        <p className="mt-1">
          {DELIVERY_TYPE_META[o.deliveryType ?? "STANDARD"].label} delivery
          {o.deliveryType === "COLD_CHAIN" && " — keep at 2–8 °C, do not leave in sunlight"}
        </p>
        {o.notes && <p className="mt-1 font-medium">Note: {o.notes}</p>}
      </div>

      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="py-2 pl-2 pr-1 font-semibold">#</th>
            <th className="px-1 py-2 font-semibold">Product & batch</th>
            <th className="px-1 py-2 text-right font-semibold">Sent</th>
            <th className="px-1 py-2 text-right font-semibold">Accepted</th>
            <th className="py-2 pl-1 pr-2 text-right font-semibold">Returned</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((l, i) => {
            const batches = batchText(l, batchById);
            return (
              <tr key={l.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pl-2 pr-1 tabular-nums">{i + 1}</td>
                <td className="px-1 py-2">
                  <p className="font-medium">{l.productName}</p>
                  <p className="text-[11px] text-slate-500">{l.packSizeName}</p>
                  {batches && <p className="text-[11px] text-slate-500">Batch: {batches}</p>}
                </td>
                <td className="px-1 py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="px-1 py-2 text-right tabular-nums">{delivered ? l.deliveredQuantity ?? "" : <Blank />}</td>
                <td className="py-2 pl-1 pr-2 text-right tabular-nums">{delivered ? l.returnedQuantity ?? 0 : <Blank />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col justify-between gap-2 rounded border border-slate-300 px-3 py-2 text-sm sm:flex-row">
        <span>Payment: {paymentMethodLabel(o.paymentMethod)}</span>
        <span className="font-semibold tabular-nums">
          {credit ? "On credit — nothing to collect" : `Amount to collect: ${formatCurrency(collect)}`}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Returned packs must come back to the warehouse with this challan. Write the reason next to each returned line.
      </p>

      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
        <p className="border-t border-slate-400 pt-1">Packed by</p>
        <p className="border-t border-slate-400 pt-1">Rider</p>
        <p className="border-t border-slate-400 pt-1">Customer (name & seal)</p>
      </div>
    </div>
  );
}

const Blank = () => <span className="inline-block h-4 w-10 border-b border-slate-400 align-bottom" />;

/* ------------------------------------------------------------------ */
/* Preview modal + print portal                                        */
/* ------------------------------------------------------------------ */

const PAGE_CSS: Record<PrintKind, string> = {
  A4: "@page { size: A4; margin: 10mm; }",
  CHALLAN: "@page { size: A4; margin: 10mm; }",
  THERMAL: "@page { size: 80mm auto; margin: 2mm; }",
};

export function OrderPrintModal({ order, initial, onClose }: { order: Order; initial: PrintKind; onClose: () => void }) {
  const { settings, customers } = useAppStore();
  const { batchById } = useInventory();
  const [kind, setKind] = useState<PrintKind>(initial);
  const customer = customers.find((c) => c.id === order.customerId);
  const props: DocProps = { order, settings, batchById, customer };
  const doc = kind === "A4" ? <InvoiceA4 {...props} /> : kind === "THERMAL" ? <ThermalReceipt {...props} /> : <Challan {...props} />;

  return (
    <>
      <Modal
        title={kind === "CHALLAN" ? "Delivery challan" : "Invoice"}
        subtitle={`${order.orderNumber} · ${order.customerName}`}
        onClose={onClose}
        size="xl"
        footer={
          <>
            <button className={btn.secondary} onClick={onClose}>
              Close
            </button>
            <button className={btn.primary} onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print
            </button>
          </>
        }
      >
        <Tabs
          label="Document"
          value={kind}
          onChange={setKind}
          tabs={[
            { id: "A4", label: "A4 tax invoice", icon: FileText },
            { id: "THERMAL", label: "80mm receipt", icon: Receipt },
            { id: "CHALLAN", label: "Delivery challan", icon: Truck },
          ]}
        />
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-4">
          <div className="shadow-sm">{doc}</div>
        </div>
      </Modal>
      {typeof document !== "undefined" &&
        createPortal(
          <div id="order-print-root" className="print-area hidden bg-white print:block">
            <style>{`${PAGE_CSS[kind]} @media print { body > *:not(#order-print-root) { display: none !important; } }`}</style>
            {doc}
          </div>,
          document.body
        )}
    </>
  );
}
