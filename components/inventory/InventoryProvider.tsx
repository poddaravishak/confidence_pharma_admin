"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import {
  AdjustmentReason,
  BatchHold,
  InventoryItem,
  PurchaseOrderDraft,
  StockAdjustment,
  StockBatch,
  StockCount,
  StockMovement,
  StockMovementType,
  StockTransfer,
  StockTransferLine,
  Supplier,
  Warehouse,
} from "@/lib/types";
import {
  APPROVAL_THRESHOLD,
  CURRENT_USER,
  inventoryItems,
  inventorySuppliers,
  purchaseOrderDrafts,
  stockAdjustments,
  stockBatches,
  stockCounts,
  stockMovements,
  stockTransfers,
  warehouses,
} from "@/lib/db/inventory-data";
import { ItemStock, computeItemStock, movementTypeForReason } from "@/lib/inventory";
import { withCatalogDefaults } from "@/lib/db/catalog-data";
import { defaultPurchaseLevel } from "@/lib/units";

type Toast = { id: number; message: string; tone: "success" | "warning" };

export interface OpeningStockInput {
  warehouseId: string;
  batchNumber: string;
  location: string;
  manufacturingDate: string;
  expiryDate: string;
  /** Base units */
  quantity: number;
  unitCost: number;
}
export type WarehouseFilter = "ALL" | string;

interface InventoryContextValue {
  items: InventoryItem[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  batches: StockBatch[];
  movements: StockMovement[];
  adjustments: StockAdjustment[];
  counts: StockCount[];
  transfers: StockTransfer[];
  purchaseOrders: PurchaseOrderDraft[];

  itemById: Record<string, InventoryItem>;
  batchById: Record<string, StockBatch>;
  warehouseById: Record<string, Warehouse>;
  supplierById: Record<string, Supplier>;

  warehouseFilter: WarehouseFilter;
  setWarehouseFilter: (w: WarehouseFilter) => void;
  /** Batches in the selected warehouse (or all). */
  scopedBatches: StockBatch[];
  /** Stock summary per item for the selected warehouse. */
  stockByItem: Record<string, ItemStock>;

  adjustStock: (input: { batchId: string; reason: AdjustmentReason; note: string; delta: number }) => StockAdjustment | null;
  approveAdjustment: (id: string) => void;
  rejectAdjustment: (id: string) => void;
  setBatchHold: (batchId: string, hold: BatchHold, reason?: string) => void;
  returnToSupplier: (batchId: string, quantity: number, note: string) => void;

  createCount: (title: string, warehouseId: string, category: string) => string;
  setCountedQuantity: (countId: string, batchId: string, value: number | null) => void;
  completeCount: (countId: string) => { posted: number; pending: number };

  createTransfer: (input: { fromWarehouseId: string; toWarehouseId: string; lines: StockTransferLine[]; note?: string }) => string;
  dispatchTransfer: (id: string) => void;
  receiveTransfer: (id: string) => void;
  cancelTransfer: (id: string) => void;

  createPurchaseOrders: (lines: { itemId: string; packs: number }[]) => string[];
  markPurchaseOrderSent: (id: string) => void;

  /** Catalog → inventory: register a new product, optionally with an opening-stock batch. */
  addItem: (item: InventoryItem, opening?: OpeningStockInput) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  /** FEFO allocation from sellable batches (pure, does not change stock). */
  /**
   * FEFO pick in base units. `taken` = base units already picked per batch in
   * the same operation (several lines of one product in different units).
   */
  allocateFefo: (
    itemId: string,
    baseQty: number,
    warehouseId?: string,
    taken?: Record<string, number>
  ) => { batchId: string; quantity: number }[];
  /** Take stock out of batches (dispatch). Quantities are base units. */
  issueStock: (lines: { batchId: string; quantity: number }[], reference: string, note?: string) => void;
  /** Put returned goods back. Sellable → original batch, damaged/expired → quarantine batch. */
  receiveReturnedStock: (input: {
    itemId: string;
    batchId?: string;
    quantity: number;
    condition: "SELLABLE" | "DAMAGED" | "EXPIRED";
    reference: string;
    note?: string;
  }) => void;

  notify: (message: string, tone?: Toast["tone"]) => void;
  /** Name recorded on movements/adjustments (set by the app store from the signed-in user). */
  setActor: (name: string) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside <InventoryProvider>");
  return ctx;
}

const byId = <T extends { id: string }>(list: T[]) =>
  list.reduce<Record<string, T>>((acc, x) => {
    acc[x.id] = x;
    return acc;
  }, {});

const nowIso = () => new Date().toISOString();

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  // Every item carries its full unit ladder (base unit + pack conversions).
  const [items, setItems] = useState<InventoryItem[]>(() => inventoryItems.map(withCatalogDefaults));
  const [batches, setBatches] = useState<StockBatch[]>(stockBatches);
  const [movements, setMovements] = useState<StockMovement[]>(stockMovements);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(stockAdjustments);
  const [counts, setCounts] = useState<StockCount[]>(stockCounts);
  const [transfers, setTransfers] = useState<StockTransfer[]>(stockTransfers);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDraft[]>(purchaseOrderDrafts);
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseFilter>("ALL");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const seq = useRef(100);
  const actorRef = useRef<string>(CURRENT_USER);
  const setActor = useCallback((name: string) => {
    actorRef.current = name;
  }, []);
  const next = (prefix: string) => `${prefix}${String(++seq.current).padStart(3, "0")}`;

