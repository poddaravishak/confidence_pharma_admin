export type CustomerType = 
  | 'PHARMACY' 
  | 'CLINIC' 
  | 'DIAGNOSTIC_CENTER' 
  | 'HOSPITAL' 
  | 'HEALTHCARE_BIZ' 
  | 'SURGICAL_STORE';

export type VerificationStatus = 
  | 'PENDING' 
  | 'UNDER_REVIEW' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'SUSPENDED';

export type OrderStatus = 
  | 'PLACED' 
  | 'CONFIRMED' 
  | 'PROCESSING' 
  | 'PACKED' 
  | 'DISPATCHED' 
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' 
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED' 
  | 'RETURNED' 
  | 'FAILED_DELIVERY';

export interface CustomerDocument {
  id: string;
  documentType: 'TRADE_LICENSE' | 'DRUG_LICENSE' | 'NID_FRONT' | 'NID_BACK' | 'STORE_FRONT_PHOTO' | 'OWNER_PHOTO';
  documentNumber?: string;
  fileUrl: string;
  isVerified: boolean;
  verifiedAt?: string;
}

export interface Customer {
  id: string;
  businessName: string;
  ownerName: string;
  customerType: CustomerType;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  isExceptionApproval?: boolean;
  exceptionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  creditLimit: number;
  currentDue: number;
  documents: CustomerDocument[];
  address: {
    fullAddress: string;
    division: string;
    district: string;
    upazilaArea: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  totalOrdersCount: number;
  totalOrderValue: number;
  createdAt: string;
}

export interface Subcategory {
  id: string;
  nameEn: string;
  nameBn: string;
  slug: string;
  isActive: boolean;
  productsCount?: number;
}

export interface Category {
  id: string;
  nameEn: string;
  nameBn: string;
  slug: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  subcategories: Subcategory[];
  totalProductsCount: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  countryOfOrigin: string;
  headquarters: string;
  totalProductsCount: number;
  establishedYear?: number;
  dgdaLicenseNo?: string;
  isActive: boolean;
  description?: string;
}

/**
 * One pack level of a product, expressed as a conversion of its base unit.
 * Stock is always counted in the base unit; `multiplierToBase` is how many
 * base units one of this pack holds (1 Box = 20 Tablets → 20).
 */
export interface PackSize {
  id: string;
  packNameEn: string;
  packNameBn: string;
  multiplierToBase: number;
  packMrp: number;
  packSellingPrice: number;
  /** Default unit on new order lines. */
  isDefault: boolean;
  /** Customers may order in this unit (default true). */
  isSellable?: boolean;
  /** Default unit for purchase orders and goods receiving. */
  isPurchaseUnit?: boolean;
  /** Barcode printed on this pack level. */
  barcode?: string;
  /**
   * Quantity tiers for orders in THIS unit (quantities counted in this unit).
   * Empty/undefined = use the product tiers by default-unit equivalent.
   */
  pricingTiers?: QuantityPricingTier[];
}

export interface QuantityPricingTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  discountPct: number;
}

export interface Product {
  id: string;
  nameEn: string;
  nameBn: string;
  genericName: string;
  brand: string;
  category: string;
  medicineType: string;
  baseUnit: string;
  mrp: number;
  basePurchasePrice: number;
  baseSellingPrice: number;
  maxDiscountPct: number;
  minOrderQty: number;
  isPrescriptionRequired: boolean;
  isColdChain: boolean;
  imageUrl: string;
  packSizes: PackSize[];
  quantityPricingTiers: QuantityPricingTier[];
  totalStockUnits: number;
  reorderLevel: number;
  isActive: boolean;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string;
  initialQuantity: number;
  availableQuantity: number;
  unitPurchaseCost: number;
  status: 'AVAILABLE' | 'LOW_STOCK' | 'NEAR_EXPIRY' | 'EXPIRED' | 'DEPLETED';
  daysUntilExpiry: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  /** Unit the line was ordered in, e.g. "Strip (10 Tablets)". */
  packSizeName: string;
  /** PackSize id of the ordered unit ("base" = the base unit itself). */
  packSizeId?: string;
  /** Quantity in the ordered unit. */
  quantity: number;
  /** Price of one ordered unit. */
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  cogsCost: number;
  /** Conversion factor: base units (tablets, vials…) in one ordered unit. Used to move stock. */
  unitsPerPack?: number;
  /** quantity × unitsPerPack — what leaves the shelf, in base units. */
  baseQuantity?: number;
  /** Base unit name at the time of ordering (Tablet, Vial…). */
  baseUnit?: string;
  /** FEFO batches picked for this line, in base units. Set at dispatch. */
  batchAllocations?: { batchId: string; quantity: number }[];
  /** Packs the customer accepted at the door (set on delivery). */
  deliveredQuantity?: number;
  /** Packs sent back with the rider (set on partial or failed delivery). */
  returnedQuantity?: number;
  returnReason?: ReturnReason;
}

