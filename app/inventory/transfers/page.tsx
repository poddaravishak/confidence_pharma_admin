"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, PackageCheck, Plus, Snowflake, Trash2, Truck, Warehouse as WarehouseIcon, X } from "lucide-react";
import { StockTransfer, StockTransferLine, TransferStatus } from "@/lib/types";
import { TRANSFER_META, batchState, fefoSort, formatBase, formatDateTime } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, FilterPills, Modal, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";

type View = "OPEN" | "ALL" | TransferStatus;
const STEPS: TransferStatus[] = ["REQUESTED", "IN_TRANSIT", "RECEIVED"];

export default function TransfersPage() {
  const { warehouses, batches, transfers, warehouseFilter, dispatchTransfer, receiveTransfer, cancelTransfer } = useInventory();
  const [view, setView] = useState<View>("OPEN");
  const [showNew, setShowNew] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<StockTransfer | null>(null);

  const whStats = useMemo(
    () =>
      Object.fromEntries(
        warehouses.map((w) => {
          const live = batches.filter((b) => b.warehouseId === w.id && b.availableQuantity > 0);
          return [
            w.id,
            {
              value: live.reduce((s, b) => s + b.availableQuantity * b.unitCost, 0),
              skus: new Set(live.map((b) => b.itemId)).size,
              batches: live.length,
            },
          ];
        })
      ),
    [warehouses, batches]
  );

  // Newest first: the store prepends new records, so keep insertion order.
  const scoped = transfers.filter(
    (t) => warehouseFilter === "ALL" || t.fromWarehouseId === warehouseFilter || t.toWarehouseId === warehouseFilter
  );
  const isOpen = (t: StockTransfer) => t.status === "REQUESTED" || t.status === "IN_TRANSIT";
  const rows = scoped.filter((t) => (view === "ALL" ? true : view === "OPEN" ? isOpen(t) : t.status === view));
  const count = (v: View) => scoped.filter((t) => (v === "ALL" ? true : v === "OPEN" ? isOpen(t) : t.status === v)).length;

  return (
    <>
      {/* Warehouses */}
      <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {warehouses.map((w) => (
          <Card key={w.id} className={cn("p-4", warehouseFilter === w.id && "border-brand-primary ring-1 ring-brand-primary")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-brand-light p-2 text-brand-primary">
                  <WarehouseIcon className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-apptext-primary">{w.name}</p>
                  <p className="text-xs text-apptext-secondary">Manager: {w.managerName}</p>
                </div>
              </div>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{w.code}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-xs text-apptext-secondary">Value</dt>
                <dd className="text-sm font-semibold tabular-nums">{formatCurrency(whStats[w.id].value)}</dd>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-xs text-apptext-secondary">Products</dt>
                <dd className="text-sm font-semibold tabular-nums">{whStats[w.id].skus}</dd>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-xs text-apptext-secondary">Batches</dt>
                <dd className="text-sm font-semibold tabular-nums">{whStats[w.id].batches}</dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {w.isPrimary && <Badge className="border-blue-200 bg-blue-50 text-brand-primary">Primary</Badge>}
              {w.hasColdRoom && (
                <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                  <Snowflake className="size-3" aria-hidden />
                  Cold room
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Stock transfers"
          description="Move stock between warehouses. Stock leaves on dispatch and arrives on receipt."
          actions={
            <button className={btn.primary} onClick={() => setShowNew(true)}>
              <Plus className="size-4" aria-hidden />
              New transfer
            </button>
          }
        />
        <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
          <FilterPills
            label="Transfer status"
            value={view}
            onChange={setView}
            options={[
              { id: "OPEN", label: "Open", count: count("OPEN") },
              { id: "RECEIVED", label: "Received", count: count("RECEIVED") },
              { id: "CANCELLED", label: "Cancelled", count: count("CANCELLED") },
              { id: "ALL", label: "All", count: count("ALL") },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Truck} title="No transfers" description="Nothing matches this filter." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => (
              <TransferRow
                key={t.id}
                transfer={t}
                onDispatch={() => dispatchTransfer(t.id)}
                onReceive={() => receiveTransfer(t.id)}
                onCancel={() => setConfirmCancel(t)}
              />
            ))}
          </ul>
        )}
      </Card>

      {showNew && <NewTransferModal onClose={() => setShowNew(false)} />}

      {confirmCancel && (
        <Modal
          title="Cancel transfer?"
          subtitle={<span className="font-mono">{confirmCancel.id}</span>}
          onClose={() => setConfirmCancel(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmCancel(null)}>
                Keep it
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  cancelTransfer(confirmCancel.id);
                  setConfirmCancel(null);
                }}
              >
                Cancel transfer
              </button>
            </>
          }
        >
          <p className="text-sm text-apptext-secondary">No stock has moved yet, so nothing changes in inventory.</p>
        </Modal>
      )}
    </>
  );
}

function TransferRow({
  transfer: t,
  onDispatch,
  onReceive,
  onCancel,
}: {
  transfer: StockTransfer;
  onDispatch: () => void;
  onReceive: () => void;
  onCancel: () => void;
}) {
  const { warehouseById, batchById, itemById } = useInventory();
  const step = STEPS.indexOf(t.status);
  const value = t.lines.reduce((s, l) => s + l.quantity * (batchById[l.batchId]?.unitCost ?? 0), 0);

  return (
    <li className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-brand-primary">{t.id}</span>
          <Badge className={TRANSFER_META[t.status].badge}>{TRANSFER_META[t.status].label}</Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium text-apptext-primary">
          {warehouseById[t.fromWarehouseId].name}
          <ArrowRight className="size-4 text-slate-400" aria-hidden />
          {warehouseById[t.toWarehouseId].name}
        </p>
        <p className="text-xs text-apptext-secondary">
          Requested by {t.requestedBy} · {formatDateTime(t.requestedAt)}
        </p>
        {t.note && <p className="mt-1 text-xs text-apptext-secondary">“{t.note}”</p>}
      </div>

      <ul className="space-y-1 text-sm xl:col-span-4">
        {t.lines.map((l) => {
          const b = batchById[l.batchId];
          const item = b ? itemById[b.itemId] : undefined;
          return (
            <li key={l.batchId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-apptext-primary">
                {item?.name} <span className="font-mono text-xs text-slate-500">{b?.batchNumber}</span>
              </span>
              <span className="whitespace-nowrap tabular-nums text-apptext-secondary">{item ? formatBase(l.quantity, item) : l.quantity}</span>
            </li>
          );
        })}
        <li className="flex justify-between border-t border-slate-100 pt-1 text-xs text-apptext-secondary">
          <span>Value</span>
          <span className="tabular-nums">{formatCurrency(value)}</span>
        </li>
      </ul>

      <div className="flex flex-col gap-3 xl:col-span-4 xl:items-end">
        {t.status !== "CANCELLED" && (
          <ol className="flex items-center gap-1.5 text-xs" aria-label="Transfer progress">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn("flex items-center gap-1", i <= step ? "font-medium text-apptext-primary" : "text-slate-400")}>
                  <span className={cn("size-2 rounded-full", i <= step ? (t.status === "RECEIVED" ? "bg-brand-green" : "bg-brand-primary") : "bg-slate-200")} />
                  {TRANSFER_META[s].label}
                </span>
                {i < STEPS.length - 1 && <span className={cn("h-px w-4", i < step ? "bg-brand-primary/50" : "bg-slate-200")} />}
              </li>
            ))}
          </ol>
        )}
        {(t.dispatchedAt || t.receivedAt) && (
          <p className="text-xs text-apptext-secondary">
            {t.dispatchedAt && `Dispatched ${formatDateTime(t.dispatchedAt)}`}
            {t.receivedAt && ` · Received ${formatDateTime(t.receivedAt)}`}
          </p>
        )}
        <div className="flex gap-2">
          {t.status === "REQUESTED" && (
            <>
              <button className={btn.secondary} onClick={onCancel}>
                <X className="size-4" aria-hidden />
                Cancel
              </button>
              <button className={btn.primary} onClick={onDispatch}>
                <Truck className="size-4" aria-hidden />
                Dispatch
              </button>
            </>
          )}
          {t.status === "IN_TRANSIT" && (
            <button className={btn.success} onClick={onReceive}>
              <PackageCheck className="size-4" aria-hidden />
              Mark received
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function NewTransferModal({ onClose }: { onClose: () => void }) {
  const { warehouses, batches, itemById, warehouseById, createTransfer, notify } = useInventory();
  const [from, setFrom] = useState(warehouses[0].id);
  const [to, setTo] = useState(warehouses[1].id);
  const [lines, setLines] = useState<(StockTransferLine & { key: number })[]>([{ key: 1, batchId: "", quantity: 0 }]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const sourceBatches = useMemo(
    () => batches.filter((b) => b.warehouseId === from && batchState(b) === "AVAILABLE").sort(fefoSort),
    [batches, from]
  );
  const dest = warehouseById[to];

  const lineErrors = lines.map((l) => {
    const b = batches.find((x) => x.id === l.batchId);
    if (!b) return "Choose a batch";
    if (l.quantity <= 0) return "Enter a quantity";
    if (l.quantity > b.availableQuantity) return `Only ${b.availableQuantity.toLocaleString("en-US")} available`;
    if (itemById[b.itemId].isColdChain && !dest.hasColdRoom) return `${dest.name} has no cold room`;
    return "";
  });
  const valid = from !== to && lineErrors.every((e) => !e) && new Set(lines.map((l) => l.batchId)).size === lines.length;

  const setLine = (key: number, patch: Partial<StockTransferLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const id = createTransfer({
      fromWarehouseId: from,
      toWarehouseId: to,
      lines: lines.map(({ batchId, quantity }) => ({ batchId, quantity })),
      note: note.trim() || undefined,
    });
    notify(`${id} requested. Dispatch it when the stock is loaded.`);
    onClose();
  };

  return (
    <Modal
      title="New stock transfer"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={submit} disabled={touched && !valid}>
            Request transfer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="From">
            {(id) => (
              <select
                id={id}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setLines([{ key: Date.now(), batchId: "", quantity: 0 }]);
                }}
                className={inputClass}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <ArrowRight className="mb-2.5 hidden size-4 text-slate-400 sm:block" aria-hidden />
          <Field label="To" error={from === to ? "Choose a different warehouse" : undefined}>
            {(id) => (
              <select id={id} value={to} onChange={(e) => setTo(e.target.value)} className={inputClass}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.hasColdRoom ? " (cold room)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-apptext-primary">Items</p>
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const b = batches.find((x) => x.id === l.batchId);
              const item = b ? itemById[b.itemId] : undefined;
              return (
                <div key={l.key} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label="Batch"
                      value={l.batchId}
                      onChange={(e) => setLine(l.key, { batchId: e.target.value })}
                      className={cn(inputClass, "flex-1")}
                    >
                      <option value="">Select product batch…</option>
                      {sourceBatches.map((sb) => (
                        <option key={sb.id} value={sb.id}>
                          {itemById[sb.itemId].name} · {sb.batchNumber} · {sb.availableQuantity.toLocaleString("en-US")} avail.
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        aria-label="Quantity"
                        value={l.quantity || ""}
                        placeholder="Qty"
                        onChange={(e) => setLine(l.key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className={cn(inputClass, "w-28 text-right tabular-nums")}
                      />
                      <button
                        aria-label="Remove line"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="rounded-lg border border-slate-200 px-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-xs">
                    <span className="text-apptext-secondary">
                      {item && b ? `${formatBase(l.quantity, item)} · ${formatCurrency(l.quantity * b.unitCost)}` : ""}
                    </span>
                    {touched && lineErrors[idx] && <span className="text-rose-600">{lineErrors[idx]}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className={cn(btn.ghost, "mt-2")}
            onClick={() => setLines((ls) => [...ls, { key: Date.now(), batchId: "", quantity: 0 }])}
          >
            <Plus className="size-4" aria-hidden />
            Add item
          </button>
        </div>

        <Field label="Note (optional)">
          {(id) => (
            <input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Weekend stock for Mirpur orders" className={inputClass} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
