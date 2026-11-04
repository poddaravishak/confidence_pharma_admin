"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CircleAlert,
  CreditCard,
  Minus,
  PackagePlus,
  Plus,
  ShieldAlert,
  Snowflake,
  Store,
  Tag,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Customer, InventoryItem, Order, PaymentChannel, QuantityPricingTier } from "@/lib/types";
import { buildOrderLine, isClosedStatus, orderTotals } from "@/lib/orders";
import { packLabel } from "@/lib/inventory";
import { mockDeliveryZoneRules } from "@/lib/db/mock-data";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { AccessDenied } from "@/components/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader, SearchInput, Switch, btn, inputClass } from "@/components/ui";
import { DELIVERY_TYPE_META, customerTypeLabel, isCreditMethod, methodForChannel, packs as packsText } from "@/components/orders/shared";

type DeliveryType = NonNullable<Order["deliveryType"]>;

interface DraftLine {
  key: string;
  productId: string;
  packs: number;
  manualDiscount: number;
}

const DEFAULT_ZONE = { zoneName: "Default delivery zone", minOrderForFreeDelivery: 5000, standardDeliveryFee: 100, expressDeliveryFee: 250 };
const COLD_CHAIN_SURCHARGE = 50;
const DEFAULT_MAX_DISCOUNT = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

