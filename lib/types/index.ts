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

export interface PackSize {
  id: string;
  packNameEn: string;
  packNameBn: string;
  multiplierToBase: number;
  packMrp: number;
  packSellingPrice: number;
  isDefault: boolean;
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
  packSizeName: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  cogsCost: number;
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
}

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
