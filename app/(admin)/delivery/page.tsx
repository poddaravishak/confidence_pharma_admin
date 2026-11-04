"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Info,
  MapPin,
  PackageCheck,
  Phone,
  Play,
  Route,
  Smartphone,
  Snowflake,
  Truck,
  Undo2,
  Users,
} from "lucide-react";
import { DeliveryPersonnel, DeliveryRun, Order } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/inventory";
import { amountToCollect, isClosedStatus, ORDER_STATUS_META, RETURN_REASON_META, RETURN_SOURCE_META } from "@/lib/orders";
import { mockDeliveryZoneRules } from "@/lib/db/mock-data";
import { OPS_TODAY } from "@/lib/db/operations-data";
import { useAppStore } from "@/lib/store/AppStore";
import { Badge, btn, Card, CardHeader, EmptyState, Modal, PageHeader, SearchInput, StatCard, Tabs } from "@/components/ui";
import { DeliveryTypeTag, RIDER_STATUS, RiderAvatar, RUN_STATUS_META, VEHICLE_LABEL } from "@/components/delivery/shared";
import { DeliveryOutcomeForm } from "@/components/delivery/DeliveryOutcomeForm";
import { SettlementModal } from "@/components/delivery/SettlementModal";
import { ChallanModal, LoadSheetModal } from "@/components/delivery/Documents";

type Tab = "dispatch" | "runs" | "custody" | "settlement" | "riders" | "zones";

const PREPARING = ["PLACED", "CONFIRMED", "PROCESSING"];

export default function DeliveryPage() {
  return (
    <Suspense>
      <DeliveryBoardFromUrl />
    </Suspense>
  );
}

/** Remount when ?tab= changes (e.g. from a notification link). */
function DeliveryBoardFromUrl() {
  const tab = useSearchParams().get("tab") as Tab | null;
  return <DeliveryBoard key={tab ?? "default"} initialTab={tab ?? "dispatch"} />;
}

