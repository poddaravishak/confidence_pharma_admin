/**
 * Analytics demo history.
 *
 * A deterministic (seeded PRNG) daily history that ends on the demo "today"
 * (2026-11-05). It feeds the executive dashboard, the /analytics hub and the
 * profit & loss statement. Every number is reproducible on the server and the
 * client, so charts never cause a hydration mismatch.
 *
 * The series is ~190 days long so a 90-day range can still be compared with
 * the 90 days before it. Today is a partial day (the demo runs mid-morning);
 * live orders and returns from the store are layered on top by `mergeLive`.
 *
 * Conventions
 * - Money is BDT. `grossSales` is invoiced value, `revenue` is net sales
 *   (gross − returns and credit notes). COGS is weighted-average cost, net of
 *   restocked returns. Product, category and customer revenue all sum to
 *   `revenue`, so every widget agrees.
 * - Dates are `YYYY-MM-DD` in Asia/Dhaka (no DST, UTC+6).
 */
import type { Customer, Order, ReturnReason, ReturnRecord } from "@/lib/types";
import { inventoryItems } from "@/lib/db/inventory-data";
import { mockCustomers } from "@/lib/db/mock-data";

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const ANALYTICS_TODAY = "2026-11-05";
export const HISTORY_DAYS = 190;

const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000;

export const toDayMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const fromDayMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromDayMs(toDayMs(iso) + n * DAY_MS);
/** Whole days from `a` to `b` (b − a). */
export const diffDays = (a: string, b: string) => Math.round((toDayMs(b) - toDayMs(a)) / DAY_MS);
/** Calendar day in Dhaka for an ISO timestamp. */
export const dhakaDay = (iso: string) => new Date(Date.parse(iso) + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
const weekdayOf = (iso: string) => new Date(toDayMs(iso)).getUTCDay();
const daysInMonth = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).getUTCDate();

export const HISTORY_START = addDays(ANALYTICS_TODAY, -(HISTORY_DAYS - 1));
/** Share of a normal trading day already booked "today" (the demo runs mid-morning). */
export const TODAY_PROGRESS = 0.42;

/* ------------------------------------------------------------------ */
/* Ranges                                                              */
/* ------------------------------------------------------------------ */

export type RangePreset = "today" | "7d" | "30d" | "90d" | "mtd" | "custom";

export interface DateRange {
  preset: RangePreset;
  /** Inclusive, YYYY-MM-DD */
  from: string;
  /** Inclusive, YYYY-MM-DD */
  to: string;
}

export const RANGE_PRESETS: { id: Exclude<RangePreset, "custom">; label: string; short: string }[] = [
  { id: "today", label: "Today", short: "Today" },
  { id: "7d", label: "Last 7 days", short: "7 days" },
  { id: "30d", label: "Last 30 days", short: "30 days" },
  { id: "90d", label: "Last 90 days", short: "90 days" },
  { id: "mtd", label: "This month", short: "This month" },
];

const clampDay = (iso: string) => (iso < HISTORY_START ? HISTORY_START : iso > ANALYTICS_TODAY ? ANALYTICS_TODAY : iso);

export function resolveRange(preset: RangePreset, custom?: { from: string; to: string }): DateRange {
  const to = ANALYTICS_TODAY;
  switch (preset) {
    case "today":
      return { preset, from: to, to };
    case "7d":
      return { preset, from: addDays(to, -6), to };
    case "30d":
      return { preset, from: addDays(to, -29), to };
    case "90d":
      return { preset, from: addDays(to, -89), to };
    case "mtd":
      return { preset, from: `${to.slice(0, 8)}01`, to };
    case "custom": {
      let from = clampDay(custom?.from ?? addDays(to, -29));
      let end = clampDay(custom?.to ?? to);
      if (from > end) [from, end] = [end, from];
      return { preset, from, to: end };
    }
  }
}

export const rangeLength = (r: Pick<DateRange, "from" | "to">) => diffDays(r.from, r.to) + 1;

