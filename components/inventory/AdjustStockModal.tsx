"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Minus, Plus, ShieldCheck } from "lucide-react";
import { AdjustmentReason } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/db/inventory-data";
import { REASON_META, daysUntil, fefoSort, formatBase } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Field, Modal, btn, inputClass } from "@/components/ui";
import { QtyBreakdown, UnitQty, UnitQuantityInput, unitQtyToBase } from "@/components/units";
import { useInventory } from "./InventoryProvider";

const REASONS = Object.keys(REASON_META) as AdjustmentReason[];

export function AdjustStockModal({
  initialItemId,
  initialBatchId,
  initialReason = "COUNT_DISCREPANCY",
  initialDirection,
  initialQuantity,
  onClose,
}: {
  initialItemId?: string;
  initialBatchId?: string;
  initialReason?: AdjustmentReason;
  initialDirection?: "in" | "out";
  initialQuantity?: number;
  onClose: () => void;
}) {
  const { items, batches, batchById, itemById, warehouseById, adjustStock, notify } = useInventory();

  const startBatch = initialBatchId ? batchById[initialBatchId] : undefined;
  const [itemId, setItemId] = useState(startBatch?.itemId ?? initialItemId ?? "");
  const [batchId, setBatchId] = useState(initialBatchId ?? "");
  const [reason, setReason] = useState<AdjustmentReason>(initialReason);
  const [direction, setDirection] = useState<"in" | "out">(
    initialDirection ?? (REASON_META[initialReason].direction === "in" ? "in" : "out")
  );
  /** Entered quantity in any unit of the item; converted to base units before saving. */
  const [qtyValue, setQtyValue] = useState<UnitQty>({ qty: initialQuantity ?? 0, levelId: "base" });
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const item = itemId ? itemById[itemId] : undefined;
  const itemBatches = useMemo(
    () => batches.filter((b) => b.itemId === itemId && (b.availableQuantity > 0 || b.id === batchId)).sort(fefoSort),
    [batches, itemId, batchId]
  );
  const batch = batchId ? batchById[batchId] : undefined;

  const effectiveDirection = REASON_META[reason].direction === "both" ? direction : REASON_META[reason].direction;
  const baseQty = item ? unitQtyToBase(item, qtyValue) : 0;
  const delta = effectiveDirection === "in" ? baseQty : -baseQty;
  const newQty = batch ? Math.max(0, batch.availableQuantity + delta) : 0;
  const realDelta = batch ? newQty - batch.availableQuantity : 0;
  const costImpact = batch ? realDelta * batch.unitCost : 0;
  const needsApproval = costImpact < 0 && Math.abs(costImpact) >= APPROVAL_THRESHOLD;
  const exceeds = batch && effectiveDirection === "out" && baseQty > batch.availableQuantity;

  const errors = {
    item: !itemId ? "Choose a product" : "",
    batch: !batchId ? "Choose a batch" : "",
    qty:
      baseQty <= 0
        ? "Enter a quantity greater than 0"
        : exceeds && item
          ? `Only ${formatBase(batch!.availableQuantity, item)} in this batch`
          : "",
    note: note.trim().length < 5 ? "Add a short reason (at least 5 characters)" : "",
  };
  const valid = !errors.item && !errors.batch && !errors.qty && !errors.note;

  const pickReason = (r: AdjustmentReason) => {
    setReason(r);
    const d = REASON_META[r].direction;
    if (d !== "both") setDirection(d);
    if (r === "EXPIRED_DISPOSAL" && batch) setQtyValue({ qty: batch.availableQuantity, levelId: "base" });
  };

  const submit = () => {
    setTouched(true);
    if (!valid || !batch || !item) return;
    const adj = adjustStock({ batchId: batch.id, reason, note: note.trim(), delta });
    if (!adj) return;
    notify(
      adj.status === "PENDING"
        ? `${adj.id} sent for approval — ${formatCurrency(Math.abs(adj.costImpact))} write-off.`
        : `${adj.id} saved. ${item.name} is now ${formatBase(adj.newQuantity, item)} in batch ${batch.batchNumber}.`,
      adj.status === "PENDING" ? "warning" : "success"
    );
    onClose();
  };

  return (
    <Modal
      title="Adjust stock"
      subtitle="Every adjustment is logged with your name, the reason and the cost impact."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary} disabled={touched && !valid}>
            {needsApproval ? "Submit for approval" : "Save adjustment"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Product & batch */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" error={touched ? errors.item : undefined}>
            {(id) => (
              <select
                id={id}
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setBatchId("");
                  setQtyValue((v) => ({ ...v, levelId: "base" }));
                }}
                className={inputClass}
              >
                <option value="">Select product…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Batch"
            error={touched ? errors.batch : undefined}
            hint={item ? "Earliest expiry first (FEFO)" : undefined}
          >
            {(id) => (
              <select
                id={id}
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className={inputClass}
                disabled={!item}
              >
                <option value="">{item ? "Select batch…" : "Choose a product first"}</option>
                {itemBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} · {warehouseById[b.warehouseId].code} · {formatBase(b.availableQuantity, item!)} ·
                    exp {b.expiryDate}
                    {daysUntil(b.expiryDate) < 0 ? " (expired)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {/* Reason */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Reason</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "cursor-pointer rounded-lg border p-2.5 transition",
                  reason === r ? "border-brand-primary bg-brand-light/30 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <input type="radio" name="reason" className="sr-only" checked={reason === r} onChange={() => pickReason(r)} />
                <span className="block text-sm font-medium text-apptext-primary">{REASON_META[r].label}</span>
                <span className="block text-xs text-apptext-secondary">{REASON_META[r].hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Quantity */}
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div>
            <p className="mb-1.5 text-sm font-medium text-apptext-primary">Direction</p>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(["out", "in"] as const).map((d) => {
                const disabled = REASON_META[reason].direction !== "both" && REASON_META[reason].direction !== d;
                const active = effectiveDirection === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDirection(d)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                      active ? (d === "out" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {d === "out" ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                    {d === "out" ? "Remove" : "Add"}
                  </button>
                );
              })}
            </div>
          </div>
          <Field
            label="Quantity"
            error={touched ? errors.qty : undefined}
          >
            {(id) =>
              item ? (
                <UnitQuantityInput
                  item={item}
                  value={qtyValue}
                  onChange={setQtyValue}
                  invalid={touched && Boolean(errors.qty)}
                  maxBase={batch && effectiveDirection === "out" ? batch.availableQuantity : undefined}
                />
              ) : (
                <input id={id} type="number" disabled placeholder="Choose a product first" className={cn(inputClass, "tabular-nums")} />
              )
            }
          </Field>
        </div>

        <Field label="Note" error={touched ? errors.note : undefined} hint="What happened? This goes into the audit log.">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 2 boxes crushed under pallet in rack A-02"
              className={inputClass}
            />
          )}
        </Field>

        {/* Summary */}
        {batch && item && baseQty > 0 && (
          <div className="rounded-xl bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div>
                <p className="text-xs text-apptext-secondary">Current</p>
                <p className="font-semibold tabular-nums text-apptext-primary">{formatBase(batch.availableQuantity, item)}</p>
                <QtyBreakdown base={batch.availableQuantity} item={item} className="mt-1" />
              </div>
              <ArrowRight className="size-4 text-slate-400" aria-hidden />
              <div>
                <p className="text-xs text-apptext-secondary">After</p>
                <p className="font-semibold tabular-nums text-apptext-primary">{formatBase(newQty, item)}</p>
                <QtyBreakdown base={newQty} item={item} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-apptext-secondary">Change</p>
                <p className={cn("font-semibold tabular-nums", realDelta < 0 ? "text-rose-700" : "text-emerald-700")}>
                  {realDelta < 0 ? "−" : "+"}
                  {formatBase(Math.abs(realDelta), item)}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-apptext-secondary">Cost impact</p>
                <p className={cn("font-semibold tabular-nums", costImpact < 0 ? "text-rose-700" : "text-emerald-700")}>
                  {costImpact < 0 ? "−" : "+"}
                  {formatCurrency(Math.abs(costImpact))}
                </p>
              </div>
            </div>
            {needsApproval ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
                Write-offs of {formatCurrency(APPROVAL_THRESHOLD)} or more need Super Admin approval. Stock will change once
                it is approved.
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-xs text-apptext-secondary">
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
                Applied immediately and recorded in the stock ledger.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
