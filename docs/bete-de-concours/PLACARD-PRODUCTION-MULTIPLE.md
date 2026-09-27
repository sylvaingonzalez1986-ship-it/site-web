# Production du Placard : plusieurs tentes

La progression ajoute des tentes à l'entrepôt existant : 1 → 2 → 3 → 4.
L'agrandissement final achète un second entrepôt de quatre tentes, soit huit tentes au total.
Le joueur lance une seule variété et une culture commune, avec les mêmes cartes, dés et situations pour toutes les tentes.
Chaque tente possède son matériel de culture, ses niveaux et son état d'usure. Les machines de transformation forment un atelier commun à toutes les tentes.

## Coûts et capacité

Chaque tente supplémentaire est livrée avec le kit de départ de niveau 1 pour 300 € virtuels : tente 120 €, lampe 120 €, extraction 60 €.
Les achats et améliorations des tentes existantes ne sont pas copiés dans la nouvelle tente.
Le second entrepôt coûte 20 000 € virtuels plus quatre kits de départ, soit 21 200 €.
Le matériel de culture s'achète et s'améliore pour la tente sélectionnée. Les machines de tamisage, lavage, filtration, séparation statique, presse et lyophilisation s'achètent une seule fois pour l'installation ; leur modèle actif, leur niveau et leur entretien sont communs.

## Culture commune

Le lancement enregistre un instantané du matériel opérationnel de chaque tente et un instantané séparé de l'atelier commun (`equipment.shared`).
Les bonus du matériel de culture sont moyennés entre les tentes ; les effets de l'atelier commun, notamment le bonus de qualité du lyophilisateur, s'appliquent une seule fois.
La qualité finale reste commune : le bonus moyen de qualité dépend des étapes réussies, selon la règle habituelle.
La quantité totale est la somme des rendements de chaque tente avec cette qualité commune, son propre bonus de rendement, les pertes de la culture et le mode énergétique choisi.
Le plafond reste 500 g par tente, soit 4 000 g pour les deux entrepôts.
Une tente de départ ne bénéficie donc pas gratuitement du rendement du matériel amélioré d'une autre tente.

La facture additionne la consommation et le coût réels de chaque tente.
Une installation solaire réduit uniquement la facture de la tente qui la possède ; la protection solaire ou antivol de toute la culture exige que toutes les tentes disposent de cette protection.
Les anciens cycles sans instantanés individuels conservent leur calcul historique et leur capacité enregistrée ; sans capacité enregistrée, ils restent à une tente.
Le lot commun se transforme avec les machines opérationnelles de l'atelier commun. L'ajout d'une tente ne demande aucun nouvel achat de ces machines. Leur usure progresse une seule fois par culture équipée, quel que soit le nombre de tentes.
Les bonus de réputation restent attribués une seule fois par culture. Les frais de laboratoire restent de 45 € virtuels par tente et la transformation est facturée selon les grammes traités.

## Installation et vérification

La migration 20260924000300_kq_individual_tents.sql a été appliquée à la base distante le 24 septembre 2026. La nouvelle règle d'atelier commun nécessite ensuite `20260927000600_kq_shared_processing_workshop.sql`, préparée et testée localement uniquement à ce stade.
Elle complète 20260923001000_kq_production_expansion.sql en conservant le matériel déjà acquis dans les tentes existantes, puis individualise les nouvelles opérations.
Les agrandissements sont interdits pendant une culture. Un devis de capacité ou de prix périmé est refusé.
Les clés de requête permettent de rejouer une réponse après une coupure sans débiter deux fois la trésorerie.

La migration de l'atelier commun regroupe les machines dans le stockage canonique de la tente 1, sans les présenter comme son matériel individuel. Elle préserve les soldes, reçus, parties déjà lancées et valeurs comptables ; les niveaux acquis et l'usure sont conservés de façon prudente. Un panier mixte achète le matériel de culture pour la tente choisie et les machines pour l'atelier commun dans une seule transaction. Aucun changement de base distante n'est effectué pour cette validation locale.

- src/lib/kanab-quest-production.test.ts : progression et prix du kit de départ.
- src/lib/kanab-quest-production-engine.test.ts : culture commune, matériel mixte, moyennes, rendements, factures, anciennes sauvegardes et altérations refusées.
- src/lib/supabase/kanab-quest-production-backend.test.ts : validation des devis et montants servis au client.
- scripts/test-placard-production-expansion.mjs : répétition SQL locale, coûts, reçus, permissions, factures et sauvegardes.
- scripts/test-placard-shared-workshop.mjs : migration et transactions de l'atelier commun dans PostgreSQL isolé (PGlite), sans connexion distante.
- scripts/audit-placard-warehouse-clarity.mjs : tentes côte à côte, sélection persistante, atelier partagé et proportions à 320, 390, 768 et 1 440 px.
- scripts/audit-placard-production.mjs : parcours navigateur à 320, 390 et 1 440 px, kit de départ, achats et améliorations indépendants, sélection conservée entre boutique et entrepôt, énergie commune.

Validation locale du 24 septembre 2026 : 1 747 tests réussis dans 265 fichiers, compilation de production Next.js réussie, contrôles TypeScript et ESLint réussis, tests PostgreSQL locaux et contrôle des permissions sur 248 migrations réussis. Audit navigateur validé aux trois largeurs indiquées.

## Application distante — 23 septembre 2026

Migration 20260923001000_kq_production_expansion.sql appliquée au projet Supabase lié à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, elle confirme que la base distante est à jour.

Contrôles en lecture seule réussis : colonne production_units accessible, trois nouvelles RPC présentes avec leurs paramètres attendus, table des reçus privés inaccessible directement à service_role (HTTP 403, code 42501). Aucun compte joueur ni achat de jeu n’a été utilisé pour la vérification. Rapport : output/production-migration/verification.json.

Cette application concerne la base de données ; elle ne déploie pas le code de l’interface.

## Application distante — 24 septembre 2026

Migration 20260924000300_kq_individual_tents.sql appliquée au projet Supabase lié « Site Web Les Chanvriers Bretons » à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, Supabase confirme que la base distante est à jour.

Contrôles en lecture seule réussis : sept colonnes tent_number accessibles, cinq nouvelles RPC présentes avec leurs paramètres obligatoires attendus, accès direct à la fonction interne kq_run_tents refusé à service_role (HTTP 403, code 42501), table kq_production_expansions inaccessible directement. Aucun compte joueur ni achat de jeu n’a été utilisé pour la vérification. Rapports : output/individual-tent-migration/application.json et output/individual-tent-migration/verification.json.

Cette application concerne uniquement la migration ; le code du site reste à déployer.
