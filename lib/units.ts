/**
 * Base Unit + Conversion model
 * ============================
 *
 * Every product has ONE base unit (Tablet, Capsule, Vial, Sachet, Bottle,
 * Piece…). All stock — batches, movements, adjustments, counts, transfers,
 * reservations and FEFO allocations — is stored and calculated in that base
 * unit only.
 *
 * Every other pack size (Strip, Box, Carton…) is just a conversion of the base
 * unit: `factor` = how many base units are in one of that pack.
 *
 *   Tablet  ×1          (base)
 *   Strip   ×10         1 Strip  = 10 Tablets
 *   Box     ×20         1 Box    = 2 Strips  = 20 Tablets
 *
 * Quantities entered in a pack are converted to base units with `toBase` the
 * moment they touch stock, and converted back only for display. This keeps
 * stock exact (integers, no fractions of a box) while letting staff order,
 * purchase, count and return in whatever unit is natural.
 */
import type { InventoryItem, PackSize } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface UnitLevel {
  /** "base" for the base unit, otherwise the PackSize id. */
  id: string;
  name: string;
  nameBn: string;
  /** Base units in one of this level (base unit = 1). */
  factor: number;
  /** How many of the next smaller level make one of this (base = 1). */
  perChild: number;
  /** Name of the next smaller level (null for the base unit). */
  childName: string | null;
  isBase: boolean;
  /** Default unit on new order lines. */
  isDefaultSale: boolean;
  /** Default unit for purchasing / receiving. */
  isDefaultPurchase: boolean;
  /** Customers can order in this unit. */
  sellable: boolean;
  barcode?: string;
  /** Price of ONE of this level. */
  mrp: number;
  price: number;
  cost: number;
}

export interface QtyPart {
  level: UnitLevel;
  qty: number;
}

type ItemLike = Pick<InventoryItem, "baseUnit" | "packUnit" | "unitsPerPack" | "sellingPrice" | "mrp" | "costPrice"> &
  Partial<Pick<InventoryItem, "packSizes" | "barcode" | "nameBn">>;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtInt = (n: number) => n.toLocaleString("en-US");

