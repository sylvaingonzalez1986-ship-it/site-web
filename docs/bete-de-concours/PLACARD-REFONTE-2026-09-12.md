# Le Placard — refonte des décisions, de la progression et du marché

Implémentation du 12 septembre 2026. Les deux migrations du Placard ont été
appliquées à la base Supabase liée après autorisation explicite du joueur.
Le code de l’application n’a pas été publié par cette opération.

## Diagnostic et choix

La boucle culture → jury → vente → équipement existait, avec incidents, défis,
maîtrises et Héritages. Ses points faibles étaient des effets de soutien répétés,
la vente automatique,
et un premier investissement de transformation disproportionné.

Le changement donne une conséquence visible à chaque décision : choisir une
rareté de Buddie et son budget d’XP, couvrir plusieurs étapes avec son deck, viser une gamme accessible,
ou accepter une marge plus faible pour libérer sa trésorerie. La difficulté des
gammes augmente par des conditions de compétence et d’investissement explicites.

Les principes utilisés sont les décisions intéressantes et les compromis décrits
par [Sid Meier à la GDC](https://www.gdcvault.com/play/1015756/interesting), ainsi que
l’autonomie et le sentiment de compétence étudiés dans la
[théorie de l’autodétermination](https://selfdeterminationtheory.org/the-theory/).
Ces principes orientent le design ; ils ne prouvent pas que cette version plaît
aux joueurs. La simulation mesure des résultats, pas le plaisir ou la rétention.

## Cartes et diversité

- 52 Buddies : bonus d’XP de départ selon la rareté conservé à la demande du joueur.
  Commun +0, Argent +1, Or +2, Épique +3, Légendaire +4, en plus de l’XP de base.
  Aucun talent par étape. Les bonus de mission et d’Héritage restent cumulatifs.
- 32 soutiens actifs : 32 effets différents. Le catalogue et les textes de la
  collection sont synchronisés par une migration générée depuis le moteur.
- La Loupe offre une protection en plus de l’inspection ; le suivi collant reste
  l’inspection économique. La Coccinelle crée une étincelle ; les autres auxiliaires
  corrigent des faces ou protègent selon des fenêtres différentes.
- Main verte coûte 2 XP pour que son universalité ait une contrepartie.
- Le deck conseillé contient jusqu’à six cartes possédées, couvre plusieurs
  familles de situations et combine préparation et réaction. Le premier choix
  tient compte du budget d’XP donné par la rareté.
- Les Héritages conservent leurs effets distincts et leur permanence.

Les sauvegardes restent lisibles, y compris celles portant le marqueur de travail
`rulesVersion: 2`. Ce marqueur n’active plus de talent. Les parties reprises
conservent leurs XP enregistrés ; les nouvelles cultures utilisent le barème
par rareté. Les corrections des soutiens s’appliquent au catalogue actif.

## Économie et gammes

Tous les montants de jeu s’affichent en euros. Les historiques de prix matériels
étrangers demeurent des références documentaires et ne constituent aucune conversion.
La trésorerie initiale reste à 350 €. Tamis : 550 € ; presse : 850 € ; laveuse :
1 250 €. Les autres prix et les niveaux d’équipement existants sont conservés.

Les conditions de gamme cumulent note, équipement installé, niveau des machines,
réputation et ventes dans la famille. Les paliers exacts sont dans le
[règlement de travail](PLACARD-RULES-DRAFT.md#marché-vivant-et-progression-commerciale).
Signature exige 85 de réputation, douze ventes dans sa famille et des machines
au niveau 9. La première transformation ne demande aucune réputation.

Le Static Sift passe de 120 à 60 € de base par gramme de produit : sa valeur
précédente écrasait les arbitrages. Les transformations déduisent des frais
proportionnels à la matière traitée. Les estimations historiques d’amortissement
restent théoriques ; les offres du comptoir sont les montants effectivement confirmables.

## Marché

Une tendance commune tourne toutes les six heures. La concentration des ventes
agrégées et les ventes répétées du joueur sur 24 heures créent une saturation
plafonnée à 45 : neuf points par vente personnelle de la filière, plus la
concentration des ventes globales (prise en compte à partir de huit ventes).
La qualité fixe la valeur de base et les transformations accessibles. Les six
titres de réputation existants accordent désormais des avantages économiques :

| Réputation | Titre | Bonus de prix avant frais | Saturation atténuée | Garantie |
| ---: | --- | ---: | ---: | --- |
| 0 | Cultivateur novice | +0 % | 0 % | Déstockage |
| 60 | Main sûre | +5 % | 15 % | Déstockage |
| 200 | Artisan du lot | +12 % | 30 % | Déstockage |
| 600 | Signature locale | +20 % | 50 % | Vente au prix du marché |
| 1500 | Maître du Placard | +30 % | 100 % | Prix ambitieux |
| 3000 | Référence du jury | +45 % | 100 % | Prix ambitieux |

Les seuils ont été relevés de 20/60/150/300/600 à 60/200/600/1500/3000 pour
ralentir les promotions sans diminuer les récompenses de chaque bonne vente.
Les gains déjà acquis restent enregistrés ; les titres et avantages sont
recalculés selon les nouveaux seuils. Une ancienne garantie à 300 points ne
s’applique donc plus : elle exige désormais 1 500 points.

Le simulateur `scripts/simulate-placard-reputation.mjs` inclut les gains réels,
les primes de filière et les conditions d’expérience. Il suppose toutes les
machines au niveau 10 dès le départ et choisit le meilleur gain immédiat.
Ce sont des scénarios favorables, pas une mesure du rythme des joueurs :

| Qualité constante | Main sûre | Artisan | Signature locale | Maître | Référence |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 8/10 | 8 ventes | 23 | 80 | 209 | 423 |
| 8,5/10 | 6 ventes | 16 | 56 | 146 | 296 |
| 9/10 | 5 ventes | 13 | 30 | 75 | 150 |
| 10/10 | 4 ventes | 9 | 20 | 43 | 84 |

À 9/10, le prix ambitieux garanti passe de 17 à 75 ventes dans ce scénario.
Un contrôle indépendant maximise les primes sur toutes les transformations,
même non débloquées, et accorde le gain de base maximal à chaque vente : cette
borne très favorable interdit encore la garantie premium pendant les 35
premières ventes et le dernier titre pendant les 70 premières. La simulation
ne représente ni le temps d’acquisition du matériel ni les variations du jury.

Les bonus de demande respectifs sont 0, 8, 18, 28, 40 et 55 points. Les avantages
restent constants entre deux paliers. À partir de 1 500 points, la clientèle fidèle
achète tous les lots admissibles au prix ambitieux ; saturation et tendance
négative ne peuvent plus faire baisser leur tarif. Une tendance favorable conserve
son bonus. Une mauvaise qualité conserve sa moindre valeur et peut coûter de la
réputation : une baisse sous un palier retire ses avantages aux offres suivantes.
Les conditions de qualité, machines et ventes en filière restent nécessaires ; la
biomasse garde son tarif de secours sans bonus.

Calcul de référence : tarif du lot × facteur de marché × (1 + bonus du palier),
puis déduction des frais d’atelier. Le facteur vaut 0,85 + tendance/200 − saturation
atténuée/180, avec un plancher de 0,50, relevé à 0,85 dès 1 500 de réputation. Le choix
de prix ci-dessous s’applique ensuite. Les montants sont arrondis en centimes.
Le calcul et les offres sont produits côté serveur ; le règlement vérifie la
réputation courante. Ces paliers ne nécessitent aucune nouvelle migration SQL.

Trois stratégies affichent le montant et l’acceptation avant engagement :

| Prix | Part de la référence après frais | Conséquence |
| --- | ---: | --- |
| Déstockage | 68 % | Acheteur de reprise assuré si la filière est accessible |
| Marché | 100 % | Selon la demande ; acheteur garanti dès 600 de réputation |
| Ambitieux | 122 % | Selon la demande ; acheteur et prix protégé dès 1 500 de réputation |

Avant ces garanties, les produits faibles ou saturés peuvent être refusés. Le joueur peut baisser le
prix, changer de filière ou conserver son lot. Aucun pourrissement, coût d’attente
ou obligation de se connecter à heure fixe n’a été ajouté. La biomasse garantit
une sortie même sous le seuil de qualité de la fleur. Les transformations et
ventes restent une transaction unique : aucune animation ne vaut une vente avant
acceptation effective de l’offre.

## Validation

- 10 400 cultures déterministes, 100 graines par Buddie et par stratégie.
- Sans soutien : médiane estimée au jury 6,3 ; 69 % des fleurs atteignent 5,8.
- Avec deck conseillé et stratégie simple : médiane 7,3 ; 91 % atteignent 5,8 ;
  26 % atteignent 8. Les moyennes par Buddie vont de 7,20 à 7,31 dans ce scénario.
- 832 parcours complets avec contrôle des sauvegardes et bornes XP/pression.
- Matrice de qualité, réputation, saturation et tendances : aucune monnaie
  invalide, une sortie disponible, aucun acheteur sur une filière verrouillée.
- Paliers et progression : 57 tests ciblés réussis, seuils exacts, prix croissants, garantie
  au prix ambitieux à qualité minimale sur chaque filière et dans les six fenêtres.
- PostgreSQL en mémoire : migrations, prix confirmé, expiration, refus, propriété,
  idempotence, changement de réputation, reprise et synchronisation du catalogue.
  Vente premium saturée à 1 500 points et refus de son ancien devis après rétrogradation.
- Navigateur réel isolé : refus → déstockage → confirmation → reçu, à 320, 390,
  768 et 1 440 pixels, sans débordement horizontal ni erreur JavaScript.
  Paliers affichés et vente au prix ambitieux à 1 500 points validés sur mobile.

La simulation repart d’un inventaire disponible à chaque culture et utilise une
estimation du jury depuis les statistiques. Elle ne simule ni la disponibilité
à long terme des boosters, ni toutes les interactions entre joueurs. Une recette
avec des joueurs devra mesurer les abandons, l’usage de chaque carte, les remises
acceptées et le nombre de cultures pour chaque gamme avant d’affirmer un
équilibrage définitif. Aucun objectif de rétention n’est présenté comme mesuré.

Commandes reproductibles :

```text
npx.cmd vitest run src/lib/kanab-quest src/lib/supabase/kanab-quest src/components/placard
node scripts/test-placard-living-market.mjs
node scripts/simulate-placard-living-market.mjs
node scripts/simulate-placard-reputation.mjs
node scripts/audit-placard-living-market.mjs
npx.cmd tsc --noEmit --pretty false
```

Les scripts SQL utilisent l’installation PGlite locale déjà présente dans
`output/reputation-test-tools`, et le contrôle visuel le navigateur installé.
Les rapports et captures se trouvent dans `output/placard-living-market`.

## Mise en service

Les migrations `20260912000200_kq_living_market.sql` et
`20260912000300_kq_distinct_talents.sql` sont appliquées à la base liée.
La vérification distante confirme une réponse HTTP 200 pour `rpc_kq_market_pulse`
et la présence de `rpc_kq_sell_market_offer`. Une prévisualisation limitée au
Placard confirme qu’aucune de ces deux migrations ne reste en attente.
La migration `20260912000100_arena_customer_reward_standings_snapshot.sql`,
indépendante du Placard, a été exclue de cette opération.
L’ancien endpoint SQL reste compatible avec les devis de l’application précédente ;
il refuse les nouvelles offres, qui exigent les contrôles de prix et d’acheteur
du nouvel endpoint. Les migrations doivent précéder la nouvelle version applicative. Les nouveaux reçus
restent dans les tables existantes et le règlement de l’électricité est conservé.
Les ventes déjà enregistrées ne sont pas recalculées.
