# Confidence Pharma Admin: Completion Plan & Checklist

> Scope: **UI + demo database only** (mock data, client-side state, no real backend).
> Created 2026-11-05 after an audit of the current codebase. Status updated 2026-11-05: phases 1–8 complete, phase 9 mostly done (open items unticked below).

---

## 0. Audit: what exists vs. what is missing

| Area | Current state | Gap |
|---|---|---|
| Dashboard `/` | KPI cards, recent orders, stock alerts, search intel | **No charts at all**, no date range, no trends, no chart library installed |
| Catalog `/catalog` | List + one basic "add" modal (one pack size, no tiers) | No full product form, no edit, no product detail, no categories/brands/units management |
| Inventory `/inventory/*` | Strong: batches, movements, adjustments, counts, reorder, transfers | No "add product / opening stock" entry; state is scoped to `/inventory` only, so other modules can't change stock |
| Orders `/orders` | Table + status pipeline modal | No create order, no detail page/timeline, no filters, no partial delivery status |
| Delivery `/delivery` | Dispatch board, riders, zone rules, challan, cash reconcile | Delivery is all-or-nothing. **No partial delivery, no delivery returns, no goods reconciliation**, no rider-facing panel |
| Returns | Nothing (`RETURNED` status only) | Whole module missing |
| Settings | Only `/settings/audit-logs` | No company, users, **roles and permissions**, tax/invoice, payment, notification or return-policy settings |
| Access control | Header hard-codes "Super Admin" | **No RBAC**: no roles, no permission checks, every user sees everything |
| Accounts | `/accounts` page | Sidebar links `/accounts/profit-loss`, which **404s** |
| Header | Static | Search, notifications, profile menu and Bangla toggle do nothing |
| Layout | Desktop only | No mobile sidebar drawer, no login screen |
| Data | Two separate mock files (`mock-data.ts`, `inventory-data.ts`) | No single store, so cross-module flows can't work (delivery return → inventory) |

---

## 1. Key flow: partial delivery and return to inventory

Example: a pharmacy orders **10 boxes of Napa 500**. At the door they accept **8**, and **2** come back.

```
Order placed (10 box) ─► Packed (FEFO batch picked: NP-2611, 10 box reserved)
        │
        ▼
Dispatched on rider run (load sheet: 10 box)  ── stock moves "Warehouse → Rider custody"
        │
        ▼
Rider panel at the customer's door
   ├─ Full delivery      → DELIVERED
   ├─ Partial delivery   → accepted 8, returned 2 + reason (damaged / over-ordered /
   │                       wrong item / near-expiry / price dispute) + photo
   │                       invoice recalculated for 8 → collect revised amount
   │                       → PARTIALLY_DELIVERED
   └─ Failed / refused   → FAILED_DELIVERY, all 10 return (RTO)
        │
        ▼
"Returns in transit" (2 box shown in rider custody, cannot be lost silently)
        │
        ▼
End-of-day rider settlement at the warehouse
   ├─ Cash handover:  expected vs received (shortage flagged)
   └─ Goods handover: expected 2 box vs counted
        │
        ▼
Return receiving and inspection (warehouse)
   ├─ Sellable   → restocked to the ORIGINAL batch (movement: DELIVERY_RETURN_IN)
   ├─ Damaged    → quarantine → write-off (approval if ≥ ৳10,000)
   └─ Missing    → shortage case, rider liability / investigation
        │
        ▼
Finance: credit note / invoice adjustment, customer ledger, COGS reversal, audit log
```

Post-delivery returns (the customer sends items back days later) use the same receive → inspect → restock pipeline through an RMA request.

---

## 2. Architecture changes (do first)

- [x] **Unified demo store** `lib/store/` (React context + reducer at the root), merging orders, inventory, riders, returns, users and settings so every module shares one state
- [x] Move the existing `InventoryProvider` up to the root, or merge it into the store (keeping its API)
- [x] **Route groups**: `app/(admin)/…` (sidebar layout) and `app/(rider)/rider/…` (mobile layout, no sidebar). URLs stay the same.
- [x] Add **Recharts** for graphs (the only new dependency)
- [x] Types: `PARTIALLY_DELIVERED` order status, `DELIVERY_RETURN_IN` / `RIDER_CUSTODY` movement types, `DeliveryRun`, `DeliveryReturn`, `CreditNote`, `RiderSettlement`, `Role`, `Permission`, `StaffUser`
- [x] Update `lib/db/schema.sql` with the matching tables (documentation for the future backend)

