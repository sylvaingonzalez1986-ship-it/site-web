# Clarté du jeu et reprise du Quartier — 11 novembre 2026

Le diagnostic est **partiellement confirmé** : le jeu possède déjà un guide progressif et une recommandation contextualisée. La difficulté restante tient notamment à leur hiérarchie et à une synthèse incomplète lorsque plusieurs activités coexistent. Les lots réalisés améliorent l’arrivée et la reprise depuis le Quartier, la continuité Récoltes → trim → jury et la récupération des confirmations Personnel, sans changer les règles. Ils ne constituent pas une validation de compréhension auprès de débutants.

## Périmètre et environnement

Reprise ciblée du [checkpoint](ux-progress.json), de l’audit de clarté du 29 octobre et des constats UI du 9 novembre ; deux spécialistes ont examiné séparément parcours/game design et UI/accessibilité. Modifications préexistantes conservées.

Stack vérifiée dans les paquets installés : Next.js 16.4.6 (App Router), React 19.2.3, TypeScript, CSS Modules/Tailwind, Supabase JS 2.95.3. Le serveur utilise le client Supabase privilégié ; `vercel.json` configure les tâches planifiées. Le niveau d’abonnement **Supabase Pro n’est pas vérifiable dans le dépôt**. Démarrage normal : `npm.cmd run dev` ; `/arene/placard` exige une session et les autorisations de jeu. `/dev/placard` redirige vers l’administration.

Recettes réalisées avec les bancs Vite/Chromium existants : vrais composants React, API simulées en mémoire, trafic distant bloqué, sans compte réel ni secret. Next.js/authentification et base distante ne sont donc pas validés de bout en bout. Les lectures locales ne déclenchent aucun règlement réel. Guide Next local `01-app/01-getting-started/05-server-and-client-components.md` consulté avant modification.

## Carte courte et décisions du joueur

| Parcours / écrans | Décision et informations indispensables |
| --- | --- |
| Arène → entrée guidée ou libre → Quartier | Trouver la prochaine action. Le guide suit 29 objectifs confirmés et reste réouvrable lorsqu’il est en cours. |
| Entrepôt → Culture | Choisir zones, matériel, Buddies et cartes ; comparer coûts, prérequis, réserve d’heures et résultat estimé avant confirmation. Les dés et décisions construisent la récolte. |
| Récoltes + Atelier | Ranger le bon lot, vérifier capacité/surplus, laisser avancer l’affinage et effectuer le trim. L’attente réelle et les heures de travail sont deux notions distinctes. |
| Jury → Commerce | Présenter une Fleur, lire le verdict, choisir vente ou transformation. Le jury consomme la Fleur d’Arène, conserve le stock récolté. Prix/offres et conséquences doivent rester confirmés par le serveur. |
| Finances → réinvestissement | Surveiller argent du jeu, factures et échéances. Personnel/production autonome, réseaux et développement commercial viennent ensuite. Missions et collections soutiennent la progression. |

Actions fréquentes : consulter, reprendre une culture, préparer les lots et ventes. Actions moins fréquentes : aménager, recruter, investir. Achats, engagements de travail, consommation de cartes/Fleurs et ventes nécessitent leurs confirmations existantes. Aucun de ces mécanismes n’a été modifié.

## Constats priorisés

P1 : obstacle métier/risque de perte de contrôle ; P2 : friction récurrente d’orientation. Fréquence qualitative, non mesurée chez des joueurs. Les lignes corrigées concernent le lot cohérent accueil → activité → retour.

