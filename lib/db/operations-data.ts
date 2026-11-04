/**
 * Operations demo dataset: orders in every status, today's delivery runs,
 * partial/failed deliveries with goods coming back, RMAs, credit notes,
 * rider settlements, notifications and system settings.
 *
 * Prices and pack sizes are taken from the inventory items, so a returned
 * pack converts back to the right number of base units when restocked.
 */
import {
  AppNotification,
  AppSettings,
  AuditLogItem,
  CreditNote,
  Customer,
  DeliveryPersonnel,
  DeliveryRun,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  ReturnReason,
  ReturnRecord,
  RiderSettlement,
  StockBatch,
} from "@/lib/types";
import { mockAuditLogs, mockCustomers, mockDeliveryPersonnel, mockOrders } from "@/lib/db/mock-data";
import { inventoryItems, stockBatches } from "@/lib/db/inventory-data";
import { buildOrderLine, netPackPrice, orderTotals, ORDER_STATUS_META, RETURN_REASON_META } from "@/lib/orders";

export const OPS_TODAY = "2026-11-05";

/* ------------------------------------------------------------------ */
/* Riders                                                              */
/* ------------------------------------------------------------------ */

export const demoRiders: DeliveryPersonnel[] = [
  { ...mockDeliveryPersonnel[0], status: "ON_DELIVERY", currentAssignedOrdersCount: 1, cashInHand: 0 },
  { ...mockDeliveryPersonnel[1], status: "ON_DELIVERY", currentAssignedOrdersCount: 1, cashInHand: 0 },
  { ...mockDeliveryPersonnel[2], status: "ON_DUTY", currentAssignedOrdersCount: 0, cashInHand: 0 },
  {
    id: "rider-04",
    name: "Rubel Mia",
    employeeCode: "EMP-RIDER-104",
    phone: "+8801556677889",
    vehicleType: "MOTORBIKE",
    vehiclePlateNo: "Dhaka Metro-La 21-7765",
    currentAssignedOrdersCount: 0,
    cashInHand: 0,
    status: "AVAILABLE",
  },
];
const riderById = Object.fromEntries(demoRiders.map((r) => [r.id, r]));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const itemById = Object.fromEntries(inventoryItems.map((i) => [i.id, i]));
const customerById: Record<string, Customer> = Object.fromEntries(mockCustomers.map((c) => [c.id, c]));

