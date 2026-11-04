"use client";

import React, { useMemo, useState } from "react";
import {
  KeyRound,
  MailPlus,
  Pencil,
  Send,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { StaffStatus, StaffUser } from "@/lib/types";
import { hasPermission } from "@/lib/rbac";
import { formatDateTime } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, Field, FilterPills, Modal, SearchInput, StatCard, btn, inputClass } from "@/components/ui";
import { Avatar, MenuItem, RowMenu, SettingsHeader } from "@/components/settings/shared";

type StatusFilter = "ALL" | StaffStatus;

const STATUS_META: Record<StaffStatus, { label: string; badge: string }> = {
  ACTIVE: { label: "Active", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactive", badge: "border-slate-200 bg-slate-100 text-slate-600" },
  INVITED: { label: "Invited", badge: "border-amber-200 bg-amber-50 text-amber-800" },
};

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

export default function UsersPage() {
  const { users, roles, roleById, currentUser, can, saveUser, deleteUser, notify, logAudit } = useAppStore();
  const { warehouseById } = useInventory();

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [confirm, setConfirm] = useState<StaffUser | null>(null);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "ACTIVE");
    return {
      total: users.length,
      active: active.length,
      invited: users.filter((u) => u.status === "INVITED").length,
      inactive: users.filter((u) => u.status === "INACTIVE").length,
      twoFa: active.filter((u) => u.twoFactorEnabled).length,
      activeCount: active.length,
    };
  }, [users]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (status !== "ALL" && u.status !== status) return false;
      if (roleFilter !== "ALL" && u.roleId !== roleFilter) return false;
      if (!q) return true;
      return [u.name, u.email, u.phone, u.designation, roleById[u.roleId]?.name ?? ""].some((f) => f.toLowerCase().includes(q));
    });
  }, [users, status, roleFilter, query, roleById]);

  const count = (s: StatusFilter) => (s === "ALL" ? users.length : users.filter((u) => u.status === s).length);

  const setUserStatus = (u: StaffUser, next: StaffStatus) => {
    saveUser({ ...u, status: next });
    notify(
      next === "ACTIVE" ? `${u.name} can sign in again.` : `${u.name} has been deactivated.`,
      next === "ACTIVE" ? "success" : "warning"
    );
  };

  const menuFor = (u: StaffUser): MenuItem[] => {
    const isSelf = u.id === currentUser?.id;
    const items: MenuItem[] = [];
    if (can("users", "edit")) {
      items.push({ label: "Edit user", icon: Pencil, onSelect: () => setEditing(u) });
      if (u.status === "INVITED") {
        items.push({
          label: "Resend invite",
          icon: Send,
          hint: `Email and SMS to ${u.phone}`,
          onSelect: () => {
            logAudit("INVITE_RESENT", "USERS", `Invite re-sent to ${u.name} (${u.email}).`);
            notify(`Invite re-sent to ${u.email}.`);
          },
        });
      } else {
        items.push({
          label: "Reset password",
          icon: KeyRound,
          hint: "Sends a one-time reset link",
          onSelect: () => {
            logAudit("PASSWORD_RESET", "USERS", `Password reset link sent to ${u.name}.`);
            notify(`Password reset link sent to ${u.email}.`);
          },
        });
      }
      if (u.status === "INACTIVE") {
        items.push({ label: "Activate", icon: UserCheck, onSelect: () => setUserStatus(u, "ACTIVE") });
      }
    }
    if (can("users", "delete") && u.status !== "INACTIVE") {
      items.push({
        label: u.status === "INVITED" ? "Revoke invite" : "Deactivate",
        icon: UserX,
        danger: true,
        disabled: isSelf,
        hint: isSelf ? "You can't deactivate your own account" : "Signs them out and blocks sign-in",
        onSelect: () => setConfirm(u),
      });
    }
    return items;
  };

  const warehouseName = (id?: string) => (id ? warehouseById[id]?.name ?? id : "All warehouses");

  return (
    <>
      <SettingsHeader
        title="Users & staff"
        description="Invite staff, assign roles and control who can sign in."
        actions={
          can("users", "create") && (
            <button className={btn.primary} onClick={() => setEditing("new")}>
              <UserPlus className="size-4" aria-hidden />
              Invite user
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total staff" value={stats.total} hint={`${roles.length} roles`} icon={Users} tone="blue" active={status === "ALL"} onClick={() => setStatus("ALL")} />
        <StatCard label="Active" value={stats.active} hint="Can sign in" icon={UserCheck} tone="green" active={status === "ACTIVE"} onClick={() => setStatus(status === "ACTIVE" ? "ALL" : "ACTIVE")} />
        <StatCard
          label="Pending invites"
          value={stats.invited}
          hint={stats.invited ? "Waiting to accept" : "None pending"}
          icon={MailPlus}
          tone={stats.invited ? "amber" : "slate"}
          active={status === "INVITED"}
          onClick={() => setStatus(status === "INVITED" ? "ALL" : "INVITED")}
        />
        <StatCard
          label="2FA coverage"
          value={`${stats.activeCount ? Math.round((stats.twoFa / stats.activeCount) * 100) : 0}%`}
          hint={`${stats.twoFa} of ${stats.activeCount} active users`}
          icon={ShieldCheck}
          tone={stats.twoFa === stats.activeCount ? "green" : "rose"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <FilterPills
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "ALL", label: "All", count: count("ALL") },
              { id: "ACTIVE", label: "Active", count: count("ACTIVE") },
              { id: "INVITED", label: "Invited", count: count("INVITED") },
              { id: "INACTIVE", label: "Inactive", count: count("INACTIVE") },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone or designation" className="flex-1" />
            <select aria-label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={cn(inputClass, "sm:w-56")}>
              <option value="ALL">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No staff found" description="Nothing matches these filters." icon={Users} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="hidden px-4 py-2.5 font-medium xl:table-cell">Phone</th>
                    <th className="px-4 py-2.5 font-medium">2FA</th>
                    <th className="px-4 py-2.5 font-medium">Last login</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((u) => {
                    const role = roleById[u.roleId];
                    return (
                      <tr key={u.id} className={cn("align-middle", u.status === "INACTIVE" && "bg-slate-50/60 text-slate-500")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar initials={u.initials} className={u.status === "INACTIVE" ? "bg-slate-100 text-slate-500" : undefined} />
                            <div className="min-w-0">
                              <p className="font-medium text-apptext-primary">
                                {u.name}
                                {u.id === currentUser?.id && <span className="ml-1.5 text-xs font-normal text-apptext-secondary">(you)</span>}
                              </p>
                              <p className="truncate text-xs text-apptext-secondary">{u.email}</p>
                              <p className="text-xs tabular-nums text-apptext-secondary xl:hidden">{u.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {role ? <Badge className={role.color}>{role.name}</Badge> : <span className="text-xs">{u.roleId}</span>}
                          <p className="mt-1 text-xs text-apptext-secondary">
                            {u.designation}
                            {u.warehouseId && ` · ${warehouseName(u.warehouseId)}`}
                          </p>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-apptext-secondary xl:table-cell">{u.phone}</td>
                        <td className="px-4 py-3">
                          <TwoFa on={u.twoFactorEnabled} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-apptext-secondary">
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_META[u.status].badge}>{STATUS_META[u.status].label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowMenu label={`Actions for ${u.name}`} items={menuFor(u)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((u) => {
                const role = roleById[u.roleId];
                return (
                  <li key={u.id} className="flex gap-3 px-4 py-3.5">
                    <Avatar initials={u.initials} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-apptext-primary">
                            {u.name}
                            {u.id === currentUser?.id && <span className="ml-1 text-xs font-normal text-apptext-secondary">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-apptext-secondary">{u.email}</p>
                          <p className="text-xs tabular-nums text-apptext-secondary">{u.phone}</p>
                        </div>
                        <RowMenu label={`Actions for ${u.name}`} items={menuFor(u)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {role && <Badge className={role.color}>{role.name}</Badge>}
                        <Badge className={STATUS_META[u.status].badge}>{STATUS_META[u.status].label}</Badge>
                        <TwoFa on={u.twoFactorEnabled} />
                      </div>
                      <p className="text-xs text-apptext-secondary">
                        {u.designation} · {warehouseName(u.warehouseId)}
                      </p>
                      <p className="text-xs tabular-nums text-apptext-secondary">
                        Last login {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {editing && <UserModal user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      {confirm && (
        <Modal
          title={confirm.status === "INVITED" ? "Revoke invite?" : `Deactivate ${confirm.name}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  if (confirm.status === "INVITED" && deleteUser(confirm.id)) notify(`Invitation for ${confirm.name} revoked.`, "warning");
                  else setUserStatus(confirm, "INACTIVE");
                  setConfirm(null);
                }}
              >
                {confirm.status === "INVITED" ? "Revoke invite" : "Deactivate"}
              </button>
            </>
          }
        >
          <p className="text-pretty text-sm text-apptext-secondary">
            {confirm.status === "INVITED"
              ? `The invite link sent to ${confirm.email} will stop working.`
              : `${confirm.name} will be signed out and can't sign in until reactivated. Their history and audit trail are kept.`}
          </p>
        </Modal>
      )}
    </>
  );
}

function TwoFa({ on }: { on: boolean }) {
  return on ? (
    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
      <ShieldCheck className="size-3" aria-hidden />
      2FA on
    </Badge>
  ) : (
    <Badge className="border-slate-200 bg-white text-slate-500">
      <ShieldOff className="size-3" aria-hidden />
      2FA off
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Invite / edit modal                                                 */
/* ------------------------------------------------------------------ */

function UserModal({ user, onClose }: { user: StaffUser | null; onClose: () => void }) {
  const { users, roles, roleById, riders, currentUser, saveUser, notify } = useAppStore();
  const { warehouses } = useInventory();
  const isSelf = user?.id === currentUser?.id;

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    designation: user?.designation ?? "",
    roleId: user?.roleId ?? roles.find((r) => r.id === "role-sales")?.id ?? roles[0]?.id ?? "",
    warehouseId: user?.warehouseId ?? "",
    riderId: user?.riderId ?? "",
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const role = roleById[form.roleId];
  const isRiderRole = Boolean(role && hasPermission(role.permissions, "rider_app") && !hasPermission(role.permissions, "dashboard"));
  const linkedRider = (riderId: string) => users.find((u) => u.riderId === riderId && u.id !== user?.id);

  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  else if (users.some((u) => u.id !== user?.id && u.email.toLowerCase() === form.email.trim().toLowerCase()))
    errors.email = "Another user already has this email.";
  if (!/^(\+?88)?01[3-9]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) errors.phone = "Enter a Bangladeshi mobile number, e.g. 01711-000000.";
  if (!form.designation.trim()) errors.designation = "Designation is required.";
  if (!form.roleId) errors.roleId = "Pick a role.";
  if (isRiderRole && !form.riderId) errors.riderId = "Link this login to a rider profile.";
  const valid = Object.keys(errors).length === 0;
  const err = (k: keyof typeof form) => (touched ? errors[k] : undefined);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const next: StaffUser = {
      ...(user ?? {
        id: `usr-${Date.now().toString(36)}`,
        status: "INVITED",
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      }),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      designation: form.designation.trim(),
      roleId: form.roleId,
      initials: initialsOf(form.name.trim()),
      warehouseId: form.warehouseId || undefined,
      riderId: isRiderRole ? form.riderId || undefined : undefined,
    } as StaffUser;
    saveUser(next);
    notify(user ? `${next.name} updated.` : `Invite sent to ${next.email}.`);
    onClose();
  };

  return (
    <Modal
      title={user ? `Edit ${user.name}` : "Invite user"}
      subtitle={user ? undefined : "They get an email and SMS link to set a password."}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={submit} disabled={touched && !valid}>
            {user ? "Save user" : "Send invite"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={err("name")}>
          {(id) => <input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} autoFocus />}
        </Field>
        <Field label="Designation" error={err("designation")}>
          {(id) => (
            <input id={id} value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Store Keeper" className={inputClass} />
          )}
        </Field>
        <Field label="Email" error={err("email")}>
          {(id) => <input id={id} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Mobile" error={err("phone")}>
          {(id) => (
            <input id={id} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+8801711000000" className={cn(inputClass, "tabular-nums")} />
          )}
        </Field>
        <Field label="Role" error={err("roleId")} hint={isSelf ? "You can't change your own role." : role?.description}>
          {(id) => (
            <select id={id} value={form.roleId} onChange={(e) => set("roleId", e.target.value)} disabled={isSelf} className={inputClass}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Warehouse" hint="Limits stock views to one warehouse. Leave blank for all.">
          {(id) => (
            <select id={id} value={form.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} className={inputClass}>
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        {isRiderRole && (
          <Field label="Rider profile" error={err("riderId")} hint="Connects this login to the rider's runs, cash and settlements." className="sm:col-span-2">
            {(id) => (
              <select id={id} value={form.riderId} onChange={(e) => set("riderId", e.target.value)} className={inputClass}>
                <option value="">Select a rider…</option>
                {riders.map((r) => {
                  const taken = linkedRider(r.id);
                  return (
                    <option key={r.id} value={r.id} disabled={Boolean(taken)}>
                      {r.name} · {r.employeeCode} · {r.vehiclePlateNo}
                      {taken ? ` (linked to ${taken.name})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}
