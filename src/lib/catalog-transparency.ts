import type { Product } from "@/data/products";
import { getActiveCatalogCategories } from "@/lib/catalog-categories";
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
  metrics: CatalogTransparencySnapshot;
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
): CatalogTransparencyDocument {
  return {
    schemaVersion: "1.0",
    name: "Observatoire de transparence du catalogue CBD",
    description:
      "Mesures calculées automatiquement à partir des références réellement publiées par Les Chanvriers Bretons.",
    canonicalPage: `${baseUrl}/cbd-naturel`,
    catalogUrl: `${baseUrl}/boutique`,
    methodology:
      "Décompte après déduplication du catalogue public. Une analyse est comptée uniquement lorsqu'un document est relié à la fiche. L'origine et le producteur proviennent de la fiche producteur associée.",
    dataAsOf: snapshot.lastCatalogUpdate ?? null,
    definitions: {
      publishedReferences: "Références uniques présentes dans le catalogue public.",
      producerIdentified: "Références reliées à un producteur ou à la production propre identifié.",
      originIdentified: "Références dont la fiche producteur comporte une localisation, un département ou une région.",
      analysesAvailable: "Références comportant un lien public vers un document d'analyse.",
    },
    metrics: snapshot,
  };
}
