"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Camera, PackageCheck, Printer, ShieldAlert } from "lucide-react";
import { CreditNote, ReturnReason, ReturnRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { daysUntil, formatDateTime, formatDay, formatPacks } from "@/lib/inventory";
import { RETURN_REASON_META } from "@/lib/orders";
import { InspectionDecision, useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { Badge, btn, inputClass, Modal } from "@/components/ui";
import { QtyStepper } from "@/components/delivery/shared";

/* ------------------------------------------------------------------ */
/* Receive (count what physically arrived)                             */
/* ------------------------------------------------------------------ */

export function ReceiveModal({ ret, onClose }: { ret: ReturnRecord; onClose: () => void }) {
  const { receiveReturn } = useAppStore();
  const [got, setGot] = useState<Record<string, number>>(() => Object.fromEntries(ret.lines.map((l) => [l.orderItemId, l.quantity])));
  const short = ret.lines.reduce((s, l) => s + (l.quantity - (got[l.orderItemId] ?? 0)), 0);

  return (
    <Modal
      title="Receive returned goods"
      subtitle={`${ret.returnNumber} · ${ret.customerName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button
            onClick={() => {
              receiveReturn(ret.id, got);
              onClose();
            }}
            className={short ? btn.danger : btn.primary}
          >
            <PackageCheck className="size-4" aria-hidden /> {short ? `Receive with ${short} short` : "Receive into returns bay"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-apptext-secondary">Count each item. Riders usually hand goods over during settlement on the Delivery page.</p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {ret.lines.map((l) => (
          <li key={l.orderItemId} className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-apptext-primary">{l.productName}</span>
              <span className="block text-xs text-apptext-secondary">Expected {l.quantity} · {l.packSizeName}</span>
            </span>
            <QtyStepper value={got[l.orderItemId] ?? 0} max={l.quantity} onChange={(v) => setGot((g) => ({ ...g, [l.orderItemId]: v }))} label={`${l.productName} received`} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Inspect (sellable → original batch, damaged → quarantine)            */
/* ------------------------------------------------------------------ */

export function InspectionPanel({ ret, onDone }: { ret: ReturnRecord; onDone?: (cn: CreditNote | null) => void }) {
  const { inspectReturn, orderById, can, settings } = useAppStore();
  const { batchById, itemById } = useInventory();
  const order = orderById[ret.orderId];

  const [decisions, setDecisions] = useState<Record<string, InspectionDecision>>(() =>
    Object.fromEntries(
      ret.lines.map((l) => {
        const received = l.receivedQuantity ?? l.quantity;
        const damagedByReason = l.reason === "DAMAGED" || l.reason === "QUALITY_ISSUE";
        return [l.orderItemId, { sellable: damagedByReason ? 0 : received, damaged: damagedByReason ? received : 0, damageCondition: "DAMAGED", batchId: l.batchId }];
      })
    )
  );
  const [confirming, setConfirming] = useState(false);

  const set = (id: string, patch: Partial<InspectionDecision>) => setDecisions((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const preview = useMemo(
    () =>
      ret.lines.map((l) => {
        const d = decisions[l.orderItemId];
        const b = d.batchId ? batchById[d.batchId] : undefined;
        const item = itemById[l.productId];
        return { l, d, b, item, received: l.receivedQuantity ?? l.quantity };
      }),
    [ret.lines, decisions, batchById, itemById]
  );

  const valid = preview.every(({ d, received }) => d.sellable + d.damaged === received);
  const restockValue = preview.reduce((s, p) => s + p.d.sellable * p.l.unitsPerPack * (p.b?.unitCost ?? p.item?.costPrice ?? 0), 0);
  const lossValue = preview.reduce((s, p) => s + p.d.damaged * p.l.unitsPerPack * (p.b?.unitCost ?? p.item?.costPrice ?? 0), 0);
  const creditValue =
    ret.source === "CUSTOMER_RMA"
      ? preview.reduce((s, p) => s + (p.d.sellable + p.d.damaged) * p.l.unitPrice, 0)
      : ret.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const canInspect = can("returns", "edit") || can("returns", "approve");
  const needsApproval = lossValue >= settings.returns.approvalThreshold && !can("returns", "approve");

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {preview.map(({ l, d, b, item, received }) => {
          const batches = (order?.items.find((i) => i.id === l.orderItemId)?.batchAllocations ?? []).map((a) => batchById[a.batchId]).filter(Boolean);
          const mismatch = d.sellable + d.damaged !== received;
          return (
            <li key={l.orderItemId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-apptext-primary">{l.productName}</p>
                  <p className="text-xs text-apptext-secondary">
                    {received} received · {l.packSizeName} · <Badge className="border-slate-200 bg-slate-50 text-slate-600">{RETURN_REASON_META[l.reason].label}</Badge>
                  </p>
                </div>
                {item?.isColdChain && <Badge className="border-sky-200 bg-sky-50 text-sky-700">Cold chain: check temperature log</Badge>}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-emerald-700">Sellable · restock</p>
                  <QtyStepper value={d.sellable} max={received} onChange={(v) => set(l.orderItemId, { sellable: v, damaged: received - v })} label={`${l.productName} sellable`} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-rose-700">Not sellable · quarantine</p>
                  <QtyStepper value={d.damaged} max={received} onChange={(v) => set(l.orderItemId, { damaged: v, sellable: received - v })} label={`${l.productName} damaged`} />
                </div>
                {d.damaged > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-apptext-secondary">Condition</span>
                    <select value={d.damageCondition} onChange={(e) => set(l.orderItemId, { damageCondition: e.target.value as "DAMAGED" | "EXPIRED" })} className={cn(inputClass, "py-1.5")}>
                      <option value="DAMAGED">Damaged / broken seal</option>
                      <option value="EXPIRED">Expired / short expiry</option>
                    </select>
                  </label>
                )}
              </div>

              {batches.length > 0 && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-apptext-secondary">Return to batch (check the number printed on the box)</span>
                  <select value={d.batchId} onChange={(e) => set(l.orderItemId, { batchId: e.target.value })} className={cn(inputClass, "py-1.5 font-mono text-xs")}>
                    {batches.map((x) => (
                      <option key={x!.id} value={x!.id}>
                        {x!.batchNumber} · exp {formatDay(x!.expiryDate)} ({daysUntil(x!.expiryDate)} days) · {x!.location}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {item && (
                <div className="mt-3 space-y-1 rounded-lg bg-surface p-2.5 text-xs">
                  {d.sellable > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-emerald-800">
                      <ArrowRight className="size-3.5" aria-hidden /> +{formatPacks(d.sellable * l.unitsPerPack, item)} back to{" "}
                      <span className="font-mono">{b?.batchNumber ?? "latest batch"}</span> {b && `(${b.location})`}
                    </p>
                  )}
                  {d.damaged > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-rose-700">
                      <ShieldAlert className="size-3.5" aria-hidden /> {formatPacks(d.damaged * l.unitsPerPack, item)} to quarantine RQ-01, blocked from picking
                    </p>
                  )}
                </div>
              )}
              {mismatch && <p className="mt-2 text-xs text-rose-600">Sellable + not sellable must equal {received}.</p>}
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-800">Restocked at cost</p>
          <p className="text-lg font-bold tabular-nums text-emerald-900">{formatCurrency(restockValue)}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-xs text-rose-800">Quarantined at cost</p>
          <p className="text-lg font-bold tabular-nums text-rose-900">{formatCurrency(lossValue)}</p>
        </div>
        <div className="rounded-xl bg-brand-light/60 p-3">
          <p className="text-xs text-brand-primary">Credit note to customer</p>
          <p className="text-lg font-bold tabular-nums text-brand-primary">{formatCurrency(creditValue)}</p>
        </div>
      </div>

      {ret.source !== "CUSTOMER_RMA" && (
        <p className="text-xs text-apptext-secondary">
          The customer was already billed only for what they kept, so this credit note is recorded as <strong>applied</strong> against the
          original invoice.
          {(ret.shortageQuantity ?? 0) > 0 && ` ${ret.shortageQuantity} missing pack(s) stay on the rider's settlement as a shortage.`}
        </p>
      )}
      {needsApproval && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Write-offs above {formatCurrency(settings.returns.approvalThreshold)} need a role with
          return approval.
        </p>
      )}

      <div className="flex justify-end gap-2">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} disabled={!valid || !canInspect || needsApproval} className={btn.primary}>
            <PackageCheck className="size-4" aria-hidden /> Complete inspection
          </button>
        ) : (
          <>
            <button onClick={() => setConfirming(false)} className={btn.secondary}>
              Back
            </button>
            <button
              onClick={() => {
                const cn = inspectReturn(ret.id, decisions);
                onDone?.(cn);
              }}
              className={btn.success}
            >
              Confirm: update stock & issue credit note
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credit note document                                                */
/* ------------------------------------------------------------------ */

export function CreditNoteModal({ cn, onClose }: { cn: CreditNote; onClose: () => void }) {
  const { settings, returns, creditNotes, setCreditNoteStatus, can } = useAppStore();
  const note = creditNotes.find((c) => c.id === cn.id) ?? cn;
  const ret = returns.find((r) => r.id === note.returnId);
  return (
    <Modal
      size="lg"
      title={`Credit note ${note.creditNoteNumber}`}
      subtitle={note.customerName}
      onClose={onClose}
      footer={
        <>
          {note.status === "ISSUED" && can("accounts", "edit") && (
            <>
              <button onClick={() => setCreditNoteStatus(note.id, "APPLIED")} className={btn.secondary}>
                Apply to customer due
              </button>
              <button onClick={() => setCreditNoteStatus(note.id, "REFUNDED")} className={btn.secondary}>
                Mark refunded
              </button>
            </>
          )}
          <button onClick={() => window.print()} className={btn.primary}>
            <Printer className="size-4" aria-hidden /> Print
          </button>
        </>
      }
    >
      <div className="print-area space-y-4 bg-white text-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/confidence-pharma-logo.jpg" alt="" className="h-9 w-auto" />
            <p className="mt-1 text-xs text-apptext-secondary">{settings.company.address}</p>
            <p className="text-xs text-apptext-secondary">BIN {settings.company.binNo}</p>
          </div>
          <div className="text-right">
            <p className="font-bold uppercase tracking-wide text-brand-primary">Credit note</p>
            <p className="font-mono text-xs">{note.creditNoteNumber}</p>
            <p className="text-xs text-apptext-secondary">{formatDateTime(note.createdAt)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-apptext-secondary">Customer</p>
            <p className="font-semibold">{note.customerName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-apptext-secondary">Against invoice</p>
            <p className="font-mono">{note.orderNumber}</p>
          </div>
        </div>
        {ret && (
          <table className="w-full text-left">
            <thead className="border-y border-slate-200 bg-surface text-xs text-apptext-secondary">
              <tr>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ret.lines.map((l) => {
                const q = ret.source === "CUSTOMER_RMA" ? (l.sellableQuantity ?? 0) + (l.damagedQuantity ?? 0) : l.quantity;
                return (
                  <tr key={l.orderItemId}>
                    <td className="px-2 py-2">{l.productName}</td>
                    <td className="px-2 py-2 text-xs">{RETURN_REASON_META[l.reason as ReturnReason].label}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{q}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(q * l.unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-apptext-secondary">{note.reason}</span>
          <span className="text-xl font-bold tabular-nums">{formatCurrency(note.amount)}</span>
        </div>
        <p className="text-xs text-apptext-secondary">
          Status: <strong>{note.status.toLowerCase()}</strong> · Issued by {note.createdBy}
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* New customer return (RMA)                                           */
/* ------------------------------------------------------------------ */

export function NewRmaModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: ReturnRecord) => void }) {
  const { orders, returns, createRma, settings } = useAppStore();
  const eligible = orders.filter((o) => o.orderStatus === "DELIVERED" || o.orderStatus === "PARTIALLY_DELIVERED");
  const [orderId, setOrderId] = useState(eligible[0]?.id ?? "");
  const order = eligible.find((o) => o.id === orderId);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<Record<string, ReturnReason>>({});
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState(0);

  const alreadyReturned = (itemId: string) =>
    returns
      .filter((r) => r.orderId === orderId && r.source === "CUSTOMER_RMA" && r.status !== "REJECTED")
      .reduce((s, r) => s + (r.lines.find((l) => l.orderItemId === itemId)?.quantity ?? 0), 0);

  const daysSince = order?.deliveredAt ? Math.floor((new Date("2026-11-05T12:00:00+06:00").getTime() - new Date(order.deliveredAt).getTime()) / 86400000) : 0;
  const outsideWindow = daysSince > settings.returns.returnWindowDays;
  const total = order ? order.items.reduce((s, l) => s + (qty[l.id] ?? 0) * l.unitPrice * (1 - l.discountPct / 100), 0) : 0;
  const any = Object.values(qty).some((v) => v > 0);

  const submit = () => {
    if (!order) return;
    const rec = createRma({
      orderId: order.id,
      lines: order.items.map((l) => ({ orderItemId: l.id, quantity: qty[l.id] ?? 0, reason: reason[l.id] ?? "QUALITY_ISSUE" })),
      note: note.trim() || undefined,
      photoCount: photos || undefined,
    });
    if (rec) onCreated(rec);
  };

  return (
    <Modal
      size="lg"
      title="New customer return"
      subtitle="The customer wants to send back goods that were already delivered."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} disabled={!any} className={btn.primary}>
            Submit return · {formatCurrency(total)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-apptext-primary">Delivered order</span>
          <select
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              setQty({});
            }}
            className={inputClass}
          >
            {eligible.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} · {o.customerName}
              </option>
            ))}
          </select>
        </label>
        {outsideWindow && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Delivered {daysSince} days ago, outside the {settings.returns.returnWindowDays}-day return window. It needs manager approval.
          </p>
        )}
        {order && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {order.items.map((l) => {
              const max = Math.max(0, (l.deliveredQuantity ?? l.quantity) - alreadyReturned(l.id));
              return (
                <li key={l.id} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-apptext-primary">{l.productName}</span>
                      <span className="block text-xs text-apptext-secondary">
                        {l.deliveredQuantity ?? l.quantity} delivered · up to {max} returnable
                      </span>
                    </span>
                    <QtyStepper value={qty[l.id] ?? 0} max={max} onChange={(v) => setQty((q) => ({ ...q, [l.id]: v }))} label={`${l.productName} to return`} />
                  </div>
                  {(qty[l.id] ?? 0) > 0 && (
                    <select value={reason[l.id] ?? "QUALITY_ISSUE"} onChange={(e) => setReason((r) => ({ ...r, [l.id]: e.target.value as ReturnReason }))} className={cn(inputClass, "py-1.5")} aria-label="Reason">
                      {(["QUALITY_ISSUE", "DAMAGED", "NEAR_EXPIRY", "WRONG_ITEM", "OVER_ORDERED", "OTHER"] as ReturnReason[]).map((r) => (
                        <option key={r} value={r}>
                          {RETURN_REASON_META[r].label}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="What did the customer report?" />
        <button type="button" onClick={() => setPhotos((p) => p + 1)} className={btn.secondary}>
          <Camera className="size-4" aria-hidden /> {photos ? `${photos} photo(s) attached` : "Attach photo"}
        </button>
        <p className="text-xs text-apptext-secondary">
          Returns of {formatCurrency(settings.returns.approvalThreshold)} or more, or raised by a role without approval rights, wait for approval.
        </p>
      </div>
    </Modal>
  );
}