/** The comparison window: the same number of days immediately before (month-to-date compares with the same days last month). */
export function previousRange(r: DateRange): DateRange {
  if (r.preset === "mtd") {
    const y = +r.from.slice(0, 4);
    const m = +r.from.slice(5, 7) - 1; // 0-based month of the range
    const prevStart = fromDayMs(Date.UTC(y, m - 1, 1));
    const prevEnd = addDays(prevStart, Math.min(rangeLength(r), daysInMonth(prevStart)) - 1);
    return { preset: "custom", from: prevStart, to: prevEnd };
  }
  const len = rangeLength(r);
  return { preset: "custom", from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

/* ------------------------------------------------------------------ */
/* Dimensions                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORIES = ["Allopathic", "Surgical", "Diagnostic", "IV Fluids"] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export const OPEX_CATEGORIES = [
  { id: "rent", label: "Warehouse & office rent" },
  { id: "utilities", label: "Utilities & cold-room power" },
  { id: "transport", label: "Fuel & vehicle upkeep" },
  { id: "packaging", label: "Packaging & consumables" },
  { id: "marketing", label: "Marketing & field promotion" },
  { id: "admin", label: "Office & admin" },
  { id: "fees", label: "Bank & MFS charges" },
] as const;
export type OpexKey = (typeof OPEX_CATEGORIES)[number]["id"];
const OPEX_KEYS = OPEX_CATEGORIES.map((o) => o.id) as OpexKey[];

export const RIDER_IDS = ["rider-01", "rider-02", "rider-03", "rider-04"] as const;
export const OTHER_CUSTOMER_ID = "cust-other";
export const OTHER_CUSTOMER_LABEL = "Other retail pharmacies";

export const RETURN_REASONS_TRACKED: ReturnReason[] = [
  "OVER_ORDERED",
  "DAMAGED",
  "NEAR_EXPIRY",
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ITEM",
  "QUALITY_ISSUE",
  "PRICE_DISPUTE",
  "REFUSED",
];

const itemById = Object.fromEntries(inventoryItems.map((i) => [i.id, i]));
export const PRODUCT_IDS = inventoryItems.map((i) => i.id);
export const productCategory = (productId: string): CategoryKey => {
  const c = itemById[productId]?.category;
  return (CATEGORIES as readonly string[]).includes(c) ? (c as CategoryKey) : "Allopathic";
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ProductDay {
  /** Packs sold */
  units: number;
  /** Net sales */
  revenue: number;
  cogs: number;
  returnsValue: number;
}

export interface RiderDay {
  deliveries: number;
  partial: number;
  failed: number;
  onTime: number;
  cash: number;
  returnsValue: number;
}

export interface DailyPoint {
  date: string;
  /** 0 = Sunday … 5 = Friday (weekly holiday), 6 = Saturday */
  weekday: number;
  /** True for today: the business day is still running. */
  isPartial: boolean;
  grossSales: number;
  returnsValue: number;
  /** Net sales = gross sales − returns and credit notes */
  revenue: number;
  cogs: number;
  grossProfit: number;
  orders: number;
  delivered: number;
  partial: number;
  failed: number;
  onTime: number;
  returnsCount: number;
  newCustomers: number;
  /** Cash and MFS collected at the door by riders */
  cashCollected: number;
  byCategory: Record<CategoryKey, number>;
  products: Record<string, ProductDay>;
  customers: Record<string, number>;
  customerOrders: Record<string, number>;
  riders: Record<string, RiderDay>;
  returnsByReason: Partial<Record<ReturnReason, number>>;
  opex: Record<OpexKey, number>;
  salaries: number;
  damageLoss: number;
  /** Stock value relative to today (today = 1). Multiply by the live stock value. */
  stockIndex: number;
  /** Customer receivables relative to today (today = 1). Multiply by the live dues. */
  duesIndex: number;
}

/* ------------------------------------------------------------------ */
/* Seeded PRNG                                                         */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n);

/** Split an integer total by weights (largest remainder), deterministic. */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

/* ------------------------------------------------------------------ */
/* Model parameters                                                    */
/* ------------------------------------------------------------------ */

/** Share of gross sales per product. Sums to 1. */
const PRODUCT_WEIGHT: Record<string, number> = {
  "prod-01": 0.13, // Napa Extra
  "prod-02": 0.09, // Seclo 20
  "prod-03": 0.07, // Monas 10
  "prod-04": 0.06, // Latex gloves
  "prod-05": 0.08, // Dengue NS1 kit (seasonal)
  "prod-06": 0.07, // Sergel 20
  "prod-07": 0.08, // Ceftron 1g IV
  "prod-08": 0.07, // Mixtard 30
  "prod-09": 0.05, // Fexo 120
  "prod-10": 0.08, // Normal saline
  "prod-11": 0.05, // Azithrocin 500
  "prod-12": 0.06, // Syringe 3ml
  "prod-13": 0.04, // Rolac 10
  "prod-14": 0.07, // Accu-Chek strips
};

/** Relative likelihood of a product coming back (cold chain, fragile, short dated). */
const RETURN_PROPENSITY: Record<string, number> = {
  "prod-03": 1.4,
  "prod-04": 1.5,
  "prod-05": 1.2,
  "prod-08": 1.8,
  "prod-10": 1.3,
  "prod-14": 1.1,
};

const REASON_WEIGHT: Record<ReturnReason, number> = {
  OVER_ORDERED: 0.28,
  DAMAGED: 0.18,
  NEAR_EXPIRY: 0.14,
  CUSTOMER_UNAVAILABLE: 0.13,
  WRONG_ITEM: 0.08,
  QUALITY_ISSUE: 0.07,
  PRICE_DISPUTE: 0.07,
  REFUSED: 0.05,
  OTHER: 0,
};

/** Dengue season lifts rapid kits and IV fluids from July to October. */
const DENGUE_SEASON: Record<number, number> = { 4: 0.4, 5: 0.5, 6: 0.9, 7: 1.4, 8: 1.8, 9: 1.9, 10: 1.6, 11: 1.1 };

/** Sun … Sat. Friday is the weekly holiday, Thursday closes early. */
const WEEKDAY_FACTOR = [1.08, 1.05, 1.02, 1.0, 0.92, 0.52, 0.96];

