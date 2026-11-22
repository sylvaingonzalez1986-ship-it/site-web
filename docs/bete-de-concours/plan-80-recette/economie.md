# Marge, caisse et capacité de reprise

Décision de cette livraison du 22 novembre 2026. Les gestes de commerce, les devis et les reçus affichent les montants du serveur. Le barème actuel est conservé. Le palier expérimental améliore certaines ventes mais laisse un déficit de 561,43 € sur douze campagnes pour le débutant de la série B, même après avoir amélioré son choix de canal. La marge positive récurrente du parcours de départ reste un critère ouvert.

## Comparaisons appariées A et B

Chaque ligne totalise les marges de douze campagnes après énergie, fournitures, laboratoire, soins et TVA, avant primes, investissement et rémunération du travail personnel. Les politiques de jeu, le jury d’entraînement, la rotation, le délai d’affinage, l’usure et les échéances sont ceux du témoin. Le scénario développé commence avec 5 000 € et quatre variétés. La saisie du modèle permet de continuer en position nette négative. Ce registre mesure aussi la profondeur du déficit. [Hypothèses du témoin](../audit-global-2026-11-22/economie.md) · [Graines et empreintes](series.json)

| Série | Zones | Profil | Témoin (€) | Offres visibles (€) | Palier 1,20 €/g (€) | Trois cartes initiales (€) | Mission réclamée (€ hors prime) |
|---|---:|---|---:|---:|---:|---:|---:|
| A | 1 | Débutant | -458,55 | -32,63 | 62,02 | 196,60 | -32,63 |
| A | 1 | Optimiseur | -76,38 | -76,38 | 18,27 | 157,85 | -76,38 |
| A | 1 | Absent 7 j | -458,55 | -32,63 | 62,02 | 196,60 | -32,63 |
| A | 2 | Débutant | -529,38 | 514,40 | 514,40 | 921,80 | 514,40 |
| A | 2 | Optimiseur | 453,75 | 453,75 | 453,75 | 861,15 | 453,75 |
| A | 2 | Absent 7 j | -743,73 | 192,87 | 300,05 | 600,27 | 192,87 |
| B | 1 | Débutant | -982,78 | -803,53 | -561,43 | -607,65 | -803,53 |
| B | 1 | Optimiseur | -838,15 | -838,15 | -606,05 | -647,65 | -838,15 |
| B | 1 | Absent 7 j | -982,78 | -803,53 | -611,90 | -607,65 | -803,53 |
| B | 2 | Débutant | -1 962,70 | -1 606,53 | -1 001,50 | -1 231,73 | -1 606,53 |
| B | 2 | Optimiseur | -1 725,15 | -1 725,15 | -1 118,10 | -1 341,05 | -1 725,15 |
| B | 2 | Absent 7 j | -2 117,95 | -1 839,40 | -1 253,73 | -1 464,60 | -1 839,40 |

Le témoin débutant vend au grossiste. La politique informée sert le CBD shop lorsqu’il accepte le lot, puis le grossiste pour le solde. Le palier remplace uniquement le prix du grossiste pour la fleur brute de 5,8 à moins de 6,5/10. Les expériences cartes et mission reprennent la politique informée et le prix courant. Une mission effectivement réclamée apporte 50 € à la caisse une seule fois. Les variations dues aux cartes incluent leur consommation. [720 campagnes et comptabilité par cycle](comparaison-ab.json)

## Série C réservée à la validation

| Zones | Profil | Marge sur 12 (€) | Caisse finale (€) | Exigible (€) | Dette totale (€) | Position nette (€) | Stock après vente (€) | Travail total (h) |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Débutant | -112,50 | 550,84 | 175,68 | 450,08 | 100,76 | 0,00 | 77,0 |
| 1 | Optimiseur | -156,23 | 506,48 | 175,05 | 449,45 | 57,03 | 0,00 | 77,5 |
| 1 | Absent 7 j | -112,50 | 276,44 | 175,68 | 175,68 | 100,76 | 0,00 | 77,0 |
| 2 | Débutant | -247,85 | 4 500,98 | 349,86 | 898,66 | 3 602,32 | 0,00 | 113,0 |
| 2 | Optimiseur | -315,45 | 4 432,19 | 348,67 | 897,47 | 3 534,72 | 0,00 | 113,5 |
| 2 | Absent 7 j | -247,85 | 3 952,18 | 349,86 | 349,86 | 3 602,32 | 0,00 | 113,0 |

