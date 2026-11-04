"use client";

import React, { useState } from "react";
import { mockCustomers } from "@/lib/db/mock-data";
import { Customer, VerificationStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck, 
  UserX, 
  MapPin, 
  Phone, 
  Check, 
  X, 
  Lock,
  Building,
  CheckCircle2
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [exceptionReason, setExceptionReason] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) => statusFilter === "ALL" || c.verificationStatus === statusFilter
  );

  const handleApprove = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              verificationStatus: "APPROVED",
              approvedBy: "Super Admin (Dr. TC Dey)",
              approvedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setNotification(`Customer verified and approved successfully!`);
    setTimeout(() => setNotification(null), 4000);
    setSelectedCustomer(null);
  };

  const handleReject = () => {
    if (!selectedCustomer || !rejectReason.trim()) return;

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === selectedCustomer.id
          ? {
              ...c,
              verificationStatus: "REJECTED",
              rejectionReason: rejectReason,
            }
          : c
      )
    );

    setNotification(`Customer KYC rejected. Reason recorded for customer re-upload.`);
    setTimeout(() => setNotification(null), 4000);
    setShowRejectModal(false);
    setSelectedCustomer(null);
    setRejectReason("");
  };

  const handleExceptionApprove = () => {
    if (!selectedCustomer || !exceptionReason.trim()) return;

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === selectedCustomer.id
          ? {
              ...c,
              verificationStatus: "APPROVED",
              isExceptionApproval: true,
              exceptionReason: exceptionReason,
              approvedBy: "Super Admin (Dr. TC Dey)",
              approvedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setNotification(`Customer approved under Super Admin Audit Exception.`);
    setTimeout(() => setNotification(null), 4000);
    setShowExceptionModal(false);
    setSelectedCustomer(null);
    setExceptionReason("");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
            B2B Customer Directory & KYC Verification
          </h1>
          <p className="text-xs text-apptext-secondary text-pretty">
            Strict statutory verification studio for pharmacies, clinics, and diagnostic establishments (SRS §2, §3 & §43)
          </p>
        </div>

        <div className="flex gap-2">
          {["ALL", "PENDING", "UNDER_REVIEW", "APPROVED", "SUSPENDED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === st
                  ? "bg-brand-primary text-white shadow-xs"
                  : "border border-slate-200 bg-white text-apptext-secondary hover:bg-surface"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-brand-green">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-green" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Customer Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface border-b border-slate-200 text-apptext-secondary font-semibold uppercase text-[11px]">
            <tr>
              <th className="py-3 px-4">Business & Owner</th>
              <th className="py-3 px-4">Entity Type</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4">KYC Status</th>
              <th className="py-3 px-4">Credit / Due</th>
              <th className="py-3 px-4 text-right">Verification Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((cust) => (
              <tr key={cust.id} className="hover:bg-surface/80 transition">
                <td className="py-3.5 px-4">
                  <p className="font-bold text-apptext-primary">{cust.businessName}</p>
                  <p className="text-[11px] text-apptext-secondary">
                    {cust.ownerName} • <span className="font-mono">{cust.phone}</span>
                  </p>
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <Building className="size-3 text-brand-blue" />
                    {cust.customerType}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400" />
                    {cust.address.upazilaArea}, {cust.address.district}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      cust.verificationStatus === "APPROVED"
                        ? "bg-emerald-50 text-brand-green border border-emerald-200"
                        : cust.verificationStatus === "UNDER_REVIEW"
                        ? "bg-blue-50 text-brand-blue border border-blue-200"
                        : cust.verificationStatus === "PENDING"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {cust.verificationStatus}
                  </span>
                  {cust.isExceptionApproval && (
                    <span className="block mt-0.5 text-[9px] font-bold text-indigo-600">
                      ★ Super Admin Exception
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <p className="font-bold text-apptext-primary font-mono tabular-nums">{formatCurrency(cust.currentDue)} Due</p>
                  <p className="text-[10px] text-slate-400 font-mono tabular-nums">Limit: {formatCurrency(cust.creditLimit)}</p>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => setSelectedCustomer(cust)}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-surface px-3 py-1.5 text-xs font-bold text-brand-primary transition shadow-2xs"
                  >
                    Inspect KYC Docs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* KYC Inspector Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-blue">
                  DRUG ADMINISTRATION & STATUTORY VERIFICATION
                </span>
                <h3 className="text-base font-bold text-brand-primary">
                  KYC Verification: {selectedCustomer.businessName}
                </h3>
                <p className="text-xs text-apptext-secondary">
                  Owner: {selectedCustomer.ownerName} • Phone: {selectedCustomer.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Document Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Uploaded Statutory Documents
              </h4>
              {selectedCustomer.documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center">
                  <AlertTriangle className="mx-auto size-6 text-amber-500 mb-1" />
                  <p className="text-xs font-bold text-amber-800">No Documents Uploaded Yet</p>
                  <p className="text-[11px] text-amber-700">
                    Customer registered via app without uploading Drug License / Trade License yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedCustomer.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 p-3 bg-surface"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-apptext-primary">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                        {doc.isVerified ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-green">
                            Verified
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-apptext-secondary mt-1">
                        No: {doc.documentNumber || "N/A"}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                        <span className="font-semibold text-brand-blue cursor-pointer hover:underline">
                          Inspect License Scan
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowExceptionModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <Lock className="size-3.5 text-indigo-600" />
                <span>Super Admin Audit Override</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  Reject & Request Re-upload
                </button>
                <button
                  onClick={() => handleApprove(selectedCustomer.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
                >
                  <Check className="size-4" />
                  <span>Verify & Approve Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exception Reason Dialog */}
      {showExceptionModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-primary">
                  Audit-Safe Exception Approval (SRS §3)
                </h3>
                <p className="text-xs text-apptext-secondary">
                  Approving without statutory documentation will be permanently recorded in the system audit log.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-apptext-primary mb-1">
                Mandatory Approval Justification Reason:
              </label>
              <textarea
                rows={3}
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="e.g. Verified via direct offline visit by Area Sales Manager; urgent flood clinic order..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowExceptionModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={!exceptionReason.trim()}
                onClick={handleExceptionApprove}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                Record in Audit Log & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {showRejectModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
                <UserX className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  Reject Customer Verification
                </h3>
                <p className="text-xs text-rose-700">
                  Customer will be notified in the Android App with the reason to re-upload clear licenses.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-apptext-primary mb-1">
                Reason for Rejection / Re-upload Request:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Drug license scan is blurry / Expired validity date..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={handleReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                Submit Rejection & Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