/** FEFO pick from the central warehouse (seed only, does not change stock). */
function fefo(itemId: string, baseQty: number, pool: StockBatch[] = stockBatches) {
  const out: { batchId: string; quantity: number }[] = [];
  let left = baseQty;
  const candidates = pool
    .filter((b) => b.itemId === itemId && b.warehouseId === "wh-01" && b.hold === "NONE" && b.availableQuantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  for (const b of candidates) {
    if (left <= 0) break;
    const take = Math.min(left, b.availableQuantity);
    out.push({ batchId: b.id, quantity: take });
    left -= take;
  }
  if (left > 0 && candidates[0]) out[0].quantity += left;
  return out;
}

type LineSpec = [productId: string, packs: number, discountPct?: number];

const at = (day: string, time: string) => `${day}T${time}:00+06:00`;

function timeline(status: OrderStatus, created: string, steps: Partial<Record<OrderStatus, string>>, by = "Tanvir Hasan"): OrderEvent[] {
  const ev: OrderEvent[] = [{ at: created, status: "PLACED", label: "Order placed", by: `${by} (phone order)` }];
  const order: OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY"];
  for (const s of order) if (steps[s]) ev.push({ at: steps[s]!, status: s, label: ORDER_STATUS_META[s].label, by: s === "PACKED" ? "Mitu Akter" : s === "DISPATCHED" ? "Jahid Hasan" : "Ayesha Siddiqua" });
  const final = steps[status];
  if (final && !order.includes(status) && status !== "PLACED") {
    ev.push({ at: final, status, label: ORDER_STATUS_META[status].label, by: "Rider" });
  }
  return ev;
}

function makeOrder(spec: {
  id: string;
  number: string;
  customerId: string;
  status: OrderStatus;
  lines: LineSpec[];
  created: string;
  steps?: Partial<Record<OrderStatus, string>>;
  deliveryCharge?: number;
  riderId?: string;
  runId?: string;
  deliveryType?: Order["deliveryType"];
  paymentMethod?: string;
  notes?: string;
}): Order {
  const c = customerById[spec.customerId];
  const items: OrderItem[] = spec.lines.map(([pid, packs, disc = 0], i) => {
    const line = buildOrderLine(`${spec.id}-l${i + 1}`, itemById[pid], packs, disc);
    const dispatched = ["DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED", "PARTIALLY_DELIVERED", "FAILED_DELIVERY"].includes(spec.status);
    return dispatched ? { ...line, batchAllocations: fefo(pid, packs * itemById[pid].unitsPerPack) } : line;
  });
  const totals = orderTotals(items, spec.deliveryCharge ?? 0);
  const steps = spec.steps ?? {};
  return {
    id: spec.id,
    orderNumber: spec.number,
    customerId: c.id,
    customerName: c.businessName,
    customerType: c.customerType,
    phone: c.phone,
    address: c.address.fullAddress,
    landmark: c.address.landmark,
    latitude: c.address.latitude,
    longitude: c.address.longitude,
    distanceKm: 3 + (parseInt(spec.id.slice(-2), 10) % 9),
    orderStatus: spec.status,
    paymentStatus: "PENDING",
    paymentMethod: spec.paymentMethod ?? "CASH_ON_DELIVERY",
    ...totals,
    paidAmount: 0,
    dueAmount: totals.grandTotal,
    items,
    createdAt: spec.created,
    notes: spec.notes,
    deliveryType: spec.deliveryType ?? "STANDARD",
    deliveryRuleName: "Dhaka Metro Core (Zone 1)",
    deliveryChallanNumber: ["PLACED", "CONFIRMED", "PROCESSING"].includes(spec.status) ? undefined : spec.number.replace("ORD", "CHAL"),
    assignedRider: spec.riderId ? riderById[spec.riderId] : undefined,
    runId: spec.runId,
    dispatchedAt: steps.DISPATCHED,
    timeline: timeline(spec.status, spec.created, steps),
    createdBy: "Tanvir Hasan",
  };
}

/** Apply a doorstep outcome to a seeded order (accepted packs per line). */
function applyPartial(o: Order, returned: Record<number, [packs: number, reason: ReturnReason]>, collected: "CASH" | "CREDIT", when: string): Order {
  const items = o.items.map((l, i) => {
    const r = returned[i];
    return r ? { ...l, deliveredQuantity: l.quantity - r[0], returnedQuantity: r[0], returnReason: r[1] } : { ...l, deliveredQuantity: l.quantity, returnedQuantity: 0 };
  });
  const revised = Math.round((items.reduce((s, l) => s + netPackPrice(l) * (l.deliveredQuantity ?? 0), 0) + o.deliveryCharge) * 100) / 100;
  const paid = collected === "CASH" ? revised : 0;
  return {
    ...o,
    items,
    orderStatus: "PARTIALLY_DELIVERED",
    originalGrandTotal: o.grandTotal,
    grandTotal: revised,
    paidAmount: paid,
    dueAmount: revised - paid,
    paymentStatus: paid >= revised ? "PAID_COD" : "DUE",
    deliveredAt: when,
    deliveryProof: { method: "OTP", receivedBy: "Shop owner", otp: "4821", capturedAt: when, paymentMethod: collected, amountCollected: paid },
    timeline: [
      ...(o.timeline ?? []),
      { at: when, status: "PARTIALLY_DELIVERED", label: "Partially delivered", by: o.assignedRider?.name ?? "Rider", note: Object.values(returned).map(([q]) => `${q} pack(s) returned`).join(", ") },
    ],
  };
}

function delivered(o: Order, when: string, method: "CASH" | "CREDIT" | "BKASH" = "CASH"): Order {
  const paid = method === "CREDIT" ? 0 : o.grandTotal;
  return {
    ...o,
    orderStatus: "DELIVERED",
    items: o.items.map((l) => ({ ...l, deliveredQuantity: l.quantity, returnedQuantity: 0 })),
    paidAmount: paid,
    dueAmount: o.grandTotal - paid,
    paymentStatus: paid > 0 ? "PAID_COD" : "DUE",
    deliveredAt: when,
    deliveryProof: { method: "OTP", receivedBy: "Counter staff", otp: "7710", capturedAt: when, paymentMethod: method, amountCollected: paid },
    timeline: [...(o.timeline ?? []), { at: when, status: "DELIVERED", label: "Delivered", by: o.assignedRider?.name ?? "Rider" }],
  };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

const T = OPS_TODAY;

// Headline scenario: 10 boxes of Napa Extra out for delivery with Shakil.
const ord101 = makeOrder({
  id: "ord-101",
  number: "CP-ORD-202611-0101",
  customerId: "cust-06",
  status: "OUT_FOR_DELIVERY",
  lines: [["prod-01", 10, 3], ["prod-02", 5]],
  created: at(T, "08:55"),
  steps: { CONFIRMED: at(T, "09:05"), PROCESSING: at(T, "09:10"), PACKED: at(T, "09:40"), DISPATCHED: at(T, "10:15"), OUT_FOR_DELIVERY: at(T, "10:20") },
  riderId: "rider-01",
  runId: "run-01",
  notes: "Deliver before 1 PM. Call Abdur Rahman on arrival.",
});

const ord102 = delivered(
  makeOrder({
    id: "ord-102",
    number: "CP-ORD-202611-0102",
    customerId: "cust-08",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-13", 4], ["prod-11", 6, 2]],
    created: at(T, "08:30"),
    steps: { CONFIRMED: at(T, "08:40"), PACKED: at(T, "09:30"), DISPATCHED: at(T, "10:15"), OUT_FOR_DELIVERY: at(T, "10:20") },
    riderId: "rider-01",
    runId: "run-01",
  }),
  at(T, "11:05")
);

const ord103 = applyPartial(
  makeOrder({
    id: "ord-103",
    number: "CP-ORD-202611-0103",
    customerId: "cust-09",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-07", 3], ["prod-04", 2]],
    created: at(T, "09:10"),
    steps: { CONFIRMED: at(T, "09:15"), PACKED: at(T, "10:00"), DISPATCHED: at(T, "10:30"), OUT_FOR_DELIVERY: at(T, "10:35") },
    riderId: "rider-02",
    runId: "run-02",
  }),
  { 1: [1, "DAMAGED"] },
  "CASH",
  at(T, "11:40")
);

const ord090 = {
  ...mockOrders[1],
  id: "ord-002",
  runId: "run-02",
  assignedRider: riderById["rider-02"],
  items: mockOrders[1].items.map((l) => ({ ...l, unitsPerPack: 1, batchAllocations: fefo(l.productId, l.quantity) })),
  timeline: timeline("OUT_FOR_DELIVERY", mockOrders[1].createdAt, { CONFIRMED: "2026-11-03T12:00:00+06:00", DISPATCHED: at(T, "10:30"), OUT_FOR_DELIVERY: at(T, "10:35") }),
} as Order;

const ord104 = delivered(
  makeOrder({
    id: "ord-104",
    number: "CP-ORD-202611-0104",
    customerId: "cust-07",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-10", 10, 4], ["prod-12", 5]],
    created: at(T, "07:50"),
    steps: { CONFIRMED: at(T, "08:00"), PACKED: at(T, "08:45"), DISPATCHED: at(T, "09:00"), OUT_FOR_DELIVERY: at(T, "09:05") },
    riderId: "rider-03",
    runId: "run-03",
    deliveryType: "STANDARD",
    paymentMethod: "CREDIT_30_DAYS",
  }),
  at(T, "09:50"),
  "CREDIT"
);

const ord105Base = makeOrder({
  id: "ord-105",
  number: "CP-ORD-202611-0105",
  customerId: "cust-01",
  status: "FAILED_DELIVERY",
  lines: [["prod-03", 6]],
  created: at(T, "08:10"),
  steps: { CONFIRMED: at(T, "08:20"), PACKED: at(T, "08:50"), DISPATCHED: at(T, "09:00"), OUT_FOR_DELIVERY: at(T, "09:05") },
  riderId: "rider-03",
  runId: "run-03",
});
const ord105: Order = {
  ...ord105Base,
  items: ord105Base.items.map((l) => ({ ...l, deliveredQuantity: 0, returnedQuantity: l.quantity, returnReason: "CUSTOMER_UNAVAILABLE" })),
  failureReason: "Shop shutter down, owner not reachable after 3 calls.",
  timeline: [...(ord105Base.timeline ?? []), { at: at(T, "10:25"), status: "FAILED_DELIVERY", label: "Delivery failed", by: "Mohammad Biplob", note: "Shop closed. Goods returning with van." }],
};

// Historic partial delivery: 12 boxes ordered, 10 accepted, 2 restocked.
const ord095 = applyPartial(
  makeOrder({
    id: "ord-095",
    number: "CP-ORD-202611-0095",
    customerId: "cust-06",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-01", 12, 3]],
    created: "2026-11-02T09:00:00+06:00",
    steps: { CONFIRMED: "2026-11-02T09:10:00+06:00", PACKED: "2026-11-02T10:00:00+06:00", DISPATCHED: "2026-11-02T10:30:00+06:00", OUT_FOR_DELIVERY: "2026-11-02T10:35:00+06:00" },
    riderId: "rider-01",
  }),
  { 0: [2, "OVER_ORDERED"] },
  "CASH",
  "2026-11-02T12:10:00+06:00"
);

const ord096 = applyPartial(
  makeOrder({
    id: "ord-096",
    number: "CP-ORD-202611-0096",
    customerId: "cust-07",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-08", 20, 2]],
    created: "2026-11-04T08:30:00+06:00",
    steps: { CONFIRMED: "2026-11-04T08:40:00+06:00", PACKED: "2026-11-04T09:20:00+06:00", DISPATCHED: "2026-11-04T09:40:00+06:00", OUT_FOR_DELIVERY: "2026-11-04T09:45:00+06:00" },
    riderId: "rider-02",
    deliveryType: "COLD_CHAIN",
    paymentMethod: "CREDIT_30_DAYS",
  }),
  { 0: [2, "QUALITY_ISSUE"] },
  "CREDIT",
  "2026-11-04T10:50:00+06:00"
);

const ord097 = delivered(
  makeOrder({
    id: "ord-097",
    number: "CP-ORD-202611-0097",
    customerId: "cust-09",
    status: "OUT_FOR_DELIVERY",
    lines: [["prod-14", 10, 5], ["prod-12", 3]],
    created: "2026-11-01T10:00:00+06:00",
    steps: { CONFIRMED: "2026-11-01T10:10:00+06:00", PACKED: "2026-11-01T11:00:00+06:00", DISPATCHED: "2026-11-01T11:30:00+06:00", OUT_FOR_DELIVERY: "2026-11-01T11:35:00+06:00" },
    riderId: "rider-04",
  }),
  "2026-11-01T12:40:00+06:00",
  "BKASH"
);

const ord001 = {
  ...mockOrders[0],
  assignedRider: riderById["rider-01"],
  items: mockOrders[0].items.map((l) => {
    const unitsPerPack = itemById[l.productId].unitsPerPack;
    const units = l.productId === "prod-04" ? 1 : unitsPerPack;
    return { ...l, unitsPerPack: units, deliveredQuantity: l.quantity, returnedQuantity: 0, batchAllocations: fefo(l.productId, l.quantity * units) };
  }),
  timeline: timeline("DELIVERED", mockOrders[0].createdAt, { CONFIRMED: "2026-11-03T10:20:00Z", DISPATCHED: mockOrders[0].dispatchedAt, DELIVERED: mockOrders[0].deliveredAt }),
} as Order;

const ord003 = {
  ...mockOrders[2],
  items: mockOrders[2].items.map((l) => ({ ...l, unitsPerPack: 100 })),
  timeline: timeline("PACKED", mockOrders[2].createdAt, { CONFIRMED: "2026-11-03T12:40:00Z", PACKED: "2026-11-03T14:00:00Z" }),
} as Order;

const ord106 = makeOrder({
  id: "ord-106",
  number: "CP-ORD-202611-0106",
  customerId: "cust-08",
  status: "PACKED",
  lines: [["prod-06", 8, 2], ["prod-01", 4]],
  created: at(T, "09:45"),
  steps: { CONFIRMED: at(T, "09:50"), PROCESSING: at(T, "10:05"), PACKED: at(T, "10:40") },
});

const ord107 = makeOrder({
  id: "ord-107",
  number: "CP-ORD-202611-0107",
  customerId: "cust-06",
  status: "PLACED",
  lines: [["prod-11", 5], ["prod-09", 6]],
  created: at(T, "11:20"),
  notes: "Customer asked for long-expiry Azithrocin only.",
});

const ord108 = makeOrder({
  id: "ord-108",
  number: "CP-ORD-202611-0108",
  customerId: "cust-07",
  status: "PROCESSING",
  lines: [["prod-07", 10, 5], ["prod-10", 5, 4]],
  created: at(T, "10:15"),
  steps: { CONFIRMED: at(T, "10:20"), PROCESSING: at(T, "10:45") },
  paymentMethod: "CREDIT_30_DAYS",
});

const ord109 = makeOrder({
  id: "ord-109",
  number: "CP-ORD-202611-0109",
  customerId: "cust-02",
  status: "CONFIRMED",
  lines: [["prod-05", 6, 5], ["prod-12", 2]],
  created: at(T, "10:50"),
  steps: { CONFIRMED: at(T, "11:00") },
  deliveryType: "COLD_CHAIN",
  deliveryCharge: 150,
});

const ord094: Order = {
  ...makeOrder({
    id: "ord-094",
    number: "CP-ORD-202611-0094",
    customerId: "cust-05",
    status: "CANCELLED",
    lines: [["prod-02", 10]],
    created: "2026-11-02T15:00:00+06:00",
  }),
  cancelReason: "Customer account suspended: drug licence expired.",
};

export const demoOrders: Order[] = [
  ord107, ord109, ord108, ord106, ord105, ord104, ord103, ord102, ord101, ord090,
  ord096, ord003, ord001, ord095, ord094, ord097,
];

/* ------------------------------------------------------------------ */
/* Delivery runs                                                       */
/* ------------------------------------------------------------------ */

export const demoRuns: DeliveryRun[] = [
  {
    id: "run-01",
    runNumber: "RUN-261105-01",
    riderId: "rider-01",
    date: T,
    orderIds: ["ord-102", "ord-101"],
    status: "IN_PROGRESS",
    loadVerified: true,
    createdAt: at(T, "10:00"),
    createdBy: "Jahid Hasan",
    startedAt: at(T, "10:20"),
  },
  {
    id: "run-02",
    runNumber: "RUN-261105-02",
    riderId: "rider-02",
    date: T,
    orderIds: ["ord-103", "ord-002"],
    status: "IN_PROGRESS",
    loadVerified: true,
    createdAt: at(T, "10:20"),
    createdBy: "Jahid Hasan",
    startedAt: at(T, "10:35"),
  },
  {
    id: "run-03",
    runNumber: "RUN-261105-03",
    riderId: "rider-03",
    date: T,
    orderIds: ["ord-104", "ord-105"],
    status: "RETURNING",
    loadVerified: true,
    createdAt: at(T, "08:50"),
    createdBy: "Jahid Hasan",
    startedAt: at(T, "09:05"),
  },
];

// Cash riders are holding right now (matches the delivered orders above).
demoRiders[0].cashInHand = ord102.paidAmount;
demoRiders[1].cashInHand = ord103.paidAmount;
demoRiders[2].cashInHand = 0;

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

function returnLinesFrom(o: Order) {
  return o.items
    .filter((l) => (l.returnedQuantity ?? 0) > 0)
    .map((l) => ({
      orderItemId: l.id,
      productId: l.productId,
      productName: l.productName,
      packSizeName: l.packSizeName,
      quantity: l.returnedQuantity!,
      unitPrice: netPackPrice(l),
      unitsPerPack: l.unitsPerPack ?? itemById[l.productId].unitsPerPack,
      reason: l.returnReason ?? "OTHER",
      batchId: l.batchAllocations?.[l.batchAllocations.length - 1]?.batchId,
    }));
}

const value = (lines: ReturnRecord["lines"]) => Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;

const ret1Lines = returnLinesFrom(ord095).map((l) => ({ ...l, receivedQuantity: 2, sellableQuantity: 2, damagedQuantity: 0 }));
const ret3Lines = returnLinesFrom(ord105);
const ret2Lines = returnLinesFrom(ord103);
const ret4Lines = returnLinesFrom(ord096).map((l) => ({ ...l, receivedQuantity: 2 }));

const ord097Strips = ord097.items[0];
const ord001Monas = ord001.items[1];

export const demoReturns: ReturnRecord[] = [
  {
    id: "ret-002",
    returnNumber: "RET-261105-002",
    source: "PARTIAL_DELIVERY",
    status: "IN_TRANSIT",
    orderId: ord103.id,
    orderNumber: ord103.orderNumber,
    customerId: ord103.customerId,
    customerName: ord103.customerName,
    riderId: "rider-02",
    runId: "run-02",
    lines: ret2Lines,
    totalValue: value(ret2Lines),
    note: "One glove carton crushed at the corner, customer kept the other.",
    photoCount: 2,
    createdAt: at(T, "11:40"),
    createdBy: "Kamal Hossain",
  },
  {
    id: "ret-003",
    returnNumber: "RET-261105-003",
    source: "FAILED_DELIVERY",
    status: "IN_TRANSIT",
    orderId: ord105.id,
    orderNumber: ord105.orderNumber,
    customerId: ord105.customerId,
    customerName: ord105.customerName,
    riderId: "rider-03",
    runId: "run-03",
    lines: ret3Lines,
    totalValue: value(ret3Lines),
    note: ord105.failureReason,
    createdAt: at(T, "10:25"),
    createdBy: "Mohammad Biplob",
  },
  {
    id: "ret-004",
    returnNumber: "RET-261104-004",
    source: "PARTIAL_DELIVERY",
    status: "RECEIVED",
    orderId: ord096.id,
    orderNumber: ord096.orderNumber,
    customerId: ord096.customerId,
    customerName: ord096.customerName,
    riderId: "rider-02",
    lines: ret4Lines,
    totalValue: value(ret4Lines),
    note: "Ice packs melted on two vials. Customer refused them. Check cold-chain log before restocking.",
    photoCount: 1,
    createdAt: "2026-11-04T10:50:00+06:00",
    createdBy: "Kamal Hossain",
    receivedAt: "2026-11-04T18:20:00+06:00",
    receivedBy: "Mitu Akter",
  },
  {
    id: "ret-001",
    returnNumber: "RET-261102-001",
    source: "PARTIAL_DELIVERY",
    status: "COMPLETED",
    orderId: ord095.id,
    orderNumber: ord095.orderNumber,
    customerId: ord095.customerId,
    customerName: ord095.customerName,
    riderId: "rider-01",
    lines: ret1Lines,
    totalValue: value(ret1Lines),
    note: "Customer ordered 12 boxes by mistake, kept 10.",
    createdAt: "2026-11-02T12:10:00+06:00",
    createdBy: "Shakil Ahmed",
    receivedAt: "2026-11-02T18:05:00+06:00",
    receivedBy: "Mitu Akter",
    inspectedAt: "2026-11-02T18:30:00+06:00",
    inspectedBy: "Rashed Karim",
    creditNoteId: "cn-001",
  },
  {
    id: "rma-005",
    returnNumber: "RMA-261104-005",
    source: "CUSTOMER_RMA",
    status: "REQUESTED",
    orderId: ord097.id,
    orderNumber: ord097.orderNumber,
    customerId: ord097.customerId,
    customerName: ord097.customerName,
    lines: [
      {
        orderItemId: ord097Strips.id,
        productId: ord097Strips.productId,
        productName: ord097Strips.productName,
        packSizeName: ord097Strips.packSizeName,
        quantity: 2,
        unitPrice: netPackPrice(ord097Strips),
        unitsPerPack: 1,
        reason: "QUALITY_ISSUE",
        batchId: ord097Strips.batchAllocations?.[0]?.batchId,
      },
    ],
    totalValue: netPackPrice(ord097Strips) * 2,
    note: "Two boxes give error E-5 on every strip. Clinic requests replacement or credit.",
    photoCount: 3,
    createdAt: "2026-11-04T15:30:00+06:00",
    createdBy: "Tanvir Hasan",
  },
  {
    id: "rma-006",
    returnNumber: "RMA-261103-006",
    source: "CUSTOMER_RMA",
    status: "APPROVED",
    orderId: ord001.id,
    orderNumber: ord001.orderNumber,
    customerId: ord001.customerId,
    customerName: ord001.customerName,
    lines: [
      {
        orderItemId: ord001Monas.id,
        productId: ord001Monas.productId,
        productName: ord001Monas.productName,
        packSizeName: ord001Monas.packSizeName,
        quantity: 2,
        unitPrice: netPackPrice(ord001Monas),
        unitsPerPack: ord001Monas.unitsPerPack ?? 30,
        reason: "NEAR_EXPIRY",
        batchId: ord001Monas.batchAllocations?.[0]?.batchId,
      },
    ],
    totalValue: netPackPrice(ord001Monas) * 2,
    note: "Pharmacy cannot sell stock with less than 6 months to expiry.",
    createdAt: "2026-11-03T16:00:00+06:00",
    createdBy: "Tanvir Hasan",
    approvedBy: "Ayesha Siddiqua",
  },
];

export const demoCreditNotes: CreditNote[] = [
  {
    id: "cn-001",
    creditNoteNumber: "CN-261102-001",
    customerId: ord095.customerId,
    customerName: ord095.customerName,
    orderId: ord095.id,
    orderNumber: ord095.orderNumber,
    returnId: "ret-001",
    amount: value(ret1Lines),
    reason: "Partial delivery: 2 boxes returned at the door (ordered too many).",
    status: "APPLIED",
    createdAt: "2026-11-02T18:30:00+06:00",
    createdBy: "Rashed Karim",
  },
];

export const demoSettlements: RiderSettlement[] = [
  {
    id: "set-001",
    settlementNumber: "SET-261103-001",
    riderId: "rider-01",
    date: "2026-11-03",
    cashExpected: 32400,
    cashReceived: 32400,
    goodsExpected: 0,
    goodsReceived: 0,
    status: "BALANCED",
    settledBy: "Nayeem Islam",
    settledAt: "2026-11-03T18:10:00+06:00",
  },
  {
    id: "set-002",
    settlementNumber: "SET-261102-002",
    riderId: "rider-01",
    date: "2026-11-02",
    cashExpected: ord095.paidAmount,
    cashReceived: ord095.paidAmount,
    goodsExpected: 2,
    goodsReceived: 2,
    status: "BALANCED",
    settledBy: "Nayeem Islam",
    settledAt: "2026-11-02T18:05:00+06:00",
  },
  {
    id: "set-003",
    settlementNumber: "SET-261104-003",
    riderId: "rider-03",
    date: "2026-11-04",
    cashExpected: 15400,
    cashReceived: 15200,
    goodsExpected: 0,
    goodsReceived: 0,
    status: "SHORTAGE",
    note: "৳200 short. Rider says change given to customer; deducted from allowance.",
    settledBy: "Nayeem Islam",
    settledAt: "2026-11-04T18:40:00+06:00",
  },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const demoNotifications: AppNotification[] = [
  { id: "n-01", title: "Partial delivery recorded", body: "City Care Clinic kept 1 of 2 glove cartons. 1 carton returning with Kamal.", at: at(T, "11:40"), module: "returns", href: "/returns", tone: "warning", read: false },
  { id: "n-02", title: "Delivery failed", body: "CP-ORD-202611-0105 to Labaid Pharma Point: shop closed. 6 boxes returning.", at: at(T, "10:25"), module: "delivery", href: "/delivery", tone: "danger", read: false },
  { id: "n-03", title: "New order placed", body: "Rahman Pharmacy placed CP-ORD-202611-0107 (৳3,096).", at: at(T, "11:20"), module: "orders", href: "/orders", tone: "info", read: false },
  { id: "n-04", title: "Return waiting for inspection", body: "2 Mixtard vials from Green Life Hospital are in the returns bay.", at: "2026-11-04T18:20:00+06:00", module: "returns", href: "/returns", tone: "warning", read: false },
  { id: "n-05", title: "Customer return request", body: "City Care Clinic asks to return 2 boxes of Accu-Chek strips (quality issue).", at: "2026-11-04T15:30:00+06:00", module: "returns", href: "/returns", tone: "info", read: false },
  { id: "n-06", title: "Adjustment needs approval", body: "Write-off of Dengue NS1 kits is above ৳10,000.", at: "2026-11-04T14:00:00+06:00", module: "inventory", href: "/inventory/adjustments", tone: "warning", read: true },
  { id: "n-07", title: "KYC submitted", body: "Al-Madina Community Clinic uploaded its drug licence.", at: "2026-11-04T12:10:00+06:00", module: "customers", href: "/customers", tone: "info", read: true },
  { id: "n-08", title: "Rider cash shortage", body: "Mohammad Biplob settled ৳200 short on 4 Nov.", at: "2026-11-04T18:40:00+06:00", module: "delivery", href: "/delivery", tone: "danger", read: true },
  { id: "n-09", title: "Stock below reorder level", body: "Fexo 120mg is out of stock. Draft a purchase order.", at: "2026-11-04T09:00:00+06:00", module: "inventory", href: "/inventory/reorder", tone: "danger", read: true },
  { id: "n-10", title: "Supplier payment due", body: "Beximco depot payable of ৳1,85,000 is due on 8 Nov.", at: "2026-11-03T10:00:00+06:00", module: "suppliers", href: "/suppliers", tone: "info", read: true },
];

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export const demoAuditLogs: AuditLogItem[] = [
  { id: "log-11", action: "DELIVERY_PARTIAL", module: "DELIVERY", performedBy: "Kamal Hossain (Rider)", timestamp: at(T, "11:40"), details: "CP-ORD-202611-0103: customer accepted 1 of 2 cartons of gloves. Return RET-261105-002 opened." },
  { id: "log-10", action: "DELIVERY_FAILED", module: "DELIVERY", performedBy: "Mohammad Biplob (Rider)", timestamp: at(T, "10:25"), details: "CP-ORD-202611-0105 failed: shop closed. Return RET-261105-003 opened for 6 boxes of Monas 10mg." },
  { id: "log-09", action: "RUN_DISPATCHED", module: "DELIVERY", performedBy: "Jahid Hasan (Dispatch)", timestamp: at(T, "10:15"), details: "RUN-261105-01 dispatched with Shakil Ahmed: 2 stops." },
  { id: "log-08", action: "RETURN_RESTOCKED", module: "RETURNS", performedBy: "Rashed Karim (Inventory Manager)", timestamp: "2026-11-02T18:30:00+06:00", details: "RET-261102-001: 2 boxes Napa Extra restocked to batch BEX-NX-2501. Credit note CN-261102-001 issued." },
  { id: "log-07", action: "ROLE_UPDATED", module: "USERS", performedBy: "Dr. TC Dey (Super Admin)", timestamp: "2026-11-01T17:00:00+06:00", details: "Dispatch Coordinator role created with delivery and returns access." },
  ...mockAuditLogs,
];

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const defaultSettings: AppSettings = {
  company: {
    legalName: "Confidence Pharma Ltd.",
    tradeName: "Confidence Pharma",
    ownerName: "Dr. TC Dey",
    phone: "+880 1711-000001",
    email: "info@confidencepharma.com.bd",
    website: "www.confidencepharma.com.bd",
    address: "214 Tejgaon I/A, Dhaka 1208, Bangladesh",
    tradeLicenseNo: "TRAD/DNCC/045812/2024",
    drugLicenseNo: "DGDA/WHL/DHA-2023/1187",
    binNo: "004512378-0101",
    tinNo: "387412569043",
  },
  tax: { vatEnabled: false, vatPct: 7.5, pricesIncludeVat: true, roundTo: 1 },
  invoice: {
    orderPrefix: "CP-ORD-",
    invoicePrefix: "CP-INV-",
    challanPrefix: "CP-CHAL-",
    creditNotePrefix: "CN-",
    nextNumber: 110,
    defaultFormat: "A4",
    footerNote: "Goods once delivered are returnable within 7 days with invoice. Cold-chain items are not returnable once accepted.",
    showBatchOnInvoice: true,
  },
  payments: [
    { id: "CASH", label: "Cash on delivery", enabled: true },
    { id: "BKASH", label: "bKash Merchant", enabled: true, accountRef: "01711-000001" },
    { id: "NAGAD", label: "Nagad Business", enabled: true, accountRef: "01711-000001" },
    { id: "BANK", label: "Bank transfer (DBBL)", enabled: true, accountRef: "DBBL 104.110.55821" },
    { id: "CREDIT", label: "Credit (due on account)", enabled: true },
  ],
  credit: { defaultCreditLimit: 50000, defaultTermsDays: 30, blockOverLimitOrders: true },
  delivery: { proofRequired: "OTP", allowPartialDelivery: true, sameDayCutoff: "14:00", maxStopsPerRun: 12, riderCashLimit: 100000 },
  returns: {
    returnWindowDays: 7,
    requirePhotoForDamage: true,
    autoRestockSellable: false,
    approvalThreshold: 10000,
    reasons: (
      ["DAMAGED", "OVER_ORDERED", "WRONG_ITEM", "NEAR_EXPIRY", "PRICE_DISPUTE", "QUALITY_ISSUE", "CUSTOMER_UNAVAILABLE", "REFUSED", "OTHER"] as ReturnReason[]
    ).map((id) => ({ id, label: RETURN_REASON_META[id].label, enabled: true })),
  },
  notifications: [
    { id: "nt-01", event: "Order confirmed", channels: { sms: true, whatsapp: true, email: false, inApp: true }, template: "Dear {customer}, your order {order_no} of {amount} is confirmed. Confidence Pharma." },
    { id: "nt-02", event: "Out for delivery", channels: { sms: true, whatsapp: true, email: false, inApp: true }, template: "{rider} is on the way with order {order_no}. Delivery OTP: {otp}." },
    { id: "nt-03", event: "Delivered / partially delivered", channels: { sms: true, whatsapp: false, email: true, inApp: true }, template: "Order {order_no} delivered. Billed {amount}. Returned items: {returned}." },
    { id: "nt-04", event: "Credit note issued", channels: { sms: false, whatsapp: true, email: true, inApp: true }, template: "Credit note {cn_no} of {amount} added to your account against {order_no}." },
    { id: "nt-05", event: "Payment due reminder", channels: { sms: true, whatsapp: true, email: false, inApp: false }, template: "Reminder: {amount} is due on your Confidence Pharma account. Pay via bKash {bkash_no}." },
    { id: "nt-06", event: "Low stock alert (staff)", channels: { sms: false, whatsapp: false, email: true, inApp: true }, template: "{product} is below reorder level ({stock} left)." },
  ],
  security: { sessionTimeoutMinutes: 60, enforceTwoFactorForAdmins: true, passwordMinLength: 8 },
};
