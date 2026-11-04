# CONFIDENCE PHARMA — B2B Healthcare & Business Marketplace

> **Web Admin Business Control Center**  
> Developed for **Confidence Pharma** (Dr. TC Dey)  
> Stack: **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, **TypeScript**, **PostgreSQL**

---

## 📌 Architecture & Design Documentation
- Full Architectural Specification & Schema Plan: [`ADMIN_PANEL_DB_AND_UI_PLAN.md`](./ADMIN_PANEL_DB_AND_UI_PLAN.md)
- Complete PostgreSQL Relational Database Schema: [`lib/db/schema.sql`](./lib/db/schema.sql)
- Complete Realistic Demo Seed Dataset: [`lib/db/mock-data.ts`](./lib/db/mock-data.ts)
- TypeScript Domain Types: [`lib/types/index.ts`](./lib/types/index.ts)

---

## 🚀 Key Modules Implemented

1. **Executive Dashboard (`/`)**:
   - Live KPI cards: Today's Sales, Weighted-Average COGS Net Profit, Inventory Valuation, Customer Dues, Supplier Payables.
   - Real-time recent orders, FEFO near-expiry alerts, zero-result search demand, and cash/MFS account balances.

2. **Catalog & Quantity Pricing (`/catalog`)**:
   - Multi-pack unit conversions (Tablet $\leftrightarrow$ Strip $\leftrightarrow$ Box).
   - Quantity-based wholesale pricing tiers (SRS §7).
   - Up to $X\%$ off promotional calculation (SRS §8).

3. **B2B Customer Directory & KYC Studio (`/customers`)**:
   - Verified business customer categories (Pharmacy, Clinic, Diagnostic Center, etc. - SRS §2).
   - Document inspection (Trade License, Drug License, NID, Store photo - SRS §3).
   - Super Admin audit exception override with mandatory justification logging (SRS §3 & §43).

4. **Order Fulfillment Pipeline (`/orders`)**:
   - Order pipeline: Placed $\rightarrow$ Confirmed $\rightarrow$ Processing $\rightarrow$ Packed $\rightarrow$ Dispatched $\rightarrow$ Delivered.
   - Dual-format print invoicing: Standard A4 Tax Invoice & 80mm POS Thermal Receipt (SRS §36).

5. **Inventory Management (`/inventory/*`)** — UI on mock data (`lib/db/inventory-data.ts`), shared state across tabs:
   - **Overview:** stock value, low/out-of-stock, expiring and blocked stock; product table in pack + base units with expandable FEFO batches.
   - **Batches & expiry:** 30/60/90-day expiry profile (SRS §24), quarantine/release, expired disposal, return to supplier.
   - **Stock movements:** full in/out ledger with filters and CSV export.
   - **Adjustments:** audit-logged adjustments with cost impact; write-offs ≥ ৳10,000 need Super Admin approval (SRS §25).
   - **Stock count:** physical/cycle counts (with blind count), variances posted as adjustments.
   - **Reorder:** low-stock list with suggested quantities, grouped by supplier into draft purchase orders (SRS §21–§22).
   - **Transfers:** multi-warehouse transfers (request → dispatch → receive) with cold-room checks.

6. **Purchases & Assisted OCR (`/purchases`)**:
   - Physical invoice camera/PDF OCR assisted line extraction (SRS §19 & §20).
   - Automatic warehouse stock increment upon save.

7. **Financials & Real-Time P&L (`/accounts`)**:
   - Management accounting: Sales − Weighted Average COGS = Gross Profit.
   - Net Profit = Gross Profit − Operating Expenses − Salaries − Damaged Stock Loss (SRS §30 & §31).
   - Multi-channel liquidity accounts (Cash till, Dutch-Bangla Bank, bKash Merchant, Nagad Business).

8. **Suppliers & Payables (`/suppliers`)**:
   - Beximco, Square, Incepta depot accounts and payable balances.
   - Low-stock automated purchase order sheet generator (SRS §21 & §22).

9. **Customer Search Analytics (`/analytics/searches`)**:
   - Real-time search query tracking.
   - Zero-Result Procurement Intelligence report for unmet market medicine demand (SRS §11 & §41).

10. **Customer Inquiries & Messaging (`/messages`)**:
    - Direct in-app communication for medicine inquiries and prescription slip photos (SRS §16).

11. **Audit Logs & Security (`/settings/audit-logs`)**:
    - Immutable activity tracking for approvals, stock modifications, and financial actions (SRS §42 & §43).

---

## 🔐 Demo sign-in & roles

Open `/login` and pick a role card (any password with 4+ characters works). The role decides which modules appear and which actions are allowed; the profile menu has **Switch demo user** to compare roles quickly.

| Role | Lands on | Can do |
|---|---|---|
| Super Admin | Dashboard | Everything, including roles & permissions |
| Operations Manager | Dashboard | All operations; view users |
| Inventory Manager | Inventory | Catalog, stock, purchases, return inspection |
| Warehouse Staff | Returns | Pack orders, receive and inspect returns |
| Sales Executive | Orders | Create orders, customers, return requests |
| Accountant | Accounts | Cash, dues, expenses, settlements, credit notes |
| Dispatch Coordinator | Delivery | Runs, riders, settlement |
| Delivery Rider | `/rider` (mobile) | Today's run, doorstep outcome, returns, cash |

Roles are editable in **Settings → Roles & permissions** (module × action matrix).

## 🚚 Partial delivery → return to inventory

1. **Dispatch** (`/delivery`): select packed orders → assign rider → stock is issued FEFO and a load sheet is printed.
2. **Rider app** (`/rider`): at the door choose *Delivered in full*, *Partial* (e.g. customer keeps 8 of 10 boxes, picks a reason) or *Failed*. The bill is recalculated live; OTP proof and payment are captured.
3. The refused packs become a **return in rider custody** (`/returns`, "With rider").
4. **Rider settlement** (`/delivery` → Rider settlement): count cash and returned packs; any mismatch is saved as a shortage.
5. **Inspection** (`/returns/[id]`): sellable packs go back to the **original batch** (`DELIVERY_RETURN_IN` in `/inventory/movements`), damaged/expired go to a quarantine batch.
6. A **credit note** is issued and everything is audit-logged.

## 🗂️ State & data

- All data is demo data held in React context: `lib/store/AppStore.tsx` (orders, runs, returns, users, settings…) on top of `components/inventory/InventoryProvider.tsx` (stock). A page reload resets the demo; only the sign-in is remembered.
- Seed data: `lib/db/operations-data.ts`, `lib/db/rbac-data.ts`, `lib/db/catalog-data.ts`, `lib/db/analytics-data.ts` (seeded 190-day history), `lib/db/inventory-data.ts`.
- Target PostgreSQL schema for the real backend: `lib/db/schema.sql` (section 12 covers the new tables).
- Build plan and status: [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md).

---

## 💻 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Admin Business Control Center.

### 3. Build for Production
```bash
npm run build
npm run start
```

