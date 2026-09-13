# Optimisation des coûts de l’Arène — 13 septembre 2026

## Objectif et périmètre

Réduire d’au moins 50 % les ressources gaspillées sur les parcours identifiés dans [l’audit initial](./ARENA-COUT-SUPABASE-2026-09-13.md), sans modifier les règles du jeu. Le forfait Pro à 25 USD/mois reste un coût fixe : une baisse des appels ou du trafic ne divise pas cet abonnement par deux. Elle réduit le risque de dépasser ses quotas et la charge du serveur.

Les corrections ci-dessous sont implémentées dans le code. Leur effet sur Supabase commencera après déploiement de l’application. Aucune migration SQL ni modification de l’abonnement n’est nécessaire.

## Plan réalisé

| Priorité | Correction | Effet attendu |
| --- | --- | --- |
| 1 | Interroger uniquement la file pendant l’attente d’un duel, toutes les 30 secondes après la fin de la requête ; suspendre les interrogations en arrière-plan. | Supprimer les relectures de fleurs et combats inchangés, ainsi que les appels qui se chevauchent. |
| 2 | Partager temporairement les classements publics et le calcul commun des récompenses via le cache de données Next.js. | Éviter de recalculer et réécrire les mêmes résultats pour chaque visiteur. |
| 3 | Calculer les aperçus du marché sans enregistrer chaque lot, et ne plus télécharger leurs options stockées. | Réduire fortement les réponses Supabase et les écritures pendant la consultation du commerce. |
| 4 | Réutiliser l’état du compte déjà lu pendant une consultation ; préparer seulement le lot concerné par une transaction. | Supprimer les lectures et préparations redondantes. |
| 5 | Vérifier les gains et les limites transactionnelles avec des tests. | Conserver les contrôles de propriété, d’équipement, de prix et d’état des lots. |

## Mesures reproductibles

Ces résultats viennent de tests locaux. Ce ne sont pas des mesures de facture ni une simulation de toute la production.

| Scénario | Avant | Après | Réduction |
| --- | ---: | ---: | ---: |
| Attente de duel visible et inchangée pendant 20 minutes, premier appel compris | 303 appels applicatifs | 41 appels à la file | 86,5 % |
| Consultation de quatre lots, réponses JSON de la base comptées dans le scénario de marché | 128 306 octets | 7 258 octets | 94,3 % |
| Préparations SQL des quatre lots pendant cette consultation | 4 | 0 | 100 % |
| Lecture de l’état du compte lors d’une ouverture du commerce | 2 | 1 | 50 % |
| 100 consultations simultanées d’un même calcul commun, dans le test du cache | 100 exécutions sans cache | 1 exécution | 99 % |

Pour les duels, les listes des fleurs et combats sont rechargées lorsque la file signale un changement. Ce rechargement ajoute deux appels et le traitement existant du classement. La mesure de 41 appels décrit une attente sans changement, sans événement de retour sur la fenêtre. Le délai de détection d’un changement peut désormais approcher 30 secondes, plus le temps de réponse, contre 12 secondes auparavant. Revenir sur l’onglet déclenche une vérification immédiate. Une requête déjà lancée peut finir lorsque l’onglet devient caché, mais aucun nouveau cycle n’est programmé en arrière-plan.

Le test de marché utilise de vraies fonctions de calcul d’offres et des données de test. Il compte les réponses sérialisées des requêtes simulées, notamment les anciens retours complets de préparation SQL et les options relues ensuite. Les réponses des services d’équipement et d’énergie, simulées et communes aux deux variantes, ainsi que les en-têtes HTTP et l’authentification, sont exclus de cette mesure. Les options sont encore envoyées du serveur du site vers le navigateur : cette optimisation vise le transfert Supabase → serveur et les écritures SQL. Le résultat dépendra du nombre et de la taille des lots réels.

Le test du cache simule le stockage Next.js et vérifie aussi le regroupement des appels en cours dans une même instance. Il ne reproduit pas un déploiement réparti sur plusieurs régions. La revalidation est configurée à 30 secondes ; Next.js peut servir le résultat précédent pendant son actualisation. Ce n’est donc pas une garantie de fraîcheur maximale de 30 secondes. Le nombre réel de calculs dépendra du trafic, des invalidations et du cache fourni par l’hébergeur.

## Conservation du comportement du jeu

- Les comptes, soldes, droits et devis de vente ne passent pas dans le cache partagé. Les projections personnelles des récompenses sont construites après la lecture commune ; les gains attribués restent lus pour le compte concerné.
- Préparer ou vendre un lot utilise toujours les contrôles serveur et les commandes SQL existants. La consultation du commerce peut montrer un aperçu, mais elle ne crée plus un lot SQL à chaque ouverture.
- Les lots vendus restent identifiés comme vendus et ne sont pas réintroduits dans les lots disponibles. Le matériel actuel est utilisé pour les aperçus, même lorsqu’un ancien enregistrement existe.
- Les clôtures et distributions de récompenses utilisent des lectures fraîches. Le lancer de récompense renvoie également un résultat frais après la commande. Ces opérations invalident les lectures communes concernées.
- Les erreurs de lecture ne sont pas conservées comme des résultats valides. Les interrogations de la file reprennent au rythme normal après une erreur.

Le cache utilise `unstable_cache`, déjà employé par le projet sans Cache Components. La documentation Next.js installée recommande désormais `use cache` avec Cache Components ; une migration globale de cette configuration n’est pas nécessaire pour cette correction.

## Vérifications

Les tests dédiés couvrent l’attente, la suspension en arrière-plan, les requêtes lentes, le retour sur l’onglet, les erreurs, le partage et l’invalidation du cache, la séparation des projections personnelles, les données du marché, le changement de matériel et la préparation avant transaction.

Résultats : 219 fichiers de tests et 1 176 tests réussis avec couverture ; contrôle TypeScript réussi ; build de production réussi. ESLint a vérifié les 903 fichiers source suivis ou nouveaux, avec zéro erreur et dix avertissements dans les fichiers non modifiés. Les sorties et caches générés localement ont été exclus de ce dernier contrôle.

Commandes de contrôle :

```powershell
npm.cmd run test:ci
npx.cmd tsc --noEmit
npx.cmd eslint .
npm.cmd run build
```

Les journaux locaux sont conservés dans `output/arena-cost-audit/` (répertoire ignoré par Git). Le test `src/lib/supabase/kanab-quest-market-cost.test.ts` reproduit et affiche la comparaison d’octets.

## Mesure après déploiement

Comparer deux périodes de sept jours avec une fréquentation et des usages comparables. Relever le trafic sortant Supabase par service, les joueurs actifs, les visites du commerce, le temps passé en attente et les appels des RPC de préparation de lots, de classement et de récompenses. Normaliser les résultats par joueur actif et, pour les parcours ciblés, par visite ou minute d’attente.

Vérifier en parallèle que les erreurs de vente n’augmentent pas et que le délai de rapprochement des duels reste acceptable. Le stockage historique et les images distantes ne sont pas réduits par ces corrections.

Une réduction globale de moitié reste à confirmer : elle dépend de la part des parcours corrigés dans la consommation totale. Par exemple, si ces parcours représentent 60 % du trafic et baissent en moyenne de 85 %, le gain total serait de 51 % ; s’ils ne représentent que 20 %, le gain serait de 17 %. Il faut utiliser les compteurs réels pour trancher, sans extrapoler les 94 % du test de marché à toute la facture.
