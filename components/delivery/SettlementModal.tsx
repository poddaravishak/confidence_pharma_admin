"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Banknote, Calculator, CheckCircle2, PackageCheck } from "lucide-react";
import { DeliveryPersonnel } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { RETURN_REASON_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn, inputClass, Modal } from "@/components/ui";
import { QtyStepper, RiderAvatar } from "./shared";

const NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/**
 * End-of-day rider handover: count the cash and check every returned pack against
 * what the rider recorded at the door. Mismatches are flagged as a shortage.
 */
export function SettlementModal({ rider, onClose }: { rider: DeliveryPersonnel; onClose: () => void }) {
  const { returns, orders, settlements, settleRider, can } = useAppStore();
  const lastSettledAt = settlements.filter((s) => s.riderId === rider.id).map((s) => s.settledAt).sort().at(-1) ?? "";
  const custody = useMemo(() => returns.filter((r) => r.riderId === rider.id && r.status === "IN_TRANSIT"), [returns, rider.id]);
  const collections = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.assignedRider?.id === rider.id &&
          o.deliveryProof?.paymentMethod === "CASH" &&
          (o.deliveryProof?.amountCollected ?? 0) > 0 &&
          o.deliveredAt &&
          new Date(o.deliveredAt).getTime() > new Date(lastSettledAt || 0).getTime()
      ),
    [orders, rider.id, lastSettledAt]
  );

  const [cash, setCash] = useState<number>(rider.cashInHand);
  const [useCounter, setUseCounter] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [goods, setGoods] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(custody.map((r) => [r.id, Object.fromEntries(r.lines.map((l) => [l.orderItemId, l.quantity]))]))
  );
  const [note, setNote] = useState("");

  const counted = useCounter ? NOTES.reduce((s, n) => s + n * (counts[n] ?? 0), 0) : cash;
  const cashDiff = Math.round((counted - rider.cashInHand) * 100) / 100;
  const goodsExpected = custody.reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);
  const goodsReceived = custody.reduce((s, r) => s + r.lines.reduce((n, l) => n + (goods[r.id]?.[l.orderItemId] ?? 0), 0), 0);
  const balanced = cashDiff === 0 && goodsReceived === goodsExpected;
  const canApprove = can("delivery", "approve") || can("accounts", "approve");

  const submit = () => {
    settleRider(rider.id, { cashReceived: counted, goodsReceived: goods, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Modal
      size="lg"
      title="Settle rider"
      subtitle="Count the cash and check the returned goods before the rider signs off."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canApprove || (!balanced && note.trim().length < 5)} className={balanced ? btn.success : btn.danger}>
            {balanced ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
            {balanced ? "Confirm settlement" : "Settle with shortage"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <RiderAvatar name={rider.name} />
          <div>
            <p className="font-semibold text-apptext-primary">{rider.name}</p>
            <p className="text-xs text-apptext-secondary">
              {rider.employeeCode} · {rider.vehiclePlateNo}
            </p>
          </div>
        </div>

        {/* Cash */}
        <section className="rounded-xl border border-slate-200">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-apptext-primary">
              <Banknote className="size-4 text-amber-600" aria-hidden /> Cash handover
            </h3>
            <button onClick={() => setUseCounter((v) => !v)} className={btn.small}>
              <Calculator className="size-3.5" aria-hidden /> {useCounter ? "Enter total" : "Count notes"}
            </button>
          </header>
          <div className="space-y-3 p-4">
            {collections.length > 0 && (
              <ul className="space-y-1 text-sm">
                {collections.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3 text-apptext-secondary">
                    <span className="truncate">
                      <span className="font-mono text-xs">{o.orderNumber.split("-").pop()}</span> · {o.customerName}
                    </span>
                    <span className="tabular-nums text-apptext-primary">{formatCurrency(o.deliveryProof?.amountCollected ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
              <span className="text-apptext-secondary">Expected (system)</span>
              <span className="text-lg font-bold tabular-nums text-apptext-primary">{formatCurrency(rider.cashInHand)}</span>
            </div>
            {useCounter ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {NOTES.map((n) => (
                  <label key={n} className="rounded-lg border border-slate-200 p-2 text-center">
                    <span className="block text-xs text-apptext-secondary">৳{n} ×</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={counts[n] ?? ""}
                      onChange={(e) => setCounts((c) => ({ ...c, [n]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="mt-1 w-full rounded border border-slate-200 px-1 py-1 text-center text-sm tabular-nums"
                      aria-label={`${n} taka notes`}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-apptext-primary">Cash counted (৳)</span>
                <input type="number" min={0} inputMode="decimal" value={cash} onChange={(e) => setCash(Number(e.target.value) || 0)} className={cn(inputClass, "text-lg font-semibold tabular-nums")} />
              </label>
            )}
            <p
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
                cashDiff === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              )}
            >
              <span>Counted {formatCurrency(counted)}</span>
              <span className="tabular-nums">{cashDiff === 0 ? "Balanced" : `${cashDiff < 0 ? "Short" : "Over"} ${formatCurrency(Math.abs(cashDiff))}`}</span>
            </p>
          </div>
        </section>

        {/* Goods */}
        <section className="rounded-xl border border-slate-200">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-apptext-primary">
              <PackageCheck className="size-4 text-teal-600" aria-hidden /> Returned goods in custody
            </h3>
            <span className="text-sm tabular-nums text-apptext-secondary">
              {goodsReceived} / {goodsExpected} pack(s)
            </span>
          </header>
          {custody.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-apptext-secondary">No returned goods with this rider.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {custody.map((r) =>
                r.lines.map((l) => {
                  const got = goods[r.id]?.[l.orderItemId] ?? 0;
                  return (
                    <li key={`${r.id}-${l.orderItemId}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-apptext-primary">
                          {l.productName} <span className="font-normal text-apptext-secondary">· {l.packSizeName}</span>
                        </p>
                        <p className="text-xs text-apptext-secondary">
                          {r.returnNumber} · {r.customerName} · <Badge className="border-slate-200 bg-slate-50 text-slate-600">{RETURN_REASON_META[l.reason].label}</Badge>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-apptext-secondary">Expected {l.quantity}</span>
                        <QtyStepper
                          value={got}
                          max={l.quantity}
                          onChange={(v) => setGoods((g) => ({ ...g, [r.id]: { ...g[r.id], [l.orderItemId]: v } }))}
                          label={`${l.productName} received`}
                        />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </section>

        {!balanced && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-rose-700">Explain the shortage (required)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="e.g. 1 box missing, rider to bring tomorrow; ৳200 deducted from allowance" />
          </label>
        )}
        {!canApprove && <p className="text-sm text-amber-700">Your role can&apos;t approve settlements. Ask an accountant or dispatch coordinator.</p>}
        <p className="text-xs text-apptext-secondary">
          Received goods move to the returns bay as “Received · to inspect”. They are restocked only after inspection in Returns.
        </p>
      </div>
    </Modal>
  );
}
