# Améliorations locales du Marché

**23 novembre 2026 · Base de travail `c0f4a8e1` · Next.js App Router 16.4.6**

## À essayer

Ouvrir [Mes voisins en Greenhouse sur la version locale](http://localhost:3000/boutique?selection=neighbors&culture=greenhouse), choisir « Voir » sur une carte, puis « Retour aux résultats ». Essayer aussi « Suivant » en bas de fiche avant de revenir. Le lien de retour garde la première carte du parcours. En accès direct sur une fiche, l’action propose sa catégorie. Le fil d’Ariane permet toujours de remonter la hiérarchie.

| Même fiche, Pineapple Mimosa, 1440 × 900 | Avant | Après |
|---|---|---|
| Sous le panneau d’achat, à la même position dans la fenêtre | [Page publique](fiche-1440-avant.webp) | [Version locale, arrivée depuis Mes voisins · Greenhouse](fiche-1440-apres.webp) |
| Paiement par carte sur profil fictif | [E-mail invalide pendant l’audit](../audit-2026-11-23/paiement-ordinateur-fixture.jpg) | [Champ signalé et correction proposée](paiement-1440-email-invalide.png) |

## Lots réalisés

**Retour et historique.** Le nom, « Voir », « Choisir format » et le lien des avis partagent un constructeur d’URL. La provenance décrit le groupe, ses filtres, la catégorie ou les identifiants du portrait et de la région, ainsi que le produit de départ. Le serveur écarte les paramètres ambigus et les associations producteur/surface invalides. Le pager garde sa portée « même catégorie » et l’entrée initiale. Les deux actions de la fiche ont désormais des destinations explicites, « Retour aux résultats » ou « Voir les fleurs CBD », et « Accueil du Marché ». [Contexte et liens](../../../src/lib/shop-origin.ts) · [Validation sur le catalogue](../../../src/lib/shop-product-route.ts) · [Carte](../../../src/components/ProductCard.tsx) · [Actions de carte](../../../src/components/ProductCardActions.tsx) · [Fiche](../../../src/app/boutique/%5Bcategory%5D/%5Bslug%5D/page.tsx)

**Reprise de lecture.** Une activation dans l’onglet enregistre le contrôle de départ et son décalage dans la page ou le panneau. L’identifiant de reprise est propre à cette activation. L’historique Next est préservé et le stockage de session garde au plus 24 instantanés. Un lien ouvert ailleurs possède déjà une destination et une ancre de carte utilisables. Les portraits et régions ont des URL propres dans le Marché. Précédent, Suivant et Échap s’appuient sur les entrées d’ouverture du panneau. Le lien explicite suit une destination construite, y compris après plusieurs fiches. [Lien de navigation](../../../src/components/boutique/ShopProductLink.tsx) · [Défilement et focus](../../../src/components/boutique/ShopResultsRestore.tsx) · [Historique des panneaux](../../../src/lib/shop-panel-history.ts) · [Dialogue](../../../src/components/ui/AppDialog.tsx) · [Régions](../../../src/components/boutique/RegionProducerShowcase.tsx)

**Rendu initial et référencement.** Le Marché reçoit les filtres dès le rendu serveur. Sa rotation utilisait déjà `connection()` à chaque requête. Les données structurées des fiches lisaient déjà `headers()` pour le nonce CSP et le manifeste de référence ne contenait aucune fiche prérendue. La lecture du contexte réutilise le catalogue public mis en cache. Le sas restaure le fragment des avis. Pour une correction de catégorie effectuée après le début du rendu HTML, Next peut émettre une redirection dans la page. L’ancre d’avis est alors reprise dans le même onglet pour le même produit. Le mécanisme expire en une minute. URL canonique, Open Graph, données structurées et les 19 URL produit du sitemap ont été contrôlées sans paramètre de provenance. [Observations sur les liens](liens-et-referencement.json) · [Marché](../../../src/app/boutique/page.tsx) · [Sas d’âge](../../../src/components/AgeGatePageClient.tsx) · [Reprise des avis](../../../src/components/boutique/ProductReviewAnchor.tsx)

**Accès aux produits.** Le raccourci proche des filtres reprend le nombre de cartes disponibles dans la sélection. Son activation place le focus sur le titre de résultats sous l’en-tête fixe. En mode régional, il mène à la carte avant le choix d’une région, puis aux produits de la région sélectionnée. Une région vide affiche son état et reste accessible. Les portraits restent en place. [Raccourci sur téléphone](catalogue-390-raccourci.png) · [Marché et compteurs](../../../src/components/boutique/BoutiquePageClient.tsx) · [Sélection régionale partagée avec la grille](../../../src/lib/region-catalogue.ts)

**Panier et paiement.** Au clic sur le moyen de paiement choisi, l’interface contrôle les coordonnées requises pour le domicile ou le relais. Le visiteur retrouve la première erreur au clavier et peut reprendre avec son panier. Le serveur conserve ses propres contrôles. Le retrait du dernier article produit une annonce, place le focus sur l’action de l’état vide et permet de fermer le tiroir avec Échap. À 0 €, les deux moyens de paiement indiquent que le montant requis doit être positif. Le GET de configuration Bitcoin indiquait `enabled: false` en local et `true` sur le site public. Les tests de création ont utilisé des interceptions, y compris pour Bitcoin. [Recette panier, carte et Bitcoin](catalogue-paiement-panier.json) · [Panier vide](panier-390-vide.png) · [Validation](../../../src/lib/checkout-delivery-validation.ts) · [Panier](../../../src/components/CartDrawer.tsx) · [Paiement](../../../src/components/CheckoutButton.tsx)

**Mesure.** Trois événements sont disponibles en prévisualisation de développement sur une adresse locale avec consentement analytique et activation explicite. Ils couvrent l’impression qualifiée, l’ouverture de fiche et l’ajout réussi, avec distinction de la variante. La transmission des nouveaux événements en production est désactivée. Le plan Vercel et le crédit du compte n’ont pas été vérifiés. Le mode de prévisualisation n’envoie aucun événement à Vercel. Le paramètre de reprise est retiré de l’URL des événements Vercel existants. [Activation locale, propriétés, limites et tarifs](../mesure-locale.md) · [Recette indépendante](mesure-et-navigation-independantes.json) · [Collecte locale](../../../src/lib/shop-measurement-preview.ts) · [Consentement et branchement](../../../src/components/VercelAnalytics.tsx)

## Lecture commerciale à préparer

| Diagnostic envisagé | Population et mesure nécessaires |
|---|---|
| Produit peu exposé | Impressions qualifiées / visites éligibles de sa liste avec consentement. Ventiler par rang, onglet, appareil et jours où la référence était commandable. |
| Produit exposé, peu ouvert | Visites de liste avec ouverture du produit / visites de liste avec impression qualifiée du produit. Examiner séparément les clics très rapides et les achats directs depuis la carte. |
| Fiche ouverte, peu d’ajouts | Sessions avec ajout réussi depuis la fiche / sessions avec fiche achetable. Les ouvertures depuis le Marché ne couvrent pas les entrées directes. Un futur export de vues consenties par fiche est nécessaire. |
| Produit ajouté, peu acheté | À prévoir séparément, sur la même cohorte consentie et à fenêtre fixée, par exemple sept jours. Compter les commandes confirmées dédupliquées contenant la référence et documenter kits, paniers mixtes, annulations et couverture. Une redirection de paiement seule ne suffit pas. |

Lire les effectifs sur des périodes comparables, par exemple deux fenêtres de 28 jours. Rapporter l’âge depuis la mise en ligne lorsqu’il est connu, les jours de disponibilité, la source et le stock constaté. Les achats agrégés de l’audit et les événements locaux de recette ne constituent pas une même population. Aucune attribution persistante au paiement n’a été ajoutée. Deux constats annexes ont été revérifiés le 23 novembre. Pineapple Mimosa reste achetable sur le site et absente du flux de découverte. Les deux anciennes fiches e-liquides affichent « Produit introuvable » et la catégorie est vide. Le lot ne modifie ni le flux, ni les références, ni les prix, ni la rotation. [Ventes de référence](../audit-2026-11-23/ventes-agregees.csv) · [Flux public](https://www.leschanvriersbretons.com/feeds/openai-products.csv)

Pour une référence dont les volumes sont faibles, publier les effectifs bruts avec les taux, prolonger la période si nécessaire et laisser la cause ouverte. Une rupture, un autre rang de présentation ou une variation du trafic peuvent changer ces taux.

## Recette et résultats

Chrome a été utilisé en 1440 × 900 et en 390 × 844 avec émulation tactile. Les données de catalogue correspondent au 23 novembre et les montants de paiement proviennent de fixtures.

| Parcours | Résultat observé |
|---|---|
| Mes voisins · Greenhouse → Pineapple Mimosa → retour → Skunk → retour | Quatre résultats retrouvés. Le focus revient sur « Voir » pour le premier produit et sur le titre pour le second, à 0 px d’écart aux deux tailles. Le bouton Précédent du navigateur donne 0 px sur ordinateur et 2 px sur mobile. Suivant rouvre la fiche. [Trace par écran](mesure-et-navigation-independantes.json) |
| Deux onglets, nouvel onglet, rechargement et pager | Les deux listes conservent respectivement quatre résultats voisins et cinq copains. Clic milieu natif sur ordinateur et lien ouvert dans un autre onglet en émulation tactile. La recharge conserve le contexte. Le pager de A vers B revient sur A, à 0 px lorsqu’un instantané existe. [Trace de navigation](mesure-et-navigation-independantes.json) |
| Portrait, région → portrait, Échap | Le contrôle retrouve sa position à 7–13 px près. Sur ordinateur, le retour explicite à Bretagne est stable à +10 px entre 650 ms et 2 s. Sur téléphone, Échap ferme d’abord le portrait et rend le focus à son déclencheur, puis ferme la région. Un portrait ouvert par son URL se ferme sur place. [Portrait sur ordinateur](navigation-producteur-restaure.png) · [Région sur téléphone](navigation-region-mobile-restauree.png) · [Scénarios complémentaires](navigation-panneaux-complement.json) |
| Carte retirée, ordre changé, image tardive | Cake Brulée passe du quatrième au premier rang. Son lien reste à 428 px du haut sur ordinateur et à 400 px sur téléphone, y compris après l’image retardée. Si la carte est absente, le titre « Produits des voisins » reçoit le focus. Une touche interrompt la tentative en attente. [Mesures](cartes-et-images.json) · [Script de reproduction](../../../scripts/check-boutique-resultats.mjs) |
| Avis, sas d’âge, ancienne catégorie, fiche directe | Cinq cas par écran. L’ancre des avis et le retour filtré survivent au sas, à la correction de catégorie et à la recharge. L’adresse canonique seule et un producteur inconnu proposent « Voir les fleurs CBD ». Les URL canoniques, Open Graph et Product concordent. [Dix observations et sitemap](liens-et-referencement.json) |
| Raccourci, filtres, sélection vide | Le bouton comptait 2 produits maison et 8 voisins avant le filtre Greenhouse. Son activation a placé le titre à 112 px du haut aux deux tailles. En Bretagne, il mène aux 9 produits, à 12 px du bord haut du panneau mobile. L’Île-de-France vide a été vérifiée sur ordinateur. [Relevés](catalogue-paiement-panier.json) |
| Paiement et retrait clavier du dernier article | Zéro création demandée lors des erreurs. Après correction, une requête interceptée pour la carte à domicile et une pour Bitcoin en relais sur chaque écran. Après le retrait, une annonce et focus sur « Découvrir les produits ». Maj+Tab mène à la fermeture du panier et Échap rend le focus à « Panier ». [Relevés](catalogue-paiement-panier.json) |
| Consentement, visibilité, ajout confirmé | Aux deux dimensions, zéro impression avant accord ou hors écran, puis une après défilement. Sur un stock d’une unité, deux tentatives ont donné un ajout et un seul événement. Zéro émission après retrait du consentement. Ces essais emploient les modules du site dans une page de test locale. [Traces et conditions](mesure-et-navigation-independantes.json) |

**Validation de la livraison.** Vitest a exécuté 114 tests ciblés dans 13 fichiers. Ils passent, ainsi qu’ESLint sur les fichiers JavaScript/TypeScript de la livraison et le typage de Next. La compilation optimisée Next.js 16.4.6 a abouti. Une instance locale de ce build lancée avec `next start` a servi en HTTP 200 les quatre cartes « Mes voisins · Greenhouse » dans le HTML initial, puis la fiche Pineapple Mimosa avec son lien de retour complet et son URL canonique propre. [Contrôle du build et du référencement](liens-et-referencement.json)

<details>
<summary>Fichiers de réalisation et de test par lot</summary>

| Emplacement | Fichiers |
|---|---|
| `src/app/boutique/` | `page.tsx`, `[category]/page.tsx`, `[category]/[slug]/page.tsx`, `[category]/[slug]/layout.tsx` |
| `src/lib/` — navigation et catalogue | `boutique-helpers.ts`, `region-catalogue.ts`, `shop-origin.ts` et son test, `shop-product-route.ts`, `shop-panel-history.ts` et son test |
| `src/components/` — entrées et sas | `ProductCard.tsx`, `ProductCardActions.tsx`, `AgeGatePageClient.tsx` et son test, `NewProductsPopup.tsx` |
| `src/components/boutique/` — navigation | `ShopProductLink.tsx`, `ShopResultsRestore.tsx`, `ProductReviewAnchor.tsx`, `BoutiquePageClient.tsx` et sa feuille CSS, `ProducerBar.tsx`, `ProducerDetailPanel.tsx`, `ProducerTcgCard.tsx`, `ProducerTcgModal.tsx`, `ProducerTcgShowcase.tsx`, `RegionProducerShowcase.tsx`, `RegionCarouselOverlay.tsx`, `RegionMarket.module.css` |
| Dialogues | `src/components/ui/AppDialog.tsx`, `src/hooks/useOverlayHistory.ts` |
| Paiement et panier | `src/components/CartDrawer.tsx` et sa feuille CSS, `src/components/CheckoutButton.tsx`, `src/lib/checkout-delivery-validation.ts` et son test |
| Mesure | `src/components/VercelAnalytics.tsx`, `src/components/boutique/ProductDetailActions.tsx`, `src/lib/shop-measurement.ts` et son test, `src/lib/shop-measurement-preview.ts`, `src/lib/vercel-analytics-privacy.ts` |
| Recette reproductible | `scripts/check-boutique-resultats.mjs`, les traces et captures de ce dossier, ainsi que `docs/boutique/mesure-locale.md` |

</details>

## Avant une mise en production

1. Examiner les captures et rejouer le parcours sur la version locale. Valider les libellés, la position au retour et les deux niveaux région/portrait.
2. Sur une préproduction avec comptes et prestataires de test, contrôler la connexion réelle, le retour sur le panier, les réponses du prestataire et le geste système sur iOS et Android.
3. Après accord, déployer le lot de navigation et de panier avec la prévisualisation analytique désactivée. Recontrôler le sitemap, un lien partagé derrière le sas, les retours de panneau et les validations de saisie. Aucune migration de données n’est requise.
4. Prendre séparément la décision sur la mesure distante après examen du plan, du quota partagé, du coût maximal et de la couverture du consentement. Le comptage serveur attribué des achats relève d’un autre lot.