| Priorité / état | Preuve et difficulté | Joueurs / fréquence probable | Décision, effort, risque, confiance |
| --- | --- | --- | --- |
| **P2 corrigé — arrivée/reprise mobile** | Ancien DOM : carte puis recommandation. Dans la recette à 320/390 px, carte à y=12 et recommandation à y=390. Le joueur explore avant de voir l’action utile. | Nouveaux et réguliers ; chaque arrivée mobile. | Résumé avant carte en lecture/mobile ; carte et résumé côte à côte sur bureau. Faible effort, risque d’ordre clavier contrôlé. Confiance élevée sur la géométrie, effet cognitif à tester. |
| **P2 corrigé — plusieurs activités** | `kanab-quest-hub.ts` accumulait culture, ventes, jury, affinage, alertes, puis ne renvoyait que deux faits. Le scénario mixte perdait jury et affinage. | Joueurs avancés/retour ; lorsque plus de deux éléments coexistent. | Deux informations immédiates, autres activités dépliables et raccourcis directs ; priorité principale conservée. Effort faible/moyen, risque de masquer une donnée maîtrisé par tests. Confiance élevée. |
| **P2 corrigé — résumé partiel** | Une erreur équipement/stockage pouvait coexister avec une recommandation valide sans bouton de réessai global. Une donnée manquante pouvait aussi sortir des deux faits affichés. | Tous ; incident réseau ou réponse incomplète. | Récupération explicite visible, sans faux zéro ; bouton occupé, focus conservé même lorsqu’un lien remplace le bouton. Effort faible/moyen, risque de doublon de lecture contrôlé. Confiance élevée. |
| **P2 corrigé — retour clavier** | Effet de focus de `PlacardPlayerShell.tsx` excluait `hub` ; le bouton de retour disparaissait, laissant le focus sur BODY (reproduction du 9 novembre). | Clavier/lecteur d’écran ; chaque retour concerné. | Focus sur le début nommé du Quartier ; Tab atteint l’action prioritaire. Premier affichage et retours au lot préservés. Faible effort/risque, confiance élevée. |
| **P1 corrigé — affinage terminé, trim incomplet** | Récoltes et résumé du lot annonçaient l’accès au jury depuis le seul affinage ; SQL `20261107000200_kq_staff_trim.sql` impose aussi le trim. | Nouveaux et retours ; lot mûr encore non trimmé. | État individuel confirmé transmis aux récoltes, au stockage et au jury. Lien vers le trim du bon lot, récupération si état inconnu ; exemptions historiques et règle serveur conservées. Validé par tests et navigateur avec API simulées, sans reproduction distante. |
| **P1 corrigé — réponse Personnel perdue** | La clé vivait uniquement en mémoire ; fermeture/rechargement perdaient la reprise, POST sans délai applicatif. | Réguliers ; réseau dégradé, fréquence réelle inconnue. | Dossier soumis conservé par propriétaire, même clé/commande à la reprise, délai de 20 s, verrou entre onglets et contrôle du compte côté route. Le résultat doit être confirmé avant suppression. Recettes locales détaillées ci-dessous. |
| **P2 corrigé — session expirée dans Personnel/Atelier** | Le 401 était traité comme une erreur ordinaire ; l’entrée serveur supprimait aussi le contexte de retour. En accès privé, une session expirée pouvait être masquée par un 404. | Tous ; expiration de session. | Proposition de reconnexion avec destination et dossier soumis conservés ; aucune reprise automatique d’une action. Statut d’authentification corrigé dans la route Personnel sans ouvrir les accès privés. |

## Avant / après contrôlé

- À 320/390 px, le début de la recommandation passe de **390 à 12 px** dans le composant isolé. Ces positions excluent l’en-tête et le guide de l’application : ce n’est pas une mesure de temps gagné.
- Le scénario avec surplus, culture, ventes, jury et affinage conserve la même urgence. Les deux activités auparavant absentes sont accessibles via **un dépliage**, avec navigation directe. Pas de nouvel écran ni de requête pour lire ce détail.
- Culture et lots prêts deviennent également des raccourcis, évitant de mémoriser leur destination avant de rechercher un bâtiment.
- Récupération partielle : **trois GET existants**, un par source (`equipment`, `storage`, `commerce?shop=1`). Polling visible, cadences, délais et serveur autoritaire inchangés. Aucune nouvelle souscription.
- Retour clavier : début nommé du Quartier → Tab → action recommandée. Réessai : focus sur le titre du résultat si la commande disparaît ; pas de déplacement si le joueur a focalisé ailleurs.
- Feuilles imprimées, enseignes neuf tranches, carte et illustrations conservées. Texte descriptif/action principale à 14 px, cible principale 48 px, détails et raccourcis au moins 44 px ; mouvement réduit respecté.

Captures inspectées : [avant mobile](../../output/clarity-lot4/quartier/before-resume-320.png), [après mobile](../../output/clarity-lot4/quartier/mixed-320-viewport.png), [activités dépliées](../../output/clarity-lot4/quartier/other-activities-320.png), [bureau](../../output/clarity-lot4/quartier/mixed-1440-viewport.png). Les montants illustrés sont ceux des fixtures, pas des comptes réels.

## Vérifications

| Commande / preuve | Résultat et portée |
| --- | --- |
| Vitest : `kanab-quest-hub`, `hub-attention`, `hub-finance`, `hub-sales` | **81 tests réussis** ; priorité surplus/dettes, heures, données inconnues, faits conservés et destinations. Une attente textuelle du nouveau test a été corrigée puis ses 30 tests relancés avec succès. |
| `node scripts/audit-quartier-resume-lot4.mjs` | **42 cas réussis**, 320/390/1440 : état vide, reprise, affinage, capacité inconnue, surplus, pannes, payload malformé, délai de 10 s, clavier, absence de débordement. Aucun POST ni erreur JS. |
| Même script `--recovery-only` | **12 cas réussis** après finalisation du focus, dont remplacement de Réessayer par un lien vers le trim. Trois lectures par récupération, aucun travail lancé. |
| `node scripts/audit-placard-journey-continuity.mjs --guide-only` | **19 groupes réussis** : entrée/reprise/fermeture du guide, vrai lancement→dés→résolution avec trois mutations en mémoire, résultat confirmé, lot homonyme, affinage/trim, heures 12/0,5/0 et panne. |
| `node scripts/audit-placard-navigation.mjs --focus-only` | **8 scénarios réussis** à 320/1440 après intégration : Atelier, Personnel, menu, historique ; Tab atteint l’action prioritaire. |
| Même script `--clarity-only` | **3 groupes réussis**, 320/390/1440 : retours contextuels lot/stockage/jury. |
| `node scripts/audit-quartier-attention-lot6.mjs --visual-hierarchy-only` | **12 groupes réussis**, 320/390/1440 avec le Shell : recommandation visible au-dessus du menu mobile, dettes/ventes bloquées conservées, carte utilisable, destinations et retour. Zéro erreur JS ou requête externe. Rapport : `output/clarity-lot6/quartier/visual-hierarchy-report.json`. |
| TypeScript global, ESLint ciblé, `git diff --check` | Réussis ; pas de migration, nouvelle dépendance ou modification de boutique/paiement/compte. |

