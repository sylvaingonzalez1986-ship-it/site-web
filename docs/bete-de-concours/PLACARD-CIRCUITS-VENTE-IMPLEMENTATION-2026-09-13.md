# Le Placard — circuits de vente livrés le 13 septembre 2026

## Comportement

Le parcours est séquentiel : choisir un lot, préparer le produit, puis comparer
les circuits de distribution. Les trois offres illustrées (vente en ligne,
CBD shops et grossistes) apparaissent seulement après la préparation. Chacune
regroupe le montant, la quantité reprise, un avantage et une contrainte.
Un produit déjà préparé rejoint directement les offres, sans nouveaux frais.

Le tarif conseillé et la quantité disponible sont proposés par défaut. Les
réglages de prix et quantité restent accessibles dans « Ajuster ». Après une
vente partielle, « Vendre le reste » revient aux offres du même produit.
La réputation, l’abonnement Internet et l’historique sont regroupés dans
« Mon commerce », replié par défaut. La barre latérale de stocks et la
navigation permanente entre circuits ont été retirées.

L’habillage reprend le lobby de l’arène et celui du Placard : décor d’atelier
plein écran, vert profond, titres condensés, étapes turquoise, trésorerie dorée
et boutons en relief. Les offres conservent leurs illustrations avec le prix
et le volume superposés ; les conditions restent juste en dessous. Le circuit
choisi devient le décor de la vente. La confirmation et le résultat de vente
utilisent la même palette. Les transitions sont courtes et désactivées lorsque
la réduction des animations est demandée. Les illustrations existantes sont
réutilisées sans nouvel asset.

L’atelier prélève ses frais une seule fois ; le produit et la part non traitée
restent en stock. On peut vendre une quantité puis placer le reste ailleurs.
Le stock ne périme pas et traverse les cycles. Les anciens reçus sont conservés.

Le résultat immédiat de vente affiche aussi la satisfaction (satisfaits,
mitigés, déçus), les clients gagnés ou perdus et le total après livraison.
Le point de départ provient du devis serveur conservé pour la confirmation ;
le point d’arrivée est celui du reçu effectivement validé. Une petite vente
satisfaisante peut ne recruter personne. Les boutiques ont désormais leur propre réseau de partenaires, distinct des clients
en ligne. Les grossistes n’évaluent pas la qualité. Depuis la migration du réseau,
les nouveaux reçus enregistrent les effectifs avant/après, la satisfaction et
le taux de reprise des shops. Les anciens reçus restent inchangés.


- Ordinateur permanent à 450 €, acheté dans le catalogue matériel, hors emplacements
  de production. Internet à 15 € par culture terminée, désactivable, avec accès
  au cycle déjà payé conservé. Solde insuffisant : suspension sans dette Internet.
- Direct : prix lié au produit, à sa note et au palier de réputation ; choix
  découverte/conseillé/ambitieux. À partir de 1 500 points, les facteurs négatifs
  ne font plus baisser le prix unitaire ; les commandes restent limitées.
- Boutiques : 40–55 % de la référence produit selon la qualité, plus 0–4 points
  selon le réseau. Seuil de 6,5 pour les fleurs et 7,5 pour les transformations.
  Prospection accessible sans partenaire ; quota commun de 400 g équivalents,
  plus 25 g par partenaire de début de cycle, modulé par l’événement.
- Grossistes : 30 % normalement, 25 % en promotion concurrente, 33 % en réassort.
  Reprennent tous les volumes, sans exigence de note, sans réputation. La biomasse
  garde sa valeur industrielle propre. Les gammes avancées restent exigeantes.

La clientèle gagne au maximum cinq fidèles par cycle. Les pertes liées aux
livraisons décevantes sont proportionnelles à l’exposition et plafonnées à 25 %
de la clientèle du début de cycle. Les quotas de demande utilisent le palier
et la fidélité figés à l’ouverture ; les gains de clients ne créent pas de
commandes supplémentaires immédiates. Un événement persistant est tiré une fois
par culture terminée. Actualisation, changement de prix et fractionnement ne
renouvellent ni quota ni abonnement.

Les gains de réputation suivent la quantité écoulée : 100 % du barème en ligne,
50 % en boutique, zéro au grossiste. La maîtrise compte le lot d’origine une
fois, à partir de 50 % du produit préparé vendu hors grossiste et avec une
qualité qui apporte de la réputation. Les fleurs restantes ne débloquent pas
la maîtrise du hash ou du rosin. Les primes
ponctuelles restent uniques. Les écritures monétaires et de réputation utilisent
des cumuls pour éviter des gains artificiels par arrondi sur les petites ventes.

## Barème du réseau de boutiques

