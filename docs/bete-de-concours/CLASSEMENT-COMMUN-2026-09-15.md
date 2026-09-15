# Classement commun du Placard — 15 septembre 2026

Les divisions Graine / Pousse / Canopée / Fleur étaient des libellés déduits de la cote. Elles ne définissaient aucun groupe d’adversaires. Leur présentation suggérait pourtant une compétition séparée et ajoutait des indicateurs à un panneau déjà chargé.

L’interface présente désormais un **classement commun du Placard**. Le panneau de saison met en avant le rang, le Score Placard, le bilan et le prochain pack de série. Les trois premiers apparaissent dans une liste simple ; un lien rejoint les classements complets. La saison s’affiche sous une forme lisible (« Saison 1 · 2026 »).

La cote, les points de saison, le bonus de réputation et l’EXP restent accessibles dans « Comprendre mon score et mes gains ». La décomposition utilise la fonction de calcul existante ; si les données actuelles diffèrent du snapshot de classement, le panneau précise l’écart. Aucun gain, score ni récompense n’a été recalculé pour cette refonte.

Les divisions et promotions de ligue ont aussi été retirées de la carte de chanvrier, du résumé de profil dans l’Arène et des résultats locaux. Les paliers de réputation restent utiles au commerce et conservent leurs règles. Les anciens champs de ligue renvoyés par l’API restent compatibles avec les clients déjà déployés, mais ne sont plus affichés.

## Duels

Lecture de la fonction réellement déployée `rpc_kq_enqueue_random_battle` :

- Aucun filtre de cote, de division ou de qualité.
- Joueurs différents, fleurs valides et non engagées dans un autre duel.
- Tirage aléatoire parmi les douze fleurs valides les plus anciennes en attente, pour limiter l’attente.

Tous les joueurs peuvent donc se rencontrer. Cela ne signifie pas qu’un duel est possible avec un joueur qui n’a aucune fleur dans la file. La cote reste utilisée dans les gains et pertes après le duel, puis entre dans le Score Placard. Aucune migration de base n’est nécessaire.

## Vérifications

- 28 tests du classement, de réputation et des règles de score réussis.
- Audit du panneau dans les styles réels du Placard à 320, 375, 768 et 1 280 pixels : absence de débordement, détails repliés au départ, score 981 + 64 + 74 = 1 119, action vers les fleurs et compte débutant sans rang fictif.
- ESLint validé sur les composants modifiés.
- Captures : `output/arena-season/`.
- Compilation de production Next.js et contrôle TypeScript réussis.
