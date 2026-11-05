"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, Download, FileText, PackageCheck, Plus, RotateCcw, ShieldAlert, Truck, Undo2 } from "lucide-react";
import { CreditNote, ReturnRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { RETURN_REASON_META, RETURN_SOURCE_META, RETURN_STATUS_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn, Card, EmptyState, FilterPills, PageHeader, SearchInput, StatCard, Tabs } from "@/components/ui";
import { CreditNoteModal, NewRmaModal } from "@/components/returns/ReturnForms";
import { packUnitOf } from "@/components/orders/shared";
import { qtyText } from "@/lib/units";

type View = "returns" | "credit";
type Filter = "ALL" | "IN_TRANSIT" | "RECEIVED" | "RMA" | "COMPLETED" | "REJECTED";

const FLOW = [
  { icon: Undo2, title: "Recorded at the door", text: "Rider enters accepted vs returned qty and reason." },
  { icon: Truck, title: "With rider", text: "Goods stay in rider custody until the hub." },
  { icon: PackageCheck, title: "Received", text: "Counted at settlement. Shortages flagged." },
  { icon: ClipboardCheck, title: "Inspected", text: "Sellable → original batch. Damaged → quarantine." },
  { icon: FileText, title: "Credit note", text: "Customer ledger adjusted and audit-logged." },
];

export default function ReturnsPage() {
  const router = useRouter();
  const { returns, creditNotes, riderById, can } = useAppStore();
  const [view, setView] = useState<View>("returns");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [rmaOpen, setRmaOpen] = useState(false);
  const [cnOpen, setCnOpen] = useState<CreditNote | null>(null);

  const isRma = (r: ReturnRecord) => r.source === "CUSTOMER_RMA" && (r.status === "REQUESTED" || r.status === "APPROVED");
  const counts = {
    ALL: returns.length,
    IN_TRANSIT: returns.filter((r) => r.status === "IN_TRANSIT").length,
    RECEIVED: returns.filter((r) => r.status === "RECEIVED").length,
    RMA: returns.filter(isRma).length,
    COMPLETED: returns.filter((r) => r.status === "COMPLETED").length,
    REJECTED: returns.filter((r) => r.status === "REJECTED").length,
  };

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return returns
      .filter((r) => {
        if (filter === "RMA") return isRma(r);
        if (filter !== "ALL") return r.status === filter;
        return true;
      })
      .filter((r) => !q || `${r.returnNumber} ${r.orderNumber} ${r.customerName} ${r.lines.map((l) => l.productName).join(" ")}`.toLowerCase().includes(q));
  }, [returns, filter, query]);

  const sum = (rs: ReturnRecord[]) => rs.reduce((s, r) => s + r.totalValue, 0);
  const restocked = returns.reduce((s, r) => s + r.lines.reduce((n, l) => n + (l.sellableQuantity ?? 0), 0), 0);
  const quarantined = returns.reduce((s, r) => s + r.lines.reduce((n, l) => n + (l.damagedQuantity ?? 0), 0), 0);

  const exportCsv = () => {
    const rows = [
      ["Return", "Source", "Status", "Order", "Customer", "Product", "Qty", "Reason", "Received", "Sellable", "Damaged", "Value"],
      ...returns.flatMap((r) =>
        r.lines.map((l) => [r.returnNumber, r.source, r.status, r.orderNumber, r.customerName, l.productName, l.quantity, l.reason, l.receivedQuantity ?? "", l.sellableQuantity ?? "", l.damagedQuantity ?? "", (l.quantity * l.unitPrice).toFixed(2)])
      ),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "returns.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Returns"
        description="Goods coming back from partial or failed deliveries and customer return requests: receive, inspect, restock and credit."
        actions={
          <>
            {can("returns", "export") && (
              <button onClick={exportCsv} className={btn.secondary}>
                <Download className="size-4" aria-hidden /> Export
              </button>
            )}
            {can("returns", "create") && (
              <button onClick={() => setRmaOpen(true)} className={btn.primary}>
                <Plus className="size-4" aria-hidden /> New customer return
              </button>
            )}
          </>
        }
      />

      {/* Flow explainer */}
      <ol className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:grid-cols-5">
        {FLOW.map((f, i) => (
          <li key={f.title} className="flex items-start gap-2.5 rounded-lg p-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
              <f.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-apptext-primary">
                {i + 1}. {f.title}
              </span>
              <span className="block text-xs text-apptext-secondary">{f.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="With riders" value={counts.IN_TRANSIT} hint={formatCurrency(sum(returns.filter((r) => r.status === "IN_TRANSIT")))} icon={Truck} tone="amber" onClick={() => setFilter("IN_TRANSIT")} active={filter === "IN_TRANSIT"} />
        <StatCard label="To inspect" value={counts.RECEIVED} hint="In returns bay" icon={ClipboardCheck} tone="violet" onClick={() => setFilter("RECEIVED")} active={filter === "RECEIVED"} />
        <StatCard label="RMA requests" value={counts.RMA} hint="Approve or schedule pickup" icon={RotateCcw} tone="blue" onClick={() => setFilter("RMA")} active={filter === "RMA"} />
        <StatCard label="Packs restocked" value={restocked} hint="Back in sellable stock" icon={PackageCheck} tone="green" />
        <StatCard label="Packs quarantined" value={quarantined} hint="Damaged / expired" icon={ShieldAlert} tone="rose" />
        <StatCard label="Credit notes" value={formatCurrency(creditNotes.reduce((s, c) => s + c.amount, 0))} hint={`${creditNotes.length} issued`} icon={FileText} tone="slate" onClick={() => setView("credit")} active={view === "credit"} />
      </div>

      <Tabs
        value={view}
        onChange={setView}
        label="Returns views"
        tabs={[
          { id: "returns", label: "Returns", count: returns.length, icon: Undo2 },
          { id: "credit", label: "Credit notes", count: creditNotes.length, icon: FileText },
        ]}
      />

      {view === "returns" && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills
              value={filter}
              onChange={setFilter}
              label="Filter returns"
              options={[
                { id: "ALL", label: "All", count: counts.ALL },
                { id: "IN_TRANSIT", label: "With riders", count: counts.IN_TRANSIT },
                { id: "RECEIVED", label: "To inspect", count: counts.RECEIVED },
                { id: "RMA", label: "Requests", count: counts.RMA },
                { id: "COMPLETED", label: "Completed", count: counts.COMPLETED },
                { id: "REJECTED", label: "Rejected", count: counts.REJECTED },
              ]}
            />
            <SearchInput value={query} onChange={setQuery} placeholder="Search return, order, customer, product" className="lg:w-72" />
          </div>

          {list.length === 0 ? (
            <EmptyState icon={Undo2} title="No returns here" description="Try another filter." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Return</th>
                      <th className="px-3 py-2.5 font-medium">Customer / order</th>
                      <th className="px-3 py-2.5 font-medium">Items</th>
                      <th className="px-3 py-2.5 font-medium">Rider</th>
                      <th className="px-3 py-2.5 text-right font-medium">Value</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((r) => (
                      <tr key={r.id} onClick={() => router.push(`/returns/${r.id}`)} className="cursor-pointer hover:bg-surface/60">
                        <td className="px-5 py-3 align-top">
                          <p className="font-mono text-sm font-medium text-brand-primary">{r.returnNumber}</p>
                          <Badge className={cn("mt-1", RETURN_SOURCE_META[r.source].badge)}>{RETURN_SOURCE_META[r.source].label}</Badge>
                          <p className="mt-1 text-xs text-apptext-secondary">{formatDateTime(r.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium text-apptext-primary">{r.customerName}</p>
                          <p className="font-mono text-xs text-apptext-secondary">{r.orderNumber}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {r.lines.map((l) => (
                            <p key={l.orderItemId} className="text-apptext-primary">
                              <span className="font-semibold tabular-nums">{qtyText(l.quantity, packUnitOf(l))}</span> {l.productName}
                              <span className="block text-xs text-apptext-secondary">{RETURN_REASON_META[l.reason].label}</span>
                            </p>
                          ))}
                        </td>
                        <td className="px-3 py-3 align-top text-apptext-secondary">{r.riderId ? riderById[r.riderId]?.name : "—"}</td>
                        <td className="px-3 py-3 text-right align-top font-semibold tabular-nums">{formatCurrency(r.totalValue)}</td>
                        <td className="px-3 py-3 align-top">
                          <Badge className={RETURN_STATUS_META[r.status].badge}>{RETURN_STATUS_META[r.status].label}</Badge>
                          {(r.shortageQuantity ?? 0) > 0 && <p className="mt-1 text-xs text-rose-600">{r.shortageQuantity} short</p>}
                        </td>
                        <td className="px-5 py-3 text-right align-top">
                          <ArrowRight className="ml-auto size-4 text-slate-300" aria-hidden />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/returns/${r.id}`} className="block space-y-1.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-medium text-brand-primary">{r.returnNumber}</span>
                        <Badge className={RETURN_STATUS_META[r.status].badge}>{RETURN_STATUS_META[r.status].label}</Badge>
                      </div>
                      <p className="text-sm font-medium text-apptext-primary">{r.customerName}</p>
                      <p className="text-xs text-apptext-secondary">{r.lines.map((l) => `${qtyText(l.quantity, packUnitOf(l))} ${l.productName}`).join(", ")}</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(r.totalValue)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {view === "credit" && (
        <Card>
          {creditNotes.length === 0 ? (
            <EmptyState icon={FileText} title="No credit notes yet" description="Credit notes are issued when a return is inspected." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Credit note</th>
                    <th className="px-3 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium">Reason</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditNotes.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3">
                        <p className="font-mono font-medium text-apptext-primary">{c.creditNoteNumber}</p>
                        <p className="text-xs text-apptext-secondary">{formatDateTime(c.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-apptext-primary">{c.customerName}</p>
                        <p className="font-mono text-xs text-apptext-secondary">{c.orderNumber}</p>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-xs text-apptext-secondary">{c.reason}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(c.amount)}</td>
                      <td className="px-3 py-3">
                        <Badge
                          className={
                            c.status === "ISSUED" ? "border-amber-200 bg-amber-50 text-amber-800" : c.status === "APPLIED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700"
                          }
                        >
                          {c.status === "ISSUED" ? "Issued · open" : c.status === "APPLIED" ? "Applied" : "Refunded"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setCnOpen(c)} className={btn.small}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {rmaOpen && (
        <NewRmaModal
          onClose={() => setRmaOpen(false)}
          onCreated={(r) => {
            setRmaOpen(false);
            router.push(`/returns/${r.id}`);
          }}
        />
      )}
      {cnOpen && <CreditNoteModal cn={cnOpen} onClose={() => setCnOpen(null)} />}
    </div>
  );
}
