"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Category, InventoryItem, Subcategory } from "@/lib/types";
import {
  CatalogBrand,
  CatalogUnit,
  DosageForm,
  catalogBrands,
  catalogCategories,
  catalogUnits,
  dosageForms as seedDosageForms,
  withCatalogDefaults,
} from "@/lib/db/catalog-data";
import { useInventory } from "@/components/inventory/InventoryProvider";

export interface PriceChange {
  at: string;
  by: string;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  note: string;
}

interface CatalogContextValue {
  /** Inventory items with their seeded catalog attributes filled in. */
  products: InventoryItem[];
  productById: Record<string, InventoryItem>;

  categories: Category[];
  brands: CatalogBrand[];
  units: CatalogUnit[];
  dosageForms: DosageForm[];

  /** Product counts keyed by category name, `${category}/${subcategory}`, brand, unit and dosage form. */
  counts: {
    category: Record<string, number>;
    subcategory: Record<string, number>;
    brand: Record<string, number>;
    unit: Record<string, number>;
    dosageForm: Record<string, number>;
  };

  saveCategory: (c: Category) => void;
  toggleCategory: (id: string) => void;
  deleteCategory: (id: string) => void;
  saveSubcategory: (categoryId: string, s: Subcategory) => void;
  toggleSubcategory: (categoryId: string, subId: string) => void;
  deleteSubcategory: (categoryId: string, subId: string) => void;

  saveBrand: (b: CatalogBrand) => void;
  toggleBrand: (id: string) => void;
  deleteBrand: (id: string) => void;

  saveUnit: (u: CatalogUnit) => void;
  toggleUnit: (id: string) => void;
  deleteUnit: (id: string) => void;

  saveDosageForm: (d: DosageForm) => void;
  toggleDosageForm: (id: string) => void;
  deleteDosageForm: (id: string) => void;

  /** Barcode per pack level (not on InventoryItem), keyed by item id then pack name. */
  packBarcodes: Record<string, Record<string, string>>;
  setPackBarcodes: (itemId: string, map: Record<string, string>) => void;

  /** Price changes recorded from the product form. */
  priceHistory: Record<string, PriceChange[]>;
  recordPrice: (itemId: string, change: PriceChange) => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}

const upsert = <T extends { id: string }>(list: T[], x: T) =>
  list.some((i) => i.id === x.id) ? list.map((i) => (i.id === x.id ? x : i)) : [...list, x];

const toggle = <T extends { id: string; isActive: boolean }>(list: T[], id: string) =>
  list.map((i) => (i.id === id ? { ...i, isActive: !i.isActive } : i));

const inc = (map: Record<string, number>, key: string | undefined) => {
  if (key) map[key] = (map[key] ?? 0) + 1;
};

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { items } = useInventory();
  const [categories, setCategories] = useState<Category[]>(catalogCategories);
  const [brands, setBrands] = useState<CatalogBrand[]>(catalogBrands);
  const [units, setUnits] = useState<CatalogUnit[]>(catalogUnits);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>(seedDosageForms);
  const [packBarcodes, setPackBarcodeState] = useState<Record<string, Record<string, string>>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceChange[]>>({});

  const products = useMemo(() => items.map(withCatalogDefaults), [items]);
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const counts = useMemo(() => {
    const c: CatalogContextValue["counts"] = { category: {}, subcategory: {}, brand: {}, unit: {}, dosageForm: {} };
    for (const p of products) {
      inc(c.category, p.category);
      if (p.subcategory) inc(c.subcategory, `${p.category}/${p.subcategory}`);
      inc(c.brand, p.brand);
      const used = new Set([p.baseUnit, p.packUnit, ...(p.packSizes ?? []).map((s) => s.packNameEn)]);
      used.forEach((u) => inc(c.unit, u));
      inc(c.dosageForm, p.dosageForm ?? p.medicineType);
    }
    return c;
  }, [products]);

  const mapCategory = (id: string, fn: (c: Category) => Category) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const setPackBarcodes = useCallback(
    (itemId: string, map: Record<string, string>) => setPackBarcodeState((prev) => ({ ...prev, [itemId]: map })),
    []
  );
  const recordPrice = useCallback(
    (itemId: string, change: PriceChange) =>
      setPriceHistory((prev) => ({ ...prev, [itemId]: [change, ...(prev[itemId] ?? [])] })),
    []
  );

  const value: CatalogContextValue = {
    products,
    productById,
    categories,
    brands,
    units,
    dosageForms,
    counts,

    saveCategory: (c) => setCategories((prev) => upsert(prev, c)),
    toggleCategory: (id) => setCategories((prev) => toggle(prev, id)),
    deleteCategory: (id) => setCategories((prev) => prev.filter((c) => c.id !== id)),
    saveSubcategory: (categoryId, s) => mapCategory(categoryId, (c) => ({ ...c, subcategories: upsert(c.subcategories, s) })),
    toggleSubcategory: (categoryId, subId) =>
      mapCategory(categoryId, (c) => ({ ...c, subcategories: toggle(c.subcategories, subId) })),
    deleteSubcategory: (categoryId, subId) =>
      mapCategory(categoryId, (c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) })),

    saveBrand: (b) => setBrands((prev) => upsert(prev, b)),
    toggleBrand: (id) => setBrands((prev) => toggle(prev, id)),
    deleteBrand: (id) => setBrands((prev) => prev.filter((b) => b.id !== id)),

    saveUnit: (u) => setUnits((prev) => upsert(prev, u)),
    toggleUnit: (id) => setUnits((prev) => toggle(prev, id)),
    deleteUnit: (id) => setUnits((prev) => prev.filter((u) => u.id !== id)),

    saveDosageForm: (d) => setDosageForms((prev) => upsert(prev, d)),
    toggleDosageForm: (id) => setDosageForms((prev) => toggle(prev, id)),
    deleteDosageForm: (id) => setDosageForms((prev) => prev.filter((d) => d.id !== id)),

    packBarcodes,
    setPackBarcodes,
    priceHistory,
    recordPrice,
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
