"use client";

import React from "react";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";
import { PermissionAction, PermissionModule } from "@/lib/types";
import { MODULE_LABEL } from "@/lib/rbac";
import { useAppStore } from "@/lib/store/AppStore";
import { btn } from "@/components/ui";

/** Renders children only when the signed-in role has the permission. */
export function Can({
  module,
  action = "view",
  children,
  fallback = null,
}: {
  module: PermissionModule;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useAppStore();
  return <>{can(module, action) ? children : fallback}</>;
}

export function AccessDenied({ module }: { module: PermissionModule }) {
  const { currentRole } = useAppStore();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm">
      <span className="rounded-full bg-rose-50 p-3 text-rose-600">
        <ShieldAlert className="size-7" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-apptext-primary">You don&apos;t have access to {MODULE_LABEL[module]}</h1>
      <p className="text-pretty text-sm text-apptext-secondary">
        Your role <span className="font-medium text-apptext-primary">{currentRole?.name ?? "—"}</span> can&apos;t view this
        page. Ask a Super Admin to update your permissions in Settings → Roles &amp; permissions.
      </p>
      <Link href={currentRole?.homePath ?? "/"} className={btn.primary}>
        Go to my home page
      </Link>
    </div>
  );
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <div className="flex items-center gap-2 text-sm text-apptext-secondary">
        <Loader2 className="size-4 animate-spin text-brand-primary" aria-hidden />
        {label}
      </div>
    </div>
  );
}
