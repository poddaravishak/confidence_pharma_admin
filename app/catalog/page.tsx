"use client";

import React, { useState } from "react";
import { mockProducts } from "@/lib/db/mock-data";
import { Product, PackSize, QuantityPricingTier } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { 
  Pill, 
  Plus, 
  Search, 
  Tag, 
  Layers, 
  CheckCircle2, 
  X, 
  Trash2,
  Check,
  AlertCircle
} from "lucide-react";

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for New Product
  const [newProdName, setNewProdName] = useState("");
  const [newGenericName, setNewGenericName] = useState("");
  const [newBrand, setNewBrand] = useState("Square Pharmaceuticals Ltd.");
  const [newCategory, setNewCategory] = useState("Allopathic");
  const [newMedicineType, setNewMedicineType] = useState("Tablet");
  const [newBaseUnit, setNewBaseUnit] = useState("Tablet");
  const [newMrp, setNewMrp] = useState<number>(5.0);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(3.5);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(4.2);
  const [newStockUnits, setNewStockUnits] = useState<number>(2000);
  const [newReorderLevel, setNewReorderLevel] = useState<number>(500);

  // Secondary Pack size
  const [packName, setPackName] = useState("1 Box (10 Strips / 100 Tabs)");
  const [packMultiplier, setPackMultiplier] = useState<number>(100);
  const [packPrice, setPackPrice] = useState<number>(420);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      selectedCategory === "ALL" || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newGenericName.trim()) return;

    const newProduct: Product = {
      id: `prod-${Date.now().toString().slice(-4)}`,
      nameEn: newProdName,
      nameBn: newProdName,
      genericName: newGenericName,
      brand: newBrand,
      category: newCategory,
      medicineType: newMedicineType,
      baseUnit: newBaseUnit,
      mrp: Number(newMrp),
      basePurchasePrice: Number(newPurchasePrice),
      baseSellingPrice: Number(newSellingPrice),
      maxDiscountPct: 10.0,
      minOrderQty: 1,
      isPrescriptionRequired: true,
      isColdChain: false,
      imageUrl: "/images/napa-extra.png",
      packSizes: [
        {
          id: `pack-${Date.now()}`,
          packNameEn: packName,
          packNameBn: packName,
          multiplierToBase: Number(packMultiplier),
          packMrp: Number(newMrp) * Number(packMultiplier),
          packSellingPrice: Number(packPrice),
          isDefault: true,
        },
      ],
      quantityPricingTiers: [
        { minQuantity: 1, maxQuantity: 9, unitPrice: Number(packPrice), discountPct: 0 },
        { minQuantity: 10, maxQuantity: 49, unitPrice: Math.round(Number(packPrice) * 0.95), discountPct: 5.0 },
        { minQuantity: 50, maxQuantity: null, unitPrice: Math.round(Number(packPrice) * 0.90), discountPct: 10.0 },
      ],
      totalStockUnits: Number(newStockUnits),
      reorderLevel: Number(newReorderLevel),
      isActive: true,
    };

    setProducts((prev) => [newProduct, ...prev]);
    setShowAddModal(false);
    setSuccessMessage(`Product "${newProdName}" added successfully to warehouse catalog!`);
    setTimeout(() => setSuccessMessage(null), 4000);

    // Reset Form
    setNewProdName("");
    setNewGenericName("");
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}" from the catalog?`)) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSuccessMessage(`Product "${name}" has been removed.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-primary sm:text-2xl text-balance">
            Product Catalog & Multi-Pack Pricing Tiers
          </h1>
          <p className="text-xs text-apptext-secondary text-pretty">
            Base units, pack conversions (Tablet $\leftrightarrow$ Strip $\leftrightarrow$ Box), and wholesale quantity discount tiers (SRS §6, §7 & §8)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition"
        >
          <Plus className="size-4 text-brand-light" />
          <span>Add New Medicine / Product</span>
        </button>
      </div>

      {/* Success Feedback Banner */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-brand-green">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-green" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-apptext-secondary" />
          <input
            type="text"
            placeholder="Filter by brand, medicine name, or generic formula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs text-apptext-primary focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          {["ALL", "Allopathic", "Surgical", "Diagnostic Reagents"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                selectedCategory === cat
                  ? "bg-brand-primary text-white shadow-xs"
                  : "border border-slate-200 bg-white text-apptext-secondary hover:bg-surface"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid / Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
                  <Pill className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-primary">
                    {product.nameEn}
                  </h3>
                  <p className="text-xs font-bold text-brand-blue">
                    {product.genericName}
                  </p>
                  <p className="text-[11px] text-apptext-secondary">{product.brand}</p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-brand-green">
                  <Tag className="size-3" />
                  Up to {product.maxDiscountPct}% Off
                </span>
                <button
                  onClick={() => handleDeleteProduct(product.id, product.nameEn)}
                  className="text-slate-400 hover:text-rose-600 transition p-1"
                  title="Delete product"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Pack Size Conversions */}
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-brand-primary uppercase">
                <Layers className="size-3.5 text-brand-blue" />
                <span>Pack Size Conversions & Wholesale Base</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {product.packSizes.map((pack) => (
                  <div
                    key={pack.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5"
                  >
                    <div>
                      <p className="font-bold text-apptext-primary">{pack.packNameEn}</p>
                      <p className="text-[10px] text-apptext-secondary tabular-nums">
                        {pack.multiplierToBase}x {product.baseUnit}s
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-primary font-mono tabular-nums">
                        {formatCurrency(pack.packSellingPrice)}
                      </p>
                      <p className="text-[10px] text-slate-400 line-through tabular-nums">
                        MRP {formatCurrency(pack.packMrp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quantity-Based Wholesale Pricing Tiers */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Quantity-Based Pricing Tiers (SRS §7)
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {product.quantityPricingTiers.map((tier, tIdx) => (
                  <div
                    key={tIdx}
                    className="rounded-xl border border-slate-200 p-2.5 text-center bg-white"
                  >
                    <span className="text-[10px] font-bold uppercase text-slate-400 tabular-nums">
                      {tier.maxQuantity
                        ? `${tier.minQuantity} – ${tier.maxQuantity} Qty`
                        : `${tier.minQuantity}+ Qty`}
                    </span>
                    <p className="text-sm font-black text-brand-primary font-mono tabular-nums mt-0.5">
                      {formatCurrency(tier.unitPrice)}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold ${
                        tier.discountPct > 0 ? "text-brand-green" : "text-slate-400"
                      }`}
                    >
                      {tier.discountPct > 0 ? `${tier.discountPct}% Discount` : "Standard Wholesale"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock Level Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-apptext-secondary">
                Warehouse Stock:{" "}
                <strong className="text-apptext-primary font-mono tabular-nums">
                  {product.totalStockUnits.toLocaleString()} {product.baseUnit}s
                </strong>
              </span>
              <span
                className={`font-bold ${
                  product.totalStockUnits <= product.reorderLevel
                    ? "text-rose-600"
                    : "text-brand-green"
                }`}
              >
                {product.totalStockUnits <= product.reorderLevel
                  ? "⚠ Low Stock (Reorder)"
                  : "✓ Adequate Stock"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ADD MEDICINE / PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-blue">
                  CATALOG INVENTORY REGISTRATION
                </span>
                <h3 className="text-base font-bold text-brand-primary">
                  Add New Medicine / Product
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Medicine / Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ciprocin 500mg"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Generic Formula *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ciprofloxacin USP"
                    value={newGenericName}
                    onChange={(e) => setNewGenericName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Brand / Pharmaceutical Manufacturer
                  </label>
                  <select
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary"
                  >
                    <option value="Square Pharmaceuticals Ltd.">Square Pharmaceuticals Ltd.</option>
                    <option value="Beximco Pharmaceuticals Ltd.">Beximco Pharmaceuticals Ltd.</option>
                    <option value="Incepta Pharmaceuticals Ltd.">Incepta Pharmaceuticals Ltd.</option>
                    <option value="Renata Limited">Renata Limited</option>
                    <option value="Healthcare Pharmaceuticals Ltd.">Healthcare Pharmaceuticals Ltd.</option>
                    <option value="Getwell Healthcare">Getwell Healthcare</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-apptext-primary"
                  >
                    <option value="Allopathic">Allopathic</option>
                    <option value="Surgical">Surgical</option>
                    <option value="Diagnostic Reagents">Diagnostic Reagents</option>
                    <option value="Healthcare Products">Healthcare Products</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Units */}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface p-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Unit</label>
                  <select
                    value={newBaseUnit}
                    onChange={(e) => setNewBaseUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Vial">Vial</option>
                    <option value="Box">Box</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Cost (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Selling Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Pack Size Converter */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <p className="font-bold text-brand-primary">Secondary Pack Configuration (Box / Strip)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pack Label</label>
                    <input
                      type="text"
                      value={packName}
                      onChange={(e) => setPackName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Units per Pack</label>
                    <input
                      type="number"
                      value={packMultiplier}
                      onChange={(e) => setPackMultiplier(parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pack Price (৳)</label>
                    <input
                      type="number"
                      value={packPrice}
                      onChange={(e) => setPackPrice(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Initial Warehouse Stock ({newBaseUnit}s)
                  </label>
                  <input
                    type="number"
                    value={newStockUnits}
                    onChange={(e) => setNewStockUnits(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-apptext-primary mb-1">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-white shadow-xs hover:bg-brand-hover"
                >
                  Save & Publish to B2B Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
