"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Role } from "@/lib/types";
import { countPermissions } from "@/lib/rbac";
import { useAppStore } from "@/lib/store/AppStore";
import { cn } from "@/lib/utils";
import { Badge, Card, Modal, btn } from "@/components/ui";
import { Avatar, SettingsHeader } from "@/components/settings/shared";
import { SUPER_ADMIN_ROLE_ID, TOTAL_PERMISSIONS } from "@/components/settings/roles";

export default function RolesPage() {
  const { roles, users, can, deleteRole, notify } = useAppStore();
  const [confirm, setConfirm] = useState<Role | null>(null);

  const usersOf = (roleId: string) => users.filter((u) => u.roleId === roleId);

  const deleteBlocker = (role: Role) => {
    const n = usersOf(role.id).length;
    if (role.isSystem) return "System roles can't be deleted.";
    if (n) return `Assigned to ${n} user${n === 1 ? "" : "s"}. Move them to another role first.`;
    return null;
  };

  return (
    <>
      <SettingsHeader
        title="Roles & permissions"
        description="Each role decides which modules staff can open and what they can change."
        actions={
          can("users", "create") && (
            <Link href="/settings/roles/new" className={btn.primary}>
              <Plus className="size-4" aria-hidden />
              Create role
            </Link>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {roles.map((role) => {
          const members = usersOf(role.id);
          const perms = countPermissions(role);
          const blocker = deleteBlocker(role);
          const locked = role.id === SUPER_ADMIN_ROLE_ID;
          const canEdit = can("users", "edit") && !locked;
          return (
            <Card key={role.id} className="flex flex-col">
              <div className="flex-1 space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={role.color}>{role.name}</Badge>
                  {role.isSystem && (
                    <Badge className="border-slate-200 bg-white text-slate-500">
                      <Lock className="size-3" aria-hidden />
                      System
                    </Badge>
                  )}
                </div>
                <p className="text-pretty text-sm text-apptext-secondary">{role.description || "No description."}</p>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-surface px-3 py-2">
                    <dt className="flex items-center gap-1.5 text-xs text-apptext-secondary">
                      <Users className="size-3.5" aria-hidden />
                      Users
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-apptext-primary">{members.length}</dd>
                  </div>
                  <div className="rounded-lg bg-surface px-3 py-2">
                    <dt className="flex items-center gap-1.5 text-xs text-apptext-secondary">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Permissions
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-apptext-primary">
                      {perms}
                      <span className="text-sm font-normal text-apptext-secondary"> / {TOTAL_PERMISSIONS}</span>
                    </dd>
                  </div>
                </dl>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${(perms / TOTAL_PERMISSIONS) * 100}%` }} />
                </div>

                {members.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {members.slice(0, 5).map((m) => (
                        <span key={m.id} title={m.name}>
                          <Avatar initials={m.initials} className="size-7 border-2 border-white text-[10px]" />
                        </span>
                      ))}
                    </div>
                    <span className="truncate text-xs text-apptext-secondary">
                      {members
                        .slice(0, 2)
                        .map((m) => m.name)
                        .join(", ")}
                      {members.length > 2 && ` +${members.length - 2} more`}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
                <Link href={`/settings/roles/${role.id}`} className={btn.small}>
                  {canEdit ? <Pencil className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                  {canEdit ? "Edit permissions" : "View permissions"}
                </Link>
                {can("users", "create") && (
                  <Link href={`/settings/roles/new?from=${role.id}`} className={btn.small}>
                    <Copy className="size-3.5" aria-hidden />
                    Clone
                  </Link>
                )}
                {can("users", "delete") && (
                  <button
                    type="button"
                    className={cn(btn.small, "ml-auto text-rose-700 hover:bg-rose-50")}
                    disabled={Boolean(blocker)}
                    title={blocker ?? `Delete ${role.name}`}
                    aria-describedby={blocker ? `del-${role.id}` : undefined}
                    onClick={() => setConfirm(role)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </button>
                )}
                {can("users", "delete") && blocker && (
                  <p id={`del-${role.id}`} className="w-full text-xs text-apptext-secondary">
                    {blocker}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {confirm && (
        <Modal
          title={`Delete ${confirm.name}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  const ok = deleteRole(confirm.id);
                  notify(ok ? `Role "${confirm.name}" deleted.` : `"${confirm.name}" can't be deleted.`, ok ? "success" : "warning");
                  setConfirm(null);
                }}
              >
                Delete role
              </button>
            </>
          }
        >
          <p className="text-sm text-apptext-secondary">This role has no users. Deleting it can&apos;t be undone.</p>
        </Modal>
      )}
    </>
  );
}
