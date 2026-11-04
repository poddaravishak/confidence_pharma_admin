"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Truck, Warehouse, Wallet, ShoppingCart, Crown, Briefcase, Send } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStore";
import { btn, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const ROLE_ICON: Record<string, React.ElementType> = {
  "role-super": Crown,
  "role-manager": Briefcase,
  "role-inventory": Warehouse,
  "role-warehouse": Warehouse,
  "role-sales": ShoppingCart,
  "role-accountant": Wallet,
  "role-dispatch": Send,
  "role-rider": Truck,
};

/** One demo account per role shown as quick sign-in cards. */
const QUICK_USERS = ["usr-01", "usr-02", "usr-03", "usr-04", "usr-06", "usr-07", "usr-08", "usr-09"];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { users, roleById, login, currentUser, currentRole, hydrated } = useAppStore();
  const [email, setEmail] = useState("tcdey@confidencepharma.com.bd");
  const [password, setPassword] = useState("demo1234");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && currentUser && currentRole) router.replace(params.get("next") || currentRole.homePath);
  }, [hydrated, currentUser, currentRole, params, router]);

  const signIn = (userId: string) => {
    const role = login(userId);
    if (!role) {
      setError("This account is inactive or has not accepted its invitation yet.");
      return;
    }
    const next = params.get("next");
    router.replace(next && role.homePath !== "/rider" ? next : role.homePath);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return setError("No staff account with that email.");
    if (password.length < 4) return setError("Enter your password.");
    signIn(user.id);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-primary p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-blue/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-green/20 blur-3xl" aria-hidden />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/confidence-pharma-logo.jpg" alt="Confidence Pharma" className="h-14 w-auto rounded-lg bg-white p-2" />
        </div>
        <div className="relative max-w-md space-y-4">
          <h1 className="text-balance text-3xl font-bold leading-tight">Business control center for B2B pharma distribution</h1>
          <p className="text-pretty text-white/75">
            Orders, FEFO inventory, delivery runs, doorstep returns, rider cash settlement and real-time P&amp;L in one place.
          </p>
          <ul className="space-y-2 text-sm text-white/85">
            {["Role-based access for every team", "Partial delivery and returns back to stock", "Rider mobile panel with OTP proof"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-green" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© 2026 Confidence Pharma Ltd. · Demo environment</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/confidence-pharma-logo.jpg" alt="Confidence Pharma" className="h-12 w-auto" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-apptext-primary">Sign in</h2>
            <p className="mt-1 text-sm text-apptext-secondary">Use your staff email, or pick a demo role below.</p>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-apptext-primary">Email</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-apptext-primary">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClass, "pl-9 pr-10")}
                />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" className={cn(btn.primary, "w-full py-2.5")}>
              Sign in <ArrowRight className="size-4" />
            </button>
            <p className="text-center text-xs text-apptext-secondary">Demo: any password with 4+ characters works.</p>
          </form>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Quick demo sign-in</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_USERS.map((id) => {
                const u = users.find((x) => x.id === id);
                if (!u) return null;
                const role = roleById[u.roleId];
                const Icon = ROLE_ICON[u.roleId] ?? ShieldCheck;
                return (
                  <button
                    key={id}
                    onClick={() => signIn(id)}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-primary/40 hover:shadow-sm"
                  >
                    <span className="rounded-lg bg-brand-light p-2 text-brand-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-apptext-primary">{role?.name}</span>
                      <span className="block truncate text-xs text-apptext-secondary">{u.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