  const itemById = useMemo(() => byId(items), [items]);
  const warehouseById = useMemo(() => byId(warehouses), []);
  const supplierById = useMemo(() => byId(inventorySuppliers), []);
  const batchById = useMemo(() => byId(batches), [batches]);

  const scopedBatches = useMemo(
    () => (warehouseFilter === "ALL" ? batches : batches.filter((b) => b.warehouseId === warehouseFilter)),
    [batches, warehouseFilter]
  );

  const stockByItem = useMemo(() => {
    const map: Record<string, ItemStock> = {};
    for (const item of items) map[item.id] = computeItemStock(item, scopedBatches);
    return map;
  }, [items, scopedBatches]);

  /* ---------- toasts ---------- */

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  /* ---------- low-level helpers ---------- */

  const changeBatchQty = (batchId: string, delta: number) =>
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, availableQuantity: Math.max(0, b.availableQuantity + delta) } : b))
    );

  const logMovement = (m: Omit<StockMovement, "id" | "date" | "performedBy"> & { performedBy?: string }) => {
    const entry: StockMovement = { id: next("mv-"), date: nowIso(), performedBy: actorRef.current, ...m };
    setMovements((prev) => [entry, ...prev]);
  };

  const applyAdjustment = (adj: Pick<StockAdjustment, "id" | "batchId" | "itemId" | "warehouseId" | "reason" | "note" | "quantityDelta">, unitCost: number) => {
    changeBatchQty(adj.batchId, adj.quantityDelta);
    logMovement({
      itemId: adj.itemId,
      batchId: adj.batchId,
      warehouseId: adj.warehouseId,
      type: movementTypeForReason(adj.reason, adj.quantityDelta),
      quantity: adj.quantityDelta,
      unitCost,
      reference: adj.id,
      note: adj.note,
    });
  };

  /* ---------- adjustments ---------- */

  const adjustStock: InventoryContextValue["adjustStock"] = ({ batchId, reason, note, delta }) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || delta === 0) return null;
    const newQuantity = Math.max(0, batch.availableQuantity + delta);
    const quantityDelta = newQuantity - batch.availableQuantity;
    if (quantityDelta === 0) return null;
    const costImpact = Math.round(quantityDelta * batch.unitCost * 100) / 100;
    const needsApproval = costImpact < 0 && Math.abs(costImpact) >= APPROVAL_THRESHOLD;

    const adj: StockAdjustment = {
      id: next("ADJ-2611-"),
      date: nowIso(),
      itemId: batch.itemId,
      batchId,
      warehouseId: batch.warehouseId,
      reason,
      note,
      quantityDelta,
      previousQuantity: batch.availableQuantity,
      newQuantity,
      costImpact,
      requestedBy: actorRef.current,
      status: needsApproval ? "PENDING" : "APPROVED",
      ...(needsApproval ? {} : { reviewedBy: actorRef.current, reviewedAt: nowIso() }),
    };
    setAdjustments((prev) => [adj, ...prev]);
    if (!needsApproval) applyAdjustment(adj, batch.unitCost);
    return adj;
  };

  const approveAdjustment = (id: string) => {
    const adj = adjustments.find((a) => a.id === id);
    if (!adj || adj.status !== "PENDING") return;
    const batch = batches.find((b) => b.id === adj.batchId);
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "APPROVED", reviewedBy: actorRef.current, reviewedAt: nowIso() } : a))
    );
    applyAdjustment(adj, batch?.unitCost ?? 0);
    notify(`${adj.id} approved and stock updated.`);
  };

  const rejectAdjustment = (id: string) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "REJECTED", reviewedBy: actorRef.current, reviewedAt: nowIso() } : a))
    );
    notify(`${id} rejected. Stock was not changed.`, "warning");
  };

  /* ---------- batch actions ---------- */

  const setBatchHold: InventoryContextValue["setBatchHold"] = (batchId, hold, reason) =>
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, hold, holdReason: hold === "NONE" ? undefined : reason } : b))
    );

  const returnToSupplier: InventoryContextValue["returnToSupplier"] = (batchId, quantity, note) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    const qty = Math.min(quantity, batch.availableQuantity);
    changeBatchQty(batchId, -qty);
    logMovement({
      itemId: batch.itemId,
      batchId,
      warehouseId: batch.warehouseId,
      type: "SUPPLIER_RETURN",
      quantity: -qty,
      unitCost: batch.unitCost,
      reference: next("SRN-2611-"),
      note,
    });
  };

  /* ---------- stock counts ---------- */

  const createCount: InventoryContextValue["createCount"] = (title, warehouseId, category) => {
    const id = next("CNT-2611-");
    const lines = batches
      .filter(
        (b) =>
          b.warehouseId === warehouseId &&
          b.availableQuantity > 0 &&
          (category === "ALL" || itemById[b.itemId]?.category === category)
      )
      .map((b) => ({ batchId: b.id, systemQuantity: b.availableQuantity, countedQuantity: null }));
    setCounts((prev) => [
      { id, title, warehouseId, createdAt: nowIso(), createdBy: actorRef.current, status: "IN_PROGRESS", lines },
      ...prev,
    ]);
    return id;
  };

  const setCountedQuantity: InventoryContextValue["setCountedQuantity"] = (countId, batchId, value) =>
    setCounts((prev) =>
      prev.map((c) =>
        c.id === countId
          ? { ...c, lines: c.lines.map((l) => (l.batchId === batchId ? { ...l, countedQuantity: value } : l)) }
          : c
      )
    );

  const completeCount: InventoryContextValue["completeCount"] = (countId) => {
    const count = counts.find((c) => c.id === countId);
    if (!count) return { posted: 0, pending: 0 };
    let posted = 0;
    let pending = 0;
    for (const line of count.lines) {
      if (line.countedQuantity === null || line.countedQuantity === line.systemQuantity) continue;
      const adj = adjustStock({
        batchId: line.batchId,
        reason: "COUNT_DISCREPANCY",
        note: `Stock count ${count.id}: counted ${line.countedQuantity}, system ${line.systemQuantity}`,
        delta: line.countedQuantity - line.systemQuantity,
      });
      if (adj?.status === "PENDING") pending++;
      else if (adj) posted++;
    }
    setCounts((prev) => prev.map((c) => (c.id === countId ? { ...c, status: "COMPLETED", completedAt: nowIso() } : c)));
    return { posted, pending };
  };

  /* ---------- transfers ---------- */

  const createTransfer: InventoryContextValue["createTransfer"] = ({ fromWarehouseId, toWarehouseId, lines, note }) => {
    const id = next("TRF-2611-");
    setTransfers((prev) => [
      { id, fromWarehouseId, toWarehouseId, status: "REQUESTED", requestedAt: nowIso(), requestedBy: actorRef.current, note, lines },
      ...prev,
    ]);
    return id;
  };

  const dispatchTransfer = (id: string) => {
    const t = transfers.find((x) => x.id === id);
    if (!t || t.status !== "REQUESTED") return;
    const short = t.lines.find((l) => (batchById[l.batchId]?.availableQuantity ?? 0) < l.quantity);
    if (short) {
      notify(`Not enough stock in batch ${batchById[short.batchId]?.batchNumber} to dispatch ${t.id}.`, "warning");
      return;
    }
    for (const l of t.lines) {
      const b = batchById[l.batchId];
      changeBatchQty(l.batchId, -l.quantity);
      logMovement({
        itemId: b.itemId,
        batchId: b.id,
        warehouseId: t.fromWarehouseId,
        type: "TRANSFER_OUT",
        quantity: -l.quantity,
        unitCost: b.unitCost,
        reference: t.id,
      });
    }
    setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status: "IN_TRANSIT", dispatchedAt: nowIso() } : x)));
    notify(`${t.id} dispatched. Stock removed from ${warehouseById[t.fromWarehouseId].name}.`);
  };

  const receiveTransfer = (id: string) => {
    const t = transfers.find((x) => x.id === id);
    if (!t || t.status !== "IN_TRANSIT") return;

    const created: StockBatch[] = [];
    const increments: Record<string, number> = {};
    const moves: Omit<StockMovement, "id" | "date" | "performedBy">[] = [];

    for (const l of t.lines) {
      const src = batchById[l.batchId];
      if (!src) continue;
      const existing =
        batches.find((b) => b.itemId === src.itemId && b.batchNumber === src.batchNumber && b.warehouseId === t.toWarehouseId) ??
        created.find((b) => b.itemId === src.itemId && b.batchNumber === src.batchNumber);
      let destId: string;
      if (existing && !created.includes(existing)) {
        increments[existing.id] = (increments[existing.id] ?? 0) + l.quantity;
        destId = existing.id;
      } else if (existing) {
        existing.availableQuantity += l.quantity;
        existing.initialQuantity += l.quantity;
        destId = existing.id;
      } else {
        destId = next("bt-");
        created.push({
          ...src,
          id: destId,
          warehouseId: t.toWarehouseId,
          location: "Receiving bay",
          receivedDate: nowIso().slice(0, 10),
          initialQuantity: l.quantity,
          availableQuantity: l.quantity,
          purchaseRef: t.id,
        });
      }
      moves.push({
        itemId: src.itemId,
        batchId: destId,
        warehouseId: t.toWarehouseId,
        type: "TRANSFER_IN" as StockMovementType,
        quantity: l.quantity,
        unitCost: src.unitCost,
        reference: t.id,
      });
    }

    setBatches((prev) => [
      ...prev.map((b) => (increments[b.id] ? { ...b, availableQuantity: b.availableQuantity + increments[b.id] } : b)),
      ...created,
    ]);
    moves.forEach((mv) => logMovement(mv));
    setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status: "RECEIVED", receivedAt: nowIso() } : x)));
    notify(`${t.id} received at ${warehouseById[t.toWarehouseId].name}.`);
  };

  const cancelTransfer = (id: string) => {
    setTransfers((prev) => prev.map((x) => (x.id === id && x.status === "REQUESTED" ? { ...x, status: "CANCELLED" } : x)));
    notify(`${id} cancelled.`, "warning");
  };

  /* ---------- purchase orders ---------- */

  const createPurchaseOrders: InventoryContextValue["createPurchaseOrders"] = (lines) => {
    const bySupplier: Record<string, PurchaseOrderDraft["lines"]> = {};
    for (const l of lines) {
      const item = itemById[l.itemId];
      if (!item || l.packs <= 0) continue;
      // Purchase lines are in the item's purchase unit (e.g. Carton = 500 Sachets).
      const unit = defaultPurchaseLevel(item);
      (bySupplier[item.supplierId] ||= []).push({
        itemId: item.id,
        packs: l.packs,
        unitCost: unit.cost,
        unitName: unit.name,
        unitsPerPack: unit.factor,
      });
    }
    const drafts: PurchaseOrderDraft[] = Object.entries(bySupplier).map(([supplierId, poLines]) => ({
      id: next("PO-2611-"),
      supplierId,
      createdAt: nowIso(),
      lines: poLines,
      status: "DRAFT",
    }));
    setPurchaseOrders((prev) => [...drafts, ...prev]);
    return drafts.map((d) => d.id);
  };

  const markPurchaseOrderSent = (id: string) =>
    setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? { ...p, status: "SENT" } : p)));

  /* ---------- catalog & order integration ---------- */

  const addItem: InventoryContextValue["addItem"] = (item, opening) => {
    setItems((prev) => [item, ...prev]);
    if (opening && opening.quantity > 0) {
      const id = next("bt-");
      setBatches((prev) => [
        ...prev,
        {
          id,
          itemId: item.id,
          warehouseId: opening.warehouseId,
          batchNumber: opening.batchNumber,
          location: opening.location || "Receiving bay",
          manufacturingDate: opening.manufacturingDate,
          expiryDate: opening.expiryDate,
          receivedDate: nowIso().slice(0, 10),
          initialQuantity: opening.quantity,
          availableQuantity: opening.quantity,
          unitCost: opening.unitCost,
          hold: "NONE",
          purchaseRef: "OPENING",
        },
      ]);
      logMovement({
        itemId: item.id,
        batchId: id,
        warehouseId: opening.warehouseId,
        type: "OPENING_STOCK",
        quantity: opening.quantity,
        unitCost: opening.unitCost,
        reference: `OPEN-${item.sku}`,
        note: "Opening stock entered with the new product",
      });
    }
  };

  const updateItem: InventoryContextValue["updateItem"] = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const allocateFefo: InventoryContextValue["allocateFefo"] = (itemId, baseQty, warehouseId = "wh-01", taken = {}) => {
    const out: { batchId: string; quantity: number }[] = [];
    let left = baseQty;
    const free = (b: StockBatch) => b.availableQuantity - (taken[b.id] ?? 0);
    const pool = batches
      .filter((b) => b.itemId === itemId && b.warehouseId === warehouseId && b.hold === "NONE" && free(b) > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    for (const b of pool) {
      if (left <= 0) break;
      const take = Math.min(left, free(b));
      out.push({ batchId: b.id, quantity: take });
      taken[b.id] = (taken[b.id] ?? 0) + take;
      left -= take;
    }
    return out;
  };

  const issueStock: InventoryContextValue["issueStock"] = (lines, reference, note) => {
    for (const l of lines) {
      const b = batchById[l.batchId];
      if (!b || l.quantity <= 0) continue;
      changeBatchQty(l.batchId, -l.quantity);
      logMovement({
        itemId: b.itemId,
        batchId: b.id,
        warehouseId: b.warehouseId,
        type: "SALE_OUT",
        quantity: -l.quantity,
        unitCost: b.unitCost,
        reference,
        note,
      });
    }
  };

  const receiveReturnedStock: InventoryContextValue["receiveReturnedStock"] = ({ itemId, batchId, quantity, condition, reference, note }) => {
    if (quantity <= 0) return;
    const item = itemById[itemId];
    const source =
      (batchId && batchById[batchId]) ||
      batches.filter((b) => b.itemId === itemId).sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0];
    if (!source) return;

    if (condition === "SELLABLE") {
      changeBatchQty(source.id, quantity);
      logMovement({
        itemId,
        batchId: source.id,
        warehouseId: source.warehouseId,
        type: "DELIVERY_RETURN_IN",
        quantity,
        unitCost: source.unitCost,
        reference,
        note: note ?? "Returned goods inspected and restocked",
      });
      return;
    }

    // Damaged or expired goods go to a quarantine batch so they never get picked.
    const id = next("bt-");
    setBatches((prev) => [
      ...prev,
      {
        ...source,
        id,
        location: "Returns quarantine (RQ-01)",
        receivedDate: nowIso().slice(0, 10),
        initialQuantity: quantity,
        availableQuantity: quantity,
        hold: "QUARANTINE",
        holdReason: `${condition === "DAMAGED" ? "Damaged" : "Expired"} return ${reference}${item ? ` (${item.name})` : ""}`,
        purchaseRef: reference,
      },
    ]);
    logMovement({
      itemId,
      batchId: id,
      warehouseId: source.warehouseId,
      type: "DELIVERY_RETURN_IN",
      quantity,
      unitCost: source.unitCost,
      reference,
      note: note ?? `Returned ${condition.toLowerCase()} goods moved to quarantine`,
    });
  };

  const value: InventoryContextValue = {
    items,
    warehouses,
    suppliers: inventorySuppliers,
    batches,
    movements,
    adjustments,
    counts,
    transfers,
    purchaseOrders,
    itemById,
    batchById,
    warehouseById,
    supplierById,
    warehouseFilter,
    setWarehouseFilter,
    scopedBatches,
    stockByItem,
    adjustStock,
    approveAdjustment,
    rejectAdjustment,
    setBatchHold,
    returnToSupplier,
    createCount,
    setCountedQuantity,
    completeCount,
    createTransfer,
    dispatchTransfer,
    receiveTransfer,
    cancelTransfer,
    createPurchaseOrders,
    markPurchaseOrderSent,
    setActor,
    addItem,
    updateItem,
    allocateFefo,
    issueStock,
    receiveReturnedStock,
    notify,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </InventoryContext.Provider>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          {t.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
          )}
          <p className="flex-1">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
