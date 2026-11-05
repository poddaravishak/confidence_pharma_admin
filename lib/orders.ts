import {
  InventoryItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentChannel,
  ReturnReason,
  ReturnSource,
  ReturnStatus,
} from "@/lib/types";
import { UnitLevel, defaultSaleLevel, findLevel, pluralUnit as plural } from "@/lib/units";

/* ------------------------------------------------------------------ */
/* Status metadata                                                     */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badge: string; dot: string }> = {
  PLACED: { label: "Placed", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  CONFIRMED: { label: "Confirmed", badge: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  PROCESSING: { label: "Processing", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  PACKED: { label: "Packed", badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  DISPATCHED: { label: "Dispatched", badge: "bg-blue-50 text-brand-primary border-blue-200", dot: "bg-brand-blue" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", badge: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  DELIVERED: { label: "Delivered", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  PARTIALLY_DELIVERED: { label: "Partially delivered", badge: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  CANCELLED: { label: "Cancelled", badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
  RETURNED: { label: "Returned", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  FAILED_DELIVERY: { label: "Failed delivery", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

/** The forward pipeline (used for progress steppers). */
export const ORDER_PIPELINE: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const isClosedStatus = (s: OrderStatus) =>
  s === "DELIVERED" || s === "PARTIALLY_DELIVERED" || s === "CANCELLED" || s === "RETURNED" || s === "FAILED_DELIVERY";

export const RETURN_REASON_META: Record<ReturnReason, { label: string; hint: string }> = {
  DAMAGED: { label: "Damaged in transit", hint: "Crushed box, broken strip, leaked bottle" },
  OVER_ORDERED: { label: "Ordered too many", hint: "Customer wants fewer than ordered" },
  WRONG_ITEM: { label: "Wrong item / strength", hint: "Not what the customer ordered" },
  NEAR_EXPIRY: { label: "Short expiry", hint: "Customer refuses stock close to expiry" },
  PRICE_DISPUTE: { label: "Price disagreement", hint: "Customer disputes the invoiced price" },
  QUALITY_ISSUE: { label: "Quality complaint", hint: "Discoloured, broken seal, cold-chain doubt" },
  CUSTOMER_UNAVAILABLE: { label: "Customer unavailable", hint: "Shop closed or not reachable" },
  REFUSED: { label: "Refused delivery", hint: "Customer refused the whole order" },
  OTHER: { label: "Other", hint: "Explain in the note" },
};

export const RETURN_STATUS_META: Record<ReturnStatus, { label: string; badge: string }> = {
  REQUESTED: { label: "Requested", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: { label: "Approved · awaiting pickup", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  REJECTED: { label: "Rejected", badge: "bg-slate-100 text-slate-500 border-slate-200" },
  IN_TRANSIT: { label: "With rider", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  RECEIVED: { label: "Received · to inspect", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const RETURN_SOURCE_META: Record<ReturnSource, { label: string; badge: string }> = {
  PARTIAL_DELIVERY: { label: "Partial delivery", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  FAILED_DELIVERY: { label: "Failed delivery", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  CUSTOMER_RMA: { label: "Customer return", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  NAGAD: "Nagad",
  BANK: "Bank transfer",
  CREDIT: "On credit (due)",
};

/* ------------------------------------------------------------------ */
/* Line & order maths                                                  */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "1 Box (240 Tablets)" for a unit level, "1 Tablet" for the base unit. */
export function unitLineLabel(level: Pick<UnitLevel, "name" | "factor">, baseUnit: string): string {
  if (level.factor <= 1) return `1 ${level.name}`;
  return `1 ${level.name} (${level.factor.toLocaleString("en-US")} ${plural(baseUnit, level.factor)})`;
}

/** Label of the item's default sale unit. */
export function packLabel(item: InventoryItem): string {
  return unitLineLabel(defaultSaleLevel(item), item.baseUnit);
}

/**
 * Build an order line in any unit of the item's ladder (default: its default
 * sale unit). Price comes from that unit; stock moves in base units via
 * `unitsPerPack` (the conversion factor) and `baseQuantity`.
 */
export function buildOrderLine(
  id: string,
  item: InventoryItem,
  qty: number,
  discountPct = 0,
  unitPriceOverride?: number,
  levelId?: string
): OrderItem {
  const level = (levelId && findLevel(item, { id: levelId })) || defaultSaleLevel(item);
  const unitPrice = unitPriceOverride ?? level.price;
  return {
    id,
    productId: item.id,
    productName: item.name,
    packSizeName: unitLineLabel(level, item.baseUnit),
    packSizeId: level.id,
    quantity: qty,
    unitPrice,
    discountPct,
    lineTotal: round2(unitPrice * qty * (1 - discountPct / 100)),
    cogsCost: round2(item.costPrice * level.factor * qty),
    unitsPerPack: level.factor,
    baseQuantity: level.factor * qty,
    baseUnit: item.baseUnit,
  };
}

/** Base unit name of a line ("Tablet"), read from the line or its "1 Box (240 Tablets)" label. */
export function lineBaseUnit(line: OrderItem): string | null {
  if (line.baseUnit) return line.baseUnit;
  const m = /\(([\d,]+)\s+([^)]+)\)/.exec(line.packSizeName);
  if (!m) return null;
  const word = m[2].trim();
  return word.replace(/(ches|shes|xes|ses)$/i, (x) => x.slice(0, -2)).replace(/s$/i, "");
}

/** "= 60 Tablets" for a line ordered in a pack, null for base-unit lines. */
export function lineBaseText(line: OrderItem, qty = line.quantity): string | null {
  const per = Math.max(1, line.unitsPerPack ?? 1);
  const unit = lineBaseUnit(line);
  if (per <= 1 || !unit) return null;
  const n = qty * per;
  return `= ${n.toLocaleString("en-US")} ${plural(unit, n)}`;
}

/** Base units a line takes off the shelf. */
export const lineBaseQty = (line: OrderItem, qty = line.quantity) => qty * Math.max(1, line.unitsPerPack ?? 1);

/** Net price of one pack after the line discount. */
export const netPackPrice = (line: OrderItem) => round2(line.unitPrice * (1 - line.discountPct / 100));

export function orderTotals(items: OrderItem[], deliveryCharge: number) {
  const gross = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const net = items.reduce((s, i) => s + i.lineTotal, 0);
  return {
    subtotal: round2(gross),
    discount: round2(gross - net),
    deliveryCharge,
    grandTotal: round2(net + deliveryCharge),
  };
}

/** Cash the rider should collect for an order right now. */
export function amountToCollect(o: Order): number {
  if (o.paymentStatus === "PAID_COD") return 0;
  return Math.max(0, round2(o.grandTotal - o.paidAmount));
}

/** Packs accepted on a line (falls back to the full quantity before delivery). */
export const acceptedQty = (line: OrderItem) => line.deliveredQuantity ?? line.quantity;
