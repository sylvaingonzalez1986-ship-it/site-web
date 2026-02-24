"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PrintfulAdminSnapshot,
  PrintfulSyncedProduct,
  PrintfulSyncedVariant,
} from "@/types/printful";

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "-";
  }
  return new Date(timestamp).toLocaleString("fr-FR");
}

function getActiveVariants(variants: PrintfulSyncedVariant[]): PrintfulSyncedVariant[] {
  return variants.filter((variant) => variant.isEnabled && variant.isInStock && variant.retailPrice > 0);
}

function getPriceRange(product: PrintfulSyncedProduct): {
  min: number;
  max: number;
  currency: string;
} | null {
  const active = getActiveVariants(product.variants);
  if (active.length === 0) {
    return null;
  }

  let min = active[0].retailPrice;
  let max = active[0].retailPrice;
  for (const variant of active) {
    if (variant.retailPrice < min) {
      min = variant.retailPrice;
    }
    if (variant.retailPrice > max) {
      max = variant.retailPrice;
    }
  }

  return {
    min,
    max,
    currency: active[0].currency || "EUR",
  };
}

export function AdminPrintfulPanel() {
  const [snapshot, setSnapshot] = useState<PrintfulAdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busySyncProductId, setBusySyncProductId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);
  const [status, setStatus] = useState("Chargement Printful...");

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/printful", { cache: "no-store" });
      const data = (await response.json()) as PrintfulAdminSnapshot & { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Chargement Printful impossible.");
        return;
      }
      setSnapshot(data);
      setStatus("Printful chargé.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur chargement Printful.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const filteredProducts = useMemo(() => {
    const list = snapshot?.products ?? [];
    const query = search.trim().toLowerCase();

    return list.filter((product) => {
      if (showPublishedOnly && !product.isPublished) {
        return false;
      }
      if (!query) {
        return true;
      }

      const variantText = product.variants
        .map((variant) => `${variant.variantName} ${variant.sku ?? ""} ${variant.syncVariantId}`)
        .join(" ");

      const haystack = [product.productName, product.syncProductId.toString(), variantText]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, showPublishedOnly, snapshot]);

  const stats = useMemo(() => {
    const products = snapshot?.products ?? [];
    const published = products.filter((product) => product.isPublished).length;
    const totalVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
    return {
      products: products.length,
      published,
      totalVariants,
    };
  }, [snapshot]);

  const runSync = async () => {
    setSyncing(true);
    setStatus("Synchronisation Printful en cours...");
    try {
      const response = await fetch("/api/admin/printful", { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        summary?: { productsCount: number; variantsCount: number };
        snapshot?: PrintfulAdminSnapshot;
      };

      if (!response.ok || !data.snapshot) {
        setStatus(data.error ?? "Synchronisation Printful impossible.");
        return;
      }

      setSnapshot(data.snapshot);
      if (data.summary) {
        setStatus(
          `Synchronisation OK: ${data.summary.productsCount} produits, ${data.summary.variantsCount} variantes.`,
        );
      } else {
        setStatus("Synchronisation Printful terminée.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Synchronisation Printful impossible.");
    } finally {
      setSyncing(false);
    }
  };

  const togglePublish = async (product: PrintfulSyncedProduct) => {
    setBusySyncProductId(product.syncProductId);
    setStatus(
      product.isPublished
        ? `Retrait ${product.productName}...`
        : `Publication ${product.productName}...`,
    );

    try {
      const response = await fetch(
        `/api/admin/printful/products/${encodeURIComponent(String(product.syncProductId))}`,
        { method: product.isPublished ? "DELETE" : "PUT" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Action Printful impossible.");
        return;
      }

      await loadSnapshot();
      setStatus(
        product.isPublished
          ? "Produit retiré de la boutique."
          : "Produit publié dans Accessoires avec choix de taille.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action Printful impossible.");
    } finally {
      setBusySyncProductId(null);
    }
  };

  return (
    <div className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Printful POD (Accessoires)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={() => void loadSnapshot()}
            disabled={loading}
          >
            Rafraîchir
          </button>
          <button
            type="button"
            className="btn-cartoon btn-primary"
            onClick={() => void runSync()}
            disabled={syncing}
          >
            {syncing ? "Sync..." : "Synchroniser Printful"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-charcoal">{status}</p>
      <p className="mt-1 text-xs text-charcoal">
        Les produits Printful publiés sont conservés lors de la sauvegarde CMS globale.
      </p>

      {!loading && snapshot && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="pill-cartoon px-3 py-2 text-xs">
              Token configuré: {snapshot.tokenConfigured ? "Oui" : "Non"}
            </div>
            <div className="pill-cartoon px-3 py-2 text-xs">
              Store ID configuré: {snapshot.storeIdConfigured ? "Oui" : "Non"}
            </div>
            <div className="pill-cartoon px-3 py-2 text-xs">Produits: {stats.products}</div>
            <div className="pill-cartoon px-3 py-2 text-xs">En boutique: {stats.published}</div>
            <div className="pill-cartoon px-3 py-2 text-xs">
              Dernière sync: {formatDate(snapshot.state.lastSyncAt)}
            </div>
          </div>

          {!snapshot.tokenConfigured && (
            <p className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fff1cf] p-3 text-sm text-ink">
              Ajoute <code>PRINTFUL_TOKEN</code> dans le fichier <code>.env</code> puis redémarre
              le serveur.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              className="h-10 min-w-[240px] flex-1 border-2 border-[#1a1a1a] px-2 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher (nom produit, ID produit, taille, SKU)"
            />
            <label className="flex h-10 items-center gap-2 border-2 border-[#1a1a1a] px-3 text-sm">
              <input
                type="checkbox"
                checked={showPublishedOnly}
                onChange={(event) => setShowPublishedOnly(event.target.checked)}
              />
              Publiés uniquement
            </label>
          </div>

          <div className="mt-5 grid gap-3">
            {filteredProducts.length === 0 && (
              <p className="text-sm text-charcoal">Aucun produit Printful.</p>
            )}

            {filteredProducts.map((product) => {
              const activeVariants = getActiveVariants(product.variants);
              const priceRange = getPriceRange(product);
              const canPublish = activeVariants.length > 0;

              return (
                <article key={product.syncProductId} className="card-cartoon bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[72px_1fr_auto] md:items-center">
                    <div className="h-[72px] w-[72px] overflow-hidden rounded border-2 border-[#1a1a1a] bg-[#f6f6f6]">
                      <img
                        src={product.thumbnailUrl || "/product_flower.jpg"}
                        alt={product.productName}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div>
                      <p className="font-semibold text-ink">{product.productName}</p>
                      <p className="mt-1 text-xs text-charcoal">
                        ID produit Printful: {product.syncProductId}
                      </p>
                      <p className="mt-1 text-xs text-charcoal">
                        {product.variants.length} variante(s), dont {activeVariants.length} active(s)/en
                        stock
                      </p>
                      <p className="mt-1 text-xs text-charcoal">
                        {priceRange
                          ? priceRange.min === priceRange.max
                            ? `Prix: ${formatMoney(priceRange.min, priceRange.currency)}`
                            : `Prix: ${formatMoney(priceRange.min, priceRange.currency)} - ${formatMoney(priceRange.max, priceRange.currency)}`
                          : "Prix indisponible (aucune variante active)."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {product.variants.map((variant) => (
                          <span
                            key={variant.syncVariantId}
                            className={`pill-cartoon px-2 py-1 text-[10px] ${
                              variant.isEnabled && variant.isInStock
                                ? "bg-[#f0fff7]"
                                : "bg-[#f4f1eb] text-charcoal"
                            }`}
                          >
                            {variant.variantName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span
                        className={`pill-cartoon px-3 py-1 text-xs ${
                          product.isPublished ? "bg-[#0a7b61] text-white" : ""
                        }`}
                      >
                        {product.isPublished ? "En boutique" : "Non publié"}
                      </span>
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-10"
                        onClick={() => void togglePublish(product)}
                        disabled={
                          busySyncProductId === product.syncProductId ||
                          (!canPublish && !product.isPublished)
                        }
                      >
                        {busySyncProductId === product.syncProductId
                          ? "..."
                          : product.isPublished
                            ? "Retirer"
                            : "Mettre en boutique"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

