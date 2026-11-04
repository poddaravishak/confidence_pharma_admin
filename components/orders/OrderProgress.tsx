"use client";

import React from "react";
import {
  Check,
  CircleCheck,
  CircleX,
  ClipboardList,
  Navigation,
  Package,
  PackageCheck,
  PackageMinus,
  PackageX,
  RotateCcw,
  ShoppingCart,
  StickyNote,
  Truck,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { Order, OrderEvent, OrderStatus } from "@/lib/types";
import { ORDER_PIPELINE, ORDER_STATUS_META } from "@/lib/orders";
import { formatDateTime } from "@/lib/inventory";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Progress stepper                                                    */
/* ------------------------------------------------------------------ */

type StepState = "done" | "current" | "todo" | "partial" | "bad";

interface Step {
  key: string;
  label: string;
  state: StepState;
  at?: string;
}

function firstAt(timeline: OrderEvent[] | undefined, status: OrderStatus) {
  return timeline?.find((e) => e.status === status)?.at;
}

function buildSteps(order: Order): Step[] {
  const s = order.orderStatus;
  const tl = order.timeline;
  const base = (upTo: number, currentIdx: number | null): Step[] =>
    ORDER_PIPELINE.slice(0, upTo).map((st, i) => ({
      key: st,
      label: ORDER_STATUS_META[st].label,
      state: currentIdx === null ? "done" : i < currentIdx ? "done" : i === currentIdx ? "current" : "todo",
      at: firstAt(tl, st),
    }));

  if (s === "PARTIALLY_DELIVERED") {
    return [...base(6, null), { key: s, label: "Partially delivered", state: "partial", at: firstAt(tl, s) ?? order.deliveredAt }];
  }
  if (s === "FAILED_DELIVERY" || s === "RETURNED") {
    return [...base(6, null), { key: s, label: ORDER_STATUS_META[s].label, state: "bad", at: firstAt(tl, s) }];
  }
  if (s === "CANCELLED") {
    let reached = 0;
    for (const e of tl ?? []) {
      const i = ORDER_PIPELINE.indexOf(e.status as OrderStatus);
      if (i > reached) reached = i;
    }
    return [...base(reached + 1, null), { key: s, label: "Cancelled", state: "bad", at: firstAt(tl, s) }];
  }
  const idx = ORDER_PIPELINE.indexOf(s);
  return base(ORDER_PIPELINE.length, s === "DELIVERED" ? null : idx);
}

const DOT: Record<StepState, string> = {
  done: "bg-brand-primary text-white border-brand-primary",
  current: "bg-white text-brand-primary border-brand-primary ring-4 ring-brand-light",
  todo: "bg-white text-slate-400 border-slate-200",
  partial: "bg-teal-600 text-white border-teal-600",
  bad: "bg-rose-600 text-white border-rose-600",
};

export function OrderStepper({ order }: { order: Order }) {
  const steps = buildSteps(order);
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max items-start sm:min-w-0" aria-label="Order progress">
        {steps.map((st, i) => {
          const last = i === steps.length - 1;
          const Icon = st.state === "bad" ? X : st.state === "todo" || st.state === "current" ? null : Check;
          return (
            <li key={st.key} className={cn("relative flex flex-col items-center text-center", last ? "w-24" : "w-24 flex-1")}>
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-3.5 h-0.5 w-full",
                    steps[i + 1].state === "todo" ? "bg-slate-200" : "bg-brand-primary"
                  )}
                />
              )}
              <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums", DOT[st.state])}>
                {Icon ? <Icon className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-2 px-1 text-xs font-medium leading-tight",
                  st.state === "todo" ? "text-slate-400" : st.state === "bad" ? "text-rose-700" : st.state === "partial" ? "text-teal-700" : "text-apptext-primary"
                )}
              >
                {st.label}
                {st.state === "current" && <span className="sr-only"> (current step)</span>}
              </span>
              {st.at && <span className="mt-0.5 text-[11px] tabular-nums text-apptext-secondary">{formatDateTime(st.at)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

const EVENT_ICON: Record<OrderEvent["status"], { icon: React.ElementType; tone: string }> = {
  PLACED: { icon: ShoppingCart, tone: "bg-slate-100 text-slate-600" },
  CONFIRMED: { icon: CircleCheck, tone: "bg-sky-50 text-sky-700" },
  PROCESSING: { icon: ClipboardList, tone: "bg-indigo-50 text-indigo-700" },
  PACKED: { icon: Package, tone: "bg-violet-50 text-violet-700" },
  DISPATCHED: { icon: Truck, tone: "bg-brand-light text-brand-primary" },
  OUT_FOR_DELIVERY: { icon: Navigation, tone: "bg-amber-50 text-amber-700" },
  DELIVERED: { icon: PackageCheck, tone: "bg-emerald-50 text-emerald-700" },
  PARTIALLY_DELIVERED: { icon: PackageMinus, tone: "bg-teal-50 text-teal-700" },
  FAILED_DELIVERY: { icon: PackageX, tone: "bg-rose-50 text-rose-700" },
  CANCELLED: { icon: CircleX, tone: "bg-slate-100 text-slate-500" },
  RETURNED: { icon: Undo2, tone: "bg-rose-50 text-rose-700" },
  NOTE: { icon: StickyNote, tone: "bg-slate-100 text-slate-600" },
  PAYMENT: { icon: Wallet, tone: "bg-emerald-50 text-emerald-700" },
  RETURN: { icon: RotateCcw, tone: "bg-indigo-50 text-indigo-700" },
};

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  if (!sorted.length) return <p className="px-4 py-6 text-sm text-apptext-secondary sm:px-5">No activity recorded yet.</p>;
  return (
    <ol className="px-4 py-4 sm:px-5">
      {sorted.map((e, i) => {
        const m = EVENT_ICON[e.status] ?? EVENT_ICON.NOTE;
        const Icon = m.icon;
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {i < sorted.length - 1 && <span aria-hidden className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-slate-200" />}
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", m.tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-apptext-primary">{e.label}</p>
              <p className="text-xs text-apptext-secondary">
                <time dateTime={e.at} className="tabular-nums">
                  {formatDateTime(e.at)}
                </time>{" "}
                · {e.by}
              </p>
              {e.note && <p className="mt-1 text-pretty rounded-lg bg-surface px-2.5 py-1.5 text-xs text-slate-600">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