export interface DeliveryPersonnel {
  id: string;
  name: string;
  employeeCode: string;
  phone: string;
  vehicleType: 'MOTORBIKE' | 'VAN' | 'BICYCLE';
  vehiclePlateNo: string;
  currentAssignedOrdersCount: number;
  cashInHand: number;
  status: 'ON_DUTY' | 'ON_DELIVERY' | 'AVAILABLE' | 'OFF_DUTY';
}

export interface DeliveryZoneRule {
  id: string;
  zoneName: string;
  division: string;
  district: string;
  areasCovered: string[];
  minOrderForFreeDelivery: number;
  standardDeliveryFee: number;
  expressDeliveryFee: number;
  estimatedTransitHours: string;
  weightSurchargePerKg: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerType: string;
  phone: string;
  address: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  orderStatus: OrderStatus;
  paymentStatus: 'PENDING' | 'PAID_COD' | 'PARTIALLY_PAID' | 'DUE';
  paymentMethod: string;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  items: OrderItem[];
  createdAt: string;
  notes?: string;
  
  // Delivery & Logistics Specifics (SRS §14 & §15)
  deliveryType?: 'STANDARD' | 'EXPRESS' | 'COLD_CHAIN';
  deliveryRuleName?: string;
  deliveryChallanNumber?: string;
  assignedRider?: DeliveryPersonnel;
  dispatchedAt?: string;
  estimatedDeliveryTime?: string;
  deliveredAt?: string;
  runId?: string;
  /** Grand total before a partial delivery revised it. */
  originalGrandTotal?: number;
  deliveryProof?: DeliveryProof;
  failureReason?: string;
  cancelReason?: string;
  timeline?: OrderEvent[];
  createdBy?: string;
}

export interface OrderEvent {
  at: string;
  status: OrderStatus | 'NOTE' | 'PAYMENT' | 'RETURN';
  label: string;
  by: string;
  note?: string;
}

export interface DeliveryProof {
  method: 'OTP' | 'SIGNATURE' | 'PHOTO';
  receivedBy: string;
  otp?: string;
  photoCount?: number;
  capturedAt: string;
  paymentMethod: PaymentChannel;
  amountCollected: number;
}

export type PaymentChannel = 'CASH' | 'BKASH' | 'NAGAD' | 'BANK' | 'CREDIT';

export interface FinancialAccount {
  id: string;
  accountName: string;
  accountType: 'CASH' | 'BANK' | 'MFS_BKASH' | 'MFS_NAGAD';
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  currentBalance: number;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  address: string;
  currentPayable: number;
  totalPurchased: number;
}

export interface SearchIntelligenceItem {
  query: string;
  searchCount: number;
  isZeroResult: boolean;
  categorySuggestion: string;
  demandUrgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  performedBy: string;
  timestamp: string;
  details: string;
}

/* ------------------------------------------------------------------ */
/* Inventory management (SRS §21–§25, plan §2.5 & §5.5)                */
/* ------------------------------------------------------------------ */

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  managerName: string;
  hasColdRoom: boolean;
  isPrimary: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  genericName: string;
  brand: string;
  category: string;
  medicineType: string;
  /** Smallest unit stock is counted in (Tablet, Vial, Bottle, Box, Piece) */
  baseUnit: string;
  /** Pack unit used for purchasing and display (Box, Carton) */
  packUnit: string;
  /** How many base units are in one pack */
  unitsPerPack: number;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  /** Reorder when sellable stock falls to this many base units */
  reorderLevel: number;
  /** Average base units sold per day over the last 30 days */
  avgDailySales: number;
  leadTimeDays: number;
  supplierId: string;
  isColdChain: boolean;
  storageCondition: string;
  isActive: boolean;

  /* Catalog fields (optional so older seed items stay valid) */
  nameBn?: string;
  subcategory?: string;
  strength?: string;
  dosageForm?: string;
  dgdaRegNo?: string;
  barcode?: string;
  description?: string;
  vatPct?: number;
  maxDiscountPct?: number;
  minOrderQty?: number;
  isPrescriptionRequired?: boolean;
  isControlled?: boolean;
  /** Extra sellable pack levels (e.g. Strip, Box, Carton) with their own prices. */
  packSizes?: PackSize[];
  /** Quantity tiers of the default sale unit (counted in that unit). */
  pricingTiers?: QuantityPricingTier[];
  imageUrls?: string[];
  visibleTo?: CustomerType[];
  minStockLevel?: number;
  maxStockLevel?: number;
  defaultWarehouseId?: string;
  defaultLocation?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  createdAt?: string;
}

