# Kanab Quest · Plan d’amélioration vers 80/100

**Objectif produit.** Un nouveau joueur doit pouvoir installer sa ferme, semer, expliquer ce qu’il a engagé, choisir comment vendre et reprendre après une mauvaise récolte ou une semaine d’absence. Un joueur avancé doit encore avoir un choix intéressant entre développer la surface, libérer du temps et améliorer la valeur d’un lot. La note cible est **80/100 sur la grille complète**. La référence reste **66/100 provisoires** au 22 novembre 2026. [Audit](rapport.md) · [Protocole de notation](protocole.md)

**Première livraison proposée.** Suivre Loïc depuis « Installer le plan » jusqu’à « Préparer mes cultures » en une action, sur le même écran, puis afficher avant le semis les **128,60 € à prévoir** pour une zone menée à terme. Ce chemin touche l’instant où le joueur vient de dépenser 786,74 € de ses 1 000 €. Il se teste de bout en bout et donne un bénéfice même si le chantier s’arrête après la première livraison.

## Budget de points

La cible de travail est **4/5, « solide et bien maîtrisé », sur chacun des 32 sous-critères**. Sur les 28 déjà évalués, il faut passer de 57,75 à 70 points sur 87,50. Les quatre autres peuvent apporter 10 points sur les 12,50 ouverts si les observations justifient également 4/5. La direction artistique est déjà au niveau visé. L’effort porte d’abord sur les décisions qui coûtent du temps ou de l’argent au joueur.

| Domaine | Acquis / évalués | Gain visé sur le périmètre déjà observé | Points à établir sur le terrain | Cible finale | Preuve déterminante |
|---|---:|---:|---:|---:|---|
| UI et lisibilité | 7,00 / 10 | +1,00 | — | 8 / 10 | Première action visible sur écran court, mêmes unités et montants entre devis et facture. |
| UX, prise en main et accessibilité | 6,75 / 11,25 | +2,25 | 3,00 | 12 / 15 | Un débutant atteint le semis sans intervention du modérateur et reprend après interruption. |
| Graphismes et direction artistique | 8,00 / 10 | 0 | — | 8 / 10 | Vérification visuelle des seuls écrans touchés, de jour et de nuit, avec focus visible. |
| Immersion et retours visuels | 7,00 / 10 | +1,00 | — | 8 / 10 | Après travaux, récolte ou vente, le joueur identifie ce qui vient de changer dans sa ferme. |
| Gameplay et décisions | 9,00 / 11,25 | 0 | 3,00 | 12 / 15 | Pendant plusieurs semaines, des joueurs en exploitation développée réalisent et expliquent différents arbitrages. |
| Cohérence chiffrée et économie | 11,00 / 20 | **+5,00** | — | **16 / 20** | Devis et reçus concordent. Plusieurs stratégies de production ou de vente ont un usage soutenable démontré. |
| Difficulté, progression et rythme | 4,00 / 7,50 | +2,00 | 2,00 | 8 / 10 | Récupération après deux lots faibles et après absence, puis observation du rythme vécu sur trois semaines. |
| Fiabilité et performance | 5,00 / 7,50 | +1,00 | 2,00 | 8 / 10 | Une campagne va jusqu’à la vente sur la version hébergée d’essai et se réconcilie après interruption. |
| **Total** | **57,75 / 87,50** | **+12,25** | **10,00** | **80 / 100** | La nouvelle note est calculée après les essais. |

À titre de sensibilité, si les 28 critères techniques et locaux atteignent la cible et que les quatre nouveaux critères obtiennent chacun 3/5, la note complète est **77,5/100**. Si les observations de terrain manquent, le jalon publiable est **70/87,50**, soit **80/100 provisoires à 87,5 % de couverture**. On conserve dans chaque bilan les notes brutes, le dénominateur et les défauts critiques.

## Travaux et critères de réception