Rapports machine : `output/clarity-lot4/quartier/{before-resume,report,recovery-report}.json`, `output/placard-navigation/{focus-report,clarity-report}.json`, `output/placard-journey-continuity/guide-report.json`. Les bancs anciens ont été adaptés au nouveau découpage des faits et à la variable publique de soutien ; il ne s’agit pas d’un changement de configuration du site.

## Fichiers de ce lot et suite

Produit : `src/components/placard/KqPlacardLobby.tsx`, son CSS Module, `PlacardPlayerShell.tsx`, `src/lib/kanab-quest-hub.ts`.

Vérification : `src/lib/kanab-quest-hub.test.ts`, `kanab-quest-hub-attention.test.ts`, `scripts/audit-quartier-resume-lot4.mjs`, `audit-quartier-attention-lot6.mjs`, `audit-placard-navigation.mjs`. Documentation : ce rapport et `ux-progress.json`.

La boucle complète jusqu’à une vente réelle, les calculs SQL en production, les autres navigateurs, les contrastes de tous les écrans et les lecteurs d’écran réels ne sont pas recertifiés. Les états avancés sont synthétiques ; aucune histoire d’absence n’a été inventée. Les corrections du trim, de la reprise Personnel et de la reconnexion contextuelle ci-dessous sont terminées. La prochaine validation est **l’observation du parcours auprès de débutants**, selon le protocole existant. Aucun commit, déploiement ou changement de données de production effectué.

## Suite réalisée — Récoltes, trim et jury

Après validation de cette priorité par l’utilisateur, deux investigations ciblées ont couvert la projection serveur et le stockage. Les autres changements locaux sont conservés.

- Chaque lot expose un trim confirmé : à faire, partiel, validé ou à vérifier. Les grammes affichés viennent du suivi Personnel ; une contribution partielle ne prétend pas qu’un employé travaille actuellement.
- « Prête pour le jury » exige désormais affinage terminé **et** aucun travail de trim restant. Récoltes, résumé du lot, stockage, réserve du jury et conseil du comptoir suivent cette règle ; file d’attente, duel engagé et lot déjà jugé gardent leurs états.
- Les liens ouvrent le trim du lot exact avec retour à la récolte sélectionnée. Le trim reste accessible pendant l’affinage. Les surplus, frais, prérequis et confirmations jury restent visibles.
- Une réponse absente, malformée ou un échec de lecture Personnel laisse le trim inconnu et propose une vérification. Les lectures dédiées des fleurs et du stockage conservent les récoltes même si cette information complémentaire échoue.
- La projection réutilise le registre Personnel : tous les trims en attente y figurent, mais seuls les 30 derniers terminés sont listés. L’absence confirme donc uniquement qu’aucun travail ne reste, et seulement pour une récolte antérieure au relevé ; aucune histoire de trim n’est inventée. Les anciens lots exemptés restent admissibles.
- Le relevé déjà réglé est réutilisé dans la session principale. Les lectures dédiées fleurs/stockage récupèrent un relevé Personnel par réponse, sans requête par lot. Le POST stockage n’ajoute pas de règlement après paiement. Les règlements existants du Personnel peuvent actualiser son état serveur ; cette recette n’en a exécuté aucun à distance. Pas de nouveau polling, migration ou changement des règles d’admission.

Fichiers principaux : `kanab-quest-flower-trim.ts`, `kanab-quest-jury-readiness.ts`, leurs tests, les types API, les backends fleurs/stockage/Personnel, le modèle récoltes et les composants Récoltes/Stockage/Jury/Commerce. Les simulations pédagogiques déclarent leur préparation confirmée explicitement.

| Vérification | Résultat |
| --- | --- |
| Tests ciblés trim et backends | 124 tests réussis à l’intégration ; après ajout du repli sur panne Personnel, 47 tests fleurs/stockage réussis. Ces nombres ne s’additionnent pas. |
| Modèle récoltes, disponibilité jury, résumé du lot et simulations | 85 tests réussis. |
| Composant stockage | 24 tests réussis : lot exact, inconnus/malformés, affinage, historique, guide et états engagés. |
| `node scripts/audit-ux-jury.mjs --trim-only` | 18 groupes à 320/390/1440 px : trim requis/partiel/inconnu/malformé, affinage, récupération, deux confirmations du jury, conséquence sur la Fleur et stock préservée, clavier et cibles de 44 px. |
| `node scripts/audit-placard-journey-continuity.mjs --trim-journey-only` | 24 groupes à 320/390/1440 px : homonymes, vrai Shell récolte → atelier → retour → jury, grammes confirmés, retour du focus, récupération, anciens lots, file et duel. |
| TypeScript global final, ESLint ciblé, diff-check | Réussis ; ESLint sans erreur, deux avertissements préexistants de variables inutilisées dans le banc de parcours. |

Les deux recettes navigateur ne font aucune mutation ni requête distante et ne signalent ni erreur JavaScript ni débordement. L’état de progression est injecté dans les fixtures, pas obtenu par une transaction réelle. Navigation Next adaptée au banc Vite ; authentification et SQL distant non recertifiés.

