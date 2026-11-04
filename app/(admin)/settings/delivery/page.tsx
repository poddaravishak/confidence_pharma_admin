"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Ban, Camera, KeyRound, MapPinned, PenLine } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Field, Switch, btn, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, toNumber, useSettingsDraft } from "@/components/settings/shared";

type Delivery = AppSettings["delivery"];

const PROOFS: { id: Delivery["proofRequired"]; label: string; hint: string; icon: React.ElementType }[] = [
  { id: "OTP", label: "OTP", hint: "Customer reads a 4-digit code sent by SMS", icon: KeyRound },
  { id: "SIGNATURE", label: "Signature", hint: "Signed on the rider's phone", icon: PenLine },
  { id: "PHOTO", label: "Photo", hint: "Photo of goods at the shop", icon: Camera },
  { id: "NONE", label: "None", hint: "Rider marks delivered", icon: Ban },
];

export default function DeliverySettingsPage() {
  const { can } = useAppStore();
  const { draft: d, setDraft, dirty, save, discard, readOnly } = useSettingsDraft("delivery");
  const set = <K extends keyof Delivery>(k: K, v: Delivery[K]) => setDraft((p) => ({ ...p, [k]: v }));

  const error =
    !/^\d{2}:\d{2}$/.test(d.sameDayCutoff)
      ? "Set a same-day cut-off time."
      : d.maxStopsPerRun < 1 || d.maxStopsPerRun > 50
        ? "Stops per run must be between 1 and 50."
        : d.riderCashLimit < 0
          ? "Cash limit can't be negative."
          : null;

  return (
    <>
      <SettingsHeader title="Delivery" description="Proof of delivery, cut-off times and limits for delivery runs." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="Proof of delivery" description="What the rider must capture before an order counts as delivered." />
        <div className="space-y-4 p-4 sm:p-5">
          <fieldset>
            <legend className="sr-only">Proof required</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PROOFS.map((p) => {
                const Icon = p.icon;
                const active = d.proofRequired === p.id;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                      active ? "border-brand-primary bg-brand-light/40" : "border-slate-200 hover:bg-slate-50",
                      readOnly && "cursor-not-allowed"
                    )}
                  >
                    <input
                      type="radio"
                      name="proof"
                      checked={active}
                      onChange={() => set("proofRequired", p.id)}
                      disabled={readOnly}
                      className="mt-0.5 accent-brand-primary"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium text-apptext-primary">
                        <Icon className="size-4 text-slate-400" aria-hidden />
                        {p.label}
                      </span>
                      <span className="block text-xs text-apptext-secondary">{p.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {d.proofRequired === "NONE" && (
            <p className="text-sm text-amber-700">Without proof, disputes about missing deliveries are hard to resolve.</p>
          )}
          <Switch
            checked={d.allowPartialDelivery}
            onChange={(v) => set("allowPartialDelivery", v)}
            disabled={readOnly}
            label="Allow partial delivery"
            description="Customer can refuse some lines at the door; the rider brings them back as a delivery return."
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Runs and riders" />
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <Field label="Same-day cut-off" hint="Orders confirmed after this go out tomorrow.">
            {(id) => (
              <input id={id} type="time" value={d.sameDayCutoff} onChange={(e) => set("sameDayCutoff", e.target.value)} disabled={readOnly} className={cn(inputClass, "tabular-nums")} />
            )}
          </Field>
          <Field label="Max stops per run" hint="Dispatch warns above this.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={50}
                value={d.maxStopsPerRun}
                onChange={(e) => set("maxStopsPerRun", Math.floor(toNumber(e.target.value)))}
                disabled={readOnly}
                className={cn(inputClass, "tabular-nums")}
              />
            )}
          </Field>
          <Field label="Rider cash limit (৳)" hint={`Rider must settle before carrying more than ${formatCurrency(d.riderCashLimit)}.`}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                step={5000}
                value={d.riderCashLimit}
                onChange={(e) => set("riderCashLimit", toNumber(e.target.value))}
                disabled={readOnly}
                className={cn(inputClass, "tabular-nums")}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
              <MapPinned className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-medium text-apptext-primary">Zones and delivery charges</p>
              <p className="text-sm text-apptext-secondary">Areas covered, delivery fees and free-delivery thresholds are managed with the fleet.</p>
            </div>
          </div>
          {can("delivery") && (
            <Link href="/delivery" className={btn.secondary}>
              Open delivery zones
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </Card>

      <SaveBar dirty={dirty} readOnly={readOnly} error={dirty ? error : null} onDiscard={discard} onSave={() => save("Delivery settings saved.")} />
    </>
  );
}
