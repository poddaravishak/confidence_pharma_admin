"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, ClipboardList, Eye, EyeOff, Plus, Wand2 } from "lucide-react";
import { InventoryItem, StockBatch, StockCount, StockCountLine } from "@/lib/types";
import { formatBase, formatDateTime, plural } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, Modal, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { LevelCounts, PackCounter, QtyBreakdown, countsFromBase } from "@/components/units";

function useCountSummary(count: StockCount | undefined) {
  const { batchById } = useInventory();
  return useMemo(() => {
    if (!count) return { counted: 0, total: 0, varianceLines: 0, varianceValue: 0 };
    let counted = 0;
    let varianceLines = 0;
    let varianceValue = 0;
    for (const l of count.lines) {
      if (l.countedQuantity === null) continue;
      counted++;
      const diff = l.countedQuantity - l.systemQuantity;
      if (diff !== 0) {
        varianceLines++;
        varianceValue += diff * (batchById[l.batchId]?.unitCost ?? 0);
      }
    }
    return { counted, total: count.lines.length, varianceLines, varianceValue };
  }, [count, batchById]);
}

export default function StockCountPage() {
  const { counts, warehouseFilter } = useInventory();
  const visible = counts.filter((c) => warehouseFilter === "ALL" || c.warehouseId === warehouseFilter);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => counts.find((c) => c.status === "IN_PROGRESS")?.id ?? counts[0]?.id ?? null
  );
  const [showNew, setShowNew] = useState(false);
  const selected = visible.find((c) => c.id === selectedId) ?? visible[0];

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sessions list */}
        <Card className="h-fit overflow-hidden">
          <CardHeader
            title="Count sessions"
            actions={
              <button className={btn.primary} onClick={() => setShowNew(true)}>
                <Plus className="size-4" aria-hidden />
                New count
              </button>
            }
          />
          {visible.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No counts yet" description="Start a count for a warehouse or category." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((c) => (
                <SessionRow key={c.id} count={c} active={selected?.id === c.id} onSelect={() => setSelectedId(c.id)} />
              ))}
            </ul>
          )}
        </Card>

        {/* Detail */}
        {selected ? <CountDetail key={selected.id} count={selected} /> : <Card><EmptyState title="Select a count" /></Card>}
      </div>

      {showNew && (
        <NewCountModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setSelectedId(id);
            setShowNew(false);
          }}
        />
      )}
    </>
  );
}

function SessionRow({ count, active, onSelect }: { count: StockCount; active: boolean; onSelect: () => void }) {
  const { warehouseById } = useInventory();
  const s = useCountSummary(count);
  const pct = s.total ? Math.round((s.counted / s.total) * 100) : 0;
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active}
        className={cn("w-full px-4 py-3 text-left transition hover:bg-surface", active && "bg-brand-light/40")}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-500">{count.id}</span>
          {count.status === "COMPLETED" ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Completed</Badge>
          ) : (
            <Badge className="border-blue-200 bg-blue-50 text-brand-primary">In progress</Badge>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-apptext-primary">{count.title}</p>
        <p className="text-xs text-apptext-secondary">
          {warehouseById[count.warehouseId].name} · {formatDateTime(count.createdAt)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-apptext-secondary">
            {s.counted}/{s.total}
          </span>
        </div>
      </button>
    </li>
  );
}

