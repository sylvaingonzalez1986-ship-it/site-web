# Rapport d'Audit SEO & GEO — leschanvriersbretons.com

**Date :** 19 mars 2026  
**Mots-clés cibles :** `cbd breton`, `cbd naturel`, `cbd rennes`  
**Domaine :** https://leschanvriersbretons.com  
**Stack :** Next.js (App Router), Supabase, Tailwind CSS

---

## SYNTHÈSE GLOBALE

| Volet | Note /100 |
|---|---|
| **1. SEO Technique** | **82/100** |
| **2. SEO On-Page & Contenu** | **78/100** |
| **3. SEO Local / GEO** | **85/100** |
| **4. Données Structurées (Schema.org)** | **88/100** |
| **5. Performance & Core Web Vitals** | **75/100** |
| **6. Maillage Interne & Architecture** | **76/100** |
| **7. Stratégie Mots-Clés Cibles** | **73/100** |
| **SCORE GLOBAL** | **79/100** |

---

## 1. SEO TECHNIQUE — 82/100

### Points forts ✓

- **robots.ts** bien configuré : pages admin, API, compte, age-gate bloquées
- **sitemap.ts** dynamique et complète : pages statiques, catégories, produits, articles blog, pages CMS, pages villes locales
- **Canonical tags** systématiques sur toutes les pages (accueil, blog, boutique, catégories, produits, pages CMS, pages villes)
- **Balise `<html lang="fr">`** correcte
- **HTTPS** forcé (`upgrade-insecure-requests` en CSP prod + HSTS avec preload)
- **Security headers** excellents (CSP avec nonce, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP)
- **metadataBase** configuré (`https://leschanvriersbretons.com`)
- **Page 404** personnalisée avec liens vers accueil et boutique
- **ISR activé** : `revalidate = 120` (produits/blog), `revalidate = 300` (articles)
- **`generateStaticParams`** pour les catégories boutique (pré-rendu statique)

### Points faibles ✗

- **Pas de `sitemap-index`** : avec produits + blog + pages villes, le sitemap pourrait devenir volumineux. Envisager un découpage (`sitemap-products.xml`, `sitemap-blog.xml`, `sitemap-local.xml`)
- **`lastModified: new Date()`** sur pages statiques et produits : renvoie "aujourd'hui" à chaque build/requête au lieu d'une vraie date de modification → Google interprète ça comme du spam de dates
- **Pas de gestion explicite des redirections 301** pour le trailing slash ou les anciennes URLs
- **Middleware exclut `sitemap.xml` et `robots.txt`** du matcher (correct), mais le pattern regex complexe pourrait masquer des erreurs d'exclusion futures
- **Pas de header `Cache-Control`** explicite sur les pages HTML côté CDN (reliance sur Next.js defaults)

### Recommandations prioritaires

1. **Fixer les `lastModified`** : pour les pages statiques, utiliser une date fixe (dernière modification réelle). Pour les produits, stocker `updatedAt` dans la base.
2. **Découper le sitemap** en sous-sitemaps si le nombre total d'URLs dépasse 500.
3. **Ajouter une gestion de redirections** dans `next.config.ts` (`async redirects()`) pour les anciennes URLs.

---

## 2. SEO ON-PAGE & CONTENU — 78/100

### Points forts ✓

- **Title tags** bien optimisés et distincts par page :
  - Accueil : *"CBD Naturel Direct Producteur Bretagne | Fleurs de CBD, Huiles & Tisanes Chanvre Artisanales"*
  - Boutique : *"Boutique CBD Naturel | Fleurs de CBD Direct Producteur Breton, Tisanes Chanvre Artisanales"*
  - Produits : template `{nom} | {catégorie} Naturel Direct Producteur Breton`
  - Blog : titre de l'article
  - Villes : `CBD {ville} | Les Chanvriers Bretons`
- **Meta descriptions** riches en mots-clés cibles, < 160 caractères
- **Template title** via Next.js metadata : `%s | Les Chanvriers Bretons`
- **Keywords meta** extensive (38 mots-clés) incluant les 3 cibles
- **OpenGraph complet** : title, description, image OG, locale `fr_FR`, type `website`
- **Twitter Card** : `summary_large_image` avec image OG
- **Alternate/hreflang** : `fr-FR` défini
- **Contenu éditorial unique par page ville** (pas de duplicate entre les 10 villes)
- **FAQ dédiée par ville** avec contenu localisé
- **Texte SEO complémentaire** sur chaque page catégorie (sous les produits)

