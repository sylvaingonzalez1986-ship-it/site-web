import { headers } from "next/headers";
import type { Product } from "@/data/products";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { getSiteUrl } from "@/lib/site-url";
import type { Producer } from "@/types/store";

type ArticleJsonLdProps = {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified: string;
  category?: string;
  wordCount?: number;
  ratingValue?: number;
  ratingCount?: number;
};

function resolveProductAvailability(product: Product): string {
  if (product.trackStock && typeof product.stockQuantity === "number" && product.stockQuantity <= 0) {
    return "https://schema.org/OutOfStock";
  }

  return "https://schema.org/InStock";
}

const CATEGORY_SLUGS: Record<Product["category"], string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

const CATEGORY_NAMES: Record<Product["category"], string> = {
  fleurs: "Fleurs CBD",
  resines: "Résines CBD",
  huiles: "Huiles CBD",
  "e-liquide": "E-liquides CBD",
  cosmetiques: "Cosmétiques CBD",
  alimentaire: "Tisanes CBD",
  miam: "Produits gourmands CBD",
  accessoires: "Accessoires CBD",
};

const BUSINESS_NAME = BUSINESS_IDENTITY.brandName;
const BUSINESS_LEGAL_NAME = BUSINESS_IDENTITY.legalName;
const BUSINESS_EMAIL = BUSINESS_IDENTITY.email;
const BUSINESS_LOGO_PATH = "/les-chanvriers-bretons-logo.png";
const BUSINESS_PHONE =
  process.env.BUSINESS_PHONE?.trim() ||
  process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() ||
  undefined;

function absoluteUrl(baseUrl: string, value: string): string {
  try {
    return new URL(value, `${baseUrl}/`).toString();
  } catch {
    return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
  }
}

function organizationId(baseUrl: string): string {
  return `${baseUrl}/#organization`;
}

function websiteId(baseUrl: string): string {
  return `${baseUrl}/#website`;
}

function founderId(baseUrl: string): string {
  return `${baseUrl}/#founder`;
}

function getProductUrl(baseUrl: string, product: Pick<Product, "category" | "id">): string {
  return `${baseUrl}/boutique/${CATEGORY_SLUGS[product.category]}/${product.id}`;
}

function buildProductOffers(product: Product, productUrl: string, baseUrl: string) {
  const seller = { "@id": organizationId(baseUrl) };
  const returnPolicy = { "@id": `${baseUrl}/#return-policy` };
  const variants = product.variantOptions?.filter((option) => option.enabled !== false) ?? [];

  if (variants.length === 0) {
    return {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "EUR",
      availability: resolveProductAvailability(product),
      itemCondition: "https://schema.org/NewCondition",
      url: productUrl,
      seller,
      hasMerchantReturnPolicy: returnPolicy,
    };
  }

  return variants.map((option) => ({
    "@type": "Offer",
    sku: `${product.id}-${option.id}`,
    name: `${product.name} — ${option.label}`,
    price: option.price,
    priceCurrency: "EUR",
    availability:
      option.inStock === false ||
      (typeof option.stockQuantity === "number" && option.stockQuantity <= 0)
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    url: productUrl,
    seller,
    hasMerchantReturnPolicy: returnPolicy,
  }));
}

function safeJsonLdStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function getNonce(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-nonce") ?? undefined;
  } catch {
    return undefined;
  }
}

function JsonLdScript({ nonce, data }: { nonce: string | undefined; data: unknown }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(data) }}
    />
  );
}

export async function OrganizationJsonLd() {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": organizationId(baseUrl),
    name: BUSINESS_NAME,
    legalName: BUSINESS_LEGAL_NAME,
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      "@id": `${baseUrl}/#logo`,
      url: `${baseUrl}${BUSINESS_LOGO_PATH}`,
      contentUrl: `${baseUrl}${BUSINESS_LOGO_PATH}`,
      width: 800,
      height: 800,
    },
    image: { "@id": `${baseUrl}/#logo` },
    description:
      "Maison bretonne consacrée au CBD et au chanvre. Le catalogue distingue la production des Chanvriers Bretons des références de producteurs partenaires et présente l'origine, la composition et les analyses disponibles par produit.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "SIREN",
        value: BUSINESS_IDENTITY.siren,
      },
      {
        "@type": "PropertyValue",
        propertyID: "SIRET",
        value: BUSINESS_IDENTITY.siret,
      },
    ],
    vatID: BUSINESS_IDENTITY.vatNumber,
    foundingDate: BUSINESS_IDENTITY.foundingDate,
    address: {
      "@type": "PostalAddress",
      ...BUSINESS_IDENTITY.address,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: BUSINESS_EMAIL,
      availableLanguage: "fr",
      areaServed: "FR",
    },
    priceRange: "€5 - €80",
    currenciesAccepted: "EUR",
    founder: {
      "@type": "Person",
      "@id": founderId(baseUrl),
      name: BUSINESS_IDENTITY.president,
      jobTitle: "Président et responsable de publication",
      image: `${baseUrl}/sylvain.png`,
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      "@id": `${baseUrl}/#return-policy`,
      applicableCountry: "FR",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
      merchantReturnLink: `${baseUrl}/cgv`,
    },
    knowsAbout: [
      "CBD naturel",
      "Chanvre breton",
      "Traçabilité du CBD",
      "Analyses de laboratoire du CBD",
      "Fleurs de CBD",
      "Tisanes au chanvre",
    ],
    areaServed: [
      { "@type": "Country", name: "France" },
      { "@type": "AdministrativeArea", name: "Bretagne" },
    ],
    sameAs: [
      BUSINESS_IDENTITY.officialRegistryUrl,
      BUSINESS_IDENTITY.externalRegistryUrl,
      ...BUSINESS_IDENTITY.socialProfileUrls,
    ],
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