/** Named accounts' share of net sales; the rest is the long tail of retail pharmacies. */
const CUSTOMER_WEIGHT: Record<string, number> = {
  "cust-07": 0.16,
  "cust-02": 0.13,
  "cust-09": 0.09,
  "cust-01": 0.08,
  "cust-06": 0.07,
  "cust-08": 0.05,
  "cust-05": 0.04,
  "cust-03": 0,
  "cust-04": 0,
};
/** Last trading day for suspended accounts. */
const CUSTOMER_UNTIL: Record<string, string> = { "cust-05": "2026-10-28" };
const customerSince = Object.fromEntries(mockCustomers.map((c) => [c.id, dhakaDay(c.createdAt)]));

const RIDER_WEIGHT: Record<string, number> = { "rider-01": 0.34, "rider-02": 0.3, "rider-03": 0.26, "rider-04": 0.14 };
const RIDER_FAIL_BIAS: Record<string, number> = { "rider-01": 0.8, "rider-02": 1.0, "rider-03": 1.35, "rider-04": 1.15 };
const RIDER_SINCE: Record<string, string> = { "rider-04": "2026-09-15" };

/** Monthly fixed costs (BDT), accrued daily. */
const MONTHLY_RENT = 110_000;
const MONTHLY_ADMIN = 24_000;
const MONTHLY_SALARIES = 340_000;
/** Festival bonuses paid with salaries (Eid-ul-Adha in May, Durga Puja in October). */
const BONUS_BY_MONTH: Record<string, number> = { "2026-05": 170_000, "2026-10": 85_000 };
const marketingFor = (month: string) => (month === "2026-10" ? 52_000 : month === "2026-08" ? 40_000 : 28_000);
const utilitiesFor = (m: number) => (m >= 5 && m <= 8 ? 42_000 : 34_000);

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

const emptyCategories = (): Record<CategoryKey, number> => ({ Allopathic: 0, Surgical: 0, Diagnostic: 0, "IV Fluids": 0 });
const emptyOpex = () => Object.fromEntries(OPEX_KEYS.map((k) => [k, 0])) as Record<OpexKey, number>;
const emptyRider = (): RiderDay => ({ deliveries: 0, partial: 0, failed: 0, onTime: 0, cash: 0, returnsValue: 0 });

