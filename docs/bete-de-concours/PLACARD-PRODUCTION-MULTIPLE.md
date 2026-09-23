# Production du Placard : plusieurs tentes

La progression ajoute des tentes à l’entrepôt existant : 1 → 2 → 3 → 4.
L’agrandissement final achète un second entrepôt de quatre tentes, soit huit tentes au total.
Le joueur réalise une culture commune à toute l’installation ; les tentes partagent matériel, niveaux et état d’usure.
La qualité, les cartes, les dés et les bonus de réputation par culture conservent leurs règles.

## Coûts et capacité

La récolte et la consommation électrique sont calculées par tente puis multipliées par la capacité enregistrée au lancement.
Le plafond de récolte reste 500 g par tente, soit 4 000 g pour les deux entrepôts.
Les anciens cycles sans capacité enregistrée restent à une tente, même après agrandissement.

Une tente supplémentaire comprend une copie de chaque matériel acheté, y compris les réserves, au tarif catalogue avec le cumul du prix de ses améliorations.
Le kit initial coûte 300 € virtuels par nouvelle tente : tente 120 €, lampe 120 €, extraction 60 €.
Chaque élément de ce kit est omis lorsqu’un modèle acheté couvre déjà le même emplacement.
Le second entrepôt coûte 20 000 € virtuels, auxquels s’ajoutent quatre copies de l’installation.

Les achats futurs, améliorations, réparations et remplacements couvrent toutes les tentes et leur prix est multiplié en conséquence.
Les taux d’usure restent identiques ; l’agrandissement conserve leur état et nécessite de réparer ou remplacer le matériel hors service.
Les frais de laboratoire sont de 45 € virtuels par tente. Les soins du chien suivent aussi la capacité du cycle.
La transformation est déjà facturée selon les grammes traités.

## Installation et vérification

Appliquer la migration 20260923001000_kq_production_expansion.sql avant de déployer le code serveur.
Elle conserve les joueurs existants à une tente, ajoute les achats atomiques et leurs reçus privés, et adapte les factures et la limite des lots.
Aucun changement des données de production n’est effectué par les scripts de vérification.

- scripts/test-placard-production-expansion.mjs : répétition SQL locale sous PGlite, coûts, reçus, permissions, factures et sauvegardes.
- scripts/audit-placard-production.mjs : composants réels dans un navigateur avec API locale simulée, mobile et bureau.
- src/lib/kanab-quest-production.test.ts et kanab-quest-production-engine.test.ts : progression, prix, récoltes, énergie et sauvegardes.
- src/lib/supabase/kanab-quest-production-backend.test.ts et l’endpoint equipment : identité de session, validation des devis et montants servis au client.

Les agrandissements sont interdits pendant une culture. Un devis de capacité ou de prix périmé est refusé.
Les clés de requête permettent de rejouer une réponse après une coupure sans débiter deux fois la trésorerie.

## Application distante — 23 septembre 2026

Migration 20260923001000_kq_production_expansion.sql appliquée au projet Supabase lié à la demande de l’utilisateur. La prévisualisation proposait uniquement cette migration ; après application, elle confirme que la base distante est à jour.

Contrôles en lecture seule réussis : colonne production_units accessible, trois nouvelles RPC présentes avec leurs paramètres attendus, table des reçus privés inaccessible directement à service_role (HTTP 403, code 42501). Aucun compte joueur ni achat de jeu n’a été utilisé pour la vérification. Rapport : output/production-migration/verification.json.

Cette application concerne la base de données ; elle ne déploie pas le code de l’interface.
