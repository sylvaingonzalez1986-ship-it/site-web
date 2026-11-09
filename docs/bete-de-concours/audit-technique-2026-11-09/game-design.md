# Audit game design — 9 novembre 2026

Périmètre : boucle Culture → trim/affinage → jury → commerce → développement, Personnel, Défis et lien avec achats/classement. Lecture du code local et de sections ciblées du checkpoint. Aucun serveur lancé, aucune clé, donnée joueur ou requête distante utilisée. Les constats portent sur l'arbre de travail, qui contient des changements non publiés. Les comportements humains ci-dessous sont des hypothèses à tester, pas des résultats d'observation.

## Boucles et économie constatées

| Moment | Parcours existant et enjeu |
| --- | --- |
| Première découverte | Essai local reproductible, six étapes, récolte assurée et gains explicitement fictifs ; une carte prêtée introduit le choix tactique. Source : `src/lib/kanab-quest-first-culture.ts:createKqFirstCulture:24-33`, `src/components/placard/KqFirstCultureTrial.tsx:136-183`. |
| Première partie officielle | Budget de départ 1 000 € du jeu ; accueil de trois Buddies ; choix variété/installation/cartes, puis lancer, réaction/soin et résolution sur six étapes. Une aide spéciale à la première culture existe. Sources : `supabase/migrations/20261019000300_kq_starting_budget.sql:5-7`, `20261019000400_kq_starter_buddies.sql:52`, `src/lib/kanab-quest-game.ts:KQ_STAGES:33`, `hasKqFirstCultureRescue:1233-1234`. |
| Session habituelle | Chaque étape de culture coûte 0,5 h de travail, soit 3 h pour six étapes prises personnellement. Trim obligatoire avant jury : 60–150 g par heure de travail selon compétence, ×4 à la machine avec pénalité de qualité. Affinage de six heures réelles. Le verdict permet de valoriser le lot ; le commerce répartit marge, volume, qualité et fidélisation entre canaux. Sources : `kanab-quest-player-action-costs.ts:6`, `kanab-quest-staff-trim.ts:12-30`, `kanab-quest-storage.ts:5-10`, `kanab-quest-hub.ts:getKqPlacardNextAction:28-78`, `kanab-quest-commerce.ts:146-246` (fichiers sous `src/lib/`). |
| Retour | Le hub cherche d'abord les volumes non protégés, puis dettes/ventes bloquées, reprise de culture, trim, jury et affinage. Il préserve les états inconnus et offre une actualisation. Le temps écoulé continue de produire salaires, échéances et vieillissement des stocks. Sources : `src/lib/kanab-quest-hub.ts:getKqPlacardResume:114-229`, `kanab-quest-staff.ts:344-398`, `kanab-quest-storage.ts:406-423`. |

| Ressource | Sources | Dépenses et limites |
| --- | --- | --- |
| Argent du jeu | Budget initial, ventes, Défis/paliers, bonus de commandes et Carnet | Matériel, soins, transformations, emballage, marketing, déplacements, salaires, charges. TVA et prélèvements sur ventes ; dette ne prend au maximum que la moitié de la recette après charges dans `previewKqBusinessPayment` (`src/lib/kanab-quest-business.ts:110-122`). |
| Temps personnel | 12 h à chaque nouveau jour de jeu de quatre heures réelles | Réserve commune sans report ; gestes instantanés débités et tâches en temps réel. Les compétences réduisent certains gestes jusqu'au dixième du coût initial. `kanab-quest-player-work.ts:4-14`, `kanab-quest-business.ts:3-8`, `kanab-quest-player-action-costs.ts:39-45`. |
| Personnel | Recrutement, expérience, formation, plan hebdomadaire volontaire | Salaire, disponibilité contractuelle, journées de repos, heures réservées, déplacement. Il peut remplacer le joueur et automatiser certaines opérations ; il ne supprime pas les capacités métier. `kanab-quest-staff.ts:43-54,598-633,722-800`. |
| Cartes et progression | Accueil, packs, missions, victoires ; 72 Défis dans 12 secteurs, 20 niveaux permanents | Cartes Botte consommées à l'usage, XP de culture dépensée tactiquement ; XP de mission inscrite une fois au reçu. Les paliers débloquent notamment cinq raretés de Buddies. `supabase/kanab-quest-backend.ts:2587-2611` sous `src/lib`, `supabase/migrations/20261109000200_kq_mission_progression.sql:7-10,210-262`. |
| Récoltes et capacité | Résultat des cultures, quantité/qualité, transformation | Temps de trim/affinage, contenants, vieillissement, demande et saturation. Les canaux ont des délais de recharge et les arrondis de recettes sont cumulés pour éviter l'arbitrage par fractionnement. `src/lib/kanab-quest-commerce.ts:46,160,190-217`, `kanab-quest-storage.ts:406-415`. |

