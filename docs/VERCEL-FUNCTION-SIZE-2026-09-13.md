# Correction de la taille des fonctions Vercel

Le déploiement du commit `6e3f14d` compilait correctement, mais Vercel refusait
la fonction `[slug]` : 478,3 Mo non compressés, au-dessus de sa limite de 250 Mo.
La trace locale incluait les illustrations publiques du jeu, notamment plus
de 423 Mo dans `public/app`. Les chemins de médias locaux utilisés par les
helpers serveur entraînaient une collecte trop large du dossier public.

`next.config.ts` exclut désormais des traces serveur les illustrations de
`public/app`, `public/placard`, `public/contest` et `public/mascots` pour toutes
les routes. Ces fichiers restent déployés et accessibles par leurs URL publiques.
Les images et polices lues par le générateur de factures restent incluses.

## Vérifications locales

- `npm.cmd run build` : réussi, compilation, TypeScript et génération des pages.
- `node scripts/check-server-traces.mjs` : 206 traces vérifiées, aucune erreur.
- `[slug]` : 41 Mio estimés, dépendances partagées Next.js comprises.
- Plus grosse trace : upload vidéo, 102,2 Mio estimés.
- Factures client et administrateur : toutes les images et polices requises présentes.
- ESLint du correctif : réussi.

Le script se lance après un build et détecte les illustrations embarquées,
les traces trop volumineuses et les ressources de factures manquantes. Ces
estimations locales Windows ne remplacent pas la taille finale calculée par
Vercel sous Linux, qui peut inclure des fichiers supplémentaires de plateforme.
