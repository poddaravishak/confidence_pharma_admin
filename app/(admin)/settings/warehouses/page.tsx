"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Info, MapPin, Plus, ShieldAlert, Snowflake, Star, UserRound, Warehouse as WarehouseIcon } from "lucide-react";
import { Warehouse } from "@/lib/types";
import { useAppStore } from "@/lib/store/AppStore";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { cn } from "@/lib/utils";
import { Badge, Card, Field, Modal, Switch, btn, inputClass } from "@/components/ui";
import { ReadOnlyNotice, SettingsHeader, toNumber } from "@/components/settings/shared";

type Zone = "AMBIENT" | "COLD" | "QUARANTINE";

interface Rack {
  warehouseId: string;
  code: string;
  zone: Zone;
  bins: string[];
}

const ZONE_META: Record<Zone, { label: string; className: string }> = {
  AMBIENT: { label: "Ambient", className: "border-slate-200 bg-white text-slate-700" },
  COLD: { label: "Cold room 2–8 °C", className: "border-sky-200 bg-sky-50 text-sky-700" },
  QUARANTINE: { label: "Quarantine", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const rackOf = (location: string) => {
  const parts = location.split("-");
  return parts.length >= 3 ? parts.slice(0, -1).join("-") : location;
};

const zoneOf = (code: string): Zone => (/(^|-)CR(-|$)/.test(code) ? "COLD" : /^Q(-|$)/.test(code) ? "QUARANTINE" : "AMBIENT");

export default function WarehousesPage() {
  const { warehouses: seedWarehouses, batches } = useInventory();
  const { can, notify } = useAppStore();
  const readOnly = !can("settings", "edit");

  const [warehouses, setWarehouses] = useState<Warehouse[]>(seedWarehouses);
  const [addedRacks, setAddedRacks] = useState<Rack[]>([]);
  const [modal, setModal] = useState<{ kind: "warehouse" } | { kind: "rack"; warehouseId: string } | null>(null);

  const racks = useMemo(() => {
    const map = new Map<string, Rack>();
    for (const b of batches) {
      const code = rackOf(b.location);
      const key = `${b.warehouseId}|${code}`;
      const rack = map.get(key) ?? { warehouseId: b.warehouseId, code, zone: zoneOf(code), bins: [] };
      if (!rack.bins.includes(b.location)) rack.bins.push(b.location);
      map.set(key, rack);
    }
    for (const r of addedRacks) map.set(`${r.warehouseId}|${r.code}`, r);
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [batches, addedRacks]);

  const batchCount = (whId: string) => batches.filter((b) => b.warehouseId === whId && b.availableQuantity > 0).length;

  return (
    <>
      <SettingsHeader
        title="Warehouses"
        description="Stock locations, rack and bin codes, and which sites can hold cold-chain items."
        actions={
          !readOnly && (
            <button className={btn.primary} onClick={() => setModal({ kind: "warehouse" })}>
              <Plus className="size-4" aria-hidden />
              Add warehouse
            </button>
          )
        }
      />
      {readOnly && <ReadOnlyNotice />}
      <p className="flex items-start gap-2 text-xs text-apptext-secondary">
        <Info className="mt-px size-3.5 shrink-0 text-brand-blue" aria-hidden />
        Demo: warehouses and racks added here last for this session only and don&apos;t appear in inventory screens. Stock levels live in{" "}
        <Link href="/inventory" className="font-medium text-brand-primary hover:underline">
          Inventory
        </Link>
        .
      </p>

      <div className="space-y-4">
        {warehouses.map((w) => {
          const whRacks = racks.filter((r) => r.warehouseId === w.id);
          const bins = whRacks.reduce((n, r) => n + r.bins.length, 0);
          return (
            <Card key={w.id}>
              <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
                    <WarehouseIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-apptext-primary">{w.name}</h3>
                      <Badge className="border-slate-200 bg-surface font-mono text-slate-600">{w.code}</Badge>
                      {w.isPrimary && (
                        <Badge className="border-brand-primary bg-brand-primary text-white">
                          <Star className="size-3" aria-hidden />
                          Primary
                        </Badge>
                      )}
                      {w.hasColdRoom && (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                          <Snowflake className="size-3" aria-hidden />
                          Cold room
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-start gap-1.5 text-sm text-apptext-secondary">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {w.address}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-apptext-secondary">
                      <UserRound className="size-3.5 shrink-0" aria-hidden />
                      Manager: <span className="text-apptext-primary">{w.managerName}</span>
                    </p>
                  </div>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-2 text-center">
                  {[
                    ["Racks", whRacks.length],
                    ["Bins", bins],
                    ["Live batches", batchCount(w.id)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-surface px-3 py-2">
                      <dt className="text-xs text-apptext-secondary">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums text-apptext-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-apptext-primary">Rack locations</p>
                  {!readOnly && (
                    <button className={btn.small} onClick={() => setModal({ kind: "rack", warehouseId: w.id })}>
                      <Plus className="size-3.5" aria-hidden />
                      Add rack location
                    </button>
                  )}
                </div>
                {whRacks.length === 0 ? (
                  <p className="text-sm text-apptext-secondary">No racks recorded yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {whRacks.map((r) => (
                      <li
                        key={r.code}
                        className={cn("rounded-lg border px-2.5 py-1.5 text-xs", ZONE_META[r.zone].className)}
                        title={r.bins.join(", ")}
                      >
                        <span className="font-mono font-semibold">{r.code}</span>
                        <span className="ml-1.5 opacity-80">
                          {r.zone !== "AMBIENT" && `${ZONE_META[r.zone].label} · `}
                          {r.bins.length} bin{r.bins.length === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!w.hasColdRoom && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                    <ShieldAlert className="size-3.5" aria-hidden />
                    No cold room: insulin, vaccines and other 2–8 °C items can&apos;t be stored here.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {modal?.kind === "warehouse" && (
        <WarehouseModal
          existing={warehouses}
          onClose={() => setModal(null)}
          onSave={(w) => {
            setWarehouses((prev) => [...(w.isPrimary ? prev.map((p) => ({ ...p, isPrimary: false })) : prev), w]);
            notify(`${w.name} added (demo).`);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "rack" && (
        <RackModal
          warehouses={warehouses}
          racks={racks}
          initialWarehouseId={modal.warehouseId}
          onClose={() => setModal(null)}
          onSave={(r) => {
            setAddedRacks((prev) => [...prev, r]);
            notify(`Rack ${r.code} added with ${r.bins.length} bin${r.bins.length === 1 ? "" : "s"} (demo).`);
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function WarehouseModal({ existing, onClose, onSave }: { existing: Warehouse[]; onClose: () => void; onSave: (w: Warehouse) => void }) {
  const [form, setForm] = useState({ name: "", code: "", address: "", managerName: "", hasColdRoom: false, isPrimary: false });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const code = form.code.trim().toUpperCase();
  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!/^[A-Z0-9]{2,5}$/.test(code)) errors.code = "2–5 letters or digits.";
  else if (existing.some((w) => w.code === code)) errors.code = "Code already in use.";
  if (!form.address.trim()) errors.address = "Address is required.";
  if (!form.managerName.trim()) errors.managerName = "Manager is required.";
  const valid = Object.keys(errors).length === 0;
  const err = (k: keyof typeof form) => (touched ? errors[k] : undefined);

  return (
    <Modal
      title="Add warehouse"
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btn.primary}
            disabled={touched && !valid}
            onClick={() => {
              setTouched(true);
              if (!valid) return;
              onSave({
                id: `wh-${Date.now().toString(36)}`,
                name: form.name.trim(),
                code,
                address: form.address.trim(),
                managerName: form.managerName.trim(),
                hasColdRoom: form.hasColdRoom,
                isPrimary: form.isPrimary,
              });
            }}
          >
            Add warehouse
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" error={err("name")} className="sm:col-span-2">
          {(id) => <input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Chattogram Hub" className={inputClass} autoFocus />}
        </Field>
        <Field label="Code" error={err("code")}>
          {(id) => <input id={id} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="CTG" className={cn(inputClass, "font-mono uppercase")} />}
        </Field>
        <Field label="Address" error={err("address")} className="sm:col-span-3">
          {(id) => <input id={id} value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Manager" error={err("managerName")} className="sm:col-span-3">
          {(id) => <input id={id} value={form.managerName} onChange={(e) => set("managerName", e.target.value)} className={inputClass} />}
        </Field>
        <div className="space-y-3 sm:col-span-3">
          <Switch checked={form.hasColdRoom} onChange={(v) => set("hasColdRoom", v)} label="Has a cold room" description="Allows 2–8 °C items to be received here." />
          <Switch checked={form.isPrimary} onChange={(v) => set("isPrimary", v)} label="Primary warehouse" description="Default for purchases and new orders." />
        </div>
      </div>
    </Modal>
  );
}

function RackModal({
  warehouses,
  racks,
  initialWarehouseId,
  onClose,
  onSave,
}: {
  warehouses: Warehouse[];
  racks: Rack[];
  initialWarehouseId: string;
  onClose: () => void;
  onSave: (r: Rack) => void;
}) {
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [code, setCode] = useState("");
  const [zone, setZone] = useState<Zone>("AMBIENT");
  const [binCount, setBinCount] = useState(4);
  const [touched, setTouched] = useState(false);

  const wh = warehouses.find((w) => w.id === warehouseId);
  const rackCode = code.trim().toUpperCase();
  const error = !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(rackCode)
    ? "Use letters, digits and dashes, e.g. A-07."
    : racks.some((r) => r.warehouseId === warehouseId && r.code === rackCode)
      ? "This rack already exists in the warehouse."
      : zone === "COLD" && !wh?.hasColdRoom
        ? "This warehouse has no cold room."
        : binCount < 1 || binCount > 50
          ? "Bins must be between 1 and 50."
          : null;
  const bins = Array.from({ length: Math.min(Math.max(binCount, 0), 50) }, (_, i) => `${rackCode || "A-07"}-${String(i + 1).padStart(2, "0")}`);

  return (
    <Modal
      title="Add rack location"
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btn.primary}
            disabled={touched && Boolean(error)}
            onClick={() => {
              setTouched(true);
              if (error) return;
              onSave({ warehouseId, code: rackCode, zone, bins });
            }}
          >
            Add rack
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Warehouse" className="sm:col-span-2">
          {(id) => (
            <select id={id} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Rack code" error={touched ? error ?? undefined : undefined}>
          {(id) => <input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="A-07" className={cn(inputClass, "font-mono uppercase")} autoFocus />}
        </Field>
        <Field label="Bins on this rack">
          {(id) => (
            <input id={id} type="number" min={1} max={50} value={binCount} onChange={(e) => setBinCount(toNumber(e.target.value))} className={cn(inputClass, "tabular-nums")} />
          )}
        </Field>
        <Field label="Zone" className="sm:col-span-2">
          {(id) => (
            <select id={id} value={zone} onChange={(e) => setZone(e.target.value as Zone)} className={inputClass}>
              {(Object.keys(ZONE_META) as Zone[]).map((z) => (
                <option key={z} value={z} disabled={z === "COLD" && !wh?.hasColdRoom}>
                  {ZONE_META[z].label}
                  {z === "COLD" && !wh?.hasColdRoom ? " (no cold room)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs text-apptext-secondary">Bin codes</p>
          <p className="font-mono text-xs text-apptext-primary">
            {bins.slice(0, 6).join(", ")}
            {bins.length > 6 && ` … ${bins[bins.length - 1]}`}
          </p>
        </div>
      </div>
    </Modal>
  );
}
