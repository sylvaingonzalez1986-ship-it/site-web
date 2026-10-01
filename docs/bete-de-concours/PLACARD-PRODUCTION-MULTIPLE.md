# Production du Placard : plusieurs tentes

La progression ajoute des tentes à l'entrepôt existant : 1 → 2 → 3 → 4.
L'agrandissement final achète un second entrepôt de quatre tentes, soit huit tentes au total.
Le joueur lance une seule variété et une culture commune, avec les mêmes cartes, dés et situations pour toutes les tentes.
Depuis la révision du 1er octobre 2026, **seules les machines de transformation sont communes** : tamisage, lavage, filtration, séparation statique, presse et lyophilisateur. Chaque tente possède son modèle de tente, son éclairage, son extraction, son contrôleur climatique, son séchoir à fleurs, son énergie et sa sécurité. Achats, modèles installés, niveaux et usure de ce matériel suivent la tente sélectionnée.

Le récapitulatif de l’entrepôt reste discret sous l’image, replié par défaut. En l’ouvrant, puis en dépliant une tente, on retrouve ses sept emplacements, avec le modèle, le niveau et l’état : installé, en réserve à installer, essentiel manquant, option non installée ou hors service. Les trois essentiels sont la tente, l’éclairage et l’extraction ; les autres emplacements sont facultatifs. Chaque ligne ouvre la bonne fiche, et l’atelier commun possède son propre volet repliable.

## Coûts et capacité

Chaque tente supplémentaire coûte 300 € virtuels et reçoit uniquement son kit de départ : tente, éclairage et extraction. Ses équipements améliorés doivent être achetés et installés pour elle. Elle accède aux machines de transformation déjà acquises dans l’atelier commun.
Le second entrepôt coûte 20 000 € virtuels plus quatre places de culture à 300 €, soit 21 200 €.
Un modèle de matériel de culture ou de service s’achète pour une tente ; un modèle de transformation s’achète une seule fois pour l’atelier commun. Chaque emplacement accepte un seul modèle installé ; les autres restent dans la réserve de leur tente ou de l’atelier. Le catalogue indique la destination de chaque article et conserve le panier propre à chaque tente ainsi que le panier des machines communes.

## Culture commune

Les nouveaux lancements enregistrent `equipment.scope = "tent"`. `equipment.tents` contient le profil opérationnel réel de chaque tente ; `equipment.shared` contient uniquement les machines de transformation. Les effets propres aux tentes sont agrégés pour la culture commune ; les effets de transformation, notamment le bonus de qualité du lyophilisateur, s’appliquent une seule fois.
La qualité finale dépend des étapes réussies, selon la règle habituelle.
La quantité totale est la somme des rendements des tentes avec cette qualité commune, le matériel opérationnel, les pertes et le mode énergétique choisi.
Le plafond reste 500 g par tente, soit 4 000 g pour les deux entrepôts.
Une nouvelle tente ne copie ni les améliorations, ni l’usure des autres tentes.

La facture additionne les consommations de chaque tente, y compris son séchoir et sa sécurité. Le solaire réduit uniquement la consommation de la tente où il est installé. Les devis détaillent la contribution de chaque tente.
Les anciens cycles conservent leurs instantanés, leur capacité et leur calcul historique. Sans capacité enregistrée, ils restent à une tente.
L’usure progresse sur les équipements de chaque tente engagés au lancement de la culture. Les machines communes sont entretenues une seule fois. Pour les nouveaux cycles, les soins des chiens acquis sont facturés par tente ; les anciens cycles conservent leurs règles historiques.
Les bonus de réputation restent attribués une seule fois par culture. Les frais de laboratoire restent de 45 € virtuels par tente et la transformation est facturée selon les grammes traités.

## Installation et vérification

La migration `20260924000300_kq_individual_tents.sql` a été appliquée le 24 septembre 2026, puis `20260927000600_kq_shared_processing_workshop.sql` le 27 septembre 2026. La règle commune à tout le matériel est portée par `20260928000100_kq_shared_installation_equipment.sql`, appliquée à la base distante le 28 septembre 2026 à la demande de l’utilisateur.
La révision du 1er octobre est portée par `20261001000200_kq_tent_equipment_and_shared_workshop.sql`, appliquée le 1er octobre 2026 à la base distante liée au projet `eyowwwpdmfrulhkpvlnf`. L’historique distant confirme son application et la vérification à blanc ne signale aucune migration en attente. Le backend correspondant doit accompagner cette migration : la nouvelle garde exige `equipment.scope = "tent"` pour les nouveaux départs. Les cultures déjà lancées conservent leurs données et peuvent se terminer.
Les agrandissements sont interdits pendant une culture. Un devis de capacité ou de prix périmé est refusé.
Les clés de requête permettent de rejouer une réponse après une coupure sans débiter deux fois la trésorerie.

