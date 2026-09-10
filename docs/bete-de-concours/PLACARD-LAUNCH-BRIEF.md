# Dossier de lancement du Placard

Version de travail `2026-09-05-draft-7`. Ce document prépare les décisions de
lancement mais ne constitue ni un règlement publié ni une promesse de lot.

## 1. Décisions indépendantes

Chaque ligne doit être validée séparément. Les cinq variables restent à
`false` tant que la décision correspondante n'est pas formellement approuvée.

| Décision | Variable | État initial | Information à figer |
| --- | --- | --- | --- |
| Calendrier | `KQ_SEASON_CALENDAR_APPROVED` | non validé | ouverture, clôture, durée et fuseau Europe/Paris |
| Lots | `KQ_SEASON_PRIZES_APPROVED` | non validé | nature, quantité, valeur, stock et procédure de remise |
| Territoire | `KQ_SEASON_TERRITORY_APPROVED` | non validé | pays ou zones admises, âge, résidence et exclusions |
| Probabilités | `KQ_COLLECTION_ODDS_APPROVED` | non validé | tables ci-dessous, coût et protections anti-doublon |
| Règlement | `KQ_PUBLIC_RULES_APPROVED` | non validé | texte final publié, données personnelles et recours |

`KQ_PLAYER_API_LIVE=true` ne suffit pas à ouvrir le jeu : le serveur exige aussi
les cinq validations précédentes et un `KQ_LAUNCH_DOSSIER_JSON` complet. Ce JSON
forme un instantané atomique du code saison, des dates ISO avec fuseau, du
territoire, de l'âge, des conditions d'éligibilité, des quatre paliers de lots,
de leurs stocks et valeurs, de la version des probabilités, de l'URL HTTPS du
règlement et du contact de recours. Un booléen `APPROVED=true` reste sans effet
si la section correspondante de cet instantané est absente ou invalide.

Pour travailler localement sans simuler une validation juridique, utiliser
`KQ_LOCAL_PLAYER_PREVIEW=true` avec `next dev`. Ce drapeau ouvre la page et les
API du Placard uniquement lorsque `NODE_ENV=development`; il est sans effet en
production et ne compte jamais comme une ouverture publique dans le préflight
admin.

## 2. Probabilités techniques à approuver

### Booster La Botte

- un booster standard contient dix cartes ; le booster gagné en duel en contient
  trois ;
- le premier emplacement est toujours Commun ;
- chaque emplacement suivant est tiré indépendamment : Commun `70 %`, Peu
  commune `24 %`, Rare `6 %` ;
- à rareté fixée, chaque référence active de cette rareté a le même poids ;
- un même booster peut contenir plusieurs copies d'une référence ;
- le coût boutique actuel est de `5` points fidélité par booster standard.

Exemple pour un booster standard de dix cartes : une Commune garantie, puis
neuf tirages indépendants selon la table `70 / 24 / 6`. Cette formulation doit
être publiée telle quelle si la mécanique reste inchangée.

### Héritages

- les Héritages ont la même valeur technique et aucune rareté publique ;
- le catalogue actif contient exactement une carte par producteur présent sur
  la plateforme ;
- la carte du producteur est débloquée par le parcours d'avis correspondant :
  il ne s'agit plus d'un tirage aléatoire entre douze références ;
- l'ajout d'un producteur crée sa définition et son retrait l'archive sans
  supprimer les cartes déjà acquises ;
- les cartes producteur actives utilisent des pouvoirs tous distincts, issus
  d'une bibliothèque éditoriale de vingt-quatre mécaniques ; le préflight
  refuse un pouvoir inconnu ou attribué deux fois ;
- si les vingt-quatre pouvoirs sont occupés, toute nouvelle carte reste
  inactive et en attente d'une mécanique inédite au lieu de créer un doublon ;
- un doublon donne un fragment ; cinq fragments fabriquent une carte manquante ;
- le tirage est déterministe et idempotent pour une même unité d'achat éligible.

L'ancien tirage Heritage après achat, y compris ses anciennes tables de
probabilités, reste dormant pour compatibilité historique et ne doit pas être
présenté comme la règle du parcours Producteurs.

## 3. Mécaniques économiques à relire

Le brouillon de règlement `PLACARD-RULES-DRAFT.md` décrit désormais les valeurs
exactes actuellement implémentées : portefeuille initial de `350 $US` virtuels,
prix des dix-neuf équipements durables achetables, effets persistants des trois
incidents, seuils et rendements des dix voies de vente, calcul de la réputation et ordre
de départage du classement. Cette monnaie reste strictement interne au jeu et
n'est ni achetable ni convertible.

