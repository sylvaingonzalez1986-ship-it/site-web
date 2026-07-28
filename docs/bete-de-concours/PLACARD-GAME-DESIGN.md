# Le Placard - Game design et architecture MVP

Statut: recherche initiale conservee + orientation jouable actuelle  
Univers: L'Arene / Hemp Heroes / carnet de degustation  
Plateforme: web responsive, Next.js, Vercel et Supabase

## 0. Orientation actuelle - source de verite du prototype

Les sections historiques plus bas documentent la premiere piste de simulation
quotidienne. Elles restent utiles pour le vocabulaire, la sobriete technique et
les futures extensions, mais ne decrivent plus la boucle jouable actuelle.

La version locale actuelle est un jeu de cartes et de des grand public:

```text
Album Kanab Quest
  -> choisir 1 Buddie CBD reel
  -> choisir 1 Substrat + autant de copies La Botte que l'album le permet
  -> piocher une main de 10 cartes a chaque etape
  -> jouer 6 etapes courtes avec 3 des
  -> gagner et depenser de l'XP pour jouer des cartes
  -> creer 1 carte Fleur unique
  -> choisir un rival selon le risque Elo
  -> jouer 3 manches de jury
  -> bruler les 2 Fleurs au verdict
  -> progresser en cote, ligue, saison et collection
```

Regles validees:

- 3 des: `1` Danger, `2-3` neutre, `4-6` reussite, `6` Etincelle;
- 6 etapes: Germination, Enracinement, Croissance, Floraison, Recolte,
  Sechage et affinage;
- 36 cartes consommables dans `La Botte du Chanvrier`;
- deck sans limite arbitraire: chaque copie possedee peut etre engagee;
- main deterministe de 10 cartes, figee pendant toute l'etape; aucune carte
  brulee n'est remplacee avant l'etape suivante, les cartes non jouees
  retournent alors dans la rotation et les copies brulees en sont retirees;
- un changement de main gratuit par culture, uniquement avant toute action;
- le constructeur affiche la probabilite de voir chaque reference dans la
  premiere main afin de rendre visible le compromis entre taille et regularite;
- il resume aussi la couverture Racines, Eau, Climat, Ravageurs, Floraison et
  Sechage, sans bloquer les decks incomplets;
- trois raccourcis permettent d'engager une copie de chaque reference, toutes
  les copies jouables ou de vider le deck avant ajustement manuel;
- un emplacement favori local memorise le Buddie, le Substrat et chaque copie;
  sa restauration retire automatiquement les copies brulees depuis;
- tout Substrat est brule au depart et toute carte La Botte est brulee a
  chaque utilisation;
- les PBI restent hors deck, apparaissent apres la Loupe et ciblent uniquement
  le ravageur revele;
- 9 Buddies CBD jouables et non consommables;
- 30 situations de culture, soit 5 par etape, dont pucerons, acariens et
  thrips;
- 15 formats de jury repartis en Presentation, Aromes et Maitrise;
- 3 defis quotidiens parmi 9, verrouilles au depart de la culture;
- classement Elo, ligues Graine / Pousse / Canopee / Fleur / Grand Cru;
- 1 booster La Botte toutes les 3 victoires consecutives;
- la Fleur du joueur et celle de l'adversaire sont brulees au verdict;
- aucune boucle temps reel, aucun moteur 2D, aucun WebSocket;
- calcul local deterministe, sauvegarde locale avec journaux de reprise;
- futur serveur: mutations service-role, burns atomiques, snapshot du
  classement une fois par jour Europe/Paris.

Sources de verite techniques:

- `src/lib/kanab-quest-game.ts`: culture, situations, cartes et des;
- `src/lib/kanab-quest-battle.ts`: Fleur, jury et burn;
- `src/lib/kanab-quest-ranking.ts`: Elo, matchmaking et ligues;
- `src/lib/kanab-quest-challenges.ts`: rotation quotidienne;
- `src/lib/kanab-quest-booster.ts`: boosters et recompenses de serie;
- `src/lib/kanab-quest-repository.ts`: persistance locale atomique;
- `supabase/migrations/20260722000100_kanab_quest_game_foundation.sql`:
  fondation serveur non appliquee.

### 0.1 Statut de la verticale locale

La verticale locale est fonctionnellement complete pour les tests produit:

- onboarding memorise et rejouable;
- inventaire a exemplaires physiques, boosters et registre de burns;
- deck sans plafond, raccourcis de composition, probabilites, couverture et
  favori restaure selon le stock restant;
