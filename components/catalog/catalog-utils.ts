import { InventoryItem } from "@/lib/types";
import { plural } from "@/lib/inventory";

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type ProductStatus = "ACTIVE" | "DRAFT" | "INACTIVE";

/** `isActive` is what the rest of the app reads, so it wins over `status`. */
export function productStatus(item: InventoryItem): ProductStatus {
  if (item.isActive) return "ACTIVE";
  return item.status === "DRAFT" ? "DRAFT" : "INACTIVE";
}

export const PRODUCT_STATUS_META: Record<ProductStatus, { label: string; badge: string; dot: string }> = {
  ACTIVE: { label: "Active", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  DRAFT: { label: "Draft", badge: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  INACTIVE: { label: "Inactive", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Gross margin on selling price. */
export function marginPct(cost: number, sell: number): number | null {
  if (!(sell > 0) || !Number.isFinite(cost)) return null;
  return ((sell - cost) / sell) * 100;
}

/** Markup on cost. */
export function markupPct(cost: number, sell: number): number | null {
  if (!(cost > 0) || !Number.isFinite(sell)) return null;
  return ((sell - cost) / cost) * 100;
}

export const fmtPct = (n: number | null, digits = 1) =>
  n === null || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;

export function marginTone(m: number | null): string {
  if (m === null) return "text-slate-400";
  if (m < 0) return "text-rose-700";
  if (m < 5) return "text-amber-700";
  return "text-emerald-700";
}

/** Price of the default selling pack. */
export const packPrice = (item: InventoryItem) => round2(item.sellingPrice * item.unitsPerPack);
export const packMrp = (item: InventoryItem) => round2(item.mrp * item.unitsPerPack);

/* ------------------------------------------------------------------ */
/* Pack hierarchy                                                      */
/* ------------------------------------------------------------------ */

export interface PackLevel {
  name: string;
  /** Base units in one of this level */
  multiplier: number;
  /** How many of the previous level make one of this level */
  perParent: number;
  isDefault: boolean;
  isBase: boolean;
}

/** Base unit followed by every pack level, smallest first. */
export function packHierarchy(item: InventoryItem): PackLevel[] {
  const base: PackLevel = {
    name: item.baseUnit,
    multiplier: 1,
    perParent: 1,
    isDefault: false,
    isBase: true,
  };
  let sizes = (item.packSizes ?? [])
    .filter((p) => p.multiplierToBase > 1 || p.packNameEn !== item.baseUnit)
    .map((p) => ({ name: p.packNameEn, multiplier: p.multiplierToBase, isDefault: p.isDefault }));
  if (sizes.length === 0 && item.unitsPerPack > 1 && item.packUnit !== item.baseUnit) {
    sizes = [{ name: item.packUnit, multiplier: item.unitsPerPack, isDefault: true }];
  }
  sizes.sort((a, b) => a.multiplier - b.multiplier);
  if (!sizes.some((s) => s.isDefault)) {
    const match = sizes.find((s) => s.name === item.packUnit && s.multiplier === item.unitsPerPack);
    if (match) match.isDefault = true;
    else base.isDefault = true;
  }
  const out: PackLevel[] = [base];
  for (const s of sizes) {
    const prev = out[out.length - 1];
    out.push({ ...s, isBase: false, perParent: Math.max(1, Math.round(s.multiplier / prev.multiplier)) });
  }
  return out;
}

/** "1 Carton = 20 Boxes = 200 Strips = 2,000 Tablets" */
export function hierarchyText(levels: { name: string; multiplier: number }[]): string {
  if (levels.length <= 1) return `Sold per ${levels[0]?.name.toLowerCase() ?? "unit"}`;
  const top = levels[levels.length - 1];
  const parts = [`1 ${top.name}`];
  for (let i = levels.length - 2; i >= 0; i--) {
    const n = top.multiplier / levels[i].multiplier;
    parts.push(`${n.toLocaleString("en-US")} ${plural(levels[i].name, n)}`);
  }
  return parts.join(" = ");
}

/* ------------------------------------------------------------------ */
/* SKU & barcode                                                       */
/* ------------------------------------------------------------------ */

function strengthToken(strength: string): string {
  const s = strength.toUpperCase().replace(/\s+/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)(MG|G|ML|MCG|IU|%)?/);
  if (!m) return "";
  const num = m[1].replace(".", "");
  return m[2] === "G" || m[2] === "ML" ? `${num}${m[2]}` : num;
}

/** BRAND-NAME-STRENGTH, e.g. BEX-NAPX-500. Adds -2, -3… to stay unique. */
export function generateSku(prefix: string, name: string, strength: string, taken: Set<string>): string {
  const word = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)[0];
  const parts = [prefix.toUpperCase() || "CP", (word ?? "ITEM").slice(0, 6), strengthToken(strength || name)].filter(Boolean);
  const base = parts.join("-");
  let sku = base;
  let n = 2;
  while (taken.has(sku)) sku = `${base}-${n++}`;
  return sku;
}

/** Random EAN-13 in the in-house 200–299 range (call from event handlers only). */
export function randomEan13(): string {
  let body = "2" + String(Math.floor(Math.random() * 10)) + String(Math.floor(Math.random() * 10));
  while (body.length < 12) body += String(Math.floor(Math.random() * 10));
  const sum = body.split("").reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return body + ((10 - (sum % 10)) % 10);
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Small RFC-4180 parser (quoted cells, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export const yes = (v: string | undefined) => /^(y|yes|true|1)$/i.test((v ?? "").trim());
