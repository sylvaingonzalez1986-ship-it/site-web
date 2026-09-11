# Facture d’électricité du Placard — réalisation du 11 septembre 2026

Statut : implémenté, compilation de production validée et migration Supabase appliquée.
Migration : `20260911000300_kq_cycle_electricity.sql`.
Les montants sont un barème virtuel de jeu, pas un tarif fournisseur.

## Intention

Faire choisir une installation rentable, plutôt que simplement le plus gros matériel.
Le joueur voit le coût avant de démarrer, reçoit une facture à la récolte et peut la
régler avec sa trésorerie ou avec ses ventes suivantes. Une facture ne doit jamais
empêcher d’utiliser sa Fleur au jury ou de la vendre.

Les puissances nominales du catalogue restent inchangées. Une sollicitation virtuelle
liée au niveau transforme ces puissances en consommation de cycle ; les paiements
débitent le portefeuille du jeu.

## Consommation

Calcul par appareil installé :

`kWh = puissance de base en W × heures équivalentes du cycle / 1 000 × sollicitation du niveau × mode`

- Sollicitation du niveau : `1 + 0,10 × (niveau − 1)` pour les appareils achetés.
- Matériel de départ : coefficient 1.
- Éclairage : 120 heures équivalentes par cycle.
- Extraction, contrôleur et caméra : 180 heures équivalentes par cycle.
- Tente : aucune consommation électrique directe.
- Matériel en réserve : aucune consommation.
- Presse, laveuse, tamis, séparation et lyophilisateur : aucune consommation pendant
  la culture ; leur utilisation au marché relève d’un coût de transformation distinct.
- Tarif d’équilibrage initial : 0,30 $US virtuel par kWh.
- Le solaire réduit l’énergie facturée suivant son bonus existant : 20 % au niveau 1,
  jusqu’à 38 % au niveau 10. Les kWh consommés et la part couverte restent distincts.

Ces heures sont une unité de simulation commune à tous les joueurs. Le temps passé
hors ligne, la vitesse de jeu ou une reconnexion ne changent pas la facture.

Le devis, ses règles et l’installation sont figés au lancement. Retirer un appareil
ou l’améliorer ensuite ne réécrit pas le coût du cycle commencé. Les anciens cycles
ne sont pas facturés rétroactivement.

## Trois réglages avant de démarrer

| Réglage | Consommation | Quantité finale | Pression supplémentaire au départ |
| --- | ---: | ---: | ---: |
| Éco | × 0,75 | × 0,90 | 0 |
| Équilibré, par défaut | × 1 | × 1 | 0 |
| Intensif | × 1,35 | × 1,12 | +1 |

L’intensif échange de la trésorerie et de la sécurité contre davantage de matière.
Le supplément de pression est nécessaire : sans contrepartie sur le déroulement,
le mode offrant davantage de quantité pourrait devenir systématiquement optimal.
Les plafonds habituels de pression, quantité et statistiques restent applicables.

La sélection tient sur trois boutons dans la préparation. Elle affiche immédiatement
le montant prévu et l’effet sur la quantité et la pression. Le choix est verrouillé
pour ce cycle après son lancement.

## Premiers repères calculés depuis le catalogue actuel

Mode équilibré, arrondi au cent une seule fois après calcul :

| Installation | Consommation par cycle | Facture |
| --- | ---: | ---: |
| LED et extraction de départ | 20,10 kWh | 6,03 $US |
| LED, extraction, contrôleur et caméra au niveau 1 | 45,90 kWh | 13,77 $US |
| Même installation au niveau 10 | 87,21 kWh | 26,16 $US |
| Même installation avec solaire niveau 10 | 87,21 kWh, dont 38 % couverts | 16,22 $US |

La facture du kit de départ reste basse par rapport aux 350 $US de trésorerie
initiale. La hausse des niveaux devient néanmoins une dépense répétée visible.
Ces valeurs constituent le point de départ des simulations de rendement et de jury,
pas une garantie de rentabilité pour chaque lot.

## Facture et règlement

À la fin du cycle, une seule facture est créée atomiquement avec la Fleur officielle.
La facture apparaît sur le bilan de récolte et reste accessible dans le tableau de
bord après une reconnexion.

- **Régler maintenant** : paiement intégral si la trésorerie le permet.
- **Régler avec les ventes** : le restant dû est prélevé sur les prochaines ventes,
  dans la limite de 50 % de chaque versement. Le joueur conserve toujours une part
  des recettes. Les factures les plus anciennes sont réglées en premier.
- Le joueur peut solder un reliquat ultérieurement lorsqu’il a assez de trésorerie.
- Aucun intérêt, aucune majoration liée à l’attente et aucun blocage de la réserve,
  du jury ou du lancement d’une nouvelle culture.

Avant chaque vente, le marché distingue le versement brut, le règlement électrique,
le montant réellement encaissé et le solde restant dû. Le reçu conserve ces montants.
L’incident « La facture qui pique » devient « Surcharge au compteur » : une panne
affecte la culture, tandis que la facture financière reste distincte et unique.

