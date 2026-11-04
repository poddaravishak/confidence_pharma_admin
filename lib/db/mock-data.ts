import { 
  Customer, 
  Product, 
  InventoryBatch, 
  Order, 
  FinancialAccount, 
  Supplier, 
  SearchIntelligenceItem, 
  AuditLogItem,
  DeliveryPersonnel,
  DeliveryZoneRule
} from '../types';

export const mockDeliveryPersonnel: DeliveryPersonnel[] = [
  {
    id: "rider-01",
    name: "Shakil Ahmed",
    employeeCode: "EMP-RIDER-101",
    phone: "+8801712345678",
    vehicleType: "MOTORBIKE",
    vehiclePlateNo: "Dhaka Metro-Ha 45-8891",
    currentAssignedOrdersCount: 2,
    cashInHand: 32400,
    status: "ON_DELIVERY"
  },
  {
    id: "rider-02",
    name: "Kamal Hossain",
    employeeCode: "EMP-RIDER-102",
    phone: "+8801819876543",
    vehicleType: "MOTORBIKE",
    vehiclePlateNo: "Dhaka Metro-Ha 39-1120",
    currentAssignedOrdersCount: 1,
    cashInHand: 0,
    status: "ON_DUTY"
  },
  {
    id: "rider-03",
    name: "Mohammad Biplob",
    employeeCode: "EMP-VAN-103",
    phone: "+8801911445566",
    vehicleType: "VAN",
    vehiclePlateNo: "Dhaka Metro-Tha 12-4433",
    currentAssignedOrdersCount: 0,
    cashInHand: 15400,
    status: "AVAILABLE"
  }
];

export const mockDeliveryZoneRules: DeliveryZoneRule[] = [
  {
    id: "rule-dhaka-core",
    zoneName: "Dhaka Metro Core (Zone 1)",
    division: "Dhaka",
    district: "Dhaka",
    areasCovered: ["Dhanmondi", "Mirpur", "Gulshan", "Banani", "Uttara", "Mohammadpur", "Tejgaon", "Badda"],
    minOrderForFreeDelivery: 5000,
    standardDeliveryFee: 100,
    expressDeliveryFee: 200,
    estimatedTransitHours: "3–6 Hours",
    weightSurchargePerKg: 10,
    isActive: true
  },
  {
    id: "rule-dhaka-old",
    zoneName: "Old Dhaka & Mitford Wholesale Hub (Zone 2)",
    division: "Dhaka",
    district: "Dhaka",
    areasCovered: ["Mitford Road", "Kotwali", "Lalbagh", "Chawkbazar", "Armanitola"],
    minOrderForFreeDelivery: 3000,
    standardDeliveryFee: 80,
    expressDeliveryFee: 150,
    estimatedTransitHours: "2–4 Hours",
    weightSurchargePerKg: 8,
    isActive: true
  },
  {
    id: "rule-greater-dhaka",
    zoneName: "Greater Dhaka Suburbs (Zone 3)",
    division: "Dhaka",
    district: "Narayanganj / Gazipur",
    areasCovered: ["Narayanganj Sadar", "Chashara", "Gazipur Chowrasta", "Savar", "Tongi"],
    minOrderForFreeDelivery: 10000,
    standardDeliveryFee: 180,
    expressDeliveryFee: 350,
    estimatedTransitHours: "Same Day (6–10 Hours)",
    weightSurchargePerKg: 15,
    isActive: true
  }
];

