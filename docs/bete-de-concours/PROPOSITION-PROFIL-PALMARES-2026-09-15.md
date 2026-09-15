# Proposition — fiche de chanvrier et palmarès

Statut : proposition acceptée et implémentée. Voir [le compte rendu de livraison](CHANVRIER-PALMARES-2026-09-15.md).

## Diagnostic du code actuel

`ChanvrierPlayerCard` affiche uniquement le personnage, son surnom, sa spécialité et un accès à la personnalisation. Le panneau ne reçoit pas de données de progression.

Les données nécessaires existent déjà en grande partie :

- `kanab-quest-game.ts` conserve, pour chaque étape résolue, les trois dés finaux, le résultat, les étincelles et la pression ; l’état conserve aussi les combos.
- `kanab-quest-challenges.ts` définit neuf défis, dont une rotation de trois par jour. Quatre étincelles, deux réussites exceptionnelles, une culture sans échec et le combo PBI ciblée sont déjà des conditions connues.
- `kanab-quest-missions.ts` contient neuf missions permanentes, réparties entre culture, clientèle en ligne et boutiques, avec des récompenses déjà attribuées par un mécanisme dédié.
- `contest_badges` et `contest_profile_badges` portent les badges du Carnet. Certains ouvrent déjà des récompenses La Botte.
- Les cultures, fleurs, résultats de duels, partenaires commerciaux, ventes et maîtrises de filières sont persistés côté serveur.

Un résultat « critical » ne signifie pas forcément trois 6 : le moteur le déduit de trois réussites. Le succès Triple étincelle doit donc examiner les trois faces finales, et non ce libellé.

## Expérience proposée

L’onglet actuel reste visible avec le petit portrait et le surnom. Un indicateur signale un nouveau badge ou succès. Son ouverture déploie une véritable fiche de joueur : panneau large sur ordinateur, fenêtre adaptée au téléphone avec défilement interne et fermeture accessible au clavier.

Le portrait, le surnom, le titre choisi, la spécialité et trois badges épinglés forment l’en-tête. La longue explication du bonus de départ est rangée derrière « Ma spécialité ». On conserve les progressions existantes : réputation, ligue et palmarès ; pas de nouvelle monnaie ou jauge d’XP.

Trois onglets suffisent :

1. **Mon parcours** : réputation et prochain palier, ligue/classement actuel, cultures terminées, meilleure note du jury, bilan des duels. Trois objectifs proches au maximum, provenant des missions ou succès, avec leur progression et un lien vers l’action utile.
2. **Succès** : collection permanente des exploits de jeu, filtres Culture / Dés / Commerce / Arène, progression, condition précise et récompense. Un objectif peut être épinglé. Les succès verrouillés restent lisibles.
3. **Badges** : vitrine commune des distinctions du Carnet, des succès et des saisons. Le détail précise l’origine, la condition et la date d’obtention. Le joueur choisit trois badges et un titre à afficher sur sa carte.

Un seul endroit pour consulter sa progression, avec des liens vers les écrans existants de missions, de Carnet et de collection. Une mission déjà récompensée n’attribue pas un second pack parce qu’elle est aussi visible dans la fiche.

## Premier catalogue de nouveaux succès

Les seuils ci-dessous sont une proposition de réglage initial, à mesurer en jeu avant de les étendre.

| Famille | Condition | Paliers proposés | Distinction |
| --- | --- | --- | --- |
| Triple étincelle | Trois dés finaux égaux à 6 lors d’une même étape validée | 1 / 5 / 20 occurrences | Badge aux trois dés ; titre « Porte-étincelles » au dernier palier |
| Collectionneur d’étincelles | Total des étincelles dans les cultures terminées | 25 / 100 / 300 | Badge bronze, argent, or |
| Culture exemplaire | Réussir les six étapes d’une culture, sans résultat fragile ni échec | 1 / 5 / 20 cultures | Badge de maîtrise |
| Sang-froid | Terminer une culture avec une pression finale à zéro | 1 / 10 / 30 cultures | Badge de régularité |
| Défense naturelle | Déclencher réellement « PBI ciblée » dans une culture terminée | 1 / 5 / 15 cultures | Badge de protection |
| Jury conquis | Obtenir une note finale de jury d’au moins 9/10 | 1 / 5 / 15 fleurs distinctes | Badge de qualité ; cadre de portrait au dernier palier |
| Artisan polyvalent | Vendre un produit transformé dans trois filières différentes, hors fleurs brutes et biomasse | 1 objectif | Badge d’atelier |
| Victoire parfaite | Gagner les trois manches d’un duel officiel contre un autre joueur | 1 / 5 / 15 duels | Badge d’arène ; titre au dernier palier |

Les missions existantes fournissent déjà les étapes « première récolte », « trois variétés », « fleur de concours », puis les paliers de clients et de boutiques. Les afficher comme parcours existants évite de recréer des objectifs identiques avec des packs supplémentaires.

### Règles de validation

