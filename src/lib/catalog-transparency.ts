import type { Product } from "@/data/products";
import {
  getActiveCatalogCategories,
  PUBLIC_CATALOG_CATEGORIES,
} from "@/lib/catalog-categories";
import { dedupeProducts } from "@/lib/product-dedup";
import {
  DEFAULT_OWN_PRODUCER,
  isOwnProduct,
  resolveProductProducer,
} from "@/lib/own-producer";
import { mostRecentSeoDate } from "@/lib/seo-sitemap";
import type { Producer } from "@/types/store";

export type CatalogTransparencyCategory = {
  category: Product["category"];
  label: string;
  publishedReferences: number;
  analysesAvailable: number;
};

export type CatalogTransparencySnapshot = {
  publishedReferences: number;
  ownReferences: number;
  partnerReferences: number;
  producerIdentified: number;
  originIdentified: number;
  analysesAvailable: number;
  unresolvedProducerReferences: number;
  distinctProducers: number;
  activeCategories: number;
  lastCatalogUpdate?: string;
  categories: CatalogTransparencyCategory[];
};

export type CatalogTransparencyObservation = {
  productId: string;
  name: string;
  category: Product["category"];
  categoryLabel: string;
  productUrl: string;
  producerName: string | null;
  relationship: "own" | "partner";
  origin: string | null;
  analysisAvailable: boolean;
  analysisUrl: string | null;
  lastUpdated: string | null;
};

export type CatalogTransparencyDocument = {
  schemaVersion: "1.0";
  name: string;
  description: string;
  canonicalPage: string;
  catalogUrl: string;
  methodology: string;
  dataAsOf: string | null;
  definitions: {
    publishedReferences: string;
    producerIdentified: string;
    originIdentified: string;
    analysesAvailable: string;
  };
  observationFields: {
    productUrl: string;
    producerName: string;
    relationship: string;
    origin: string;
    analysisUrl: string;
    lastUpdated: string;
  };
  metrics: CatalogTransparencySnapshot;
  observations: CatalogTransparencyObservation[];
};

function hasPublishedAnalysis(product: Product): boolean {
  return typeof product.analysisPdf === "string" && product.analysisPdf.trim().length > 0;
}

function hasProducerOrigin(producer: Producer | undefined): boolean {
  if (!producer) return false;
  return [producer.location, producer.department, producer.region].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function formatProducerOrigin(producer: Producer | undefined): string | null {
  if (!producer) return null;

  const values = [producer.location, producer.department, producer.region]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, allValues) =>
      allValues.findIndex((candidate) => candidate.toLocaleLowerCase("fr") === value.toLocaleLowerCase("fr")) === index,
    );

  return values.length > 0 ? values.join(" · ") : null;
}

function absolutePublicUrl(value: string, baseUrl: string): string {
  return new URL(value, `${baseUrl}/`).toString();
}

export function buildCatalogTransparencyObservations(
  products: Product[],
  producers: Producer[],
  baseUrl: string,
  ownProducer: Producer = DEFAULT_OWN_PRODUCER,
): CatalogTransparencyObservation[] {
  const producerById = new Map(producers.map((producer) => [producer.id, producer]));
  const categoryByCode = new Map(
    PUBLIC_CATALOG_CATEGORIES.map((category) => [category.category, category]),
  );

  return dedupeProducts(products).map((product) => {
    const producer = resolveProductProducer(product, producerById, ownProducer);
    const category = categoryByCode.get(product.category);
    const analysisAvailable = hasPublishedAnalysis(product);

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      categoryLabel: category?.label ?? product.category,
      productUrl: `${baseUrl}/boutique/${category?.slug ?? product.category}/${product.id}`,
      producerName: producer?.name.trim() || null,
      relationship: isOwnProduct(product) ? "own" : "partner",
      origin: formatProducerOrigin(producer),
      analysisAvailable,
      analysisUrl: analysisAvailable ? absolutePublicUrl(product.analysisPdf!, baseUrl) : null,
      lastUpdated: product.updatedAt ?? product.createdAt ?? null,
    };
  });
}