export const mockCustomers: Customer[] = [
  {
    id: "cust-01",
    businessName: "Labaid Pharma Point (Dhanmondi Branch)",
    ownerName: "Dr. Rafiqul Islam",
    customerType: "PHARMACY",
    phone: "+8801711002233",
    whatsappNumber: "+8801711002233",
    email: "labaid.dhanmondi@pharma.bd",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin (Dr. TC Dey)",
    approvedAt: "2026-10-15T10:30:00Z",
    creditLimit: 150000,
    currentDue: 18500,
    documents: [
      {
        id: "doc-01",
        documentType: "DRUG_LICENSE",
        documentNumber: "DGDA/DHA-2024/9912",
        fileUrl: "/docs/sample-drug-license.jpg",
        isVerified: true,
        verifiedAt: "2026-10-15T10:30:00Z"
      },
      {
        id: "doc-02",
        documentType: "TRADE_LICENSE",
        documentNumber: "TRAD/DSCC/012993/2025",
        fileUrl: "/docs/sample-trade-license.jpg",
        isVerified: true,
        verifiedAt: "2026-10-15T10:30:00Z"
      }
    ],
    address: {
      fullAddress: "House 12, Road 4, Dhanmondi R/A, Dhaka-1205",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Dhanmondi",
      landmark: "Opposite to State University / Near Dhanmondi Lake",
      latitude: 23.7461,
      longitude: 90.3742
    },
    totalOrdersCount: 28,
    totalOrderValue: 452000,
    createdAt: "2026-10-10T09:15:00Z"
  },
  {
    id: "cust-02",
    businessName: "Popular Diagnostic & Consultation Center",
    ownerName: "Kabir Hossain",
    customerType: "DIAGNOSTIC_CENTER",
    phone: "+8801819554433",
    whatsappNumber: "+8801819554433",
    email: "popular.mirpur10@med.bd",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin",
    approvedAt: "2026-10-18T14:20:00Z",
    creditLimit: 300000,
    currentDue: 42000,
    documents: [
      {
        id: "doc-03",
        documentType: "DRUG_LICENSE",
        documentNumber: "DGDA/MIR-8842",
        fileUrl: "/docs/sample-drug-license.jpg",
        isVerified: true
      }
    ],
    address: {
      fullAddress: "Plot 3, Block B, Mirpur-10 Roundabout, Dhaka-1216",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Mirpur",
      landmark: "Mirpur-10 Metro Rail Pillar 241",
      latitude: 23.8069,
      longitude: 90.3687
    },
    totalOrdersCount: 42,
    totalOrderValue: 885000,
    createdAt: "2026-10-12T11:00:00Z"
  },
  {
    id: "cust-03",
    businessName: "Al-Madina Community Clinic & Pharmacy",
    ownerName: "Akramul Haque",
    customerType: "CLINIC",
    phone: "+8801912448822",
    whatsappNumber: "+8801912448822",
    verificationStatus: "UNDER_REVIEW",
    creditLimit: 50000,
    currentDue: 0,
    documents: [
      {
        id: "doc-04",
        documentType: "DRUG_LICENSE",
        documentNumber: "DGDA/NAR-5501",
        fileUrl: "/docs/sample-license.jpg",
        isVerified: false
      }
    ],
    address: {
      fullAddress: "B.B. Road, Chashara, Narayanganj Sadar",
      division: "Dhaka",
      district: "Narayanganj",
      upazilaArea: "Chashara",
      landmark: "Near Chashara Railway Station Gate",
      latitude: 23.6238,
      longitude: 90.4998
    },
    totalOrdersCount: 0,
    totalOrderValue: 0,
    createdAt: "2026-11-01T15:30:00Z"
  },
  {
    id: "cust-04",
    businessName: "Mitford Surgical & Medical Depot",
    ownerName: "Zahirul Alam",
    customerType: "SURGICAL_STORE",
    phone: "+8801611776655",
    verificationStatus: "PENDING",
    creditLimit: 0,
    currentDue: 0,
    documents: [],
    address: {
      fullAddress: "34 Mitford Road, Old Dhaka",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Kotwali",
      landmark: "Sir Salimullah Medical College Gate 2",
      latitude: 23.7154,
      longitude: 90.4002
    },
    totalOrdersCount: 0,
    totalOrderValue: 0,
    createdAt: "2026-11-03T08:45:00Z"
  },
  {
    id: "cust-05",
    businessName: "Apex Healthcare & Dispensary",
    ownerName: "Nazmul Hasan",
    customerType: "PHARMACY",
    phone: "+8801712998811",
    verificationStatus: "SUSPENDED",
    rejectionReason: "Drug License expired on 30 Sep 2026 and renewal copy not provided after repeated notifications.",
    creditLimit: 80000,
    currentDue: 14500,
    documents: [],
    address: {
      fullAddress: "Sector 7, Road 13, Uttara Model Town, Dhaka",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Uttara",
      landmark: "Near Mascot Plaza",
      latitude: 23.8728,
      longitude: 90.3984
    },
    totalOrdersCount: 15,
    totalOrderValue: 195000,
    createdAt: "2026-09-01T10:00:00Z"
  },
  {
    id: "cust-06",
    businessName: "Rahman Pharmacy (Mohammadpur)",
    ownerName: "Abdur Rahman",
    customerType: "PHARMACY",
    phone: "+8801715667788",
    whatsappNumber: "+8801715667788",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin (Dr. TC Dey)",
    approvedAt: "2026-06-12T09:00:00Z",
    creditLimit: 120000,
    currentDue: 24600,
    documents: [],
    address: {
      fullAddress: "22/3 Tajmahal Road, Mohammadpur, Dhaka-1207",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Mohammadpur",
      latitude: 23.759,
      longitude: 90.3626
    },
    totalOrdersCount: 41,
    totalOrderValue: 618000,
    createdAt: "2026-06-12T09:00:00Z"
  },
  {
    id: "cust-07",
    businessName: "Green Life Hospital Pharmacy",
    ownerName: "Farhana Yeasmin",
    customerType: "HOSPITAL",
    phone: "+8801819223344",
    whatsappNumber: "+8801819223344",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin (Dr. TC Dey)",
    approvedAt: "2026-03-20T09:00:00Z",
    creditLimit: 400000,
    currentDue: 86500,
    documents: [],
    address: {
      fullAddress: "32 Green Road, Dhanmondi, Dhaka-1205",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Dhanmondi",
      latitude: 23.7465,
      longitude: 90.3866
    },
    totalOrdersCount: 63,
    totalOrderValue: 1840000,
    createdAt: "2026-03-20T09:00:00Z"
  },
  {
    id: "cust-08",
    businessName: "Shifa Medical Hall (Farmgate)",
    ownerName: "Mizanur Rahman",
    customerType: "PHARMACY",
    phone: "+8801670112233",
    whatsappNumber: "+8801670112233",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin (Dr. TC Dey)",
    approvedAt: "2026-07-02T09:00:00Z",
    creditLimit: 90000,
    currentDue: 11200,
    documents: [],
    address: {
      fullAddress: "45 Tejturi Bazar, Farmgate, Dhaka-1215",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Tejgaon",
      latitude: 23.7577,
      longitude: 90.3897
    },
    totalOrdersCount: 29,
    totalOrderValue: 402000,
    createdAt: "2026-07-02T09:00:00Z"
  },
  {
    id: "cust-09",
    businessName: "City Care Clinic (Banani)",
    ownerName: "Dr. Sharmin Akter",
    customerType: "CLINIC",
    phone: "+8801755009988",
    whatsappNumber: "+8801755009988",
    verificationStatus: "APPROVED",
    approvedBy: "Super Admin (Dr. TC Dey)",
    approvedAt: "2026-08-18T09:00:00Z",
    creditLimit: 200000,
    currentDue: 0,
    documents: [],
    address: {
      fullAddress: "Road 11, House 54, Banani, Dhaka-1213",
      division: "Dhaka",
      district: "Dhaka",
      upazilaArea: "Banani",
      latitude: 23.7937,
      longitude: 90.4066
    },
    totalOrdersCount: 18,
    totalOrderValue: 356000,
    createdAt: "2026-08-18T09:00:00Z"
  }
];

