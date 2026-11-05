/**
 * Catalog master data (categories, brands, units, dosage forms) and the
 * catalog-only attributes of the seeded inventory items.
 *
 * Products themselves live in `useInventory().items`; names here match the
 * `category`, `subcategory` and `brand` strings on those items so counts work.
 */
import { Brand, Category, CustomerType, InventoryItem, PackSize, QuantityPricingTier } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Local types (not part of lib/types)                                 */
/* ------------------------------------------------------------------ */

export interface CatalogBrand extends Brand {
  /** Used to build SKUs, e.g. BEX-NAPX-500 */
  skuPrefix: string;
}

export type UnitKind = "BASE" | "PACK" | "BOTH";

export interface CatalogUnit {
  id: string;
  name: string;
  nameBn: string;
  abbreviation: string;
  kind: UnitKind;
  isActive: boolean;
}

export interface DosageForm {
  id: string;
  name: string;
  nameBn: string;
  defaultBaseUnit: string;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Customer types                                                      */
/* ------------------------------------------------------------------ */

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PHARMACY: "Pharmacy",
  CLINIC: "Clinic",
  DIAGNOSTIC_CENTER: "Diagnostic centre",
  HOSPITAL: "Hospital",
  HEALTHCARE_BIZ: "Healthcare business",
  SURGICAL_STORE: "Surgical store",
};

export const ALL_CUSTOMER_TYPES = Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[];

export const STORAGE_CONDITIONS = [
  "Below 30°C, dry place",
  "Below 25°C, protect from light",
  "2–8°C (refrigerated), do not freeze",
  "4–30°C, keep dry",
  "Room temperature",
  "Store frozen (−20°C)",
];

/* ------------------------------------------------------------------ */
/* Categories & subcategories                                          */
/* ------------------------------------------------------------------ */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sub = (id: string, nameEn: string, nameBn: string, isActive = true) => ({
  id,
  nameEn,
  nameBn,
  slug: slug(nameEn),
  isActive,
});