Rapports : [jury](../../output/ux-implementation/jury/trim-results.json), [parcours](../../output/placard-journey-continuity/trim-journey-report.json). Captures inspectées : [récolte mobile](../../output/placard-journey-continuity/trim-journey-required-320.png), [jury mobile](../../output/ux-implementation/jury/trim-required-320.png), [trim partiel bureau](../../output/ux-implementation/jury/trim-partial-1440.png), ainsi que les captures atelier et récupération revues lors de la recette. Les captures jury précèdent l’ajout final des mots « et le trim » dans son introduction.

## Suite réalisée — confirmation Personnel après réponse perdue

La commande réellement envoyée, sa clé, son compte, sa date et les détails de confirmation sont conservés avant le POST. Une simple présentation non confirmée reste temporaire. Fermer la fenêtre, changer entre Personnel et Atelier ou recharger conserve le dossier soumis. La reprise est explicite ; aucun POST n’est lancé à l’ouverture de l’écran.

Le serveur déduplique déjà les commandes par compte et clé, avec comparaison de la commande normalisée, avant les contrôles d’éligibilité et les débits. Ses reçus n’ont pas d’expiration. La reprise réutilise ce contrat ; aucune modification SQL ni règle économique. La route vérifie désormais aussi le compte attendu par le navigateur, pour empêcher un changement de session dans un autre onglet d’exécuter la demande sous un autre propriétaire.

- Réponse perdue, 401, erreur serveur, JSON incomplet et délai dépassé conservent le dossier. Le délai de **20 secondes** inclut la lecture du corps ; les réponses tardives, les démontages et les changements de compte ne remplacent pas l’état courant.
- Un premier refus explicite peut libérer la demande. Un refus reçu après une réponse déjà incertaine conserve le dossier : il ne prouve pas que la première invocation ne peut plus aboutir. Les nouvelles opérations Personnel restent bloquées tant que cette incertitude n’est pas résolue ; la consultation des autres écrans reste possible.
- Un verrou navigateur par propriétaire couvre sauvegarde, POST borné et traitement du résultat. Un autre onglet ne lance pas de POST concurrent et doit reprendre explicitement le dossier conservé. Sa suppression ailleurs ferme une présentation devenue ancienne et demande une actualisation.
- Une reprise ne projette pas un second débit et n’est pas bloquée par un solde devenu inférieur au coût initial : le premier paiement peut avoir abouti. Les montants et conditions originaux restent visibles.
- Échec de sauvegarde : aucun premier POST. Dossier illisible : aucune substitution silencieuse. Sans Web Locks, l’envoi réel est bloqué avec une explication ; un navigateur récent en contexte sécurisé est nécessaire.
- Le tutoriel garde ses dossiers en mémoire, isolés par instance de simulation, sans lire ni écrire les confirmations du compte réel. Le contexte du compte vient du Shell alimenté par la session serveur.
- Les panneaux, matériaux, commandes de 44 px, confirmations et retours de focus existants sont conservés. Fermer une reprise revient au bouton du dossier si l’action d’origine est devenue désactivée.

Fichiers : `KqStaffOperations.tsx`, nouveau `KqStaffRecoveryContext.tsx`, gardes Personnel/Atelier et contexte du Shell ; nouveau `kanab-quest-staff-recovery.ts` avec tests ; route `/api/arena/placard/staff` et ses tests ; mode `--recovery-only` du banc navigateur existant. Une revue ciblée a identifié puis vérifié la correction de concurrence entre onglets.

Tests unitaires/API : **60 réussis** sur la conservation/lecture du dossier, l’isolation par propriétaire, le délai et les réponses tardives, la route et l’idempotence du backend. Les essais restent locaux ; aucun compte, paiement ou règlement réel n’a été utilisé. Le banc injecte les interruptions et conserve son serveur fictif entre rechargements.

| Vérification finale | Résultat |
| --- | --- |
| `node scripts/audit-placard-staff-ui.mjs --recovery-only` | **16 groupes réussis** : 320/390/1440 px, pertes avant/après enregistrement, fermeture/retour/rechargement, débit de 70 € fictifs et réservation de 2 h uniques, échecs de stockage/lecture, solde réduit après débit, compte/déconnexion et tutoriel. Deux onglets réels vérifient le verrou pendant le POST et le nettoyage, sa libération après réponse/délai, et la fermeture d’une présentation dont le dossier a été résolu ailleurs. Délai mesuré : 20 013 ms. |
| `node scripts/audit-placard-staff-ui.mjs --staff-moments-only` | **4 groupes réussis** : embauche et formation, annulation, réponse perdue/réessai, paiement unique, retour du focus et absence de réaction inventée après lecture/remontage. Deux anciens sélecteurs du banc ont été adaptés à la navigation actuelle avant la relance réussie. |
| TypeScript global, ESLint ciblé et diff-check | Réussis, sans erreur ni avertissement ESLint sur le lot. Le dernier ajustement d’indentation du bloc d’envoi a été vérifié comme ne modifiant aucun jeton. |

Les deux recettes ne signalent aucune erreur JavaScript ni requête distante. La régression ordinaire est consignée dans [staff-moments-report.json](../../output/placard-staff-ui/staff-moments-report.json). Authentification réelle, autres moteurs de navigateur et transactions SQL distantes ne sont pas revalidés.

