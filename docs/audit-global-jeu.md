# Audit global du jeu — 15 novembre 2026

**Suite autorisée le 15 novembre :** les trois premières priorités ont été implémentées localement : preuve de travail des missions, reprise des confirmations financières et ordres exécutés au prochain cours publié (choix utilisateur). [Livraison et validations](bete-de-concours/global-audit-fixes.json). Deux migrations sont prêtes ; aucune migration distante ni publication. Le diagnostic ci-dessous décrit l’état initial audité.

Arbre local `f87dfd74`. Audit et propositions uniquement : aucun code du jeu, migration ou environnement distant modifié. Une vague de trois spécialistes GPT-6.1 Sol (game design, économie, UX), sans sous-délégation ; coordination et essais locaux séparés. Les documents du 9 novembre ont servi de repères, leurs constats ont été revalidés.

## A. Diagnostic global

**Le Quartier possède une boucle cohérente et des décisions réelles ; sa principale faiblesse est l’inégalité de fiabilité et de lisibilité entre ses systèmes.** On prépare une culture avec variété, cartes, équipement et travail, on arbitre les étapes et incidents, puis on récolte, prépare, conserve, fait évaluer et commercialise. Les recettes financent capacité, matériel et personnel. Missions, carrière, collection et compétition fournissent des objectifs complémentaires.

À conserver : les cartes jouées à des moments précis, les contrats qui contraignent leur usage, l’arbitrage qualité/quantité/coût, les débouchés commerciaux, et le lien entre variété, arômes et demande. Par exemple, Éco réduit l’énergie de 25 % et la récolte de 10 % ; Intensif augmente respectivement de 35 % et 12 %, avec une pression supplémentaire (`kanab-quest-energy.ts:8`). Ce sont des compromis compréhensibles, contrairement à une simple accumulation de bonus.

Les causes principales à traiter sont : des preuves de progression parfois trop permissives ; une récupération des transactions différente selon l’écran ; des cours financiers anciens encore exécutables ; des indicateurs de rentabilité incomplets ; enfin plusieurs conceptions concurrentes du mérite (maîtrise, achats, répétition). Les coûts récurrents ajoutent une difficulté pour les retours espacés.

Le jeu offre des raisons plausibles de revenir : récoltes différées, demandes renouvelées, investissements, contrats et tournois. **Le plaisir, la compréhension autonome et la rétention ne sont pas démontrés.** Ajouter des activités serait prématuré avant de vérifier que les joueurs comprennent et désirent poursuivre celles qui existent.

## B. Couverture et limites

Légende : **C** = établi par lecture du code ; **T** = test local exécuté ; **O** = observé dans l’interface simulée ; **H** = hypothèse à tester ; **NV** = non vérifié. « Actif » signifie accessible dans les chemins applicatifs inspectés, sous réserve des autorisations et configurations. Cela ne certifie pas l’activation en production.

Les chemins abrégés `lib/` et `ui/` désignent `src/lib/` et `src/components/placard/`. Les lignes citées sont celles de cet arbre.

