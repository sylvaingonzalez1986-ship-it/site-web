# Référencement des fleurs et de la ferme

**19 novembre 2026 · Branche `seo/origine-cbd-france` · À valider avant publication.** Sur Bing France, l’accueil est le premier résultat du domaine sur « Bretagne CBD » (2e), « CBD Bretagne » (3e) et « CBD breton » (4e). Le domaine est hors des dix résultats examinés pour les six expressions nationales. Le relevé distingue les résultats Bing et Brave réellement observés, les limites d’accès Google et les observations issues d’autres recherches publiques. [Relevé par requête et par moteur](releve-recherche-fr.md)

## Arbitrage

La cible à suivre est la première position organique en France sur les six expressions nationales, moteur par moteur. Les citations avec lien et les commandes issues de la recherche ont leurs propres indicateurs.

Les URL actuelles ci-dessous sont des pages existantes. Les positions entre parenthèses sont les seules mesures de classement utilisées dans cet arbitrage.

| Requête | Intention retenue | URL actuelle | URL cible | Preuve | Action |
| --- | --- | --- | --- | --- | --- |
| CBD naturel | Choisir une référence et vérifier ce que « naturel » recouvre | `/cbd-naturel`, `/`, `/cbd-rennes` | `/cbd-naturel` | Boutiques et guide sur le naturel et la synthèse dans les cinq premiers Bing. L’observatoire relie déjà les références aux producteurs et aux documents. | Garder la sélection en stock accessible dès l’introduction, relier deux fiches à la méthode de vérification. La présence de la définition à Rennes ne démontre pas une concurrence mesurable. |
| CBD français | Acheter en connaissant l’origine déclarée | `/`, `/boutique/fleurs-cbd` | `/boutique/fleurs-cbd` pour les fleurs | Boutiques dans les trois premiers Bing et Brave. Le catalogue distingue une ferme en Ille-et-Vilaine et des producteurs partenaires nommés. | Présenter l’offre française de fleurs, le vendeur, la localisation du producteur et le départ du colis sur le parcours. |
| fleurs de CBD françaises | Comparer les producteurs, les formats et les prix | `/boutique/fleurs-cbd` | Même URL | 18 fleurs dans le catalogue public lors de l’observation, dont 14 avec lien d’analyse. | Conserver la grille de produits et leurs fiches canoniques, y compris en rupture saisonnière. |
| CBD producteur | Identifier le cultivateur et acheter sa récolte | `/a-propos`, `/boutique` | `/a-propos` → fiche de fleur | Un annuaire de fermes arrive premier dans le relevé Brave, puis une exploitation. Les résultats Bing incluent des boutiques. | Présenter Sylvain et conduire vers sa référence maison, puis vers les partenaires du Marché. |
| producteur de CBD français | Situer une ferme et vérifier son rôle | `/a-propos`, sélecteur de producteurs du Marché | `/a-propos` | Le site identifie Sylvain et sa ferme. La question sur le fournisseur professionnel dépasse l’offre établie. | Rendre le nom, le département et le lien vers les fleurs lisibles dans le HTML. |
| CBD direct producteur | Acheter auprès de celui qui cultive | `/boutique`, `/a-propos` | `/a-propos` → récolte maison | Le vendeur commercialise aussi les fleurs de Ty Kanna et d’autres fermes. | Signaler sur la fiche la relation maison ou partenaire et afficher le vendeur. |
| CBD breton | Trouver la ferme, acheter ou vérifier une origine régionale | `/` (4e), `/boutique` (6e), `/cbd-breton` (9e) sur Bing | `/` pour l’entrée régionale, `/cbd-breton` pour l’origine | Trois URL distinctes dans la même SERP. | Préserver les trois destinations et les titres. Ajouter le lien éditorial vers le guide breton depuis l’accueil et la catégorie. |
| CBD Bretagne | Trouver un acteur ou une offre en Bretagne | `/` (3e Bing), `/cbd-breton` | `/` | L’accueil se classe et oriente déjà vers le Marché. | Garder sa canonique et son titre régional. Mesurer aussi `/boutique`. |
| Bretagne CBD | Trouver un vendeur ou une production régionale | `/` (2e Bing), pages locales selon la ville | `/` | L’accueil est la page la mieux placée observée. Rennes décrit une livraison. | Conserver le parcours local et relever les pages d’arrivée séparément. |