### Points faibles ✗

- **Le mot-clé "cbd rennes"** n'apparaît pas dans le title de la page d'accueil ni dans la meta description principale
- **La page boutique n'a pas de canonical explicite dans son `page.tsx`** → elle est définie dans `layout.tsx`, ce qui fonctionne mais peut prêter à confusion avec le layout blog qui a aussi un canonical
- **Pas d'attribut `alt` dynamique riche** confirmé sur les images produit dans les listes
- **Les mots-clés "cbd breton"** sont surtout présents dans la description mais pas assez insérés dans des H1/H2 visibles
- **Le H1 de la page d'accueil** est géré dynamiquement par `HomePinnedExperience` → impossible de vérifier sa valeur sans voir le CMS ; risque qu'il ne contienne pas les keywords cibles
- **Le blog manque de focus thématique** : pas de tag/catégorie filtrables côté SEO visible dans les URLs

### Recommandations prioritaires

1. **Injecter "cbd breton" et "cbd naturel" dans le H1 de la homepage** visible par les moteurs.
2. **Créer une page pilier "CBD Breton"** (`/cbd-breton`) avec contenu long-format (2000+ mots) ciblant le mot-clé principal.
3. **Ajouter "cbd rennes" dans la meta description** de la homepage si Rennes est la cible prioritaire.
4. **Structurer le blog par catégories** avec URLs comme `/blog/categorie/legislation`, `/blog/categorie/guides` pour créer des clusters sémantiques.
5. **Vérifier les alt des images** produits : inclure `{nom produit} – CBD naturel breton` dans chaque alt.

---

## 3. SEO LOCAL / GEO — 85/100

### Points forts ✓

- **10 pages villes dédiées** avec URLs propres (`/cbd-rennes`, `/cbd-brest`, `/cbd-quimper`, etc.)
- **Contenu éditorial unique par ville** (2 paragraphes personnalisés + intro produit + FAQs locales)
- **FAQs localisées** : 5 questions/réponses par ville avec réponses adaptées au contexte local
- **Maillage inter-villes** via `nearbyCityMap` : chaque page ville pointe vers les 4 villes proches
- **Footer avec liens vers toutes les villes** : excellent pour le crawl et le maillage
- **Schema.org `LocalBusiness`** avec `areaServed` incluant Bretagne + France
- **`CityServiceJsonLd`** dédié par ville : schema `OnlineStore + LocalBusiness` avec `addressLocality`, `addressRegion`
- **Produits mis en avant** sur chaque page ville (top 4)
- **Sitemap inclut les pages villes** avec `changeFrequency: "monthly"` et `priority: 0.65`
- **Fil d'Ariane** sur chaque page ville

### Points faibles ✗

- **Seulement 10 villes** couvertes : manquent des villes secondaires stratégiques (Lannion, Guingamp, Morlaix, Concarneau, Auray, Dinan, Dinard, Ploërmel)
- **Pas de page département** (`/cbd-ille-et-vilaine`, `/cbd-finistere`, `/cbd-morbihan`, `/cbd-cotes-armor`) pour créer un niveau intermédiaire
- **Pas de Google Business Profile** mentionné dans le code (pas de lien `maps.google.com`)
- **L'adresse physique est incomplète** dans le schema LocalBusiness : pas de `streetAddress`, pas de `postalCode` → Google ne peut pas localiser précisément
- **Pas de page /cbd-bretagne** générique qui chaperonne toutes les pages villes
- **Les mots-clés des pages villes** pourraient être enrichis (ex: "livraison CBD Rennes", "acheter CBD Rennes pas cher")

### Recommandations prioritaires

1. **Créer une page hub `/cbd-bretagne`** avec carte interactive et liens vers toutes les villes.
2. **Ajouter 8-10 villes secondaires** pour couvrir chaque bassin de population breton.
3. **Créer 4 pages départements** comme niveau intermédiaire dans la hiérarchie locale.
4. **Compléter l'adresse** dans le schema `LocalBusiness` : ajouter `streetAddress` et `postalCode` si applicable.
5. **Ajouter les coordonnées GPS** (latitude/longitude) dans le schema `GeoCoordinates` pour chaque page ville.

