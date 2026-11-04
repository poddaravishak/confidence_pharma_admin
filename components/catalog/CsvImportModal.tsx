"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, FileUp, Upload } from "lucide-react";
import { InventoryItem, PackSize } from "@/lib/types";
import { ALL_CUSTOMER_TYPES, STORAGE_CONDITIONS } from "@/lib/db/catalog-data";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Modal, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "./CatalogProvider";
import { downloadCsv, generateSku, parseCsv, round2, yes } from "./catalog-utils";
import { suggestSupplier } from "./product-draft";

const COLUMNS: { key: string; required?: boolean; example: string; note: string }[] = [
  { key: "name", required: true, example: "Ace Plus 500mg Tablet", note: "Brand name with strength" },
  { key: "generic_name", required: true, example: "Paracetamol + Caffeine", note: "" },
  { key: "brand", required: true, example: "Square Pharmaceuticals", note: "Must match a brand in master data" },
  { key: "category", required: true, example: "Allopathic", note: "Must match a category" },
  { key: "subcategory", example: "Analgesics", note: "Optional" },
  { key: "strength", example: "500mg", note: "" },
  { key: "dosage_form", example: "Tablet", note: "" },
  { key: "base_unit", required: true, example: "Tablet", note: "Unit stock is counted in" },
  { key: "pack_unit", example: "Box", note: "Default selling pack" },
  { key: "units_per_pack", example: "100", note: "Base units in one pack" },
  { key: "cost_price", required: true, example: "2.10", note: "Per base unit" },
  { key: "selling_price", required: true, example: "2.40", note: "Per base unit" },
  { key: "mrp", required: true, example: "2.80", note: "Per base unit" },
  { key: "reorder_level", example: "2000", note: "Base units" },
  { key: "barcode", example: "", note: "Optional" },
  { key: "dgda_reg_no", example: "032-0101-001", note: "" },
  { key: "rx_required", example: "no", note: "yes / no" },
  { key: "cold_chain", example: "no", note: "yes / no" },
  { key: "status", example: "draft", note: "active / draft (default draft)" },
];

const SAMPLE = [
  COLUMNS.map((c) => c.key),
  ["Ace Plus 500mg Tablet", "Paracetamol + Caffeine", "Square Pharmaceuticals", "Allopathic", "Analgesics", "500mg + 65mg", "Tablet", "Tablet", "Box", "100", "2.10", "2.40", "2.80", "2000", "", "032-0101-001", "no", "no", "active"],
  ["Ciprocin 500mg Tablet", "Ciprofloxacin", "Beximco Pharmaceuticals", "Allopathic", "Antibiotics", "500mg", "Tablet", "Tablet", "Box", "50", "11", "13", "15", "500", "", "037-0221-008", "yes", "no", "active"],
  ["Orsaline-N Sachet", "Oral Rehydration Salts", "ACI", "Nutrition", "Oral rehydration", "10.25g", "Powder (sachet)", "Sachet", "Box", "20", "4.5", "5.2", "6", "400", "", "", "no", "no", "draft"],
  ["Insulin pen needle 4mm", "Pen needle", "Novo Nordisk", "Medical devices", "", "32G 4mm", "Device", "Piece", "Box", "100", "12", "16", "14", "", "", "", "no", "no", "active"],
];