export function pluralUnit(word: string, n: number): string {
  if (Math.abs(n) === 1) return word;
  if (/(x|s|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

const BN_UNIT: Record<string, string> = {
  Tablet: "ট্যাবলেট",
  Capsule: "ক্যাপসুল",
  Vial: "ভায়াল",
  Ampoule: "অ্যাম্পুল",
  Bottle: "বোতল",
  Piece: "পিস",
  Kit: "কিট",
  Box: "বাক্স",
  Strip: "পাতা",
  Carton: "কার্টন",
  Tube: "টিউব",
  Sachet: "স্যাশে",
};

export const unitNameBn = (name: string) => BN_UNIT[name] ?? name;

/** "3 Boxes" */
export const qtyText = (qty: number, unitName: string) => `${fmtInt(qty)} ${pluralUnit(unitName, qty)}`;

/* ------------------------------------------------------------------ */
/* Building the unit ladder of an item                                 */
/* ------------------------------------------------------------------ */

/**
 * Base unit followed by every pack level, smallest first. Always contains the
 * base unit (factor 1). Duplicate factors and the base unit repeated as a
 * pack are folded together.
 */
export function unitLevels(item: ItemLike): UnitLevel[] {
  const packs: PackSize[] = (item.packSizes ?? []).filter((p) => p.multiplierToBase >= 1);
  const baseRow = packs.find((p) => p.multiplierToBase === 1 || p.packNameEn === item.baseUnit);

  const base: UnitLevel = {
    id: "base",
    name: item.baseUnit,
    nameBn: baseRow?.packNameBn || unitNameBn(item.baseUnit),
    factor: 1,
    perChild: 1,
    childName: null,
    isBase: true,
    isDefaultSale: false,
    isDefaultPurchase: false,
    sellable: baseRow ? baseRow.isSellable !== false : true,
    barcode: baseRow?.barcode ?? item.barcode,
    mrp: item.mrp,
    price: baseRow?.packSellingPrice ?? item.sellingPrice,
    cost: item.costPrice,
  };

  let rows = packs
    .filter((p) => p !== baseRow && p.multiplierToBase > 1)
    .map((p) => ({
      id: p.id,
      name: p.packNameEn,
      nameBn: p.packNameBn || unitNameBn(p.packNameEn),
      factor: Math.round(p.multiplierToBase),
      isDefaultSale: p.isDefault,
      isDefaultPurchase: Boolean(p.isPurchaseUnit),
      sellable: p.isSellable !== false,
      barcode: p.barcode,
      mrp: p.packMrp || round2(item.mrp * p.multiplierToBase),
      price: p.packSellingPrice || round2(item.sellingPrice * p.multiplierToBase),
    }));

  // Older items carry only packUnit/unitsPerPack.
  if (rows.length === 0 && item.unitsPerPack > 1 && item.packUnit !== item.baseUnit) {
    rows = [
      {
        id: `pk-${item.packUnit.toLowerCase()}`,
        name: item.packUnit,
        nameBn: unitNameBn(item.packUnit),
        factor: item.unitsPerPack,
        isDefaultSale: true,
        isDefaultPurchase: false,
        sellable: true,
        barcode: undefined,
        mrp: round2(item.mrp * item.unitsPerPack),
        price: round2(item.sellingPrice * item.unitsPerPack),
      },
    ];
  }

  // One level per factor, ascending.
  const seen = new Set<number>([1]);
  rows = rows.sort((a, b) => a.factor - b.factor).filter((r) => (seen.has(r.factor) ? false : (seen.add(r.factor), true)));

  const out: UnitLevel[] = [base];
  for (const r of rows) {
    const prev = out[out.length - 1];
    out.push({
      ...r,
      perChild: Math.max(1, Math.round(r.factor / prev.factor)),
      childName: prev.name,
      isBase: false,
      cost: round2(item.costPrice * r.factor),
    });
  }

  // Exactly one default sale unit: explicit flag → legacy packUnit → base.
  if (!out.some((l) => l.isDefaultSale)) {
    const legacy = out.find((l) => l.name === item.packUnit && l.factor === Math.max(1, item.unitsPerPack));
    (legacy ?? base).isDefaultSale = true;
  } else {
    let found = false;
    for (const l of out) {
      if (l.isDefaultSale && found) l.isDefaultSale = false;
      if (l.isDefaultSale) found = true;
    }
  }
  // Default purchase unit: explicit flag → largest level.
  if (!out.some((l) => l.isDefaultPurchase)) out[out.length - 1].isDefaultPurchase = true;
  // The default sale unit is always sellable.
  for (const l of out) if (l.isDefaultSale) l.sellable = true;

  return out;
}

export const sellableLevels = (item: ItemLike) => unitLevels(item).filter((l) => l.sellable);
export const defaultSaleLevel = (item: ItemLike) => unitLevels(item).find((l) => l.isDefaultSale)!;
export const defaultPurchaseLevel = (item: ItemLike) => unitLevels(item).find((l) => l.isDefaultPurchase)!;
export const largestLevel = (item: ItemLike) => {
  const ls = unitLevels(item);
  return ls[ls.length - 1];
};

/** Find a level by id, then by name, then by factor. */
export function findLevel(item: ItemLike, ref: { id?: string; name?: string; factor?: number }): UnitLevel | undefined {
  const levels = unitLevels(item);
  return (
    (ref.id ? levels.find((l) => l.id === ref.id) : undefined) ??
    (ref.name ? levels.find((l) => l.name.toLowerCase() === ref.name!.toLowerCase()) : undefined) ??
    (ref.factor ? levels.find((l) => l.factor === ref.factor) : undefined)
  );
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/** Quantity in a pack level → base units. */
export const toBase = (qty: number, level: Pick<UnitLevel, "factor"> | number) =>
  Math.round(qty * (typeof level === "number" ? level : level.factor));

/** Base units → whole packs of a level, plus the base-unit remainder. */
export function fromBase(base: number, level: Pick<UnitLevel, "factor"> | number) {
  const f = Math.max(1, typeof level === "number" ? level : level.factor);
  const sign = base < 0 ? -1 : 1;
  const abs = Math.abs(base);
  return { whole: sign * Math.floor(abs / f), remainder: sign * (abs % f), exact: abs % f === 0 };
}

/** Convert a quantity between two levels of the same item (may be fractional). */
export const convert = (qty: number, from: Pick<UnitLevel, "factor">, to: Pick<UnitLevel, "factor">) =>
  (qty * from.factor) / to.factor;

/**
 * Greedy split of a base quantity across the ladder, largest unit first:
 * 245 tablets with Strip ×10, Box ×20 → 12 Box + 0 Strip + 5 Tablet.
 * Pass `only` to restrict to some levels (the base unit is always kept so
 * nothing is lost).
 */
export function splitBase(base: number, levels: UnitLevel[], only?: string[]): QtyPart[] {
  const use = levels.filter((l) => l.isBase || !only || only.includes(l.id)).sort((a, b) => b.factor - a.factor);
  let rest = Math.abs(base);
  const sign = base < 0 ? -1 : 1;
  return use.map((level) => {
    const qty = Math.floor(rest / level.factor);
    rest -= qty * level.factor;
    return { level, qty: sign * qty };
  });
}

/** Sum of {levelId: qty} entries in base units. */
export function sumToBase(levels: UnitLevel[], counts: Record<string, number>): number {
  return levels.reduce((s, l) => s + toBase(Math.max(0, counts[l.id] || 0), l), 0);
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

export type QtyStyle =
  /** "12 Boxes + 5 Tablets" (every non-zero level) */
  | "breakdown"
  /** "245 Tablets" */
  | "base"
  /** "12 Boxes + 5 Tablets" using only the default sale unit and base */
  | "sale";

export function formatQty(base: number, item: ItemLike, style: QtyStyle = "breakdown"): string {
  const levels = unitLevels(item);
  if (style === "base" || levels.length === 1) return qtyText(base, item.baseUnit);
  const sale = levels.find((l) => l.isDefaultSale)!;
  const parts = splitBase(base, levels, style === "sale" ? [sale.id] : undefined).filter((p) => p.qty !== 0);
  if (parts.length === 0) return qtyText(0, item.baseUnit);
  const sign = base < 0 ? "−" : "";
  return sign + parts.map((p) => qtyText(Math.abs(p.qty), p.level.name)).join(" + ");
}

/** "1 Box = 2 Strips = 20 Tablets" */
export function conversionChain(item: ItemLike): string {
  const levels = unitLevels(item);
  if (levels.length === 1) return `Sold per ${item.baseUnit.toLowerCase()}`;
  const top = levels[levels.length - 1];
  const parts = [`1 ${top.name}`];
  for (let i = levels.length - 2; i >= 0; i--) parts.push(qtyText(top.factor / levels[i].factor, levels[i].name));
  return parts.join(" = ");
}

/** ["1 Strip = 10 Tablets", "1 Box = 2 Strips (20 Tablets)"] */
export function conversionSteps(item: ItemLike): string[] {
  return unitLevels(item)
    .filter((l) => !l.isBase)
    .map((l) =>
      l.childName && l.perChild !== l.factor
        ? `1 ${l.name} = ${qtyText(l.perChild, l.childName)} (${qtyText(l.factor, item.baseUnit)})`
        : `1 ${l.name} = ${qtyText(l.factor, item.baseUnit)}`
    );
}

/** "Strip (10 Tablets)" — what one unit of a level contains. */
export function levelLabel(level: UnitLevel, item: ItemLike): string {
  return level.isBase ? level.name : `${level.name} (${qtyText(level.factor, item.baseUnit)})`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Rules for a valid ladder (smallest first, base unit first):
 * names unique, factors whole numbers, strictly increasing, and each level
 * an exact multiple of the one below (no "1 Box = 2.5 Strips").
 */
export function validateLadder(levels: { name: string; factor: number }[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  levels.forEach((l, i) => {
    const key = l.name.trim().toLowerCase();
    if (!key) errors.push(`Level ${i + 1} needs a name.`);
    else if (names.has(key)) errors.push(`"${l.name}" is used twice.`);
    names.add(key);
    if (!Number.isInteger(l.factor) || l.factor < 1) errors.push(`${l.name || `Level ${i + 1}`} must hold a whole number of base units.`);
    if (i > 0) {
      const prev = levels[i - 1];
      if (l.factor <= prev.factor) errors.push(`${l.name} must be bigger than ${prev.name}.`);
      else if (l.factor % prev.factor !== 0) errors.push(`${l.name} must hold a whole number of ${pluralUnit(prev.name, 2)}.`);
    }
  });
  return errors;
}

/* ------------------------------------------------------------------ */
/* Pricing & stock in a unit                                           */
/* ------------------------------------------------------------------ */

/** Selling price of one unit of this level (pack override wins). */
export const priceOf = (level: UnitLevel) => level.price;

/** Effective per-base-unit price of a level, to spot pack discounts. */
export const pricePerBase = (level: UnitLevel) => round2(level.price / level.factor);

/** How many whole units of `level` the given base stock covers. */
export const availableIn = (base: number, level: UnitLevel) => Math.floor(Math.max(0, base) / level.factor);
