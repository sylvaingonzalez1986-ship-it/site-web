# Règlement saisonnier : décisions et concordance avant publication

9 novembre 2026 — note interne accompagnant le [règlement QRT-REG-1](projet-reglement-saisonnier.md). Ne pas afficher cette note dans le parcours joueur.

## Ce qui est confirmé

L'utilisateur demande un classement doté où les achats permettent des avis validés, donnant des points de dégustation intégrés au classement des gains. Ne pas supprimer ou neutraliser cette contribution et ne pas remplacer le classement par un tirage général.

La dotation de base est de 100 g au total par saison, augmentée selon les ventes de fleurs Concours ; le lancer de dé est conservé. Après correction explicite de l'utilisateur, la bêta commence dimanche prochain, soit le 15 novembre 2026, et se termine au 1er janvier 2027. Les saisons suivantes sont trimestrielles. L'interprétation retenue est une bascule à 00 h Europe/Paris, sans chevauchement.

| Saison | Début inclus Europe/Paris | Fin exclue Europe/Paris | Instants UTC correspondants |
| --- | --- | --- | --- |
| Bêta 2026 | 15/11/2026 00:00 | 01/01/2027 00:00 | 2026-11-14T23:00:00Z → 2026-12-31T23:00:00Z |
| 2027 T1 | 01/01/2027 00:00 | 01/04/2027 00:00 | 2026-12-31T23:00:00Z → 2027-03-31T22:00:00Z |
| 2027 T2 | 01/04/2027 00:00 | 01/07/2027 00:00 | 2027-03-31T22:00:00Z → 2027-06-30T22:00:00Z |
| 2027 T3 | 01/07/2027 00:00 | 01/10/2027 00:00 | 2027-06-30T22:00:00Z → 2027-09-30T22:00:00Z |
| 2027 T4 | 01/10/2027 00:00 | 01/01/2028 00:00 | 2027-09-30T22:00:00Z → 2027-12-31T23:00:00Z |

Les dates ne sont pas une preuve que les saisons existent déjà dans la base. Aucun identifiant technique de saison n'a été inventé ou écrit en production.

## Choix de rédaction complétés

Ces modalités concrétisent la demande « go complete ». Elles ne sont pas présentées comme des faits déjà configurés :

- France métropolitaine, Corse comprise ; majeurs ; exclusions des personnes ayant un rôle privilégié dans l'organisation et de leur foyer.
- Taux de dé existants 1/4/7/10 %, appliqués aux grammes Concours, avec socle de 100 g ajouté une seule fois.
- Barème de classement v3 conservé : 100 points par produit fleur distinct avec avis admissible ; composantes Duels et Gestion détaillées dans l'annexe A.
- Éligibilité actuelle de référence : trois duels humains ou une fleur avec avis admissible. Filtrer les inéligibles avant d'établir les rangs d'attribution ; l'affichage doit distinguer rang général et rang pour les lots.
- Top 10 et Fleur Surprise conservés avec les parts 27/18/13,5/6,75/6,75/3,6/3,6/3,6/3,6/3,6/10 %. Réaffecter les parts vacantes et la Surprise sans candidat aux parts du classement, proportionnellement. Partager les ex æquo avant l'arrondi final par bénéficiaire.
- Report explicite des fractions de gramme, des dotations sans éligible et des lots non réclamés, toujours en supplément des 100 g de la saison suivante. Les réserves doivent rester traçables et ne pas être comptées deux fois.
- Achats créés et payés avant dépôt d'avis et dans la saison ; avis déposé avant clôture. Ce resserrement doit être visible avant achat et ne pas s'appliquer rétroactivement à des droits déjà promis.
- Avis contrôlés dans les sept jours, publication provisoire après revue de clôture, sept jours de réclamation à compter de cette publication, résultat définitif au plus tard vingt et un jours après clôture. Réexamen humain et droits légaux conservés.
- Notification dans les sept jours après résultats ; trente jours pour répondre, relances à quinze et trente jours, dernière grâce de quinze jours ; expédition dans les trente jours après dossier complet. Sans commande ni frais imposés.
- Durées de données définies par finalité : opérationnel saison jusqu'à trois mois après remise, preuves restreintes cinq ans, journaux six mois, copies d'identité exceptionnelles trente jours après vérification, classement public un an, avis publics cinq ans maximum. Ce sont des durées de politique proposées dans la rédaction, pas des durées légales universelles ni une preuve de purge existante.

## Nouvelle demande sur la réclamation du lot

Après la rédaction, l'utilisateur demande que le gagnant passe une commande sans minimum pour réclamer son lot, en faisant valoir la gratuité du jeu. Cette demande remplace l'hypothèse selon laquelle la remise sans commande serait une préférence approuvée par l'utilisateur. Elle est enregistrée comme une modalité souhaitée, pas comme une conformité établie.