export const mockProducts: Product[] = [
  {
    id: "prod-01",
    nameEn: "Napa Extra 500mg+65mg",
    nameBn: "নাপা এক্সট্রা ৫০০ মি.গ্রা.+৬৫ মি.গ্রা.",
    genericName: "Paracetamol + Caffeine",
    brand: "Beximco Pharmaceuticals Ltd.",
    category: "Allopathic",
    medicineType: "Tablet",
    baseUnit: "Tablet",
    mrp: 3.00,
    basePurchasePrice: 2.20,
    baseSellingPrice: 2.50,
    maxDiscountPct: 10.0,
    minOrderQty: 1,
    isPrescriptionRequired: false,
    isColdChain: false,
    imageUrl: "/images/napa-extra.png",
    packSizes: [
      {
        id: "pack-01-strip",
        packNameEn: "1 Strip (12 Tablets)",
        packNameBn: "১ পাতা (১২ টি ট্যাবলেট)",
        multiplierToBase: 12,
        packMrp: 36.00,
        packSellingPrice: 30.00,
        isDefault: false
      },
      {
        id: "pack-01-box",
        packNameEn: "1 Box (20 Strips / 240 Tablets)",
        packNameBn: "১ বাক্স (২০ পাতা / ২৪০ টি ট্যাবলেট)",
        multiplierToBase: 240,
        packMrp: 720.00,
        packSellingPrice: 600.00,
        isDefault: true
      }
    ],
    quantityPricingTiers: [
      { minQuantity: 1, maxQuantity: 9, unitPrice: 600.00, discountPct: 0 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 570.00, discountPct: 5.0 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 540.00, discountPct: 10.0 }
    ],
    totalStockUnits: 9600,
    reorderLevel: 2400,
    isActive: true
  },
  {
    id: "prod-02",
    nameEn: "Seclo 20mg Capsule",
    nameBn: "সেকলো ২০ মি.গ্রা. ক্যাপসুল",
    genericName: "Omeprazole",
    brand: "Square Pharmaceuticals Ltd.",
    category: "Allopathic",
    medicineType: "Capsule",
    baseUnit: "Capsule",
    mrp: 6.00,
    basePurchasePrice: 4.10,
    baseSellingPrice: 4.80,
    maxDiscountPct: 10.0,
    minOrderQty: 1,
    isPrescriptionRequired: true,
    isColdChain: false,
    imageUrl: "/images/seclo-20.png",
    packSizes: [
      {
        id: "pack-02-box",
        packNameEn: "1 Box (10 Strips / 100 Capsules)",
        packNameBn: "১ বাক্স (১০ পাতা / ১০০ টি ক্যাপসুল)",
        multiplierToBase: 100,
        packMrp: 600.00,
        packSellingPrice: 480.00,
        isDefault: true
      }
    ],
    quantityPricingTiers: [
      { minQuantity: 1, maxQuantity: 9, unitPrice: 480.00, discountPct: 0 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 456.00, discountPct: 5.0 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 432.00, discountPct: 10.0 }
    ],
    totalStockUnits: 1400,
    reorderLevel: 3000,
    isActive: true
  },
  {
    id: "prod-03",
    nameEn: "Monas 10mg Tablet",
    nameBn: "মোনাস ১০ মি.গ্রা. ট্যাবলেট",
    genericName: "Montelukast",
    brand: "Incepta Pharmaceuticals Ltd.",
    category: "Allopathic",
    medicineType: "Tablet",
    baseUnit: "Tablet",
    mrp: 17.50,
    basePurchasePrice: 12.80,
    baseSellingPrice: 15.00,
    maxDiscountPct: 12.0,
    minOrderQty: 1,
    isPrescriptionRequired: true,
    isColdChain: false,
    imageUrl: "/images/monas-10.png",
    packSizes: [
      {
        id: "pack-03-box",
        packNameEn: "1 Box (3 Strips / 30 Tablets)",
        packNameBn: "১ বাক্স (৩ পাতা / ৩০ টি ট্যাবলেট)",
        multiplierToBase: 30,
        packMrp: 525.00,
        packSellingPrice: 450.00,
        isDefault: true
      }
    ],
    quantityPricingTiers: [
      { minQuantity: 1, maxQuantity: 9, unitPrice: 450.00, discountPct: 0 },
      { minQuantity: 10, maxQuantity: 29, unitPrice: 423.00, discountPct: 6.0 },
      { minQuantity: 30, maxQuantity: null, unitPrice: 396.00, discountPct: 12.0 }
    ],
    totalStockUnits: 4500,
    reorderLevel: 900,
    isActive: true
  },
  {
    id: "prod-04",
    nameEn: "Latex Examination Gloves (Powder-Free, M)",
    nameBn: "ল্যাটেক্স পরীক্ষা গ্লাভস (এম)",
    genericName: "Medical Examination Gloves",
    brand: "Getwell Healthcare",
    category: "Surgical",
    medicineType: "Surgical",
    baseUnit: "Box",
    mrp: 550.00,
    basePurchasePrice: 380.00,
    baseSellingPrice: 450.00,
    maxDiscountPct: 13.3,
    minOrderQty: 1,
    isPrescriptionRequired: false,
    isColdChain: false,
    imageUrl: "/images/gloves.png",
    packSizes: [
      {
        id: "pack-04-carton",
        packNameEn: "1 Carton (10 Boxes / 1000 Gloves)",
        packNameBn: "১ কার্টুন (১০ বাক্স / ১০০০ গ্লাভস)",
        multiplierToBase: 10,
        packMrp: 5500.00,
        packSellingPrice: 4500.00,
        isDefault: true
      }
    ],
    quantityPricingTiers: [
      { minQuantity: 1, maxQuantity: 4, unitPrice: 4500.00, discountPct: 0 },
      { minQuantity: 5, maxQuantity: 19, unitPrice: 4200.00, discountPct: 6.7 },
      { minQuantity: 20, maxQuantity: null, unitPrice: 3900.00, discountPct: 13.3 }
    ],
    totalStockUnits: 85,
    reorderLevel: 20,
    isActive: true
  },
  {
    id: "prod-05",
    nameEn: "Dengue NS1 Ag Rapid Diagnostic Kit",
    nameBn: "ডেঙ্গু এনএস১ দ্রুত ডায়াগনস্টিক কিট",
    genericName: "Dengue Antigen Cassette",
    brand: "SD Biosensor / Abbott",
    category: "Diagnostic Reagents",
    medicineType: "Reagent",
    baseUnit: "Box",
    mrp: 3800.00,
    basePurchasePrice: 2500.00,
    baseSellingPrice: 3200.00,
    maxDiscountPct: 15.6,
    minOrderQty: 1,
    isPrescriptionRequired: false,
    isColdChain: true,
    imageUrl: "/images/dengue-kit.png",
    packSizes: [
      {
        id: "pack-05-box",
        packNameEn: "1 Box (25 Test Cassettes + Buffer)",
        packNameBn: "১ বাক্স (২৫ টেস্ট ক্যাসেট)",
        multiplierToBase: 1,
        packMrp: 3800.00,
        packSellingPrice: 3200.00,
        isDefault: true
      }
    ],
    quantityPricingTiers: [
      { minQuantity: 1, maxQuantity: 2, unitPrice: 3200.00, discountPct: 0 },
      { minQuantity: 3, maxQuantity: 9, unitPrice: 2950.00, discountPct: 7.8 },
      { minQuantity: 10, maxQuantity: null, unitPrice: 2700.00, discountPct: 15.6 }
    ],
    totalStockUnits: 120,
    reorderLevel: 30,
    isActive: true
  }
];

