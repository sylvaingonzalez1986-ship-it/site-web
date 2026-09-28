# Production du Placard : plusieurs tentes

La progression ajoute des tentes à l'entrepôt existant : 1 → 2 → 3 → 4.
L'agrandissement final achète un second entrepôt de quatre tentes, soit huit tentes au total.
Le joueur lance une seule variété et une culture commune, avec les mêmes cartes, dés et situations pour toutes les tentes.
Tout le matériel appartient à l’installation : les achats, modèles installés, niveaux et états d’usure sont communs à toutes les tentes, actuelles et futures. Sélectionner une tente change uniquement le contexte visuel, sans déplacer les objets ni filtrer l’inventaire.

## Coûts et capacité

Chaque tente supplémentaire ajoute de la capacité pour 300 € virtuels et bénéficie immédiatement du matériel commun. Aucun modèle amélioré n’est à racheter et aucun niveau ni état d’usure n’est réinitialisé.
Le second entrepôt coûte 20 000 € virtuels plus quatre places de culture à 300 €, soit 21 200 €.
Chaque modèle de matériel s’achète une seule fois. Un seul modèle par emplacement est installé pour toute l’installation ; les autres restent acquis en réserve. Les mêmes règles valent pour la tente, l’éclairage, l’extraction, le climat, le séchoir, le solaire, la sécurité et toutes les machines de transformation.

## Culture commune

Les nouveaux lancements enregistrent `equipment.scope = "installation"`. Le profil commun hors transformation est répété dans `equipment.tents` pour calculer la capacité physique ; `equipment.shared` reste réservé aux machines de transformation pour préserver les anciennes sauvegardes.
Les bonus sont communs à toutes les tentes. Les effets des machines de transformation, notamment le bonus de qualité du lyophilisateur, s’appliquent une seule fois.
La qualité finale dépend des étapes réussies, selon la règle habituelle.
La quantité totale est la somme des rendements des tentes avec cette qualité commune, le matériel opérationnel, les pertes et le mode énergétique choisi.
Le plafond reste 500 g par tente, soit 4 000 g pour les deux entrepôts.
Une nouvelle tente bénéficie du même équipement que les autres, y compris des améliorations déjà acquises.

La facture additionne l’éclairage, l’extraction et le climat de chaque tente. Les services communs de sécurité et de séchage des fleurs consomment une seule fois pour l’installation ; le solaire réduit la facture globale.
Les anciens cycles conservent leurs instantanés, leur capacité et leur calcul historique. Sans capacité enregistrée, ils restent à une tente.
L’usure du matériel et l’entretien des machines progressent une seule fois par culture équipée, quel que soit le nombre de tentes. Les soins du chien sont également comptés une seule fois pour les nouvelles cultures.
Les bonus de réputation restent attribués une seule fois par culture. Les frais de laboratoire restent de 45 € virtuels par tente et la transformation est facturée selon les grammes traités.

## Installation et vérification

La migration `20260924000300_kq_individual_tents.sql` a été appliquée le 24 septembre 2026, puis `20260927000600_kq_shared_processing_workshop.sql` le 27 septembre 2026. La règle commune à tout le matériel est portée par `20260928000100_kq_shared_installation_equipment.sql`, appliquée à la base distante le 28 septembre 2026 à la demande de l’utilisateur.
Le backend correspondant reste à déployer : les nouveaux départs de culture transmettent le marqueur `equipment.scope = "installation"`, exigé par la nouvelle garde SQL. Les cultures déjà lancées conservent leurs données et peuvent se terminer.
Les agrandissements sont interdits pendant une culture. Un devis de capacité ou de prix périmé est refusé.
Les clés de requête permettent de rejouer une réponse après une coupure sans débiter deux fois la trésorerie.

La nouvelle migration regroupe tous les modèles dans le stockage canonique de la tente 1, sans les présenter comme son matériel individuel. Elle conserve les soldes, reçus, parties déjà lancées et valeurs comptables. Les doublons gardent le niveau maximum acquis et l’usure maximale constatée ; leurs prix historiques sont additionnés, sans nouveau débit ni remboursement automatique. Pour un emplacement occupé dans plusieurs anciennes tentes, un modèle payé déjà installé est préféré au kit gratuit ; entre modèles payés, le choix de la première tente est prioritaire. Les modèles en réserve restent disponibles sans être installés automatiquement.

- src/lib/kanab-quest-production.test.ts : progression et prix de la capacité supplémentaire.
- src/lib/kanab-quest-production-engine.test.ts : culture commune, matériel mixte, moyennes, rendements, factures, anciennes sauvegardes et altérations refusées.
- src/lib/supabase/kanab-quest-production-backend.test.ts : validation des devis et montants servis au client.
- scripts/test-placard-production-expansion.mjs : répétition SQL locale, coûts, reçus, permissions, factures et sauvegardes.
- scripts/test-placard-shared-workshop.mjs : migration et transactions de l'atelier commun dans PostgreSQL isolé (PGlite), sans connexion distante.
- scripts/test-placard-shared-installation.mjs : fusion de tout le matériel, anciennes cultures actives, achats et opérations uniques, agrandissements sans réinitialisation, huit tentes et une seule usure, permissions SQL.
- scripts/audit-placard-warehouse-clarity.mjs : tentes côte à côte, sélection persistante, atelier partagé et proportions à 320, 390, 768 et 1 440 px.
- scripts/audit-placard-production.mjs : parcours navigateur à 320, 390 et 1 440 px, agrandissement avec matériel commun, achats et améliorations globaux, sélection conservée et énergie commune.

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
