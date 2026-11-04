"use client";

import React from "react";
import { Check, Minus } from "lucide-react";
import { PermissionAction, PermissionModule, PermissionSet } from "@/lib/types";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, allPermissions, countPermissions } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Checkbox } from "./shared";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const SUPER_ADMIN_ROLE_ID = "role-super";

export const TOTAL_PERMISSIONS = countPermissions({ permissions: allPermissions() });

export const ROLE_COLORS: { label: string; className: string }[] = [
  { label: "Sky", className: "bg-sky-50 text-sky-700 border-sky-200" },
  { label: "Emerald", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { label: "Teal", className: "bg-teal-50 text-teal-700 border-teal-200" },
  { label: "Amber", className: "bg-amber-50 text-amber-800 border-amber-200" },
  { label: "Orange", className: "bg-orange-50 text-orange-700 border-orange-200" },
  { label: "Rose", className: "bg-rose-50 text-rose-700 border-rose-200" },
  { label: "Indigo", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { label: "Violet", className: "bg-violet-50 text-violet-700 border-violet-200" },
  { label: "Slate", className: "bg-slate-100 text-slate-700 border-slate-200" },
  { label: "Brand", className: "bg-brand-light text-brand-primary border-brand-light" },
];

export const HOME_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/orders", label: "Orders" },
  { path: "/delivery", label: "Delivery & fleet" },
  { path: "/returns", label: "Returns" },
  { path: "/inventory", label: "Inventory" },
  { path: "/catalog", label: "Catalog & pricing" },
  { path: "/customers", label: "Customers" },
  { path: "/purchases", label: "Purchases" },
  { path: "/suppliers", label: "Suppliers" },
  { path: "/accounts", label: "Accounts" },
  { path: "/messages", label: "Customer inquiries" },
  { path: "/settings", label: "Settings" },
  { path: "/rider", label: "Rider app" },
];

const ACTION_ORDER = PERMISSION_ACTIONS.map((a) => a.id);
const MODULE_GROUPS = Array.from(new Set(PERMISSION_MODULES.map((m) => m.group)));

/** Sorted actions, empty modules removed, so two sets compare reliably. */
export function normalizePermissions(set: PermissionSet): PermissionSet {
  const out: PermissionSet = {};
  for (const m of PERMISSION_MODULES) {
    const list = set[m.id]?.filter((a) => m.actions.includes(a)) ?? [];
    if (list.length) out[m.id] = ACTION_ORDER.filter((a) => list.includes(a));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Permission matrix                                                   */
/* ------------------------------------------------------------------ */

export function PermissionMatrix({
  value,
  onChange,
  disabled,
}: {
  value: PermissionSet;
  onChange: (next: PermissionSet) => void;
  disabled?: boolean;
}) {
  const setModule = (draft: PermissionSet, m: PermissionModule, actions: PermissionAction[]) => {
    if (actions.length) draft[m] = ACTION_ORDER.filter((a) => actions.includes(a));
    else delete draft[m];
  };

  const applyToggle = (draft: PermissionSet, m: PermissionModule, a: PermissionAction, on: boolean) => {
    const cur = draft[m] ?? [];
    if (on) setModule(draft, m, Array.from(new Set([...cur, a, "view" as const])));
    else if (a === "view") setModule(draft, m, []);
    else setModule(draft, m, cur.filter((x) => x !== a));
  };

  const toggle = (m: PermissionModule, a: PermissionAction, on: boolean) => {
    const draft = { ...value };
    applyToggle(draft, m, a, on);
    onChange(draft);
  };

  const toggleRow = (m: (typeof PERMISSION_MODULES)[number], on: boolean) => {
    const draft = { ...value };
    setModule(draft, m.id, on ? [...m.actions] : []);
    onChange(draft);
  };

  const toggleColumn = (a: PermissionAction, on: boolean) => {
    const draft = { ...value };
    for (const m of PERMISSION_MODULES) if (m.actions.includes(a)) applyToggle(draft, m.id, a, on);
    onChange(draft);
  };

  const columnState = (a: PermissionAction) => {
    const applicable = PERMISSION_MODULES.filter((m) => m.actions.includes(a));
    const on = applicable.filter((m) => value[m.id]?.includes(a)).length;
    return { all: on === applicable.length, some: on > 0 };
  };

  const allOn = PERMISSION_MODULES.every((m) => m.actions.every((a) => value[m.id]?.includes(a)));
  const anyOn = PERMISSION_MODULES.some((m) => (value[m.id]?.length ?? 0) > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-surface text-xs text-apptext-secondary">
            <th scope="col" className="sticky left-0 z-10 w-72 bg-surface px-4 py-2.5 text-left font-medium">
              Module
            </th>
            <th scope="col" className="px-2 py-2.5 text-center font-medium">
              <div className="flex flex-col items-center gap-1.5">
                <span>All</span>
                <Checkbox
                  label="Grant every permission"
                  checked={allOn}
                  indeterminate={anyOn}
                  disabled={disabled}
                  onChange={(on) => onChange(on ? allPermissions() : {})}
                />
              </div>
            </th>
            {PERMISSION_ACTIONS.map((a) => {
              const s = columnState(a.id);
              return (
                <th key={a.id} scope="col" className="px-2 py-2.5 text-center font-medium">
                  <div className="flex flex-col items-center gap-1.5">
                    <span>{a.label}</span>
                    <Checkbox
                      label={`${a.label} on every module`}
                      checked={s.all}
                      indeterminate={s.some}
                      disabled={disabled}
                      onChange={(on) => toggleColumn(a.id, on)}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        {MODULE_GROUPS.map((group) => (
          <tbody key={group} className="divide-y divide-slate-100">
            <tr>
              <th
                colSpan={2 + PERMISSION_ACTIONS.length}
                scope="colgroup"
                className="border-y border-slate-100 bg-slate-50/70 px-4 py-1.5 text-left text-xs font-semibold text-apptext-secondary"
              >
                <span className="sticky left-4">{group}</span>
              </th>
            </tr>
            {PERMISSION_MODULES.filter((m) => m.group === group).map((m) => {
              const granted = value[m.id] ?? [];
              const rowAll = m.actions.every((a) => granted.includes(a));
              return (
                <tr key={m.id} className={cn("transition", granted.length > 0 && "bg-brand-light/15")}>
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left font-normal">
                    <span className="block font-medium text-apptext-primary">{m.label}</span>
                    <span className="block text-xs text-apptext-secondary">{m.description}</span>
                  </th>
                  <td className="px-2 py-2.5 text-center">
                    <Checkbox
                      label={`All ${m.label} permissions`}
                      checked={rowAll}
                      indeterminate={granted.length > 0}
                      disabled={disabled}
                      onChange={(on) => toggleRow(m, on)}
                    />
                  </td>
                  {PERMISSION_ACTIONS.map((a) => (
                    <td key={a.id} className="px-2 py-2.5 text-center">
                      {m.actions.includes(a.id) ? (
                        <Checkbox
                          label={`${a.label} ${m.label}`}
                          checked={granted.includes(a.id)}
                          disabled={disabled}
                          onChange={(on) => toggle(m.id, a.id, on)}
                        />
                      ) : (
                        <span className="text-slate-300" title="Not applicable to this module">
                          <span aria-hidden>–</span>
                          <span className="sr-only">Not applicable</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only summary (profile page, role cards)                        */
/* ------------------------------------------------------------------ */

export function PermissionSummary({ permissions }: { permissions: PermissionSet }) {
  return (
    <ul className="divide-y divide-slate-100">
      {PERMISSION_MODULES.map((m) => {
        const granted = permissions[m.id] ?? [];
        return (
          <li key={m.id} className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span className={cn("flex items-center gap-2 text-sm", granted.length ? "font-medium text-apptext-primary" : "text-slate-400")}>
              {granted.length ? (
                <Check className="size-4 text-brand-green" aria-hidden />
              ) : (
                <Minus className="size-4 text-slate-300" aria-hidden />
              )}
              {m.label}
            </span>
            {granted.length ? (
              <span className="flex flex-wrap gap-1 sm:justify-end">
                {PERMISSION_ACTIONS.filter((a) => granted.includes(a.id)).map((a) => (
                  <Badge key={a.id} className="border-brand-light bg-brand-light/50 text-brand-primary">
                    {a.label}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-xs text-slate-400">No access</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
