# Personnages de l’arène — style Sylvain

Les têtes utilisent `sylvain-v4` et les tenues `sylvain-outfits-v5`. Les illustrations ont été générées avec l’outil intégré `image_gen`, en prenant `public/sylvain.png` comme référence principale : visage de trois quarts, une oreille visible, yeux verticaux à encoche, nez arrondi, sourire et ombres pointillées. Seuls le foulard et la boucle d’oreille proviennent encore de `sylvain-v3`.

Chaque coiffure est une tête complète obtenue par édition du même visage maître. Les cheveux, le crâne et l’oreille appartiennent à la même image ; ils ne sont plus superposés à partir de dessins indépendants. Le cadre transparent commun est conservé sans découpe ni étirement.

Les six hauts, quatre bas et quatre paires de chaussures sont issus d’éditions d’un personnage entier dans la même pose. Les vêtements comportent désormais des poches, coutures, ourlets, plis et cols cohérents ; les chaussures ont des panneaux, lacets et semelles propres à chaque modèle. Deux calques de jambes complètent les tenues : jambes nues pour le short et collants pour la jupe. Tous les calques de corps conservent le même cadre transparent de 768 × 1280 pixels, sans déplacement ni mise à l’échelle individuelle.

## Assets et prompts

- Têtes utilisées par le site : `public/contest/avatars/sylvain-v4/` (12 coiffures et 9 éditions pour les expressions, sourcils, barbes et lunettes, en WebP sans perte).
- Tenues utilisées par le site : `public/contest/avatars/sylvain-outfits-v5/` (6 hauts, 4 bas, 4 chaussures et 2 calques de jambes, en WebP sans perte).
- Foulard et boucle d’oreille : `public/contest/avatars/sylvain-v3/`.
- Maître et PNG originaux des têtes : `output/imagegen/sylvain-avatar-v4/source/`.
- Maître et éditions du personnage entier pour les tenues : `output/imagegen/sylvain-outfits-v5/source/`.
- Prompts enregistrés et spécifications initiales : [chanvrier-sylvain-v4-prompts.json](chanvrier-sylvain-v4-prompts.json). Les quatre spécifications initiales sont distinguées des prompts exacts conservés pour les éditions suivantes.
- Prompts exacts des tenues : [chanvrier-sylvain-outfits-v5-prompts.json](chanvrier-sylvain-outfits-v5-prompts.json). Le registre conserve le maître, les 11 variantes initiales et les 2 éditions finales des chaussures à partir du personnage en short, qui rendent leurs cols entièrement visibles.
- Conversion des têtes, à partir des PNG locaux : `node scripts/prepare-chanvrier-heads.mjs`.
- Extraction des calques de tenues, à partir des PNG locaux : `node scripts/prepare-chanvrier-outfits.mjs`.
- Assemblage : `src/components/contest/ChanvrierAvatar.tsx`, `chanvrier-head-renderer.ts` et `chanvrier-body-renderer.ts`.
- Aperçu de six personnages : `output/chanvrier-customization/sylvain-v5-preview.png`.
- Grilles des tenues et détails des chevilles : `output/chanvrier-outfit-audit/after/`.

Les PNG et captures sous `output/` sont des fichiers de travail locaux. Le site utilise uniquement les WebP de `public/` et ne dépend pas du cache de génération.

## Assemblage et validation

Les expressions, barbes et lunettes proviennent d’éditions du visage maître, appliquées dans ce même cadre. Un masque conserve les cheveux et les contours de la barbe lors d’un changement d’expression. Les options de forme du visage, des yeux et du nez déforment légèrement le dessin existant pour préserver son style.

Le corps est composé dans l’ordre jambes → chaussures → bas → haut. Les calques de bas ne contiennent que le vêtement et son encre ; chaque chaussure possède son propre col. Les jambes passent derrière ces cols et les ourlets, ce qui évite de superposer une ancienne cheville aux chaussures choisies. Les pieds conservent les mêmes points d’appui et la même ligne de sol. Une éventuelle adaptation de silhouette porte sur le corps entier.

La recoloration conserve l’encre, les ombres pointillées, les gants et les semelles crème. L’ocre des hauts et chaussures, le turquoise des bas et le rose réservé à la peau sont traités séparément. Les références de luminosité des jambes tiennent compte des différences entre les éditions générées afin de garder un teint cohérent avec les bras. Les tenues restent indépendantes du visage et des autres choix du profil.

Les profils existants gardent leurs choix et leurs valeurs par défaut ; les nouveaux profils commencent avec une tenue ocre/turquoise, des cheveux noirs et un sourire ouvert. Les vues « En pied » et « Zoom visage » utilisent le même personnage.

`node scripts/audit-chanvrier-customization.mjs` vérifie les douze coiffures distinctes, les sélections indépendantes, les vues en pied et visage, les largeurs mobiles 320/390 px, l’enregistrement avec reprise après erreur, la réouverture et le livret. Le script capture aussi 24 combinaisons pour l’inspection visuelle.

`node scripts/audit-chanvrier-heads.mjs` produit les grilles des 72 combinaisons coiffure/visage, ainsi que les expressions, accessoires, couleurs et tenues dans `output/chanvrier-head-audit/`. Les captures servent au contrôle visuel des raccords ; les assertions vérifient le chargement et la distinction des choix.

`node scripts/audit-chanvrier-outfits.mjs` produit les 16 combinaisons bas/chaussures, les six hauts, les teints des deux silhouettes et les six couleurs dans `output/chanvrier-outfit-audit/after/`. Une grille agrandit les chevilles pour examiner les raccords des jambes, cols et ourlets. Les assertions contrôlent les chargements, les choix distincts et les erreurs du navigateur ; la qualité des raccords nécessite aussi l’inspection des captures après chaque modification des illustrations.

Ces changements visuels ne nécessitent pas de migration supplémentaire. Les migrations de personnalisation et d’épargne du 19 septembre 2026 ont été appliquées lors de l’étape précédente.
