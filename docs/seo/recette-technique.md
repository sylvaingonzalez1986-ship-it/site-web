# Recette SEO technique

## Avant, production du 19 novembre 2026

Relevé HTTP GET avec agent Googlebot, sans cookie de session ni JavaScript. Les trois pages répondent 200 et déclarent `index, follow`. Le tableau reprend les liens internes dédupliqués du HTML initial, ancres comprises. Les fiches recommandées et leur ordre peuvent évoluer avec le catalogue.

| URL | Titre | H1 |
| --- | --- | --- |
| [Accueil](https://www.leschanvriersbretons.com/) | CBD naturel en Bretagne \| Production et partenaires identifiés | Du CBD vrai. Au prix juste. |
| [Rennes](https://www.leschanvriersbretons.com/cbd-rennes) | CBD Rennes : livraison, origine et analyses \| Les Chanvriers Bretons | CBD à Rennes : livraison et traçabilité |
| [CBD breton](https://www.leschanvriersbretons.com/cbd-breton) | CBD breton : production, origine et traçabilité \| Les Chanvriers Bretons | CBD breton : quelle origine réelle ? |

Les trois canoniques utilisent `https://www.leschanvriersbretons.com` et le chemin de la page, avec l’origine seule pour l’accueil.

L’archive locale `output/seo-audit/production.json` du 11 septembre 2026 consignait 275 ms pour la requête de l’accueil et 337 ms pour celle du guide breton. Rennes ne figurait pas dans cette série. Ce sont deux durées ponctuelles de collecte HTTP. Core Web Vitals terrain, clics, impressions, position moyenne et commandes de ces pages au 19 novembre sont « non mesuré ». Le relevé Bing par requête fournit séparément les positions observées. [Recherche France](releve-recherche-fr.md)

| Page | Liens internes distincts dans le HTML initial |
| --- | --- |
| Accueil | `#main-content`, `/`, `/boutique`, `/profil/collection`, `/compte/connexion`, `/blog`, `/politique-cookies`, `#notre-philosophie`, `/boutique/fleurs-cbd/product-1775333841673`, `/arene/carnet/regular`, `/fidelite`, `/cbd-naturel`, `/cbd-pas-cher`, `/boutique/fleurs-cbd/product-1788596868038`, `/boutique/fleurs-cbd/product-1785787553459`, `/boutique/fleurs-cbd/product-1773870383362`, `/arene/placard`, `/arene?vue=classement`, `/reglement-jeu-promo` |
| Rennes | `#main-content`, `/`, `/boutique`, `/profil/collection`, `/compte/connexion`, `/blog`, `/politique-cookies`, `/cbd-naturel`, `/boutique/fleurs-cbd/product-1773870065552`, `/boutique/e-liquide-cbd/product-1787424055218`, `/boutique/fleurs-cbd/product-1773870383362`, `/boutique/fleurs-cbd/product-1773870609046`, `/boutique/fleurs-cbd`, `/boutique/e-liquide-cbd`, `/analyse-laboratoire-cbd`, `/a-propos`, `/cbd-vitre`, `/cbd-fougeres`, `/cbd-saint-malo`, `/cbd-redon` |
| CBD breton | `#main-content`, `/`, `/boutique`, `/profil/collection`, `/compte/connexion`, `/blog`, `/politique-cookies`, `/a-propos`, `/cbd-naturel`, `/boutique/fleurs-cbd/product-1775333841673`, `/cbd-rennes`, `/cbd-quimper`, `/cbd-brest`, `/cbd-vannes`, `/cbd-lorient`, `/cbd-saint-brieuc`, `/cbd-saint-malo`, `/cbd-fougeres`, `/cbd-vitre`, `/cbd-redon`, `/analyse-laboratoire-cbd` |

`/cbd-bretagne` ne correspond à aucune route bretonne statique ou entrée de la liste locale du dépôt. Le GET Googlebot sur le site public et sur l’intégration renvoie un 200 transport avec fallback 404 et `noindex`. L’URL ne représente aucune autre page bretonne publiée.

Le pied de page rend un squelette jusqu’au chargement du magasin dans le navigateur. Ses liens régionaux et légaux n’apparaissaient donc pas dans le relevé de l’accueil. Sur les pages locales et le guide breton, le contenu éditorial et ses liens restent visibles dans le HTML initial.

## Catalogue et indexation

| Vérification | Avant | Après, vérifié dans le code |
| --- | --- | --- |
| Contrôle d’âge | Pour les GET document, l’accueil, la boutique et le blog redirigent les visiteurs sans cookie valide. Les agents reconnus reçoivent la page. Les destinations éditoriales régionales ne passent pas par ce contrôle. | Les redirections d’âge portent `Cache-Control: private, no-store, max-age=0`. Le contrôle d’âge et le consentement aux cookies restent distincts. La configuration effective du CDN est à vérifier après mise en ligne. |
| Catégorie fleurs | 200, canonique autoréférente et `index, follow` observés en production. Les cartes contiennent des liens HTML vers les fiches. | Canonique et Open Graph utilisent l’origine commune du site. Le lien éditorial « Vérifier l’origine bretonne d’une fleur » mène à `/cbd-breton`. |
| Alias et requêtes | `/boutique/alimentaire-cbd` est un 308 déclaré dans Next vers `/boutique/tisane-cbd`. Les filtres de boutique sont des états client et partagent la canonique de `/boutique`. Les variantes sont des choix sur la fiche. | Les variantes restent sur l’URL de la fiche. Vérifier le statut HTTP effectif d’une mauvaise catégorie produit et d’un SKU inconnu, car le streaming Next peut envoyer le statut avant la résolution du contenu. |
| Catalogue et XML | Le sitemap inclut les routes locales, les catégories peuplées et les références publiques. Une catégorie vide porte `noindex, follow` via son layout. Une rupture temporaire reste publiable. Les sources CMS et statiques sont concaténées sans dédoublonnage d’URL. | Vérifier que `robots.txt` annonce le sitemap canonique, puis tester les statuts et canoniques des entrées. Un doublon CMS exact est un risque de configuration, sans occurrence établie dans la capture avant. |
| Prix et rupture | La fiche affichait le prix de base même avec des variantes, parfois toutes indisponibles. Les offres JSON-LD contenaient les prix des formats. | Le prix visible de chaque format correspond à son Offer. Les formats épuisés restent visibles et désactivés. Quand aucun format n’est achetable, l’ajout au panier est désactivé et le prix de base est omis. |
| Document d’analyse | Le bouton montait la modale. Le lien vers le PDF était absent du HTML initial de la fiche. | Le lien est un `a[href]` validé et ouvre la modale au clic ordinaire après hydratation. Le navigateur conserve ses gestes de navigation natifs. Sans document valide, la fiche indique qu’aucune analyse n’est publiée. |
| JSON-LD | `OnlineStore`, `WebSite`, `BreadcrumbList` et `Product` observés sur les deux fiches relevées. Les offres référencent le vendeur global. Le nom de la ferme pouvait servir de repli pour un partenaire introuvable. | `Product` omet l’attribution si le partenaire est inconnu. `Offer` réutilise les formats publiés et les règles de stock du sélecteur, avec devise EUR. Le document d’analyse référence la même URL validée que le lien HTML. |

## Vérifications locales

- 45 tests ciblés passent dans cinq fichiers avec Vitest. Ils couvrent le balisage produit, les catégories, les dates du sitemap, les formats achetables et la politique middleware. ESLint passe sur les fichiers techniques modifiés.

### Réponses HTTP de l’intégration

Relevé sur le build de production local `127.0.0.1:3189` avec GET, `Accept: text/html` et redirections désactivées dans le client de test. Le CDN de production ne faisait pas partie de ce test local.

- Visiteur sans cookie, l’accueil, la boutique et la fiche Small Bud Mix renvoient 307 vers `/age-gate?next=…`, avec `Cache-Control: private, no-store, max-age=0`. Rennes et le guide CBD breton renvoient 200. L’écran d’âge renvoie 200 avec `noindex, nofollow`. Une confirmation réussie émet le cookie d’âge. Avec ce cookie, l’accueil, la boutique et la fiche renvoient 200, et l’écran d’âge renvoie 307 vers la destination avec la même directive de cache.
- Sans cookie, Googlebot reçoit les trois pages bretonnes et le catalogue en 200. OAI-SearchBot reçoit aussi l’accueil, la boutique et la fiche en 200. `/boutique?categorie=fleurs&culture=outdoor` reçoit la même canonique HTTPS unique que `/boutique`, sans paramètres.
- L’alias `/boutique/alimentaire-cbd` renvoie un véritable 308 vers `/boutique/tisane-cbd`. La catégorie cible est vide dans le catalogue testé et répond 200 avec `noindex, follow`. La catégorie fleurs renvoie 200 avec une canonique autoréférente et `index, follow`.
- Pour `/boutique/huiles-cbd/product-1775333841673`, la production actuelle et le build local renvoient tous deux HTTP 200 avec une redirection HTML immédiate vers `/boutique/fleurs-cbd/product-1775333841673`, une canonique sur la fiche cible et `noindex, follow`. La fiche cible renvoie HTTP 200, `index, follow` et une canonique autoréférente.
- Pour `/boutique/fleurs-cbd/produit-introuvable-recette-seo`, la production actuelle et le build local renvoient HTTP 200 suivi du fallback 404 Next dans le flux, avec `noindex, nofollow` et le `noindex` ajouté par Next. C’est un comportement préexistant. Un statut HTTP 404 ou 308 sur ces cas dépend d’une résolution avant le démarrage du flux.
- `robots.txt` et `sitemap.xml` renvoient 200. Le premier annonce le sitemap sur le domaine HTTPS canonique. Le sitemap comporte 53 URL uniques sur ce seul domaine, dont l’accueil et les deux pages bretonnes protégées. Il ne comprend ni contrôle d’âge, ni alias alimentaire, ni paramètres de filtre.
- Les fiches Small Bud Mix, Sour Space Candy et Heaven exposent `OnlineStore` comme entité marchande, `BreadcrumbList` et `Product` dans le HTML. Le dernier élément du fil correspond à la canonique et chaque `Offer` référence le vendeur. Small Bud Mix à 1 € et Sour Space Candy à 2,50 € sont `InStock`. Heaven à 2,50 € est `OutOfStock` et reste indexable. Aucune variante n’est publiée sur les 20 fiches du catalogue testé. Le cas des variantes épuisées est couvert par les tests d’offres, sans exemple publié observé.
- Sour Space Candy est attribuée à Ty Kanna. Le document d’analyse a la même URL dans le lien HTML et dans `Product.subjectOf`. Une lecture partielle du fichier public répond HTTP 206, `application/pdf`, avec la signature `%PDF-1`. Small Bud Mix indique l’absence d’analyse publiée.

## Recette mobile finale

Build `npm.cmd run build` réussi avec contrôle TypeScript et génération de 151 pages statiques. Production locale testée avec `next start`, catalogue configuré, Chrome mobile et un nouveau contexte invité à chaque largeur. L’entrée de recherche a été simulée en ouvrant directement son URL cible. Les images distantes ont été chargées via l’optimiseur public existant pendant le test final, car le DNS64 de la machine empêche l’optimiseur Next local de les récupérer. HTML, JavaScript, navigation et panier provenaient du build local.

| Parcours effectivement réalisé | 320 px | 390 px |
| --- | --- | --- |
| Entrée sur la catégorie fleurs, confirmation de majorité, refus des cookies facultatifs, ouverture de Small Bud Mix | Réussi | Réussi |
| Lecture de la mention « référence maison », de la localisation et de l’absence d’analyse | Réussi | Réussi |
| Guide naturel → sélection en stock → exemple Sour Space Candy → fiche Ty Kanna, Morbihan → analyse publique dans la modale | PDF HTTP 200 | PDF HTTP 200 |
| Fermeture du rapport, ajout d’un article et ouverture du panier invité | 1 × 2,50 € TTC | 1 × 2,50 € TTC |
| Ferme → Heaven, fiche accessible avec bouton de rupture désactivé | Réussi | Réussi |

La grille des coordonnées débordait de 18 px à 320 px et un clic réel pouvait atteindre le lien voisin de Heaven. Après correction du dimensionnement et du retour à la ligne de l’adresse électronique, aucun débordement horizontal ni erreur JavaScript pendant les deux parcours. La vente s’arrête au panier. [Capture du panier à 320 px](panier-mobile-2026-11-19.png)

La suite intégrée compte **73 tests réussis dans 14 fichiers**, dont le rendu serveur des variantes disponibles ou épuisées, le balisage des offres, l’observatoire, les règles des robots, IndexNow et le panier. ESLint ciblé et `git diff --check` passent. Les modifications de jeu présentes simultanément dans le répertoire de travail sont hors du commit SEO.