Avant l'approbation du règlement, la relecture produit doit notamment confirmer :

- que le rythme d'accès aux équipements reste motivant sur plusieurs cultures ;
- que la biomasse constitue un filet de sécurité sans devenir la meilleure voie ;
- que le seuil de réputation à `6,2/10` récompense la qualité sans bloquer les
  nouveaux joueurs ;
- que les avantages d'équipement et les réponses aux incidents restent lisibles
  dans le HUD, la boutique, la culture et le marché ;
- que tous les montants sont présentés comme valeurs fictives du jeu.

Ces chiffres sont couverts par des tests de cohérence entre le catalogue, le
moteur et le brouillon. Cette couverture technique ne remplace pas leur
validation éditoriale, juridique et d'équilibrage.

La table d'équilibrage du pilotage admin permet de faire varier la note et le
poids sans écrire de donnée joueur. Son scénario étalon (`8,8/10`, `100 g`)
exige que les huit transformations soient financièrement préférables au lot brut.
Les ateliers accessibles doivent amortir leur kit minimal en 3 à 18 récoltes ;
les chaînes américaines de séparation statique, de lavage ou de pressage de fin
de progression peuvent demander jusqu'à 36 récoltes. Le reliquat non traité est
vendu brut quand sa note le permet, sinon en biomasse. Les prix d'achat restent
alignés sur les dix-neuf références achetables et les trois équipements de départ,
soit vingt-deux références matérielles contrôlées le `2026-09-01`. Le préflight
admin compare également les prix de paiement Supabase au catalogue versionné.

## 4. Fiche Saison 1 à compléter

| Champ | Valeur validée |
| --- | --- |
| Code technique | `KQ-2026-S1` |
| Date et heure d'ouverture | à décider |
| Date et heure de clôture | à décider |
| Territoire | à décider |
| Âge et conditions de participation | à décider |
| Nombre minimal de duels officiels | `3` actuellement implémenté |
| Lots Champion / Podium / Finaliste / Participant | à décider |
| Valeur commerciale totale | à décider |
| Mode, délai et coût de remise | à décider |
| Contact et procédure de réclamation | à décider |

Une fois cette fiche intégralement décidée, ses valeurs doivent être transcrites
dans un unique `KQ_LAUNCH_DOSSIER_JSON`, relues dans le préflight admin, puis les
cinq validations peuvent être basculées séparément. Le préflight détaille les
champs manquants ; il ne complète et n'approuve aucune décision automatiquement.
L'assistant « Saison 1 · assistant de décision » du pilotage admin permet de
préparer ces valeurs, de contrôler les cinq sections, de calculer la valeur
totale annoncée des lots, puis de copier la variable ou télécharger le JSON. Il
travaille uniquement dans le navigateur et n'écrit aucune configuration serveur.

## 5. Ordre de validation

1. compléter et faire approuver la fiche Saison 1 ;
2. confronter les probabilités et les mécaniques économiques ci-dessus au code,
   aux tests et aux migrations de recette ;
3. valider l'équilibrage du portefeuille, des équipements, du marché et de la
   réputation, puis intégrer les décisions dans le règlement public ;
4. faire relire le règlement et les mentions de données personnelles ;
5. basculer les cinq validations dans l'environnement de recette ;
6. effectuer la recette mobile multi-comptes ;
7. reproduire les mêmes valeurs en production pendant la fenêtre coordonnée ;
8. ouvrir `KQ_PLAYER_API_LIVE` en dernier.

## 6. Recette mobile locale multi-comptes

Le contrôle automatisé exige par défaut deux comptes locaux dont les tailles de
collection diffèrent. Le mode conseillé ouvre lui-même les deux sessions auprès
du serveur local à partir d'un tableau JSON placé uniquement dans l'environnement
du processus. La variable est retirée avant le lancement de Chrome et ni les
emails, ni les mots de passe, ni les cookies ne figurent dans le rapport. Aucun
secret de recette ne doit être ajouté à `.env.local` ou à un fichier suivi par Git.
Chaque exécution crée sans écrasement une preuve JSON horodatée dans
`output/placard-mobile-audits/`. Ce sous-dossier est ignoré par Git ; copier le
rapport validé dans le dossier de livraison sécurisé retenu pour la recette. Un
autre sous-dossier du projet peut être choisi avec `PLACARD_MOBILE_REPORT_DIR`,
mais le script refuse tout chemin situé hors du workspace.

