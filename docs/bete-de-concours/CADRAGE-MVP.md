# Bete de concours - Cadrage MVP
## Les Chanvriers Bretons - Avril 2026

Document de cadrage produit et technique pour un module premium autonome ajoute au site existant.

Objectif:
- valoriser des lots premium sans casser la logique de prix standard du catalogue
- permettre une degustation communautaire structuree
- creer une preuve sociale visible et differenciante
- faire remonter un classement credible par saison de recolte

Le MVP decrit ici ne modifie pas la logique coeur de la boutique. Il ajoute un nouvel espace dedie, branche au panier et aux produits existants.

---

## 1. Decisions figees

- espace permanent
- plusieurs lots premium possibles par producteur
- avis reserves aux clients ayant achete le lot
- moderation obligatoire avant publication
- lot premium achetable depuis sa page
- onglet dedie `Bete de concours`
- page lot avec carte TCG / carrousel fleurs a gauche et guide de degustation a droite
- guide de degustation represente par un cahier a spirale ouvrable en popup
- pseudo specifique a ce module
- classement principal par saison de recolte
- contexte de consommation obligatoire dans chaque avis
- systeme de points testeurs et badges dedies

---

## 2. Vision produit

`Bete de concours` est une couche premium du site. Le module ne remplace pas la boutique classique. Il met en avant certains lots d'exception via:
- une presentation editoriale plus forte
- une fiche lot plus riche
- un guide de degustation structure
- une experience ludique de juge avec cahier a spirale, pages, jauges et badges
- un feed public de critiques moderees
- un classement vivant par saison de recolte

Logique de fond:
- les prix standard du catalogue restent en place
- un lot premium ne doit pas etre une simple hausse de prix invisible
- un lot premium doit etre identifiable, racontable, notable et comparable

Conclusion produit:
- 1 lot premium = 1 entree concours = 1 page dediee = 1 historique de notes = 1 place dans le classement

---

## 3. Positionnement par rapport au site existant

Le module doit reutiliser l'architecture actuelle quand c'est utile:
- design cartoon / TCG deja present dans le site
- panier et ajout au panier existants
- compte client existant
- commandes existantes
- patterns de moderation deja presents dans le blog

Le module ne doit pas:
- casser les categories boutique existantes
- changer la logique de prix de tous les produits par culture
- melanger les notes premium avec les commentaires du blog
- melanger les notes de plusieurs recoltes sur la meme base de classement

---

## 4. Perimetre MVP

Le MVP comprend:
- un nouvel onglet `Bete de concours`
- une page hub `/betes-de-concours`
- une page lot `/betes-de-concours/[slug]`
- un profil degustateur avec pseudo
- un guide de degustation reserve aux acheteurs
- une moderation admin des avis
- un feed public de critiques approuvees
- des classements par saison et par culture

Le MVP ne comprend pas:
- hall of fame multi-saisons
- recompenses communautaires complexes
- collection Panini complete pour les utilisateurs
- plusieurs avis par client sur un meme lot
- edition libre d'un avis deja soumis
- moteur de recommandation

---

## 5. Experience utilisateur

### 5.1 Page hub

Route:
- `/betes-de-concours`

Structure cible:
- colonne gauche
- zone centrale de carrousel
- zone d'informations secondaires ou bandeau classement/feed

Colonne gauche:
- categories empilees:
- `Outdoor`
- `Greenhouse`
- `Indoor`

Filtres visibles:
- saison de recolte active
- acces aux archives

Zone centrale:
- carrousel des lots correspondant a la categorie + saison choisies
- carte d'aperu de chaque lot
- score global
- rang dans la saison
- producteur
- prix
- CTA vers la fiche lot

Elements secondaires:
- apercu du top classement de la saison
- citations tournees de critiques approuvees

Classement testeurs:
- afficher un bloc `Top testeurs` directement sur le hub
- proposer deux onglets: `Saison` et `Global`
- sur desktop: top 3 en podium + tableau compact top 10
- sur mobile: carte `Mon rang` puis liste verticale top 10
- lien `Voir tout le classement` vers une vue dediee du classement testeurs

