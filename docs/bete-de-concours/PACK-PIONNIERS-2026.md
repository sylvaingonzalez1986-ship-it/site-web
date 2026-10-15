# Pack des Pionniers — édition limitée 2026

## Contenu et éligibilité

Une attribution par compte : **5 000 € de jeu** (500 000 centimes ajoutés au solde existant), **un Buddie or ou épique aléatoire** ajouté à l’album, **10 packs La Botte de 10 cartes** et la carte souvenir **Les Pionniers holographique**.

Le tirage du Buddie choisit d’abord la rareté : **90 % or / 10 % épique** (9 chances sur 10 pour l’or, 1 sur 10 pour l’épique), puis une carte au hasard parmi les Buddies actifs de cette rareté. Ces probabilités sont indépendantes de la taille des deux catalogues ; elles ne garantissent pas une carte épique dans chaque groupe de dix packs Pionniers. Les deux raretés doivent être disponibles pour permettre l’attribution.

La commande doit être payée, non annulée et créée avant le **11 octobre 2026 à 00:00 Europe/Paris**, soit le 10 octobre à 22:00 UTC. Le 10 octobre est donc entièrement inclus. Aucun plancher de date : tout l’historique du site est pris en compte. Une commande future ne qualifie pas. Une commande passée avant la borne puis payée plus tard peut devenir éligible : la borne porte sur la date de commande. La récupération du cadeau n’expire pas.

Les commandes liées à un compte sont reconnues par leur identifiant client. Une ancienne commande sans compte peut qualifier son acheteur si l’adresse correspond à l’e-mail **vérifié** de son compte, sans tenir compte de la casse ou des espaces de bord. Une commande déjà liée à un autre compte ne peut pas être récupérée par e-mail. Le nombre de commandes ne multiplie pas les cadeaux.

La carte souvenir est stockée dans `lottery_card_instances`, au sein de la collection `PIONEERS_2026`, code `PIONEER-2026-001`. La collection et sa définition restent inactives pour les tirages habituels ; la carte est présentée dans l’espace dédié de l’album avec une finition holographique irisée en CSS. L’effet respecte la préférence de réduction des animations. Elle ne modifie ni les pages Buddies, ni leurs récompenses de complétion, ni les bonus de jeu des Buddies. Le Buddie or ou épique peut être un doublon d’une carte déjà possédée, conformément au tirage aléatoire demandé.

## Parcours

- Lien depuis l’aide de l’Arène vers `/profil/collection#pack-pionniers`.
- Présentation dans l’accueil de l’album, les cartes et les récompenses ; le joueur éligible pourra recevoir son pack dès le 30 octobre 2026 à 00 h 00 (Europe/Paris), avant l’ouverture du jeu le 1er novembre.
- Après attribution : carte souvenir holographique possédée, nom et rareté du Buddie tiré ; l’album indique le 1er novembre pour ouvrir les packs, puis affiche le lien vers la boutique du Placard à l’ouverture du jeu.
- La distribution groupée crédite aussi les comptes qui ne visitent pas l’album. Une visite ultérieure retrouve les récompenses attribuées.

Le statut GET ne crédite rien. Le POST ne prend aucun montant, identifiant client ou choix de carte fourni par le navigateur. Les quatre récompenses sont attribuées dans une transaction PostgreSQL avec verrou par compte, registre unique et clés de packs uniques. Rejouer la demande retourne le même tirage sans nouveau crédit. Les RPC sont réservées au rôle service. Le registre expose uniquement la ligne du propriétaire via RLS.

## Activation

**Calendrier validé : libération du pack le 30 octobre 2026 à 00 h 00 (Europe/Paris), ouverture du jeu le 1er novembre 2026 à 00 h 00 (Europe/Paris).** La limite des commandes reste le 10 octobre 2026 inclus, heure de Paris. Attendre le 30 octobre avant de lancer `--apply` ; la récupération du pack depuis l’album devient accessible à cette date indépendamment du verrou de l’Arène. Les migrations initiales sont déjà appliquées ; aucune distribution automatique n’est programmée.

Déployer les fichiers de l’application avec la migration `supabase/migrations/20261015000100_kq_pioneer_pack_release_october_30.sql`, après les migrations précédentes dont `20260919000300_kq_pioneer_pack.sql`, `20260919000400_kq_pioneer_pack_opening.sql` et `20261001000100_kq_pioneer_pack_rewards.sql`. Les catalogues Buddies et La Botte doivent être actifs, avec au moins un Buddie or et un épique actifs.

**Révision du 1er octobre 2026 :** la migration `20261001000100_kq_pioneer_pack_rewards.sql` porte les futurs packs à 5 000 € et ajoute le tirage or/épique 90/10. Vérifiée localement, elle a été appliquée au projet Supabase lié `eyowwwpdmfrulhkpvlnf` à la demande de l’utilisateur avec `supabase db push --linked --yes`, après confirmation qu’elle était la seule migration en attente. L’historique distant confirme la version `20261001000100` et la prévisualisation suivante indique que la base est à jour. Les éventuelles attributions historiques conservent leur montant et leur carte, sans nouveau crédit. La clé API historique `goldCard` est conservée avec un champ `rarity` pour afficher la rareté réellement reçue. Aucune distribution de packs n’avait été lancée lors de cette intervention ; le verrou était alors fixé au 15 octobre.