Si la commande exige l'achat d'un article, même de faible montant, la prise de possession du gain est conditionnée à une dépense. La gratuité de participation et l'absence de montant minimal ne suppriment pas cette dépense. L'article L. 121-7, 7° vise le coût imposé pour demander un prix annoncé comme gagné. La CJUE précise que son faible montant et l'absence de bénéfice du professionnel ne rendent pas cette pratique admissible ; annoncer les conditions à l'avance ne suffit pas non plus. Sources vérifiées le 9 novembre 2026 : [L. 121-7, 7°](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227282), [CJUE, C-428/11, points 49 à 57 et dispositif](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62011CJ0428).

Alternative concrète proposée, sans la présenter comme un choix déjà accepté : conserver un parcours de commande logistique permettant de commander le lot seul à 0 €, port et traitement inclus. Un achat supplémentaire doit relever d'une décision indépendante, sans conditionner la remise ni créer des frais pour obtenir le lot. Une simple option gratuite ajoutée à plusieurs méthodes payantes pour réclamer le gain ne suffit pas à neutraliser ces dernières selon le même arrêt.

Proposition de clause alternative : « Le gagnant réclame son lot depuis son espace au moyen d'une commande de remise. Cette commande peut contenir uniquement le lot gagné, pour un total de 0 €, frais de port et de traitement compris. Aucun autre article ni paiement n'est nécessaire pour obtenir le lot. »

La commande payante obligatoire n'est pas intégrée comme règle validée à l'article 10. Le règlement de travail conserve la remise gratuite recommandée, avec un avertissement de statut en tête ; le choix de remise reste à résoudre avant publication. Aucun code de commande ou paiement n'a été modifié.

## Mention factuelle non résolue

**Médiateur de la consommation : aucun organisme conventionné identifié.** Le dépôt et les pages publiques consultées ne donnent pas de nom. Une recherche ciblée dans la messagerie connectée n'a pas établi de convention ; aucune pièce d'identité ou pièce jointe sans rapport n'a été ouverte. L'utilisateur a répondu sur les dates mais n'a pas encore renseigné le médiateur. Cette absence de preuve ne permet pas de conclure qu'aucun contrat n'existe.

Il faut obtenir le nom exact, l'adresse postale et le site du médiateur compétent, ainsi que la confirmation de l'adhésion ou convention. Aucun message n'a été envoyé, aucune convention souscrite et aucun organisme choisi au nom de l'utilisateur. Un lien vers une liste de médiateurs ne remplace pas ces coordonnées. La DGCCRF précise qu'on ne peut pas déclarer un médiateur de sa seule initiative sans convention ou rattachement adapté : [choix du médiateur](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/choisir-un-mediateur-de-la-consommation), [obligations d'information](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0).

L'article 13 signale honnêtement cette information manquante. Ne pas qualifier le texte de « prêt à publier » avant de la renseigner et de vérifier la concordance opérationnelle.

## Écarts du code à traiter

| Sujet | État observé | Travail avant application du nouveau texte |
| --- | --- | --- |
| Dotation | Toutes fleurs ; pas de socle 100 g | Ajouter le socle une seule fois, limiter le bonus aux références Concours historisées, appliquer les taux et tracer reports/ajustements. |
| Retours | Les semaines peuvent être figées sans registre complet des quantités nettes retournées | Fixer le délai de validation, déduire les grammes remboursés avant validation et faire supporter les retours ultérieurs à l'organisateur. |
| Autres avantages d'achat | Monnaie de commande, cartes et packs ; synchronisations encore présentes | Mettre la compétition en accord avec le choix « avantage d'achat : dégustation seulement ». Ne pas affirmer que l'absence d'un crédit direct de points supprime les effets indirects. Définir un traitement prospectif des ressources et des résultats, en préservant les reçus et droits existants. |
| Avis | Date de dépôt dans la saison ; paiement pouvant être postérieur à la clôture s'il précède l'approbation | Exiger les bornes publiées de création/paiement/dépôt ; contrôler partiellement remboursé, produits distincts et fin de modération ; indiquer la contrepartie en points dans le formulaire et les avis publics. |
| Classement | Données courantes ; certaines lectures après clôture pourraient inclure des événements ultérieurs | Figer à la clôture les points humains, la réputation et les autres entrées ; appliquer ensuite seulement les corrections admissibles d'avis/preuves. |
| Gestion | Fenêtre 720 h pouvant précéder saison, réputation permanente, ventes HT du jeu saisonnières | Conserver ces distinctions de l'annexe, ne pas réinitialiser implicitement la ferme ou confondre argent fictif et chiffre d'affaires réel. |
| Éligibilité et répartition | Parts des inéligibles non distribuées ; pas de réaffectation complète | Mettre en œuvre le filtrage, la normalisation des parts, les ex æquo de frontière, l'arrondi par bénéficiaire et la Surprise avec 1/N. Même calcul en serveur, contrôle SQL et présentation. |
| Clôture | Ancien helper remplace la date de fin par l'heure de gel | Ne jamais déplacer l'échéance publiée lors d'une modération, d'un gel tardif ou d'un réessai ; séparer fin de participation, vérification et attribution. |
| Remise | Cadeau réclamé dans une nouvelle commande payante | Créer une remise autonome sans achat ni port imposé, suivre notification/relances/expédition ; aucune réservation en double entre remise autonome et commande facultative. |
| Reports | Reliquat calculé mais report intersaison complet non établi | Registre de grammes à origine et destination uniques ; réserver les lots non réclamés, afficher le solde, appliquer le report en plus du nouveau socle. |
| Ouverture | Dossier ancien à quatre paliers et code de saison KQ-2026-S1 | Faire correspondre calendrier bêta/trimestres, lots, territoire, formule et version du règlement. Ne pas seulement activer un drapeau de validation. |
| Données et publication | Purges, consentement à la version et information des avis non vérifiés | Enregistrer version acceptée et preuve, appliquer les durées par finalité, limiter les justificatifs et prévoir un réexamen humain ; mettre à jour la notice publique. |

