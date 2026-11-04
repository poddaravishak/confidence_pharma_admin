"use client";

/**
 * Application-wide demo store.
 *
 * Holds everything that crosses module boundaries: the signed-in user and RBAC,
 * orders, delivery runs, riders, returns, credit notes, rider settlements,
 * settings, notifications and the audit trail. Stock changes are delegated to
 * the InventoryProvider (mounted above this provider) so every delivery and
 * return shows up in /inventory/movements.
 *
 * State is in memory only: a page reload resets the demo, except the login,
 * which is remembered in localStorage.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AppNotification,
  AppSettings,
  AuditLogItem,
  CreditNote,
  Customer,
  DeliveryPersonnel,
  DeliveryProof,
  DeliveryRun,
  Order,
  OrderEvent,
  OrderStatus,
  PaymentChannel,
  PermissionAction,
  PermissionModule,
  ReturnLine,
  ReturnReason,
  ReturnRecord,
  RiderSettlement,
  Role,
  StaffUser,
} from "@/lib/types";
import { demoRoles, demoUsers } from "@/lib/db/rbac-data";
import {
  defaultSettings,
  demoAuditLogs,
  demoCreditNotes,
  demoNotifications,
  demoOrders,
  demoReturns,
  demoRiders,
  demoRuns,
  demoSettlements,
} from "@/lib/db/operations-data";
import { mockCustomers } from "@/lib/db/mock-data";
import { hasPermission } from "@/lib/rbac";
import { buildOrderLine, netPackPrice, orderTotals, ORDER_STATUS_META, isClosedStatus } from "@/lib/orders";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { formatCurrency } from "@/lib/utils";

const SESSION_KEY = "cp-demo-session";

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface CreateOrderInput {
  customerId: string;
  lines: { productId: string; packs: number; discountPct?: number }[];
  deliveryType: NonNullable<Order["deliveryType"]>;
  deliveryCharge: number;
  paymentMethod: string;
  notes?: string;
  /** Skip straight to CONFIRMED (phone orders taken by staff). */
  confirm?: boolean;
}

export interface DeliveryOutcome {
  kind: "FULL" | "PARTIAL" | "FAILED";
  /** Packs accepted per order line. Required for PARTIAL. */
  lines?: { orderItemId: string; accepted: number; reason?: ReturnReason }[];
  failureReason?: string;
  failureCode?: ReturnReason;
  payment: { method: PaymentChannel; amount: number };
  proof?: Omit<DeliveryProof, "capturedAt" | "paymentMethod" | "amountCollected">;
  note?: string;
  photoCount?: number;
}

export interface SettlementInput {
  cashReceived: number;
  /** returnId → orderItemId → packs handed over */
  goodsReceived: Record<string, Record<string, number>>;
  note?: string;
}

export interface InspectionDecision {
  sellable: number;
  damaged: number;
  damageCondition?: "DAMAGED" | "EXPIRED";
  batchId?: string;
}

export interface RmaInput {
  orderId: string;
  lines: { orderItemId: string; quantity: number; reason: ReturnReason }[];
  note?: string;
  photoCount?: number;
}

interface AppStoreValue {
  /* auth & RBAC */
  hydrated: boolean;
  currentUser: StaffUser | null;
  currentRole: Role | null;
  login: (userId: string) => Role | null;
  logout: () => void;
  can: (module: PermissionModule, action?: PermissionAction) => boolean;

  /* users & roles */
  users: StaffUser[];
  roles: Role[];
  roleById: Record<string, Role>;
  saveUser: (user: StaffUser) => void;
  /** Removes an invited user that never signed in. Returns false for active accounts. */
  deleteUser: (id: string) => boolean;
  saveRole: (role: Role) => void;
  deleteRole: (id: string) => boolean;

  /* settings, notifications, audit */
  settings: AppSettings;
  updateSettings: <K extends keyof AppSettings>(section: K, value: AppSettings[K]) => void;
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  auditLogs: AuditLogItem[];
  logAudit: (action: string, module: string, details: string) => void;

  /* operations */
  customers: Customer[];
  orders: Order[];
  orderById: Record<string, Order>;
  riders: DeliveryPersonnel[];
  riderById: Record<string, DeliveryPersonnel>;
  runs: DeliveryRun[];
  returns: ReturnRecord[];
  creditNotes: CreditNote[];
  settlements: RiderSettlement[];

  createOrder: (input: CreateOrderInput) => Order;
  advanceOrder: (orderId: string, status: OrderStatus, note?: string) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  /** Collect a payment against an order's due (counter, bKash, bank). */
  recordPayment: (orderId: string, input: { amount: number; method: PaymentChannel; reference?: string }) => void;

