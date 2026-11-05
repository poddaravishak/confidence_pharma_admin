"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Copy,
  History,
  LayoutList,
  Package,
  PackageX,
  Pencil,
  Power,
  ShoppingCart,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { DEMO_TODAY } from "@/lib/db/inventory-data";
import { ALL_CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS } from "@/lib/db/catalog-data";
import {
  BATCH_STATE_META,
  MOVEMENT_META,
  batchState,
  computeItemStock,
  fefoSort,
  formatDateTime,
  formatDay,
  formatPacks,
  plural,
} from "@/lib/inventory";
import { ORDER_STATUS_META, acceptedQty, netPackPrice } from "@/lib/orders";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Tabs, btn } from "@/components/ui";
import { useInventory } from "@/components/inventory/InventoryProvider";
import { ColdChainTag, ExpiryBadge, StockStatusBadge } from "@/components/inventory/shared";
import { useAppStore } from "@/lib/store/AppStore";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { ControlledTag, KeyValues, ProductStatusBadge, ProductThumb, RxTag } from "@/components/catalog/shared";
import { fmtPct, marginPct, marginTone, round2 } from "@/components/catalog/catalog-utils";
import { availableIn, conversionChain, defaultSaleLevel, formatQty, qtyText, unitLevels } from "@/lib/units";
import { packUnitOf } from "@/components/orders/shared";
import { ConversionLadder, UnitConverter } from "@/components/units";

type Tab = "overview" | "stock" | "movements" | "sales";

