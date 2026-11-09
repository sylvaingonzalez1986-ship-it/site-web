# Jeu du Quartier : règlement et dotation en fleurs

Analyse du 9 novembre 2026, mise à jour après arbitrage utilisateur. Décisions confirmées : **100 g au total à partager par saison**, auxquels s'ajoute une contribution liée aux ventes de fleurs Concours ; conserver le lancer de dé et **un classement doté incluant les points de dégustation**. L'achat permet de déposer des avis admissibles ; leur validation rapporte des points et peut améliorer le rang donnant droit aux fleurs. L'utilisateur veut réserver l'avantage d'achat à cette contribution dégustation. À la demande « go complete », les modalités sont désormais rédigées dans le [règlement QRT-REG-1](projet-reglement-saisonnier.md) ; les choix de rédaction et les écarts techniques sont dans la [note de mise en œuvre](reglement-saisonnier-mise-en-oeuvre.md).

Calendrier corrigé expressément par l'utilisateur : **bêta du dimanche 15 novembre 2026 à 00 h au 1er janvier 2027 à 00 h exclu**, puis saisons trimestrielles dès le 1er janvier 2027, heure de Paris. L'ancienne hypothèse d'une bêta commençant le 1er janvier est abandonnée. Aucun calendrier de production n'a été modifié.

Périmètre : lecture ciblée du dépôt et du règlement public, recherche auprès de sources officielles françaises. Aucun accès aux données privées de production, changement du jeu, attribution, migration ou publication. La configuration réellement active et les engagements déjà pris envers les joueurs restent à vérifier avant une transition.

## Conclusion

Il faut préparer un règlement propre aux gains saisonniers, accessible avant la participation, et mettre le fonctionnement en accord avec ce texte. Le règlement public actuel décrit surtout le Booster Pack. Écrire un règlement ne suffit pas à rendre une mécanique licite : les achats influencent aujourd'hui les résultats et la récupération des fleurs passe par une nouvelle commande.

Le modèle retenu conserve le dé collectif gratuit, le classement doté et la contribution dégustation issue d'achats suivis d'avis validés. La dotation proposée est **100 g + bonus calculé sur les grammes de fleurs Concours vendus**. L'avantage de classement lié à la dégustation est intentionnel : il ne faut ni le neutraliser, ni écrire que les achats n'influencent pas les gains. Le projet doit être examiné comme une opération promotionnelle comportant cet avantage. La remise sans achat supplémentaire ni coût imposé reste recommandée. La qualification de l'opération et des fleurs offertes mérite une relecture par un juriste connaissant ces deux sujets avant lancement ; cette analyse n'est pas une attestation de conformité.

## Ce que fait actuellement le jeu

Les références suivantes décrivent le code local et les migrations, pas une inspection de l'état de la base déployée.

