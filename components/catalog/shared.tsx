"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  Baby,
  Boxes,
  Droplets,
  FileText,
  FolderTree,
  Leaf,
  Package,
  Pill,
  Ruler,
  Scissors,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Tags,
  TestTube,
} from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { PRODUCT_STATUS_META, productStatus } from "./catalog-utils";
import { useCatalog } from "./CatalogProvider";

/* ------------------------------------------------------------------ */
/* Section navigation                                                  */
/* ------------------------------------------------------------------ */

export function CatalogNav() {
  const pathname = usePathname();
  const { products, categories, brands, units, dosageForms } = useCatalog();
  const tabs = [
    { href: "/catalog", label: "Products", icon: Package, count: products.length },
    { href: "/catalog/categories", label: "Categories", icon: FolderTree, count: categories.length },
    { href: "/catalog/brands", label: "Brands", icon: Tags, count: brands.length },
    { href: "/catalog/units", label: "Units & dosage forms", icon: Ruler, count: units.length + dosageForms.length },
  ];
  return (
    <nav aria-label="Catalog sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const active = t.href === "/catalog" ? pathname === "/catalog" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-apptext-secondary hover:border-slate-300 hover:text-apptext-primary"
                )}
              >
                <t.icon className="size-4" aria-hidden />
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
                    active ? "bg-brand-light text-brand-primary" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {t.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

export const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Pill,
  Scissors,
  TestTube,
  Droplets,
  Leaf,
  Baby,
  Stethoscope,
  Apple,
  Syringe,
  Boxes,
  FileText,
};

export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Package;
  return <Icon className={className} aria-hidden />;
}

const THUMB_TONES = [
  "bg-sky-50 text-sky-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-brand-light text-brand-primary",
  "bg-teal-50 text-teal-700",
];

const CATEGORY_ICON_BY_NAME: Record<string, string> = {
  Allopathic: "Pill",
  Surgical: "Scissors",
  Diagnostic: "TestTube",
  "IV Fluids": "Droplets",
  "Herbal & Unani": "Leaf",
  "Baby care": "Baby",
  "Medical devices": "Stethoscope",
  Nutrition: "Apple",
};

/** First image, or a tinted placeholder with the category icon. */
export function ProductThumb({ item, size = "md" }: { item: InventoryItem; size?: "sm" | "md" | "lg" }) {
  const src = item.imageUrls?.[0];
  const dims = size === "lg" ? "size-20" : size === "sm" ? "size-9" : "size-11";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- object URLs from local uploads
      <img src={src} alt="" className={cn(dims, "shrink-0 rounded-lg border border-slate-200 object-cover")} />
    );
  }
  const tone = THUMB_TONES[item.name.length % THUMB_TONES.length];
  return (
    <span className={cn(dims, "flex shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
      <CategoryIcon name={CATEGORY_ICON_BY_NAME[item.category]} className={size === "lg" ? "size-8" : "size-5"} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function ProductStatusBadge({ item }: { item: InventoryItem }) {
  const meta = PRODUCT_STATUS_META[productStatus(item)];
  return (
    <Badge className={meta.badge}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function RxTag() {
  return (
    <Badge className="border-rose-200 bg-rose-50 text-rose-700">
      <span className="font-semibold">Rx</span>
      <span className="sr-only">Prescription required</span>
    </Badge>
  );
}

export function ControlledTag() {
  return (
    <Badge className="border-violet-200 bg-violet-50 text-violet-700">
      <ShieldAlert className="size-3" aria-hidden />
      Controlled
    </Badge>
  );
}

/** Small key/value list used on detail and summary panels. */
export function KeyValues({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-slate-100 text-sm", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-apptext-secondary">{k}</dt>
          <dd className="min-w-0 text-right font-medium text-apptext-primary">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact switch for table rows (label is for screen readers). */
export function InlineSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand-primary" : "bg-slate-200"
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow transition", checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}