export const catalogCategories: Category[] = [
  {
    id: "cat-01",
    nameEn: "Allopathic",
    nameBn: "অ্যালোপ্যাথিক",
    slug: "allopathic",
    icon: "Pill",
    displayOrder: 1,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0101", "Analgesics", "ব্যথানাশক"),
      sub("sub-0102", "Antibiotics", "অ্যান্টিবায়োটিক"),
      sub("sub-0103", "Antacids", "অ্যান্টাসিড"),
      sub("sub-0104", "Antihistamines", "অ্যান্টিহিস্টামিন"),
      sub("sub-0105", "Respiratory", "শ্বাসতন্ত্র"),
      sub("sub-0106", "Diabetes", "ডায়াবেটিস"),
      sub("sub-0107", "Cardiovascular", "হৃদরোগ"),
      sub("sub-0108", "Rehydration", "পানিশূন্যতা"),
    ],
  },
  {
    id: "cat-02",
    nameEn: "Surgical",
    nameBn: "সার্জিক্যাল",
    slug: "surgical",
    icon: "Scissors",
    displayOrder: 2,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0201", "Gloves", "গ্লাভস"),
      sub("sub-0202", "Syringes & needles", "সিরিঞ্জ ও সুই"),
      sub("sub-0203", "Dressings & bandages", "ড্রেসিং ও ব্যান্ডেজ"),
      sub("sub-0204", "Sutures", "সেলাইয়ের সুতা"),
    ],
  },
  {
    id: "cat-03",
    nameEn: "Diagnostic",
    nameBn: "ডায়াগনস্টিক",
    slug: "diagnostic",
    icon: "TestTube",
    displayOrder: 3,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0301", "Rapid test kits", "র‍্যাপিড টেস্ট কিট"),
      sub("sub-0302", "Glucose monitoring", "গ্লুকোজ পরীক্ষা"),
      sub("sub-0303", "Lab reagents", "ল্যাব রিএজেন্ট"),
    ],
  },
  {
    id: "cat-04",
    nameEn: "IV Fluids",
    nameBn: "আইভি স্যালাইন",
    slug: "iv-fluids",
    icon: "Droplets",
    displayOrder: 4,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0401", "Saline", "স্যালাইন"),
      sub("sub-0402", "Dextrose", "ডেক্সট্রোজ"),
      sub("sub-0403", "Electrolytes", "ইলেক্ট্রোলাইট"),
    ],
  },
  {
    id: "cat-05",
    nameEn: "Herbal & Unani",
    nameBn: "হারবাল ও ইউনানি",
    slug: "herbal-and-unani",
    icon: "Leaf",
    displayOrder: 5,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [sub("sub-0501", "Herbal syrups", "হারবাল সিরাপ"), sub("sub-0502", "Unani medicines", "ইউনানি ওষুধ")],
  },
  {
    id: "cat-06",
    nameEn: "Baby care",
    nameBn: "শিশু পরিচর্যা",
    slug: "baby-care",
    icon: "Baby",
    displayOrder: 6,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0601", "Diapers", "ডায়াপার"),
      sub("sub-0602", "Baby food", "শিশু খাদ্য"),
      sub("sub-0603", "Baby skin care", "শিশুর ত্বকের যত্ন"),
    ],
  },
  {
    id: "cat-07",
    nameEn: "Medical devices",
    nameBn: "চিকিৎসা যন্ত্র",
    slug: "medical-devices",
    icon: "Stethoscope",
    displayOrder: 7,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0701", "BP monitors", "রক্তচাপ মাপার যন্ত্র"),
      sub("sub-0702", "Glucometers", "গ্লুকোমিটার"),
      sub("sub-0703", "Nebulizers", "নেবুলাইজার"),
      sub("sub-0704", "Thermometers", "থার্মোমিটার"),
    ],
  },
  {
    id: "cat-08",
    nameEn: "Nutrition",
    nameBn: "পুষ্টি",
    slug: "nutrition",
    icon: "Apple",
    displayOrder: 8,
    isActive: true,
    totalProductsCount: 0,
    subcategories: [
      sub("sub-0801", "Vitamins & minerals", "ভিটামিন ও মিনারেল"),
      sub("sub-0802", "Oral rehydration", "খাবার স্যালাইন"),
      sub("sub-0803", "Protein supplements", "প্রোটিন সাপ্লিমেন্ট", false),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Brands / manufacturers                                              */
/* ------------------------------------------------------------------ */

const brand = (
  id: string,
  name: string,
  skuPrefix: string,
  countryOfOrigin: string,
  headquarters: string,
  establishedYear: number,
  dgdaLicenseNo: string,
  description: string,
  isActive = true
): CatalogBrand => ({
  id,
  name,
  slug: slug(name),
  skuPrefix,
  countryOfOrigin,
  headquarters,
  establishedYear,
  dgdaLicenseNo,
  description,
  isActive,
  totalProductsCount: 0,
});

export const catalogBrands: CatalogBrand[] = [
  brand("br-01", "Beximco Pharmaceuticals", "BEX", "Bangladesh", "Tongi, Gazipur", 1976, "DGDA/ML-034", "Generics, respiratory and anti-infectives."),
  brand("br-02", "Square Pharmaceuticals", "SQ", "Bangladesh", "Mohakhali, Dhaka", 1958, "DGDA/ML-002", "Largest local manufacturer by market share."),
  brand("br-03", "Incepta Pharmaceuticals", "INC", "Bangladesh", "Tejgaon, Dhaka", 1999, "DGDA/ML-118", "Broad generics range and vaccines."),
  brand("br-04", "Healthcare Pharmaceuticals", "HC", "Bangladesh", "Rajendrapur, Gazipur", 1988, "DGDA/ML-071", "Gastro, cardio and anti-infectives."),
  brand("br-05", "Renata", "RN", "Bangladesh", "Mirpur, Dhaka", 1972, "DGDA/ML-015", "Human health and animal health."),
  brand("br-06", "Orion Infusion", "OR", "Bangladesh", "Siddhirganj, Narayanganj", 1985, "DGDA/ML-089", "Large-volume parenterals and IV fluids."),
  brand("br-07", "JMI", "JMI", "Bangladesh", "Tejgaon, Dhaka", 1999, "DGDA/MD-011", "Disposable syringes and medical devices."),
  brand("br-08", "Getwell Healthcare", "GW", "Bangladesh", "Savar, Dhaka", 2005, "DGDA/MD-027", "Gloves and surgical consumables."),
  brand("br-09", "SD Biosensor", "SDB", "South Korea", "Suwon, Gyeonggi", 2010, "DGDA/IMP-2207", "Rapid diagnostic test kits (imported)."),
  brand("br-10", "Novo Nordisk", "NN", "Denmark", "Bagsværd", 1923, "DGDA/IMP-0412", "Insulin and diabetes care (imported)."),
  brand("br-11", "Roche", "RC", "Switzerland", "Basel", 1896, "DGDA/IMP-0388", "Diagnostics and glucose monitoring (imported)."),
  brand("br-12", "ACI", "ACI", "Bangladesh", "Tejgaon, Dhaka", 1968, "DGDA/ML-009", "Pharmaceuticals, consumer health and ORS."),
  brand("br-13", "Eskayef", "SKF", "Bangladesh", "Tongi, Gazipur", 1990, "DGDA/ML-061", "Generics, oncology and biologics."),
];

/* ------------------------------------------------------------------ */
/* Units & dosage forms                                                */
/* ------------------------------------------------------------------ */

export const catalogUnits: CatalogUnit[] = [
  { id: "un-01", name: "Tablet", nameBn: "ট্যাবলেট", abbreviation: "tab", kind: "BASE", isActive: true },
  { id: "un-02", name: "Capsule", nameBn: "ক্যাপসুল", abbreviation: "cap", kind: "BASE", isActive: true },
  { id: "un-03", name: "Vial", nameBn: "ভায়াল", abbreviation: "vial", kind: "BASE", isActive: true },
  { id: "un-04", name: "Ampoule", nameBn: "অ্যাম্পুল", abbreviation: "amp", kind: "BASE", isActive: true },
  { id: "un-05", name: "Bottle", nameBn: "বোতল", abbreviation: "btl", kind: "BASE", isActive: true },
  { id: "un-06", name: "Piece", nameBn: "পিস", abbreviation: "pc", kind: "BASE", isActive: true },
  { id: "un-07", name: "Kit", nameBn: "কিট", abbreviation: "kit", kind: "BOTH", isActive: true },
  { id: "un-08", name: "Box", nameBn: "বাক্স", abbreviation: "box", kind: "BOTH", isActive: true },
  { id: "un-09", name: "Strip", nameBn: "পাতা", abbreviation: "strip", kind: "PACK", isActive: true },
  { id: "un-10", name: "Carton", nameBn: "কার্টন", abbreviation: "ctn", kind: "PACK", isActive: true },
  { id: "un-11", name: "Tube", nameBn: "টিউব", abbreviation: "tube", kind: "BASE", isActive: true },
  { id: "un-12", name: "Sachet", nameBn: "স্যাশে", abbreviation: "sac", kind: "BASE", isActive: true },
];

export const dosageForms: DosageForm[] = [
  { id: "df-01", name: "Tablet", nameBn: "ট্যাবলেট", defaultBaseUnit: "Tablet", isActive: true },
  { id: "df-02", name: "Capsule", nameBn: "ক্যাপসুল", defaultBaseUnit: "Capsule", isActive: true },
  { id: "df-03", name: "Syrup", nameBn: "সিরাপ", defaultBaseUnit: "Bottle", isActive: true },
  { id: "df-04", name: "Suspension", nameBn: "সাসপেনশন", defaultBaseUnit: "Bottle", isActive: true },
  { id: "df-05", name: "Injection", nameBn: "ইনজেকশন", defaultBaseUnit: "Vial", isActive: true },
  { id: "df-06", name: "IV Infusion", nameBn: "আইভি ইনফিউশন", defaultBaseUnit: "Bottle", isActive: true },
  { id: "df-07", name: "Cream", nameBn: "ক্রিম", defaultBaseUnit: "Tube", isActive: true },
  { id: "df-08", name: "Ointment", nameBn: "মলম", defaultBaseUnit: "Tube", isActive: true },
  { id: "df-09", name: "Eye/ear drops", nameBn: "চোখ/কানের ড্রপ", defaultBaseUnit: "Bottle", isActive: true },
  { id: "df-10", name: "Inhaler", nameBn: "ইনহেলার", defaultBaseUnit: "Piece", isActive: true },
  { id: "df-11", name: "Powder (sachet)", nameBn: "পাউডার", defaultBaseUnit: "Sachet", isActive: true },
  { id: "df-12", name: "Suppository", nameBn: "সাপোজিটরি", defaultBaseUnit: "Piece", isActive: true },
  { id: "df-13", name: "Reagent", nameBn: "রিএজেন্ট", defaultBaseUnit: "Kit", isActive: true },
  { id: "df-14", name: "Surgical", nameBn: "সার্জিক্যাল", defaultBaseUnit: "Piece", isActive: true },
  { id: "df-15", name: "Device", nameBn: "যন্ত্র", defaultBaseUnit: "Piece", isActive: true },
];

/* ------------------------------------------------------------------ */
/* Barcodes                                                            */
/* ------------------------------------------------------------------ */

/** EAN-13 check digit for a 12-digit body. */
export function ean13CheckDigit(body12: string): number {
  const sum = body12
    .split("")
    .reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/** Valid EAN-13 in the 200–299 in-house range. */
export function ean13(body12: string): string {
  return `${body12}${ean13CheckDigit(body12)}`;
}

/* ------------------------------------------------------------------ */
/* Catalog attributes for the seeded inventory items                   */
/* ------------------------------------------------------------------ */

type Level = [name: string, multiplier: number];

interface PackOpts {
  /** Customers may also order loose base units (default true). */
  baseSellable?: boolean;
  /** Pack levels that can't be ordered (purchase-only, e.g. Carton). */
  notSellable?: string[];
  /** Default purchase / receiving unit (default: the largest level). */
  purchase?: string;
  /** 6-digit product code used to derive one EAN-13 per pack level. */
  code?: string;
  /** Own quantity tiers per pack name, as % steps of that pack's price. */
  tiers?: Record<string, [min: number, max: number | null, pct: number][]>;
}

/**
 * Build PackSize rows from a base-unit ladder. Each level is a conversion of
 * the base unit (multiplier = base units per pack); prices are per base unit
 * × multiplier.
 */
function packs(levels: Level[], defaultName: string, mrp: number, sell: number, opts: PackOpts = {}): PackSize[] {
  const bn = Object.fromEntries(catalogUnits.map((u) => [u.name, u.nameBn]));
  const rows: PackSize[] = levels.map(([name, m], i) => ({
    id: `pk-${name.toLowerCase()}`,
    packNameEn: name,
    packNameBn: bn[name] ?? name,
    multiplierToBase: m,
    packMrp: Math.round(mrp * m * 100) / 100,
    packSellingPrice: Math.round(sell * m * 100) / 100,
    isDefault: name === defaultName,
    isSellable: !opts.notSellable?.includes(name),
    isPurchaseUnit: opts.purchase ? name === opts.purchase : i === levels.length - 1,
    barcode: opts.code ? ean13(`21${opts.code}${String(i + 1).padStart(4, "0")}`) : undefined,
    pricingTiers: opts.tiers?.[name] ? tiers(Math.round(sell * m * 100) / 100, opts.tiers[name]) : undefined,
  }));
  if (opts.baseSellable === false) {
    rows.unshift({
      id: "pk-base",
      packNameEn: "",
      packNameBn: "",
      multiplierToBase: 1,
      packMrp: mrp,
      packSellingPrice: sell,
      isDefault: false,
      isSellable: false,
    });
  }
  return rows;
}

const tiers = (packPrice: number, steps: [min: number, max: number | null, pct: number][]): QuantityPricingTier[] =>
  steps.map(([minQuantity, maxQuantity, discountPct]) => ({
    minQuantity,
    maxQuantity,
    discountPct,
    unitPrice: Math.round(packPrice * (1 - discountPct / 100) * 100) / 100,
  }));

const ALL_TYPES = ALL_CUSTOMER_TYPES;
const NO_RETAIL_SURGICAL: CustomerType[] = ["PHARMACY", "CLINIC", "HOSPITAL", "DIAGNOSTIC_CENTER", "HEALTHCARE_BIZ"];

export const SEED_PRODUCT_EXTRAS: Record<string, Partial<InventoryItem>> = {
  "prod-01": {
    nameBn: "নাপা এক্সট্রা ৫০০ মি.গ্রা.",
    subcategory: "Analgesics",
    strength: "500mg + 65mg",
    dosageForm: "Tablet",
    dgdaRegNo: "037-0412-001",
    barcode: ean13("200000000101"),
    isPrescriptionRequired: false,
    packSizes: packs([["Strip", 12], ["Box", 240]], "Box", 3, 2.5, {
      baseSellable: false,
      code: "000101",
      // Loose strips have their own ladder; boxes use the product tiers below.
      tiers: { Strip: [[1, 49, 0], [50, 199, 3], [200, null, 5]] },
    }),
    pricingTiers: tiers(600, [[1, 9, 0], [10, 49, 5], [50, null, 10]]),
    vatPct: 0,
    maxDiscountPct: 10,
    minOrderQty: 1,
    visibleTo: ALL_TYPES,
    defaultWarehouseId: "wh-01",
    defaultLocation: "A-01-02",
    minStockLevel: 2400,
    maxStockLevel: 24000,
    status: "ACTIVE",
    createdAt: "2025-01-10T09:00:00Z",
  },
  "prod-02": {
    nameBn: "সেকলো ২০ মি.গ্রা.",
    subcategory: "Antacids",
    strength: "20mg",
    dosageForm: "Capsule",
    dgdaRegNo: "032-0187-022",
    barcode: ean13("200000000202"),
    isPrescriptionRequired: true,
    packSizes: packs([["Strip", 10], ["Box", 100]], "Box", 6, 4.8, { baseSellable: false, code: "000202" }),
    pricingTiers: tiers(480, [[1, 9, 0], [10, 49, 5], [50, null, 10]]),
    vatPct: 0,
    maxDiscountPct: 10,
    minOrderQty: 1,
    visibleTo: NO_RETAIL_SURGICAL,
    defaultWarehouseId: "wh-01",
    defaultLocation: "A-02-01",
    status: "ACTIVE",
    createdAt: "2025-01-10T09:00:00Z",
  },
  "prod-03": {
    nameBn: "মোনাস ১০ মি.গ্রা.",
    subcategory: "Respiratory",
    strength: "10mg",
    dosageForm: "Tablet",
    dgdaRegNo: "041-0233-104",
    barcode: ean13("200000000303"),
    isPrescriptionRequired: true,
    packSizes: packs([["Strip", 10], ["Box", 30]], "Box", 17.5, 15, { code: "000303" }),
    pricingTiers: tiers(450, [[1, 9, 0], [10, 29, 6], [30, null, 12]]),
    vatPct: 0,
    maxDiscountPct: 12,
    minOrderQty: 1,
    visibleTo: NO_RETAIL_SURGICAL,
    defaultWarehouseId: "wh-01",
    status: "ACTIVE",
    createdAt: "2025-02-02T09:00:00Z",
  },
  "prod-04": {
    nameBn: "ল্যাটেক্স গ্লাভস (মিডিয়াম)",
    subcategory: "Gloves",
    strength: "Size M",
    dosageForm: "Surgical",
    barcode: ean13("200000000404"),
    packSizes: packs([["Carton", 10]], "Carton", 550, 450, { code: "000404" }),
    vatPct: 5,
    maxDiscountPct: 8,
    minOrderQty: 1,
    visibleTo: ALL_TYPES,
    status: "ACTIVE",
    createdAt: "2025-03-15T09:00:00Z",
  },
  "prod-05": {
    nameBn: "ডেঙ্গু এনএস১ র‍্যাপিড কিট",
    subcategory: "Rapid test kits",
    strength: "25 tests",
    dosageForm: "Reagent",
    dgdaRegNo: "IMP-DX-2207-15",
    barcode: ean13("200000000505"),
    vatPct: 5,
    maxDiscountPct: 5,
    minOrderQty: 1,
    visibleTo: ["CLINIC", "DIAGNOSTIC_CENTER", "HOSPITAL"],
    status: "ACTIVE",
    createdAt: "2025-06-01T09:00:00Z",
  },
  "prod-06": {
    nameBn: "সারজেল ২০ মি.গ্রা.",
    subcategory: "Antacids",
    strength: "20mg",
    dosageForm: "Capsule",
    dgdaRegNo: "019-0290-031",
    barcode: ean13("200000000606"),
    isPrescriptionRequired: true,
    packSizes: packs([["Strip", 10], ["Box", 100]], "Box", 7, 6.5),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: NO_RETAIL_SURGICAL,
    status: "ACTIVE",
    createdAt: "2025-02-20T09:00:00Z",
  },
  "prod-07": {
    nameBn: "সেফট্রন ১ গ্রাম ইনজেকশন",
    subcategory: "Antibiotics",
    strength: "1g",
    dosageForm: "Injection",
    dgdaRegNo: "032-0501-077",
    barcode: ean13("200000000707"),
    isPrescriptionRequired: true,
    packSizes: packs([["Box", 10]], "Box", 190, 175),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: ["CLINIC", "HOSPITAL", "PHARMACY"],
    status: "ACTIVE",
    createdAt: "2025-02-20T09:00:00Z",
  },
  "prod-08": {
    nameBn: "মিক্সটার্ড ৩০ ইনসুলিন",
    subcategory: "Diabetes",
    strength: "100 IU/ml, 10ml",
    dosageForm: "Injection",
    dgdaRegNo: "IMP-0412-0088",
    barcode: ean13("200000000808"),
    isPrescriptionRequired: true,
    vatPct: 0,
    maxDiscountPct: 3,
    visibleTo: ["PHARMACY", "CLINIC", "HOSPITAL"],
    defaultWarehouseId: "wh-01",
    defaultLocation: "Cold room CR-01",
    status: "ACTIVE",
    createdAt: "2025-04-11T09:00:00Z",
  },
  "prod-09": {
    nameBn: "ফেক্সো ১২০ মি.গ্রা.",
    subcategory: "Antihistamines",
    strength: "120mg",
    dosageForm: "Tablet",
    dgdaRegNo: "032-0266-045",
    barcode: ean13("200000000909"),
    packSizes: packs([["Strip", 10], ["Box", 50]], "Box", 9, 8.5),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: ALL_TYPES,
    status: "ACTIVE",
    createdAt: "2025-02-20T09:00:00Z",
  },
  "prod-10": {
    nameBn: "নরমাল স্যালাইন ০.৯% ৫০০ মি.লি.",
    subcategory: "Saline",
    strength: "0.9% w/v, 500ml",
    dosageForm: "IV Infusion",
    dgdaRegNo: "089-0110-003",
    barcode: ean13("200000001005"),
    isPrescriptionRequired: true,
    packSizes: packs([["Carton", 20]], "Carton", 95, 85),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: ["CLINIC", "HOSPITAL", "PHARMACY"],
    status: "ACTIVE",
    createdAt: "2025-03-01T09:00:00Z",
  },
  "prod-11": {
    nameBn: "অ্যাজিথ্রোসিন ৫০০ মি.গ্রা.",
    subcategory: "Antibiotics",
    strength: "500mg",
    dosageForm: "Tablet",
    dgdaRegNo: "037-0377-019",
    barcode: ean13("200000001104"),
    isPrescriptionRequired: true,
    packSizes: packs([["Strip", 6], ["Box", 30]], "Box", 40, 36),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: NO_RETAIL_SURGICAL,
    status: "ACTIVE",
    createdAt: "2025-01-10T09:00:00Z",
  },
  "prod-12": {
    nameBn: "ডিসপোজেবল সিরিঞ্জ ৩ মি.লি.",
    subcategory: "Syringes & needles",
    strength: "3ml, 23G",
    dosageForm: "Surgical",
    barcode: ean13("200000001203"),
    packSizes: packs([["Box", 100], ["Carton", 1000]], "Box", 7, 5.5, { notSellable: ["Carton"], code: "001201" }),
    vatPct: 5,
    maxDiscountPct: 8,
    visibleTo: ALL_TYPES,
    status: "ACTIVE",
    createdAt: "2025-03-15T09:00:00Z",
  },
  "prod-13": {
    nameBn: "রোলাক ১০ মি.গ্রা.",
    subcategory: "Analgesics",
    strength: "10mg",
    dosageForm: "Tablet",
    dgdaRegNo: "015-0144-062",
    barcode: ean13("200000001302"),
    isPrescriptionRequired: true,
    isControlled: false,
    packSizes: packs([["Strip", 10], ["Box", 50]], "Box", 9, 8),
    vatPct: 0,
    maxDiscountPct: 5,
    visibleTo: NO_RETAIL_SURGICAL,
    status: "ACTIVE",
    createdAt: "2025-05-05T09:00:00Z",
  },
  "prod-15": {
    nameBn: "ওরাল স্যালাইন (ওআরএস)",
    subcategory: "Rehydration",
    strength: "10.25g",
    dosageForm: "Powder (sachet)",
    dgdaRegNo: "009-0311-045",
    barcode: ean13("200000001501"),
    isPrescriptionRequired: false,
    // 1 Box = 25 Sachets · 1 Carton = 20 Boxes = 500 Sachets
    packSizes: packs([["Box", 25], ["Carton", 500]], "Box", 7, 6, { notSellable: ["Carton"], purchase: "Carton", code: "001501" }),
    pricingTiers: tiers(150, [[1, 19, 0], [20, 99, 4], [100, null, 8]]),
    vatPct: 0,
    maxDiscountPct: 8,
    minOrderQty: 1,
    visibleTo: ALL_TYPES,
    defaultWarehouseId: "wh-01",
    defaultLocation: "A-07-01",
    minStockLevel: 2500,
    maxStockLevel: 20000,
    status: "ACTIVE",
    createdAt: "2026-05-04T09:00:00Z",
  },
  "prod-16": {
    nameBn: "সিপ্রোসিন ৫০০ মি.গ্রা.",
    subcategory: "Antibiotics",
    strength: "500mg",
    dosageForm: "Tablet",
    dgdaRegNo: "032-0118-209",
    barcode: ean13("200000001601"),
    isPrescriptionRequired: true,
    // 1 Strip = 10 Tablets · 1 Box = 2 Strips · 1 Carton = 50 Boxes
    packSizes: packs([["Strip", 10], ["Box", 20], ["Carton", 1000]], "Box", 15, 14, {
      notSellable: ["Carton"],
      code: "001601",
      tiers: { Strip: [[1, 19, 0], [20, 49, 3], [50, null, 5]] },
    }),
    // Box (default unit): 1–9 0% · 10–49 5% · 50–99 10% · 100+ 15%
    pricingTiers: tiers(280, [[1, 9, 0], [10, 49, 5], [50, 99, 10], [100, null, 15]]),
    maxDiscountPct: 15,
    vatPct: 0,
    minOrderQty: 1,
    visibleTo: NO_RETAIL_SURGICAL,
    defaultWarehouseId: "wh-01",
    defaultLocation: "A-05-03",
    status: "ACTIVE",
    createdAt: "2026-06-12T09:00:00Z",
  },
  "prod-14": {
    nameBn: "অ্যাকু-চেক অ্যাকটিভ স্ট্রিপ (৫০)",
    subcategory: "Glucose monitoring",
    strength: "50 strips",
    dosageForm: "Reagent",
    dgdaRegNo: "IMP-0388-0051",
    barcode: ean13("200000001401"),
    vatPct: 5,
    maxDiscountPct: 5,
    visibleTo: ALL_TYPES,
    status: "ACTIVE",
    createdAt: "2025-04-11T09:00:00Z",
  },
};

/**
 * Item with its seeded catalog attributes filled in. Values already on the
 * item always win, so edits saved through `updateItem` take over.
 */
export function withCatalogDefaults(item: InventoryItem): InventoryItem {
  const extra = SEED_PRODUCT_EXTRAS[item.id];
  if (!extra) return item;
  const out: InventoryItem = { ...item };
  for (const key of Object.keys(extra) as (keyof InventoryItem)[]) {
    if (out[key] === undefined) (out as unknown as Record<string, unknown>)[key] = extra[key];
  }
  return out;
}
