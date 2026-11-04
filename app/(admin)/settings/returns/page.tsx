"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileMinus, PackageCheck, Truck, Wallet } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { RETURN_REASON_META } from "@/lib/orders";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Field, Switch, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, toNumber, useSettingsDraft } from "@/components/settings/shared";

type Returns = AppSettings["returns"];

const FLOW: { title: string; body: string; icon: React.ElementType }[] = [
  { title: "Rider returns", body: "Refused or partial lines come back on the van with a reason.", icon: Truck },
  { title: "Settlement", body: "Accounts counts the rider's cash and the goods returned.", icon: Wallet },
  { title: "Inspection", body: "Warehouse checks each line: sellable, damaged or near expiry.", icon: ClipboardCheck },
  { title: "Restock or quarantine", body: "Sellable stock goes back to its batch; the rest is held.", icon: PackageCheck },
  { title: "Credit note", body: "The customer's account is credited for accepted lines.", icon: FileMinus },
];

export default function ReturnPolicyPage() {
  const { can } = useAppStore();
  const { draft: r, setDraft, dirty, save, discard, readOnly } = useSettingsDraft("returns");
  const set = <K extends keyof Returns>(k: K, v: Returns[K]) => setDraft((p) => ({ ...p, [k]: v }));
  const toggleReason = (id: Returns["reasons"][number]["id"], enabled: boolean) =>
    set(
      "reasons",
      r.reasons.map((x) => (x.id === id ? { ...x, enabled } : x))
    );

  const enabled = r.reasons.filter((x) => x.enabled).length;
  const error =
    r.returnWindowDays < 0 || r.returnWindowDays > 90
      ? "Return window must be 0–90 days."
      : r.approvalThreshold < 0
        ? "Approval threshold can't be negative."
        : enabled === 0
          ? "Keep at least one return reason on."
          : null;

  return (
    <>
      <SettingsHeader title="Return policy" description="When customers can return goods, what needs approval and what goes back into stock." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="How a delivery return flows" />
        <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
          {FLOW.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative rounded-lg border border-slate-200/80 bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold tabular-nums text-white">{i + 1}</span>
                  <Icon className="size-4 text-brand-primary" aria-hidden />
                </div>
                <p className="mt-2 text-sm font-medium text-apptext-primary">{step.title}</p>
                <p className="text-xs text-apptext-secondary">{step.body}</p>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden size-4 -translate-y-1/2 text-slate-300 xl:block" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
        {can("returns") && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm sm:px-5">
            <Link href="/returns" className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline">
              Go to returns
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Rules" />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Return window (days)" hint="Counted from the delivery date. Delivery returns at the door are always allowed.">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  max={90}
                  value={r.returnWindowDays}
                  onChange={(e) => set("returnWindowDays", Math.floor(toNumber(e.target.value)))}
                  disabled={readOnly}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
            <Field label="Approval threshold (৳)" hint={`Customer returns of ${formatCurrency(r.approvalThreshold)} or more need a manager's approval.`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  step={500}
                  value={r.approvalThreshold}
                  onChange={(e) => set("approvalThreshold", toNumber(e.target.value))}
                  disabled={readOnly}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
          </div>
          <Switch
            checked={r.requirePhotoForDamage}
            onChange={(v) => set("requirePhotoForDamage", v)}
            disabled={readOnly}
            label="Require a photo for damaged goods"
            description="Rider or customer must attach a photo when the reason is damage or quality."
          />
          <Switch
            checked={r.autoRestockSellable}
            onChange={(v) => set("autoRestockSellable", v)}
            disabled={readOnly}
            label="Auto-restock sellable items"
            description="Skip manual inspection for lines the rider marks as sealed and undamaged."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Return reasons" description={`${enabled} of ${r.reasons.length} shown to riders and customers.`} />
        <ul className="divide-y divide-slate-100">
          {r.reasons.map((x) => (
            <li key={x.id} className="px-4 py-3 sm:px-5">
              <Switch
                checked={x.enabled}
                onChange={(v) => toggleReason(x.id, v)}
                disabled={readOnly}
                label={x.label}
                description={RETURN_REASON_META[x.id]?.hint}
              />
            </li>
          ))}
        </ul>
      </Card>

      <SaveBar dirty={dirty} readOnly={readOnly} error={dirty ? error : null} onDiscard={discard} onSave={() => save("Return policy saved.")} />
    </>
  );
}