---

## 3. Phased checklist

### Phase 1: Foundation and access control
- [x] Unified store + route groups (section 2)
- [x] Demo **login screen** `/login` with role cards ("Sign in as Super Admin / Inventory Manager / Rider…")
- [x] **RBAC engine**: `can(module, action)` helper, `<Can>` guard component, "Access denied" page state
- [x] Roles: Super Admin, Admin/Manager, Inventory Manager, Warehouse Staff, Sales/Order Executive, Accountant, Delivery Rider
- [x] Actions per module: view / create / edit / delete / approve / export
- [x] Sidebar filters by permission; buttons are disabled or hidden without permission
- [x] Header: working **profile menu** (switch role for demo, logout), **notifications dropdown**, **global search** (products, orders, customers)
- [ ] Bangla toggle: switches the label only; full Bangla UI strings not yet translated
- [x] Mobile responsive sidebar (drawer + hamburger)
- [x] Fix `/accounts/profit-loss` 404

### Phase 2: Settings
- [x] `/settings` hub with left sub-nav
- [x] **Company profile**: name, logo, trade/drug licence, BIN/TIN, addresses
- [x] **Users and staff**: list, invite/add, assign role, activate/deactivate, reset password (demo), last login
- [x] **Roles and permissions**: role list + **permission matrix** (module × action checkboxes), clone role, custom roles, user count per role
- [x] **Warehouses and locations**: warehouses, racks/bins, cold room
- [x] **Tax and invoice**: VAT %, invoice prefix and numbering, A4/thermal footer text, rounding
- [x] **Payment methods**: Cash, bKash, Nagad, bank, credit terms
- [x] **Delivery settings**: zones and charges (moved/linked from delivery), cut-off times, OTP proof required
- [x] **Return policy**: return reasons, return window (days), auto-restock rules, approval thresholds
- [x] **Notifications**: SMS/WhatsApp/email templates and triggers
- [x] Audit logs (existing page moved under the hub, plus filters and export)

### Phase 3: Executive dashboard and analytics
- [x] Date range picker (Today / 7d / 30d / This month / Custom) driving every widget
- [x] KPI cards with **trend % vs previous period** and sparklines
- [x] **Sales and profit trend** (area chart: revenue, COGS, gross profit)
- [x] **Orders by status** + fulfilment funnel
- [x] **Sales by category** and **top 10 products**
- [x] **Top customers** and **customer dues aging** (0–30 / 31–60 / 61–90 / 90+)
- [x] **Delivery performance**: on-time %, partial-delivery rate, return rate, per-rider leaderboard
- [x] **Inventory health**: stock value trend, expiry buckets, low/out-of-stock count
- [x] **Cash position** across Cash / Bank / bKash / Nagad
- [x] Today's task panel: pending KYC, orders to pack, returns to inspect, approvals waiting
- [x] `/analytics` hub: Sales, Products, Customers, Delivery, Returns, Inventory reports with tables + CSV export

### Phase 4: Catalog and product management
- [x] **Add product, full page** `/catalog/new` (multi-section form with a sticky summary):
  - [x] Basic: name EN/BN, generic, strength, dosage form, brand, category/subcategory, DGDA reg. no., Rx / controlled / cold-chain flags
  - [x] **Units and pack hierarchy**: Tablet → Strip → Box → Carton with multipliers and barcode per pack
  - [x] **Pricing**: purchase cost, MRP, selling price per pack, live margin %, VAT, max discount
  - [x] **Quantity pricing tiers** (add/remove rows, overlap validation)
  - [x] **Inventory**: auto SKU, reorder level, min/max, default warehouse and rack
  - [x] **Opening stock**: batch no., mfg/expiry date, quantity, cost (creates batch + movement)
  - [x] Images (upload preview), visibility per customer type, active toggle
  - [x] Validation, save as draft, "save and add another"
