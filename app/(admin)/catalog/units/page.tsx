"use client";

import React, { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CatalogUnit, DosageForm, UnitKind } from "@/lib/db/catalog-data";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, Field, Modal, PageHeader, Switch, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CatalogNav, InlineSwitch } from "@/components/catalog/shared";

const KIND_META: Record<UnitKind, { label: string; hint: string; badge: string }> = {
  BASE: { label: "Base unit", hint: "Counted in stock (Tablet, Vial)", badge: "bg-brand-light text-brand-primary border-brand-primary/20" },
  PACK: { label: "Pack", hint: "Holds other units (Strip, Carton)", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  BOTH: { label: "Base or pack", hint: "Either (Box, Kit)", badge: "bg-slate-100 text-slate-700 border-slate-200" },
};

const iconBtn = "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-primary";

export default function UnitsPage() {
  const { notify } = useInventory();
  const { can, logAudit } = useAppStore();
  const { units, dosageForms, counts, saveUnit, toggleUnit, deleteUnit, saveDosageForm, toggleDosageForm, deleteDosageForm } = useCatalog();
  const [unitEdit, setUnitEdit] = useState<{ value: CatalogUnit; isNew: boolean } | null>(null);
  const [formEdit, setFormEdit] = useState<{ value: DosageForm; isNew: boolean } | null>(null);

  const canCreate = can("catalog", "create");
  const canEdit = can("catalog", "edit");
  const canDelete = can("catalog", "delete");

  const removeUnit = (u: CatalogUnit) => {
    const n = counts.unit[u.name] ?? 0;
    if (n > 0) return notify(`${u.name} is used by ${n} products. Deactivate it instead.`, "warning");
    if (dosageForms.some((d) => d.defaultBaseUnit === u.name)) return notify(`${u.name} is a dosage form's default unit.`, "warning");
    if (!window.confirm(`Delete the unit "${u.name}"?`)) return;
    deleteUnit(u.id);
    logAudit("UNIT_DELETED", "CATALOG", `Unit "${u.name}" deleted.`);
  };
  const removeForm = (d: DosageForm) => {
    const n = counts.dosageForm[d.name] ?? 0;
    if (n > 0) return notify(`${d.name} is used by ${n} products. Deactivate it instead.`, "warning");
    if (!window.confirm(`Delete the dosage form "${d.name}"?`)) return;
    deleteDosageForm(d.id);
    logAudit("DOSAGE_FORM_DELETED", "CATALOG", `Dosage form "${d.name}" deleted.`);
  };

  return (
    <>
      <PageHeader title="Units & dosage forms" description="The building blocks of every pack hierarchy and product listing." />
      <CatalogNav />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Units"
            description="Base units are counted in stock. Packs contain other units."
            actions={
              canCreate && (
                <button
                  onClick={() =>
                    setUnitEdit({
                      isNew: true,
                      value: { id: `un-${Date.now().toString(36)}`, name: "", nameBn: "", abbreviation: "", kind: "BASE", isActive: true },
                    })
                  }
                  className={btn.small}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add unit
                </button>
              )
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-3 py-2">Short</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Products</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="py-2 pl-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className={cn(!u.isActive && "opacity-60")}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-apptext-primary">{u.name}</p>
                      <p lang="bn" className="text-xs text-apptext-secondary">
                        {u.nameBn}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apptext-secondary">{u.abbreviation}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={KIND_META[u.kind].badge}>{KIND_META[u.kind].label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{counts.unit[u.name] ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <InlineSwitch checked={u.isActive} disabled={!canEdit} label={`${u.name} active`} onChange={() => toggleUnit(u.id)} />
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <div className="inline-flex gap-0.5">
                        {canEdit && (
                          <button onClick={() => setUnitEdit({ value: u, isNew: false })} aria-label={`Edit ${u.name}`} className={iconBtn}>
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => removeUnit(u)} aria-label={`Delete ${u.name}`} className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}>
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Dosage forms"
            description="Picking a form in the product form pre-selects its base unit."
            actions={
              canCreate && (
                <button
                  onClick={() =>
                    setFormEdit({
                      isNew: true,
                      value: { id: `df-${Date.now().toString(36)}`, name: "", nameBn: "", defaultBaseUnit: "Tablet", isActive: true },
                    })
                  }
                  className={btn.small}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add dosage form
                </button>
              )
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2">Dosage form</th>
                  <th className="px-3 py-2">Default unit</th>
                  <th className="px-3 py-2 text-right">Products</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="py-2 pl-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dosageForms.map((d) => (
                  <tr key={d.id} className={cn(!d.isActive && "opacity-60")}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-apptext-primary">{d.name}</p>
                      <p lang="bn" className="text-xs text-apptext-secondary">
                        {d.nameBn}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-apptext-secondary">{d.defaultBaseUnit}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{counts.dosageForm[d.name] ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <InlineSwitch checked={d.isActive} disabled={!canEdit} label={`${d.name} active`} onChange={() => toggleDosageForm(d.id)} />
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <div className="inline-flex gap-0.5">
                        {canEdit && (
                          <button onClick={() => setFormEdit({ value: d, isNew: false })} aria-label={`Edit ${d.name}`} className={iconBtn}>
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => removeForm(d)} aria-label={`Delete ${d.name}`} className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}>
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {unitEdit && (
        <UnitModal
          initial={unitEdit.value}
          isNew={unitEdit.isNew}
          taken={units.filter((u) => u.id !== unitEdit.value.id).map((u) => u.name.toLowerCase())}
          inUse={(counts.unit[unitEdit.value.name] ?? 0) > 0}
          onClose={() => setUnitEdit(null)}
          onSave={(u) => {
            saveUnit(u);
            logAudit(unitEdit.isNew ? "UNIT_CREATED" : "UNIT_UPDATED", "CATALOG", `Unit "${u.name}" saved.`);
            notify(`${u.name} saved.`);
            setUnitEdit(null);
          }}
        />
      )}
      {formEdit && (
        <DosageFormModal
          initial={formEdit.value}
          isNew={formEdit.isNew}
          units={units.filter((u) => u.kind !== "PACK" && u.isActive)}
          taken={dosageForms.filter((d) => d.id !== formEdit.value.id).map((d) => d.name.toLowerCase())}
          inUse={(counts.dosageForm[formEdit.value.name] ?? 0) > 0}
          onClose={() => setFormEdit(null)}
          onSave={(d) => {
            saveDosageForm(d);
            logAudit(formEdit.isNew ? "DOSAGE_FORM_CREATED" : "DOSAGE_FORM_UPDATED", "CATALOG", `Dosage form "${d.name}" saved.`);
            notify(`${d.name} saved.`);
            setFormEdit(null);
          }}
        />
      )}
    </>
  );
}

function nameError(name: string, initial: string, taken: string[], isNew: boolean, inUse: boolean) {
  if (!name.trim()) return "Name is required.";
  if (taken.includes(name.trim().toLowerCase())) return "This name is already used.";
  if (!isNew && inUse && name.trim() !== initial) return "Renaming is locked while products use it.";
  return undefined;
}

function UnitModal({
  initial,
  isNew,
  taken,
  inUse,
  onClose,
  onSave,
}: {
  initial: CatalogUnit;
  isNew: boolean;
  taken: string[];
  inUse: boolean;
  onClose: () => void;
  onSave: (u: CatalogUnit) => void;
}) {
  const [u, setU] = useState(initial);
  const [tried, setTried] = useState(false);
  const errName = nameError(u.name, initial.name, taken, isNew, inUse);
  const errBn = !u.nameBn.trim() ? "Bangla name is required." : undefined;
  const submit = () => {
    setTried(true);
    if (errName || errBn) return;
    onSave({ ...u, name: u.name.trim(), nameBn: u.nameBn.trim(), abbreviation: u.abbreviation.trim() || u.name.trim().slice(0, 4).toLowerCase() });
  };
  return (
    <Modal
      title={isNew ? "Add unit" : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary}>
            Save unit
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name (English) *" error={tried ? errName : undefined}>
            {(id) => <input id={id} value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} placeholder="e.g. Sachet" className={inputClass} autoFocus />}
          </Field>
          <Field label="Name (Bangla) *" error={tried ? errBn : undefined}>
            {(id) => <input id={id} lang="bn" value={u.nameBn} onChange={(e) => setU({ ...u, nameBn: e.target.value })} className={inputClass} />}
          </Field>
        </div>
        <Field label="Abbreviation" hint="Shown on invoices and pick lists.">
          {(id) => <input id={id} value={u.abbreviation} onChange={(e) => setU({ ...u, abbreviation: e.target.value })} className={cn(inputClass, "font-mono sm:w-40")} />}
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_META) as UnitKind[]).map((k) => (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm",
                  u.kind === k ? "border-brand-primary bg-brand-light/30" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <input type="radio" name="unit-kind" checked={u.kind === k} onChange={() => setU({ ...u, kind: k })} className="mt-0.5 accent-brand-primary" />
                <span>
                  <span className="block font-medium text-apptext-primary">{KIND_META[k].label}</span>
                  <span className="block text-xs text-apptext-secondary">{KIND_META[k].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Switch checked={u.isActive} onChange={(v) => setU({ ...u, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

function DosageFormModal({
  initial,
  isNew,
  units,
  taken,
  inUse,
  onClose,
  onSave,
}: {
  initial: DosageForm;
  isNew: boolean;
  units: CatalogUnit[];
  taken: string[];
  inUse: boolean;
  onClose: () => void;
  onSave: (d: DosageForm) => void;
}) {
  const [d, setD] = useState(initial);
  const [tried, setTried] = useState(false);
  const errName = nameError(d.name, initial.name, taken, isNew, inUse);
  const submit = () => {
    setTried(true);
    if (errName) return;
    onSave({ ...d, name: d.name.trim(), nameBn: d.nameBn.trim() });
  };
  return (
    <Modal
      title={isNew ? "Add dosage form" : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary}>
            Save dosage form
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name (English) *" error={tried ? errName : undefined}>
            {(id) => <input id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Nasal spray" className={inputClass} autoFocus />}
          </Field>
          <Field label="Name (Bangla)">
            {(id) => <input id={id} lang="bn" value={d.nameBn} onChange={(e) => setD({ ...d, nameBn: e.target.value })} className={inputClass} />}
          </Field>
        </div>
        <Field label="Default base unit">
          {(id) => (
            <select id={id} value={d.defaultBaseUnit} onChange={(e) => setD({ ...d, defaultBaseUnit: e.target.value })} className={inputClass}>
              {units.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Switch checked={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}