function generateHistory(): DailyPoint[] {
  const rand = mulberry32(20261105);
  const noise = (spread: number) => 1 + (rand() * 2 - 1) * spread;
  const points: DailyPoint[] = [];

  for (let t = 0; t < HISTORY_DAYS; t++) {
    const date = addDays(HISTORY_START, t);
    const weekday = weekdayOf(date);
    const month = +date.slice(5, 7);
    const monthKey = date.slice(0, 7);
    const isToday = date === ANALYTICS_TODAY;
    const dim = daysInMonth(date);

    /* ---- demand ---- */
    const trend = 1 + 0.28 * (t / (HISTORY_DAYS - 1));
    let festival = 1;
    if (date >= "2026-05-26" && date <= "2026-05-30") festival = 0.45; // Eid-ul-Adha holidays
    if (date >= "2026-10-18" && date <= "2026-10-20") festival = 0.8; // Durga Puja
    const dayFactor = WEEKDAY_FACTOR[weekday] * festival * (isToday ? TODAY_PROGRESS : 1);
    const base = 215_000 * trend * dayFactor * noise(0.12);
    const dengue = DENGUE_SEASON[month] ?? 1;

    const products: Record<string, ProductDay> = {};
    let grossSales = 0;
    for (const pid of PRODUCT_IDS) {
      const item = itemById[pid];
      let w = PRODUCT_WEIGHT[pid] ?? 0.03;
      if (pid === "prod-05") w *= dengue;
      if (pid === "prod-10") w *= 0.8 + 0.22 * dengue;
      if (pid === "prod-09" && diffDays(date, ANALYTICS_TODAY) < 4) w *= 0.15; // Fexo stocked out this week
      const netPack = item.sellingPrice * item.unitsPerPack * 0.985;
      const units = Math.max(0, round((base * w * noise(0.3)) / netPack));
      const gross = units * netPack;
      const cogs = units * item.costPrice * item.unitsPerPack;
      grossSales += gross;
      products[pid] = { units, revenue: gross, cogs, returnsValue: 0 };
    }

    /* ---- returns (partial / failed deliveries and RMAs) ---- */
    const returnRate = 0.017 * noise(0.45);
    let returnsValue = 0;
    for (const pid of PRODUCT_IDS) {
      const p = products[pid];
      const r = p.revenue * returnRate * (RETURN_PROPENSITY[pid] ?? 0.85) * noise(0.6);
      const costShare = p.revenue > 0 ? p.cogs / p.revenue : 0;
      // ~85% of returned goods are sellable and go back to stock, reversing COGS.
      p.returnsValue = r;
      p.revenue -= r;
      p.cogs -= r * costShare * 0.85;
      returnsValue += r;
    }
    const revenue = grossSales - returnsValue;
    const cogs = Object.values(products).reduce((s, p) => s + p.cogs, 0);

    const returnsByReason: Partial<Record<ReturnReason, number>> = {};
    {
      const ws = RETURN_REASONS_TRACKED.map((r) => REASON_WEIGHT[r] * noise(0.5));
      const sum = ws.reduce((s, w) => s + w, 0);
      RETURN_REASONS_TRACKED.forEach((r, i) => (returnsByReason[r] = (returnsValue * ws[i]) / sum));
    }

    const byCategory = emptyCategories();
    for (const pid of PRODUCT_IDS) byCategory[productCategory(pid)] += products[pid].revenue;

    /* ---- orders & fulfilment ---- */
    const aov = 7_400 * (1 + 0.08 * (t / HISTORY_DAYS)) * noise(0.1);
    const orders = Math.max(1, round(grossSales / aov));
    const failed = Math.min(orders, round(orders * 0.024 * noise(0.8)));
    const partial = Math.min(orders - failed, round(orders * 0.052 * noise(0.6)));
    const delivered = orders - failed - partial;
    const onTime = Math.min(delivered + partial, round((delivered + partial) * (0.9 + (rand() * 2 - 1) * 0.05)));
    const returnsCount = partial + failed + (rand() < 0.35 ? 1 : 0);
    const cashCollected = revenue * 0.58 * noise(0.08);

    /* ---- customers ---- */
    const customers: Record<string, number> = {};
    const customerOrders: Record<string, number> = {};
    {
      const ids = [...Object.keys(CUSTOMER_WEIGHT), OTHER_CUSTOMER_ID];
      const ws = ids.map((id) => {
        if (id === OTHER_CUSTOMER_ID) return 0.38 * noise(0.1);
        const since = customerSince[id];
        if (since && date < since) return 0;
        if (CUSTOMER_UNTIL[id] && date > CUSTOMER_UNTIL[id]) return 0;
        return CUSTOMER_WEIGHT[id] * noise(0.6);
      });
      const sum = ws.reduce((s, w) => s + w, 0);
      const counts = allocate(orders, ws);
      ids.forEach((id, i) => {
        customers[id] = (revenue * ws[i]) / sum;
        customerOrders[id] = counts[i];
      });
    }
    const newCustomers = rand() < 0.55 ? (rand() < 0.25 ? 2 : 1) : 0;

    /* ---- riders ---- */
    const riders: Record<string, RiderDay> = {};
    {
      const active = RIDER_IDS.filter((id) => !RIDER_SINCE[id] || date >= RIDER_SINCE[id]);
      const ws = active.map((id) => RIDER_WEIGHT[id] * noise(0.2));
      const dCounts = allocate(delivered, ws);
      // Partial and failed drops are rare, so assign each one to a rider at random (weighted).
      const pick = (weights: number[]) => {
        const sum = weights.reduce((n, w) => n + w, 0);
        let x = rand() * sum;
        for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) <= 0) return i;
        return weights.length - 1;
      };
      const pCounts = active.map(() => 0);
      const fCounts = active.map(() => 0);
      const failWs = active.map((id, i) => ws[i] * RIDER_FAIL_BIAS[id]);
      for (let k = 0; k < partial; k++) pCounts[pick(ws)]++;
      for (let k = 0; k < failed; k++) fCounts[pick(failWs)]++;
      const done = delivered + partial;
      for (const id of RIDER_IDS) riders[id] = emptyRider();
      active.forEach((id, i) => {
        const r = riders[id];
        r.deliveries = dCounts[i] + pCounts[i];
        r.partial = pCounts[i];
        r.failed = fCounts[i];
        r.onTime = Math.min(r.deliveries, round(r.deliveries * (done ? onTime / done : 1) * noise(0.04)));
        r.cash = done ? (cashCollected * r.deliveries) / done : 0;
        const attempts = r.deliveries + r.failed;
        r.returnsValue = orders ? returnsValue * 0.82 * (attempts / orders) : 0;
      });
    }

    /* ---- expenses ---- */
    const accrue = (monthly: number) => (monthly / dim) * (isToday ? TODAY_PROGRESS : 1);
    const opex = emptyOpex();
    opex.rent = accrue(MONTHLY_RENT);
    opex.utilities = accrue(utilitiesFor(month));
    opex.admin = accrue(MONTHLY_ADMIN);
    opex.marketing = accrue(marketingFor(monthKey));
    opex.transport = 1_200 * (isToday ? TODAY_PROGRESS : 1) + orders * 45 * noise(0.15);
    opex.packaging = grossSales * 0.0042;
    opex.fees = revenue * 0.0036;
    const salaries = accrue(MONTHLY_SALARIES + (BONUS_BY_MONTH[monthKey] ?? 0));
    let damageLoss = rand() < 0.14 ? 1_500 + rand() * 10_500 : 0;
    if (+date.slice(8, 10) === dim) damageLoss += 8_000 + rand() * 14_000; // month-end expiry write-off

    points.push({
      date,
      weekday,
      isPartial: isToday,
      grossSales,
      returnsValue,
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      orders,
      delivered,
      partial,
      failed,
      onTime,
      returnsCount,
      newCustomers,
      cashCollected,
      byCategory,
      products,
      customers,
      customerOrders,
      riders,
      returnsByReason,
      opex,
      salaries,
      damageLoss,
      stockIndex: 1,
      duesIndex: 1,
    });
  }

  /* ---- stock value index: purchases on Saturdays and Mondays, drawn down by sales ---- */
  // About 30 days of cover: each day consumes ~1/30 of stock at cost.
  let level = 1;
  let consumedSincePurchase = 0;
  const raw: number[] = [];
  const avgCogs = points.reduce((n, p) => n + p.cogs, 0) / points.length;
  for (const p of points) {
    const used = (p.cogs / avgCogs) / 30;
    level -= used;
    consumedSincePurchase += used;
    if (p.weekday === 6 || p.weekday === 1) {
      level += consumedSincePurchase * noise(0.35) + 0.25 * (1 - level);
      consumedSincePurchase = 0;
    }
    raw.push(level);
  }
  const last = raw[raw.length - 1];
  points.forEach((p, i) => (p.stockIndex = raw[i] / last));

  /* ---- receivables index: credit sales raise it, collections bring it down ---- */
  let dues = 0.78;
  const duesRaw: number[] = [];
  for (const p of points) {
    const creditSales = p.revenue * 0.4;
    const collected = p.revenue * (0.395 - 0.0006 * Math.sin(p.weekday)) * noise(0.18);
    dues = Math.max(0.5, dues + (creditSales - collected) / 2_600_000);
    duesRaw.push(dues);
  }
  const lastDues = duesRaw[duesRaw.length - 1];
  points.forEach((p, i) => (p.duesIndex = duesRaw[i] / lastDues));

  return points;
}

