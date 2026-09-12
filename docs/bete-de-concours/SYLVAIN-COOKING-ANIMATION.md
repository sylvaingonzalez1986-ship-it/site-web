# Sylvain aux fourneaux — 12 septembre 2026

La transition du marché utilise quatre poses de Sylvain en train de remuer une
préparation, de la vapeur et un tampon de réussite. L’image sert de métaphore
visuelle de la préparation du lot ; les règles des filières restent celles du jeu.

- Asset : `public/placard/sylvain-cooking-sprites-v1.webp` (1254 × 1254 px, 182 648 octets).
- Quatre cellules carrées en grille 2 × 2, dans l’ordre de lecture.
- Référence d’identité : `public/sylvain.png`, visage sans barbe et casquette originale.
- Création : outil intégré **image_gen** ; conversion WebP via Sharp, sans redessin.
- Intégration : `KqMarketDesk.tsx` et son module CSS, chargement anticipé au marché.
- Boucle de 1,1 seconde ; préparation visible au moins 2 secondes si le serveur
  confirme rapidement. La réussite attend toujours la confirmation du serveur.
- Erreur : retour immédiat à la confirmation, conservation de la clé de vente.
- Animations réduites : personnage immobile, aucun délai minimal supplémentaire.
- La réussite affiche le montant net après règlement électrique.

## Validation

`node scripts/audit-placard-electricity-market.mjs` utilise les vrais composants et
un portefeuille fictif. Il vérifie la progression des poses, l’arrêt à la réussite,
les largeurs 320/390/768/1440 px, le retour après erreur, la clé de vente conservée,
le reçu électrique et les animations réduites. Images de contrôle dans
`output/cooking-animation/` (hors Git).

## Prompt final de génération

Create a production animation sprite sheet, use-case illustration-story, for a French cartoon game. The attached image is the EXACT identity and drawing-style reference of Sylvain, not the target composition. Preserve his clean-shaven rounded cream face, black oval eyes, simple curved nose, friendly mouth, teal-and-tan baseball cap with black brim, tan sweatshirt, teal clothes, thick black outlines and sparse halftone shading. NO beard, NO realistic human, NO chef hat replacing the cap. Output ONE square image divided into exactly FOUR EQUAL square animation cells arranged in a precise 2 by 2 grid, NO gutters, NO borders, NO labels, NO text. Each cell is the same fixed camera framing of Sylvain from waist up cooking, stirring a large teal cooking pot with a wooden spoon behind a small cream worktop, steam rising from a warm golden preparation. This is a playful cooking metaphor for a game transformation, no recipe or technical diagrams. Use a perfectly flat uniform deep green #003f30 background across every cell, no gradient. Character and pot fit completely inside each cell with a 10 percent safe margin. IDENTICAL SCALE, same pot position, same body position, same cap position and same worktop across all 4 cells, so it can loop without jitter. Frame order top-left, top-right, bottom-left, bottom-right. The animation should clearly show the hand and spoon stirring in a circle: frame1 hand/spoon left; frame2 center back; frame3 right; frame4 center front; slight corresponding shoulder motion and different curls of steam. Keep face appealing and highly faithful to the attached original. Make the 4 frames close enough to flow in a loop, but hand/spoon genuinely move. Clean bold shapes, restrained teal/tan/cream/gold palette matching the mascot, readable at 300px per cell, polished retro game artwork. Deliver square 2048 by 2048 if possible.
