# Ouverture des packs — 22 septembre 2026

Le sachet et les cartes partagent désormais une scène persistante. Une timeline GSAP coordonne la déchirure, la descente du sachet et la sortie du dos de carte en environ 1,6 seconde. La carte reste en place quand le résultat du serveur arrive ; une réponse lente conserve le dos visible, sans révélation ni nouvel appel d’ouverture.

Le retournement sépare anticipation, passage de profil, révélation et stabilisation. Le nom, la rareté, le son et les effets apparaissent ensemble au passage de profil. La navigation est verrouillée pendant le mouvement ; la carte suivante remplace la précédente pendant sa sortie, puis glisse en place. La scène suivante est chargée à l’avance. Le geste de déchirure pilote directement les propriétés CSS, sans rendu React à chaque mouvement du doigt.

| Rareté | Réaction |
| --- | --- |
| Commune | Retournement court, lumière douce et deux notes |
| Argent | Onde en losange, éclats argentés et carillon clair |
| Or | Double anneau, rayons dorés et accord plus riche |
| Épique | Deux orbites croisées, halo violet et notes scintillantes |
| Légendaire | Anticipation prolongée, colonne lumineuse, couronne de rayons, étoiles et résolution musicale |

Le son est désactivé au départ. Le bouton sonore autorise la création du contexte audio ; les voix sont plafonnées, puis arrêtées et déconnectées quand le son est coupé ou le modal fermé. Aucun son externe n’est téléchargé.

La réduction des mouvements rend les changements immédiats, sans particules, mouvements de caméra ou attente artificielle. Le passage de l’animation attend toujours la réponse réelle. Les erreurs permettent de réessayer le même ticket. La fermeture détruit la timeline et ignore les résultats tardifs. Les règles de tirage, API et récompenses sont inchangées.

## Fichiers

- `src/components/lottery/PackOpeningAnimation.tsx` : séquence persistante et réactions.
- `src/components/lottery/PackSwipeCut.tsx` : geste tactile, souris et clavier.
- `src/components/lottery/PackOpening.module.css` : scène, cartes et effets.
- `src/hooks/useBoosterSound.ts` : sons synthétisés et cycle de vie audio.

## Validation

- TypeScript : `npx.cmd tsc --noEmit --incremental false`.
- ESLint ciblé sur les composants, le hook et le script d’audit.
- `node scripts/audit-pack-opening.mjs` : vrai modal et composants, données synthétiques, sans requête vers les services externes.
- Largeurs 320, 390, 768 et 1440 px ; cinq raretés ; souris, geste tactile incomplet/complet et clavier ; clics répétés sans doublon ; attente réseau et passage de l’animation ; reprise après erreur ; récapitulatif et consultation ; confinement/restauration du focus ; nettoyage audio et fermeture pendant une requête ; réduction des mouvements à 320 × 480 px.
- Rapport et captures : `output/pack-opening-studio/`.
- `node scripts/audit-pack-opening.mjs --record` : démonstration mobile locale, cinq raretés, fichier MP4 muet dans le même dossier. La vidéo sert à examiner le mouvement ; elle ne mesure pas les performances sur un téléphone physique.

Références techniques : [timelines GSAP](https://gsap.com/docs/v3/GSAP/Timeline/), [bonnes pratiques Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). Le guide Next.js installé sur les composants clients et les images a été consulté.