---

## 4. DONNÉES STRUCTURÉES (SCHEMA.ORG) — 88/100

### Points forts ✓

- **7 types de schema implémentés** :
  - `Organization` (global, avec `founder`, `knowsAbout`, `sameAs`)
  - `LocalBusiness + OnlineStore` (affiché sur toutes les pages)
  - `WebSite` avec `SearchAction` (sitelinks searchbox)
  - `BreadcrumbList` (blog, boutique, catégories, produits, villes)
  - `Product` avec `Offer`, `availability`, `brand` (pages produit)
  - `Article` avec `AggregateRating`, `wordCount` (blog)
  - `FAQPage` (boutique + pages villes)
  - `ItemList` / `CollectionPage` (listes de produits)
- **Sécurisation JSON-LD** : échappement des `<`, `>`, `&`, `\u2028/\u2029` (prévention XSS)
- **Nonce CSP** appliqué aux scripts JSON-LD
- **`ProductListJsonLd`** avec brand par producteur, prix, disponibilité
- **`CityServiceJsonLd`** avec `knowsAbout` localisé par ville

### Points faibles ✗

- **Pas de schema `Review` / `AggregateRating` sur les produits** → seul le blog a `AggregateRating`
- **Pas de schema `Offer` avec `shippingDetails`** (délais/frais de livraison) → enrichissement rich snippets manqué
- **Pas de schema `Event`** pour les promotions ou nouveautés
- **L'image `logo`** pointe vers `/sylvain.png` : devrait être le logo officiel de la marque, pas un portrait
- **Pas de `returnPolicy`** dans les offres produit

### Recommandations prioritaires

1. **Ajouter `AggregateRating`** sur les produits si un système d'avis existe.
2. **Enrichir les `Offer`** avec `shippingDetails` et `returnPolicy` pour les Product rich snippets.
3. **Utiliser le vrai logo** de la marque dans les schemas `Organization` et `LocalBusiness`.

---

## 5. PERFORMANCE & CORE WEB VITALS — 75/100

### Points forts ✓

- **WebVitals tracking** intégré (LCP, INP, CLS, FCP, TTFB)
- **Next.js Image optimization** activée en production (`unoptimized: false` en prod)
- **Formats modernes** : AVIF + WebP configurés
- **`font-display: swap`** sur les 3 polices (Space Grotesk, Shrikhand, Caveat)
- **Fallback fonts** définis pour chaque police
- **`reactCompiler: true`** activé (optimisation du rendu React)
- **`optimizePackageImports`** pour `lucide-react` et `simple-icons`
- **`next/dynamic`** utilisé pour le lazy loading de composants lourds (CartDrawer, AdminPanels, etc.)
- **DNS prefetch + preconnect** vers Supabase
- **Bundle analyzer** disponible (`ANALYZE=true`)
- **Sentry tree-shaking** : `removeDebugLogging: true`
- **ISR** : les pages se régénèrent sans rebuild complet

### Points faibles ✗

- **Pas de `priority` sur les images LCP** : les `ProductCard` ont `imagePriority = false` par défaut → l'image au-dessus du fold charge en lazy
- **3 polices Google Fonts** chargées (Space Grotesk + Shrikhand + Caveat) → impact sur le FCP
- **Le composant `HomePinnedExperience`** est un client component lourd importé dynamiquement → risque de LCP élevé
- **Pas de `loading.tsx`** visible pour les routes dynamiques → blancs potentiels pendant le chargement
- **Le middleware fait un appel async** (`verifyAgeGateCookie` + `isAdminAuthorized`) sur chaque requête → latence TTFB potentielle
- **`NewProductsPopup`** chargé sans lazy sur toutes les pages → JS inutile si pas de nouveaux produits

### Recommandations prioritaires

1. **Passer `priority={true}`** sur la première image visible de la homepage et des pages catégorie.
2. **Réduire à 2 polices** : Caveat est-il vraiment nécessaire ? Chaque police ajoute ~20-40kb.
3. **Ajouter des fichiers `loading.tsx`** pour les routes dynamiques (/boutique/[category]/[slug], /blog/[slug]).
4. **Lazy-loader `NewProductsPopup`** avec `next/dynamic`.
5. **Cacher le résultat de `getAgeGateSigningKey`** (déjà fait ✓) mais optimiser le check HMAC pour réduire le TTFB.

