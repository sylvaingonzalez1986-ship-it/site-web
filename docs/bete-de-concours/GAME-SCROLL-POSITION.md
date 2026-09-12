# Position de lecture dans le jeu — 12 septembre 2026

Les écrans du Placard et de l’Arène utilisaient plusieurs restaurations de
défilement indépendantes. Une fenêtre pouvait rétablir sa position d’ouverture
après une navigation. Un écran raccourci pouvait aussi laisser le navigateur
afficher uniquement le pied de page, toujours présent dans le layout.

## Comportement

- Une nouvelle vue, le lancement de la culture et l’arrivée à la récolte affichent
  le début de l’écran concerné après son rendu.
- Les validations intermédiaires ne rétablissent plus une ancienne coordonnée
  enregistrée avant une requête réseau.
- Un `ResizeObserver` ramène le contenu dans le champ de vision si sa hauteur
  diminue pendant que le joueur le consulte. Descendre volontairement dans le
  pied de page reste possible.
- L’ancrage automatique du document est désactivé uniquement pendant la présence
  d’une surface de jeu, puis sa valeur initiale est restaurée.
- Les fenêtres du marché, de la boutique, du matériel et du carnet utilisent le
  même verrou de défilement, avec comptage des fenêtres superposées. Leur fermeture
  ne rembobine pas une navigation. Les retours de focus utilisent `preventScroll`.

## Vérification reproductible

`node scripts/audit-game-scroll.mjs` reproduit le défaut sans protection puis
vérifie la correction dans Chromium à 390 et 1440 px : contenu raccourci,
position conservée, navigation avec fenêtres superposées, contenu chargé après
700 ms et consultation volontaire du pied de page. React Strict Mode est activé.

`node scripts/audit-placard-electricity-market.mjs` utilise le vrai
`PlacardPlayerShell` et les composants du marché avec des réponses API fictives,
à 320, 390, 768 et 1440 px. Le pied de page reste présent pendant la navigation,
la confirmation, l’animation, le reçu de vente et le retour au tableau de bord.
Les variantes image lente, image indisponible et mouvement réduit restent testées.

Ces scripts ne modifient aucun compte ni aucune partie réelle. Les rapports et
captures sont écrits dans `output/game-scroll` et `output/cooking-animation`.
