"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle, Navigation, PackageX, Phone, RotateCcw, Snowflake, StickyNote, XCircle } from "lucide-react";
import { ReturnRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { amountToCollect, isClosedStatus, netPackPrice, ORDER_STATUS_META, PAYMENT_CHANNEL_LABEL, RETURN_REASON_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn } from "@/components/ui";
import { mapsUrl, whatsappUrl } from "@/components/delivery/shared";
import { DeliveryOutcomeForm, OutcomeKind } from "@/components/delivery/DeliveryOutcomeForm";
import { useRider } from "@/components/rider/RiderShell";

export default function RiderStopPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const rider = useRider();
  const { orderById, runs } = useAppStore();
  const order = orderById[orderId];
  const [mode, setMode] = useState<OutcomeKind | null>(null);
  const [result, setResult] = useState<{ ret: ReturnRecord | null; kind: OutcomeKind } | null>(null);

  if (!order || order.assignedRider?.id !== rider.id) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center">
        <p className="font-semibold text-apptext-primary">This stop isn&apos;t on your run.</p>
        <Link href="/rider" className="mt-2 inline-block text-sm font-medium text-brand-primary underline">
          Back to today
        </Link>
      </div>
    );
  }

  const run = runs.find((r) => r.id === order.runId);
  const closed = isClosedStatus(order.orderStatus);
  const canRecord = !closed && run?.status === "IN_PROGRESS";

  /* ---------- success screen ---------- */
  if (result) {
    const tone = result.kind === "FULL" ? "emerald" : result.kind === "PARTIAL" ? "teal" : "rose";
    return (
      <div className="space-y-4">
        <div className={cn("rounded-2xl p-6 text-center", tone === "emerald" ? "bg-emerald-50" : tone === "teal" ? "bg-teal-50" : "bg-rose-50")}>
          {result.kind === "FAILED" ? <XCircle className="mx-auto size-12 text-rose-500" aria-hidden /> : <CheckCircle2 className={cn("mx-auto size-12", tone === "emerald" ? "text-emerald-500" : "text-teal-500")} aria-hidden />}
          <p className="mt-2 text-lg font-bold text-apptext-primary">
            {result.kind === "FULL" ? "Delivered" : result.kind === "PARTIAL" ? "Partial delivery saved" : "Delivery marked failed"}
          </p>
          <p className="text-sm text-apptext-secondary">{order.customerName}</p>
          {order.deliveryProof && order.deliveryProof.amountCollected > 0 && (
            <p className="mt-3 text-2xl font-bold tabular-nums text-apptext-primary">
              {formatCurrency(order.deliveryProof.amountCollected)}
              <span className="ml-1 text-sm font-medium text-apptext-secondary">{PAYMENT_CHANNEL_LABEL[order.deliveryProof.paymentMethod]}</span>
            </p>
          )}
        </div>
        {result.ret && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <PackageX className="size-5" aria-hidden /> Keep these with you
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {result.ret.lines.map((l) => (
                <li key={l.orderItemId}>
                  <span className="font-semibold tabular-nums">{l.quantity}</span> × {l.productName} · {RETURN_REASON_META[l.reason].label}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Return <span className="font-mono">{result.ret.returnNumber}</span>. Hand these to the store keeper at settlement.
            </p>
          </div>
        )}
        <Link href="/rider" className={cn(btn.primary, "w-full py-3 text-base")}>
          Next stop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/rider" className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary">
        <ArrowLeft className="size-4" aria-hidden /> Today&apos;s run
      </Link>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-apptext-secondary">{order.orderNumber}</p>
            <h1 className="text-lg font-bold text-apptext-primary">{order.customerName}</h1>
          </div>
          <Badge className={ORDER_STATUS_META[order.orderStatus].badge}>{ORDER_STATUS_META[order.orderStatus].label}</Badge>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-apptext-secondary">
          <MapPin className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
          <span>
            {order.address}
            {order.landmark && <span className="block text-xs">Landmark: {order.landmark}</span>}
          </span>
        </p>
        {order.notes && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
            <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden /> {order.notes}
          </p>
        )}
        {order.deliveryType === "COLD_CHAIN" && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sky-50 p-2.5 text-sm text-sky-800">
            <Snowflake className="size-4" aria-hidden /> Cold chain. Check the ice packs before handing over.
          </p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`tel:${order.phone}`} className={cn(btn.secondary, "flex-col gap-1 py-2.5 text-xs")}>
            <Phone className="size-5 text-brand-blue" aria-hidden /> Call
          </a>
          <a href={whatsappUrl(order.phone, `Assalamu alaikum, I'm ${rider.name} from Confidence Pharma with order ${order.orderNumber}.`)} target="_blank" rel="noreferrer" className={cn(btn.secondary, "flex-col gap-1 py-2.5 text-xs")}>
            <MessageCircle className="size-5 text-emerald-600" aria-hidden /> WhatsApp
          </a>
          <a href={mapsUrl(order)} target="_blank" rel="noreferrer" className={cn(btn.secondary, "flex-col gap-1 py-2.5 text-xs")}>
            <Navigation className="size-5 text-brand-blue" aria-hidden /> Map
          </a>
        </div>
      </section>

      {!mode && (
        <>
          <section className="rounded-2xl bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-apptext-primary">Items ({order.items.length})</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-apptext-primary">{l.productName}</span>
                    <span className="block text-xs text-apptext-secondary">
                      {l.packSizeName} · {formatCurrency(netPackPrice(l))}
                    </span>
                    {(l.returnedQuantity ?? 0) > 0 && (
                      <span className="block text-xs text-teal-700">
                        {l.deliveredQuantity} delivered · {l.returnedQuantity} returned ({RETURN_REASON_META[l.returnReason ?? "OTHER"].label})
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-apptext-primary">× {l.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-sm text-apptext-secondary">{closed ? "Billed" : order.paymentMethod.includes("CREDIT") ? "On credit · nothing to collect" : "Collect"}</span>
              <span className="text-2xl font-bold tabular-nums text-apptext-primary">{formatCurrency(closed ? order.grandTotal : amountToCollect(order))}</span>
            </div>
          </section>

          {canRecord ? (
            <div className="space-y-2">
              <button onClick={() => setMode("FULL")} className={cn(btn.success, "w-full py-3.5 text-base")}>
                <CheckCircle2 className="size-5" aria-hidden /> Delivered in full
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode("PARTIAL")} className={cn(btn.secondary, "border-teal-300 py-3.5 text-base text-teal-800")}>
                  <RotateCcw className="size-5" aria-hidden /> Partial
                </button>
                <button onClick={() => setMode("FAILED")} className={cn(btn.secondary, "border-rose-300 py-3.5 text-base text-rose-700")}>
                  <XCircle className="size-5" aria-hidden /> Failed
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-apptext-secondary">
              {closed ? "This stop is closed." : "Start the run from Today before recording deliveries."}
            </p>
          )}
        </>
      )}

      {mode && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <DeliveryOutcomeForm order={order} initialKind={mode} large onCancel={() => setMode(null)} onDone={(ret, kind) => setResult({ ret, kind })} />
        </section>
      )}
    </div>
  );
}
