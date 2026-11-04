"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FileText, PackageCheck, Phone, Send, ShoppingBag } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { formatBase, formatDateTime, plural, suggestedReorderPacks } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { StockStatusBadge } from "@/components/inventory/shared";

export default function ReorderPage() {
  return (
    <Suspense>
      <ReorderView />
    </Suspense>
  );
}

function ReorderView() {
  const params = useSearchParams();
  const focusItem = params.get("item");
  const { items, stockByItem, supplierById, itemById, purchaseOrders, createPurchaseOrders, markPurchaseOrderSent, notify } =
    useInventory();

  const [showAll, setShowAll] = useState(() => !!focusItem && stockByItem[focusItem]?.status === "IN_STOCK");

  const candidates = useMemo(
    () => items.filter((i) => showAll || stockByItem[i.id].status !== "IN_STOCK" || i.id === focusItem),
    [items, stockByItem, showAll, focusItem]
  );

  const [packs, setPacks] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, suggestedReorderPacks(i, stockByItem[i.id].sellable)]))
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, stockByItem[i.id].status !== "IN_STOCK" || i.id === focusItem]))
  );

  const groups = useMemo(() => {
    const map: Record<string, InventoryItem[]> = {};
    for (const i of candidates) (map[i.supplierId] ||= []).push(i);
    return Object.entries(map).sort(([a], [b]) => (supplierById[a]?.name ?? "").localeCompare(supplierById[b]?.name ?? ""));
  }, [candidates, supplierById]);

  const onOrder = useMemo(() => {
    const map: Record<string, { packs: number; po: string }> = {};
    for (const po of purchaseOrders)
      for (const l of po.lines) map[l.itemId] = { packs: (map[l.itemId]?.packs ?? 0) + l.packs, po: po.id };
    return map;
  }, [purchaseOrders]);

  const packCost = (i: InventoryItem) => i.costPrice * i.unitsPerPack;
  const chosen = candidates.filter((i) => selected[i.id] && (packs[i.id] ?? 0) > 0);
  const total = chosen.reduce((s, i) => s + packCost(i) * (packs[i.id] ?? 0), 0);
  const supplierCount = new Set(chosen.map((i) => i.supplierId)).size;

  const create = () => {
    const ids = createPurchaseOrders(chosen.map((i) => ({ itemId: i.id, packs: packs[i.id] })));
    notify(`${ids.length} draft purchase ${ids.length === 1 ? "order" : "orders"} created: ${ids.join(", ")}.`);
    setSelected((s) => ({ ...s, ...Object.fromEntries(chosen.map((i) => [i.id, false])) }));
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader
          title="Items to reorder"
          description="Suggested quantity covers supplier lead time plus 30 days of sales, and at least twice the reorder level."
          actions={
            <label className="flex items-center gap-2 text-sm text-apptext-secondary">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="size-4 accent-brand-primary"
              />
              Show all products
            </label>
          }
        />

        {groups.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nothing to reorder" description="Every product is above its reorder level." />
        ) : (
          <div className="divide-y divide-slate-200">
            {groups.map(([supplierId, list]) => {
              const sup = supplierById[supplierId];
              const subtotal = list.filter((i) => selected[i.id]).reduce((s, i) => s + packCost(i) * (packs[i.id] ?? 0), 0);
              return (
                <section key={supplierId}>
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2.5 sm:px-5">
                    <div>
                      <p className="text-sm font-semibold text-apptext-primary">{sup?.name}</p>
                      <p className="flex items-center gap-1 text-xs text-apptext-secondary">
                        <Phone className="size-3" aria-hidden />
                        {sup?.contactPerson} · {sup?.phone}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-apptext-secondary">
                      Subtotal <span className="font-semibold text-apptext-primary">{formatCurrency(subtotal)}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="text-xs text-apptext-secondary">
                        <tr className="border-b border-slate-100">
                          <th className="w-10 py-2 pl-4 sm:pl-5">
                            <span className="sr-only">Select</span>
                          </th>
                          <th className="px-3 py-2 font-medium">Product</th>
                          <th className="px-3 py-2 font-medium">Stock / reorder level</th>
                          <th className="px-3 py-2 text-right font-medium">Cover / lead time</th>
                          <th className="px-3 py-2 text-right font-medium">Order qty</th>
                          <th className="px-4 py-2 text-right font-medium sm:pr-5">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {list.map((i) => {
                          const s = stockByItem[i.id];
                          const p = packs[i.id] ?? 0;
                          const urgent = s.daysOfCover !== null && s.daysOfCover <= i.leadTimeDays;
                          return (
                            <tr key={i.id} className={cn(!selected[i.id] && "opacity-60", i.id === focusItem && "bg-brand-light/30")}>
                              <td className="py-3 pl-4 sm:pl-5">
                                <input
                                  type="checkbox"
                                  aria-label={`Include ${i.name}`}
                                  checked={!!selected[i.id]}
                                  onChange={(e) => setSelected((x) => ({ ...x, [i.id]: e.target.checked }))}
                                  className="size-4 accent-brand-primary"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-medium text-apptext-primary">{i.name}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  <StockStatusBadge status={s.status} />
                                  {onOrder[i.id] ? (
                                    <Badge className="border-blue-200 bg-blue-50 text-brand-primary">
                                      On order: {onOrder[i.id].packs} {plural(i.packUnit, onOrder[i.id].packs)} ({onOrder[i.id].po})
                                    </Badge>
                                  ) : (
                                    urgent && <Badge className="border-rose-200 bg-rose-50 text-rose-700">Order today</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 tabular-nums">
                                <p className="font-medium text-apptext-primary">{formatBase(s.sellable, i)}</p>
                                <p className="text-xs text-apptext-secondary">Reorder at {i.reorderLevel.toLocaleString("en-US")}</p>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                <p className={cn("font-medium", urgent ? "text-rose-700" : "text-apptext-primary")}>
                                  {s.daysOfCover ?? "—"} days
                                </p>
                                <p className="text-xs text-apptext-secondary">Lead time {i.leadTimeDays} days</p>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    aria-label={`Order quantity for ${i.name}`}
                                    value={p}
                                    onChange={(e) => setPacks((x) => ({ ...x, [i.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                                    className={cn(inputClass, "w-24 text-right tabular-nums")}
                                  />
                                  <span className="w-16 text-left text-xs text-apptext-secondary">{plural(i.packUnit, p)}</span>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-400">= {formatBase(p * i.unitsPerPack, i)}</p>
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-apptext-primary sm:pr-5">
                                {formatCurrency(packCost(i) * p)}
                                <p className="text-xs font-normal text-slate-500">
                                  {formatCurrency(packCost(i))} / {i.packUnit.toLowerCase()}
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {groups.length > 0 && (
          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-apptext-secondary">
              <span className="font-semibold text-apptext-primary">{chosen.length}</span> items from{" "}
              <span className="font-semibold text-apptext-primary">{supplierCount}</span> {plural("supplier", supplierCount)} ·{" "}
              <span className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(total)}</span>
            </p>
            <button className={btn.primary} disabled={chosen.length === 0} onClick={create}>
              <ShoppingBag className="size-4" aria-hidden />
              Create {supplierCount > 1 ? `${supplierCount} purchase orders` : "purchase order"}
            </button>
          </div>
        )}
      </Card>

      {/* Draft POs */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Purchase orders from this screen"
          description="Send to the supplier, then record the delivery in Purchase Entry to add stock."
          actions={
            <Link href="/purchases" className={btn.secondary}>
              <FileText className="size-4" aria-hidden />
              Purchase entry
            </Link>
          }
        />
        {purchaseOrders.length === 0 ? (
          <EmptyState icon={FileText} title="No purchase orders yet" description="Select items above and create a purchase order." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {purchaseOrders.map((po) => {
              const sup = supplierById[po.supplierId];
              const value = po.lines.reduce((s, l) => s + l.packs * l.unitCost, 0);
              return (
                <li key={po.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-primary">{po.id}</span>
                      {po.status === "SENT" ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Sent
                        </Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-600">Draft</Badge>
                      )}
                    </div>
                    <p className="text-sm text-apptext-primary">{sup?.name}</p>
                    <p className="text-xs text-apptext-secondary">
                      {po.lines.map((l) => `${itemById[l.itemId].name} × ${l.packs}`).join(" · ")}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(po.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(value)}</span>
                    {po.status === "DRAFT" && (
                      <button
                        className={btn.small}
                        onClick={() => {
                          markPurchaseOrderSent(po.id);
                          notify(`${po.id} marked as sent to ${sup?.name}.`);
                        }}
                      >
                        <Send className="size-3.5" aria-hidden />
                        Mark sent
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
