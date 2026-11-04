"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, Monitor, ShieldAlert, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { hasPermission } from "@/lib/rbac";
import { useAppStore } from "@/lib/store/AppStore";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, Field, Switch, btn, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, toNumber, useSettingsDraft } from "@/components/settings/shared";

type Security = AppSettings["security"];

const TIMEOUTS = [15, 30, 60, 120, 240, 480];

interface Session {
  id: string;
  user: string;
  device: string;
  kind: "desktop" | "phone" | "tablet";
  location: string;
  ip: string;
  lastActive: string;
  current?: boolean;
}

const DEVICE_ICON = { desktop: Monitor, phone: Smartphone, tablet: Tablet };

export default function SecurityPage() {
  const { users, roleById, currentUser, notify, logAudit } = useAppStore();
  const { draft: s, setDraft, dirty, save, discard, readOnly } = useSettingsDraft("security");
  const set = <K extends keyof Security>(k: K, v: Security[K]) => setDraft((p) => ({ ...p, [k]: v }));

  const [sessions, setSessions] = useState<Session[]>(() => [
    { id: "s1", user: currentUser?.name ?? "You", device: "Chrome on macOS", kind: "desktop", location: "Tejgaon, Dhaka", ip: "103.48.17.22", lastActive: "Active now", current: true },
    { id: "s2", user: "Ayesha Siddiqua", device: "Safari on iPhone", kind: "phone", location: "Gulshan, Dhaka", ip: "103.48.17.40", lastActive: "12 min ago" },
    { id: "s3", user: "Rashed Karim", device: "Edge on Windows", kind: "desktop", location: "Tejgaon, Dhaka", ip: "103.48.17.31", lastActive: "34 min ago" },
    { id: "s4", user: "Shakil Ahmed", device: "Rider app on Android", kind: "phone", location: "Mirpur, Dhaka", ip: "37.111.204.9", lastActive: "1 hr ago" },
    { id: "s5", user: "Nayeem Islam", device: "Chrome on Android tablet", kind: "tablet", location: "Motijheel, Dhaka", ip: "45.127.88.14", lastActive: "3 hr ago" },
  ]);

  const adminsWithout2fa = useMemo(
    () =>
      users.filter((u) => {
        const role = roleById[u.roleId];
        return u.status === "ACTIVE" && !u.twoFactorEnabled && role && (hasPermission(role.permissions, "users", "edit") || hasPermission(role.permissions, "settings", "edit"));
      }),
    [users, roleById]
  );

  const error = s.passwordMinLength < 6 || s.passwordMinLength > 32 ? "Password length must be 6–32 characters." : null;

  const endSession = (id: string) => {
    const sess = sessions.find((x) => x.id === id);
    setSessions((prev) => prev.filter((x) => x.id !== id));
    if (sess) {
      logAudit("SESSION_REVOKED", "SECURITY", `Signed out ${sess.user} on ${sess.device}.`);
      notify(`${sess.user} signed out on ${sess.device}.`);
    }
  };

  const endOthers = () => {
    const n = sessions.filter((x) => !x.current).length;
    setSessions((prev) => prev.filter((x) => x.current));
    logAudit("SESSION_REVOKED", "SECURITY", `Signed out ${n} other session(s).`);
    notify(`${n} other session${n === 1 ? "" : "s"} signed out.`, "warning");
  };

  return (
    <>
      <SettingsHeader title="Security" description="Sign-in rules for staff accounts and who is signed in right now." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="Sign-in policy" />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sign out after inactivity" hint="Applies to the admin panel. The rider app stays signed in for the whole shift.">
              {(id) => (
                <select
                  id={id}
                  value={s.sessionTimeoutMinutes}
                  onChange={(e) => set("sessionTimeoutMinutes", toNumber(e.target.value))}
                  disabled={readOnly}
                  className={inputClass}
                >
                  {(TIMEOUTS.includes(s.sessionTimeoutMinutes) ? TIMEOUTS : [...TIMEOUTS, s.sessionTimeoutMinutes].sort((a, b) => a - b)).map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Minimum password length">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={6}
                  max={32}
                  value={s.passwordMinLength}
                  onChange={(e) => set("passwordMinLength", Math.floor(toNumber(e.target.value)))}
                  disabled={readOnly}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
          </div>
          <Switch
            checked={s.enforceTwoFactorForAdmins}
            onChange={(v) => set("enforceTwoFactorForAdmins", v)}
            disabled={readOnly}
            label="Require two-factor sign-in for admins"
            description="Anyone who can edit users or system settings must use an authenticator code."
          />
          {s.enforceTwoFactorForAdmins && adminsWithout2fa.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {adminsWithout2fa.map((u) => u.name).join(", ")} {adminsWithout2fa.length === 1 ? "has" : "have"} admin access without 2FA and will be asked to
                set it up at next sign-in.
              </span>
            </div>
          )}
          {s.enforceTwoFactorForAdmins && adminsWithout2fa.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="size-4" aria-hidden />
              Every admin has 2FA turned on.
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Active sessions"
          description="Demo data. Signing out a session ends it on that device."
          actions={
            !readOnly &&
            sessions.some((x) => !x.current) && (
              <button className={btn.secondary} onClick={endOthers}>
                <LogOut className="size-4" aria-hidden />
                Sign out all others
              </button>
            )
          }
        />
        <ul className="divide-y divide-slate-100">
          {sessions.map((sess) => {
            const Icon = DEVICE_ICON[sess.kind];
            return (
              <li key={sess.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-slate-500">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-apptext-primary">
                    {sess.user}
                    {sess.current && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">This device</Badge>}
                  </p>
                  <p className="text-xs text-apptext-secondary">
                    {sess.device} · {sess.location}
                  </p>
                  <p className="text-xs tabular-nums text-apptext-secondary">
                    <span className="font-mono">{sess.ip}</span> · {sess.lastActive}
                  </p>
                </div>
                {!sess.current && !readOnly && (
                  <button type="button" className={btn.small} onClick={() => endSession(sess.id)} aria-label={`Sign out ${sess.user} on ${sess.device}`}>
                    <LogOut className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-apptext-secondary sm:px-5">
          Your own devices and 2FA are managed in{" "}
          <Link href="/settings/profile" className="font-medium text-brand-primary hover:underline">
            My profile
          </Link>
          .
        </p>
      </Card>

      <SaveBar dirty={dirty} readOnly={readOnly} error={dirty ? error : null} onDiscard={discard} onSave={() => save("Security settings saved.")} />
    </>
  );
}