function DeliveryBoard({ initialTab }: { initialTab: Tab }) {
  const { orders, runs, riders, returns, orderById, can } = useAppStore();
  const [tab, setTab] = useState<Tab>(initialTab);

  const ready = orders.filter((o) => o.orderStatus === "PACKED");
  const preparing = orders.filter((o) => PREPARING.includes(o.orderStatus));
  const activeRuns = runs.filter((r) => r.status !== "SETTLED");
  const openStops = activeRuns.flatMap((r) => r.orderIds).filter((id) => orderById[id] && !isClosedStatus(orderById[id].orderStatus)).length;
  const custody = returns.filter((r) => r.status === "IN_TRANSIT");
  const custodyPacks = custody.reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0);
  const cashWithRiders = riders.reduce((s, r) => s + r.cashInHand, 0);
  const toSettle = riders.filter((r) => r.cashInHand > 0 || custody.some((c) => c.riderId === r.id));
  const todayIssues = orders.filter(
    (o) => (o.orderStatus === "PARTIALLY_DELIVERED" || o.orderStatus === "FAILED_DELIVERY") && (o.timeline?.at(-1)?.at ?? "").slice(0, 10) >= OPS_TODAY
  ).length;

  const tabs: { id: Tab; label: string; count?: number; icon: React.ElementType }[] = [
    { id: "dispatch", label: "Dispatch", count: ready.length, icon: ClipboardList },
    { id: "runs", label: "Live runs", count: activeRuns.length, icon: Route },
    { id: "custody", label: "Returns with riders", count: custody.length, icon: Undo2 },
    { id: "settlement", label: "Rider settlement", count: toSettle.length, icon: Banknote },
    { id: "riders", label: "Riders", icon: Users },
    { id: "zones", label: "Zones & charges", icon: MapPin },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery & riders"
        description="Build delivery runs, track riders on the road, receive returned goods and settle cash at the end of the day."
        actions={
          <Link href="/rider" className={btn.secondary}>
            <Smartphone className="size-4" aria-hidden /> Open rider app
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Ready to dispatch" value={ready.length} hint={`${preparing.length} being prepared`} icon={PackageCheck} tone="violet" onClick={() => setTab("dispatch")} active={tab === "dispatch"} />
        <StatCard label="Live runs" value={activeRuns.length} hint={`${openStops} stop(s) open`} icon={Route} tone="blue" onClick={() => setTab("runs")} active={tab === "runs"} />
        <StatCard label="Partial / failed today" value={todayIssues} hint="Goods coming back" icon={AlertTriangle} tone="rose" onClick={() => setTab("custody")} />
        <StatCard label="Packs with riders" value={custodyPacks} hint={`${custody.length} return(s) in transit`} icon={Undo2} tone="amber" onClick={() => setTab("custody")} active={tab === "custody"} />
        <StatCard label="Cash with riders" value={formatCurrency(cashWithRiders)} hint="To deposit" icon={Banknote} tone="green" onClick={() => setTab("settlement")} active={tab === "settlement"} />
        <StatCard label="Riders on road" value={riders.filter((r) => r.status === "ON_DELIVERY").length} hint={`of ${riders.length} riders`} icon={Truck} tone="slate" onClick={() => setTab("riders")} active={tab === "riders"} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={tabs} label="Delivery sections" />

      {tab === "dispatch" && <DispatchTab ready={ready} preparing={preparing} canCreate={can("delivery", "create")} />}
      {tab === "runs" && <RunsTab runs={activeRuns} />}
      {tab === "custody" && <CustodyTab />}
      {tab === "settlement" && <SettlementTab toSettle={toSettle} />}
      {tab === "riders" && <RidersTab />}
      {tab === "zones" && <ZonesTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

function DispatchTab({ ready, preparing, canCreate }: { ready: Order[]; preparing: Order[]; canCreate: boolean }) {
  const { riders, runs, createRun, settings } = useAppStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [riderId, setRiderId] = useState("");
  const [challan, setChallan] = useState<Order | null>(null);

  const list = ready.filter((o) => `${o.orderNumber} ${o.customerName} ${o.address}`.toLowerCase().includes(query.toLowerCase()));
  const picked = ready.filter((o) => selected.includes(o.id));
  const cold = picked.some((o) => o.deliveryType === "COLD_CHAIN");
  const cash = picked.reduce((s, o) => s + (o.paymentMethod.includes("CREDIT") ? 0 : amountToCollect(o)), 0);

  const ranked = [...riders].sort((a, b) => {
    const rank = { AVAILABLE: 0, ON_DUTY: 1, ON_DELIVERY: 2, OFF_DUTY: 3 } as const;
    return rank[a.status] - rank[b.status] || a.currentAssignedOrdersCount - b.currentAssignedOrdersCount;
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const confirm = () => {
    const run = createRun(riderId, selected);
    if (run) {
      setSelected([]);
      setAssigning(false);
      setRiderId("");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader
          title="Packed and ready"
          description="Select the stops for one rider, then create a run. Stock is issued FEFO when the run is created."
          actions={<SearchInput value={query} onChange={setQuery} placeholder="Search orders" className="w-56" />}
        />
        {list.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nothing packed yet" description="Orders appear here once the warehouse marks them as packed." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((o) => {
              const on = selected.includes(o.id);
              return (
                <li key={o.id} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5", on && "bg-brand-light/30")}>
                  <label className="flex flex-1 cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggle(o.id)} disabled={!canCreate} className="mt-1 size-4 accent-brand-primary" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/orders/${o.id}`} className="font-mono text-sm font-medium text-brand-primary hover:underline">
                          {o.orderNumber}
                        </Link>
                        <DeliveryTypeTag type={o.deliveryType} />
                      </span>
                      <span className="block text-sm font-medium text-apptext-primary">{o.customerName}</span>
                      <span className="flex items-center gap-1 text-xs text-apptext-secondary">
                        <MapPin className="size-3" aria-hidden /> {o.address}
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right text-sm">
                      <p className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(o.grandTotal)}</p>
                      <p className="text-xs text-apptext-secondary">
                        {o.items.reduce((s, l) => s + l.quantity, 0)} pack(s) · {o.paymentMethod.includes("CREDIT") ? "Credit" : "COD"}
                      </p>
                    </div>
                    <button onClick={() => setChallan(o)} className={btn.small} aria-label={`Challan for ${o.orderNumber}`}>
                      <FileText className="size-3.5" aria-hidden /> Challan
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="space-y-5">
        <Card className="xl:sticky xl:top-20">
          <CardHeader title="New delivery run" />
          <div className="space-y-3 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-apptext-secondary">Stops selected</span>
              <span className="font-semibold tabular-nums">
                {picked.length} / {settings.delivery.maxStopsPerRun}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-apptext-secondary">Packs to load</span>
              <span className="font-semibold tabular-nums">{picked.reduce((s, o) => s + o.items.reduce((n, l) => n + l.quantity, 0), 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-apptext-secondary">Cash to collect</span>
              <span className="font-semibold tabular-nums">{formatCurrency(cash)}</span>
            </div>
            {cold && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-50 p-2.5 text-xs text-sky-800">
                <Snowflake className="mt-px size-4 shrink-0" aria-hidden /> Includes cold-chain stops: send an insulated box with ice packs.
              </p>
            )}
            {picked.length > settings.delivery.maxStopsPerRun && <p className="text-xs text-rose-600">Too many stops for one run.</p>}
            <button
              onClick={() => setAssigning(true)}
              disabled={!canCreate || picked.length === 0 || picked.length > settings.delivery.maxStopsPerRun}
              className={cn(btn.primary, "w-full")}
            >
              <Truck className="size-4" aria-hidden /> Assign rider & create run
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Being prepared" description={`${preparing.length} order(s) not packed yet`} />
          <ul className="divide-y divide-slate-100">
            {preparing.slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <Link href={`/orders/${o.id}`} className="min-w-0">
                  <span className="block truncate font-medium text-apptext-primary">{o.customerName}</span>
                  <span className="font-mono text-xs text-apptext-secondary">{o.orderNumber}</span>
                </Link>
                <Badge className={ORDER_STATUS_META[o.orderStatus].badge}>{ORDER_STATUS_META[o.orderStatus].label}</Badge>
              </li>
            ))}
            {preparing.length === 0 && <li className="px-4 py-6 text-center text-sm text-apptext-secondary">All caught up.</li>}
          </ul>
        </Card>
      </div>

      {assigning && (
        <Modal
          title="Assign a rider"
          subtitle={`${picked.length} stop(s) · ${formatCurrency(cash)} to collect`}
          onClose={() => setAssigning(false)}
          footer={
            <>
              <button onClick={() => setAssigning(false)} className={btn.secondary}>
                Cancel
              </button>
              <button onClick={confirm} disabled={!riderId} className={btn.primary}>
                Create run & issue stock
              </button>
            </>
          }
        >
          <fieldset className="space-y-2">
            <legend className="sr-only">Choose a rider</legend>
            {ranked.map((r, i) => {
              const st = RIDER_STATUS[r.status];
              const off = r.status === "OFF_DUTY";
              const busy = runs.some((x) => x.riderId === r.id && x.status !== "SETTLED");
              return (
                <label
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition",
                    off ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    riderId === r.id ? "border-brand-primary bg-brand-light/30 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <input type="radio" name="rider" checked={riderId === r.id} disabled={off} onChange={() => setRiderId(r.id)} className="size-4 accent-brand-primary" />
                  <RiderAvatar name={r.name} className="size-9 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-apptext-primary">
                      {r.name}
                      {i === 0 && !off && <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">Suggested</span>}
                    </span>
                    <span className="block text-xs text-apptext-secondary">
                      {VEHICLE_LABEL[r.vehicleType]} · {r.vehiclePlateNo}
                    </span>
                  </span>
                  <span className="text-right text-xs">
                    <span className={cn("flex items-center justify-end gap-1 font-medium", st.text)}>
                      <span className={cn("size-1.5 rounded-full", st.dot)} /> {st.label}
                    </span>
                    {busy && <span className="text-slate-500">Has an open run</span>}
                    {r.cashInHand > 0 && <span className="block text-amber-700">{formatCurrency(r.cashInHand)} in hand</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Modal>
      )}
      {challan && <ChallanModal order={challan} onClose={() => setChallan(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live runs                                                           */
/* ------------------------------------------------------------------ */

function RunsTab({ runs }: { runs: DeliveryRun[] }) {
  const { orderById, riderById, returns, verifyRunLoad, startRun, can } = useAppStore();
  const [loadSheet, setLoadSheet] = useState<DeliveryRun | null>(null);
  const [recordFor, setRecordFor] = useState<Order | null>(null);
  const [settleFor, setSettleFor] = useState<DeliveryPersonnel | null>(null);

  if (runs.length === 0)
    return (
      <Card>
        <EmptyState icon={Route} title="No runs on the road" description="Create a run from the Dispatch tab." />
      </Card>
    );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {runs.map((run) => {
        const rider = riderById[run.riderId];
        const stops = run.orderIds.map((id) => orderById[id]).filter(Boolean);
        const done = stops.filter((o) => isClosedStatus(o.orderStatus)).length;
        const custody = returns.filter((r) => r.runId === run.id && r.status === "IN_TRANSIT");
        const collected = stops.reduce((s, o) => s + (o.deliveryProof?.paymentMethod === "CASH" ? o.deliveryProof.amountCollected : 0), 0);
        const pct = stops.length ? Math.round((done / stops.length) * 100) : 0;
        return (
          <Card key={run.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <RiderAvatar name={rider?.name ?? "?"} />
                <div>
                  <p className="font-semibold text-apptext-primary">{rider?.name}</p>
                  <p className="font-mono text-xs text-apptext-secondary">
                    {run.runNumber} · {VEHICLE_LABEL[rider?.vehicleType ?? "MOTORBIKE"]}
                  </p>
                </div>
              </div>
              <Badge className={RUN_STATUS_META[run.status].badge}>{RUN_STATUS_META[run.status].label}</Badge>
            </div>

            <div className="space-y-1.5 px-4 pt-3">
              <div className="flex justify-between text-xs text-apptext-secondary">
                <span>
                  {done} of {stops.length} stops done
                </span>
                <span>{run.startedAt ? `Started ${formatDateTime(run.startedAt)}` : "Not started"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ol className="flex-1 space-y-2 p-4">
              {stops.map((o, i) => {
                const meta = ORDER_STATUS_META[o.orderStatus];
                const open = !isClosedStatus(o.orderStatus);
                const returned = o.items.reduce((s, l) => s + (l.returnedQuantity ?? 0), 0);
                return (
                  <li key={o.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5">
                    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", open ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700")}>
                      {open ? i + 1 : <CheckCircle2 className="size-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/orders/${o.id}`} className="block truncate text-sm font-medium text-apptext-primary hover:text-brand-primary">
                        {o.customerName}
                      </Link>
                      <p className="text-xs text-apptext-secondary">
                        <span className="font-mono">{o.orderNumber.split("-").pop()}</span> · {formatCurrency(o.grandTotal)}
                        {o.originalGrandTotal && <span className="ml-1 text-slate-400 line-through">{formatCurrency(o.originalGrandTotal)}</span>}
                        {returned > 0 && <span className="ml-1 text-teal-700">· {returned} returning</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge className={meta.badge}>{meta.label}</Badge>
                      {open && run.status === "IN_PROGRESS" && can("delivery", "edit") && (
                        <button onClick={() => setRecordFor(o)} className="text-xs font-medium text-brand-primary hover:underline">
                          Record outcome
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <dl className="grid grid-cols-2 gap-px border-y border-slate-100 bg-slate-100 text-sm">
              <div className="bg-white px-4 py-2.5">
                <dt className="text-xs text-apptext-secondary">Cash collected</dt>
                <dd className="font-semibold tabular-nums text-apptext-primary">{formatCurrency(collected)}</dd>
              </div>
              <div className="bg-white px-4 py-2.5">
                <dt className="text-xs text-apptext-secondary">Goods returning</dt>
                <dd className={cn("font-semibold tabular-nums", custody.length ? "text-teal-700" : "text-apptext-primary")}>
                  {custody.reduce((s, r) => s + r.lines.reduce((n, l) => n + l.quantity, 0), 0)} pack(s)
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 p-3">
              <button onClick={() => setLoadSheet(run)} className={btn.small}>
                <ClipboardList className="size-3.5" aria-hidden /> Load sheet
              </button>
              {rider && (
                <a href={`tel:${rider.phone}`} className={btn.small}>
                  <Phone className="size-3.5" aria-hidden /> Call rider
                </a>
              )}
              {run.status === "LOADING" && !run.loadVerified && can("delivery", "edit") && (
                <button onClick={() => verifyRunLoad(run.id)} className={btn.small}>
                  <ClipboardCheck className="size-3.5" aria-hidden /> Verify load
                </button>
              )}
              {run.status === "LOADING" && can("delivery", "edit") && (
                <button onClick={() => startRun(run.id)} className={cn(btn.small, "border-brand-primary bg-brand-primary text-white hover:bg-brand-hover")}>
                  <Play className="size-3.5" aria-hidden /> Start run
                </button>
              )}
              {run.status === "RETURNING" && rider && (
                <button onClick={() => setSettleFor(rider)} className={cn(btn.small, "ml-auto border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700")}>
                  <Banknote className="size-3.5" aria-hidden /> Settle rider
                </button>
              )}
            </div>
          </Card>
        );
      })}

      {loadSheet && <LoadSheetModal run={loadSheet} onClose={() => setLoadSheet(null)} />}
      {recordFor && (
        <Modal size="lg" title="Record delivery outcome" subtitle={`${recordFor.orderNumber} · ${recordFor.customerName} (on behalf of ${recordFor.assignedRider?.name})`} onClose={() => setRecordFor(null)}>
          <DeliveryOutcomeForm order={recordFor} onDone={() => setRecordFor(null)} onCancel={() => setRecordFor(null)} />
        </Modal>
      )}
      {settleFor && <SettlementModal rider={settleFor} onClose={() => setSettleFor(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Returns in custody                                                  */
/* ------------------------------------------------------------------ */

function CustodyTab() {
  const { returns, riderById } = useAppStore();
  const custody = returns.filter((r) => r.status === "IN_TRANSIT");

  return (
    <Card>
      <CardHeader
        title="Returned goods still with riders"
        description="Goods the customer didn't accept. They are checked in at the rider's settlement and then inspected in Returns."
        actions={
          <Link href="/returns" className={btn.secondary}>
            Open returns
          </Link>
        }
      />
      {custody.length === 0 ? (
        <EmptyState icon={Undo2} title="No goods in transit" description="Partial and failed deliveries show up here until the rider hands them over." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
              <tr>
                <th className="px-5 py-2.5 font-medium">Return</th>
                <th className="px-3 py-2.5 font-medium">Rider</th>
                <th className="px-3 py-2.5 font-medium">Items</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
                <th className="px-3 py-2.5 text-right font-medium">Value</th>
                <th className="px-5 py-2.5 font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {custody.map((r) => (
                <tr key={r.id} className="hover:bg-surface/60">
                  <td className="px-5 py-3">
                    <Link href={`/returns/${r.id}`} className="font-mono text-sm font-medium text-brand-primary hover:underline">
                      {r.returnNumber}
                    </Link>
                    <p className="text-xs text-apptext-secondary">{r.customerName}</p>
                    <Badge className={cn("mt-1", RETURN_SOURCE_META[r.source].badge)}>{RETURN_SOURCE_META[r.source].label}</Badge>
                  </td>
                  <td className="px-3 py-3 text-apptext-primary">{r.riderId ? riderById[r.riderId]?.name : "—"}</td>
                  <td className="px-3 py-3">
                    {r.lines.map((l) => (
                      <p key={l.orderItemId} className="text-apptext-primary">
                        <span className="font-semibold tabular-nums">{l.quantity}</span> × {l.productName}
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-3 text-xs text-apptext-secondary">{[...new Set(r.lines.map((l) => RETURN_REASON_META[l.reason].label))].join(", ")}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(r.totalValue)}</td>
                  <td className="px-5 py-3 text-xs text-apptext-secondary">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

function SettlementTab({ toSettle }: { toSettle: DeliveryPersonnel[] }) {
  const { returns, settlements, riderById, runs } = useAppStore();
  const [settleFor, setSettleFor] = useState<DeliveryPersonnel | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-brand-blue/20 bg-brand-light/40 p-4 text-sm text-apptext-primary">
        <Info className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
        <p className="text-pretty">
          At the end of the run the rider hands over <strong>cash</strong> and any <strong>returned goods</strong>. Both are counted
          against what was recorded at the door. Any mismatch is saved as a shortage against the rider.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {toSettle.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState icon={CheckCircle2} title="Everyone is settled" description="No rider is holding cash or returned goods." />
          </Card>
        )}
        {toSettle.map((r) => {
          const custody = returns.filter((x) => x.riderId === r.id && x.status === "IN_TRANSIT");
          const packs = custody.reduce((s, x) => s + x.lines.reduce((n, l) => n + l.quantity, 0), 0);
          const run = runs.find((x) => x.riderId === r.id && x.status !== "SETTLED");
          return (
            <Card key={r.id} className="p-4">
              <div className="flex items-center gap-3">
                <RiderAvatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-apptext-primary">{r.name}</p>
                  <p className="text-xs text-apptext-secondary">{run ? `${run.runNumber} · ${RUN_STATUS_META[run.status].label}` : "No open run"}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-amber-50 p-3">
                  <dt className="text-xs text-amber-800">Cash in hand</dt>
                  <dd className="text-lg font-bold tabular-nums text-amber-900">{formatCurrency(r.cashInHand)}</dd>
                </div>
                <div className="rounded-lg bg-teal-50 p-3">
                  <dt className="text-xs text-teal-800">Goods to return</dt>
                  <dd className="text-lg font-bold tabular-nums text-teal-900">{packs} pack(s)</dd>
                </div>
              </dl>
              {run && run.status === "IN_PROGRESS" && <p className="mt-3 text-xs text-amber-700">Run still on the road. You can settle what has been collected so far.</p>}
              <button onClick={() => setSettleFor(r)} className={cn(btn.primary, "mt-4 w-full")}>
                <Banknote className="size-4" aria-hidden /> Settle now
              </button>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Settlement history" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-surface text-xs text-apptext-secondary">
              <tr>
                <th className="px-5 py-2.5 font-medium">Settlement</th>
                <th className="px-3 py-2.5 font-medium">Rider</th>
                <th className="px-3 py-2.5 text-right font-medium">Cash expected</th>
                <th className="px-3 py-2.5 text-right font-medium">Cash received</th>
                <th className="px-3 py-2.5 text-right font-medium">Goods</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <p className="font-mono text-sm text-apptext-primary">{s.settlementNumber}</p>
                    <p className="text-xs text-apptext-secondary">{formatDateTime(s.settledAt)}</p>
                  </td>
                  <td className="px-3 py-3">{riderById[s.riderId]?.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(s.cashExpected)}</td>
                  <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", s.cashReceived < s.cashExpected && "text-rose-600")}>{formatCurrency(s.cashReceived)}</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", s.goodsReceived < s.goodsExpected && "text-rose-600")}>
                    {s.goodsReceived} / {s.goodsExpected}
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={s.status === "BALANCED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                      {s.status === "BALANCED" ? "Balanced" : "Shortage"}
                    </Badge>
                    {s.note && <p className="mt-1 max-w-xs text-xs text-apptext-secondary">{s.note}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-apptext-secondary">{s.settledBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {settleFor && <SettlementModal rider={settleFor} onClose={() => setSettleFor(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Riders                                                              */
/* ------------------------------------------------------------------ */

function RidersTab() {
  const { riders, orders, returns, settlements } = useAppStore();
  const stats = useMemo(
    () =>
      Object.fromEntries(
        riders.map((r) => {
          const mine = orders.filter((o) => o.assignedRider?.id === r.id);
          const delivered = mine.filter((o) => o.orderStatus === "DELIVERED").length;
          const partial = mine.filter((o) => o.orderStatus === "PARTIALLY_DELIVERED").length;
          const failed = mine.filter((o) => o.orderStatus === "FAILED_DELIVERY").length;
          const total = delivered + partial + failed;
          const shortages = settlements.filter((s) => s.riderId === r.id && s.status === "SHORTAGE").length;
          return [r.id, { delivered, partial, failed, success: total ? Math.round(((delivered + partial) / total) * 100) : 100, shortages, returns: returns.filter((x) => x.riderId === r.id).length }];
        })
      ),
    [riders, orders, returns, settlements]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {riders.map((r) => {
        const st = RIDER_STATUS[r.status];
        const s = stats[r.id];
        return (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <RiderAvatar name={r.name} />
                <div>
                  <p className="font-semibold text-apptext-primary">{r.name}</p>
                  <p className="font-mono text-xs text-slate-400">{r.employeeCode}</p>
                </div>
              </div>
              <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", st.text)}>
                <span className={cn("size-2 rounded-full", st.dot)} /> {st.label}
              </span>
            </div>
            <p className="px-4 text-xs text-apptext-secondary">
              {VEHICLE_LABEL[r.vehicleType]} · <span className="font-mono">{r.vehiclePlateNo}</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100 text-center">
              {[
                ["Delivered", s.delivered, "text-emerald-700"],
                ["Partial", s.partial, "text-teal-700"],
                ["Failed", s.failed, "text-rose-600"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="bg-white py-2.5">
                  <dt className="text-[11px] text-apptext-secondary">{l}</dt>
                  <dd className={cn("text-lg font-bold tabular-nums", c as string)}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex-1 space-y-1 p-4 text-sm">
              <p className="flex justify-between">
                <span className="text-apptext-secondary">Success rate</span>
                <span className="font-semibold tabular-nums">{s.success}%</span>
              </p>
              <p className="flex justify-between">
                <span className="text-apptext-secondary">Cash in hand</span>
                <span className={cn("font-semibold tabular-nums", r.cashInHand > 0 && "text-amber-700")}>{formatCurrency(r.cashInHand)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-apptext-secondary">Settlement shortages</span>
                <span className={cn("font-semibold tabular-nums", s.shortages > 0 && "text-rose-600")}>{s.shortages}</span>
              </p>
            </div>
            <div className="border-t border-slate-100 p-3">
              <a href={`tel:${r.phone}`} className={cn(btn.secondary, "w-full")}>
                <Phone className="size-4 text-brand-blue" aria-hidden /> {r.phone}
              </a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zones                                                               */
/* ------------------------------------------------------------------ */

function ZonesTab() {
  return (
    <section className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-brand-blue/20 bg-brand-light/40 p-4 text-sm text-apptext-primary">
        <Info className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
        <p className="text-pretty">
          Delivery charges come from the customer&apos;s zone, the order total (free above the threshold) and the delivery type. Proof of
          delivery and partial-delivery rules are in{" "}
          <Link href="/settings/delivery" className="font-medium text-brand-primary underline">
            Settings → Delivery
          </Link>
          .
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockDeliveryZoneRules.map((rule) => (
          <Card key={rule.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3 p-5 pb-3">
              <div>
                <h3 className="text-balance font-semibold text-apptext-primary">{rule.zoneName}</h3>
                <p className="text-sm text-apptext-secondary">
                  {rule.district}, {rule.division}
                </p>
              </div>
              <Badge className={rule.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>
                {rule.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <dl className="mx-5 divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
              {[
                ["Standard charge", formatCurrency(rule.standardDeliveryFee)],
                ["Express charge", formatCurrency(rule.expressDeliveryFee)],
                ["Free delivery above", formatCurrency(rule.minOrderForFreeDelivery)],
                ["Weight surcharge", `${formatCurrency(rule.weightSurchargePerKg)} / kg`],
                ["Delivery time", rule.estimatedTransitHours],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-apptext-secondary">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="p-5 pt-4">
              <p className="mb-2 text-xs font-medium text-apptext-secondary">Areas covered ({rule.areasCovered.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {rule.areasCovered.map((a) => (
                  <span key={a} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
