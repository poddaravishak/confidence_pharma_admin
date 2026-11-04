"use client";

import React from "react";
import { BadgeCheck, ImageIcon } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { Card, CardHeader, Field, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, useSettingsDraft } from "@/components/settings/shared";

type Company = AppSettings["company"];

const SECTIONS: { title: string; description: string; fields: { key: keyof Company; label: string; type?: string; hint?: string; wide?: boolean; required?: boolean }[] }[] = [
  {
    title: "Business identity",
    description: "Printed on invoices, challans and credit notes.",
    fields: [
      { key: "legalName", label: "Legal name", required: true },
      { key: "tradeName", label: "Trade name", hint: "Shown in the app header and customer messages.", required: true },
      { key: "ownerName", label: "Owner / managing director" },
      { key: "website", label: "Website" },
    ],
  },
  {
    title: "Contact",
    description: "Where customers and suppliers reach you.",
    fields: [
      { key: "phone", label: "Phone", type: "tel", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "address", label: "Registered address", wide: true, required: true },
    ],
  },
  {
    title: "Licences and tax registration",
    description: "Required on every invoice for DGDA and NBR compliance.",
    fields: [
      { key: "tradeLicenseNo", label: "Trade licence no.", required: true },
      { key: "drugLicenseNo", label: "Drug licence no. (DGDA)", required: true },
      { key: "binNo", label: "BIN (VAT registration)", hint: "13-digit business identification number.", required: true },
      { key: "tinNo", label: "TIN", hint: "12-digit e-TIN.", required: true },
    ],
  },
];

export default function CompanyProfilePage() {
  const { draft, setDraft, dirty, save, discard, readOnly } = useSettingsDraft("company");
  const { settings } = useAppStore();

  const set = (key: keyof Company, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const missing = SECTIONS.flatMap((s) => s.fields).find((f) => f.required && !draft[f.key].trim());
  const emailBad = draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim());
  const error = missing ? `${missing.label} is required.` : emailBad ? "Enter a valid email address." : null;

  return (
    <>
      <SettingsHeader title="Company profile" description="Legal and contact details used across invoices, challans and customer messages." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="Logo" description="Used on the sign-in page, sidebar and printed documents." />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex h-24 w-full max-w-[240px] items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/confidence-pharma-logo.jpg" alt={`${settings.company.tradeName} logo`} className="max-h-full w-auto object-contain" />
          </div>
          <div className="space-y-2 text-sm text-apptext-secondary">
            <p className="flex items-center gap-1.5">
              <ImageIcon className="size-4 text-slate-400" aria-hidden />
              JPG or PNG, at least 400 × 120 px, on a white background.
            </p>
            <p className="flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-brand-green" aria-hidden />
              Logo uploads are disabled in this demo.
            </p>
          </div>
        </div>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader title={section.title} description={section.description} />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {section.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} className={f.wide ? "sm:col-span-2" : undefined}>
                {(id) =>
                  f.wide ? (
                    <textarea
                      id={id}
                      rows={2}
                      value={draft[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={readOnly}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={id}
                      type={f.type ?? "text"}
                      value={draft[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={readOnly}
                      className={`${inputClass} ${f.key.endsWith("No") ? "font-mono tabular-nums" : ""}`}
                    />
                  )
                }
              </Field>
            ))}
          </div>
        </Card>
      ))}

      <SaveBar dirty={dirty} error={dirty ? error : null} readOnly={readOnly} onDiscard={discard} onSave={() => save("Company profile saved.")} />
    </>
  );
}
