import React from "react";
import Link from "next/link";
import { 
  mockCustomers, 
  mockProducts, 
  mockBatches, 
  mockOrders, 
  mockFinancialAccounts,
  mockSuppliers, 
  mockSearchIntelligence,
  mockDeliveryPersonnel 
} from "@/lib/db/mock-data";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { SearchIntelligence } from "@/components/dashboard/SearchIntelligence";
import { 
  UserCheck, 
  PackagePlus, 
  FileSpreadsheet, 
  Wallet,
  ArrowRight,
  Truck,
  Bike,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  // Compute Key Metrics
  const todaySales = mockOrders
    .filter((o) => o.orderStatus === "DELIVERED")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const totalCogs = mockOrders
    .filter((o) => o.orderStatus === "DELIVERED")
    .reduce((sum, o) => sum + o.items.reduce((iSum, item) => iSum + item.cogsCost, 0), 0);
  const monthNetProfit = todaySales - totalCogs;

  const stockValuation = mockProducts.reduce(
    (sum, p) => sum + p.totalStockUnits * p.basePurchasePrice,
    0
  );

  const customerDue = mockCustomers.reduce((sum, c) => sum + c.currentDue, 0);
  const supplierPayable = mockSuppliers.reduce((sum, s) => sum + s.currentPayable, 0);

  const pendingVerificationCount = mockCustomers.filter(
    (c) => c.verificationStatus === "PENDING" || c.verificationStatus === "UNDER_REVIEW"
  ).length;

  const onDeliveryCount = mockOrders.filter(
    (o) => o.orderStatus === "OUT_FOR_DELIVERY" || o.orderStatus === "DISPATCHED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Welcome Header with Logo & Quick Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/confidence-pharma-logo.jpg"
            alt="Confidence Pharma Logo"
            className="h-12 w-auto object-contain hidden sm:block"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-brand-primary sm:text-2xl">
                Business Control Center
              </h1>
              <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-[10px] font-bold text-brand-primary border border-brand-blue/30">
                Live Production
              </span>
            </div>
            <p className="text-xs text-apptext-secondary mt-0.5">
              One Stop B2B Healthcare & Business Operations Platform
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/delivery"
            className="flex items-center gap-1.5 rounded-xl border border-brand-blue/40 bg-brand-light/40 px-3.5 py-2 text-xs font-bold text-brand-primary shadow-xs transition hover:bg-brand-light"
          >
            <Truck className="h-4 w-4 text-brand-blue" />
            <span>Delivery Fleet ({onDeliveryCount} Active)</span>
          </Link>
          <Link
            href="/purchases"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-apptext-primary shadow-xs transition hover:bg-surface"
          >
            <FileSpreadsheet className="h-4 w-4 text-brand-primary" />
            <span>OCR Purchase</span>
          </Link>
          <Link
            href="/customers"
            className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            <UserCheck className="h-4 w-4 text-brand-light" />
            <span>Review KYC ({pendingVerificationCount})</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <MetricCards
        todaySales={todaySales}
        monthNetProfit={monthNetProfit}
        stockValuation={stockValuation}
        customerDue={customerDue}
        supplierPayable={supplierPayable}
      />

      {/* Fleet & Delivery Active Notification Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-brand-blue/30 bg-gradient-to-r from-brand-light/60 via-white to-brand-light/30 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white shadow-sm">
            <Truck className="h-5 w-5 text-brand-light" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-primary">
              Logistics Status: {onDeliveryCount} Orders Currently on the Road
            </h4>
            <p className="text-[11px] text-apptext-secondary">
              GPS location, Cold Chain verification, and printed challan status available in the logistics center.
            </p>
          </div>
        </div>
        <Link
          href="/delivery"
          className="flex items-center gap-1 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-hover transition whitespace-nowrap self-start sm:self-auto"
        >
          <span>Open Fleet Dispatch</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Verification Notice Banner if items pending */}
      {pendingVerificationCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                {pendingVerificationCount} Healthcare Businesses Waiting for Drug License Verification
              </h4>
              <p className="text-[11px] text-amber-700">
                Pharmacies cannot place wholesale medicine orders until approved or granted audit exception.
              </p>
            </div>
          </div>
          <Link
            href="/customers"
            className="flex items-center gap-1 rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-800 transition"
          >
            <span>Review KYC</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Middle Grid: Orders & Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrders orders={mockOrders} />
        </div>
        <div>
          <StockAlerts batches={mockBatches} />
        </div>
      </div>

      {/* Bottom Grid: Search Intelligence & Multi-Account Balances */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SearchIntelligence searches={mockSearchIntelligence} />
        </div>

        {/* Financial Accounts Snapshot */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-brand-light p-2 text-brand-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-primary">Cash & MFS Accounts</h2>
                <p className="text-xs text-apptext-secondary">Operating liquidity accounts</p>
              </div>
            </div>
            <Link
              href="/accounts"
              className="text-xs font-bold text-brand-blue hover:text-brand-primary transition"
            >
              Ledgers
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {mockFinancialAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-surface transition"
              >
                <div>
                  <p className="text-xs font-bold text-apptext-primary">{acc.accountName}</p>
                  <span className="text-[10px] text-apptext-secondary uppercase font-mono">
                    {acc.accountType} {acc.accountNumber && `• ${acc.accountNumber}`}
                  </span>
                </div>
                <span className="text-xs font-bold text-brand-primary font-mono">
                  {formatCurrency(acc.currentBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
