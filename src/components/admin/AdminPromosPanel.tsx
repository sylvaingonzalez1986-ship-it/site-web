"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import { categoryLabels, type Product, type ProductCategory } from "@/data/products";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { CmsStore } from "@/types/store";

const productCategoryOptions = Object.keys(categoryLabels) as ProductCategory[];

type AdminPromosPanelProps = {
  draft: CmsStore;
  setDraft: Dispatch<SetStateAction<CmsStore>>;
};

type NewPackDraft = {
  name: string;
  description: string;
  category: ProductCategory;
  price: string;
  images: string[];
  productIds: string[];
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function buildValidPackProductIds(
  value: string[] | undefined,
  currentProductId: string,
  products: Product[],
): string[] {
  const nonPackIds = new Set(products.filter((product) => !product.isPack).map((product) => product.id));
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const id of value ?? []) {
    const safeId = id.trim();
    if (!safeId || safeId === currentProductId || seen.has(safeId) || !nonPackIds.has(safeId)) {
      continue;
    }
    seen.add(safeId);
    uniqueIds.push(safeId);
  }

  return uniqueIds;
}

function recalculatePackProduct(product: Product, products: Product[]): Product | null {
  const validPackProductIds = buildValidPackProductIds(product.packProductIds, product.id, products);
  if (validPackProductIds.length === 0) {
    return null;
  }

  const productsById = new Map(
    products.filter((candidate) => !candidate.isPack).map((candidate) => [candidate.id, candidate]),
  );
  const originalPrice = roundMoney(
    validPackProductIds.reduce((total, id) => total + (productsById.get(id)?.price ?? 0), 0),
  );
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    return null;
  }

  const packPrice =
    Number.isFinite(product.price) && product.price > 0 ? roundMoney(product.price) : originalPrice;
  const promoPercent = Math.round((1 - packPrice / originalPrice) * 100);
  const hasPromo =
    Number.isFinite(promoPercent) &&
    promoPercent > 0 &&
    promoPercent <= 99 &&
    originalPrice > packPrice;

  return {
    ...product,
    price: packPrice,
    originalPrice: hasPromo ? originalPrice : undefined,
    promoPercent: hasPromo ? promoPercent : undefined,
    isPack: true,
    packProductIds: validPackProductIds,
  };
}

function createInitialPackDraft(): NewPackDraft {
  return {
    name: "Nouveau pack promo",
    description: "Pack promotionnel compose de plusieurs produits.",
    category: "fleurs",
    price: "",
    images: ["/product_flower.jpg"],
    productIds: [],
  };
}

