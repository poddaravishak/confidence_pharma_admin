"use client";

import React from "react";
import { InventoryProvider } from "@/components/inventory/InventoryProvider";
import { AppStoreProvider } from "@/lib/store/AppStore";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";

/**
 * Root client providers. Inventory sits outside the app store so orders and returns can move stock;
 * catalog master data (categories, brands, units) lives at the root so it survives navigation.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <AppStoreProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </AppStoreProvider>
    </InventoryProvider>
  );
}