## Deux produits et un rapport

Le catalogue public du 19 novembre contient 20 références, dont deux maison. La fiche de **Small Bud Mix**, vendue à 1 €/g au relevé, est rattachée aux Chanvriers Bretons en Ille-et-Vilaine et ne propose pas d’analyse. Celle de **Sour Space Candy**, vendue à 2,50 €/g, identifie Ty Kanna dans le Morbihan. Les Chanvriers Bretons vendent ces deux fleurs et expédient les commandes de Bretagne. **Heaven**, référence maison à 2,50 €/g, est en rupture et son rapport reste consultable. Les lieux précis de culture et de transformation de ces lots restent à documenter lorsqu’ils ne figurent pas sur la fiche. [Small Bud Mix](https://www.leschanvriersbretons.com/boutique/fleurs-cbd/product-1775333841673) · [Sour Space Candy](https://www.leschanvriersbretons.com/boutique/fleurs-cbd/product-1773870383362) · [Heaven](https://www.leschanvriersbretons.com/boutique/fleurs-cbd/product-1782391212934)

Le PDF public de Sour Space Candy répond en HTTP 200. Sa page porte le nom de Labostark, l’échantillon « Sour space candy CBD » et un tableau de cannabinoïdes mesurés. La copie publique ne livre pas de numéro de lot lisible permettant de confirmer la correspondance avec le sachet vendu. L’analyse portant sur cet échantillon ne justifie aucune certification ou affirmation sur le reste du catalogue. [Rapport de Sour Space Candy](https://eyowwwpdmfrulhkpvlnf.supabase.co/storage/v1/object/public/product-analyses/f3fad60e-e74d-485c-9ee6-d823118d38e7.pdf)

## Périmètre livré

| URL ou fonction | Fichiers principaux |
| --- | --- |
| Accueil, ferme, guide national | `src/components/home/HomeEditorialExperience.tsx`, `src/app/a-propos/page.tsx`, `src/app/cbd-naturel/page.tsx` |
| Marché, catégorie fleurs, fiches | `src/components/boutique/BoutiquePageClient.tsx`, `src/app/boutique/[category]/{layout,page}.tsx`, `src/app/boutique/[category]/[slug]/page.tsx` |
| Prix, disponibilité, attribution, rapport et modale | `src/lib/{own-producer,product-stock,product-discovery,product-analysis-url,catalog-transparency}.ts`, `src/components/boutique/{ProductDetailActions,ProductAnalysisModal}.tsx` |
| HTML structuré, exploration | `src/components/JsonLd.tsx`, `src/components/JsonLd.test.ts`, `middleware.ts`, `src/app/sitemap.ts` |

Les huit pages échantillonnées avant et après répondent en HTTP 200 au GET avec User-Agent Googlebot et conservent leur canonique. Les titres de l’accueil, du guide breton et de Rennes sont identiques. L’accueil gagne trois destinations en HTML vers la catégorie fleurs, la ferme et le guide breton. Le lien PDF de Sour Space Candy apparaît désormais dans le HTML initial de sa fiche. [Recette technique et inventaire avant modification](recette-technique.md)

## Mesures à compter de la mise en ligne

Le build de production et les 73 tests ciblés passent. À 320 et 390 px, Chrome a ouvert le PDF de Sour Space Candy puis ajouté une unité à 2,50 € au panier invité. Small Bud Mix affiche l’absence d’analyse et Heaven reste consultable en rupture. [Capture du panier](panier-mobile-2026-11-19.png) · [Conditions et limites de la recette](recette-technique.md)

J0 est la date de publication effective. Au J0, exporter les 28 jours complets précédents. À J30, J60 et J90, exporter les 28 jours complets terminés la veille du jalon. Utiliser les mêmes filtres France, recherche Web, appareil et requête exacte. Conserver la date réelle de l’export et son dernier jour disponible si le moteur publie en différé.

| Jalon | Visibilité organique nationale | Visibilité organique bretonne | Citations IA avec lien | Commandes organiques payées |
| --- | --- | --- | --- | --- |
| J0 | non mesuré | non mesuré | non mesuré | non mesuré |
| J30 | non mesuré | non mesuré | non mesuré | non mesuré |
| J60 | non mesuré | non mesuré | non mesuré | non mesuré |
| J90 | non mesuré | non mesuré | non mesuré | non mesuré |

- **Recherche organique.** Le CSV prévoit les neuf requêtes, trois moteurs et quatre jalons. Pour chaque couple requête–moteur, conserver une ligne par URL réellement visible ou exportée. Relever clics, impressions et position moyenne dans les propriétés autorisées Google Search Console et Bing Webmaster Tools, selon les champs fournis. Reporter le rang et la profondeur du sondage manuel dans leurs propres colonnes. En cas d’absence sur les dix premiers, écrire « absent des 10 » et laisser la position exacte « non mesuré ». [Tableau de suivi à compléter](suivi-requetes-fr.csv)
- **Commandes.** Ventiler les commandes payées distinctes par période, moteur organique et page d’entrée réelle. Suivre `/`, `/cbd-breton` et `/cbd-rennes` dans le groupe régional, les deux pages nationales et la ferme dans le groupe national, puis distinguer les entrées directes sur les fiches. Exclure les campagnes payantes, annulations et paiements de test. Une vente ne peut être rapprochée de sa requête qu’avec une attribution effectivement disponible. L’événement Vercel `ai_referral` nécessite le consentement et mesure une visite. Aucune attribution exploitable aux commandes n’a été établie dans cette mission. [Collecte sur le site](../../src/components/VercelAnalytics.tsx)
- **IA.** Rejouer les deux questions fixes en français dans des conversations neuves sur ChatGPT Search, Copilot et Perplexity. Pour chaque essai, conserver date, service, question, mention de la marque, URL effectivement citée et exactitude. Comparer les liens sur plusieurs réponses et deux dates, avec le nombre de réponses obtenues comme dénominateur. Les citations agrégées de Bing Webmaster Tools et les visites issues d’une IA ont leur propre série. [Panel, essais et règles officielles](acces-et-citations-ia.md)

Les accès externes nécessaires sont les exports France des propriétés Google et Bing, le rapport Bing AI Performance, une mesure de commandes attribuées avec consentement, et des sessions capables de restituer les réponses IA. Les journaux Vercel/CDN permettraient de confirmer le passage des robots depuis leurs plages officielles. Le point de départ des SERP publiques reste daté du 19 novembre, indépendamment du futur J0.

## Trois décisions après publication

1. **Choisir la page qui sert le mieux « CBD naturel ».** À J30, examiner les couples requête–URL et les clics. Si le guide progresse, poursuivre son maillage. Si l’accueil ou Rennes reçoit une part durable des clics de découverte nationale, examiner les variantes avant de modifier la page locale.
2. **Choisir la prochaine preuve à publier.** À J60, comparer les arrivées sur la catégorie, les fiches ouvertes et les commandes attribuables. Si la demande se concentre sur un lot, obtenir du producteur son lieu de culture et un rapport identifiable, puis compléter cette fiche. Si la demande porte sur la vente directe, développer la récolte documentée de Sylvain sur la page ferme.
3. **Décider où investir ensuite.** À J90, comparer les trois positions régionales au relevé initial et les citations avec lien au panel précédent. En cas de recul régional répété, réexaminer en priorité les liens et le contenu de l’accueil. Si le régional tient et que les annuaires dominent toujours les requêtes producteurs, évaluer l’éligibilité de la ferme à une mention éditoriale ciblée.
