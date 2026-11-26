# Observations SEO

## Crawl public du 26 novembre 2026

À 17 h 16, heure de Paris, 16 GET directs ont été effectués sur un échantillon de l’accueil, de la boutique, de deux catégories, de deux fiches, des producteurs, du journal, de deux articles, des guides et de Rennes. Chaque GET avec agent déclaré Googlebot a reçu HTTP 200 sans redirection. L’échantillon contient 16 titres, 16 descriptions, 16 H1 et 16 canoniques distincts, avec une canonique autoréférente par URL. Le HTML initial fournit aussi les directives robots, les liens internes du périmètre public et les types JSON-LD. Une inspection Google effective reste N/D. [Relevé HTTP et HTML](../../docs/seo-operator/preview/crawl-public-2026-11-26.json)

- `robots.txt` et `sitemap.xml` ont répondu 200. Le sitemap comporte 51 URL distinctes sur le domaine canonique, dont 19 chemins de fiches et 6 articles. Les directives autorisent les pages auditées. La catégorie e-liquides affiche qu’elle est vide, porte `noindex, follow` et est absente du sitemap. [Robots](https://www.leschanvriersbretons.com/robots.txt) · [Sitemap](https://www.leschanvriersbretons.com/sitemap.xml) · [E-liquides](https://www.leschanvriersbretons.com/boutique/e-liquide-cbd)
- La catégorie e-liquides est la seule URL de l’échantillon sans lien entrant depuis une autre des 16 pages, après prise en compte des ancres. Le constat porte sur le HTML initial de cet échantillon. Un diagnostic d’orphelin demanderait un crawl de l’ensemble des pages publiques et de leurs liens rendus. [Relevé des liens](../../docs/seo-operator/preview/crawl-public-2026-11-26.json)
- Avec un agent Chrome mobile et aucun cookie, l’accueil, la boutique et le journal renvoient 307 vers le contrôle d’âge, avec retour vers la page demandée. Le guide d’analyse répond 200 directement. Ce test relève du comportement HTTP. La recette de rendu se trouve dans l’aperçu du lot. [Relevé HTTP mobile](../../docs/seo-operator/preview/crawl-public-2026-11-26.json)
- L’accueil relie la catégorie fleurs, la ferme, les guides naturels, breton et prix. La catégorie fleurs et le guide naturel pointent déjà vers le guide d’analyse. Le guide d’analyse renvoie à la boutique générale en fin de lecture. Il manque un lien en contexte, près de la première réponse, qui montre où consulter le rapport sur une fiche. [Accueil](https://www.leschanvriersbretons.com/) · [Fleurs](https://www.leschanvriersbretons.com/boutique/fleurs-cbd) · [Guide d’analyse](https://www.leschanvriersbretons.com/analyse-laboratoire-cbd)
- La boutique encode ses filtres de catégorie et de culture dans la requête et garde la canonique `/boutique`. Les formats se sélectionnent sur la fiche, à son URL canonique. Aucune URL de pagination n’a été relevée dans le HTML initial du catalogue et du journal échantillonnés. Les liens « Précédent » et « Suivant » relevés entre produits mènent à d’autres fiches. [Recette antérieure des paramètres et variantes](../../docs/seo/recette-technique.md) · [Relevé des liens](../../docs/seo-operator/preview/crawl-public-2026-11-26.json)

## Recherche du 26 novembre 2026

L’outil web a renvoyé des exemples francophones sur « CBD Bretagne », « CBD breton », « CBD naturel », « CBD français », « CBD producteur », « CBD producteurs » et « CBD pas cher » ainsi que des formulations affinées autour des fleurs et du prix au gramme. L’emplacement et l’appareil sont N/D. L’ordre d’affichage de l’outil ne permet pas d’attribuer un classement à un moteur. Les exemples illustrent les tâches couvertes.

| Intention | Exemples observés |
| --- | --- |
| Bretagne et breton | CannaBZH et Le CBD Breton présentent leur production régionale. Breizh District répond aussi au besoin de trouver un commerce régional. [CannaBZH](https://cannabzh.com/) · [Le CBD Breton](https://lecbdbreton.bzh/) · [Breizh District](https://www.breizh-district.com/categorie-produit/produits-cbd/) |
| Naturel | Le terme coexiste dans les résultats avec les sites marchands et les publications publiques sur la composition. La lecture des preuves peut relier ces deux besoins. [Cann’Adhémar](https://cannadhemar.fr/) · [Étude MILDECA](https://www.drogues.gouv.fr/etude-cbd) |
| Producteur, producteurs et français | Les annuaires répondent à la recherche d’exploitations. Les fermes et les catalogues français servent l’achat direct et l’identification de l’origine. [L’Herbe en France](https://www.herbeenfrance.com/producteurs) · [France Cannabis](https://association-france-cannabis.com/annuaire-producteurs-cbd-france) · [La Ferme en Herbe](https://www.lafermeenherbe.fr/boutique-cbd-francais/) |
| Prix accessible | Des pages comparent les prix au gramme et la taille des formats. Les prix affichés ici restent ceux du catalogue. [Comparateur CBD Dream](https://www.cbd-dream.com/fleurs-cbd/) · [Guide L’Herbe en France](https://www.herbeenfrance.com/cbd-pas-cher) |

| Mesure | État au 26 novembre |
| --- | --- |
| Search Console et Bing Webmaster Tools | Accès ou export N/D. Impressions, clics, CTR, positions moyennes et indexation effective N/D. |
| Google, Bing et Brave France | Rangs actuels N/D. Le 19 novembre, une collecte directe Bing avait observé l’accueil en positions 2 à 4 sur trois variantes régionales. La date et le caractère ponctuel limitent la comparaison. [Relevé daté](../../docs/seo/releve-recherche-fr.md) |
| Googlebot, Bing et robots IA | Les directives d’exploration sont publiques. La fréquence de passage, l’indexation et les citations réelles restent N/D. |
| ChatGPT, Gemini, Perplexity, Claude | Réponses et citations vérifiées N/D. Un lien ou un résultat d’un outil web ne vaut pas une citation d’un moteur de réponse. |
| Trafic, engagement, commandes attribuées et Web Vitals terrain | Valeurs et tendances N/D. Les contrôles HTTP et navigateur couvrent le fonctionnement des pages et de leur navigation. |

La recette Chrome locale du guide mesure le rendu et les interactions à trois largeurs. Elle utilise une fixture et des fenêtres émulées sur Windows. Aucun score Lighthouse n’a été relevé pour ce lot. Les mesures Lighthouse historiques décrivent la page et les conditions de laboratoire de leur date. Les Core Web Vitals terrain exigent une fenêtre de données utilisateurs, par exemple CrUX ou une mesure réelle autorisée. [Recette du lot](../../docs/seo-operator/preview/README.md) · [Mesure de laboratoire historique](../../docs/seo/AUDIT-2026-09-11.md)

## Opportunités externes

- [Mangeons local](https://www.mangeons-local.bzh/cbd-tracabilite-conseils/) publie un guide sur la traçabilité du CBD breton. Aucune mention exacte des Chanvriers Bretons dans l’extrait consulté. Un guide local ou un portrait de ferme peut présenter un intérêt éditorial. Vérifier les critères, l’angle et les preuves avant tout contact.
- [L’Herbe en France](https://www.herbeenfrance.com/producteurs) est un annuaire commercial par région. Ty Kanna figurait dans la liste bretonne consultée. Vérifier l’existence d’une fiche propre et les conditions éventuelles avant d’évaluer une présence.
- [France Cannabis](https://association-france-cannabis.com/annuaire-producteurs-cbd-france) réserve publiquement cet annuaire à ses adhérents. Mettre en attente jusqu’à vérification humaine de l’adhésion, du cadre et des coûts éventuels.
- [Ultraweed](https://ultraweed.fr/sites-references) cite déjà Les Chanvriers Bretons. Vérifier à l’occasion l’identité, le lien et la fraîcheur des références. Le relevé ne permet pas d’inférer le trafic ni l’intérêt d’un partenariat.

Aucun contact externe effectué.
