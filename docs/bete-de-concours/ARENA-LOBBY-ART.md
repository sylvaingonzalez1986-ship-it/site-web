# Accueil Arène — lobby interactif

## Direction retenue

Accueil de type sélection de mode, palette verte/crème/jaune conservée, Sylvain
cartoon fidèle à sa référence. Aucun changement de données, règles ou API.

- Navigation directe Carnet / Placard / Classement conservée.
- Aperçu contextuel au survol ou au focus ; boutons dédiés utilisables au tactile.
- Déplacement léger de la scène au pointeur souris ; désactivé en mouvement réduit.
- Sons synthétisés localement, désactivés par défaut, activés uniquement par clic.
- Aucun compteur de joueurs, récompense, notification ou résultat fictif.

## Illustration

Outil intégré image_gen (compétence imagegen), pas de CLI ni de clé API consultée.
Références : public/sylvain.png (identité) et public/sylvain-culture-hero.webp (style).
Fichier retenu : public/contest/mascot/arena-lobby-sylvain-v1.png.
Ancienne illustration conservée. Le résultat final a un fond vert opaque ; la première
version avec damier a été écartée. Le projet utilise le composant Next Image responsive.

### Prompt de création

Use case: identity-preserve.
Asset type: finished transparent-background hero character illustration for a professional retro console videogame website lobby.
Input Image 1 is the CANONICAL IDENTITY of Sylvain; Image 2 is supporting wardrobe and bold-ink style reference. Redraw Sylvain in an entirely new action pose, keeping his exact face design, simple black oval cartoon eyes, rounded nose, black hair shape, friendly mischievous smile, stocky cartoon proportions, teal and tan baseball cap with black brim, tan sweatshirt, teal trousers, cream cartoon hands, tan shoes. One Sylvain only. Do not redesign him as a realistic adult, child, animal, or generic gaming mascot.
Primary request: Sylvain is the charismatic host of a retro 2000s console game lobby. Full body dynamic confident three-quarter pose, leaning slightly toward the viewer, one shoe forward. One hand presents a fan of three collectible cards with simple botanical emblems and the other throws TWO chunky cream dice upward. A small dark-green grow cabinet with a stylized botanical plant sits behind his legs on one side, and a small gold trophy and closed cream notebook balance the composition near his feet. These secondary elements must be subordinate, with a strong readable silhouette and plenty of transparent air between them. All dice faces have normal clear black pips.
Style: premium hand-drawn cel-shaded cartoon key art, bold clean black contours, confident graphic shapes, limited two-level shadow shading, tiny restrained halftone accents. Think punchy console character-select cover art without imitating or adding any game trademark. Not pixel art, not rubbery 3D, not painterly realism. Contemporary polish while preserving the original cartoon identity.
Palette: forest green #00563f, teal #008c84, warm gold #f4c43d, cream #fffaf1, black #111512, tan clothing; small warm skin areas. Crisp highlights and warm gold rim accents, no purple/pink neon.
Composition: portrait-ish 4:5 standalone cutout, character occupies most of the frame, silhouette fully contained with 5% transparent margins, face large and clear. No rectangular backdrop, no environment panorama, no large paper circle, no vignette, no ground rectangle. True transparent RGBA background. No typography, no words, no logos, no watermark, no UI buttons. This will sit over an HTML dark-green game stage.

### Retouche finale du fond

Use case: precise-object-edit. Edit this exact image. Keep Sylvain and ALL foreground illustration elements pixel-faithful in appearance: same pose, face, colors, hat, clothes, hands, cards, dice, cabinet, plant, notebook, trophy and proportions. Change ONLY the checkerboard background: replace every visible gray checkerboard area with a perfectly uniform opaque solid forest green #00563f, including the small gaps between foreground objects. Absolutely no checkerboard, no transparency, no gradient, no vignette, no added objects, no text. Crisp clean ink edges. This is a finished opaque hero poster for a dark-green website game screen.

## Vérification

Aperçu isolé avec les vrais composants, données fictives, polices de repli et
requêtes externes bloquées : node scripts/audit-arena-retro.mjs --lobby.
Contrôles à 320, 390, 768 et 1440 px : aperçu des trois modes, focus clavier,
activation/désactivation sonore, mouvement réduit, absence de débordement horizontal.
Les captures sont dans output/arena-retro/lobby-<largeur>.png.