export const mockBatches: InventoryBatch[] = [
  {
    id: "batch-101",
    productId: "prod-01",
    productName: "Napa Extra 500mg+65mg",
    batchNumber: "BEX-NX-2409",
    expiryDate: "2026-12-01",
    initialQuantity: 4800,
    availableQuantity: 1200,
    unitPurchaseCost: 2.20,
    status: "NEAR_EXPIRY",
    daysUntilExpiry: 28
  },
  {
    id: "batch-102",
    productId: "prod-01",
    productName: "Napa Extra 500mg+65mg",
    batchNumber: "BEX-NX-2501",
    expiryDate: "2027-10-15",
    initialQuantity: 9600,
    availableQuantity: 8400,
    unitPurchaseCost: 2.20,
    status: "AVAILABLE",
    daysUntilExpiry: 346
  },
  {
    id: "batch-103",
    productId: "prod-02",
    productName: "Seclo 20mg Capsule",
    batchNumber: "SQ-SEC-2508",
    expiryDate: "2027-08-30",
    initialQuantity: 5000,
    availableQuantity: 1400,
    unitPurchaseCost: 4.10,
    status: "LOW_STOCK",
    daysUntilExpiry: 300
  },
  {
    id: "batch-104",
    productId: "prod-05",
    productName: "Dengue NS1 Ag Rapid Diagnostic Kit",
    batchNumber: "SDB-DEN-2611",
    expiryDate: "2027-05-30",
    initialQuantity: 150,
    availableQuantity: 120,
    unitPurchaseCost: 2500.00,
    status: "AVAILABLE",
    daysUntilExpiry: 208
  }
];