| Qualité | Fleur | Hash / rosin | Reprise de référence | Effet sur les partenaires |
| --- | --- | --- | --- | --- |
| Limite | 6,5 à moins de 7 | 7,5 à moins de 8 | 40 % | −1 par 100 g équivalents livrés |
| Correcte | 7 à moins de 8 | 8 à moins de 9 | 45 % | Stable |
| Très bonne | 8 à moins de 9 | 9 à moins de 9,5 | 50 % | +1 par 200 g équivalents livrés |
| Exceptionnelle | 9 à 10 | 9,5 à 10 | 55 % | +1 par 150 g équivalents livrés |

En dessous des seuils d’acceptation : refus, donc aucun effet de livraison.
La biomasse reste réservée au grossiste. Le barème vise la lisibilité et
l’équilibre du jeu ; ses pourcentages ne sont pas des cotations du marché réel.

Le bonus réseau ajoute **1 point dès 1 partenaire**, **2 dès 4**, **3 dès 8**,
**4 dès 12**. Exemple : une fleur à 8,5/10 vaut 50 % sans partenaire et 52 %
avec quatre boutiques. Un lot limite tombe à 42 % avec le même réseau.
Le prix maximum de reprise (59 %) reste sous le plancher du direct (60 %).

Le réseau est limité à 20 partenaires et à un recrutement par cycle. Les
pertes sont limitées à 25 % des partenaires de début de cycle, arrondis au
supérieur (au moins un départ possible dans un petit réseau). Les petites
livraisons cumulent leur progression entre cycles ; aucun partenaire entier
n’est perdu pour un simple échantillon sans livraisons décevantes antérieures.
Chaque progression est calculée à partir de la masse de fleurs équivalente :
les concentrés ne permettent pas d’accélérer artificiellement le recrutement.

Le prix réseau et la capacité sont figés à l’ouverture du cycle. La qualité
du lot joue immédiatement ; les partenaires gagnés ou perdus ajustent ces
conditions au cycle suivant. La capacité reste de 400 g sans partenaire,
puis augmente de 25 g par boutique, jusqu’à 900 g avant événements.
Un réassort ajoute 25 % ; les promotions concurrentes retirent 25 % du volume.

Pour 120 g livrés chaque cycle, une qualité constante de 8/10 atteint
20 boutiques au 34e cycle ; à 9/10, au 25e cycle. Ces trajectoires supposent
assez de récolte et aucune livraison décevante. Le jeu conserve la progression
lente de réputation et les différences de marge entre les trois circuits.

Les crédits de recrutement et de départ utilisent une unité commune de
6 000 : masse équivalente en décigrammes × 3 (très bon), × 4 (exceptionnel),
× 6 (décevant). Les cumuls de cycle sont plafonnés avant conversion en
partenaires. Les fonctions SQL recalculent les mouvements et vérifient le
devis serveur ; une répétition réseau renvoie le reçu déjà enregistré.

## Structure

- `src/lib/kanab-quest-commerce.ts` : barème commun au serveur et aux aperçus UI.
- `src/lib/supabase/kanab-quest-commerce-backend.ts` : devis produits par le serveur,
  lecture des stocks et commandes validées ; le navigateur n’envoie jamais son prix calculé.
- `/api/arena/placard/commerce` : session authentifiée, contrôle d’accès et limitation
  des mutations. L’ancien POST du marché demande de rafraîchir l’application.
- `KqCommerceDesk` : scènes illustrées, réserve, préparation, quantité, confirmation,
  confirmation du montant net et reçu. Les informations de gestion sont regroupées. `KqCommerceComputer` est intégré dans la zone défilante
  du catalogue matériel, avec actualisation du portefeuille après achat.
- Les devis expirent après dix minutes. Les transactions vérifient le propriétaire,
  la version du compte/cycle, le stock, la réputation, l’abonnement et la dette
  électrique. Un devis devenu obsolète doit être réexaminé.
- Le passage en stock interdit l’ancien règlement intégral. Les reçus autorisent
  plusieurs ventes par fleur. Les identifiants de requête conservent leur résultat
  pour qu’une répétition réseau ne change pas une seconde fois le portefeuille.
- Le tri des cultures historiques utilise `completed_at`, puis `started_at`.
  Le chargement traite les lots non préparés par groupes de 100 ; la réserve
  persistante est indépendante de l’ancienne limite des 40 dernières fleurs.

## Base de données

Migrations appliquées à la base liée :

- `20260913000100_kq_sales_channels.sql` : stocks, comptes commerciaux, campagnes,
  devis, commandes, ventes partielles et compatibilité des reçus historiques.
- `20260913000200_kq_commerce_completed_at.sql` : correction du champ de date de
  la dernière culture terminée, détectée par le contrôle SQL distant.

- `20260913000300_kq_commerce_mastery_guards.sql` : conditions de progression
  revérifiées à la préparation et maîtrise fondée sur le produit réellement vendu.
