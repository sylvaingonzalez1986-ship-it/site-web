# Production du Placard : plusieurs tentes

La progression ajoute une tente à la fois : 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
À la cinquième tente, le joueur ouvre un second entrepôt, puis l’équipe progressivement.
Le joueur lance une seule variété et une culture commune, avec les mêmes cartes, dés et situations pour toutes les tentes.
La révision du 11 octobre 2026 distingue trois destinations : chaque tente possède son modèle, son éclairage, son extraction et son contrôleur climatique ; chaque bâtiment partage un séchoir, un équipement solaire et une sécurité entre ses quatre places ; les machines de transformation servent tout l’atelier. Achats, modèles installés, niveaux et usure suivent leur destination physique.

Le récapitulatif distingue les quatre emplacements de chaque tente, les trois services de chaque bâtiment et l’atelier de transformation. Chaque état associe un badge à un libellé : installé, en réserve, essentiel manquant, option non installée ou hors service. Les trois essentiels sont la tente, l’éclairage et l’extraction. Chaque ligne ouvre la bonne fiche. Les comptes dont la conversion est différée conservent temporairement leur récapitulatif historique à sept emplacements par tente.

La barre de progression affiche le portrait personnalisé enregistré, le pseudo et
la spécialité du joueur, son niveau sur dix, les XP acquis dans le palier et ceux
qui manquent pour le suivant. Son volet de détails explique les gains d’XP des
cultures, la pratique distincte des transformations et les dix paliers d’accès.
Le profil accompagne la réponse d’équipement existante, sans requête de profil
supplémentaire ; une modification du personnage actualise également la barre.
Les exercices restent identifiés comme démonstrations et ne remplacent pas le
portrait du joueur par un personnage fictif.

## Coûts et capacité

Chaque tente supplémentaire coûte 300 € virtuels et reçoit uniquement son kit de départ : tente, éclairage et extraction. Ses équipements améliorés doivent être achetés et installés pour elle. Elle accède aux machines de transformation déjà acquises dans l’atelier commun.
Le second entrepôt coûte 20 000 € virtuels plus sa première tente à 300 €, soit
20 300 € pour passer de quatre à cinq. Les trois suivantes coûtent chacune 300 €.
Les deuxième, troisième et quatrième tentes demandent les niveaux métier 3, 5 et 7 ;
les cinquième à huitième demandent le niveau 10. L’interface expose le palier, le
solde après achat, la consommation supplémentaire du kit et le stockage disponible.
Un modèle de culture s’achète pour une tente, un service pour son bâtiment, une machine de transformation pour l’atelier commun. Chaque emplacement accepte un seul modèle installé ; les autres restent en réserve à la même destination. Le catalogue et les paniers indiquent ces destinations. Une tente supplémentaire profite des services déjà installés dans son bâtiment ; le second bâtiment ouvre avec ses services vides.

## Culture commune

Les nouveaux lancements des comptes convertis enregistrent `equipment.scope = "building"`. `equipment.tents` contient le profil effectif de chaque tente, incluant les services de son bâtiment ; `equipment.shared` contient uniquement les machines de transformation. Les services d’un même bâtiment doivent avoir les mêmes codes et niveaux dans tous ses profils effectifs. Le stockage physique conserve un seul appareil, rattaché à la tente 1 ou 5 ; ces identifiants techniques ne sont pas présentés comme des achats par tente. Les effets propres aux tentes sont agrégés pour la culture commune ; les effets de transformation, notamment le bonus de qualité du lyophilisateur, s’appliquent une seule fois.
La qualité finale dépend des étapes réussies, selon la règle habituelle.
La quantité totale est la somme des rendements des tentes avec cette qualité commune, le matériel opérationnel, les pertes et le mode énergétique choisi.
Le plafond reste 500 g par tente, soit 4 000 g pour les deux entrepôts.
Une nouvelle tente ne copie ni les améliorations, ni l’usure des autres tentes.