La profondeur stratégique existe : choix qualité/débit, manuel/machine, vente rapide/marge, compétence/délégation, variété/spécialisation. Aucun gain monétaire infini immédiatement répétable n'a été démontré dans ce périmètre. Les Défis sont finis et les reçus rejoués ne repaient pas ; les entraînements sont plafonnés à dix par jour et la fleur d'arène est consommée. Cela n'est pas une preuve exhaustive d'absence d'exploitation. Le défaut GD-1 fournit un progrès sans travail utile, avec un plafond de récompenses ; ce n'est pas une création monétaire infinie.

## Cinq constats prioritaires

### GD-1 — P1 — Une réservation salariée inutilisée valide un Défi de travail terminé

**Fait reproduit localement.** La métrique SQL compte toute archive de tâche salariée dont `status='completed'`. Or `completeTask` termine aussi les réservations Culture et Transformation utilisées à **0 h** ; le compteur de carrière `completedTasks` les exclut expressément. Les réservations peuvent être créées sans culture/lot cible. Le trigger d'archive conserve toutes les tâches `completed`, sans filtre de travail effectif.

**Preuves.** `src/lib/kanab-quest-staff.ts:completeTask:227-242` ; `applyKqStaffManualCommand:611-619` ; `supabase/migrations/20261107000600_kq_staff_archive.sql:kq_staff_archive_transition:115-120` ; `supabase/migrations/20261109000200_kq_mission_progression.sql:kq_mission_metrics:22-24,38`.

**Reproduction.** Le setup PGlite existant de `scripts/test-placard-mission-progression.mjs` est réutilisé avec la vraie fonction SQL. Une archive synthétique `completed`, `cultureShift=true`, `hours=0.5`, `cultureUsedHours=0` fait passer `staff-first-task` de 0 à 1 et `claimable=true`. Aucun gain réclamé, zéro reçu et aucun appel distant. Résultat : [mission-zero-work-result.json](mission-zero-work-result.json). Diagnostic : [mission-zero-work-diagnostic.mjs](mission-zero-work-diagnostic.mjs). Limite : l'insertion d'archive est synthétique ; le moteur de complétion et le trigger ont été lus, pas exécutés dans cette reproduction.

**Impact.** Les missions récompensent une présence inutilisée ; fractionner des réservations devient avantageux pour atteindre les paliers sans accomplir l'activité annoncée. Fréquence réelle inconnue.

**Correction minimale.** Exclure les réservations `cultureShift`/`processingShift` dont les heures utilisées sont nulles ; conserver les tâches historiques réellement travaillées et les reçus acquis. Ajouter un contrôle SQL sur les deux genres et une réservation effectivement utilisée. Ne pas modifier rétroactivement la migration déjà appliquée déclarée : prévoir une migration suivante.

**Effort :** S (environ 0,5–1 jour avec régression SQL/grants). **Confiance : élevée** sur la métrique ; intégration complète à confirmer.

**Portée de publication.** La migration du 9 novembre est non suivie dans Git au moment de l'audit. `output/mission-progression-migration/completion.json` déclare une application vérifiée le 9 novembre à 20:18 UTC, avec `codePublished=false`. C'est une preuve historique locale ; aucune vérification nouvelle du déploiement ou de la production n'a été faite.