export const mockOrders: Order[] = [
  {
    id: "ord-001",
    orderNumber: "CP-ORD-202611-0089",
    customerId: "cust-01",
    customerName: "Labaid Pharma Point (Dhanmondi)",
    customerType: "PHARMACY",
    phone: "+8801711002233",
    address: "House 12, Road 4, Dhanmondi R/A, Dhaka",
    landmark: "Opposite to State University",
    latitude: 23.7461,
    longitude: 90.3742,
    distanceKm: 4.8,
    orderStatus: "DELIVERED",
    paymentStatus: "PAID_COD",
    paymentMethod: "CASH_ON_DELIVERY",
    subtotal: 34200,
    discount: 1800,
    deliveryCharge: 0,
    grandTotal: 32400,
    paidAmount: 32400,
    dueAmount: 0,
    deliveryType: "STANDARD",
    deliveryRuleName: "Dhaka Metro Core (Zone 1) - Free Delivery > ৳5,000",
    deliveryChallanNumber: "CHAL-202611-0089",
    assignedRider: mockDeliveryPersonnel[0],
    dispatchedAt: "2026-11-03T10:45:00Z",
    deliveredAt: "2026-11-03T12:30:00Z",
    items: [
      {
        id: "item-01",
        productId: "prod-01",
        productName: "Napa Extra 500mg+65mg",
        packSizeName: "1 Box (20 Strips)",
        quantity: 20,
        unitPrice: 570.00,
        discountPct: 5.0,
        lineTotal: 11400.00,
        cogsCost: 10560.00
      },
      {
        id: "item-02",
        productId: "prod-03",
        productName: "Monas 10mg Tablet",
        packSizeName: "1 Box (3 Strips)",
        quantity: 50,
        unitPrice: 396.00,
        discountPct: 12.0,
        lineTotal: 19800.00,
        cogsCost: 19200.00
      },
      {
        id: "item-03",
        productId: "prod-04",
        productName: "Latex Examination Gloves (M)",
        packSizeName: "1 Carton (10 Boxes)",
        quantity: 3,
        unitPrice: 4500.00,
        discountPct: 0,
        lineTotal: 13500.00,
        cogsCost: 11400.00
      }
    ],
    createdAt: "2026-11-03T10:15:00Z"
  },
  {
    id: "ord-002",
    orderNumber: "CP-ORD-202611-0090",
    customerId: "cust-02",
    customerName: "Popular Diagnostic Center (Mirpur)",
    customerType: "DIAGNOSTIC_CENTER",
    phone: "+8801819554433",
    address: "Mirpur-10 Roundabout, Dhaka",
    landmark: "Pillar 241, Metro Rail",
    latitude: 23.8069,
    longitude: 90.3687,
    distanceKm: 8.2,
    orderStatus: "OUT_FOR_DELIVERY",
    paymentStatus: "DUE",
    paymentMethod: "CASH_ON_DELIVERY",
    subtotal: 29500,
    discount: 2500,
    deliveryCharge: 150,
    grandTotal: 27150,
    paidAmount: 0,
    dueAmount: 27150,
    deliveryType: "COLD_CHAIN",
    deliveryRuleName: "Cold Chain Diagnostic Box + Zone 1",
    deliveryChallanNumber: "CHAL-202611-0090",
    assignedRider: mockDeliveryPersonnel[1],
    dispatchedAt: "2026-11-03T12:00:00Z",
    estimatedDeliveryTime: "2:30 PM Today",
    items: [
      {
        id: "item-04",
        productId: "prod-05",
        productName: "Dengue NS1 Ag Rapid Diagnostic Kit",
        packSizeName: "1 Box (25 Tests)",
        quantity: 10,
        unitPrice: 2700.00,
        discountPct: 15.6,
        lineTotal: 27000.00,
        cogsCost: 25000.00
      }
    ],
    createdAt: "2026-11-03T11:45:00Z"
  },
  {
    id: "ord-003",
    orderNumber: "CP-ORD-202611-0091",
    customerId: "cust-01",
    customerName: "Labaid Pharma Point (Dhanmondi)",
    customerType: "PHARMACY",
    phone: "+8801711002233",
    address: "House 12, Road 4, Dhanmondi R/A, Dhaka",
    landmark: "Near Dhanmondi Lake",
    latitude: 23.7461,
    longitude: 90.3742,
    distanceKm: 4.8,
    orderStatus: "PACKED",
    paymentStatus: "PENDING",
    paymentMethod: "CASH_ON_DELIVERY",
    subtotal: 14400,
    discount: 720,
    deliveryCharge: 100,
    grandTotal: 13780,
    paidAmount: 0,
    dueAmount: 13780,
    deliveryType: "STANDARD",
    deliveryRuleName: "Dhaka Metro Core (Zone 1)",
    deliveryChallanNumber: "CHAL-202611-0091",
    items: [
      {
        id: "item-05",
        productId: "prod-02",
        productName: "Seclo 20mg Capsule",
        packSizeName: "1 Box (10 Strips)",
        quantity: 30,
        unitPrice: 456.00,
        discountPct: 5.0,
        lineTotal: 13680.00,
        cogsCost: 12300.00
      }
    ],
    createdAt: "2026-11-03T12:30:00Z"
  }
];