Les charges ci-dessous sont des estimations en jours-personnes, conception, réalisation et recette ciblée comprises. Les seuils d’acceptation proposés orientent le chantier. Ils ne constituent pas des résultats déjà obtenus.

### 1. Mener le premier investissement jusqu’au semis · 3 à 5 jours

**Responsable proposé :** interface du jeu. Peut commencer immédiatement. Couvre UX01–05.

- À la confirmation des travaux, afficher « Préparer mes cultures » pour le plan enregistré. L’activation ouvre le choix de variété et place le focus au bon endroit. Garder « Revoir mon plan » disponible. En cas de refus serveur, préserver le devis et son brouillon.
- Sur écran court, garder « Commencer avec Loïc » et « Jouer librement » visibles ensemble. Dans l’entrepôt vide, rapprocher « Proposer un plan de départ » d’Aménager. Distinguer les six gestes du départ des fiches facultatives du Carnet. Conserver les choix du personnage à la fermeture de l’éditeur jusqu’à abandon explicite.
- **Réception.** Partir d’un compte fictif neuf avec collection vide. Vérifier sur 320 × 540, 320 × 710 et ordinateur au clavier le pack gratuit, le devis, un refus suivi d’un nouvel essai, un seul débit de 786,74 €, puis un accès direct à la variété sans passer par Priorités ou QuizzShow. Fermer le guide, revenir, semer et vérifier l’étape retrouvée. [Captures et chemin actuel](experience.md) · [Recette Loïc](../../../scripts/audit-loic-journey.mjs)

### 2. Donner au joueur le budget complet du lot · 3 à 5 jours

**Responsables proposés :** économie et interface. Peut avancer en parallèle du lot 1. Couvre ECO-01 et la présentation du rendement d’ECO-04.

- Rapprocher, dans le devis et la préparation, le débit immédiat, les charges engagées, les frais conditionnels et leurs échéances. Une ligne « si cette zone va à la récolte » porte les 45 € d’analyse par lot terminé. Identifier les soins facultatifs, les frais liés au canal de vente et la TVA à l’étape pertinente. Réutiliser les valeurs courantes du serveur.
- Pour le premier plan, le joueur doit pouvoir lire **213,26 € en caisse après travaux**, **83,60 € d’énergie et fournitures**, **45 € d’analyse éventuelle** et **84,66 € disponibles après réserve complète**. Employer « potentiel matériel » pour le plan et « récolté » pour le poids constaté. Après vente, montrer le brut, les retenues, le montant reçu et la dette restante, avec accès au reçu.
- **Réception.** Vérifier au centime le chemin devis → semis → facture → vente pour une zone puis trois zones terminées dans la même campagne. Attendre respectivement 45 € et 135 € d’analyses. Tester aussi une campagne interrompue avant récolte, les arrondis de TVA et une ancienne facture sauvegardée. Sur mobile, coût et confirmation restent visibles. [Cycle de référence](economie.md) · [Composant de devis](../../../src/components/placard/KqWarehouseCosts.tsx) · [Factures](../../../src/components/placard/KqTreasuryInvoices.tsx)

### 3. Fiabiliser la campagne complète et ses reprises · 5 à 8 jours

**Responsable proposé :** serveur et données. Commence dès la première semaine. La validation intégrée précède tout changement de barème retenu au lot 4. Couvre TEC-01 et la reprise de TEC-02.

- Actualiser les catalogues des recettes de capacité et de postrécolte. Isoler la cause de `warehouse_condition_invalid` avant de modifier une attente de test. Remplacer l’ancien repère du guide dans la recette 3D. Garder un scénario explicite de compatibilité pour les sauvegardes et factures antérieures.
- Rejouer sur base jetable la chaîne plan → réservation d’intrants → trois zones → récolte → trim → stockage → vente → reçu. Pour une préparation dont la réponse a été perdue, retrouver l’état et l’identifiant d’opération au rechargement. Vérifier également le changement de compte et le résultat d’une commande devenue périmée.
- **Réception.** La chaîne actuelle se termine avec les mêmes masses, stocks, soldes et reçus avant et après reprise. Les suites interrompues lors de l’audit passent sur les versions de données qu’elles annoncent couvrir. Deux sessions normales sur deux connexions à une base PostgreSQL isolée traitent le dernier stock disponible et les écritures concurrentes de plan avec un état final cohérent. Archiver le rapprochement chiffré. [Suites en échec et commandes](fiabilite.md) · [Campagnes multizones](../../../scripts/test-placard-shared-campaigns.mjs)