const VERIFICATION_META: Record<Customer["verificationStatus"], { label: string; badge: string }> = {
  APPROVED: { label: "KYC approved", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "KYC pending", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  UNDER_REVIEW: { label: "KYC under review", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  REJECTED: { label: "KYC rejected", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  SUSPENDED: { label: "Suspended", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

/** Why a customer can't order (null when they can). */
function customerBlock(c: Customer): string | null {
  if (c.verificationStatus === "SUSPENDED") return "This account is suspended. Orders are blocked until a manager reactivates it.";
  if (c.verificationStatus === "REJECTED") return "KYC was rejected. The customer must resubmit documents before ordering.";
  if (c.verificationStatus !== "APPROVED" && !c.isExceptionApproval) return "KYC isn't approved yet. Approve the customer in Customers & KYC first.";
  return null;
}

function tierFor(item: InventoryItem, packs: number): QuantityPricingTier | undefined {
  return item.pricingTiers?.find((t) => packs >= t.minQuantity && (t.maxQuantity === null || packs <= t.maxQuantity));
}

/** Tier discount as a % of the pack price (tiers may give a % or only a reduced pack price). */
function tierDiscountPct(item: InventoryItem, t: QuantityPricingTier): number {
  if (t.discountPct > 0) return t.discountPct;
  const packPrice = item.sellingPrice * item.unitsPerPack;
  if (t.unitPrice > 0 && t.unitPrice < packPrice) return round2((1 - t.unitPrice / packPrice) * 100);
  return 0;
}

const isSellable = (i: InventoryItem) => i.isActive && (i.status === undefined || i.status === "ACTIVE");

export default function NewOrderPage() {
  const router = useRouter();
  const { customers, orders, settings, can, createOrder, notify } = useAppStore();
  const { items, itemById, stockByItem } = useInventory();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("STANDARD");
  const [chargeOverride, setChargeOverride] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentChannel>("CASH");
  const [notes, setNotes] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const customer = customers.find((c) => c.id === customerId) ?? null;

  /* ---------- customer picker ---------- */
  const hiddenCustomers = customers.filter((c) => c.verificationStatus !== "APPROVED").length;
  const customerResults = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) => showAllCustomers || c.verificationStatus === "APPROVED")
      .filter(
        (c) =>
          !q ||
          `${c.businessName} ${c.ownerName} ${c.address.upazilaArea}`.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
      )
      .slice(0, 8);
  }, [customers, customerQuery, showAllCustomers]);

  /** Credit tied up in open (undelivered) credit orders, per customer. */
  const openCredit = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) {
      if (isClosedStatus(o.orderStatus) || !isCreditMethod(o.paymentMethod)) continue;
      m[o.customerId] = (m[o.customerId] ?? 0) + o.grandTotal;
    }
    return m;
  }, [orders]);

  const creditInfo = (c: Customer) => {
    const open = openCredit[c.id] ?? 0;
    return { open, available: Math.max(0, c.creditLimit - c.currentDue - open) };
  };

  /* ---------- stock reserved by open, not-yet-dispatched orders (base units) ---------- */
  const reserved = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) {
      if (isClosedStatus(o.orderStatus)) continue;
      for (const l of o.items) {
        if (l.batchAllocations?.length) continue;
        const per = l.unitsPerPack ?? itemById[l.productId]?.unitsPerPack ?? 1;
        m[l.productId] = (m[l.productId] ?? 0) + l.quantity * per;
      }
    }
    return m;
  }, [orders, itemById]);

  const stockPacks = (item: InventoryItem) => {
    const sellable = stockByItem[item.id]?.sellable ?? 0;
    const per = Math.max(1, item.unitsPerPack);
    return {
      sellable: Math.floor(sellable / per),
      free: Math.max(0, Math.floor((sellable - (reserved[item.id] ?? 0)) / per)),
      reserved: Math.ceil((reserved[item.id] ?? 0) / per),
    };
  };

  /* ---------- product search ---------- */
  const productResults = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(isSellable)
      .filter((i) => !customer || !i.visibleTo?.length || i.visibleTo.includes(customer.customerType))
      .filter((i) => `${i.name} ${i.genericName} ${i.brand} ${i.sku}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, productQuery, customer]);

  const addProduct = (item: InventoryItem) => {
    setLines((prev) => {
      const hit = prev.find((l) => l.productId === item.id);
      if (hit) return prev.map((l) => (l.key === hit.key ? { ...l, packs: l.packs + 1 } : l));
      return [...prev, { key: `${item.id}-${Date.now()}`, productId: item.id, packs: Math.max(1, item.minOrderQty ?? 1), manualDiscount: 0 }];
    });
    setProductQuery("");
  };

  const patchLine = (key: string, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  /* ---------- priced lines ---------- */
  const priced = lines
    .filter((l) => itemById[l.productId])
    .map((l) => {
      const item = itemById[l.productId];
      const tier = tierFor(item, l.packs);
      const maxDisc = item.maxDiscountPct ?? DEFAULT_MAX_DISCOUNT;
      const discountPct = tier ? tierDiscountPct(item, tier) : Math.min(Math.max(0, l.manualDiscount || 0), maxDisc);
      const line = buildOrderLine(l.key, item, Math.max(1, Math.floor(l.packs || 0)), discountPct);
      return { draft: l, item, tier, maxDisc, discountPct, line, stock: stockPacks(item) };
    });

  const requiresCold = priced.some((p) => p.item.isColdChain);
  const effectiveType: DeliveryType = requiresCold ? "COLD_CHAIN" : deliveryType;

  /* ---------- delivery charge ---------- */
  const zone =
    (customer &&
      mockDeliveryZoneRules.find(
        (z) => z.isActive && z.areasCovered.some((a) => a.toLowerCase() === customer.address.upazilaArea.toLowerCase())
      )) ||
    DEFAULT_ZONE;
  const goodsNet = round2(priced.reduce((s, p) => s + p.line.lineTotal, 0));
  const defaultCharge =
    effectiveType === "EXPRESS"
      ? zone.expressDeliveryFee
      : effectiveType === "COLD_CHAIN"
        ? zone.standardDeliveryFee + COLD_CHAIN_SURCHARGE
        : goodsNet >= zone.minOrderForFreeDelivery
          ? 0
          : zone.standardDeliveryFee;
  const deliveryCharge = chargeOverride ?? defaultCharge;

  const totals = orderTotals(
    priced.map((p) => p.line),
    deliveryCharge
  );
  const cogs = round2(priced.reduce((s, p) => s + p.line.cogsCost, 0));
  const margin = round2(goodsNet - cogs);
  const marginPct = goodsNet > 0 ? (margin / goodsNet) * 100 : 0;

  /* ---------- payment ---------- */
  const methods = settings.payments.filter((p) => p.enabled);
  const paymentEnabled = methods.some((m) => m.id === payment);
  const isCredit = payment === "CREDIT";
  const credit = customer ? creditInfo(customer) : null;
  const overLimit = Boolean(customer && isCredit && credit && totals.grandTotal > credit.available);
  const noCreditLine = Boolean(customer && isCredit && customer.creditLimit <= 0);

  /* ---------- validation ---------- */
  const errors: string[] = [];
  const warnings: string[] = [];
  const block = customer ? customerBlock(customer) : null;
  if (!customer) errors.push("Choose a customer.");
  else if (block) errors.push(block);
  if (!priced.length) errors.push("Add at least one product.");
  if (!paymentEnabled) errors.push("Choose a payment method.");
  if (noCreditLine) errors.push("This customer has no credit line. Choose cash or mobile payment.");
  else if (overLimit && settings.credit.blockOverLimitOrders)
    errors.push(`Order exceeds available credit by ${formatCurrency(totals.grandTotal - (credit?.available ?? 0))}. Over-limit credit orders are blocked in settings.`);
  else if (overLimit) warnings.push(`Order exceeds available credit by ${formatCurrency(totals.grandTotal - (credit?.available ?? 0))}.`);
  if (deliveryCharge < 0) errors.push("Delivery charge can't be negative.");
  const stockShort = priced.filter((p) => p.line.quantity > p.stock.free);
  if (stockShort.length) warnings.push(`${stockShort.length} ${stockShort.length === 1 ? "line exceeds" : "lines exceed"} free stock and may be short at packing.`);
  if (customer?.isExceptionApproval && customer.verificationStatus !== "APPROVED")
    warnings.push("Customer is ordering under a KYC exception approval.");
  if (customer && !isCredit && customer.currentDue > customer.creditLimit && customer.creditLimit > 0)
    warnings.push(`Customer already owes ${formatCurrency(customer.currentDue)}, above their credit limit. Collect dues on delivery.`);

  const canConfirm = can("orders", "edit");

  const submit = (confirm: boolean) => {
    setTriedSubmit(true);
    if (errors.length || !customer || submitting) return;
    setSubmitting(true);
    const order = createOrder({
      customerId: customer.id,
      lines: priced.map((p) => ({ productId: p.item.id, packs: p.line.quantity, discountPct: p.discountPct })),
      deliveryType: effectiveType,
      deliveryCharge,
      paymentMethod: methodForChannel(payment, settings.credit.defaultTermsDays),
      notes: notes.trim() || undefined,
      confirm,
    });
    notify(`${order.orderNumber} ${confirm ? "placed and confirmed" : "placed"} for ${customer.businessName}.`);
    router.push(`/orders/${order.id}`);
  };

  if (!can("orders", "create")) return <AccessDenied module="orders" />;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <Link href="/orders" className="hover:text-brand-primary hover:underline">
            Orders
          </Link>
        }
        title="New order"
        description="Take a phone or WhatsApp order for an approved customer."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* 1. Customer */}
          <Card>
            <CardHeader title="1. Customer" description="Only KYC-approved customers can order." />
            <div className="p-4 sm:p-5">
              {customer ? (
                <SelectedCustomer
                  customer={customer}
                  credit={creditInfo(customer)}
                  block={block}
                  onChange={() => {
                    setCustomerId(null);
                    setChargeOverride(null);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <SearchInput value={customerQuery} onChange={setCustomerQuery} placeholder="Search by shop, owner, area or phone" />
                  {hiddenCustomers > 0 && (
                    <Switch
                      checked={showAllCustomers}
                      onChange={setShowAllCustomers}
                      label="Show unverified and suspended customers"
                      description={`${hiddenCustomers} hidden. They are shown for reference but can't order.`}
                    />
                  )}
                  {customerResults.length === 0 ? (
                    <EmptyState icon={UserRound} title="No customers found" description="Check the spelling or search by phone number." />
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {customerResults.map((c) => {
                        const ci = creditInfo(c);
                        const blocked = customerBlock(c);
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerId(c.id);
                                setChargeOverride(null);
                                if (c.creditLimit <= 0 && payment === "CREDIT") setPayment("CASH");
                              }}
                              className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-apptext-primary">{c.businessName}</span>
                                  {blocked && <Badge className={VERIFICATION_META[c.verificationStatus].badge}>{VERIFICATION_META[c.verificationStatus].label}</Badge>}
                                </span>
                                <span className="block text-xs text-apptext-secondary">
                                  {customerTypeLabel(c.customerType)} · {c.address.upazilaArea} · <span className="tabular-nums">{c.phone}</span>
                                </span>
                              </span>
                              <span className="shrink-0 text-xs text-apptext-secondary sm:text-right">
                                Available credit
                                <span className="block font-semibold tabular-nums text-apptext-primary">{formatCurrency(ci.available)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* 2. Products */}
          <Card>
            <CardHeader
              title="2. Products"
              description="Prices are per pack. Quantity tiers apply automatically; otherwise a manual discount up to the product's limit."
            />
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <SearchInput value={productQuery} onChange={setProductQuery} placeholder="Search product, generic, brand or SKU" />
                {productQuery.trim() && (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {productResults.length === 0 ? (
                      <li className="px-3 py-4 text-center text-sm text-apptext-secondary">No active product matches “{productQuery}”.</li>
                    ) : (
                      productResults.map((i) => {
                        const st = stockPacks(i);
                        return (
                          <li key={i.id}>
                            <button
                              type="button"
                              onClick={() => addProduct(i)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-surface"
                            >
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-apptext-primary">{i.name}</span>
                                  {i.isColdChain && <Snowflake className="size-3.5 text-sky-600" aria-label="Cold chain" />}
                                </span>
                                <span className="block truncate text-xs text-apptext-secondary">
                                  {i.genericName} · {i.brand} · {packLabel(i)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right text-xs">
                                <span className="block font-semibold tabular-nums text-apptext-primary">
                                  {formatCurrency(round2(i.sellingPrice * i.unitsPerPack))}
                                </span>
                                <span className={cn("tabular-nums", st.free <= 0 ? "text-rose-600" : "text-apptext-secondary")}>
                                  {st.free <= 0 ? "Out of stock" : `${packsText(st.free, i.packUnit)} free`}
                                </span>
                              </span>
                              <Plus className="size-4 shrink-0 text-brand-primary" aria-hidden />
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>

              {priced.length === 0 ? (
                <EmptyState icon={PackagePlus} title="No products yet" description="Search above and tap a product to add it to the order." />
              ) : (
                <ul className="space-y-3">
                  {priced.map((p) => (
                    <LineEditor
                      key={p.draft.key}
                      p={p}
                      onPacks={(n) => patchLine(p.draft.key, { packs: n })}
                      onDiscount={(n) => patchLine(p.draft.key, { manualDiscount: n })}
                      onRemove={() => removeLine(p.draft.key)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* 3. Delivery & payment */}
          <Card>
            <CardHeader title="3. Delivery and payment" />
            <div className="space-y-5 p-4 sm:p-5">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Delivery type</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(DELIVERY_TYPE_META) as DeliveryType[]).map((t) => {
                    const m = DELIVERY_TYPE_META[t];
                    const Icon = m.icon;
                    const disabled = requiresCold && t !== "COLD_CHAIN";
                    const active = effectiveType === t;
                    return (
                      <label
                        key={t}
                        className={cn(
                          "flex cursor-pointer gap-2.5 rounded-xl border p-3 transition",
                          active ? "border-brand-primary bg-brand-light/40 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-surface",
                          disabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <input
                          type="radio"
                          name="delivery-type"
                          className="sr-only"
                          checked={active}
                          disabled={disabled}
                          onChange={() => {
                            setDeliveryType(t);
                            setChargeOverride(null);
                          }}
                        />
                        <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-primary" : "text-slate-400")} aria-hidden />
                        <span>
                          <span className="block text-sm font-medium text-apptext-primary">{m.label}</span>
                          <span className="block text-xs text-apptext-secondary">{m.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {requiresCold && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-800">
                    <Snowflake className="size-3.5" aria-hidden />
                    Cold chain is required because the order has refrigerated items.
                  </p>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Delivery charge (৳)"
                  hint={
                    chargeOverride === null ? (
                      <>
                        {zone.zoneName}:{" "}
                        {effectiveType === "STANDARD"
                          ? `free over ${formatCurrency(zone.minOrderForFreeDelivery)}, else ${formatCurrency(zone.standardDeliveryFee)}`
                          : effectiveType === "EXPRESS"
                            ? `express ${formatCurrency(zone.expressDeliveryFee)}`
                            : `standard ${formatCurrency(zone.standardDeliveryFee)} + ${formatCurrency(COLD_CHAIN_SURCHARGE)} cold box`}
                      </>
                    ) : (
                      <button type="button" className="font-medium text-brand-primary hover:underline" onClick={() => setChargeOverride(null)}>
                        Reset to zone default ({formatCurrency(defaultCharge)})
                      </button>
                    )
                  }
                >
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      min={0}
                      step={10}
                      inputMode="numeric"
                      className={cn(inputClass, "tabular-nums")}
                      value={deliveryCharge}
                      onChange={(e) => setChargeOverride(e.target.value === "" ? 0 : Number(e.target.value))}
                    />
                  )}
                </Field>
                <Field label="Notes for packing and delivery" hint="Printed on the challan.">
                  {(id) => (
                    <textarea
                      id={id}
                      rows={2}
                      className={inputClass}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Call before arrival, long expiry only"
                    />
                  )}
                </Field>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Payment method</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {methods.map((m) => {
                    const creditDisabled = m.id === "CREDIT" && customer !== null && customer.creditLimit <= 0;
                    const active = payment === m.id;
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition",
                          active ? "border-brand-primary bg-brand-light/40 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-surface",
                          creditDisabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <input
                          type="radio"
                          name="payment"
                          className="size-4 border-slate-300 text-brand-primary focus:ring-brand-blue"
                          checked={active}
                          disabled={creditDisabled}
                          onChange={() => setPayment(m.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-apptext-primary">
                            {m.id === "CASH" ? "Cash on delivery" : m.id === "CREDIT" ? `Credit ${settings.credit.defaultTermsDays} days` : m.label}
                          </span>
                          {m.id === "CREDIT" && customer && (
                            <span className="block text-xs tabular-nums text-apptext-secondary">
                              {customer.creditLimit <= 0 ? "No credit line" : `${formatCurrency(creditInfo(customer).available)} available`}
                            </span>
                          )}
                          {m.accountRef && m.id !== "CREDIT" && <span className="block text-xs tabular-nums text-apptext-secondary">{m.accountRef}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </Card>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Order summary" description={customer ? customer.businessName : "No customer selected"} />
            <div className="space-y-3 p-4 sm:p-5">
              <dl className="space-y-1.5 text-sm">
                <SumRow label={`Subtotal (${priced.length} ${priced.length === 1 ? "line" : "lines"})`} value={formatCurrency(totals.subtotal)} />
                <SumRow label="Discount" value={`− ${formatCurrency(totals.discount)}`} tone={totals.discount > 0 ? "text-emerald-700" : undefined} />
                <SumRow label={`Delivery (${DELIVERY_TYPE_META[effectiveType].label.toLowerCase()})`} value={deliveryCharge === 0 ? "Free" : formatCurrency(deliveryCharge)} />
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                  <dt className="font-semibold text-apptext-primary">Grand total</dt>
                  <dd className="text-xl font-bold tabular-nums text-brand-primary">{formatCurrency(totals.grandTotal)}</dd>
                </div>
                <div className="flex justify-between text-xs text-apptext-secondary">
                  <dt>Gross margin on goods</dt>
                  <dd className={cn("tabular-nums font-medium", margin < 0 ? "text-rose-600" : "text-emerald-700")}>
                    {formatCurrency(margin)} · {marginPct.toFixed(1)}%
                  </dd>
                </div>
                <div className="flex justify-between text-xs text-apptext-secondary">
                  <dt>COGS</dt>
                  <dd className="tabular-nums">{formatCurrency(cogs)}</dd>
                </div>
              </dl>

              {customer && isCredit && credit && (
                <div className={cn("rounded-lg px-3 py-2 text-xs", overLimit ? "bg-rose-50 text-rose-800" : "bg-surface text-apptext-secondary")}>
                  <p className="flex items-center gap-1.5 font-medium">
                    <CreditCard className="size-3.5" aria-hidden />
                    Credit check
                  </p>
                  <p className="mt-0.5 tabular-nums">
                    {formatCurrency(totals.grandTotal)} of {formatCurrency(credit.available)} available
                    {overLimit ? " — over limit" : ""}
                  </p>
                </div>
              )}

              {(triedSubmit ? errors : []).length > 0 && (
                <ul role="alert" className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errors.map((e) => (
                    <li key={e} className="flex gap-1.5">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {warnings.map((w) => (
                    <li key={w} className="flex gap-1.5">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2">
                {canConfirm && (
                  <button className={btn.primary} onClick={() => submit(true)} disabled={submitting || (triedSubmit && errors.length > 0)}>
                    <BadgeCheck className="size-4" aria-hidden />
                    Place & confirm
                  </button>
                )}
                <button
                  className={canConfirm ? btn.secondary : btn.primary}
                  onClick={() => submit(false)}
                  disabled={submitting || (triedSubmit && errors.length > 0)}
                >
                  Place order
                </button>
                <Link href="/orders" className={btn.ghost}>
                  Cancel
                </Link>
              </div>
              <p className="text-xs text-apptext-secondary">
                Stock is picked FEFO and issued when the order is dispatched on a delivery run.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SumRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-apptext-secondary">{label}</dt>
      <dd className={cn("tabular-nums text-apptext-primary", tone)}>{value}</dd>
    </div>
  );
}

function SelectedCustomer({
  customer: c,
  credit,
  block,
  onChange,
}: {
  customer: Customer;
  credit: { open: number; available: number };
  block: string | null;
  onChange: () => void;
}) {
  const v = VERIFICATION_META[c.verificationStatus];
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-apptext-primary">{c.businessName}</p>
            <p className="text-xs text-apptext-secondary">
              {customerTypeLabel(c.customerType)} · {c.ownerName} · <span className="tabular-nums">{c.phone}</span>
            </p>
            <p className="text-xs text-apptext-secondary">{c.address.fullAddress}</p>
            <div className="mt-1">
              <Badge className={v.badge}>{v.label}</Badge>
            </div>
          </div>
        </div>
        <button type="button" className={btn.small} onClick={onChange}>
          Change
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Credit limit", formatCurrency(c.creditLimit)],
          ["Current due", formatCurrency(c.currentDue)],
          ["Open credit orders", formatCurrency(credit.open)],
          ["Available credit", formatCurrency(credit.available)],
        ].map(([k, val], i) => (
          <div key={k} className={cn("rounded-lg bg-surface px-3 py-2", i === 3 && "bg-brand-light/50")}>
            <dt className="text-xs text-apptext-secondary">{k}</dt>
            <dd className={cn("text-sm font-semibold tabular-nums", i === 3 ? "text-brand-primary" : "text-apptext-primary")}>{val}</dd>
          </div>
        ))}
      </dl>
      {block && (
        <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {block}
        </p>
      )}
    </div>
  );
}

interface PricedLine {
  draft: DraftLine;
  item: InventoryItem;
  tier?: QuantityPricingTier;
  maxDisc: number;
  discountPct: number;
  line: ReturnType<typeof buildOrderLine>;
  stock: { sellable: number; free: number; reserved: number };
}

function LineEditor({
  p,
  onPacks,
  onDiscount,
  onRemove,
}: {
  p: PricedLine;
  onPacks: (n: number) => void;
  onDiscount: (n: number) => void;
  onRemove: () => void;
}) {
  const { item, line, stock, tier } = p;
  const unit = item.packUnit;
  const overFree = line.quantity > stock.free;
  const overSellable = line.quantity > stock.sellable;
  const belowMin = item.minOrderQty !== undefined && line.quantity < item.minOrderQty;
  const capped = !tier && p.draft.manualDiscount > p.maxDisc;
  const nextTier = item.pricingTiers?.filter((t) => t.minQuantity > line.quantity).sort((a, b) => a.minQuantity - b.minQuantity)[0];

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-apptext-primary">
            {item.name}
            {item.isColdChain && (
              <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                <Snowflake className="size-3" aria-hidden />
                Cold chain
              </Badge>
            )}
            {item.isPrescriptionRequired && <Badge className="border-slate-200 bg-slate-50 text-slate-600">Rx</Badge>}
          </p>
          <p className="text-xs text-apptext-secondary">
            {packLabel(item)} · {formatCurrency(line.unitPrice)} per {unit.toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          className="-m-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-apptext-secondary">Quantity ({unit.toLowerCase()})</span>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Decrease quantity"
              className="rounded-l-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              disabled={line.quantity <= 1}
              onClick={() => onPacks(Math.max(1, line.quantity - 1))}
            >
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              aria-label={`Quantity of ${item.name}`}
              className="w-16 border-y border-slate-200 px-2 py-[7px] text-center text-sm tabular-nums focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              value={p.draft.packs}
              onChange={(e) => onPacks(Math.max(0, Math.floor(Number(e.target.value))))}
              onBlur={() => p.draft.packs < 1 && onPacks(1)}
            />
            <button
              type="button"
              aria-label="Increase quantity"
              className="rounded-r-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              onClick={() => onPacks(line.quantity + 1)}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div>
          {tier ? (
            <>
              <span className="mb-1.5 block text-xs font-medium text-apptext-secondary">Price tier</span>
              <p className="flex items-center gap-1.5 py-2 text-sm text-emerald-700">
                <Tag className="size-3.5" aria-hidden />
                {tier.minQuantity}
                {tier.maxQuantity === null ? "+" : `–${tier.maxQuantity}`} {unit.toLowerCase()}: {p.discountPct}% off
              </p>
            </>
          ) : (
            <Field label={`Discount % (max ${p.maxDisc}%)`} error={capped ? `Capped at ${p.maxDisc}%` : undefined}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  max={p.maxDisc}
                  step={0.5}
                  inputMode="decimal"
                  className={cn(inputClass, "tabular-nums sm:max-w-[8rem]")}
                  value={p.draft.manualDiscount}
                  onChange={(e) => onDiscount(Math.max(0, Number(e.target.value)))}
                />
              )}
            </Field>
          )}
        </div>

        <div className="col-span-2 text-right sm:col-span-1">
          <span className="block text-xs text-apptext-secondary">Line total</span>
          <span className="text-base font-semibold tabular-nums text-apptext-primary">{formatCurrency(line.lineTotal)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={cn("tabular-nums", overSellable ? "text-rose-600" : overFree ? "text-amber-700" : "text-apptext-secondary")}>
          {stock.sellable} {unit.toLowerCase()} sellable
          {stock.reserved > 0 && ` · ${stock.reserved} reserved by open orders`}
        </span>
        {overSellable ? (
          <span className="flex items-center gap-1 font-medium text-rose-600">
            <TriangleAlert className="size-3.5" aria-hidden />
            Only {stock.sellable} in stock
          </span>
        ) : overFree ? (
          <span className="flex items-center gap-1 font-medium text-amber-700">
            <TriangleAlert className="size-3.5" aria-hidden />
            Exceeds free stock ({stock.free})
          </span>
        ) : null}
        {belowMin && <span className="font-medium text-amber-700">Minimum order is {item.minOrderQty}</span>}
        {nextTier && (
          <span className="flex items-center gap-1 text-brand-primary">
            <Tag className="size-3" aria-hidden />
            Order {nextTier.minQuantity} for {tierDiscountPct(item, nextTier)}% off
          </span>
        )}
      </div>
    </li>
  );
}
