# Pack des Pionniers — édition limitée 2026

## Contenu et éligibilité

Une attribution par compte : **1 000 € de jeu** (100 000 centimes ajoutés au solde existant), **un Buddie or aléatoire** ajouté à l’album, **10 packs La Botte de 10 cartes** et la carte souvenir **Les Pionniers**.

La commande doit être payée, non annulée et créée avant le **11 octobre 2026 à 00:00 Europe/Paris**, soit le 10 octobre à 22:00 UTC. Le 10 octobre est donc entièrement inclus. Aucun plancher de date : tout l’historique du site est pris en compte. Une commande future ne qualifie pas. Une commande passée avant la borne puis payée plus tard peut devenir éligible : la borne porte sur la date de commande. La récupération du cadeau n’expire pas.

Les commandes liées à un compte sont reconnues par leur identifiant client. Une ancienne commande sans compte peut qualifier son acheteur si l’adresse correspond à l’e-mail **vérifié** de son compte, sans tenir compte de la casse ou des espaces de bord. Une commande déjà liée à un autre compte ne peut pas être récupérée par e-mail. Le nombre de commandes ne multiplie pas les cadeaux.

La carte souvenir est stockée dans `lottery_card_instances`, au sein de la collection `PIONEERS_2026`, code `PIONEER-2026-001`. La collection et sa définition restent inactives pour les tirages habituels ; la carte est présentée dans l’espace dédié de l’album. Elle ne modifie ni les pages Buddies, ni leurs récompenses de complétion, ni les bonus de jeu des Buddies. Le Buddie or peut être un doublon d’une carte déjà possédée, conformément au tirage aléatoire demandé.

## Parcours

- Lien depuis l’aide de l’Arène vers `/profil/collection#pack-pionniers`.
- Présentation dans l’accueil de l’album, les cartes et les récompenses ; le joueur éligible pourra recevoir son pack lors de l’ouverture du jeu le 15 octobre 2026.
- Après attribution : carte souvenir possédée, nom du Buddie tiré, accès à la boutique du Placard pour ouvrir les packs.
- La distribution groupée crédite aussi les comptes qui ne visitent pas l’album. Une visite ultérieure retrouve les récompenses attribuées.

Le statut GET ne crédite rien. Le POST ne prend aucun montant, identifiant client ou choix de carte fourni par le navigateur. Les quatre récompenses sont attribuées dans une transaction PostgreSQL avec verrou par compte, registre unique et clés de packs uniques. Rejouer la demande retourne le même tirage sans nouveau crédit. Les RPC sont réservées au rôle service. Le registre expose uniquement la ligne du propriétaire via RLS.

## Activation

**Calendrier validé : distribution le 15 octobre 2026, à l’ouverture du jeu.** La limite des commandes reste le 10 octobre 2026 inclus, heure de Paris. Attendre l’ouverture avant de lancer `--apply` et de rendre la récupération du pack accessible aux joueurs. La migration est déjà appliquée ; aucune distribution automatique n’est programmée.

Déployer les fichiers de l’application et appliquer `supabase/migrations/20260919000300_kq_pioneer_pack.sql` après les migrations précédentes. Les catalogues Buddies et La Botte doivent être actifs avec leurs cartes.

Avec les variables Supabase du projet dans l’environnement ou `.env.local` :

```powershell
# Aperçu du nombre de comptes à créditer, sans attribution.
node scripts/grant-pioneer-packs.mjs

# Attribution effective, par lots de 100 comptes maximum.
node scripts/grant-pioneer-packs.mjs --apply
```

Lancer la distribution le 15 octobre 2026 à l’ouverture du jeu, avec un nouvel aperçu des bénéficiaires juste avant l’attribution. Ce script n’installe pas de tâche planifiée. Il peut être relancé après une interruption : les attributions déjà faites ne sont pas répétées. Les nouvelles personnes éligibles peuvent aussi récupérer leur cadeau depuis l’album. Un acheteur invité doit disposer d’un compte avec e-mail vérifié pour recevoir des biens de jeu.

**État de cette intervention (19 septembre 2026) :** migration `20260919000300` appliquée au projet Supabase lié `eyowwwpdmfrulhkpvlnf` et confirmée dans son historique distant. La connexion fonctionne avec les accès CLI locaux hors du bac à sable. Aperçu distant vérifié : 116 comptes examinés, 52 éligibles, aucun contenu indisponible. La distribution groupée n’a pas été lancée : 0 attribution lors de cette intervention.

## Vérifications

```powershell
node scripts/test-pioneer-pack.mjs
npx.cmd vitest run src/app/api/account/pioneer-pack/route.test.ts
node scripts/audit-pioneer-pack.mjs
```

Le test PostgreSQL charge la migration réelle et la fonction existante d’ouverture des packs sur des tables isolées. Horloge figée autour du 15 octobre 2026 et générateur aléatoire déterministe pour tester les bornes. Cas vérifiés : historique, dernière microseconde du 10 octobre, première seconde du 11, commandes impayées/annulées, e-mail invité vérifié, tentative de récupération d’une commande d’un autre compte, argent initial/existant, absence de doublon, sélection dans le bon ensemble de Buddies or actifs, annulation intégrale sur erreur tardive, ouverture réelle de dix cartes, aperçu et pagination de distribution, nettoyage des commandes, permissions RPC et RLS. PGlite sérialise les requêtes : ce test de rejeu simultané ne remplace pas un test de contention sur plusieurs connexions PostgreSQL.

L’audit navigateur charge le composant réel avec des comptes et une API simulés. Captures et rapport : `output/pioneer-pack/`, formats 320, 390, 768 et 1 440 px ; succès, déjà reçu, déconnexion, non-éligibilité, contenu indisponible et nouvelles tentatives après erreur.

## Illustration originale

Générée avec l’outil intégré **imagegen**, à partir de la mascotte de `public/mascots/blog-journal.png` comme référence d’identité. Fichier intégré : `public/contest/rewards/pioneers-2026-v1.png`. Aucun appel à une API d’image externe par script.

Prompt exact :

```text
Use case: stylized-concept. Asset type: a finished exclusive commemorative collectible card for the French Kanab Quest / Les Chanvriers Bretons web game. Use the attached reference solely to preserve the mascot's visual identity: friendly round pale face, simple black cartoon eyes, teal and tan cap, teal overalls over tan shirt, thick black outlines, 1930s cartoon with subtle halftone paper texture. Create NEW artwork and pose: the mascot proudly holds a small living hemp seedling in a golden planter with both hands, symbol of the players who helped the adventure grow. Full portrait trading card, approximately 2:3, straight-on flat printable design, all corners in frame. Deep forest green #003f30, cream #fffaf1, warm gold #f4c43d; substantial ornate but restrained gold border, little botanical flourishes, cream title panel, warm celebratory sunburst behind mascot. Professional game collectible, cohesive with a retro French farming game, clean highly readable at small size. Exact French text only: top small 'KANAB QUEST', main title 'LES PIONNIERS', bottom plaque 'ÉDITION LIMITÉE', bottom small '2026'. No other text, no currency, no stats, no 1/1 numbering, no watermark, no mockup or tabletop. This commemorative card is distinct from the regular Buddies and La Botte packs. Make this a polished exclusive collector's reward.
```

## Verrou de lancement

La migration `20260919000400_kq_pioneer_pack_opening.sql` est appliquée au projet lié. Elle interdit les attributions avant le 15 octobre 2026 à 00 h 00, heure de Paris, y compris les appels de service et la distribution groupée. L’aperçu reste disponible. Aucune distribution automatique n’est programmée ; lancer le script le jour de l’ouverture.
