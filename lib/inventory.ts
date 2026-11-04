import {
  AdjustmentReason,
  ApprovalStatus,
  InventoryItem,
  StockBatch,
  StockMovementType,
  TransferStatus,
} from "@/lib/types";
import { DEMO_TODAY } from "@/lib/db/inventory-data";

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const today = new Date(`${DEMO_TODAY}T00:00:00Z`).getTime();

export function daysUntil(date: string): number {
  return Math.round((new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() - today) / DAY_MS);
}

export function formatDay(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

/* ------------------------------------------------------------------ */
/* Quantities                                                          */
/* ------------------------------------------------------------------ */

export function plural(word: string, n: number): string {
  if (n === 1) return word;
  if (/(x|s|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "25 Boxes + 40 Tablets" — pack breakdown of a base-unit quantity. */
export function formatPacks(qty: number, item: InventoryItem): string {
  if (item.unitsPerPack <= 1 || item.packUnit === item.baseUnit) {
    return `${qty.toLocaleString("en-US")} ${plural(item.baseUnit, qty)}`;
  }
  const sign = qty < 0 ? "−" : "";
  const abs = Math.abs(qty);
  const packs = Math.floor(abs / item.unitsPerPack);
  const rest = abs % item.unitsPerPack;
  const parts: string[] = [];
  if (packs) parts.push(`${packs.toLocaleString("en-US")} ${plural(item.packUnit, packs)}`);
  if (rest || !packs) parts.push(`${rest.toLocaleString("en-US")} ${plural(item.baseUnit, rest)}`);
  return sign + parts.join(" + ");
}

/** "9,600 Tablets" */
export function formatBase(qty: number, item: InventoryItem): string {
  return `${qty.toLocaleString("en-US")} ${plural(item.baseUnit, Math.abs(qty))}`;
}

export function packLabel(item: InventoryItem): string {
  return item.unitsPerPack > 1 && item.packUnit !== item.baseUnit
    ? `1 ${item.packUnit} = ${item.unitsPerPack} ${plural(item.baseUnit, item.unitsPerPack)}`
    : `Sold per ${item.baseUnit.toLowerCase()}`;
}

/* ------------------------------------------------------------------ */
/* Expiry (FEFO) — red < 30 days, amber 31–90, green > 90 (plan §5.5)  */
/* ------------------------------------------------------------------ */

export type ExpiryBucket = "EXPIRED" | "UNDER_30" | "UNDER_60" | "UNDER_90" | "SAFE";

export function expiryBucket(days: number): ExpiryBucket {
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "UNDER_30";
  if (days <= 60) return "UNDER_60";
  if (days <= 90) return "UNDER_90";
  return "SAFE";
}

export const EXPIRY_META: Record<ExpiryBucket, { label: string; short: string; badge: string; dot: string; bar: string }> = {
  EXPIRED: { label: "Expired", short: "Expired", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-600", bar: "bg-rose-600" },
  UNDER_30: { label: "Expires within 30 days", short: "≤ 30 days", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", bar: "bg-rose-500" },
  UNDER_60: { label: "Expires in 31–60 days", short: "31–60 days", badge: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500", bar: "bg-amber-500" },
  UNDER_90: { label: "Expires in 61–90 days", short: "61–90 days", badge: "bg-yellow-50 text-yellow-800 border-yellow-200", dot: "bg-yellow-400", bar: "bg-yellow-400" },
  SAFE: { label: "More than 90 days", short: "> 90 days", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};

export function expiryText(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} ${plural("day", Math.abs(days))} ago`;
  if (days === 0) return "Expires today";
  if (days <= 90) return `${days} ${plural("day", days)} left`;
  const months = Math.round(days / 30);
  return `${months} ${plural("month", months)} left`;
}

/* ------------------------------------------------------------------ */
/* Batch & item status                                                 */
/* ------------------------------------------------------------------ */

export type BatchState = "AVAILABLE" | "ON_HOLD" | "EXPIRED" | "DEPLETED";

export function batchState(batch: StockBatch): BatchState {
  if (batch.availableQuantity <= 0) return "DEPLETED";
  if (daysUntil(batch.expiryDate) < 0) return "EXPIRED";
  if (batch.hold !== "NONE") return "ON_HOLD";
  return "AVAILABLE";
}

export const BATCH_STATE_META: Record<BatchState, { label: string; badge: string }> = {
  AVAILABLE: { label: "Sellable", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ON_HOLD: { label: "On hold", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  EXPIRED: { label: "Expired", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  DEPLETED: { label: "Empty", badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

export const STOCK_STATUS_META: Record<StockStatus, { label: string; badge: string; bar: string }> = {
  OUT_OF_STOCK: { label: "Out of stock", badge: "bg-rose-50 text-rose-700 border-rose-200", bar: "bg-rose-500" },
  LOW_STOCK: { label: "Low stock", badge: "bg-amber-50 text-amber-800 border-amber-200", bar: "bg-amber-500" },
  IN_STOCK: { label: "In stock", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
};

export interface ItemStock {
  onHand: number;
  sellable: number;
  onHold: number;
  expired: number;
  value: number;
  batchCount: number;
  nearestExpiryDays: number | null;
  status: StockStatus;
  daysOfCover: number | null;
}

export function computeItemStock(item: InventoryItem, batches: StockBatch[]): ItemStock {
  let onHand = 0;
  let sellable = 0;
  let onHold = 0;
  let expired = 0;
  let value = 0;
  let batchCount = 0;
  let nearest: number | null = null;

  for (const bt of batches) {
    if (bt.itemId !== item.id || bt.availableQuantity <= 0) continue;
    const state = batchState(bt);
    batchCount++;
    onHand += bt.availableQuantity;
    value += bt.availableQuantity * bt.unitCost;
    if (state === "AVAILABLE") {
      sellable += bt.availableQuantity;
      const d = daysUntil(bt.expiryDate);
      nearest = nearest === null ? d : Math.min(nearest, d);
    } else if (state === "ON_HOLD") onHold += bt.availableQuantity;
    else if (state === "EXPIRED") expired += bt.availableQuantity;
  }

  const status: StockStatus = sellable <= 0 ? "OUT_OF_STOCK" : sellable <= item.reorderLevel ? "LOW_STOCK" : "IN_STOCK";
  const daysOfCover = item.avgDailySales > 0 ? Math.floor(sellable / item.avgDailySales) : null;

  return { onHand, sellable, onHold, expired, value, batchCount, nearestExpiryDays: nearest, status, daysOfCover };
}

/** Packs to order so stock covers lead time + 30 days, and at least 2× reorder level. */
export function suggestedReorderPacks(item: InventoryItem, sellable: number): number {
  const target = Math.max(item.avgDailySales * (item.leadTimeDays + 30), item.reorderLevel * 2);
  const need = Math.max(0, target - sellable);
  return Math.ceil(need / Math.max(1, item.unitsPerPack));
}

/** FEFO: sellable batches, earliest expiry first. */
export function fefoSort(a: StockBatch, b: StockBatch): number {
  return a.expiryDate.localeCompare(b.expiryDate);
}

/* ------------------------------------------------------------------ */
/* Movements, adjustments, transfers                                   */
/* ------------------------------------------------------------------ */

export const MOVEMENT_META: Record<StockMovementType, { label: string; badge: string }> = {
  PURCHASE_IN: { label: "Purchase received", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SALE_OUT: { label: "Sold", badge: "bg-blue-50 text-brand-primary border-blue-200" },
  CUSTOMER_RETURN: { label: "Customer return", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  SUPPLIER_RETURN: { label: "Returned to supplier", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  ADJUSTMENT_IN: { label: "Adjustment (+)", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  ADJUSTMENT_OUT: { label: "Adjustment (−)", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  DAMAGE: { label: "Damaged", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  EXPIRY_DISPOSAL: { label: "Expired disposal", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  TRANSFER_OUT: { label: "Transfer out", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  TRANSFER_IN: { label: "Transfer in", badge: "bg-violet-50 text-violet-700 border-violet-200" },
};

export const REASON_META: Record<AdjustmentReason, { label: string; hint: string; direction: "in" | "out" | "both" }> = {
  COUNT_DISCREPANCY: { label: "Count discrepancy", hint: "Physical count differs from the system", direction: "both" },
  DAMAGED: { label: "Damaged in warehouse", hint: "Broken, leaked, crushed or temperature excursion", direction: "out" },
  EXPIRED_DISPOSAL: { label: "Expired disposal", hint: "Expired stock sent for destruction", direction: "out" },
  FOUND_STOCK: { label: "Found stock", hint: "Stock found that was not in the system", direction: "in" },
  SAMPLE_USE: { label: "Sample / internal use", hint: "Given as sample or used internally", direction: "out" },
  OTHER: { label: "Other", hint: "Explain in the note", direction: "both" },
};

export function movementTypeForReason(reason: AdjustmentReason, delta: number): StockMovementType {
  if (reason === "DAMAGED") return "DAMAGE";
  if (reason === "EXPIRED_DISPOSAL") return "EXPIRY_DISPOSAL";
  return delta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
}

export const APPROVAL_META: Record<ApprovalStatus, { label: string; badge: string }> = {
  PENDING: { label: "Awaiting approval", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const TRANSFER_META: Record<TransferStatus, { label: string; badge: string }> = {
  REQUESTED: { label: "Requested", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  IN_TRANSIT: { label: "In transit", badge: "bg-blue-50 text-brand-primary border-blue-200" },
  RECEIVED: { label: "Received", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelled", badge: "bg-slate-100 text-slate-500 border-slate-200" },
};