### GD-2 — P1 avant communication publique — L'achat influence plusieurs couches de la compétition dotée

**Faits.** La formule active prévue par le code v3 additionne `100 × fleurs distinctes achetées avec avis validé`, `100 × log2(1 + points de duels / 50)` et le score Gestion. Les achats rapportent aussi dix euros du jeu par euro produit ; les quantités dégustées augmentent les gains du Carnet et les probabilités d'un Buddie Or. Les lots réels utilisent ce classement ; une dégustation validée ou trois duels permet l'éligibilité.

**Preuves.** `src/lib/arena-ranking.ts:calculateArenaScore:1-3,7-12,26-31` ; `supabase/migrations/20261018000300_arena_tasting_first_rankings.sql:143-175` ; `20260927000500_kq_order_cash_rewards.sql:kq_grant_order_cash_reward:72-87` ; `src/lib/kanab-quest-notebook-quantity.ts:11-28` ; `src/lib/arena-customer-rewards.ts:ARENA_CUSTOMER_REWARD_SLOTS:34-45,isArenaCustomerRewardEligible:116-123`.

**Impact/hypothèse.** Sans Gestion, 1, 3 et 5 fleurs validées valent respectivement autant que 50, 350 et 1 550 points bruts de duels. La contribution du catalogue acheté croît linéairement tandis que celle du jeu compétitif ralentit. Le sentiment d'équité peut se dégrader chez les joueurs gratuits si le concours est présenté comme fondé principalement sur leur maîtrise du jeu. Aucun comportement de joueur n'a été mesuré.

**Correction minimale.** Rendre explicites, dans la présentation des gains/classement, les trois contributions et les avantages des achats ; fixer une promesse cohérente avant publication. Le lien achat → avis → classement est un choix utilisateur déjà enregistré au checkpoint : ne pas le retirer sous couvert de correction technique. Réserver toute neutralisation d'autres bonus en compétition à une décision produit distincte. Ne pas confondre les lots clients réels avec `KQ_SEASON_REWARDS_LIVE=false`, qui concerne une autre couche de récompenses KQ.

**Effort :** S pour cohérence de présentation, M pour séparation compétitive. **Confiance : élevée** sur les règles, moyenne sur l'effet de rétention/équité. Analyse de mécanique uniquement, sans conclusion juridique.

### GD-3 — P2 — L'absence peut accumuler les salaires après arrêt de la production planifiée

**Faits.** Un mois du jeu dure 120 h réelles, soit cinq jours. `advanceKqStaffBase` facture tous les mois écoulés d'un contrat encore actif. Le planning hebdomadaire s'arrête au premier salaire impayé, sauf gestion administrative autorisée ; les tâches manquées ne sont pas recréées lors d'un paiement ultérieur. Trente jours réels correspondent donc à six mois du jeu.

**Preuves.** `src/lib/kanab-quest-business.ts:KQ_GAME_MONTH_MS:3-8` ; `src/lib/kanab-quest-staff.ts:advanceKqStaffBase:355-372`, `advanceKqStaff:722-725,752-764,787-799`.

**Impact/hypothèse.** Un joueur qui revient après une absence avec un CDI et sans gestionnaire de paie suffisamment financé peut trouver une dette croissante et une équipe improductive. Risque d'abandon au retour ; il s'agit d'un choix de simulation, pas d'une erreur de calcul démontrée. CDD, paiement automatique et trésorerie disponible modèrent ce risque.

**Correction minimale.** Afficher à l'embauche et dans le retour un coût d'absence à 5/15/30 jours réels avec date du premier arrêt et moyen concret de reprise. Si l'objectif est un jeu occasionnel, décider ensuite d'un plafond de dette hors connexion ou d'une pause volontaire ; ce changement d'équilibrage est distinct du correctif d'information.

