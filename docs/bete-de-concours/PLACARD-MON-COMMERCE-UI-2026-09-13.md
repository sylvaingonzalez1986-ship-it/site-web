# Mon commerce — interface du 13 septembre 2026

La section reste repliable pour préserver le parcours de vente. Son entrée
illustrée ouvre un tableau de bord dédié : rang actuel, réputation chiffrée,
bonus en ligne et jauge vers le prochain palier. Les six rangs détaillés
distinguent le palier actuel, les paliers débloqués et ceux à atteindre.

Les clients en ligne et les boutiques partenaires ont chacun leur compteur et
une explication courte. Internet affiche l’accès du cycle et la reconduction
séparément ; couper la reconduction conserve l’accès déjà payé. Les trois
dernières ventes sont immédiatement lisibles avec une vignette du circuit,
le poids, le net versé et l’effet sur la réputation. Les autres ventes sont
accessibles en dépliant la liste.

Illustration créée avec l’outil intégré imagegen, puis convertie en WebP avec
Sharp (1200 × 800, qualité 85). Aucun changement de règles économiques.

- Fichier intégré : `public/placard/commerce-office-v1.webp`.
- Original conservé : `C:/Users/sylva/.codex/generated_images/01a09714-d6fa-7271-94b5-4e4e507128ee/exec-c54c74c5-e838-4162-a757-c776c23c78fc.png`.
- Composant : `src/components/placard/KqCommerceOverview.tsx`.
- Style : `src/components/placard/KqCommerceOverview.module.css`.

## Prompt final

Use case: illustration-story. Asset type: landscape illustration for the commerce dashboard of the French management game Le Placard, same vintage illustrated arena world. Create a finished 3:2 landscape game environment, no UI or text. A cheerful small cartoon merchant with a round face, black beret and cream work shirt stands at a wooden shopkeeper desk reviewing an open order ledger; a compact retro computer with softly glowing mint screen, internet router, carefully packed kraft parcels and a small brass reputation trophy sit on the desk. Behind, a corkboard with small shopfront sketches and customer portraits connected by simple pins suggests a growing community of customers and partner shops, without readable text or plotted metrics. Cozy boutique back office with amber pendant lamp and shelves of jars. Distinct hand-drawn black ink contours, delicate stipple and engraved shading, richly illustrated cartoon game art rather than photorealism. Restrained palette deep forest green #003f30, dark teal, mint turquoise highlights, mustard gold #f4c43d, warm cream paper. Warm welcoming light, inviting and playful. Clear single focal scene, merchant and desk centered in middle two thirds so a responsive crop remains understandable. No letters, words, numbers, logos, watermark, frames, UI panels or charts.

## Vérification

Le script `scripts/audit-placard-commerce.mjs` couvre le tableau de bord
à 320, 390, 768 et 1440 px : illustration chargée, jauge de 28 % pour
312 points au palier Artisan du lot, prochain objectif à 600, trois ventes
visibles, autres ventes accessibles, arrêt et reprise de la reconduction,
et dernier palier rempli à 100 %.
