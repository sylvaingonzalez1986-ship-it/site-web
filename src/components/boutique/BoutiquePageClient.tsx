"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import {
  categoryLabels,
  isProductCultureModeEligible,
  PRODUCT_CULTURE_LABELS,
  type Product,
  type ProductCategory,
  type ProductCultureType,
} from "@/data/products";
import { resolveProductProducer } from "@/lib/own-producer";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { mergeUniqueProductsById } from "@/lib/boutique-helpers";
import { rotateProductsForDay } from "@/lib/product-rotation";
import type { BoutiqueSection, Producer, PublicStoreResponse } from "@/types/store";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import styles from "./BoutiquePageClient.module.css";

const RegionProducerShowcase = dynamic(
  () => import("@/components/boutique/RegionProducerShowcase").then((mod) => mod.RegionProducerShowcase),
  { ssr: false },
);

const ProducerTcgModal = dynamic(
  () => import("@/components/boutique/ProducerTcgModal").then((mod) => mod.ProducerTcgModal),
  { ssr: false },
);

type Filter = "all" | "promos" | ProductCategory;
type CultureFilter = "all" | ProductCultureType;
const CULTURE_FILTERS: CultureFilter[] = ["all", "outdoor", "greenhouse", "indoor"];
type ShowcaseMode = "products" | "neighbors" | "copains" | "regions";
const SHOWCASE_MODES: ShowcaseMode[] = ["products", "neighbors", "copains", "regions"];
const CATALOG_URL_EVENT = "shop:filters-changed";
function subscribeToCatalogUrl(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(CATALOG_URL_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CATALOG_URL_EVENT, notify);
  };
}
const readCatalogUrl = () => window.location.search;
const serverCatalogUrl = () => "";
function readCatalogFilters(search: string): { filter: Filter; cultureFilter: CultureFilter; showcaseMode: ShowcaseMode } {
  const params = new URLSearchParams(search);
  const requestedFilter = params.get("categorie") ?? "all";
  const requestedCulture = params.get("culture") as CultureFilter;
  const requestedMode = params.get("selection") as ShowcaseMode;
  return {
    filter: requestedFilter === "promos" || Object.hasOwn(categoryLabels, requestedFilter) ? requestedFilter as Filter : "all",
    cultureFilter: CULTURE_FILTERS.includes(requestedCulture) ? requestedCulture : "all",
    showcaseMode: SHOWCASE_MODES.includes(requestedMode) ? requestedMode : "products",
  };
}
function updateCatalogFilter(key: "selection" | "categorie" | "culture", value: string, defaultValue: string) {
  const url = new URL(window.location.href);
  if (value === defaultValue) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  if (url.href === window.location.href) return;
  // Native history is integrated with the Next router; keep unrelated query parameters.
  window.history.pushState(null, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(CATALOG_URL_EVENT));
}

type BoutiquePageClientProps = {
  rotationDay: number;
  boutique: PublicStoreResponse["content"]["boutique"];
  producers: Producer[];
  ownProducer: Producer;
  ownProducts: Product[];
  partnerProducts: Product[];
  voisinProducts: Product[];
  copainsProducts: Product[];
  globalAccessoriesProducts: Product[];
  boutiqueSections: BoutiqueSection[];
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
};