```powershell
$env:PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON='[{"label":"debutant","email":"recette1@example.test","password":"mot_de_passe_1"},{"label":"collectionneur","email":"recette2@example.test","password":"mot_de_passe_2"}]'
npm.cmd run audit:placard:mobile
Remove-Item Env:\PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON
```

Le mode historique `PLACARD_MOBILE_AUDIT_COOKIES`, séparé par `||`, reste
disponible lorsqu'une session a déjà été préparée. Les deux modes sont exclusifs.
Le serveur local doit être démarré avec un `KQ_LAUNCH_DOSSIER_JSON` de recette
complet, `KQ_PLAYER_API_LIVE=true` et les cinq validations
`KQ_*_APPROVED=true`, uniquement dans son processus de recette. Les valeurs de
production restent fermées jusqu'aux décisions formelles.

Avant Lighthouse, le script exige pour chaque compte une page Placard, un
bootstrap authentifié, le catalogue matériel et le marché en `200`. Il refuse
donc une page introuvable, une redirection vers la connexion, une session
expirée ou un sous-système économique indisponible. Lighthouse mesure ensuite
trois états au format 390 × 844 : le HUD d'accueil, le catalogue matériel ouvert
et le comptoir du marché. Le rapport compare les collections, détaille chaque
état par profil et publie le pire résultat sans exposer les cookies. Les
problèmes d’accessibilité ne conservent que leur identifiant, leur titre et le
nombre de nœuds touchés : aucun extrait du DOM authentifié n’est archivé.

Cette mesure ne remplace pas les essais sur téléphones réels. La validation
humaine doit encore couvrir le confort tactile, le clavier virtuel, les zones
sûres iOS, le changement d'orientation, la lisibilité en extérieur, un achat
réel de matériel et une vente réelle complète sur chaque appareil.

Le pilotage admin contient désormais une checklist dédiée « Appareils réels ·
recette humaine ». Elle impose dix contrôles sur un iPhone physique avec Safari
et les mêmes dix contrôles sur un téléphone Android physique avec Chrome. Les
choix sont conservés localement dans le navigateur ; aucun modèle de téléphone,
compte, email ou commentaire libre n'est enregistré. Après validation des vingt
contrôles, exporter la preuve JSON et la déposer dans
`output/placard-mobile-manual-reviews/`. Une décision « Bloqué » ou « À tester »
empêche le dossier consolidé de passer.

Le contrôle marché ne peut être validé qu'après avoir choisi une option sur un
lot prêt, confirmé la vente au pouce, obtenu le reçu puis constaté le versement,
le gain de réputation et le statut vendu du lot. Un second appui ou un rejeu de
la requête ne doit jamais produire un second crédit. Ce protocole est exigé sur
iPhone/Safari et Android/Chrome.

Le contrôle panier ne peut être validé qu'après un achat réel : ajouter un
matériel compatible et abordable, ouvrir le tiroir au-dessus du voile sombre,
faire défiler son contenu, confirmer la commande, installer le matériel depuis
le reçu puis vérifier le nouveau solde et l'inventaire dans le HUD. Le retour au
catalogue ne doit montrer ni second débit ni doublon. Ce protocole est exigé sur
les deux téléphones ; les anciennes preuves v1 et v2 sont refusées.

Avant cette recette, ouvrir la planche « Direction artistique · recette humaine »
dans le pilotage admin du Placard. Les 89 médias du socle et chaque Héritage
des producteurs actifs doivent être examinés et le
rapport JSON exporté. Tout élément marqué « À retoucher » maintient le chantier
artistique ouvert, même si les contrôles automatisés de format et de poids sont
verts. Une décision est liée au chemin exact du fichier examiné : remplacer un
visuel le remet automatiquement « À contrôler ». Un rapport archivé peut être
réimporté, mais ses décisions périmées ou étrangères au manifeste courant sont
écartées et signalées.

## 7. Recette des rétro-attributions

Les trois traitements admin fonctionnent désormais par lots avec une simulation
globale en lecture seule avant toute écriture :

- missions Carnet vers boosters La Botte ;
- avis validés sur les fleurs concours vers cinq boosters et Héritage producteur ;
- ancien flux Héritage lié aux achats, conservé dormant pour contrôle historique.

Une exécution exige simultanément :