La facture additionne les consommations des tentes et facture le séchoir et la caméra une seule fois par bâtiment. Le solaire réduit la consommation des tentes de son bâtiment. Les devis distinguent les charges des bâtiments et celles des tentes ; l’usure d’un service n’est pas multipliée par le nombre de tentes.
Les incidents respectent également ce périmètre : le vol réduit uniquement le rendement du bâtiment sans sécurité ; une surcharge retire 10 points de rendement aux tentes du bâtiment sans secours solaire, sans modifier les dés de la culture commune. Le journal conserve les pertes de chaque bâtiment et vérifie leur moyenne pondérée au chargement. Ouvrir le second entrepôt ne retire donc pas la protection du premier.
Les anciens cycles conservent leurs instantanés, leur capacité et leur calcul historique. Sans capacité enregistrée, ils restent à une tente.
L’usure progresse sur les équipements engagés au lancement de la culture. Les machines communes vieillissent uniquement lors d’une transformation qui les utilise, une fois par lot. Les soins des chiens acquis sont facturés une fois par bâtiment ; les anciens cycles conservent leurs règles historiques.
Les bonus de réputation restent attribués une seule fois par culture. L’analyse du lot commun coûte **45 € virtuels une seule fois par session de culture terminée**, quel que soit le nombre de tentes. La transformation est facturée selon les grammes traités.

## Installation et vérification

Révision locale du 11 octobre 2026 : les migrations
`20261011120000_kq_chanvrier_career.sql` puis
`20261011120100_kq_gradual_production_expansion.sql` ont été appliquées au projet
lié `eyowwwpdmfrulhkpvlnf` le 11 octobre 2026 à la demande de l’utilisateur. La
prévisualisation ciblée après application confirme qu’elles sont enregistrées.
La migration indépendante `20261010000500_botte_situations_epic.sql`, également en
attente, a été exclue du dossier de déploiement. Cette opération ne publie pas
le code de l’interface.
Les anciens reçus d’extension de quatre à huit restent rejouables, et aucun compte
existant ne perd ses tentes ou ses machines.

Les journaux privés `kq_chanvrier_career_events` et
`kq_chanvrier_processing_practice` empêchent de recompter une culture ou un lot.
Leur lecture passe par un RPC réservé à `service_role` ; aucune permission directe
sur les tables n’est accordée aux rôles API. Un outil de remise à zéro explicite
devra supprimer ces journaux avant leurs cultures/lots parents. Les simples
consultations, ventes et suppressions techniques ne doivent pas effacer la carrière.

Les paliers et capacités sont détaillés dans [les règles du Placard](PLACARD-RULES-DRAFT.md).
La migration `20261011130000_kq_building_services.sql` regroupe sécurité, solaire et
séchoir. Elle a également été appliquée au projet lié le 11 octobre 2026. La
vérification distante confirme les trois migrations, l’accès au RPC de carrière
et 20 comptes en version bâtiment, sans compte restant en version 2 au moment
du contrôle. Reçu local : `output/chanvrier-rework/deployment-receipt.json`.
Les acquisitions et installations d’origine sont archivées dans une table
privée ; le regroupement conserve le niveau maximal et le meilleur état disponibles,
la somme des bases d’achat, les valeurs comptables et leurs dates d’amortissement.
Il n’y a ni débit ni nouvelle valeur comptable. Les devis et reçus antérieurs restent
inchangés. Un compte avec une culture active conserve la version 2 jusqu’à sa clôture,
puis bascule en version 3 à la prochaine initialisation de son équipement, après
l’enregistrement de son usure et de ses factures historiques. La suppression du compte
reste possible et supprime également l’archive privée.