- main figee de 10 copies par etape et un changement de main par culture;
- 30 situations toutes atteignables, 6 etapes, pression, XP, combos et PBI;
- carte Fleur unique avec statistiques et code d'integrite;
- choix du rival, programme du jury, duel en 3 manches et burn des 2 Fleurs;
- Elo, ligues, saison, 9 defis quotidiens et booster de serie;
- sauvegardes locales, journaux de reprise et validation anti-injection.

Ne sont volontairement pas actives dans cette verticale:

- comptes et inventaires Supabase reels;
- matchmaking entre deux comptes reels;
- classement partage et rotation serveur quotidienne;
- application de la migration, push, preview Vercel ou production;
- illustrations finales de la collection La Botte.

Ces points exigent une autorisation distincte de connexion ou de deploiement et
ne doivent pas etre simules comme termines par le prototype local.

## 1. Vision

Le Placard est un jeu de cartes de culture asynchrone relie a L'Arene. Le joueur utilise une strain CBD qu'il possede deja dans sa collection Hemp Heroes, conduit une culture virtuelle par decisions quotidiennes, transforme le resultat en carte Recolte unique, puis la presente dans des concours ou des duels 1 contre 1.

Promesse joueur:

> Choisis un Buddie de ton album, revele son potentiel par tes decisions et fais-en une bete de concours.

Le jeu doit etre:

- une simulation lisible, dans laquelle chaque resultat a une cause;
- une extension naturelle du carnet et de la collection existants;
- accessible en moins de deux minutes par jour;
- competitif sans etre pay-to-win;
- leger pour le navigateur, Vercel et Supabase;
- coherent avec le style cartoon retro et les personnages du site.

## 2. Piliers

### 2.1 Collection utile

Une carte Hemp Heroes possedee peut debloquer une strain cultivable. La carte n'est jamais consommee et conserve son recto, son dos, son numero et sa rarete de collection.

### 2.2 Simulation causale

Le resultat depend du potentiel de la strain, de l'environnement, des equipements, des decisions et du temps. Une carte ne donne pas arbitrairement `+3 qualite`: elle modifie un parametre du systeme, puis le moteur en calcule les consequences.

### 2.3 Decisions rares mais importantes

Un tour est disponible chaque jour. Le joueur lit le diagnostic, prend une ou deux decisions et quitte le jeu. Une absence ralentit ou laisse agir les automatismes, mais ne detruit pas gratuitement la culture.

### 2.4 Competition equitable

La rarete de collection ne determine pas la victoire. Les concours changent de criteres et les duels opposent des Recoltes de categorie comparable. Le format miroir impose la meme strain aux deux joueurs.

### 2.5 Sobriete technique

Aucune boucle serveur, aucun moteur 2D, aucun WebSocket et aucune ecriture horaire. La simulation est deterministe et calculee a la demande.

## 3. Boucle globale

```text
Carnet de degustation valide
        -> points de reputation permanents
        -> Jetons de culture depensables
        -> boosters et nouvelles cartes
        -> choix d'une strain possedee
        -> culture quotidienne
        -> sechage et affinage
        -> carte Recolte unique
        -> concours / duel / classement
        -> rubans, cosmetiques, maitrise et boosters
```

Deux economies doivent rester distinctes:

- reputation de degustateur: permanente, jamais depensee;
- Jetons de culture: depensables pour lancer une culture ou certaines actions.

La note donnee a un produit ne doit jamais augmenter directement une recompense. Les gains du carnet reposent sur sa validation, sa completude, sa precision et ses achievements.

## 4. Les cartes

### 4.1 Carte Buddie

La definition de carte existante reste la source de verite. Une carte compatible porte le sceau visuel `Cultivable` et debloque son profil de simulation.

Regles:

- elle reste dans l'album;
- elle n'est pas verrouillee pendant une culture;
- un seul exemplaire suffit pour debloquer la strain;
- les doublons ne multiplient pas sa puissance;
- normal, brillant ou dore ont le meme effet de jeu;
- la rarete indique la valeur de collection et eventuellement la complexite, pas la force brute.

### 4.2 Carte Recolte

Elle est creee a la fin d'une culture et devient immuable. Elle contient:

- strain et carte Buddie d'origine;
- pseudo du joueur;
- numero de recolte;
- saison et date;
- version du moteur;
- statistiques finales;
- profil aromatique simule;
- score de sobriete;
- principaux evenements de culture;
- cadre et rubans obtenus.