1. une session admin valide ;
2. `KQ_RETRO_ADMIN_WRITES_ALLOWED=true` sur la copie de recette ;
3. la confirmation serveur `EXECUTE_RETRO_BATCH` ;
4. l'empreinte de la simulation du même curseur ;
5. une nouvelle simulation serveur identique juste avant l'appel des RPC.

Si une attribution intervient entre l'aperçu et l'exécution, l'empreinte change
et le lot est refusé. Le verrou d'écriture reste à `false` en local standard et
en production hors fenêtre contrôlée. Les compteurs initiaux du panneau admin
décrivent seulement le compte admin ; les compteurs globaux fiables sont ceux
du lot simulé.

Après chaque simulation ou exécution, le panneau propose une preuve JSON
horodatée pour le lot Carnet, Héritage ou Producteurs. Elle conserve le curseur,
l'empreinte de simulation, l'état des deux garde-fous et les compteurs propres
au traitement. Le rapport est construit par liste blanche : il n'inclut ni
email, ni identifiant joueur, ni ligne source. Archiver la preuve de simulation
et celle d'exécution dans le dossier sécurisé de recette permet de rapprocher
exactement les deux passages sans exporter les données de production.

## 8. Charge et smoke tests transactionnels

Le test de charge Placard reste en lecture seule. Il exige par défaut deux
cookies de comptes distincts dans `PLACARD_LOAD_TEST_COOKIES`, puis contrôle
pour chaque session la page Placard et le bootstrap en `200` avant de créer la
charge. Chaque participant consulte ensuite la page, le bootstrap, le
classement, les Fleurs, les duels, le catalogue matériel et le marché. Une
preuve v2 n'est recevable que si ces sept routes ont toutes reçu des requêtes et
respectent leur budget p95. Une cible distante n'est acceptée que si les trois
garde-fous concordent :

```powershell
$env:PLACARD_LOAD_TEST_ALLOW_REMOTE="1"
$env:PLACARD_LOAD_TEST_CONFIRM_TARGET="STAGING_READ_ONLY"
$env:PLACARD_LOAD_TEST_ALLOWED_HOST="recette.exemple.fr"
```

`PLACARD_LOAD_TEST_ALLOWED_HOST` doit correspondre exactement à l'hôte, port
compris s'il est explicite, de `PLACARD_LOAD_TEST_BASE_URL`. Les cookies ne
doivent jamais être enregistrés dans Git. Ils sont retirés de l'environnement
du processus dès leur lecture et ne figurent pas dans le rapport.

Chaque exécution terminée archive sans écrasement un rapport versionné dans
`output/placard-load-tests/`, y compris lorsque les budgets sont dépassés. Le
rapport contient la décision globale `passed`, les chemins en échec et les
mesures par route. `PLACARD_LOAD_TEST_REPORT_DIR` peut désigner un autre
sous-dossier du projet ; tout chemin extérieur au workspace est refusé.

Le smoke test transactionnel est destructif et ne possède aucun contournement
distant. Il exige à la fois un serveur web local, un
`NEXT_PUBLIC_SUPABASE_URL` fourni directement dans l'environnement du processus
et dont l'hôte est `localhost` ou `127.0.0.1`, ainsi que la confirmation
`PLACARD_SMOKE_CONFIRM_DATABASE=LOCAL_SUPABASE_ONLY`. Le script ne lit aucun
fichier `.env*`. Les actions `card`, `verdict` et `bot-challenge` exigent en plus
`PLACARD_SMOKE_CONFIRM_BURNS=LOCAL_BURNS_ONLY`; l'action `market` exige
`PLACARD_SMOKE_CONFIRM_MARKET=LOCAL_MARKET_ONLY`; l'action `equipment` exige
`PLACARD_SMOKE_CONFIRM_EQUIPMENT=LOCAL_EQUIPMENT_ONLY`.

Le scénario `equipment` exige une référence locale achetable, non possédée et
finançable. Il envoie deux fois la même clé d'achat, exige le même reçu avec le
second appel en mode `replayed`, contrôle le débit exact, installe le matériel,
puis relit l'atelier pour confirmer le solde, la propriété et l'équipement
actif. Il refuse donc une recette qui ne ferait que relire un achat antérieur.

Le scénario `bot-challenge` exige une Fleur locale disponible issue d'une
culture qui valide au moins un défi du jour encore non encaissé. Il photographie
la progression et la liste des Fleurs, lance le duel d'entraînement, puis exige
le crédit exact des points de défi et de l'expérience, l'ajout des clés de défi
au profil et la disparition de la Fleur brûlée. Il rejoue ensuite la même Fleur :
le serveur doit refuser cette seconde mutation et tous les compteurs doivent
rester strictement inchangés.