export function BoutiquePageClient({
  rotationDay,
  boutique,
  producers,
  ownProducer,
  ownProducts,
  partnerProducts,
  voisinProducts,
  copainsProducts,
  globalAccessoriesProducts,
  boutiqueSections,
  tastingSummariesByProductId,
}: BoutiquePageClientProps) {
  const loading = false;
  const search = useSyncExternalStore(subscribeToCatalogUrl, readCatalogUrl, serverCatalogUrl);
  const { filter, cultureFilter, showcaseMode } = readCatalogFilters(search);
  const setFilter = (value: Filter) => updateCatalogFilter("categorie", value, "all");
  const setCultureFilter = (value: CultureFilter) => updateCatalogFilter("culture", value, "all");
  const setShowcaseMode = (value: ShowcaseMode) => updateCatalogFilter("selection", value, "products");
  const [selectedOwnProducerId, setSelectedOwnProducerId] = useState<string | null>(null);

  const modeProducts = showcaseMode === "neighbors" ? voisinProducts : showcaseMode === "copains" ? copainsProducts : ownProducts;

  const availableFilters = useMemo(() => {
    const categoryOrder = Object.keys(categoryLabels) as ProductCategory[];
    const modeCategoryCounts = new Map<ProductCategory, number>();

    for (const product of modeProducts) {
      if (product.category === "accessoires") {
        continue;
      }
      modeCategoryCounts.set(product.category, (modeCategoryCounts.get(product.category) ?? 0) + 1);
    }

    const filters: Filter[] = [];
    const hasPromos = mergeUniqueProductsById([...modeProducts, ...globalAccessoriesProducts]).some((product) =>
      hasActiveProductPromo(product),
    );
    const hasModeProducts = modeProducts.length > 0;

    if (hasModeProducts) {
      filters.push("all");
    }

    if (hasPromos) {
      filters.push("promos");
    }

    for (const category of categoryOrder) {
      if (category === "accessoires") {
        continue;
      }
      if ((modeCategoryCounts.get(category) ?? 0) > 0) {
        filters.push(category);
      }
    }

    if (globalAccessoriesProducts.length > 0) {
      filters.push("accessoires");
    }

    return filters;
  }, [globalAccessoriesProducts, modeProducts]);

  const effectiveFilter: Filter = availableFilters.includes(filter) ? filter : "all";
  const showCultureFilter =
    effectiveFilter === "all" ||
    effectiveFilter === "promos" ||
    isProductCultureModeEligible(effectiveFilter);
  const effectiveCultureFilter = showCultureFilter ? cultureFilter : "all";

  const displayedProducts = useMemo(() => {
    let selection;
    if (effectiveFilter === "accessoires") {
      selection = globalAccessoriesProducts;
    } else if (effectiveFilter === "promos") {
      selection = mergeUniqueProductsById([...modeProducts, ...globalAccessoriesProducts]).filter(
        (product) => hasActiveProductPromo(product),
      );
    } else if (effectiveFilter === "all") {
      selection = modeProducts;
    } else {
      selection = modeProducts.filter((item) => item.category === effectiveFilter);
    }

    if (effectiveCultureFilter !== "all") {
      selection = selection.filter(
        (product) =>
          isProductCultureModeEligible(product.category) &&
          product.cultureMode === effectiveCultureFilter,
      );
    }

    // Rotate the selected list, so even a small category has its own full cycle.
    // Reopening a tab/filter reuses the server's day instead of drawing again.
    return rotateProductsForDay(
      selection,
      rotationDay,
      effectiveFilter === "accessoires" ? "boutique:accessoires" : `boutique:${showcaseMode}:${effectiveFilter}`,
      { ownProductsFirst: true },
    );
  }, [effectiveCultureFilter, effectiveFilter, globalAccessoriesProducts, modeProducts, rotationDay, showcaseMode]);

  const displayedOwnProducts = useMemo(
    () => displayedProducts.filter((product) => !product.producerId),
    [displayedProducts],
  );

  const producersById = useMemo(
    () => new Map(producers.map((producer) => [producer.id, producer])),
    [producers],
  );

  const ownProductsByProducerId = useMemo(
    () => new Map([[ownProducer.id, displayedOwnProducts]]),
    [displayedOwnProducts, ownProducer.id],
  );

  const renderBoutiqueSection = (section: BoutiqueSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-8";

    switch (section.type) {
      case "header":
        return (
          <header
            key={section.id}
            data-boutique-hero
            className={`${spacingClass} ${styles.hero}`}
          >
            <div className={styles.heroIntro}>
              <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}>{boutique.eyebrow || "La boutique"}</p>
                <h1 className={styles.heroTitle}>Chanvre <span>naturel</span></h1>
              </div>
              <div className={styles.heroCharacter}>
                <Image
                  src="/mascots/boutique-market.png"
                  alt="Charles présente la sélection de produits de la boutique"
                  width={1024}
                  height={1536}
                  sizes="(max-width: 639px) 100px, (max-width: 899px) 180px, 240px"
                  preload
                />
              </div>
              {boutique.description.trim() ? <p className={styles.heroDescription}>{boutique.description}</p> : null}
            </div>
            <div className={styles.heroCatalogue}>
              <p className={styles.catalogueLabel}>Faites votre marché</p>
              <div className={styles.navigation} role="group" aria-label="Origine des produits">
                  <button data-ui-commerce="shop-tab" data-ui-shape="control"
                    type="button"
                    data-tutorial="tab-mes-produits"
                    aria-pressed={showcaseMode === "products"}
                    className={styles.shopTab}
                    onClick={() => setShowcaseMode("products")}
                  >
                    <span className="block">Mes produits</span>
                  </button>
                  <button data-ui-commerce="shop-tab" data-ui-shape="control"
                    type="button"
                    data-tutorial="tab-mes-voisins"
                    aria-pressed={showcaseMode === "neighbors"}
                    className={styles.shopTab}
                    onClick={() => {
                      if (voisinProducts.length > 0) {
                        setShowcaseMode("neighbors");
                      }
                    }}
                    disabled={voisinProducts.length === 0}
                  >
                    <span className="block">Mes voisins</span>
                  </button>
                  <button data-ui-commerce="shop-tab" data-ui-shape="control"
                    type="button"
                    data-tutorial="tab-les-copains"
                    aria-pressed={showcaseMode === "copains"}
                    className={styles.shopTab}
                    onClick={() => {
                      if (copainsProducts.length > 0) {
                        setShowcaseMode("copains");
                      }
                    }}
                    disabled={copainsProducts.length === 0}
                  >
                    <span>Les copains <span className={styles.tabDetail}>de France et de Navarre</span></span>
                  </button>
                  <button data-ui-commerce="shop-tab" data-ui-shape="control"
                    type="button"
                    className={styles.shopTab}
                    aria-pressed={showcaseMode === "regions"}
                    onClick={() => setShowcaseMode("regions")}
                  >
                    <span className="block">Par région</span>
                  </button>
              </div>
              {showcaseMode !== "regions" && availableFilters.length > 1 && (
                <CategoryFilter selected={effectiveFilter} filters={availableFilters} onChange={setFilter} />
              )}
              {showcaseMode !== "regions" && showCultureFilter && (
                <fieldset className={styles.cultureFilter}>
                  <legend>Type de culture</legend>
                  <div className={styles.cultureOptions}>
                    {CULTURE_FILTERS.map((culture) => (
                      <button data-ui-commerce="shop-filter" data-ui-shape="control"
                        key={culture}
                        type="button"
                        aria-pressed={effectiveCultureFilter === culture}
                        onClick={() => setCultureFilter(culture)}
                        className="pill-cartoon min-h-[44px] px-4 py-2 text-sm uppercase tracking-wide transition"
                      >
                        {culture === "all" ? "Tous" : PRODUCT_CULTURE_LABELS[culture]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </header>
        );
      case "products": {
        if (showcaseMode === "regions") {
          return (
            <div key={section.id} className={spacingClass}>
              <RegionProducerShowcase
                rotationDay={rotationDay}
                producers={producers}
                products={partnerProducts}
                ownProducer={ownProducer}
                ownProducts={ownProducts}
                addButtonLabel={boutique.addButtonLabel}
                lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
                tastingSummariesByProductId={tastingSummariesByProductId}
              />
            </div>
          );
        }

        const isNeighborsMode = showcaseMode === "neighbors";
        const isCopainsMode = showcaseMode === "copains";
        const isPartnerMode = isNeighborsMode || isCopainsMode;
        const hasProducerProducts = displayedProducts.some((product) => Boolean(product.producerId));
        const showOwnProducerCard =
          showcaseMode === "products" && displayedOwnProducts.length > 0;

        return (
          <div key={section.id} className={spacingClass}>
            {isNeighborsMode && (
              <div data-ui-commerce="paper" data-ui-shape="panel" className={styles.sectionIntro}>
                <h2 className="font-display text-4xl text-ink">Mes voisins</h2>
                <p className="mt-3 max-w-3xl text-charcoal">
                  Producteurs bretons et du 44. Parce que oui, Nantes fait partie de la Bretagne historique.
                </p>
              </div>
            )}
            {isCopainsMode && (
              <div data-ui-commerce="paper" data-ui-shape="panel" className={styles.sectionIntro}>
                <h2 className="font-display text-4xl text-ink">
                  Les copains de France et de Navarre
                </h2>
                <p className="mt-3 max-w-3xl text-charcoal">
                  Il existe de nombreux talents et de superbes produits partout en France. D&eacute;couvrez ici ceux de quelques producteurs qui partagent nos valeurs.
                </p>
              </div>
            )}

            {effectiveFilter === "promos" && displayedProducts.length > 0 && (
              <div data-ui-commerce="promo-panel" data-ui-shape="panel" className="cartoon-border mb-6 bg-[#d35400] p-5 text-white">
                <h3 className="font-display text-3xl text-white">Promotions en cours</h3>
                <p className="mt-2 text-sm text-white/95">
                  Retrouve ici toutes les offres actives, y compris les packs promo.
                </p>
              </div>
            )}

            <div className={styles.catalogueHeading}>
              <h2>{effectiveFilter === "all" ? "Tous les produits" : effectiveFilter === "promos" ? "Les bonnes affaires" : categoryLabels[effectiveFilter]}</h2>
              <span aria-live="polite" aria-atomic="true">{displayedProducts.length} produit{displayedProducts.length > 1 ? "s" : ""}</span>
            </div>
            {isPartnerMode && hasProducerProducts ? (
              <ProducerBar
                rotationDay={rotationDay}
                producers={producers}
                products={displayedProducts}
                addButtonLabel={boutique.addButtonLabel}
                lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
                tastingSummariesByProductId={tastingSummariesByProductId}
              />
            ) : (
              <>
                {showOwnProducerCard && (
                  <div className="mb-6 flex justify-center md:justify-start">
                    <ProducerTcgCard
                      producer={ownProducer}
                      isSelected={selectedOwnProducerId === ownProducer.id}
                      imagePriority
                      onClick={() =>
                        setSelectedOwnProducerId((current) =>
                          current === ownProducer.id ? null : ownProducer.id,
                        )
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                  {displayedProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      producer={resolveProductProducer(product, producersById, ownProducer)}
                      addButtonLabel={boutique.addButtonLabel}
                      lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                      imagePriority={index === 0}
                      tastingSummary={tastingSummariesByProductId[product.id]}
                    />
                  ))}
                </div>

                <ProducerTcgModal
                  open={showOwnProducerCard && selectedOwnProducerId !== null}
                  producers={[ownProducer]}
                  selectedProducerId={selectedOwnProducerId}
                  productsByProducerId={ownProductsByProducerId}
                  addButtonLabel={boutique.addButtonLabel}
                  lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                  producerPartnerLabel={boutique.ownProducerLabel}
                  producerWebsiteLabel={boutique.producerWebsiteLabel}
                  tastingSummariesByProductId={tastingSummariesByProductId}
                  onClose={() => setSelectedOwnProducerId(null)}
                  onSelectProducer={setSelectedOwnProducerId}
                />
              </>
            )}

            {displayedProducts.length === 0 && !loading && (
              <div data-ui-commerce="paper" data-ui-shape="panel" className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
                {effectiveCultureFilter !== "all"
                  ? `Aucun produit en culture ${PRODUCT_CULTURE_LABELS[effectiveCultureFilter]} pour ces filtres.`
                  : effectiveFilter === "promos"
                  ? "Aucune promotion en cours."
                  : isNeighborsMode
                    ? "Aucun produit voisin pour ce filtre."
                    : isCopainsMode
                    ? "Aucun produit partenaire pour ce filtre."
                    : boutique.emptyMessage}
                {effectiveCultureFilter !== "all" && (
                  <button data-ui-commerce="secondary" data-ui-shape="control"
                    type="button"
                    className="btn-cartoon btn-secondary mx-auto mt-4 block"
                    onClick={() => setCultureFilter("all")}
                  >
                    Voir tous les types de culture
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }
      case "copains":
        return null;
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="card"
            className={spacingClass}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section data-ui-commerce="shop" className={`section-band paper-grain pt-32 ${styles.page}`}>
      <div className="retro-container">
        {boutiqueSections.map((section, index) => renderBoutiqueSection(section, index))}
      </div>
    </section>
  );
}