La Recolte, et non la carte Buddie, participe aux concours et duels.

### 4.3 Sous-ensemble MVP

Le catalogue comprend 52 definitions Hemp Heroes. Le MVP ne doit pas attribuer un profil agronomique aux 52 cartes avant validation documentaire. Il commence avec 6 strains contrastees choisies parmi les cartes existantes, par exemple:

- Charlotte's Web;
- Cannatonic;
- ACDC;
- Sour Tsunami;
- Hawaiian Haze;
- Carmagnola.

`L'Arbre Mere - Toutes Varietes` est un personnage legendaire fictif et ne lance pas une culture standard.

Chaque profil doit indiquer la provenance et le niveau de confiance de ses donnees. Les appellations commerciales ne doivent pas etre presentees comme des genotypes universellement stables.

## 5. Une culture

### 5.1 Structure MVP

Une partie dure 12 tours quotidiens:

1. installation;
2. enracinement I;
3. enracinement II;
4. croissance I;
5. croissance II;
6. croissance III;
7. transition;
8. floraison I;
9. floraison II;
10. maturation;
11. sechage;
12. affinage et revelation.

La duree peut varier plus tard selon la strain. Pour le MVP, une structure commune simplifie l'equilibrage et l'explication.

### 5.2 Etat simule

Etat visible ou diagnostique:

- phase;
- vigueur;
- biomasse;
- masse racinaire;
- eau disponible;
- nutrition simplifiee N/P/K;
- temperature;
- humidite;
- circulation d'air;
- stress cumule;
- pression sanitaire;
- maturite;
- potentiel aromatique conserve.

Le moteur peut conserver des valeurs plus precises que l'interface. Les capteurs ameliorent la precision des estimations visibles plutot que de donner un bonus abstrait.

### 5.3 Calcul par facteur limitant

Modele conceptuel:

```text
assimilation = potentiel_genetique
             * facteur_lumiere
             * facteur_hydrique
             * facteur_racinaire
             * facteur_nutritif
             * facteur_climatique
             * surface_foliaire_active
```

La valeur la plus defavorable limite la progression. Une lampe puissante ne compense pas des racines asphyxiees.

Le stress possede une memoire:

```text
stress_jour = lumiere + eau + racines + climat + sanitaire - recuperation
```

Un stress leger est recuperable. Un stress fort et repete reduit certains potentiels finaux.

### 5.4 Une decision quotidienne

Le compte rendu montre:

- ce qui a change depuis le dernier tour;
- l'explication causale;
- le niveau de confiance du diagnostic;
- deux ou trois interventions possibles;
- les consequences immediates connues;
- les risques possibles.

Le joueur dispose de deux points d'action. Il peut modifier un reglage, jouer une carte Technique, installer un equipement ou ne rien changer.

### 5.5 Incertitude

Le moteur connait l'etat reel. Le joueur voit une estimation conditionnee par ses capteurs et sa maitrise de la strain.

Exemple:

```text
Sans capteur: substrat legerement humide
Capteur commun: humidite estimee entre 38 et 48
Capteur expert: humidite estimee entre 41 et 45
```

Cette incertitude cree du diagnostic sans recourir a un hasard opaque.

## 6. Equipements et techniques

### 6.1 Permanents

- lampe;
- pot;
- substrat;
- ventilation;
- capteur;
- automatisation.

Chaque permanent modifie des capacites physiques: puissance, homogeneite, retention, drainage, debit d'air, precision ou regle automatique.

### 6.2 Techniques

- observation approfondie;
- ajustement climatique;
- soin racinaire;
- reequilibrage;
- inspection sanitaire;
- recuperation;
- preparation au sechage.

Une Technique produit un effet explicable et est journalisee. Le MVP peut proposer un deck de 8 Techniques, avec une main de 3 et un maximum d'une Technique jouee par tour.

## 7. Maitrise d'une strain

Chaque strain possede une progression independante:

- Decouverte: 0 recolte;
- Apprentie: 1 recolte;
- Confirmee: 3 recoltes;
- Experte: 6 recoltes et un defi specifique;
- Maitrise: 10 recoltes et un podium.

La maitrise revele de l'information:

- fourchettes plus precises;
- sensibilites documentees;
- historique compare;
- diagnostics plus fiables;
- consequences mieux anticipees.

Elle ne doit pas creer un important bonus statistique permanent.

## 8. Recolte et notation

Statistiques de concours MVP sur 100:

- Aspect;
- Nez;
- Complexite;
- Douceur;
- Persistance;
- Proprete;
- Rendement;
- Sobriete.

Elles emergent de la simulation. Le score general est informatif, mais aucun concours ne doit se resumer a ce total.

Exemple de reglement:

```text
Coupe aromatique
Nez          30 %
Complexite   25 %
Persistance  20 %
Proprete     15 %
Sobriete     10 %
```

## 9. Concours

### 9.1 Concours asynchrone

Le joueur inscrit une Recolte avant la cloture. A la cloture, toutes les Recoltes sont evaluees sur un instantane du reglement. Le classement est calcule une fois puis publie.

Formats MVP:

- concours ouvert;
- concours par tranche de puissance;
- concours d'une strain imposee;
- concours debutant;
- concours de sobriete.

### 9.2 Recompenses

Priorite aux recompenses horizontales:

- ruban sur la carte;
- cadre saisonnier;
- titre de profil;
- booster;
- fragments de fabrication;
- illustration ou pose alternative;
- invitation a un concours special.

Les meilleurs joueurs ne doivent pas recevoir systematiquement des cartes plus puissantes.

## 10. Duels 1 contre 1

Le duel est asynchrone et se joue en trois manches:

1. presentation: Aspect et Proprete;
2. analyse: Nez et Complexite;
3. verdict: Douceur et Persistance.

Chaque joueur engage:

- une Recolte;
- trois cartes Jury choisies avant resolution.

Deux manches gagnees donnent la victoire. La seed, le reglement et les choix produisent un resultat deterministe et auditable.

Formats:

- amical;
- classe avec matchmaking par puissance;
- miroir avec strain identique;
- evenement saisonnier.

Au verdict, les deux Fleurs generees sont brulees, victoire comme defaite.
La carte Buddie d'origine, les Heritage et les Jetons ne sont pas detruits.
Un duel expire sans verdict libere les deux Fleurs sans burn.

## 11. UX et direction artistique

### 11.1 Navigation

Le carnet de L'Arene accueille quatre vues:

```text
Degustations | Collection | Placard | Concours
```

Sur mobile, elles deviennent des marque-pages du carnet.

### 11.2 Roles des personnages

- Charles: accueil, boosters et revelation de la Recolte;
- Cultivateur: choix quotidiens;
- Inspecteur: diagnostic et explication causale;
- Juge: reglements, duels et resultats;
- duo de L'Arene: commentaires et progression.

Les personnages ne sont pas decoratifs. Chacun correspond a une fonction stable.

### 11.3 Ecran du Placard

La carte de la strain occupe le centre. Autour d'elle se trouvent les petites cartes permanentes. Le diagnostic et les actions sont presentes dans des panneaux de carnet.

Deux lectures sont disponibles:

- simple: phrases et alertes traduites par les personnages;
- expert: valeurs, courbes courtes et historique.

### 11.4 Systeme visuel

Reutiliser:

- fond creme `#f7f4ee`;
- menthe `#bac59d`;
- turquoise des mascottes;
- encre `#1a1a1a`;
- contours noirs de 2 a 3 px;
- ombres decalees;
- trames retro;
- typographie display et annotations manuscrites;
- boutons cartoon existants;
- dos TCG existant.

Eviter:

- interface sombre et neon;
- moteur 2D libre;
- animation permanente;
- tableaux scientifiques exposes par defaut;
- style graphique different de L'Arene.

### 11.5 Revelation finale

La Recolte utilise le rituel du booster:

1. carte retournee avec le dos existant;
2. intervention de Charles;
3. retournement CSS;
4. statistiques revelees progressivement;
5. ajout a l'herbier et proposition d'inscription.

## 12. Architecture sobre

### 12.1 Principe

Le moteur est une bibliotheque TypeScript pure et versionnee. Il ne fait aucun appel reseau. Il recoit un etat, une configuration, une seed et un nombre de jours a simuler, puis retourne le nouvel etat et les evenements.

```text
route serveur
  -> lecture de la culture
  -> simulation des jours manquants en memoire
  -> application de l'action
  -> RPC transactionnelle unique
```

### 12.2 Frequence

- aucun tick serveur permanent;
- aucun Realtime;
- aucune ecriture horaire;
- maximum une consolidation quotidienne par culture active;
- aucune operation pour un joueur absent;
- rattrapage de plusieurs jours en un calcul au retour.

### 12.3 Tables proposees

`game_variety_profiles`