interface PreviewRow {
  line: number;
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function CsvImportModal({ onClose }: { onClose: () => void }) {
  const { addItem, notify, suppliers } = useInventory();
  const { logAudit } = useAppStore();
  const { products, brands, categories } = useCatalog();
  const [text, setText] = useState("");
  const [step, setStep] = useState<"paste" | "preview">("paste");

  const rows = useMemo<PreviewRow[]>(() => {
    if (step !== "preview") return [];
    const grid = parseCsv(text);
    if (grid.length < 2) return [];
    const header = grid[0].map(norm);
    const existing = new Set(products.map((p) => `${p.name.toLowerCase()}|${(p.strength ?? "").toLowerCase()}`));
    return grid.slice(1).map((cells, i) => {
      const values: Record<string, string> = {};
      header.forEach((h, j) => (values[h] = (cells[j] ?? "").trim()));
      const errors: string[] = [];
      const warnings: string[] = [];
      for (const c of COLUMNS) if (c.required && !values[c.key]) errors.push(`${c.key} is required`);
      const nums = ["cost_price", "selling_price", "mrp"].map((k) => parseFloat(values[k]));
      if (values.cost_price && !(nums[0] > 0)) errors.push("cost_price must be a number");
      if (values.selling_price && !(nums[1] > 0)) errors.push("selling_price must be a number");
      if (values.mrp && !(nums[2] > 0)) errors.push("mrp must be a number");
      if (nums[1] > 0 && nums[2] > 0 && nums[1] > nums[2]) errors.push("selling_price is above mrp");
      if (values.units_per_pack && !/^\d+$/.test(values.units_per_pack)) errors.push("units_per_pack must be a whole number");
      if (values.brand && !brands.some((b) => b.name.toLowerCase() === values.brand.toLowerCase())) errors.push(`unknown brand "${values.brand}"`);
      const cat = categories.find((c) => c.nameEn.toLowerCase() === (values.category ?? "").toLowerCase());
      if (values.category && !cat) errors.push(`unknown category "${values.category}"`);
      if (cat && values.subcategory && !cat.subcategories.some((s) => s.nameEn.toLowerCase() === values.subcategory.toLowerCase()))
        warnings.push(`subcategory "${values.subcategory}" not found, left empty`);
      if (existing.has(`${(values.name ?? "").toLowerCase()}|${(values.strength ?? "").toLowerCase()}`))
        warnings.push("a product with this name and strength already exists");
      if (nums[0] > 0 && nums[1] > 0 && nums[1] < nums[0]) warnings.push("selling below cost");
      return { line: i + 2, values, errors, warnings };
    });
  }, [step, text, products, brands, categories]);

  const valid = rows.filter((r) => r.errors.length === 0);

  const runImport = () => {
    const taken = new Set(products.map((p) => p.sku.toUpperCase()));
    const stamp = Date.now().toString(36);
    valid.forEach((r, i) => {
      const v = r.values;
      const brand = brands.find((b) => b.name.toLowerCase() === v.brand.toLowerCase())!;
      const cat = categories.find((c) => c.nameEn.toLowerCase() === v.category.toLowerCase())!;
      const sub = cat.subcategories.find((s) => s.nameEn.toLowerCase() === (v.subcategory ?? "").toLowerCase());
      const sku = generateSku(brand.skuPrefix, v.name, v.strength ?? "", taken);
      taken.add(sku);
      const units = Math.max(1, parseInt(v.units_per_pack || "1", 10) || 1);
      const packUnit = v.pack_unit && units > 1 ? v.pack_unit : v.base_unit;
      const cost = parseFloat(v.cost_price);
      const sell = parseFloat(v.selling_price);
      const mrp = parseFloat(v.mrp);
      const cold = yes(v.cold_chain);
      const active = /^active$/i.test(v.status ?? "");
      const packSizes: PackSize[] = [
        {
          id: `pk-${packUnit.toLowerCase()}`,
          packNameEn: packUnit,
          packNameBn: packUnit,
          multiplierToBase: units,
          packMrp: round2(mrp * units),
          packSellingPrice: round2(sell * units),
          isDefault: true,
        },
      ];
      const item: InventoryItem = {
        id: `prod-${stamp}${i}`,
        sku,
        name: v.name,
        genericName: v.generic_name,
        brand: brand.name,
        category: cat.nameEn,
        subcategory: sub?.nameEn ?? "",
        medicineType: v.dosage_form || v.base_unit,
        dosageForm: v.dosage_form || undefined,
        strength: v.strength || undefined,
        baseUnit: v.base_unit,
        packUnit,
        unitsPerPack: units,
        packSizes,
        costPrice: cost,
        sellingPrice: sell,
        mrp,
        reorderLevel: parseInt(v.reorder_level || "0", 10) || 0,
        avgDailySales: 0,
        leadTimeDays: 3,
        supplierId: suggestSupplier(brand.name, suppliers) ?? suppliers[0]?.id ?? "",
        isColdChain: cold,
        storageCondition: cold ? STORAGE_CONDITIONS[2] : STORAGE_CONDITIONS[0],
        isActive: active,
        status: active ? "ACTIVE" : "DRAFT",
        barcode: v.barcode || undefined,
        dgdaRegNo: v.dgda_reg_no || undefined,
        isPrescriptionRequired: yes(v.rx_required),
        vatPct: 0,
        maxDiscountPct: 5,
        minOrderQty: 1,
        visibleTo: [...ALL_CUSTOMER_TYPES],
        defaultWarehouseId: "wh-01",
        createdAt: new Date().toISOString(),
      };
      addItem(item);
    });
    logAudit("PRODUCTS_IMPORTED", "CATALOG", `${valid.length} products imported from CSV (${rows.length - valid.length} rows skipped).`);
    notify(`${valid.length} ${valid.length === 1 ? "product" : "products"} imported.`);
    onClose();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setStep("preview");
  };

  return (
    <Modal
      title="Import products from CSV"
      subtitle={step === "paste" ? "Demo: paste rows or pick a .csv file, check the preview, then import." : `${rows.length} rows read`}
      onClose={onClose}
      size="xl"
      footer={
        step === "paste" ? (
          <>
            <button onClick={onClose} className={btn.secondary}>
              Cancel
            </button>
            <button onClick={() => setStep("preview")} disabled={!text.trim()} className={btn.primary}>
              Preview rows
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setStep("paste")} className={btn.secondary}>
              Back
            </button>
            <button onClick={runImport} disabled={valid.length === 0} className={btn.primary}>
              <Upload className="size-4" aria-hidden />
              Import {valid.length} {valid.length === 1 ? "product" : "products"}
            </button>
          </>
        )
      }
    >
      {step === "paste" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-apptext-primary">Template columns</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadCsv("catalog-import-template.csv", SAMPLE.slice(0, 2))} className={btn.small}>
                <Download className="size-3.5" aria-hidden />
                Download template
              </button>
              <button onClick={() => setText(SAMPLE.map((r) => r.join(",")).join("\n"))} className={btn.small}>
                Load sample rows
              </button>
            </div>
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-apptext-secondary">
                <tr>
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Example</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COLUMNS.map((c) => (
                  <tr key={c.key}>
                    <td className="px-3 py-1.5 font-mono text-apptext-primary">
                      {c.key}
                      {c.required && <span className="text-rose-600"> *</span>}
                    </td>
                    <td className="px-3 py-1.5 text-apptext-secondary">{c.example || "—"}</td>
                    <td className="px-3 py-1.5 text-apptext-secondary">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label htmlFor="csv-paste" className="mb-1.5 block text-sm font-medium text-apptext-primary">
              Paste CSV (first row is the header)
            </label>
            <textarea
              id="csv-paste"
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={COLUMNS.map((c) => c.key).join(",")}
              className={cn(inputClass, "font-mono text-xs")}
            />
          </div>
          <label className={cn(btn.secondary, "cursor-pointer")}>
            <FileUp className="size-4" aria-hidden />
            Choose .csv file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-apptext-secondary">No data rows found. Include a header row and at least one product.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-3" aria-hidden />
              {valid.length} ready
            </Badge>
            {rows.length - valid.length > 0 && (
              <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                <CircleAlert className="size-3" aria-hidden />
                {rows.length - valid.length} with errors (skipped)
              </Badge>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Brand · category</th>
                  <th className="px-3 py-2 text-right">Pack price</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const units = Math.max(1, parseInt(r.values.units_per_pack || "1", 10) || 1);
                  const sell = parseFloat(r.values.selling_price);
                  return (
                    <tr key={r.line} className={cn(r.errors.length > 0 && "bg-rose-50/40")}>
                      <td className="px-3 py-2 tabular-nums text-slate-500">{r.line}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-apptext-primary">{r.values.name || "—"}</p>
                        <p className="text-xs text-apptext-secondary">{r.values.generic_name}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-apptext-secondary">
                        {r.values.brand} · {r.values.category}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {sell > 0 ? formatCurrency(round2(sell * units)) : "—"}
                        {r.values.pack_unit && <span className="block text-xs text-slate-500">per {r.values.pack_unit}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.errors.length ? (
                          <ul className="space-y-0.5 text-rose-700">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="font-medium text-emerald-700">Ready{/^active$/i.test(r.values.status ?? "") ? " (active)" : " (draft)"}</span>
                        )}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-amber-700">
                            {w}
                          </p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