export type BatchHold = 'NONE' | 'QUARANTINE' | 'RECALLED';

export interface StockBatch {
  id: string;
  itemId: string;
  warehouseId: string;
  batchNumber: string;
  location: string;
  manufacturingDate: string;
  expiryDate: string;
  receivedDate: string;
  initialQuantity: number;
  availableQuantity: number;
  unitCost: number;
  hold: BatchHold;
  holdReason?: string;
  purchaseRef?: string;
}

export type StockMovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'EXPIRY_DISPOSAL'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'DELIVERY_RETURN_IN'
  | 'OPENING_STOCK';

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  batchId: string;
  warehouseId: string;
  type: StockMovementType;
  /** Signed quantity in base units (+ in, − out) */
  quantity: number;
  unitCost: number;
  reference: string;
  performedBy: string;
  note?: string;
}

export type AdjustmentReason =
  | 'COUNT_DISCREPANCY'
  | 'DAMAGED'
  | 'EXPIRED_DISPOSAL'
  | 'FOUND_STOCK'
  | 'SAMPLE_USE'
  | 'OTHER';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StockAdjustment {
  id: string;
  date: string;
  itemId: string;
  batchId: string;
  warehouseId: string;
  reason: AdjustmentReason;
  note: string;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  costImpact: number;
  requestedBy: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type StockCountStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface StockCountLine {
  batchId: string;
  systemQuantity: number;
  countedQuantity: number | null;
}

export interface StockCount {
  id: string;
  title: string;
  warehouseId: string;
  createdAt: string;
  createdBy: string;
  status: StockCountStatus;
  completedAt?: string;
  lines: StockCountLine[];
}

export type TransferStatus = 'REQUESTED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface StockTransferLine {
  batchId: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: TransferStatus;
  requestedAt: string;
  requestedBy: string;
  dispatchedAt?: string;
  receivedAt?: string;
  note?: string;
  lines: StockTransferLine[];
}

export interface PurchaseOrderDraft {
  id: string;
  supplierId: string;
  createdAt: string;
  /**
   * `packs` are in the item's purchase unit; `unitsPerPack` snapshots its
   * conversion so receiving can post the exact base quantity.
   */
  lines: { itemId: string; packs: number; unitCost: number; unitName?: string; unitsPerPack?: number }[];
  status: 'DRAFT' | 'SENT';
}

/* ------------------------------------------------------------------ */
/* Access control: roles, permissions, staff users                     */
/* ------------------------------------------------------------------ */

export type PermissionModule =
  | 'dashboard'
  | 'orders'
  | 'delivery'
  | 'returns'
  | 'catalog'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'accounts'
  | 'analytics'
  | 'messages'
  | 'settings'
  | 'users'
  | 'audit'
  | 'rider_app';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type PermissionSet = Partial<Record<PermissionModule, PermissionAction[]>>;

export interface Role {
  id: string;
  name: string;
  description: string;
  /** System roles can be edited but not deleted. */
  isSystem: boolean;
  /** Tailwind classes for the role chip. */
  color: string;
  /** Where this role lands after sign-in. */
  homePath: string;
  permissions: PermissionSet;
}

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  designation: string;
  initials: string;
  status: StaffStatus;
  warehouseId?: string;
  /** Links a rider login to the DeliveryPersonnel record. */
  riderId?: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Delivery runs, returns, credit notes, rider settlement              */
/* ------------------------------------------------------------------ */

export type DeliveryRunStatus = 'LOADING' | 'IN_PROGRESS' | 'RETURNING' | 'SETTLED';

export interface DeliveryRun {
  id: string;
  runNumber: string;
  riderId: string;
  date: string;
  orderIds: string[];
  status: DeliveryRunStatus;
  /** Rider has ticked every line on the load sheet. */
  loadVerified: boolean;
  createdAt: string;
  createdBy: string;
  startedAt?: string;
  settledAt?: string;
  settlementId?: string;
}