- `card_definition_id` unique;
- `is_cultivable`;
- `difficulty`;
- `model_parameters jsonb`;
- `data_sources jsonb`;
- `confidence_level`;
- `simulation_version`.

`game_cultures`

- `id`;
- `user_id`;
- `card_definition_id`;
- `status`;
- `current_day`;
- `last_simulated_at`;
- `next_turn_at`;
- `configuration jsonb`;
- `state jsonb`;
- `random_seed`;
- `engine_version`;
- `row_version`;
- timestamps.

`game_culture_events`

- `culture_id`;
- `day`;
- `event_type`;
- `card_definition_id` nullable;
- `payload jsonb`;
- timestamp.

`game_harvests`

- `culture_id` unique;
- `user_id`;
- `card_definition_id`;
- `final_scores jsonb`;
- `aroma_profile jsonb`;
- `quality_tier`;
- `visual_variant`;
- `engine_version`;
- timestamp.

`game_matches`

- joueurs et Recoltes;
- reglement versionne;
- choix Jury;
- seed;
- resultat;
- statut et timestamps.

`game_competitions` et `game_competition_entries`

- reglement versionne;
- fenetre d'inscription;
- cloture;
- Recolte inscrite;
- score et rang materialises.

### 12.4 Securite et concurrence

- RLS sur toutes les donnees personnelles;
- inventaire existant comme preuve de possession;
- mutations uniquement par route serveur et RPC;
- verrouillage optimiste avec `row_version`;
- `expected_version` obligatoire pour toute action;
- fonctions idempotentes;
- seed creee cote serveur;
- Recoltes immuables;
- resultats de concours reproductibles.

### 12.5 Traitement quotidien

Un seul job quotidien traite uniquement:

- concours arrives a cloture;
- duels expires;
- classement materialise;
- notifications groupees;
- archivage leger.

Les cultures individuelles sont calculees a l'ouverture. Le job collectif travaille par petits lots avec reprise idempotente.

### 12.6 Cache

Cache public long pour:

- definitions de cartes;
- profils de strains;
- reglements;
- podiums;
- pages publiques de Recoltes.

Jamais de cache public pour:

- inventaire;
- culture active;
- Jetons;
- cartes Jury cachees;
- resultat non revele.

### 12.7 Budget de performance

Par action joueur:

- maximum 2 lectures Supabase;
- une RPC d'ecriture;
- etat de culture inferieur a 10 Ko;
- reponse API inferieure a 100 Ko;
- moteur cible inferieur a 50 ms de CPU;
- route complete cible inferieure a 500 ms hors incident reseau;
- maximum 40 evenements conserves en lecture chaude.

## 13. Performance frontend

- code du jeu charge dynamiquement seulement dans Le Placard;
- aucun code du moteur dans le bundle navigateur;
- WebP ou AVIF;
- miniatures dans l'album;
- une seule grande illustration chargee;
- lazy loading hors ecran;
- animations CSS courtes;
- aucun canvas ou moteur physique dans le parcours principal;
- aucune generation d'image a l'affichage;
- carte partageable generee uniquement sur demande puis stockee.

## 14. Anti pay-to-win

- une carte possedee debloque la strain pour toujours;
- doublons convertibles en cosmetiques, fragments ou information;
- variantes brillantes sans bonus de puissance;
- deck de depart jouable offert;
- cartes essentielles fabricables;
- matchmaking par categorie de Recolte;
- format miroir regulier;
- recompenses de classement surtout cosmetiques;
- aucune perte du Buddie ou des Heritage apres une defaite; seules les deux
  Fleurs engagees sont brulees au verdict.

## 15. MVP fonctionnel

### Inclus

- 6 strains issues de la collection;
- selection depuis l'album;
- un emplacement de culture;
- 12 tours;
- 6 systemes simules: lumiere, climat, eau, racines, nutrition et stress;
- 6 permanents;
- 8 Techniques;
- diagnostic simple et vue expert;
- maitrise par strain;
- carte Recolte;
- un concours hebdomadaire;
- duel asynchrone en trois manches;
- classement quotidien;
- interface carnet et personnages existants.

### Hors MVP

- temps reel;
- combat anime;
- marche entre joueurs;
- reproduction ou hybridation;
- plusieurs plantes simultanees;
- meteo regionale complete;
- guildes;
- generation automatique d'illustrations;
- profils agronomiques pour les 52 cartes.

## 16. Parcours de prototype

Le premier prototype vertical doit prouver une seule boucle:

