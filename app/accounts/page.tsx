"use client";

import React, { useState } from "react";
import { mockFinancialAccounts, mockOrders } from "@/lib/db/mock-data";
import { FinancialAccount } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  Building2, 
  Plus, 
  FileText,
  X,
  CheckCircle2,
  ArrowRightLeft
} from "lucide-react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>(mockFinancialAccounts);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Transfer Form State
  const [fromAccountId, setFromAccountId] = useState(accounts[2]?.id || accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || accounts[0]?.id);
  const [transferAmount, setTransferAmount] = useState<number>(50000);
  const [transferNote, setTransferNote] = useState("Transfer from bKash merchant collection to DBBL Current A/C");

  // Accounting figures
  const totalSales = mockOrders
    .filter((o) => o.orderStatus === "DELIVERED")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const totalCogs = mockOrders
    .filter((o) => o.orderStatus === "DELIVERED")
    .reduce((sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.cogsCost, 0), 0);

  const grossProfit = totalSales - totalCogs;
  const grossMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0";

  const operatingExpenses = 12500;
  const salaryExpenses = 28000;
  const damageLosses = 900;

  const netProfit = grossProfit - operatingExpenses - salaryExpenses - damageLosses;

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId || transferAmount <= 0) {
      alert("Source and destination accounts must be different, and amount must be positive.");
      return;
    }

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    if (!fromAcc || fromAcc.currentBalance < transferAmount) {
      alert("Insufficient balance in source account!");
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - transferAmount };
        }
        if (acc.id === toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + transferAmount };
        }
        return acc;
      })
    );

    setShowTransferModal(false);
    setSuccessBanner(
      `Successfully transferred ${formatCurrency(transferAmount)} from ${fromAcc.accountName} to destination account.`
    );
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
            Financial Management & Real-Time P&L
          </h1>
          <p className="text-xs text-apptext-secondary text-pretty">
            Management accounting, COGS via Weighted Average Cost, and multi-channel liquidity (SRS §30, §31 & §35)
          </p>
        </div>

        <button
          onClick={() => setShowTransferModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
        >
          <ArrowRightLeft className="size-4 text-brand-light" />
          <span>Inter-Account Transfer</span>
        </button>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-brand-green">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-green" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Multi-Account Liquidity Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between text-apptext-secondary">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {acc.accountType}
              </span>
              <div className="rounded-lg bg-brand-light p-1.5 text-brand-primary">
                <Wallet className="size-4" />
              </div>
            </div>
            <h3 className="mt-2 text-xs font-bold text-apptext-primary line-clamp-1">
              {acc.accountName}
            </h3>
            <p className="text-[10px] text-apptext-secondary font-mono">
              {acc.accountNumber || "Cash Safe Register"}
            </p>
            <p className="mt-3 text-lg font-black text-brand-primary font-mono tabular-nums">
              {formatCurrency(acc.currentBalance)}
            </p>
          </div>
        ))}
      </div>

      {/* Real-time Profit & Loss Statement (SRS §30 & §31) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-brand-green">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brand-primary">
                Real-Time Profit & Loss Statement
              </h2>
              <p className="text-xs text-apptext-secondary">
                Gross Profit = Net Sales − COGS | Net Profit = Gross Profit − Expenses − Salaries − Damage
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-brand-green">
            Current Period: Live
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Revenue */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 font-bold text-apptext-primary">
            <span className="text-sm">Delivered Net Sales (Revenue)</span>
            <span className="text-sm font-mono tabular-nums text-brand-green font-black">
              +{formatCurrency(totalSales)}
            </span>
          </div>

          {/* COGS */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-apptext-secondary pl-4">
            <div>
              <p className="font-semibold text-apptext-primary">Less: Cost of Goods Sold (COGS)</p>
              <p className="text-[11px] text-apptext-secondary">
                Calculated on exact weighted average batch purchase costs
              </p>
            </div>
            <span className="font-mono tabular-nums text-rose-600 font-bold">
              -{formatCurrency(totalCogs)}
            </span>
          </div>

          {/* Gross Profit */}
          <div className="flex items-center justify-between py-3 bg-surface px-4 rounded-xl font-black text-apptext-primary">
            <span>
              Gross Profit <span className="text-xs font-normal text-apptext-secondary">({grossMargin}% margin)</span>
            </span>
            <span className="font-mono tabular-nums text-brand-primary text-sm font-black">
              {formatCurrency(grossProfit)}
            </span>
          </div>

          {/* Operating Expenses */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-apptext-secondary pl-4">
            <div>
              <p className="font-semibold text-apptext-primary">Less: Operating Expenses (Rent, Utilities, Fuel)</p>
              <p className="text-[11px] text-apptext-secondary">Itemized bills and operational vouchers</p>
            </div>
            <span className="font-mono tabular-nums text-rose-600 font-bold">
              -{formatCurrency(operatingExpenses)}
            </span>
          </div>

          {/* Salaries */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-apptext-secondary pl-4">
            <div>
              <p className="font-semibold text-apptext-primary">Less: Employee Salaries & Logistics Wages</p>
              <p className="text-[11px] text-apptext-secondary">Warehouse personnel and delivery dispatch staff</p>
            </div>
            <span className="font-mono tabular-nums text-rose-600 font-bold">
              -{formatCurrency(salaryExpenses)}
            </span>
          </div>

          {/* Damaged Stock */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 text-apptext-secondary pl-4">
            <div>
              <p className="font-semibold text-apptext-primary">Less: Damaged / Expired Stock Loss</p>
              <p className="text-[11px] text-apptext-secondary">Unsalable warehouse write-offs</p>
            </div>
            <span className="font-mono tabular-nums text-rose-600 font-bold">
              -{formatCurrency(damageLosses)}
            </span>
          </div>

          {/* Net Profit Banner */}
          <div className="flex items-center justify-between py-3.5 bg-brand-primary text-white px-5 rounded-xl font-black text-sm shadow-xs">
            <span>Net Profit (Final Operational Earnings)</span>
            <span className="font-mono tabular-nums text-base font-black text-brand-light">
              {formatCurrency(netProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* INTER-ACCOUNT TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-brand-primary">Inter-Account Fund Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-apptext-primary mb-1">From Source Account:</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Balance: {formatCurrency(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">To Destination Account:</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Balance: {formatCurrency(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">Transfer Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-brand-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-apptext-primary mb-1">Internal Reference / Note:</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-primary px-5 py-2 font-bold text-white hover:bg-brand-hover shadow-xs"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
