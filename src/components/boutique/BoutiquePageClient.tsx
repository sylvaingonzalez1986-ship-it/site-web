"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard, type ShopCardOrigin } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { focusShopResults, REGION_RESULTS_ID, ShopResultsRestore } from "@/components/boutique/ShopResultsRestore";
import { FRENCH_REGIONS } from "@/data/france-geo";
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
import { mergeUniqueProductsById, shopProductsShortcutLabel } from "@/lib/boutique-helpers";
import { buildRegionCatalogue } from "@/lib/region-catalogue";
import { rotateProductsForDay } from "@/lib/product-rotation";
import { changeShopUrl } from "@/lib/shop-panel-history";
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
const RESULTS_TITLE: Record<ShowcaseMode, string> = {
  products: "Produits maison",
  neighbors: "Produits des voisins",
  copains: "Produits des copains",
  regions: "Produits par région",
};

function goToResults() {
  const heading = document.getElementById("boutique-resultats");
  heading?.scrollIntoView({ block: "start" });
  heading?.focus({ preventScroll: true });
}

function readCatalogFilters(params: Pick<URLSearchParams, "get">): { filter: Filter; cultureFilter: CultureFilter; showcaseMode: ShowcaseMode } {
  const requestedFilter = params.get("categorie") ?? "all";
  const requestedCulture = params.get("culture") as CultureFilter;
  const requestedMode = params.get("selection") as ShowcaseMode;
  return {
    filter: requestedFilter === "promos" || Object.hasOwn(categoryLabels, requestedFilter) ? requestedFilter as Filter : "all",
    cultureFilter: CULTURE_FILTERS.includes(requestedCulture) ? requestedCulture : "all",
    showcaseMode: SHOWCASE_MODES.includes(requestedMode) ? requestedMode : "products",
  };
}
type BoutiquePageClientProps = {
  initialSearch: string;
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
  initialSearch,
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
  tastingSummariesByProductId = {},
}: BoutiquePageClientProps) {
  const loading = false;
  const search = useSearchParams() ?? new URLSearchParams(initialSearch);
  const { filter, cultureFilter, showcaseMode } = readCatalogFilters(search);
  const setFilter = (value: Filter) => changeShopUrl({ categorie: value === "all" ? null : value, producteur: null });
  const setCultureFilter = (value: CultureFilter) => changeShopUrl({ culture: value === "all" ? null : value, producteur: null });
  const setShowcaseMode = (value: ShowcaseMode) => changeShopUrl({ selection: value === "products" ? null : value, region: null, producteur: null });
  const selectedProducerId = search.get("producteur");
  const isRegionMode = showcaseMode === "regions";
  const selectedRegion = isRegionMode ? FRENCH_REGIONS.find(region => region === search.get("region")) ?? null : null;
  const setProducer = (producerId: string | null) => changeShopUrl({ producteur: producerId }, producerId ? selectedProducerId ? "switch" : "open" : "close");
  const regionCatalogue = useMemo(() => isRegionMode
    ? buildRegionCatalogue(selectedRegion, producers, partnerProducts, ownProducer, ownProducts, rotationDay)
    : null, [isRegionMode, ownProducer, ownProducts, partnerProducts, producers, rotationDay, selectedRegion]);

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
  const listOrigin: ShopCardOrigin = { surface: "market", selection: showcaseMode, categorie: effectiveFilter, culture: effectiveCultureFilter };

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
  const resultCount = displayedProducts.length;
  const regionalProductCount = regionCatalogue?.selectedProducts.length ?? 0;
  const shortcutLabel = selectedRegion
    ? regionalProductCount > 0 ? shopProductsShortcutLabel(regionalProductCount) : "Voir la région"
    : showcaseMode === "regions" ? "Voir la carte des producteurs" : shopProductsShortcutLabel(resultCount);
  const hasResultsSection = boutiqueSections.some(section => section.type === "products");
  const resultLabel = effectiveFilter === "all" ? null : effectiveFilter === "promos" ? "Promotions" : categoryLabels[effectiveFilter];
  const resultsHeading = (
    <div className={styles.catalogueHeading}>
      <h2 id="boutique-resultats" tabIndex={-1}>{RESULTS_TITLE[showcaseMode]}</h2>
      {showcaseMode !== "regions" && (
        <span aria-live="polite" aria-atomic="true">
          {resultLabel && `${resultLabel} · `}{resultCount} produit{resultCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
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
            <div id="producteurs" className={`${styles.heroCatalogue} scroll-mt-28`}>
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
              {hasResultsSection && (
                <div className={styles.resultsAction}>
                  {showcaseMode === "regions" || resultCount > 0 ? (
                    <>
                      <button type="button" onClick={() => {
                        if (!selectedRegion || !focusShopResults(REGION_RESULTS_ID)) goToResults();
                      }} aria-controls={selectedRegion ? REGION_RESULTS_ID : "boutique-resultats"} className={styles.resultsButton}>
                        {shortcutLabel}
                      </button>
                      {selectedRegion && regionalProductCount === 0 && <p role="status">Aucun produit dans cette région actuellement.</p>}
                    </>
                  ) : (
                    <p role="status">Aucun produit pour cette sélection.</p>
                  )}
                </div>
              )}
            </div>
          </header>
        );
      case "products": {
        if (regionCatalogue) {
          return (
            <div key={section.id} className={spacingClass}>
              {resultsHeading}
              <RegionProducerShowcase
                originFilters={{ categorie: filter, culture: cultureFilter }}
                selectedRegion={selectedRegion}
                selectedProducerId={selectedProducerId}
                onSelectProducer={setProducer}
                rotationDay={rotationDay}
                catalogue={regionCatalogue}
                ownProducer={ownProducer}
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
        const hasProducerProducts = displayedProducts.some((product) => product.producerId && producersById.has(product.producerId));
        const showOwnProducerCard =
          showcaseMode === "products" && displayedOwnProducts.length > 0;

        return (
          <div key={section.id} className={spacingClass}>
            {isNeighborsMode && (
              <div data-ui-commerce="paper" data-ui-shape="panel" className={styles.sectionIntro}>
                <p className="max-w-3xl text-charcoal">
                  Producteurs bretons et du 44. Parce que oui, Nantes fait partie de la Bretagne historique.
                </p>
              </div>
            )}
            {isCopainsMode && (
              <div data-ui-commerce="paper" data-ui-shape="panel" className={styles.sectionIntro}>
                <p className="max-w-3xl text-charcoal">
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

            {isPartnerMode && hasProducerProducts ? (
              <ProducerBar
                origin={listOrigin}
                selectedProducerId={selectedProducerId}
                onSelectProducer={setProducer}
                rotationDay={rotationDay}
                producers={producers}
                products={displayedProducts}
                addButtonLabel={boutique.addButtonLabel}
                lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
                tastingSummariesByProductId={tastingSummariesByProductId}
                resultsHeading={resultsHeading}
              />
            ) : (
              <>
                {showOwnProducerCard && (
                  <div className="mb-6 flex justify-center md:justify-start">
                    <ProducerTcgCard
                      producer={ownProducer}
                      isSelected={selectedProducerId === ownProducer.id}
                      imagePriority
                      onClick={() => setProducer(ownProducer.id)}
                    />
                  </div>
                )}

                {resultsHeading}
                <div data-shop-list-view="market" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                  {displayedProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      origin={listOrigin}
                      producer={resolveProductProducer(product, producersById, ownProducer)}
                      addButtonLabel={boutique.addButtonLabel}
                      lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                      imagePriority={index === 0}
                      tastingSummary={tastingSummariesByProductId[product.id]}
                    />
                  ))}
                </div>

                <ProducerTcgModal
                  open={showOwnProducerCard && selectedProducerId === ownProducer.id}
                  origin={{ ...listOrigin, surface: "producer" }}
                  producers={[ownProducer]}
                  selectedProducerId={selectedProducerId}
                  productsByProducerId={ownProductsByProducerId}
                  addButtonLabel={boutique.addButtonLabel}
                  lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                  producerPartnerLabel={boutique.ownProducerLabel}
                  producerWebsiteLabel={boutique.producerWebsiteLabel}
                  tastingSummariesByProductId={tastingSummariesByProductId}
                  onClose={() => setProducer(null)}
                  onSelectProducer={setProducer}
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
      <ShopResultsRestore />
      <div className="retro-container">
        {boutiqueSections.map((section, index) => renderBoutiqueSection(section, index))}
      </div>
    </section>
  );
}
