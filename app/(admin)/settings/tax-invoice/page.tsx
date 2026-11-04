"use client";

import React from "react";
import { AppSettings } from "@/lib/types";
import { OPS_TODAY } from "@/lib/db/operations-data";
import { useAppStore } from "@/lib/store/AppStore";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Field, Switch, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SaveBar, SettingsHeader, toNumber, useDirtyGuard, useSettingsDraft } from "@/components/settings/shared";

type Tax = AppSettings["tax"];
type Invoice = AppSettings["invoice"];

const ROUNDING: { id: Tax["roundTo"]; label: string; hint: string }[] = [
  { id: 0, label: "No rounding", hint: "Keep paisa" },
  { id: 1, label: "Nearest ৳1", hint: "Most common" },
  { id: 5, label: "Nearest ৳5", hint: "Cash friendly" },
];

const [Y, M, D] = OPS_TODAY.split("-");
const YYYYMM = `${Y}${M}`;
const YYMMDD = `${Y.slice(2)}${M}${D}`;
const SAMPLE_SUBTOTAL = 12347.4;

const roundTo = (n: number, step: Tax["roundTo"]) => (step === 0 ? Math.round(n * 100) / 100 : Math.round(n / step) * step);

export default function TaxInvoicePage() {
  const { updateSettings, notify } = useAppStore();
  const tax = useSettingsDraft("tax");
  const invoice = useSettingsDraft("invoice");
  const readOnly = tax.readOnly;
  const dirty = tax.dirty || invoice.dirty;
  useDirtyGuard(dirty);

  const t = tax.draft;
  const inv = invoice.draft;
  const setTax = <K extends keyof Tax>(k: K, v: Tax[K]) => tax.setDraft((d) => ({ ...d, [k]: v }));
  const setInv = <K extends keyof Invoice>(k: K, v: Invoice[K]) => invoice.setDraft((d) => ({ ...d, [k]: v }));

  const seq = String(Math.max(0, inv.nextNumber)).padStart(4, "0");
  const numbers = [
    { label: "Order", value: `${inv.orderPrefix}${YYYYMM}-${seq}` },
    { label: "Invoice", value: `${inv.invoicePrefix}${YYYYMM}-${seq}` },
    { label: "Delivery challan", value: `${inv.challanPrefix}${YYYYMM}-${seq}` },
    { label: "Credit note", value: `${inv.creditNotePrefix}${YYMMDD}-201` },
  ];

  const vat = t.vatEnabled ? (t.pricesIncludeVat ? (SAMPLE_SUBTOTAL * t.vatPct) / (100 + t.vatPct) : (SAMPLE_SUBTOTAL * t.vatPct) / 100) : 0;
  const gross = t.vatEnabled && !t.pricesIncludeVat ? SAMPLE_SUBTOTAL + vat : SAMPLE_SUBTOTAL;
  const total = roundTo(gross, t.roundTo);
  const roundOff = Math.round((total - gross) * 100) / 100;

  const error =
    t.vatEnabled && (t.vatPct < 0 || t.vatPct > 30)
      ? "VAT must be between 0% and 30%."
      : [inv.orderPrefix, inv.invoicePrefix, inv.challanPrefix, inv.creditNotePrefix].some((p) => !p.trim())
        ? "Every document needs a prefix."
        : new Set([inv.orderPrefix, inv.invoicePrefix, inv.challanPrefix, inv.creditNotePrefix]).size < 4
          ? "Prefixes must be different from each other."
          : !Number.isInteger(inv.nextNumber) || inv.nextNumber < 1
            ? "Next number must be a whole number of 1 or more."
            : null;

  const save = () => {
    if (tax.dirty) updateSettings("tax", t);
    if (invoice.dirty) updateSettings("invoice", inv);
    notify("Tax and invoice settings saved.");
  };

  return (
    <>
      <SettingsHeader title="Tax & invoice" description="VAT, rounding and how invoices, challans and credit notes are numbered and printed." />
      {readOnly && <ReadOnlyNotice />}

      <Card>
        <CardHeader title="VAT" description="Most medicines in Bangladesh are VAT-exempt at the wholesale stage. Turn on only if you are registered to charge VAT." />
        <div className="space-y-4 p-4 sm:p-5">
          <Switch checked={t.vatEnabled} onChange={(v) => setTax("vatEnabled", v)} disabled={readOnly} label="Charge VAT on invoices" />
          <div className={cn("grid gap-4 sm:grid-cols-2", !t.vatEnabled && "opacity-60")}>
            <Field label="VAT rate (%)" hint="Standard reduced rate for trading is 7.5%.">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  step="0.5"
                  min={0}
                  max={30}
                  value={t.vatPct}
                  onChange={(e) => setTax("vatPct", toNumber(e.target.value))}
                  disabled={readOnly || !t.vatEnabled}
                  className={cn(inputClass, "tabular-nums")}
                />
              )}
            </Field>
            <div className="sm:pt-7">
              <Switch
                checked={t.pricesIncludeVat}
                onChange={(v) => setTax("pricesIncludeVat", v)}
                disabled={readOnly || !t.vatEnabled}
                label="Prices include VAT"
                description="VAT is shown as a portion of the price instead of added on top."
              />
            </div>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Round invoice totals</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROUNDING.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                    t.roundTo === r.id ? "border-brand-primary bg-brand-light/40" : "border-slate-200 hover:bg-slate-50",
                    readOnly && "cursor-not-allowed"
                  )}
                >
                  <input
                    type="radio"
                    name="rounding"
                    checked={t.roundTo === r.id}
                    onChange={() => setTax("roundTo", r.id)}
                    disabled={readOnly}
                    className="mt-0.5 accent-brand-primary"
                  />
                  <span>
                    <span className="block font-medium text-apptext-primary">{r.label}</span>
                    <span className="block text-xs text-apptext-secondary">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader title="Document numbering" description="Numbers run in sequence per month: prefix + year and month + running number." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          {(
            [
              ["orderPrefix", "Order prefix"],
              ["invoicePrefix", "Invoice prefix"],
              ["challanPrefix", "Challan prefix"],
              ["creditNotePrefix", "Credit note prefix"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              {(id) => (
                <input id={id} value={inv[k]} onChange={(e) => setInv(k, e.target.value.toUpperCase())} disabled={readOnly} className={cn(inputClass, "font-mono")} />
              )}
            </Field>
          ))}
          <Field label="Next running number" hint="Used by the next order, invoice and challan.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                value={inv.nextNumber}
                onChange={(e) => setInv("nextNumber", Math.floor(toNumber(e.target.value)))}
                disabled={readOnly}
                className={cn(inputClass, "tabular-nums")}
              />
            )}
          </Field>
        </div>
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <p className="mb-2 text-sm font-medium text-apptext-primary">Preview of the next numbers</p>
          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {numbers.map((n) => (
              <div key={n.label} className="rounded-lg border border-dashed border-slate-200 bg-surface px-3 py-2">
                <dt className="text-xs text-apptext-secondary">{n.label}</dt>
                <dd className="break-all font-mono text-sm font-semibold tabular-nums text-brand-primary">{n.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Printing" />
          <div className="space-y-4 p-4 sm:p-5">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Default print format</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["A4", "A4 sheet", "Office printer, with letterhead"],
                    ["THERMAL_80MM", "80 mm thermal", "Counter or rider printer"],
                  ] as const
                ).map(([id, label, hint]) => (
                  <label
                    key={id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                      inv.defaultFormat === id ? "border-brand-primary bg-brand-light/40" : "border-slate-200 hover:bg-slate-50",
                      readOnly && "cursor-not-allowed"
                    )}
                  >
                    <input
                      type="radio"
                      name="format"
                      checked={inv.defaultFormat === id}
                      onChange={() => setInv("defaultFormat", id)}
                      disabled={readOnly}
                      className="mt-0.5 accent-brand-primary"
                    />
                    <span>
                      <span className="block font-medium text-apptext-primary">{label}</span>
                      <span className="block text-xs text-apptext-secondary">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Footer note" hint={`${inv.footerNote.length}/240 characters`}>
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  maxLength={240}
                  value={inv.footerNote}
                  onChange={(e) => setInv("footerNote", e.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              )}
            </Field>
            <Switch
              checked={inv.showBatchOnInvoice}
              onChange={(v) => setInv("showBatchOnInvoice", v)}
              disabled={readOnly}
              label="Show batch and expiry on each line"
              description="Recommended for DGDA traceability."
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Sample invoice" description={inv.defaultFormat === "A4" ? "A4 layout" : "80 mm thermal layout"} />
          <div className="bg-surface p-4">
            <div
              className={cn(
                "mx-auto space-y-2 border border-slate-200 bg-white p-4 text-xs text-apptext-primary shadow-sm",
                inv.defaultFormat === "THERMAL_80MM" ? "max-w-[260px] font-mono" : "max-w-full"
              )}
            >
              <div className={inv.defaultFormat === "THERMAL_80MM" ? "text-center" : "flex items-start justify-between gap-2"}>
                <p className="font-semibold text-brand-primary">Confidence Pharma</p>
                <p className="font-mono tabular-nums">{numbers[1].value}</p>
              </div>
              <div className="border-t border-dashed border-slate-200 pt-2">
                <div className="flex justify-between gap-2">
                  <span>Napa Extra 500mg × 20 box</span>
                  <span className="tabular-nums">{formatCurrency(SAMPLE_SUBTOTAL)}</span>
                </div>
                {inv.showBatchOnInvoice && <p className="text-[11px] text-apptext-secondary">Batch BEX-NX-2409 · Exp 12/2026</p>}
              </div>
              <dl className="space-y-0.5 border-t border-dashed border-slate-200 pt-2 tabular-nums">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(SAMPLE_SUBTOTAL)}</dd>
                </div>
                {t.vatEnabled && (
                  <div className="flex justify-between text-apptext-secondary">
                    <dt>
                      VAT {t.vatPct}%{t.pricesIncludeVat ? " (incl.)" : ""}
                    </dt>
                    <dd>{formatCurrency(Math.round(vat * 100) / 100)}</dd>
                  </div>
                )}
                {roundOff !== 0 && (
                  <div className="flex justify-between text-apptext-secondary">
                    <dt>Rounding</dt>
                    <dd>
                      {roundOff > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(roundOff))}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <dt>Total</dt>
                  <dd>{formatCurrency(total)}</dd>
                </div>
              </dl>
              {inv.footerNote && <p className="border-t border-dashed border-slate-200 pt-2 text-[11px] text-apptext-secondary">{inv.footerNote}</p>}
            </div>
          </div>
        </Card>
      </div>

      <SaveBar
        dirty={dirty}
        readOnly={readOnly}
        error={dirty ? error : null}
        onSave={save}
        onDiscard={() => {
          tax.discard();
          invoice.discard();
        }}
      />
    </>
  );
}