---

## 6. MAILLAGE INTERNE & ARCHITECTURE — 76/100

### Points forts ✓

- **Architecture claire** :
  - `/` → `/boutique` → `/boutique/{catégorie}` → `/boutique/{catégorie}/{produit}`
  - `/blog` → `/blog/{slug}`
  - `/cbd-{ville}` (pages locales)
- **Fil d'Ariane** sur toutes les pages profondes (boutique, produits, blog, villes)
- **Footer riche** : liens vers toutes les catégories, toutes les villes, pages légales
- **Maillage inter-villes** : chaque page ville pointe vers 4 villes proches
- **Liens "Vous aimerez aussi"** entre catégories (cross-linking catégories)
- **Navigation produit** : prev/next entre produits de la même catégorie
- **Blog avec articles liés** (`BlogRelatedPosts`)

### Points faibles ✗

- **Pas de lien depuis les pages produit vers les pages villes** → opportunité manquée de maillage
- **Pas de lien depuis le blog vers les pages villes ou catégories** de manière systématique (seulement `BLOG_CATEGORY_SHOP_LINKS`)
- **Pas de breadcrumb sur la homepage**
- **Le maillage ville → catégorie** est limité : les pages villes montrent 4 produits mais ne lient pas assez les pages catégorie
- **Pas de "hub page"** centrale `/cbd-bretagne` qui structure le maillage local
- **Pas de page `/a-propos`** ou `/notre-histoire`** qui pourrait concentrer l'ancrage EAT (Expertise, Authority, Trust)

### Recommandations prioritaires

1. **Ajouter des liens contextuels depuis les articles de blog** vers les pages villes et catégories pertinentes.
2. **Créer une page `/a-propos`** ou `/notre-histoire` pour renforcer l'E-E-A-T.
3. **Sur chaque page ville, ajouter des liens directs vers les catégories** (`Voir toutes nos fleurs CBD`, etc.).
4. **Sur les pages produit, ajouter un encart "Livraison en Bretagne"** avec liens vers les pages villes.

---

## 7. STRATÉGIE MOTS-CLÉS CIBLES — 73/100

### Analyse mot-clé par mot-clé

#### 🔑 "cbd breton" — Note : 78/100

| Critère | Présent | Détail |
|---|---|---|
| Title de la homepage | ✓ (indirect) | *"Direct Producteur Bretagne"* mais pas "cbd breton" exact |
| Meta description homepage | ✓ | *"producteur breton"*, *"cultivé en Bretagne"* |
| Keywords meta | ✓ | `"cbd breton"` présent |
| H1 homepage | ? | Dépend du CMS, non vérifiable |
| Schema.org | ✓ | `knowsAbout: "Chanvre breton"`, `areaServed: "Bretagne"` |
| Contenu catégories | ✓ | Répété dans toutes les descriptions catégorie |
| URL dédiée | ✗ | **Pas de page `/cbd-breton`** |
| Blog content | ? | Dépend des articles publiés |

**Verdict :** Le mot-clé est bien distribué sémantiquement mais manque une page pilier dédiée `/cbd-breton`.

#### 🔑 "cbd naturel" — Note : 82/100

| Critère | Présent | Détail |
|---|---|---|
| Title homepage | ✓ | *"CBD Naturel Direct Producteur"* |
| Meta description | ✓ | *"CBD naturel en direct du producteur breton"* |
| Keywords meta | ✓ | Premier keyword listé |
| Schema.org | ✓ | `knowsAbout: "CBD naturel"` |
| Pages catégorie | ✓ | Décliné dans chaque description |
| Pages villes | ✓ | Présent dans chaque description ville |
| Footer | ✓ | *"CBD naturel, breton et légal"* |
| URL dédiée | ✗ | **Pas de page `/cbd-naturel`** |

**Verdict :** Meilleur ciblage des 3 mots-clés. Présent organiquement partout. Créer une landing page dédiée permettrait de viser le top 3.

#### 🔑 "cbd rennes" — Note : 86/100

