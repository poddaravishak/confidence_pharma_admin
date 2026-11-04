"use client";

import React from "react";
import { Banknote, Building, CreditCard, Smartphone } from "lucide-react";
import { AppSettings, PaymentChannel } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Field, Switch, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, toNumber, useDirtyGuard, useSettingsDraft } from "@/components/settings/shared";

type Credit = AppSettings["credit"];

const CHANNEL_META: Record<PaymentChannel, { icon: React.ElementType; refLabel?: string; placeholder?: string; hint: string }> = {
  CASH: { icon: Banknote, hint: "Rider collects cash at the door and settles at day end." },
  BKASH: { icon: Smartphone, refLabel: "Merchant number", placeholder: "01711-000000", hint: "Customers pay to your bKash merchant wallet." },
  NAGAD: { icon: Smartphone, refLabel: "Merchant number", placeholder: "01711-000000", hint: "Customers pay to your Nagad business wallet." },
  BANK: { icon: Building, refLabel: "Bank and account no.", placeholder: "DBBL 104.110.00000", hint: "Transfer or cheque deposit; confirmed by accounts." },
  CREDIT: { icon: CreditCard, hint: "Order is added to the customer's due balance." },
};

export default function PaymentsPage() {
  const { updateSettings, notify } = useAppStore();
  const payments = useSettingsDraft("payments");
  const credit = useSettingsDraft("credit");
  const readOnly = payments.readOnly;
  const dirty = payments.dirty || credit.dirty;
  useDirtyGuard(dirty);

  const c = credit.draft;
  const setCredit = <K extends keyof Credit>(k: K, v: Credit[K]) => credit.setDraft((d) => ({ ...d, [k]: v }));
  const patchChannel = (id: PaymentChannel, patch: Partial<AppSettings["payments"][number]>) =>
    payments.setDraft((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const enabledCount = payments.draft.filter((p) => p.enabled).length;
  const missingRef = payments.draft.find((p) => p.enabled && CHANNEL_META[p.id].refLabel && !p.accountRef?.trim());
  const error =
    enabledCount === 0
      ? "Keep at least one payment method on."
      : missingRef
        ? `Add the ${CHANNEL_META[missingRef.id].refLabel?.toLowerCase()} for ${missingRef.label}.`
        : c.defaultCreditLimit < 0 || c.defaultTermsDays < 0
          ? "Credit values can't be negative."
          : null;

  const creditOn = payments.draft.find((p) => p.id === "CREDIT")?.enabled ?? false;

  return (
    <>
      <SettingsHeader title="Payment methods & credit" description="How customers can pay, and the credit given to new B2B accounts." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="Payment methods" description={`${enabledCount} of ${payments.draft.length} enabled at checkout and on the rider app.`} />
        <ul className="divide-y divide-slate-100">
          {payments.draft.map((p) => {
            const meta = CHANNEL_META[p.id];
            const Icon = meta.icon;
            return (
              <li key={p.id} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
                <div className="flex gap-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", p.enabled ? "bg-brand-light text-brand-primary" : "bg-slate-100 text-slate-400")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Switch checked={p.enabled} onChange={(v) => patchChannel(p.id, { enabled: v })} disabled={readOnly} label={p.label} description={meta.hint} />
                  </div>
                </div>
                {meta.refLabel ? (
                  <Field label={meta.refLabel}>
                    {(id) => (
                      <input
                        id={id}
                        value={p.accountRef ?? ""}
                        onChange={(e) => patchChannel(p.id, { accountRef: e.target.value })}
                        disabled={readOnly || !p.enabled}
                        placeholder={meta.placeholder}
                        className={cn(inputClass, "font-mono tabular-nums")}
                      />
                    )}
                  </Field>
                ) : (
                  <span className="hidden md:block" />
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Credit defaults" description="Applied when a new customer account is approved. You can change them per customer." />
        <div className={cn("space-y-4 p-4 sm:p-5", !creditOn && "opacity-60")}>
          {!creditOn && <p className="text-sm text-amber-700">Credit is turned off above, so these defaults aren&apos;t used.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default credit limit (৳)" hint={formatCurrency(c.defaultCreditLimit)}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  step={1000}
                  value={c.defaultCreditLimit}
                  onChange={(e) => setCredit("defaultCreditLimit", toNumber(e.target.value))}
                  disabled={readOnly}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
            <Field label="Payment terms (days)" hint="Days after delivery before the invoice is overdue.">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  max={120}
                  value={c.defaultTermsDays}
                  onChange={(e) => setCredit("defaultTermsDays", Math.floor(toNumber(e.target.value)))}
                  disabled={readOnly}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
          </div>
          <Switch
            checked={c.blockOverLimitOrders}
            onChange={(v) => setCredit("blockOverLimitOrders", v)}
            disabled={readOnly}
            label="Block orders that go over the credit limit"
            description="When off, staff see a warning but can still confirm the order."
          />
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        readOnly={readOnly}
        error={dirty ? error : null}
        onDiscard={() => {
          payments.discard();
          credit.discard();
        }}
        onSave={() => {
          if (payments.dirty) updateSettings("payments", payments.draft);
          if (credit.dirty) updateSettings("credit", c);
          notify("Payment settings saved.");
        }}
      />
    </>
  );
}
