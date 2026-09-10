# Fin du plan Placard — état vérifié le 8 septembre 2026

Ce suivi reprend les huit étapes de « Reste avant ouverture publique » dans
`PLACARD-GAME-DESIGN.md`. Il distingue l'implémentation, la recette exécutée et
les décisions de lancement. Il n'ajoute aucune fonctionnalité au périmètre.

## Résultat de la reprise

- Les fonctionnalités décrites par le plan sont présentes dans le dépôt :
  économie, matériel durable, inventaire équipé, boutique et panier, marché,
  réputation, incidents, duels aléatoires, entraînement et défis, Héritages
  dynamiques et outils de pilotage.
- `supabase migration list --linked` confirme la concordance des versions locales
  et distantes jusqu'à `20260907000100`. Aucune migration distante ne reste à pousser.
- Le dernier contrôle complet du 7 septembre comptait 957 tests réussis dans
  188 fichiers et un build réussi. Ce résultat ne vaut pas recette sur appareils.
- Le vérificateur de lancement a été exécuté le 8 septembre : aucun rapport
  recevable n'est présent dans les six dossiers d'entrée ; les douze preuves
  sont donc absentes du dossier consolidé. Cela n'annule pas les essais manuels
  que le propriétaire avait déclarés fonctionnels dans la conversation.
- La recette du duel bot a été renforcée : une réponse sans tableau `flowers`
  ne vaut plus preuve de burn ; une progression sans liste de défis valide
  échoue. Des tests exécutent le script avec HTTP et fichiers en mémoire,
  dont le second crédit, les réponses incomplètes, les erreurs 429/503 et le
  refus d'une base distante. Ils ne produisent aucune preuve de recette réelle.
- Deux fichiers de tests existants ont été corrigés pour le contrôle TypeScript
  complet : typage des rapports de recette et simulation de `NODE_ENV` via Vitest.
  Validation du 8 septembre : 41 tests ciblés réussis dans quatre fichiers,
  lint ciblé sans erreur et `tsc --noEmit --incremental false` réussi.

## Les huit étapes restantes

| Étape du plan | État constaté | Condition de clôture |
| --- | --- | --- |
| 1. Revue graphique humaine | Illustrations présentes, audit Situation existant, export humain absent | Examiner et exporter la revue dans le pilotage admin, avec le catalogue des producteurs actifs |
| 2. Dates, lots, territoire, probabilités, règlement | Assistant de décision et brouillon disponibles ; fiche Saison 1 encore à compléter dans le dossier | Fixer les valeurs et approuver les cinq sections du dossier |
| 3. Mobile physique multi-comptes | Corrections et checklist disponibles ; essais déclarés fonctionnels, export complet absent | Exporter les contrôles réellement effectués sur iPhone et Android |
| 4. Rétro-attributions | Traitements et simulations implémentés ; preuves absentes | Exécuter les lots sur une copie de recette et archiver simulations et résultats |
| 5. Charge et transactions | Scripts disponibles ; rapports absents | Exécuter la charge avec deux sessions et les cinq scénarios sur une base jetable |
| 6. Budgets d'exploitation | Seuils p95 implémentés ; mesures de recette absentes | Examiner les rapports de charge et arrêter les budgets Supabase/Vercel |
| 7. Fenêtre d'activation | Ordre documenté dans le dossier de lancement | Fixer la fenêtre une fois les étapes précédentes validées |
| 8. Activation et smoke test client | Non exécutés dans cette reprise | Approuver la configuration complète, ouvrir l'accès joueur en dernier et vérifier le parcours client |

## Environnement de recette constaté

Docker Desktop a été démarré. La base locale existante
`supabase_db_lesiteinternetquitue` s'arrête à la migration `20260421000100`.
La prévisualisation `supabase db push --local --dry-run` trouve les migrations
ultérieures, dont `20260719000300_reset_contest_test_activity.sql` qui supprime
les avis, points, badges acquis et récompenses débloquées de la phase de test.

Cette ancienne base n'a été ni réinitialisée ni migrée pendant cette reprise.
La recette destructive doit utiliser une copie identifiée comme jetable.
Le démarrage de Docker ne suffit pas à qualifier cette ancienne base de copie
de recette actuelle, ni à fournir les deux sessions requises par les scripts.

Les décisions de calendrier, de territoire et de lots ont été demandées au
propriétaire. Une approbation graphique ou une manipulation sur téléphone ne
doit pas être déclarée réalisée par un test automatisé.

## Preuve de contrôle archivée

Le rapport du 8 septembre est disponible dans
`output/placard-launch-evidence/placard-launch-evidence-2026-09-08T05-10-22-278Z.json`.
Son verdict est `passed: false` parce que les exports de recette manquent.
Il doit être régénéré après leur dépôt avec
`npm run verify:placard:launch-evidence`.

La fin du plan n'est donc pas annoncée terminée : les éléments ouverts ci-dessus
sont les conditions concrètes de clôture, et non de nouveaux développements à
inventer à chaque reprise.