### 5.2 Page lot

Route:
- `/betes-de-concours/[slug]`

Layout desktop:
- colonne gauche: carte TCG + carrousel de fleurs + fiche technique + feed
- colonne droite: guide de degustation

Colonne gauche:
- carte TCG du lot
- carrousel de fleurs ou image principale
- nom du lot
- producteur
- type de culture
- saison de recolte
- score global
- badges ou rangs utiles
- fiche technique
- caracteristiques sensorielles
- liens vers le produit achetable
- critiques approuvees
- bandeau ou flux de citations qui tournent

Classement testeurs sur une fiche lot:
- ne pas mettre le classement complet sur la fiche lot pour eviter de distraire de la degustation
- afficher seulement le niveau et les badges des auteurs dans le feed de critiques
- chaque pseudo public renvoie vers le profil testeur public

Colonne droite:
- cahier de degustation ferme, visible a cote du carrousel
- apparence: carnet a spirale dans le style graphique du site
- couverture: nom du lot, saison, categorie, badge concours
- au clic: popup centrale avec animation d'ouverture
- navigation page precedente / page suivante
- progression visible dans le parcours
- reserve aux clients eligibles
- sinon message de verrouillage avec explication

### 5.3 Setup pseudo

Au premier acces a `Bete de concours`:
- si aucun pseudo n'existe pour le compte, demander un pseudo
- pseudo utilise uniquement dans ce module
- pseudo affiche publiquement a la place du prenom/nom

Regles recommandees:
- pseudo unique
- longueur raisonnable
- filtrage des termes interdits
- snapshot du pseudo au moment de l'avis pour garder la coherence historique

Profil testeur public:
- route cible: `/betes-de-concours/profils/[pseudo]`
- afficher niveau, points, rang global, rang saison, badges achievements et critiques approuvees
- masquer toute donnee personnelle client: nom reel, email, adresse, commandes

### 5.4 Guide de degustation interactif

Le carnet de degustation devient un guide de degustation ludique.

Objectif:
- accompagner le client comme un juge de concours
- expliquer les criteres avant de demander une note
- rendre la notation plus qualitative et moins mecanique
- creer un objet visuel memorable autour de `Bete de concours`

Interaction cible:
- etat ferme sur la page lot
- clic sur la couverture
- ouverture en popup centrale
- lecture page par page
- jauges de notation 1 a 10 conservees
- validation finale puis soumission en moderation

Structure recommandee:
- page 1: couverture du cahier
- page 2: preparation et contexte de degustation
- page 3: inspection visuelle
- page 4: nez et terpenes
- page 5: degustation
- page 6: standards attendus pour une fleur de concours
- page 7: verdict final et commentaire

Le guide ne doit pas etre un simple formulaire deplace dans une modale. Chaque page doit apporter soit:
- une explication utile
- une observation a faire
- une note a donner
- un choix aromatique
- une synthese de progression

---

## 6. Contexte de degustation

Chaque avis doit inclure un contexte minimal obligatoire avant les notes.

### 6.1 Mode de consommation

Champ obligatoire:
- `mode_de_consommation`

Valeurs V1:
- `vaporizer`
- `joint_no_tobacco`
- `joint_with_tobacco`
- `water_pipe`
- `other`

Champ optionnel:
- `consumption_details`

Exemples:
- `Volcano`
- `Dynavap`
- `bong verre`
- `feuille slim`

Objectif:
- rendre les notes plus interpretables
- permettre plus tard des sous-lectures par mode de consommation

### 6.2 Eventuels champs futurs hors MVP

- heure de degustation
- degustation seul / a plusieurs
- temperature du vapo
- taille de mouture

Ces champs restent hors MVP.

---

## 7. Guide de degustation

### 7.1 Regles generales

- 1 client = 1 avis par lot
- avis reserve aux clients ayant achete le lot
- verification faite sur commande payee
- avis soumis en statut `pending`
- publication uniquement apres moderation
- seuls les avis `approved` alimentent le classement

