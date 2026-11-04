"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, CircleAlert, ShieldCheck, X } from "lucide-react";
import { Order, ReturnReason, ReturnRecord } from "@/lib/types";
import { RETURN_REASON_META, netPackPrice } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Field, Modal, btn, inputClass } from "@/components/ui";
import { packUnitOf, packs } from "./shared";

/* ------------------------------------------------------------------ */
/* Cancel order                                                        */
/* ------------------------------------------------------------------ */

const CANCEL_REASONS = [
  "Customer cancelled by phone",
  "Duplicate order",
  "Item out of stock",
  "Credit hold / payment issue",
  "Wrong address or unreachable",
  "Other",
];

export function CancelOrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { cancelOrder } = useAppStore();
  const [preset, setPreset] = useState(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const needsNote = preset === "Other";
  const reason = [preset === "Other" ? null : preset, note.trim() || null].filter(Boolean).join(": ");
  const valid = !needsNote || note.trim().length >= 3;

  return (
    <Modal
      title={`Cancel ${order.orderNumber}?`}
      subtitle={order.customerName}
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Keep order
          </button>
          <button
            className={btn.danger}
            disabled={!valid}
            onClick={() => {
              cancelOrder(order.id, reason);
              onClose();
            }}
          >
            Cancel order
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason">
          {(id) => (
            <select id={id} className={inputClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={needsNote ? "Explain the reason" : "Note (optional)"} error={needsNote && !valid && note ? "Write at least a few words." : undefined}>
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shown on the order timeline and in the audit log"
            />
          )}
        </Field>
        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-apptext-secondary">
          {order.orderStatus === "PACKED"
            ? "Stock is issued only at dispatch, so inventory doesn't change. Unpack the goods and put them back in their bins."
            : "Stock is issued only at dispatch, so nothing has left inventory and no reservation remains after cancelling."}
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Customer return (RMA)                                               */
/* ------------------------------------------------------------------ */

const RMA_REASONS: ReturnReason[] = ["DAMAGED", "QUALITY_ISSUE", "NEAR_EXPIRY", "WRONG_ITEM", "OVER_ORDERED", "PRICE_DISPUTE", "OTHER"];

interface RmaLineState {
  selected: boolean;
  qty: number;
  reason: ReturnReason;
}

export function RmaModal({
  order,
  onClose,
  onCreated,
}: {
  order: Order;
  onClose: () => void;
  onCreated: (r: ReturnRecord) => void;
}) {
  const { returns, settings, can, createRma } = useAppStore();

  const enabledReasons = RMA_REASONS.filter((r) => settings.returns.reasons.find((x) => x.id === r)?.enabled ?? true);

  /** Packs still returnable per line: delivered minus packs already in open or completed RMAs. */
  const returnable = useMemo(() => {
    const already: Record<string, number> = {};
    for (const r of returns) {
      if (r.orderId !== order.id || r.source !== "CUSTOMER_RMA" || r.status === "REJECTED") continue;
      for (const l of r.lines) already[l.orderItemId] = (already[l.orderItemId] ?? 0) + l.quantity;
    }
    return Object.fromEntries(
      order.items.map((l) => {
        const delivered = l.deliveredQuantity ?? (order.orderStatus === "DELIVERED" ? l.quantity : 0);
        return [l.id, { delivered, already: already[l.id] ?? 0, max: Math.max(0, delivered - (already[l.id] ?? 0)) }];
      })
    ) as Record<string, { delivered: number; already: number; max: number }>;
  }, [returns, order]);

  const [lines, setLines] = useState<Record<string, RmaLineState>>(() =>
    Object.fromEntries(order.items.map((l) => [l.id, { selected: false, qty: 1, reason: enabledReasons[0] ?? "OTHER" }]))
  );
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const set = (id: string, patch: Partial<RmaLineState>) => setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const chosen = order.items
    .filter((l) => lines[l.id].selected && returnable[l.id].max > 0)
    .map((l) => ({ line: l, qty: Math.min(Math.max(0, Math.floor(lines[l.id].qty || 0)), returnable[l.id].max), reason: lines[l.id].reason }));
  const value = chosen.reduce((s, c) => s + netPackPrice(c.line) * c.qty, 0);
  const needsApproval = value >= settings.returns.approvalThreshold || !can("returns", "approve");
  const needsPhoto = settings.returns.requirePhotoForDamage && chosen.some((c) => c.reason === "DAMAGED" || c.reason === "QUALITY_ISSUE");

  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : null;
  const ageDays = deliveredAt ? Math.floor((openedAt - deliveredAt) / 86_400_000) : 0;
  const outsideWindow = ageDays > settings.returns.returnWindowDays;
  const coldChain = order.deliveryType === "COLD_CHAIN";

  const errors: string[] = [];
  if (!chosen.length || chosen.every((c) => c.qty <= 0)) errors.push("Select at least one line and a quantity.");
  if (needsPhoto && photos.length === 0) errors.push("Add at least one photo for damaged or quality returns.");
  if (chosen.some((c) => c.reason === "OTHER") && !note.trim()) errors.push("Explain the reason in the note.");

  const submit = () => {
    setTouched(true);
    if (errors.length) return;
    const rec = createRma({
      orderId: order.id,
      lines: chosen.map((c) => ({ orderItemId: c.line.id, quantity: c.qty, reason: c.reason })),
      note: note.trim() || undefined,
      photoCount: photos.length,
    });
    if (rec) onCreated(rec);
    onClose();
  };

  const nothingReturnable = order.items.every((l) => returnable[l.id].max === 0);

  return (
    <Modal
      title="Create customer return (RMA)"
      subtitle={`${order.orderNumber} · ${order.customerName}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={submit} disabled={nothingReturnable}>
            {needsApproval ? "Submit for approval" : "Create and approve"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {(outsideWindow || coldChain) && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              {outsideWindow && (
                <p>
                  Delivered {ageDays} days ago, outside the {settings.returns.returnWindowDays}-day return window. An approver must accept the exception.
                </p>
              )}
              {coldChain && <p>Cold-chain goods are normally not returnable once accepted. Record why this one is.</p>}
            </div>
          </div>
        )}

        {nothingReturnable ? (
          <p className="rounded-lg bg-surface px-3 py-4 text-center text-sm text-apptext-secondary">
            Every delivered pack on this order is already on a return.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {order.items.map((l) => {
              const r = returnable[l.id];
              const st = lines[l.id];
              const unit = packUnitOf(l);
              const disabled = r.max === 0;
              return (
                <li key={l.id} className={cn("p-3", disabled && "opacity-60")}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-slate-300 text-brand-primary focus:ring-brand-blue"
                      checked={st.selected && !disabled}
                      disabled={disabled}
                      onChange={(e) => set(l.id, { selected: e.target.checked })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-apptext-primary">{l.productName}</span>
                      <span className="block text-xs text-apptext-secondary">
                        {packs(r.delivered, unit)} delivered
                        {r.already > 0 && ` · ${r.already} already on a return`} · {formatCurrency(netPackPrice(l))} per {unit.toLowerCase()}
                      </span>
                    </span>
                  </label>
                  {st.selected && !disabled && (
                    <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-[8rem_1fr]">
                      <Field label="Quantity" hint={`Up to ${r.max}`}>
                        {(id) => (
                          <input
                            id={id}
                            type="number"
                            min={1}
                            max={r.max}
                            inputMode="numeric"
                            className={cn(inputClass, "tabular-nums")}
                            value={st.qty}
                            onChange={(e) => set(l.id, { qty: Math.min(r.max, Math.max(0, Number(e.target.value))) })}
                          />
                        )}
                      </Field>
                      <Field label="Reason" hint={RETURN_REASON_META[st.reason].hint}>
                        {(id) => (
                          <select id={id} className={inputClass} value={st.reason} onChange={(e) => set(l.id, { reason: e.target.value as ReturnReason })}>
                            {enabledReasons.map((x) => (
                              <option key={x} value={x}>
                                {RETURN_REASON_META[x].label}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Field label="Note" hint="What the customer reported. Visible to the warehouse team.">
          {(id) => <textarea id={id} rows={2} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-apptext-primary">
            Photos {needsPhoto && <span className="text-rose-600">(required for damage)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((p, i) => (
              <span key={`${p}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-surface py-0.5 pl-2.5 pr-1 text-xs">
                {p}
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <label className={cn(btn.small, "cursor-pointer")}>
              <Camera className="size-3.5" aria-hidden />
              Add photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const names = Array.from(e.target.files ?? []).map((f) => f.name);
                  setPhotos((prev) => [...prev, ...names]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-apptext-secondary">Demo only: files stay on this device and only the count is saved.</p>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Return value <span className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(value)}</span>
          </span>
          <span className={cn("flex items-center gap-1.5 text-xs", needsApproval ? "text-amber-800" : "text-emerald-700")}>
            <ShieldCheck className="size-3.5" aria-hidden />
            {needsApproval
              ? value >= settings.returns.approvalThreshold
                ? `Needs approval (≥ ${formatCurrency(settings.returns.approvalThreshold)})`
                : "Needs approval from a manager"
              : "Approved automatically"}
          </span>
        </div>

        {touched && errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-apptext-secondary">
          The return then follows pickup → receive → inspect in{" "}
          <Link href="/returns" className="font-medium text-brand-primary hover:underline">
            Returns
          </Link>
          . A credit note is issued after inspection.
        </p>
      </div>
    </Modal>
  );
}
