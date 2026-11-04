"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Package,
  Repeat,
  Search,
  Settings,
  ShoppingCart,
  User,
  Users,
} from "lucide-react";
import { AppNotification } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { ORDER_STATUS_META } from "@/lib/orders";
import { Badge } from "@/components/ui";

function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

const TONE_DOT: Record<AppNotification["tone"], string> = {
  info: "bg-brand-blue",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const router = useRouter();
  const { orders, customers, can } = useAppStore();
  const { items } = useInventory();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (term.length < 2) return null;
    const match = (...fields: (string | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(term));
    return {
      products: can("catalog") || can("inventory") ? items.filter((i) => match(i.name, i.genericName, i.sku, i.brand)).slice(0, 5) : [],
      orders: can("orders") ? orders.filter((o) => match(o.orderNumber, o.customerName, o.phone)).slice(0, 5) : [],
      customers: can("customers") ? customers.filter((c) => match(c.businessName, c.ownerName, c.phone)).slice(0, 4) : [],
    };
  }, [term, items, orders, customers, can]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const empty = results && !results.products.length && !results.orders.length && !results.customers.length;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search products, orders and customers"
        placeholder="Search medicines, orders, customers…"
        className="h-10 w-full rounded-lg border border-slate-200 bg-surface pl-9 pr-14 text-sm text-apptext-primary placeholder:text-slate-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
        ⌘K
      </kbd>

      {open && results && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {empty && <p className="px-3 py-6 text-center text-sm text-apptext-secondary">No matches for “{q}”.</p>}
          {results.products.length > 0 && (
            <ResultGroup label="Products" icon={Package}>
              {results.products.map((p) => (
                <ResultRow key={p.id} onClick={() => go(`/catalog/${p.id}`)} title={p.name} meta={`${p.genericName} · ${p.sku}`} />
              ))}
            </ResultGroup>
          )}
          {results.orders.length > 0 && (
            <ResultGroup label="Orders" icon={ShoppingCart}>
              {results.orders.map((o) => (
                <ResultRow
                  key={o.id}
                  onClick={() => go(`/orders/${o.id}`)}
                  title={o.orderNumber}
                  meta={`${o.customerName} · ${formatCurrency(o.grandTotal)}`}
                  right={<Badge className={ORDER_STATUS_META[o.orderStatus].badge}>{ORDER_STATUS_META[o.orderStatus].label}</Badge>}
                />
              ))}
            </ResultGroup>
          )}
          {results.customers.length > 0 && (
            <ResultGroup label="Customers" icon={Users}>
              {results.customers.map((c) => (
                <ResultRow key={c.id} onClick={() => go(`/customers?focus=${c.id}`)} title={c.businessName} meta={`${c.ownerName} · ${c.phone}`} />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({ title, meta, right, onClick }: { title: string; meta: string; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-apptext-primary">{title}</span>
        <span className="block truncate text-xs text-apptext-secondary">{meta}</span>
      </span>
      {right}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function NotificationsMenu() {
  const router = useRouter();
  const { notifications, markNotificationRead, markAllNotificationsRead, can } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const visible = notifications.filter((n) => can(n.module));
  const unread = visible.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-apptext-secondary transition hover:bg-surface"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-apptext-primary">Notifications</p>
            <button onClick={markAllNotificationsRead} disabled={!unread} className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary disabled:opacity-40">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto">
            {visible.length === 0 && <li className="px-4 py-8 text-center text-sm text-apptext-secondary">You&apos;re all caught up.</li>}
            {visible.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    markNotificationRead(n.id);
                    setOpen(false);
                    router.push(n.href);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface", !n.read && "bg-brand-light/20")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-slate-200" : TONE_DOT[n.tone])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-apptext-primary">{n.title}</span>
                    <span className="block text-xs text-apptext-secondary">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile menu with demo role switch                                  */
/* ------------------------------------------------------------------ */

function ProfileMenu() {
  const router = useRouter();
  const { currentUser, currentRole, users, roleById, login, logout, can } = useAppStore();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => {
    setOpen(false);
    setSwitching(false);
  });
  if (!currentUser) return null;

  const switchTo = (id: string) => {
    const role = login(id);
    setOpen(false);
    setSwitching(false);
    if (role) router.push(role.homePath);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-surface"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-primary text-xs font-bold text-white">{currentUser.initials}</span>
        <span className="hidden text-left md:block">
          <span className="block text-sm font-semibold leading-tight text-apptext-primary">{currentUser.name}</span>
          <span className="block text-xs leading-tight text-brand-blue">{currentRole?.name}</span>
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 md:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {!switching ? (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-apptext-primary">{currentUser.name}</p>
                <p className="text-xs text-apptext-secondary">{currentUser.email}</p>
                <Badge className={cn("mt-2", currentRole?.color ?? "")}>{currentRole?.name}</Badge>
              </div>
              <div className="p-1.5">
                <MenuLink href="/settings/profile" icon={User} onClick={() => setOpen(false)}>
                  My profile
                </MenuLink>
                {can("settings") && (
                  <MenuLink href="/settings" icon={Settings} onClick={() => setOpen(false)}>
                    Settings
                  </MenuLink>
                )}
                <button onClick={() => setSwitching(true)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-surface">
                  <Repeat className="size-4 text-slate-400" /> Switch demo user
                </button>
                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto p-1.5">
              <p className="px-3 py-2 text-xs text-apptext-secondary">Demo only: see the system as another role.</p>
              {users
                .filter((u) => u.status === "ACTIVE")
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchTo(u.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-surface", u.id === currentUser.id && "bg-brand-light/40")}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{u.initials}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-apptext-primary">{u.name}</span>
                      <span className="block truncate text-xs text-apptext-secondary">{roleById[u.roleId]?.name}</span>
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, children, onClick }: { href: string; icon: React.ElementType; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-surface">
      <Icon className="size-4 text-slate-400" /> {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export function Header({ onMenu }: { onMenu: () => void }) {
  const [lang, setLang] = useState<"en" | "bn">("en");

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-surface lg:hidden">
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => setLang((l) => (l === "en" ? "bn" : "en"))}
          aria-label="Switch language"
          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-light/40 sm:flex"
        >
          <Globe className="size-3.5 text-brand-blue" />
          {lang === "en" ? "বাংলা" : "English"}
        </button>
        <NotificationsMenu />
        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
}