| Critère | Présent | Détail |
|---|---|---|
| URL dédiée | ✓ | `/cbd-rennes` |
| Title page | ✓ | *"CBD Rennes | Les Chanvriers Bretons"* |
| Meta description | ✓ | *"CBD naturel breton livré à Rennes"* |
| Contenu éditorial | ✓ | 2 paragraphes uniques + intro produits |
| FAQ localisée | ✓ | 5 questions Rennes-spécifiques |
| Schema LocalBusiness | ✓ | `CityServiceJsonLd` avec Rennes |
| Maillage | ✓ | Liens depuis footer + villes proches |
| Sitemap | ✓ | Inclus avec priority 0.65 |

**Verdict :** Le meilleur ciblage des 3. Structure technique solide. Points d'amélioration : densifier le contenu (actuellement ~300 mots, viser 800+) et ajouter des avis clients localisés.

---

## PLAN D'ACTION PRIORITAIRE POUR RIVALISER

### 🔴 Urgence haute (impact fort, effort modéré)

| # | Action | Mot-clé impacté | Impact estimé |
|---|---|---|---|
| 1 | **Créer `/cbd-breton`** — page pilier 2000+ mots sur le CBD breton, culture, producteur, terroir | `cbd breton` | +15-25 positions |
| 2 | **Densifier `/cbd-rennes`** — passer de ~300 à 800+ mots, ajouter avis locaux, carte de livraison | `cbd rennes` | +5-10 positions |
| 3 | **Fixer les `lastModified`** dans le sitemap — utiliser de vraies dates | Tous | Crédibilité sitemap |
| 4 | **Ajouter `priority={true}`** sur le LCP de la homepage | Tous | CWV / ranking boost |
| 5 | **Enrichir le H1 de la homepage** avec "CBD naturel breton" | `cbd naturel`, `cbd breton` | +5-15 positions |

### 🟡 Urgence moyenne (impact moyen, effort modéré)

| # | Action | Mot-clé impacté | Impact estimé |
|---|---|---|---|
| 6 | Créer page hub `/cbd-bretagne` avec carte interactive | `cbd breton` | +10-15 positions |
| 7 | Ajouter 8 villes secondaires (Dinan, Morlaix, Auray, etc.) | GEO global | Couverture locale +40% |
| 8 | Créer 4 pages départements | GEO global | +sémantique locale |
| 9 | Structurer le blog en clusters thématiques | `cbd naturel` | Autorité thématique |
| 10 | Ajouter `AggregateRating` produits | Tous | Rich snippets CTR |
| 11 | Créer page `/a-propos` pour E-E-A-T | Tous | Trust signal |

### 🟢 Optimisations continues

| # | Action | Mot-clé impacté |
|---|---|---|
| 12 | Publier 2-3 articles blog/mois ciblant la longue traîne ("meilleure fleur CBD bretagne", "huile CBD naturelle avis") | `cbd naturel`, `cbd breton` |
| 13 | Relier systématiquement blog → pages villes avec ancres optimisées | `cbd rennes`, GEO |
| 14 | Obtenir des backlinks locaux (annuaires bretons, presse régionale, partenaires producteurs) | Tous |
| 15 | Mettre en place un Google Business Profile avec avis | `cbd rennes`, GEO |

---

## ANALYSE CONCURRENTIELLE — POSITIONNEMENT REQUIS

Pour rivaliser sur les 3 mots-clés cibles, le site doit :

| Axe | Niveau actuel | Niveau requis |
|---|---|---|
| **Contenu pilier** | 0 page dédiée pour "cbd breton" / "cbd naturel" | 1 page 2000+ mots par keyword principal |
| **Profondeur locale** | 10 villes | 18-20 villes + 4 départements + 1 hub régional |
| **Blog fréquence** | Variable | 2-3 articles/mois avec maillage interne |
| **Schema richness** | 7 types (très bien) | Ajouter Review/Rating produits |
| **E-E-A-T** | Fondateur mentionné | Page dédiée + certifications + témoignages |
| **Backlinks** | Non auditable ici | Stratégie netlinking local breton |
| **Core Web Vitals** | Correct mais améliorable | LCP < 2.5s, INP < 200ms, CLS < 0.1 |

---

*Rapport généré le 19 mars 2026 — Audit basé sur l'analyse du code source du projet Next.js.*
