# École des Chanvriers et Maison des cartes

L’ancien emplacement Collection ouvre l’école. La Maison des cartes réunit les accès Packs et Collection dans l’ancien magasin de packs. Les identifiants, cartes, quantités, raretés, packs, historiques et conditions d’accès existants sont conservés ; aucune conversion de collection n’est nécessaire.

**Mise à jour du 13 novembre 2026 :** à la demande explicite de l’utilisateur, les douze migrations de l’école (`20261111000400`, puis `20261112000100` à `20261112001100`) ont été appliquées au projet Supabase lié « Site Web Les Chanvriers Bretons ». Les 390 migrations sont synchronisées, sans migration en attente. Les 17 tables privées, 24 fonctions et leurs permissions ont été vérifiées en lecture seule. Preuve : `output/school/migration-release-2026-11-13/summary.json`. Cette opération ne publie ni le code ni les assets. Les mentions de livraison locale dans les historiques ci-dessous décrivent les validations antérieures du 12 novembre.

## Organisation actuelle : tournoi et encyclopédie

Depuis le **14 novembre 2026, le tournoi est le seul mode de jeu de l’école**. L’entrée de l’école ouvre directement le tournoi ; les deux accès disponibles sont **Tournoi à 4** et **Encyclopédie**. Les anciennes URL des salles de quiz et ateliers affichent le tournoi. Les trois API de quiz solo (`challenge`, `quiz`, `quiz/check`) répondent 410 avec l’adresse du tournoi, en conservant leurs contrôles d’accès. Aucun ancien gain, résultat, acquis ou contenu encyclopédique n’est supprimé. Aucune migration supplémentaire n’est nécessaire.

La banque du 13 novembre comptait **180 QCM factuels sur le chanvre**. À la demande du 14 novembre, elle passe à **360 questions**, en conservant ces 180 premières entrées et en ajoutant 180 questions recherchées et sourcées. **Histoire et anecdotes** rejoint les neuf thèmes existants : plante ; variétés et génétique ; arômes et terpènes ; cannabinoïdes ; graines et alimentation ; fibres et matériaux ; sol et racines ; santé du chanvre ; culture et récolte. Le Club des Hachichins, le mot marijuana, la prohibition et les découvertes scientifiques font désormais partie du tirage. Les quatre niveaux comptent chacun 90 questions. Les anciens quiz pédagogiques et ateliers ne sont pas réactivés ; les gains antérieurs restent visibles.

Le tournoi utilise cette banque partagée : trois questions par niveau Facile, Intermédiaire, Difficile et Expert, soit douze questions pour un finaliste. Les bonnes réponses, corrections, points et chronomètres restent déterminés par le serveur. Les règles du tournoi sont détaillées ci-dessous. L’ancienne série solo de vingt questions est retirée.

L’encyclopédie comporte désormais **9 rubriques, 52 articles factuels, 137 fiches et 160 définitions**. Six articles courts accompagnent les nouvelles corrections, dont deux articles d’histoire factuelle ; l’ancien parcours historique et ses exercices restent archivés. Les illustrations existantes sont réutilisées. Le tournoi ouvre directement les articles, avec leurs références et les limites d’accès aux documents consultés (texte intégral, résumé ou notice).

Depuis le 14 novembre, la rubrique Arômes et terpènes présente **28 cartes sélectionnées pour leur présence documentée dans le cannabis et leur odeur décrite**, dans un carrousel avec recherche par nom, synonyme et odeur et filtres olfactifs. Les 58 dossiers non retenus restent archivés ; cela ne signifie pas qu’ils sont tous absents du cannabis. Chaque carte ouvre une popup parcourable au clavier, aux flèches et au doigt. **Toutes les cartes ont des illustrations aromatiques adaptées**, dont sept nouveaux dessins image_gen : herbe fraîche, camphre, lavande, résine, muscade, rose et térébenthine. Les autres dessins reprennent les Buddies. Les caractéristiques essentielles sont visibles, les références et précisions dépliables. **26 des cartes retenues ont un schéma moléculaire PubChem** ; les structures des deux autres ne sont pas supposées. Les fiches écartées ne sont plus proposées dans la recherche ou l’index ; leurs anciennes URL ouvrent l’article général sur les terpènes. Aucun score ni gain modifié. Provenance : `cannabis-terpene-selection-provenance.json`, `terpene-card-visual-provenance.json`, `terpene-aroma-art-v1.json` et `terpene-structure-provenance.json`.

Les séries solo ne peuvent plus être lancées ni reprises. Les scores terminés, cartes, acquis et gains restent conservés. La migration historique 20261113000100 avait adapté le RPC aux nouveaux thèmes ; le retrait actuel intervient dans la navigation et les API, sans suppression de données ni modification de cette migration. Le code et les assets ne sont pas publiés par cette opération.

Validation : 540 tests réussis ; lint et compilation Next réussis ; 56 contrôles SQL locaux ; 22 contrôles de cycle/reprise ; trois parties navigateur complètes, dont reprise de commandes perdues et isolation entre comptes. Interface contrôlée à 320 et 1440 px, clavier et retrait des anciens contenus vérifiés. Les 180 identifiants de la banque privée sont absents des JavaScript navigateur. Rapport : output/school/hemp-quiz-validation.json. Provenance : hemp-quiz-biology-provenance.json et hemp-quiz-uses-provenance.json.

Le 14 novembre, la présentation du quiz adopte un décor original de plateau dans la DA du Quartier : fauteuil, pupitre au chanvre, rideaux et lampes. Les questions et choix apparaissent par des animations courtes ; la correction conserve les quatre propositions, marque le choix et la bonne réponse, anime les points réellement attribués et affiche des confettis pour une réponse juste. Le résultat montre les vingt réponses. Le bouton Animations et la préférence système de mouvement réduit coupent les effets sans cacher le chronomètre. Aucun délai décoratif n’est ajouté au bonus serveur. Inspiration et génération : `school-quiz-stage-art-v1.json`.

