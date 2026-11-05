"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, CheckCircle2, ClipboardCheck, FileText, History, PackageCheck, ThumbsDown, ThumbsUp, Truck, Undo2, User } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { RETURN_REASON_META, RETURN_SOURCE_META, RETURN_STATUS_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { Badge, btn, Card, CardHeader, EmptyState, inputClass, Modal } from "@/components/ui";
import { CreditNoteModal, InspectionPanel, ReceiveModal } from "@/components/returns/ReturnForms";
import { RiderAvatar } from "@/components/delivery/shared";

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { returns, creditNotes, riderById, riders, orderById, approveRma, rejectRma, markRmaPickedUp, can } = useAppStore();
  const { movements, batchById } = useInventory();
  const ret = returns.find((r) => r.id === id);
  const [receiving, setReceiving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pickupRider, setPickupRider] = useState("");
  const [cnOpen, setCnOpen] = useState(false);

  if (!ret) {
    return (
      <Card>
        <EmptyState icon={Undo2} title="Return not found" action={<Link href="/returns" className={btn.primary}>Back to returns</Link>} />
      </Card>
    );
  }

  const rider = ret.riderId ? riderById[ret.riderId] : undefined;
  const order = orderById[ret.orderId];
  const creditNote = creditNotes.find((c) => c.id === ret.creditNoteId);
  const stockMoves = movements.filter((m) => m.reference === ret.returnNumber);
  const isRma = ret.source === "CUSTOMER_RMA";

  const steps = isRma
    ? [
        { key: "REQUESTED", label: "Requested", at: ret.createdAt, by: ret.createdBy },
        { key: "APPROVED", label: "Approved", by: ret.approvedBy },
        { key: "IN_TRANSIT", label: "Picked up", by: rider?.name },
        { key: "RECEIVED", label: "Received", at: ret.receivedAt, by: ret.receivedBy },
        { key: "COMPLETED", label: "Inspected & credited", at: ret.inspectedAt, by: ret.inspectedBy },
      ]
    : [
        { key: "RECORDED", label: "Recorded at door", at: ret.createdAt, by: ret.createdBy },
        { key: "IN_TRANSIT", label: "With rider", by: rider?.name },
        { key: "RECEIVED", label: "Received at hub", at: ret.receivedAt, by: ret.receivedBy },
        { key: "COMPLETED", label: "Inspected & restocked", at: ret.inspectedAt, by: ret.inspectedBy },
      ];
  const order_ = isRma ? ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "COMPLETED"] : ["RECORDED", "IN_TRANSIT", "RECEIVED", "COMPLETED"];
  const currentIdx = ret.status === "REJECTED" ? 0 : order_.indexOf(ret.status === "IN_TRANSIT" && !isRma ? "IN_TRANSIT" : ret.status);

  return (
    <div className="space-y-5">
      <Link href="/returns" className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary">
        <ArrowLeft className="size-4" aria-hidden /> Returns
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold text-brand-primary">{ret.returnNumber}</h1>
            <Badge className={RETURN_STATUS_META[ret.status].badge}>{RETURN_STATUS_META[ret.status].label}</Badge>
            <Badge className={RETURN_SOURCE_META[ret.source].badge}>{RETURN_SOURCE_META[ret.source].label}</Badge>
          </div>
          <p className="mt-1 text-sm text-apptext-secondary">
            {ret.customerName} · order{" "}
            <Link href={`/orders/${ret.orderId}`} className="font-mono font-medium text-brand-primary hover:underline">
              {ret.orderNumber}
            </Link>{" "}
            · value {formatCurrency(ret.totalValue)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ret.status === "REQUESTED" && can("returns", "approve") && (
            <>
              <button onClick={() => setRejecting(true)} className={btn.secondary}>
                <ThumbsDown className="size-4" aria-hidden /> Reject
              </button>
              <button onClick={() => approveRma(ret.id)} className={btn.success}>
                <ThumbsUp className="size-4" aria-hidden /> Approve return
              </button>
            </>
          )}
          {(ret.status === "IN_TRANSIT" || ret.status === "APPROVED") && can("returns", "edit") && (
            <button onClick={() => setReceiving(true)} className={btn.primary}>
              <PackageCheck className="size-4" aria-hidden /> Receive at warehouse
            </button>
          )}
          {creditNote && (
            <button onClick={() => setCnOpen(true)} className={btn.secondary}>
              <FileText className="size-4" aria-hidden /> Credit note {creditNote.creditNoteNumber}
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <Card className="p-4">
        <ol className="grid grid-cols-1 gap-3 sm:grid-flow-col sm:grid-cols-none">
          {steps.map((s, i) => {
            const done = ret.status !== "REJECTED" && i <= currentIdx;
            const current = i === currentIdx && ret.status !== "COMPLETED";
            return (
              <li key={s.key} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done && !current ? "bg-emerald-500 text-white" : current ? "bg-brand-primary text-white ring-4 ring-brand-light" : "bg-slate-100 text-slate-400"
                  )}
                >
                  {done && !current ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", done ? "text-apptext-primary" : "text-slate-400")}>{s.label}</span>
                  {done && (s.at || s.by) && (
                    <span className="block text-xs text-apptext-secondary">
                      {s.at && formatDateTime(s.at)}
                      {s.by && ` · ${s.by}`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        {ret.status === "REJECTED" && <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Rejected: {ret.rejectedReason}</p>}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {ret.status === "RECEIVED" ? (
            <Card>
              <CardHeader title="Inspect and restock" description="Split each line into sellable and not sellable. Sellable packs go back into the batch they came from." />
              <div className="p-4">
                <InspectionPanel ret={ret} onDone={(c) => c && setCnOpen(true)} />
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Returned items" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Item</th>
                      <th className="px-3 py-2.5 font-medium">Reason</th>
                      <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                      <th className="px-3 py-2.5 text-right font-medium">Received</th>
                      <th className="px-3 py-2.5 text-right font-medium">Restocked</th>
                      <th className="px-3 py-2.5 text-right font-medium">Quarantined</th>
                      <th className="px-5 py-2.5 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ret.lines.map((l) => (
                      <tr key={l.orderItemId}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-apptext-primary">{l.productName}</p>
                          <p className="text-xs text-apptext-secondary">
                            {l.packSizeName}
                            {l.batchId && batchById[l.batchId] && <span className="font-mono"> · {batchById[l.batchId].batchNumber}</span>}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-apptext-secondary">{RETURN_REASON_META[l.reason].label}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{l.quantity}</td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", l.receivedQuantity !== undefined && l.receivedQuantity < l.quantity && "font-semibold text-rose-600")}>{l.receivedQuantity ?? "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{l.sellableQuantity ?? "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-rose-600">{l.damagedQuantity ?? "—"}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCurrency(l.quantity * l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ret.status === "IN_TRANSIT" && !isRma && (
                <p className="border-t border-slate-100 px-5 py-3 text-sm text-apptext-secondary">
                  Waiting for {rider?.name ?? "the rider"} to hand these over.{" "}
                  <Link href="/delivery?tab=settlement" className="font-medium text-brand-primary underline">
                    Settle the rider
                  </Link>{" "}
                  to receive cash and goods together.
                </p>
              )}
              {ret.status === "APPROVED" && (
                <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center">
                  <span className="text-sm text-apptext-secondary">Schedule pickup with</span>
                  <select value={pickupRider} onChange={(e) => setPickupRider(e.target.value)} className={cn(inputClass, "py-1.5 sm:w-56")} aria-label="Pickup rider">
                    <option value="">Choose rider…</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => markRmaPickedUp(ret.id, pickupRider)} disabled={!pickupRider || !can("returns", "edit")} className={btn.secondary}>
                    <Truck className="size-4" aria-hidden /> Mark picked up
                  </button>
                </div>
              )}
            </Card>
          )}

          {stockMoves.length > 0 && (
            <Card>
              <CardHeader
                title="Stock movements"
                description="Posted to the inventory ledger"
                actions={
                  <Link href="/inventory/movements" className={btn.small}>
                    <History className="size-3.5" aria-hidden /> Open ledger
                  </Link>
                }
              />
              <ul className="divide-y divide-slate-100">
                {stockMoves.map((m) => {
                  const b = batchById[m.batchId];
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span>
                        <span className="block font-mono text-xs text-apptext-primary">
                          {b?.batchNumber} · {b?.location}
                        </span>
                        <span className="block text-xs text-apptext-secondary">{m.note}</span>
                      </span>
                      <span className={cn("font-semibold tabular-nums", b?.hold === "QUARANTINE" ? "text-rose-600" : "text-emerald-700")}>+{m.quantity.toLocaleString("en-US")}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-apptext-primary">Details</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Created">{formatDateTime(ret.createdAt)}</Row>
              <Row label="By">{ret.createdBy}</Row>
              {ret.approvedBy && <Row label="Approved by">{ret.approvedBy}</Row>}
              {(ret.shortageQuantity ?? 0) > 0 && (
                <Row label="Shortage">
                  <span className="font-semibold text-rose-600">{ret.shortageQuantity} pack(s)</span>
                </Row>
              )}
              {ret.photoCount ? (
                <Row label="Photos">
                  <span className="inline-flex items-center gap-1">
                    <Camera className="size-3.5" aria-hidden /> {ret.photoCount}
                  </span>
                </Row>
              ) : null}
            </dl>
            {ret.note && <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-apptext-primary">{ret.note}</p>}
            {ret.photoCount ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: ret.photoCount }).map((_, i) => (
                  <div key={i} className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <Camera className="size-5" aria-hidden />
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          {rider && (
            <Card className="flex items-center gap-3 p-4">
              <RiderAvatar name={rider.name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-apptext-primary">{rider.name}</p>
                <p className="text-xs text-apptext-secondary">{rider.phone}</p>
              </div>
              <a href={`tel:${rider.phone}`} className={btn.small} aria-label={`Call ${rider.name}`}>
                Call
              </a>
            </Card>
          )}

          {order && (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-apptext-primary">
                <User className="size-4 text-slate-400" aria-hidden /> Customer
              </h2>
              <p className="font-medium text-apptext-primary">{order.customerName}</p>
              <p className="text-xs text-apptext-secondary">{order.address}</p>
              <p className="mt-2 text-sm">
                Order total {formatCurrency(order.grandTotal)}
                {order.originalGrandTotal && <span className="ml-1 text-xs text-slate-400 line-through">{formatCurrency(order.originalGrandTotal)}</span>}
              </p>
            </Card>
          )}

          {ret.status === "COMPLETED" && (
            <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50/60 p-4">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-emerald-900">Return closed</p>
                <p className="text-emerald-800">
                  {ret.lines.reduce((s, l) => s + (l.sellableQuantity ?? 0), 0)} restocked · {ret.lines.reduce((s, l) => s + (l.damagedQuantity ?? 0), 0)} quarantined
                </p>
                {ret.lines.some((l) => (l.damagedQuantity ?? 0) > 0) && (
                  <Link href="/inventory/batches" className="mt-1 inline-flex items-center gap-1 font-medium text-emerald-900 underline">
                    <ClipboardCheck className="size-3.5" aria-hidden /> Dispose quarantined stock
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {receiving && <ReceiveModal ret={ret} onClose={() => setReceiving(false)} />}
      {cnOpen && creditNote && <CreditNoteModal cn={creditNote} onClose={() => setCnOpen(false)} />}
      {rejecting && (
        <Modal
          title="Reject return request"
          subtitle={ret.returnNumber}
          onClose={() => setRejecting(false)}
          footer={
            <>
              <button onClick={() => setRejecting(false)} className={btn.secondary}>
                Cancel
              </button>
              <button
                disabled={rejectReason.trim().length < 5}
                onClick={() => {
                  rejectRma(ret.id, rejectReason.trim());
                  setRejecting(false);
                }}
                className={btn.danger}
              >
                Reject
              </button>
            </>
          }
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-apptext-primary">Reason shown to the customer</span>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className={inputClass} placeholder="e.g. Outside the 7-day return window; seal broken by customer" />
          </label>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-apptext-secondary">{label}</dt>
      <dd className="text-right text-apptext-primary">{children}</dd>
    </div>
  );
}