function CountDetail({ count }: { count: StockCount }) {
  const { itemById, batchById, warehouseById, setCountedQuantity, completeCount, notify } = useInventory();
  const s = useCountSummary(count);
  const [blind, setBlind] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const done = count.status === "COMPLETED";

  const fillRemaining = () => {
    count.lines.forEach((l) => l.countedQuantity === null && setCountedQuantity(count.id, l.batchId, l.systemQuantity));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={count.title}
        description={
          <>
            {warehouseById[count.warehouseId].name} · started by {count.createdBy}
            {count.completedAt && ` · completed ${formatDateTime(count.completedAt)}`}
          </>
        }
        actions={
          !done && (
            <>
              <button className={btn.secondary} onClick={() => setBlind((b) => !b)} aria-pressed={blind}>
                {blind ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                {blind ? "Show system qty" : "Blind count"}
              </button>
              <button className={btn.secondary} onClick={fillRemaining} disabled={s.counted === s.total}>
                <Wand2 className="size-4" aria-hidden />
                Fill rest as matched
              </button>
            </>
          )
        }
      />

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
        <div className="p-3">
          <p className="text-xs text-apptext-secondary">Counted</p>
          <p className="text-lg font-bold tabular-nums text-apptext-primary">
            {s.counted}/{s.total}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs text-apptext-secondary">Lines with variance</p>
          <p className={cn("text-lg font-bold tabular-nums", s.varianceLines ? "text-amber-700" : "text-apptext-primary")}>
            {s.varianceLines}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs text-apptext-secondary">Net variance</p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              s.varianceValue < 0 ? "text-rose-700" : s.varianceValue > 0 ? "text-emerald-700" : "text-apptext-primary"
            )}
          >
            {s.varianceValue < 0 ? "−" : s.varianceValue > 0 ? "+" : ""}
            {formatCurrency(Math.abs(s.varianceValue))}
          </p>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,11rem)_minmax(0,9rem)] gap-4 bg-surface px-4 py-2.5 text-xs font-medium text-apptext-secondary sm:grid sm:px-5">
        <span>Product · batch · rack</span>
        {!blind && <span className="text-right">System</span>}
        {!blind && <span className="text-right">Variance</span>}
      </div>
      <ul className="divide-y divide-slate-100">
        {count.lines.map((l) => {
          const batch = batchById[l.batchId];
          return (
            <CountLineRow
              key={l.batchId}
              line={l}
              batch={batch}
              item={itemById[batch.itemId]}
              blind={blind}
              done={done}
              onCount={(value) => setCountedQuantity(count.id, l.batchId, value)}
            />
          );
        })}
      </ul>

      {!done && (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-apptext-secondary">
            {s.total - s.counted > 0
              ? `${s.total - s.counted} lines not counted yet — uncounted lines are left unchanged.`
              : "All lines counted."}
          </p>
          <button className={btn.primary} onClick={() => setConfirm(true)} disabled={s.counted === 0}>
            <ClipboardCheck className="size-4" aria-hidden />
            Complete count
          </button>
        </div>
      )}

      {confirm && (
        <Modal
          title="Complete stock count?"
          subtitle={count.title}
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirm(false)}>
                Keep counting
              </button>
              <button
                className={btn.primary}
                onClick={() => {
                  const r = completeCount(count.id);
                  notify(
                    r.posted + r.pending === 0
                      ? `${count.id} completed — no variances.`
                      : `${count.id} completed. ${r.posted} ${plural("adjustment", r.posted)} posted${
                          r.pending ? `, ${r.pending} sent for approval` : ""
                        }.`
                  );
                  setConfirm(false);
                }}
              >
                Complete & post variances
              </button>
            </>
          }
        >
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-apptext-secondary">Lines counted</span>
              <span className="font-medium tabular-nums">
                {s.counted} of {s.total}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-apptext-secondary">Adjustments to create</span>
              <span className="font-medium tabular-nums">{s.varianceLines}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-apptext-secondary">Net value change</span>
              <span className={cn("font-semibold tabular-nums", s.varianceValue < 0 ? "text-rose-700" : "text-emerald-700")}>
                {formatCurrency(s.varianceValue)}
              </span>
            </li>
          </ul>
          <p className="mt-4 rounded-lg bg-surface p-3 text-xs text-apptext-secondary">
            Each variance becomes a &ldquo;Count discrepancy&rdquo; adjustment. Large shortages go to Super Admin for approval.
          </p>
        </Modal>
      )}
    </Card>
  );
}

/**
 * One batch in a count. Staff count what is physically on the shelf in every
 * unit (cartons, boxes, loose strips, loose tablets); the total is saved in
 * base units.
 */
