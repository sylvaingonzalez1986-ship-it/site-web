# Entrepôt et pièce séchoir

L’entrée **Entrepôt** du Placard ouvre un décor illustré : la box au centre, les équipements installés dessus et autour, et une pièce séchoir à droite. Cliquer sur un emplacement présente le matériel possédé, son niveau, ses avantages et ses charges. Installer remplace uniquement le matériel du même emplacement ; l’ancien reste possédé. Les boutons d’installation du catalogue rejoignent directement le bon emplacement. Sur mobile, le décor se déplace horizontalement et le panneau apparaît sous la scène.

Le tutoriel visite ce lieu à l’étape 5. Il n’effectue aucun achat ni installation automatique.

## Économie du séchoir

`DRYING-ROOM` coûte **600 € virtuels** et occupe `flower-drying`, distinct du sécheur de hash (`drying`). Les deux peuvent être installés ensemble. Le catalogue compte désormais 17 équipements actifs, dont 14 achetables.

| Niveau | Bonus maximal de qualité | Régularité |
| --- | ---: | ---: |
| 1 | +1 | +2 % |
| 4 | +2 | +5 % |
| 7 | +3 | +8 % |
| 10 | +4 | +11 % |

La régularité progresse d’un point à chaque niveau et contribue à la statistique de la Fleur utilisée en duel. Le bonus de qualité est pondéré par les étapes réussies, comme les autres équipements : `plancher(bonus maximal × réussites / 6)`. Un séchoir niveau 10 apporte donc +2 pour trois étapes réussies, +4 pour six et zéro pour aucune. Ce n’est pas un bonus garanti à la note du jury.

Chaque amélioration coûte `600 € × niveau actuel / 10` : de 60 € pour passer au niveau 2 à 540 € pour atteindre le niveau 10. Les neuf améliorations coûtent 2 700 € au total. Le coût électrique simulé est intégré à la facture de culture ; en mode équilibré, le séchoir seul coûte environ 1,62 € au niveau 1 et 3,08 € au niveau 10. Ces valeurs sont des paramètres de jeu.

Le décor ajoute une deuxième rangée de fleurs aux rails existants au niveau 5 et un repère doré au niveau 10. Les équipements et niveaux sont figés au lancement : acheter ou améliorer pendant une culture ne change pas rétroactivement ses bonus ou sa facture.

La disposition utilise des proportions et points d’appui propres à chaque objet : lampe dans l’ouverture de la box, extraction raccordée à son évent, caméra sur un montant, presse et tamis sur l’établi, machines et chien au sol. Les objets absents sont représentés par de petits repères « + ». Chaque visuel utilise son rectangle précis dans l’atlas afin d’exclure les fragments voisins. Aucun portant ne flotte devant la porte du séchoir ; seules les fleurs sont superposées aux rails dessinés. Les captures de contrôle incluent une installation complète avec caméra puis chien.

## Validation et activation

Vérification finale : **1 163 tests sur 215 fichiers réussis**, ESLint des fichiers concernés et compilation Next.js réussis. La compilation locale signale des lectures Supabase indisponibles pendant la revalidation du catalogue, sans échec de build.

- `kanab-quest-drying-room.test.ts` : prix, paliers, coût, cumul avec le sécheur de hash, qualité conditionnelle, facture et sauvegarde d’une culture réelle du moteur.
- `node scripts/test-placard-drying-room.mjs` : migrations et transactions PostgreSQL locales (PGlite), propriété du matériel, achat idempotent, coexistence des deux séchoirs et neuf améliorations jusqu’au plafond.
- `node scripts/audit-placard-warehouse.mjs` : composants réels avec API simulées, cinq formats d’écran, installation, remplacement, amélioration, achat absent, fonds insuffisants, erreur réseau et nouvelle tentative ; liaison réelle boutique → entrepôt.
- `node scripts/audit-arena-journey.mjs` : parcours complet des neuf étapes, dont le nouvel entrepôt, et 25 vues adaptées aux écrans.

La migration **`supabase/migrations/20260913001100_kq_flower_drying_room.sql`** ajoute le nouvel emplacement et l’équipement. Après validation locale, elle a été appliquée au projet Supabase lié le 13 septembre 2026, seule, sans les autres migrations en attente. La lecture distante confirme `DRYING-ROOM`, emplacement `flower-drying`, actif et achetable à 60 000 centimes. Elle réutilise les transactions d’achat, d’installation et d’amélioration existantes.

Le refus initial provenait du séchoir absent du catalogue SQL malgré sa présence dans le catalogue de l’application. L’erreur de commande est maintenant affichée à l’intérieur de la confirmation, au lieu de rester masquée derrière cette fenêtre. L’audit navigateur couvre le refus, sa visibilité, la nouvelle tentative, le débit de 600 € et l’installation sur ordinateur et mobile, avec API simulées. Aucun achat réel n’a été effectué sur le compte du joueur pour tester.

## Illustrations livrées

