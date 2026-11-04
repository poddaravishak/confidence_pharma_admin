"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Download, Flame } from "lucide-react";
import { StockMovementType } from "@/lib/types";
import { MOVEMENT_META, formatBase, formatDateTime } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, EmptyState, FilterPills, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";

type Group = "ALL" | "IN" | "OUT" | "LOSS" | "TRANSFER";

const GROUPS: Record<Exclude<Group, "ALL">, StockMovementType[]> = {
  IN: ["PURCHASE_IN", "CUSTOMER_RETURN", "ADJUSTMENT_IN"],
  OUT: ["SALE_OUT", "SUPPLIER_RETURN", "ADJUSTMENT_OUT"],
  LOSS: ["DAMAGE", "EXPIRY_DISPOSAL", "ADJUSTMENT_OUT"],
  TRANSFER: ["TRANSFER_IN", "TRANSFER_OUT"],
};

export default function MovementsPage() {
  return (
    <Suspense>
      <MovementsView />
    </Suspense>
  );
}

function MovementsView() {
  const params = useSearchParams();
  const { movements, items, itemById, batchById, warehouseById, warehouseFilter } = useInventory();

  const [group, setGroup] = useState<Group>("ALL");
  const [itemId, setItemId] = useState(params.get("item") ?? "ALL");
  const [query, setQuery] = useState("");

  const scoped = useMemo(
    () =>
      movements
        .filter((m) => warehouseFilter === "ALL" || m.warehouseId === warehouseFilter)
        .filter((m) => itemId === "ALL" || m.itemId === itemId),
    [movements, warehouseFilter, itemId]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((m) => {
      if (group !== "ALL" && !GROUPS[group].includes(m.type)) return false;
      if (!q) return true;
      const b = batchById[m.batchId];
      return [m.reference, m.performedBy, m.note ?? "", b?.batchNumber ?? "", itemById[m.itemId].name].some((f) =>
        f.toLowerCase().includes(q)
      );
    });
  }, [scoped, group, query, batchById, itemById]);

  const totals = useMemo(() => {
    let inValue = 0;
    let outValue = 0;
    let lossValue = 0;
    for (const m of rows) {
      const v = Math.abs(m.quantity * m.unitCost);
      if (m.type === "DAMAGE" || m.type === "EXPIRY_DISPOSAL") lossValue += v;
      else if (m.quantity > 0) inValue += v;
      else outValue += v;
    }
    return { inValue, outValue, lossValue };
  }, [rows]);

  const count = (g: Group) => (g === "ALL" ? scoped.length : scoped.filter((m) => GROUPS[g].includes(m.type)).length);

  const exportCsv = () => {
    const header = ["Date", "Type", "Product", "Batch", "Warehouse", "Quantity", "Unit", "Unit cost", "Value", "Reference", "By", "Note"];
    const lines = rows.map((m) => {
      const item = itemById[m.itemId];
      return [
        m.date,
        MOVEMENT_META[m.type].label,
        item.name,
        batchById[m.batchId]?.batchNumber ?? "",
        warehouseById[m.warehouseId].name,
        m.quantity,
        item.baseUnit,
        m.unitCost,
        (m.quantity * m.unitCost).toFixed(2),
        m.reference,
        m.performedBy,
        m.note ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-movements.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatCard label="Stock in" value={formatCurrency(totals.inValue)} hint="Purchases, returns, found stock" icon={ArrowDownLeft} tone="green" />
        <StatCard label="Stock out" value={formatCurrency(totals.outValue)} hint="Sales, supplier returns, transfers" icon={ArrowUpRight} tone="blue" />
        <StatCard label="Losses" value={formatCurrency(totals.lossValue)} hint="Damaged and expired write-offs" icon={Flame} tone={totals.lossValue ? "rose" : "slate"} />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills
              label="Movement type"
              value={group}
              onChange={setGroup}
              options={[
                { id: "ALL", label: "All", count: count("ALL") },
                { id: "IN", label: "Stock in", count: count("IN") },
                { id: "OUT", label: "Stock out", count: count("OUT") },
                { id: "LOSS", label: "Losses & adjustments", count: count("LOSS") },
                { id: "TRANSFER", label: "Transfers", count: count("TRANSFER") },
              ]}
            />
            <button onClick={exportCsv} className={btn.secondary} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search reference, batch, person or note" className="flex-1" />
            <select aria-label="Product" value={itemId} onChange={(e) => setItemId(e.target.value)} className={cn(inputClass, "sm:w-64")}>
              <option value="ALL">All products</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No movements" description="Nothing matches these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Product · batch</th>
                  <th className="px-3 py-2.5">Warehouse</th>
                  <th className="px-3 py-2.5 text-right">Quantity</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const item = itemById[m.itemId];
                  const meta = MOVEMENT_META[m.type];
                  return (
                    <tr key={m.id} className="align-top transition hover:bg-surface/60">
                      <td className="whitespace-nowrap px-4 py-3 text-apptext-secondary">{formatDateTime(m.date)}</td>
                      <td className="px-3 py-3">
                        <Badge className={meta.badge}>{meta.label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-apptext-primary">{item.name}</p>
                        <p className="font-mono text-xs text-slate-500">{batchById[m.batchId]?.batchNumber}</p>
                        {m.note && <p className="mt-0.5 max-w-xs text-xs text-apptext-secondary">{m.note}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-apptext-secondary">{warehouseById[m.warehouseId].name}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums",
                          m.quantity > 0 ? "text-emerald-700" : "text-rose-700"
                        )}
                      >
                        {m.quantity > 0 ? "+" : "−"}
                        {formatBase(Math.abs(m.quantity), item)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-apptext-primary">
                        {formatCurrency(Math.abs(m.quantity * m.unitCost))}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-brand-primary">{m.reference}</td>
                      <td className="px-4 py-3 text-xs text-apptext-secondary">{m.performedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