// Compatibility export for deployments whose layout still imports the former
// duplicate LocalBusiness graph. OrganizationJsonLd now carries the store data.
export async function LocalBusinessJsonLd() {
  return null;
}

export async function WebSiteJsonLd() {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(baseUrl),
    name: BUSINESS_NAME,
    url: baseUrl,
    publisher: { "@id": organizationId(baseUrl) },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/boutique?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function WebPageJsonLd({
  name,
  description,
  url,
  about,
  dateModified,
}: {
  name: string;
  description: string;
  url: string;
  about: string[];
  dateModified?: string;
}) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name,
    description,
    ...(dateModified ? { dateModified } : {}),
    inLanguage: "fr-FR",
    isPartOf: { "@id": websiteId(baseUrl) },
    publisher: { "@id": organizationId(baseUrl) },
    about: about.map((nameValue) => ({ "@type": "Thing", name: nameValue })),
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const nonce = await getNonce();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function CityServiceJsonLd({
  city,
  department,
  url,
  description,
}: {
  city: string;
  department: string;
  url: string;
  description: string;
}) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#delivery-service`,
    name: `Livraison de CBD à ${city}`,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    description,
    serviceType: "Livraison de produits CBD",
    provider: { "@id": organizationId(baseUrl) },
    areaServed: [
      { "@type": "City", name: city },
      { "@type": "AdministrativeArea", name: department },
      { "@type": "AdministrativeArea", name: "Bretagne" },
      { "@type": "Country", name: "France" },
    ],
    termsOfService: `${baseUrl}/cgv`,
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function CollectionPageJsonLd({
  name,
  description,
  url,
  products,
}: {
  name: string;
  description: string;
  url: string;
  products: Product[];
}) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    mainEntity: {
      "@type": "ItemList",
      name,
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: getProductUrl(baseUrl, product),
      })),
    },
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function ProductListJsonLd({
  products,
  producers = [],
}: {
  products: Product[];
  producers?: Producer[];
}) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();
  const producerById = new Map(producers.map((producer) => [producer.id, producer]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Produits CBD - Les Chanvriers Bretons",
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => {
      const productUrl = getProductUrl(baseUrl, product);

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          "@id": `${productUrl}#product`,
          sku: product.id,
          name: product.name,
          description: product.description,
          image: absoluteUrl(baseUrl, product.images?.[0] ?? product.image),
          url: productUrl,
          category: CATEGORY_NAMES[product.category],
        brand: {
          "@type": "Brand",
          name:
            (product.producerId
              ? producerById.get(product.producerId)?.name
              : undefined) ?? BUSINESS_NAME,
        },
          offers: buildProductOffers(product, productUrl, baseUrl),
        },
      };
    }),
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function ProductJsonLd({
  product,
  producer,
  aggregateRating,
}: {
  product: Product;
  producer?: { id?: string; name: string };
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
    bestRating: number;
  };
}) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const productUrl = getProductUrl(baseUrl, product);
  const productImages = (product.images?.length ? product.images : [product.image]).map((image) =>
    absoluteUrl(baseUrl, image),
  );
  const additionalProperty = [
    product.cultureMode
      ? { "@type": "PropertyValue", name: "Mode de culture", value: product.cultureMode }
      : undefined,
    typeof product.weightGrams === "number"
      ? { "@type": "PropertyValue", name: "Poids", value: product.weightGrams, unitCode: "GRM" }
      : undefined,
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    sku: product.id,
    name: product.name,
    description: product.description,
    image: productImages,
    url: productUrl,
    category: CATEGORY_NAMES[product.category],
    brand: {
      "@type": "Brand",
      name: producer?.name ?? BUSINESS_NAME,
    },
    manufacturer: producer
      ? {
          "@type": "Organization",
          "@id": `${baseUrl}/#producer-${encodeURIComponent(producer.id ?? product.producerId ?? producer.name)}`,
          name: producer.name,
        }
      : { "@id": organizationId(baseUrl) },
    additionalProperty: additionalProperty.length > 0 ? additionalProperty : undefined,
    subjectOf: product.analysisPdf
      ? {
          "@type": "DigitalDocument",
          name: `Analyse laboratoire — ${product.name}`,
          url: absoluteUrl(baseUrl, product.analysisPdf),
        }
      : undefined,
    ...(aggregateRating ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue,
        ratingCount: aggregateRating.ratingCount,
        bestRating: aggregateRating.bestRating,
        worstRating: 1,
      },
    } : {}),
    offers: buildProductOffers(product, productUrl, baseUrl),
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  category,
  wordCount,
  ratingValue,
  ratingCount,
}: ArticleJsonLdProps) {
  const nonce = await getNonce();
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: [image],
    datePublished,
    dateModified,
    articleSection: category,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    author: {
      "@id": organizationId(baseUrl),
    },
    publisher: {
      "@id": organizationId(baseUrl),
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}${BUSINESS_LOGO_PATH}`,
      },
    },
    wordCount: typeof wordCount === "number" && Number.isFinite(wordCount) ? wordCount : undefined,
    aggregateRating:
      typeof ratingValue === "number" &&
      Number.isFinite(ratingValue) &&
      typeof ratingCount === "number" &&
      Number.isFinite(ratingCount) &&
      ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(ratingValue.toFixed(2)),
            bestRating: 5,
            worstRating: 1,
            ratingCount: Math.max(0, Math.floor(ratingCount)),
          }
        : undefined,
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}

export async function FaqJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const nonce = await getNonce();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return <JsonLdScript nonce={nonce} data={jsonLd} />;
}
