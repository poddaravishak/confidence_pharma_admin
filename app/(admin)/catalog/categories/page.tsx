"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Category, Subcategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, EmptyState, Field, Modal, PageHeader, SearchInput, Switch, btn, inputClass } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CATEGORY_ICONS, CatalogNav, CategoryIcon, InlineSwitch } from "@/components/catalog/shared";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Editing =
  | { kind: "category"; value: Category; isNew: boolean }
  | { kind: "sub"; categoryId: string; value: Subcategory; isNew: boolean; oldName?: string };

export default function CategoriesPage() {
  const { notify } = useInventory();
  const { can, logAudit } = useAppStore();
  const { categories, counts, saveCategory, toggleCategory, deleteCategory, saveSubcategory, toggleSubcategory, deleteSubcategory } =
    useCatalog();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(["cat-01"]));
  const [editing, setEditing] = useState<Editing | null>(null);

  const canCreate = can("catalog", "create");
  const canEdit = can("catalog", "edit");
  const canDelete = can("catalog", "delete");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .filter(
        (c) =>
          !q ||
          c.nameEn.toLowerCase().includes(q) ||
          c.nameBn.includes(q) ||
          c.subcategories.some((s) => s.nameEn.toLowerCase().includes(q) || s.nameBn.includes(q))
      );
  }, [categories, query]);

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const newCategory = () =>
    setEditing({
      kind: "category",
      isNew: true,
      value: {
        id: `cat-${Date.now().toString(36)}`,
        nameEn: "",
        nameBn: "",
        slug: "",
        icon: "Pill",
        displayOrder: Math.max(0, ...categories.map((c) => c.displayOrder)) + 1,
        isActive: true,
        subcategories: [],
        totalProductsCount: 0,
      },
    });

  const newSub = (categoryId: string) =>
    setEditing({
      kind: "sub",
      categoryId,
      isNew: true,
      value: { id: `sub-${Date.now().toString(36)}`, nameEn: "", nameBn: "", slug: "", isActive: true },
    });

  const remove = (c: Category) => {
    const n = counts.category[c.nameEn] ?? 0;
    if (n > 0) {
      notify(`${c.nameEn} has ${n} products. Move them to another category first.`, "warning");
      return;
    }
    if (!window.confirm(`Delete the category "${c.nameEn}" and its ${c.subcategories.length} subcategories?`)) return;
    deleteCategory(c.id);
    logAudit("CATEGORY_DELETED", "CATALOG", `Category "${c.nameEn}" deleted.`);
    notify(`${c.nameEn} deleted.`);
  };

  const removeSub = (c: Category, s: Subcategory) => {
    const n = counts.subcategory[`${c.nameEn}/${s.nameEn}`] ?? 0;
    if (n > 0) {
      notify(`${s.nameEn} has ${n} products. Move them first.`, "warning");
      return;
    }
    if (!window.confirm(`Delete the subcategory "${s.nameEn}"?`)) return;
    deleteSubcategory(c.id, s.id);
    logAudit("SUBCATEGORY_DELETED", "CATALOG", `Subcategory "${c.nameEn} › ${s.nameEn}" deleted.`);
  };

  const iconBtn = "rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-primary";

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products for browsing in the customer app, reports and stock counts."
        actions={
          canCreate && (
            <button onClick={newCategory} className={btn.primary}>
              <Plus className="size-4" aria-hidden />
              Add category
            </button>
          )
        }
      />
      <CatalogNav />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search categories or subcategories" className="sm:max-w-sm" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="w-10 py-2.5 pl-4" />
                  <th className="px-3 py-2.5 text-right">Order</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Subcategories</th>
                  <th className="px-3 py-2.5 text-right">Products</th>
                  <th className="px-3 py-2.5">Active</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const expanded = open.has(c.id) || !!query.trim();
                  return (
                    <React.Fragment key={c.id}>
                      <tr className={cn("transition hover:bg-surface/60", !c.isActive && "opacity-60")}>
                        <td className="py-3 pl-4">
                          <button
                            onClick={() => toggleOpen(c.id)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Hide" : "Show"} subcategories of ${c.nameEn}`}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <ChevronDown className={cn("size-4 transition", expanded && "rotate-180")} />
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-apptext-secondary">{c.displayOrder}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
                              <CategoryIcon name={c.icon} className="size-4" />
                            </span>
                            <div>
                              <p className="font-medium text-apptext-primary">{c.nameEn}</p>
                              <p lang="bn" className="text-xs text-apptext-secondary">
                                {c.nameBn} · <span className="font-mono">/{c.slug}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{c.subcategories.length}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-apptext-primary">{counts.category[c.nameEn] ?? 0}</td>
                        <td className="px-3 py-3">
                          <InlineSwitch
                            checked={c.isActive}
                            disabled={!canEdit}
                            label={`${c.nameEn} active`}
                            onChange={() => {
                              toggleCategory(c.id);
                              logAudit("CATEGORY_UPDATED", "CATALOG", `Category "${c.nameEn}" ${c.isActive ? "deactivated" : "activated"}.`);
                            }}
                          />
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <div className="inline-flex gap-0.5">
                            {canCreate && (
                              <button onClick={() => newSub(c.id)} aria-label={`Add subcategory to ${c.nameEn}`} title="Add subcategory" className={iconBtn}>
                                <Plus className="size-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button onClick={() => setEditing({ kind: "category", value: c, isNew: false })} aria-label={`Edit ${c.nameEn}`} title="Edit" className={iconBtn}>
                                <Pencil className="size-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => remove(c)} aria-label={`Delete ${c.nameEn}`} title="Delete" className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}>
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded &&
                        (c.subcategories.length === 0 ? (
                          <tr className="bg-surface/50">
                            <td />
                            <td colSpan={6} className="px-3 py-3 text-sm text-apptext-secondary">
                              No subcategories.{" "}
                              {canCreate && (
                                <button onClick={() => newSub(c.id)} className="font-medium text-brand-blue hover:underline">
                                  Add one
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          c.subcategories.map((s) => (
                            <tr key={s.id} className={cn("bg-surface/50", !s.isActive && "opacity-60")}>
                              <td />
                              <td />
                              <td className="px-3 py-2 pl-12">
                                <p className="text-apptext-primary">{s.nameEn}</p>
                                <p lang="bn" className="text-xs text-apptext-secondary">
                                  {s.nameBn}
                                </p>
                              </td>
                              <td />
                              <td className="px-3 py-2 text-right tabular-nums">{counts.subcategory[`${c.nameEn}/${s.nameEn}`] ?? 0}</td>
                              <td className="px-3 py-2">
                                <InlineSwitch
                                  checked={s.isActive}
                                  disabled={!canEdit}
                                  label={`${s.nameEn} active`}
                                  onChange={() => toggleSubcategory(c.id, s.id)}
                                />
                              </td>
                              <td className="py-2 pl-3 pr-4 text-right">
                                <div className="inline-flex gap-0.5">
                                  {canEdit && (
                                    <button
                                      onClick={() => setEditing({ kind: "sub", categoryId: c.id, value: s, isNew: false, oldName: s.nameEn })}
                                      aria-label={`Edit ${s.nameEn}`}
                                      className={iconBtn}
                                    >
                                      <Pencil className="size-4" />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => removeSub(c, s)} aria-label={`Delete ${s.nameEn}`} className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")}>
                                      <Trash2 className="size-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing?.kind === "category" && (
        <CategoryModal
          initial={editing.value}
          isNew={editing.isNew}
          taken={categories.filter((c) => c.id !== editing.value.id).map((c) => c.nameEn.toLowerCase())}
          productCount={counts.category[editing.value.nameEn] ?? 0}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            saveCategory(c);
            logAudit(editing.isNew ? "CATEGORY_CREATED" : "CATEGORY_UPDATED", "CATALOG", `Category "${c.nameEn}" ${editing.isNew ? "created" : "updated"}.`);
            notify(`${c.nameEn} saved.`);
            setEditing(null);
          }}
        />
      )}
      {editing?.kind === "sub" && (
        <SubcategoryModal
          initial={editing.value}
          isNew={editing.isNew}
          categoryName={categories.find((c) => c.id === editing.categoryId)?.nameEn ?? ""}
          taken={(categories.find((c) => c.id === editing.categoryId)?.subcategories ?? [])
            .filter((s) => s.id !== editing.value.id)
            .map((s) => s.nameEn.toLowerCase())}
          productCount={
            editing.oldName ? counts.subcategory[`${categories.find((c) => c.id === editing.categoryId)?.nameEn}/${editing.oldName}`] ?? 0 : 0
          }
          onClose={() => setEditing(null)}
          onSave={(s) => {
            saveSubcategory(editing.categoryId, s);
            logAudit(editing.isNew ? "SUBCATEGORY_CREATED" : "SUBCATEGORY_UPDATED", "CATALOG", `Subcategory "${s.nameEn}" saved.`);
            notify(`${s.nameEn} saved.`);
            setOpen((prev) => new Set(prev).add(editing.categoryId));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CategoryModal({
  initial,
  isNew,
  taken,
  productCount,
  onClose,
  onSave,
}: {
  initial: Category;
  isNew: boolean;
  taken: string[];
  productCount: number;
  onClose: () => void;
  onSave: (c: Category) => void;
}) {
  const [c, setC] = useState(initial);
  const [tried, setTried] = useState(false);
  const nameError = !c.nameEn.trim()
    ? "Name is required."
    : taken.includes(c.nameEn.trim().toLowerCase())
    ? "Another category already uses this name."
    : !isNew && productCount > 0 && c.nameEn.trim() !== initial.nameEn
    ? `Renaming is locked while ${productCount} products use this category.`
    : undefined;
  const bnError = !c.nameBn.trim() ? "Bangla name is required." : undefined;
  const orderError = !(c.displayOrder >= 1) ? "Use 1 or more." : undefined;
  const submit = () => {
    setTried(true);
    if (nameError || bnError || orderError) return;
    onSave({ ...c, nameEn: c.nameEn.trim(), nameBn: c.nameBn.trim(), slug: c.slug.trim() || slugify(c.nameEn) });
  };
  return (
    <Modal
      title={isNew ? "Add category" : `Edit ${initial.nameEn}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary}>
            Save category
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name (English) *" error={tried ? nameError : undefined}>
          {(id) => <input id={id} value={c.nameEn} onChange={(e) => setC({ ...c, nameEn: e.target.value })} className={inputClass} autoFocus />}
        </Field>
        <Field label="Name (Bangla) *" error={tried ? bnError : undefined}>
          {(id) => <input id={id} lang="bn" value={c.nameBn} onChange={(e) => setC({ ...c, nameBn: e.target.value })} className={inputClass} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="URL slug" hint="Blank: made from the name">
            {(id) => (
              <input id={id} value={c.slug} placeholder={slugify(c.nameEn)} onChange={(e) => setC({ ...c, slug: slugify(e.target.value) })} className={cn(inputClass, "font-mono")} />
            )}
          </Field>
          <Field label="Display order" error={tried ? orderError : undefined}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                value={c.displayOrder}
                onChange={(e) => setC({ ...c, displayOrder: parseInt(e.target.value, 10) || 0 })}
                className={cn(inputClass, "tabular-nums")}
              />
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-apptext-primary">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(CATEGORY_ICONS).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setC({ ...c, icon: name })}
                aria-pressed={c.icon === name}
                aria-label={`Icon ${name}`}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg border transition",
                  c.icon === name ? "border-brand-primary bg-brand-light text-brand-primary" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                <CategoryIcon name={name} className="size-4" />
              </button>
            ))}
          </div>
        </fieldset>
        <Switch checked={c.isActive} onChange={(v) => setC({ ...c, isActive: v })} label="Active" description="Inactive categories are hidden from the product form and customer app." />
      </div>
    </Modal>
  );
}

function SubcategoryModal({
  initial,
  isNew,
  categoryName,
  taken,
  productCount,
  onClose,
  onSave,
}: {
  initial: Subcategory;
  isNew: boolean;
  categoryName: string;
  taken: string[];
  productCount: number;
  onClose: () => void;
  onSave: (s: Subcategory) => void;
}) {
  const [s, setS] = useState(initial);
  const [tried, setTried] = useState(false);
  const nameError = !s.nameEn.trim()
    ? "Name is required."
    : taken.includes(s.nameEn.trim().toLowerCase())
    ? `${categoryName} already has this subcategory.`
    : !isNew && productCount > 0 && s.nameEn.trim() !== initial.nameEn
    ? `Renaming is locked while ${productCount} products use it.`
    : undefined;
  const bnError = !s.nameBn.trim() ? "Bangla name is required." : undefined;
  const submit = () => {
    setTried(true);
    if (nameError || bnError) return;
    onSave({ ...s, nameEn: s.nameEn.trim(), nameBn: s.nameBn.trim(), slug: slugify(s.nameEn) });
  };
  return (
    <Modal
      title={isNew ? "Add subcategory" : `Edit ${initial.nameEn}`}
      subtitle={`In ${categoryName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={submit} className={btn.primary}>
            Save subcategory
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name (English) *" error={tried ? nameError : undefined}>
          {(id) => <input id={id} value={s.nameEn} onChange={(e) => setS({ ...s, nameEn: e.target.value })} className={inputClass} autoFocus />}
        </Field>
        <Field label="Name (Bangla) *" error={tried ? bnError : undefined}>
          {(id) => <input id={id} lang="bn" value={s.nameBn} onChange={(e) => setS({ ...s, nameBn: e.target.value })} className={inputClass} />}
        </Field>
        <Switch checked={s.isActive} onChange={(v) => setS({ ...s, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}
