"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleSlash, PackageX, RotateCcw, ShieldCheck, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { AdjustmentReason, StockBatch } from "@/lib/types";
import {
  BATCH_STATE_META,
  EXPIRY_META,
  ExpiryBucket,
  batchState,
  daysUntil,
  expiryBucket,
  fefoSort,
  formatBase,
  formatPacks,
  plural,
} from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, EmptyState, Field, FilterPills, Modal, SearchInput, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { AdjustStockModal } from "@/components/inventory/AdjustStockModal";
import { ColdChainTag, ExpiryBadge } from "@/components/inventory/shared";

type View = "ALL" | ExpiryBucket | "ON_HOLD";
const BUCKETS: ExpiryBucket[] = ["EXPIRED", "UNDER_30", "UNDER_60", "UNDER_90", "SAFE"];

export default function BatchesPage() {
  return (
    <Suspense>
      <BatchesView />
    </Suspense>
  );
}

function BatchesView() {
  const params = useSearchParams();
  const { scopedBatches, itemById, warehouseById, supplierById, setBatchHold, returnToSupplier, notify } = useInventory();

  const [view, setView] = useState<View>((params.get("view") as View) || "ALL");
  const [query, setQuery] = useState("");
  const [adjust, setAdjust] = useState<{ batchId: string; reason?: AdjustmentReason; qty?: number } | null>(null);
  const [holdFor, setHoldFor] = useState<StockBatch | null>(null);
  const [releaseFor, setReleaseFor] = useState<StockBatch | null>(null);
  const [returnFor, setReturnFor] = useState<StockBatch | null>(null);

  const live = useMemo(() => scopedBatches.filter((b) => b.availableQuantity > 0), [scopedBatches]);

  const summary = useMemo(() => {
    const s = Object.fromEntries(BUCKETS.map((k) => [k, { count: 0, value: 0 }])) as Record<ExpiryBucket, { count: number; value: number }>;
    let total = 0;
    for (const b of live) {
      const k = expiryBucket(daysUntil(b.expiryDate));
      const v = b.availableQuantity * b.unitCost;
      s[k].count++;
      s[k].value += v;
      total += v;
    }
    return { buckets: s, total };
  }, [live]);

  const heldCount = live.filter((b) => batchState(b) === "ON_HOLD").length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live
      .filter((b) => {
        if (view === "ON_HOLD") return batchState(b) === "ON_HOLD";
        if (view !== "ALL" && expiryBucket(daysUntil(b.expiryDate)) !== view) return false;
        if (!q) return true;
        const item = itemById[b.itemId];
        return [b.batchNumber, item.name, item.genericName, b.location].some((f) => f.toLowerCase().includes(q));
      })
      .sort(fefoSort);
  }, [live, view, query, itemById]);

  return (
    <>
      {/* Expiry buckets */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-apptext-primary">Expiry profile</h2>
          <p className="text-sm text-apptext-secondary">
            {formatCurrency(summary.total)} across {live.length} batches
          </p>
        </div>
        <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
          {BUCKETS.map((k) =>
            summary.buckets[k].value > 0 ? (
              <div
                key={k}
                className={EXPIRY_META[k].bar}
                style={{ width: `${(summary.buckets[k].value / Math.max(1, summary.total)) * 100}%` }}
              />
            ) : null
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BUCKETS.map((k) => {
            const active = view === k;
            return (
              <button
                key={k}
                onClick={() => setView(active ? "ALL" : k)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-3 text-left transition hover:bg-surface",
                  active ? "border-brand-primary ring-1 ring-brand-primary" : "border-slate-200"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-apptext-secondary">
                  <span className={cn("size-2 rounded-full", EXPIRY_META[k].dot)} aria-hidden />
                  {EXPIRY_META[k].short}
                </span>
                <span className="mt-1 block text-lg font-bold tabular-nums text-apptext-primary">
                  {summary.buckets[k].count}{" "}
                  <span className="text-sm font-normal text-apptext-secondary">{plural("batch", summary.buckets[k].count)}</span>
                </span>
                <span className="block text-xs tabular-nums text-apptext-secondary">{formatCurrency(summary.buckets[k].value)}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterPills
            label="Filter batches"
            value={view}
            onChange={setView}
            options={[
              { id: "ALL", label: "All batches", count: live.length },
              { id: "EXPIRED", label: "Expired", count: summary.buckets.EXPIRED.count },
              { id: "UNDER_30", label: "≤ 30 days", count: summary.buckets.UNDER_30.count },
              { id: "UNDER_60", label: "31–60 days", count: summary.buckets.UNDER_60.count },
              { id: "UNDER_90", label: "61–90 days", count: summary.buckets.UNDER_90.count },
              { id: "ON_HOLD", label: "On hold", count: heldCount },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="Search batch, product or rack" className="lg:w-72" />
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No batches here" description="Nothing matches this filter in the selected warehouse." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2.5">Batch</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Where</th>
                  <th className="px-3 py-2.5">Expiry</th>
                  <th className="px-3 py-2.5 text-right">Remaining</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => {
                  const item = itemById[b.itemId];
                  const st = batchState(b);
                  const days = daysUntil(b.expiryDate);
                  const usedPct = Math.round((b.availableQuantity / Math.max(1, b.initialQuantity)) * 100);
                  return (
                    <tr key={b.id} className={cn("align-top transition hover:bg-surface/60", st === "EXPIRED" && "bg-rose-50/40")}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-apptext-primary">{b.batchNumber}</p>
                        <p className="text-xs text-slate-500">Mfg {b.manufacturingDate}</p>
                        {b.purchaseRef && <p className="font-mono text-xs text-slate-400">{b.purchaseRef}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-apptext-primary">{item.name}</p>
                        <p className="text-xs text-apptext-secondary">{item.genericName}</p>
                        {item.isColdChain && <div className="mt-1"><ColdChainTag /></div>}
                      </td>
                      <td className="px-3 py-3 text-xs text-apptext-secondary">
                        <p className="font-medium text-apptext-primary">{warehouseById[b.warehouseId].name}</p>
                        <p>Rack {b.location}</p>
                      </td>
                      <td className="px-3 py-3">
                        <ExpiryBadge date={b.expiryDate} showDate />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <p className="font-semibold text-apptext-primary">{formatBase(b.availableQuantity, item)}</p>
                        <p className="text-xs text-slate-500">{formatPacks(b.availableQuantity, item)}</p>
                        <p className="text-xs text-slate-400">{usedPct}% of {b.initialQuantity.toLocaleString("en-US")} received</p>
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-apptext-primary">
                        {formatCurrency(b.availableQuantity * b.unitCost)}
                        <p className="text-xs font-normal text-slate-500">{formatCurrency(b.unitCost)} each</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={BATCH_STATE_META[st].badge}>{BATCH_STATE_META[st].label}</Badge>
                        {b.holdReason && st === "ON_HOLD" && (
                          <p className="mt-1 max-w-[180px] text-xs text-violet-700">{b.holdReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {st === "EXPIRED" && (
                            <>
                              <button
                                className={cn(btn.small, "border-rose-200 text-rose-700 hover:bg-rose-50")}
                                onClick={() => setAdjust({ batchId: b.id, reason: "EXPIRED_DISPOSAL", qty: b.availableQuantity })}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                Dispose
                              </button>
                              <button className={btn.small} onClick={() => setReturnFor(b)}>
                                <Undo2 className="size-3.5" aria-hidden />
                                Return
                              </button>
                            </>
                          )}
                          {st === "ON_HOLD" && (
                            <>
                              <button className={cn(btn.small, "border-emerald-200 text-emerald-700 hover:bg-emerald-50")} onClick={() => setReleaseFor(b)}>
                                <ShieldCheck className="size-3.5" aria-hidden />
                                Release
                              </button>
                              <button className={btn.small} onClick={() => setReturnFor(b)}>
                                <Undo2 className="size-3.5" aria-hidden />
                                Return
                              </button>
                            </>
                          )}
                          {st === "AVAILABLE" && (
                            <>
                              <button className={btn.small} onClick={() => setAdjust({ batchId: b.id })}>
                                <SlidersHorizontal className="size-3.5" aria-hidden />
                                Adjust
                              </button>
                              {days <= 90 ? (
                                <button className={btn.small} onClick={() => setReturnFor(b)}>
                                  <Undo2 className="size-3.5" aria-hidden />
                                  Return
                                </button>
                              ) : (
                                <button className={btn.small} onClick={() => setHoldFor(b)}>
                                  <CircleSlash className="size-3.5" aria-hidden />
                                  Hold
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adjust && (
        <AdjustStockModal
          initialBatchId={adjust.batchId}
          initialReason={adjust.reason}
          initialQuantity={adjust.qty}
          onClose={() => setAdjust(null)}
        />
      )}

      {holdFor && (
        <HoldModal
          title="Put batch on hold"
          batch={holdFor}
          label="Why is this batch on hold?"
          placeholder="e.g. Customer complaint — tablets discoloured, awaiting QC"
          confirm="Put on hold"
          onClose={() => setHoldFor(null)}
          onConfirm={(reason) => {
            setBatchHold(holdFor.id, "QUARANTINE", reason);
            notify(`Batch ${holdFor.batchNumber} is on hold and can no longer be sold.`, "warning");
            setHoldFor(null);
          }}
        />
      )}

      {releaseFor && (
        <HoldModal
          title="Release batch for sale"
          batch={releaseFor}
          label="QC result"
          placeholder="e.g. QC passed — seal intact, tablets OK (QC-2611-04)"
          confirm="Release for sale"
          onClose={() => setReleaseFor(null)}
          onConfirm={() => {
            setBatchHold(releaseFor.id, "NONE");
            notify(`Batch ${releaseFor.batchNumber} released and now sellable.`);
            setReleaseFor(null);
          }}
        />
      )}

      {returnFor && (
        <ReturnModal
          batch={returnFor}
          supplierName={supplierById[itemById[returnFor.itemId].supplierId]?.name ?? "supplier"}
          onClose={() => setReturnFor(null)}
          onConfirm={(qty, note) => {
            returnToSupplier(returnFor.id, qty, note);
            notify(`${qty.toLocaleString("en-US")} units of ${returnFor.batchNumber} returned to supplier.`);
            setReturnFor(null);
          }}
        />
      )}
    </>
  );
}

function HoldModal({
  title,
  batch,
  label,
  placeholder,
  confirm,
  onClose,
  onConfirm,
}: {
  title: string;
  batch: StockBatch;
  label: string;
  placeholder: string;
  confirm: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { itemById } = useInventory();
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={title}
      subtitle={
        <>
          <span className="font-mono">{batch.batchNumber}</span> · {itemById[batch.itemId].name}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} disabled={reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>
            {confirm}
          </button>
        </>
      }
    >
      <Field label={label}>
        {(id) => (
          <textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} className={inputClass} />
        )}
      </Field>
    </Modal>
  );
}

function ReturnModal({
  batch,
  supplierName,
  onClose,
  onConfirm,
}: {
  batch: StockBatch;
  supplierName: string;
  onClose: () => void;
  onConfirm: (qty: number, note: string) => void;
}) {
  const { itemById } = useInventory();
  const item = itemById[batch.itemId];
  const [qty, setQty] = useState(String(batch.availableQuantity));
  const [note, setNote] = useState("");
  const n = Math.floor(Number(qty) || 0);
  const valid = n > 0 && n <= batch.availableQuantity && note.trim().length >= 5;
  return (
    <Modal
      title="Return to supplier"
      subtitle={
        <>
          <span className="font-mono">{batch.batchNumber}</span> · {item.name} → {supplierName}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} disabled={!valid} onClick={() => onConfirm(n, note.trim())}>
            <RotateCcw className="size-4" aria-hidden />
            Create return note
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={`Quantity (${item.baseUnit.toLowerCase()}s)`}
          hint={`${formatBase(batch.availableQuantity, item)} available · value ${formatCurrency(n * batch.unitCost)}`}
          error={n > batch.availableQuantity ? "More than available in this batch" : undefined}
        >
          {(id) => <input id={id} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={cn(inputClass, "tabular-nums")} />}
        </Field>
        <Field label="Reason" hint="Shown on the supplier return note (SRN).">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Short-dated stock, credit note agreed with depot"
              className={inputClass}
            />
          )}
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-apptext-secondary">
          <PackageX className="mt-px size-4 shrink-0 text-slate-400" aria-hidden />
          Stock leaves inventory now. The supplier credit is settled from Suppliers &amp; Payables.
        </p>
      </div>
    </Modal>
  );
}
