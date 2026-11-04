"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PackageX } from "lucide-react";
import { Card, EmptyState, btn } from "@/components/ui";
import { ProductForm } from "@/components/catalog/ProductForm";
import { useCatalog } from "@/components/catalog/CatalogProvider";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { productById } = useCatalog();
  const item = productById[id];

  if (!item) {
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
  return <ProductForm key={item.id} item={item} />;
}
