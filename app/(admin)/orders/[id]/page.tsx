"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Ban,
  Bike,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  PackageMinus,
  PackageX,
  Phone,
  Printer,
  RotateCcw,
  SearchX,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { Order, OrderItem, ReturnRecord, StockBatch } from "@/lib/types";
import { ORDER_STATUS_META, PAYMENT_CHANNEL_LABEL, RETURN_SOURCE_META, RETURN_STATUS_META, acceptedQty, isClosedStatus } from "@/lib/orders";
import { formatDateTime, formatDay } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, btn } from "@/components/ui";
import {
  DELIVERY_TYPE_META,
  NEXT_STEP,
  PRE_DISPATCH,
  DeliveryTypeTag,
  OrderStatusBadge,
  PaymentStatusBadge,
  billedLineTotal,
  customerTypeLabel,
  deliveryLineText,
  packUnitOf,
  paymentMethodLabel,
  returnedSummary,
} from "@/components/orders/shared";
import { OrderStepper, OrderTimeline } from "@/components/orders/OrderProgress";
import { OrderPrintModal, PrintKind, challanNumber } from "@/components/orders/PrintDocuments";
import { CancelOrderModal, RmaModal } from "@/components/orders/OrderModals";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const { orderById, customers, returns, creditNotes, riderById, runs, settings, can, advanceOrder, notify } = useAppStore();
  const { batchById, allocateFefo } = useInventory();

  const [print, setPrint] = useState<PrintKind | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rmaOpen, setRmaOpen] = useState(false);
  const [createdRma, setCreatedRma] = useState<ReturnRecord | null>(null);

  const order = orderById[id];

  if (!order) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={SearchX}
          title="Order not found"
          description={`There is no order with the id “${id}”. It may have been created in another session; the demo resets on reload.`}
          action={
            <Link href="/orders" className={btn.primary}>
              Back to orders
            </Link>
          }
        />
      </Card>
    );
  }

  const o = order;
  const s = o.orderStatus;
  const customer = customers.find((c) => c.id === o.customerId);
  const rider = o.assignedRider ? riderById[o.assignedRider.id] ?? o.assignedRider : undefined;
  const run = o.runId ? runs.find((r) => r.id === o.runId) : undefined;
  const orderReturns = returns.filter((r) => r.orderId === o.id);
  const orderCredits = creditNotes.filter((c) => c.orderId === o.id);

  const canEdit = can("orders", "edit");
  const next = NEXT_STEP[s];
  const canCancel = canEdit && PRE_DISPATCH.includes(s);
  const canRma = (s === "DELIVERED" || s === "PARTIALLY_DELIVERED") && can("returns", "create");
  const showChallan = !["PLACED", "CONFIRMED", "CANCELLED"].includes(s);
  const inTransit = s === "DISPATCHED" || s === "OUT_FOR_DELIVERY";

  /* billed figures (after a partial delivery the bill covers accepted packs only) */
  const billedGross = round2(o.items.reduce((sum, l) => sum + l.unitPrice * acceptedQty(l), 0));
  const billedNet = round2(o.items.reduce((sum, l) => sum + billedLineTotal(l), 0));
  const billedDelivery = s === "FAILED_DELIVERY" ? 0 : o.deliveryCharge;
  const revised = o.originalGrandTotal !== undefined;
  const returned = returnedSummary(o.items);
  const totalReturned = o.items.reduce((n, l) => n + (l.returnedQuantity ?? 0), 0);

  const advance = () => {
    if (!next) return;
    advanceOrder(o.id, next.to);
    notify(`${o.orderNumber} moved to ${ORDER_STATUS_META[next.to].label.toLowerCase()}.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <Link href="/orders" className="hover:text-brand-primary hover:underline">
            Orders
          </Link>
        }
        title={o.orderNumber}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <OrderStatusBadge status={s} />
            <PaymentStatusBadge status={o.paymentStatus} />
            <DeliveryTypeTag type={o.deliveryType} />
            <span>
              {o.customerName} · created {o.createdBy ? `by ${o.createdBy} ` : ""}
              <time className="tabular-nums" dateTime={o.createdAt}>
                {formatDateTime(o.createdAt)}
              </time>
            </span>
          </span>
        }
        actions={
          <>
            {canEdit && next && (
              <button className={btn.primary} onClick={advance}>
                {next.label}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
            {s === "PACKED" && (
              <Link href="/delivery" className={btn.primary}>
                <Truck className="size-4" aria-hidden />
                Go to delivery board
              </Link>
            )}
            {inTransit && (
              <Link href="/delivery" className={btn.secondary}>
                <Truck className="size-4" aria-hidden />
                Track on delivery board
              </Link>
            )}
            {canRma && (
              <button className={btn.secondary} onClick={() => setRmaOpen(true)}>
                <RotateCcw className="size-4" aria-hidden />
                Create return (RMA)
              </button>
            )}
            <button className={btn.secondary} onClick={() => setPrint(settings.invoice.defaultFormat === "THERMAL_80MM" ? "THERMAL" : "A4")}>
              <Printer className="size-4" aria-hidden />
              Print invoice
            </button>
            {showChallan && (
              <button className={btn.secondary} onClick={() => setPrint("CHALLAN")}>
                <FileText className="size-4" aria-hidden />
                Print challan
              </button>
            )}
            {canCancel && (
              <button className={cn(btn.secondary, "text-rose-700 hover:bg-rose-50")} onClick={() => setCancelOpen(true)}>
                <Ban className="size-4" aria-hidden />
                Cancel
              </button>
            )}
          </>
        }
      />

      {createdRma && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {createdRma.returnNumber} {createdRma.status === "APPROVED" ? "created and approved. Schedule a pickup." : "submitted for approval."}
          </span>
          <Link href={`/returns/${createdRma.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            Open {createdRma.returnNumber}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {s === "CANCELLED" && (
        <Banner tone="slate" icon={Ban} title="Order cancelled">
          {o.cancelReason ?? "No reason recorded."}
        </Banner>
      )}
      {s === "FAILED_DELIVERY" && (
        <Banner tone="rose" icon={PackageX} title="Delivery failed — all goods returning">
          {o.failureReason ?? "No reason recorded."} {orderReturns.length > 0 && "The return is tracked below."}
        </Banner>
      )}
      {s === "PARTIALLY_DELIVERED" && (
        <Banner tone="teal" icon={PackageMinus} title={`Partially delivered — ${returned} came back`}>
          The bill was revised at the door from {formatCurrency(o.originalGrandTotal ?? o.grandTotal)} to {formatCurrency(o.grandTotal)}. Returned packs go
          through receiving and inspection in Returns.
        </Banner>
      )}

      <Card className="p-4 sm:p-5">
        <OrderStepper order={o} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader
              title="Items"
              description={
                <>
                  <span className="tabular-nums">{o.items.length}</span> {o.items.length === 1 ? "line" : "lines"}
                  {totalReturned > 0 && ` · ${returned} returned`}
                </>
              }
            />
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="py-2.5 pl-5 pr-3 font-medium">Product</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2.5 font-medium">Delivery</th>
                    <th className="px-3 py-2.5 text-right font-medium">Unit price</th>
                    <th className="px-3 py-2.5 text-right font-medium">Disc.</th>
                    <th className="py-2.5 pl-3 pr-5 text-right font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {o.items.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 pl-5 pr-3">
                        <p className="font-medium text-apptext-primary">{l.productName}</p>
                        <p className="text-xs text-apptext-secondary">{l.packSizeName}</p>
                        <Batches line={l} order={o} batchById={batchById} allocateFefo={allocateFefo} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-3">
                        <DeliveryCell line={l} status={s} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.discountPct ? `${l.discountPct}%` : "—"}</td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <LineTotal line={l} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {o.items.map((l) => (
                <li key={l.id} className="space-y-2 px-4 py-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-apptext-primary">{l.productName}</p>
                      <p className="text-xs text-apptext-secondary">
                        {l.packSizeName} · <span className="tabular-nums">{l.quantity}</span> × {formatCurrency(l.unitPrice)}
                        {l.discountPct ? ` − ${l.discountPct}%` : ""}
                      </p>
                    </div>
                    <LineTotal line={l} />
                  </div>
                  <DeliveryCell line={l} status={s} />
                  <Batches line={l} order={o} batchById={batchById} allocateFefo={allocateFefo} />
                </li>
              ))}
            </ul>
          </Card>

          {/* Billing & payment */}
          <Card>
            <CardHeader title="Billing and payment" description={paymentMethodLabel(o.paymentMethod)} />
            <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
              <dl className="space-y-1.5 text-sm">
                <Row label={revised ? "Subtotal (delivered)" : "Subtotal"} value={formatCurrency(billedGross)} />
                <Row label="Discount" value={`− ${formatCurrency(round2(billedGross - billedNet))}`} />
                <Row label={`Delivery (${DELIVERY_TYPE_META[o.deliveryType ?? "STANDARD"].label.toLowerCase()})`} value={billedDelivery === 0 ? "Free" : formatCurrency(billedDelivery)} />
                {revised && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-apptext-secondary">
                    <dt>Original total</dt>
                    <dd className="tabular-nums line-through">{formatCurrency(o.originalGrandTotal!)}</dd>
                  </div>
                )}
                <div className={cn("flex items-baseline justify-between pt-1.5", !revised && "border-t border-slate-200")}>
                  <dt className="font-semibold text-apptext-primary">{revised ? "Revised total" : "Grand total"}</dt>
                  <dd className="text-lg font-bold tabular-nums text-brand-primary">{formatCurrency(o.grandTotal)}</dd>
                </div>
                {revised && (
                  <p className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs text-teal-800">
                    Revised at delivery: {returned || "quantities changed"} returned
                    {o.originalGrandTotal !== undefined && ` (− ${formatCurrency(round2(o.originalGrandTotal - o.grandTotal))})`}.
                  </p>
                )}
                <Row label="Paid" value={formatCurrency(o.paidAmount)} tone="text-emerald-700" />
                <div className="flex items-center justify-between">
                  <dt className="text-apptext-secondary">Due</dt>
                  <dd className="flex items-center gap-2">
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <span className={cn("font-semibold tabular-nums", o.dueAmount > 0 ? "text-rose-700" : "text-apptext-primary")}>{formatCurrency(o.dueAmount)}</span>
                  </dd>
                </div>
                {o.dueAmount > 0 && (o.orderStatus === "DELIVERED" || o.orderStatus === "PARTIALLY_DELIVERED") && can("accounts", "create") && (
                  <Link href="/accounts/receivables" className={cn(btn.small, "w-full")}>
                    Collect payment <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </dl>

              <div className="text-sm">
                <p className="mb-2 font-medium text-apptext-primary">Proof of delivery</p>
                {o.deliveryProof ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-surface p-3 text-xs">
                    <dt className="text-apptext-secondary">Method</dt>
                    <dd className="font-medium">{o.deliveryProof.method === "OTP" ? "Customer OTP" : o.deliveryProof.method === "SIGNATURE" ? "Signature" : "Photo"}</dd>
                    <dt className="text-apptext-secondary">Received by</dt>
                    <dd className="font-medium">{o.deliveryProof.receivedBy}</dd>
                    {o.deliveryProof.otp && (
                      <>
                        <dt className="text-apptext-secondary">OTP</dt>
                        <dd className="font-mono font-medium">{o.deliveryProof.otp}</dd>
                      </>
                    )}
                    {o.deliveryProof.photoCount ? (
                      <>
                        <dt className="text-apptext-secondary">Photos</dt>
                        <dd className="tabular-nums">{o.deliveryProof.photoCount}</dd>
                      </>
                    ) : null}
                    <dt className="text-apptext-secondary">Collected</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(o.deliveryProof.amountCollected)}</dd>
                    <dt className="text-apptext-secondary">Channel</dt>
                    <dd>{PAYMENT_CHANNEL_LABEL[o.deliveryProof.paymentMethod]}</dd>
                    <dt className="text-apptext-secondary">Captured</dt>
                    <dd className="tabular-nums">{formatDateTime(o.deliveryProof.capturedAt)}</dd>
                  </dl>
                ) : (
                  <p className="rounded-lg bg-surface p-3 text-xs text-apptext-secondary">
                    {s === "FAILED_DELIVERY"
                      ? "No proof: the delivery failed."
                      : s === "CANCELLED"
                        ? "Not applicable: the order was cancelled."
                        : o.deliveredAt
                          ? `Delivered ${formatDateTime(o.deliveredAt)}. No proof was captured.`
                          : "Captured by the rider at the door (OTP, signature or photo)."}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" description="Newest first" />
            <OrderTimeline events={o.timeline ?? []} />
          </Card>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-3 p-4 text-sm sm:p-5">
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
                  <Store className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-apptext-primary">{o.customerName}</p>
                  <p className="text-xs text-apptext-secondary">
                    {customerTypeLabel(o.customerType)}
                    {customer?.ownerName ? ` · ${customer.ownerName}` : ""}
                  </p>
                </div>
              </div>
              <p className="flex gap-2 text-apptext-primary">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
                <span>
                  {o.address}
                  {o.landmark && <span className="block text-xs text-apptext-secondary">Landmark: {o.landmark}</span>}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={`tel:${o.phone}`} className={btn.small}>
                  <Phone className="size-3.5" aria-hidden />
                  <span className="tabular-nums">{o.phone}</span>
                </a>
                {customer?.whatsappNumber && (
                  <a href={`https://wa.me/${customer.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={btn.small}>
                    <MessageCircle className="size-3.5" aria-hidden />
                    WhatsApp
                  </a>
                )}
                <a
                  href={
                    o.latitude && o.longitude
                      ? `https://www.google.com/maps?q=${o.latitude},${o.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={btn.small}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Map
                </a>
              </div>
              {customer && (
                <dl className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <dt className="text-apptext-secondary">Credit limit</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(customer.creditLimit)}</dd>
                  </div>
                  <div>
                    <dt className="text-apptext-secondary">Current due</dt>
                    <dd className={cn("font-semibold tabular-nums", customer.currentDue > 0 && "text-rose-700")}>{formatCurrency(customer.currentDue)}</dd>
                  </div>
                </dl>
              )}
              {o.notes && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Note: {o.notes}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <div className="space-y-3 p-4 text-sm sm:p-5">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-apptext-secondary">Type</dt>
                  <dd className="font-medium">{DELIVERY_TYPE_META[o.deliveryType ?? "STANDARD"].label}</dd>
                </div>
                <div>
                  <dt className="text-apptext-secondary">Charge</dt>
                  <dd className="font-medium tabular-nums">{o.deliveryCharge ? formatCurrency(o.deliveryCharge) : "Free"}</dd>
                </div>
                {o.deliveryRuleName && (
                  <div className="col-span-2">
                    <dt className="text-apptext-secondary">Zone</dt>
                    <dd>{o.deliveryRuleName}</dd>
                  </div>
                )}
                {showChallan && (
                  <div>
                    <dt className="text-apptext-secondary">Challan</dt>
                    <dd className="font-mono">{challanNumber(o, settings)}</dd>
                  </div>
                )}
                {o.dispatchedAt && (
                  <div>
                    <dt className="text-apptext-secondary">Dispatched</dt>
                    <dd className="tabular-nums">{formatDateTime(o.dispatchedAt)}</dd>
                  </div>
                )}
                {o.deliveredAt && (
                  <div>
                    <dt className="text-apptext-secondary">Delivered</dt>
                    <dd className="tabular-nums">{formatDateTime(o.deliveredAt)}</dd>
                  </div>
                )}
              </dl>
              {rider ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex min-w-0 gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-brand-primary">
                      <Bike className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-apptext-primary">{rider.name}</p>
                      <p className="text-xs text-apptext-secondary">
                        {rider.employeeCode} · {rider.vehicleType.toLowerCase()} {rider.vehiclePlateNo}
                      </p>
                      {run && (
                        <p className="text-xs text-apptext-secondary">
                          Run <span className="font-mono">{run.runNumber}</span> · {run.status.toLowerCase().replace("_", " ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <a href={`tel:${rider.phone}`} className={btn.small} aria-label={`Call ${rider.name}`}>
                    <Phone className="size-3.5" aria-hidden />
                  </a>
                </div>
              ) : (
                <p className="rounded-lg bg-surface px-3 py-2 text-xs text-apptext-secondary">
                  {isClosedStatus(s) ? "No rider was assigned." : "A rider is assigned when the order goes out on a delivery run."}{" "}
                  {s === "PACKED" && (
                    <Link href="/delivery" className="font-medium text-brand-primary hover:underline">
                      Assign on the delivery board
                    </Link>
                  )}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Returns and credit notes" />
            {orderReturns.length === 0 && orderCredits.length === 0 ? (
              <p className="px-4 py-4 text-sm text-apptext-secondary sm:px-5">No returns on this order.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orderReturns.map((r) => (
                  <li key={r.id}>
                    <Link href={`/returns/${r.id}`} className="block px-4 py-3 transition hover:bg-surface sm:px-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-brand-primary">{r.returnNumber}</span>
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.totalValue)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge className={RETURN_SOURCE_META[r.source].badge}>{RETURN_SOURCE_META[r.source].label}</Badge>
                        <Badge className={RETURN_STATUS_META[r.status].badge}>{RETURN_STATUS_META[r.status].label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-apptext-secondary">
                        {r.lines.map((l) => `${l.quantity} × ${l.productName}`).join(", ")} · {formatDay(r.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
                {orderCredits.map((c) => (
                  <li key={c.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-apptext-primary">{c.creditNoteNumber}</span>
                      <span className="text-sm font-semibold tabular-nums text-emerald-700">− {formatCurrency(c.amount)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Credit note · {c.status.toLowerCase()}</Badge>
                      <Link href={`/returns/${c.returnId}`} className="text-xs font-medium text-brand-primary hover:underline">
                        View return
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-apptext-secondary">{c.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {print && <OrderPrintModal order={o} initial={print} onClose={() => setPrint(null)} />}
      {cancelOpen && <CancelOrderModal order={o} onClose={() => setCancelOpen(false)} />}
      {rmaOpen && <RmaModal order={o} onClose={() => setRmaOpen(false)} onCreated={setCreatedRma} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-apptext-secondary">{label}</dt>
      <dd className={cn("tabular-nums text-apptext-primary", tone)}>{value}</dd>
    </div>
  );
}

const BANNER_TONE = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
};

function Banner({ tone, icon: Icon, title, children }: { tone: keyof typeof BANNER_TONE; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", BANNER_TONE[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-pretty">{children}</p>
      </div>
    </div>
  );
}

function LineTotal({ line }: { line: OrderItem }) {
  const billed = billedLineTotal(line);
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(billed)}</p>
      {billed !== line.lineTotal && <p className="text-xs tabular-nums text-apptext-secondary line-through">{formatCurrency(line.lineTotal)}</p>}
    </div>
  );
}

function DeliveryCell({ line, status }: { line: OrderItem; status: Order["orderStatus"] }) {
  const text = deliveryLineText(line);
  if (!text) {
    return <span className="text-xs text-apptext-secondary">{status === "CANCELLED" ? "Cancelled" : "Not delivered yet"}</span>;
  }
  const delivered = line.deliveredQuantity ?? 0;
  const pct = line.quantity > 0 ? (delivered / line.quantity) * 100 : 0;
  const hasReturn = (line.returnedQuantity ?? 0) > 0;
  const [main, ...rest] = text.split(" · ");
  return (
    <div className="min-w-[10rem]">
      <p className={cn("text-xs font-medium tabular-nums", delivered === 0 ? "text-rose-700" : hasReturn ? "text-teal-700" : "text-emerald-700")}>{main}</p>
      <div className="mt-1 h-1.5 w-full max-w-[9rem] overflow-hidden rounded-full bg-rose-100" aria-hidden>
        <div className={cn("h-full rounded-full", hasReturn ? "bg-teal-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      {rest.length > 0 && <p className="mt-1 text-xs text-apptext-secondary">{rest.join(" · ")}</p>}
    </div>
  );
}

function Batches({
  line,
  order,
  batchById,
  allocateFefo,
}: {
  line: OrderItem;
  order: Order;
  batchById: Record<string, StockBatch>;
  allocateFefo: (itemId: string, baseQty: number) => { batchId: string; quantity: number }[];
}) {
  const per = Math.max(1, line.unitsPerPack ?? 1);
  const unit = packUnitOf(line);
  const preview = !line.batchAllocations?.length && ["CONFIRMED", "PROCESSING", "PACKED"].includes(order.orderStatus);
  const allocs = line.batchAllocations?.length ? line.batchAllocations : preview ? allocateFefo(line.productId, line.quantity * per) : [];
  if (!allocs.length) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[11px] font-medium text-apptext-secondary">{preview ? "FEFO pick preview" : "FEFO batches"}</p>
      <ul className="mt-0.5 flex flex-wrap gap-1">
        {allocs.map((a) => {
          const b = batchById[a.batchId];
          const qty = a.quantity % per === 0 ? `${a.quantity / per} ${unit.toLowerCase()}` : `${a.quantity} units`;
          return (
            <li key={a.batchId} className={cn("rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", preview ? "border-dashed border-slate-300 text-slate-500" : "border-slate-200 bg-surface text-slate-600")}>
              <span className="font-mono font-medium">{b?.batchNumber ?? a.batchId}</span>
              {b && ` · exp ${formatDay(b.expiryDate)}`} · {qty}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