La migration du 1er octobre matérialise les droits déjà acquis pour chaque tente existante : tous les modèles possédés sont conservés, avec leurs niveaux, usure et choix installé/en réserve. Les machines de transformation restent dans leur stockage commun. Les prix d’acquisition et actifs comptables existants sont répartis au centime entre les copies, sans créer de valeur, débiter de trésorerie ou modifier les reçus historiques. Le marqueur `equipment_scope_version = 2` empêche toute seconde conversion lors d’un rejeu.

- src/lib/kanab-quest-production.test.ts : progression et prix de la capacité supplémentaire.
- src/lib/kanab-quest-production-engine.test.ts : culture commune, matériel mixte, moyennes, rendements, factures, anciennes sauvegardes et altérations refusées.
- src/lib/supabase/kanab-quest-production-backend.test.ts : validation des devis et montants servis au client.
- scripts/test-placard-production-expansion.mjs : répétition SQL locale, coûts, reçus, permissions, factures et sauvegardes.
- scripts/test-placard-shared-workshop.mjs : migration et transactions de l'atelier commun dans PostgreSQL isolé (PGlite), sans connexion distante.
- scripts/test-placard-shared-installation.mjs : vérification historique de la fusion du 28 septembre, avant sa conversion en équipements par tente.
- scripts/test-placard-tent-equipment.mjs : conversion et rejeu, préservation des valeurs, achats mixtes, opérations par tente, atelier commun, nouvelles tentes et compatibilité de trois générations de cultures.
- scripts/audit-placard-warehouse-clarity.mjs : récapitulatif par tente, réserve, états d’usure, sélection persistante, atelier partagé, réponses tardives et proportions à 320, 390, 768 et 1 440 px.
- scripts/audit-placard-production.mjs : agrandissements avec kits de départ, matériel et charges par tente, factures historiques figées.
- scripts/audit-placard-shared-catalog.mjs : paniers par destination, achats locaux et communs, actions et réponses tardives.

Validation locale du 24 septembre 2026 : 1 747 tests réussis dans 265 fichiers, compilation de production Next.js réussie, contrôles TypeScript et ESLint réussis, tests PostgreSQL locaux et contrôle des permissions sur 248 migrations réussis. Audit navigateur validé aux trois largeurs indiquées.

Validation locale du 28 septembre 2026 : 2 053 cas Vitest validés (une ancienne assertion de texte corrigée puis relancée), 110 assertions PostgreSQL pour la migration de matériel commun et contrôle des permissions sur 257 migrations. TypeScript et ESLint réussissent. Les audits navigateur avec API simulées couvrent l’entrepôt à 320, 390, 768 et 1 440 px, ainsi que catalogue et agrandissements à 320, 390 et 1 440 px : achats et états communs, panier conservé, héritage des nouvelles tentes, anciennes factures préservées. Rapports dans `output/placard-warehouse-clarity`, `output/placard-shared-catalog` et `output/production`. Ces contrôles locaux n’appliquent pas la migration distante.

## Application distante — 23 septembre 2026

Migration 20260923001000_kq_production_expansion.sql appliquée au projet Supabase lié à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, elle confirme que la base distante est à jour.

Contrôles en lecture seule réussis : colonne production_units accessible, trois nouvelles RPC présentes avec leurs paramètres attendus, table des reçus privés inaccessible directement à service_role (HTTP 403, code 42501). Aucun compte joueur ni achat de jeu n’a été utilisé pour la vérification. Rapport : output/production-migration/verification.json.

Cette application concerne la base de données ; elle ne déploie pas le code de l’interface.

## Application distante — 24 septembre 2026

Migration 20260924000300_kq_individual_tents.sql appliquée au projet Supabase lié « Site Web Les Chanvriers Bretons » à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, Supabase confirme que la base distante est à jour.

Contrôles en lecture seule réussis : sept colonnes tent_number accessibles, cinq nouvelles RPC présentes avec leurs paramètres obligatoires attendus, accès direct à la fonction interne kq_run_tents refusé à service_role (HTTP 403, code 42501), table kq_production_expansions inaccessible directement. Aucun compte joueur ni achat de jeu n’a été utilisé pour la vérification. Rapports : output/individual-tent-migration/application.json et output/individual-tent-migration/verification.json.

Cette application concerne uniquement la migration ; le code du site reste à déployer.

## Application distante — 28 septembre 2026

Migration `20260928000100_kq_shared_installation_equipment.sql` appliquée au projet Supabase lié « Site Web Les Chanvriers Bretons » à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, Supabase confirme que la base distante est à jour.

Quatorze contrôles en lecture seule réussis à 18:36 UTC : schéma et signatures RPC, nouveau commentaire de capacité, fonctions internes inaccessibles à `service_role`, catalogue complet et absence de matériel, de modèles installés ou d’actifs de matériel non retirés hors du stockage canonique. Les contrôles sur les tables joueurs utilisent uniquement des compteurs `HEAD`, sans récupérer leurs lignes ni invoquer de transaction de jeu. Rapports : `output/shared-installation-migration/application.json` et `output/shared-installation-migration/verification.json`.

Cette opération applique la migration uniquement ; aucun commit, push ou déploiement du code applicatif n’a été effectué.
