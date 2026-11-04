"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, ClipboardList, Eye, EyeOff, Plus, Wand2 } from "lucide-react";
import { StockCount } from "@/lib/types";
import { formatDateTime, formatPacks, plural } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, Modal, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";

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
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-surface text-xs font-medium text-apptext-secondary">
            <tr>
              <th className="px-4 py-2.5">Product · batch</th>
              <th className="px-3 py-2.5">Rack</th>
              {!blind && <th className="px-3 py-2.5 text-right">System</th>}
              <th className="px-3 py-2.5 text-right">Counted</th>
              {!blind && <th className="px-4 py-2.5 text-right">Variance</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {count.lines.map((l) => {
              const batch = batchById[l.batchId];
              const item = itemById[batch.itemId];
              const diff = l.countedQuantity === null ? null : l.countedQuantity - l.systemQuantity;
              return (
                <tr key={l.batchId} className={cn(diff !== null && diff !== 0 && !blind && "bg-amber-50/40")}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-apptext-primary">{item.name}</p>
                    <p className="font-mono text-xs text-slate-500">{batch.batchNumber}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-apptext-secondary">{batch.location}</td>
                  {!blind && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-apptext-secondary">
                      {l.systemQuantity.toLocaleString("en-US")}
                      <span className="block text-xs">{formatPacks(l.systemQuantity, item)}</span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    {done ? (
                      <span className="font-medium tabular-nums">{l.countedQuantity?.toLocaleString("en-US") ?? "—"}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Counted quantity for ${item.name} ${batch.batchNumber}`}
                        value={l.countedQuantity ?? ""}
                        onChange={(e) =>
                          setCountedQuantity(count.id, l.batchId, e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))
                        }
                        placeholder="—"
                        className={cn(inputClass, "ml-auto w-28 text-right tabular-nums")}
                      />
                    )}
                    <span className="mt-0.5 block text-xs text-slate-400">{item.baseUnit.toLowerCase()}s</span>
                  </td>
                  {!blind && (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {diff === null ? (
                        <span className="text-slate-400">Not counted</span>
                      ) : diff === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="size-4" aria-hidden />
                          Match
                        </span>
                      ) : (
                        <span className={cn("font-semibold", diff < 0 ? "text-rose-700" : "text-emerald-700")}>
                          {diff > 0 ? "+" : "−"}
                          {Math.abs(diff).toLocaleString("en-US")}
                          <span className="block text-xs font-normal">
                            {formatCurrency(Math.abs(diff * batch.unitCost))}
                          </span>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
