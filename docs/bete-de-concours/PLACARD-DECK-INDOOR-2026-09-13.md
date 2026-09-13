# Refonte du deck indoor — 13 septembre 2026

32 cartes actives, chacune avec un effet différent. Les cartes de terreau déjà retirées restent archivées. Six accessoires sont remplacés à code, rareté et quantité possédée identiques. Les bonus d’XP des Buddies restent inchangés : 0 / 1 / 2 / 3 / 4 selon la rareté.

## Remplacements

| Ancienne carte | Nouvelle carte | Rôle dans le jeu |
|---|---|---|
| Pot en tissu | Voile d’ombrage | Protection accessible contre un Danger, contre une hausse de Pression. |
| Testeur pH–EC | Thermomètre infrarouge | Diagnostic du climat ou de l’éclairage ; relance avec remboursement conditionnel. |
| Perlite calibrée | Minuteur recalé | Correction précise et bon marché en Éclairage ou Énergie. |
| Biochar inoculé | Nettoyage du placard | Prévention contre les ravageurs et incidents d’hygiène ; la baisse de Pression exige un Danger. |
| Engrais bio complet | Diagnostic croisé | Convertit deux réussites et un neutre en réussite critique ; ne sauve pas un mauvais jet. |
| Tensiomètre | Réserve d’eau de secours | Réaction d’urgence en Eau ; la Pression peut augmenter la difficulté. |

Toutes les cartes indiquent le coût, le moment de jeu, les situations compatibles, l’effet chiffré et une limite spécifique. Les 32 rectos sont régénérés depuis le même catalogue que le moteur. « Annuler un Danger » ne signifie plus implicitement « obtenir une réussite ». Le 6 est expliqué comme une réussite qui apporte aussi 1 XP au verdict.

La carte Swirskii coûte 1 XP et cible uniquement les dés neutres face aux thrips ; Persimilis conserve le rôle contre les acariens. Le tri par lots et le sécateur propre répondent aussi aux incidents d’hygiène. Les PBI conservent leur réserve, leur identification préalable et leur coût en exemplaires.

## Incidents et variété

Huit situations s’ajoutent aux trente existantes : lampe trop agressive, soufflerie de face, horloge décalée, extraction encrassée, fuite de lumière, dépôt suspect sur les feuilles, fleur suspecte dans le lot, condensation au bocal. Elles ont chacune une illustration carrée dédiée. Les nouveaux thèmes Éclairage et Hygiène sont affichés sur les cartes et les incidents.

Les parties enregistrées conservent leurs codes de situation. Les mêmes codes de cartes restent utilisables avec leurs nouvelles règles ; il n’y a pas de suppression ni de réémission d’exemplaires. Les nouvelles cultures utilisent un tirage déterministe mélangé : l’ancien multiplicateur de 7 aurait figé les étapes contenant sept situations. L’évitement des situations récentes est conservé.

Les incidents restent des abstractions de jeu : dés, Pression, Qualité et XP. Les sources servent à choisir des thèmes cohérents, sans transformer les cartes en recettes horticoles ni promettre qu’un outil garantit la guérison d’une plante.

## Recherche utilisée

