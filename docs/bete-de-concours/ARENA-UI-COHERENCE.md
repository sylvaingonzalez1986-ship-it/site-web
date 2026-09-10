# Arène — cohérence des espaces, 10 septembre 2026

La référence est l'accueil à trois scènes décrit dans `ARENA-FULLSCREEN-SCENES.md`.

## Direction appliquée

- Dégustation, Placard et Classement partagent `ArenaSceneHeader` : illustration du mode, titre, retour à l'Arène et navigation avec état actif crème souligné d'or.
- Le Carnet conserve ses onglets Regular / Concours / Fleurs, distincts du choix d'espace. Le lien Placard respecte l'état d'accès transmis par le serveur.
- Fond vert sombre, panneaux de lecture crème, commandes rectangulaires et accents jaunes. Les animations d'arrivée respectent la réduction des mouvements.
- Le jeu, le marché, le catalogue, l'inventaire et l'accès au catalogue dans la boutique reprennent ces couleurs et ces commandes. Les illustrations des cartes et les gestes du carnet restent conservés.
- Les règles, calculs, routes, achats, confirmations de vente et permissions ne sont pas modifiés.

## Vérification

`node scripts/audit-arena-retro.mjs --sections` couvre les vrais composants Dégustation, Classement, classement des fleurs, Placard, marché et catalogue à 320, 390, 768 et 1 440 px. Il vérifie les débordements, la navigation clavier, l'état actif, l'ouverture et la fermeture du carnet, le HUD et le panier matériel.

Les variantes `--dice` et `--reputation` contrôlent respectivement le lancer (y compris erreur et animation bloquée) et les confirmations / reçus de ventes positives, neutres et pénalisantes.

Captures dans `output/arena-retro/`. Ces aperçus utilisent des données fictives et des polices de secours. Le compteur de récompenses y est volontairement indisponible ; cela ne décrit pas son état en production. Ils ne remplacent pas une manipulation sur téléphone physique avec un compte connecté.
