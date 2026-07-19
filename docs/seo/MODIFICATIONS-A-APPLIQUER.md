# Métadonnées SEO à Améliorer

## Actions Immédiates sur Fichiers Existants

## ⚠️ IMPORTANT

Ces modifications doivent être appliquées manuellement aux fichiers existants.
Je ne peux pas éditer les fichiers directement, mais voici les changements précis à effectuer.

---

## 📄 FICHIER: src/app/layout.tsx

### Ligne ~60 - Ajouter meta viewport optimization

**APRÈS la ligne avec `viewport` export, AJOUTER :**

```tsx
// Optimisation SEO supplémentaire
export const metadata: Metadata = {
  // ... métadonnées existantes ...

  // AJOUTER CES LIGNES :
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // À compléter plus tard avec Google Search Console
    google: "VOTRE_CODE_GOOGLE_VERIFICATION",
  },
};
```

---

## 📄 FICHIER: src/app/boutique/[category]/[slug]/page.tsx

### Amélioration du title (ligne ~104)

**REMPLACER :**

```tsx
const title = `${product.name} | ${catInfo?.label ?? "CBD"} Naturel Direct Producteur Breton`;
```

**PAR :**

```tsx
// Title optimisé avec caractéristiques produit
const title = product.thcContent
  ? `${product.name} ${product.thcContent}% CBD | ${catInfo?.label ?? "CBD"} Naturel Breton Direct Producteur`
  : `${product.name} | ${catInfo?.label ?? "CBD"} Naturel Direct Producteur Breton`;
```

### Enrichir la meta description (ligne ~109)

**REMPLACER :**

```tsx
const metaDescription = `${product.name} — ${description} ${brandName}. CBD naturel breton, direct producteur, livraison rapide en France.`;
```

**PAR :**

```tsx
const metaDescription = `${product.name} — ${description} ${brandName}. ${product.weight ? product.weight + "g. " : ""}CBD naturel breton, direct producteur${product.thcContent ? ", " + product.thcContent + "% CBD" : ""}, livraison rapide France.`;
```

---

## 📄 FICHIER: src/components/ProductCard.tsx

### Ajouter structured data pour chaque carte produit

**CHERCHER la section où le ProductCard est rendu et AJOUTER :**

```tsx
// Dans ProductCard.tsx, ajouter un micro-schema
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.imageUrl,
      description: product.description.slice(0, 200),
      brand: {
        "@type": "Brand",
        name: "Les Chanvriers Bretons",
      },
      offers: {
        "@type": "Offer",
        price: product.price,
        priceCurrency: "EUR",
        availability:
          product.stockQuantity > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    }),
  }}
/>
```

---

## 📄 FICHIER: src/app/blog/[slug]/page.tsx

### Ajouter breadcrumb JSON-LD

**IMPORTER en haut du fichier :**

```tsx
import { BreadcrumbJsonLd, ArticleJsonLd } from "@/components/JsonLd";
```

**DANS le composant, avant le return, AJOUTER :**

```tsx
const baseUrl = getSiteUrl();
const articleUrl = `${baseUrl}/blog/${post.slug}`;
```

**DANS le JSX, après l'ouverture de la section principale :**

```tsx
<BreadcrumbJsonLd
  items={[
    { name: "Accueil", url: baseUrl },
    { name: "Blog", url: `${baseUrl}/blog` },
    { name: post.title, url: articleUrl },
  ]}
/>
<ArticleJsonLd
  title={post.title}
  description={post.excerpt || post.title}
  url={articleUrl}
  image={post.featuredImage || `${baseUrl}/og-default.png`}
  datePublished={post.publishedAt}
  dateModified={post.updatedAt || post.publishedAt}
  category={post.category}
  wordCount={post.content?.split(' ').length}
/>
```

---

## 📄 NOUVEAU FICHIER À CRÉER: src/app/sitemap-blog.xml/route.ts

**Pour un sitemap secondaire dédié au blog :**

```tsx
import { NextResponse } from "next/server";
import { getPublishedBlogPostsByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";

export async function GET() {
  const baseUrl = getSiteUrl();
  const posts = await getPublishedBlogPostsByBackend();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${posts
  .map(
    (post) => `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.updatedAt || post.publishedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    ${
      post.featuredImage
        ? `<image:image>
      <image:loc>${post.featuredImage}</image:loc>
      <image:caption>${post.title}</image:caption>
    </image:image>`
        : ""
    }
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate",
    },
  });
}
```

---

## 📄 FICHIER: next.config.ts

### Optimisations headers supplémentaires (ligne ~23-50)

**AJOUTER dans la section headers() :**

```typescript
{
  source: '/sitemap.xml',
  headers: [
    { key: 'Content-Type', value: 'application/xml' },
    { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
  ],
},
{
  source: '/robots.txt',
  headers: [
    { key: 'Content-Type', value: 'text/plain' },
    { key: 'Cache-Control', value: 'public, max-age=86400' },
  ],
},
```

---

## 📄 FICHIER: src/components/Footer.tsx

### Ajouter liens internes SEO dans le footer

**CHERCHER la section des liens du footer et S'ASSURER que ces liens sont présents :**

```tsx
<div className="footer-section">
  <h3>Nos Produits CBD</h3>
  <ul>
    <li><Link href="/boutique/fleurs-cbd">Fleurs CBD</Link></li>
    <li><Link href="/boutique/huiles-cbd">Huiles CBD</Link></li>
    <li><Link href="/boutique/resines-cbd">Résines CBD</Link></li>
    <li><Link href="/boutique/tisane-cbd">Tisanes Chanvre</Link></li>
  </ul>
</div>

<div className="footer-section">
  <h3>Découvrir</h3>
  <ul>
    <li><Link href="/cbd-naturel">CBD Naturel</Link></li>
    <li><Link href="/blog">Blog & Guides</Link></li>
    <li><Link href="/fidelite">Programme Fidélité</Link></li>
  </ul>
</div>
```

---

## 📄 NOUVEAU COMPOSANT: src/components/StructuredDataProduct.tsx

```tsx
import { getSiteUrl } from "@/lib/site-url";
import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

interface StructuredDataProductProps {
  product: Product;
  producer?: Producer;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

export function StructuredDataProduct({
  product,
  producer,
  aggregateRating,
}: StructuredDataProductProps) {
  const baseUrl = getSiteUrl();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    description: product.description,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: producer?.name || "Les Chanvriers Bretons",
    },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/boutique/${product.category}/${product.id}`,
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      availability:
        product.stockQuantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
    ...(aggregateRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

---

## ✅ CHECKLIST PRIORITÉS

**Phase 1 (Cette semaine) :**

- [x] robots.txt créé
- [ ] Améliorer titles produits (fichier page.tsx)
- [ ] Ajouter alt texts images (voir GUIDE-OPTIMISATION-IMAGES.md)
- [ ] Vérifier balises meta descriptions

**Phase 2 (Semaine prochaine) :**

- [ ] Créer sitemap-blog.xml
- [ ] Ajouter breadcrumbs blog
- [ ] Enrichir footer avec liens internes
- [ ] Implémenter StructuredDataProduct

**Phase 3 (2 semaines) :**

- [ ] Optimiser toutes les images
- [ ] Créer 3 premiers articles de blog piliers
- [ ] Configurer Google Search Console
- [ ] Audit Core Web Vitals

---

**Notes :** Ces modifications sont purement techniques et ne changeront pas l'apparence visuelle du site. Elles amélioreront uniquement le référencement et l'indexation par les moteurs de recherche.