| Système | Rôle et interactions | État, preuves examinées | Vérification |
|---|---|---|---|
| Entrée, compte, introduction | Accès à l’Arène puis au Quartier | `src/app/arene/placard/page.tsx:21`, `lib/kanab-quest-player-access.ts:16` ; accès conditionnel, ouverture datée du 1er novembre | C ; configuration distante NV |
| Quartier, guide, reprise | Priorités, mission suivie, destination suivante | `ui/PlacardPlayerShell.tsx:395`, `lib/kanab-quest-hub-attention.ts:1` ; actif | C/O partiel |
| Culture, dés, incidents | Six étapes, risque et qualité, emploi des cartes | `lib/kanab-quest-game.ts:33,749`, `kanab-quest-care.ts:108,182` ; actif | C/T routes ; cycle complet joué NV |
| Buddies, Botte, Héritages, packs | Variétés, ressources tactiques et pouvoirs ; copies consommées à l’usage | `kanab-quest-heritage.ts:1`, Shell:310, tests card-recovery ; actif | C/T/O préparation |
| Plan, zones, bâtiments, équipements | Capacité, installations partagées, paliers et choix d’investissement | `kanab-quest-equipment.ts:717,848`, préparation/retour plan ; actif | C/O ; tous paliers NV |
| Énergie, climat, sécurité, entretien | Coûts et risques de production/conservation | `kanab-quest-energy.ts:8,23,87`, catalogue équipement, care ; actif | C ; équilibrage net NV |
| Travail personnel | Budget commun de 12 h par journée de jeu | `kanab-quest-player-work.ts:4`, test player-workday ; actif | C/T SQL |
| Personnel, compétences, production autonome | Réserver/déléguer, payer et interrompre ; partage avec culture/atelier | `kanab-quest-staff.ts:253,389,839`, migration `20261110000100` ; actif | C/T ; simulation longue NV |
| Récolte, séchage, trim, affinage | Préparer le lot et accéder au jury/commerce | `kanab-quest-storage.ts:6`, guide hub, scripts workday ; actif, affinage de 6 h réelles | C ; progression longue NV |
| Stockage et débordement | Capacité, dégradation, protection, liquidation | `kanab-quest-storage.ts:8,43` ; grâce de 1 h après verdict, surplus à 0,54 €/g fictif | C ; absence longue NV |
| Atelier, transformations | Arbitrage matériel, travail, rendement et prix | `kanab-quest-economy-balance.ts:190`, `ui/KqEquipmentCatalogModal.tsx:748` ; actif | C/calcul ; marge nette NV |
| Commerce, lots, canaux et prix | Vente en ligne, boutique CBD ou gros ; réputation et capacité | `kanab-quest-commerce.ts:14,26,46`, route commerce ; actif | C/T route ; chaîne SQL complète NV |
| Demande, publicité, site commercial | Adapter produits/arômes, acquisition et renouvellement des ventes | `kanab-quest-customer-demand.ts:5,55,118`, `ui/KqAdvertisingPanel.tsx` ; demande sur 72 h, aperçu 24 h avant | C ; campagne complète NV |
| Contrats initiaux et renouvelables | Objectifs qualité/cartes reliés à la culture | `kanab-quest-contracts.ts:1`, `kanab-quest-renewable-contracts.ts:2` ; actif | C ; récompenses autoritaires serveur |
| Comptabilité, factures, trésorerie | Coûts différés et possibilité de réinvestir | `kanab-quest-business.ts:4`, `ui/KqTreasuryDesk.tsx:177` ; actif | C/T route commerce |
| Banque | Liquidité contre échéances, jusqu’à 7 périodes de 5 jours réels | `ui/KqBankLoans.tsx:89`, `kanab-quest-bank.ts` ; actif | C ; défauts réseau non reproduits en navigateur |
| Crypto et bourse | Placement des liquidités, dépendance à des données externes | migrations `20261005000100`, `20260923000800` ; implémentées, fournisseurs requis | C ; activation/cours réels NV |
| Réseaux et sponsors | Audience, confiance, énergie et rémunération | `kanab-quest-social.ts:185,294` ; actif, cadence Paris distincte | C ; optimisation longue NV |
| Jury, duels humains, bots | Évaluer et comparer les récoltes ; classement | `lib/supabase/kanab-quest-backend.ts:1645`, `kanab-quest-battle.ts` ; actif, entraînements bots plafonnés à 10/jour | C ; rencontres réelles NV |
| Missions, carrière | Récompenses et objectifs graduels ; 20 niveaux de missions | `kanab-quest-mission-progression.ts:24`, migration `20261109000200` ; actif | C/T anomalie ciblée |
| QuizzShow, tournoi, titre | Apprentissage compétitif, meilleure finale hebdomadaire | `ui/KqSchool.tsx:64`, migration `20261114000400:96,391` ; actif | C ; tournoi complet NV |
| Encyclopédie, histoire, fiches | Comprendre les thèmes du jeu ; lecture indépendante | KqSchool, checkpoint du 14 novembre ; actif | C/cartographie ; pas de nouvel audit scientifique |
| Ancien quiz solo et ateliers scolaires | Anciennes boucles d’apprentissage | `kanab-quest-school-navigation.ts:5`, API `_retired-quiz.ts:8` ; retirés, redirections/410 | C |
| Carnet, avis, classements, lots réels | Achats/avis, score global et récompenses clients ; tirage mensuel distinct | `arena-ranking.ts:26`, `arena-customer-rewards.ts:34`, `monthly-review-draw.ts:1` ; implémentés | C ; attribution/livraison réelle NV |
| Anciennes récompenses saison KQ et Carnet | Récompenses historiques à ne pas promettre | `kanab-quest-season-rewards.ts:1`, `kanab-quest-notebook-rewards.ts:8` ; désactivées | C |
| Soutien financier | Contribution réelle séparée du cycle audité | `/api/support`, summary simulée inactive ; pas d’avantage de jeu établi ici | Cartographie ; paiement hors essais |
| Sauvegarde, API, traitements serveur | Identité authentifiée, reçus, révisions, rattrapage et crons | tests runs/actions/commerce/staff/missions, player-workday | T local ; déploiement, concurrence multi-connexion et coût serveur NV |