### 7.2 Criteres notes

Chaque critere est note de 1 a 10:
- aspect_visuel
- manucure
- sechage_curing
- nez_a_froid
- intensite_aromatique
- complexite_aromatique
- gout
- douceur_combustion
- persistance
- impression_generale

Ces criteres sont conserves en base pour le MVP, mais l'interface doit les presenter par familles de jugement inspirees des concours:
- apparence
- aromes / terpenes
- gout
- qualite de combustion ou vaporisation
- coherence generale

Ponderation indicative pour le score public:
- visuel: 15%
- nez / terpenes: 25%
- gout: 25%
- douceur / qualite de combustion ou vaporisation: 20%
- impression generale: 15%

Le score public peut rester calcule cote serveur afin d'eviter une logique divergente entre front et stats.

### 7.3 Tags aromatiques

Selection multi-choix:
- agrumes
- fruits_tropicaux
- fruits_rouges
- floral
- terreux
- boise
- pin_resineux
- epice_poivre
- diesel_gaz
- herbace
- sucre_gourmand
- autre_libre

### 7.4 Critique redigee

Champ texte libre:
- commentaire subjectif du degustateur
- publie seulement apres moderation

Format recommande:
- texte court a moyen
- ton libre mais lisible

### 7.5 Explications terpenes

Le guide doit expliquer simplement les familles de terpenes les plus utiles pour la degustation.

Terpenes V1:
- myrcene: terreux, fruit mur, musque, parfois vegetal
- limonene: citron, orange, agrumes, sensation vive
- pinene: pin, resine, foret, fraicheur
- caryophyllene: poivre, epices, bois sec
- linalol: floral, lavande, douceur aromatique
- humulene: houblon, boise, herbe seche
- terpinolene: floral, fruit frais, notes complexes

Chaque terpene peut etre associe a:
- une icone
- une couleur
- une courte definition
- des tags aromatiques proches

### 7.6 Standards fleur de concours

Le guide doit integrer une page pedagogique sur les standards attendus.

Signaux positifs:
- fleur propre, sans odeur de foin, moisi, humidite ou poussiere
- sechage maitrise, ni cassant ni trop humide
- curing net, avec aromes lisibles
- manucure soignee, peu de feuilles inutiles
- trichomes visibles et preserves
- structure coherente avec la culture et la variete
- arome identifiable, complexe et durable
- gout qui traduit le nez
- combustion ou vaporisation douce, non acre

Signaux negatifs:
- odeur de foin ou de cave
- humidite excessive
- fleur trop seche et friable
- gout agressif ou chimique
- combustion difficile
- aromes plats ou incoherents
- presence visible de defauts

### 7.7 Jauges de notation

Les jauges 1 a 10 restent le coeur de notation.

Lecture utilisateur:
- 1 a 3: faible ou defaut marque
- 4 a 6: correct mais perfectible
- 7 a 8: tres bon niveau
- 9 a 10: niveau concours

Design recommande:
- jauge visuelle par critere
- retour textuel court selon la note
- couleur differente par famille de critere
- micro-animation lorsque la note est choisie
- bloc de progression indiquant les pages restantes

Le systeme doit eviter de pousser artificiellement les utilisateurs vers 10. Les libelles doivent aider a noter avec discernement.

---

## 7.bis Points testeurs, badges et avantages

Le module doit ajouter un incentive ludique sans degrader la qualite des avis.

Principe:
- les points definitifs sont attribues apres moderation
- un avis rejete ne donne pas de points publics
- les badges valorisent la participation et la qualite
- les avantages sont debloques par paliers

### 7.bis.1 Points testeurs

Regles V1 retenues:
- fleur goutee avec critique approuvee: +20 points
- terpene dominant correctement trouve: +10 points par terpene
- bonus terpenes plafonne a +50 points par critique
- pouce haut recu sur une critique approuvee: +5 points
- pouce bas recu sur une critique approuvee: -1 point
- bonus admin pour critique utile: +30 points
- bonus admin pour critique excellente: +75 points