- Triple étincelle se base sur les trois dés conservés au verdict, après les effets autorisés des cartes et de l’Héritage. Les relances provisoires et le dé bonus non conservé ne comptent pas.
- Un triple 6 déclenche immédiatement un petit effet et le message « Triple étincelle ! ». Le succès permanent est validé à la fin de la culture, pour éviter les cultures abandonnées à répétition.
- Un succès de culture est compté une fois par culture, sauf les occurrences de triple 6 et les étincelles, agrégées une fois depuis ses étapes validées.
- La progression de clientèle conserve le meilleur palier atteint. Perdre ensuite des clients ne retire pas un badge déjà obtenu.
- Les défis journaliers restent des objectifs renouvelables ; les succès sont permanents. Leurs récompenses ne sont pas recalculées à chaque ouverture de la fiche.
- Seules les actions validées sur le serveur comptent. Les simulations locales et les aperçus ne donnent aucun succès.

## Récompenses et équilibre

Les distinctions donnent d’abord des badges évolutifs, titres et cadres. Elles n’ajoutent pas de bonus permanents de qualité, de rendement ou de réputation : ces paramètres ont déjà leur progression propre.

Pour proposer aussi des packs sans multiplier les distributions, un parcours global accorde **un pack La Botte à 5 familles de succès débloquées, puis un à 8 familles**. Chaque famille ne compte qu’une fois, même si ses trois paliers sont atteints. Les badges importés du Carnet et les missions déjà rémunérées sont exclus de ces compteurs. Ces deux versements ne se réinitialisent pas à chaque saison.

La première version comporte huit familles : les deux paliers sont donc atteignables dès le lancement. Suivre le nombre de packs distribués et le rythme réel de progression avant d’ajouter des familles ou des récompenses.

## Implémentation proposée

### Lecture et interface

- Conserver l’onglet et le personnage existants, remplacer le contenu de `ChanvrierPlayerCard` par une fiche à trois onglets.
- Créer une lecture privée `GET /api/arena/chanvrier/progress` rassemblant résumé, succès, badges, objectifs et distinctions épinglées.
- Charger cette réponse à l’ouverture du profil, réutiliser brièvement la réponse en mémoire et l’invalider après culture, vente, duel ou attribution de badge. Pas de polling ni abonnement Realtime.
- Garder les images du personnage en cache navigateur. Utiliser les icônes existantes et des cadres dessinés en CSS/SVG pour les badges.
- Afficher un chargement puis un message avec relance si les statistiques sont indisponibles ; l’identité et la personnalisation doivent rester accessibles.

### Progression côté serveur

- Un catalogue versionné définit les codes, familles, paliers, critères, titres et récompenses.
- Une table de compteurs par joueur conserve les totaux et records utiles. La fiche ne recharge pas les historiques complets.
- Une table de progression conserve valeur, palier obtenu et date de déblocage pour chaque famille.
- Les badges obtenus apparaissent dans la vitrine existante via des codes réservés `kq-*`, sans réutiliser les règles de récompense du Carnet.
- L’évaluation s’exécute dans les transactions qui terminent une culture, enregistrent une vente ou valident un duel. Une clé d’événement unique empêche de compter deux fois une même culture, étape ou transaction rejouée.
- Les packs utilisent les entitlements existants, avec une source dédiée et une clé unique par joueur et palier de récompense. Créer cette source dans la contrainte de base si nécessaire. Aucun second moteur d’ouverture de packs.
- Les badges et titres épinglés sont vérifiés côté serveur : le joueur doit les avoir obtenus.

### Reprise de l’historique

Une migration de rattrapage par lots peut créditer les faits démontrables : cultures terminées et leur historique final, notes de jury persistées, maîtrises de filières, résultats de duels et badges du Carnet. Elle utilise les mêmes clés d’événement que les nouvelles actions.

Les données manquantes ne sont pas inventées. Les dés finaux permettent le triple 6 proposé ; distinguer un triple naturel d’un triple obtenu grâce aux cartes demanderait des traces supplémentaires. Cette distinction n’entre donc pas dans la première version.

## Ordre de livraison

1. Fiche enrichie avec les données existantes, badges du Carnet et missions ; état de chargement indépendant du guide.
2. Compteurs et succès permanents, migration de reprise et tests d’idempotence.
3. Vitrine personnalisable, animations de déblocage et récompenses bornées.

Vérifier notamment : triple 6 réel et faux positif « critical », relance abandonnée, culture abandonnée, cumul avec Main Verte, vente en plusieurs fois, répétition d’une requête, concurrence entre deux onglets, droits d’accès, récompense déjà reçue, reprise historique et affichage sur petits écrans.

## Correction indépendante terminée

La migration `20260914000500_kq_shop_offer_precision.sql` a été appliquée et le test SQL rejoué le 15 septembre 2026. Elle résout le refus des offres CBD shop causé par un résidu décimal dans la progression des partenaires. La vente passe au prix prévu ; une modification significative et une double exécution restent contrôlées. Les essais utilisent un joueur fictif dans une transaction annulée.
