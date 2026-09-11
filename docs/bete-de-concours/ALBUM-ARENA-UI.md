# Mon album — interface Arène

Mise à jour du 11 septembre 2026, sur `/profil/collection`.

- Accueil pleine hauteur utilisant directement les styles de `ArenaLobby.module.css` et `ArenaRetro.module.css` : même marque, même sélecteur à trois entrées, même bouton contextuel et même disposition mobile.
- Personnage original rétabli, scène centrale sans cadre, lien direct vers l’Arène.
- Trois destinations : Boosters, Cartes et Récompenses. Chaque destination possède son écran dans l’album ; les changements se font localement et replacent le focus au début de l’écran.
- Les cartes Buddies et La Botte / Héritages se choisissent dans la collection. Elles ne sont plus empilées sur la page d’accueil.
- Achat avec points dans Boosters ; gains et recyclage dans Récompenses.
- Navigation par rareté : l’onglet actif reste visible sans déplacer verticalement la page.
- Titres et badges contrastés, présentation adaptée aux petits écrans.
- Collection du Placard harmonisée ; compteur calculé depuis le catalogue, texte adapté au sol vivant.

## Illustration actuelle

L’asset `public/app/lottery/charles-booster-presentation-v2.png` est réutilisé tel quel pour conserver le personnage fidèle et son pack. Aucun nouveau dessin ni traitement de l’image pour cette révision.

Le booster scellé `public/app/lottery/sealed-booster-pack.png` et son parcours d’ouverture sont conservés.

## Historique : illustration écartée du 10 septembre

Mode : **imagegen intégré, édition avec références locales**. Conversion WebP avec Sharp, 1200 × 800, 167 526 octets.

Asset conservé sur disque mais retiré de la page : `public/app/lottery/album-booster-mascot-v3.webp`.

Références : `public/app/lottery/charles-booster-presentation-v2.png` et `public/contest/mascot/tasting/tasting-verdict.png`.

Le dessin du personnage est renouvelé et reprend la présentation du booster. L’asset original `public/app/lottery/sealed-booster-pack.png` et le parcours d’ouverture sont conservés.

La première génération produisait un damier opaque ; elle a été écartée. La seconde utilise un fond vert explicite intégré à la scène.

### Prompt initial

Edit the first reference image for a premium cartoon game collection album. Transparent background, no text. Redraw ONLY the farmer mascot on the LEFT in the precise chunky dark ink, lively expressive halftone cartoon style of the second reference. Friendly rounded face, short brown beard, beige cap with dark teal visor, beige shirt and teal overalls. He smiles proudly presenting the booster with an open hand. Natural convincing hands and body, clean bold silhouette, richer cel shading and subtle print texture, playful but professional. CRITICAL: preserve the large foil BOOSTER PACK on the RIGHT exactly as in reference one: same original illustrated wrapper artwork including seated farmer, yellow sunburst, green field, golden rectangular frame, dark green foil and silver crimped top and bottom. Do not redesign, simplify or substitute the pack. Keep entire mascot and entire booster visible, similar composition and relative size, no ground or scenery, real alpha transparency. Second reference is for mascot drawing style only; do not include its notebook. Crisp high quality game UI asset.

### Prompt de correction retenu

Edit this game illustration. Replace ALL gray checkerboard background and ghost outlines with a completely flat deep forest green background hex #073a32. No checkerboard anywhere, no transparency, no texture in background. Preserve the exact foil booster pack artwork, shape, colors and silver seals. Improve the mascot: dynamic friendly adult farmer in chunky premium cartoon game style, rounded proportions, subtle tan face shading, short brown beard, cream tee and teal overalls, teal and beige cap. Keep the pose presenting the pack and strong ink outlines with halftone on clothing. Enlarge subjects to occupy entire canvas height with only 3 percent margins. Keep both complete feet and pack visible. Landscape canvas 3:2 aspect ratio, mascot left and large booster right. No text, no extra objects.

## Vérifications

`node scripts/audit-album-arena.mjs` utilise les vrais composants et le hook de l’album avec des réponses API synthétiques locales. Aucun accès à Supabase.

Contrôles : largeurs 320, 390, 768 et 1440 px, personnage original, une seule action principale, navigation entre écrans, collection du Placard, débordement horizontal, images, changement de rareté, détails des cartes, ouverture et fermeture du booster original, achat avec points, choix de récompense, gestion des doublons, collection vide, aperçu déconnecté et sélection au clavier en mouvement réduit.

Captures et rapport local : `output/placard-workshop/album/`.

## Ouverture interactive des boosters — 11 septembre

L’ouverture utilise une scène Arène dédiée : éclairages, sol en perspective,
sachet qui réagit au glissement, fermeture déchirée et cartes extraites en éventail.
Le joueur retourne chaque carte au toucher, au balayage ou au clavier. Les cartes
révélées restent consultables ; les suivantes se découvrent dans l’ordre reçu.
Les couleurs, reflets et éclats suivent la rareté réelle de chaque carte.

Le son est désactivé par défaut ; son activation autorise des arpèges synthétisés
localement, sans fichier audio ni appel externe. Les animations respectent la
réduction des mouvements et peuvent être passées. Le récapitulatif montre les
nouveautés, doublons et bonus, permet de revoir chaque carte et ne se ferme plus
automatiquement après trois secondes.

L’API de tirage et ses résultats sont conservés. Un verrou synchrone empêche
plusieurs appels d’ouverture depuis un même geste ou un double clic. Les erreurs
permettent de réessayer le même ticket ; passer l’animation attend toujours le
résultat serveur. La fermeture annule les temporisations visuelles restantes.

Implémentation : `PackOpeningAnimation.tsx`, `PackSwipeCut.tsx`,
`PackOpening.module.css`, `PackOpeningFlowModal.tsx`, `useBoosterSound.ts`.
Le modal gère Échap, le confinement du focus et son retour au déclencheur.

L’audit couvre les cinq raretés, un bonus, le geste tactile incomplet puis complet,
le passage du toucher au clavier, la déduplication des appels, une erreur réseau,
la révélation rapide, la consultation après récapitulatif et une hauteur de 480 px.
Les captures `pack-*.png` utilisent des résultats fictifs ; les mesures Chromium
ne remplacent pas un essai sur un smartphone physique.