L’accueil de l’encyclopédie présente huit grandes rubriques illustrées. Chaque rubrique distingue les articles illustrés des fiches de référence recherchables et paginées ; les illustrations botaniques existantes différencient les sujets. Recherche globale, index, lexique, retours au focus et 28 cartes terpènes sont conservés. Cette évolution ne modifie ni contenu scientifique, ni banque, ni base de données. Vérifications du 14 novembre : deux parties complètes à 320/1440 px, correction visuelle, reprise sans double score après perte réseau, mouvement réduit, recherche et pagination. Rapports : `output/school/challenge-ui/report.json`, `output/school/quiz-stage/report.json` et `output/school/encyclopedia-visual-reorg-report.json`.

## Tournoi du fauteuil

Le **Tournoi à4 est ouvert toute la semaine**. Un clic sur **Participer au tournoi** suffit : recherche de joueurs pendant15secondes, puis complétion automatique avec les replays de la semaine et les bots Mila, Gabin ou Iris. Quatre humains démarrent immédiatement. Les vrais personnages restent visibles aux pupitres ; les replays et bots sont explicitement distingués.

Trois manches de trois questions font passer4→3→2→1. Le finaliste affronte le score enregistré du champion sur trois questions expert, même si le champion est absent. Une réponse juste vaut100points avec jusqu’à50points de rapidité, dans un délai de20secondes. La manche repart de zéro ; le total du parcours reste affiché.

Le titre est attribué **à minuit à la fin du dimanche, heure de Paris**. La course au fauteuil retient uniquement la meilleure finale réelle de chaque joueur : score sur450 (bonus de rapidité inclus), bonnes réponses, temps cumulé, puis première réalisation entre challengers. Le meilleur challenger devient champion seulement s’il dépasse le benchmark du titulaire ; à égalité ou sans meilleur candidat, le champion conserve son fauteuil. Aucun titre n’est transféré à la fin d’une partie en semaine. Le palmarès historique et le classement de la semaine sont séparés.

L’heure serveur de la dernière réponse expert — ou de son délai expiré — détermine la semaine du résultat. Une partie traversant minuit continue normalement. Les résultats sont figés avant l’écran de bilan pour qu’un polling tardif ne déplace pas une finale. Les douze réponses réelles des finalistes deviennent des replays ; les réponses partielles ne sont jamais complétées artificiellement et les bots n’alimentent ni titres ni résultats humains.

Le job PostgreSQL nommé **kq-school-tournament-weekly-champion** fonctionne même sans joueur connecté. Deux horaires UTC couvrent l’heure de Paris en été/hiver ; une clôture unique par édition et le rattrapage RPC rendent les exécutions répétées sûres. Les horloges fictives et simulations de cron sont limitées aux bases de test isolées.

Migration **20261114000400_kq_school_tournament_weekly_champion.sql appliquée le14novembre2026**, après001–003, sans modifier ces fichiers historiques. **395 migrations synchronisées, aucune attente** ;10tables privées et18fonctions contrôlées. Le worker de clôture est réservé au planificateur postgres ; seul le RPC de jeu nommé est accessible à service_role. Rapport : **output/school/tournament-weekly-release-2026-11-14/summary.json**. Validation : **output/school/tournament-weekly-validation.json**. Le code et les assets ne sont pas publiés par cette opération.

## Archives des parcours et du contenu initial

- Maison des cartes : `/arene/placard?view=shop`, avec `tab=packs|collection` et `section=buddies|botte`. L’ancien `view=collection` reste un accès aux cartes.
- École : `/arene/placard?view=school`, puis `section=learn|quiz|workshops`, `module=<id>` et `passage=<id>` pour retrouver une séquence.
- Les fiches utilisent `buddy=<code>` et préservent le contexte d’origine, y compris le passage du cours ou le corrigé.
- Neuf parcours sont développés : **Histoire du chanvre et du cannabis** (11 chapitres/22 leçons), **Botanique, diversité et génétique** (8/16), **Terpènes et profils aromatiques** (10/20), **Cannabinoïdes, formation et preuves** (10/20), **Modes de culture et choix de système** (8/16), **Enquêter sur la santé des plantes** (8/16), **Sol, racines et nutrition** (10/20), **Produits, transformations et qualité** (10/20) et **Comprendre ce qui améliore vraiment une récolte** (9/18). Le repère juridique historique reste accessible comme complément distinct des neuf parcours. Les fiches nécessaires à l’apprentissage restent accessibles sans posséder les cartes.
- Dix identités de quiz conservent leur budget historique. Histoire sélectionne dix questions parmi quarante-quatre, couvrant dix chapitres distincts. Botanique sélectionne dix questions parmi trente-deux, couvrant les huit chapitres avec deux questions supplémentaires de chapitres distincts. Terpènes, Cannabinoïdes, Sol et Produits sélectionnent chacun dix questions parmi quarante, une par chapitre. Modes de culture et Santé des plantes sélectionnent chacun dix questions parmi trente-deux, couvrant les huit chapitres avec deux questions supplémentaires de chapitres distincts. Récolte sélectionne dix questions parmi trente-six, couvrant les neuf chapitres avec une question supplémentaire distincte dans un chapitre. Le quiz du complément juridique conserve ses questions. Chaque synthèse comporte dix questions, sans chronomètre ; les réponses de référence sont dans des modules `server-only`.
- Dix Buddies réels reliés à onze questions ; les descriptions commerciales et la fiction sont attribuées aux fiches.
- Six ateliers : deux grilles de huit mots aux intersections vérifiées, un classement chronologique de six repères, trois séries d’association. Saisie de mots avec accents, clavier et commandes tactiles ; aucune récompense monétaire d’atelier.

La banque annoncée `ecole_chanvre_100_questions.json` était absente. Les contenus ont été rédigés et sourcés pour cette évolution. Les repères sanitaires et juridiques sont datés du 11 novembre 2026 ; les 31 sources et leur usage précis sont enregistrés dans `school-content-provenance.json`.

### Parcours Histoire — version du 12 novembre 2026

Accès direct : `/arene/placard?view=school&section=learn&module=history&passage=history-index`. L’index, les leçons, les chapitres à vérifier et les termes du glossaire possèdent des passages stables. L’ancienne lecture du cours reste acquise ; elle ne valide pas automatiquement les vingt-deux nouvelles leçons.