### Vérifications réellement exécutées

- **202 tests Vitest réussis**, zéro échec : routes démarrage/actions, commerce, personnel, missions, récupération Personnel/cartes. Résultats : `output/audit-global-jeu/tests.json` ; dépendances serveur simulées.
- **206 contrôles SQL réussis** : `node scripts/test-placard-player-workday.mjs`, journal `output/audit-global-jeu/workday.log`. PGlite, une connexion, frontières métier explicitement simulées ; cela ne prouve pas la contention en production.
- **13 contrôles navigateur réussis**, dont préparation à 320/390/1440 px, retour navigateur, rechargement, inventaire indisponible et culture déjà démarrée ailleurs. API mémoire, aucun appel réel ni erreur JS ; deux captures à 320 px inspectées. Preuve : `output/audit-global-jeu/browser/preparation-report.json`.
- **Mission à zéro travail reproduite** : progression 0 → 1, récompense réclamable, sans la réclamer. Fixture d’archive synthétique et vraies fonctions de métrique, avec exclusion Production du 10 novembre appliquée ; transition d’archivage complète non exécutée. Script/résultat : `output/audit-global-jeu/mission-zero-work.mjs` et `mission-zero-work-result.json`.
- Deux limites de recette : `test-placard-mission-evidence.mjs` échoue dans son bootstrap dynamique (`assert is not defined`) ; l’ancien parcours `--guide-only` attend un guide fermé alors que le guide est visible. Ces essais ne sont pas comptés comme réussis et ne démontrent pas des défauts du jeu. Seule la copie locale du harness a reçu une fixture `/api/support` ; aucun test source modifié.

Scénarios : nouveau joueur jusqu’à première réussite **analysé par règles, pas joué intégralement** ; joueur en progression **préparation observée, investissements calculés** ; avancé **code/calcul uniquement** ; retour d’absence **règles analysées et rechargement observé, pas d’absence réelle simulée** ; difficulté **inventaire/réseau de préparation testé, finances inspectées**. Aucune perte générale de sauvegarde, double récompense ou saturation serveur établie. Aucun système supplémentaire seulement prévu n’est certifié ; les composants historiques ne sont pas assimilés à des fonctionnalités actives.

## C. Problèmes prioritaires

Efforts : S = correction localisée ; M = plusieurs composants/règles et validation ; L = refonte. Les priorités produit ne sont pas des niveaux de vulnérabilité.

### 1. Une réservation inutilisée valide une mission — P1, S, C/T

**Scénario :** le salarié termine une réservation Culture/Transformation sans travailler. La métrique compte le statut `completed`, alors que ce statut inclut zéro heure (`supabase/migrations/20261109000200_kq_mission_progression.sql:24`, `src/lib/kanab-quest-staff.ts:253,262`). La modification du 10 novembre, ligne 269, n’exclut que Production. **Effet :** obtenir une preuve d’accomplissement sans accomplissement. **Correction :** compter le travail positif pour ces réservations, conserver les autres tâches légitimes, tester zéro/positif/relecture et ne pas retirer rétroactivement les gains.

### 2. Une confirmation financière peut rester verrouillée et perdre sa reprise — P1, M, C