Le scénario `market` reçoit un lot local déjà jugé et brûlé, une filière de
transformation et sa machine pivot. Il achète la machine si elle manque,
l'installe si nécessaire, épingle la mission d'atelier, vérifie que la note du
jury et le matériel rendent la vente disponible, puis rejoue la même demande de
vente. La recette n'est validée que si le second appel restitue le même reçu en
mode `replayed`, sans second paiement, et si la progression d'expertise est
rattachée à la mission épinglée.

Une exécution arrivée jusqu'à la réponse transactionnelle archive une preuve
versionnée dans `output/placard-smoke-tests/`. Le rapport ne contient ni cookie,
ni identifiant de culture, de duel ou de lot, ni corps de réponse : il conserve
le type de route, des empreintes SHA-256, les statuts HTTP, les contrôles
d'idempotence et d'expertise, la durée et la décision finale.
Le dossier peut être remplacé par `PLACARD_SMOKE_REPORT_DIR`, à condition de
rester à l'intérieur du workspace.

## 9. Consolidation des preuves de recette

`npm run verify:placard:launch-evidence` vérifie hors ligne que le dossier de
recette contient un ensemble cohérent et récent de preuves. Le script ne lance
aucun appel réseau et ne lit aucun fichier `.env*`. Déposer les exports dans les
sous-dossiers suivants :

- revue du socle graphique et des Héritages producteurs actifs : `output/placard-artwork-reviews/` ;
- audit mobile : `output/placard-mobile-audits/` ;
- recette humaine sur téléphones physiques :
  `output/placard-mobile-manual-reviews/` ;
- charge : `output/placard-load-tests/` ;
- transactions : `output/placard-smoke-tests/` ;
- simulations et exécutions rétro : `output/placard-retro-evidence/`.

Le contrôle exige douze validations : la revue artistique complète, l'audit
mobile des trois vues avec deux comptes, la recette humaine complète sur iPhone
et Android physiques, le test de charge, les smoke tests `card`, `verdict`,
`bot-challenge`, `equipment` et `market`, puis les chaînes rétro Carnet, Héritage et
Producteurs depuis le curseur zéro jusqu'à la fin. Pour chaque lot rétro qui
contient des écritures, la simulation et l'exécution doivent partager le même
curseur, la même empreinte et les mêmes compteurs. Un lot vide peut simplement
enchaîner le curseur suivant.

Le rapport consolidé peut ensuite être importé dans « Dossier de preuves
consolidé » du pilotage admin. L'interface recalcule sa cohérence, refuse toute
liste différente des douze preuves attendues, signale son expiration et affiche
la première action encore bloquante. Elle ne conserve dans le navigateur que
les codes, libellés, décisions et détails expurgés : les chemins des preuves
sources et leur contenu ne sont pas recopiés.

Le préflight distingue désormais la présence des deux règles Carnet de leur
activation. Pour atteindre « prêt à activer », les deux règles doivent être
configurées, tandis que leurs lignes et les fonctions Carnet, avis Producteurs,
Héritage après achat, récompenses de saison et accès joueur doivent encore être
dormants. L'ouverture de l'un de ces flux avant la fenêtre coordonnée crée un
blocage explicite ; l'accès joueur reste la dernière bascule.

Dans le pilotage admin, le verdict final croise ce préflight serveur avec le
rapport local des douze preuves. La fenêtre n'est annoncée prête que si le
rapport est complet et encore frais, et si le contenu serveur est complet avec
tous les flux dormants. Le rapport ne peut donc pas masquer un blocage serveur,
ni le préflight masquer une preuve absente. Ce voyant reste informatif et
n'active aucun mécanisme.

Pour la recette physique, le rapport consolidé distingue une preuve absente
d'une preuve v1 obsolète, d'un protocole de vente v2 manquant, d'un contrôle non
validé ou d'une décision expirée. Le détail cite le profil et le contrôle à
refaire afin que le prochain geste de recette soit directement identifiable.

Les preuves de plus de quatorze jours sont refusées par défaut. Cette fenêtre
peut être ajustée entre 1 et 90 jours avec
`PLACARD_LAUNCH_EVIDENCE_MAX_AGE_DAYS`. Le rapport consolidé, expurgé et non
écrasable est créé dans `output/placard-launch-evidence/`. Un fichier JSON
illisible ou une seule preuve manquante place le verdict global à `false`.