const NOT_SOLD = new Set(["CANCELLED", "FAILED_DELIVERY", "RETURNED"]);

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { batches, movements, warehouseById, supplierById, updateItem, notify } = useInventory();
  const { orders, can, logAudit } = useAppStore();
  const { productById, packBarcodes, priceHistory } = useCatalog();
  const [tab, setTab] = useState<Tab>("overview");

  const item = productById[id];

  const itemBatches = useMemo(() => batches.filter((b) => b.itemId === id).sort(fefoSort), [batches, id]);
  const itemMoves = useMemo(
    () => movements.filter((m) => m.itemId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [movements, id]
  );
  const stock = useMemo(() => (item ? computeItemStock(item, batches) : null), [item, batches]);

  const sales = useMemo(() => {
    if (!item) return [];
    return orders
      .flatMap((o) =>
        o.items
          .filter((l) => l.productId === id)
          .map((l) => {
            const packs = NOT_SOLD.has(o.orderStatus) ? 0 : acceptedQty(l);
            const per = l.unitsPerPack ?? item.unitsPerPack;
            return {
              key: `${o.id}-${l.id}`,
              order: o,
              line: l,
              /** Unit the line was ordered in (lines may use different units). */
              unit: packUnitOf(l),
              packs,
              units: packs * per,
              revenue: round2(netPackPrice(l) * packs),
              cogs: l.quantity > 0 ? round2((l.cogsCost / l.quantity) * packs) : 0,
            };
          })
      )
      .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  }, [orders, id, item]);

  if (!item || !stock) {
    return (
      <Card>
        <EmptyState
          icon={PackageX}
          title="Product not found"
          description="It may have been added in another session. Demo data resets on reload."
          action={
            <Link href="/catalog" className={btn.secondary}>
              Back to catalog
            </Link>
          }
        />
      </Card>
    );
  }

  // Lines can be in different units, so add up base units and convert once.
  const saleLevel = defaultSaleLevel(item);
  const sums = sales.reduce(
    (t, s) => ({ units: t.units + s.units, revenue: t.revenue + s.revenue, cogs: t.cogs + s.cogs }),
    { units: 0, revenue: 0, cogs: 0 }
  );
  const totals = { ...sums, packs: round2(sums.units / saleLevel.factor) };
  const margin = marginPct(item.costPrice, item.sellingPrice);
  const canEdit = can("catalog", "edit");

  const toggleActive = () => {
    const active = !item.isActive;
    if (active && !(item.sellingPrice > 0 && item.mrp > 0)) {
      notify("Add a selling price and MRP before activating this product.", "warning");
      return;
    }
    if (!active && !window.confirm(`Deactivate ${item.name}? Customers will no longer be able to order it.`)) return;
    updateItem(item.id, { isActive: active, status: active ? "ACTIVE" : "INACTIVE" });
    logAudit(active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED", "CATALOG", `${item.name} (${item.sku}) ${active ? "activated" : "deactivated"}.`);
    notify(`${item.name} ${active ? "activated" : "deactivated"}.`);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutList },
    { id: "stock", label: "Stock & batches", icon: Boxes, count: itemBatches.filter((b) => b.availableQuantity > 0).length },
    { id: "movements", label: "Movements", icon: History, count: itemMoves.length },
    { id: "sales", label: "Sales", icon: BarChart3, count: sales.length },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-1">
            <Link href="/catalog" className="hover:text-brand-primary hover:underline">
              Catalog
            </Link>
            <span aria-hidden>/</span>
            <span className="font-mono text-xs">{item.sku}</span>
          </span>
        }
        title={item.name}
        description={
          <span>
            {[item.genericName, item.strength, item.brand].filter(Boolean).join(" · ")}
            {item.nameBn && (
              <span lang="bn" className="block">
                {item.nameBn}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {canEdit && (
              <Link href={`/catalog/${item.id}/edit`} className={btn.primary}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            )}
            {can("catalog", "create") && (
              <Link href={`/catalog/new?duplicate=${item.id}`} className={btn.secondary}>
                <Copy className="size-4" aria-hidden />
                Duplicate
              </Link>
            )}
            {canEdit && (
              <button onClick={toggleActive} className={btn.secondary}>
                {item.isActive ? <Power className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                {item.isActive ? "Deactivate" : "Activate"}
              </button>
            )}
            {can("inventory", "edit") && (
              <Link href="/inventory" className={btn.secondary}>
                <SlidersHorizontal className="size-4" aria-hidden />
                Adjust stock
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <ProductStatusBadge item={item} />
        <StockStatusBadge status={stock.status} />
        {item.isPrescriptionRequired && <RxTag />}
        {item.isControlled && <ControlledTag />}
        {item.isColdChain && <ColdChainTag />}
        <Badge className="border-slate-200 bg-white text-slate-600">
          {item.category}
          {item.subcategory ? ` › ${item.subcategory}` : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <StatCard
          label="Sellable stock"
          value={<span className="text-lg">{formatPacks(stock.sellable, item)}</span>}
          hint={`${stock.batchCount} ${plural("batch", stock.batchCount)}${stock.onHold + stock.expired ? ` · ${(stock.onHold + stock.expired).toLocaleString("en-US")} blocked` : ""}`}
          icon={Boxes}
          tone={stock.status === "IN_STOCK" ? "green" : stock.status === "LOW_STOCK" ? "amber" : "rose"}
        />
        <StatCard label="Stock value" value={formatCurrency(round2(stock.value))} hint="At batch cost" icon={Wallet} tone="blue" />
        <StatCard
          label={`Price per ${saleLevel.name.toLowerCase()}`}
          value={formatCurrency(saleLevel.price)}
          hint={`MRP ${formatCurrency(saleLevel.mrp)} · ${fmtPct(margin)} margin`}
          icon={Package}
          tone="slate"
        />
        <StatCard
          label="Sold"
          value={<span className="text-lg">{formatQty(totals.units, item, "sale")}</span>}
          hint={`${totals.units.toLocaleString("en-US")} ${plural(item.baseUnit, totals.units).toLowerCase()} in total`}
          icon={ShoppingCart}
          tone="slate"
        />
        <StatCard label="Revenue" value={formatCurrency(round2(totals.revenue))} hint={`${sales.length} order ${plural("line", sales.length)}`} icon={BarChart3} tone="green" />
      </div>

      <Tabs label="Product sections" value={tab} onChange={setTab} tabs={tabs} />

      {tab === "overview" && <Overview item={item} sellable={stock?.sellable ?? 0} barcodes={packBarcodes[item.id] ?? {}} history={priceHistory[item.id] ?? []} supplier={supplierById[item.supplierId]?.name} warehouse={item.defaultWarehouseId ? warehouseById[item.defaultWarehouseId]?.name : undefined} />}

      {tab === "stock" && (
        <StockTab item={item} batches={itemBatches} warehouseById={warehouseById} />
      )}

      {tab === "movements" && (
        <Card className="overflow-hidden">
          {itemMoves.length === 0 ? (
            <EmptyState icon={History} title="No stock movements yet" description="Purchases, sales, adjustments and transfers will show here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Batch · warehouse</th>
                    <th className="px-3 py-2.5 text-right">Quantity</th>
                    <th className="px-3 py-2.5 text-right">Unit cost</th>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-4 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemMoves.map((m) => {
                    const meta = MOVEMENT_META[m.type];
                    const b = batches.find((x) => x.id === m.batchId);
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-apptext-secondary">{formatDateTime(m.date)}</td>
                        <td className="px-3 py-2.5">
                          <Badge className={meta.badge}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="font-mono font-semibold text-apptext-primary">{b?.batchNumber ?? "—"}</span>
                          <span className="block text-apptext-secondary">{warehouseById[m.warehouseId]?.code}</span>
                        </td>
                        <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", m.quantity < 0 ? "text-rose-700" : "text-emerald-700")}>
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity.toLocaleString("en-US")}
                          <span className="block text-xs font-normal text-slate-500">{formatPacks(m.quantity, item)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-apptext-secondary">{formatCurrency(m.unitCost)}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-apptext-primary">{m.reference}</span>
                          {m.note && <span className="block max-w-xs truncate text-xs text-apptext-secondary">{m.note}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-apptext-secondary">{m.performedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-slate-100 px-4 py-2.5 text-right">
            <Link href={`/inventory/movements?item=${item.id}`} className="text-sm font-medium text-brand-blue hover:underline">
              Open in stock movements
            </Link>
          </div>
        </Card>
      )}

      {tab === "sales" && <SalesTab sales={sales} item={item} totals={totals} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function Overview({
  item,
  sellable,
  barcodes,
  history,
  supplier,
  warehouse,
}: {
  item: ReturnType<typeof useCatalog>["products"][number];
  /** Sellable stock in base units. */
  sellable: number;
  barcodes: Record<string, string>;
  history: ReturnType<typeof useCatalog>["priceHistory"][string];
  supplier?: string;
  warehouse?: string;
}) {
  const ladder = unitLevels(item);
  const sale = ladder.find((l) => l.isDefaultSale)!;
  const tiers = [...(item.pricingTiers ?? [])].sort((a, b) => a.minQuantity - b.minQuantity);
  const packCost = sale.cost;
  const visible = item.visibleTo ?? ALL_CUSTOMER_TYPES;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader title="Product details" />
          <div className="grid gap-x-8 px-4 pb-2 sm:grid-cols-2 sm:px-5">
            <KeyValues
              rows={[
                ["Generic name", item.genericName],
                ["Strength", item.strength || "—"],
                ["Dosage form", item.dosageForm ?? item.medicineType],
                ["Brand", item.brand],
                ["Category", [item.category, item.subcategory].filter(Boolean).join(" › ")],
                ["DGDA reg. no.", <span key="d" className="font-mono text-xs">{item.dgdaRegNo || "—"}</span>],
                ["Barcode", <span key="b" className="font-mono text-xs">{item.barcode || "—"}</span>],
              ]}
            />
            <KeyValues
              rows={[
                ["SKU", <span key="s" className="font-mono text-xs">{item.sku}</span>],
                ["Storage", item.storageCondition],
                ["Prescription", item.isPrescriptionRequired ? "Required" : "Not required"],
                ["Controlled drug", item.isControlled ? "Yes" : "No"],
                ["Supplier", supplier ?? "—"],
                ["Lead time", `${item.leadTimeDays} ${plural("day", item.leadTimeDays)}`],
                ["Default location", [warehouse, item.defaultLocation].filter(Boolean).join(" · ") || "—"],
              ]}
            />
          </div>
          {item.description && <p className="text-pretty border-t border-slate-100 px-4 py-3 text-sm text-apptext-secondary sm:px-5">{item.description}</p>}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Units & conversions"
            description={`Stock is counted in ${plural(item.baseUnit, 2).toLowerCase()}. Every other unit is a conversion: ${conversionChain(item)}.`}
          />
          <div className="border-b border-slate-100 px-4 pb-3 sm:px-5">
            <ConversionLadder item={item} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                <tr>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-3 py-2">Contains</th>
                  <th className="px-3 py-2 text-right">= Base units</th>
                  <th className="px-3 py-2">Barcode</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">MRP</th>
                  <th className="px-3 py-2 text-right">Selling</th>
                  <th className="px-4 py-2 text-right">In stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {ladder.map((l) => (
                  <tr key={l.id} className={cn(l.isDefaultSale && "bg-brand-light/30")}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-apptext-primary">1 {l.name}</span>
                      <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                        {l.isBase && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Base</Badge>}
                        {l.isDefaultSale && <Badge className="border-blue-200 bg-brand-light text-brand-primary">Default sale</Badge>}
                        {l.isDefaultPurchase && <Badge className="border-violet-200 bg-violet-50 text-violet-700">Purchase</Badge>}
                        {!l.sellable && <Badge className="border-slate-200 bg-slate-50 text-slate-500">Not sold</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-apptext-secondary">{l.childName ? qtyText(l.perChild, l.childName) : "Smallest unit"}</td>
                    <td className="px-3 py-2 text-right">{l.factor.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 font-mono text-xs text-apptext-secondary">{(l.isBase ? item.barcode : barcodes[l.name] ?? l.barcode) || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l.cost)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l.mrp)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-apptext-primary">{formatCurrency(l.price)}</td>
                    <td className="px-4 py-2 text-right">{availableIn(sellable, l).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
            <UnitConverter item={item} stockBase={sellable} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Quantity price tiers"
            description={`Quantities in ${plural(sale.name, 2).toLowerCase()}. Lines in other units count by their ${item.baseUnit.toLowerCase()} equivalent.`}
          />
          {tiers.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-apptext-secondary">
              No tiers. Every order pays {formatCurrency(sale.price)} per {sale.name.toLowerCase()}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="px-4 py-2">Order quantity</th>
                    <th className="px-3 py-2 text-right">Price / {sale.name.toLowerCase()}</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {tiers.map((t) => {
                    const m = t.unitPrice > 0 ? ((t.unitPrice - packCost) / t.unitPrice) * 100 : null;
                    return (
                      <tr key={t.minQuantity}>
                        <td className="px-4 py-2 font-medium text-apptext-primary">
                          {t.maxQuantity === null ? `${t.minQuantity}+` : `${t.minQuantity}–${t.maxQuantity}`}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(t.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{t.discountPct}%</td>
                        <td className={cn("px-4 py-2 text-right font-medium", marginTone(m))}>{fmtPct(m)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Images" />
          <div className="p-4">
            {item.imageUrls?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {item.imageUrls.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URLs
                  <img key={src} src={src} alt={`${item.name} image ${i + 1}`} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ProductThumb item={item} size="lg" />
                <p className="text-sm text-apptext-secondary">No images yet. Add them from the edit form.</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pricing" description={`Per ${item.baseUnit.toLowerCase()}`} />
          <div className="px-4 pb-2 sm:px-5">
            <KeyValues
              rows={[
                ["Purchase cost", formatCurrency(item.costPrice)],
                ["Selling price", formatCurrency(item.sellingPrice)],
                ["MRP", formatCurrency(item.mrp)],
                ["Margin", <span key="m" className={marginTone(marginPct(item.costPrice, item.sellingPrice))}>{fmtPct(marginPct(item.costPrice, item.sellingPrice))}</span>],
                ["VAT", `${item.vatPct ?? 0}%`],
                ["Max discount", `${item.maxDiscountPct ?? 0}%`],
                ["Minimum order", `${item.minOrderQty ?? 1} ${plural(sale.name, item.minOrderQty ?? 1).toLowerCase()}`],
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Inventory settings" />
          <div className="px-4 pb-2 sm:px-5">
            <KeyValues
              rows={[
                ["Reorder level", formatPacks(item.reorderLevel, item)],
                ["Minimum stock", item.minStockLevel !== undefined ? formatPacks(item.minStockLevel, item) : "—"],
                ["Maximum stock", item.maxStockLevel !== undefined ? formatPacks(item.maxStockLevel, item) : "—"],
                ["Avg. daily sales", `${item.avgDailySales.toLocaleString("en-US")} ${plural(item.baseUnit, item.avgDailySales).toLowerCase()}`],
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Visible to" description={`${visible.length} of ${ALL_CUSTOMER_TYPES.length} customer types`} />
          <div className="flex flex-wrap gap-1.5 p-4">
            {ALL_CUSTOMER_TYPES.map((t) => (
              <Badge
                key={t}
                className={visible.includes(t) ? "border-brand-primary/30 bg-brand-light/50 text-brand-primary" : "border-slate-200 bg-white text-slate-400 line-through"}
              >
                {CUSTOMER_TYPE_LABELS[t]}
              </Badge>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Price history" />
          {history.length === 0 ? (
            <p className="px-5 py-4 text-sm text-apptext-secondary">
              No changes recorded{item.createdAt ? ` since ${formatDay(item.createdAt)}` : ""}.
            </p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.at} className="px-4 py-2.5 text-sm sm:px-5">
                  <div className="flex justify-between gap-2">
                    <span className="tabular-nums text-apptext-secondary">{formatDateTime(h.at)}</span>
                    <span className="font-medium tabular-nums text-apptext-primary">{formatCurrency(h.sellingPrice)}</span>
                  </div>
                  <p className="text-xs text-apptext-secondary">
                    Cost {formatCurrency(h.costPrice)} · MRP {formatCurrency(h.mrp)} · {h.by}
                  </p>
                  <p className="text-xs text-slate-400">{h.note}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock & batches                                                     */
/* ------------------------------------------------------------------ */

function StockTab({
  item,
  batches,
  warehouseById,
}: {
  item: ReturnType<typeof useCatalog>["products"][number];
  batches: ReturnType<typeof useInventory>["batches"];
  warehouseById: ReturnType<typeof useInventory>["warehouseById"];
}) {
  const live = batches.filter((b) => b.availableQuantity > 0);
  const groups = Object.entries(
    live.reduce<Record<string, typeof live>>((acc, b) => {
      (acc[b.warehouseId] ||= []).push(b);
      return acc;
    }, {})
  );
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Boxes}
          title="No stock on hand"
          description="Receive a purchase or record opening stock to create the first batch."
          action={
            <Link href="/purchases" className={btn.secondary}>
              Go to purchases
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map(([whId, list]) => {
        const s = computeItemStock(item, list);
        return (
          <Card key={whId} className="overflow-hidden">
            <CardHeader
              title={warehouseById[whId]?.name ?? whId}
              description={`${formatPacks(s.sellable, item)} sellable · ${list.length} ${plural("batch", list.length)} · ${formatCurrency(round2(s.value))}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface text-xs font-medium text-apptext-secondary">
                  <tr>
                    <th className="px-4 py-2">Batch (FEFO order)</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Mfg</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                    <th className="px-4 py-2">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((b) => {
                    const st = batchState(b);
                    return (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-semibold text-apptext-primary">{b.batchNumber}</span>
                          {b.purchaseRef && <span className="block text-xs text-slate-400">{b.purchaseRef}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-apptext-secondary">{b.location}</td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-apptext-secondary">{formatDay(b.manufacturingDate)}</td>
                        <td className="px-3 py-2.5">
                          <ExpiryBadge date={b.expiryDate} showDate />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="font-medium text-apptext-primary">{b.availableQuantity.toLocaleString("en-US")}</span>
                          <span className="block text-xs text-slate-500">{formatPacks(b.availableQuantity, item)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-apptext-secondary">{formatCurrency(b.unitCost)}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={BATCH_STATE_META[st].badge}>{BATCH_STATE_META[st].label}</Badge>
                          {b.holdReason && <span className="mt-0.5 block max-w-[12rem] truncate text-xs text-violet-700">{b.holdReason}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

type SaleRow = {
  key: string;
  order: ReturnType<typeof useAppStore>["orders"][number];
  unit: string;
  packs: number;
  units: number;
  revenue: number;
  cogs: number;
};

function SalesTab({
  sales,
  item,
  totals,
}: {
  sales: SaleRow[];
  item: ReturnType<typeof useCatalog>["products"][number];
  totals: { units: number; revenue: number; cogs: number; packs: number };
}) {
  const months = useMemo(() => {
    const end = new Date(`${DEMO_TODAY}T00:00:00Z`);
    const list: { key: string; label: string; revenue: number; packs: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
      list.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
        revenue: 0,
        packs: 0,
      });
    }
    for (const s of sales) {
      const m = list.find((x) => x.key === s.order.createdAt.slice(0, 7));
      if (m) {
        m.revenue = round2(m.revenue + s.revenue);
        m.packs = round2(m.packs + s.units / defaultSaleLevel(item).factor);
      }
    }
    return list;
  }, [sales, item]);

  if (sales.length === 0) {
    return (
      <Card>
        <EmptyState icon={ShoppingCart} title="No sales yet" description="Orders that include this product will appear here." />
      </Card>
    );
  }

  const gm = totals.revenue > 0 ? ((totals.revenue - totals.cogs) / totals.revenue) * 100 : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Revenue by month"
          description={`Last 6 months · ${formatCurrency(round2(totals.revenue))} total · gross margin ${fmtPct(gm)}`}
        />
        <div className="h-56 px-2 py-3 sm:px-4" role="img" aria-label={`Monthly revenue: ${months.map((m) => `${m.label} ${formatCurrency(m.revenue)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="0" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#CBD5E1" }} tick={{ fill: "#64748B", fontSize: 12 }} />
              <YAxis
                width={56}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 12 }}
                tickFormatter={(v: number) => (v >= 1000 ? `৳${Math.round(v / 1000)}k` : `৳${v}`)}
              />
              <Tooltip
                cursor={{ fill: "#F1F5F9" }}
                formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                labelStyle={{ color: "#172B4D", fontWeight: 600 }}
                contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0", fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#073783" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Orders with this product" description={`${formatQty(totals.units, item, "sale")} delivered or open`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface text-xs font-medium text-apptext-secondary">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">{plural(item.baseUnit, 2)}</th>
                <th className="px-4 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => {
                const meta = ORDER_STATUS_META[s.order.orderStatus];
                return (
                  <tr key={s.key} className={cn(s.packs === 0 && "text-slate-400")}>
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${s.order.id}`} className="font-mono text-xs font-semibold text-brand-blue hover:underline">
                        {s.order.orderNumber}
                      </Link>
                      <span className="block text-xs tabular-nums text-apptext-secondary">{formatDay(s.order.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-apptext-primary">{s.order.customerName}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={meta.badge}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {s.packs.toLocaleString("en-US")} <span className="text-xs text-apptext-secondary">{plural(s.unit, s.packs).toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.units.toLocaleString("en-US")}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-apptext-primary">{formatCurrency(s.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
