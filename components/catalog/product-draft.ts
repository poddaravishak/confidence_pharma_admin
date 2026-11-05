import { CustomerType, InventoryItem, PackSize, QuantityPricingTier, Supplier, Warehouse } from "@/lib/types";
import { ALL_CUSTOMER_TYPES, CatalogUnit, ean13CheckDigit } from "@/lib/db/catalog-data";
import { DEMO_TODAY } from "@/lib/db/inventory-data";
import { OpeningStockInput } from "@/components/inventory/InventoryProvider";
import { plural } from "@/lib/inventory";
import { marginPct, markupPct, packHierarchy, round2 } from "./catalog-utils";
import { unitLevels, validateLadder } from "@/lib/units";

/* ------------------------------------------------------------------ */
/* Draft shape (strings for numeric inputs so fields can be empty)     */
/* ------------------------------------------------------------------ */

export interface PackDraft {
  key: string;
  name: string;
  /** How many of the level below make one of this */
  perParent: string;
  barcode: string;
  /** Customers may order in this unit */
  sellable: boolean;
}

export type TierMode = "PRICE" | "DISCOUNT";

export interface TierDraft {
  key: string;
  min: string;
  max: string;
  mode: TierMode;
  value: string;
}

export interface ImageDraft {
  key: string;
  url: string;
  name: string;
}

export type DraftStatus = "ACTIVE" | "DRAFT" | "INACTIVE";

export interface ProductDraft {
  name: string;
  nameBn: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  brand: string;
  category: string;
  subcategory: string;
  dgdaRegNo: string;
  barcode: string;
  description: string;
  isPrescriptionRequired: boolean;
  isControlled: boolean;
  isColdChain: boolean;
  storageCondition: string;

  baseUnit: string;
  /** Customers may order loose base units */
  baseSellable: boolean;
  packs: PackDraft[];
  /** "base" or a PackDraft key */
  defaultPackKey: string;
  /** Default unit for purchasing / receiving: "base" or a PackDraft key */
  purchasePackKey: string;

  costPrice: string;
  mrp: string;
  sellingPrice: string;
  vatPct: string;
  maxDiscountPct: string;
  minOrderQty: string;

  /** Tiers of the default sale unit (counted in that unit). */
  tiers: TierDraft[];
  /**
   * Own tiers per other sellable unit ("base" or a PackDraft key). A unit
   * missing here inherits the default-unit tiers by base-unit equivalent.
   */
  levelTiers: Record<string, TierDraft[]>;

  sku: string;
  skuTouched: boolean;
  reorderLevel: string;
  minStock: string;
  maxStock: string;
  supplierId: string;
  leadTimeDays: string;
  defaultWarehouseId: string;
  defaultLocation: string;

  openingEnabled: boolean;
  openingWarehouseId: string;
  openingBatch: string;
  openingMfg: string;
  openingExpiry: string;
  openingQty: string;
  /** Level key the quantity is entered in */
  openingLevelKey: string;
  openingUnitCost: string;

