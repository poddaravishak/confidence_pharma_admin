import { InventoryNav, WarehouseSwitcher } from "@/components/inventory/shared";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-brand-primary">Inventory</h1>
            <p className="mt-1 text-sm text-apptext-secondary">
              Stock on hand, FEFO batches, adjustments, counts, reorders and warehouse transfers.
            </p>
          </div>
          <WarehouseSwitcher />
        </div>
        <InventoryNav />
        <div className="space-y-5">{children}</div>
      </div>
  );
}