export const analyticsHistory: DailyPoint[] = generateHistory();

/* ------------------------------------------------------------------ */
/* Live overlay: today's store orders and returns                      */
/* ------------------------------------------------------------------ */

function clonePoint(p: DailyPoint): DailyPoint {
  return {
    ...p,
    byCategory: { ...p.byCategory },
    products: Object.fromEntries(Object.entries(p.products).map(([k, v]) => [k, { ...v }])),
    customers: { ...p.customers },
    customerOrders: { ...p.customerOrders },
    riders: Object.fromEntries(Object.entries(p.riders).map(([k, v]) => [k, { ...v }])),
    returnsByReason: { ...p.returnsByReason },
    opex: { ...p.opex },
  };
}

/**
 * Layer today's live store activity on top of the generated history:
 * orders placed today, deliveries completed today and returns opened today.
 * Older store records are already represented by the generated history.
 */
export function mergeLive(history: DailyPoint[], orders: Order[], returns: ReturnRecord[]): DailyPoint[] {
  const idx = history.findIndex((p) => p.date === ANALYTICS_TODAY);
  if (idx < 0) return history;
  const p = clonePoint(history[idx]);

  for (const o of orders) {
    if (dhakaDay(o.createdAt) === ANALYTICS_TODAY && o.orderStatus !== "CANCELLED") {
      p.orders += 1;
      p.customerOrders[o.customerId in p.customerOrders ? o.customerId : OTHER_CUSTOMER_ID] += 1;
    }
    const doneAt = o.deliveredAt ?? o.deliveryProof?.capturedAt;
    const closed = o.orderStatus === "DELIVERED" || o.orderStatus === "PARTIALLY_DELIVERED";
    const failed = o.orderStatus === "FAILED_DELIVERY";
    if (!(closed || failed)) continue;
    const day = doneAt ? dhakaDay(doneAt) : failed ? dhakaDay(o.timeline?.[o.timeline.length - 1]?.at ?? o.createdAt) : "";
    if (day !== ANALYTICS_TODAY) continue;

    const riderId = o.assignedRider?.id;
    const r = riderId ? (p.riders[riderId] ??= emptyRider()) : null;
    if (failed) {
      p.failed += 1;
      if (r) r.failed += 1;
      continue;
    }
    const sales = Math.max(0, o.grandTotal - o.deliveryCharge);
    p.revenue += sales;
    p.grossSales += sales;
    const custKey = o.customerId in p.customers ? o.customerId : OTHER_CUSTOMER_ID;
    p.customers[custKey] += sales;
    let cogs = 0;
    for (const line of o.items) {
      const accepted = line.deliveredQuantity ?? line.quantity;
      const share = line.quantity ? accepted / line.quantity : 1;
      const lineRev = line.lineTotal * share;
      const lineCogs = line.cogsCost * share;
      cogs += lineCogs;
      const prod = (p.products[line.productId] ??= { units: 0, revenue: 0, cogs: 0, returnsValue: 0 });
      prod.units += accepted;
      prod.revenue += lineRev;
      prod.cogs += lineCogs;
      p.byCategory[productCategory(line.productId)] += lineRev;
    }
    p.cogs += cogs;
    if (o.orderStatus === "PARTIALLY_DELIVERED") p.partial += 1;
    else p.delivered += 1;
    p.onTime += 1;
    const collected = o.deliveryProof?.amountCollected ?? o.paidAmount;
    p.cashCollected += collected;
    if (r) {
      r.deliveries += 1;
      r.onTime += 1;
      r.cash += collected;
      if (o.orderStatus === "PARTIALLY_DELIVERED") r.partial += 1;
    }
  }

  for (const ret of returns) {
    if (dhakaDay(ret.createdAt) !== ANALYTICS_TODAY || ret.status === "REJECTED") continue;
    p.returnsCount += 1;
    p.returnsValue += ret.totalValue;
    if (ret.source === "CUSTOMER_RMA") p.revenue -= ret.totalValue;
    else p.grossSales += ret.totalValue; // the order's net already excludes the goods sent back
    for (const l of ret.lines) {
      const v = l.unitPrice * l.quantity;
      p.returnsByReason[l.reason] = (p.returnsByReason[l.reason] ?? 0) + v;
      const prod = (p.products[l.productId] ??= { units: 0, revenue: 0, cogs: 0, returnsValue: 0 });
      prod.returnsValue += v;
    }
    if (ret.riderId) (p.riders[ret.riderId] ??= emptyRider()).returnsValue += ret.totalValue;
  }
  p.grossProfit = p.revenue - p.cogs;

  const out = history.slice();
  out[idx] = p;
  return out;
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface Summary {
  days: number;
  grossSales: number;
  returnsValue: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** Gross margin, 0–100 */
  margin: number;
  orders: number;
  aov: number;
  delivered: number;
  partial: number;
  failed: number;
  attempts: number;
  onTime: number;
  onTimeRate: number;
  partialRate: number;
  failedRate: number;
  /** Returns as % of gross sales */
  returnRate: number;
  returnsCount: number;
  newCustomers: number;
  cashCollected: number;
  opex: Record<OpexKey, number>;
  opexTotal: number;
  salaries: number;
  damageLoss: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

export function summarize(points: DailyPoint[]): Summary {
  const s = {
    grossSales: 0,
    returnsValue: 0,
    revenue: 0,
    cogs: 0,
    orders: 0,
    delivered: 0,
    partial: 0,
    failed: 0,
    onTime: 0,
    returnsCount: 0,
    newCustomers: 0,
    cashCollected: 0,
    salaries: 0,
    damageLoss: 0,
  };
  const opex = emptyOpex();
  for (const p of points) {
    s.grossSales += p.grossSales;
    s.returnsValue += p.returnsValue;
    s.revenue += p.revenue;
    s.cogs += p.cogs;
    s.orders += p.orders;
    s.delivered += p.delivered;
    s.partial += p.partial;
    s.failed += p.failed;
    s.onTime += p.onTime;
    s.returnsCount += p.returnsCount;
    s.newCustomers += p.newCustomers;
    s.cashCollected += p.cashCollected;
    s.salaries += p.salaries;
    s.damageLoss += p.damageLoss;
    for (const k of OPEX_KEYS) opex[k] += p.opex[k];
  }
  const grossProfit = s.revenue - s.cogs;
  const attempts = s.delivered + s.partial + s.failed;
  const opexTotal = OPEX_KEYS.reduce((n, k) => n + opex[k], 0);
  const totalExpenses = opexTotal + s.salaries + s.damageLoss;
  const netProfit = grossProfit - totalExpenses;
  return {
    days: points.length,
    ...s,
    grossProfit,
    margin: pct(grossProfit, s.revenue),
    aov: s.orders ? s.revenue / s.orders : 0,
    attempts,
    onTimeRate: pct(s.onTime, s.delivered + s.partial),
    partialRate: pct(s.partial, attempts),
    failedRate: pct(s.failed, attempts),
    returnRate: pct(s.returnsValue, s.grossSales),
    opex,
    opexTotal,
    totalExpenses,
    netProfit,
    netMargin: pct(netProfit, s.revenue),
  };
}

type Source = DateRange | Pick<DateRange, "from" | "to"> | DailyPoint[];

/** Daily points inside a range (inclusive). Pass `source` to read a live-merged history. */
export function getSeries(range: Pick<DateRange, "from" | "to">, source: DailyPoint[] = analyticsHistory): DailyPoint[] {
  return source.filter((p) => p.date >= range.from && p.date <= range.to);
}

const pointsOf = (x: Source, source: DailyPoint[] = analyticsHistory) => (Array.isArray(x) ? x : getSeries(x, source));

/** A copy of a day with every additive measure multiplied by `f` (counts stay fractional). */
function scalePoint(p: DailyPoint, f: number): DailyPoint {
  const scaleMap = <K extends string>(m: Partial<Record<K, number>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, (v as number) * f])) as Record<K, number>;
  return {
    ...p,
    grossSales: p.grossSales * f,
    returnsValue: p.returnsValue * f,
    revenue: p.revenue * f,
    cogs: p.cogs * f,
    grossProfit: p.grossProfit * f,
    orders: p.orders * f,
    delivered: p.delivered * f,
    partial: p.partial * f,
    failed: p.failed * f,
    onTime: p.onTime * f,
    returnsCount: p.returnsCount * f,
    newCustomers: p.newCustomers * f,
    cashCollected: p.cashCollected * f,
    byCategory: scaleMap(p.byCategory),
    customers: scaleMap(p.customers),
    customerOrders: scaleMap(p.customerOrders),
    returnsByReason: scaleMap(p.returnsByReason),
    products: Object.fromEntries(
      Object.entries(p.products).map(([k, v]) => [k, { units: v.units * f, revenue: v.revenue * f, cogs: v.cogs * f, returnsValue: v.returnsValue * f }])
    ),
    riders: Object.fromEntries(Object.entries(p.riders).map(([k, v]) => [k, scaleMap(v as unknown as Record<string, number>) as unknown as RiderDay])),
  };
}

