"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  Eye,
  ImagePlus,
  Info,
  Layers,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { CustomerType, InventoryItem } from "@/lib/types";
import { ALL_CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, STORAGE_CONDITIONS } from "@/lib/db/catalog-data";
import { DEMO_TODAY } from "@/lib/db/inventory-data";
import { plural } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, Field, PageHeader, Switch, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "./CatalogProvider";
import { ColdChainTag } from "@/components/inventory/shared";
import { RxTag, ControlledTag } from "./shared";
import { fmtPct, generateSku, hierarchyText, marginTone, randomEan13, round2 } from "./catalog-utils";
import {
  Derived,
  DraftStatus,
  Issue,
  ProductDraft,
  SECTIONS,
  SectionId,
  TierDraft,
  buildItem,
  buildOpening,
  derive,
  draftFromItem,
  emptyDraft,
  levelQty,
  newKey,
  num,
  packBarcodeMap,
  suggestSupplier,
  suggestedTiers,
  validate,
} from "./product-draft";

const MAX_IMAGES = 4;
const MAX_IMAGE_MB = 2;
const errorRing = "border-rose-300 focus:border-rose-400 focus:ring-rose-200";

type SaveKind = "draft" | "save" | "another";

export function ProductForm({ item, duplicateOf }: { item?: InventoryItem; duplicateOf?: InventoryItem }) {
  const router = useRouter();
  const { addItem, updateItem, notify, suppliers, warehouses } = useInventory();
  const { can, logAudit, currentUser } = useAppStore();
  const { products, brands, categories, units, dosageForms, packBarcodes, setPackBarcodes, recordPrice } = useCatalog();

  const isEdit = !!item;
  const [draft, setDraft] = useState<ProductDraft>(() =>
    item
      ? draftFromItem(item, packBarcodes[item.id] ?? {})
      : duplicateOf
      ? draftFromItem(duplicateOf, {}, true)
      : emptyDraft()
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [showErrors, setShowErrors] = useState<false | "draft" | "full">(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const createdUrls = useRef(new Set<string>());

  const set = (patch: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ---------- derived ---------- */

  const brandMeta = brands.find((b) => b.name === draft.brand);
  const takenSkus = useMemo(
    () => new Set(products.filter((p) => p.id !== item?.id).map((p) => p.sku.toUpperCase())),
    [products, item?.id]
  );
  const autoSku = useMemo(
    () => generateSku(brandMeta?.skuPrefix ?? "", draft.name, draft.strength, takenSkus),
    [brandMeta?.skuPrefix, draft.name, draft.strength, takenSkus]
  );
  const effective = useMemo(
    () => (draft.skuTouched ? draft : { ...draft, sku: draft.name ? autoSku : "" }),
    [draft, autoSku]
  );
  const x = useMemo(() => derive(effective), [effective]);
  const ctx = useMemo(() => ({ takenSkus, warehouses, isCreate: !isEdit }), [takenSkus, warehouses, isEdit]);
  const full = useMemo(() => validate(effective, x, ctx, false), [effective, x, ctx]);
  const shown = useMemo(
    () => (showErrors === "draft" ? validate(effective, x, ctx, true).errors : showErrors === "full" ? full.errors : []),
    [showErrors, effective, x, ctx, full.errors]
  );
  const errorFor = (key: string) => shown.find((e) => e.key === key)?.message;
  const dirty = JSON.stringify(draft) !== baseline;

  /* ---------- unsaved-changes guard ---------- */

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  /* ---------- save ---------- */

  const allowed = isEdit ? can("catalog", "edit") : can("catalog", "create");

  const save = (kind: SaveKind) => {
    if (!allowed) return;
    const forDraft = kind === "draft";
    const { errors } = validate(effective, x, ctx, forDraft);
    if (errors.length) {
      setShowErrors(forDraft ? "draft" : "full");
      notify(`Fix ${errors.length} ${plural("problem", errors.length)} before saving.`, "warning");
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    const status: DraftStatus = forDraft ? "DRAFT" : effective.status;
    const id = item?.id ?? `prod-${Date.now().toString(36)}`;
    const next = buildItem(effective, x, { id, status, existing: item, units });

    if (item) {
      updateItem(id, next);
      if (item.costPrice !== next.costPrice || item.sellingPrice !== next.sellingPrice || item.mrp !== next.mrp) {
        recordPrice(id, {
          at: new Date().toISOString(),
          by: currentUser?.name ?? "Staff",
          costPrice: next.costPrice,
          sellingPrice: next.sellingPrice,
          mrp: next.mrp,
          note: `Was ${formatCurrency(item.costPrice)} / ${formatCurrency(item.sellingPrice)} / ${formatCurrency(item.mrp)}`,
        });
      }
    } else {
      addItem(next, buildOpening(effective, x));
      recordPrice(id, {
        at: next.createdAt!,
        by: currentUser?.name ?? "Staff",
        costPrice: next.costPrice,
        sellingPrice: next.sellingPrice,
        mrp: next.mrp,
        note: "Initial price",
      });
    }
    setPackBarcodes(id, packBarcodeMap(effective));

    const opening = !item && effective.openingEnabled ? `, opening stock ${levelQty(x.openingBase, x.levels[0].name)}` : "";
    logAudit(
      item ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      "CATALOG",
      `${next.name} (${next.sku}) ${item ? "updated" : "created"} as ${status.toLowerCase()}. ${next.packUnit} ${formatCurrency(
        next.sellingPrice * next.unitsPerPack
      )}${opening}.`
    );

    if (kind === "another") {
      notify(`${next.name} saved. Add the next product.`);
      createdUrls.current = new Set();
      const fresh = emptyDraft({
        brand: effective.brand,
        category: effective.category,
        subcategory: effective.subcategory,
        dosageForm: effective.dosageForm,
        supplierId: effective.supplierId,
        defaultWarehouseId: effective.defaultWarehouseId,
        openingWarehouseId: effective.defaultWarehouseId,
      });
      setDraft(fresh);
      setBaseline(JSON.stringify(fresh));
      setShowErrors(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBaseline(JSON.stringify(draft));
    notify(`${next.name} ${item ? "updated" : "added to the catalog"}${status === "DRAFT" ? " as a draft" : ""}.`);
    router.push(`/catalog/${id}`);
  };

  /* ---------- section status for the summary ---------- */

  const sectionState = (id: SectionId): "error" | "warn" | "ok" | "skip" => {
    if (id === "opening" && (isEdit || !draft.openingEnabled)) return "skip";
    if (id === "media" && draft.images.length === 0) return "skip";
    if (id === "tiers" && draft.tiers.length === 0) return "skip";
    if (full.errors.some((e) => e.section === id)) return "error";
    if (full.warnings.some((w) => w.section === id)) return "warn";
    return "ok";
  };

  // Sections read the effective draft so the auto-generated SKU shows in its input.
  const sectionProps = { draft: effective, set, x, errorFor, full };

  const title = isEdit ? `Edit ${item.name}` : duplicateOf ? "Duplicate product" : "Add product";

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <PageHeader
        breadcrumb={
          <span className="flex flex-wrap items-center gap-1">
            <Link href="/catalog" className="hover:text-brand-primary hover:underline">
              Catalog
            </Link>
            <span aria-hidden>/</span>
            {item && (
              <>
                <Link href={`/catalog/${item.id}`} className="hover:text-brand-primary hover:underline">
                  {item.name}
                </Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span>{isEdit ? "Edit" : "New product"}</span>
          </span>
        }
        title={title}
        description={
          isEdit
            ? "Changes apply everywhere the product is used: orders, inventory and the customer app."
            : duplicateOf
            ? `Starting from ${duplicateOf.name}. Barcode, SKU, images and stock are not copied.`
            : "Everything a pharmacy needs to find, price and order this product. Fields marked * are required to publish."
        }
        actions={
          <Link href={item ? `/catalog/${item.id}` : "/catalog"} className={btn.secondary}>
            <ArrowLeft className="size-4" aria-hidden />
            Cancel
          </Link>
        }
      />

      {!allowed && (
        <Notice tone="rose" title="You can view this form but not save it">
          Your role does not have permission to {isEdit ? "edit" : "create"} catalog products.
        </Notice>
      )}

      <div ref={summaryRef} className="scroll-mt-20">
        {shown.length > 0 && <ErrorSummary errors={shown} draftMode={showErrors === "draft"} />}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------- Summary (top on mobile, sticky right on desktop) ---------- */}
        <aside className="lg:sticky lg:top-20 lg:order-2" aria-label="Product summary">
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((o) => !o)}
              aria-expanded={summaryOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:hidden"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-apptext-primary">{draft.name || "Untitled product"}</span>
                <span className="block text-xs tabular-nums text-apptext-secondary">
                  {x.packSell > 0 ? `${formatCurrency(x.packSell)} per ${x.defaultLevel.name.toLowerCase()}` : "No price yet"} ·{" "}
                  {fmtPct(x.margin)} margin
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", summaryOpen && "rotate-180")} aria-hidden />
            </button>
            <div className={cn("border-t border-slate-100 lg:block lg:border-t-0", summaryOpen ? "block" : "hidden")}>
              <Summary draft={effective} x={x} sectionState={sectionState} isEdit={isEdit} />
              <div className="hidden space-y-2 border-t border-slate-100 p-4 lg:block">
                <SaveButtons isEdit={isEdit} allowed={allowed} onSave={save} stacked />
                {dirty && <p className="text-center text-xs text-amber-700">Unsaved changes</p>}
              </div>
            </div>
          </Card>
        </aside>

        {/* ---------- Sections ---------- */}
        <div className="min-w-0 space-y-5 lg:order-1">
          <BasicSection {...sectionProps} brands={brands} categories={categories} dosageForms={dosageForms} suppliers={suppliers} />
          <PacksSection {...sectionProps} units={units} />
          <PricingSection {...sectionProps} />
          <TiersSection {...sectionProps} />
          <InventorySection
            {...sectionProps}
            autoSku={autoSku}
            suppliers={suppliers}
            warehouses={warehouses}
          />
          <OpeningSection {...sectionProps} isEdit={isEdit} warehouses={warehouses} skuPrefix={brandMeta?.skuPrefix ?? "CP"} />
          <MediaSection {...sectionProps} createdUrls={createdUrls} notify={notify} />
          <VisibilitySection {...sectionProps} isEdit={isEdit} />
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <SaveButtons isEdit={isEdit} allowed={allowed} onSave={save} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

interface SectionProps {
  draft: ProductDraft;
  set: (patch: Partial<ProductDraft>) => void;
  x: Derived;
  errorFor: (key: string) => string | undefined;
  full: { errors: Issue[]; warnings: Issue[] };
}

function SaveButtons({
  isEdit,
  allowed,
  onSave,
  stacked,
}: {
  isEdit: boolean;
  allowed: boolean;
  onSave: (k: SaveKind) => void;
  stacked?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", stacked ? "flex-col" : "flex-row")}>
      <button type="button" onClick={() => onSave("save")} disabled={!allowed} className={cn(btn.primary, "flex-1")}>
        <Save className="size-4" aria-hidden />
        Save product
      </button>
      <button type="button" onClick={() => onSave("draft")} disabled={!allowed} className={cn(btn.secondary, "flex-1")}>
        Save as draft
      </button>
      {!isEdit && stacked && (
        <button type="button" onClick={() => onSave("another")} disabled={!allowed} className={cn(btn.ghost, "w-full")}>
          <Plus className="size-4" aria-hidden />
          Save & add another
        </button>
      )}
    </div>
  );
}

function FormSection({
  id,
  step,
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  id: SectionId;
  step: number;
  title: string;
  description?: React.ReactNode;
  icon: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="scroll-mt-20">
      <section id={`sec-${id}`} aria-labelledby={`sec-${id}-title`} className="scroll-mt-20">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id={`sec-${id}-title`} className="text-base font-semibold text-apptext-primary">
                <span className="mr-1.5 text-sm font-medium tabular-nums text-slate-400">{step}.</span>
                {title}
              </h2>
              {description && <p className="text-pretty text-sm text-apptext-secondary">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="space-y-4 p-4 sm:p-5">{children}</div>
      </section>
    </Card>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "amber" | "rose" | "blue";
  title?: string;
  children?: React.ReactNode;
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];
  const Icon = tone === "blue" ? Info : tone === "amber" ? AlertTriangle : CircleAlert;
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", styles)} role={tone === "rose" ? "alert" : undefined}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-pretty">{children}</div>}
      </div>
    </div>
  );
}

function SectionWarnings({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <Notice tone="amber" title={issues.length === 1 ? "Check this" : `Check ${issues.length} things`}>
      <ul className="list-disc space-y-0.5 pl-4">
        {issues.map((w, i) => (
          <li key={`${w.key}-${i}`}>{w.message}</li>
        ))}
      </ul>
    </Notice>
  );
}

function ErrorSummary({ errors, draftMode }: { errors: Issue[]; draftMode: boolean }) {
  const go = (section: SectionId) =>
    document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-2.5">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-rose-900">
            {errors.length} {plural("problem", errors.length)} to fix before {draftMode ? "saving the draft" : "saving"}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {errors.map((e, i) => (
              <li key={`${e.key}-${i}`}>
                <button type="button" onClick={() => go(e.section)} className="text-left text-rose-800 hover:underline">
                  <span className="font-medium">{SECTIONS.find((s) => s.id === e.section)?.label}:</span> {e.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = "0.00",
  suffix,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">৳</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, "pl-7 tabular-nums", suffix && "pr-16", invalid && errorRing)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      )}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  suffix,
  step = "1",
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  suffix?: string;
  step?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        aria-label={ariaLabel}
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, "tabular-nums", suffix && "pr-14", invalid && errorRing)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 max-w-[45%] -translate-y-1/2 truncate text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

const req = (label: string) => `${label} *`;

/* ------------------------------------------------------------------ */
/* 1. Basic information                                                */
/* ------------------------------------------------------------------ */

function BasicSection({
  draft,
  set,
  errorFor,
  full,
  brands,
  categories,
  dosageForms,
  suppliers,
}: SectionProps & {
  brands: ReturnType<typeof useCatalog>["brands"];
  categories: ReturnType<typeof useCatalog>["categories"];
  dosageForms: ReturnType<typeof useCatalog>["dosageForms"];
  suppliers: ReturnType<typeof useInventory>["suppliers"];
}) {
  const category = categories.find((c) => c.nameEn === draft.category);
  const subcategories = (category?.subcategories ?? []).filter((s) => s.isActive || s.nameEn === draft.subcategory);
  const activeBrands = brands.filter((b) => b.isActive || b.name === draft.brand);
  const activeCategories = categories
    .filter((c) => c.isActive || c.nameEn === draft.category)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const forms = dosageForms.filter((d) => d.isActive || d.name === draft.dosageForm);
  const storageOptions = STORAGE_CONDITIONS.includes(draft.storageCondition)
    ? STORAGE_CONDITIONS
    : [draft.storageCondition, ...STORAGE_CONDITIONS].filter(Boolean);

  return (
    <FormSection id="basic" step={1} icon={Tag} title="Basic information" description="How the product is named, registered and stored.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={req("Product name (English)")} error={errorFor("name")} hint="Brand name with strength, as printed on the pack.">
          {(id) => (
            <input
              id={id}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Napa Extra 500mg Tablet"
              className={cn(inputClass, errorFor("name") && errorRing)}
            />
          )}
        </Field>
        <Field label="Product name (Bangla)" hint="Shown in the customer app when Bangla is selected.">
          {(id) => (
            <input
              id={id}
              lang="bn"
              value={draft.nameBn}
              onChange={(e) => set({ nameBn: e.target.value })}
              placeholder="যেমন: নাপা এক্সট্রা ৫০০ মি.গ্রা."
              className={inputClass}
            />
          )}
        </Field>
        <Field label={req("Generic name")} error={errorFor("genericName")}>
          {(id) => (
            <input
              id={id}
              value={draft.genericName}
              onChange={(e) => set({ genericName: e.target.value })}
              placeholder="e.g. Paracetamol + Caffeine"
              className={cn(inputClass, errorFor("genericName") && errorRing)}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Strength">
            {(id) => (
              <input
                id={id}
                value={draft.strength}
                onChange={(e) => set({ strength: e.target.value })}
                placeholder="500mg"
                className={inputClass}
              />
            )}
          </Field>
          <Field label={req("Dosage form")} error={errorFor("dosageForm")}>
            {(id) => (
              <select
                id={id}
                value={draft.dosageForm}
                onChange={(e) => {
                  const df = dosageForms.find((d) => d.name === e.target.value);
                  set({ dosageForm: e.target.value, ...(df ? { baseUnit: df.defaultBaseUnit } : {}) });
                }}
                className={cn(inputClass, errorFor("dosageForm") && errorRing)}
              >
                <option value="">Select…</option>
                {forms.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label={req("Brand / manufacturer")} error={errorFor("brand")}>
          {(id) => (
            <select
              id={id}
              value={draft.brand}
              onChange={(e) => {
                const supplierId = draft.supplierId || suggestSupplier(e.target.value, suppliers) || "";
                set({ brand: e.target.value, supplierId });
              }}
              className={cn(inputClass, errorFor("brand") && errorRing)}
            >
              <option value="">Select brand…</option>
              {activeBrands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name} ({b.countryOfOrigin})
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={req("Category")} error={errorFor("category")}>
            {(id) => (
              <select
                id={id}
                value={draft.category}
                onChange={(e) => set({ category: e.target.value, subcategory: "" })}
                className={cn(inputClass, errorFor("category") && errorRing)}
              >
                <option value="">Select…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.nameEn}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Subcategory">
            {(id) => (
              <select
                id={id}
                value={draft.subcategory}
                onChange={(e) => set({ subcategory: e.target.value })}
                disabled={!category || subcategories.length === 0}
                className={inputClass}
              >
                <option value="">{category ? "None" : "Pick a category first"}</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.nameEn}>
                    {s.nameEn}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="DGDA registration no." error={errorFor("dgdaRegNo")} hint="Required for medicines, IV fluids and Herbal/Unani.">
          {(id) => (
            <input
              id={id}
              value={draft.dgdaRegNo}
              onChange={(e) => set({ dgdaRegNo: e.target.value })}
              placeholder="e.g. 037-0412-001"
              className={cn(inputClass, "font-mono", errorFor("dgdaRegNo") && errorRing)}
            />
          )}
        </Field>
        <Field label="Barcode (base unit)" error={errorFor("barcode")} hint="EAN-13 printed on the unit, or generate an in-house code.">
          {(id) => (
            <div className="flex gap-2">
              <input
                id={id}
                inputMode="numeric"
                value={draft.barcode}
                onChange={(e) => set({ barcode: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                placeholder="13 digits"
                className={cn(inputClass, "font-mono tabular-nums", errorFor("barcode") && errorRing)}
              />
              <button type="button" onClick={() => set({ barcode: randomEan13() })} className={cn(btn.secondary, "shrink-0")}>
                <Barcode className="size-4" aria-hidden />
                Generate
              </button>
            </div>
          )}
        </Field>
        <Field label="Description" className="sm:col-span-2" hint="Indications, pack notes or anything the sales team should know.">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              className={cn(inputClass, "resize-y")}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-surface/60 p-4 sm:grid-cols-3">
        <Switch
          checked={draft.isPrescriptionRequired}
          onChange={(v) => set({ isPrescriptionRequired: v })}
          label="Prescription required"
          description="Customers must upload an Rx."
        />
        <Switch
          checked={draft.isControlled}
          onChange={(v) => set({ isControlled: v, ...(v ? { isPrescriptionRequired: true } : {}) })}
          label="Controlled drug"
          description="Narcotic/psychotropic register."
        />
        <Switch
          checked={draft.isColdChain}
          onChange={(v) =>
            set({ isColdChain: v, ...(v && !/2\s*[–-]\s*8/.test(draft.storageCondition) ? { storageCondition: STORAGE_CONDITIONS[2] } : {}) })
          }
          label="Cold chain"
          description="Stored and delivered at 2–8°C."
        />
      </div>

      <Field label={req("Storage condition")} error={errorFor("storageCondition")}>
        {(id) => (
          <select
            id={id}
            value={draft.storageCondition}
            onChange={(e) => set({ storageCondition: e.target.value })}
            className={cn(inputClass, "sm:max-w-sm", errorFor("storageCondition") && errorRing)}
          >
            {storageOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </Field>
      <SectionWarnings issues={full.warnings.filter((w) => w.section === "basic")} />
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Units & pack hierarchy                                           */
/* ------------------------------------------------------------------ */

function PacksSection({ draft, set, x, errorFor, units }: SectionProps & { units: ReturnType<typeof useCatalog>["units"] }) {
  const baseUnits = units.filter((u) => (u.kind !== "PACK" && u.isActive) || u.name === draft.baseUnit);
  const packUnits = units.filter((u) => u.isActive);

  const addLevel = () => {
    const used = new Set([draft.baseUnit, ...draft.packs.map((p) => p.name)]);
    const name = ["Strip", "Box", "Carton"].find((n) => !used.has(n)) ?? "";
    set({ packs: [...draft.packs, { key: newKey(), name, perParent: name === "Carton" ? "20" : "10", barcode: "", sellable: name !== "Carton" }] });
  };
  const removeLevel = (key: string) => {
    const idx = draft.packs.findIndex((p) => p.key === key);
    const packs = draft.packs.filter((p) => p.key !== key);
    const fallback = idx > 0 ? draft.packs[idx - 1].key : "base";
    set({
      packs,
      defaultPackKey: draft.defaultPackKey === key ? fallback : draft.defaultPackKey,
      purchasePackKey: draft.purchasePackKey === key ? fallback : draft.purchasePackKey,
      openingLevelKey: draft.openingLevelKey === key ? fallback : draft.openingLevelKey,
    });
  };
  const updatePack = (key: string, patch: Partial<ProductDraft["packs"][number]>) =>
    set({ packs: draft.packs.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

  return (
    <FormSection
      id="packs"
      step={2}
      icon={Layers}
      title="Units & pack hierarchy"
      description="Stock is always counted in the base unit. Every pack size is a conversion of it: each level holds a whole number of the level below."
      actions={
        <button type="button" onClick={addLevel} disabled={draft.packs.length >= 4} className={btn.small}>
          <Plus className="size-3.5" aria-hidden />
          Add pack level
        </button>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface text-xs font-medium text-apptext-secondary">
            <tr>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Contains</th>
              <th className="px-3 py-2 text-right">= Base units</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2 text-center">Sellable</th>
              <th className="px-3 py-2 text-center">Default sale unit</th>
              <th className="px-3 py-2 text-center">Purchase unit</th>
              <th className="px-3 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className={cn(draft.defaultPackKey === "base" && "bg-brand-light/30")}>
              <td className="px-3 py-2.5 text-xs font-medium text-slate-500">Base</td>
              <td className="px-3 py-2.5">
                <select
                  aria-label="Base unit"
                  value={draft.baseUnit}
                  onChange={(e) => set({ baseUnit: e.target.value })}
                  className={cn(inputClass, "w-36", errorFor("baseUnit") && errorRing)}
                >
                  {baseUnits.map((u) => (
                    <option key={u.id}>{u.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2.5 text-xs text-apptext-secondary">Smallest countable unit</td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">1</td>
              <td className="px-3 py-2.5 text-xs text-apptext-secondary">Set in basic information</td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  aria-label={`Customers can order loose ${plural(draft.baseUnit, 2).toLowerCase()}`}
                  checked={draft.baseSellable || draft.defaultPackKey === "base"}
                  disabled={draft.defaultPackKey === "base"}
                  onChange={(e) => set({ baseSellable: e.target.checked })}
                  className="size-4 accent-brand-primary"
                />
              </td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="radio"
                  name="default-pack"
                  aria-label={`Sell per ${draft.baseUnit}`}
                  checked={draft.defaultPackKey === "base"}
                  onChange={() => set({ defaultPackKey: "base", baseSellable: true })}
                  className="size-4 accent-brand-primary"
                />
              </td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="radio"
                  name="purchase-pack"
                  aria-label={`Buy per ${draft.baseUnit}`}
                  checked={draft.purchasePackKey === "base"}
                  onChange={() => set({ purchasePackKey: "base" })}
                  className="size-4 accent-brand-primary"
                />
              </td>
              <td />
            </tr>
            {draft.packs.map((p, i) => {
              const level = x.levels[i + 1];
              const below = x.levels[i];
              return (
                <tr key={p.key} className={cn(draft.defaultPackKey === p.key && "bg-brand-light/30")}>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <select
                      aria-label={`Pack level ${i + 1} unit`}
                      value={p.name}
                      onChange={(e) => updatePack(p.key, { name: e.target.value })}
                      className={cn(inputClass, "w-36", errorFor(`pack.${p.key}.name`) && errorRing)}
                    >
                      <option value="">Select…</option>
                      {packUnits.map((u) => (
                        <option key={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <NumberInput
                          ariaLabel={`${below.name}s per ${p.name || "pack"}`}
                          value={p.perParent}
                          onChange={(v) => updatePack(p.key, { perParent: v })}
                          invalid={!!errorFor(`pack.${p.key}.perParent`)}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs text-apptext-secondary">{plural(below.name, 2)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-apptext-primary">
                    {level.multiplier.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <input
                        aria-label={`${p.name || "Pack"} barcode`}
                        inputMode="numeric"
                        value={p.barcode}
                        onChange={(e) => updatePack(p.key, { barcode: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                        placeholder="Optional"
                        className={cn(inputClass, "w-36 font-mono text-xs tabular-nums", errorFor(`pack.${p.key}.barcode`) && errorRing)}
                      />
                      <button
                        type="button"
                        onClick={() => updatePack(p.key, { barcode: randomEan13() })}
                        aria-label={`Generate barcode for ${p.name || "pack"}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-primary"
                      >
                        <Barcode className="size-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Customers can order by the ${(p.name || "pack").toLowerCase()}`}
                      checked={p.sellable || draft.defaultPackKey === p.key}
                      disabled={draft.defaultPackKey === p.key}
                      onChange={(e) => updatePack(p.key, { sellable: e.target.checked })}
                      className="size-4 accent-brand-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="radio"
                      name="default-pack"
                      aria-label={`Sell per ${p.name || "pack"}`}
                      checked={draft.defaultPackKey === p.key}
                      onChange={() => set({ defaultPackKey: p.key, packs: draft.packs.map((q) => (q.key === p.key ? { ...q, sellable: true } : q)) })}
                      className="size-4 accent-brand-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="radio"
                      name="purchase-pack"
                      aria-label={`Buy per ${p.name || "pack"}`}
                      checked={draft.purchasePackKey === p.key}
                      onChange={() => set({ purchasePackKey: p.key })}
                      className="size-4 accent-brand-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeLevel(p.key)}
                      aria-label={`Remove ${p.name || "pack level"}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {["defaultPack", "purchasePack"].map((f) => {
        const msg = errorFor(f);
        return msg ? (
          <p key={f} className="text-xs text-rose-600">
            {msg}
          </p>
        ) : null;
      })}
      {draft.packs.map((p) =>
        ["name", "perParent", "barcode"].map((f) => {
          const msg = errorFor(`pack.${p.key}.${f}`);
          return msg ? (
            <p key={`${p.key}-${f}`} className="text-xs text-rose-600">
              {msg}
            </p>
          ) : null;
        })
      )}

      <div className="flex flex-col gap-3 rounded-lg bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-apptext-secondary">Pack breakdown</p>
          <p className="font-semibold tabular-nums text-apptext-primary">{hierarchyText(x.levels)}</p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-xs font-medium text-apptext-secondary">Default sale unit</p>
          <p className="font-semibold text-brand-primary">
            1 {x.defaultLevel.name}
            {x.mult > 1 && (
              <span className="font-normal tabular-nums text-apptext-secondary">
                {" "}
                = {levelQty(x.mult, x.levels[0].name)}
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="text-xs text-apptext-secondary">
        Stock, batches, counts and FEFO picking always run in {plural(x.levels[0].name, 2).toLowerCase()}. Orders can be taken in any
        sellable unit (default: {x.defaultLevel.name.toLowerCase()}); purchase orders and goods receiving use the purchase unit. Prices
        below are entered per base unit and multiplied up for every pack.
      </p>
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Pricing                                                          */
/* ------------------------------------------------------------------ */

function PricingSection({ draft, set, x, errorFor, full }: SectionProps) {
  const base = x.levels[0].name.toLowerCase();
  const aboveMrp = x.sell > 0 && x.mrp > 0 && x.sell > x.mrp;
  const profitPerPack = Number.isFinite(x.packSell - x.packCost) ? round2(x.packSell - x.packCost) : NaN;
  const vat = num(draft.vatPct);

  return (
    <FormSection id="pricing" step={3} icon={Sparkles} title="Pricing" description={`All prices are per ${base}. Pack prices are worked out for you.`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={req(`Purchase cost / ${base}`)} error={errorFor("costPrice")}>
          {(id) => <MoneyInput id={id} value={draft.costPrice} onChange={(v) => set({ costPrice: v })} invalid={!!errorFor("costPrice")} />}
        </Field>
        <Field label={req(`MRP / ${base}`)} error={errorFor("mrp")} hint="Printed maximum retail price.">
          {(id) => <MoneyInput id={id} value={draft.mrp} onChange={(v) => set({ mrp: v })} invalid={!!errorFor("mrp")} />}
        </Field>
        <Field label={req(`Selling price / ${base}`)} error={errorFor("sellingPrice")} hint="Trade price to customers.">
          {(id) => (
            <MoneyInput
              id={id}
              value={draft.sellingPrice}
              onChange={(v) => set({ sellingPrice: v })}
              invalid={!!errorFor("sellingPrice") || aboveMrp}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Margin" value={fmtPct(x.margin)} tone={marginTone(x.margin)} hint="On selling price" />
        <Metric label="Markup" value={fmtPct(x.markup)} tone={marginTone(x.margin)} hint="On cost" />
        <Metric
          label={`Profit / ${x.defaultLevel.name.toLowerCase()}`}
          value={Number.isFinite(profitPerPack) ? formatCurrency(profitPerPack) : "—"}
          tone={marginTone(x.margin)}
        />
        <Metric
          label="Margin at max discount"
          value={fmtPct(x.marginAtMaxDiscount)}
          tone={marginTone(x.marginAtMaxDiscount)}
          hint={`${Number.isFinite(num(draft.maxDiscountPct)) ? num(draft.maxDiscountPct) : 0}% off`}
        />
      </div>

      {aboveMrp && (
        <Notice tone="rose" title="Selling price is above MRP">
          Selling above the printed MRP is not allowed. Lower the selling price to {formatCurrency(x.mrp)} or less.
        </Notice>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface text-xs font-medium text-apptext-secondary">
            <tr>
              <th className="px-3 py-2">Pack</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">MRP</th>
              <th className="px-3 py-2 text-right">Selling</th>
              <th className="px-3 py-2 text-right">Selling + VAT</th>
              <th className="px-3 py-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {x.levels.map((l) => {
              const money = (n: number) => (Number.isFinite(n) && n > 0 ? formatCurrency(round2(n * l.multiplier)) : "—");
              return (
                <tr key={l.key} className={cn(l.key === x.defaultLevel.key && "bg-brand-light/30")}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-apptext-primary">1 {l.name}</span>
                    {l.multiplier > 1 && <span className="ml-1 text-xs text-apptext-secondary">({levelQty(l.multiplier, x.levels[0].name)})</span>}
                    {l.key === x.defaultLevel.key && (
                      <span className="ml-1.5 rounded bg-brand-light px-1 py-px text-[11px] font-medium text-brand-primary">Default</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{money(x.cost)}</td>
                  <td className="px-3 py-2 text-right">{money(x.mrp)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-apptext-primary">{money(x.sell)}</td>
                  <td className="px-3 py-2 text-right text-apptext-secondary">
                    {Number.isFinite(vat) ? money(x.sell * (1 + vat / 100)) : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right font-medium", marginTone(x.margin))}>{fmtPct(x.margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="VAT %" error={errorFor("vatPct")} hint="Most medicines are VAT-exempt (0%).">
          {(id) => <NumberInput id={id} step="0.5" value={draft.vatPct} onChange={(v) => set({ vatPct: v })} suffix="%" invalid={!!errorFor("vatPct")} />}
        </Field>
        <Field label="Max discount %" error={errorFor("maxDiscountPct")} hint="Cap for order and tier discounts.">
          {(id) => (
            <NumberInput
              id={id}
              step="0.5"
              value={draft.maxDiscountPct}
              onChange={(v) => set({ maxDiscountPct: v })}
              suffix="%"
              invalid={!!errorFor("maxDiscountPct")}
            />
          )}
        </Field>
        <Field label="Minimum order" error={errorFor("minOrderQty")}>
          {(id) => (
            <NumberInput
              id={id}
              value={draft.minOrderQty}
              onChange={(v) => set({ minOrderQty: v })}
              suffix={plural(x.defaultLevel.name, 2).toLowerCase()}
              invalid={!!errorFor("minOrderQty")}
            />
          )}
        </Field>
      </div>
      <SectionWarnings issues={full.warnings.filter((w) => w.section === "pricing")} />
    </FormSection>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="text-xs text-apptext-secondary">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", tone ?? "text-apptext-primary")}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Quantity pricing tiers                                           */
/* ------------------------------------------------------------------ */

function TiersSection({ draft, set, x, errorFor, full }: SectionProps) {
  const base = x.levels[0];
  // Units customers can order in: default first, then the others smallest first.
  const sellableKeys = new Set([...(draft.baseSellable ? ["base"] : []), ...draft.packs.filter((p) => p.sellable).map((p) => p.key), x.defaultLevel.key]);
  const units = [x.defaultLevel, ...x.levels.filter((l) => l.key !== x.defaultLevel.key && sellableKeys.has(l.key))];
  const [tab, setTab] = useState(x.defaultLevel.key);
  const active = units.find((u) => u.key === tab) ?? units[0];
  const isDefault = active.key === x.defaultLevel.key;
  const own = isDefault || draft.levelTiers[active.key] !== undefined;
  const liveErrors = full.errors.filter((e) => e.section === "tiers");

  const tiers = isDefault ? draft.tiers : draft.levelTiers[active.key] ?? [];
  const rows = isDefault ? x.tierRows : x.levelTierRows[active.key] ?? [];
  const setTiers = (list: TierDraft[]) =>
    isDefault ? set({ tiers: list }) : set({ levelTiers: { ...draft.levelTiers, [active.key]: list } });
  const setOwn = (on: boolean) => {
    const next = { ...draft.levelTiers };
    if (on) next[active.key] = suggestedTiers();
    else delete next[active.key];
    set({ levelTiers: next });
  };
  const ownCount = (key: string) => (key === x.defaultLevel.key ? draft.tiers.length : draft.levelTiers[key]?.length ?? 0);
  const example = x.defaultLevel.multiplier / Math.max(1, active.multiplier);

  return (
    <FormSection
      id="tiers"
      step={4}
      icon={Boxes}
      title="Quantity pricing tiers"
      description="Bulk prices by order quantity. Set them for the default unit, and give any other pack size its own ladder if it sells differently."
    >
      {units.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Unit">
          {units.map((u) => {
            const on = u.key === active.key;
            const count = ownCount(u.key);
            const inherits = u.key !== x.defaultLevel.key && draft.levelTiers[u.key] === undefined;
            return (
              <button
                key={u.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(u.key)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  on ? "border-brand-primary bg-brand-light text-brand-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {u.name}
                <span className="ml-1.5 text-xs font-normal text-apptext-secondary">
                  {u.key === x.defaultLevel.key ? "default" : inherits ? "inherits" : `${count} ${plural("tier", count)}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isDefault && (
        <Switch
          checked={own}
          onChange={setOwn}
          label={`Own tiers for ${plural(active.name, 2).toLowerCase()}`}
          description={
            own
              ? `${active.name} orders are priced by how many ${plural(active.name, 2).toLowerCase()} are ordered.`
              : `Off: ${plural(active.name, 2).toLowerCase()} use the ${x.defaultLevel.name.toLowerCase()} tiers by ${base.name.toLowerCase()} count${
                  example > 1 && Number.isInteger(example) ? ` (${example} ${plural(active.name, example).toLowerCase()} count as 1 ${x.defaultLevel.name.toLowerCase()})` : ""
                }.`
          }
        />
      )}

      {own && (
        <TierEditor
          key={active.key}
          unitName={active.name}
          baseName={base.name}
          multiplier={Math.max(1, active.multiplier)}
          packSell={round2((Number.isFinite(x.sell) ? x.sell : 0) * Math.max(1, active.multiplier))}
          packCost={round2((Number.isFinite(x.cost) ? x.cost : 0) * Math.max(1, active.multiplier))}
          tiers={tiers}
          rows={rows}
          onChange={setTiers}
          errorFor={errorFor}
          liveErrors={liveErrors}
        />
      )}

      {liveErrors.length > 0 && (
        <Notice tone="rose" title="Tier problems">
          <ul className="list-disc space-y-0.5 pl-4">
            {liveErrors.map((e, i) => (
              <li key={`${e.key}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </Notice>
      )}
      <SectionWarnings issues={full.warnings.filter((w) => w.section === "tiers")} />
    </FormSection>
  );
}

/** Editable tier table for one unit, with a live "what the customer pays" preview. */
function TierEditor({
  unitName,
  baseName,
  multiplier,
  packSell,
  packCost,
  tiers,
  rows,
  onChange,
  errorFor,
  liveErrors,
}: {
  unitName: string;
  baseName: string;
  multiplier: number;
  packSell: number;
  packCost: number;
  tiers: TierDraft[];
  rows: Derived["tierRows"];
  onChange: (t: TierDraft[]) => void;
  errorFor: (key: string) => string | undefined;
  liveErrors: Issue[];
}) {
  const unit = unitName.toLowerCase();
  const units = plural(unitName, 2).toLowerCase();
  const sorted = [...rows].filter((t) => Number.isFinite(t.min)).sort((a, b) => a.min - b.min);
  const bad = (k: string) => !!errorFor(k) || liveErrors.some((e) => e.key === k);

  const addTier = () => {
    const last = sorted[sorted.length - 1];
    const min = last ? (last.max === null ? "" : String(last.max + 1)) : "1";
    onChange([...tiers, { key: newKey(), min, max: "", mode: "DISCOUNT", value: "" }]);
  };
  const update = (key: string, patch: Partial<TierDraft>) => onChange(tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-apptext-secondary">
          Quantities in {units} · list price {packSell > 0 ? formatCurrency(packSell) : "—"} per {unit}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange(suggestedTiers())} className={btn.small}>
            Use 0 / 5 / 10 / 15% ladder
          </button>
          <button type="button" onClick={addTier} className={btn.small}>
            <Plus className="size-3.5" aria-hidden />
            Add tier
          </button>
        </div>
      </div>

      {tiers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-apptext-secondary">
          No tiers. Every order is charged {packSell > 0 ? formatCurrency(packSell) : "the selling price"} per {unit}.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1.3fr_1.2fr_1fr_auto] gap-2 px-1 text-xs font-medium text-apptext-secondary md:grid">
            <span>Min {units}</span>
            <span>Max {units}</span>
            <span>Price by</span>
            <span>Value</span>
            <span className="text-right">Works out to</span>
            <span className="w-8" />
          </div>
          {tiers.map((t, i) => {
            const row = rows[i];
            return (
              <div
                key={t.key}
                className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-2.5 md:grid-cols-[1fr_1fr_1.3fr_1.2fr_1fr_auto] md:items-center md:border-0 md:p-1"
              >
                <NumberInput ariaLabel={`${unitName} tier ${i + 1} minimum`} value={t.min} onChange={(v) => update(t.key, { min: v })} invalid={bad(`tier.${t.key}.min`)} placeholder="Min" />
                <NumberInput ariaLabel={`${unitName} tier ${i + 1} maximum`} value={t.max} onChange={(v) => update(t.key, { max: v })} invalid={bad(`tier.${t.key}.max`)} placeholder="and above" />
                <div className="col-span-2 flex rounded-lg border border-slate-200 p-0.5 md:col-span-1" role="group" aria-label={`Tier ${i + 1} price type`}>
                  {(["DISCOUNT", "PRICE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={t.mode === m}
                      onClick={() => update(t.key, { mode: m, value: "" })}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
                        t.mode === m ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {m === "DISCOUNT" ? "Discount %" : `Price / ${unit}`}
                    </button>
                  ))}
                </div>
                {t.mode === "PRICE" ? (
                  <MoneyInput id={`tier-${t.key}`} value={t.value} onChange={(v) => update(t.key, { value: v })} invalid={bad(`tier.${t.key}.value`)} />
                ) : (
                  <NumberInput ariaLabel={`${unitName} tier ${i + 1} discount`} step="0.5" value={t.value} onChange={(v) => update(t.key, { value: v })} suffix="%" invalid={bad(`tier.${t.key}.value`)} />
                )}
                <p className="text-right text-sm tabular-nums text-apptext-secondary">
                  {t.mode === "PRICE"
                    ? row && Number.isFinite(row.discountPct)
                      ? `${row.discountPct.toFixed(1)}% off`
                      : "—"
                    : row && row.packPrice > 0
                    ? formatCurrency(row.packPrice)
                    : "—"}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(tiers.filter((r) => r.key !== t.key))}
                  aria-label={`Remove ${unit} tier ${i + 1}`}
                  className="justify-self-end rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <p className="border-b border-slate-100 bg-surface px-3 py-2 text-xs font-medium text-apptext-secondary">Preview: what a customer pays per {unit}</p>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-apptext-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Order quantity</th>
                <th className="px-3 py-2 text-right font-medium">Price / {unit}</th>
                <th className="px-3 py-2 text-right font-medium">Per {baseName.toLowerCase()}</th>
                <th className="px-3 py-2 text-right font-medium">Discount</th>
                <th className="px-3 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {sorted.map((t) => {
                const m = packCost > 0 && t.packPrice > 0 ? ((t.packPrice - packCost) / t.packPrice) * 100 : null;
                return (
                  <tr key={t.key}>
                    <td className="px-3 py-2 font-medium text-apptext-primary">
                      {t.max === null ? `${t.min}+` : t.min === t.max ? `${t.min}` : `${t.min}–${t.max}`} {plural(unitName, t.max ?? 2).toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{t.packPrice > 0 ? formatCurrency(t.packPrice) : "—"}</td>
                    <td className="px-3 py-2 text-right text-apptext-secondary">{t.packPrice > 0 ? formatCurrency(round2(t.packPrice / multiplier)) : "—"}</td>
                    <td className="px-3 py-2 text-right">{Number.isFinite(t.discountPct) ? `${t.discountPct.toFixed(1)}%` : "—"}</td>
                    <td className={cn("px-3 py-2 text-right font-medium", marginTone(m))}>{fmtPct(m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Inventory                                                        */
/* ------------------------------------------------------------------ */

function InventorySection({
  draft,
  set,
  x,
  errorFor,
  full,
  autoSku,
  suppliers,
  warehouses,
}: SectionProps & {
  autoSku: string;
  suppliers: ReturnType<typeof useInventory>["suppliers"];
  warehouses: ReturnType<typeof useInventory>["warehouses"];
}) {
  const base = x.levels[0].name;
  const inPacks = (s: string) => {
    const n = Math.floor(num(s));
    if (!Number.isFinite(n) || x.mult <= 1) return undefined;
    return `≈ ${(n / x.mult).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${plural(x.defaultLevel.name, n / x.mult).toLowerCase()}`;
  };
  return (
    <FormSection id="inventory" step={5} icon={WarehouseIcon} title="Inventory" description={`Stock levels are in ${plural(base, 2).toLowerCase()}.`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={req("SKU")}
          error={errorFor("sku")}
          hint={draft.skuTouched ? "Edited by hand." : "Auto: brand prefix, name and strength."}
        >
          {(id) => (
            <div className="flex gap-2">
              <input
                id={id}
                value={draft.sku}
                onChange={(e) => set({ sku: e.target.value.toUpperCase().replace(/\s+/g, "-"), skuTouched: true })}
                placeholder="Fills in as you type the name"
                className={cn(inputClass, "font-mono", errorFor("sku") && errorRing)}
              />
              <button
                type="button"
                onClick={() => set({ sku: "", skuTouched: false })}
                aria-label="Regenerate SKU"
                title={`Regenerate (${autoSku})`}
                className={cn(btn.secondary, "shrink-0 px-2.5")}
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          )}
        </Field>
        <Field label={req("Reorder level")} error={errorFor("reorderLevel")} hint={inPacks(draft.reorderLevel) ?? "Reorder when sellable stock falls to this."}>
          {(id) => (
            <NumberInput
              id={id}
              value={draft.reorderLevel}
              onChange={(v) => set({ reorderLevel: v })}
              suffix={plural(base, 2).toLowerCase()}
              invalid={!!errorFor("reorderLevel")}
            />
          )}
        </Field>
        <Field label="Minimum stock" error={errorFor("minStock")} hint={inPacks(draft.minStock) ?? "Safety stock."}>
          {(id) => <NumberInput id={id} value={draft.minStock} onChange={(v) => set({ minStock: v })} suffix={plural(base, 2).toLowerCase()} invalid={!!errorFor("minStock")} />}
        </Field>
        <Field label="Maximum stock" error={errorFor("maxStock")} hint={inPacks(draft.maxStock) ?? "Reorders will not go above this."}>
          {(id) => <NumberInput id={id} value={draft.maxStock} onChange={(v) => set({ maxStock: v })} suffix={plural(base, 2).toLowerCase()} invalid={!!errorFor("maxStock")} />}
        </Field>
        <Field label={req("Preferred supplier")} error={errorFor("supplierId")}>
          {(id) => (
            <select id={id} value={draft.supplierId} onChange={(e) => set({ supplierId: e.target.value })} className={cn(inputClass, errorFor("supplierId") && errorRing)}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={req("Lead time")} error={errorFor("leadTimeDays")} hint="Days from order to delivery.">
          {(id) => <NumberInput id={id} value={draft.leadTimeDays} onChange={(v) => set({ leadTimeDays: v })} suffix="days" invalid={!!errorFor("leadTimeDays")} />}
        </Field>
        <Field label={req("Default warehouse")} error={errorFor("defaultWarehouseId")}>
          {(id) => (
            <select
              id={id}
              value={draft.defaultWarehouseId}
              onChange={(e) => set({ defaultWarehouseId: e.target.value, openingWarehouseId: e.target.value })}
              className={cn(inputClass, errorFor("defaultWarehouseId") && errorRing)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.hasColdRoom ? " (cold room)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Rack location" hint="Aisle-rack-shelf, e.g. A-01-02.">
          {(id) => (
            <input
              id={id}
              value={draft.defaultLocation}
              onChange={(e) => set({ defaultLocation: e.target.value.toUpperCase() })}
              placeholder="A-01-02"
              className={cn(inputClass, "font-mono")}
            />
          )}
        </Field>
      </div>
      <SectionWarnings issues={full.warnings.filter((w) => w.section === "inventory")} />
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Opening stock                                                    */
/* ------------------------------------------------------------------ */

function OpeningSection({
  draft,
  set,
  x,
  errorFor,
  isEdit,
  warehouses,
  skuPrefix,
}: SectionProps & { isEdit: boolean; warehouses: ReturnType<typeof useInventory>["warehouses"]; skuPrefix: string }) {
  if (isEdit) {
    return (
      <FormSection id="opening" step={6} icon={PackagePlus} title="Stock" description="Opening stock can only be entered when a product is created.">
        <Notice tone="blue">
          Receive new stock through{" "}
          <Link href="/purchases" className="font-medium underline">
            Purchases
          </Link>{" "}
          or correct quantities in{" "}
          <Link href="/inventory/adjustments" className="font-medium underline">
            Inventory adjustments
          </Link>
          .
        </Notice>
      </FormSection>
    );
  }
  const value = x.openingBase * (Number.isFinite(x.openingCost) ? x.openingCost : 0);
  const genBatch = () => {
    const ym = (draft.openingMfg || DEMO_TODAY).slice(2, 7).replace("-", "");
    set({ openingBatch: `${skuPrefix}-${ym}-${String(Math.floor(100 + Math.random() * 900))}` });
  };
  return (
    <FormSection
      id="opening"
      step={6}
      icon={PackagePlus}
      title="Opening stock"
      description="Optional. Creates the first batch and an opening-stock movement in inventory."
    >
      <Switch
        checked={draft.openingEnabled}
        onChange={(v) => set({ openingEnabled: v })}
        label="Record opening stock"
        description="Stock already on the shelf. You can also receive stock later through a purchase."
      />
      {draft.openingEnabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={req("Warehouse")} error={errorFor("openingWarehouseId")}>
              {(id) => (
                <select
                  id={id}
                  value={draft.openingWarehouseId}
                  onChange={(e) => set({ openingWarehouseId: e.target.value })}
                  className={cn(inputClass, errorFor("openingWarehouseId") && errorRing)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.hasColdRoom ? " (cold room)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={req("Batch number")} error={errorFor("openingBatch")}>
              {(id) => (
                <div className="flex gap-2">
                  <input
                    id={id}
                    value={draft.openingBatch}
                    onChange={(e) => set({ openingBatch: e.target.value.toUpperCase() })}
                    placeholder="As printed on the pack"
                    className={cn(inputClass, "font-mono", errorFor("openingBatch") && errorRing)}
                  />
                  <button type="button" onClick={genBatch} className={cn(btn.secondary, "shrink-0")}>
                    Generate
                  </button>
                </div>
              )}
            </Field>
            <Field label={req("Manufacturing date")} error={errorFor("openingMfg")}>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  max={DEMO_TODAY}
                  value={draft.openingMfg}
                  onChange={(e) => set({ openingMfg: e.target.value })}
                  className={cn(inputClass, "tabular-nums", errorFor("openingMfg") && errorRing)}
                />
              )}
            </Field>
            <Field label={req("Expiry date")} error={errorFor("openingExpiry")} hint="Must be after manufacturing and in the future.">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  min={draft.openingMfg || DEMO_TODAY}
                  value={draft.openingExpiry}
                  onChange={(e) => set({ openingExpiry: e.target.value })}
                  className={cn(inputClass, "tabular-nums", errorFor("openingExpiry") && errorRing)}
                />
              )}
            </Field>
            <Field label={req("Quantity")} error={errorFor("openingQty")}>
              {(id) => (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NumberInput id={id} value={draft.openingQty} onChange={(v) => set({ openingQty: v })} invalid={!!errorFor("openingQty")} />
                  </div>
                  <select
                    aria-label="Quantity unit"
                    value={x.openingLevel.key}
                    onChange={(e) => set({ openingLevelKey: e.target.value })}
                    className={cn(inputClass, "w-32")}
                  >
                    {x.levels.map((l) => (
                      <option key={l.key} value={l.key}>
                        {plural(l.name, 2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
            <Field
              label={`Unit cost / ${x.levels[0].name.toLowerCase()}`}
              error={errorFor("openingUnitCost")}
              hint={x.cost > 0 ? `Blank uses the purchase cost (${formatCurrency(x.cost)}).` : undefined}
            >
              {(id) => (
                <MoneyInput
                  id={id}
                  value={draft.openingUnitCost}
                  onChange={(v) => set({ openingUnitCost: v })}
                  placeholder={x.cost > 0 ? String(x.cost) : "0.00"}
                  invalid={!!errorFor("openingUnitCost")}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-apptext-secondary">Will be stocked as</span>
            <span className="font-semibold tabular-nums text-apptext-primary">
              {levelQty(x.openingBase, x.levels[0].name)}
              {value > 0 && <span className="font-normal text-apptext-secondary"> · value {formatCurrency(round2(value))}</span>}
            </span>
          </div>
        </>
      )}
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Media                                                            */
/* ------------------------------------------------------------------ */

function MediaSection({
  draft,
  set,
  createdUrls,
  notify,
}: SectionProps & { createdUrls: React.MutableRefObject<Set<string>>; notify: (m: string, t?: "success" | "warning") => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES - draft.images.length;

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const tooBig = list.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    const ok = list.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024).slice(0, room);
    if (tooBig.length) notify(`${tooBig.length} ${plural("image", tooBig.length)} over ${MAX_IMAGE_MB} MB skipped.`, "warning");
    if (list.length - tooBig.length > room) notify(`Only ${MAX_IMAGES} images are allowed per product.`, "warning");
    const added = ok.map((f) => {
      const url = URL.createObjectURL(f);
      createdUrls.current.add(url);
      return { key: newKey(), url, name: f.name };
    });
    set({ images: [...draft.images, ...added] });
    if (inputRef.current) inputRef.current.value = "";
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.images];
    const j = i + dir;
    [next[i], next[j]] = [next[j], next[i]];
    set({ images: next });
  };
  const remove = (key: string) => {
    const img = draft.images.find((i) => i.key === key);
    if (img && createdUrls.current.has(img.url)) {
      URL.revokeObjectURL(img.url);
      createdUrls.current.delete(img.url);
    }
    set({ images: draft.images.filter((i) => i.key !== key) });
  };

  return (
    <FormSection
      id="media"
      step={7}
      icon={ImagePlus}
      title="Media"
      description={`Up to ${MAX_IMAGES} images, PNG or JPG, ${MAX_IMAGE_MB} MB each. The first image is the cover.`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {draft.images.map((img, i) => (
          <figure key={img.key} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={img.url} alt={img.name} className="aspect-square w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded bg-brand-primary px-1.5 py-0.5 text-[11px] font-medium text-white">Cover</span>
            )}
            <figcaption className="flex items-center justify-between gap-1 border-t border-slate-200 bg-white px-1.5 py-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${img.name} left`}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(img.key)}
                aria-label={`Remove ${img.name}`}
                className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === draft.images.length - 1}
                aria-label={`Move ${img.name} right`}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ArrowRight className="size-3.5" />
              </button>
            </figcaption>
          </figure>
        ))}
        {room > 0 && (
          <label
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 text-center text-sm text-apptext-secondary transition hover:border-brand-blue hover:bg-brand-light/30 focus-within:border-brand-blue"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
          >
            <ImagePlus className="size-6 text-slate-400" aria-hidden />
            <span className="font-medium text-brand-primary">Add image</span>
            <span className="text-xs tabular-nums">
              {draft.images.length} / {MAX_IMAGES}
            </span>
            <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
      </div>
      <p className="text-xs text-apptext-secondary">Demo: images stay in this browser tab only.</p>
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Visibility                                                       */
/* ------------------------------------------------------------------ */

function VisibilitySection({ draft, set, errorFor, isEdit }: SectionProps & { isEdit: boolean }) {
  const options: { id: DraftStatus; label: string; hint: string }[] = [
    { id: "ACTIVE", label: "Active", hint: "Listed in the customer app and can be ordered." },
    { id: "DRAFT", label: "Draft", hint: "Hidden. Finish the details later." },
    ...(isEdit ? [{ id: "INACTIVE" as const, label: "Inactive", hint: "Hidden. Kept for history and reports." }] : []),
  ];
  const toggleType = (t: CustomerType) =>
    set({ visibleTo: draft.visibleTo.includes(t) ? draft.visibleTo.filter((v) => v !== t) : [...draft.visibleTo, t] });
  const all = draft.visibleTo.length === ALL_CUSTOMER_TYPES.length;

  return (
    <FormSection id="visibility" step={8} icon={Eye} title="Visibility" description="Who can see and order this product.">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-apptext-primary">Status</legend>
        <div className={cn("grid gap-2", isEdit ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                draft.status === o.id ? "border-brand-primary bg-brand-light/30 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-slate-50"
              )}
            >
              <input
                type="radio"
                name="status"
                checked={draft.status === o.id}
                onChange={() => set({ status: o.id })}
                className="mt-0.5 size-4 accent-brand-primary"
              />
              <span>
                <span className="block text-sm font-medium text-apptext-primary">{o.label}</span>
                <span className="block text-xs text-apptext-secondary">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-2 flex items-center justify-between gap-3">
          <legend className="text-sm font-medium text-apptext-primary">Customer types that can buy it</legend>
          <button
            type="button"
            onClick={() => set({ visibleTo: all ? [] : [...ALL_CUSTOMER_TYPES] })}
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            {all ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_CUSTOMER_TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition",
                draft.visibleTo.includes(t) ? "border-brand-primary/40 bg-brand-light/30" : "border-slate-200 hover:bg-slate-50"
              )}
            >
              <input type="checkbox" checked={draft.visibleTo.includes(t)} onChange={() => toggleType(t)} className="size-4 accent-brand-primary" />
              {CUSTOMER_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        {errorFor("visibleTo") && <p className="mt-1 text-xs text-rose-600">{errorFor("visibleTo")}</p>}
        {draft.isPrescriptionRequired && draft.visibleTo.includes("SURGICAL_STORE") && (
          <p className="mt-2 text-xs text-amber-700">Surgical stores usually cannot sell prescription medicines.</p>
        )}
      </fieldset>
    </FormSection>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function Summary({
  draft,
  x,
  sectionState,
  isEdit,
}: {
  draft: ProductDraft;
  x: Derived;
  sectionState: (id: SectionId) => "error" | "warn" | "ok" | "skip";
  isEdit: boolean;
}) {
  const cover = draft.images[0]?.url;
  const statusMeta = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DRAFT: "bg-amber-50 text-amber-800 border-amber-200",
    INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
  }[draft.status];
  const go = (id: SectionId) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-3">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={cover} alt="" className="size-14 shrink-0 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary" aria-hidden>
            <Package className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-apptext-primary">{draft.name || "Untitled product"}</p>
          {draft.nameBn && (
            <p lang="bn" className="truncate text-sm text-apptext-secondary">
              {draft.nameBn}
            </p>
          )}
          <p className="truncate text-xs text-apptext-secondary">
            {[draft.genericName, draft.strength].filter(Boolean).join(" · ") || "Generic name"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge className={statusMeta}>{draft.status === "ACTIVE" ? "Active" : draft.status === "DRAFT" ? "Draft" : "Inactive"}</Badge>
            {draft.isPrescriptionRequired && <RxTag />}
            {draft.isControlled && <ControlledTag />}
            {draft.isColdChain && <ColdChainTag />}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-slate-100 text-sm">
        {[
          ["SKU", <span key="sku" className="font-mono text-xs">{draft.sku || "—"}</span>],
          ["Brand", draft.brand || "—"],
          ["Category", [draft.category, draft.subcategory].filter(Boolean).join(" › ") || "—"],
          ["Sells as", `1 ${x.defaultLevel.name}${x.mult > 1 ? ` (${levelQty(x.mult, x.levels[0].name)})` : ""}`],
          ["Pack price", x.packSell > 0 ? formatCurrency(x.packSell) : "—"],
          ["Pack MRP", x.packMrp > 0 ? formatCurrency(x.packMrp) : "—"],
          ["Margin", <span key="m" className={marginTone(x.margin)}>{fmtPct(x.margin)}</span>],
          ["Price tiers", draft.tiers.length ? `${draft.tiers.length} ${plural("tier", draft.tiers.length)}` : "None"],
          ...(!isEdit
            ? [["Opening stock", draft.openingEnabled && x.openingBase > 0 ? levelQty(x.openingBase, x.levels[0].name) : "None"] as const]
            : []),
          ["Visible to", `${draft.visibleTo.length} of ${ALL_CUSTOMER_TYPES.length} customer types`],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex items-start justify-between gap-3 py-1.5">
            <dt className="shrink-0 text-apptext-secondary">{k}</dt>
            <dd className="min-w-0 text-right font-medium tabular-nums text-apptext-primary">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="mb-1.5 text-xs font-medium text-apptext-secondary">Sections</p>
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => {
            const st = sectionState(s.id);
            const Icon = st === "ok" ? CheckCircle2 : st === "error" ? CircleAlert : st === "warn" ? AlertTriangle : CircleDashed;
            const tone = st === "ok" ? "text-emerald-600" : st === "error" ? "text-rose-600" : st === "warn" ? "text-amber-600" : "text-slate-300";
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-apptext-primary hover:bg-surface"
                >
                  <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />
                  <span className="flex-1">{s.id === "opening" && isEdit ? "Stock" : s.label}</span>
                  <span className="sr-only">
                    {st === "ok" ? "complete" : st === "error" ? "has problems" : st === "warn" ? "has warnings" : "optional"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