Regles de garde-fou:
- seuls les clients ayant deja achete peuvent voter sur les critiques
- un client ne peut pas voter sur sa propre critique
- un seul vote par critique et par client, modifiable
- un client ne peut donc pas cumuler plusieurs pouces sur une meme critique
- les pouces bas servent aussi de signalement progressif en moderation
- les points definitifs doivent etre journalises pour permettre audit et correction

Les points doivent etre journalises pour permettre audit et correction.

### 7.bis.2 Paliers

Paliers V1:
- Curieux: 0 points
- Gouteur: 100 points
- Nez Fin: 300 points
- Juge Amateur: 750 points
- Testeur Certifie: 1500 points
- Maitre Terpene: 3000 points
- Jury Saisonnier: statut special attribue par saison

### 7.bis.3 Badges

Les badges sont des achievements facon jeu video. Ils ne remplacent pas les niveaux:
- les niveaux mesurent la progression en points
- les badges marquent des actions ou exploits precis
- certains badges peuvent debloquer des boosters Kanab Quest, mais pas tous
- la liste ci-dessous est une proposition a valider badge par badge

Badges achievements V1 proposes:

| Badge | Condition de deblocage | Recompense suggeree |
| --- | --- | --- |
| Premier Carnet | 1ere critique approuvee | 1 booster |
| Premiere Piste | 1 terpene dominant trouve | 1 booster |
| Combo Aromatique | 3 terpenes corrects sur une meme critique | 3 boosters |
| Nez Absolu | tous les terpenes dominants trouves sur une critique | 3 boosters |
| Nez Divin | Nez Absolu obtenu sur 3 critiques | 6 boosters |
| Tour de Saison | 3 fleurs concours goutees sur une meme saison | 2 boosters |
| Marathon des Lots | 10 critiques approuvees au total | 4 boosters |
| Expert Outdoor | 3 critiques approuvees sur des lots outdoor | 1 booster |
| Expert Greenhouse | 3 critiques approuvees sur des lots greenhouse | 1 booster |
| Expert Indoor | 3 critiques approuvees sur des lots indoor | 1 booster |
| Critique Utile | 1 critique marquee utile par admin | 1 booster |
| Plume d'Or | 1 critique marquee excellente par admin | 3 boosters |
| Voix Respectee | 25 pouces haut recus au total | 2 boosters |
| Validateur Serieux | 25 votes donnes sur les critiques des autres | 1 booster |
| Jury Saisonnier | top 10 du classement testeurs de saison | 10 boosters |

Les badges peuvent etre affiches:
- sur le profil degustateur
- dans le feed public des critiques
- dans le guide apres validation

### 7.bis.4 Avantages

Avantages retenus:
- boosters Kanab Quest debloques par paliers
- boosters Kanab Quest debloques par certains badges achievements
- vote special prix du public en fin de saison pour les meilleurs profils

Regle MVP:
- prevoir le modele de donnees et l'affichage des paliers
- une recompense de palier ou de badge ne peut etre reclamee qu'une seule fois
- les boosters reclames sont ajoutes directement a l'album Kanab Quest

---

## 8. Modele de donnees

Le MVP doit etre porte par des tables dediees pour ne pas polluer `products` et `blog_comments`.

### 8.1 `contest_seasons`

Role:
- representer une saison de recolte

Champs:
- `id`
- `code`
- `label`
- `year`
- `harvest_start`
- `harvest_end`
- `is_active`
- `is_archived`
- `created_at`
- `updated_at`

Exemples:
- `recolte-2026`
- `Recolte Automne 2026`

### 8.2 `contest_entries`

Role:
- representer un lot premium en concours

Champs:
- `id`
- `slug`
- `title`
- `product_id`
- `producer_id`
- `season_id`
- `category`
- `story`
- `technical_sheet`
- `image_url`
- `gallery_urls`
- `is_published`
- `created_at`
- `updated_at`

Notes:
- `category` ici signifie `outdoor | greenhouse | indoor`
- `product_id` pointe vers le produit achetable