function CountLineRow({
  line,
  batch,
  item,
  blind,
  done,
  onCount,
}: {
  line: StockCountLine;
  batch: StockBatch;
  item: InventoryItem;
  blind: boolean;
  done: boolean;
  onCount: (base: number | null) => void;
}) {
  // Local per-unit counts keep what the user typed (e.g. 2 Boxes + 15 Strips)
  // instead of re-splitting the base total on every keystroke.
  const [typed, setTyped] = useState<LevelCounts | null>(null);
  const counts = typed ?? (line.countedQuantity === null ? {} : countsFromBase(item, line.countedQuantity));
  const diff = line.countedQuantity === null ? null : line.countedQuantity - line.systemQuantity;
  const flagged = diff !== null && diff !== 0 && !blind;

  return (
    <li className={cn("px-4 py-3 sm:px-5", flagged && "bg-amber-50/40")}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_minmax(0,9rem)] sm:gap-4">
        <div className="min-w-0">
          <p className="font-medium text-apptext-primary">{item.name}</p>
          <p className="font-mono text-xs text-slate-500">
            {batch.batchNumber} · {batch.location}
          </p>
        </div>
        {!blind && (
          <div className="min-w-0 sm:text-right">
            <p className="text-xs text-apptext-secondary sm:hidden">System</p>
            <p className="text-sm font-medium tabular-nums text-apptext-primary">{formatBase(line.systemQuantity, item)}</p>
            <QtyBreakdown base={line.systemQuantity} item={item} className="mt-1 sm:justify-end" />
          </div>
        )}
        {!blind && (
          <div className="min-w-0 tabular-nums sm:text-right">
            <p className="text-xs text-apptext-secondary sm:hidden">Variance</p>
            {diff === null ? (
              <span className="text-sm text-slate-400">Not counted</span>
            ) : diff === 0 ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" aria-hidden />
                Match
              </span>
            ) : (
              <div className={cn("text-sm font-semibold", diff < 0 ? "text-rose-700" : "text-emerald-700")}>
                {diff > 0 ? "+" : "−"}
                {formatBase(Math.abs(diff), item)}
                <QtyBreakdown base={Math.abs(diff)} item={item} className="mt-1 font-normal sm:justify-end" />
                <span className="mt-0.5 block text-xs font-normal">{formatCurrency(Math.abs(diff * batch.unitCost))}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        {done ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-apptext-secondary">Counted</span>
            {line.countedQuantity === null ? (
              <span className="text-slate-400">—</span>
            ) : (
              <>
                <span className="font-medium tabular-nums text-apptext-primary">{formatBase(line.countedQuantity, item)}</span>
                <QtyBreakdown base={line.countedQuantity} item={item} />
              </>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-apptext-primary">
                Counted on shelf
                {line.countedQuantity === null && <span className="font-normal text-slate-400"> · not counted yet</span>}
              </span>
              {line.countedQuantity !== null && (
                <button
                  type="button"
                  className="text-xs font-medium text-brand-primary hover:underline"
                  onClick={() => {
                    setTyped(null);
                    onCount(null);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <PackCounter
              item={item}
              counts={counts}
              compact
              onChange={(next, base) => {
                setTyped(next);
                onCount(base);
              }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function NewCountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { warehouses, items, batches, itemById, createCount, notify } = useInventory();
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const [warehouseId, setWarehouseId] = useState(warehouses[0].id);
  const [category, setCategory] = useState("ALL");
  const [title, setTitle] = useState("");

  const lineCount = batches.filter(
    (b) => b.warehouseId === warehouseId && b.availableQuantity > 0 && (category === "ALL" || itemById[b.itemId].category === category)
  ).length;
  const autoTitle = `${category === "ALL" ? "Full" : category} count — ${warehouses.find((w) => w.id === warehouseId)?.code}`;

  return (
    <Modal
      title="Start a stock count"
      subtitle="Snapshot current system quantities, then count what is on the shelf."
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btn.primary}
            disabled={lineCount === 0}
            onClick={() => {
              const id = createCount(title.trim() || autoTitle, warehouseId, category);
              notify(`${id} started with ${lineCount} batches to count.`);
              onCreated(id);
            }}
          >
            Start count
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Warehouse">
          {(id) => (
            <select id={id} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Category" hint={`${lineCount} batches will be included`}>
          {(id) => (
            <select id={id} value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Title (optional)">
          {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} className={inputClass} />}
        </Field>
      </div>
    </Modal>
  );
}