| Sujet | Constat vérifié | Référence dans le dépôt |
| --- | --- | --- |
| Socle garanti | Aucun socle de 100 g dans le calcul identifié. Contributions hebdomadaires + ajustements administratifs. | `supabase/migrations/20260826000200_arena_customer_reward_weekly_dice.sql:179` |
| Ventes retenues | Toutes les lignes de catégorie `fleurs`, payantes, de poids connu, sur commandes payées non annulées/non archivées ; aucun filtre Concours. | Même migration, ligne 121 |
| Dé collectif | Un lancer serveur par compte et semaine, calendrier Europe/Paris. Profil de joueur requis ; aucun achat ni minimum de duels pour lancer. Moyenne collective donnant 1 %, 4 %, 7 % ou 10 %. | Même migration, lignes 35 et 261 ; `src/lib/arena-customer-rewards.ts:7` |
| Classement des gains | 100 points par fleur distincte achetée avec avis validé, plus points de duels transformés et score commercial. | `src/lib/arena-ranking.ts:25` ; `supabase/migrations/20261018000300_arena_tasting_first_rankings.sql:57` |
| Éligibilité aux lots | Trois duels humains OU une fleur achetée avec avis validé dans la formule actuelle. Cette condition ne concerne pas le lancer collectif. | `src/lib/arena-customer-rewards.ts:116` |
| Avantages des commandes | 10 euros fictifs par euro réel de produits après remises, hors port. Les achats peuvent aussi apporter des cartes et packs ayant des effets de jeu. | `supabase/migrations/20260927000500_kq_order_cash_rewards.sql:72` ; `supabase/migrations/20261003000200_contest_bundle_cumulative_rewards.sql:128` ; `src/lib/kanab-quest-game.ts:318` |
| Répartition | 90 % aux places du Top 10 et 10 % à une Fleur Surprise tirée parmi les éligibles hors Top 10. Égalités et arrondis traités ; certaines parts peuvent rester non attribuées. | `src/lib/arena-customer-rewards.ts:34` et `:145` |
| Clôture | Gel des semaines et du classement, puis attribution distincte. Le helper historique remplace la date de fin par l'heure d'exécution. | `supabase/migrations/20260826000100_arena_customer_reward_pool.sql:334` ; `supabase/migrations/20260912000100_arena_customer_reward_standings_snapshot.sql:7` |
| Remise | Bons de grammes ajoutés à une commande ; panier marchand positif exigé, cadeau sans réduction de ce panier, livraison calculée normalement. Aucun parcours de remise seule identifié. | `src/app/api/checkout/viva/route.ts:572`, `:756`, `:818` |
| Texte et ouverture | Règlement Booster Pack et ancien brouillon à quatre paliers, décalés du Top 10 + Surprise actuel. Le dossier d'ouverture ne contrôle pas la cohérence juridique du texte. | `src/app/reglement-jeu-promo/page.tsx:29` ; `docs/bete-de-concours/PLACARD-RULES-DRAFT.md:947` ; `src/lib/kanab-quest-launch-approvals.ts:34` |

L'accès gratuit existe, notamment avec les packs de départ. Cela ne supprime pas les avantages directs et indirects d'achat. Les points de dégustation sont conservés à la demande de l'utilisateur. En revanche, la règle cible « seul avantage d'achat : dégustation » n'est pas encore une description exacte de tous les mécanismes du dépôt : monnaie de commande et cartes issues des achats sont aussi prévues, avec synchronisation dans `src/lib/supabase/kanab-quest-bootstrap-rewards.ts:8`. Leur traitement prospectif doit être mis en accord avec le règlement sans supprimer arbitrairement les récompenses déjà acquises.