- `20260913000400_kq_shop_partners.sql` : réseau indépendant, progression cumulée,
  conditions figées par cycle, validation des gains/pertes et reçus détaillés.

La migration des récompenses d’arène `20260912000100` a été exclue. Le contrôle
SQL distant ne remonte plus d’erreur après le correctif. La migration déjà
appliquée n’a pas été réécrite : le correctif est une migration complémentaire.

## Vérifications

Les 92 fichiers de tests du Placard passent : 657 tests. TypeScript et ESLint
passent également. L’API Next locale répond 401 sans session, et le schéma
Supabase répond 200 avec toutes les nouvelles fonctions et tables attendues.

- Tests TypeScript : trois tarifs, prérequis Internet, reprise de qualité nulle,
  saturation, stabilité du prix haut de gamme, quota commun, fractionnement,
  arrondis monétaires, fidélisation et exposition aux pertes.
- PostgreSQL en mémoire : ordinateur, facturation unique, reconduction, absence
  de trésorerie, stocks préparés, reçus partiels, verrouillage des anciennes ventes,
  propriété, répétition des requêtes, offres concurrentes, expiration, dette
  électrique modifiée, conservation entre cycles et retour d’un ancien joueur.
- Navigateur réel avec données synthétiques : préparation, vente directe de 20 g,
  reprise grossiste des 100 g restants, reçu et état vide à 320/390/768/1440 px.
  Achat du PC dans le catalogue réel puis activation Internet à 390 px.
  Le contrôle du parcours simplifié vérifie aussi l’absence de circuits avant
  préparation, les réglages repliés, le retour aux invendus, la reprise d’un
  produit déjà préparé et la transformation en hash avec fleurs restantes.
  Scénarios complémentaires : satisfaction sans recrutement, clients gagnés/perdus,
  partenaire recruté, partenaire perdu et consultation du barème sur mobile.
- Simulation de 960 cultures : 4 qualités × 4 stratégies × 60 cycles. Les
  scénarios ne modélisent pas les boosters, les transformations ni la saturation ;
  ils comparent les circuits, sans annoncer de rentabilité réelle ou de rétention.
  À 6/10, la stratégie mixte avec Internet rapporte moins de trésorerie finale
  que la reprise grossiste seule ; à 9/10, le mix direct/boutique rapporte davantage
  que les boutiques seules. Le direct seul laisse des stocks invendus.

Rapports : `output/placard-commerce/report.json`, `balance.json`, captures PNG.
Commandes :

```text
npx.cmd vitest run src/lib/kanab-quest src/lib/supabase/kanab-quest src/components/placard
node scripts/test-placard-commerce.mjs
node scripts/simulate-placard-commerce.mjs
node scripts/audit-placard-commerce.mjs
node scripts/check-placard-commerce-schema.mjs
npx.cmd tsc --noEmit
```

## Illustrations

Génération avec l’outil intégré imagegen, sans CLI ni clé API supplémentaire.
Référence de style : `public/placard/market-workshop-v1.png`, consultée avant
la génération. Chaque résultat a été inspecté puis converti en WebP de 1 200 px.
Les fichiers consommés par le site sont dans le dépôt :

| Circuit | Fichier |
| --- | --- |
| Direct | `public/placard/channel-online-v1.webp` |
| CBD shops | `public/placard/channel-cbd-shop-v1.webp` |
| Grossistes | `public/placard/channel-wholesale-v1.webp` |

Prompt commun exact, précédé du sujet correspondant ci-dessous :

> Use case: illustration-story. Create ONE new landscape 3:2 game scene asset.
> Reference image is STYLE ONLY; do not reproduce its machinery or character.
> [SUBJECT] Match the existing Le Placard game illustration: retro hand-inked
> storybook engraving, bold black outlines, stippled print grain, deep forest
> green and teal with golden mustard light and warm cream. Readable silhouette,
> coherent perspective, charming richly illustrated setting, illustrated to the
> edges, no border or UI panels, no text, no logos. Main subject centered within
> middle 70 percent; lower edge dark green for HTML caption overlay. This is a
> polished environment selection illustration for a game.

Sujets exacts insérés :

1. An inviting vintage desktop computer with glowing screen and small wifi router
   on a wooden packing desk, kraft parcels and glass botanical flower jars, warm
   lamp, green curtains. Clearly a small producer's ONLINE SHOP shipping station.
   No people.
2. A charming French botanical CBD shop front, wide ochre striped awning, forest
   green wooden storefront, flower jars visible through large window, small
   welcoming counter. Clearly a RETAIL SHOP buying products. No people.
3. A rustic wholesale warehouse loading bay, wooden pallets stacked with large
   sealed kraft cartons and sacks, teal delivery van parked beside them, hanging
   yellow industrial lamp. Clearly a WHOLESALE bulk distribution depot. No people.
