"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FilePenLine,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
  Power,
  ScrollText,
  Snowflake,
  Upload,
  X,
} from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { ItemStock, STOCK_STATUS_META, StockStatus, computeItemStock, formatPacks } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, EmptyState, PageHeader, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { ColdChainTag, StockStatusBadge } from "@/components/inventory/shared";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CatalogNav, ProductStatusBadge, ProductThumb, RxTag } from "@/components/catalog/shared";
import { CsvImportModal } from "@/components/catalog/CsvImportModal";
import {
  ProductStatus,
  downloadCsv,
  fmtPct,
  marginPct,
  marginTone,
  packMrp,
  packPrice,
  productStatus,
} from "@/components/catalog/catalog-utils";

type View = "table" | "grid";

export default function CatalogPage() {
  const { batches, updateItem, notify, supplierById } = useInventory();
  const { products, categories, brands } = useCatalog();
  const { can, logAudit } = useAppStore();

  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [brand, setBrand] = useState("ALL");
  const [status, setStatus] = useState<"ALL" | ProductStatus>("ALL");
  const [rx, setRx] = useState<"ALL" | "RX" | "OTC">("ALL");
  const [cold, setCold] = useState(false);
  const [stockFilter, setStockFilter] = useState<"ALL" | StockStatus>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const canCreate = can("catalog", "create");
  const canEdit = can("catalog", "edit");
  const canExport = can("catalog", "export");

  /* Catalog shows stock across every warehouse, not the inventory warehouse switcher. */
  const stock = useMemo(() => {
    const map: Record<string, ItemStock> = {};
    for (const p of products) map[p.id] = computeItemStock(p, batches);
    return map;
  }, [products, batches]);

  const kpi = useMemo(() => {
    const k = { total: products.length, active: 0, drafts: 0, inactive: 0, low: 0, out: 0, rx: 0 };
    for (const p of products) {
      const st = productStatus(p);
      if (st === "ACTIVE") k.active++;
      else if (st === "DRAFT") k.drafts++;
      else k.inactive++;
      if (stock[p.id].status === "LOW_STOCK") k.low++;
      if (stock[p.id].status === "OUT_OF_STOCK") k.out++;
      if (p.isPrescriptionRequired) k.rx++;
    }
    return k;
  }, [products, stock]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (category !== "ALL" && p.category !== category) return false;
        if (brand !== "ALL" && p.brand !== brand) return false;
        if (status !== "ALL" && productStatus(p) !== status) return false;
        if (rx === "RX" && !p.isPrescriptionRequired) return false;
        if (rx === "OTC" && p.isPrescriptionRequired) return false;
        if (cold && !p.isColdChain) return false;
        if (stockFilter !== "ALL" && stock[p.id].status !== stockFilter) return false;
        if (!q) return true;
        return [p.name, p.nameBn, p.genericName, p.sku, p.barcode, p.brand].some((f) => f?.toLowerCase().includes(q));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, stock, query, category, brand, status, rx, cold, stockFilter]);

  const filtersActive =
    !!query || category !== "ALL" || brand !== "ALL" || status !== "ALL" || rx !== "ALL" || cold || stockFilter !== "ALL";
  const clearFilters = () => {
    setQuery("");
    setCategory("ALL");
    setBrand("ALL");
    setStatus("ALL");
    setRx("ALL");
    setCold(false);
    setStockFilter("ALL");
  };

  /* ---------- selection & bulk actions ---------- */

  const visibleIds = rows.map((r) => r.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allSelected = rows.length > 0 && selectedVisible.length === rows.length;
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  const setActive = (ids: string[], active: boolean) => {
    let changed = 0;
    let skipped = 0;
    const names: string[] = [];
    for (const id of ids) {
      const p = products.find((x) => x.id === id);
      if (!p || p.isActive === active) continue;
      if (active && !(p.sellingPrice > 0 && p.mrp > 0)) {
        skipped++;
        continue;
      }
      updateItem(id, { isActive: active, status: active ? "ACTIVE" : "INACTIVE" });
      names.push(p.sku);
      changed++;
    }
    if (changed) {
      logAudit(active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED", "CATALOG", `${names.join(", ")} ${active ? "activated" : "deactivated"}.`);
      notify(`${changed} ${changed === 1 ? "product" : "products"} ${active ? "activated" : "deactivated"}.`);
    }
    if (skipped) notify(`${skipped} draft ${skipped === 1 ? "product has" : "products have"} no price yet and stayed inactive.`, "warning");
    if (!changed && !skipped) notify(`Nothing to change. Selected products are already ${active ? "active" : "inactive"}.`, "warning");
  };

  const exportCsv = (list: InventoryItem[]) => {
    const header = [
      "sku", "name", "name_bn", "generic_name", "strength", "dosage_form", "brand", "category", "subcategory",
      "base_unit", "pack_unit", "units_per_pack", "cost_price", "selling_price", "mrp", "pack_price", "pack_mrp",
      "margin_pct", "vat_pct", "rx_required", "cold_chain", "status", "sellable_base_units", "supplier", "barcode", "dgda_reg_no",
    ];
    const data = list.map((p) => [
      p.sku, p.name, p.nameBn ?? "", p.genericName, p.strength ?? "", p.dosageForm ?? p.medicineType, p.brand, p.category,
      p.subcategory ?? "", p.baseUnit, p.packUnit, p.unitsPerPack, p.costPrice, p.sellingPrice, p.mrp, packPrice(p), packMrp(p),
      marginPct(p.costPrice, p.sellingPrice)?.toFixed(1) ?? "", p.vatPct ?? 0, p.isPrescriptionRequired ? "yes" : "no",
      p.isColdChain ? "yes" : "no", productStatus(p).toLowerCase(), stock[p.id].sellable, supplierById[p.supplierId]?.name ?? "",
      p.barcode ?? "", p.dgdaRegNo ?? "",
    ]);
    downloadCsv(`catalog-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    logAudit("CATALOG_EXPORTED", "CATALOG", `${list.length} products exported to CSV.`);
    notify(`${list.length} ${list.length === 1 ? "product" : "products"} exported.`);
  };

  const selectedItems = products.filter((p) => selected.has(p.id));

  const actions = (p: InventoryItem) => ({ p, canEdit, canCreate, onToggle: () => setActive([p.id], !p.isActive) });

  return (
    <>
      <PageHeader
        title="Products & catalog"
        description="Every product the business sells, with pack hierarchy, pricing and live stock from inventory."
        actions={
          <>
            {canCreate && (
              <button onClick={() => setImportOpen(true)} className={btn.secondary}>
                <Upload className="size-4" aria-hidden />
                CSV import
              </button>
            )}
            {canExport && (
              <button onClick={() => exportCsv(rows)} disabled={rows.length === 0} className={btn.secondary}>
                <Download className="size-4" aria-hidden />
                Export
              </button>
            )}
            {canCreate && (
              <Link href="/catalog/new" className={btn.primary}>
                <Plus className="size-4" aria-hidden />
                Add product
              </Link>
            )}
          </>
        }
      />
      <CatalogNav />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <StatCard label="Total products" value={kpi.total} hint={`${categories.length} categories · ${brands.length} brands`} icon={Package} tone="blue" />
        <StatCard
          label="Active"
          value={kpi.active}
          hint={kpi.inactive ? `${kpi.inactive} inactive` : "Visible to customers"}
          icon={CheckCircle2}
          tone="green"
          active={status === "ACTIVE"}
          onClick={() => setStatus(status === "ACTIVE" ? "ALL" : "ACTIVE")}
        />
        <StatCard
          label="Drafts"
          value={kpi.drafts}
          hint="Not yet published"
          icon={FilePenLine}
          tone={kpi.drafts ? "amber" : "slate"}
          active={status === "DRAFT"}
          onClick={() => setStatus(status === "DRAFT" ? "ALL" : "DRAFT")}
        />
        <StatCard
          label="Low stock"
          value={kpi.low}
          hint={kpi.out ? `+ ${kpi.out} out of stock` : "At or below reorder level"}
          icon={AlertTriangle}
          tone={kpi.low ? "amber" : "slate"}
          active={stockFilter === "LOW_STOCK"}
          onClick={() => setStockFilter(stockFilter === "LOW_STOCK" ? "ALL" : "LOW_STOCK")}
        />
        <StatCard
          label="Rx-only"
          value={kpi.rx}
          hint="Prescription required"
          icon={ScrollText}
          tone={kpi.rx ? "rose" : "slate"}
          active={rx === "RX"}
          onClick={() => setRx(rx === "RX" ? "ALL" : "RX")}
        />
      </div>

      <Card className="overflow-hidden">
        {/* ---------- Filters ---------- */}
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search name, generic, SKU or barcode" className="flex-1" />
            <div className="flex gap-2">
              <button
                onClick={() => setCold(!cold)}
                aria-pressed={cold}
                className={cn(btn.secondary, "flex-1 sm:flex-none", cold && "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-50")}
              >
                <Snowflake className="size-4" aria-hidden />
                Cold chain
              </button>
              <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="View">
                {([
                  ["table", List, "Table view"],
                  ["grid", LayoutGrid, "Grid view"],
                ] as const).map(([v, Icon, label]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    aria-label={label}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 transition",
                      view === v ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="ALL">All categories</option>
              {[...categories].sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                <option key={c.id} value={c.nameEn}>
                  {c.nameEn}
                </option>
              ))}
            </select>
            <select aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass}>
              <option value="ALL">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
              <option value="ALL">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select aria-label="Prescription" value={rx} onChange={(e) => setRx(e.target.value as typeof rx)} className={inputClass}>
              <option value="ALL">Rx and OTC</option>
              <option value="RX">Rx only</option>
              <option value="OTC">OTC only</option>
            </select>
            <select
              aria-label="Stock status"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
              className={cn(inputClass, "col-span-2 md:col-span-1")}
            >
              <option value="ALL">Any stock level</option>
              {(Object.keys(STOCK_STATUS_META) as StockStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STOCK_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="tabular-nums text-apptext-secondary">
              {rows.length} of {products.length} products
            </span>
            {filtersActive && (
              <button onClick={clearFilters} className={btn.ghost}>
                <X className="size-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ---------- Bulk bar ---------- */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-brand-primary/20 bg-brand-light/40 px-3 py-2 sm:px-4">
            <span className="text-sm font-medium tabular-nums text-brand-primary">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {canEdit && (
                <>
                  <button onClick={() => setActive([...selected], true)} className={btn.small}>
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Activate
                  </button>
                  <button onClick={() => setActive([...selected], false)} className={btn.small}>
                    <Power className="size-3.5" aria-hidden />
                    Deactivate
                  </button>
                </>
              )}
              {canExport && (
                <button onClick={() => exportCsv(selectedItems)} className={btn.small}>
                  <Download className="size-3.5" aria-hidden />
                  Export CSV
                </button>
              )}
              <button onClick={() => setSelected(new Set())} className={btn.small}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ---------- Results ---------- */}
        {rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length ? "No products match" : "No products yet"}
            description={products.length ? "Try a different filter or search term." : "Add your first product to start selling."}
            action={
              products.length ? (
                <button className={btn.ghost} onClick={clearFilters}>
                  Clear filters
                </button>
              ) : canCreate ? (
                <Link href="/catalog/new" className={btn.primary}>
                  <Plus className="size-4" aria-hidden />
                  Add product
                </Link>
              ) : undefined
            }
          />
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="w-10 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedVisible.length > 0 && !allSelected;
                      }}
                      onChange={toggleAll}
                      className="size-4 accent-brand-primary"
                    />
                  </th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Category · brand</th>
                  <th className="px-3 py-2.5 text-right">Pack price</th>
                  <th className="px-3 py-2.5 text-right">MRP</th>
                  <th className="px-3 py-2.5 text-right">Margin</th>
                  <th className="px-3 py-2.5">Stock</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const s = stock[p.id];
                  const m = marginPct(p.costPrice, p.sellingPrice);
                  return (
                    <tr key={p.id} className={cn("transition hover:bg-surface/60", selected.has(p.id) && "bg-brand-light/20")}>
                      <td className="py-3 pl-4 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          className="mt-1 size-4 accent-brand-primary"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <ProductThumb item={p} />
                          <div className="min-w-0">
                            <Link href={`/catalog/${p.id}`} className="font-medium text-apptext-primary hover:text-brand-primary hover:underline">
                              {p.name}
                            </Link>
                            <p className="truncate text-xs text-apptext-secondary">
                              {[p.genericName, p.strength].filter(Boolean).join(" · ")}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs text-slate-400">{p.sku}</span>
                              {p.isPrescriptionRequired && <RxTag />}
                              {p.isColdChain && <ColdChainTag />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-apptext-primary">{p.category}</p>
                        <p className="text-xs text-apptext-secondary">{[p.subcategory, p.brand].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-3 py-3 text-right align-top tabular-nums">
                        <p className="font-semibold text-apptext-primary">{formatCurrency(packPrice(p))}</p>
                        <p className="text-xs text-apptext-secondary">per {p.packUnit.toLowerCase()}</p>
                      </td>
                      <td className="px-3 py-3 text-right align-top tabular-nums text-apptext-secondary">{formatCurrency(packMrp(p))}</td>
                      <td className={cn("px-3 py-3 text-right align-top font-medium tabular-nums", marginTone(m))}>{fmtPct(m)}</td>
                      <td className="px-3 py-3 align-top">
                        <p className="tabular-nums text-apptext-primary">{formatPacks(s.sellable, p)}</p>
                        <div className="mt-1">
                          <StockStatusBadge status={s.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <ProductStatusBadge item={p} />
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right align-top">
                        <RowActions {...actions(p)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map((p) => {
              const s = stock[p.id];
              const m = marginPct(p.costPrice, p.sellingPrice);
              return (
                <article
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-white p-3 transition hover:shadow-sm",
                    selected.has(p.id) ? "border-brand-primary ring-1 ring-brand-primary" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ProductThumb item={p} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/catalog/${p.id}`} className="font-medium leading-snug text-apptext-primary hover:text-brand-primary hover:underline">
                          {p.name}
                        </Link>
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          className="mt-0.5 size-4 shrink-0 accent-brand-primary"
                        />
                      </div>
                      <p className="truncate text-xs text-apptext-secondary">{p.genericName}</p>
                      <p className="truncate text-xs text-slate-400">{p.brand}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <ProductStatusBadge item={p} />
                    {p.isPrescriptionRequired && <RxTag />}
                    {p.isColdChain && <ColdChainTag />}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface p-2 text-xs">
                    <div>
                      <dt className="text-apptext-secondary">Per {p.packUnit.toLowerCase()}</dt>
                      <dd className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(packPrice(p))}</dd>
                    </div>
                    <div>
                      <dt className="text-apptext-secondary">MRP</dt>
                      <dd className="tabular-nums text-apptext-primary">{formatCurrency(packMrp(p))}</dd>
                    </div>
                    <div>
                      <dt className="text-apptext-secondary">Margin</dt>
                      <dd className={cn("font-medium tabular-nums", marginTone(m))}>{fmtPct(m)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-xs tabular-nums text-apptext-primary">{formatPacks(s.sellable, p)}</p>
                      <StockStatusBadge status={s.status} />
                    </div>
                    <RowActions {...actions(p)} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {importOpen && <CsvImportModal onClose={() => setImportOpen(false)} />}
    </>
  );
}

function RowActions({
  p,
  canEdit,
  canCreate,
  onToggle,
}: {
  p: InventoryItem;
  canEdit: boolean;
  canCreate: boolean;
  onToggle: () => void;
}) {
  const icon = "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-primary";
  return (
    <div className="inline-flex items-center gap-0.5">
      <Link href={`/catalog/${p.id}`} aria-label={`View ${p.name}`} title="View" className={icon}>
        <Eye className="size-4" />
      </Link>
      {canEdit && (
        <Link href={`/catalog/${p.id}/edit`} aria-label={`Edit ${p.name}`} title="Edit" className={icon}>
          <Pencil className="size-4" />
        </Link>
      )}
      {canCreate && (
        <Link href={`/catalog/new?duplicate=${p.id}`} aria-label={`Duplicate ${p.name}`} title="Duplicate" className={icon}>
          <Copy className="size-4" />
        </Link>
      )}
      {canEdit && (
        <button
          onClick={onToggle}
          aria-label={`${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
          title={p.isActive ? "Deactivate" : "Activate"}
          className={cn(icon, p.isActive ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-emerald-50 hover:text-emerald-600")}
        >
          <Power className="size-4" />
        </button>
      )}
    </div>
  );
}
