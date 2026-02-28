"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { getSelectableVariantOptions, isProductInStock } from "@/lib/product-stock";
import type { Product } from "@/data/products";

type ProductDetailActionsProps = {
  product: Product;
};

export function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  const selectableVariants = getSelectableVariantOptions(product);
  const hasVariants = selectableVariants.length > 0;
  const selectedVariant =
    selectableVariants.find((v) => v.id === selectedVariantId) ??
    selectableVariants[0];
  const inStock = isProductInStock(product);

  const handleAddToCart = () => {
    if (authLoading || !inStock) return;

    const added = addToCart(product, selectedVariant?.id, qty);
    if (added) {
      setQty(1);
      return;
    }

    const nextPath =
      typeof window === "undefined"
        ? "/boutique"
        : `${window.location.pathname}${window.location.search}`;
    router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  };

  return (
    <div className="mt-6 space-y-4">
      {hasVariants && (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-charcoal">
            {product.variantLabel?.trim() || "Taille"}
          </label>
          <select
            className="h-10 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm"
            value={selectedVariant?.id ?? ""}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setQty(1);
            }}
          >
            {selectableVariants.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.price.toFixed(2)} €
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {inStock && <QuantitySelector value={qty} onChange={setQty} />}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={authLoading || !inStock}
          className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center gap-2 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} /> {inStock ? "Ajouter au panier" : "Rupture de stock"}
        </button>
      </div>
    </div>
  );
}
