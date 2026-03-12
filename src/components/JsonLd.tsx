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
    logo: `${baseUrl}/sylvain.png`,
    description:
      "Producteur CBD en Bretagne. Fleurs de CBD direct producteur, huiles spectre complet, résines et tisanes chanvre artisanales. CBD naturel cultivé sans pesticide, achat en circuit court. Livraison rapide France.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    founder: {
      "@type": "Person",
      name: "Sylvain",
      jobTitle: "Chanvrier breton",
    },
    knowsAbout: [
      "CBD naturel",
      "Chanvre breton",
      "Culture de chanvre sans pesticide",
      "Circuit court CBD",
      "Fleurs de CBD",
      "Tisanes chanvre artisanales",
    ],
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
    "@type": ["OnlineStore", "LocalBusiness"],
    name: BUSINESS_NAME,
    url: baseUrl,
    logo: `${baseUrl}/sylvain.png`,
    image: `${baseUrl}/sylvain.png`,
    description:
      "Boutique CBD naturel direct producteur breton. Fleurs de CBD, résines, huiles spectre complet, tisanes chanvre artisanales. Achat CBD circuit court, français, sans pesticide, cultivé en Bretagne. Livraison rapide en France.",
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    priceRange: "€5 - €80",
    currenciesAccepted: "EUR",
    keywords:
      "cbd naturel, cbd breton, producteur cbd bretagne, fleur de cbd direct producteur, achat cbd circuit court, cbd français sans pesticide, tisane chanvre artisanale",
    areaServed: [
      { "@type": "Country", name: "France" },
      { "@type": "AdministrativeArea", name: "Bretagne" },
    ],
    address: {
      "@type": "PostalAddress",
      addressRegion: "Bretagne",
      addressCountry: "FR",
    },
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

export function CityServiceJsonLd({
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
  const baseUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["OnlineStore", "LocalBusiness"],
    name: `${BUSINESS_NAME} ${city}`,
    url,
    mainEntityOfPage: url,
    image: `${baseUrl}/sylvain.png`,
    logo: `${baseUrl}/sylvain.png`,
    description,
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    areaServed: [
      { "@type": "City", name: city },
      { "@type": "AdministrativeArea", name: department },
      { "@type": "AdministrativeArea", name: "Bretagne" },
      { "@type": "Country", name: "France" },
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      addressRegion: department,
      addressCountry: "FR",
    },
    knowsAbout: [
      `CBD ${city}`,
      `fleurs CBD ${city}`,
      `huiles CBD ${city}`,
      `résines CBD ${city}`,
      `tisanes chanvre ${city}`,
      "CBD naturel",
      "producteur CBD Bretagne",
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

export function CollectionPageJsonLd({
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
        url: `${baseUrl}/boutique/${
          {
            fleurs: "fleurs-cbd",
            resines: "resines-cbd",
            huiles: "huiles-cbd",
            "e-liquide": "e-liquide-cbd",
            cosmetiques: "cosmetiques-cbd",
            alimentaire: "tisane-cbd",
            miam: "miam-cbd",
            accessoires: "accessoires-cbd",
          }[product.category] ?? `${product.category}-cbd`
        }/${product.id}`,
      })),
    },
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
        sku: product.id,
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
          availability: resolveProductAvailability(product),
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

export function ProductJsonLd({
  product,
  producer,
}: {
  product: Product;
  producer?: { name: string };
}) {
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
    sku: product.id,
    name: product.name,
    description: product.description,
    image: fullImageUrl,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: producer?.name ?? BUSINESS_NAME,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "EUR",
      availability: resolveProductAvailability(product),
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
  wordCount,
  ratingValue,
  ratingCount,
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
        url: `${baseUrl}/sylvain.png`,
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