1. ouvrir la collection;
2. choisir Cannatonic;
3. lancer une culture;
4. consulter le rapport du jour;
5. choisir entre trois actions;
6. resoudre le tour;
7. avancer artificiellement jusqu'a la recolte en environnement de test;
8. reveler la carte Recolte;
9. l'inscrire a un concours factice.

Le prototype peut utiliser un profil de simulation provisoire clairement marque comme non valide. L'equilibrage scientifique intervient apres validation de la boucle et des donnees sources.

## 17. Indicateurs de validation

- part des joueurs avec une carte compatible qui lancent une culture;
- taux de retour au tour 2, au tour 4 et a la recolte;
- temps median d'une session quotidienne;
- taux de comprehension des diagnostics;
- repartition des choix, pour detecter une option dominante;
- nombre de strains essayees par joueur;
- part des Recoltes inscrites en concours;
- taux de duels rejoues;
- lectures et ecritures Supabase par joueur actif;
- poids du bundle et des images;
- latence p95 des actions.

### Garde de performance en recette

`npm run load-test:placard` mesure en lecture seule la page Placard, le
bootstrap, la session et le classement. Par defaut, le test refuse une cible
distante et applique deux budgets distincts:

- page HTML: p95 inferieur ou egal a 2 500 ms;
- routes API: p95 inferieur ou egal a 1 200 ms;
- taux d'erreur maximal: 1 %.

Les budgets sont ajustables avec `PLACARD_LOAD_TEST_PAGE_P95_MS`,
`PLACARD_LOAD_TEST_API_P95_MS` et
`PLACARD_LOAD_TEST_MAX_ERROR_RATE`. Le test des burns et des verdicts reste
separe, car il doit uniquement etre lance sur une copie de recette jetable.

`npm run smoke-test:placard:transactions` couvre une seule mutation a la fois:
burn d'une carte La Botte ou verdict avec burn des deux Fleurs. Ce script
refuse sans exception toute URL autre que `localhost` ou `127.0.0.1`. Il exige
egalement `PLACARD_SMOKE_CONFIRM_BURNS=LOCAL_BURNS_ONLY`, un cookie de compte
de recette et les identifiants de l'objet a consommer. Il n'est jamais lance
par la CI.

`npm run audit:placard:mobile` controle la page authentifiee dans un viewport
390 x 844 avec Lighthouse. Les seuils locaux par defaut sont: performance 75,
accessibilite 90, LCP 4 000 ms, CLS 0,10 et poids transfere 2 Mo. L'audit refuse
lui aussi toute cible distante. Il complete la recette sur appareils reels
mais ne la remplace pas, notamment pour le confort tactile et la lisibilite en
conditions exterieures.

## 18. Decisions a valider avant implementation complete

1. Nom public final: Le Placard ou autre.
2. Six strains exactes du MVP et sources de leurs parametres.
3. Duree reelle d'un tour et gestion des absences.
4. Economie initiale des Jetons de culture.
5. Statut juridique et editorial des appellations commerciales.
6. Liste des personnages et leur role officiel.
7. Niveau de detail affiche dans la vue expert.
8. Premier reglement de concours.

## 19. Recompenses du carnet vers le Placard

### Principe

Le carnet ne recompense jamais la valeur de la note donnee. Il recompense uniquement:

- une critique validee;
- la precision des terpenes identifies;
- la regularite sur plusieurs lots;
- la qualite d'une contribution reconnue par la moderation;
- la participation utile a la communaute.

Cela evite d'encourager artificiellement les bonnes notes.

### Format cible des packs

1. Les boosters Buddies restent inchangés et continuent d'être achetés et
   ouverts depuis l'album principal.
2. L'Arène propose séparément un booster La Botte de dix cartes.
3. Le booster La Botte coûte 5 points. Les deux achats utilisent le même
   portefeuille de fidélité, mais conservent chacun leur propre tarif.
4. Un Jeton Coup de pouce donne +1 XP au départ d'une culture. Deux jetons
   maximum peuvent être dépensés par partie.

Les collections et leurs boosters restent séparés. Les packs déjà attribués ne
sont jamais modifiés rétroactivement. La boutique La Botte reste dormante
jusqu'à une activation coordonnée du catalogue, des visuels et des RPC.

### Grille cible des badges