**Effort :** S pour information, M pour politique d'absence. **Confiance : élevée** sur les règles, moyenne sur leur effet joueur.

### GD-4 — P2 — La réserve de temps et l'heure de connexion imposent deux conditions différentes

**Faits.** La réserve est 12 h de travail toutes les quatre heures réelles, sans report. Une mission doit aussi finir avant la frontière du jour. La tournée des campagnes réserve exactement 12 h, dure deux heures réelles et ne peut donc plus démarrer dans la seconde moitié du jour, même avec une réserve personnelle intacte. Les gestes immédiats, eux, débitent la réserve sans occuper ce même temps réel.

**Preuves.** `src/lib/kanab-quest-player-work.ts:getKqPlayerWorkday:11-14` ; `src/lib/kanab-quest-staff.ts:HOUR_MS:30,getKqStaffCalendar:43-47,applyKqStaffManualCommand:510-537` ; `src/lib/kanab-quest-business.ts:4`.

**Impact/hypothèse.** « 12 h disponibles » ne signifie pas « tournée possible ». Une visite à heure fixe peut systématiquement tomber dans une fenêtre défavorable. À l'inverse, plusieurs visites réparties sur une journée réelle permettent d'utiliser jusqu'à six renouvellements. La fréquence de connexion risque de compter davantage que le choix stratégique ; le coût visible et les erreurs existantes réduisent la surprise, sans supprimer la contrainte.

**Correction minimale.** Montrer côte à côte heures de travail restantes et durée réelle encore planifiable, puis l'heure du prochain départ possible. Pour une cible de sessions quotidiennes, tester un report plafonné ou une tâche pouvant franchir un changement de jour ; ne pas changer l'horloge générale sans simuler charges et capacité.

**Effort :** S pour explication contextualisée, M pour modification du temps. **Confiance : élevée** sur les conditions, moyenne sur la pénalité ressentie.

### GD-5 — P2 — Le hub recommande une attente avec des coûts devenus faux

**Faits.** `getKqPlacardResume` utilise encore 1 h pour une nouvelle culture, 0,5 h pour tout commerce et le texte « Le lancement demande 1 h ». Le catalogue courant fixe `culture.start=0`, ne facture la culture qu'au lancer, et réduit les gestes Commerce selon compétence jusqu'à 0,05 h. Le SQL de Culture a également retiré le coût de démarrage.

**Preuves.** `src/lib/kanab-quest-hub.ts:getKqPlacardResume:178-196` ; `src/lib/kanab-quest-player-action-costs.ts:KQ_PLAYER_ACTION_COSTS:6-13,getKqPlayerActionHours:39-45` ; `supabase/migrations/20261108000300_kq_culture_work_steps.sql:256-258`.

**Impact.** À 0,2 h de réserve, un joueur compétent peut encore vendre mais recevoir une recommandation d'attendre ; pour une reprise de commerce, le texte peut même parler de prochaine culture. Le hub contredit le coût métier et masque une prochaine action possible. Ce constat est statique, pas une nouvelle recette navigateur.

**Correction minimale.** Déterminer le seuil depuis l'action précise, les compétences et le devis courant, puis conserver le titre/destination métier. Distinguer démarrage gratuit, premier lancer à 0,5 h et délégation disponible. Vérifier les cas 0 / 0,2 / 0,5 h, Commerce haut niveau et Culture.

**Effort :** S (environ 0,5 jour). **Confiance : élevée**.

## Limites et suite bornée

La reproduction PGlite de GD-1 est la seule nouvelle exécution de cette contribution. Aucun test distant, build, parcours réel, distribution statistique de revenus, acquisition/retour de vrais joueurs ou saison simulée n'a été réalisé. Les rapports antérieurs cités au checkpoint ne valent pas nouvelle validation. Priorité proposée : corriger GD-1 et GD-5, puis valider une cohérence de promesse pour GD-2 ; une simulation bornée « une visite par jour / plusieurs visites / retour après 15 jours » permettra ensuite d'arbitrer GD-3 et GD-4 sans nouvel audit général.
