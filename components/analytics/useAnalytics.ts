"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import {
  DateRange,
  OTHER_CUSTOMER_ID,
  OTHER_CUSTOMER_LABEL,
  RangePreset,
  analyticsHistory,
  mergeLive,
  resolveRange,
} from "@/lib/db/analytics-data";

/** Generated history with today's live store orders and returns layered on top. */
export function useLiveHistory() {
  const { orders, returns } = useAppStore();
  return useMemo(() => mergeLive(analyticsHistory, orders, returns), [orders, returns]);
}

export function useDateRange(initial: RangePreset = "30d") {
  return useState<DateRange>(() => resolveRange(initial));
}

/** Display names for ids used in the history (live store first, so renames show up). */
export function useNameLookup() {
  const { customers, riders } = useAppStore();
  const { items } = useInventory();
  return useMemo(() => {
    const customer: Record<string, string> = { [OTHER_CUSTOMER_ID]: OTHER_CUSTOMER_LABEL };
    for (const c of customers) customer[c.id] = c.businessName;
    const rider: Record<string, string> = {};
    for (const r of riders) rider[r.id] = r.name;
    const product: Record<string, string> = {};
    for (const i of items) product[i.id] = i.name;
    return {
      customer: (id: string) => customer[id] ?? id,
      rider: (id: string) => rider[id] ?? id,
      product: (id: string) => product[id] ?? id,
    };
  }, [customers, riders, items]);
}