### 4. Rendre la marge et la récupération jouables · 5 à 9 jours

**Responsable proposé :** game design économique, avec l’appui du serveur. Le simulateur avant changement sert de témoin. Couvre ECO-02 et les décisions d’investissement d’ECO-04.

1. Au commerce, montrer deux offres réellement accessibles pour le lot et leur net après frais. Quand un canal refuse le lot, afficher le motif et la reprise disponible. Avant récolte, présenter des **scénarios** de qualité. Avec les règles auditées et 128,60 € de charges, le point mort est d’environ 73,5 g à 2,10 €/g TTC et 514,4 g à 0,30 €/g TTC. Rendre la prochaine mission déjà gagnée et réclamable visible au moment du besoin.
2. Comparer la règle actuelle, avec cette information améliorée, à une variante comportant un palier intermédiaire autour de 6,5/10. Garder séparés l’effet d’une meilleure information, celui du prix et celui d’une prime de mission. Pour la lampe, l’extension et les machines d’atelier, comparer « acheter » à « continuer avec l’équipement actuel » sur le même lot. Chiffrer marge additionnelle, travail libéré et cycles nécessaires pour récupérer le surcoût.
3. Rejouer les séries A et B de **12 campagnes**, avec les trois profils de l’audit, à une et deux zones. Avant de choisir une variante, réserver une troisième série de graines fixes qui servira uniquement à la validation. Conserver les conditions documentées, puis tester séparément les cartes et les missions effectivement réclamées. Distinguer argent en caisse, factures exigibles, position nette, marge hors primes et valeur du stock.
4. **Décision de réglage.** Sur un départ gratuit et deux premiers lots sous le seuil, exiger une action de reprise visible, finançable avec la caisse et les heures restantes, qui permette de relancer avant la prochaine échéance. Chercher au moins deux choix ayant chacun un avantage mesuré sur un état accessible, par exemple préserver la réserve ou accepter un surcoût pour gagner du temps. Une stratégie d’exploitation courante doit dégager une marge récurrente positive sur la série de validation, hors primes de première fois. Documenter les séries où elle perd, l’ampleur et la récupération. Si l’information suffit, conserver le barème. Si une variante améliore la récupération mais rend systématiquement supérieur un seul canal ou équipement dans les cas comparés, la retravailler avant adoption. [Simulateur](economie.mjs) · [Résultats témoins](economie-resultats.json)

### 5. Faire comprendre les conséquences et préparer le retour · 4 à 7 jours

**Responsable proposé :** interface et game design. Utilise les chiffres du lot 2. Couvre ECO-03, ECO-05 et les deux critères d’immersion à relever.

- Après travaux, renvoyer à la zone installée. Après récolte, relier le poids obtenu au potentiel et à la première cause chiffrée d’écart disponible dans l’état du jeu. Après vente, relier le lot vendu au reçu et aux factures réglées. Donner à Loïc un retour court portant sur cette action. Réserver le détail du calcul à une ouverture volontaire.
- Au retour, indiquer ce qui a réellement évolué depuis la visite précédente, la culture qui attend un geste, les factures échues et le lot dont la valeur peut changer. Si l’état antérieur n’est pas connu, afficher la situation actuelle avec son échéance. À la deuxième zone, prévoir la rotation suivante selon les Buddies possédés et permettre de préparer seulement la zone disponible.
- **Réception.** Sur le même état, comparer un retour le lendemain et à J+7. Les projections affichées correspondent aux échéances serveur et mènent à l’action utile. Avec trois Buddies, on voit avant de s’engager pourquoi les deux zones ne pourront pas enchaîner ensemble. Avec quatre, on peut préparer la rotation complète du cas de référence. Tester au clavier et au toucher. Préserver les pancartes, le papier, les illustrations et le repli sans WebGL déjà réussis. [Profils de retour et rotation](economie.md) · [Parcours du Quartier](experience.md)