- [Forum GrowWeedEasy — What’s going on here?](https://forum.growweedeasy.com/forum/growing-community/588621-what-s-going-on-here) : témoignages et hésitations entre plusieurs causes. Inspiration pour le diagnostic croisé et la soufflerie ; les réponses du forum ne constituent pas une validation technique.
- [Reddit microgrowery — Vent: I can’t overcome powdery mildew](https://www.reddit.com/r/microgrowery/comments/1i7evnv/vent_i_cant_overcome_powdery_mildew/) : difficulté récurrente rapportée par un cultivateur, utilisée comme piste de scénario.
- [University of Maryland — Excess Light on Indoor Plants](https://extension.umd.edu/resource/excess-light-indoor-plants) : excès de lumière et sensibilité de certaines plantes à la durée du jour. Justifie les thèmes Éclairage et rythme lumineux.
- [University of Maryland — Gray Mold or Botrytis Blight on Indoor Plants](https://extension.umd.edu/resource/gray-mold-or-botrytis-blight-indoor-plants) : lien entre humidité, circulation d’air et risque de maladie. Justifie les incidents d’hygiène et de conservation.
- [UC IPM — Thrips](https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/thrips/) : observation, identification, pièges de suivi et auxiliaires ont des rôles distincts. Justifie la distinction Loupe / Plaque de suivi / PBI.
- [UC Agriculture and Natural Resources — Mites, Lygus Bugs](https://ucanr.edu/sites/zalomlab/files/250126.pdf) : mention de Swirskii pour thrips et aleurodes ; suppression de la cible générique « acariens » de cette carte.

## Équilibrage vérifié

Simulation reproductible de 6 000 cultures, réparties en quatre profils de 1 500 parties. La stratégie choisit des préparations par priorité et des corrections déterministes après le lancer, sans regarder les futures relances. Pas de matériel supplémentaire. Ces chiffres comparent des profils de test ; ce ne sont pas des taux garantis pour les joueurs.

| Profil | Qualité moyenne | Qualité concours ≥ 10 | Cartes consommées / culture |
|---|---:|---:|---:|
| Sans cartes, Buddie commun | 5,11 | 11,1 % | 0 |
| Deck commun, Buddie commun | 6,70 | 23,3 % | 4,63 |
| Deck complet, Buddie commun | 7,67 | 33,0 % | 4,17 |
| Deck complet, Buddie légendaire | 7,91 | 36,1 % | 4,43 |

Les cartes communes améliorent les résultats. Une collection complète et un Buddie rare apportent une aide mesurable sans garantir une fleur de concours. Une grosse collection n’est pas un deck optimisé : sa main est davantage diluée. Les huit nouvelles situations sont majoritairement de difficulté 2 ; la refonte n’ajoute pas de pénalité générale de progression.

## Validation et livraison

- 619 tests du Placard passent, dont 216 combinaisons de dés pour Diagnostic croisé, les corrections conditionnelles, la compatibilité des cartes et la distribution des 38 incidents sur 3 000 graines.
- Build de production et lint ciblé réussis ; 207 traces serveur contrôlées, maximum 102,2 Mio. Le build local signale des échecs de rafraîchissement du catalogue public Supabase dans cet environnement réseau, sans échec de compilation ; il ne valide donc pas la fraîcheur des données distantes.
- Migration exécutée sur PostgreSQL embarqué local : 32 définitions mises à jour, propriété et raretés inchangées, transaction refusée si une règle manque.
- Correction annexe révélée par la suite globale : les rejets de limitation de débit de la route missions sont désormais journalisés comme sur les autres routes.
- Affichage du guide réel des cartes contrôlé à 320, 390, 768 et 1440 px, sans débordement ni erreur JavaScript.
- État de livraison : code et assets présents localement ; aucune publication ni migration distante effectuée pour cette refonte.
- Migration distante préparée : `20260913000600_kq_indoor_deck_redesign.sql`. Le dry-run ne sélectionne que ce fichier. La migration de classement `20260912000100` reste exclue.
- Pour publier, déployer les nouveaux assets et le code avant de synchroniser les noms, descriptions et images dans la base partagée. Les anciennes images restent présentes pour les clients en cache.

Commandes : `npx.cmd vitest run src/lib/kanab-quest`, `node scripts/test-placard-indoor-catalog.mjs`, `node scripts/simulate-placard-indoor-deck.mjs`, `node scripts/audit-placard-deck.mjs`, `npm.cmd run build`, `node scripts/check-server-traces.mjs`.

## Images et prompts

Outil intégré imagegen, sans CLI/API externe. Six illustrations enregistrées dans `public/app/kanab-quest/cards/` (`botte-013-voile-ombrage-v1.webp`, `botte-018-thermometre-infrarouge-v1.webp`, `botte-019-minuteur-recale-v1.webp`, `botte-020-nettoyage-placard-v1.webp`, `botte-021-diagnostic-croise-v1.webp`, `botte-024-reserve-eau-secours-v1.webp`). Huit scènes enregistrées dans `public/app/kanab-quest/situations/`, codes SIT-031 à SIT-038, version 1. Les 32 rectos version 4 sont dans `public/app/kanab-quest/card-fronts/`.

Prompts communs : nouvelle illustration pour un jeu fictif de jardinage indoor, bande dessinée rétro, contours noirs épais, papier crème tramé, turquoise et ocre, aucun texte ni personnage. La carte Ventilateur sert de référence de style pour les accessoires et SIT-001 pour les scènes carrées. Sujets des accessoires : voile d’ombrage, thermomètre infrarouge, minuteur mécanique débranché, balai/chiffon/sac de nettoyage, carnet de diagnostic avec loupe, réserve d’eau. Sujets des scènes : pousse sous une lampe trop intense ; feuilles secouées par un ventilateur ; minuteur à vérifier ; extraction poussiéreuse ; lumière passant par une porte ; dépôt blanchâtre sur une feuille ; fleur suspecte isolée au tri ; condensation visible dans un bocal.
