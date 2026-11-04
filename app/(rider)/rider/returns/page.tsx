"use client";

import React from "react";
import { MapPin, PackageCheck, PackageX, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { RETURN_REASON_META, RETURN_SOURCE_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn } from "@/components/ui";
import { useRider } from "@/components/rider/RiderShell";

export default function RiderReturnsPage() {
  const rider = useRider();
  const { returns, orderById, markRmaPickedUp } = useAppStore();
  const custody = returns.filter((r) => r.riderId === rider.id && r.status === "IN_TRANSIT");
  const pickups = returns.filter((r) => r.source === "CUSTOMER_RMA" && r.status === "APPROVED");
  const packs = custody.reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="mb-1 text-lg font-bold text-apptext-primary">Goods with you</h1>
        <p className="mb-3 text-sm text-apptext-secondary">
          {packs > 0 ? `${packs} pack(s). Hand them to the store keeper at the end of the day.` : "Nothing to return right now."}
        </p>
        <div className="space-y-3">
          {custody.map((r) => (
            <article key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-apptext-secondary">{r.returnNumber}</p>
                  <p className="font-semibold text-apptext-primary">{r.customerName}</p>
                </div>
                <Badge className={RETURN_SOURCE_META[r.source].badge}>{RETURN_SOURCE_META[r.source].label}</Badge>
              </div>
              <ul className="mt-2 space-y-1.5">
                {r.lines.map((l) => (
                  <li key={l.orderItemId} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-amber-900">{l.productName}</span>
                      <span className="block text-xs text-amber-800">{RETURN_REASON_META[l.reason].label}</span>
                    </span>
                    <span className="text-lg font-bold tabular-nums text-amber-900">× {l.quantity}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-apptext-secondary">
                {formatDateTime(r.createdAt)} · value {formatCurrency(r.totalValue)}
              </p>
            </article>
          ))}
          {custody.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center">
              <PackageCheck className="mx-auto size-10 text-emerald-400" aria-hidden />
              <p className="mt-2 text-sm text-apptext-secondary">You&apos;re not carrying any returned goods.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold text-apptext-primary">Pickup requests</h2>
        <p className="mb-3 text-sm text-apptext-secondary">Approved customer returns waiting to be collected.</p>
        <div className="space-y-3">
          {pickups.map((r) => {
            const o = orderById[r.orderId];
            return (
              <article key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-mono text-xs text-apptext-secondary">{r.returnNumber}</p>
                <p className="font-semibold text-apptext-primary">{r.customerName}</p>
                {o && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-apptext-secondary">
                    <MapPin className="mt-px size-3 shrink-0" aria-hidden /> {o.address}
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {r.lines.map((l) => (
                    <li key={l.orderItemId} className="flex justify-between">
                      <span>{l.productName}</span>
                      <span className="font-semibold tabular-nums">× {l.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {o && (
                    <a href={`tel:${o.phone}`} className={btn.secondary}>
                      <Phone className="size-4" aria-hidden /> Call
                    </a>
                  )}
                  <button onClick={() => markRmaPickedUp(r.id, rider.id)} className={btn.primary}>
                    <PackageX className="size-4" aria-hidden /> Picked up
                  </button>
                </div>
              </article>
            );
          })}
          {pickups.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm text-apptext-secondary">No pickups waiting.</p>}
        </div>
      </section>
    </div>
  );
}