export type ReturnReason =
  | 'DAMAGED'
  | 'OVER_ORDERED'
  | 'WRONG_ITEM'
  | 'NEAR_EXPIRY'
  | 'PRICE_DISPUTE'
  | 'QUALITY_ISSUE'
  | 'CUSTOMER_UNAVAILABLE'
  | 'REFUSED'
  | 'OTHER';

export type ReturnSource = 'PARTIAL_DELIVERY' | 'FAILED_DELIVERY' | 'CUSTOMER_RMA';

/**
 * Lifecycle:
 * - Delivery returns: IN_TRANSIT (with rider) → RECEIVED (handed over) → COMPLETED (inspected and restocked)
 * - Customer RMA:     REQUESTED → APPROVED → IN_TRANSIT (picked up) → RECEIVED → COMPLETED, or REJECTED
 */
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'RECEIVED' | 'COMPLETED';

export type ItemCondition = 'SELLABLE' | 'DAMAGED' | 'EXPIRED';

export interface ReturnLine {
  orderItemId: string;
  productId: string;
  productName: string;
  packSizeName: string;
  /** Packs expected back. */
  quantity: number;
  unitPrice: number;
  unitsPerPack: number;
  reason: ReturnReason;
  /** Original FEFO batch the goods were picked from. */
  batchId?: string;
  /** Packs physically handed over at the warehouse. */
  receivedQuantity?: number;
  /** Inspection split (packs). sellable + damaged = received. */
  sellableQuantity?: number;
  damagedQuantity?: number;
  damageCondition?: Exclude<ItemCondition, 'SELLABLE'>;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  source: ReturnSource;
  status: ReturnStatus;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  riderId?: string;
  runId?: string;
  lines: ReturnLine[];
  /** Value of the goods coming back at invoiced price. */
  totalValue: number;
  note?: string;
  photoCount?: number;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  rejectedReason?: string;
  receivedAt?: string;
  receivedBy?: string;
  inspectedAt?: string;
  inspectedBy?: string;
  creditNoteId?: string;
  /** Packs that were expected but not handed over. */
  shortageQuantity?: number;
}

export type CreditNoteStatus = 'ISSUED' | 'APPLIED' | 'REFUNDED';

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  returnId: string;
  amount: number;
  reason: string;
  status: CreditNoteStatus;
  createdAt: string;
  createdBy: string;
}

export interface RiderSettlement {
  id: string;
  settlementNumber: string;
  riderId: string;
  runId?: string;
  date: string;
  cashExpected: number;
  cashReceived: number;
  /** Packs of returned goods the rider should hand over. */
  goodsExpected: number;
  goodsReceived: number;
  status: 'BALANCED' | 'SHORTAGE';
  note?: string;
  settledBy: string;
  settledAt: string;
}

/* ------------------------------------------------------------------ */
/* Notifications & settings                                            */
/* ------------------------------------------------------------------ */

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  module: PermissionModule;
  href: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
}

export interface AppSettings {
  company: {
    legalName: string;
    tradeName: string;
    ownerName: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    tradeLicenseNo: string;
    drugLicenseNo: string;
    binNo: string;
    tinNo: string;
  };
  tax: {
    vatEnabled: boolean;
    vatPct: number;
    pricesIncludeVat: boolean;
    roundTo: 0 | 1 | 5;
  };
  invoice: {
    orderPrefix: string;
    invoicePrefix: string;
    challanPrefix: string;
    creditNotePrefix: string;
    nextNumber: number;
    defaultFormat: 'A4' | 'THERMAL_80MM';
    footerNote: string;
    showBatchOnInvoice: boolean;
  };
  payments: { id: PaymentChannel; label: string; enabled: boolean; accountRef?: string }[];
  credit: {
    defaultCreditLimit: number;
    defaultTermsDays: number;
    blockOverLimitOrders: boolean;
  };
  delivery: {
    proofRequired: 'OTP' | 'SIGNATURE' | 'PHOTO' | 'NONE';
    allowPartialDelivery: boolean;
    sameDayCutoff: string;
    maxStopsPerRun: number;
    riderCashLimit: number;
  };
  returns: {
    returnWindowDays: number;
    requirePhotoForDamage: boolean;
    autoRestockSellable: boolean;
    approvalThreshold: number;
    reasons: { id: ReturnReason; label: string; enabled: boolean }[];
  };
  notifications: {
    id: string;
    event: string;
    channels: { sms: boolean; whatsapp: boolean; email: boolean; inApp: boolean };
    template: string;
  }[];
  security: {
    sessionTimeoutMinutes: number;
    enforceTwoFactorForAdmins: boolean;
    passwordMinLength: number;
  };
}