Captures inspectées : [reprise après débit à 320 px](../../output/placard-staff-ui/recovery-lose-after-320.png), [reprise sur bureau](../../output/placard-staff-ui/recovery-lose-before-1440.png). Rapport de récupération : [recovery-report.json](../../output/placard-staff-ui/recovery-report.json). Les montants montrés sont ceux des fixtures.

## Suite réalisée — reconnexion dans Personnel et Atelier

Le code HTTP 401 ouvre maintenant une explication et le lien « Se reconnecter », y compris dans une confirmation ouverte et si la réponse ne contient pas de JSON exploitable. Le suivi conserve ses dernières données, signalées comme anciennes, et bloque les commandes, dont la paie. Les lectures automatiques de ce suivi s’arrêtent tant qu’il reste dans cet état. Les erreurs de service ou de disponibilité ne sont pas transformées en expiration de session.

Le lien mène à la connexion existante par navigation complète. Son paramètre `next` contient la destination canonique du jeu, ses paramètres d’écran, de lot, d’employé et de retour, ainsi que le fragment présent côté navigateur. Les détails de commande et sa clé ne sont pas ajoutés au lien. Le filtrage `sanitizeNextPath` existant reste utilisé ; aucune destination externe n’est suivie. L’entrée serveur `/arene/placard` conserve également les paramètres de la requête lorsqu’elle doit rediriger un visiteur non connecté, au lieu de revenir systématiquement à l’accueil du jeu.

Le dossier déjà envoyé reste enregistré pour son propriétaire pendant la connexion. Retour au même compte : il peut être repris explicitement avec la même commande et la même clé. Retour à un autre compte : le dossier du premier n’est ni affiché ni envoyé. Le refus structuré `staff_owner_changed` propose lui aussi une reconnexion au compte d’origine. Aucun POST Personnel n’est déclenché automatiquement après le retour ; les brouillons non soumis restent temporaires comme dans le lot précédent. Les états internes non représentés dans l’URL, comme un formulaire non soumis, ne constituent pas une sauvegarde de navigation.

Une revue a révélé que le contrôle d’accès privé de la route Personnel renvoyait 404 avant de distinguer l’absence de session. La route vérifie désormais l’activation du module, l’identité puis l’accès de cette identité : module désactivé et compte connecté non autorisé restent en 404 ; identité absente avec module actif passe en 401. Les règles d’ouverture, les droits bêta/admin, les contrôles du propriétaire, les limites de requêtes et les vérifications du corps sont conservés. Aucun autre endpoint ni mécanisme global de connexion n’est modifié.

Produit : `kanab-quest-staff-reauth.ts`, suivi et confirmation `KqStaffOperations`, matériau du lien dans `KqStaffDesk.module.css`, états bloqués/anciens Personnel et trim, page d’entrée et route Personnel. Réutilisation du vrai `AccountLoginForm`, sans changement de son code. L’essai tutoriel reste isolé et ne propose pas de connexion réelle.

**178 tests ciblés réussis** : destination sûre, contexte et paramètres répétés, lecture d’une réponse 401 sans décodage de corps, conservation et délai du dossier, entrée serveur et route Personnel. Les tests d’accès utilisent le vrai contrôle d’identité et couvrent l’accès privé expiré, les comptes non autorisés, l’ouverture publique et la période précédant l’ouverture. TypeScript global, ESLint ciblé et diff-check réussis.

`node scripts/audit-placard-staff-ui.mjs --reauth-only` : **17 groupes réussis à 320/390/1440 px**, avec 401 malformés sur lecture et confirmation, premier chargement et dernières données conservées, vrai formulaire de connexion, connexion refusée puis réussie, URL complète au retour, absence de POST Personnel automatique et reprise identique avant/après enregistrement simulé. Changement de compte, propriétaire refusé, paie désactivée, erreurs503/419 et isolement du tutoriel vérifiés. Aucun débordement, erreur JavaScript ou appel distant. Le clavier est contrôlé avec la page de test au premier plan ; le dialogue natif bloque les commandes d’arrière-plan sans ajouter de piège clavier personnalisé. Rapport : [reauth-report.json](../../output/placard-staff-ui/reauth-report.json).

Captures inspectées : [session expirée dans Personnel à 390 px](../../output/placard-staff-ui/reauth-get-stale-staff-390.png), [confirmation de trim conservée à 320 px](../../output/placard-staff-ui/reauth-post-workshop-320.png). Les boutons simples en haut de la fixture sont des commandes du banc, pas la navigation du site.

Portée : composants réels Personnel/Trim et formulaire de connexion, navigation et API simulées sur le serveur local du banc. Ce n’est pas un test avec Supabase distant, des identifiants réels ou le Shell complet ; l’entrée Next.js est couverte séparément par les tests de page. Aucun compte réel, règlement ou déploiement utilisé. Les nouveaux joueurs n’ont pas encore été observés.

## Retrait de « Choisir un objectif »

À la demande de l’utilisateur, le bouton affiché dans le Quartier sans objectif épinglé est supprimé, ainsi que son conteneur et sa marge. Les objectifs volontairement épinglés restent visibles et Missions conserve ses accès. Retirer une épingle ramène le focus clavier sur le Quartier ; aucun bouton de remplacement n’est affiché.