export function buildCatalogTransparencySnapshot(
  products: Product[],
  producers: Producer[],
  ownProducer: Producer = DEFAULT_OWN_PRODUCER,
): CatalogTransparencySnapshot {
  const publishedProducts = dedupeProducts(products);
  const producerById = new Map(producers.map((producer) => [producer.id, producer]));
  const distinctProducerIds = new Set<string>();
  let ownReferences = 0;
  let partnerReferences = 0;
  let producerIdentified = 0;
  let originIdentified = 0;
  let analysesAvailable = 0;
  let unresolvedProducerReferences = 0;

  for (const product of publishedProducts) {
    const ownReference = isOwnProduct(product);
    const producer = resolveProductProducer(product, producerById, ownProducer);

    if (ownReference) {
      ownReferences += 1;
    } else {
      partnerReferences += 1;
    }

    if (producer?.name.trim()) {
      producerIdentified += 1;
      distinctProducerIds.add(producer.id);
    } else if (product.producerId) {
      unresolvedProducerReferences += 1;
    }

    if (hasProducerOrigin(producer)) {
      originIdentified += 1;
    }

    if (hasPublishedAnalysis(product)) {
      analysesAvailable += 1;
    }
  }

  const activeCategories = getActiveCatalogCategories(publishedProducts);
  const lastCatalogUpdate = mostRecentSeoDate(
    publishedProducts.map((product) => product.updatedAt ?? product.createdAt),
  );

  return {
    publishedReferences: publishedProducts.length,
    ownReferences,
    partnerReferences,
    producerIdentified,
    originIdentified,
    analysesAvailable,
    unresolvedProducerReferences,
    distinctProducers: distinctProducerIds.size,
    activeCategories: activeCategories.length,
    ...(lastCatalogUpdate ? { lastCatalogUpdate: lastCatalogUpdate.toISOString() } : {}),
    categories: activeCategories.map(({ category, label }) => {
      const categoryProducts = publishedProducts.filter((product) => product.category === category);
      return {
        category,
        label,
        publishedReferences: categoryProducts.length,
        analysesAvailable: categoryProducts.filter(hasPublishedAnalysis).length,
      };
    }),
  };
}

export function buildCatalogTransparencyDocument(
  snapshot: CatalogTransparencySnapshot,
  baseUrl: string,
  observations: CatalogTransparencyObservation[] = [],
): CatalogTransparencyDocument {
  return {
    schemaVersion: "1.0",
    name: "Observatoire de transparence du catalogue CBD",
    description:
      "Mesures calculées automatiquement à partir des références réellement publiées par Les Chanvriers Bretons.",
    canonicalPage: `${baseUrl}/cbd-naturel`,
    catalogUrl: `${baseUrl}/boutique`,
    methodology:
      "Décompte après déduplication du catalogue public. Une analyse est comptée uniquement lorsqu'un document est relié à la fiche. L'origine et le producteur proviennent de la fiche producteur associée. Les observations permettent de rapprocher chaque total de ses références publiques.",
    dataAsOf: snapshot.lastCatalogUpdate ?? null,
    definitions: {
      publishedReferences: "Références uniques présentes dans le catalogue public.",
      producerIdentified: "Références reliées à un producteur ou à la production propre identifié.",
      originIdentified: "Références dont la fiche producteur comporte une localisation, un département ou une région.",
      analysesAvailable: "Références comportant un lien public vers un document d'analyse.",
    },
    observationFields: {
      productUrl: "URL canonique de la fiche produit publique.",
      producerName: "Nom du producteur associé ; null lorsque l'association ne peut pas être résolue.",
      relationship: "own pour la production propre, partner pour une référence partenaire.",
      origin: "Localisation, département ou région déclarés sur la fiche producteur ; null en leur absence.",
      analysisUrl: "URL du document d'analyse public relié à la référence ; null lorsqu'aucun document n'est publié.",
      lastUpdated: "Date de dernière mise à jour de la référence lorsqu'elle est disponible.",
    },
    metrics: snapshot,
    observations,
  };
}
