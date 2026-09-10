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
  -> choisir 1 mode de culture + autant de copies La Botte que l'album le permet
  -> piocher une main de 5 cartes a chaque etape
  -> jouer 6 etapes courtes avec 3 des
  -> gagner et depenser de l'XP pour jouer des cartes
  -> subir des incidents Energie, DDTM et Securite avec des reponses dediees
  -> creer 1 carte Fleur unique
  -> deposer sa Fleur dans la file de duel aleatoire
  -> appariement automatique puis 3 manches de jury
  -> bruler les 2 Fleurs au verdict
  -> vendre en biomasse ou en brut, ou transformer avec le materiel possede
  -> gagner de l'argent et une reputation qualite permanente
  -> reinvestir dans le catalogue d'equipements durables
  -> progresser en cote, ligue, saison, reputation et collection
```

Regles validees:

- 3 des: `1` Danger, `2-3` neutre, `4-6` reussite, `6` Etincelle;
- 6 etapes: Germination, Enracinement, Croissance, Floraison, Recolte,
  Sechage et affinage;
- 36 cartes consommables dans `La Botte du Chanvrier`;
- deck sans limite arbitraire: chaque copie possedee peut etre engagee;
- main deterministe de 5 cartes, figee pendant toute l'etape; aucune carte
  brulee n'est remplacee avant l'etape suivante, les cartes non jouees
  retournent alors dans la rotation et les copies brulees en sont retirees;
- un changement de main gratuit par culture, uniquement avant toute action;
- le constructeur affiche la probabilite de voir chaque reference dans la
  premiere main afin de rendre visible le compromis entre taille et regularite;
- il resume aussi la couverture Racines, Eau, Climat, Ravageurs, Floraison et
  Sechage, sans bloquer les decks incomplets;
- trois raccourcis permettent d'engager une copie de chaque reference, toutes
  les copies jouables ou de vider le deck avant ajustement manuel;
- les quatre modes reels (Terreau, Hydroponie, Aeroponie et Sol vivant)
  affichent leur technique, leur niveau de pilotage, leur dependance electrique,
  leur avantage et leur risque avant la selection;
- seul le Terreau horticole peut servir de mode standard gratuit quand aucun
  mode de culture n'est possede;
- le mode choisi rejoint les traits de la Fleur et son dossier de vente sous
  forme de trace descriptive; il ne rajoute aucun bonus cache au jury ou au
  prix, ses effets restent ceux joues pendant la culture;
- pendant chaque Situation, le panneau du mode annonce si son avantage est
  actif, en veille ou menace par une coupure; Hydroponie et Aeroponie perdent
  leur bonus de pompe sans courant, avec une penalite double pour l'Aeroponie;
- un emplacement favori local memorise le Buddie, le mode de culture et chaque copie;
  sa restauration retire automatiquement les copies brulees depuis;
- toute carte de mode de culture possedee est brulee au depart et toute carte La Botte est brulee a
  chaque utilisation;
- les PBI restent hors deck, apparaissent apres la Loupe et ciblent uniquement
  le ravageur revele;
- 9 Buddies CBD jouables et non consommables;
- 30 situations de culture, soit 5 par etape, dont pucerons, acariens et
  thrips;
- trois incidents satiriques avec consequences persistantes: facture
  electrique et coupure, controle DDTM, vol de recolte;
- quatre reponses specialisees: Papiers en regle, Branchement illegal,
  Echeancier negocie et Gros molosse;
- 15 formats de jury repartis en Presentation, Aromes et Maitrise;
- 3 defis quotidiens parmi 9, verrouilles au depart de la culture;
- classement Elo, ligues Graine / Pousse / Canopee / Fleur / Grand Cru;
- 1 booster La Botte toutes les 3 victoires consecutives;
- la Fleur du joueur et celle de l'adversaire sont brulees au verdict;
- portefeuille materiel initialise a 350 USD, catalogue de 22 equipements dont
  13 machines de transformation aux prix publics US, panier, validation et
  equipement par slot;
- quatre modes de culture reels et differencies: Terreau, Hydroponie,
  Aeroponie et Sol vivant; perlite, biochar et engrais bio sont consommables;
- marche post-recolte avec jury qualite, biomasse, lot brut, dry sift, static
  sift, ice water hash et quatre paliers de rosin selon l'equipement et la note;
- la qualite pilote le prix et la reputation; la reputation departage le
  classement officiel apres cote et points de saison, avant le bilan sportif;
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
- `src/lib/kanab-quest-equipment.ts`: catalogue durable, prix et effets;
- `src/lib/kanab-quest-market.ts`: note du jury, rendements, prix et reputation;
- `src/lib/kanab-quest-repository.ts`: persistance locale atomique;
- `supabase/migrations/20260722000100_kanab_quest_game_foundation.sql`:
  fondation serveur historique, completee par les migrations datees du
  30 aout 2026 pour l'equipement, le marche et les incidents.

### 0.1 Statut de la verticale locale

La verticale locale est fonctionnellement complete pour les tests produit:

- onboarding memorise et rejouable, aligne sur la boucle atelier actuelle :
  preparation, six etapes, jury, debouche post-recolte et reinvestissement;
- inventaire a exemplaires physiques, boosters et registre de burns;
- deck sans plafond, raccourcis de composition, probabilites, couverture et
  favori restaure selon le stock restant;
- main figee de 5 copies par etape et un changement de main par culture;
- 30 situations toutes atteignables, 6 etapes, pression, XP, combos et PBI;
- carte Fleur unique avec statistiques et code d'integrite;
- file de duel aleatoire, programme du jury, trois manches et burn des 2 Fleurs;
- Elo, ligues, saison, 9 defis quotidiens et booster de serie;
- boutique materielle e-commerce, transformations post-recolte et reputation;
- audit automatise des doublons exacts et des cartes strictement dominees;
- direction artistique cartoon satirique documentee, avec Sylvain verrouille
  sur les proportions et les attributs de la mascotte de reference;
- sauvegardes locales, journaux de reprise et validation anti-injection.

Ne sont volontairement pas actives dans le mode local historique:

- comptes et inventaires Supabase reels;
- matchmaking entre deux comptes reels;
- classement partage et rotation serveur quotidienne;
- application distante des migrations 003 a 006 sans autorisation explicite;
- validation humaine finale de toute la collection illustree.

Le parcours joueur officiel et les economies serveur existent maintenant, mais
restent derriere leurs verrous de lancement. Une connexion, une migration ou un
deploiement distant ne doit jamais etre simule comme termine par le prototype
local.

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

Le joueur ne choisit plus son rival. Il engage une seule Fleur dans une file
serveur anonyme et peut la retirer tant qu'elle attend. L'arrivee d'une Fleur
constitue d'abord un groupe avec les douze candidatures valides les plus
anciennes, puis tire l'adversaire au hasard dans ce groupe, sans filtre de
qualite ni blocage anti-revanche. Deux joueurs distincts en file peuvent ainsi
toujours former un match, y compris avec une faible population. Le client
retente aussi l'appariement pendant l'attente afin de reprendre les
candidatures deposees avant une concurrence ou une interruption momentanee.
Les deux lignes sont revendiquees avec verrouillage et `SKIP LOCKED` afin que
deux requetes concurrentes ne puissent ni creer deux duels ni bruler deux fois
la meme Fleur. Le verdict est demande automatiquement par le joueur qui forme
le match; le bouton manuel ne sert plus qu'a reprendre un verdict interrompu.
L'entraînement bot ne présente plus non plus de catalogue d'adversaires : le
serveur tire le jardin d'essai à partir de la Fleur engagée et refuse toute
sélection provenant du client. Le nom et la variété du bot sont révélés dans le
reçu du verdict.

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
- classement actualisé après chaque vente et duel;
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

`npm run load-test:placard` simule par defaut 100 participants et mesure en
lecture seule la page Placard, le bootstrap, le classement, la reserve de
Fleurs et l'historique des duels. Ces deux dernieres routes reproduisent le
rafraichissement de la file sans engager ni bruler de Fleur. Le test refuse une
cible distante, exige deux sessions distinctes et prevalide pour chacune la
page et le bootstrap en `200`. Une recette distante exige simultanement l'autorisation
explicite, la confirmation `STAGING_READ_ONLY` et un hote autorise identique a
celui de l'URL cible. Le test applique deux budgets distincts:

- page HTML: p95 inferieur ou egal a 2 500 ms;
- routes API: p95 inferieur ou egal a 1 200 ms;
- taux d'erreur maximal: 1 %.

Les budgets sont ajustables avec `PLACARD_LOAD_TEST_PAGE_P95_MS`,
`PLACARD_LOAD_TEST_API_P95_MS` et
`PLACARD_LOAD_TEST_MAX_ERROR_RATE`. Chaque exécution terminée archive une preuve
JSON versionnée et non écrasable dans `output/placard-load-tests/`, avec le
verdict global et les routes hors budget. Le test des burns et des verdicts
reste separe, car il doit uniquement etre lance sur une copie de recette
jetable.

`npm run smoke-test:placard:transactions` couvre une seule famille de mutation à
la fois : burn d'une carte La Botte, verdict avec burn des deux Fleurs, duel bot
avec crédit d'un défi quotidien, achat-installation, ou parcours marché local.
Le scénario bot vérifie le crédit exact des points et de l'expérience, la
synchronisation des défis, le burn de la Fleur et l'absence de double crédit au
rejeu. Le parcours marché vérifie l'achat éventuel de la machine pivot,
son installation, l'épinglage de la filière, l'éligibilité du lot, la vente,
l'expertise et le rejeu idempotent du reçu. Le script refuse sans exception
toute URL web et toute URL Supabase autres que `localhost` ou `127.0.0.1`. Il
exige `PLACARD_SMOKE_CONFIRM_DATABASE=LOCAL_SUPABASE_ONLY`, puis la confirmation
spécifique `LOCAL_BURNS_ONLY`, `LOCAL_EQUIPMENT_ONLY` ou `LOCAL_MARKET_ONLY`, un cookie local et les
identifiants nécessaires. `NEXT_PUBLIC_SUPABASE_URL` doit être injectée dans le
processus : le script ne lit aucun fichier `.env*`. Il prévalide le bootstrap
authentifié avant toute mutation et n'est jamais lancé par la CI. Chaque réponse
transactionnelle est archivée dans `output/placard-smoke-tests/` sous forme de
preuve expurgée : les identifiants et les reçus sont remplacés par des
empreintes.

`npm run audit:placard:mobile` contrôle trois états authentifiés dans un viewport
390 × 844 avec Lighthouse : le HUD, le catalogue matériel ouvert et le marché.
Par défaut, il exige deux comptes locaux et vérifie qu'ils ont des tailles de
collection différentes. Chaque session passe d'abord par la page, le bootstrap,
le catalogue et le marché réels : une redirection vers la connexion, une 404 ou
une API indisponible invalide la recette avant la mesure. Le rapport expose les
résultats de chaque état par profil et le pire cas sans jamais afficher les cookies.
Il est archivé automatiquement dans `output/placard-mobile-audits/`; aucun
extrait du DOM authentifié n'est conservé dans les problèmes d'accessibilité.
Les seuils locaux par defaut sont: performance 75, accessibilite 90, LCP 4 000
ms, CLS 0,10 et poids transfere 2 Mo. L'audit refuse toute cible distante. Il
complete la recette sur appareils reels mais ne la remplace pas, notamment pour
le confort tactile et la lisibilite en conditions exterieures.

Le pilotage admin instrumente cette dernière étape avec vingt décisions : dix
sur iPhone/Safari physique et dix sur Android/Chrome physique. La checklist est
locale, importable et exportable sans compte, email, modèle d'appareil ni texte
libre. Son export va dans `output/placard-mobile-manual-reviews/` et devient une
preuve distincte de l'audit Lighthouse dans le dossier de lancement.
Le contrôle marché impose sur chacun des deux appareils une vente réelle de bout
en bout : choix, confirmation, reçu, versement, réputation, lot vendu et rejeu
sans double crédit. Le manifeste v2 invalide les preuves antérieures qui ne
couvraient que la lisibilité de la fenêtre de confirmation.

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
fleurs concours. Le catalogue suit maintenant les producteurs réellement
présents sur la plateforme : un producteur possède une carte stable, quel que
soit le nombre de variétés qu'il propose pendant une saison.

Regles validees:

- un avis éligible validé sur une fleur du producteur débloque son Heritage de
  façon idempotente;
- les Heritage ne brulent jamais et restent reutilisables;
- un seul Heritage peut etre equipe par culture;
- il reste hors du deck La Botte et de la main de cinq cartes;
- son pouvoir est limite a une utilisation ou une condition par culture;
- les doublons n'augmentent jamais la puissance de la carte;
- les variantes brillantes ou dorees sont uniquement cosmetiques;
- une carte retirée du catalogue ne peut plus être gagnée ni équipée dans une
  nouvelle culture, mais les exemplaires acquis restent visibles dans l'album.

Catalogue implemente:

- une définition Heritage est créée automatiquement à l'ajout d'un producteur;
- sa référence reste stable même si le nom ou le visuel du producteur change;
- à la suppression du producteur, la définition et son parcours actif sont
  archivés sans supprimer les reçus ni les cartes déjà gagnées;
- les mécaniques proviennent d'un catalogue extensible contrôlé par le moteur;
  la création choisit exclusivement un pouvoir actif encore inutilisé et un
  index SQL interdit deux pouvoirs identiques parmi les producteurs présents;
  si le catalogue est épuisé, la carte est créée inactive en attente éditoriale
  au lieu de produire silencieusement un doublon;
- toutes les cartes ont la même valeur technique et aucune rareté publique;
- un doublon donne 1 fragment;
- 5 fragments fabriquent n'importe quelle reference active manquante.

L'ancien catalogue fermé de douze références et son tirage après achat sont
conservés uniquement pour la compatibilité des anciens reçus. Ils ne constituent
plus la source de vérité du catalogue joueur.

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

Douze pouvoirs supplémentaires étendent cette bibliothèque à 24 combinaisons
réellement distinctes : Élan de semis, Racines décompressées, Croissance
résiliente, Pistils étincelants, Mémoire du gardien, Dernier affinage, Premier
élan, Exigence du jury, Culture zen, Parade ancestrale, Soupape lumineuse et Art
du compromis. Chacun possède son propre déclencheur et sa propre contrepartie :
étape imposée, condition de dé, Pression, Situation de vol ou qualité du résultat.
Le préflight refuse désormais un catalogue producteur contenant un effet inconnu
ou utilisé deux fois.

Etat de lancement:

- synchronisation automatique avec la table Producteurs;
- édition du nom, du pouvoir, du texte et du visuel depuis le pilotage admin;
- affichage dynamique dans le Placard et l'album client;
- atelier joueur dans l'album : à partir de 5 fragments, choix explicite d'une
  référence producteur active et manquante, avec débit et attribution atomiques;
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

- boucle de culture a six etapes, main de cinq et deck limite uniquement par les
  copies possedees;
- effets Buddies, cartes La Botte, PBI apres inspection et Heritage;
- burns atomiques du mode de culture et de chaque carte jouee;
- portefeuille de Jetons Coup de pouce;
- creation serveur d'une Fleur unique a la recolte;
- reserve de Fleurs, file classee aleatoire, retrait avant match, appariement
  transactionnel et verdict automatique;
- burn atomique des deux Fleurs au verdict;
- cote, ligues, points, series, defis et classement actualisé à chaque lecture;
- saisons dynamiques, expiration des duels et recompenses de saison dormantes;
- recompenses Carnet et tirages Heritage installes mais dormants;
- routes joueur separees des routes admin, authentification par `customerId`,
  rate limiting et erreurs serveur filtrees;
- page joueur responsive integree a L'Arene derriere `KQ_PLAYER_API_LIVE`;
- reprise de culture exclusivement depuis Supabase, sans sauvegarde locale de
  l'etat officiel;
- bootstrap collection optimise et lectures initiales regroupees;
- classement Placard recalculé depuis les cotes, points et réputations serveur,
  sans cache navigateur afin qu'une vente ou un duel soit visible immédiatement;
- portefeuille d'argent, equipements durables, jury de qualite, vente,
  transformation, biomasse et reputation serveur;
- HUD d'atelier avec solde, reputation, inventaire durable et prochain
  investissement compatible, recalcule apres chaque achat, plus une action
  conseillee qui priorise culture active, lot a valoriser, Fleur a juger,
  achat accessible ou nouvelle culture; l'objectif materiel suit le prix
  compatible le plus proche afin de conserver des paliers intermediaires avant
  les machines de transformation a plusieurs milliers de dollars; le bouton
  de l'objectif ouvre directement sa fiche marquee dans le catalogue, sans
  ajout automatique au panier; une reglette Culture, Jury, Vente expose aussi
  les parties, Fleurs et lots en attente avec acces direct a chaque etape;
- table d'equilibrage admin en lecture seule : comparaison des voies de marche,
  amortissement des machines, alertes de domination et controle des prix reels;
- catalogue e-commerce triable par progression ou prix, avec filtre des achats
  immediatement compatibles avec le budget et les prerequis du joueur; le recu
  de commande distingue clairement achat et installation, puis permet d'activer
  chaque piece sans quitter la confirmation; une machine achetee mais privee de
  son prerequis reste en reserve et ne peut pas activer ses bonus; le panier
  signale les pieces qui partagent un emplacement et le materiel actif qu'une
  future installation remplacera; les presses a rosin superieures conservent
  toutes les recettes des paliers inferieurs et l'objectif automatique ignore
  les modeles deja depasses par un achat plus haut dans la meme gamme; ces
  alternatives sont signalees comme telles et ne sont jamais confondues avec
  une collection reellement complete; la projection du panier simule les
  remplacements par emplacement et exclut les conflits ou prerequis non resolus
  afin de ne jamais additionner des bonus impossibles; avant paiement, le panier
  et sa confirmation montrent les variations de quantite, qualite, regularite,
  energie, capacite et precision; une filiere n'est annoncee ouverte que si sa
  chaine technique est complete, avec rappel de la note minimale du jury;
  chaque fiche produit applique la meme projection au chargement reel du joueur
  et indique le materiel remplace avant meme l'ajout au panier; les machines de
  transformation y ajoutent un amortissement indicatif sur un lot temoin de
  100 g note 8,8/10, avec surplus par lot, capital restant selon les machines
  deja possedees, contenu du panier et remplacement des modeles minimaux par les
  machines superieures compatibles; les grandes laveuses, le separateur
  automatise et les presses superieures disposent de leurs propres projections,
  tandis qu'un ancien modele deja depasse n'en revendique plus le benefice;
  chaque filiere affiche aussi l'epargne manquante et peut ajouter en une seule
  action toutes les pieces encore absentes de son panier; le panier conserve
  alors la filiere visee, son seuil de jury, son surplus temoin, son
  amortissement et sa jauge de financement jusqu'a l'achat ou l'abandon de
  l'objectif; la filiere choisie est sauvegardee sur le profil et remonte dans
  le HUD avec son budget restant, y compris apres fermeture de la boutique ou
  reconnexion;
  apres paiement, chaque
  ligne du recu traduit la machine en bonus chiffres et filieres ouvertes, puis
  distingue sans ambiguite achat, prerequis manquant et installation active;
- aide a la decision dans le comptoir des lots : meilleur revenu, meilleure
  reputation et ecart chiffre par rapport a la vente brute, sans masquer les
  autres choix disponibles; la confirmation irreversible projette aussi le
  solde, la reputation, le titre et le prochain investissement apres la vente;
  lorsqu'une filiere materielle est epinglee, l'aperçu et le reçu montrent la
  part du versement qui finance réellement son budget, la progression avant et
  apres ainsi que le nombre indicatif de ventes comparables encore necessaires;
  la voie epinglee remonte en premiere position et est mise en evidence dans la comparaison du lot et
  diagnostique quatre situations sans ambiguite : lot pret, qualite
  insuffisante, materiel manquant, ou qualite et materiel encore insuffisants;
  son appel a l'action rouvre directement la machine pivot et sa chaine;
  la premiere vente conforme a l'objectif enregistre atomiquement la maitrise
  durable de la filiere, ferme l'objectif epingle et celebre le jalon dans le
  recu; le palier non maitrise suivant de la meme famille peut alors etre
  epingle, sans conseiller une presse inferieure deja remplacee; apres fermeture
  du recu, le HUD conserve le palmares des huit voies de transformation tandis
  que chaque fiche du marche affiche son nombre de ventes et son record jury;
  les ventes repetees remplissent quatre paliers d'expertise coherents avec la
  maitrise des strains : Apprentie a 1, Confirmee a 3, Experte a 6 et Maitrise
  a 10 ventes, avec le prochain seuil visible jusque dans le recu de vente;
  les passages a 3, 6 et 10 ventes versent respectivement 5, 12 et 25 points de
  reputation, figes dans le recu idempotent et reserves aux transformations;
  la table d'equilibrage admin permet de simuler le numero de vente et separe la
  reputation du lot, la prime ponctuelle d'expertise et leur total pour chaque
  filiere;
  une mission d'atelier permanente retient la filiere epinglee ou choisit le
  palier d'expertise le plus proche, annonce sa prime et remonte sa voie en tete
  du comptoir sans masquer les autres choix; elle peut etre epinglee en un clic,
  reutilise la machine pivot la plus performante deja possedee ou ouvre la fiche
  du premier equipement manquant, puis suit le joueur jusqu'au verdict;
- chaque voie bloquee distingue desormais le manque de note du jury du manque
  de materiel : la premiere indique l'objectif de la prochaine recolte, la
  seconde ouvre directement la machine a acheter, a installer ou son prerequis;
  quitter la boutique ramene au lot concerne et recharge ses options;
- recu de vente relie a la progression durable : prochaine machine compatible,
  budget restant et acces direct a sa fiche dans le catalogue, ou objectif
  qualite lorsque l'atelier est complet;
- reputation publiee dans le classement Placard et integree au Score Placard :
  cote + 25 % des points de saison (bonus plafonne a 150) + quatre fois la
  racine carree de la reputation (bonus plafonne a 100); les egalites suivent
  reputation, cote, victoires, defaites, points de saison puis identifiant stable;
  les six titres cosmetiques et la progression restent visibles dans le HUD,
  les recus de vente et les deux vues du classement Placard;
- incidents Facture electrique, Controle DDTM et Renard a deux pattes, avec
  coupure de courant et perte de quantite effectivement appliquees;
- trajectoire de recolte visible pendant la culture : qualite projetee, palier,
  distance au prochain palier, poids estime et pertes deja subies, recalcules
  apres chaque etape avec la formule finale existante et clairement presentes
  comme une projection non garantie; la filiere sauvegardee y rappelle son
  seuil commercial sans confondre la Qualite de culture avec la note du jury;
  dans la reserve, chaque Fleur affiche une estimation pre-jury issue de ses
  cinq statistiques et l'ecart restant, le verdict officiel restant souverain;
  les recus des duels humains et bot affichent ensuite la note commerciale
  definitive, la comparent au seuil epingle et ouvrent directement le lot le
  plus recent dans le comptoir;
- recu anime apres chaque resolution : variation de qualite, XP reellement
  gagnes, poids projete et perte de recolte eventuelle sont affiches avant de
  passer a l'etape suivante et conserves dans l'historique de la culture;
- bulletin final commun aux parties officielles et locales : equation des six
  etapes, bonus de materiel, qualite finale, poids brut, perte d'incident et
  poids final, suivis des six recus d'etape; les scores negatifs autorises par
  le moteur ne sont plus artificiellement affiches comme zero;
- garde de charge en lecture seule, multi-comptes prevalides, avec budgets p95
  distincts page et API et couverture obligatoire du HUD, classement, Fleurs,
  duels, catalogue matériel et marché;
- smoke test destructif limité techniquement à un serveur et une base Supabase
  locaux pour les burns, verdicts, le duel bot et ses défis sans double crédit,
  l'achat-installation de matériel avec débit idempotent et le parcours marché
  avec rejeu idempotent;
- audit Lighthouse smartphone authentifié du HUD, du catalogue matériel ouvert
  et du marché, avec budgets performance, accessibilité, LCP, CLS et poids
  transféré;
- checklist admin exportable des vingt contrôles humains sur iPhone/Safari et
  Android/Chrome physiques, avec achat réel de matériel, installation depuis
  le reçu et vente réelle sans double débit sur chaque appareil;
- vérificateur hors ligne des douze preuves de recette, avec fraîcheur maximale,
  intégrité des vingt décisions mobiles, continuité des curseurs rétro et
  correspondance simulation/exécution; ses refus mobiles indiquent désormais
  la version, le profil et le contrôle exact à reprendre;
- synthèse importable de ce rapport dans le pilotage admin, limitée aux données
  expurgées, avec détection d'expiration, prochaine action bloquante et verdict
  croisé avec l'état dormant réellement lu par le préflight serveur;
- preflight admin dont l'état prêt est réellement atteignable avec deux règles
  Carnet configurées mais dormantes, et qui contrôle aussi le flux Producteurs;
  l'accès joueur reste fermé jusqu'à la dernière étape de la fenêtre
  d'activation.

### Volontairement dormant avant lancement

- `KQ_PLAYER_API_LIVE`;
- `KQ_SEASON_CALENDAR_APPROVED`;
- `KQ_SEASON_PRIZES_APPROVED`;
- `KQ_SEASON_TERRITORY_APPROVED`;
- `KQ_COLLECTION_ODDS_APPROVED`;
- `KQ_PUBLIC_RULES_APPROVED`;
- activation commerciale de La Botte;
- attribution automatique des boosters Carnet;
- tirages Heritage lies aux achats concours;
- distribution des recompenses de saison;
- affichage de La Botte et des Heritage dans l'album client principal.

### Reste avant ouverture publique

État vérifié et conditions de clôture au 8 septembre 2026 :
[`PLACARD-FIN-DE-PLAN.md`](PLACARD-FIN-DE-PLAN.md).

1. valider humainement les 36 cartes La Botte, chaque Heritage lié à un
   producteur actif et les situations selon `PLACARD-DA-V2.md`; la planche admin
   se recalcule avec le catalogue Producteurs et remet toute nouvelle image à
   contrôler; les planches historiques restent reproductibles et l'audit
   Situation est consigné dans `PLACARD-SITUATION-ARTWORK-AUDIT.md`;
2. valider les lots, dates, territoire, probabilites et reglement public;
   le dossier de decision et les cinq verrous independants sont decrits dans
   `PLACARD-LAUNCH-BRIEF.md`;
3. effectuer une recette mobile sur appareils reels avec plusieurs comptes et
   collections de tailles differentes; l'audit Lighthouse local et la checklist
   admin sont prêts mais ne remplacent pas la manipulation physique; exporter
   la checklist intégralement validée dans le dossier de preuves;
4. tester la retro-attribution Carnet et Heritage sur une copie de production;
5. exécuter le test de charge déjà instrumenté sur la copie de recette, puis
   les smoke tests de burns, verdicts, duel bot avec défis, achat-installation de matériel et vente
   marché exclusivement sur sa base jetable;
6. relever et valider les budgets Supabase/Vercel avec les mesures p95
   produites par route;
7. preparer une fenetre d'activation coordonnee des collections, recompenses,
   album et acces joueur;
8. n'activer les flags qu'apres validation explicite, puis effectuer un test
   fumee avec un compte client de recette.

Cette liste est la source de verite pour la fin de projet. Les anciennes
sections de simulation quotidienne restent des archives de conception et ne
doivent pas etre utilisees comme checklist de lancement.