### 6. Mesurer et corriger les lenteurs sur appareil réel · 3 à 6 jours

**Responsable proposé :** technique frontend. Mesures initiales dès la semaine 1, recette finale après intégration des lots 1, 2 et 5. Couvre le volet performance de TEC-02.

- Mesurer une version de production hébergée d’essai avec comptes synthétiques, sur un téléphone Android de milieu de gamme, un iPhone et un ordinateur de référence. Consigner appareils, navigateurs, réseau, version, densité de pixels et état des données. Couvrir village → entrepôt, confirmation du plan, ouverture d’un article QuizzShow et retour à une ferme développée.
- Séparer délai avant premier contrôle utilisable, retour visuel au toucher, délai de confirmation serveur et fluidité de la scène. Utiliser les seuils Lighthouse déjà définis au dépôt pour le HUD, le catalogue et le marché, dont LCP ≤ 4 s et CLS ≤ 0,1. Pour le village, viser à titre de cible interne une médiane d’au moins 30 images/s pendant un déplacement sur le téléphone de référence. Mesurer en plusieurs passages à froid et à chaud. Le repli HTML doit conserver les actions principales.
- **Réception.** Archiver les mesures avant/après par appareil avec les erreurs et le résultat des gestes. Corriger d’abord le ralentissement qui retarde le plus la première action. Tester le chemin hébergé connecté jusqu’au reçu puis après reconnexion. Le dossier d’audit indique pourquoi le bootstrap réclame une **base et une application isolées** pour ces essais. [Mesures de départ et budget de performance](fiabilite.md)

### 7. Aligner classement, lots et remise · 3 à 6 jours

**Responsables proposés :** produit et serveur. Ouvrir ce chantier en parallèle. L’arbitrage s’impose avant la prochaine attribution réelle, quelle que soit la note globale. Couvre LOT-01.

- Identifier la règle effectivement applicable à la saison et les engagements déjà présentés aux joueurs. Trancher les rangs éligibles, le partage des ex æquo, les parts vacantes et la remise du lot. À partir de la décision, aligner l’aperçu joueur, la clôture, les reçus et le mode de remise. Préciser les effets du don, de la commande créditant le jeu et de la dégustation donnant des points.
- **Réception.** Sur une saison fictive, rapprocher gramme par gramme le budget, les parts, les reports et les reçus. Couvrir trois ex æquo dont un inéligible, un seul éligible et aucun éligible. Jouer le parcours d’un gagnant jusqu’au mode de remise prévu, y compris après interruption. Vérifier que la même clôture produit le même décompte et que les engagements historiques sont respectés. [Écart documenté](rapport.md) · [Décisions saisonnières](../reglement-saisonnier-mise-en-oeuvre.md)

### 8. Établir les quatre notes encore ouvertes · 4 à 6 jours répartis sur trois semaines

**Responsables proposés :** recherche joueur et QA. Préparer les participants et les comptes dès la première semaine. Démarrer les observations sur une version identifiée intégrant le premier parcours et la lecture des coûts.