| Badge | Booster La Botte | Jeton Coup de pouce |
| --- | ---: | ---: |
| Premier Carnet | 1 | 1 |
| Gouteur Regulier | 1 | 2 |
| Marathon des Lots | 2 | 3 |
| Premiere Piste | 1 | 0 |
| Combo Aromatique | 1 | 1 |
| Nez Absolu | 2 | 1 |
| Nez Divin | 3 | 2 |
| Tour de Saison | 1 | 2 |
| Expert Outdoor | 1 | 1 |
| Expert Greenhouse | 1 | 1 |
| Expert Indoor | 1 | 1 |
| Critique Utile | 0 | 1 |
| Plume d'Or | 1 | 2 |
| Voix Respectee | 1 | 1 |
| Validateur Serieux | 0 | 1 |

### Etat de lancement

La configuration est dormante et `KQ_NOTEBOOK_REWARDS_LIVE` reste a `false`.
La collection La Botte et ses definitions restent inactives dans Supabase.
Aucun booster La Botte ne doit être achetable ou ouvrable par un client avant
le lancement complet.
Le raccord apres approbation d'une critique est implemente: il recalcule d'abord
les badges, filtre ceux qui possedent une regle Placard active, puis appelle le
RPC idempotent badge par badge. Tant que le flag reste a `false`, ce raccord
s'arrete avant toute lecture ou ecriture Supabase liee au Placard.

## 20. Cartes Heritage de concours

Les cartes Heritage sont des cartes permanentes offertes par le parcours des
fleurs concours. Elles ne dependent ni du nombre ni de l'identite des varietes
proposees pendant une saison.

Regles validees:

- chaque achat eligible d'une fleur concours donne un tirage Heritage;
- le tirage est attache de facon idempotente a la ligne de commande eligible;
- les Heritage ne brulent jamais et restent reutilisables;
- un seul Heritage peut etre equipe par culture;
- il reste hors du deck La Botte et de la main de dix cartes;
- son pouvoir est limite a une utilisation ou une condition par culture;
- les doublons n'augmentent jamais la puissance de la carte;
- les variantes brillantes ou dorees sont uniquement cosmetiques;
- les probabilites et la protection contre les longues series sans rare doivent
  etre publiees avant activation.

Catalogue initial cible:

- 6 communes;
- 4 rares;
- 2 epiques;
- probabilites de base 70 / 25 / 5;
- garantie rare ou epique apres cinq tirages sans rarete superieure;
- priorite aux references non possedees a rarete egale;
- doublons convertis en fragments dans une phase ulterieure.

Conversion retenue pour le prototype:

- doublon commun: 1 fragment;
- doublon rare: 3 fragments;
- doublon epique: 8 fragments;
- fabrication commune: 5 fragments;
- fabrication rare: 12 fragments;
- aucune fabrication epique au lancement.

Familles de pouvoirs:

- Racines solides: annule le premier Danger d'Enracinement;
- Reserve du jardinier: commence avec un XP supplementaire;
- Main prevoyante: pioche douze cartes et en conserve dix;
- Climat stable: annule la premiere hausse de pression climatique;
- Second regard: offre un changement de main supplementaire;
- Reprise vigoureuse: rend un XP apres le premier echec;
- Instinct du cultivateur: relance un de neutre;
- Bouclier biologique: facilite la premiere inspection de ravageur;
- Floraison maitrisee: transforme un neutre en reussite en Floraison;
- Affinage patient: relance le de le plus faible a la derniere etape;
- Heritage de la canopee: ignore les Dangers d'un lancer sans creer d'Etincelle;
- Signature du maitre: ajoute un quatrieme de et conserve les trois meilleurs.

Etat de lancement:

- catalogue et stockage dormants;
- aucun branchement automatique sur les commandes payees avant validation;
- aucun affichage dans l'album client avant la mise en ligne coordonnee;
- tests d'attribution realises uniquement avec des identifiants de commande de
  test ou en mode apercu sans ecriture.

### Checklist d'activation atomique

1. terminer les routes serveur du Placard et la consommation des Jetons Coup de pouce;
2. connecter les parties, burns et classements a Supabase;
3. ajouter le portefeuille client pour les boosters La Botte et les jetons;
4. tester la retro-attribution des badges deja obtenus sur une copie de la base;
5. publier le reglement des burns, du classement et des lots de fin de saison;
6. activer simultanement la collection, les recompenses, l'interface Album et l'acces au Placard;
7. verifier qu'aucun ecran ne presente une recompense impossible a utiliser;
8. activer les Heritage et basculer
   `KQ_HERITAGE_PURCHASE_DRAWS_LIVE` dans la meme fenetre de lancement, apres
   publication des probabilites. Le branchement idempotent au passage d'une
   commande en statut paye est deja implemente mais reste dormant.

