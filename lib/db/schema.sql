-- =============================================================================
-- CONFIDENCE PHARMA — B2B Healthcare & Business Marketplace
-- Master Database Schema (PostgreSQL)
-- Architecture: Single-Vendor Core with Multi-Vendor / Multi-Branch Readiness
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. SYSTEM ROLES, PERMISSIONS & ADMINISTRATIVE USERS
-- -----------------------------------------------------------------------------

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name_en VARCHAR(100) NOT NULL,
    display_name_bn VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. EMPLOYEE & PAYROLL MANAGEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    employee_code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    nid_number VARCHAR(50) NOT NULL,
    joining_date DATE NOT NULL,
    basic_salary NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, TERMINATED, RESIGNED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. B2B CUSTOMER (HEALTHCARE ENTITIES) & KYC VERIFICATION
-- -----------------------------------------------------------------------------

CREATE TABLE customer_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_type_id UUID NOT NULL REFERENCES customer_types(id),
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(20),
    email VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    verification_status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, UNDER_REVIEW, APPROVED, REJECTED, SUSPENDED
    rejection_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    is_exception_approval BOOLEAN DEFAULT FALSE,
    exception_reason TEXT,
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    current_due NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- TRADE_LICENSE, DRUG_LICENSE, NID_FRONT, NID_BACK, STORE_FRONT_PHOTO, OWNER_PHOTO
    document_number VARCHAR(100),
    file_url TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title VARCHAR(50) DEFAULT 'Main Store',
    full_address TEXT NOT NULL,
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila_area VARCHAR(100) NOT NULL,
    landmark VARCHAR(255),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    is_default BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. PRODUCT CATALOG, MULTI-PACK CONVERSIONS & QUANTITY PRICING TIERS
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    icon_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(160) UNIQUE NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id),
    subcategory_id UUID REFERENCES subcategories(id),
    brand_id UUID NOT NULL REFERENCES brands(id),
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255),
    generic_name VARCHAR(255) NOT NULL,
    medicine_type VARCHAR(50) NOT NULL, -- Tablet, Capsule, Syrup, Injection, IV, Surgical, Reagent, Equipment
    base_unit VARCHAR(30) NOT NULL, -- Piece, Tablet, Capsule, Bottle, Box
    mrp NUMERIC(10, 2) NOT NULL,
    base_purchase_price NUMERIC(10, 2) NOT NULL,
    base_selling_price NUMERIC(10, 2) NOT NULL,
    max_promotional_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    min_order_qty INT DEFAULT 1,
    is_prescription_required BOOLEAN DEFAULT TRUE,
    is_cold_chain BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_pack_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    pack_name_en VARCHAR(50) NOT NULL,
    pack_name_bn VARCHAR(50) NOT NULL,
    multiplier_to_base NUMERIC(10, 4) NOT NULL, -- 10 for strip of 10, 100 for box of 100
    pack_mrp NUMERIC(10, 2) NOT NULL,
    pack_selling_price NUMERIC(10, 2) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE quantity_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    pack_size_id UUID REFERENCES product_pack_sizes(id) ON DELETE CASCADE,
    min_quantity INT NOT NULL,
    max_quantity INT, -- NULL indicates upper unbound
    unit_price NUMERIC(10, 2) NOT NULL,
    discount_pct NUMERIC(5, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 5. SUPPLIERS, PURCHASES & ASSISTED OCR LOGS
-- -----------------------------------------------------------------------------

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    current_payable NUMERIC(14, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_invoice_no VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    warehouse_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    purchase_date DATE NOT NULL,
    subtotal_cost NUMERIC(14, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    transport_cost NUMERIC(12, 2) DEFAULT 0.00,
    other_costs NUMERIC(12, 2) DEFAULT 0.00,
    grand_total_cost NUMERIC(14, 2) NOT NULL,
    paid_amount NUMERIC(14, 2) DEFAULT 0.00,
    due_amount NUMERIC(14, 2) DEFAULT 0.00,
    payment_status VARCHAR(30) DEFAULT 'UNPAID', -- PAID, PARTIALLY_PAID, UNPAID
    invoice_attachment_url TEXT,
    is_ocr_scanned BOOLEAN DEFAULT FALSE,
    ocr_raw_text TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    pack_size_id UUID REFERENCES product_pack_sizes(id),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_purchased INT NOT NULL,
    unit_purchase_cost NUMERIC(10, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    base_unit_equivalent_qty INT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. INVENTORY BATCHES (FEFO), STOCK MOVEMENTS & ADJUSTMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    purchase_item_id UUID REFERENCES purchase_items(id),
    warehouse_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    batch_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    initial_quantity INT NOT NULL,
    available_quantity INT NOT NULL,
    unit_purchase_cost NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'AVAILABLE', -- AVAILABLE, LOW_STOCK, NEAR_EXPIRY, EXPIRED, DEPLETED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    adjustment_type VARCHAR(30) NOT NULL, -- INCREASE, DECREASE, DAMAGE_WRITEOFF, EXPIRY_DISPOSAL
    quantity_delta INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    cost_impact NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. ORDERS, DISPATCH & INVOICING
-- -----------------------------------------------------------------------------

CREATE TABLE delivery_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(100) NOT NULL,
    zone_division VARCHAR(50),
    zone_district VARCHAR(50),
    min_order_amount_for_free NUMERIC(10, 2) DEFAULT 5000.00,
    base_delivery_fee NUMERIC(10, 2) DEFAULT 100.00,
    express_delivery_fee NUMERIC(10, 2) DEFAULT 200.00,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_address_id UUID NOT NULL REFERENCES customer_addresses(id),
    order_status VARCHAR(30) DEFAULT 'PLACED', -- PLACED, CONFIRMED, PROCESSING, PACKED, DISPATCHED, DELIVERED, CANCELLED, RETURNED, FAILED_DELIVERY
    payment_status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, PAID_COD, PARTIALLY_PAID, DUE
    payment_method VARCHAR(30) DEFAULT 'CASH_ON_DELIVERY',
    subtotal_amount NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    delivery_charge NUMERIC(10, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    due_amount NUMERIC(12, 2) DEFAULT 0.00,
    applied_delivery_rule_id UUID REFERENCES delivery_rules(id),
    notes TEXT,
    assigned_delivery_person_id UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    pack_size_id UUID REFERENCES product_pack_sizes(id),
    batch_id UUID REFERENCES inventory_batches(id),
    quantity INT NOT NULL,
    base_unit_qty INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL,
    unit_cost_for_cogs NUMERIC(10, 2) NOT NULL
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    invoice_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00,
    delivery_charge NUMERIC(10, 2) DEFAULT 0.00,
    total_payable NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL,
    due_amount NUMERIC(12, 2) NOT NULL,
    bin_tax_info VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. SALES TRANSACTIONS, CUSTOMER DUES & RETURNS
-- -----------------------------------------------------------------------------

CREATE TABLE sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    transaction_date DATE NOT NULL,
    gross_sales_amount NUMERIC(14, 2) NOT NULL,
    total_cogs NUMERIC(14, 2) NOT NULL,
    gross_profit NUMERIC(14, 2) NOT NULL,
    net_paid NUMERIC(14, 2) NOT NULL,
    net_due NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_due_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_id UUID REFERENCES orders(id),
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    receipt_voucher_no VARCHAR(100),
    collected_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    return_status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    stock_condition VARCHAR(30), -- RESALABLE, DAMAGED
    refund_or_credit_amount NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    handled_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. FINANCIAL ACCOUNTS, OPERATING EXPENSES & SALARIES
-- -----------------------------------------------------------------------------

CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL, -- CASH, BANK, MFS_BKASH, MFS_NAGAD
    account_number VARCHAR(100),
    bank_name VARCHAR(100),
    branch_name VARCHAR(100),
    current_balance NUMERIC(14, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE account_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_account_id UUID REFERENCES financial_accounts(id),
    to_account_id UUID REFERENCES financial_accounts(id),
    transaction_type VARCHAR(50) NOT NULL, -- CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, EXPENSE_PAYMENT, SALARY_PAYOUT, ACCOUNT_TRANSFER
    amount NUMERIC(14, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_category_id UUID NOT NULL REFERENCES expense_categories(id),
    financial_account_id UUID REFERENCES financial_accounts(id),
    amount NUMERIC(12, 2) NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    receipt_attachment_url TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE salary_disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    financial_account_id UUID REFERENCES financial_accounts(id),
    salary_month INT NOT NULL,
    salary_year INT NOT NULL,
    basic_amount NUMERIC(12, 2) NOT NULL,
    bonus_amount NUMERIC(12, 2) DEFAULT 0.00,
    commission_amount NUMERIC(12, 2) DEFAULT 0.00,
    deduction_amount NUMERIC(12, 2) DEFAULT 0.00,
    advance_adjusted NUMERIC(12, 2) DEFAULT 0.00,
    net_paid_amount NUMERIC(12, 2) NOT NULL,
    disbursement_status VARCHAR(30) DEFAULT 'PAID',
    disbursed_at TIMESTAMPTZ DEFAULT NOW(),
    payslip_number VARCHAR(50) UNIQUE NOT NULL
);

-- -----------------------------------------------------------------------------
-- 10. INTELLIGENCE, SEARCH ANALYTICS, AUDIT LOGS & MESSAGING
-- -----------------------------------------------------------------------------

CREATE TABLE search_analytics_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    query_string VARCHAR(255) NOT NULL,
    normalized_keyword VARCHAR(255) NOT NULL,
    result_count INT NOT NULL,
    is_zero_result BOOLEAN DEFAULT FALSE,
    searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    sender_type VARCHAR(20) NOT NULL, -- CUSTOMER, ADMIN
    sender_user_id UUID REFERENCES users(id),
    message_text TEXT,
    attachment_image_url TEXT,
    inquiry_type VARCHAR(50), -- PRODUCT_QUERY, PRESCRIPTION_SLIP, DAMAGED_PROOF, GENERAL
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    previous_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR SCALE & SPEED
CREATE INDEX idx_products_generic ON products(generic_name);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_inventory_batches_fefo ON inventory_batches(product_id, expiry_date ASC, available_quantity);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_search_zero_result ON search_analytics_logs(is_zero_result, searched_at DESC);

