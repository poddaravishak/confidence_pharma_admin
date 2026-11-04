"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardCheck, MapPin, Navigation, Phone, Snowflake, Truck, Warehouse } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { amountToCollect, isClosedStatus, ORDER_STATUS_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { Badge, btn } from "@/components/ui";
import { mapsUrl, RUN_STATUS_META } from "@/components/delivery/shared";
import { useRider } from "@/components/rider/RiderShell";

export default function RiderTodayPage() {
  const rider = useRider();
  const { runs, orderById, returns, verifyRunLoad, startRun } = useAppStore();
  const { batchById } = useInventory();
  const run = runs.find((r) => r.riderId === rider.id && r.status !== "SETTLED");
  const stops = run ? run.orderIds.map((id) => orderById[id]).filter(Boolean) : [];
  const open = stops.filter((o) => !isClosedStatus(o.orderStatus));
  const done = stops.length - open.length;
  const toCollect = open.reduce((s, o) => s + (o.paymentMethod.includes("CREDIT") ? 0 : amountToCollect(o)), 0);
  const custodyPacks = returns.filter((r) => r.riderId === rider.id && r.status === "IN_TRANSIT").reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const allLines = stops.flatMap((o) => o.items.map((l) => ({ o, l })));
  const allTicked = allLines.length > 0 && allLines.every(({ l }) => ticked[l.id]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Stops left" value={`${open.length}`} hint={`${done} done`} />
        <Tile label="To collect" value={formatCurrency(toCollect)} hint="Cash / MFS" />
        <Tile label="Cash in hand" value={formatCurrency(rider.cashInHand)} hint="Hand over at hub" tone="amber" />
        <Tile label="Returns with you" value={`${custodyPacks} pack${custodyPacks === 1 ? "" : "s"}`} hint="Bring back to hub" tone="teal" />
      </div>

      {!run && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <Truck className="mx-auto size-10 text-slate-300" aria-hidden />
          <p className="mt-2 font-semibold text-apptext-primary">No run assigned yet</p>
          <p className="text-sm text-apptext-secondary">Dispatch will assign your next delivery run. Pull down to refresh.</p>
        </div>
      )}

      {run && (
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="font-mono text-sm font-semibold text-apptext-primary">{run.runNumber}</p>
            <p className="text-xs text-apptext-secondary">{stops.length} stop(s)</p>
          </div>
          <Badge className={RUN_STATUS_META[run.status].badge}>{RUN_STATUS_META[run.status].label}</Badge>
        </div>
      )}

      {/* Loading: verify every line before leaving the warehouse */}
      {run?.status === "LOADING" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-apptext-primary">
            <ClipboardCheck className="size-5 text-brand-blue" aria-hidden /> Check your load
          </h2>
          <p className="mb-3 text-sm text-apptext-secondary">Tick each item as you load it. Check the batch number on the box.</p>
          <div className="space-y-3">
            {stops.map((o, i) => (
              <div key={o.id} className="rounded-xl border border-slate-200">
                <p className="border-b border-slate-100 px-3 py-2 text-sm font-medium text-apptext-primary">
                  Stop {i + 1} · {o.customerName}
                </p>
                <ul>
                  {o.items.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                        <input type="checkbox" checked={!!ticked[l.id]} onChange={(e) => setTicked((t) => ({ ...t, [l.id]: e.target.checked }))} className="size-6 accent-brand-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-apptext-primary">
                            {l.quantity} × {l.productName}
                          </span>
                          <span className="block truncate font-mono text-xs text-apptext-secondary">
                            {(l.batchAllocations ?? []).map((a) => batchById[a.batchId]?.batchNumber).filter(Boolean).join(", ") || l.packSizeName}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            disabled={!allTicked}
            onClick={() => {
              verifyRunLoad(run.id);
              startRun(run.id);
            }}
            className={cn(btn.primary, "mt-4 w-full py-3 text-base")}
          >
            <Truck className="size-5" aria-hidden /> Load checked · start run
          </button>
        </section>
      )}

      {/* Stops */}
      {run && run.status !== "LOADING" && (
        <ol className="space-y-3">
          {stops.map((o, i) => {
            const closed = isClosedStatus(o.orderStatus);
            const next = !closed && open[0]?.id === o.id;
            const returned = o.items.reduce((s, l) => s + (l.returnedQuantity ?? 0), 0);
            return (
              <li key={o.id} className={cn("overflow-hidden rounded-2xl bg-white shadow-sm", next && "ring-2 ring-brand-blue")}>
                <Link href={`/rider/stop/${o.id}`} className="flex items-start gap-3 p-4">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", closed ? "bg-emerald-100 text-emerald-700" : next ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600")}>
                    {closed ? <CheckCircle2 className="size-5" aria-hidden /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {next && <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-blue">Next stop</span>}
                    <span className="block font-semibold text-apptext-primary">{o.customerName}</span>
                    <span className="flex items-start gap-1 text-xs text-apptext-secondary">
                      <MapPin className="mt-px size-3 shrink-0" aria-hidden /> {o.address}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge className={ORDER_STATUS_META[o.orderStatus].badge}>{ORDER_STATUS_META[o.orderStatus].label}</Badge>
                      {o.deliveryType === "COLD_CHAIN" && (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                          <Snowflake className="size-3" aria-hidden /> Cold
                        </Badge>
                      )}
                      {returned > 0 && <Badge className="border-teal-200 bg-teal-50 text-teal-700">{returned} returning</Badge>}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums text-apptext-primary">{formatCurrency(closed ? o.grandTotal : amountToCollect(o))}</span>
                    <span className="block text-[11px] text-apptext-secondary">{o.paymentMethod.includes("CREDIT") ? "Credit" : closed ? "Billed" : "Collect"}</span>
                    <ChevronRight className="ml-auto mt-1 size-4 text-slate-300" aria-hidden />
                  </span>
                </Link>
                {next && (
                  <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100">
                    <a href={`tel:${o.phone}`} className="flex items-center justify-center gap-2 bg-white py-3 text-sm font-medium text-apptext-primary">
                      <Phone className="size-4 text-brand-blue" aria-hidden /> Call
                    </a>
                    <a href={mapsUrl(o)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-white py-3 text-sm font-medium text-apptext-primary">
                      <Navigation className="size-4 text-brand-blue" aria-hidden /> Navigate
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {run?.status === "RETURNING" && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-sky-900">
            <Warehouse className="size-5" aria-hidden /> All stops done. Head back to the hub.
          </p>
          <p className="mt-1 text-sm text-sky-800">
            Hand over <strong>{formatCurrency(rider.cashInHand)}</strong> cash
            {custodyPacks > 0 && (
              <>
                {" "}
                and <strong>{custodyPacks} returned pack(s)</strong>
              </>
            )}{" "}
            to the accounts desk to close {run.runNumber}.
          </p>
          <Link href="/rider/cash" className={cn(btn.primary, "mt-3 w-full")}>
            View handover summary
          </Link>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "amber" | "teal" }) {
  return (
    <div className={cn("rounded-2xl p-3.5 shadow-sm", tone === "amber" ? "bg-amber-50" : tone === "teal" ? "bg-teal-50" : "bg-white")}>
      <p className="text-xs text-apptext-secondary">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-apptext-primary">{value}</p>
      <p className="text-[11px] text-apptext-secondary">{hint}</p>
    </div>
  );
}