Validation locale : TypeScript global, ESLint ciblé, 39 contrôles navigateur d’épinglage et 42 cas du Quartier réussis à 320/390/1440 px. Absence du bouton au démarrage, après rechargement et après retrait ; aucune lecture Missions sans épingle ; persistance, isolation des comptes et du tutoriel, erreurs/réessai et focus conservés. Capture mobile inspectée, aucune erreur JS ni mutation métier. Rapports : `output/pinned-mission-lot4/report.json` et `output/clarity-lot4/quartier/report.json`. API simulées ; aucune publication.

## Retrait de l’aide et du bouton de pause du Quartier

À la demande de l’utilisateur, le bouton Aide en haut à droite de la carte et son panneau sont supprimés, ainsi que le bouton de pause/reprise des animations et son conteneur sous la carte. Imports, état de pause manuelle et styles inutilisés retirés. Les animations restent actives et respectent le mouvement réduit de l’appareil et leur suspension automatique hors écran, lorsque l’onglet est masqué ou pendant le déplacement de la carte.

Validation : TypeScript global et ESLint ciblé réussis. Recettes locales à 320/390/1440 px : aide et pause/reprise absentes, aucun conteneur vide sous la carte (écart mesuré de 0 px), 24 cibles bâtiments, 24 focus en zoom et panoramique tactile. Animation réelle, mouvement réduit et suspension hors écran vérifiés. Aucun débordement ni erreur JavaScript, capture mobile inspectée. Rapports actualisés : `output/clarity-lot5/navigation/after/report.json` et `output/placard-navigation/motion-report.json`. API simulées ; aucune publication.

## Retrait du bouton Son des packs Buddies

À la demande de l’utilisateur, le bouton Son de l’ouverture des packs Buddies et ses styles sont supprimés. Le composant ne charge plus le hook sonore et n’appelle plus les effets audio ; les animations, les cartes et la logique d’ouverture restent conservées.

Validation : TypeScript global, ESLint ciblé et neuf groupes navigateur réussis à 320/390/768/1440 px. Absence du bouton et zéro contexte audio pendant les cinq raretés, la fermeture et le remontage ; ouverture unique, réessai avec le même ticket, résultat tardif ignoré, clavier/focus et mouvements réduits vérifiés. Captures mobile/bureau inspectées ; aucune erreur JavaScript ni requête externe. Rapport : `output/pack-opening-studio/report.json`. API simulées ; aucune publication.

## Séances avec des débutants — protocole préparé et retours joueurs

**Retour utilisateur au 11 novembre : des joueurs ont déjà testé et aucun bug ne lui a été signalé pour l’instant.** Cette précision remplace la précédente indication d’absence de testeurs. Le nombre de joueurs, leur expérience, la version essayée et les parcours couverts ne sont pas précisés. Aucun compte rendu d’observation structurée n’a été reçu : le compteur à zéro de la grille ne signifie donc pas que personne n’a joué. L’absence de bug signalé ne suffit pas à conclure sur les hésitations ou la compréhension du parcours.

La prochaine démarche légère consiste à recueillir les retours des joueurs existants : « À quel moment as-tu hésité ? », « Savais-tu quoi faire ensuite ? », « Les coûts et les conséquences étaient-ils clairs avant de confirmer ? ». Aucun correctif supplémentaire n’est identifié par leur retour actuel. Le protocole ci-dessous reste disponible pour une observation structurée ; il rend opérationnelle la [section 14 du protocole existant](AUDIT-CLARTE-ET-PARCOURS-2026-10-29.md), sans ajouter un nouvel audit. Version de séance : `debutants-2026-11-11-v1`.

La [grille CSV](observations-debutants.csv) contient uniquement les en-têtes, sans participant fictif ni résultat prérempli. Cette annexe et les critères ci-dessous sont réservés à l’observateur ; ne pas les afficher au joueur pendant l’essai.

### Invitation prête à copier

Si une série de premières découvertes est organisée, commencer par une personne pour le pilote, puis réunir 5 à 8 nouveaux joueurs pour la série principale. Les joueurs ayant déjà essayé peuvent donner des retours, mais ne sont plus des primo-utilisateurs. Ce message est un brouillon ; aucune invitation n’a été envoyée par l’agent. Fixer le rendez-vous une fois l’accès de test vérifié.

> Je cherche des personnes qui n’ont jamais joué au jeu de gestion des Chanvriers Bretons pour essayer ses premiers écrans. La séance durera environ 40 à 45 minutes, sur téléphone ou ordinateur. Vous découvrirez le jeu et direz ce que vous comprenez ou ce qui vous fait hésiter. Aucune expérience particulière n’est nécessaire : c’est la clarté du jeu que nous voulons tester. Si cela vous intéresse, indiquez votre appareil habituel et vos disponibilités.

Avant de retenir une personne, vérifier qu’elle n’a ni conçu ni déjà essayé le jeu. Noter sa pratique des jeux de gestion pour varier les profils, sans exclure les débutants. Conserver les coordonnées d’organisation hors de la grille d’observation et du dépôt ; la grille utilise uniquement les identifiants de participants.

### Conditions à réunir