Chaque leçon articule une question, un objectif, un schéma, l’essentiel, un exemple, un approfondissement facultatif et un exercice corrigé. Les onze contextes précisent qui, où, pour quoi, quelles transformations, quelles preuves, ainsi que travail, commerce et débouchés. Les exercices demandent une conclusion et sa justification ; une conclusion juste avec une justification erronée reste à revoir. Les situations fictives, dont la commande de Noyal, sont signalées comme telles.

Le parcours comprend vingt-deux activités et onze vérifications de chapitre, sans monnaie supplémentaire. Les cinq exercices demandés sont présents : dossier archéologique Tunnug/Jirzankal, commande de toile à Noyal, association matières/métiers/usages, comparaison du document USDA avec le texte fiscal de 1937, correction d’une chronologie trompeuse. Les quatre options de chacune des quarante-quatre questions de synthèse ont une explication.

La frise propose trente repères filtrables par région et usage ; elle distingue objet, événement, publication et entrée en vigueur. La carte montre sept liaisons sourcées sur un fond Natural Earth, avec tracés schématiques et hypothèses en pointillés. Ni les coordonnées ni les arcs ne prétendent restituer un itinéraire commercial exact. Le glossaire comporte trente-deux termes ; la recherche ignore les accents. Les fiches de Buddies gardent le retour vers le passage lu et restent consultables sans possession.

Les cinquante et une références indiquent auteur, titre, date, URL, passage, date de consultation et étendue réelle d’accès. Une notice d’archive n’est jamais présentée comme la lecture intégrale du document. Le dossier Tunnug publié le 5 novembre 2026 est traité à partir du communiqué institutionnel consulté, avec limites explicites ; le texte intégral de l’étude n’a pas été consulté. Les traditions de Shennong, le support des Bibles de Gutenberg et les récits monocausaux de prohibition font l’objet d’un examen critique. Relecture indépendante des passages médicaux, scientifiques et réglementaires ; contre-vérification des notices bretonnes, Gutenberg et USDA. Les contenus factuels et leurs sources sont dans `src/lib/kanab-quest-school-history-{early,modern}.ts`, la provenance et les limites dans `school-history-provenance.json`.

La progression détaillée est indépendante des gains : vingt-deux lectures, vingt-deux activités et onze chapitres. Les validations se cumulent ; une révision concurrente protège la position de reprise plus récente. Les envois sont séquentiels, les étapes en attente survivent à la navigation, et un bouton permet de réessayer après une réponse perdue. Le stockage de l’onglet est une aide ; le serveur reste la référence. Les choix des exercices sont des brouillons locaux, séparés par propriétaire.

### Parcours Botanique — version du 12 novembre 2026

Accès direct : `/arene/placard?view=school&module=plant&passage=botany-index`. Le module et l’identité de récompense `plant` sont conservés ; les nouveaux passages `botany-*` identifient les seize leçons et les huit vérifications de chapitre. L’ancien cours reste acquis, sans valider automatiquement les nouvelles lectures ni rouvrir le plafond de dix euros de jeu.

Les huit chapitres couvrent anatomie, cycle, expression sexuelle, observation, taxonomie, diversité, génétique et filiations modernes. Chaque leçon comporte question, objectif, explication courte, visuel, approfondissement, exemple et exercice. Les sept exercices demandés sont intégrés : repères d’une plante, organes et fonctions, fleurs et observation insuffisante, ordre du cycle, génotype/phénotype, pedigree incertain et comparaison de fiches. Les activités communes aux deux parcours affichent une étape à la fois ; choix, justification et position de l’exercice sont conservés dans l’onglet.

Les planches légendées distinguent fleurs, stipules, bractée, stigmates, fruit et graine. Une vue volontairement dégradée sert à reconnaître les limites d’une observation. Les coupes et dessins conceptuels sont identifiés comme tels, sans échelle mesurée ; les illustrations générées ne constituent pas des photographies diagnostiques. Le tableau de transmission porte sur un locus fictif A/a et n’optimise aucun caractère réel. La photopériode est expliquée sans calendrier de production. Autofloraison, autofécondation et semences féminisées sont explicitement distinguées.

Dix dossiers — Haze, Skunk, Northern Lights, Kush, Diesel, Blueberry, White Widow, Cookies, Gelato et hybrides CBD — présentent origine revendiquée, période documentée, obtenteur déclaré, parents annoncés, récits concurrents, preuves et inconnues. Les vingt-sept liens des arbres sont des déclarations attribuées, pas des parentages validés génétiquement ; quatre concernent une ascendance composée dont les générations ne sont pas établies. Les trois statuts de preuve restent filtrables, y compris lorsqu’un statut n’a aucun lien. Les versions de White Widow ne sont pas fusionnées ; les parents inconnus d’OG Kush ou de CBD Therapy ne sont pas inventés. Les fiches Buddies réelles restent consultables sans possession avec retour au dossier exact.

Les cinquante-trois sources comportent métadonnées et limites d’accès : trente-deux textes ou passages intégraux, dix pages d’organismes, six résumés, quatre extraits indexés et une fiche documentaire. Les entretiens indexés ne sont pas présentés comme une lecture intégrale. Les déclarations commerciales restent attribuées et confrontées aux études sur la variabilité des échantillons partageant un nom. La taxonomie Kew est présentée comme un traitement, sans ériger trois espèces en certitude ni inférer un effet à partir d’indica/sativa.

Les trois parcours partagent le moteur de leçons, d’activités et de références. Le glossaire commun réunit cent vingt entrées, chacune avec son contexte et ses leçons liées ; il se charge à l’ouverture. La banque de trente-deux questions est séparée de ses cent vingt-huit explications privées. La sélection signée `b1` est liée au propriétaire et à la version ; la progression détaillée utilise une file d’envoi indépendante de celle d’Histoire. Documentation : `school-botany-provenance.json`, `school-botany-art-provenance.json` et section `botanyExtension` de `school-economy-validation.json`.

### Parcours Terpènes — version du 12 novembre 2026