La [page publique consultée](https://www.leschanvriersbretons.com/reglement-jeu-promo) mentionne une commande payée pour les Booster Packs et une récompense légendaire en bons d'achat. Elle ne définit ni les saisons, ni cette dotation, ni le dé collectif. Il faut distinguer ces opérations et préserver les droits antérieurement acquis.

## Cadre français à prendre en compte

Une offre au public, un gain espéré, une part de hasard et un sacrifice financier constituent les quatre critères des jeux d'argent et de hasard. Des fleurs réelles constituent un gain en nature ; le caractère stratégique du jeu et l'absence de conversion en argent ne règlent pas la question. Le financement d'une dotation par le chiffre d'affaires de l'organisateur ne signifie pas, à lui seul, que le joueur mise de l'argent. Le lien entre paiement et participation ou chances doit être examiné. Sources : [article L. 320-1 du CSI](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039182525) et [ANJ, porteurs de projet](https://anj.fr/professionnels/porteur-de-projet).

Une exception existe pour les opérations publicitaires. Une obligation d'achat n'est pas systématiquement interdite : l'achat doit porter sur le produit ou service et non sur l'accès au jeu ; l'opération ne doit pas être déloyale. On ne peut donc conclure ni « achat = toujours illégal », ni « accès gratuit = automatiquement conforme ». Les avantages d'achat observés justifient une analyse spécifique si on les conserve dans la compétition dotée. Sources : [DGCCRF, fiche du 11 mars 2026](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/loterie-des-pratiques-commerciales-reglementees), [L. 320-6, 7°](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039169738/2026-09-22) et [L. 121-20](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227240/2025-12-04).

Un règlement écrit précis est fortement recommandé pour informer les participants et prouver les engagements. Il ne faut pas présenter comme une obligation générale actuelle l'ancienne procédure de dépôt chez un huissier : l'ancien article L. 121-38 a été abrogé en 2014. Un dépôt volontaire peut aider à dater et prouver les règles, sans homologuer le jeu. Source : [ancien dispositif et abrogation par l'article 54 de la loi du 20 décembre 2014](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000006133621/2014-10-03/).

La remise des gains est un point prioritaire. Faire supporter un coût pour réclamer un prix présenté comme gagné peut relever d'une pratique agressive. Prévoir une expédition du lot prise en charge par l'organisateur, indépendamment du panier marchand, évite ce problème dans le modèle recommandé. Source : [Code de la consommation, L. 121-7, 7°](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032227282/2026-02-25).

Les lots doivent être des fleurs de chanvre commercialisables, avec origine et conformité vérifiables, teneur en THC conforme et absence de substances interdites. Le seuil de 0,3 % n'est pas une autorisation universelle : les règles dépendent aussi de l'usage et de la présentation. Pour des produits susceptibles d'être fumés, vérifier déclaration, emballage et avertissements ; ne pas les présenter comme des aliments ou leur attribuer des effets thérapeutiques. Retenir les majeurs comme condition explicite du jeu et un territoire de livraison défini. Ces recommandations ne constituent pas une validation des lots existants. Source : [MILDECA, état du droit de septembre 2026, pages 2 à 9](https://www.drogues.gouv.fr/sites/default/files/2026-09/Ce%20que%20dit%20la%20loi%20CBD_sept_2026_0.pdf), [page actualisée le 30 octobre 2026](https://www.drogues.gouv.fr/en-matiere-de-cbd).

L'acceptation du règlement doit rester distincte de la prospection commerciale. Informer sur les données nécessaires, leur conservation, les destinataires et les droits ; publier les gagnants sous pseudonyme et protéger leurs coordonnées de livraison. Source : [CNIL, jeux concours](https://www.cnil.fr/sites/default/files/atoms/files/commerce-donnees_perso_parrainage_jeux_concours.pdf).

## Proposition : garder le dé et ajouter un socle réel

Pour chaque saison :

`dotation en g = 100 g + somme des bonus hebdomadaires Concours`

`bonus d'une semaine = grammes Concours admissibles de la semaine × taux du dé collectif`

On conserve, à titre de proposition, les taux déjà compris par le jeu :

| Moyenne des dés, arrondie à deux décimales comme actuellement | Taux appliqué aux grammes Concours |
| --- | ---: |
| Aucun lancer, ou moyenne < 2,50 | 1 % |
| 2,50 ≤ moyenne < 3,50 | 4 % |
| 3,50 ≤ moyenne < 4,50 | 7 % |
| Moyenne ≥ 4,50 | 10 % |

Chaque personne dispose du même lancer gratuit hebdomadaire ; aucun achat ou soutien financier n'ajoute de lancer, ne modifie ses faces, ni ne pondère sa contribution. Le dé agit sur le bonus collectif. Il ne diminue jamais les 100 g garantis. Les dés de Culture restent dans le jeu ; leurs effets sur l'attribution réelle doivent être pris en compte dans le classement doté conservé.

Exemple fictif, pas un résultat commercial : 1 000 g Concours admissibles dans une semaine à 4 % ajoutent 40 g. En l'absence d'autres contributions, la dotation devient 140 g. Zéro vente laisse 100 g. Il s'agit d'un pourcentage de **grammes vendus**, pas d'euros de chiffre d'affaires.

Définition technique recommandée avant mise en œuvre :

- Fleurs identifiées Concours au moment de la vente, classification conservée avec la ligne de commande. Le classificateur actuel utilise le prix de référence TTC au gramme : moins de 2,50 € exclu, 2,50 € Regular, au-dessus Concours (`src/lib/contest-product-track.ts:20`). Un changement ultérieur de prix ne doit pas reclasser les ventes historiques. Une catégorie inconnue doit être résolue, pas devinée depuis le nom.
- Quantités réellement payées, nettes des annulations et remboursements retenus par les règles publiées. Exclure les cadeaux, essais et doublons ; traiter les retours partiels et le décalage paiement/retour. Le calcul actuel ne constitue pas à lui seul un registre des quantités nettes remboursées.
- Dates de saison annoncées à l'avance ; semaines du lundi au dimanche en Europe/Paris, bornées par ces dates. Ne pas déplacer la clôture effective simplement parce que l'administrateur agit plus tard.
- Bonus calculé au dixième de gramme pour conserver la précision actuelle. Montant de semaine en cours explicitement provisoire : sa moyenne peut monter ou descendre. Historique définitif enregistré avec sa formule et ses justificatifs.
- Politique recommandée : après validation définitive d'un bonus hebdomadaire, les retours tardifs sont supportés par l'organisateur et ne retirent pas une dotation déjà annoncée comme acquise. Avant cette validation, les retours corrigent le provisoire. Prévoir le délai de validation et le traitement de la dernière semaine.
- Socle de 100 g provisionné une seule fois par saison, même sans vente. Préserver les reçus et éviter de l'ajouter une deuxième fois lors d'un recalcul ou d'une reprise. Aucun ajustement négatif ne peut diminuer ce socle.

## Attribution retenue : classement incluant la dégustation

L'utilisateur a explicitement choisi de conserver le classement doté, confirmé que les points de dégustation entrent dans ce classement et précisé : acheter permet de récolter plus de points en laissant des avis sur les fleurs. Cette décision remplace la proposition antérieure de séparer la dégustation des gains ou de remplacer le classement par une participation gratuite distincte.

Le principe à décrire est : **achat d'une fleur admissible → avis validé → points de dégustation → contribution au classement général → possibilité de gagner une part de la dotation**. L'achat seul ne donne pas ces points de dégustation. Le barème actuel compte 100 points par fleur distincte achetée avec avis validé pendant la saison ; il ne multiplie pas ces points par le prix payé, les grammes commandés ou les avis répétés sur la même fleur. Les autres composantes du classement et la validation des avis doivent être explicitées. Les avis doivent rester sincères : un avis défavorable admissible ne doit pas être écarté pour sa seule opinion ; signaler la contrepartie en points aux lecteurs des avis selon des modalités à définir.

L'accès gratuit par le jeu peut être conservé, mais il ne permet pas d'annoncer une absence d'avantage d'achat : le règlement doit décrire celui de la dégustation. La conformité de ce montage relève de l'analyse de l'opération promotionnelle et de sa loyauté, et non d'une prétendue obligation générale de retirer tous les points liés aux achats. Le seul fait d'écrire ce lien dans le règlement ne le valide pas juridiquement.

La règle cible limite les avantages d'achat utilisés dans la compétition à la dégustation. Les autres bonus observés dans le dépôt sont un écart à traiter séparément ; aucun retrait, désactivation ou changement de récompense n'a été effectué pendant cette analyse.

Les pourcentages actuels sont repris dans la rédaction : 27 %, 18 %, 13,5 %, 6,75 %, 6,75 %, puis cinq fois 3,6 %, et 10 % Surprise. Pour 100 g, l'arrondi donne 27 / 18 / 13 / 7 / 7 / 4 / 4 / 4 / 3 / 3 g, plus 10 g Surprise, hors égalités. Le lot Surprise annexe est conservé ; il ne remplace pas le classement doté retenu. La nouvelle rédaction ajoute un filtrage des éligibles et une réaffectation des parts vacantes, à implémenter.

**100 g disponibles ne garantit pas 100 g effectivement attribués.** Le code laisse des parts non distribuées si des personnes sont inéligibles ou s'il n'existe aucun candidat Surprise. Il ne faut pas promettre « 100 g distribués » sans changer cela. Prévoir une règle publiée de réaffectation des places vacantes, de traitement des égalités, des arrondis et des lots non réclamés. En l'absence totale de participant valide, annoncer le sort du stock ; aucun report automatique intersaison n'a été établi dans cet audit.

## Trame du règlement à finaliser

1. Organisateur et contact : identité de `src/lib/business-identity.ts`, à vérifier avant publication ; objet et périmètre distincts des Booster Packs.
2. Saison : identifiant, début, fin et heure de Paris ; version du règlement applicable, archive accessible.
3. Participants : majorité, territoire précis, compte personnel, exclusions explicites des personnes liées à l'organisation, traitement des comptes multiples.
4. Participation : parcours gratuit du jeu et critères d'éligibilité ; achats permettant des avis admissibles, points de dégustation et incidence assumée sur le classement doté ; préciser le traitement des autres avantages.
5. Dé : fréquence, faces, génération serveur, limites, reprises après erreur, calcul collectif et taux, semaines sans lancer et lutte contre les comptes multiples.
6. Dotation : 100 g garantis au total, formule du bonus, ventes Concours admissibles, arrondis, validation, remboursements, distinction provisoire/définitif, nature des fleurs et valeur commerciale indicative.
7. Gagnants : classement doté incluant la dégustation, formule et preuve, nombre de lots, égalités, seuils et parts sans bénéficiaire ; préciser le maintien éventuel du lot Surprise annexe et ses conditions.
8. Remise : notification, délai de réponse raisonnable, variétés ou assortiment, substitutions précisément encadrées, livraison et frais, procédure sans nouvelle commande et réclamation.
9. Incidents et fraude : preuves, procédure contradictoire proportionnée, correction des erreurs et recours ; éviter une clause autorisant toute annulation sans motif ni protection des droits acquis.
10. Données : finalités, bases légales, durées, destinataires, droits, sécurité et politique de confidentialité ; prospection séparée.
11. Réclamations et médiation : contact, modalités et médiateur effectivement désigné ; ne pas recopier un tribunal imposé au consommateur.
12. Modification et fin : application prospective, dates publiées, conservation des résultats et engagements des saisons ouvertes ; version des règles enregistrée avec la participation et les attributions.

Proposition de clause centrale, non publiée et à compléter par les articles ci-dessus :

> Pour chaque saison, l'organisateur garantit une dotation totale minimale de 100 grammes de fleurs de chanvre CBD conformes à la réglementation applicable, à partager entre les gagnants. À ce socle s'ajoutent les contributions calculées sur les quantités admissibles de fleurs Concours vendues pendant la saison. Le taux de chaque semaine est déterminé par les lancers gratuits du dé collectif suivant le barème du règlement. Les 100 grammes garantis sont indépendants du volume des ventes et des résultats des dés. Les contributions provisoires et définitivement acquises sont affichées séparément.

Cette clause centrale est développée dans le règlement QRT-REG-1 : calendrier, répartition, égalités, parts vacantes, reports et remise y sont désormais rédigés. Ce sont les règles prévues, pas une attestation de leur mise en œuvre actuelle.

Clause de dégustation retenue pour le projet :

> Les achats de fleurs admissibles permettent au participant de déposer des avis de dégustation. Les avis validés rapportent des points selon le barème annoncé. Ces points entrent dans le classement général utilisé pour attribuer les lots de fleurs de la saison. Acheter plusieurs fleurs distinctes et publier un avis validé sur chacune peut donc améliorer le classement et les perspectives de gain. L'attribution de points ne dépend pas du caractère favorable de l'avis.

Le [projet de règlement saisonnier](projet-reglement-saisonnier.md) reprend ce choix. Il reste un document de travail, distinct du règlement public en vigueur.

## Prochaine tâche bornée

La rédaction des modalités et du calendrier corrigé est terminée. Ne pas redemander les arbitrages classement/dégustation/dotation/dé et ne pas supprimer les points des avis. L'unique mention factuelle non renseignée dans le texte est le médiateur conventionné. Obtenir ses coordonnées réelles ; faire examiner le montage promotionnel et les lots, puis mettre le jeu en accord avec le texte selon la note de mise en œuvre. Aucune publication ni modification de partie n'a été réalisée pour cette rédaction.

L'implémentation correspondante devra traiter ensemble SQL de dotation, preuves Concours à la vente, maintien de la contribution dégustation au classement doté, traitement des autres avantages d'achat, clôture, remise des lots, écran de dotation, règlement et dossier d'ouverture. Une nouvelle migration devra déclarer ses permissions et passer `npm run check:supabase-grants`. Les vérifications devront couvrir au minimum zéro vente = 100 g, recalcul sans double socle, exclusion Regular du financement Concours, avis admissibles comptés une fois, absence de points de dégustation pour l'achat seul, remboursements, dates, égalités/absence de gagnant, reprise du dé et remise sans paiement.

Travail réalisé ici : analyse et documentation uniquement. Aucune modification du fonctionnement ni du règlement publié ; aucun test applicatif nécessaire pour ce livrable documentaire.