## Présentation et intérêt de jeu

Le bilan prend la forme d’un ticket dans la palette crème, turquoise et jaune de
l’arène : consommation, part solaire, montant et tampon « Réglée » après paiement.
Le détail par appareil se déplie à la demande sur smartphone.

Un indicateur `grammes récoltés / kWh consommés` permet de comparer ses propres cycles
et d’afficher un record personnel d’efficacité. Il ne modifie pas les statistiques
de duel. Les coûts de transformation futurs devront rester séparés pour ne pas
fausser cette comparaison entre cultures.

## Points de réalisation et de validation

- Versionner le devis enregistré dans l’état serveur de la culture.
- Clé unique de facture par identifiant de culture ; paiement et vente idempotents.
- Verrouiller le portefeuille et les factures dans un ordre commun aux transactions.
- Aucun montant, niveau ou appareil soumis par le navigateur ne fait autorité.
- Préserver les factures et leurs paiements si un écran de bilan est fermé.
- Vérifier portefeuille vide, paiement manuel concurrent avec une vente, paiement
  rejoué après coupure, plusieurs factures et petits versements avec arrondis.
- Simuler les mêmes graines de parties pour comparer les trois modes, aux niveaux
  1, 5 et 10 : grammes, qualité, revenu brut, énergie et bénéfice net.
- Vérifier les scénarios de mauvaise récolte et de vente en biomasse avant de fixer
  définitivement le tarif : le kit de départ doit rester viable.
- Contrôler l’interface mobile, les contrastes et la réduction des animations.

## Résultats de validation

`node scripts/simulate-placard-electricity.mjs` compare 200 graines identiques par
réglage, sans jouer de cartes : départ et niveaux 1, 5, 10 × trois modes = 2 400 cycles.
Le jury est estimé depuis les statistiques de la Fleur ; les recettes ne préjugent
pas des résultats d’un duel réel. Les investissements initiaux ne sont pas déduits.

| Installation | Mode | Quantité moyenne | Qualité moyenne | Facture | Vente biomasse moins électricité, moyenne |
| --- | --- | ---: | ---: | ---: | ---: |
| Départ | Éco | 69,73 g | 4,76 | 4,52 $US | 16,40 $US |
| Départ | Équilibré | 77,47 g | 4,76 | 6,03 $US | 17,21 $US |
| Départ | Intensif | 83,91 g | 4,26 | 8,14 $US | 17,03 $US |
| Niveau 1 | Éco | 126,65 g | 5,49 | 10,33 $US | 27,66 $US |
| Niveau 1 | Équilibré | 140,72 g | 5,49 | 13,77 $US | 28,45 $US |
| Niveau 1 | Intensif | 152,04 g | 4,89 | 18,59 $US | 27,02 $US |
| Niveau 5 | Éco | 152,21 g | 6,37 | 14,46 $US | 31,20 $US |
| Niveau 5 | Équilibré | 169,12 g | 6,37 | 19,28 $US | 31,46 $US |
| Niveau 5 | Intensif | 182,54 g | 5,71 | 26,03 $US | 28,73 $US |
| Niveau 10 | Éco | 183,75 g | 7,11 | 19,62 $US | 35,51 $US |
| Niveau 10 | Équilibré | 204,16 g | 7,11 | 26,16 $US | 35,09 $US |
| Niveau 10 | Intensif | 219,78 g | 6,35 | 35,32 $US | 30,62 $US |

Aucun cycle de départ ne perd de trésorerie après une vente biomasse dans cet échantillon.
Au niveau 10 intensif, 4 cycles sur 200 perdent de la trésorerie en biomasse : le risque
est assumé et le remboursement plafonné préserve toujours au moins la moitié des recettes.
Le remplacement de la tente de départ préserve maintenant le déblocage de la vente brute.

- `node scripts/test-placard-electricity.mjs` : migration dans PostgreSQL embarqué,
  création unique, exemption des anciennes parties, annulation transactionnelle,
  devis immuable, compte isolé, paiements et ventes rejoués, FIFO, plafond et reliquat.
- `node scripts/audit-placard-electricity.mjs` : vrais composants React, portefeuille
  fictif, 12 vues de 320 à 1 440 px, sélection de mode, manque de trésorerie et reprise réseau.
- `node scripts/audit-placard-electricity-market.mjs` : marché et reçu avec déduction,
  navigation mobile et animations réduites. Aucune écriture en production lors des audits.
- Tests unitaires du calcul, de la sauvegarde, des six étapes et des droits de l’API.

### Périmètre

Cette version facture la culture. Les machines de transformation ne sont pas
facturées pendant qu’elles attendent ; leur éventuel coût à l’utilisation reste
une évolution distincte. Le tarif V1 et sa formule doivent rester compatibles
avec les devis V1 enregistrés si un nouveau barème est introduit.
