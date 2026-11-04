"use client";

import React from "react";
import { Snowflake, Zap } from "lucide-react";
import { DeliveryPersonnel, DeliveryRunStatus, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export const RIDER_STATUS: Record<DeliveryPersonnel["status"], { label: string; dot: string; text: string }> = {
  AVAILABLE: { label: "Available", dot: "bg-emerald-500", text: "text-emerald-700" },
  ON_DUTY: { label: "On duty", dot: "bg-brand-blue", text: "text-brand-primary" },
  ON_DELIVERY: { label: "On delivery", dot: "bg-amber-500", text: "text-amber-700" },
  OFF_DUTY: { label: "Off duty", dot: "bg-slate-300", text: "text-slate-500" },
};

export const VEHICLE_LABEL: Record<DeliveryPersonnel["vehicleType"], string> = {
  MOTORBIKE: "Motorbike",
  VAN: "Delivery van",
  BICYCLE: "Bicycle",
};

export const RUN_STATUS_META: Record<DeliveryRunStatus, { label: string; badge: string }> = {
  LOADING: { label: "Loading", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  IN_PROGRESS: { label: "On the road", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  RETURNING: { label: "Returning to hub", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  SETTLED: { label: "Settled", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function RiderAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-primary", className)}>
      {initials(name)}
    </span>
  );
}

export function DeliveryTypeTag({ type }: { type?: Order["deliveryType"] }) {
  if (type === "COLD_CHAIN")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <Snowflake className="size-3" aria-hidden /> Cold chain
      </span>
    );
  if (type === "EXPRESS")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
        <Zap className="size-3" aria-hidden /> Express
      </span>
    );
  return null;
}

export function mapsUrl(o: Pick<Order, "latitude" | "longitude" | "address">): string {
  return o.latitude && o.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`;
}

export function whatsappUrl(phone: string, text?: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Number stepper sized for thumbs on the rider app. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  label: string;
  size?: "md" | "lg";
}) {
  const btnCls = cn(
    "flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40",
    size === "lg" ? "size-11 text-lg" : "size-8"
  );
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={label}>
      <button type="button" className={btnCls} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        aria-label={label}
        className={cn(
          "rounded-lg border border-slate-200 text-center font-semibold tabular-nums text-apptext-primary focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20",
          size === "lg" ? "h-11 w-16 text-lg" : "h-8 w-12 text-sm"
        )}
      />
      <button type="button" className={btnCls} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}