### 8.3 `contest_profiles`

Role:
- stocker le pseudo dedie

Champs:
- `customer_id`
- `pseudo`
- `created_at`
- `updated_at`

### 8.4 `contest_reviews`

Role:
- stocker le coeur d'un avis

Champs:
- `id`
- `entry_id`
- `season_id`
- `customer_id`
- `pseudo_snapshot`
- `consumption_method`
- `consumption_details`
- `comment`
- `status`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

Contrainte cle:
- unique `(entry_id, customer_id)`

### 8.5 `contest_review_scores`

Role:
- stocker les notes par critere

Champs:
- `id`
- `review_id`
- `criterion`
- `score`
- `created_at`

Contrainte:
- un score par critere et par review

### 8.6 `contest_review_aroma_tags`

Role:
- stocker les aromes coches

Champs:
- `id`
- `review_id`
- `tag`
- `custom_label`
- `created_at`

### 8.7 Vues ou vues materialisees

Recommande des le depart:
- `contest_entry_stats`
- `contest_rankings_current`

Elles doivent servir a:
- calculer les moyennes
- compter les avis approuves
- preparer les tops par saison
- eviter des agregations lourdes en front

### 8.8 `contest_tester_points`

Role:
- journaliser les points gagnes par les degustateurs

Champs:
- `id`
- `customer_id`
- `review_id`
- `season_id`
- `reason`
- `points`
- `created_at`

Notes:
- la somme des points peut etre calculee depuis ce journal
- eviter de stocker uniquement un compteur opaque

### 8.9 `contest_badges`

Role:
- definir les badges disponibles

Champs:
- `id`
- `code`
- `label`
- `description`
- `icon`
- `season_id`
- `is_active`
- `created_at`

### 8.10 `contest_profile_badges`

Role:
- attribuer des badges aux degustateurs

Champs:
- `id`
- `customer_id`
- `badge_id`
- `review_id`
- `awarded_at`

Contrainte:
- un meme badge ne doit pas etre attribue deux fois au meme client sauf badge saisonnier explicitement versionne

### 8.11 `contest_rewards`

Role:
- definir les avantages debloquables par palier

Champs:
- `id`
- `code`
- `label`
- `description`
- `required_points`
- `reward_type`
- `is_active`
- `created_at`

### 8.12 `contest_reward_unlocks`

Role:
- tracer les avantages debloques par client

Champs:
- `id`
- `customer_id`
- `reward_id`
- `status`
- `unlocked_at`
- `claimed_at`

Statuts:
- `unlocked`
- `claimed`
- `expired`

### 8.13 `contest_review_votes`

Role:
- stocker les pouces haut / bas sur les critiques approuvees
- alimenter les points de reputation et le signalement de critiques contestees

Champs:
- `id`
- `review_id`
- `voter_customer_id`
- `value`
- `created_at`
- `updated_at`

Contraintes:
- `value` vaut `1` pour pouce haut ou `-1` pour pouce bas
- unique `(review_id, voter_customer_id)`
- un client ne peut pas voter pour sa propre critique
- le vote est reserve aux clients ayant deja achete
- le vote peut etre change de `+1` a `-1`, ou inversement, mais jamais duplique

### 8.14 Vues testeurs

Vues recommandees:
- `contest_tester_points_summary`
- `contest_tester_rankings_global`
- `contest_tester_rankings_by_season`
- `contest_review_vote_summary`

Elles doivent servir a:
- afficher les profils publics de testeurs
- afficher la barre de progression
- preparer les classements global et saison
- afficher les badges achievements debloques
- detecter les critiques a revoir apres signalements

---

## 9. Eligibilite d'un avis

Un utilisateur peut noter un lot si:
- il est connecte
- il a un compte client valide
- il a au moins une commande `paid`
- cette commande contient le `product_id` lie au lot premium

Regle MVP:
- une commande payee suffit a debloquer le guide

Cas speciaux a gerer:
- commande annulee
- lot retire du catalogue
- produit remplace en cours de saison