Banque/Crypto attendent réponse et JSON sans délai applicatif ; fermeture et Échap sont bloqués pendant `busy` (`KqBankLoans.tsx:89-109`, `KqBankConfirmation.tsx:68,142`, `KqCryptoMarket.tsx:119,135-157,192`). La Banque garde sa clé uniquement dans un `useRef` (:30,91). **Effet :** après réponse perdue puis rechargement, le joueur ne sait plus si sa commande a abouti et perd son dossier de reprise. **Aucun double débit démontré.** Étendre le protocole Personnel : dossier persistant par propriétaire, délai, état « résultat à vérifier », réconciliation et même clé au rejeu. Fermer un dialogue ne doit jamais signifier annuler une opération serveur.

### 3. Les placements autorisent un avantage sur des cours anciens — P1, M, C/calcul

La crypto exécute au fixing quotidien de 19 h ; la bourse tolère 45 minutes en séance et 96 h hors séance (`20261005000100_kq_crypto_daily_refresh.sql:21-29,143-170` ; `20260923000800_kq_stock_market.sql:108-112,176-193`). **Cause :** l’heure d’exécution ne correspond pas à l’information disponible au joueur. Illustration fictive : 1 000 € achetés au cours 100 puis revendus au prochain fixing 110 donnent 1 100 €, hors arrondis. Le prochain prix reste incertain : ce n’est pas un gain garanti. **Correction :** exécuter les ordres au prochain fixing annoncé, ou utiliser des cotations réellement contemporaines ; annoncer le statut en attente. Fournisseurs et exploitation effective non vérifiés.

### 4. Le « repère de rentabilité » omet les coûts différentiels — P2, S, C/calcul

Le joueur compare des équipements avec investissement / (paiement transformé − paiement brut), sans travail, usure ni autres charges différentielles (`kanab-quest-economy-balance.ts:190-193`, `KqEquipmentCatalogModal.tsx:748-774`). À qualité 8,8 et 100 g : signature, 4 675 € / 1 779,77 € = **2,6 lots** ; static, 23 350 € / 466,36 € = **50,1 lots**. À 800 g : 0,6 contre 41,7. **Effet :** une récupération brute du capital peut être comprise comme un bénéfice net. Renommer immédiatement « remboursement théorique avant frais », lister les exclusions ; calculer ensuite marge et gain par heure. Ces écarts ne prouvent pas une stratégie dominante nette.

### 5. Le classement global récompense fortement les achats distincts — P2 produit, S/M, C/H

Chaque fleur achetée avec avis approuvé apporte 100 points ; les duels suivent `100 × log2(1 + points/50)` (`arena-ranking.ts:26`). Trois fleurs égalent donc **350 points bruts de duel**, hors Gestion. Les récompenses clients existent séparément des saisons KQ désactivées. **Risque :** le joueur cherchant une compétition de maîtrise peut découvrir tard cette autre logique. Rendre les contributions visibles avant participation et expliquer le classement ; décider ensuite s’il faut distinguer les compétitions dotées. La perception d’iniquité reste à mesurer.

### 6. Les coûts persistent après arrêt du travail pour impayé — P2, M, C/H

La paie rattrape les périodes échues ; les tâches récurrentes s’interrompent en cas d’impayé (`kanab-quest-staff.ts:389,839`). Un mois vaut cinq jours réels (`kanab-quest-business.ts:4`) : quinze jours représentent trois échéances mensuelles. **Risque au retour :** voir les charges continuer sans activité productive. Les explications existent déjà (`KqStaffDesk.tsx:319`, `KqStaffEmployeeSheet.tsx:110`). Ajouter à l’embauche une projection personnalisée de trésorerie et du premier arrêt ; tester avant de décider d’un plafond ou d’une pause d’absence.

### 7. Le titre QuizzShow favorise aussi le nombre d’essais — P2 produit, M, C/H

Meilleure finale hebdomadaire et réinscription après tournoi terminé coexistent, sans quota hebdomadaire dans ce chemin (`20261114000400_kq_school_tournament_weekly_champion.sql:96,391`). **Risque :** volume et mémorisation pèsent sur une comparaison présentée comme une performance. Choisir explicitement entre meilleur résultat illimité et nombre annoncé d’essais classés, en conservant les parties libres. Ce choix n’est pas un bug.

### 8. Les sessions expirées restent des erreurs ordinaires dans les finances — P2, M, C

