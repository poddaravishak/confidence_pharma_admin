"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, Banknote, Download, HandCoins, MessageCircle, Users, Wallet } from "lucide-react";
import { Order, PaymentChannel } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDay } from "@/lib/inventory";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/orders";
import { OPS_TODAY } from "@/lib/db/operations-data";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn, Card, CardHeader, EmptyState, inputClass, Modal, PageHeader, SearchInput, StatCard } from "@/components/ui";

type Bucket = "0-30" | "31-60" | "61-90" | "90+";
const BUCKETS: Bucket[] = ["0-30", "31-60", "61-90", "90+"];
const BUCKET_TONE: Record<Bucket, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-amber-400",
  "61-90": "bg-orange-500",
  "90+": "bg-rose-600",
};

const today = new Date(`${OPS_TODAY}T12:00:00+06:00`).getTime();
const ageDays = (iso: string) => Math.max(0, Math.floor((today - new Date(iso).getTime()) / 86400000));
const bucketOf = (days: number): Bucket => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");

interface CustomerDue {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  /** Opening balance carried from before the demo orders. */
  opening: number;
  openOrders: Order[];
  total: number;
  buckets: Record<Bucket, number>;
}

export default function ReceivablesPage() {
  const { customers, orders, creditNotes, recordPayment, can } = useAppStore();
  const [query, setQuery] = useState("");
  const [collectFor, setCollectFor] = useState<Order | null>(null);

  const dues = useMemo<CustomerDue[]>(() => {
    return customers
      .map((c) => {
        const openOrders = orders.filter((o) => o.customerId === c.id && o.dueAmount > 0 && (o.orderStatus === "DELIVERED" || o.orderStatus === "PARTIALLY_DELIVERED"));
        const buckets: Record<Bucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
        for (const o of openOrders) buckets[bucketOf(ageDays(o.deliveredAt ?? o.createdAt))] += o.dueAmount;
        // Seeded customer balances are older dues not represented by demo orders: spread them as 31-60 / 61-90.
        const opening = c.currentDue;
        buckets["31-60"] += Math.round(opening * 0.6);
        buckets["61-90"] += opening - Math.round(opening * 0.6);
        const openCredit = creditNotes.filter((n) => n.customerId === c.id && n.status === "ISSUED").reduce((s, n) => s + n.amount, 0);
        const total = Object.values(buckets).reduce((s, v) => s + v, 0) - openCredit;
        return { id: c.id, name: c.businessName, phone: c.phone, creditLimit: c.creditLimit, opening, openOrders, total, buckets };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [customers, orders, creditNotes]);

  const list = dues.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  const totals = BUCKETS.reduce((acc, b) => ({ ...acc, [b]: dues.reduce((s, d) => s + d.buckets[b], 0) }), {} as Record<Bucket, number>);
  const grand = dues.reduce((s, d) => s + d.total, 0);
  const overLimit = dues.filter((d) => d.creditLimit > 0 && d.total > d.creditLimit).length;
  const collectedToday = orders
    .flatMap((o) => o.timeline ?? [])
    .filter((e) => e.status === "PAYMENT" && e.at.slice(0, 10) >= OPS_TODAY)
    .reduce((s, e) => s + (Number(e.label.replace(/[^\d.]/g, "")) || 0), 0);

  const exportCsv = () => {
    const rows = [["Customer", "Phone", "Credit limit", ...BUCKETS, "Total due"], ...dues.map((d) => [d.name, d.phone, d.creditLimit, ...BUCKETS.map((b) => d.buckets[b]), d.total])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer-dues.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer dues & collections"
        description="Outstanding balances by age, credit-limit exposure and payments received against invoices."
        actions={
          can("accounts", "export") && (
            <button onClick={exportCsv} className={btn.secondary}>
              <Download className="size-4" aria-hidden /> Export
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total receivable" value={formatCurrency(grand)} hint={`${dues.length} customers`} icon={Wallet} tone="blue" />
        <StatCard label="Over 60 days" value={formatCurrency(totals["61-90"] + totals["90+"])} hint="Follow up now" icon={AlarmClock} tone="rose" />
        <StatCard label="Over credit limit" value={overLimit} hint="Orders blocked on credit" icon={Users} tone="amber" />
        <StatCard label="Collected today" value={formatCurrency(collectedToday)} hint="Counter, bKash, bank" icon={HandCoins} tone="green" />
      </div>

      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold text-apptext-primary">Aging</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Receivables aging">
          {BUCKETS.map((b) => (
            <div key={b} className={BUCKET_TONE[b]} style={{ width: `${grand ? (totals[b] / grand) * 100 : 0}%` }} />
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BUCKETS.map((b) => (
            <div key={b}>
              <dt className="flex items-center gap-1.5 text-xs text-apptext-secondary">
                <span className={cn("size-2 rounded-full", BUCKET_TONE[b])} /> {b} days
              </dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(totals[b])}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="By customer" actions={<SearchInput value={query} onChange={setQuery} placeholder="Search customer" className="w-56" />} />
        {list.length === 0 ? (
          <EmptyState icon={Wallet} title="No dues" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((d) => {
              const pct = d.creditLimit ? Math.min(100, Math.round((d.total / d.creditLimit) * 100)) : 0;
              return (
                <li key={d.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-apptext-primary">{d.name}</p>
                      <p className="text-xs text-apptext-secondary">
                        {d.phone} · limit {formatCurrency(d.creditLimit)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://wa.me/${d.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Dear ${d.name}, your outstanding balance with Confidence Pharma is ${formatCurrency(d.total)}. Thank you.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={btn.small}
                      >
                        <MessageCircle className="size-3.5 text-emerald-600" aria-hidden /> Remind
                      </a>
                      <p className="text-lg font-bold tabular-nums text-apptext-primary">{formatCurrency(d.total)}</p>
                    </div>
                  </div>
                  {d.creditLimit > 0 && (
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-blue")} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-apptext-secondary">{pct}% of credit limit used</p>
                    </div>
                  )}
                  {(d.openOrders.length > 0 || d.opening > 0) && (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {d.opening > 0 && (
                            <tr className="text-apptext-secondary">
                              <td className="px-3 py-2">Opening balance</td>
                              <td className="px-3 py-2 text-xs">Before 1 Nov</td>
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.opening)}</td>
                              <td className="px-3 py-2" />
                            </tr>
                          )}
                          {d.openOrders.map((o) => {
                            const days = ageDays(o.deliveredAt ?? o.createdAt);
                            return (
                              <tr key={o.id}>
                                <td className="px-3 py-2">
                                  <Link href={`/orders/${o.id}`} className="font-mono text-xs font-medium text-brand-primary hover:underline">
                                    {o.orderNumber}
                                  </Link>
                                </td>
                                <td className="px-3 py-2 text-xs text-apptext-secondary">Delivered {formatDay(o.deliveredAt ?? o.createdAt)}</td>
                                <td className="px-3 py-2">
                                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">{days} days</Badge>
                                </td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(o.dueAmount)}</td>
                                <td className="px-3 py-2 text-right">
                                  {can("accounts", "create") && (
                                    <button onClick={() => setCollectFor(o)} className={btn.small}>
                                      <Banknote className="size-3.5" aria-hidden /> Collect
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {collectFor && <CollectModal order={collectFor} onClose={() => setCollectFor(null)} onSave={(amount, method, ref) => recordPayment(collectFor.id, { amount, method, reference: ref })} />}
    </div>
  );
}

function CollectModal({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: (amount: number, method: PaymentChannel, ref?: string) => void }) {
  const [amount, setAmount] = useState(order.dueAmount);
  const [method, setMethod] = useState<PaymentChannel>("BKASH");
  const [ref, setRef] = useState("");
  const valid = amount > 0 && amount <= order.dueAmount && (method === "CASH" || ref.trim().length >= 4);
  return (
    <Modal
      title="Record payment"
      subtitle={`${order.orderNumber} · ${order.customerName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => {
              onSave(amount, method, ref.trim() || undefined);
              onClose();
            }}
            className={btn.primary}
          >
            Save {formatCurrency(amount)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-surface px-3 py-2 text-sm">
          Due on this invoice: <span className="font-semibold tabular-nums">{formatCurrency(order.dueAmount)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(["CASH", "BKASH", "NAGAD", "BANK"] as PaymentChannel[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", method === m ? "border-brand-primary bg-brand-primary text-white" : "border-slate-200 text-slate-600")}
            >
              {PAYMENT_CHANNEL_LABEL[m]}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Amount (৳)</span>
          <input type="number" min={0} max={order.dueAmount} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className={cn(inputClass, "text-lg font-semibold tabular-nums")} />
        </label>
        {method !== "CASH" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Transaction ID / cheque no.</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} placeholder="e.g. 9KX27Q1M" />
          </label>
        )}
      </div>
    </Modal>
  );
}
