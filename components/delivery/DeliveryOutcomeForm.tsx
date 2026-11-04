"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, PackageX, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Order, PaymentChannel, ReturnReason, ReturnRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { netPackPrice, PAYMENT_CHANNEL_LABEL, RETURN_REASON_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { btn, inputClass } from "@/components/ui";
import { QtyStepper } from "./shared";

export type OutcomeKind = "FULL" | "PARTIAL" | "FAILED";

const LINE_REASONS: ReturnReason[] = ["OVER_ORDERED", "DAMAGED", "WRONG_ITEM", "NEAR_EXPIRY", "PRICE_DISPUTE", "QUALITY_ISSUE", "OTHER"];
const FAIL_REASONS: ReturnReason[] = ["CUSTOMER_UNAVAILABLE", "REFUSED", "WRONG_ITEM", "PRICE_DISPUTE", "OTHER"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Doorstep outcome: full, partial (per-line accepted qty + reason) or failed.
 * Recalculates the bill live, captures payment and proof, then calls recordDelivery.
 */
export function DeliveryOutcomeForm({
  order,
  initialKind = "FULL",
  onDone,
  onCancel,
  large,
}: {
  order: Order;
  initialKind?: OutcomeKind;
  onDone: (ret: ReturnRecord | null, kind: OutcomeKind) => void;
  onCancel?: () => void;
  /** Bigger touch targets for the rider app. */
  large?: boolean;
}) {
  const { settings, recordDelivery } = useAppStore();
  const [kind, setKind] = useState<OutcomeKind>(initialKind);
  const [accepted, setAccepted] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((l, i) => [l.id, initialKind === "PARTIAL" && i === 0 ? Math.max(0, l.quantity - 1) : l.quantity]))
  );
  const [reasons, setReasons] = useState<Record<string, ReturnReason>>(() => Object.fromEntries(order.items.map((l) => [l.id, "OVER_ORDERED" as ReturnReason])));
  const [failCode, setFailCode] = useState<ReturnReason>("CUSTOMER_UNAVAILABLE");
  const [note, setNote] = useState("");
  const isCredit = order.paymentMethod.includes("CREDIT");
  const enabledChannels = settings.payments.filter((p) => p.enabled).map((p) => p.id);
  const [method, setMethod] = useState<PaymentChannel>(isCredit ? "CREDIT" : "CASH");
  const [amountEdited, setAmountEdited] = useState<number | null>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [otp, setOtp] = useState("");
  const [photos, setPhotos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const proofMethod = settings.delivery.proofRequired;

  const lines = useMemo(
    () =>
      order.items.map((l) => {
        const acc = kind === "FULL" ? l.quantity : kind === "FAILED" ? 0 : accepted[l.id] ?? l.quantity;
        return { line: l, accepted: acc, returned: l.quantity - acc, net: netPackPrice(l) };
      }),
    [order.items, kind, accepted]
  );

  const returnedPacks = lines.reduce((s, l) => s + l.returned, 0);
  const returnedValue = round2(lines.reduce((s, l) => s + l.returned * l.net, 0));
  const revised = kind === "FAILED" ? 0 : round2(lines.reduce((s, l) => s + l.accepted * l.net, 0) + order.deliveryCharge);
  const dueNow = round2(Math.max(0, revised - order.paidAmount));
  const amount = method === "CREDIT" ? 0 : amountEdited ?? dueNow;
  const needsPhoto =
    settings.returns.requirePhotoForDamage && kind === "PARTIAL" && lines.some((l) => l.returned > 0 && reasons[l.line.id] === "DAMAGED");

  const submit = () => {
    setError(null);
    if (kind === "PARTIAL") {
      if (returnedPacks === 0) return setError("Nothing is being returned. Use “Delivered in full” instead.");
      if (lines.every((l) => l.accepted === 0)) return setError("The customer accepted nothing. Use “Failed / refused” instead.");
      if (!settings.delivery.allowPartialDelivery) return setError("Partial delivery is turned off in Settings → Delivery.");
    }
    if (needsPhoto && photos === 0) return setError("Take at least one photo of the damaged goods.");
    if (kind !== "FAILED") {
      if (proofMethod === "OTP" && !/^\d{4}$/.test(otp)) return setError("Enter the 4-digit OTP the customer received by SMS.");
      if (proofMethod === "SIGNATURE" && receivedBy.trim().length < 2) return setError("Enter the name of the person who signed.");
      if (proofMethod === "PHOTO" && photos === 0) return setError("Take a photo of the signed challan.");
      if (method !== "CREDIT" && amount > dueNow + 0.01) return setError(`Amount can't be more than ${formatCurrency(dueNow)}.`);
    }
    if (kind === "FAILED" && failCode === "OTHER" && note.trim().length < 3) return setError("Explain why the delivery failed.");

    const ret = recordDelivery(order.id, {
      kind,
      lines: lines.map((l) => ({ orderItemId: l.line.id, accepted: l.accepted, reason: reasons[l.line.id] })),
      failureCode: kind === "FAILED" ? failCode : undefined,
      failureReason: kind === "FAILED" ? [RETURN_REASON_META[failCode].label, note.trim()].filter(Boolean).join(": ") : undefined,
      note: note.trim() || undefined,
      photoCount: photos || undefined,
      payment: { method: kind === "FAILED" ? "CASH" : method, amount: kind === "FAILED" ? 0 : amount },
      proof:
        kind === "FAILED"
          ? undefined
          : { method: proofMethod === "NONE" ? "SIGNATURE" : proofMethod, receivedBy: receivedBy.trim() || "Customer", otp: otp || undefined, photoCount: photos || undefined },
    });
    onDone(ret, kind);
  };

  const kinds: { id: OutcomeKind; label: string; icon: React.ElementType; tone: string }[] = [
    { id: "FULL", label: "Delivered in full", icon: CheckCircle2, tone: "border-emerald-500 bg-emerald-50 text-emerald-800" },
    { id: "PARTIAL", label: "Partial delivery", icon: RotateCcw, tone: "border-teal-500 bg-teal-50 text-teal-800" },
    { id: "FAILED", label: "Failed / refused", icon: XCircle, tone: "border-rose-500 bg-rose-50 text-rose-800" },
  ];

  return (
    <div className="space-y-5">
      {/* Outcome */}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Delivery outcome">
        {kinds.map((k) => {
          const active = kind === k.id;
          const Icon = k.icon;
          return (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setKind(k.id);
                setAmountEdited(null);
                if (k.id === "PARTIAL" && returnedPacks === 0) {
                  const first = order.items.find((l) => l.quantity > 0);
                  if (first) setAccepted((a) => ({ ...a, [first.id]: Math.max(0, first.quantity - 1) }));
                }
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 text-center text-xs font-semibold transition sm:text-sm",
                large ? "py-4" : "py-3",
                active ? k.tone : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Lines */}
      {kind !== "FAILED" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-apptext-primary">{kind === "PARTIAL" ? "How many did the customer keep?" : "Items handed over"}</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {lines.map(({ line, accepted: acc, returned, net }) => (
              <li key={line.id} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-apptext-primary">{line.productName}</p>
                    <p className="text-xs text-apptext-secondary">
                      {line.packSizeName} · {formatCurrency(net)} each · ordered <span className="tabular-nums">{line.quantity}</span>
                    </p>
                  </div>
                  {kind === "PARTIAL" ? (
                    <QtyStepper
                      value={acc}
                      max={line.quantity}
                      onChange={(v) => setAccepted((a) => ({ ...a, [line.id]: v }))}
                      label={`${line.productName} accepted`}
                      size={large ? "lg" : "md"}
                    />
                  ) : (
                    <span className="text-sm font-semibold tabular-nums text-apptext-primary">× {line.quantity}</span>
                  )}
                </div>
                {kind === "PARTIAL" && returned > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg bg-teal-50/70 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-teal-800">
                      <PackageX className="size-4" aria-hidden />
                      <span className="tabular-nums">{returned}</span> coming back · {formatCurrency(returned * net)}
                    </p>
                    <select
                      value={reasons[line.id]}
                      onChange={(e) => setReasons((r) => ({ ...r, [line.id]: e.target.value as ReturnReason }))}
                      aria-label={`Return reason for ${line.productName}`}
                      className={cn(inputClass, "py-1.5 sm:w-56")}
                    >
                      {LINE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {RETURN_REASON_META[r].label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {kind === "FAILED" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-apptext-primary">Why did the delivery fail?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FAIL_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition",
                  failCode === r ? "border-rose-400 bg-rose-50/60 ring-1 ring-rose-400" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <input type="radio" name="fail" checked={failCode === r} onChange={() => setFailCode(r)} className="mt-0.5 size-4 accent-rose-600" />
                <span>
                  <span className="block font-medium text-apptext-primary">{RETURN_REASON_META[r].label}</span>
                  <span className="block text-xs text-apptext-secondary">{RETURN_REASON_META[r].hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            All {order.items.reduce((s, l) => s + l.quantity, 0)} pack(s) stay with you and must be handed back at the hub. A return
            is opened automatically.
          </p>
        </div>
      )}

      {/* Bill */}
      <div className="rounded-xl border border-slate-200 bg-surface p-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-apptext-secondary">Original invoice</dt>
            <dd className={cn("tabular-nums", (returnedPacks > 0 || kind === "FAILED") && "text-slate-400 line-through")}>{formatCurrency(order.grandTotal)}</dd>
          </div>
          {returnedPacks > 0 && kind !== "FAILED" && (
            <div className="flex justify-between text-teal-700">
              <dt>Less returned ({returnedPacks} pack{returnedPacks === 1 ? "" : "s"})</dt>
              <dd className="tabular-nums">− {formatCurrency(returnedValue)}</dd>
            </div>
          )}
          {order.paidAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-apptext-secondary">Already paid</dt>
              <dd className="tabular-nums">− {formatCurrency(order.paidAmount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-apptext-primary">{kind === "FAILED" ? "Nothing to collect" : "Revised bill to collect"}</dt>
            <dd className="text-2xl font-bold tabular-nums text-apptext-primary">{formatCurrency(dueNow)}</dd>
          </div>
        </dl>
      </div>

      {/* Payment & proof */}
      {kind !== "FAILED" && (
        <div className={cn("grid grid-cols-1 gap-4", !large && "sm:grid-cols-2")}>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-apptext-primary">Payment</p>
            <div className="flex flex-wrap gap-1.5">
              {enabledChannels
                .filter((c) => c !== "BANK")
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setMethod(c);
                      setAmountEdited(null);
                    }}
                    aria-pressed={method === c}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      method === c ? "border-brand-primary bg-brand-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {PAYMENT_CHANNEL_LABEL[c]}
                  </button>
                ))}
            </div>
            {method !== "CREDIT" ? (
              <label className="block">
                <span className="mb-1 block text-xs text-apptext-secondary">Amount received (৳)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  min={0}
                  max={dueNow}
                  onChange={(e) => setAmountEdited(Number(e.target.value))}
                  className={cn(inputClass, "text-lg font-semibold tabular-nums")}
                />
                {amount < dueNow && <span className="mt-1 block text-xs text-amber-700">{formatCurrency(dueNow - amount)} will stay as due on the customer&apos;s account.</span>}
              </label>
            ) : (
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">{formatCurrency(dueNow)} will be added to the customer&apos;s due balance.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-apptext-primary">
              <ShieldCheck className="size-4 text-brand-blue" aria-hidden /> Proof of delivery
            </p>
            {proofMethod === "OTP" && (
              <label className="block">
                <span className="mb-1 block text-xs text-apptext-secondary">Customer OTP (demo: any 4 digits)</span>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className={cn(inputClass, "text-center text-lg font-semibold tracking-[0.5em]")}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-apptext-secondary">Received by</span>
              <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name of the person" className={inputClass} />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setPhotos((p) => p + 1)} className={btn.secondary}>
          <Camera className="size-4" aria-hidden /> {photos ? `${photos} photo${photos > 1 ? "s" : ""} added` : "Add photo"}
        </button>
        {needsPhoto && photos === 0 && <span className="text-xs text-amber-700">Photo required for damaged goods</span>}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-apptext-primary">Note {kind === "FAILED" && failCode === "OTHER" ? "(required)" : "(optional)"}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="Anything the warehouse or accounts team should know" />
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className={cn(btn.secondary, large && "py-3")}>
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          className={cn(kind === "FAILED" ? btn.danger : kind === "PARTIAL" ? btn.primary : btn.success, large && "py-3 text-base")}
        >
          {kind === "FULL" && `Confirm delivery${amount > 0 ? ` · ${formatCurrency(amount)}` : ""}`}
          {kind === "PARTIAL" && `Confirm partial · ${returnedPacks} returning`}
          {kind === "FAILED" && "Mark as failed"}
        </button>
      </div>
    </div>
  );
}