export function AdminPromosPanel({ draft, setDraft }: AdminPromosPanelProps) {
  const [productSearch, setProductSearch] = useState("");
  const [promoInputs, setPromoInputs] = useState<Record<string, string>>({});
  const [packForm, setPackForm] = useState<NewPackDraft>(createInitialPackDraft());
  const [packError, setPackError] = useState<string | null>(null);

  const productsWithIndex = useMemo(
    () => draft.products.map((product, index) => ({ product, index })),
    [draft.products],
  );

  const standardProductsWithIndex = useMemo(
    () => productsWithIndex.filter(({ product }) => !product.isPack),
    [productsWithIndex],
  );

  const filteredStandardProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    if (!search) {
      return standardProductsWithIndex;
    }

    return standardProductsWithIndex.filter(({ product }) =>
      product.name.toLowerCase().includes(search),
    );
  }, [productSearch, standardProductsWithIndex]);

  const packProductsWithIndex = useMemo(
    () => productsWithIndex.filter(({ product }) => product.isPack),
    [productsWithIndex],
  );

  const promoCount = useMemo(
    () => draft.products.filter((product) => hasActiveProductPromo(product)).length,
    [draft.products],
  );

  const nonPackProducts = useMemo(
    () => draft.products.filter((product) => !product.isPack),
    [draft.products],
  );

  const nonPackProductsById = useMemo(
    () => new Map(nonPackProducts.map((product) => [product.id, product])),
    [nonPackProducts],
  );

  const selectedPackProducts = useMemo(
    () =>
      packForm.productIds
        .map((id) => nonPackProductsById.get(id))
        .filter((product): product is Product => Boolean(product)),
    [nonPackProductsById, packForm.productIds],
  );

  const newPackOriginalPrice = useMemo(
    () => roundMoney(selectedPackProducts.reduce((total, product) => total + product.price, 0)),
    [selectedPackProducts],
  );

  const parsedPackPrice = Number(packForm.price);
  const newPackDiscountPercent = useMemo(() => {
    if (!Number.isFinite(parsedPackPrice) || parsedPackPrice <= 0 || newPackOriginalPrice <= 0) {
      return 0;
    }
    return Math.round((1 - parsedPackPrice / newPackOriginalPrice) * 100);
  }, [newPackOriginalPrice, parsedPackPrice]);

  const setPromoInput = (productId: string, value: string) => {
    setPromoInputs((current) => ({ ...current, [productId]: value }));
  };

  const applyPromo = (index: number, productId: string) => {
    const rawValue = promoInputs[productId] ?? "10";
    const promoPercent = Number(rawValue);
    if (!Number.isInteger(promoPercent) || promoPercent < 1 || promoPercent > 99) {
      setPackError("Le pourcentage promo doit etre un entier entre 1 et 99.");
      return;
    }

    setPackError(null);
    setDraft((current) => {
      const nextProducts = [...current.products];
      const target = nextProducts[index];
      if (!target || target.isPack) {
        return current;
      }

      const safeOriginalPrice =
        hasActiveProductPromo(target) && target.originalPrice
          ? target.originalPrice
          : target.price;
      const discountedPrice = roundMoney(
        Math.max(0.01, safeOriginalPrice * (1 - promoPercent / 100)),
      );

      nextProducts[index] = {
        ...target,
        originalPrice: roundMoney(safeOriginalPrice),
        promoPercent,
        price: discountedPrice,
      };

      return { ...current, products: nextProducts };
    });
  };

  const removePromo = (index: number) => {
    setPackError(null);
    setDraft((current) => {
      const nextProducts = [...current.products];
      const target = nextProducts[index];
      if (!target || target.isPack) {
        return current;
      }

      nextProducts[index] = {
        ...target,
        price: target.originalPrice && target.originalPrice > 0 ? target.originalPrice : target.price,
        originalPrice: undefined,
        promoPercent: undefined,
      };

      return { ...current, products: nextProducts };
    });
  };

  const createPack = () => {
    const name = packForm.name.trim();
    const price = Number(packForm.price);
    const validComponentIds = buildValidPackProductIds(packForm.productIds, "", nonPackProducts);

    if (!name) {
      setPackError("Le nom du pack est obligatoire.");
      return;
    }
    if (validComponentIds.length === 0) {
      setPackError("Sélectionne au moins un produit pour le pack.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setPackError("Le prix du pack est invalide.");
      return;
    }
    if (newPackOriginalPrice <= 0) {
      setPackError("Impossible de calculer le prix d'origine du pack.");
      return;
    }
    if (price >= newPackOriginalPrice) {
      setPackError("Le prix du pack doit etre inferieur au prix d'origine.");
      return;
    }

    setPackError(null);
    setDraft((current) => {
      const id = `pack-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const safeImages = packForm.images.length > 0 ? packForm.images : ["/product_flower.jpg"];

      const packProduct: Product = {
        id,
        name,
        category: packForm.category,
        description: packForm.description.trim() || "Pack promotionnel.",
        image: safeImages[0],
        images: safeImages,
        price: roundMoney(price),
        isPack: true,
        packProductIds: validComponentIds,
        originalPrice: newPackOriginalPrice,
        promoPercent: newPackDiscountPercent > 0 ? newPackDiscountPercent : undefined,
        badge: "Pack promo",
      };

      const recalculated = recalculatePackProduct(packProduct, current.products);
      if (!recalculated) {
        return current;
      }

      return {
        ...current,
        products: [...current.products, recalculated],
      };
    });

    setPackForm(createInitialPackDraft());
  };

  const updatePackPrice = (index: number, nextPrice: number) => {
    setDraft((current) => {
      const nextProducts = [...current.products];
      const currentPack = nextProducts[index];
      if (!currentPack || !currentPack.isPack) {
        return current;
      }

      const recalculated = recalculatePackProduct(
        {
          ...currentPack,
          price: Number.isFinite(nextPrice) && nextPrice > 0 ? roundMoney(nextPrice) : currentPack.price,
        },
        current.products,
      );

      if (!recalculated) {
        nextProducts.splice(index, 1);
      } else {
        nextProducts[index] = recalculated;
      }

      return { ...current, products: nextProducts };
    });
  };

  const togglePackComponent = (index: number, componentId: string) => {
    setDraft((current) => {
      const nextProducts = [...current.products];
      const currentPack = nextProducts[index];
      if (!currentPack || !currentPack.isPack) {
        return current;
      }

      const currentIds = new Set(currentPack.packProductIds ?? []);
      if (currentIds.has(componentId)) {
        currentIds.delete(componentId);
      } else {
        currentIds.add(componentId);
      }

      const recalculated = recalculatePackProduct(
        {
          ...currentPack,
          packProductIds: Array.from(currentIds),
        },
        current.products,
      );

      if (!recalculated) {
        nextProducts.splice(index, 1);
      } else {
        nextProducts[index] = recalculated;
      }

      return { ...current, products: nextProducts };
    });
  };

  const removePack = (index: number) => {
    setDraft((current) => ({
      ...current,
      products: current.products.filter((_, productIndex) => productIndex !== index),
    }));
  };

  return (
    <div className="grid gap-8">
      <div className="cartoon-border bg-cream p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-3xl">Promotions produits</h2>
          <span className="pill-cartoon px-3 py-1 text-xs uppercase tracking-[0.1em]">
            {promoCount} en promo
          </span>
        </div>

        <div className="mt-4">
          <input
            className="h-10 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm md:max-w-md"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Rechercher un produit..."
          />
        </div>

        <div className="mt-6 grid gap-4">
          {filteredStandardProducts.length === 0 && (
            <p className="text-charcoal">Aucun produit correspondant.</p>
          )}
          {filteredStandardProducts.map(({ product, index }) => (
            <article key={`${product.id}-${index}`} className="card-cartoon bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-center">
                <div>
                  <p className="font-display text-2xl text-ink">{product.name}</p>
                  <p className="text-sm text-charcoal">{categoryLabels[product.category]}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {hasActiveProductPromo(product) ? (
                      <>
                        <span className="price-original text-sm">{formatPrice(product.originalPrice)}</span>
                        <span className="price-promo text-lg">{formatPrice(product.price)}</span>
                        <span className="pill-cartoon bg-orange px-2 py-1 text-[10px] text-white">
                          Moins {product.promoPercent}%
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-ink">{formatPrice(product.price)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveProductPromo(product) ? (
                    <button
                      type="button"
                      className="btn-cartoon btn-primary h-10 px-3 text-xs"
                      onClick={() => removePromo(index)}
                    >
                      Retirer la promo
                    </button>
                  ) : (
                    <>
                      <input
                        className="h-10 w-24 border-2 border-[#1a1a1a] px-2 text-sm"
                        type="number"
                        min={1}
                        max={99}
                        value={promoInputs[product.id] ?? ""}
                        onChange={(event) => setPromoInput(product.id, event.target.value)}
                        placeholder="%"
                      />
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                        onClick={() => applyPromo(index, product.id)}
                      >
                        Appliquer
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="cartoon-border bg-cream p-6 md:p-8">
        <h2 className="font-display text-3xl">Packs promotionnels</h2>

        <div className="mt-5 card-cartoon bg-white p-4">
          <h3 className="font-display text-2xl text-ink">Creer un pack</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
              value={packForm.name}
              onChange={(event) => setPackForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nom du pack"
            />
            <select
              className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
              value={packForm.category}
              onChange={(event) =>
                setPackForm((current) => ({
                  ...current,
                  category: event.target.value as ProductCategory,
                }))
              }
            >
              {productCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
            value={packForm.description}
            onChange={(event) =>
              setPackForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Description du pack"
          />
          <div className="mt-3">
            <ProductImageUpload
              images={packForm.images}
              onChange={(nextImages) =>
                setPackForm((current) => ({ ...current, images: nextImages }))
              }
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
                Produits dans le pack
              </p>
              <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1">
                {nonPackProducts.map((product) => {
                  const checked = packForm.productIds.includes(product.id);
                  return (
                    <label key={product.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPackForm((current) => ({
                            ...current,
                            productIds: checked
                              ? current.productIds.filter((id) => id !== product.id)
                              : [...current.productIds, product.id],
                          }))
                        }
                      />
                      <span className="min-w-0 truncate">{product.name}</span>
                      <span className="ml-auto text-xs text-charcoal">{formatPrice(product.price)}</span>
                      <span className="text-[10px] font-semibold text-charcoal">TVA {product.vatRate ?? 20}%</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
                Prix du pack
              </p>
              <p className="mt-2 text-sm text-charcoal">
                Prix d'origine: <strong>{formatPrice(newPackOriginalPrice)}</strong>
              </p>
              <input
                className="mt-2 h-10 w-full border-2 border-[#1a1a1a] bg-white px-2 text-sm"
                type="number"
                min={0.01}
                step="0.01"
                value={packForm.price}
                onChange={(event) =>
                  setPackForm((current) => ({ ...current, price: event.target.value }))
                }
                placeholder="Prix promo du pack"
              />
              <p className="mt-2 text-sm text-charcoal">
                Reduction calculee:{" "}
                <strong className={newPackDiscountPercent > 0 ? "price-promo" : "text-ink"}>
                  {newPackDiscountPercent > 0 ? `${newPackDiscountPercent}%` : "0%"}
                </strong>
              </p>
              <button
                type="button"
                className="btn-cartoon btn-secondary mt-3 h-10 px-3 text-xs"
                onClick={createPack}
              >
                Creer le pack
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {packProductsWithIndex.length === 0 && (
            <p className="text-charcoal">Aucun pack promotionnel pour le moment.</p>
          )}

          {packProductsWithIndex.map(({ product, index }) => (
            <article key={`${product.id}-${index}`} className="card-cartoon bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-ink">{product.name}</p>
                  <p className="text-sm text-charcoal">
                    {hasActiveProductPromo(product)
                      ? `${formatPrice(product.price)} au lieu de ${formatPrice(product.originalPrice)}`
                      : formatPrice(product.price)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-10 px-3 text-xs"
                  onClick={() => removePack(index)}
                >
                  Supprimer le pack
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
                    Prix pack
                  </p>
                  <input
                    className="mt-1 h-10 w-full border-2 border-[#1a1a1a] px-2 text-sm"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={product.price}
                    onChange={(event) => updatePackPrice(index, Number(event.target.value))}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
                    Produits composants
                  </p>
                  <div className="mt-1 grid max-h-44 gap-2 overflow-y-auto rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-2">
                    {nonPackProducts.map((candidate) => {
                      const checked = (product.packProductIds ?? []).includes(candidate.id);
                      return (
                        <label key={`${product.id}-${candidate.id}`} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePackComponent(index, candidate.id)}
                          />
                          <span className="min-w-0 truncate">{candidate.name}</span>
                          <span className="ml-auto text-xs text-charcoal">
                            {formatPrice(candidate.price)}
                          </span>
                          <span className="text-[10px] font-semibold text-charcoal">TVA {candidate.vatRate ?? 20}%</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {packError && <p className="mt-4 text-sm font-semibold text-red-700">{packError}</p>}
      </div>
    </div>
  );
}