Approche recommandee:
- figer l'eligibilite sur le `product_id` du lot au moment de la notation

---

## 10. Moderation

### 10.1 Statuts

Statuts des avis:
- `pending`
- `approved`
- `rejected`

### 10.2 Regles

- un avis `pending` n'est jamais public
- un avis `approved` est visible et compte dans les classements
- un avis `rejected` reste non public et n'entre pas dans les stats

### 10.3 Back-office

Le back-office MVP doit permettre:
- lister les avis par statut
- filtrer les avis signales par pouces bas
- lire l'avis complet
- voir le pseudo
- voir le lot et la saison
- approuver
- rejeter
- confirmer une critique contestee
- marquer une critique comme utile ou excellente

Option utile:
- note interne de moderation

---

## 11. Classements

### 11.1 Axe principal

Le classement principal doit etre calcule par:
- saison de recolte

Puis declinaison par:
- categorie de culture

Puis declinaison complementaire par:
- critere

### 11.2 Vues classement V1

Classements des lots:
- top global de la saison
- top outdoor de la saison
- top greenhouse de la saison
- top indoor de la saison
- top visuel
- top gout
- top nez a froid

Classements des testeurs:
- classement global toutes saisons
- classement par saison
- top saison pour attribuer le statut `Jury Saisonnier`
- top global pour afficher un statut prestige sur le profil public

Regles de departage des testeurs:
- nombre de critiques approuvees
- nombre de terpenes correctement trouves
- solde pouces haut / pouces bas
- critique approuvee la plus recente

### 11.3 Regle de fiabilite

Le MVP doit eviter les classements absurdes dus a un faible nombre d'avis.

Recommandations:
- seuil minimum de visibilite dans un classement: 5 avis approuves
- utilisation d'un score lisse plutot qu'une moyenne brute

Principe:
- un lot avec 1 avis a 10 ne doit pas depasser un lot avec 30 avis a 8.8

### 11.4 Archives

Le systeme doit prevoir:
- une saison active par defaut
- des archives consultables
- un hall of fame multi-saisons pour les meilleurs testeurs globaux

---

## 12. API cible

### 12.1 Public

- `GET /api/contest/seasons`
- `GET /api/contest/entries?season=&category=`
- `GET /api/contest/entries/[slug]`
- `GET /api/contest/feed?season=&category=`
- `GET /api/contest/rankings?season=&category=`
- `GET /api/contest/testers/rankings?scope=global|season&season=`
- `GET /api/contest/testers/[pseudo]`

### 12.2 Client connecte

- `POST /api/contest/profile`
- `GET /api/contest/profile`
- `POST /api/contest/reviews`
- `GET /api/contest/reviews/me?entryId=`
- `POST /api/contest/reviews/[reviewId]/vote`
- `GET /api/contest/tester/progress`
- `GET /api/contest/tester/badges`
- `GET /api/contest/tester/rewards`

### 12.3 Admin

- `GET /api/admin/contest/reviews?status=`
- `PATCH /api/admin/contest/reviews/[id]`
- `GET /api/admin/contest/entries`
- `POST /api/admin/contest/entries`
- `PATCH /api/admin/contest/entries/[id]`
- `GET /api/admin/contest/seasons`
- `POST /api/admin/contest/seasons`
- `GET /api/admin/contest/badges`
- `POST /api/admin/contest/badges`
- `GET /api/admin/contest/rewards`
- `POST /api/admin/contest/rewards`
- `POST /api/admin/contest/tester-points`

---

## 13. Admin MVP

Le panneau admin doit permettre:
- creer une saison
- activer ou archiver une saison
- creer un lot premium
- lier un lot a un produit achetable
- lier un lot a un producteur
- definir sa categorie
- definir sa saison
- publier / depublier
- moderer les avis
- consulter les stats par lot
- consulter les points testeurs
- attribuer un bonus de points manuel
- creer ou desactiver des badges
- creer ou desactiver des avantages

Le back-office peut reutiliser le style d'administration existant du site.

---

## 14. Reemploi technique probable

