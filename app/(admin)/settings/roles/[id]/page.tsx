"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock, SearchX } from "lucide-react";
import { Role } from "@/lib/types";
import { allPermissions, countPermissions, hasPermission, moduleForPath } from "@/lib/rbac";
import { useAppStore } from "@/lib/store/AppStore";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, btn, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, useDirtyGuard } from "@/components/settings/shared";
import {
  HOME_PAGES,
  PermissionMatrix,
  ROLE_COLORS,
  SUPER_ADMIN_ROLE_ID,
  TOTAL_PERMISSIONS,
  normalizePermissions,
} from "@/components/settings/roles";

export default function RoleEditorPage() {
  return (
    <Suspense>
      <RoleEditorRoute />
    </Suspense>
  );
}

const BLANK: Role = {
  id: "",
  name: "",
  description: "",
  isSystem: false,
  color: ROLE_COLORS[0].className,
  homePath: "/",
  permissions: { dashboard: ["view"] },
};

function RoleEditorRoute() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { roleById } = useAppStore();
  const isNew = id === "new";
  const fromId = params.get("from");

  if (isNew) {
    const source = fromId ? roleById[fromId] : undefined;
    const initial: Role = source
      ? {
          ...source,
          id: "",
          name: `${source.name} (copy)`,
          isSystem: false,
          permissions: normalizePermissions(source.id === SUPER_ADMIN_ROLE_ID ? allPermissions() : source.permissions),
        }
      : BLANK;
    return <RoleForm key={`new-${fromId ?? ""}`} initial={initial} isNew clonedFrom={source?.name} />;
  }

  const role = roleById[id];
  if (!role) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Role not found"
          description="It may have been deleted."
          action={
            <Link href="/settings/roles" className={btn.secondary}>
              Back to roles
            </Link>
          }
        />
      </Card>
    );
  }
  return <RoleForm key={role.id} initial={{ ...role, permissions: normalizePermissions(role.permissions) }} isNew={false} />;
}