Accès direct : `/arene/placard?view=school&module=molecules&passage=terpenes-index`. Dix chapitres, vingt leçons courtes, approfondissements repliables, vingt activités et dix bilans. Les quarante questions disposent de cent soixante corrections privées ; le quiz couvre les dix chapitres. Les termes du parcours rejoignent le glossaire commun, avec recherche et renvois vers les leçons.

L’encyclopédie réunit **31 fiches détaillées et 55 entrées complémentaires**, avec recherche par nom ou synonyme, caractères grecs acceptés, filtres chimiques, olfactifs et par niveau d’identification. Nom, synonymes, isomères, preuves de présence, matrice, notes sensorielles, autres plantes, résultats biologiques ou lacunes et références sont séparés. Les attributions provisoires restent explicites ; les 86 dossiers ne constituent ni 86 identités toutes confirmées, ni un inventaire exhaustif. Corpus, exclusions, règles de regroupement et date sont consultables dans l’interface et dans `school-terpenes-corpus.json`.

Les six exercices demandés sont intégrés : roue des familles olfactives, classement molécule/famille, terpène/autre composé, profils fictifs comparés en mg/g et proportions, critique de publicité, mots croisés. La grille réutilise le moteur existant et offre saisie par mot entier, indices, correction et brouillon. Les notes aromatiques de trois Buddies sont attribuées aux sources commerciales déjà associées au jeu ; elles renvoient à quatre fiches de composés sans prétendre fournir leur analyse chimique. Navigation dans les deux sens et consultation sans possession.

Présence, concentration, seuil et contribution olfactive sont distingués. Les résultats sur cellules, animaux et humains restent séparés ; les essais humains Spindle2024 et Kumar2025 sont confrontés dans leurs périmètres respectifs. Le chapitre non terpénique inclut soufrés, esters et autres composés effectivement identifiés. Volatilité, évaporation, ébullition et dégradation sont expliquées sans réglage de vaporisation ni consommation nécessaire. Les 52 références précisent auteur, date, URL, passage, accès réel et limites ; relectures indépendantes des identités et des affirmations sensibles consignées dans `school-terpenes-provenance.json`.

L’identité historique `molecules` / `school:molecules` conserve son plafond de 1000 centimes et ses anciens reçus. La sélection signée `t1` et la progression20/10/20 sont isolées des parcours Histoire et Botanique. Les leçons, activités et bilans ne versent pas de monnaie. Aucune génération d’IA pendant la partie.

### Parcours Cannabinoïdes — version du 12 novembre 2026

Accès direct : `/arene/placard?view=school&module=evidence&passage=cannabinoids-index`. Dix chapitres, vingt leçons et activités, dix bilans, quarante questions et cent soixante explications privées. Les six exercices demandés évaluent classement des origines, paires acide/neutre, réseau, type d’étude, conclusion exagérée et fiche incomplète, avec justification obligatoire. Les quarante-trois termes portent le glossaire commun à 163 entrées.

Le registre rassemble 29 fiches : identité et synonymes, famille, forme, présence dans une matrice définie, mécanismes, données humaines, risques et inconnues. Recherche et filtres ne transforment pas l’absence d’une fiche en preuve d’absence. Les dossiers THCP, CBDP, HHC et dérivés commerciaux séparent présence végétale, artefact possible et fabrication. Les sources indiquent précisément l’étendue de lecture.

Le réseau interactif contient 23 nœuds et 23 relations : précurseurs, enzymes, branche CBGA et formes variniques, décarboxylation, vieillissement, métabolisme et fabrication. Les cosubstrats ne sont pas présentés comme deux voies indépendantes. CBGVA→CBCVA reste une relation proposée, nommée et en pointillés. Le CBG neutre n’est pas le précurseur de toutes les molécules. Aucun couple temps/température, réactif, appareil, protocole de conversion ni recette de dosage n’est reproduit.

La matrice molécules × preuves et les treize fiches d’études distinguent modèles précliniques, recherches humaines exploratoires et essais cliniques. Chaque fiche expose population, effectif ou limite d’information, formulation, comparateur, durée, critère, résultat, incertitude, événements indésirables, financement, dates et cohorte. Les résultats négatifs et contradictoires restent consultables. Les articles HHC 2025 et 2026 réutilisent six participants ; les expériences THCP ne fournissent pas un multiplicateur d’effet humain. Les graphiques Dravet et CBDV conservent unités, comparateurs et incertitudes.

EMA, EFSA, ANSES/ANSM et EUDA sont cités selon leurs fonctions et dates. Le Buddy Charlotte’s Web est accessible sans possession, avec retour exact au passage ; sa fiche n’est pas assimilée à un médicament. Illustrations de chanvre existantes et matériaux du Quartier réutilisés. Les schémas, interactions et chiffres restent en HTML.

L’identité `evidence` / `school:evidence` conserve son budget historique de 1000 centimes, sans remise à zéro. Sélection `c1` signée, progression20/10/20, union des validations, reprise protégée par révision et envois séparés par joueur/parcours. La lecture et les exercices ne versent pas de monnaie. Relectures et limites : `school-cannabinoids-provenance.json` et `school-cannabinoids-corpus.json`.

### Parcours Modes de culture — version du 12 novembre 2026

Le parcours s’ouvre avec `module=genetics&passage=cultivation-index`. L’identifiant historique `genetics` et la récompense `school:genetics` sont conservés, puisque la génétique est désormais développée dans Botanique. Les gains antérieurs ne sont pas remis à zéro et les anciennes lectures ne valident pas automatiquement les nouvelles étapes.

Huit chapitres et seize leçons couvrent les deux axes indépendants, lumière, climat, ressources et travail, aléas, performance et coûts, empreinte et choix contextualisé. Chaque leçon propose un objectif, un exemple, un visuel et une activité argumentée ; huit bilans de chapitre complètent la banque de trente-deux questions, avec cent vingt-huit corrections d’options privées. La sélection signée `u1` couvre les huit chapitres. Le moteur et la file de progression 16/8/16 sont réutilisés avec un espace propre au joueur et au parcours.