  createRun: (riderId: string, orderIds: string[]) => DeliveryRun | null;
  verifyRunLoad: (runId: string) => void;
  startRun: (runId: string) => void;
  recordDelivery: (orderId: string, outcome: DeliveryOutcome) => ReturnRecord | null;
  settleRider: (riderId: string, input: SettlementInput) => RiderSettlement | null;

  receiveReturn: (returnId: string, received: Record<string, number>) => void;
  inspectReturn: (returnId: string, decisions: Record<string, InspectionDecision>) => CreditNote | null;
  createRma: (input: RmaInput) => ReturnRecord | null;
  approveRma: (returnId: string) => void;
  rejectRma: (returnId: string, reason: string) => void;
  markRmaPickedUp: (returnId: string, riderId: string) => void;
  setCreditNoteStatus: (id: string, status: CreditNote["status"]) => void;

  notify: (message: string, tone?: "success" | "warning") => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside <AppStoreProvider>");
  return ctx;
}

/** Shorthand for permission checks in components. */
export function useCan() {
  return useAppStore().can;
}

const byId = <T extends { id: string }>(list: T[]) =>
  list.reduce<Record<string, T>>((acc, x) => {
    acc[x.id] = x;
    return acc;
  }, {});

const nowIso = () => new Date().toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;
const stamp = () => {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const inventory = useInventory();
  const { notify } = inventory;

  /* ---------- state ---------- */
  const [hydrated, setHydrated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<StaffUser[]>(demoUsers);
  const [roles, setRoles] = useState<Role[]>(demoRoles);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [notifications, setNotifications] = useState<AppNotification[]>(demoNotifications);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(demoAuditLogs);
  const [customers] = useState<Customer[]>(mockCustomers);
  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [riders, setRiders] = useState<DeliveryPersonnel[]>(demoRiders);
  const [runs, setRuns] = useState<DeliveryRun[]>(demoRuns);
  const [returns, setReturns] = useState<ReturnRecord[]>(demoReturns);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(demoCreditNotes);
  const [settlements, setSettlements] = useState<RiderSettlement[]>(demoSettlements);

  const seq = useRef(200);
  const nextNo = () => String(++seq.current).padStart(3, "0");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SESSION_KEY);
      // Reading browser storage has to wait until after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && demoUsers.some((u) => u.id === saved)) setCurrentUserId(saved);
    } catch {
      /* storage unavailable: stay signed out */
    }
    setHydrated(true);
  }, []);

  /* ---------- derived ---------- */
  const roleById = useMemo(() => byId(roles), [roles]);
  const orderById = useMemo(() => byId(orders), [orders]);
  const riderById = useMemo(() => byId(riders), [riders]);
  const currentUser = useMemo(() => users.find((u) => u.id === currentUserId) ?? null, [users, currentUserId]);
  const currentRole = currentUser ? roleById[currentUser.roleId] ?? null : null;
  const actor = currentUser ? `${currentUser.name} (${currentRole?.name ?? "Staff"})` : "System";

  // Stock movements and adjustments are attributed to whoever is signed in.
  const { setActor } = inventory;
  useEffect(() => setActor(actor), [actor, setActor]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction = "view") => hasPermission(currentRole?.permissions, module, action),
    [currentRole]
  );

  /* ---------- auth ---------- */
  const login = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user || user.status !== "ACTIVE") return null;
    setCurrentUserId(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, lastLoginAt: nowIso() } : u)));
    try {
      window.localStorage.setItem(SESSION_KEY, userId);
    } catch {
      /* ignore */
    }
    return roleById[user.roleId] ?? null;
  };

  const logout = () => {
    setCurrentUserId(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  };

  /* ---------- audit & notifications ---------- */
  const logAudit = useCallback(
    (action: string, module: string, details: string) =>
      setAuditLogs((prev) => [{ id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, action, module, performedBy: actor, timestamp: nowIso(), details }, ...prev]),
    [actor]
  );

  const pushNotification = (n: Omit<AppNotification, "id" | "at" | "read">) =>
    setNotifications((prev) => [{ ...n, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: nowIso(), read: false }, ...prev]);

  const markNotificationRead = (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllNotificationsRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  /* ---------- users, roles, settings ---------- */
  const saveUser = (user: StaffUser) => {
    const exists = users.some((u) => u.id === user.id);
    setUsers((prev) => (exists ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev]));
    logAudit(exists ? "USER_UPDATED" : "USER_CREATED", "USERS", `${user.name} (${roleById[user.roleId]?.name ?? user.roleId}) ${exists ? "updated" : "invited"}. Status: ${user.status}.`);
  };

  const deleteUser = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user || user.status !== "INVITED" || id === currentUserId) return false;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    logAudit("USER_INVITE_REVOKED", "USERS", `Invitation for ${user.name} (${user.email}) revoked.`);
    return true;
  };

  const saveRole = (role: Role) => {
    const exists = roles.some((r) => r.id === role.id);
    setRoles((prev) => (exists ? prev.map((r) => (r.id === role.id ? role : r)) : [...prev, role]));
    logAudit(exists ? "ROLE_UPDATED" : "ROLE_CREATED", "USERS", `Role "${role.name}" ${exists ? "updated" : "created"}.`);
  };

  const deleteRole = (id: string) => {
    const role = roleById[id];
    if (!role || role.isSystem || users.some((u) => u.roleId === id)) return false;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    logAudit("ROLE_DELETED", "USERS", `Role "${role.name}" deleted.`);
    return true;
  };

  const updateSettings: AppStoreValue["updateSettings"] = (section, value) => {
    setSettings((prev) => ({ ...prev, [section]: value }));
    logAudit("SETTINGS_UPDATED", "SETTINGS", `${String(section)} settings changed.`);
  };

  /* ---------- order helpers ---------- */
  const patchOrder = (id: string, fn: (o: Order) => Order) => setOrders((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));
  const event = (status: OrderEvent["status"], label: string, note?: string): OrderEvent => ({ at: nowIso(), status, label, by: actor, note });

  const createOrder = (input: CreateOrderInput): Order => {
    const customer = customers.find((c) => c.id === input.customerId)!;
    const n = settings.invoice.nextNumber;
    setSettings((s) => ({ ...s, invoice: { ...s.invoice, nextNumber: s.invoice.nextNumber + 1 } }));
    const id = `ord-${n}`;
    const items = input.lines.map((l, i) => buildOrderLine(`${id}-l${i + 1}`, inventory.itemById[l.productId], l.packs, l.discountPct ?? 0));
    const totals = orderTotals(items, input.deliveryCharge);
    const status: OrderStatus = input.confirm ? "CONFIRMED" : "PLACED";
    const order: Order = {
      id,
      orderNumber: `${settings.invoice.orderPrefix}202611-${String(n).padStart(4, "0")}`,
      customerId: customer.id,
      customerName: customer.businessName,
      customerType: customer.customerType,
      phone: customer.phone,
      address: customer.address.fullAddress,
      landmark: customer.address.landmark,
      latitude: customer.address.latitude,
      longitude: customer.address.longitude,
      orderStatus: status,
      paymentStatus: "PENDING",
      paymentMethod: input.paymentMethod,
      ...totals,
      paidAmount: 0,
      dueAmount: totals.grandTotal,
      items,
      createdAt: nowIso(),
      notes: input.notes,
      deliveryType: input.deliveryType,
      createdBy: currentUser?.name,
      timeline: [
        event("PLACED", "Order placed"),
        ...(input.confirm ? [event("CONFIRMED", "Order confirmed")] : []),
      ],
    };
    setOrders((prev) => [order, ...prev]);
    logAudit("ORDER_CREATED", "ORDERS", `${order.orderNumber} for ${customer.businessName}: ${formatCurrency(order.grandTotal)}.`);
    pushNotification({ title: "New order placed", body: `${customer.businessName} · ${order.orderNumber} (${formatCurrency(order.grandTotal)})`, module: "orders", href: `/orders/${order.id}`, tone: "info" });
    return order;
  };

  const advanceOrder = (orderId: string, status: OrderStatus, note?: string) => {
    patchOrder(orderId, (o) => ({
      ...o,
      orderStatus: status,
      deliveryChallanNumber: o.deliveryChallanNumber ?? (status === "PACKED" ? o.orderNumber.replace("ORD", "CHAL") : undefined),
      timeline: [...(o.timeline ?? []), event(status, ORDER_STATUS_META[status].label, note)],
    }));
    const o = orderById[orderId];
    if (o) logAudit("ORDER_STATUS", "ORDERS", `${o.orderNumber}: ${ORDER_STATUS_META[o.orderStatus].label} → ${ORDER_STATUS_META[status].label}.`);
  };

  const cancelOrder = (orderId: string, reason: string) => {
    const o = orderById[orderId];
    if (!o || isClosedStatus(o.orderStatus)) return;
    patchOrder(orderId, (x) => ({ ...x, orderStatus: "CANCELLED", cancelReason: reason, timeline: [...(x.timeline ?? []), event("CANCELLED", "Order cancelled", reason)] }));
    logAudit("ORDER_CANCELLED", "ORDERS", `${o.orderNumber} cancelled. Reason: ${reason}`);
    notify(`${o.orderNumber} cancelled.`, "warning");
  };

  const recordPayment: AppStoreValue["recordPayment"] = (orderId, { amount, method, reference }) => {
    const o = orderById[orderId];
    if (!o || amount <= 0) return;
    const paid = round2(Math.min(o.grandTotal, o.paidAmount + amount));
    const due = round2(Math.max(0, o.grandTotal - paid));
    patchOrder(orderId, (x) => ({
      ...x,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: due === 0 ? "PAID_COD" : "PARTIALLY_PAID",
      timeline: [...(x.timeline ?? []), event("PAYMENT", `${formatCurrency(amount)} received`, [method, reference].filter(Boolean).join(" · "))],
    }));
    logAudit("PAYMENT_RECEIVED", "ACCOUNTS", `${o.orderNumber}: ${formatCurrency(amount)} via ${method}${reference ? ` (${reference})` : ""}. Due now ${formatCurrency(due)}.`);
    notify(`${formatCurrency(amount)} recorded against ${o.orderNumber}.`);
  };

  /* ---------- delivery runs ---------- */
  const createRun = (riderId: string, orderIds: string[]): DeliveryRun | null => {
    const rider = riderById[riderId];
    const picked = orderIds.map((id) => orderById[id]).filter(Boolean);
    if (!rider || picked.length === 0) return null;

    const runId = `run-${Date.now()}`;
    const run: DeliveryRun = {
      id: runId,
      runNumber: `RUN-${stamp()}-${nextNo()}`,
      riderId,
      date: nowIso().slice(0, 10),
      orderIds: picked.map((o) => o.id),
      status: "LOADING",
      loadVerified: false,
      createdAt: nowIso(),
      createdBy: actor,
    };

    // FEFO-pick every line and take the stock out of the warehouse.
    const allocated: Record<string, Order> = {};
    for (const o of picked) {
      const items = o.items.map((l) => {
        if (l.batchAllocations?.length) return l;
        const units = l.unitsPerPack ?? inventory.itemById[l.productId]?.unitsPerPack ?? 1;
        const alloc = inventory.allocateFefo(l.productId, l.quantity * units);
        inventory.issueStock(alloc, o.orderNumber, `Dispatched on ${run.runNumber}`);
        return { ...l, unitsPerPack: units, batchAllocations: alloc };
      });
      allocated[o.id] = {
        ...o,
        items,
        orderStatus: "DISPATCHED",
        runId,
        assignedRider: rider,
        dispatchedAt: nowIso(),
        deliveryChallanNumber: o.deliveryChallanNumber ?? o.orderNumber.replace("ORD", "CHAL"),
        timeline: [...(o.timeline ?? []), event("DISPATCHED", "Dispatched", `${run.runNumber} · ${rider.name}`)],
      };
    }
    setOrders((prev) => prev.map((o) => allocated[o.id] ?? o));
    setRuns((prev) => [run, ...prev]);
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, status: "ON_DELIVERY", currentAssignedOrdersCount: r.currentAssignedOrdersCount + picked.length } : r))
    );
    logAudit("RUN_DISPATCHED", "DELIVERY", `${run.runNumber} created for ${rider.name}: ${picked.map((o) => o.orderNumber).join(", ")}. Stock issued FEFO.`);
    notify(`${run.runNumber} created for ${rider.name}. ${picked.length} stop(s), stock issued from warehouse.`);
    return run;
  };

  const verifyRunLoad = (runId: string) => {
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, loadVerified: true } : r)));
    notify("Load sheet verified.");
  };

  const startRun = (runId: string) => {
    const run = runs.find((r) => r.id === runId);
    if (!run) return;
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: "IN_PROGRESS", startedAt: nowIso(), loadVerified: true } : r)));
    setOrders((prev) =>
      prev.map((o) =>
        run.orderIds.includes(o.id) && o.orderStatus === "DISPATCHED"
          ? { ...o, orderStatus: "OUT_FOR_DELIVERY", timeline: [...(o.timeline ?? []), event("OUT_FOR_DELIVERY", "Out for delivery")] }
          : o
      )
    );
    notify(`${run.runNumber} started. Customers notified.`);
  };

  const recordDelivery = (orderId: string, outcome: DeliveryOutcome): ReturnRecord | null => {
    const o = orderById[orderId];
    if (!o) return null;
    const accepted: Record<string, { accepted: number; reason?: ReturnReason }> = {};
    for (const l of o.items) {
      if (outcome.kind === "FULL") accepted[l.id] = { accepted: l.quantity };
      else if (outcome.kind === "FAILED") accepted[l.id] = { accepted: 0, reason: outcome.failureCode ?? "REFUSED" };
      else {
        const hit = outcome.lines?.find((x) => x.orderItemId === l.id);
        accepted[l.id] = { accepted: Math.min(l.quantity, Math.max(0, hit?.accepted ?? l.quantity)), reason: hit?.reason };
      }
    }
    const items = o.items.map((l) => {
      const a = accepted[l.id];
      const returned = l.quantity - a.accepted;
      return { ...l, deliveredQuantity: a.accepted, returnedQuantity: returned, returnReason: returned > 0 ? a.reason ?? "OTHER" : undefined };
    });
    const anyReturned = items.some((l) => (l.returnedQuantity ?? 0) > 0);
    const nothingAccepted = items.every((l) => (l.deliveredQuantity ?? 0) === 0);
    const status: OrderStatus = outcome.kind === "FAILED" || nothingAccepted ? "FAILED_DELIVERY" : anyReturned ? "PARTIALLY_DELIVERED" : "DELIVERED";
    const revised = round2(items.reduce((s, l) => s + netPackPrice(l) * (l.deliveredQuantity ?? 0), 0) + (status === "FAILED_DELIVERY" ? 0 : o.deliveryCharge));
    const collected = outcome.payment.method === "CREDIT" ? 0 : Math.min(outcome.payment.amount, revised);
    const paid = round2(o.paidAmount + collected);
    const due = round2(Math.max(0, revised - paid));

    let ret: ReturnRecord | null = null;
    if (anyReturned) {
      const lines: ReturnLine[] = items
        .filter((l) => (l.returnedQuantity ?? 0) > 0)
        .map((l) => ({
          orderItemId: l.id,
          productId: l.productId,
          productName: l.productName,
          packSizeName: l.packSizeName,
          quantity: l.returnedQuantity!,
          unitPrice: netPackPrice(l),
          unitsPerPack: l.unitsPerPack ?? inventory.itemById[l.productId]?.unitsPerPack ?? 1,
          reason: l.returnReason ?? "OTHER",
          batchId: l.batchAllocations?.[l.batchAllocations.length - 1]?.batchId,
        }));
      ret = {
        id: `ret-${Date.now()}`,
        returnNumber: `RET-${stamp()}-${nextNo()}`,
        source: status === "FAILED_DELIVERY" ? "FAILED_DELIVERY" : "PARTIAL_DELIVERY",
        status: "IN_TRANSIT",
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: o.customerName,
        riderId: o.assignedRider?.id,
        runId: o.runId,
        lines,
        totalValue: round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
        note: outcome.failureReason ?? outcome.note,
        photoCount: outcome.photoCount,
        createdAt: nowIso(),
        createdBy: actor,
      };
      setReturns((prev) => [ret!, ...prev]);
    }

    const returnedSummary = items
      .filter((l) => (l.returnedQuantity ?? 0) > 0)
      .map((l) => `${l.returnedQuantity} × ${l.productName}`)
      .join(", ");

    patchOrder(orderId, (x) => ({
      ...x,
      items,
      orderStatus: status,
      originalGrandTotal: x.originalGrandTotal ?? (revised !== x.grandTotal ? x.grandTotal : undefined),
      grandTotal: revised,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: revised === 0 ? x.paymentStatus : due === 0 ? "PAID_COD" : paid > 0 ? "PARTIALLY_PAID" : "DUE",
      deliveredAt: status === "FAILED_DELIVERY" ? undefined : nowIso(),
      failureReason: outcome.failureReason,
      deliveryProof: outcome.proof
        ? { ...outcome.proof, capturedAt: nowIso(), paymentMethod: outcome.payment.method, amountCollected: collected }
        : undefined,
      timeline: [
        ...(x.timeline ?? []),
        event(status, ORDER_STATUS_META[status].label, [returnedSummary && `Returned: ${returnedSummary}`, outcome.failureReason].filter(Boolean).join(" · ") || undefined),
        ...(collected > 0 ? [event("PAYMENT" as const, `${formatCurrency(collected)} collected`, outcome.payment.method)] : []),
      ],
    }));

    // Rider holds cash only; MFS goes straight to the merchant wallet.
    const riderId = o.assignedRider?.id;
    if (riderId) {
      setRiders((prev) =>
        prev.map((r) =>
          r.id === riderId
            ? {
                ...r,
                cashInHand: r.cashInHand + (outcome.payment.method === "CASH" ? collected : 0),
                currentAssignedOrdersCount: Math.max(0, r.currentAssignedOrdersCount - 1),
              }
            : r
        )
      );
    }
    if (o.runId) {
      const run = runs.find((r) => r.id === o.runId);
      if (run) {
        const stillOpen = run.orderIds.filter((id) => id !== orderId && !isClosedStatus(orderById[id]?.orderStatus ?? "DELIVERED"));
        if (stillOpen.length === 0) setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, status: "RETURNING" } : r)));
      }
    }

    const label =
      status === "DELIVERED" ? "delivered" : status === "PARTIALLY_DELIVERED" ? "partially delivered" : "failed";
    logAudit(
      `DELIVERY_${status === "DELIVERED" ? "COMPLETED" : status === "PARTIALLY_DELIVERED" ? "PARTIAL" : "FAILED"}`,
      "DELIVERY",
      `${o.orderNumber} ${label}. Billed ${formatCurrency(revised)}, collected ${formatCurrency(collected)} (${outcome.payment.method}).${ret ? ` Return ${ret.returnNumber}: ${returnedSummary}.` : ""}`
    );
    if (ret) {
      pushNotification({
        title: status === "FAILED_DELIVERY" ? "Delivery failed" : "Partial delivery recorded",
        body: `${o.customerName}: ${returnedSummary} returning with ${o.assignedRider?.name ?? "rider"}.`,
        module: "returns",
        href: `/returns/${ret.id}`,
        tone: status === "FAILED_DELIVERY" ? "danger" : "warning",
      });
    }
    return ret;
  };

  const settleRider = (riderId: string, input: SettlementInput): RiderSettlement | null => {
    const rider = riderById[riderId];
    if (!rider) return null;
    const pending = returns.filter((r) => r.riderId === riderId && r.status === "IN_TRANSIT");
    const goodsExpected = pending.reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);
    let goodsReceived = 0;

    const updated: Record<string, ReturnRecord> = {};
    for (const r of pending) {
      const got = input.goodsReceived[r.id] ?? {};
      const lines = r.lines.map((l) => {
        const q = Math.min(l.quantity, Math.max(0, got[l.orderItemId] ?? l.quantity));
        goodsReceived += q;
        return { ...l, receivedQuantity: q };
      });
      const shortage = lines.reduce((s, l) => s + (l.quantity - (l.receivedQuantity ?? 0)), 0);
      updated[r.id] = { ...r, lines, status: "RECEIVED", receivedAt: nowIso(), receivedBy: actor, shortageQuantity: shortage };
    }

    const cashExpected = rider.cashInHand;
    const balanced = round2(input.cashReceived) === round2(cashExpected) && goodsReceived === goodsExpected;
    const settlement: RiderSettlement = {
      id: `set-${Date.now()}`,
      settlementNumber: `SET-${stamp()}-${nextNo()}`,
      riderId,
      runId: runs.find((r) => r.riderId === riderId && r.status !== "SETTLED")?.id,
      date: nowIso().slice(0, 10),
      cashExpected,
      cashReceived: input.cashReceived,
      goodsExpected,
      goodsReceived,
      status: balanced ? "BALANCED" : "SHORTAGE",
      note: input.note,
      settledBy: actor,
      settledAt: nowIso(),
    };

    setReturns((prev) => prev.map((r) => updated[r.id] ?? r));
    setSettlements((prev) => [settlement, ...prev]);
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, cashInHand: 0, status: r.currentAssignedOrdersCount > 0 ? r.status : "ON_DUTY" } : r))
    );
    setRuns((prev) =>
      prev.map((r) =>
        r.riderId === riderId && r.status === "RETURNING" ? { ...r, status: "SETTLED", settledAt: nowIso(), settlementId: settlement.id } : r
      )
    );
    logAudit(
      "RIDER_SETTLED",
      "DELIVERY",
      `${rider.name}: cash ${formatCurrency(input.cashReceived)} of ${formatCurrency(cashExpected)}, goods ${goodsReceived} of ${goodsExpected} pack(s).${balanced ? "" : " SHORTAGE flagged."}`
    );
    if (!balanced) {
      pushNotification({ title: "Rider settlement shortage", body: `${rider.name} settled with a shortage. Review ${settlement.settlementNumber}.`, module: "delivery", href: "/delivery?tab=settlement", tone: "danger" });
    }
    notify(
      balanced
        ? `${rider.name} settled. ${formatCurrency(input.cashReceived)} deposited, ${goodsReceived} pack(s) received into the returns bay.`
        : `${rider.name} settled with a shortage. Flagged for review.`,
      balanced ? "success" : "warning"
    );
    return settlement;
  };

  /* ---------- returns ---------- */
  const patchReturn = (id: string, fn: (r: ReturnRecord) => ReturnRecord) => setReturns((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));

  const receiveReturn = (returnId: string, received: Record<string, number>) => {
    const r = returns.find((x) => x.id === returnId);
    if (!r) return;
    const lines = r.lines.map((l) => ({ ...l, receivedQuantity: Math.min(l.quantity, Math.max(0, received[l.orderItemId] ?? l.quantity)) }));
    const shortage = lines.reduce((s, l) => s + (l.quantity - (l.receivedQuantity ?? 0)), 0);
    patchReturn(returnId, (x) => ({ ...x, lines, status: "RECEIVED", receivedAt: nowIso(), receivedBy: actor, shortageQuantity: shortage }));
    logAudit("RETURN_RECEIVED", "RETURNS", `${r.returnNumber}: ${lines.reduce((s, l) => s + (l.receivedQuantity ?? 0), 0)} pack(s) received${shortage ? `, ${shortage} short` : ""}.`);
    notify(`${r.returnNumber} received into the returns bay.`);
  };

  const inspectReturn = (returnId: string, decisions: Record<string, InspectionDecision>): CreditNote | null => {
    const r = returns.find((x) => x.id === returnId);
    if (!r || r.status !== "RECEIVED") return null;

    const lines = r.lines.map((l) => {
      const d = decisions[l.orderItemId] ?? { sellable: l.receivedQuantity ?? 0, damaged: 0 };
      const batchId = d.batchId ?? l.batchId;
      if (d.sellable > 0)
        inventory.receiveReturnedStock({ itemId: l.productId, batchId, quantity: d.sellable * l.unitsPerPack, condition: "SELLABLE", reference: r.returnNumber });
      if (d.damaged > 0)
        inventory.receiveReturnedStock({ itemId: l.productId, batchId, quantity: d.damaged * l.unitsPerPack, condition: d.damageCondition ?? "DAMAGED", reference: r.returnNumber });
      return { ...l, batchId, sellableQuantity: d.sellable, damagedQuantity: d.damaged, damageCondition: d.damaged > 0 ? d.damageCondition ?? "DAMAGED" : undefined };
    });

    // Delivery returns: credit for everything the customer refused (any shortage is the rider's liability).
    // Customer RMA: credit only what actually came back.
    const creditQty = (l: ReturnLine) => (r.source === "CUSTOMER_RMA" ? (l.sellableQuantity ?? 0) + (l.damagedQuantity ?? 0) : l.quantity);
    const amount = round2(lines.reduce((s, l) => s + l.unitPrice * creditQty(l), 0));
    let cn: CreditNote | null = null;
    if (amount > 0) {
      cn = {
        id: `cn-${Date.now()}`,
        creditNoteNumber: `${settings.invoice.creditNotePrefix}${stamp()}-${nextNo()}`,
        customerId: r.customerId,
        customerName: r.customerName,
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        returnId: r.id,
        amount,
        reason:
          r.source === "CUSTOMER_RMA"
            ? `Customer return: ${lines.map((l) => `${creditQty(l)} × ${l.productName}`).join(", ")}`
            : `${r.source === "FAILED_DELIVERY" ? "Failed delivery" : "Partial delivery"}: ${lines.map((l) => `${l.quantity} × ${l.productName}`).join(", ")} not accepted`,
        // Delivery returns were already deducted from the bill at the door.
        status: r.source === "CUSTOMER_RMA" ? "ISSUED" : "APPLIED",
        createdAt: nowIso(),
        createdBy: actor,
      };
      setCreditNotes((prev) => [cn!, ...prev]);
    }

    patchReturn(returnId, (x) => ({ ...x, lines, status: "COMPLETED", inspectedAt: nowIso(), inspectedBy: actor, creditNoteId: cn?.id }));
    if (r.source === "CUSTOMER_RMA") {
      patchOrder(r.orderId, (o) => ({ ...o, timeline: [...(o.timeline ?? []), event("RETURN", `Return ${r.returnNumber} completed`, cn ? `Credit note ${cn.creditNoteNumber} ${formatCurrency(cn.amount)}` : undefined)] }));
    }
    const restocked = lines.reduce((s, l) => s + (l.sellableQuantity ?? 0), 0);
    const quarantined = lines.reduce((s, l) => s + (l.damagedQuantity ?? 0), 0);
    logAudit(
      "RETURN_INSPECTED",
      "RETURNS",
      `${r.returnNumber}: ${restocked} pack(s) restocked, ${quarantined} quarantined.${cn ? ` Credit note ${cn.creditNoteNumber} ${formatCurrency(cn.amount)}.` : ""}`
    );
    notify(`${r.returnNumber} completed: ${restocked} restocked, ${quarantined} quarantined.${cn ? ` ${cn.creditNoteNumber} issued.` : ""}`);
    return cn;
  };

  const createRma = (input: RmaInput): ReturnRecord | null => {
    const o = orderById[input.orderId];
    if (!o) return null;
    const lines: ReturnLine[] = input.lines
      .filter((l) => l.quantity > 0)
      .map((l) => {
        const item = o.items.find((i) => i.id === l.orderItemId)!;
        return {
          orderItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          packSizeName: item.packSizeName,
          quantity: Math.min(l.quantity, item.deliveredQuantity ?? item.quantity),
          unitPrice: netPackPrice(item),
          unitsPerPack: item.unitsPerPack ?? inventory.itemById[item.productId]?.unitsPerPack ?? 1,
          reason: l.reason,
          batchId: item.batchAllocations?.[0]?.batchId,
        };
      });
    if (!lines.length) return null;
    const totalValue = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
    const needsApproval = totalValue >= settings.returns.approvalThreshold || !can("returns", "approve");
    const rec: ReturnRecord = {
      id: `rma-${Date.now()}`,
      returnNumber: `RMA-${stamp()}-${nextNo()}`,
      source: "CUSTOMER_RMA",
      status: needsApproval ? "REQUESTED" : "APPROVED",
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customerName: o.customerName,
      lines,
      totalValue,
      note: input.note,
      photoCount: input.photoCount,
      createdAt: nowIso(),
      createdBy: actor,
      approvedBy: needsApproval ? undefined : actor,
    };
    setReturns((prev) => [rec, ...prev]);
    logAudit("RMA_CREATED", "RETURNS", `${rec.returnNumber} for ${o.orderNumber}: ${formatCurrency(totalValue)}${needsApproval ? " (awaiting approval)" : ""}.`);
    notify(`${rec.returnNumber} ${needsApproval ? "submitted for approval" : "created and approved"}.`);
    return rec;
  };

  const approveRma = (returnId: string) => {
    const r = returns.find((x) => x.id === returnId);
    if (!r) return;
    patchReturn(returnId, (x) => ({ ...x, status: "APPROVED", approvedBy: actor }));
    logAudit("RMA_APPROVED", "RETURNS", `${r.returnNumber} approved (${formatCurrency(r.totalValue)}).`);
    notify(`${r.returnNumber} approved. Schedule a pickup.`);
  };

  const rejectRma = (returnId: string, reason: string) => {
    const r = returns.find((x) => x.id === returnId);
    if (!r) return;
    patchReturn(returnId, (x) => ({ ...x, status: "REJECTED", rejectedReason: reason }));
    logAudit("RMA_REJECTED", "RETURNS", `${r.returnNumber} rejected: ${reason}`);
    notify(`${r.returnNumber} rejected.`, "warning");
  };

  const markRmaPickedUp = (returnId: string, riderId: string) => {
    const r = returns.find((x) => x.id === returnId);
    if (!r) return;
    patchReturn(returnId, (x) => ({ ...x, status: "IN_TRANSIT", riderId }));
    logAudit("RMA_PICKUP", "RETURNS", `${r.returnNumber} picked up by ${riderById[riderId]?.name ?? riderId}.`);
    notify(`${r.returnNumber} picked up. It will be received at the rider's settlement.`);
  };

  const setCreditNoteStatus = (id: string, status: CreditNote["status"]) => {
    setCreditNotes((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    const cn = creditNotes.find((c) => c.id === id);
    if (cn) logAudit("CREDIT_NOTE_UPDATED", "ACCOUNTS", `${cn.creditNoteNumber} marked ${status.toLowerCase()}.`);
  };

  const value: AppStoreValue = {
    hydrated,
    currentUser,
    currentRole,
    login,
    logout,
    can,
    users,
    roles,
    roleById,
    saveUser,
    deleteUser,
    saveRole,
    deleteRole,
    settings,
    updateSettings,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    auditLogs,
    logAudit,
    customers,
    orders,
    orderById,
    riders,
    riderById,
    runs,
    returns,
    creditNotes,
    settlements,
    createOrder,
    advanceOrder,
    cancelOrder,
    recordPayment,
    createRun,
    verifyRunLoad,
    startRun,
    recordDelivery,
    settleRider,
    receiveReturn,
    inspectReturn,
    createRma,
    approveRma,
    rejectRma,
    markRmaPickedUp,
    setCreditNoteStatus,
    notify,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