/** % change, or null when there is no base to compare with. */
export function changePct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || Math.abs(previous) < 1e-9) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function comparePrevious(range: DateRange, source: DailyPoint[] = analyticsHistory) {
  const prevRange = previousRange(range);
  const currentPoints = getSeries(range, source);
  let previousPoints = getSeries(prevRange, source);
  // "Today" is still running: compare with yesterday at the same point of the day.
  if (range.from === ANALYTICS_TODAY && range.to === ANALYTICS_TODAY) previousPoints = previousPoints.map((p) => scalePoint(p, TODAY_PROGRESS));
  // Named period/prior (not current/previous): React Compiler treats `.current` like a ref.
  const period = summarize(currentPoints);
  const prior = summarize(previousPoints);
  // Only compare when the previous window is fully covered by history.
  const comparable = prevRange.from >= HISTORY_START;
  return {
    range,
    prevRange,
    period,
    prior,
    currentPoints,
    previousPoints,
    comparable,
    change: (key: keyof Omit<Summary, "opex">) => (comparable ? changePct(period[key], prior[key]) : null),
  };
}

/* ---------- buckets (day / week / month) ---------- */

export type Granularity = "day" | "week" | "month";

export interface SeriesRow extends Summary {
  key: string;
  /** First and last day covered by the bucket (clipped to the data). */
  from: string;
  to: string;
  partial: number;
  /** True when the bucket is incomplete (today, or a cut-off week/month). */
  incomplete: boolean;
  byCategory: Record<CategoryKey, number>;
  stockIndex: number;
  duesIndex: number;
}