La serre de chanvre générée dans la direction du Quartier comporte six repères accessibles au clavier : plantes, surface mouillée, vitre froide, ouvrant, ventilateur et cuve. L’animation est illustrative et respecte la réduction des mouvements. Elle ne constitue ni une photographie diagnostique ni un plan technique. Prompt, référence visuelle et assets : `school-cultivation-art-provenance.json`.

Le comparateur présente huit configurations sur dix critères, sans classement universel. Trois dossiers fictifs décrivent une filière bretonne fibre/graine, une pépinière pédagogique et une station de recherche. La simulation qualitative expose ses hypothèses et ses limites pour cinq choix de contexte ; elle ne prédit pas de rendement, de coût ni de bénéfice. Le bilan A/B/C sépare kWh, kg CO₂e, kg de biomasse sèche et kWh/kg ; il couvre seulement l’électricité de culture et exclut explicitement le séchage et les autres postes. Les études de laitue documentent une méthode et des compromis, sans transfert de ratios au chanvre.

Les cinq exercices demandés sont intégrés : axes, humidité de serre, informations manquantes, bilan simplifié et défense d’un choix. Plusieurs décisions cohérentes peuvent être acceptées avec une justification commune explicite. La fiche finale relie les objectifs aux options et renvoie vers sol/eau, santé des plantes et qualité. Carmagnola (HH2026-045) fournit un lien attribué à une vraie fiche ; son histoire ne certifie ni un lot de semences, ni une autorisation, ni une performance. Le glossaire commun et les sources indiquent le niveau d’accès aux documents.

Les limites scientifiques, corpus et preuves de vérification figurent dans `school-cultivation-provenance.json` et `school-cultivation-corpus.json`.

## Économie et persistance

Le catalogue SQL fixe un budget de **1 000 centimes de monnaie du jeu par quiz**, soit **100 € au maximum** pour les dix quiz. Un quiz vaut au plus un cinquième d’une première mission de 50 €. Le total représente 5 % du capital initial de 2 000 €.

La réussite commence à 7/10. Pour un score `s`, le droit est nul sous 7, sinon `floor(budget_cents × s / 10)`. Le versement est le maximum entre zéro et ce droit moins le montant déjà payé. L’arrondi se fait au centime inférieur. Exemple : 7/10 verse 7 €, puis 9/10 verse seulement 2 €. Rejouer un score identique ou inférieur ne verse rien.

Les identités `school:<module>` sont indépendantes de la version éditoriale. Modifier le texte, l’ordre des options ou déployer de nouveau ne recrée pas les gains. Un ajustement volontaire des budgets se fait dans une migration ultérieure ciblant les lignes de `kq_school_catalog`.

Le serveur vérifie la session, l’origine, les identifiants, options, doublons et version, puis calcule le score. La fonction SQL verrouille d’abord le portefeuille du joueur, commun aux différents quiz. Reçu, progression, meilleur score, total payé, portefeuille et écritures comptables sont atomiques. Les quatre tables sont privées, y compris pour les écritures directes `service_role` ; seul le RPC nommé est exécutable par le serveur.

Les brouillons et reçus de l’onglet sont isolés par propriétaire et par quiz. Une réponse réseau perdue garde sa clé d’idempotence et verrouille les réponses jusqu’au résultat. Un conflit définitif après duplication d’onglet propose explicitement une nouvelle tentative, sans renouveler une clé après une simple coupure réseau. Cours et ateliers envoient leur progression uniquement à la validation.

## Illustration et coûts

Le bâtiment extérieur a été réellement redessiné. L’intérieur v4 conserve la salle en coupe du Quartier : pierre crème, bois miel texturé, détails encrés et accents teal/ardoise. Il est entièrement consacré au chanvre : les deux pages du livre illustrent sa feuille et son inflorescence, les pots et semis sont du chanvre, l’atelier montre ses graines, fibres, corde et textile. Les plantes et fleurs génériques de la v3 ont été remplacées, y compris les hortensias. Cette exigence s’applique aux futures illustrations de l’école. La bibliothèque, le pupitre et l’établi sont des destinations HTML accessibles. Lampe et livre s’animent sur un fond nettoyé ; pause, réduction des mouvements, visibilité de l’onglet et de la scène sont prises en compte. Les planches botaniques des cours, déjà approuvées, sont conservées.

Les dix planches botaniques et leurs dix miniatures occupent environ 2,58 Mo au total, servis comme fichiers statiques et chargés selon le parcours. Elles illustrent les notions ; elles ne constituent pas des analyses, des dosages ni des preuves historiques. Aucun service d’IA n’est appelé pendant le jeu. Aucun temps réel ou enregistrement à chaque frappe n’est ajouté.

Prompts, sources d’image et traitements : `school-artwork-provenance.json`, `school-learning-art-provenance.json` et `school-interior-v4-provenance.json`. Exports reproductibles : `scripts/export-school-artwork.mjs`, `scripts/export-school-learning-art.mjs`, `scripts/export-school-interior-art.mjs`, `scripts/export-placard-map-sprites.mjs`.

## Installation et vérification

Les migrations de l’école sont `supabase/migrations/20261111000400_kq_school.sql`, `supabase/migrations/20261112000100_kq_school_history_progress.sql`, `supabase/migrations/20261112000200_kq_school_botany_progress.sql`, `supabase/migrations/20261112000300_kq_school_terpenes_progress.sql` et `supabase/migrations/20261112000400_kq_school_cannabinoids_progress.sql` et `supabase/migrations/20261112000500_kq_school_cultivation_progress.sql`. Elles ont été appliquées dans les bases temporaires de test uniquement. **Elles n’ont pas été appliquées au projet Supabase distant, et l’application n’a pas été publiée.** Une éventuelle publication ultérieure devra suivre le processus habituel du dépôt pour ces migrations, puis le code et les assets. Les anciennes migrations déjà en cours dans le dépôt n’ont pas été effacées ou fusionnées avec celles-ci.

Le contrôle distant antérieur du 12 novembre 2026, en lecture seule, précède la nouvelle migration Histoire. La preuve `output/school/migration-readiness.json` ne vaut donc pas vérification de disponibilité pour la livraison actuelle. Aucun nouveau contrôle ni changement distant n’a été nécessaire pour cette livraison locale.

Pour essayer l’école sans compte ni connexion à la base du jeu :

