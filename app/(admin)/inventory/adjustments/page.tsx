"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Info, Plus, ShieldAlert, TrendingDown, TrendingUp, X } from "lucide-react";
import { AdjustmentReason, ApprovalStatus, StockAdjustment } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/db/inventory-data";
import { APPROVAL_META, REASON_META, formatBase, formatDateTime } from "@/lib/inventory";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, EmptyState, FilterPills, Modal, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { AdjustStockModal } from "@/components/inventory/AdjustStockModal";

type StatusFilter = "ALL" | ApprovalStatus;

export default function AdjustmentsPage() {
  return (
    <Suspense>
      <AdjustmentsView />
    </Suspense>
  );
}

function AdjustmentsView() {
  const params = useSearchParams();
  const { adjustments, itemById, batchById, warehouseById, warehouseFilter, approveAdjustment, rejectAdjustment } = useInventory();

  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) || "ALL");
  const [reason, setReason] = useState<"ALL" | AdjustmentReason>("ALL");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [review, setReview] = useState<{ adj: StockAdjustment; action: "approve" | "reject" } | null>(null);

  const scoped = useMemo(
    () =>
      adjustments.filter((a) => warehouseFilter === "ALL" || a.warehouseId === warehouseFilter),
    [adjustments, warehouseFilter]
  );

  const stats = useMemo(() => {
    const pending = scoped.filter((a) => a.status === "PENDING");
    const approved = scoped.filter((a) => a.status === "APPROVED");
    return {
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, a) => s + Math.abs(a.costImpact), 0),
      losses: approved.filter((a) => a.costImpact < 0).reduce((s, a) => s + Math.abs(a.costImpact), 0),
      gains: approved.filter((a) => a.costImpact > 0).reduce((s, a) => s + a.costImpact, 0),
    };
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((a) => {
      if (status !== "ALL" && a.status !== status) return false;
      if (reason !== "ALL" && a.reason !== reason) return false;
      if (!q) return true;
      return [a.id, a.note, a.requestedBy, itemById[a.itemId].name, batchById[a.batchId]?.batchNumber ?? ""].some((f) =>
        f.toLowerCase().includes(q)
      );
    });
  }, [scoped, status, reason, query, itemById, batchById]);

  const count = (s: StatusFilter) => (s === "ALL" ? scoped.length : scoped.filter((a) => a.status === s).length);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatCard
          label="Awaiting approval"
          value={stats.pendingCount}
          hint={stats.pendingCount ? `${formatCurrency(stats.pendingValue)} in write-offs` : "Nothing to review"}
          icon={ShieldAlert}
          tone={stats.pendingCount ? "amber" : "slate"}
          active={status === "PENDING"}
          onClick={() => setStatus(status === "PENDING" ? "ALL" : "PENDING")}
        />
        <StatCard label="Approved losses" value={formatCurrency(stats.losses)} hint="Damage, expiry and shortages" icon={TrendingDown} tone="rose" />
        <StatCard label="Approved gains" value={formatCurrency(stats.gains)} hint="Found stock and count surpluses" icon={TrendingUp} tone="green" />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills
              label="Approval status"
              value={status}
              onChange={setStatus}
              options={[
                { id: "ALL", label: "All", count: count("ALL") },
                { id: "PENDING", label: "Awaiting approval", count: count("PENDING") },
                { id: "APPROVED", label: "Approved", count: count("APPROVED") },
                { id: "REJECTED", label: "Rejected", count: count("REJECTED") },
              ]}
            />
            <button className={btn.primary} onClick={() => setShowNew(true)}>
              <Plus className="size-4" aria-hidden />
              New adjustment
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search ID, product, batch, note or person" className="flex-1" />
            <select
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as "ALL" | AdjustmentReason)}
              className={cn(inputClass, "sm:w-56")}
            >
              <option value="ALL">All reasons</option>
              {(Object.keys(REASON_META) as AdjustmentReason[]).map((r) => (
                <option key={r} value={r}>
                  {REASON_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <p className="flex items-start gap-2 text-xs text-apptext-secondary">
            <Info className="mt-px size-3.5 shrink-0 text-brand-blue" aria-hidden />
            Write-offs of {formatCurrency(APPROVAL_THRESHOLD)} or more wait for Super Admin approval before stock changes.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No adjustments" description="Nothing matches these filters." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((a) => {
              const item = itemById[a.itemId];
              const batch = batchById[a.batchId];
              return (
                <li
                  key={a.id}
                  className={cn(
                    "grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-12 xl:items-center",
                    a.status === "PENDING" && "bg-amber-50/40"
                  )}
                >
                  <div className="xl:col-span-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-primary">{a.id}</span>
                      <Badge className={APPROVAL_META[a.status].badge}>{APPROVAL_META[a.status].label}</Badge>
                    </div>
                    <p className="mt-1 font-medium text-apptext-primary">{item.name}</p>
                    <p className="text-xs text-apptext-secondary">
                      <span className="font-mono">{batch?.batchNumber}</span> · {warehouseById[a.warehouseId].name}
                    </p>
                  </div>
                  <div className="xl:col-span-3">
                    <p className="text-sm font-medium text-apptext-primary">{REASON_META[a.reason].label}</p>
                    <p className="text-xs text-apptext-secondary">{a.note}</p>
                  </div>
                  <div className="tabular-nums xl:col-span-2 xl:text-right">
                    <p className={cn("font-semibold", a.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700")}>
                      {a.quantityDelta > 0 ? "+" : "−"}
                      {formatBase(Math.abs(a.quantityDelta), item)}
                    </p>
                    <p className="text-xs text-apptext-secondary">
                      {a.previousQuantity.toLocaleString("en-US")} → {a.newQuantity.toLocaleString("en-US")}
                    </p>
                    <p className={cn("text-xs font-medium", a.costImpact < 0 ? "text-rose-700" : "text-emerald-700")}>
                      {a.costImpact < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(a.costImpact))}
                    </p>
                  </div>
                  <div className="text-xs text-apptext-secondary xl:col-span-2">
                    <p>
                      Requested by <span className="text-apptext-primary">{a.requestedBy}</span>
                    </p>
                    <p>{formatDateTime(a.date)}</p>
                    {a.reviewedBy && a.status !== "PENDING" && (
                      <p className="mt-0.5">
                        {a.status === "APPROVED" ? "Approved" : "Rejected"} by {a.reviewedBy}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 xl:col-span-1 xl:justify-end">
                    {a.status === "PENDING" && (
                      <>
                        <button
                          aria-label={`Approve ${a.id}`}
                          title="Approve"
                          onClick={() => setReview({ adj: a, action: "approve" })}
                          className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          aria-label={`Reject ${a.id}`}
                          title="Reject"
                          onClick={() => setReview({ adj: a, action: "reject" })}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showNew && <AdjustStockModal onClose={() => setShowNew(false)} />}

      {review && (
        <Modal
          title={review.action === "approve" ? "Approve adjustment" : "Reject adjustment"}
          subtitle={<span className="font-mono">{review.adj.id}</span>}
          onClose={() => setReview(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setReview(null)}>
                Cancel
              </button>
              <button
                className={review.action === "approve" ? btn.success : btn.danger}
                onClick={() => {
                  if (review.action === "approve") approveAdjustment(review.adj.id);
                  else rejectAdjustment(review.adj.id);
                  setReview(null);
                }}
              >
                {review.action === "approve" ? "Approve as Super Admin" : "Reject"}
              </button>
            </>
          }
        >
          <dl className="space-y-2 text-sm">
            {[
              ["Product", itemById[review.adj.itemId].name],
              ["Batch", batchById[review.adj.batchId]?.batchNumber ?? "—"],
              ["Reason", REASON_META[review.adj.reason].label],
              ["Note", review.adj.note],
              ["Change", formatBase(review.adj.quantityDelta, itemById[review.adj.itemId])],
              ["Cost impact", formatCurrency(review.adj.costImpact)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-apptext-secondary">{k}</dt>
                <dd className="text-right font-medium text-apptext-primary">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-surface p-3 text-xs text-apptext-secondary">
            {review.action === "approve"
              ? "Stock is updated immediately and the loss is posted to the stock ledger."
              : "Stock stays as it is. The request remains in the audit trail as rejected."}
          </p>
        </Modal>
      )}
    </>
  );
}