- [x] **Edit product** (same form) and **product detail page** (stock by batch, price history, sales chart, movements)
- [x] Bulk actions: activate/deactivate, CSV import template (demo), export
- [x] Master data pages: **Categories/subcategories**, **Brands/manufacturers**, **Units and dosage forms**
- [x] "Add product" shortcut on the inventory overview

### Phase 5: Orders
- [x] **Create order** (phone/WhatsApp orders): pick customer → add items with pack + tier price → delivery type → payment → credit-limit check
- [x] **Order detail page** `/orders/[id]`: items, FEFO batch allocation, timeline, payments, delivery proof, returns, invoice
- [x] Filters (status, payment, date, customer), search, bulk confirm/print
- [x] Partial status display + "delivered 8 / 10" line progress
- [x] Cancel order with reason (releases reserved stock)

### Phase 6: Delivery and rider panel
- [x] **Admin delivery board** upgrades:
  - [x] Delivery runs (assign several orders to a rider → load sheet)
  - [x] Live run status per rider (stops done / pending)
  - [x] **Returns in transit** tab (goods in rider custody)
  - [x] **Rider settlement**: cash expected vs received **and** goods expected vs received, shortage handling
- [x] **Rider panel** `/rider` (mobile-first, rider role only):
  - [x] Today's run: stops, total to collect, route order
  - [x] Pickup verification: tick each line as loaded
  - [x] Stop detail: call/WhatsApp customer, map link, items, amount
  - [x] **Deliver**: Full / **Partial** (accepted vs returned qty per line + reason + photo) / Failed (reason)
  - [x] Revised bill shown live, payment capture (Cash / bKash / Nagad / Due on credit)
  - [x] Proof: customer OTP / signature pad / photo
  - [x] My returns in custody, my cash in hand
  - [x] End-of-day handover summary
  - [x] Rider profile and earnings/history

### Phase 7: Returns management
- [x] `/returns` hub with tabs: **Delivery returns**, **Customer returns (RMA)**, **Supplier returns**
- [x] Return receiving screen: scan/count, compare against expected, condition per line
- [x] Inspection outcome per line: **Restock to original batch** / Quarantine / Write-off
- [x] Restock creates an inventory movement (visible in `/inventory/movements`) and updates batch qty
- [x] Credit note generation (printable), customer ledger adjustment, COGS reversal
- [x] RMA flow: request → approve/reject → pickup → receive → refund/credit
- [x] Return reasons analytics (by product, customer, rider)
- [x] Every step audit-logged

### Phase 8: Finance touch-ups
- [x] `/accounts/profit-loss` page with period P&L, charts
- [x] Customer dues and collections page (receive payment, aging)
- [x] Expenses entry (categories, attachments) + salary list (demo)

### Phase 9: Polish and QA
- [x] Consistent empty and error states
- [ ] Loading skeletons (not needed while data is in-memory; add with the real API)
- [x] Toasts and confirm dialogs everywhere destructive
- [x] `aria-label` on icon buttons, Escape closes modals
- [ ] Focus traps in modals
- [x] Mobile pass on every page
- [x] `tsc --noEmit`, `next build` and `eslint` clean
- [x] Click-through test of the full 10 → 8 + 2 return flow end-to-end
- [x] Update README
- [ ] Update DESIGN.md (chart palette notes)

---

## 4. Demo data to add
- [x] 7 roles with permission sets, ~12 staff users (incl. 4 riders)
- [x] 90 days of daily sales and order history (for charts)
- [x] Orders in every status, incl. **one 10-box Napa order** ready for partial delivery
- [x] 2 active delivery runs, 3 historic partial deliveries, 1 failed delivery
- [x] 4 delivery returns (pending receipt / inspected / restocked / write-off) and 3 RMAs
- [x] Categories (≈8) with subcategories, brands (≈10), units/dosage forms
- [x] Company settings, tax, invoice and return-policy defaults
- [x] Notifications feed (≈15 items)

---

## 5. Suggested build order
1 → 2 → 6 + 7 (core return flow) → 4 → 3 → 5 → 8 → 9