- Un pilote, puis **5 à 8 personnes qui découvrent le jeu**, sans participation à sa conception. Noter leur pratique des jeux de gestion et leur appareil habituel. Une personne revenant pour la deuxième partie reste le même participant. Affecter les identifiants P01, P02… seulement une fois les personnes confirmées.
- Une version identifiable et accessible sur un environnement de test isolé, avec les écrans natifs et le guide progressif de la ferme. Préparer des fermes de test séparées et vérifier leur état avant chaque séance. Aucune commande ni modification de compte de production n’est prévue par cette préparation.
- Noter l’URL, la version du code, l’état du guide, les lots et les moyens disponibles côté serveur. Les montants, quantités et échéances de la grille de l’observateur viennent de ces états, jamais d’une valeur inventée pour remplir le protocole.
- Observer aussi des utilisateurs sur téléphone si l’accès le permet. Noter le vrai appareil : une fenêtre d’ordinateur de 390 px n’est pas un téléphone.
- Le mode « Apprendre à jouer » et les démonstrations locales constituent un autre périmètre. Les identifier comme `simulation`, séparé de `ferme_test_native` ; leurs observations ne valident ni l’authentification réelle ni la continuité de la ferme. Les bancs automatisés existants ne sont pas des participants et ne sont pas un accès public prêt pour une séance.

La séance principale dure **environ 40 à 45 minutes**, avec une tâche à la fois. L’observateur prévoit le temps, sans imposer de rapidité au participant. Si le pilote conduit à modifier les consignes ou les états de départ, changer la version du protocole et séparer ses résultats de la série principale.

### Introduction à lire

« Nous regardons si le jeu est compréhensible. Ce n’est pas vous que nous évaluons. Faites ce qui vous semble naturel et dites ce que vous cherchez, ce que vous comprenez et ce qui vous fait hésiter. Vous pouvez utiliser les aides du jeu, choisir de ne pas confirmer une action ou arrêter la séance. Je vous donnerai un objectif à la fois. »

Utiliser des identifiants anonymes dans les notes. Aucun mot de passe n’est demandé à l’observateur ni inscrit dans la grille. Les notes suffisent ; un enregistrement éventuel nécessite l’accord du participant et se coupe pendant la saisie d’identifiants.

### Parcours principal

Prévoir 3 minutes d’introduction, environ 30 à 35 minutes de tâches et 5 minutes de retour. Les durées ci-dessous servent à organiser la séance, pas à souffler une solution. Toute tâche indisponible est notée `non_teste`, avec sa raison.

| ID / durée indicative | État à préparer pour l’observateur | Consigne à lire, sans ajouter de noms de boutons | Ce que l’observateur relève |
| --- | --- | --- | --- |
| S01 · 3 min | Première arrivée dans la ferme ; état du guide consigné. | « Vous découvrez cette ferme. Montrez ce que vous feriez d’abord et expliquez ce que cela va changer. » | Première action comprise, guide découvert ou ignoré, hésitations. Laisser le joueur choisir son chemin. |
| S02 · 7 min | Ferme permettant un premier lancement ; budget et matériel connus de l’observateur. | « Commencez votre première culture et prenez une première décision. Avant de confirmer, expliquez ce qui va être utilisé. » Puis : « Vous voulez continuer sans le panneau d’aide. Faites-le, puis retrouvez cette aide. » | Décision et coût compris, aide réduite/fermée/retrouvée, progression conservée. Ne pas exiger une récolte complète en quelques minutes. |
| S03 · 5 min | Nouvelle récolte de test, contenant disponible ; identité exacte relevée. | « Voici la récolte [nom et date affichés]. Rangez-la à l’endroit qui vous paraît adapté. » | Bon lot, quantité, capacité, distinction acheté/installé/disponible, compréhension du surplus éventuel. |
| S04 · 5 min | Même lot en affinage, avec une préparation encore nécessaire ; échéance et état réels notés hors de la vue du joueur. | « Que pouvez-vous faire avec ce lot maintenant, et quand pourrez-vous poursuivre vers le jury ? » | Découverte du travail restant sans prononcer « trim » ni « Atelier » à sa place ; attente réelle distinguée du travail, prochaine action et bon lot. |
| S05 · 4 min | Lot admissible confirmé, ou retour ultérieur au même lot ; identité et changement d’état annoncés. | « Préparez ce lot pour le jury. Avant de confirmer, expliquez ce qui sera utilisé et ce qui restera. Vous pouvez décider de ne pas confirmer. » | Compréhension de la Fleur consommée et du stock conservé ; annuler peut être un choix éclairé, pas un échec automatique. |
| S06 · 5 min | Lot après verdict réellement confirmé dans l’environnement de test. | « Retrouvez ce lot et choisissez comment vous souhaiteriez le vendre. Expliquez votre choix et les conséquences avant de confirmer. » | Identité maintenue, circuit trouvé, quantité et coût compris. Ne pas orienter vers un circuit préféré par l’observateur. |

**Attentes et changements d’état.** L’affinage de six heures ne se compresse pas pour prétendre avoir validé le parcours réel. Pour suivre la même récolte, organiser une reprise après l’échéance serveur et conserver le même identifiant de participant et de lot. Si cela n’est pas possible, utiliser un lot distinct déjà prêt en annonçant : « Pour la suite, nous passons à une autre récolte déjà prête. » Le noter comme changement d’état préparé. Cette variante observe jury/vente, mais ne prouve pas la continuité de S02 à S06. Un verdict en attente peut lui aussi nécessiter une reprise ; un lot différent doit toujours être signalé.