export const mockFinancialAccounts: FinancialAccount[] = [
  {
    id: "acc-01",
    accountName: "Main Office Petty Cash Till",
    accountType: "CASH",
    currentBalance: 85400.00
  },
  {
    id: "acc-02",
    accountName: "Dutch-Bangla Bank Ltd. (Current A/C)",
    accountType: "BANK",
    accountNumber: "115.110.498214",
    bankName: "Dutch-Bangla Bank PLC",
    branchName: "Gulshan Branch, Dhaka",
    currentBalance: 1420500.00
  },
  {
    id: "acc-03",
    accountName: "bKash Merchant Wallet (+8801611110029)",
    accountType: "MFS_BKASH",
    accountNumber: "+8801611110029",
    currentBalance: 245000.00
  },
  {
    id: "acc-04",
    accountName: "Nagad Business A/C (+8801611110029)",
    accountType: "MFS_NAGAD",
    accountNumber: "+8801611110029",
    currentBalance: 115000.00
  }
];

export const mockSuppliers: Supplier[] = [
  {
    id: "sup-01",
    name: "Beximco Pharmaceuticals Depo",
    companyName: "Beximco Pharmaceuticals Ltd.",
    contactPerson: "Tanvir Ahmed (Area Sales Manager)",
    phone: "+8801730001122",
    address: "Tejgaon Industrial Area, Dhaka",
    currentPayable: 185000.00,
    totalPurchased: 2450000.00
  },
  {
    id: "sup-02",
    name: "Square Pharmaceuticals Central Depo",
    companyName: "Square Pharmaceuticals Ltd.",
    contactPerson: "Mahbubur Rahman",
    phone: "+8801755009988",
    address: "Kallayanpur Depo, Mirpur Road, Dhaka",
    currentPayable: 95000.00,
    totalPurchased: 3100000.00
  },
  {
    id: "sup-03",
    name: "Incepta Pharmaceuticals Distribution",
    companyName: "Incepta Pharmaceuticals Ltd.",
    contactPerson: "Shafiqul Islam",
    phone: "+8801844112233",
    address: "Tejgaon I/A, Dhaka-1208",
    currentPayable: 62000.00,
    totalPurchased: 1850000.00
  }
];

