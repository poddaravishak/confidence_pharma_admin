"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CircleUser,
  Eye,
  KeyRound,
  Lock,
  MoreHorizontal,
  Receipt,
  ShieldCheck,
  Truck,
  Undo2,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { AppSettings, PermissionModule } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { cn } from "@/lib/utils";
import { btn } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Hub navigation                                                      */
/* ------------------------------------------------------------------ */

type NavItem = { href: string; label: string; icon: React.ElementType; module: PermissionModule | null };

export const SETTINGS_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Organisation",
    items: [
      { href: "/settings", label: "Company profile", icon: Building2, module: "settings" },
      { href: "/settings/warehouses", label: "Warehouses", icon: Warehouse, module: "settings" },
    ],
  },
  {
    group: "People & access",
    items: [
      { href: "/settings/users", label: "Users & staff", icon: Users, module: "users" },
      { href: "/settings/roles", label: "Roles & permissions", icon: KeyRound, module: "users" },
      { href: "/settings/security", label: "Security", icon: Lock, module: "settings" },
    ],
  },
  {
    group: "Commerce",
    items: [
      { href: "/settings/tax-invoice", label: "Tax & invoice", icon: Receipt, module: "settings" },
      { href: "/settings/payments", label: "Payment methods & credit", icon: Wallet, module: "settings" },
      { href: "/settings/delivery", label: "Delivery", icon: Truck, module: "settings" },
      { href: "/settings/returns", label: "Return policy", icon: Undo2, module: "settings" },
      { href: "/settings/notifications", label: "Notifications", icon: Bell, module: "settings" },
    ],
  },
  {
    group: "Records & account",
    items: [
      { href: "/settings/audit-logs", label: "Audit logs", icon: ShieldCheck, module: "audit" },
      { href: "/settings/profile", label: "My profile", icon: CircleUser, module: null },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/settings" ? pathname === "/settings" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav() {
  const pathname = usePathname();
  const { can } = useAppStore();

  const groups = SETTINGS_NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.module || can(i.module)) })).filter(
    (g) => g.items.length > 0
  );
  const flat = groups.flatMap((g) => g.items);

  return (
    <>
      {/* Mobile / tablet: horizontal scroll */}
      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
        <ul className="flex min-w-max gap-1.5 pb-1">
          {flat.map((i) => {
            const active = isActive(pathname, i.href);
            const Icon = i.icon;
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: left rail */}
      <nav aria-label="Settings sections" className="hidden lg:block">
        <div className="sticky top-20 space-y-5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          {groups.map((g) => (
            <div key={g.group}>
              <p className="px-2.5 pb-1.5 text-xs font-semibold text-apptext-secondary">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const active = isActive(pathname, i.href);
                  const Icon = i.icon;
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                          active ? "bg-brand-light text-brand-primary" : "text-slate-600 hover:bg-surface hover:text-apptext-primary"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-brand-primary" : "text-slate-400")} aria-hidden />
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

export function SettingsHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-balance text-lg font-semibold text-apptext-primary">{title}</h2>
        {description && <p className="mt-0.5 text-pretty text-sm text-apptext-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ReadOnlyNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-brand-light bg-brand-light/40 px-3 py-2 text-sm text-brand-primary">
      <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children ?? "You can view these settings, but your role can't change them."}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Draft state with dirty tracking for one settings section            */
/* ------------------------------------------------------------------ */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function useSettingsDraft<K extends keyof AppSettings>(section: K) {
  const { settings, updateSettings, notify, can } = useAppStore();
  const saved = settings[section];
  const [draft, setDraft] = useState<AppSettings[K]>(saved);
  const dirty = !same(draft, saved);
  useDirtyGuard(dirty);

  return {
    draft,
    setDraft,
    saved,
    dirty,
    readOnly: !can("settings", "edit"),
    save: (message = "Settings saved.") => {
      updateSettings(section, draft);
      notify(message);
    },
    discard: () => setDraft(saved),
  };
}

/* ------------------------------------------------------------------ */
/* Save / discard bar                                                  */
/* ------------------------------------------------------------------ */

export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  error,
  readOnly,
  saveLabel = "Save changes",
}: {
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  error?: string | null;
  readOnly?: boolean;
  saveLabel?: string;
}) {
  if (readOnly) return null;
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm transition sm:flex-row sm:items-center sm:justify-between",
        dirty ? "border-amber-200 bg-amber-50" : "border-slate-200/80 bg-white"
      )}
      role="status"
    >
      <p className={cn("text-sm", error ? "text-rose-700" : dirty ? "font-medium text-amber-800" : "text-apptext-secondary")}>
        {error ?? (dirty ? "You have unsaved changes." : "All changes saved.")}
      </p>
      <div className="flex gap-2">
        <button type="button" className={cn(btn.secondary, "flex-1 sm:flex-none")} onClick={onDiscard} disabled={!dirty}>
          Discard
        </button>
        <button type="button" className={cn(btn.primary, "flex-1 sm:flex-none")} onClick={onSave} disabled={!dirty || Boolean(error)}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small inputs                                                        */
/* ------------------------------------------------------------------ */

/** Parses a numeric input; empty input becomes 0. */
export const toNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={cn(
        "size-4 cursor-pointer rounded border-slate-300 accent-brand-primary disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    />
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-primary",
        className
      )}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Row action menu                                                     */
/* ------------------------------------------------------------------ */

export type MenuItem = {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
};

export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-apptext-primary"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger ? "text-rose-700 hover:bg-rose-50" : "text-apptext-primary hover:bg-surface"
                )}
              >
                {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  {item.hint && <span className="block text-xs text-apptext-secondary">{item.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Two-column label / value line used in read-only summaries. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-apptext-secondary">{label}</dt>
      <dd className="text-sm font-medium text-apptext-primary sm:text-right">{children}</dd>
    </div>
  );
}
