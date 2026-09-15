# Fiche de chanvrier et palmarès — 15 septembre 2026

Implémenté. Les migrations `20260915000100` et `20260915000200` sont appliquées au projet Supabase lié. La publication du code applicatif reste liée au prochain déploiement.

## Expérience

Le bouton « Ma carte » ouvre une fiche illustrée avec trois rubriques :

- **Mon parcours** : réputation et prochain palier, ligue et dernier classement enregistré, cultures terminées, meilleure note réelle du jury, bilan des duels entre joueurs, trois objectifs proches au maximum.
- **Succès** : huit familles permanentes, filtres, paliers bronze/argent/or, condition précise et objectif épinglable.
- **Badges** : distinctions du Carnet, du Placard et des saisons ; détail, date, trois badges épinglés et titres obtenus. Le cadre doré se débloque au dernier palier « Jury conquis ».

Le personnage reste personnalisable si le palmarès ne répond pas. La fenêtre utilise un dialogue natif avec retour du focus, fermeture par Échap et défilement interne. Les illustrations du personnage restent inchangées ; les médailles utilisent les icônes existantes.

## Règles et récompenses

Le catalogue commun à l’interface et au jeu est `src/lib/chanvrier-achievements.json`. Ses seuils sont vérifiés contre le catalogue SQL.

Les triples correspondent exclusivement aux trois dés finaux `[6,6,6]`, après effets et relances. L’effet « Triple étincelle ! » apparaît au résultat de l’étape ; les compteurs permanents attendent la fin de la culture. Les réussites exceptionnelles sans trois 6 ne comptent pas comme triples.

Cultures exemplaires : six étapes réussies ou critiques, sans fragile ni échec. Sang-froid : pression finale à zéro. Défense naturelle : présence réelle du combo PBI ciblée. Les données historiques absentes ne sont pas déduites.

Le jury utilise les trois notes enregistrées dans le duel, moyennées et ramenées sur 10 comme au marché. Une fleur distincte compte une seule fois pour « Jury conquis ». Les jurys d’entraînement contribuent à la qualité ; seules les victoires contre d’autres joueurs comptent pour « Victoire parfaite » et le bilan V/D.

Les ventes partielles d’une même filière ne multiplient pas « Artisan polyvalent ». Fleurs brutes et biomasse sont exclues.

Un pack de **10 cartes La Botte à 5 familles**, puis un autre à **8 familles**, une seule fois par compte. Les paliers d’un même succès ne comptent pas comme de nouvelles familles. Aucun bonus supplémentaire d’XP, qualité ou réputation. Les missions existantes et les récompenses du Carnet restent indépendantes, sans double attribution.

## Serveur et coût

Les triggers enregistrent les résultats officiels dans leur transaction. Une clé unique par événement et un verrou par joueur rendent le traitement idempotent. Les compteurs alimentent la fiche ; les historiques complets ne sont pas envoyés au navigateur. Les badges réutilisent `contest_profile_badges`, sans récompense Carnet ajoutée. Les packs réutilisent les entitlements avec la source `achievement`.

`GET /api/arena/chanvrier/progress` rassemble les compteurs, les badges, la vitrine et les missions existantes. Réponse privée, sans cache partagé. Chargement à l’ouverture, cache mémoire de 60 secondes dans la fiche, invalidation après résultats officiels et événements de commerce/récompense. Aucun polling ni Realtime supplémentaire. Les liens n’anticipent pas le chargement de leurs destinations. Le classement vient du dernier snapshot disponible, daté dans la fiche ; la consultation ne déclenche pas son recalcul.

`PATCH` accepte uniquement une vitrine et/ou le nombre de badges vus. L’identité vient de la session. Maximum trois badges distincts ; propriété du badge et déblocage du titre contrôlés en base. Les fonctions ne sont pas exécutables par les rôles anonymes ou authentifiés ; seuls les appels serveur autorisés y accèdent.

## Reprise et vérifications

`scripts/backfill-chanvrier-progress.mjs --apply` examine au maximum 100 sources par appel (plafond SQL : 200). Il peut être relancé depuis le début : les mêmes clés empêchent de recompter ou de récompenser deux fois. Les dates affichées sont les dates effectives d’attribution ; les dates des événements restent conservées dans le registre.

Reprise effectuée : **63 cultures, 7 duels officiels, 46 duels d’entraînement et 65 reçus de vente**. Vérification SQL : tous les cycles terminés sont comptabilisés ; rejouer les pages laisse inchangés compteurs, événements, badges et packs.

- Régression SQL `supabase/tests/chanvrier_achievements.sql` : déclenchement réel à la fin d’une culture, faux critique, abandon, rejeu, PBI, jury, ventes distinctes, orientation du duel, packs bornés, propriété des distinctions et droits. Comptes fictifs, transaction annulée.
- Suite complète : 223 fichiers, 1 197 tests réussis avant ajout du test ciblé d’invalidation des résultats officiels.
- Audit navigateur `scripts/audit-chanvrier-profile.mjs` : 320, 375 et 1 280 px, onboarding, trois rubriques, épinglage, titre, fermeture/focus, personnalisation, cache et réessai après indisponibilité.
- Captures locales : `output/chanvrier-profile/`.
- Validation finale : compilation de production Next.js réussie, contrôle TypeScript et ESLint réussis ; 21 tests ciblés réussis, dont le nouveau contrôle d’invalidation. Les audits de cache et de reprise après erreur passent aux trois largeurs.
