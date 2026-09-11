# Illustrations des situations — Placard indoor

## Direction retenue

Les situations se déroulent dans un petit placard de culture intérieur : parois opaques réfléchissantes, montants et porte visibles, LED suspendue, ventilateur à grille et gaine d’extraction. Les accessoires sont reconnaissables et les incidents lisibles sans objets fantaisistes.

Le dessin conserve le personnage cartoon de l’Arène, les contours sombres, la palette crème / turquoise / vert profond / jaune et la texture tramée. Le nom du personnage n’est pas ajouté à l’interface.

Les semis, plantes en croissance et scènes de séchage ont des visuels distincts. Les LED sont éteintes pour le séchage et l’affinage. Les détails anatomiques et accessoires incohérents repérés lors de la revue ont été retouchés.

## Intégration

- 29 situations et la coupure de courant utilisent les nouveaux fichiers `*-v3.webp` dans `public/app/kanab-quest/situations/`.
- `src/lib/kanab-quest-situation-artwork.ts` associe les scènes aux images et fournit les textes alternatifs.
- Format carré 1200 × 1200, WebP qualité 84 : environ 302 Kio en moyenne, 389 Kio au maximum.
- Les anciennes versions restent disponibles. Les règles de jeu et la présentation des cartes ne sont pas modifiées par ce remplacement.
- **Exception : SIT-004 « Coup de chaud » conserve son illustration v2.** La génération de son remplacement a été refusée par le générateur ; elle n’a pas été relancée.

## Production et références

Outil utilisé : générateur intégré `image_gen` du skill imagegen, puis conversion des fichiers sélectionnés en WebP avec Sharp.

Référence du personnage : `public/contest/mascot/tasting/tasting-verdict.png`.
Référence du décor indoor : `public/app/kanab-quest/situations/situation-SIT-001-depart-hesitant-v3.webp`.

Les [prompts et statuts par scène](./situation-artwork-v3.prompts.json) sont conservés dans le dépôt. Pour une génération standard, le texte comprend `commonPrompt`, puis `Situation CODE:`, puis `prompt` et l’éventuel `promptSuffix`. `promptOverride` conserve le prompt propre à la première scène ; `editPrompt` conserve la retouche finale lorsqu’il y en a une.

Une planche de contrôle locale est disponible dans `output/placard-workshop/situations/indoor-overview.png` (répertoire de travail ignoré par Git).

## Validation

- Revue visuelle des images générées et des retouches sélectionnées.
- 12 tests existants réussis : catalogue complet, chemins locaux, priorité de la coupure, absence de doublons, dimensions et budgets de fichiers.
- `tsc --noEmit` réussi.
- Aucun déploiement ni test de navigation sur un compte connecté réalisé dans cette passe.
