"use client";

import React from "react";
import { Banknote, CheckCircle2, Smartphone, Warehouse } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge } from "@/components/ui";
import { useRider } from "@/components/rider/RiderShell";

export default function RiderCashPage() {
  const rider = useRider();
  const { orders, returns, settlements, settings } = useAppStore();
  const collections = orders
    .filter((o) => o.assignedRider?.id === rider.id && o.deliveryProof && o.deliveryProof.amountCollected > 0)
    .sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? ""));
  const mine = settlements.filter((s) => s.riderId === rider.id);
  const lastSettled = mine.map((s) => s.settledAt).sort().at(-1) ?? "";
  const sinceLast = collections.filter((o) => (o.deliveredAt ?? "") > lastSettled);
  const mfs = sinceLast.filter((o) => o.deliveryProof!.paymentMethod !== "CASH").reduce((s, o) => s + o.deliveryProof!.amountCollected, 0);
  const packs = returns.filter((r) => r.riderId === rider.id && r.status === "IN_TRANSIT").reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);
  const nearLimit = rider.cashInHand >= settings.delivery.riderCashLimit * 0.8;

  return (
    <div className="space-y-4">
      <section className={cn("rounded-2xl p-5 text-white shadow-sm", nearLimit ? "bg-rose-600" : "bg-brand-primary")}>
        <p className="flex items-center gap-2 text-sm text-white/80">
          <Banknote className="size-4" aria-hidden /> Cash in hand
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatCurrency(rider.cashInHand)}</p>
        <p className="mt-1 text-xs text-white/75">
          {nearLimit ? `Close to your ${formatCurrency(settings.delivery.riderCashLimit)} limit. Deposit soon.` : `Limit ${formatCurrency(settings.delivery.riderCashLimit)}`}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="flex items-center gap-1 text-xs text-apptext-secondary">
            <Smartphone className="size-3.5" aria-hidden /> bKash / Nagad
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCurrency(mfs)}</p>
          <p className="text-[11px] text-apptext-secondary">Paid to merchant wallet</p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-xs text-apptext-secondary">Returned goods</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{packs} pack(s)</p>
          <p className="text-[11px] text-apptext-secondary">To hand over</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-apptext-primary">
          <Warehouse className="size-4 text-brand-blue" aria-hidden /> End-of-day handover
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-apptext-secondary">
          <li>Go to the accounts desk at Tejgaon hub.</li>
          <li>Hand over {formatCurrency(rider.cashInHand)} cash. It will be counted in front of you.</li>
          {packs > 0 && <li>Give the {packs} returned pack(s) to the store keeper.</li>}
          <li>Check the settlement on this screen before you leave.</li>
        </ol>
      </section>

      <section className="rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-apptext-primary">Collections since last settlement</h2>
        <ul className="divide-y divide-slate-100">
          {sinceLast.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-apptext-primary">{o.customerName}</span>
                <span className="block text-xs text-apptext-secondary">
                  {o.deliveredAt && formatDateTime(o.deliveredAt)} · {PAYMENT_CHANNEL_LABEL[o.deliveryProof!.paymentMethod]}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(o.deliveryProof!.amountCollected)}</span>
            </li>
          ))}
          {sinceLast.length === 0 && <li className="px-4 py-5 text-center text-sm text-apptext-secondary">No collections yet.</li>}
        </ul>
      </section>

      <section className="rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-apptext-primary">Past settlements</h2>
        <ul className="divide-y divide-slate-100">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block font-mono text-xs text-apptext-secondary">{s.settlementNumber}</span>
                <span className="block text-xs text-apptext-secondary">{formatDateTime(s.settledAt)}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{formatCurrency(s.cashReceived)}</span>
                <Badge className={s.status === "BALANCED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                  {s.status === "BALANCED" ? (
                    <>
                      <CheckCircle2 className="size-3" aria-hidden /> Balanced
                    </>
                  ) : (
                    "Shortage"
                  )}
                </Badge>
              </span>
            </li>
          ))}
          {mine.length === 0 && <li className="px-4 py-5 text-center text-sm text-apptext-secondary">No settlements yet.</li>}
        </ul>
      </section>
    </div>
  );
}
