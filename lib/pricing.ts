/**
 * Quantity-based pricing
 * ======================
 *
 * Every product can have quantity tiers, and every pack size can have its
 * OWN tiers on top of that:
 *
 *   Box (default)   1–9 ৳280 · 10–49 ৳266 (5%) · 50–99 ৳252 (10%) · 100+ ৳238 (15%)
 *   Strip (own)     1–19 ৳140 · 20–49 ৳135.8 (3%) · 50+ ৳133 (5%)
 *   Tablet          no own tiers → uses the Box tiers by tablet equivalent
 *
 * Resolution for an order line in unit U:
 *   1. U has its own tiers  → count the quantity ordered in U.
 *   2. otherwise            → use the product tiers (defined in the default
 *      sale unit) and count every inheriting line of the product by its
 *      default-unit equivalent (base units ÷ default factor).
 *   3. no tier matches      → normal list price (manual discount allowed).
 */
import type { InventoryItem, QuantityPricingTier } from "@/lib/types";
import { UnitLevel, defaultSaleLevel, pluralUnit } from "@/lib/units";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type TierSource = "OWN" | "PRODUCT";

export interface TierTable {
  tiers: QuantityPricingTier[];
  /** OWN = this unit's own tiers; PRODUCT = product tiers in the default unit. */
  source: TierSource;
  /** Unit the tier quantities are counted in. */
  countUnit: UnitLevel;
  /** List price of one `countUnit`. */
  listPrice: number;
}

const sortTiers = (t: QuantityPricingTier[]) => [...t].sort((a, b) => a.minQuantity - b.minQuantity);

/** The tier table that prices a line in `level`. */
export function tierTable(item: InventoryItem, level: UnitLevel): TierTable {
  const sale = defaultSaleLevel(item);
  if (level.id !== sale.id && level.tiers?.length) {
    return { tiers: sortTiers(level.tiers), source: "OWN", countUnit: level, listPrice: level.price };
  }
  const own = level.id === sale.id && level.tiers?.length ? level.tiers : item.pricingTiers ?? [];
  return { tiers: sortTiers(own), source: level.id === sale.id ? "OWN" : "PRODUCT", countUnit: sale, listPrice: sale.price };
}

/** True when `level` prices off its own tier table (not inherited). */
export const hasOwnTiers = (item: InventoryItem, level: UnitLevel) => {
  const sale = defaultSaleLevel(item);
  return level.id === sale.id ? Boolean(item.pricingTiers?.length || level.tiers?.length) : Boolean(level.tiers?.length);
};

export function findTier(tiers: QuantityPricingTier[], qty: number): QuantityPricingTier | undefined {
  return tiers.find((t) => qty >= t.minQuantity && (t.maxQuantity === null || qty <= t.maxQuantity));
}

/** Tier discount as % of the list price (a tier may store a %, a price, or both). */
export function tierDiscountPct(t: QuantityPricingTier, listPrice: number): number {
  if (t.discountPct > 0) return t.discountPct;
  if (t.unitPrice > 0 && listPrice > 0 && t.unitPrice < listPrice) return round2((1 - t.unitPrice / listPrice) * 100);
  return 0;
}

/** Price of one count-unit in a tier. */
export const tierUnitPrice = (t: QuantityPricingTier, listPrice: number) =>
  t.unitPrice > 0 ? t.unitPrice : round2(listPrice * (1 - t.discountPct / 100));

export interface TierQuote {
  table: TierTable;
  /** Quantity used to pick the tier, in `table.countUnit`. */
  countedQty: number;
  tier?: QuantityPricingTier;
  /** Discount on this line's list price. */
  discountPct: number;
  /** The next better tier and how many more count-units reach it. */
  next?: { tier: QuantityPricingTier; discountPct: number; more: number };
}

/**
 * Quote a line.
 * @param lineQty     quantity of this line in `level`
 * @param inheritBase base units of ALL lines of this product that use the
 *                    product tiers (only used when `level` has no own tiers)
 */
export function quoteTier(item: InventoryItem, level: UnitLevel, lineQty: number, inheritBase: number): TierQuote {
  const table = tierTable(item, level);
  // A pack with its own tiers counts its own quantity; everything else shares
  // the product tiers, counted across all inheriting lines in the default unit.
  const ownPackTiers = level.id !== defaultSaleLevel(item).id && table.source === "OWN";
  const countedQty = ownPackTiers ? lineQty : Math.floor(inheritBase / table.countUnit.factor);
  const tier = findTier(table.tiers, countedQty);
  const discountPct = tier ? tierDiscountPct(tier, table.listPrice) : 0;
  const nextTier = table.tiers.find((t) => t.minQuantity > countedQty && tierDiscountPct(t, table.listPrice) > discountPct);
  return {
    table,
    countedQty,
    tier,
    discountPct,
    next: nextTier ? { tier: nextTier, discountPct: tierDiscountPct(nextTier, table.listPrice), more: nextTier.minQuantity - countedQty } : undefined,
  };
}

/** "10–49 Boxes" / "100+ Boxes" */
export function tierRangeLabel(t: QuantityPricingTier, unitName: string): string {
  const range = t.maxQuantity === null ? `${t.minQuantity}+` : t.minQuantity === t.maxQuantity ? `${t.minQuantity}` : `${t.minQuantity}–${t.maxQuantity}`;
  return `${range} ${pluralUnit(unitName, t.maxQuantity ?? 2)}`;
}

/** Build tiers from a % ladder: [[1, 9, 0], [10, 49, 5], [50, null, 10]]. */
export function tiersFromSteps(listPrice: number, steps: [min: number, max: number | null, pct: number][]): QuantityPricingTier[] {
  return steps.map(([minQuantity, maxQuantity, discountPct]) => ({
    minQuantity,
    maxQuantity,
    discountPct,
    unitPrice: round2(listPrice * (1 - discountPct / 100)),
  }));
}

/**
 * Structural checks for a tier table: whole numbers, no overlaps, no gaps,
 * only the last tier open-ended, prices never go up as quantity goes up.
 */
export function validateTiers(tiers: QuantityPricingTier[], listPrice: number): string[] {
  const out: string[] = [];
  const s = sortTiers(tiers);
  s.forEach((t, i) => {
    if (!Number.isInteger(t.minQuantity) || t.minQuantity < 1) out.push(`Tier ${i + 1}: minimum must be a whole number of 1 or more.`);
    if (t.maxQuantity !== null && t.maxQuantity < t.minQuantity) out.push(`Tier ${i + 1}: maximum is below the minimum.`);
    const next = s[i + 1];
    if (!next) return;
    if (t.maxQuantity === null) out.push(`Tier from ${t.minQuantity} has no upper limit but another tier starts at ${next.minQuantity}.`);
    else if (next.minQuantity <= t.maxQuantity) out.push(`Tiers ${t.minQuantity}–${t.maxQuantity} and ${next.minQuantity}+ overlap.`);
    else if (next.minQuantity > t.maxQuantity + 1) out.push(`Gap: ${t.maxQuantity + 1}–${next.minQuantity - 1} is not covered.`);
    if (tierUnitPrice(next, listPrice) > tierUnitPrice(t, listPrice)) out.push(`Tier from ${next.minQuantity} costs more than the tier before it.`);
  });
  return out;
}
