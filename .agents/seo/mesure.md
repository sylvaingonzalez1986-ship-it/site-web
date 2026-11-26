# Mesure organique

## Sources et fenêtres

Au 26 novembre 2026, aucun export de performance exploitable ni connexion authentifiée Search Console ou Bing Webmaster Tools n’a été identifié. Vercel est relié à GitHub pour les déploiements. Le code mesure sous consentement certaines visites référentes IA. Une entrée au paiement ne suffit pas pour attribuer une vente. Aucun profil client ni historique de commande ne doit être exporté. [Instrumentation](../../src/components/VercelAnalytics.tsx)

Utiliser le dernier jour complet **finalisé par la source**. Avec une clôture provisoire au 23 novembre 2026, la base de 90 jours va du 26 août au 23 novembre, les deux fenêtres de 28 jours du 29 septembre au 26 octobre et du 27 octobre au 23 novembre. Recalculer ces dates si le fournisseur annonce une fin différente. Privilégier Google Web France et séparer mobile/ordinateur puis URL d’entrée et marque/hors marque. « Les Chanvriers Bretons » et ses variantes orthographiques identifiantes sont des recherches de marque. « CBD breton » et « CBD Bretagne » seuls sont hors marque. Les requêtes masquées restent inconnues. Comparer une même source, dimension, couverture et règle de consentement. Signaler jours fériés, promotions réelles, saisonnalité et petits volumes.

| Source | Lecture attendue | État initial |
| --- | --- | --- |
| Google Search Console, recherche Web | Clics, impressions, CTR, position moyenne pour un segment, indexation via le rapport Pages/inspection. Les apparitions des fonctionnalités IA entrent dans le total Web. | Non disponible |
| Bing Webmaster Tools | Performance Bing et indexation. Le rapport natif AI Performance couvre ses surfaces déclarées, dont Copilot. | Non disponible |
| Brave Search | Observation directe datée des résultats France. | [Échantillon de novembre](../../docs/seo/releve-recherche-fr.md) |
| Vercel Analytics | Trafic agrégé consenti et événements de référent IA par page. | Aucun export disponible |
| Attribution des ventes | Achats confirmés et CA en EUR rattachés à une entrée organique avec un modèle d’attribution explicite. | Non disponible |
| Terrain et laboratoire | Web Vitals terrain si disponibles avec population/période. Les essais navigateur, Chrome et Lighthouse sont des mesures de laboratoire. | [Recette historique](../../docs/seo/recette-technique.md) et [aperçu du lot](../../docs/seo-operator/preview/) |

L’API officielle permet une lecture Search Console avec un droit en lecture seule. Un export agrégé équivalent convient aussi. Un accès Bing séparé est nécessaire pour son rapport natif. Le compte Supabase de l’application n’est pas une source d’attribution. [API Google](https://developers.google.com/webmaster-tools/v1/api_reference_index) · [Fonctions IA Google](https://developers.google.com/search/docs/appearance/ai-features) · [Rapport Microsoft](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/)

## Import local

Si une autorisation Google existe, fournir au processus un jeton OAuth temporaire de portée `webmasters.readonly` via `LCB_GSC_READONLY_TOKEN`. Exécuter `node scripts/seo-measure/google-web.mjs --state-dir "$etat"` dans la session locale. L’import utilise trois lectures au maximum, trouve le dernier jour finalisé et renouvelle 90 jours de données Web France sur les chemins publics autorisés. La propriété domaine est utilisée par défaut. Pour une propriété préfixe, utiliser `--property https://www.leschanvriersbretons.com/`. La classification par filtre de marque exclut les requêtes anonymisées des totaux ventilés. L’API limite aussi les lignes disponibles. Une erreur de permission ou un plafond de lignes interrompt l’import. Le compte de service, son octroi et sa facturation éventuelle restent à configurer par le propriétaire s’il choisit ce mode. Le cycle initial a utilisé le mode sans accès privé. [Méthode officielle](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

Le fichier JSON d’entrée contient `{"schema":1,"sources":{}}` lorsque les données manquent. Les sources possibles sont `googleWeb`, `bingWeb`, `organicSales`. Chaque source renseignée contient `from`, `through` (dates ISO inclusives de couverture finalisée continue) et `rows`. Fournir uniquement des jours complets pour le périmètre annoncé. Conserver le fichier et les résultats détaillés dans le dossier privé d’état de l’opérateur.

Une ligne contient `date`, `country` (FR), `device` (mobile, desktop, tablet ou unknown), `brand` (brand, nonbrand ou unknown), `landing` (chemin canonique public). Ajouter pour la recherche `clicks`, `impressions`, `position` (moyenne du segment, null si indisponible). Pour les achats, ajouter `orders` et `revenueEUR`. Chaque ligne est un segment journalier disjoint. Exclure les sous-totaux et les données nominatives. Une absence de ligne donne une mesure indisponible. Utiliser une ligne avec zéros uniquement si la source les atteste. Ne pas additionner des tableaux indépendants par requête et par URL. Noter dans le rapport de la période la propriété, les filtres, la date d’export, les limites liées aux requêtes masquées et le modèle d’attribution.

```powershell
$etat = Join-Path $env:LOCALAPPDATA 'LCB/SeoOperator/state'
node scripts/seo-measure/report.mjs "$etat/metrics-input.json" --state-dir "$etat"
```

Le rapport calcule les trois fenêtres et leurs segments par source, pondère les positions par impressions et calcule le CTR à partir des sommes. Les totaux correspondent au périmètre des lignes fournies. Une période incomplète reste indisponible. Le runner lit seulement les indicateurs agrégés autorisés. Une fois des données disponibles, protéger les pages régionales qui contribuent aux clics et aux ventes, puis comparer les mêmes segments après mise en ligne. [Script](../../scripts/seo-measure/report.mjs)
