"use client";

import React, { useState } from "react";
import { Bell, ChevronDown, Mail, MessageCircle, MessageSquareText } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, useSettingsDraft } from "@/components/settings/shared";

type Rule = AppSettings["notifications"][number];
type ChannelKey = keyof Rule["channels"];

const CHANNELS: { id: ChannelKey; label: string; icon: React.ElementType }[] = [
  { id: "sms", label: "SMS", icon: MessageSquareText },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "email", label: "Email", icon: Mail },
  { id: "inApp", label: "In-app", icon: Bell },
];

const PLACEHOLDER = /\{(\w+)\}/g;

export default function NotificationsPage() {
  const { settings } = useAppStore();
  const { draft, setDraft, dirty, save, discard, readOnly } = useSettingsDraft("notifications");
  const [open, setOpen] = useState<string | null>(draft[0]?.id ?? null);

  const bkash = settings.payments.find((p) => p.id === "BKASH")?.accountRef ?? "01711-000001";
  const SAMPLE: Record<string, string> = {
    customer: "Rahman Pharmacy",
    order_no: `${settings.invoice.orderPrefix}202611-0110`,
    amount: formatCurrency(12450),
    rider: "Shakil Ahmed",
    otp: "4821",
    returned: "2 box Napa Extra",
    cn_no: `${settings.invoice.creditNotePrefix}261105-201`,
    bkash_no: bkash,
    product: "Napa Extra 500mg",
    stock: "120 boxes",
  };

  const patch = (id: string, fn: (r: Rule) => Rule) => setDraft((list) => list.map((r) => (r.id === id ? fn(r) : r)));

  const unknownIn = (tpl: string) => Array.from(tpl.matchAll(PLACEHOLDER), (m) => m[1]).filter((k) => !(k in SAMPLE));
  const fillPreview = (tpl: string) => tpl.replace(PLACEHOLDER, (all, key: string) => SAMPLE[key] ?? all);

  const badTemplate = draft.find((r) => !r.template.trim() || unknownIn(r.template).length > 0);
  const error = badTemplate
    ? !badTemplate.template.trim()
      ? `"${badTemplate.event}" needs a message.`
      : `"${badTemplate.event}" uses an unknown placeholder: {${unknownIn(badTemplate.template)[0]}}.`
    : null;

  return (
    <>
      <SettingsHeader title="Notifications" description="Which events message customers and staff, on which channels, and what the message says." />
      {readOnly && <ReadOnlyNotice />}

      <Card className="overflow-hidden">
        <CardHeader title="Events" description="SMS is billed per 160-character segment." />
        <ul className="divide-y divide-slate-100">
          {draft.map((rule) => {
            const expanded = open === rule.id;
            const preview = fillPreview(rule.template);
            const segments = Math.max(1, Math.ceil(preview.length / 160));
            const unknown = unknownIn(rule.template);
            const panelId = `tpl-${rule.id}`;
            return (
              <li key={rule.id}>
                <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : rule.id)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", expanded && "rotate-180")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-medium text-apptext-primary">{rule.event}</span>
                      <span className="block truncate text-xs text-apptext-secondary">{rule.template}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Channels for ${rule.event}`}>
                    {CHANNELS.map((c) => {
                      const on = rule.channels[c.id];
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={on}
                          disabled={readOnly}
                          onClick={() => patch(rule.id, (r) => ({ ...r, channels: { ...r.channels, [c.id]: !on } }))}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed",
                            on ? "border-brand-primary bg-brand-primary text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {expanded && (
                  <div id={panelId} className="grid gap-4 border-t border-slate-100 bg-surface/60 px-4 py-4 sm:px-5 lg:grid-cols-2">
                    <div>
                      <label htmlFor={`${panelId}-input`} className="mb-1.5 block text-sm font-medium text-apptext-primary">
                        Message template
                      </label>
                      <textarea
                        id={`${panelId}-input`}
                        rows={4}
                        value={rule.template}
                        onChange={(e) => patch(rule.id, (r) => ({ ...r, template: e.target.value }))}
                        disabled={readOnly}
                        className={inputClass}
                      />
                      <p className="mt-1.5 text-xs text-apptext-secondary">Placeholders are replaced when the message is sent. Click to insert:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.keys(SAMPLE).map((k) => (
                          <button
                            key={k}
                            type="button"
                            disabled={readOnly}
                            onClick={() => patch(rule.id, (r) => ({ ...r, template: `${r.template.replace(/\s*$/, "")} {${k}}` }))}
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 transition hover:border-brand-blue hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {`{${k}}`}
                          </button>
                        ))}
                      </div>
                      {unknown.length > 0 && (
                        <p className="mt-2 text-xs text-rose-600">
                          Unknown placeholder{unknown.length > 1 ? "s" : ""}: {unknown.map((u) => `{${u}}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-apptext-primary">Preview with sample values</p>
                      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-apptext-primary shadow-sm">
                        {preview || <span className="text-slate-400">Empty message</span>}
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-apptext-secondary">
                        {preview.length} characters
                        {rule.channels.sms && ` · ${segments} SMS segment${segments === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <SaveBar dirty={dirty} readOnly={readOnly} error={dirty ? error : null} onDiscard={discard} onSave={() => save("Notification settings saved.")} />
    </>
  );
}