Banque, Crypto et comptabilité traitent les 401 sans lien de reconnexion contextualisé (`KqBankLoans.tsx:48-59,93-107`, `KqCryptoMarket.tsx:149-156`, `KqTreasuryDesk.tsx:177-184`). **Effet :** répétition inutile ou recherche manuelle de la connexion. Introduire un état partagé « session expirée », bloquer les mutations et conserver le dossier incertain avant redirection interne validée. Dépend du protocole de reprise du point 2.

Les quatre défauts UX du 9 novembre concernant Personnel et focus du quartier sont corrigés dans le code actuel ; ils ne sont pas reconduits. Aucun bug bloquant supplémentaire établi.

## D. Direction recommandée

L’arrivée doit répondre à trois questions : **qu’ai-je, quel objectif poursuis-je, quelle action puis-je faire maintenant ?** Conserver le quartier illustré, les panneaux papier, les coûts visibles et le guide existant. Le rendre utile par l’état réel, sans ajouter de slogans ou de nouvelles couches de navigation.

Une session cible commence par les urgences et résultats depuis la dernière visite, puis un objectif choisi : obtenir un lot de qualité, remplir un contrat ou financer un équipement. Culture, soins et cartes alimentent cet objectif ; la vente ou la mise en affinage prépare la session suivante. Montrer l’échéance réelle, les frais futurs et le prochain choix possible.

Relier davantage les systèmes existants : comparaison nette avant investissement ; demande/arômes dans la préparation ; explication encyclopédique accessible depuis une décision. Garder QuizzShow et placements comme activités facultatives. Unifier les confirmations et la reprise ; ne pas fusionner artificiellement les monnaies, horloges ou classements. Aucun nouveau système n’est nécessaire à ce stade.

## E. Plan d’action

Trois améliorations rapides : corriger la preuve des missions, expliciter le calcul avant frais, rendre les contributions au classement visibles. La priorité d’intégrité reste supérieure à l’ordre de facilité.

| Ordre | Action et dépendance | Critère de réussite observable |
|---|---|---|
| 1 | Corriger la preuve de travail des missions — S | Zéro heure n’avance pas ; travail positif avance une fois ; tâches légitimes conservées |
| 2 | Généraliser la reprise financière depuis Personnel — M | Réponse perdue, rechargement et reconnexion retrouvent le même dossier et son résultat, sans nouvelle commande implicite |
| 3 | Fixer la règle d’exécution des placements — M, décision produit avant SQL/UI | Un ordre ne peut exploiter le cours périmé ; prix/heure/statut affichés concordent avec son reçu |
| 4 | Renommer le repère brut puis chiffrer les frais — S puis M | Le joueur distingue recettes, frais exclus et investissement ; exemple manuel concordant avec le devis |
| 5 | Expliquer les contributions au classement — S, avant éventuel changement de formule | Un participant peut expliquer pourquoi les mêmes duels donnent des totaux différents selon achats/avis et Gestion |

Ensuite : projection des charges d’absence, décision sur essais classés QuizzShow, simulation nette de quelques stratégies débutant/avancé. Un changement économique dépend de cette simulation ; une simplification du parcours dépend des essais de compréhension. Pas de rééquilibrage global à l’aveugle.

## F. Incertitudes à lever

- Faire jouer cinq nouveaux joueurs jusqu’à leur première réussite, sans les guider : prochaine action, coût prévu, conséquence comprise et moment d’hésitation. Cela teste le guidage et la charge cognitive.
- Faire reprendre trois états synthétiques après absence courte/longue ou transaction interrompue : observer récupération et compréhension des charges, sans opérations réelles.
- Comparer quelques trajectoires avec mêmes ressources : vente brute/transformation, joueur occasionnel/actif, avec coûts, temps et invendus. Les simulations actuelles de paiement brut ne suffisent pas.
- Sur QuizzShow, comparer essais et meilleurs résultats ; interroger séparément l’équité des classements. Ne pas déduire plaisir ou rétention des seuls scores.

Restent inconnus : économie distribuée des comptes, demandes réellement consommées, configuration des fournisseurs, attribution des récompenses en production, contention et temps serveur. Ces données manquantes empêchent de conclure sur une pénurie globale, une inflation, une capacité d’accueil ou une stratégie dominante universelle.