/** Weeks start on Saturday, the first working day in Bangladesh. */
export function weekStart(iso: string): string {
  const wd = weekdayOf(iso);
  return addDays(iso, -((wd + 1) % 7));
}

export function bucketize(points: DailyPoint[], granularity: Granularity): SeriesRow[] {
  const groups = new Map<string, DailyPoint[]>();
  for (const p of points) {
    const key = granularity === "day" ? p.date : granularity === "week" ? weekStart(p.date) : p.date.slice(0, 7);
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups.entries()).map(([key, pts]) => {
    const byCategory = emptyCategories();
    for (const p of pts) for (const c of CATEGORIES) byCategory[c] += p.byCategory[c];
    const expected = granularity === "day" ? 1 : granularity === "week" ? 7 : daysInMonth(pts[0].date);
    return {
      ...summarize(pts),
      key,
      from: pts[0].date,
      to: pts[pts.length - 1].date,
      incomplete: pts.length < expected || pts.some((p) => p.isPartial),
      byCategory,
      stockIndex: pts[pts.length - 1].stockIndex,
      duesIndex: pts[pts.length - 1].duesIndex,
    };
  });
}

/* ---------- dimensions ---------- */

export function categoryTotals(x: Source, source?: DailyPoint[]) {
  const pts = pointsOf(x, source);
  const totals = emptyCategories();
  for (const p of pts) for (const c of CATEGORIES) totals[c] += p.byCategory[c];
  const sum = CATEGORIES.reduce((n, c) => n + totals[c], 0);
  return CATEGORIES.map((c) => ({ category: c, revenue: totals[c], share: pct(totals[c], sum) })).sort((a, b) => b.revenue - a.revenue);
}

export interface ProductTotal {
  productId: string;
  name: string;
  category: CategoryKey;
  units: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  returnsValue: number;
  returnRate: number;
  share: number;
}

