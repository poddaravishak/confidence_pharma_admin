"use client";

import React, { useMemo, useState } from "react";
import { Building2, Globe2, Pencil, Plus, Trash2 } from "lucide-react";
import { CatalogBrand } from "@/lib/db/catalog-data";
import { cn } from "@/lib/utils";
import { Card, EmptyState, Field, FilterPills, Modal, PageHeader, SearchInput, StatCard, Switch, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CatalogNav, InlineSwitch } from "@/components/catalog/shared";

type Origin = "ALL" | "LOCAL" | "IMPORTED";

export default function BrandsPage() {
  const { notify } = useInventory();
  const { can, logAudit } = useAppStore();
  const { brands, counts, saveBrand, toggleBrand, deleteBrand } = useCatalog();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<Origin>("ALL");
  const [editing, setEditing] = useState<{ value: CatalogBrand; isNew: boolean } | null>(null);

  const canCreate = can("catalog", "create");
  const canEdit = can("catalog", "edit");
  const canDelete = can("catalog", "delete");

  const local = brands.filter((b) => b.countryOfOrigin === "Bangladesh").length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brands
      .filter((b) => origin === "ALL" || (origin === "LOCAL") === (b.countryOfOrigin === "Bangladesh"))
      .filter((b) => !q || [b.name, b.countryOfOrigin, b.headquarters, b.dgdaLicenseNo, b.skuPrefix].some((f) => f?.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brands, query, origin]);

  const remove = (b: CatalogBrand) => {
    const n = counts.brand[b.name] ?? 0;
    if (n > 0) {
      notify(`${b.name} has ${n} products. Deactivate it instead.`, "warning");
      return;
    }
    if (!window.confirm(`Delete ${b.name}?`)) return;
    deleteBrand(b.id);
    logAudit("BRAND_DELETED", "CATALOG", `Brand "${b.name}" deleted.`);
    notify(`${b.name} deleted.`);
  };

  const iconBtn = "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-primary";

  return (
    <>
      <PageHeader
        title="Brands & manufacturers"
        description="Companies whose products you distribute. The SKU prefix starts every new product's SKU."
        actions={
          canCreate && (
            <button
              onClick={() =>
                setEditing({
                  isNew: true,
                  value: {
                    id: `br-${Date.now().toString(36)}`,
                    name: "",
                    slug: "",
                    skuPrefix: "",
                    countryOfOrigin: "Bangladesh",
                    headquarters: "",
                    totalProductsCount: 0,
                    isActive: true,
                  },
                })
              }
              className={btn.primary}
            >
              <Plus className="size-4" aria-hidden />
              Add brand
            </button>
          )
        }
      />
      <CatalogNav />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <StatCard label="Brands" value={brands.length} hint={`${brands.filter((b) => b.isActive).length} active`} icon={Building2} tone="blue" />
        <StatCard label="Local manufacturers" value={local} hint="Made in Bangladesh" icon={Building2} tone="green" />
        <StatCard label="Imported" value={brands.length - local} hint="Need an import licence" icon={Globe2} tone="violet" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, country, licence or prefix" className="sm:max-w-sm sm:flex-1" />
          <FilterPills
            label="Origin"
            value={origin}
            onChange={setOrigin}
            options={[
              { id: "ALL", label: "All", count: brands.length },
              { id: "LOCAL", label: "Local", count: local },
              { id: "IMPORTED", label: "Imported", count: brands.length - local },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No brands match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2.5">Brand</th>
                  <th className="px-3 py-2.5">SKU prefix</th>
                  <th className="px-3 py-2.5">Origin · HQ</th>
                  <th className="px-3 py-2.5">DGDA licence</th>
                  <th className="px-3 py-2.5 text-right">Since</th>
                  <th className="px-3 py-2.5 text-right">Products</th>
                  <th className="px-3 py-2.5">Active</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => {
                  const n = counts.brand[b.name] ?? 0;
                  return (
                    <tr key={b.id} className={cn("transition hover:bg-surface/60", !b.isActive && "opacity-60")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-xs font-bold text-brand-primary">
                            {b.skuPrefix.slice(0, 3)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-apptext-primary">{b.name}</p>
                            {b.description && <p className="max-w-xs truncate text-xs text-apptext-secondary">{b.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-apptext-primary">{b.skuPrefix}</td>
                      <td className="px-3 py-3">
                        <p className="text-apptext-primary">{b.countryOfOrigin}</p>
                        <p className="text-xs text-apptext-secondary">{b.headquarters}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-apptext-secondary">{b.dgdaLicenseNo || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-apptext-secondary">{b.establishedYear ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className={n > 0 ? "font-semibold text-apptext-primary" : "text-slate-400"}>{n}</span>
                      </td>
                      <td className="px-3 py-3">
                        <InlineSwitch
                          checked={b.isActive}
                          disabled={!canEdit}
                          label={`${b.name} active`}
                          onChange={() => {
                            toggleBrand(b.id);
                            logAudit("BRAND_UPDATED", "CATALOG", `Brand "${b.name}" ${b.isActive ? "deactivated" : "activated"}.`);
                          }}
                        />
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <div className="inline-flex gap-0.5">
                          {canEdit && (
                            <button onClick={() => setEditing({ value: b, isNew: false })} aria-label={`Edit ${b.name}`} className={iconBtn}>
                              <Pencil className="size-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => remove(b)} aria-label={`Delete ${b.name}`} className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}>
                              <Trash2 className="size-4" />
                            </button>
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

      {editing && (
        <BrandModal
          initial={editing.value}
          isNew={editing.isNew}
          others={brands.filter((b) => b.id !== editing.value.id)}
          productCount={counts.brand[editing.value.name] ?? 0}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            saveBrand(b);
            logAudit(editing.isNew ? "BRAND_CREATED" : "BRAND_UPDATED", "CATALOG", `Brand "${b.name}" (${b.skuPrefix}) ${editing.isNew ? "created" : "updated"}.`);
            notify(`${b.name} saved.`);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function BrandModal({
  initial,
  isNew,
  others,
  productCount,
  onClose,
  onSave,
}: {
  initial: CatalogBrand;
  isNew: boolean;
  others: CatalogBrand[];
  productCount: number;
  onClose: () => void;
  onSave: (b: CatalogBrand) => void;
}) {
  const [b, setB] = useState(initial);
  const [year, setYear] = useState(initial.establishedYear ? String(initial.establishedYear) : "");
  const [tried, setTried] = useState(false);
  const thisYear = 2026;

  const errors = {
    name: !b.name.trim()
      ? "Name is required."
      : others.some((o) => o.name.toLowerCase() === b.name.trim().toLowerCase())
      ? "Another brand already uses this name."
      : !isNew && productCount > 0 && b.name.trim() !== initial.name
      ? `Renaming is locked while ${productCount} products use this brand.`
      : undefined,
    prefix: !/^[A-Z0-9]{2,4}$/.test(b.skuPrefix)
      ? "2–4 letters or digits."
      : others.some((o) => o.skuPrefix === b.skuPrefix)
      ? "Prefix already used by another brand."
      : undefined,
    country: !b.countryOfOrigin.trim() ? "Country is required." : undefined,
    year: year && !(Number(year) >= 1800 && Number(year) <= thisYear) ? `Between 1800 and ${thisYear}.` : undefined,
  };
  const submit = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const name = b.name.trim();
    onSave({
      ...b,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      establishedYear: year ? Number(year) : undefined,
    });
  };
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  return (
    <Modal
      title={isNew ? "Add brand" : `Edit ${initial.name}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary}>
            Save brand
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand / company name *" error={err("name")} className="sm:col-span-2">
          {(id) => <input id={id} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} className={inputClass} autoFocus />}
        </Field>
        <Field label="SKU prefix *" error={err("prefix")} hint="Used for new SKUs, e.g. BEX-NAPX-500">
          {(id) => (
            <input
              id={id}
              value={b.skuPrefix}
              maxLength={4}
              onChange={(e) => setB({ ...b, skuPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
              className={cn(inputClass, "font-mono uppercase")}
            />
          )}
        </Field>
        <Field label="DGDA licence no." hint="Manufacturing or import licence">
          {(id) => (
            <input id={id} value={b.dgdaLicenseNo ?? ""} onChange={(e) => setB({ ...b, dgdaLicenseNo: e.target.value })} className={cn(inputClass, "font-mono")} />
          )}
        </Field>
        <Field label="Country of origin *" error={err("country")}>
          {(id) => (
            <input id={id} list="brand-countries" value={b.countryOfOrigin} onChange={(e) => setB({ ...b, countryOfOrigin: e.target.value })} className={inputClass} />
          )}
        </Field>
        <datalist id="brand-countries">
          {["Bangladesh", "India", "Denmark", "Switzerland", "South Korea", "Germany", "United Kingdom", "USA", "China", "Japan"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Headquarters">
          {(id) => <input id={id} value={b.headquarters} onChange={(e) => setB({ ...b, headquarters: e.target.value })} className={inputClass} />}
        </Field>
        <Field label="Established" error={err("year")}>
          {(id) => (
            <input id={id} type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1976" className={cn(inputClass, "tabular-nums")} />
          )}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(id) => (
            <textarea id={id} rows={2} value={b.description ?? ""} onChange={(e) => setB({ ...b, description: e.target.value })} className={cn(inputClass, "resize-y")} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={b.isActive} onChange={(v) => setB({ ...b, isActive: v })} label="Active" description="Inactive brands are hidden when adding products." />
        </div>
      </div>
    </Modal>
  );
}
