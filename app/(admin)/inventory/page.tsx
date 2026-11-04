"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronDown,
  CircleSlash,
  Clock,
  History,
  PackageX,
  Plus,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { InventoryItem } from "@/lib/types";
import {
  BATCH_STATE_META,
  batchState,
  daysUntil,
  fefoSort,
  formatBase,
  formatPacks,
  packLabel,
} from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, EmptyState, FilterPills, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { AdjustStockModal } from "@/components/inventory/AdjustStockModal";
import {
  ColdChainTag,
  ExpiryBadge,
  ItemCell,
  StockLevelBar,
  StockStatusBadge,
} from "@/components/inventory/shared";

type Filter = "ALL" | "LOW" | "OUT" | "EXPIRING" | "COLD";
type Sort = "name" | "value" | "cover" | "expiry";

export default function InventoryOverviewPage() {
  const { items, stockByItem, scopedBatches, adjustments, transfers, warehouseById, supplierById } = useInventory();
  const { can } = useAppStore();

  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState<Sort>("name");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<{ itemId?: string; batchId?: string } | null>(null);

  /* ---------- KPIs ---------- */

  const kpi = useMemo(() => {
    let value = 0;
    let low = 0;
    let out = 0;
    let expiringValue = 0;
    let expiringBatches = 0;
    let blockedValue = 0;
    for (const i of items) {
      const s = stockByItem[i.id];
      value += s.value;
      if (s.status === "LOW_STOCK") low++;
      if (s.status === "OUT_OF_STOCK") out++;
    }
    for (const b of scopedBatches) {
      if (b.availableQuantity <= 0) continue;
      const d = daysUntil(b.expiryDate);
      const st = batchState(b);
      if (st === "AVAILABLE" && d <= 90) {
        expiringBatches++;
        expiringValue += b.availableQuantity * b.unitCost;
      }
      if (st === "EXPIRED" || st === "ON_HOLD") blockedValue += b.availableQuantity * b.unitCost;
    }
    return { value, low, out, expiringValue, expiringBatches, blockedValue };
  }, [items, stockByItem, scopedBatches]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  /* ---------- Needs attention ---------- */

  const attention = useMemo(() => {
    const list: { icon: React.ElementType; tone: string; text: string; href: string; cta: string }[] = [];
    const expired = scopedBatches.filter((b) => batchState(b) === "EXPIRED");
    if (expired.length)
      list.push({
        icon: PackageX,
        tone: "text-rose-600 bg-rose-50",
        text: `${expired.length} expired ${expired.length === 1 ? "batch is" : "batches are"} still on the shelf`,
        href: "/inventory/batches?view=EXPIRED",
        cta: "Dispose",
      });
    const pending = adjustments.filter((a) => a.status === "PENDING").length;
    if (pending)
      list.push({
        icon: ShieldAlert,
        tone: "text-amber-700 bg-amber-50",
        text: `${pending} stock ${pending === 1 ? "adjustment needs" : "adjustments need"} approval`,
        href: "/inventory/adjustments?status=PENDING",
        cta: "Review",
      });
    const held = scopedBatches.filter((b) => batchState(b) === "ON_HOLD");
    if (held.length)
      list.push({
        icon: CircleSlash,
        tone: "text-violet-700 bg-violet-50",
        text: `${held.length} ${held.length === 1 ? "batch is" : "batches are"} in quarantine awaiting QC`,
        href: "/inventory/batches?view=ON_HOLD",
        cta: "Check",
      });
    if (kpi.out + kpi.low)
      list.push({
        icon: ShoppingBag,
        tone: "text-brand-primary bg-brand-light",
        text: `${kpi.out + kpi.low} products are at or below reorder level`,
        href: "/inventory/reorder",
        cta: "Reorder",
      });
    const toReceive = transfers.filter((t) => t.status === "IN_TRANSIT").length;
    if (toReceive)
      list.push({
        icon: Boxes,
        tone: "text-brand-primary bg-brand-light",
        text: `${toReceive} ${toReceive === 1 ? "transfer is" : "transfers are"} in transit`,
        href: "/inventory/transfers",
        cta: "Track",
      });
    return list;
  }, [scopedBatches, adjustments, transfers, kpi.out, kpi.low]);

  /* ---------- Table rows ---------- */

  const counts = useMemo(() => {
    const c = { ALL: items.length, LOW: 0, OUT: 0, EXPIRING: 0, COLD: 0 };
    for (const i of items) {
      const s = stockByItem[i.id];
      if (s.status === "LOW_STOCK") c.LOW++;
      if (s.status === "OUT_OF_STOCK") c.OUT++;
      if (s.nearestExpiryDays !== null && s.nearestExpiryDays <= 90) c.EXPIRING++;
      if (i.isColdChain) c.COLD++;
    }
    return c;
  }, [items, stockByItem]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      const s = stockByItem[i.id];
      if (filter === "LOW" && s.status !== "LOW_STOCK") return false;
      if (filter === "OUT" && s.status !== "OUT_OF_STOCK") return false;
      if (filter === "EXPIRING" && (s.nearestExpiryDays === null || s.nearestExpiryDays > 90)) return false;
      if (filter === "COLD" && !i.isColdChain) return false;
      if (category !== "ALL" && i.category !== category) return false;
      if (!q) return true;
      return [i.name, i.genericName, i.brand, i.sku].some((f) => f.toLowerCase().includes(q));
    });
    const s = (i: InventoryItem) => stockByItem[i.id];
    return list.sort((a, b) => {
      if (sort === "value") return s(b).value - s(a).value;
      if (sort === "cover") return (s(a).daysOfCover ?? 9999) - (s(b).daysOfCover ?? 9999);
      if (sort === "expiry") return (s(a).nearestExpiryDays ?? 9999) - (s(b).nearestExpiryDays ?? 9999);
      return a.name.localeCompare(b.name);
    });
  }, [items, stockByItem, filter, category, query, sort]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "ALL", label: "All products", count: counts.ALL },
    { id: "LOW", label: "Low stock", count: counts.LOW },
    { id: "OUT", label: "Out of stock", count: counts.OUT },
    { id: "EXPIRING", label: "Expiring ≤ 90 days", count: counts.EXPIRING },
    { id: "COLD", label: "Cold chain", count: counts.COLD },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <StatCard label="Stock value" value={formatCurrency(kpi.value)} hint="At purchase cost" icon={Wallet} tone="blue" />
        <StatCard
          label="Low stock"
          value={kpi.low}
          hint="At or below reorder level"
          icon={AlertTriangle}
          tone={kpi.low ? "amber" : "slate"}
          active={filter === "LOW"}
          onClick={() => setFilter(filter === "LOW" ? "ALL" : "LOW")}
        />
        <StatCard
          label="Out of stock"
          value={kpi.out}
          hint="No sellable units"
          icon={PackageX}
          tone={kpi.out ? "rose" : "slate"}
          active={filter === "OUT"}
          onClick={() => setFilter(filter === "OUT" ? "ALL" : "OUT")}
        />
        <StatCard
          label="Expiring ≤ 90 days"
          value={formatCurrency(kpi.expiringValue)}
          hint={`${kpi.expiringBatches} sellable batches`}
          icon={Clock}
          tone={kpi.expiringBatches ? "amber" : "slate"}
          active={filter === "EXPIRING"}
          onClick={() => setFilter(filter === "EXPIRING" ? "ALL" : "EXPIRING")}
        />
        <StatCard
          label="Blocked stock"
          value={formatCurrency(kpi.blockedValue)}
          hint="Expired or on hold"
          icon={CircleSlash}
          tone={kpi.blockedValue ? "violet" : "slate"}
        />
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 sm:px-5">
            <h2 className="text-sm font-semibold text-apptext-primary">Needs attention</h2>
          </div>
          <ul className="grid gap-px p-2 sm:grid-cols-2 xl:grid-cols-3">
            {attention.map((a) => (
              <li key={a.text}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-surface"
                >
                  <span className={cn("rounded-lg p-2", a.tone)}>
                    <a.icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex-1 text-sm text-apptext-primary">{a.text}</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-brand-blue">
                    {a.cta}
                    <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Stock table */}
      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <FilterPills label="Filter products" value={filter} onChange={setFilter} options={filters} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search name, generic, brand or SKU"
              className="flex-1"
            />
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(inputClass, "sm:w-44")}>
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(inputClass, "sm:w-48")}>
              <option value="name">Sort: Name</option>
              <option value="value">Sort: Stock value</option>
              <option value="cover">Sort: Days of cover (lowest)</option>
              <option value="expiry">Sort: Nearest expiry</option>
            </select>
            {can("catalog", "create") && (
              <Link href="/catalog/new" className={cn(btn.primary, "shrink-0")}>
                <Plus className="size-4" aria-hidden />
                Add product
              </Link>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Try a different filter or search term."
            action={
              <button
                className={btn.ghost}
                onClick={() => {
                  setFilter("ALL");
                  setQuery("");
                  setCategory("ALL");
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="w-8 py-2.5 pl-4" />
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Sellable stock</th>
                  <th className="px-3 py-2.5 text-right">Days of cover</th>
                  <th className="px-3 py-2.5">Next expiry</th>
                  <th className="px-3 py-2.5 text-right">Value</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((item) => {
                  const s = stockByItem[item.id];
                  const open = expanded === item.id;
                  const itemBatches = scopedBatches
                    .filter((b) => b.itemId === item.id && b.availableQuantity > 0)
                    .sort(fefoSort);
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={cn("transition hover:bg-surface/60", open && "bg-surface/60")}>
                        <td className="py-3 pl-4 align-top">
                          <button
                            onClick={() => setExpanded(open ? null : item.id)}
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} batches for ${item.name}`}
                            className="mt-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-start gap-2">
                            <ItemCell item={item} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-400">{item.sku}</span>
                            {item.isColdChain && <ColdChainTag />}
                          </div>
                        </td>
                        <td className="w-56 px-3 py-3 align-top">
                          <p className="font-semibold tabular-nums text-apptext-primary">{formatBase(s.sellable, item)}</p>
                          <p className="mb-1.5 text-xs text-apptext-secondary">{formatPacks(s.sellable, item)}</p>
                          <StockLevelBar stock={s} item={item} />
                          <p className="mt-1 text-xs text-slate-500">Reorder at {item.reorderLevel.toLocaleString("en-US")}</p>
                          {(s.onHold > 0 || s.expired > 0) && (
                            <p className="mt-0.5 text-xs text-violet-700">
                              + {(s.onHold + s.expired).toLocaleString("en-US")} blocked
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right align-top tabular-nums">
                          {s.daysOfCover === null ? (
                            "—"
                          ) : (
                            <span
                              className={cn(
                                "font-semibold",
                                s.daysOfCover <= item.leadTimeDays + 3
                                  ? "text-rose-700"
                                  : s.daysOfCover <= 14
                                  ? "text-amber-700"
                                  : "text-apptext-primary"
                              )}
                            >
                              {s.daysOfCover} d
                            </span>
                          )}
                          <p className="text-xs font-normal text-slate-500">{item.avgDailySales}/day</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {s.nearestExpiryDays === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <ExpiryBadge date={itemBatches.find((b) => batchState(b) === "AVAILABLE")!.expiryDate} showDate />
                          )}
                        </td>
                        <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-apptext-primary">
                          {formatCurrency(s.value)}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <StockStatusBadge status={s.status} />
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right align-top">
                          <button onClick={() => setAdjustFor({ itemId: item.id })} className={btn.small}>
                            <SlidersHorizontal className="size-3.5" aria-hidden />
                            Adjust
                          </button>
                        </td>
                      </tr>

                      {open && (
                        <tr className="bg-surface/60">
                          <td />
                          <td colSpan={7} className="pb-4 pr-4">
                            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-left text-sm">
                                  <thead className="border-b border-slate-100 text-xs text-apptext-secondary">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Batch (FEFO order)</th>
                                      <th className="px-3 py-2 font-medium">Warehouse · location</th>
                                      <th className="px-3 py-2 font-medium">Expiry</th>
                                      <th className="px-3 py-2 text-right font-medium">Quantity</th>
                                      <th className="px-3 py-2 font-medium">State</th>
                                      <th className="px-3 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {itemBatches.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-apptext-secondary">
                                          No stock in this warehouse.
                                        </td>
                                      </tr>
                                    )}
                                    {itemBatches.map((b, idx) => {
                                      const st = batchState(b);
                                      return (
                                        <tr key={b.id}>
                                          <td className="px-3 py-2">
                                            <span className="font-mono text-xs font-semibold text-apptext-primary">{b.batchNumber}</span>
                                            {idx === 0 && st === "AVAILABLE" && (
                                              <span className="ml-1.5 rounded bg-brand-light px-1 py-px text-[11px] font-medium text-brand-primary">
                                                Pick first
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-apptext-secondary">
                                            {warehouseById[b.warehouseId].code} · {b.location}
                                          </td>
                                          <td className="px-3 py-2">
                                            <ExpiryBadge date={b.expiryDate} />
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums">
                                            <span className="font-medium text-apptext-primary">{b.availableQuantity.toLocaleString("en-US")}</span>
                                            <span className="block text-xs text-slate-500">{formatPacks(b.availableQuantity, item)}</span>
                                          </td>
                                          <td className="px-3 py-2">
                                            <Badge className={BATCH_STATE_META[st].badge}>{BATCH_STATE_META[st].label}</Badge>
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <button
                                              onClick={() => setAdjustFor({ batchId: b.id })}
                                              className="text-xs font-medium text-brand-blue hover:underline"
                                            >
                                              Adjust
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              <dl className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                {[
                                  ["Pack size", packLabel(item)],
                                  ["Reorder level", formatBase(item.reorderLevel, item)],
                                  ["Supplier", supplierById[item.supplierId]?.name ?? "—"],
                                  ["Lead time", `${item.leadTimeDays} days`],
                                  ["Storage", item.storageCondition],
                                  ["Cost / sell", `${formatCurrency(item.costPrice)} / ${formatCurrency(item.sellingPrice)}`],
                                ].map(([k, v]) => (
                                  <div key={k} className="flex justify-between gap-3">
                                    <dt className="text-apptext-secondary">{k}</dt>
                                    <dd className="text-right font-medium text-apptext-primary">{v}</dd>
                                  </div>
                                ))}
                                <div className="flex gap-2 border-t border-slate-100 pt-2">
                                  <Link href={`/inventory/movements?item=${item.id}`} className={cn(btn.small, "flex-1")}>
                                    <History className="size-3.5" aria-hidden />
                                    History
                                  </Link>
                                  <Link href={`/inventory/reorder?item=${item.id}`} className={cn(btn.small, "flex-1")}>
                                    <ShoppingBag className="size-3.5" aria-hidden />
                                    Reorder
                                  </Link>
                                </div>
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adjustFor && (
        <AdjustStockModal
          initialItemId={adjustFor.itemId}
          initialBatchId={adjustFor.batchId}
          onClose={() => setAdjustFor(null)}
        />
      )}
    </>
  );
}