```text
npm run preview:school
```

Ouvrir `http://127.0.0.1:3248/arene/placard?view=school`. Cet aperçu sert les vrais composants, illustrations, cours, quiz et ateliers avec des données de démonstration. La progression et les récompenses sont simulées en mémoire ; les autres destinations sont des témoins de navigation. Le serveur écoute uniquement sur la machine locale. Arrêter puis relancer le serveur réinitialise la progression de démonstration.

Commandes de contrôle :

```text
npx vitest run src/lib/kanab-quest-school.test.ts src/lib/kanab-quest-school-content.test.ts src/lib/kanab-quest-school-server.test.ts src/lib/supabase/kanab-quest-school-backend.test.ts src/app/api/arena/placard/school/route.test.ts
node scripts/test-placard-school.mjs
node scripts/test-placard-school-concurrency.mjs
npm run check:supabase-grants
node scripts/audit-placard-navigation.mjs --cards-only
npx vitest run src/lib/kanab-quest-school-history-content.test.ts src/lib/kanab-quest-school-history-server.test.ts src/lib/kanab-quest-school-history-progress.test.ts src/lib/kanab-quest-school-history-outbox.test.ts src/lib/supabase/kanab-quest-school-history-backend.test.ts
node scripts/test-placard-school-history.mjs
node scripts/test-placard-school-concurrency.mjs --history
node scripts/audit-placard-navigation.mjs --school-history
npx vitest run src/lib/kanab-quest-school-botany-content.test.ts src/lib/kanab-quest-school-botany-server.test.ts src/lib/kanab-quest-school-botany-progress.test.ts src/lib/kanab-quest-school-history-outbox.test.ts src/lib/supabase/kanab-quest-school-botany-backend.test.ts
node scripts/test-placard-school-botany.mjs
node scripts/test-placard-school-concurrency.mjs --botany
node scripts/test-placard-school-fixture.mjs
node scripts/audit-placard-navigation.mjs --school-botany
npx vitest run src/lib/kanab-quest-school-terpenes-content.test.ts src/lib/kanab-quest-school-terpenes-server.test.ts src/lib/kanab-quest-school-terpenes-progress.test.ts src/lib/supabase/kanab-quest-school-terpenes-backend.test.ts
node scripts/test-placard-school-terpenes.mjs
node scripts/test-placard-school-concurrency.mjs --terpenes
node scripts/audit-placard-navigation.mjs --school-terpenes
npx vitest run src/lib/kanab-quest-school-cannabinoids-content.test.ts src/lib/kanab-quest-school-cannabinoids-server.test.ts src/lib/kanab-quest-school-cannabinoids-progress.test.ts src/lib/supabase/kanab-quest-school-cannabinoids-backend.test.ts
node scripts/test-placard-school-cannabinoids.mjs
node scripts/test-placard-school-concurrency.mjs --cannabinoids
node scripts/audit-placard-navigation.mjs --school-cannabinoids
npx vitest run src/lib/kanab-quest-school-cultivation-content.test.ts src/lib/kanab-quest-school-cultivation-server.test.ts src/lib/kanab-quest-school-cultivation-progress.test.ts src/lib/supabase/kanab-quest-school-cultivation-backend.test.ts
node scripts/test-placard-school-cultivation.mjs
node scripts/test-placard-school-concurrency.mjs --cultivation
node scripts/audit-placard-navigation.mjs --school-cultivation
npx tsc --noEmit
npm run build
```

Le test de concurrence utilise un PostgreSQL 17 local éphémère, sans réseau, port publié ni montage de données. Les tests navigateur utilisent le vrai Shell, les composants, les images et des API simulées ; ils ne valident pas une session distante ni un paiement réel. Les scénarios et captures sont conservés dans `output/placard-navigation/`. Les contrôles économiques réellement exécutés sont détaillés dans `school-economy-validation.json`.

Les recettes actuelles des parcours utilisent `--school-history`, `--school-botany`, `--school-terpenes`, `--school-cannabinoids` et `--school-cultivation`. L’ancien audit complet `--school-visual` attendait les quatre sections introductives de Botanique ; il ne sert pas de preuve pour les nouveaux parcours. Son mode `--preview` reste l’entrée de la démonstration locale.

Livraison Terpènes vérifiée : 138 tests ciblés, contrôles SQL et permissions, build avec TypeScript, recettes Terpènes/Botanique à 320 et 1440 px et aperçu local final. Les 116 explications privées des trois parcours sont absentes des 185 chunks JavaScript client. Détails et limites : `school-terpenes-provenance.json`.

Livraison Cannabinoïdes vérifiée : 168 tests ciblés, 55 contrôles SQL, 13 concurrence PostgreSQL, 44 fixture, permissions sur 383 migrations, build avec TypeScript et recette à 320/1440 px incluant les six exercices. Les 156 explications privées des quatre parcours sont absentes des chunks client. Les cinq migrations restent locales. Détails : `school-cannabinoids-provenance.json`.

Aperçu final Cannabinoïdes revérifié à 320 et 1440 px, avec les quatre parcours et le glossaire commun. Les branches du réseau affichent chaque précurseur et chaque produit pour éviter une lecture en chaîne. La compilation termine avec le code 0 ; certaines revalidations de données publiques Supabase échouent faute d’accès réseau. Ces données distantes ne font pas partie de la validation locale.

Livraison Modes de culture vérifiée : 199 tests ciblés, 58 contrôles SQL, 14 concurrence PostgreSQL, 56 fixture et permissions sur 384 migrations. Compilation Next.js/TypeScript réussie, code 0 enregistré ; les avertissements de revalidation des données publiques Supabase dus au réseau sont documentés. Recette et aperçu final à 320/1440 px sans erreur JavaScript ni débordement ; 205 entrées au glossaire commun. Les six migrations de l’école restent locales. Détails : `school-cultivation-provenance.json`.

### Parcours Santé des plantes — version du 12 novembre 2026