function RoleForm({ initial, isNew, clonedFrom }: { initial: Role; isNew: boolean; clonedFrom?: string }) {
  const router = useRouter();
  const { roles, users, currentRole, can, saveRole, notify } = useAppStore();
  const [draft, setDraft] = useState<Role>(initial);
  const [baseline, setBaseline] = useState<Role>(initial);

  const locked = initial.id === SUPER_ADMIN_ROLE_ID;
  const readOnly = locked || !can("users", isNew ? "create" : "edit");
  const permissions = locked ? allPermissions() : draft.permissions;
  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(baseline);
  useDirtyGuard(dirty && !readOnly);

  const set = <K extends keyof Role>(k: K, v: Role[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const members = users.filter((u) => u.roleId === initial.id);
  const isOwnRole = !isNew && currentRole?.id === initial.id;
  const losesOwnAccess = isOwnRole && !hasPermission(draft.permissions, "users", "edit");

  const homeModule = moduleForPath(draft.homePath);
  const homeBlocked = !hasPermission(permissions, homeModule);
  const homeLabel = HOME_PAGES.find((h) => h.path === draft.homePath)?.label ?? draft.homePath;

  const nameTaken = roles.some((r) => r.id !== draft.id && r.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  const error = !draft.name.trim()
    ? "Give the role a name."
    : nameTaken
      ? "Another role already uses this name."
      : countPermissions(draft) === 0
        ? "Grant at least one permission."
        : null;

  const colorOptions = ROLE_COLORS.some((c) => c.className === draft.color)
    ? ROLE_COLORS
    : [{ label: "Current", className: draft.color }, ...ROLE_COLORS];

  const save = () => {
    if (error) return;
    const next: Role = {
      ...draft,
      id: draft.id || `role-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      permissions: normalizePermissions(draft.permissions),
    };
    saveRole(next);
    notify(isNew ? `Role "${next.name}" created.` : `Role "${next.name}" saved.`);
    if (isNew) router.replace(`/settings/roles/${next.id}`);
    else {
      setDraft(next);
      setBaseline(next);
    }
  };

  const discard = () => {
    if (isNew) router.push("/settings/roles");
    else setDraft(baseline);
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/settings/roles" className="mb-1 inline-flex items-center gap-1 text-sm text-apptext-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" aria-hidden />
            All roles
          </Link>
          <h2 className="text-balance text-lg font-semibold text-apptext-primary">
            {isNew ? (clonedFrom ? `Clone ${clonedFrom}` : "Create role") : initial.name}
          </h2>
          <p className="mt-0.5 text-sm text-apptext-secondary">
            {isNew
              ? "Name the role, pick where it lands after sign-in, then tick what it can do."
              : `${members.length} user${members.length === 1 ? "" : "s"} · ${countPermissions({ permissions })} of ${TOTAL_PERMISSIONS} permissions`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {initial.isSystem && (
            <Badge className="border-slate-200 bg-white text-slate-500">
              <Lock className="size-3" aria-hidden />
              System role
            </Badge>
          )}
          <Badge className={draft.color}>{draft.name.trim() || "New role"}</Badge>
        </div>
      </div>

      {locked ? (
        <p className="flex items-start gap-2 rounded-lg border border-brand-light bg-brand-light/40 px-3 py-2 text-sm text-brand-primary">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Super Admin always has every permission so the business can never be locked out. It can&apos;t be edited; clone it to start a custom role.
        </p>
      ) : (
        readOnly && <ReadOnlyNotice>You can view this role, but your role can&apos;t change roles.</ReadOnlyNotice>
      )}

      {losesOwnAccess && !readOnly && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          This is your own role. Saving without “Users &amp; roles → Edit” will lock you out of this page.
        </p>
      )}

      <Card>
        <CardHeader title="Role details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Role name">
            {(id) => (
              <input id={id} value={draft.name} onChange={(e) => set("name", e.target.value)} disabled={readOnly} placeholder="e.g. Branch Supervisor" className={inputClass} />
            )}
          </Field>
          <Field
            label="Home page after sign-in"
            error={homeBlocked ? `This role can't open ${homeLabel}. Grant ${homeLabel} → View or pick another page.` : undefined}
          >
            {(id) => (
              <select id={id} value={draft.homePath} onChange={(e) => set("homePath", e.target.value)} disabled={readOnly} className={inputClass}>
                {HOME_PAGES.map((h) => (
                  <option key={h.path} value={h.path}>
                    {h.label}
                    {hasPermission(permissions, moduleForPath(h.path)) ? "" : " (no access)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Description" className="sm:col-span-2">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                disabled={readOnly}
                placeholder="What this role is for"
                className={inputClass}
              />
            )}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Chip colour</legend>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.className}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={draft.color === c.className}
                  onClick={() => set("color", c.className)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    c.className,
                    draft.color === c.className ? "ring-2 ring-brand-blue ring-offset-1" : "opacity-80 hover:opacity-100"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Permissions"
          description="Ticking any action also grants View. Clearing View removes the module entirely."
          actions={
            <span className="text-sm tabular-nums text-apptext-secondary">
              {countPermissions({ permissions })} / {TOTAL_PERMISSIONS} granted
            </span>
          }
        />
        <PermissionMatrix value={permissions} onChange={(p) => set("permissions", p)} disabled={readOnly} />
      </Card>

      {!isNew && members.length > 0 && (
        <Card>
          <CardHeader title="Users with this role" description="Changes apply to them the next time a page loads." />
          <ul className="flex flex-wrap gap-2 p-4 sm:p-5">
            {members.map((m) => (
              <li key={m.id} className="rounded-full border border-slate-200 bg-surface px-3 py-1 text-sm text-apptext-primary">
                {m.name}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SaveBar
        dirty={dirty}
        readOnly={readOnly}
        error={dirty ? error : null}
        onSave={save}
        onDiscard={discard}
        saveLabel={isNew ? "Create role" : "Save role"}
      />
    </>
  );
}
