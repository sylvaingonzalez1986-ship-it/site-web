# Guide d'Optimisation SEO - Images

## Les Chanvriers Bretons - Avril 2026

## 🎯 Objectif

Optimiser toutes les images du site pour :

- Améliorer le référencement images Google
- Renforcer l'accessibilité
- Améliorer les Core Web Vitals

---

## ✅ ACTIONS PRIORITAIRES PAR PAGE

### Page d'accueil (/)

**Images à optimiser :**

```tsx
// ❌ AVANT - Sans alt ou alt générique
<Image src="/hero-cbd.jpg" alt="CBD" />

// ✅ APRÈS - Alt descriptif avec keywords naturels
<Image
  src="/hero-cbd.jpg"
  alt="Fleurs de CBD naturel cultivées en Bretagne par Les Chanvriers Bretons, sans pesticide"
  width={1200}
  height={800}
  priority
  fetchPriority="high"
/>
```

**Héros principal :**

- Alt: "Fleurs de CBD naturel cultivées en Bretagne par Les Chanvriers Bretons, sans pesticide"
- Attributs: `priority` + `fetchPriority="high"`

**Section produits vedettes :**

- Alt: "[Nom produit] - CBD naturel breton [type: fleur/huile/résine], cultivé sans pesticide"
- Attributs: `loading="lazy"` (sauf 2 premières images)

**Photo producteur/équipe :**

- Alt: "Sylvain, chanvrier breton, fondateur des Chanvriers Bretons dans sa ferme"

---

### Pages Produits (/boutique/[category]/[slug])

**Image principale produit :**

```tsx
<Image
  src={product.imageUrl}
  alt={`${product.name} - ${getCategoryLabel(product.category)} CBD naturel breton, direct producteur, ${product.thcContent}% THC`}
  width={800}
  height={800}
  priority
  quality={90}
/>
```

**Galerie photos (si applicable) :**

```tsx
{
  product.gallery?.map((img, index) => (
    <Image
      key={img.id}
      src={img.url}
      alt={`${product.name} - Vue ${index + 1} - Détail ${img.description || "fleur CBD"}`}
      width={600}
      height={600}
      loading={index < 2 ? "eager" : "lazy"}
    />
  ));
}
```

**Badges/Labels (Bio, French, etc.) :**

```tsx
<Image
  src="/badge-bio.svg"
  alt="Logo Agriculture Biologique - Chanvre cultivé selon principes bio"
  width={60}
  height={60}
  loading="lazy"
/>
```

---

### Pages Catégories (/boutique/[category])

**Vignettes produits :**

```tsx
// Dans ProductCard.tsx
<Image
  src={product.imageUrl}
  alt={`${product.name} - ${product.category} CBD naturel, ${product.weight}g, cultivé en Bretagne`}
  width={400}
  height={400}
  loading={imagePriority ? "eager" : "lazy"}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

---

### Page Blog (/blog et /blog/[slug])

**Image en-tête article :**

```tsx
<Image
  src={post.featuredImage}
  alt={post.imageAlt || `${post.title} - Guide CBD par Les Chanvriers Bretons`}
  width={1200}
  height={630}
  priority
  quality={85}
/>
```

**Images dans le contenu :**

```tsx
// Toujours avec contexte descriptif
<Image
  src="/guide-dosage-cbd.jpg"
  alt="Tableau de dosage huile CBD selon poids corporel et effet recherché - Guide pratique"
  width={800}
  height={500}
  loading="lazy"
/>
```

---

### Page CBD Naturel (/cbd-naturel)

**Illustrations sections :**

```tsx
<Image
  src="/culture-sol-vivant.jpg"
  alt="Culture de chanvre sur sol vivant en Bretagne - Méthode organique sans pesticide"
  width={600}
  height={400}
  loading="lazy"
/>

<Image
  src="/terroir-breton.jpg"
  alt="Paysage breton avec champs de chanvre CBD - Terroir naturel Les Chanvriers Bretons"
  width={600}
  height={400}
  loading="lazy"
/>
```

---

## 📋 CHECKLIST VALIDATION

Pour chaque image du site, vérifier :

- [ ] **Alt text descriptif** : 10-125 caractères, contexte précis
- [ ] **Keywords naturels** : Intégrer 1-2 keywords pertinents sans forcer
- [ ] **Dimensions explicites** : width + height pour éviter CLS
- [ ] **Loading optimal** :
  - `priority` + `fetchPriority="high"` pour hero/above-fold
  - `loading="lazy"` pour below-fold
- [ ] **Format optimisé** : AVIF > WebP > JPEG (Next.js gère auto)
- [ ] **Qualité adaptive** : `quality={85-90}` pour produits, {75-80} autres
- [ ] **Sizes attribute** : Pour images responsive
- [ ] **Pas de texte important dans l'image** : Accessibilité

---

## 🎨 FORMULES ALT OPTIMALES PAR TYPE

### Produit

`[Nom produit] - [Type: fleur/huile/résine] CBD [caractéristique unique], [poids/volume], [origine: breton/français]`

**Exemple :**
`Amnesia Haze - Fleur CBD premium 15%, 10g, cultivée en Bretagne sans pesticide`

### Catégorie/Collection

`Collection/Catégorie [nom] - CBD naturel breton, [nombre] produits, direct producteur`

**Exemple :**
`Huiles CBD Full Spectrum - 5 huiles naturelles bretonnes, extraction douce`

### Guide/Tutoriel

`[Titre guide] - [Type de visuel: infographie/schéma/photo] - Guide CBD Les Chanvriers Bretons`

**Exemple :**
`Comment doser l'huile CBD - Tableau de dosage par poids - Guide pratique`

### Terroir/Producteur

`[Sujet] - [Contexte géographique] - [Méthode/Caractéristique] Les Chanvriers Bretons`

**Exemple :**
`Culture de chanvre en plein champ - Bretagne - Méthode organique sans pesticide`

---

## ⚡ IMPACT SEO ATTENDU

**Après optimisation complète :**

- +25-40% de trafic via Google Images
- Meilleur CTR sur résultats enrichis
- Improved accessibility score
- Réduction CLS (Cumulative Layout Shift)
- Éligibilité featured snippets avec images

---

## 🔧 OUTILS DE VALIDATION

1. **Chrome DevTools Lighthouse** : Accessibility audit
2. **Google Search Console** : Rapport "Expérience sur la page"
3. **alt text validator** : Extension navigateur
4. **WebAIM** : Wave accessibility checker

---

## 📝 TEMPLATE CODE À RÉUTILISER

```tsx
// components/OptimizedImage.tsx
import Image from "next/image";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      quality={priority ? 90 : 85}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className={className}
    />
  );
}
```

---

**Date de dernière mise à jour :** Avril 2026
**Responsable :** Équipe SEO Les Chanvriers Bretons
