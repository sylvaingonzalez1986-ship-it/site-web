# Fond d’entrepôt V3

Généré le 27 septembre 2026 avec l’outil intégré `imagegen`, à partir de `../warehouse-v2/room.webp`, puis encodé en WebP (qualité 90, dimensions conservées).

Le fond conserve l’illustration de l’atelier, dégage une rangée de quatre tentes et déplace l’établi au premier plan. Les tentes et machines restent des éléments interactifs indépendants.

## Prompt final

Edit the provided illustrated warehouse background into a spacious layout for a 2D management game. The reference is the edit target and the exact style reference. Preserve its hand-painted Franco-Belgian comic / ink illustration style, deep teal industrial steel framework, honey-colored wooden ceiling, warm cream wall, polished warm concrete floor and sunlight from high left windows. Output a wide landscape 2:1 bitmap, crisp detailed illustration, full bleed with no UI, labels, numbers, text, people, equipment, tents or plants.
Composition must be reorganized, preserving the visual identity:
- Straight-on elevation view of an exceptionally wide open warehouse, very shallow perspective, no strongly converging rear wall. Back wall meets the floor at exactly 59% of image height, leaving a large open floor foreground.
- Ceiling and overhead fixtures confined to the top 14% of the frame. The wall area between x5% and x85%, y18% to y59%, must remain entirely clear and unobstructed; this is where four grow-tent sprites will be placed side by side. Only subtle teal uprights against the wall.
- Remove the entire large central workbench from the reference.
- Remove the built-in drying cubicle and open door on the right; replace them with the same blank cream rear wall and continuous open floor. No door, alcove, inset rack or side room.
- Add only one SMALL plain wooden workbench in the front left, occupying x5% to x31% of image width. Its countertop is horizontally level at y73% and its feet sit on the floor at y93%. Teal metal base, honey wood top, entirely empty tabletop. It is about 90cm high relative to a 2m tent that would occupy 38% image height.
- All floor from x34% through x98% must remain empty for individual machinery sprites. Keep shadows soft and diffuse so later sprites integrate.
- Less imposing roof than the reference, more useful wall/floor area, regular scale, no extra decorative clutter.
This is a production background, not a screenshot or mockup. Do not render the proposed tents or machines; they are interactive independent sprites added in code.

## Cabine du séchoir

`flower-drying-room.webp` a été généré avec l’outil intégré `imagegen` à partir de l’illustration du catalogue `public/app/kanab-quest/equipment/equipment-DRYING-ROOM-hero-v1.webp`. Le PNG transparent a été recadré sur son contenu et exporté en WebP, qualité 90, 614 × 1000 pixels, avec son canal alpha conservé.

La cabine remplace l’enceinte qui avait disparu du fond V3. Elle apparaît uniquement lorsque le séchoir de la tente sélectionnée est installé, avec sa base sur la même ligne que les tentes. Les fleurs V2 restent des éléments superposés dans l’ouverture : une rangée aux niveaux 1–4, deux rangées à partir du niveau 5. Le lyophilisateur de l’atelier commun reste indépendant.

### Prompt final de la cabine

Use case: stylized-concept / precise-object-edit. Create a production transparent-background sprite for this 2D warehouse management game, using the referenced drying-room catalog illustration as the object and exact hand-inked French comic art style reference. Render ONE complete small walk-in flower-drying enclosure, freestanding, deep teal metal frame and door, warm cream insulated walls, small metallic ventilation fan on top, honey-colored wooden rail supports inside, dark muted ochre interior. Change its perspective to nearly straight-on front elevation with only a very narrow left side visible, matching a warehouse viewed front-on with slightly visible floor. The door is open outward to the right but almost edge-on so the complete object stays narrow: width around 65% of height. CRITICAL: remove ALL hanging flowers and plants from the reference, leaving a clear open doorway with an empty dark interior; game code overlays the flowers separately. The main doorway should be centered at approximately x46% of the object's total width, occupying x18%-73%, from y25%-88%. Keep the complete enclosure, ventilation and base visible with tight even transparent margins. Transparent outside the object, fully opaque inside the enclosure. No floor patch, background, text, plaque text, labels, watermark, UI or additional objects. Detailed textured warm cream and teal shading, crisp ink edges. This is an in-game compositing asset, not a product card.