| Question à trancher | Protocole proposé | Signal de réception proposé |
|---|---|---|
| Un débutant joue-t-il seul ? | Huit personnes découvrant le jeu, réparties entre mobile et ordinateur. Du personnage au semis, puis du lot prêt à la vente sur une sauvegarde dédiée. Introduire une interruption. Noter aide demandée, détours, temps actif et mots utilisés pour expliquer les frais. | Au moins 6 sur 8 sèment, reprennent et trouvent un débouché sans indice du modérateur, et au moins 6 sur 8 distinguent encaisse, charges et frais d’analyse. Rejouer toute difficulté bloquante récurrente après correction. |
| Les décisions avancées gardent-elles un intérêt ? | Suivre sur trois semaines un petit groupe proposé de 4 à 6 joueurs avec une ferme développée. Relever les décisions réellement prises et ce qu’ils y gagnent ou y sacrifient. | Observer au moins deux stratégies viables et des décisions renouvelées au fil de plusieurs visites. Documenter aussi les joueurs qui répètent un geste faute d’alternative. Un témoignage isolé ne suffit pas pour attribuer 4/5. |
| Que devient le rythme avec une absence ? | Inclure dans le suivi des participants revenant à J+7. Comparer ce qu’ils pensent avoir perdu, ce que le journal constate et l’action qu’ils choisissent ensuite. Conserver également les parcours abandonnés et les motifs connus. | Les revenants retrouvent l’étape utile, expliquent l’échéance passée et peuvent reprendre avec les moyens affichés. Rapporter le nombre de cas observés et les exceptions. |
| Le service hébergé tient-il ? | Sur la même version, effectuer le parcours du lot 6 avec authentification, données et reçus réels de l’environnement d’essai. Tester rechargement et reconnexion sur appareils physiques. | Budget de performance vérifié, fin du parcours et soldes réconciliés sur chaque configuration annoncée. Les contextes inaccessibles restent identifiés dans la couverture. |

Utiliser le registre d’observation du projet. Une hypothèse de lassitude ou une cadence observée sur un petit groupe ne donne pas un taux de rétention général. Si le terrain révèle un parcours bloqué ou une stratégie de récupération incompréhensible, corriger ce parcours puis le refaire avec de nouveaux participants. [Registre existant](../observations-debutants.csv) · [Sous-critères humains](protocole.md)

## Ordre de livraison et suivi

| Jalon | Quand, à titre indicatif | Décision de sortie |
|---|---|---|
| Premier semis et budget | Semaines 1–2 | Livrer ensemble les lots 1 et 2. En parallèle, démarrer le lot 3, relever les performances initiales et ouvrir la décision sur les lots réels. |
| Première boucle vérifiée | Semaines 2–4 | Achever la campagne du lot 3. Comparer les variantes du lot 4 et sélectionner le réglage seulement après les mesures. Intégrer les retours d’action et de reprise du lot 5. |
| Bêta observée | Semaines 4–7 | Stabiliser la version candidate, réaliser les essais hébergés et suivre les joueurs trois semaines. Si un défaut matériel impose une nouvelle version, tracer les deux versions et refaire les tâches touchées. |
| Nouvelle notation | Fin du suivi, environ semaines 6–8 selon disponibilité | Reprendre les 32 sous-critères, lier une preuve à chaque note, recalculer points et couverture et publier les écarts à la cible. Traiter séparément toute perte de données, récompense erronée ou progression bloquée. |

**Charge indicative totale : 30 à 52 jours-personnes.** L’horizon de six à huit semaines suppose deux contributeurs disponibles en parallèle, un interlocuteur produit pour l’équilibrage et les lots, des appareils d’essai et un recrutement engagé tôt. Le coût du suivi inclut la préparation et l’analyse, avec trois semaines de temps calendaire. Une modification profonde du mode de remise ou un besoin d’infrastructure supplémentaire ferait réestimer le lot concerné.

À chaque livraison, mettre à jour le point de reprise avec la version, le scénario exécuté, le résultat, le défaut restant et le prochain lot borné. Le **premier ticket prêt à réaliser** est la transition « Installer le plan → Préparer mes cultures » avec conservation du brouillon sur erreur, focus sur la prochaine commande et recette directe à 320 et 1 440 px.
