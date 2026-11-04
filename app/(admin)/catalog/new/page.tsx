"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductForm } from "@/components/catalog/ProductForm";
import { useCatalog } from "@/components/catalog/CatalogProvider";

function NewProduct() {
  const params = useSearchParams();
  const { productById } = useCatalog();
  const source = params.get("duplicate");
  const duplicateOf = source ? productById[source] : undefined;
  // Keyed so switching between "new" and "duplicate" resets the form.
  return <ProductForm key={duplicateOf?.id ?? "new"} duplicateOf={duplicateOf} />;
}

export default function NewProductPage() {
  return (
    <Suspense fallback={null}>
      <NewProduct />
    </Suspense>
  );
}
