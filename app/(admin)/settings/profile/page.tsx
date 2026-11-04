"use client";

import React, { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { StaffUser } from "@/lib/types";
import { countPermissions, hasPermission } from "@/lib/rbac";
import { formatDateTime } from "@/lib/inventory";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { cn, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Field, Switch, btn, inputClass } from "@/components/ui";
import { Avatar, InfoRow, SaveBar, SettingsHeader, useDirtyGuard } from "@/components/settings/shared";
import { PermissionSummary, TOTAL_PERMISSIONS } from "@/components/settings/roles";

export default function ProfilePage() {
  const { currentUser } = useAppStore();
  if (!currentUser) return null;
  return <ProfileForm key={currentUser.id} user={currentUser} />;
}

function ProfileForm({ user }: { user: StaffUser }) {
  const { currentRole, settings, saveUser, notify, logAudit } = useAppStore();
  const { warehouseById } = useInventory();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const dirty = form.name !== user.name || form.phone !== user.phone;
  useDirtyGuard(dirty);

  const error = !form.name.trim()
    ? "Name is required."
    : !/^(\+?88)?01[3-9]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))
      ? "Enter a Bangladeshi mobile number."
      : null;

  const isAdmin = Boolean(
    currentRole && (hasPermission(currentRole.permissions, "users", "edit") || hasPermission(currentRole.permissions, "settings", "edit"))
  );
  const twoFaLocked = isAdmin && settings.security.enforceTwoFactorForAdmins && user.twoFactorEnabled;

  const saveProfile = () => {
    const name = form.name.trim();
    const initials =
      name
        .replace(/^Dr\.\s*/i, "")
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || user.initials;
    saveUser({ ...user, name, phone: form.phone.trim(), initials });
    notify("Profile updated.");
  };

  return (
    <>
      <SettingsHeader title="My profile" description="Your details, password and two-factor sign-in." />

      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <Avatar initials={user.initials} className="size-14 text-base" />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-apptext-primary">{user.name}</p>
            <p className="text-sm text-apptext-secondary">{user.designation}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {currentRole && <Badge className={currentRole.color}>{currentRole.name}</Badge>}
              {user.twoFactorEnabled && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">2FA on</Badge>}
            </div>
          </div>
        </div>
        <dl className="divide-y divide-slate-100 border-t border-slate-100 px-4 sm:px-5">
          <InfoRow label="Warehouse">{user.warehouseId ? warehouseById[user.warehouseId]?.name ?? user.warehouseId : "All warehouses"}</InfoRow>
          <InfoRow label="Last sign-in">
            <span className="tabular-nums">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</span>
          </InfoRow>
          <InfoRow label="Member since">
            <span className="tabular-nums">{formatDate(user.createdAt)}</span>
          </InfoRow>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Personal details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Full name">
            {(id) => <input id={id} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />}
          </Field>
          <Field label="Mobile">
            {(id) => (
              <input
                id={id}
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={cn(inputClass, "tabular-nums")}
              />
            )}
          </Field>
          <Field label="Email" hint="Ask a Super Admin to change your sign-in email." className="sm:col-span-2">
            {(id) => <input id={id} type="email" value={user.email} readOnly disabled className={inputClass} />}
          </Field>
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <SaveBar
            dirty={dirty}
            error={dirty ? error : null}
            onDiscard={() => setForm({ name: user.name, phone: user.phone })}
            onSave={saveProfile}
            saveLabel="Save profile"
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <PasswordCard
          minLength={settings.security.passwordMinLength}
          onChanged={() => {
            logAudit("PASSWORD_CHANGED", "USERS", `${user.name} changed their password.`);
            notify("Password changed. Other devices will be signed out.");
          }}
        />

        <Card>
          <CardHeader title="Two-factor sign-in" description="Ask for a 6-digit code from an authenticator app after your password." />
          <div className="space-y-3 p-4 sm:p-5">
            <Switch
              checked={user.twoFactorEnabled}
              disabled={twoFaLocked}
              onChange={(v) => {
                saveUser({ ...user, twoFactorEnabled: v });
                notify(v ? "Two-factor sign-in turned on." : "Two-factor sign-in turned off.", v ? "success" : "warning");
              }}
              label="Use two-factor sign-in"
              description={user.twoFactorEnabled ? "On. You'll be asked for a code on new devices." : "Off. Anyone with your password can sign in."}
            />
            {twoFaLocked && <p className="text-xs text-apptext-secondary">Required for admin roles by your security policy, so it can&apos;t be turned off.</p>}
          </div>
        </Card>
      </div>

      {currentRole && (
        <Card className="overflow-hidden">
          <CardHeader
            title="What your role can do"
            description={`${currentRole.name}: ${currentRole.description}`}
            actions={
              <span className="text-sm tabular-nums text-apptext-secondary">
                {countPermissions(currentRole)} / {TOTAL_PERMISSIONS} permissions
              </span>
            }
          />
          <PermissionSummary permissions={currentRole.permissions} />
        </Card>
      )}
    </>
  );
}

function PasswordCard({ minLength, onChanged }: { minLength: number; onChanged: () => void }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const errors = {
    current: !form.current ? "Enter your current password." : undefined,
    next:
      form.next.length < minLength
        ? `Use at least ${minLength} characters.`
        : !/\d/.test(form.next) || !/[A-Za-z]/.test(form.next)
          ? "Mix letters and numbers."
          : form.next === form.current
            ? "Pick a password you haven't used here."
            : undefined,
    confirm: form.confirm !== form.next ? "Passwords don't match." : undefined,
  };
  const valid = !errors.current && !errors.next && !errors.confirm;

  return (
    <Card>
      <CardHeader title="Change password" description="Demo only: passwords aren't stored." />
      <form
        className="space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!valid) return;
          onChanged();
          setForm({ current: "", next: "", confirm: "" });
          setTouched(false);
        }}
      >
        {(
          [
            ["current", "Current password", "current-password"],
            ["next", "New password", "new-password"],
            ["confirm", "Confirm new password", "new-password"],
          ] as const
        ).map(([k, label, auto]) => (
          <Field key={k} label={label} error={touched ? errors[k] : undefined} hint={k === "next" ? `At least ${minLength} characters with letters and numbers.` : undefined}>
            {(id) => (
              <input
                id={id}
                type={show ? "text" : "password"}
                autoComplete={auto}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className={inputClass}
              />
            )}
          </Field>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={btn.ghost} onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
          <button type="submit" className={btn.primary} disabled={touched && !valid}>
            <KeyRound className="size-4" aria-hidden />
            Update password
          </button>
        </div>
      </form>
    </Card>
  );
}