Les opérations de jeu sont réalisées uniquement dans l’environnement de test prévu. Une décision expliquée avant engagement permet déjà d’évaluer la compréhension ; noter distinctement si l’action a ensuite été confirmée, annulée ou laissée en attente.

### Compléments lors d’une deuxième séance, ou si le parcours principal laisse du temps

Ne pas faire passer ces variantes avant la découverte initiale : elles peuvent apprendre les réponses au participant. Ne provoquer les incidents que dans un environnement dont l’isolation et les commandes de simulation sont vérifiées.

| ID | État et consigne | Observation attendue, non lue au participant |
| --- | --- | --- |
| S07 · reprise | Ferme avec plusieurs activités réelles de test. « Vous reprenez cette ferme. Que feriez-vous maintenant, et pourquoi ? » | Urgence, attente et opportunité distinguées ; activités supplémentaires trouvées. Un état préparé n’est pas une absence réellement vécue par le joueur. |
| S08 · confirmation incertaine | Réponse perdue simulée sur une demande de test déjà envoyée. « Vous n’avez pas reçu de réponse. Que feriez-vous pour savoir où en est votre demande ? » | Dossier retrouvé après fermeture/rechargement, absence de nouvelle demande indépendante, compréhension du résultat. L’observateur connaît le scénario avant/après enregistrement et note lequel a été utilisé. |
| S09 · session expirée | Expiration simulée avec un dossier conservé. « Vous souhaitez poursuivre cette opération. Faites ce qui vous paraît nécessaire. » | Reconnexion découverte, retour au bon écran et lot, reprise volontaire, compréhension qu’aucune opération n’est relancée automatiquement. |

### Conduite et saisie

- Laisser le joueur utiliser le guide et l’aide du produit ; les noter dans `aide_produit`. Cela reste une démarche autonome tant que l’observateur n’a pas donné d’indice.
- Une relance neutre comme « Que cherchez-vous ? » n’indique pas la solution. Tout indice de navigation ou de vocabulaire donné par l’observateur est consigné dans `indice_moderateur` et rend la réussite assistée. Ne pas nommer le bouton, le prérequis manquant ou le chemin avant cette consignation.
- Chronométrer à partir de la fin de la consigne. `temps_action_comprise_s` correspond à la première intention verbalisée avec un sens cohérent ; un clic seul ne prouve pas la compréhension. `temps_tache_active_s` exclut une interruption technique ou l’attente de plusieurs heures. Si la mesure manque, laisser vide, sans inscrire zéro.
- `resultat` : `autonome`, `assiste`, `echec`, `non_teste` ou `interrompu`. Une indisponibilité de l’environnement n’est pas un échec du joueur. Noter séparément `comprehension` : `correcte`, `partielle`, `incorrecte` ou `non_evaluee` ; une opération effectuée avec une conséquence mal comprise ne valide pas la compréhension.
- `detours` décrit les destinations réellement visitées. `lot_cible` et `lot_choisi` permettent de repérer une erreur entre récoltes homonymes. Un champ vide signifie non relevé, pas « aucun problème ».
- `verbatim` contient uniquement les mots effectivement entendus. `observation` décrit ce qui s’est passé ; séparer ensuite l’interprétation et l’idée de correction. Référencer une capture ou un instant d’enregistrement dans `preuve` seulement s’il existe.

### Retour et décision après les séances

Questions de fin : « Qu’essayiez-vous de faire ? », « À quel moment avez-vous hésité ? », « Qu’est-ce qui vous a permis de reprendre ? », « Qu’est-ce qui vous ferait arrêter ou revenir ? ». Ne pas présenter la liste des correctifs du 11 novembre avant ces réponses.

Conserver les cibles exploratoires de la section 14 : première action comprise en dix secondes ; première décision de démonstration en moins de trois minutes ; environ quatre personnes sur cinq réussissant les tâches fréquentes sans indice de l’observateur. **Dix secondes n’est pas un signal pour aider**, et le seuil de trois minutes ne s’applique pas automatiquement à une culture native. Rapporter les nombres observés `x/n` par tâche et par mode ; ne pas transformer ce petit groupe en preuve statistique de rétention ou de gain de temps.

Une confusion sur un débit, une consommation définitive ou le compte utilisé est prioritaire, même isolée. Pour les autres difficultés, rapprocher les faits concordants et leur fréquence dans les séances effectivement réalisées. Chaque constat retenu comporte la tâche, les observations, les personnes concernées, l’aide nécessaire, l’impact et une correction bornée à vérifier. Ne pas modifier la direction artistique sur la seule préférence d’un participant.

**Condition de clôture de `playerResearch` :** observations humaines recueillies, incompréhensions prioritaires analysées, corrections nécessaires effectuées et contrôlées. La préparation présente et l’absence de bug signalé ne remplissent pas à elles seules cette condition. Les observations structurées, taux de réussite et verbatims restent actuellement vides ; le retour général de l’utilisateur est consigné en tête de cette annexe.