La caisse inclut les encaissements nets après retenues. La dette totale comprend aussi les factures à venir. La position est la caisse diminuée de cette dette. Le moteur de simulation vérifie pour chaque vente que toutes les unités ont trouvé preneur avant de comptabiliser 0 € de stock. Les six politiques de la série C terminent en perte d’exploitation sur douze campagnes. [72 campagnes de validation](validation-c.json)

## Deux premiers lots faibles et reprise

Sur le départ A, après deux lots, le débutant informé détient 228,89 € en caisse, 104,38 € exigibles et 241,58 € de dette totale. Son stock est vendu et sa position est de −12,69 €. Il lui reste 10,5 h de travail dans la journée simulée. La seule première récolte réclamée porte la position à 37,31 €. Les trois missions acquises dans le scénario récolte → trim → jury créditent 3 × 50 €. La caisse atteint alors 378,89 €, la position 137,31 €. Une relance avec réserve complète de 128,60 € laisse 8,71 € après provision de toutes les factures. Les ventes du profil assidu suivent les six heures d’affinage et le calcul est daté avant la prochaine échéance fournisseur. La recette SQL injecte les soldes du modèle puis réclame ces trois objectifs acquis avec leurs vraies RPC et relit les reçus. Elle couvre une reprise ponctuelle. Les douze campagnes A et B documentent aussi ce qui arrive une fois les primes consommées. [Recette des 302 contrôles de missions](../../../scripts/test-placard-mission-progression.mjs)

## Acheter ou poursuivre avec le même équipement

Calcul supplémentaire sur les campagnes appariées, à barème courant, sans carte ni prime. Changer seulement la lampe puis ajouter un extracteur préserve les graines, le profil et l’album du départ. Pour l’extension, les deux options ont 5 000 € et les quatre mêmes Buddies. La première récupération du surcoût compte le premier cumul de marge supplémentaire atteignant le prix de l’achat. Une perte ultérieure peut effacer ce gain. D est une série complémentaire fixée pour les équipements après C. Elle ne participe pas à la notation de validation C. [Définition des séries](series.json) · [Trésorerie et travail par option](investissements.json)

| Série | Achat face au plan de référence | Surcoût (€) | Marge en plus sur 12 (€) | Variation médiane du travail (h/cycle) | Premier cycle couvrant le surcoût | Marge d’exploitation de la ferme sur 12 (€) |
|---|---|---:|---:|---:|---:|---:|
| A | lampe | 26,41 | 225,48 | 0 | 2 | 149,10 |
| A | extraction avec la lampe | 132,60 | 411,80 | 0,5 | 4 | 560,90 |
| A | seconde zone | 363,09 | 530,13 | 3 | 8 | 453,75 |
| B | lampe | 26,41 | 247,80 | 0 | 2 | -590,35 |
| B | extraction avec la lampe | 132,60 | 153,07 | 0,25 | 11 | -437,28 |
| B | seconde zone | 363,09 | -862,00 | 3 | Au-delà des 12 observés | -1 725,15 |
| D | lampe | 26,41 | 235,97 | 0 | 2 | -372,43 |
| D | extraction avec la lampe | 132,60 | 223,93 | 0,5 | 3 | -148,50 |
| D | seconde zone | 363,09 | -290,45 | 3 | Au-delà des 12 observés | -916,03 |

Pour un lot identique de 100 g à 8/10 et un CBD shop disponible, la fleur brute rapporte 250,00 € après TVA. Le dry-sift rapporte 86,66 € après TVA et préparation pour 0,133 h de travail nominal et 5 040 € de machine. Le rosin rapporte 121,60 € pour 1,333 h et 4 500 €. Sur cet état, la vente brute préserve la caisse et libère du temps. Une autre capacité, réputation ou offre nécessite un nouveau devis. [Détail des offres et capacités](comparaison-ab.json)

Depuis la racine, exécuter `node docs/bete-de-concours/plan-80-recette/simuler.mjs` pour A/B, ajouter `--validation` pour reproduire C ou `--investissements` pour les comparaisons de matériel. Les deux fichiers témoins de l’audit gardent leurs SHA-256 initiaux.