## 21. Recompenses de fin de saison

La grille de dotation est calculee depuis l'instantane final du classement et
reste dormante tant que le reglement public et les lots physiques ne sont pas
valides. Trois duels termines sont necessaires pour etre eligible.

| Rang | Reconnaissance | Booster La Botte | Fragments Heritage |
| --- | --- | ---: | ---: |
| 1 | titre, cadre or, ruban, invitation speciale | 3 | 12 |
| 2-3 | titre, cadre podium, ruban, invitation speciale | 2 | 8 |
| 4-10 | titre, cadre saisonnier, ruban | 1 | 3 |
| 11+ | titre et ruban de participation | 0 | 1 |

Les recompenses restent principalement cosmetiques. Chaque attribution future
portera une cle idempotente `saison:joueur:palier`. La constante
`KQ_SEASON_REWARDS_LIVE` reste a `false`; aucun lot, booster ou fragment n'est
distribue par ce module. La commande admin et le RPC atomique de distribution
sont installes mais dormants: le RPC exige a la fois un palier actif, une
collection La Botte active et l'eligibilite aux trois duels minimum.
Les rubans et autres cosmetiques reprennent automatiquement le code court de la
saison active (`S1`, `S2`, etc.) et ne sont jamais figes sur la premiere saison.

## 22. Etat d'implementation local

### Termine techniquement

- boucle de culture a six etapes, main de dix et deck limite uniquement par les
  copies possedees;
- effets Buddies, cartes La Botte, PBI apres inspection et Heritage;
- burns atomiques du Substrat et de chaque carte jouee;
- portefeuille de Jetons Coup de pouce;
- creation serveur d'une Fleur unique a la recolte;
- reserve de Fleurs, matchmaking classe, verrouillage puis verdict separe;
- burn atomique des deux Fleurs au verdict;
- cote, ligues, points, series, defis et classement quotidien;
- saisons dynamiques, expiration des duels et recompenses de saison dormantes;
- recompenses Carnet et tirages Heritage installes mais dormants;
- routes joueur separees des routes admin, authentification par `customerId`,
  rate limiting et erreurs serveur filtrees;
- page joueur responsive integree a L'Arene derriere `KQ_PLAYER_API_LIVE`;
- reprise de culture exclusivement depuis Supabase, sans sauvegarde locale de
  l'etat officiel;
- bootstrap collection optimise et lectures initiales regroupees;
- classement general mis en cache 24 heures, progression privee immediate;
- garde de charge en lecture seule avec budgets p95 distincts page et API;
- smoke test destructif limite techniquement a localhost pour les burns et
  verdicts;
- audit Lighthouse smartphone authentifie avec budgets performance,
  accessibilite, LCP, CLS et poids transfere;
- preflight admin qui exige que l'acces joueur reste ferme jusqu'a la derniere
  etape de la fenetre d'activation.

### Volontairement dormant avant lancement

- `KQ_PLAYER_API_LIVE`;
- `KQ_PUBLIC_RULES_APPROVED`;
- activation commerciale de La Botte;
- attribution automatique des boosters Carnet;
- tirages Heritage lies aux achats concours;
- fabrication par fragments;
- distribution des recompenses de saison;
- affichage de La Botte et des Heritage dans l'album client principal.

### Reste avant ouverture publique

1. produire et valider les illustrations finales des 36 cartes La Botte et des
   12 Heritage;
2. valider les lots, dates, territoire, probabilites et reglement public;
3. effectuer une recette mobile sur appareils reels avec plusieurs comptes et
   collections de tailles differentes; l'audit Lighthouse local est pret mais
   ne remplace pas cette validation humaine;
4. tester la retro-attribution Carnet et Heritage sur une copie de production;
5. executer le test de charge deja instrumente sur la copie de recette, puis
   les smoke tests de burns et verdicts exclusivement sur sa base jetable;
6. relever et valider les budgets Supabase/Vercel avec les mesures p95
   produites par route;
7. preparer une fenetre d'activation coordonnee des collections, recompenses,
   album et acces joueur;
8. n'activer les flags qu'apres validation explicite, puis effectuer un test
   fumee avec un compte client de recette.

Cette liste est la source de verite pour la fin de projet. Les anciennes
sections de simulation quotidienne restent des archives de conception et ne
doivent pas etre utilisees comme checklist de lancement.