Accès direct : `/arene/placard?view=school&module=biodiversity&passage=health-index`. Le parcours conserve le quiz `biodiversity`, sa récompense `school:biodiversity` et son plafond historique de 1000 centimes ; le plafond de l’école reste 10000 centimes. Les anciens reçus, gains et lectures ne sont pas réinitialisés. Sélection signée `p1`, progression privée séparée, seize lectures et activités, huit bilans, trente-deux questions et cent vingt-huit explications de propositions côté serveur.

Les huit chapitres suivent observation, causes biotiques et abiotiques, ravageurs, agents pathogènes, auxiliaires, prévention, protection intégrée et vérification du résultat. L’atlas contient vingt-huit fiches, dont quatre groupes d’auxiliaires, avec recherche, filtres, organes, signes, cycle, dispersion, confusions, confirmation, prévention et limites de gestion. Les contextes français de chanvre fibre/graine sont distingués des observations nord-américaines sous abri. Champignons, oomycètes, virus et viroïdes restent distincts. Une détection moléculaire n’est pas automatiquement une preuve de causalité.

Quatre documents photographiques CC BY sont intégrés : figures 4, 5 et 7 de Punja et collaborateurs (2019) et photographie de Phorodon cannabis par Whitney Cranshaw. Fichiers originaux, crédits, liens, dates, échelles et limites sont conservés ; les figures contenant des reprises tierces sont exclues. Les légendes signalent la nature expérimentale de la figure 5 et le nom provisoire d’oïdium de 2019. L’illustration de chanvre utilisée en ouverture est décorative, sans valeur diagnostique. Provenance : `school-health-art-provenance.json`.

Les six enquêtes demandent une justification. Dans le dossier fictif du bac qui flétrit, le joueur consulte au moins deux observations avant d’accéder à la conclusion ; demandes et réponses en cours restent propres au propriétaire dans l’onglet. Plusieurs dossiers permettent une conclusion correcte « diagnostic non confirmé ». La démarche de protection intégrée se réordonne au clavier et les observations peuvent conduire à revenir en arrière. La présence d’un auxiliaire ne garantit aucun résultat.

La fiche réelle E-Phy SLUXX HP (usage 11012903, v11.0) a été consultée le 12 novembre 2026, avec date de mise à jour du 6 juillet 2026 et date d’autorisation de l’usage du 24 septembre 2018 séparées. Elle sert à vérifier la cible, le groupe cultural, le mode et les restrictions ; aucune recette, dose ou intervention n’est prescrite. Le catalogue DGAL/SDSPV/2025-236, pages PDF548 et558, confirme la portée toutes cultures incluant le chanvre ; les restrictions propres au produit restent applicables. Un usage limaces ne couvre pas les thrips. Aucun logo E-Phy ou Anses n’est reproduit. L’atlas ne recommande aucun produit phytopharmaceutique.

Les liens rejoignent le cours sur humidité/condensation et l’anatomie des racines. Le lien nutrition rejoint désormais Sol, racines et nutrition ; les signes abiotiques restent expliqués dans Santé. La fiche Carmagnola HH2026-045 reste lisible sans possession ; son histoire ne démontre pas une résistance aux maladies.

La migration `20261112000600_kq_school_health_progress.sql` ajoute la progression privée. Les sept migrations de l’école sont destinées à la livraison locale ; aucune n’est appliquée ici au projet distant. Les preuves de validation et le point de reprise sont consignés dans `school-health-provenance.json`, `school-health-corpus.json`, `school-economy-validation.json` et `ux-progress.json`.

Livraison Santé vérifiée : 233 tests ciblés, 61 contrôles SQL, 15 concurrence PostgreSQL, 68 fixture et permissions sur 385 migrations. Compilation Next.js/TypeScript réussie. Recette et aperçu à 320/1440 px ; 260 termes au glossaire. Les sept migrations restent locales. Détails : `school-health-provenance.json`.

### Parcours Sol, racines et nutrition — version du 12 novembre 2026

Accès : `/arene/placard?view=school&module=uses&passage=soil-index`. Dix chapitres et vingt leçons couvrent propriétés physiques, rhizosphère, vie du sol, matière organique et cycles, éléments nutritifs, mesures, engrais/amendements, catégories d’apports, analyse/suivi et chanvre autorisé selon son débouché. Le quiz `uses` et la récompense `school:uses` conservent leurs gains et budgets ; signature `s1`, progression privée indépendante, 40 questions et 160 explications privées.

La coupe illustrée générée montre du chanvre, des racines connectées et six repères HTML accessibles au clavier. Aucun microorganisme grossi n’est confondu avec une observation à la même échelle. La carte des relations comporte 14 nœuds et 26 liens conditionnels, accompagnés d’une liste textuelle et de sources. Treize indicateurs séparent mesure, méthode et limites ; quatorze éléments minéraux sont détaillés, avec rappel que C, H et O restent également essentiels. Huit catégories d’apports se comparent par fonctions, maturité, variabilité et risques.

Les deux analyses portent explicitement la mention exercice fictif. A et B sont deux zones, non un avant/après. Les valeurs de pH, EC, CEC et P de méthodes différentes ne donnent ni classement direct ni recommandation. Les calculs de teneur et de C/N sont contrôlés. Aucun stock, bénéfice, dose ou calendrier de production n’est extrapolé de ces chiffres.

Les sept exercices demandent des justifications : éléments/fonctions, CEC/conductivité, deux analyses, information manquante, cycle, causes possibles d’un symptôme et engrais/amendement. La boucle d’azote se remet dans l’ordre au clavier ; elle est présentée comme une voie possible, avec immobilisation et voies non dessinées explicites. Le parcours se termine par observer → analyser → comprendre la limite → choisir une action proportionnée → mesurer son résultat.

Les observations de microorganismes, fonctions supposées et bénéfices expérimentaux sont séparés. Les études d’inoculants sur maïs ne sont pas des essais sur chanvre ; les publications partageant une cohorte sont signalées. La fiche publique Carmagnola HH2026-045 reste accessible sans possession, sans lui attribuer une recette universelle de nutrition. Santé et Modes de culture renvoient au nouveau parcours.

