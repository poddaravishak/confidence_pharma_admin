"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  mockOrders,
  mockDeliveryPersonnel,
  mockDeliveryZoneRules,
} from "@/lib/db/mock-data";
import { Order, OrderStatus, DeliveryPersonnel } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Truck,
  MapPin,
  Navigation,
  UserCheck,
  CheckCircle2,
  Clock,
  Sliders,
  FileText,
  Phone,
  Wallet,
  Snowflake,
  Zap,
  Printer,
  X,
  Bike,
  Search,
  PackageCheck,
  AlertTriangle,
  Info,
  Inbox,
  Banknote,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers & display metadata                                          */
/* ------------------------------------------------------------------ */

type Tab = "DISPATCH" | "RIDERS" | "RULES";
type Bucket = "ALL" | "AWAITING" | "IN_TRANSIT" | "DELIVERED" | "ISSUE";

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  PLACED: { label: "Placed", className: "bg-slate-100 text-slate-700 border-slate-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PROCESSING: { label: "Processing", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PACKED: { label: "Packed · ready", className: "bg-violet-50 text-violet-700 border-violet-200" },
  DISPATCHED: { label: "Dispatched", className: "bg-blue-50 text-brand-primary border-blue-200" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-amber-50 text-amber-800 border-amber-200" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-50 text-rose-700 border-rose-200" },
  RETURNED: { label: "Returned", className: "bg-rose-50 text-rose-700 border-rose-200" },
  FAILED_DELIVERY: { label: "Failed delivery", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const BUCKET_ACCENT: Record<Exclude<Bucket, "ALL">, string> = {
  AWAITING: "before:bg-amber-400",
  IN_TRANSIT: "before:bg-brand-blue",
  DELIVERED: "before:bg-brand-green",
  ISSUE: "before:bg-rose-500",
};

const PAYMENT_LABEL: Record<Order["paymentStatus"], string> = {
  PENDING: "Unpaid",
  DUE: "Cash due",
  PARTIALLY_PAID: "Partially paid",
  PAID_COD: "Paid (COD)",
};

const RIDER_STATUS: Record<DeliveryPersonnel["status"], { label: string; dot: string; text: string }> = {
  AVAILABLE: { label: "Available", dot: "bg-brand-green", text: "text-emerald-700" },
  ON_DUTY: { label: "On duty", dot: "bg-brand-blue", text: "text-brand-primary" },
  ON_DELIVERY: { label: "On delivery", dot: "bg-amber-500", text: "text-amber-800" },
  OFF_DUTY: { label: "Off duty", dot: "bg-slate-400", text: "text-slate-500" },
};

const VEHICLE_LABEL: Record<DeliveryPersonnel["vehicleType"], string> = {
  MOTORBIKE: "Motorbike",
  VAN: "Van",
  BICYCLE: "Bicycle",
};

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PACKED", label: "Packed" },
  { status: "DISPATCHED", label: "Dispatched" },
  { status: "OUT_FOR_DELIVERY", label: "On the way" },
  { status: "DELIVERED", label: "Delivered" },
];

function getBucket(o: Order): Exclude<Bucket, "ALL"> {
  if (o.orderStatus === "DELIVERED") return "DELIVERED";
  if (o.orderStatus === "DISPATCHED" || o.orderStatus === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  if (["CANCELLED", "RETURNED", "FAILED_DELIVERY"].includes(o.orderStatus)) return "ISSUE";
  return "AWAITING";
}

const BUCKET_ORDER: Record<Exclude<Bucket, "ALL">, number> = {
  AWAITING: 0,
  IN_TRANSIT: 1,
  ISSUE: 2,
  DELIVERED: 3,
};

function amountToCollect(o: Order): number {
  if (o.paymentStatus === "PAID_COD") return 0;
  return o.dueAmount > 0 ? o.dueAmount : o.grandTotal - o.paidAmount;
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Dhaka",
    });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapsUrl(o: Order): string {
  return o.latitude && o.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${o.latitude},${o.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`;
}

/* ------------------------------------------------------------------ */
/* Small UI building blocks                                            */
/* ------------------------------------------------------------------ */

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-apptext-primary">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-sm text-apptext-secondary">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="no-print -m-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="no-print flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryTypeTag({ type }: { type?: Order["deliveryType"] }) {
  if (type === "COLD_CHAIN")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
        <Snowflake className="size-3.5" aria-hidden />
        Cold chain
      </span>
    );
  if (type === "EXPRESS")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
        <Zap className="size-3.5" aria-hidden />
        Express · 3h
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
      Standard
    </span>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className)}>
      {meta.label}
    </span>
  );
}

function ProgressSteps({ status }: { status: OrderStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Delivery progress">
      {STEPS.map((step, i) => {
        const done = current >= 0 && i <= current;
        return (
          <li key={step.status} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                done ? "font-medium text-apptext-primary" : "text-slate-400",
                i === current && status !== "DELIVERED" && "text-brand-primary"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  done ? (status === "DELIVERED" ? "bg-brand-green" : "bg-brand-primary") : "bg-slate-200"
                )}
                aria-hidden
              />
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={cn("h-px w-3 sm:w-5", done && i < current ? "bg-brand-primary/50" : "bg-slate-200")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ElementType;
  tone: "amber" | "blue" | "green" | "slate";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneMap = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-brand-light text-brand-primary",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "w-full rounded-xl border bg-white p-4 text-left shadow-sm transition",
        onClick && "hover:border-brand-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
        active ? "border-brand-primary ring-1 ring-brand-primary" : "border-slate-200/80"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-apptext-secondary">{label}</span>
        <span className={cn("rounded-lg p-2", toneMap[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-apptext-primary">{value}</p>
      <p className="mt-0.5 text-xs text-apptext-secondary">{hint}</p>
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DeliveryManagementPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [riders, setRiders] = useState<DeliveryPersonnel[]>(mockDeliveryPersonnel);
  const [zoneRules] = useState(mockDeliveryZoneRules);
  const [activeTab, setActiveTab] = useState<Tab>("DISPATCH");

  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [query, setQuery] = useState("");

  const [assignFor, setAssignFor] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [challanFor, setChallanFor] = useState<Order | null>(null);
  const [deliverFor, setDeliverFor] = useState<Order | null>(null);
  const [reconcileFor, setReconcileFor] = useState<DeliveryPersonnel | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- Derived data ---------- */

  const counts = useMemo(() => {
    const c = { ALL: orders.length, AWAITING: 0, IN_TRANSIT: 0, DELIVERED: 0, ISSUE: 0 };
    orders.forEach((o) => c[getBucket(o)]++);
    return c;
  }, [orders]);

  const ridersActive = riders.filter((r) => r.status !== "OFF_DUTY").length;
  const ridersFree = riders.filter((r) => r.status === "AVAILABLE" || r.status === "ON_DUTY").length;
  const cashWithRiders = riders.reduce((sum, r) => sum + r.cashInHand, 0);

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => bucket === "ALL" || getBucket(o) === bucket)
      .filter(
        (o) =>
          !q ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q) ||
          o.assignedRider?.name.toLowerCase().includes(q)
      )
      .sort((a, b) => BUCKET_ORDER[getBucket(a)] - BUCKET_ORDER[getBucket(b)]);
  }, [orders, bucket, query]);

  const ordersByRider = useMemo(() => {
    const map: Record<string, Order[]> = {};
    orders.forEach((o) => {
      if (o.assignedRider && getBucket(o) === "IN_TRANSIT") {
        (map[o.assignedRider.id] ||= []).push(o);
      }
    });
    return map;
  }, [orders]);

  const rankedRiders = useMemo(() => {
    const rank: Record<DeliveryPersonnel["status"], number> = { AVAILABLE: 0, ON_DUTY: 1, ON_DELIVERY: 2, OFF_DUTY: 3 };
    return [...riders].sort(
      (a, b) => rank[a.status] - rank[b.status] || a.currentAssignedOrdersCount - b.currentAssignedOrdersCount
    );
  }, [riders]);
  const recommendedRiderId = rankedRiders.find((r) => r.status !== "OFF_DUTY")?.id;

  /* ---------- Actions ---------- */

  const openAssign = (o: Order) => {
    setAssignFor(o);
    setSelectedRiderId(recommendedRiderId ?? "");
  };

  const handleAssignRider = () => {
    if (!assignFor || !selectedRiderId) return;
    const rider = riders.find((r) => r.id === selectedRiderId);
    if (!rider) return;
    const challan = assignFor.deliveryChallanNumber || `CHAL-${Date.now().toString().slice(-6)}`;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === assignFor.id
          ? {
              ...o,
              assignedRider: rider,
              orderStatus: "DISPATCHED",
              dispatchedAt: new Date().toISOString(),
              deliveryChallanNumber: challan,
            }
          : o
      )
    );
    setRiders((prev) =>
      prev.map((r) =>
        r.id === rider.id
          ? { ...r, currentAssignedOrdersCount: r.currentAssignedOrdersCount + 1, status: "ON_DELIVERY" }
          : r
      )
    );
    setToast(`${assignFor.orderNumber} dispatched with ${rider.name}. Challan ${challan} created.`);
    setAssignFor(null);
  };

  const startDelivery = (o: Order) => {
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, orderStatus: "OUT_FOR_DELIVERY" } : x)));
    setToast(`${o.orderNumber} is now out for delivery.`);
  };

  const confirmDelivered = () => {
    if (!deliverFor) return;
    const collected = amountToCollect(deliverFor);
    const riderId = deliverFor.assignedRider?.id;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === deliverFor.id
          ? {
              ...o,
              orderStatus: "DELIVERED",
              paymentStatus: "PAID_COD",
              paidAmount: o.grandTotal,
              dueAmount: 0,
              deliveredAt: new Date().toISOString(),
            }
          : o
      )
    );
    if (riderId) {
      setRiders((prev) =>
        prev.map((r) => {
          if (r.id !== riderId) return r;
          const remaining = Math.max(0, r.currentAssignedOrdersCount - 1);
          return {
            ...r,
            cashInHand: r.cashInHand + collected,
            currentAssignedOrdersCount: remaining,
            status: remaining === 0 && r.status === "ON_DELIVERY" ? "ON_DUTY" : r.status,
          };
        })
      );
    }
    setToast(
      collected > 0
        ? `${deliverFor.orderNumber} delivered. ${formatCurrency(collected)} cash collected.`
        : `${deliverFor.orderNumber} marked as delivered.`
    );
    setDeliverFor(null);
  };

  const confirmReconcile = () => {
    if (!reconcileFor) return;
    setRiders((prev) => prev.map((r) => (r.id === reconcileFor.id ? { ...r, cashInHand: 0 } : r)));
    setToast(`${formatCurrency(reconcileFor.cashInHand)} from ${reconcileFor.name} deposited to cash register.`);
    setReconcileFor(null);
  };

  /* ---------- Render ---------- */

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "DISPATCH", label: "Dispatch board", icon: Truck, count: counts.AWAITING + counts.IN_TRANSIT },
    { id: "RIDERS", label: "Riders", icon: Bike, count: riders.length },
    { id: "RULES", label: "Delivery charges", icon: Sliders },
  ];

  const filters: { id: Bucket; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "AWAITING", label: "Needs rider" },
    { id: "IN_TRANSIT", label: "In transit" },
    { id: "DELIVERED", label: "Delivered" },
    ...(counts.ISSUE > 0 ? [{ id: "ISSUE" as Bucket, label: "Issues" }] : []),
  ];

  const goToBucket = (b: Bucket) => {
    setActiveTab("DISPATCH");
    setBucket((cur) => (cur === b ? "ALL" : b));
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-brand-primary">Delivery</h1>
          <p className="mt-1 text-sm text-apptext-secondary">
            Assign riders, track orders on the road, and manage zone delivery charges.
          </p>
        </div>

        <div role="tablist" aria-label="Delivery sections" className="flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm lg:w-auto">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition lg:flex-none",
                  active ? "bg-brand-primary text-white shadow-sm" : "text-apptext-secondary hover:bg-slate-50 hover:text-brand-primary"
                )}
              >
                <t.icon className="size-4" aria-hidden />
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-xs tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary cards (click to filter) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Needs a rider"
          value={counts.AWAITING}
          hint={counts.AWAITING > 0 ? "Waiting to be dispatched" : "All orders assigned"}
          icon={PackageCheck}
          tone={counts.AWAITING > 0 ? "amber" : "slate"}
          active={activeTab === "DISPATCH" && bucket === "AWAITING"}
          onClick={() => goToBucket("AWAITING")}
        />
        <StatCard
          label="In transit"
          value={counts.IN_TRANSIT}
          hint="Dispatched or on the way"
          icon={Truck}
          tone="blue"
          active={activeTab === "DISPATCH" && bucket === "IN_TRANSIT"}
          onClick={() => goToBucket("IN_TRANSIT")}
        />
        <StatCard
          label="Riders free"
          value={
            <>
              {ridersFree}
              <span className="text-base font-medium text-apptext-secondary"> / {ridersActive}</span>
            </>
          }
          hint="Available to take orders"
          icon={Bike}
          tone="green"
          active={activeTab === "RIDERS"}
          onClick={() => setActiveTab("RIDERS")}
        />
        <StatCard
          label="Cash with riders"
          value={formatCurrency(cashWithRiders)}
          hint="COD to be deposited"
          icon={Wallet}
          tone={cashWithRiders > 0 ? "amber" : "slate"}
          onClick={() => setActiveTab("RIDERS")}
        />
      </div>

      {/* ============================ DISPATCH BOARD ============================ */}
      {activeTab === "DISPATCH" && (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter orders">
              {filters.map((f) => {
                const active = bucket === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setBucket(f.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      active
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {f.label}
                    <span className={cn("tabular-nums text-xs", active ? "text-white/80" : "text-slate-400")}>
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="relative block md:w-72">
              <span className="sr-only">Search orders</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search order, pharmacy, area or rider"
                className="w-full rounded-lg border border-slate-200 bg-surface py-2 pl-9 pr-3 text-sm text-apptext-primary placeholder:text-slate-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>
          </div>

          {/* Column headings (desktop) */}
          <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 bg-surface px-5 py-2 text-xs font-medium text-apptext-secondary lg:grid">
            <span className="col-span-5">Order & destination</span>
            <span className="col-span-3">Rider</span>
            <span className="col-span-4 text-right">Payment & actions</span>
          </div>

          {/* Order rows */}
          {visibleOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <span className="rounded-full bg-slate-100 p-3 text-slate-400">
                <Inbox className="size-6" aria-hidden />
              </span>
              <p className="font-medium text-apptext-primary">No orders match</p>
              <p className="text-sm text-apptext-secondary">Try a different filter or search term.</p>
              {(query || bucket !== "ALL") && (
                <button
                  onClick={() => {
                    setQuery("");
                    setBucket("ALL");
                  }}
                  className="mt-2 text-sm font-medium text-brand-blue hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleOrders.map((ord) => {
                const b = getBucket(ord);
                const due = amountToCollect(ord);
                const rider = ord.assignedRider
                  ? riders.find((r) => r.id === ord.assignedRider!.id) ?? ord.assignedRider
                  : undefined;

                return (
                  <li
                    key={ord.id}
                    className={cn(
                      "relative grid grid-cols-1 gap-4 px-4 py-4 transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:bg-surface/60 sm:px-5 lg:grid-cols-12 lg:items-center",
                      BUCKET_ACCENT[b]
                    )}
                  >
                    {/* Order & destination */}
                    <div className="min-w-0 space-y-2 lg:col-span-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-brand-primary">{ord.orderNumber}</span>
                        <StatusBadge status={ord.orderStatus} />
                        <DeliveryTypeTag type={ord.deliveryType} />
                      </div>
                      <div>
                        <p className="truncate text-base font-semibold text-apptext-primary">{ord.customerName}</p>
                        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-apptext-secondary">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
                          <span className="text-pretty">
                            {ord.address}
                            {ord.distanceKm ? (
                              <span className="whitespace-nowrap text-slate-400"> · {ord.distanceKm} km</span>
                            ) : null}
                          </span>
                        </p>
                        {ord.landmark && (
                          <p className="pl-[22px] text-xs text-slate-500">Near {ord.landmark}</p>
                        )}
                      </div>
                      {b !== "ISSUE" && <ProgressSteps status={ord.orderStatus} />}
                    </div>

                    {/* Rider */}
                    <div className="lg:col-span-3">
                      {rider ? (
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-primary">
                            {initials(rider.name)}
                          </span>
                          <div className="min-w-0 text-sm">
                            <p className="truncate font-medium text-apptext-primary">{rider.name}</p>
                            <a
                              href={`tel:${rider.phone}`}
                              className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
                            >
                              <Phone className="size-3" aria-hidden />
                              {rider.phone}
                            </a>
                            {(ord.deliveredAt || ord.estimatedDeliveryTime || ord.dispatchedAt) && (
                              <p className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="size-3" aria-hidden />
                                {ord.deliveredAt
                                  ? `Delivered ${formatTime(ord.deliveredAt)}`
                                  : ord.estimatedDeliveryTime
                                  ? `ETA ${ord.estimatedDeliveryTime}`
                                  : `Left ${formatTime(ord.dispatchedAt)}`}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
                          <AlertTriangle className="size-4 shrink-0" aria-hidden />
                          No rider assigned
                        </div>
                      )}
                    </div>

                    {/* Payment & actions */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-4 lg:flex-col lg:items-end lg:justify-center">
                      <div className="lg:text-right">
                        <p className="text-lg font-bold tabular-nums text-apptext-primary">{formatCurrency(ord.grandTotal)}</p>
                        <p className={cn("text-xs font-medium", due > 0 ? "text-amber-700" : "text-emerald-700")}>
                          {due > 0 ? `Collect ${formatCurrency(due)} · ${PAYMENT_LABEL[ord.paymentStatus]}` : PAYMENT_LABEL[ord.paymentStatus]}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <a
                          href={mapsUrl(ord)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${ord.customerName} in Google Maps`}
                          title="Open in Google Maps"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Navigation className="size-4 text-brand-blue" aria-hidden />
                          <span>Map</span>
                        </a>
                        <button
                          onClick={() => setChallanFor(ord)}
                          title="View delivery challan"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileText className="size-4 text-brand-primary" aria-hidden />
                          <span>Challan</span>
                        </button>

                        {b === "AWAITING" && (
                          <button
                            onClick={() => openAssign(ord)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
                          >
                            <UserCheck className="size-4" aria-hidden />
                            Assign rider
                          </button>
                        )}
                        {ord.orderStatus === "DISPATCHED" && (
                          <button
                            onClick={() => startDelivery(ord)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
                          >
                            <Truck className="size-4" aria-hidden />
                            Start delivery
                          </button>
                        )}
                        {ord.orderStatus === "OUT_FOR_DELIVERY" && (
                          <button
                            onClick={() => setDeliverFor(ord)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="size-4" aria-hidden />
                            Mark delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ============================ RIDERS ============================ */}
      {activeTab === "RIDERS" && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {riders.map((r) => {
            const st = RIDER_STATUS[r.status];
            const active = ordersByRider[r.id] ?? [];
            return (
              <article key={r.id} className="flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-primary">
                      {initials(r.name)}
                    </span>
                    <div>
                      <h3 className="font-semibold text-apptext-primary">{r.name}</h3>
                      <p className="font-mono text-xs text-slate-400">{r.employeeCode}</p>
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", st.text)}>
                    <span className={cn("size-2 rounded-full", st.dot)} aria-hidden />
                    {st.label}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-px border-y border-slate-100 bg-slate-100">
                  <div className="bg-white px-5 py-3">
                    <dt className="text-xs text-apptext-secondary">Active deliveries</dt>
                    <dd className="text-xl font-bold tabular-nums text-apptext-primary">{r.currentAssignedOrdersCount}</dd>
                  </div>
                  <div className="bg-white px-5 py-3">
                    <dt className="text-xs text-apptext-secondary">Cash in hand</dt>
                    <dd className={cn("text-xl font-bold tabular-nums", r.cashInHand > 0 ? "text-amber-700" : "text-apptext-primary")}>
                      {formatCurrency(r.cashInHand)}
                    </dd>
                  </div>
                </dl>

                <div className="flex-1 space-y-2 px-5 py-4 text-sm text-apptext-secondary">
                  <p className="flex items-center gap-2">
                    <Truck className="size-4 text-slate-400" aria-hidden />
                    {VEHICLE_LABEL[r.vehicleType]} · <span className="font-mono text-xs text-slate-600">{r.vehiclePlateNo}</span>
                  </p>
                  {active.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs">Carrying:</span>
                      {active.map((o) => (
                        <span key={o.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                          {o.orderNumber.split("-").pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 border-t border-slate-100 p-3">
                  <a
                    href={`tel:${r.phone}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Phone className="size-4 text-brand-blue" aria-hidden />
                    Call
                  </a>
                  <button
                    onClick={() => setReconcileFor(r)}
                    disabled={r.cashInHand === 0}
                    className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-brand-primary py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Banknote className="size-4" aria-hidden />
                    {r.cashInHand > 0 ? "Deposit cash" : "No cash to deposit"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ============================ DELIVERY CHARGES ============================ */}
      {activeTab === "RULES" && (
        <section className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-brand-blue/20 bg-brand-light/40 p-4 text-sm text-apptext-primary">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
            <p className="text-pretty">
              Delivery charges are calculated automatically from the customer&apos;s zone, the order total (free above
              the threshold) and the delivery type. Cold chain and heavy orders add a per-kg surcharge.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {zoneRules.map((rule) => (
              <article key={rule.id} className="flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div>
                    <h3 className="text-balance font-semibold text-apptext-primary">{rule.zoneName}</h3>
                    <p className="text-sm text-apptext-secondary">
                      {rule.district}, {rule.division}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                      rule.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    )}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <dl className="mx-5 divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
                  {[
                    ["Standard charge", formatCurrency(rule.standardDeliveryFee), "text-apptext-primary"],
                    ["Express charge", formatCurrency(rule.expressDeliveryFee), "text-apptext-primary"],
                    ["Free delivery above", formatCurrency(rule.minOrderForFreeDelivery), "text-emerald-700"],
                    ["Weight surcharge", `${formatCurrency(rule.weightSurchargePerKg)} / kg`, "text-apptext-primary"],
                    ["Delivery time", rule.estimatedTransitHours, "text-apptext-primary"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                      <dt className="text-apptext-secondary">{label}</dt>
                      <dd className={cn("font-semibold tabular-nums", color)}>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="p-5 pt-4">
                  <p className="mb-2 text-xs font-medium text-apptext-secondary">
                    Areas covered ({rule.areasCovered.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.areasCovered.map((area) => (
                      <span key={area} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ============================ MODALS ============================ */}

      {/* Assign rider */}
      {assignFor && (
        <Modal
          title="Assign a rider"
          subtitle={
            <>
              <span className="font-mono">{assignFor.orderNumber}</span> · {assignFor.customerName}
            </>
          }
          onClose={() => setAssignFor(null)}
          footer={
            <>
              <button
                onClick={() => setAssignFor(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!selectedRiderId}
                onClick={handleAssignRider}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Assign & dispatch
              </button>
            </>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-apptext-secondary">
            <MapPin className="size-4 text-brand-blue" aria-hidden />
            {assignFor.address}
            <DeliveryTypeTag type={assignFor.deliveryType} />
          </div>
          <fieldset className="space-y-2">
            <legend className="sr-only">Choose a rider</legend>
            {rankedRiders.map((r) => {
              const st = RIDER_STATUS[r.status];
              const off = r.status === "OFF_DUTY";
              const checked = selectedRiderId === r.id;
              return (
                <label
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition",
                    off ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    checked ? "border-brand-primary bg-brand-light/30 ring-1 ring-brand-primary" : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <input
                    type="radio"
                    name="rider"
                    value={r.id}
                    checked={checked}
                    disabled={off}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                    className="size-4 accent-brand-primary"
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-primary">
                    {initials(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-apptext-primary">
                      {r.name}
                      {r.id === recommendedRiderId && (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-700">
                          Suggested
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-apptext-secondary">
                      {VEHICLE_LABEL[r.vehicleType]} · {r.vehiclePlateNo}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={cn("flex items-center justify-end gap-1 font-medium", st.text)}>
                      <span className={cn("size-1.5 rounded-full", st.dot)} aria-hidden />
                      {st.label}
                    </p>
                    <p className="tabular-nums text-slate-500">{r.currentAssignedOrdersCount} active</p>
                  </div>
                </label>
              );
            })}
          </fieldset>
          {assignFor.deliveryType === "COLD_CHAIN" && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
              <Snowflake className="mt-px size-4 shrink-0" aria-hidden />
              Cold chain order — make sure the rider carries an insulated box.
            </p>
          )}
        </Modal>
      )}

      {/* Confirm delivered */}
      {deliverFor && (
        <Modal
          title="Confirm delivery"
          subtitle={
            <>
              <span className="font-mono">{deliverFor.orderNumber}</span> · {deliverFor.customerName}
            </>
          }
          onClose={() => setDeliverFor(null)}
          footer={
            <>
              <button
                onClick={() => setDeliverFor(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelivered}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Confirm delivered
              </button>
            </>
          }
        >
          {amountToCollect(deliverFor) > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">Cash to collect from customer</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-amber-900">
                {formatCurrency(amountToCollect(deliverFor))}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                This amount will be added to {deliverFor.assignedRider?.name ?? "the rider"}&apos;s cash in hand.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Already paid — no cash to collect.
            </div>
          )}
          <p className="mt-3 text-sm text-apptext-secondary">
            Confirm the pharmacy has received {deliverFor.items.length} item
            {deliverFor.items.length === 1 ? "" : "s"} in sealed condition and signed the challan.
          </p>
        </Modal>
      )}

      {/* Deposit rider cash */}
      {reconcileFor && (
        <Modal
          title="Deposit rider cash"
          subtitle={reconcileFor.name}
          onClose={() => setReconcileFor(null)}
          footer={
            <>
              <button
                onClick={() => setReconcileFor(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReconcile}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
              >
                Confirm deposit
              </button>
            </>
          }
        >
          <p className="text-sm text-apptext-secondary">Amount received into the cash register</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-apptext-primary">
            {formatCurrency(reconcileFor.cashInHand)}
          </p>
          <p className="mt-3 text-sm text-apptext-secondary">
            Count the cash before confirming. The rider&apos;s balance will reset to {formatCurrency(0)}.
          </p>
        </Modal>
      )}

      {/* Delivery challan */}
      {challanFor && (
        <Modal
          size="lg"
          className="print-area"
          title={`Delivery challan ${challanFor.deliveryChallanNumber ?? "(draft)"}`}
          subtitle="Confidence Pharma · Central Warehouse"
          onClose={() => setChallanFor(null)}
          footer={
            <>
              <button
                onClick={() => setChallanFor(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
              >
                <Printer className="size-4" aria-hidden />
                Print challan
              </button>
            </>
          }
        >
          <div className="space-y-5">
            {!challanFor.deliveryChallanNumber && (
              <p className="no-print flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                A challan number is issued when a rider is assigned.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-apptext-secondary">Deliver to</p>
                <p className="mt-1 font-semibold text-apptext-primary">{challanFor.customerName}</p>
                <p className="text-apptext-secondary">{challanFor.address}</p>
                <p className="text-apptext-secondary">{challanFor.phone}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-apptext-secondary">Dispatch details</p>
                <p className="mt-1 font-semibold text-apptext-primary">
                  Order <span className="font-mono">{challanFor.orderNumber}</span>
                </p>
                <p className="text-apptext-secondary">Rider: {challanFor.assignedRider?.name ?? "Not assigned"}</p>
                <p className="text-apptext-secondary">
                  Vehicle: {challanFor.assignedRider?.vehiclePlateNo ?? "—"}
                </p>
                {challanFor.dispatchedAt && (
                  <p className="text-apptext-secondary">Dispatched: {formatTime(challanFor.dispatchedAt)}</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2">Pack</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {challanFor.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-apptext-primary">{it.productName}</td>
                      <td className="px-3 py-2 text-apptext-secondary">{it.packSizeName}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-surface text-sm">
                  <tr>
                    <td className="px-3 py-2 font-medium text-apptext-secondary" colSpan={2}>
                      Cash to collect
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-apptext-primary">
                      {formatCurrency(amountToCollect(challanFor))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
              <div>
                <div className="h-12 border-b border-dashed border-slate-300" />
                <p className="mt-2 font-medium text-slate-700">Dispatcher & rider signature</p>
              </div>
              <div>
                <div className="h-12 border-b border-dashed border-slate-300" />
                <p className="mt-2 font-medium text-slate-700">Pharmacy seal & signature</p>
                <p className="text-slate-400">Goods received sealed and intact</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
          <p className="flex-1">{toast}</p>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
