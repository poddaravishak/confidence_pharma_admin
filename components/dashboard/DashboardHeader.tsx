"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { PackagePlus, Plus, RotateCcw, Truck } from "lucide-react";
import { PermissionAction, PermissionModule } from "@/lib/types";
import { ANALYTICS_TODAY, DateRange } from "@/lib/db/analytics-data";
import { btn } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./DateRangePicker";

const QUICK_ACTIONS: { href: string; label: string; icon: React.ElementType; module: PermissionModule; action: PermissionAction; primary?: boolean }[] = [
  { href: "/orders/new", label: "New order", icon: Plus, module: "orders", action: "create", primary: true },
  { href: "/catalog/new", label: "Add product", icon: PackagePlus, module: "catalog", action: "create" },
  { href: "/returns", label: "Returns", icon: RotateCcw, module: "returns", action: "view" },
  { href: "/delivery", label: "Delivery", icon: Truck, module: "delivery", action: "view" },
];

const noopSubscribe = () => () => {};

/** Current hour on the client; a neutral morning hour while rendering on the server. */
function useHour() {
  return useSyncExternalStore(
    noopSubscribe,
    () => new Date().getHours(),
    () => 9
  );
}

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function DashboardHeader({
  name,
  roleName,
  range,
  onRangeChange,
  can,
}: {
  name: string;
  roleName?: string;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  can: (module: PermissionModule, action?: PermissionAction) => boolean;
}) {
  const hour = useHour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const actions = QUICK_ACTIONS.filter((a) => can(a.module, a.action));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-apptext-secondary">
          {longDate(ANALYTICS_TODAY)}
          {roleName && <span className="text-apptext-muted"> · {roleName}</span>}
        </p>
        <h1 className="mt-0.5 text-balance text-2xl font-bold tracking-tight text-brand-primary">
          {greeting}, {name}
        </h1>
        <p className="mt-1 text-pretty text-sm text-apptext-secondary">Here is how the business is doing.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <DateRangePicker value={range} onChange={onRangeChange} />
        {actions.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Quick actions">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href} className={cn(a.primary ? btn.primary : btn.secondary, "whitespace-nowrap")}>
                  <Icon className="size-4" aria-hidden />
                  {a.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