Livraison locale vérifiée : 270 tests ciblés, 64 contrôles SQL, 16 de concurrence PostgreSQL, 80 de fixture et permissions sur 386 migrations. Compilation Next.js/TypeScript réussie ; recette et aperçu à 320/1440 px ; 331 entrées au glossaire commun. Migration 20261112000700 locale uniquement ; les huit migrations de l’école ne sont pas appliquées au projet distant. Sources, limites, art et preuves : school-soil-provenance.json, school-soil-corpus.json, school-soil-art-provenance.json.

### Parcours Produits, transformations et qualité — version du 12 novembre 2026

Accès : `/arene/placard?view=school&module=profiles&passage=products-index`. Quatre ensembles relient graines/fibres/matériaux, résines/extraits/formulations, alimentation/inhalation/qualité, puis origine des molécules et traçabilité. Dix chapitres, vingt leçons, vingt activités, dix bilans et quarante questions avec cent soixante explications privées.

La planche générée possède six repères HTML. L’atlas comporte 29 fiches avec origine, principe, propriétés, limites, contrôles, débouché et règles datées. La chaîne textile se remet dans l’ordre au clavier ; cinq cartes distinguent les opérations ; six étiquettes fictives confrontent terme commercial et preuve. Le glossaire commun atteint 403 entrées.

Les six exercices demandés sont présents : partie/produit, types de transformation, étiquette, certificat, information manquante et parcours des fibres. Une enquête supplémentaire porte sur quatre pièces du lot B : dossier d’entrée A/D, assemblage, certificat A et étiquette B. Les choix et leurs raisons sont évalués ensemble ; le brouillon reprend après rechargement et la progression reste liée au joueur.

Le certificat est un exercice fictif : deux résultats en mg/kg et quatre catégories non mesurées, jamais remplacées par zéro. Le lien d’un échantillon au lot, la méthode, la LQ, l’incertitude et la portée sont explicites. L’enquête peut conclure que B est insuffisamment documenté, sans inventer une contamination ou une conformité.

Droit France/UE et repères sanitaires vérifiés au 12 novembre 2026, avec textes et passages cités. Les règles alimentaires, l’avis EFSA, les allégations et l’autorisation ne sont pas fusionnés. Le seuil du chanvre n’autorise pas chaque produit. Naturel, hémisynthétique ou synthétique ne préjugent ni de pureté ni de sécurité ; aucune recette de fabrication, de dosage ou d’inhalation n’est fournie.

Carmagnola HH2026-045 ouvre sa fiche publique sans possession dans le chapitre fibres, sans inventer une performance de lot. Liens vers Botanique, Histoire bretonne et Cannabinoïdes. Quiz `profiles`, récompense `school:profiles`, budget historique et reçus conservés ; signature `v1`. Aucun gain par les exercices.

Livraison locale vérifiée : 306 tests ciblés, 67 contrôles SQL, 17 de concurrence PostgreSQL, 92 de fixture et permissions sur 387 migrations. Compilation Next.js/TypeScript réussie ; recette et aperçu à 320/1440 px. Les neuf migrations de l’école restent locales. Sources, limites, art et preuves : school-products-provenance.json, school-products-corpus.json, school-products-art-provenance.json.

### Parcours Comprendre ce qui améliore vraiment une récolte — version du 12 novembre 2026

Accès : `/arene/placard?view=school&module=prevention&passage=harvest-index`. Neuf chapitres, dix-huit leçons et activités, neuf bilans, trente-six questions avec cent quarante-quatre explications privées. Les applications concernent le chanvre autorisé, surtout graines et fibres ; les fleurs sont abordées par leurs critères analytiques de qualité.

Dix critères de résultat introduisent le parcours. Trois lots fictifs se comparent selon huit indicateurs avec unités et périmètres visibles ; l’eau non mesurée du lot B reste absente. Les bilans de matière sèche ferment sans chevauchement de pertes. Le carnet propose douze champs, trois essais distinguent comparaison valable et confusion, un plan guidé accepte deux organisations cohérentes. Dix conseils annoncent leurs preuves favorables, contradictoires, coûts et limites. Le glossaire commun atteint 470 entrées.

Les six exercices demandés sont intégrés : analyser trois lots, repérer une erreur d’unité, distinguer rendement brut et commercialisable, choisir une prochaine mesure, déceler un essai confondu et composer un plan fiable. Conclusion et justification sont corrigées ensemble.

L’atelier final présente six documents sur une baisse de qualité fictive. Le joueur consulte des pièces, relie au moins deux hypothèses à leurs preuves, choisit une action proportionnée et un suivi vérifiable. Observer davantage ou réserver le lot pour des contrôles ciblés peuvent être justes, avec leurs raisons. Un diagnostic non confirmé reste une conclusion recevable. Le brouillon reprend après rechargement et ne passe pas à un autre joueur.

Les coûts partiels ne sont pas des marges ; énergie et émissions restent distinctes. Ni le nom de la variété ni une astuce ne garantit un résultat. Les études et sources conservent leurs périmètres ; aucune donnée réelle n’est inventée à partir des exemples fictifs, aucun protocole d’augmentation de puissance en THC n’est fourni.

La scène illustrée est décorative, avec graines et fibres de chanvre ; elle ne constitue ni un diagnostic ni une mesure. Carmagnola HH2026-045 reste consultable sans possession, avec les limites de sa fiche. Huit renvois fonctionnels relient l’atelier aux parcours précédents.

quizId prevention / reward school:prevention conservés ; plafond de 1 000 centimes et total historique de 10 000 inchangés. Sélection r1 : dix questions parmi trente-six, couvrant les neuf chapitres (un chapitre reçoit deux questions distinctes). Activités sans gain ; anciens reçus et gains préservés. 20261112000900_kq_school_harvest_progress.sql testée en bases temporaires locales. Aucune des dix migrations de l’école appliquée au projet distant.

Vérifications locales : 345 tests ciblés, 70 contrôles SQL, 18 de concurrence PostgreSQL, 104 de fixture et permissions sur 388 migrations. Compilation Next.js/TypeScript réussie ; parcours complet et aperçu à 320/1440 px. Les 336 explications privées des neuf parcours sont absentes des scripts de production. Sources, limites, illustration et preuves dans school-harvest-provenance.json, school-harvest-corpus.json et school-harvest-art-provenance.json.
