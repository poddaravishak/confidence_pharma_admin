"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Home, LayoutDashboard, PackageX, UserRound } from "lucide-react";
import { DeliveryPersonnel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/AppStore";
import { FullPageLoader } from "@/components/auth";
import { RiderAvatar } from "@/components/delivery/shared";

const RiderContext = createContext<DeliveryPersonnel | null>(null);

/** The rider whose panel is open (the signed-in rider, or the one an admin picked). */
export function useRider(): DeliveryPersonnel {
  const r = useContext(RiderContext);
  if (!r) throw new Error("useRider must be used inside <RiderShell>");
  return r;
}

const NAV = [
  { href: "/rider", label: "Today", icon: Home },
  { href: "/rider/returns", label: "Returns", icon: PackageX },
  { href: "/rider/cash", label: "Cash", icon: Banknote },
  { href: "/rider/profile", label: "Profile", icon: UserRound },
];

export function RiderShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, currentUser, can, riders, riderById, returns } = useAppStore();
  const [viewAs, setViewAs] = useState<string>("rider-01");

  useEffect(() => {
    if (hydrated && !currentUser) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, currentUser, pathname, router]);

  if (!hydrated || !currentUser) return <FullPageLoader />;

  if (!can("rider_app")) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
        <p className="font-semibold text-apptext-primary">The rider app isn&apos;t available for your role.</p>
        <Link href="/" className="text-sm font-medium text-brand-primary underline">
          Back to the admin panel
        </Link>
      </div>
    );
  }

  const ownRider = currentUser.riderId ? riderById[currentUser.riderId] : undefined;
  const rider = ownRider ?? riderById[viewAs];
  const isAdminView = !ownRider;
  const custody = returns.filter((r) => r.riderId === rider?.id && r.status === "IN_TRANSIT").length;

  if (!rider) return <FullPageLoader label="No rider profile linked to this account." />;

  return (
    <RiderContext.Provider value={rider}>
      <div className="min-h-dvh bg-slate-100">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface shadow-xl">
          {isAdminView && (
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 text-xs text-white">
              <Link href="/delivery" className="flex items-center gap-1 text-white/80 hover:text-white">
                <ArrowLeft className="size-3.5" aria-hidden /> Admin
              </Link>
              <span className="ml-auto text-white/60">Viewing as</span>
              <select
                value={rider.id}
                onChange={(e) => setViewAs(e.target.value)}
                aria-label="Choose rider to preview"
                className="rounded bg-slate-800 px-1.5 py-0.5 text-white"
              >
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-brand-primary px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
            <RiderAvatar name={rider.name} className="bg-white/15 text-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{rider.name}</p>
              <p className="truncate text-xs text-white/70">
                {rider.employeeCode} · {rider.vehiclePlateNo}
              </p>
            </div>
            {isAdminView && (
              <Link href="/" aria-label="Admin dashboard" className="rounded-lg p-2 text-white/80 hover:bg-white/10">
                <LayoutDashboard className="size-5" />
              </Link>
            )}
          </header>

          <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Rider navigation">
            <ul className="grid grid-cols-4">
              {NAV.map((n) => {
                const active = n.href === "/rider" ? pathname === "/rider" || pathname.startsWith("/rider/stop") : pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <li key={n.href}>
                    <Link href={n.href} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-brand-primary" : "text-slate-500")}>
                      <Icon className="size-5" aria-hidden />
                      {n.label}
                      {n.href === "/rider/returns" && custody > 0 && (
                        <span className="absolute right-[calc(50%-18px)] top-1.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{custody}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </RiderContext.Provider>
  );
}
