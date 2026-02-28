import type { Product } from "@/data/products";
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
};

const BUSINESS_NAME = "Les Chanvriers Bretons";
const BUSINESS_EMAIL = "leschanvriersbretons@gmail.com";
const BUSINESS_PHONE =
  process.env.BUSINESS_PHONE?.trim() ||
  process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() ||
  undefined;

function safeJsonLdStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function OrganizationJsonLd() {
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BUSINESS_NAME,
    url: baseUrl,
    logo: `${baseUrl}/charles.png`,
    description:
      "Shop CBD bio breton pas cher en Bretagne. Fleurs CBD indoor et greenhouse, huiles CBD spectre complet, résines, cosmétiques et tisanes au chanvre naturel breton. CBD artisanal et légal.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    areaServed: [
      { "@type": "Country", name: "France" },
      { "@type": "AdministrativeArea", name: "Bretagne" },
    ],
    sameAs: [
      "https://www.instagram.com/leschanvriersbretons",
      "https://www.facebook.com/leschanvriersbretons",
      "https://www.tiktok.com/@leschanvriersbretons",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function LocalBusinessJsonLd() {
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: BUSINESS_NAME,
    url: baseUrl,
    logo: `${baseUrl}/charles.png`,
    image: `${baseUrl}/charles.png`,
    description:
      "Boutique CBD bio breton en Bretagne. Fleurs CBD indoor et greenhouse, huiles CBD spectre complet, résines CBD naturelles, cosmétiques et tisanes au chanvre bio breton. CBD artisanal, naturel et légal. Livraison rapide en France.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    priceRange: "€5 - €80",
    currenciesAccepted: "EUR",
    areaServed: [
      { "@type": "Country", name: "France" },
      { "@type": "AdministrativeArea", name: "Bretagne" },
    ],
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    sameAs: [
      "https://www.instagram.com/leschanvriersbretons",
      "https://www.facebook.com/leschanvriersbretons",
      "https://www.tiktok.com/@leschanvriersbretons",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BUSINESS_NAME,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/boutique?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function ProductListJsonLd({
  products,
  producers = [],
}: {
  products: Product[];
  producers?: Producer[];
}) {
  const baseUrl = getSiteUrl();
  const producerById = new Map(producers.map((producer) => [producer.id, producer]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Produits CBD - Les Chanvriers Bretons",
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: `${baseUrl}${product.images?.[0] ?? product.image}`,
        brand: {
          "@type": "Brand",
          name:
            (product.producerId
              ? producerById.get(product.producerId)?.name
              : undefined) ?? BUSINESS_NAME,
        },
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          seller: {
            "@type": "Organization",
            name: BUSINESS_NAME,
          },
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function ProductJsonLd({ product }: { product: Product }) {
  const baseUrl = getSiteUrl();

  const categorySlugs: Record<string, string> = {
    fleurs: "fleurs-cbd",
    resines: "resines-cbd",
    huiles: "huiles-cbd",
    "e-liquide": "e-liquide-cbd",
    cosmetiques: "cosmetiques-cbd",
    alimentaire: "tisane-cbd",
    miam: "miam-cbd",
    accessoires: "accessoires-cbd",
  };
  const catSlug = categorySlugs[product.category] ?? `${product.category}-cbd`;
  const productUrl = `${baseUrl}/boutique/${catSlug}/${product.id}`;
  const imageUrl = product.images?.[0] ?? product.image;
  const fullImageUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${baseUrl}${imageUrl}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: fullImageUrl,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: BUSINESS_NAME,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: productUrl,
      seller: {
        "@type": "Organization",
        name: BUSINESS_NAME,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  category,
}: ArticleJsonLdProps) {
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
      "@type": "Organization",
      name: BUSINESS_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: BUSINESS_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/charles.png`,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function FaqJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}