Le module peut reutiliser des patterns deja presents:
- visuel TCG deja utilise dans le site
- ajout au panier existant
- authentification client existante
- verification des commandes existantes
- moderation type blog deja presente

Le module doit rester decouple dans son modele de donnees.

---

## 15. Phasage recommande

### Phase 1 - Cadrage final

- valider les criteres definitifs
- valider les tags aromatiques
- valider la structure d'une saison
- decider si un lot premium = toujours un SKU dedie

### Phase 2 - Socle data

- migrations Supabase
- types TypeScript
- vues SQL de stats et classement
- tables points, badges et avantages
- logique d'eligibilite achat
- garde-fou local-only avant toute exposition

### Phase 3 - Admin

- CRUD saisons
- CRUD lots premium
- moderation des avis
- gestion badges et avantages V1

### Phase 4 - Front hub

- page hub
- rail gauche categories
- filtre saison
- carrousel des lots
- apercu classement

### Phase 5 - Front fiche lot

- page lot
- carte TCG
- carrousel de fleurs
- fiche technique
- bloc achat
- feed de citations
- cahier de degustation ferme visible a droite

### Phase 6 - Guide de degustation

- setup pseudo
- guide reserve aux acheteurs
- cahier a spirale ouvrable en popup
- parcours page par page
- explications terpenes
- page standards fleur de concours
- jauges de notation 1 a 10
- soumission
- etats `pending`

### Phase 7 - Gamification V1

- points testeurs
- paliers
- badges achievements
- votes pouces haut / bas
- signalement des critiques contestees
- classements testeurs global et saison
- affichage du prochain palier
- attribution apres moderation

### Phase 8 - Finition

- responsive
- details UX
- microcopy
- validation des cas limites

---

## 16. Points restant a trancher

- seuil d'entree dans les classements: 3, 5 ou 10 avis approuves
- un lot premium est-il toujours un nouveau SKU
- longueur max de la critique publique
- changement de pseudo libre ou avec delai
- format exact du libelle de saison
- nombre exact de boosters par palier
- liste finale des 15 badges achievements
- duree de validite des avantages debloques
- wording final des standards de concours pour rester pedagogique et responsable

---

## 16.bis Garde-fou de deploiement

- le module reste desactive par defaut
- l'activation locale passe par `CONTEST_FEATURE_ENABLED=true`
- pour afficher le lien dans l'interface locale, ajouter aussi `NEXT_PUBLIC_CONTEST_FEATURE_ENABLED=true`
- si l'application tourne en `production`, `CONTEST_FEATURE_ENABLED=true` ne suffit pas
- l'ouverture production doit etre volontaire: ajouter aussi `CONTEST_FEATURE_ALLOW_PRODUCTION=true`
- pour afficher le panneau admin concours en production, ajouter aussi `NEXT_PUBLIC_CONTEST_FEATURE_ALLOW_PRODUCTION=true`
- avant toute ouverture production, verifier que les migrations SQL concours et les policies RLS associees sont appliquees sur la bonne base

---

## 17. Sources d'inspiration

Le choix des criteres s'appuie sur des grilles publiques de competitions cannabis ou proches:
- Spannabis Champions Cup: https://spannabis.es/bilbao/en/home/
- High Times Cannabis Cup FAQ: https://cannabiscup.com/frontpage/
- Karma Cup judging portal: https://thekarmacup.com/cannabis-cup/judging/how-to-judge/
- Stargazer Cannabis Cup official rules: https://www.stargazerfest.com/stargazer-cannabis-cup/official-rules
- Karma Cup scoring system: https://thekarmacup.com/cannabis-competition-scoring-system/

Les criteres ont ensuite ete adaptes au contexte du site pour privilegier:
- qualite de fleur
- experience sensorielle
- comparabilite des avis
- lisibilite pour l'utilisateur

Points recurrents observes dans les grilles publiques:
- apparence / trichomes / manucure
- arôme / profil terpenique / intensite
- gout / traduction du nez en bouche
- qualite de combustion ou vaporisation
- douceur / proprete de l'experience
- impression generale