Le changement de calendrier ne doit pas effacer les engagements éventuels de la période antérieure au 15 novembre. L'état déployé et les engagements aux participants restent à examiner avant migration ; aucune inspection des données privées de production n'a été réalisée ici.

## Vérifications de mise en œuvre à prévoir

Dotation : 0 vente donne 100 g ; recalcul et rejeu n'ajoutent pas le socle ; Regular/cadeaux inconnus ne deviennent pas Concours ; retours partiels ; validation hebdomadaire ; report sans double crédit. Dates : bornes exclusives, dimanche d'ouverture, semaines partielles, changement d'heure et photographie réelle de clôture.

Classement : conserver les 100 points d'une fleur admissible avec avis, sans points pour l'achat seul, sans multiplication par quantité ni note positive ; avis de fin de saison ; duels humains avec défis et exclusion bots ; trois logarithmes de Gestion arrondis séparément ; ex æquo à la dixième place et joueurs non éligibles.

Attribution/remise : 100 % des grammes entiers affectés dès qu'il existe un éligible ; aucun candidat Surprise ; un seul participant ; nombreux ex æquo ; lot nul après arrondi ; reprise après réponse perdue ; un seul reçu par attribution ; aucune exigence de commande ou paiement pour recevoir ; report des non-réclamés sans perdre le droit d'un gagnant déjà confirmé.

Les contrôles métier seront exécutés lors des changements applicatifs. Les migrations devront déclarer les permissions explicites de chaque nouvel objet et passer le contrôle existant des grants. Aucun test applicatif, migration ou paiement n'est déclenché pour la rédaction seule.

Vérifications réalisées sur la rédaction : relecture indépendante du barème et de la cohérence du texte ; publication provisoire explicitement bornée à J+7 ; convention d'arrondi commune aux entiers, dixièmes et centièmes. Somme des parts égale à 100 %, allocation d'exemple égale à 100 g, exemples Duels 20/5 et Gestion 90 vérifiés. Les six bornes UTC de la table donnent bien minuit en Europe/Paris, y compris les changements d'heure, et le 15 novembre 2026 est un dimanche. Les trois documents, leurs liens locaux, l'absence de champs génériques à compléter et le JSON de reprise ont été contrôlés. La mention non résolue du médiateur est volontairement conservée.

## Sources complémentaires du texte

Le maintien du lien achat → avis → classement doté appelle une analyse de l'opération promotionnelle et de sa loyauté. Une obligation d'achat n'est pas interdite en toute circonstance ; elle n'autorise pas pour autant un accès au hasard vendu sous couvert de produit. Le règlement ne certifie pas cette qualification : [DGCCRF, fiche loteries du 11 mars 2026](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/loterie-des-pratiques-commerciales-reglementees).

L'information sur les avis doit expliciter la contrepartie, les contrôles, dates, refus, modifications et délais. Une note positive n'est pas une condition aux points : [information des consommateurs sur les avis](https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/peut-faire-confiance-aux-avis-en-ligne), [article D. 111-17](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035724934/2025-05-22).

Les durées de données doivent correspondre aux finalités et aux opérations réellement mises en œuvre ; les règles des opérateurs de jeux d'argent agréés ne sont pas transposées automatiquement à cette promotion : [CNIL, durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees). Pour la conformité des fleurs et leur présentation, voir le [dossier MILDECA actualisé au 30 octobre 2026](https://www.drogues.gouv.fr/en-matiere-de-cbd).