export const mockSearchIntelligence: SearchIntelligenceItem[] = [
  {
    query: "Meropenem 1g Injection",
    searchCount: 64,
    isZeroResult: true,
    categorySuggestion: "Hospital / Antibiotics IV",
    demandUrgency: "HIGH"
  },
  {
    query: "Insulin Glargine Pen (Lantus)",
    searchCount: 52,
    isZeroResult: true,
    categorySuggestion: "Cold Chain / Diabetes",
    demandUrgency: "HIGH"
  },
  {
    query: "Napa Extra",
    searchCount: 248,
    isZeroResult: false,
    categorySuggestion: "Allopathic",
    demandUrgency: "LOW"
  },
  {
    query: "Blood Bag Triple 450ml",
    searchCount: 38,
    isZeroResult: true,
    categorySuggestion: "Blood Transfusion / Surgical",
    demandUrgency: "MEDIUM"
  },
  {
    query: "Seclo 20",
    searchCount: 184,
    isZeroResult: false,
    categorySuggestion: "Allopathic",
    demandUrgency: "LOW"
  }
];

export const mockAuditLogs: AuditLogItem[] = [
  {
    id: "log-01",
    action: "CUSTOMER_EXCEPTION_APPROVED",
    module: "KYC_VERIFICATION",
    performedBy: "Super Admin (Dr. TC Dey)",
    timestamp: "2026-11-02T16:45:00Z",
    details: "Customer 'Al-Madina Clinic' granted provisional approval for 15 days pending Drug License verification. Reason: Personal recommendation and urgent flood-relief medicine orders."
  },
  {
    id: "log-02",
    action: "STOCK_ADJUSTMENT",
    module: "INVENTORY",
    performedBy: "Inventory Manager (Shakil)",
    timestamp: "2026-11-01T11:20:00Z",
    details: "Adjusted -2 Boxes of Monas 10mg due to moisture damage during monsoon unloading. Recorded in P&L damage write-off."
  },
  {
    id: "log-03",
    action: "PURCHASE_OCR_VERIFIED",
    module: "PROCUREMENT",
    performedBy: "Accounts Staff (Nayeem)",
    timestamp: "2026-11-01T09:30:00Z",
    details: "Scanned physical delivery invoice from Beximco Pharma (Inv #BEX-788192) via assisted OCR and imported 40 boxes into inventory."
  }
];