Génération et retouches avec **imagegen intégré**, puis conversion WebP via Sharp, sans modification du dessin par code. Référence de style initiale : `public/placard/equipment-showroom-v1.webp`. Les sources PNG restent dans le dossier de génération Codex ; les fichiers utilisés par l’application sont tous dans le dépôt :

- `public/placard/warehouse-room-v1.webp` : décor 1536 × 1024.
- `public/placard/warehouse-sprites-v1.webp` : atlas 4 × 4, 1254 × 1254, transparence alpha vérifiée.
- `public/app/kanab-quest/equipment/equipment-DRYING-ROOM-hero-v1.webp` : illustration du catalogue, 1254 × 1254.

### Prompts de production

Décor :

> Use case: stylized-concept. Create a NEW wide 3:2 raster game background, NOT a mockup. The reference image is STYLE REFERENCE ONLY: match the French Arena game's hand inked comic artwork, deep teal green, warm cream, honey wood, thick black outlines, subtle halftone. Scene: inside a small cozy warehouse workshop, straight-on slightly elevated perspective, three clearly readable areas. LEFT/CENTER 18%-60% of width is a large EMPTY floor bay against a simple light cream wall, with no grow tent or equipment: the game will overlay a grow tent and lighting here. RIGHT 68%-95% is a separate small walk-in flower drying room with a teal framed door standing open, visible simple wooden hanging rails inside, EMPTY rails, dark muted interior, a small blank plaque over the doorway. FAR LEFT a small empty workbench suitable for equipment overlays, wall sockets and conduits but no installed machines. Clear floor, visible ceiling beams, restrained industrial warehouse details. Composition must leave large clean space for movable equipment in center and around it, no foreground counter blocking the floor, no person, no text, no labels, no interface, no cards. Warm welcoming gaming illustration, same cohesive visual world as reference. The whole room fits in frame.

Atlas :

> Use case: stylized-concept. Create ONE game sprite atlas PNG with TRUE TRANSPARENT BACKGROUND (alpha), no background colors, no checkerboard drawn, no text, no grid lines. Exact layout: 4 equally sized columns x 4 equally sized rows, 16 isolated objects, each centered inside its own equal square cell, generous transparent padding, no object crosses its cell boundary. Square canvas maximum resolution. STYLE ONLY from reference: hand inked cozy French arcade warehouse, thick dark outlines, deep teal frames, warm cream highlights, wood amber, subtle halftone. Front three-quarter very slight perspective, coherent asset pack, no people, no backdrop, no floor tiles, no outer frame. Row 1 from left: (1) basic dark teal indoor grow tent with OPEN front door, visible empty cream interior and floor, no lighting or plants; (2) upgraded sturdy dark teal OPEN grow tent with brass reinforced corners and empty cream interior; (3) small warm glowing suspended LED grow light panel; (4) upgraded wide warm glowing grow LED bar array. Row 2: (1) small cylindrical extraction fan with duct connector; (2) larger teal extraction fan with duct connector; (3) wall climate control panel with blank dark display and simple colored knobs; (4) solar panel leaning against portable battery. Row 3: (1) cream security camera on mounting arm; (2) friendly seated tan and black guard dog; (3) compact teal rosin press machine; (4) teal washing machine with lid. Row 4: (1) wooden dry sieve trays; (2) stainless filter stack; (3) teal freeze dryer with round door; (4) wooden flower drying rack with a few hanging botanical branch bundles. Objects must read as actual scene objects, not framed cards. Keep all 16 cells exactly in order with transparent separation so CSS can display each cell independently.

Correction de transparence :

> Use case: background-extraction. Edit this exact sprite atlas. Preserve all sixteen objects, their exact equal 4x4 grid positions, scale, colors, details and outlines. Remove the ENTIRE gray-and-white checkerboard background, replacing it with genuine PNG transparency / alpha=0. The checkerboard in the input is painted pixels and must be removed, NOT reproduced. Every space between objects and around silhouettes must be truly transparent. Do not draw a checkerboard. Do not change objects. Return a transparent RGBA PNG asset suitable to composite directly over a warehouse background.

Illustration du séchoir, avec le décor final comme référence :

> Use case: stylized-concept. Create a NEW square 1:1 game equipment catalogue illustration, 1536x1536 if possible. Reference image is STYLE AND ROOM DESIGN REFERENCE ONLY. Depict the small flower drying room from the right of this warehouse as the central complete hero subject, its teal door open, with wooden racks and a few hanging botanical flower bundles visible inside. Front three-quarter perspective, room fills most of square frame but all edges remain visible. Match French Arena game artwork: thick black ink contours, deep teal, warm cream and honey wood, subtle halftone comic texture. Simple warm cream background with small floor shadow, no person, no text, no UI, no border. This is a game illustration of a purchased separate drying room, not a real-world instruction diagram.

Retouche finale des fleurs :

> Edit this exact square game illustration, preserving the room, door, perspective, colors, frame and inked style. Replace only the hanging colorful garden flowers and culinary herbs with small bundles of green hemp/cannabis branches and compact green flower buds, matching the existing cannabis game. No daisies, no purple flowers, no pink flowers, no yellow flowers. This remains a fictional game room illustration with no text or technical instructions.