  images: ImageDraft[];
  status: DraftStatus;
  visibleTo: CustomerType[];
}

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(++seq).toString(36)}`;

export const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};
const isInt = (s: string) => /^\d+$/.test(s.trim());

export function emptyDraft(keep?: Partial<ProductDraft>): ProductDraft {
  const strip = newKey();
  const box = newKey();
  return {
    name: "",
    nameBn: "",
    genericName: "",
    strength: "",
    dosageForm: "Tablet",
    brand: "",
    category: "",
    subcategory: "",
    dgdaRegNo: "",
    barcode: "",
    description: "",
    isPrescriptionRequired: false,
    isControlled: false,
    isColdChain: false,
    storageCondition: "Below 30°C, dry place",
    baseUnit: "Tablet",
    baseSellable: true,
    packs: [
      { key: strip, name: "Strip", perParent: "10", barcode: "", sellable: true },
      { key: box, name: "Box", perParent: "10", barcode: "", sellable: true },
    ],
    defaultPackKey: box,
    purchasePackKey: box,
    costPrice: "",
    mrp: "",
    sellingPrice: "",
    vatPct: "0",
    maxDiscountPct: "10",
    minOrderQty: "1",
    tiers: [],
    levelTiers: {},
    sku: "",
    skuTouched: false,
    reorderLevel: "",
    minStock: "",
    maxStock: "",
    supplierId: "",
    leadTimeDays: "3",
    defaultWarehouseId: "wh-01",
    defaultLocation: "",
    openingEnabled: false,
    openingWarehouseId: "wh-01",
    openingBatch: "",
    openingMfg: "",
    openingExpiry: "",
    openingQty: "",
    openingLevelKey: box,
    openingUnitCost: "",
    images: [],
    status: "ACTIVE",
    visibleTo: [...ALL_CUSTOMER_TYPES],
    ...keep,
  };
}

const str = (n: number | undefined | null) => (n === undefined || n === null || !Number.isFinite(n) ? "" : String(n));

/** Draft for editing (or duplicating) an existing item. */
export function draftFromItem(item: InventoryItem, barcodes: Record<string, string>, asCopy = false): ProductDraft {
  const levels = packHierarchy(item);
  const ladder = unitLevels(item);
  const packs: PackDraft[] = levels
    .filter((l) => !l.isBase)
    .map((l, i) => ({
      key: newKey(),
      name: l.name,
      perParent: String(l.perParent),
      barcode: asCopy ? "" : barcodes[l.name] ?? ladder[i + 1]?.barcode ?? "",
      sellable: ladder[i + 1]?.sellable ?? true,
    }));
  const defaultIdx = levels.findIndex((l) => l.isDefault);
  const defaultPackKey = defaultIdx <= 0 ? "base" : packs[defaultIdx - 1].key;
  const purchaseIdx = ladder.findIndex((l) => l.isDefaultPurchase);
  const purchasePackKey = purchaseIdx <= 0 ? "base" : packs[purchaseIdx - 1]?.key ?? defaultPackKey;
  const defaultMult = Math.max(1, levels[defaultIdx]?.multiplier ?? 1);
  const packSell = item.sellingPrice * defaultMult;

  const tiers = tierDraftsFrom(item.pricingTiers ?? [], packSell);
  const levelTiers: Record<string, TierDraft[]> = {};
  ladder.forEach((l, i) => {
    if (l.isDefaultSale || !l.tiers?.length) return;
    const key = i === 0 ? "base" : packs[i - 1]?.key;
    if (key) levelTiers[key] = tierDraftsFrom(l.tiers, l.price);
  });

  return emptyDraft({
    name: asCopy ? `${item.name} (copy)` : item.name,
    nameBn: item.nameBn ?? "",
    genericName: item.genericName,
    strength: item.strength ?? "",
    dosageForm: item.dosageForm ?? item.medicineType,
    brand: item.brand,
    category: item.category,
    subcategory: item.subcategory ?? "",
    dgdaRegNo: item.dgdaRegNo ?? "",
    barcode: asCopy ? "" : item.barcode ?? "",
    description: item.description ?? "",
    isPrescriptionRequired: !!item.isPrescriptionRequired,
    isControlled: !!item.isControlled,
    isColdChain: item.isColdChain,
    storageCondition: item.storageCondition,
    baseUnit: item.baseUnit,
    baseSellable: ladder[0]?.sellable ?? true,
    packs,
    defaultPackKey,
    purchasePackKey,
    costPrice: str(item.costPrice),
    mrp: str(item.mrp),
    sellingPrice: str(item.sellingPrice),
    vatPct: str(item.vatPct ?? 0),
    maxDiscountPct: str(item.maxDiscountPct ?? 0),
    minOrderQty: str(item.minOrderQty ?? 1),
    tiers,
    levelTiers,
    sku: asCopy ? "" : item.sku,
    skuTouched: !asCopy,
    reorderLevel: str(item.reorderLevel),
    minStock: str(item.minStockLevel),
    maxStock: str(item.maxStockLevel),
    supplierId: item.supplierId,
    leadTimeDays: str(item.leadTimeDays),
    defaultWarehouseId: item.defaultWarehouseId ?? "wh-01",
    defaultLocation: item.defaultLocation ?? "",
    openingWarehouseId: item.defaultWarehouseId ?? "wh-01",
    openingLevelKey: defaultPackKey,
    images: asCopy ? [] : (item.imageUrls ?? []).map((url, i) => ({ key: newKey(), url, name: `Image ${i + 1}` })),
    status: asCopy ? "DRAFT" : item.isActive ? "ACTIVE" : item.status === "DRAFT" ? "DRAFT" : "INACTIVE",
    visibleTo: item.visibleTo ?? [...ALL_CUSTOMER_TYPES],
  });
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export interface LevelInfo {
  key: string;
  name: string;
  multiplier: number;
  isBase: boolean;
}

export interface TierRow {
  key: string;
  min: number;
  max: number | null;
  packPrice: number;
  discountPct: number;
}

function tierRowsFor(list: TierDraft[], packSell: number): TierRow[] {
  return list.map((t) => {
    const v = num(t.value);
    const packPrice = t.mode === "PRICE" ? v : round2(packSell * (1 - (Number.isFinite(v) ? v : 0) / 100));
    const discountPct = t.mode === "DISCOUNT" ? v : packSell > 0 ? round2((1 - v / packSell) * 100) : NaN;
    return { key: t.key, min: Math.floor(num(t.min)), max: t.max.trim() === "" ? null : Math.floor(num(t.max)), packPrice, discountPct };
  });
}

/** Saved tiers → editable rows (keeps "price" mode when a tier only stores a price). */
export function tierDraftsFrom(list: QuantityPricingTier[], packSell: number): TierDraft[] {
  return list.map((t) => {
    const byPct = t.discountPct > 0 || Math.abs(t.unitPrice - packSell) < 0.01;
    return {
      key: newKey(),
      min: String(t.minQuantity),
      max: t.maxQuantity === null ? "" : String(t.maxQuantity),
      mode: byPct ? "DISCOUNT" : "PRICE",
      value: byPct ? String(t.discountPct) : String(t.unitPrice),
    };
  });
}

/** Rows → saved tiers, sorted. */
function rowsToTiers(rows: TierRow[]): QuantityPricingTier[] {
  const z = (n: number) => (Number.isFinite(n) ? n : 0);
  return rows
    .filter((t) => Number.isFinite(t.min))
    .sort((a, b) => a.min - b.min)
    .map((t) => ({
      minQuantity: t.min,
      maxQuantity: t.max,
      unitPrice: round2(z(t.packPrice)),
      discountPct: round2(Math.max(0, z(t.discountPct))),
    }));
}

/** "4 Box tiers" etc. — the 0/5/10/15% ladder from the pricing brief. */
export function suggestedTiers(): TierDraft[] {
  return [
    { key: newKey(), min: "1", max: "9", mode: "DISCOUNT", value: "0" },
    { key: newKey(), min: "10", max: "49", mode: "DISCOUNT", value: "5" },
    { key: newKey(), min: "50", max: "99", mode: "DISCOUNT", value: "10" },
    { key: newKey(), min: "100", max: "", mode: "DISCOUNT", value: "15" },
  ];
}

export function derive(d: ProductDraft) {
  const levels: LevelInfo[] = [{ key: "base", name: d.baseUnit || "Unit", multiplier: 1, isBase: true }];
  for (const p of d.packs) {
    const per = Math.max(0, Math.floor(num(p.perParent)) || 0);
    levels.push({ key: p.key, name: p.name || "Pack", multiplier: levels[levels.length - 1].multiplier * per, isBase: false });
  }
  const defaultLevel = levels.find((l) => l.key === d.defaultPackKey) ?? levels[0];
  const mult = Math.max(1, defaultLevel.multiplier);
  const cost = num(d.costPrice);
  const mrp = num(d.mrp);
  const sell = num(d.sellingPrice);
  const maxDisc = num(d.maxDiscountPct);
  const packSell = round2(sell * mult);

  const tierRows = tierRowsFor(d.tiers, packSell);
  /** Own tier rows per non-default unit key. */
  const levelTierRows: Record<string, TierRow[]> = {};
  for (const [key, list] of Object.entries(d.levelTiers)) {
    const lv = levels.find((l) => l.key === key);
    if (lv && lv.key !== defaultLevel.key) levelTierRows[key] = tierRowsFor(list, round2(sell * Math.max(1, lv.multiplier)));
  }

  const openingLevel = levels.find((l) => l.key === d.openingLevelKey) ?? defaultLevel;
  const openingBase = Math.floor(num(d.openingQty) || 0) * openingLevel.multiplier;
  const openingCost = Number.isFinite(num(d.openingUnitCost)) ? num(d.openingUnitCost) : cost;

  return {
    levels,
    defaultLevel,
    mult,
    cost,
    mrp,
    sell,
    packSell,
    packCost: round2(cost * mult),
    packMrp: round2(mrp * mult),
    margin: marginPct(cost, sell),
    markup: markupPct(cost, sell),
    marginAtMaxDiscount: Number.isFinite(maxDisc) ? marginPct(cost, sell * (1 - maxDisc / 100)) : null,
    tierRows,
    levelTierRows,
    openingLevel,
    openingBase,
    openingCost,
  };
}

export type Derived = ReturnType<typeof derive>;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type SectionId = "basic" | "packs" | "pricing" | "tiers" | "inventory" | "opening" | "media" | "visibility";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "basic", label: "Basic information" },
  { id: "packs", label: "Units & pack hierarchy" },
  { id: "pricing", label: "Pricing" },
  { id: "tiers", label: "Quantity pricing tiers" },
  { id: "inventory", label: "Inventory" },
  { id: "opening", label: "Opening stock" },
  { id: "media", label: "Media" },
  { id: "visibility", label: "Visibility" },
];

export interface Issue {
  key: string;
  section: SectionId;
  message: string;
}

const MEDICINE_CATEGORIES = new Set(["Allopathic", "Herbal & Unani", "IV Fluids"]);

/** Keys still checked when saving as a draft. */
const DRAFT_KEYS = /^(name|sku|pack|opening|barcode)/;

export function validate(
  d: ProductDraft,
  x: Derived,
  ctx: { takenSkus: Set<string>; warehouses: Warehouse[]; isCreate: boolean },
  forDraft: boolean
): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (key: string, section: SectionId, message: string) => errors.push({ key, section, message });
  const warn = (key: string, section: SectionId, message: string) => warnings.push({ key, section, message });

  /* basic */
  if (!d.name.trim()) err("name", "basic", "Product name is required.");
  if (!d.genericName.trim()) err("genericName", "basic", "Generic name is required.");
  if (!d.brand) err("brand", "basic", "Choose a brand or manufacturer.");
  if (!d.category) err("category", "basic", "Choose a category.");
  if (!d.dosageForm) err("dosageForm", "basic", "Choose a dosage form.");
  if (MEDICINE_CATEGORIES.has(d.category) && !d.dgdaRegNo.trim())
    err("dgdaRegNo", "basic", "DGDA registration number is required for medicines.");
  if (d.barcode.trim()) {
    const b = d.barcode.trim();
    if (!/^\d{8}$|^\d{12,13}$/.test(b)) err("barcode", "basic", "Barcode must be 8, 12 or 13 digits.");
    else if (b.length === 13 && ean13CheckDigit(b.slice(0, 12)) !== Number(b[12]))
      err("barcode", "basic", "EAN-13 check digit does not match. Check the number or generate a new one.");
  }
  if (!d.storageCondition.trim()) err("storageCondition", "basic", "Storage condition is required.");
  if (d.isColdChain && !/2\s*[–-]\s*8|frozen|refrigerat/i.test(d.storageCondition))
    warn("storageCondition", "basic", "Cold-chain product, but the storage condition does not mention 2–8°C.");

  /* packs */
  if (!d.baseUnit) err("baseUnit", "packs", "Choose the base unit stock is counted in.");
  const seen = new Set<string>([d.baseUnit.toLowerCase()]);
  const codes = new Set<string>();
  d.packs.forEach((p, i) => {
    const label = `Pack level ${i + 1}`;
    if (!p.name.trim()) err(`pack.${p.key}.name`, "packs", `${label}: choose a unit.`);
    else if (seen.has(p.name.toLowerCase())) err(`pack.${p.key}.name`, "packs", `${label}: "${p.name}" is already used in this hierarchy.`);
    seen.add(p.name.toLowerCase());
    if (!isInt(p.perParent) || Number(p.perParent) < 2)
      err(`pack.${p.key}.perParent`, "packs", `${label}: quantity must be a whole number of 2 or more.`);
    const code = p.barcode.trim();
    if (code) {
      if (!/^\d{8}$|^\d{12,14}$/.test(code)) err(`pack.${p.key}.barcode`, "packs", `${label}: barcode must be 8, 12, 13 or 14 digits.`);
      else if (codes.has(code) || code === d.barcode.trim()) err(`pack.${p.key}.barcode`, "packs", `${label}: barcode is used twice.`);
      codes.add(code);
    }
  });
  const ladderErrors = validateLadder(x.levels.map((l) => ({ name: l.name, factor: l.multiplier })));
  if (!ladderErrors.length) {
    const sellableKeys = [d.baseSellable ? "base" : null, ...d.packs.filter((p) => p.sellable).map((p) => p.key)];
    if (!sellableKeys.includes(d.defaultPackKey))
      err("defaultPack", "packs", "The default selling unit must be one customers can order. Tick “Sellable” for it.");
    if (x.levels.length > 1 && !d.packs.some((p) => p.key === d.purchasePackKey) && d.purchasePackKey !== "base")
      err("purchasePack", "packs", "Choose the unit you buy and receive this product in.");
  }

  /* pricing */
  if (!(x.cost > 0)) err("costPrice", "pricing", "Enter the purchase cost per base unit.");
  if (!(x.mrp > 0)) err("mrp", "pricing", "Enter the MRP per base unit.");
  if (!(x.sell > 0)) err("sellingPrice", "pricing", "Enter the selling price per base unit.");
  if (x.sell > 0 && x.mrp > 0 && x.sell > x.mrp)
    err("sellingPrice", "pricing", "Selling price is above MRP. Selling above the printed MRP is not allowed.");
  if (x.margin !== null && x.cost > 0) {
    if (x.margin < 0) warn("sellingPrice", "pricing", `Selling below cost: you lose ${(-x.margin).toFixed(1)}% on every sale.`);
    else if (x.margin < 5) warn("sellingPrice", "pricing", `Margin is only ${x.margin.toFixed(1)}%. The usual floor is 5%.`);
  }
  const vat = num(d.vatPct);
  if (!(vat >= 0 && vat <= 100)) err("vatPct", "pricing", "VAT must be between 0 and 100%.");
  const md = num(d.maxDiscountPct);
  if (!(md >= 0 && md <= 100)) err("maxDiscountPct", "pricing", "Max discount must be between 0 and 100%.");
  else if (x.marginAtMaxDiscount !== null && x.marginAtMaxDiscount < 0)
    warn("maxDiscountPct", "pricing", `At the full ${md}% discount the price drops below cost.`);
  if (!isInt(d.minOrderQty) || Number(d.minOrderQty) < 1) err("minOrderQty", "pricing", "Minimum order must be a whole number of 1 or more.");

  /* tiers: default unit, then every unit with its own tiers */
  const checkTiers = (rows: TierRow[], raws: TierDraft[], unitName: string, packSell: number, packCost: number, prefix: string) => {
    const unit = unitName.toLowerCase();
    rows.forEach((t, i) => {
      const label = `${prefix}tier ${i + 1}`.replace(/^t/, "T");
      const raw = raws[i];
      if (!isInt(raw.min) || t.min < 1) err(`tier.${t.key}.min`, "tiers", `${label}: minimum quantity must be 1 or more.`);
      if (raw.max.trim() !== "" && (!isInt(raw.max) || (t.max !== null && t.max < t.min)))
        err(`tier.${t.key}.max`, "tiers", `${label}: maximum must be a whole number not below the minimum.`);
      const v = num(raw.value);
      if (raw.mode === "PRICE") {
        if (!(v > 0)) err(`tier.${t.key}.value`, "tiers", `${label}: enter a price per ${unit}.`);
        else if (packSell > 0 && v > packSell) err(`tier.${t.key}.value`, "tiers", `${label}: tier price is above the normal ${unit} price.`);
      } else if (!(v >= 0 && v < 100)) err(`tier.${t.key}.value`, "tiers", `${label}: discount must be between 0 and 99%.`);
      if (Number.isFinite(t.discountPct) && md >= 0 && t.discountPct > md + 0.001)
        warn(`tier.${t.key}.value`, "tiers", `${label}: ${t.discountPct.toFixed(1)}% is more than the ${md}% max discount.`);
      if (packCost > 0 && t.packPrice > 0 && t.packPrice < packCost) warn(`tier.${t.key}.value`, "tiers", `${label}: price is below cost.`);
    });
    const sorted = rows.filter((t) => Number.isFinite(t.min)).slice().sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const next = sorted[i + 1];
      if (!next) break;
      if (t.max === null) {
        err(`tier.${t.key}.max`, "tiers", `${prefix}Tier from ${t.min} has no upper limit but another tier starts at ${next.min}.`);
        continue;
      }
      if (next.min <= t.max) err(`tier.${next.key}.min`, "tiers", `${prefix}Tiers ${t.min}–${t.max} and ${next.min}–${next.max ?? "∞"} overlap.`);
      else if (next.min > t.max + 1) err(`tier.${next.key}.min`, "tiers", `${prefix}Gap: ${t.max + 1}–${next.min - 1} ${plural(unitName, 2).toLowerCase()} are not covered by any tier.`);
      if (Number.isFinite(next.packPrice) && Number.isFinite(t.packPrice) && next.packPrice > t.packPrice + 0.001)
        warn(`tier.${next.key}.value`, "tiers", `${prefix}Tier from ${next.min} is dearer than the tier before it.`);
    }
    if (sorted.length && sorted[0].min > 1)
      warn(`tier.${sorted[0].key}.min`, "tiers", `${prefix}Orders below ${sorted[0].min} ${plural(unitName, 2).toLowerCase()} use the normal selling price.`);
  };
  checkTiers(x.tierRows, d.tiers, x.defaultLevel.name, x.packSell, x.packCost, "");
  for (const [key, rows] of Object.entries(x.levelTierRows)) {
    const lv = x.levels.find((l) => l.key === key)!;
    const name = lv.name;
    if (!rows.length) err(`levelTiers.${key}`, "tiers", `${name}: add at least one tier or switch its own tiers off.`);
    checkTiers(rows, d.levelTiers[key], name, round2(x.sell * lv.multiplier), round2(x.cost * lv.multiplier), `${name} `);
  }

  /* inventory */
  const sku = d.sku.trim();
  if (!sku) err("sku", "inventory", "SKU is required.");
  else if (!/^[A-Z0-9][A-Z0-9-]*$/i.test(sku)) err("sku", "inventory", "SKU can only contain letters, numbers and dashes.");
  else if (ctx.takenSkus.has(sku.toUpperCase())) err("sku", "inventory", `SKU ${sku} is already used by another product.`);
  if (!isInt(d.reorderLevel)) err("reorderLevel", "inventory", "Enter the reorder level in base units.");
  const min = d.minStock.trim() ? num(d.minStock) : null;
  const max = d.maxStock.trim() ? num(d.maxStock) : null;
  if (d.minStock.trim() && !isInt(d.minStock)) err("minStock", "inventory", "Minimum stock must be a whole number.");
  if (d.maxStock.trim() && !isInt(d.maxStock)) err("maxStock", "inventory", "Maximum stock must be a whole number.");
  if (min !== null && max !== null && max <= min) err("maxStock", "inventory", "Maximum stock must be above minimum stock.");
  if (max !== null && isInt(d.reorderLevel) && Number(d.reorderLevel) >= max)
    warn("reorderLevel", "inventory", "Reorder level is at or above the maximum stock level.");
  if (!d.supplierId) err("supplierId", "inventory", "Choose a preferred supplier.");
  if (!isInt(d.leadTimeDays)) err("leadTimeDays", "inventory", "Lead time must be a whole number of days.");
  if (!d.defaultWarehouseId) err("defaultWarehouseId", "inventory", "Choose a default warehouse.");
  const wh = ctx.warehouses.find((w) => w.id === d.defaultWarehouseId);
  if (d.isColdChain && wh && !wh.hasColdRoom)
    warn("defaultWarehouseId", "inventory", `${wh.name} has no cold room for a cold-chain product.`);

  /* opening stock */
  if (ctx.isCreate && d.openingEnabled) {
    const owh = ctx.warehouses.find((w) => w.id === d.openingWarehouseId);
    if (!owh) err("openingWarehouseId", "opening", "Choose the warehouse receiving the opening stock.");
    else if (d.isColdChain && !owh.hasColdRoom) err("openingWarehouseId", "opening", `${owh.name} has no cold room for cold-chain stock.`);
    if (!d.openingBatch.trim()) err("openingBatch", "opening", "Enter the batch number.");
    if (!d.openingMfg) err("openingMfg", "opening", "Enter the manufacturing date.");
    else if (d.openingMfg > DEMO_TODAY) err("openingMfg", "opening", "Manufacturing date cannot be in the future.");
    if (!d.openingExpiry) err("openingExpiry", "opening", "Enter the expiry date.");
    else if (d.openingMfg && d.openingExpiry <= d.openingMfg) err("openingExpiry", "opening", "Expiry must be after the manufacturing date.");
    else if (d.openingExpiry <= DEMO_TODAY) err("openingExpiry", "opening", "Expiry date must be in the future.");
    if (!isInt(d.openingQty) || Number(d.openingQty) < 1) err("openingQty", "opening", "Enter a quantity of at least 1.");
    if (d.openingUnitCost.trim() && !(num(d.openingUnitCost) > 0)) err("openingUnitCost", "opening", "Unit cost must be above zero.");
    if (!d.openingUnitCost.trim() && !(x.cost > 0)) err("openingUnitCost", "opening", "Enter the unit cost (or the purchase cost above).");
  }

  /* visibility */
  if (d.status === "ACTIVE" && d.visibleTo.length === 0)
    err("visibleTo", "visibility", "Pick at least one customer type, or save as a draft.");

  if (forDraft) return { errors: errors.filter((e) => DRAFT_KEYS.test(e.key)), warnings };
  return { errors, warnings };
}

/* ------------------------------------------------------------------ */
/* Draft → InventoryItem                                               */
/* ------------------------------------------------------------------ */

const orZero = (n: number) => (Number.isFinite(n) ? n : 0);
const optNum = (s: string) => (s.trim() && Number.isFinite(num(s)) ? num(s) : undefined);

export function buildItem(
  d: ProductDraft,
  x: Derived,
  opts: { id: string; status: DraftStatus; existing?: InventoryItem; units: CatalogUnit[] }
): InventoryItem {
  const bn = Object.fromEntries(opts.units.map((u) => [u.name, u.nameBn]));
  const cost = orZero(x.cost);
  const mrp = orZero(x.mrp);
  const sell = orZero(x.sell);
  const packLevels = x.levels.filter((l) => !l.isBase);
  const draftByKey = Object.fromEntries(d.packs.map((p) => [p.key, p]));
  const packSizes: PackSize[] = packLevels.map((l) => ({
    id: `pk-${l.name.toLowerCase().replace(/\s+/g, "-")}`,
    packNameEn: l.name,
    packNameBn: bn[l.name] ?? l.name,
    multiplierToBase: l.multiplier,
    packMrp: round2(mrp * l.multiplier),
    packSellingPrice: round2(sell * l.multiplier),
    isDefault: l.key === x.defaultLevel.key,
    isSellable: draftByKey[l.key]?.sellable !== false || l.key === x.defaultLevel.key,
    isPurchaseUnit: l.key === d.purchasePackKey,
    barcode: draftByKey[l.key]?.barcode.trim() || undefined,
    pricingTiers: x.levelTierRows[l.key]?.length ? rowsToTiers(x.levelTierRows[l.key]) : undefined,
  }));
  // The base unit gets its own row whenever it carries a flag.
  if (x.defaultLevel.isBase || !d.baseSellable || d.purchasePackKey === "base" || x.levelTierRows.base?.length) {
    packSizes.unshift({
      id: "pk-base",
      packNameEn: d.baseUnit,
      packNameBn: bn[d.baseUnit] ?? d.baseUnit,
      multiplierToBase: 1,
      packMrp: mrp,
      packSellingPrice: sell,
      isDefault: x.defaultLevel.isBase,
      isSellable: d.baseSellable || x.defaultLevel.isBase,
      isPurchaseUnit: d.purchasePackKey === "base",
      pricingTiers: x.levelTierRows.base?.length ? rowsToTiers(x.levelTierRows.base) : undefined,
    });
  }
  const pricingTiers = rowsToTiers(x.tierRows);

  return {
    ...(opts.existing ?? {}),
    id: opts.id,
    sku: d.sku.trim().toUpperCase(),
    name: d.name.trim(),
    genericName: d.genericName.trim(),
    brand: d.brand,
    category: d.category,
    medicineType: d.dosageForm || opts.existing?.medicineType || "Tablet",
    baseUnit: d.baseUnit,
    packUnit: x.defaultLevel.name,
    unitsPerPack: Math.max(1, x.defaultLevel.multiplier),
    costPrice: cost,
    sellingPrice: sell,
    mrp,
    reorderLevel: Math.floor(orZero(num(d.reorderLevel))),
    avgDailySales: opts.existing?.avgDailySales ?? 0,
    leadTimeDays: Math.floor(orZero(num(d.leadTimeDays))),
    supplierId: d.supplierId,
    isColdChain: d.isColdChain,
    storageCondition: d.storageCondition.trim(),
    isActive: opts.status === "ACTIVE",
    nameBn: d.nameBn.trim(),
    subcategory: d.subcategory,
    strength: d.strength.trim(),
    dosageForm: d.dosageForm,
    dgdaRegNo: d.dgdaRegNo.trim(),
    barcode: d.barcode.trim(),
    description: d.description.trim(),
    vatPct: orZero(num(d.vatPct)),
    maxDiscountPct: orZero(num(d.maxDiscountPct)),
    minOrderQty: Math.max(1, Math.floor(orZero(num(d.minOrderQty)))),
    isPrescriptionRequired: d.isPrescriptionRequired,
    isControlled: d.isControlled,
    packSizes,
    pricingTiers,
    imageUrls: d.images.map((i) => i.url),
    visibleTo: d.visibleTo,
    minStockLevel: optNum(d.minStock),
    maxStockLevel: optNum(d.maxStock),
    defaultWarehouseId: d.defaultWarehouseId,
    defaultLocation: d.defaultLocation.trim(),
    status: opts.status,
    createdAt: opts.existing?.createdAt ?? new Date().toISOString(),
  };
}

export function buildOpening(d: ProductDraft, x: Derived): OpeningStockInput | undefined {
  if (!d.openingEnabled || x.openingBase <= 0) return undefined;
  return {
    warehouseId: d.openingWarehouseId,
    batchNumber: d.openingBatch.trim().toUpperCase(),
    location: d.defaultLocation.trim() || "Receiving bay",
    manufacturingDate: d.openingMfg,
    expiryDate: d.openingExpiry,
    quantity: x.openingBase,
    unitCost: orZero(x.openingCost),
  };
}

/** Barcodes per pack name, for the catalog store. */
export function packBarcodeMap(d: ProductDraft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of d.packs) if (p.barcode.trim() && p.name) out[p.name] = p.barcode.trim();
  return out;
}

/** Supplier whose company name contains the brand's first word. */
export function suggestSupplier(brand: string, suppliers: Supplier[]): string | undefined {
  const word = brand.split(/\s+/)[0]?.toLowerCase();
  if (!word) return undefined;
  return suppliers.find((s) => s.companyName.toLowerCase().includes(word) || s.name.toLowerCase().includes(word))?.id;
}

export const levelQty = (n: number, name: string) => `${n.toLocaleString("en-US")} ${plural(name, n)}`;
