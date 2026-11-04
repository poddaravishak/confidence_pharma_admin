"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { moduleForPath } from "@/lib/rbac";
import { useAppStore } from "@/lib/store/AppStore";
import { AccessDenied, FullPageLoader } from "@/components/auth";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

/** Admin chrome: sign-in guard, role-based route guard, sidebar (drawer on mobile) and header. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, currentUser, currentRole, can } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const isRiderOnly = Boolean(currentRole && !can("dashboard") && can("rider_app") && Object.keys(currentRole.permissions).length === 1);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (isRiderOnly) router.replace("/rider");
  }, [hydrated, currentUser, isRiderOnly, pathname, router]);

  if (!hydrated || !currentUser || isRiderOnly) return <FullPageLoader />;

  const routeModule = moduleForPath(pathname);
  const allowed = pathname.startsWith("/settings/profile") || can(routeModule);

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{allowed ? children : <AccessDenied module={routeModule} />}</main>
      </div>
    </div>
  );
}