Avec les variables Supabase du projet dans l’environnement ou `.env.local` :

```powershell
# Aperçu du nombre de comptes à créditer, sans attribution.
node scripts/grant-pioneer-packs.mjs

# Attribution effective, par lots de 100 comptes maximum.
node scripts/grant-pioneer-packs.mjs --apply
```

Lancer la distribution à partir du 30 octobre 2026 à 00 h 00 (Europe/Paris), avec un nouvel aperçu des bénéficiaires juste avant l’attribution. Ce script n’installe pas de tâche planifiée. Il peut être relancé après une interruption : les attributions déjà faites ne sont pas répétées. Les nouvelles personnes éligibles peuvent aussi récupérer leur cadeau depuis l’album. Un acheteur invité doit disposer d’un compte avec e-mail vérifié pour recevoir des biens de jeu.

**État de cette intervention (19 septembre 2026) :** migration `20260919000300` appliquée au projet Supabase lié `eyowwwpdmfrulhkpvlnf` et confirmée dans son historique distant. La connexion fonctionne avec les accès CLI locaux hors du bac à sable. Aperçu distant vérifié : 116 comptes examinés, 52 éligibles, aucun contenu indisponible. La distribution groupée n’a pas été lancée : 0 attribution lors de cette intervention.

## Vérifications

```powershell
node scripts/test-pioneer-pack.mjs
npx.cmd vitest run src/app/api/account/pioneer-pack/route.test.ts
node scripts/audit-pioneer-pack.mjs
npm run check:supabase-grants
```

Le test PostgreSQL charge les migrations réelles et la fonction existante d’ouverture des packs sur des tables isolées. Horloge figée autour du 30 octobre 2026 et générateur aléatoire déterministe pour tester les bornes. Cas vérifiés : historique, dernière microseconde du 10 octobre, première seconde du 11, commandes impayées/annulées, e-mail invité vérifié, tentative de récupération d’une commande d’un autre compte, ajout de 5 000 € au solde initial/existant, conservation des anciens cadeaux, absence de doublon, neuf issues or et une épique sur les dix issues équiprobables même avec des catalogues de tailles différentes, sélection dans le bon ensemble de Buddies actifs, indisponibilité de l’une des raretés, annulation intégrale sur erreur tardive, ouverture réelle de dix cartes, aperçu et pagination de distribution, nettoyage des commandes, permissions RPC et RLS. PGlite sérialise les requêtes : ce test de rejeu simultané ne remplace pas un test de contention sur plusieurs connexions PostgreSQL.

L’audit navigateur charge le composant réel avec des comptes et une API simulés. Il applique les verrous de production avec une horloge contrôlée : refus avant le 30 octobre, récupération dès minuit heure de Paris, message d’attente pour ouvrir les packs jusqu’au 1er novembre et lien vers le Placard à partir de cette seconde borne. Captures et rapport : `output/pioneer-pack/`, formats 320, 390, 768 et 1 440 px ; succès or et épique, anciens cadeaux, finition holographique et réduction des animations, déjà reçu, déconnexion, non-éligibilité, contenu indisponible et nouvelles tentatives après erreur.

## Illustration originale

Générée avec l’outil intégré **imagegen**, à partir de la mascotte de `public/mascots/blog-journal.png` comme référence d’identité. Fichier intégré : `public/contest/rewards/pioneers-2026-v1.png`. Aucun appel à une API d’image externe par script.

Prompt exact :

```text
Use case: stylized-concept. Asset type: a finished exclusive commemorative collectible card for the French Kanab Quest / Les Chanvriers Bretons web game. Use the attached reference solely to preserve the mascot's visual identity: friendly round pale face, simple black cartoon eyes, teal and tan cap, teal overalls over tan shirt, thick black outlines, 1930s cartoon with subtle halftone paper texture. Create NEW artwork and pose: the mascot proudly holds a small living hemp seedling in a golden planter with both hands, symbol of the players who helped the adventure grow. Full portrait trading card, approximately 2:3, straight-on flat printable design, all corners in frame. Deep forest green #003f30, cream #fffaf1, warm gold #f4c43d; substantial ornate but restrained gold border, little botanical flourishes, cream title panel, warm celebratory sunburst behind mascot. Professional game collectible, cohesive with a retro French farming game, clean highly readable at small size. Exact French text only: top small 'KANAB QUEST', main title 'LES PIONNIERS', bottom plaque 'ÉDITION LIMITÉE', bottom small '2026'. No other text, no currency, no stats, no 1/1 numbering, no watermark, no mockup or tabletop. This commemorative card is distinct from the regular Buddies and La Botte packs. Make this a polished exclusive collector's reward.
```

## Verrou de lancement

La migration historique `20260919000400_kq_pioneer_pack_opening.sql`, appliquée au projet lié, fixait le verrou au 15 octobre. La nouvelle migration additive `20261015000100_kq_pioneer_pack_release_october_30.sql` le reporte au **30 octobre 2026 à 00 h 00, heure de Paris** (29 octobre à 23 h 00 UTC), y compris pour les appels de service et la distribution groupée. Elle reste à déployer avec l’application ; aucune modification distante ni distribution n’est exécutée par cette préparation. Les attributions déjà effectuées sont conservées. L’aperçu reste disponible. Aucune distribution automatique n’est programmée ; lancer le script à partir du 30 octobre.