export function productTotals(x: Source, source?: DailyPoint[]): ProductTotal[] {
  const pts = pointsOf(x, source);
  const acc = new Map<string, ProductDay>();
  for (const p of pts)
    for (const [pid, d] of Object.entries(p.products)) {
      const a = acc.get(pid) ?? { units: 0, revenue: 0, cogs: 0, returnsValue: 0 };
      a.units += d.units;
      a.revenue += d.revenue;
      a.cogs += d.cogs;
      a.returnsValue += d.returnsValue;
      acc.set(pid, a);
    }
  const total = Array.from(acc.values()).reduce((n, a) => n + a.revenue, 0);
  return Array.from(acc.entries())
    .map(([productId, a]) => ({
      productId,
      name: itemById[productId]?.name ?? productId,
      category: productCategory(productId),
      units: a.units,
      revenue: a.revenue,
      cogs: a.cogs,
      grossProfit: a.revenue - a.cogs,
      margin: pct(a.revenue - a.cogs, a.revenue),
      returnsValue: a.returnsValue,
      returnRate: pct(a.returnsValue, a.revenue + a.returnsValue),
      share: pct(a.revenue, total),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function topProducts(x: Source, n = 10, source?: DailyPoint[]): ProductTotal[] {
  return productTotals(x, source).slice(0, n);
}

export interface CustomerTotal {
  customerId: string;
  revenue: number;
  orders: number;
  share: number;
}

export function customerTotals(x: Source, source?: DailyPoint[]): CustomerTotal[] {
  const pts = pointsOf(x, source);
  const rev: Record<string, number> = {};
  const ord: Record<string, number> = {};
  for (const p of pts) {
    for (const [id, v] of Object.entries(p.customers)) rev[id] = (rev[id] ?? 0) + v;
    for (const [id, v] of Object.entries(p.customerOrders)) ord[id] = (ord[id] ?? 0) + v;
  }
  const total = Object.values(rev).reduce((n, v) => n + v, 0);
  return Object.keys(rev)
    .map((customerId) => ({ customerId, revenue: rev[customerId], orders: ord[customerId] ?? 0, share: pct(rev[customerId], total) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function topCustomers(x: Source, n = 8, source?: DailyPoint[], includeOther = false): CustomerTotal[] {
  return customerTotals(x, source)
    .filter((c) => includeOther || c.customerId !== OTHER_CUSTOMER_ID)
    .filter((c) => c.revenue > 0)
    .slice(0, n);
}

export interface RiderTotal extends RiderDay {
  riderId: string;
  attempts: number;
  onTimeRate: number;
  partialRate: number;
  failedRate: number;
}

export function riderTotals(x: Source, source?: DailyPoint[]): RiderTotal[] {
  const pts = pointsOf(x, source);
  const acc: Record<string, RiderDay> = {};
  for (const p of pts)
    for (const [id, d] of Object.entries(p.riders)) {
      const a = (acc[id] ??= emptyRider());
      a.deliveries += d.deliveries;
      a.partial += d.partial;
      a.failed += d.failed;
      a.onTime += d.onTime;
      a.cash += d.cash;
      a.returnsValue += d.returnsValue;
    }
  return Object.entries(acc)
    .map(([riderId, a]) => {
      const attempts = a.deliveries + a.failed;
      return {
        riderId,
        ...a,
        attempts,
        onTimeRate: pct(a.onTime, a.deliveries),
        partialRate: pct(a.partial, attempts),
        failedRate: pct(a.failed, attempts),
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);
}

export function returnsByReason(x: Source, source?: DailyPoint[]) {
  const pts = pointsOf(x, source);
  const acc: Partial<Record<ReturnReason, number>> = {};
  for (const p of pts) for (const [r, v] of Object.entries(p.returnsByReason) as [ReturnReason, number][]) acc[r] = (acc[r] ?? 0) + v;
  const total = Object.values(acc).reduce((n, v) => n + (v ?? 0), 0);
  return (Object.entries(acc) as [ReturnReason, number][])
    .filter(([, v]) => v > 0)
    .map(([reason, value]) => ({ reason, value, share: pct(value, total) }))
    .sort((a, b) => b.value - a.value);
}

/** Average net sales per weekday (Saturday first). */
export function weekdayProfile(x: Source, source?: DailyPoint[]) {
  const pts = pointsOf(x, source).filter((p) => !p.isPartial);
  const order = [6, 0, 1, 2, 3, 4, 5];
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return order.map((wd) => {
    const days = pts.filter((p) => p.weekday === wd);
    const revenue = days.reduce((n, p) => n + p.revenue, 0);
    return { weekday: wd, label: names[wd], avgRevenue: days.length ? revenue / days.length : 0, days: days.length };
  });
}

/* ------------------------------------------------------------------ */
/* Customer dues aging                                                 */
/* ------------------------------------------------------------------ */

export const AGING_BUCKETS = [
  { id: "d0_30", label: "0–30 days" },
  { id: "d31_60", label: "31–60 days" },
  { id: "d61_90", label: "61–90 days" },
  { id: "d90p", label: "90+ days" },
] as const;
export type AgingKey = (typeof AGING_BUCKETS)[number]["id"];

/** How each account's outstanding balance is spread over the aging buckets. */
const AGING_PROFILE: Record<string, [number, number, number, number]> = {
  "cust-01": [1, 0, 0, 0],
  "cust-02": [0.82, 0.18, 0, 0],
  "cust-05": [0, 0.15, 0.45, 0.4],
  "cust-06": [0.55, 0.3, 0.15, 0],
  "cust-07": [0.48, 0.27, 0.15, 0.1],
  "cust-08": [0.62, 0.38, 0, 0],
  "cust-09": [0.7, 0.3, 0, 0],
};

export interface DuesAgingRow extends Record<AgingKey, number> {
  customerId: string;
  customerName: string;
  total: number;
}

/** Split each live customer balance into aging buckets (never older than the account itself). */
export function duesAging(customers: Pick<Customer, "id" | "businessName" | "currentDue" | "createdAt">[]): DuesAgingRow[] {
  return customers
    .filter((c) => c.currentDue > 0)
    .map((c) => {
      const age = diffDays(dhakaDay(c.createdAt), ANALYTICS_TODAY);
      const limits = [0, 31, 61, 91];
      const profile = (AGING_PROFILE[c.id] ?? [0.6, 0.25, 0.1, 0.05]).map((w, i) => (age >= limits[i] ? w : 0));
      const sum = profile.reduce((n, w) => n + w, 0) || 1;
      const parts = profile.map((w) => Math.round((c.currentDue * w) / sum));
      parts[0] += c.currentDue - parts.reduce((n, v) => n + v, 0);
      return {
        customerId: c.id,
        customerName: c.businessName,
        total: c.currentDue,
        d0_30: parts[0],
        d31_60: parts[1],
        d61_90: parts[2],
        d90p: parts[3],
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function agingTotals(rows: DuesAgingRow[]) {
  return AGING_BUCKETS.map((b) => ({ ...b, value: rows.reduce((n, r) => n + r[b.id], 0) }));
}
