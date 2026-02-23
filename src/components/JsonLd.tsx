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
const BUSINESS_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "60 rue Francois 1er",
  postalCode: "75008",
  addressLocality: "Paris",
  addressCountry: "FR",
};

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
      "Shop CBD bio breton pas cher en Bretagne. Fleurs CBD indoor et greenhouse, huiles CBD spectre complet, resines, cosmetiques et tisanes au chanvre naturel. CBD artisanal et legal.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    address: BUSINESS_ADDRESS,
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
    "@type": "Store",
    name: BUSINESS_NAME,
    url: baseUrl,
    logo: `${baseUrl}/charles.png`,
    image: `${baseUrl}/charles.png`,
    description:
      "Boutique CBD bio breton en Bretagne. Fleurs CBD indoor et greenhouse, huiles CBD spectre complet, resines CBD naturelles, cosmetiques et tisanes au chanvre bio. CBD artisanal, naturel et legal. Livraison rapide en France.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    address: BUSINESS_ADDRESS,
    priceRange: "EUR",
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: `${baseUrl}${product.images?.[0] ?? product.image}`,
    brand: {
      "@type": "Brand",
      name: BUSINESS_NAME,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: `${baseUrl}/boutique`,
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