Contrôles dédiés : `scripts/test-chanvrier-career.mjs` exécute une répétition
PostgreSQL isolée avec reprise de l’historique, comparaison SQL/TypeScript,
idempotence, acquisitions anciennes, entretien et permissions.
`scripts/test-building-services.mjs` vérifie le regroupement physique, les valeurs
comptables, les anciens reçus, les cultures actives et la suppression de compte.
`scripts/simulate-chanvrier-career.mjs` vérifie les paliers indépendants du capital ;
`scripts/simulate-chanvrier-economy.mjs` compare plusieurs parcours financiers.
`scripts/audit-chanvrier-career-ui.mjs` vérifie les états de l’interface dans un
navigateur isolé avec des réponses simulées.

Validation locale : 3 037 tests Vitest passent dans 354 fichiers, ainsi que les
répétitions PostgreSQL et les 30 contrôles navigateur à 320 et 1 440 px, avec
un contrôle supplémentaire du défilement à 320 × 640 px. La barre personnalisée
est également vérifiée au clavier et après modification du portrait.
ESLint est valide sur les fichiers modifiés ; le contrôle des permissions valide
292 migrations. TypeScript valide le code source avec la configuration isolée
`output/chanvrier-rework/tsconfig.json` ; le contrôle racine inclut encore un ancien
cache dans `output/css-hmr-fix/` dont les imports générés sont invalides.
Les captures et le rapport navigateur sont disponibles dans
`output/chanvrier-rework/ui/`. Les trois nouveaux identifiants de migration ont été
choisis après contrôle de leur unicité avec les autres travaux en cours.

La simulation financière utilise 100 g par tente, une note de 9,2, une session par
jour, la vente en boutique après curing et le règlement immédiat des charges.
Pour 350 / 1 000 / 5 000 € de départ, le métier atteint le niveau 10 après 45 cultures
terminées ; réunir l’atelier visé prend 243 / 227 / 205 sessions avec une tente,
ou 79 / 75 / 80 avec des extensions. Ce sont des scénarios d’équilibrage, pas des
prévisions de parcours réel. La reprise grossiste de fleur brute dès 6,5/10 passe
à 38 % en marché normal, 35 % en promotion et 39 % en réassort. Pour 100 g,
la marge après TVA, analyse et électricité de départ devient respectivement
5,97 / 1,47 / 7,47 €. La boutique conserve un prix supérieur et ses gains de
réputation. Les autres fleurs, extraits, biomasses et surplus sans contenant
conservent leurs tarifs ; une petite récolte ou une dégradation reste risquée.
Le simulateur contrôle les notes 6,5 / 7 / 8 / 9,2 dans les trois événements.
À 350 € de départ, le parcours exclusivement grossiste ne passe plus en déficit
sur 400 sessions, mais n'ouvre pas les recettes exigeant une réputation commerciale.

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

## Correction des analyses — 10 octobre 2026

La migration `20261010000900_kq_lab_analysis_per_session.sql` fixe l’analyse à **45 € par session terminée**, pour le lot commun à toutes les tentes. La clé unique de culture empêche une seconde facture. Les factures antérieures supérieures à 45 € sont régularisées en tenant compte des paiements : excédent impayé annulé, trop-perçu rendu au portefeuille de jeu, échéances et reçus historiques conservés. Une réexécution ne rembourse rien une seconde fois.

La migration a été appliquée seule au projet Supabase lié le 10 octobre 2026 ; le registre distant et la prévisualisation suivante ont été vérifiés à 17 h 47, heure de Paris. PostgreSQL confirme **9 factures corrigées**, **135 € virtuels de dette annulée** et **270 € virtuels remboursés**. Reçu : `output/lab-analysis-per-session/application.json`. Le code de l’interface n’a pas été publié par cette opération.

Validation : 105 tests ciblés, TypeScript et ESLint valides ; scénarios SQL business, production et trésorerie réussis, incluant 1/2/3/4/8 tentes, paiements partiels et complets, factures multiples, comptes avec ou sans suivi comptable initialisé, revalorisation du stock, conservation des reçus et rejeu. Le contrôle des permissions couvre 283 migrations.

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
