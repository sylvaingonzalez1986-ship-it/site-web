# Bonus assortiment de fleurs Concours

Un client qui atteint **3 g achetés de chaque fleur Concours du programme**, en cumulant ses commandes payées, débloque une seule fois :

- **1 carte Buddies épique**, tirée aléatoirement parmi les cartes épiques actives de la collection Buddies ;
- **3 packs Buddies**, de 3 cartes chacun ;
- **5 packs La Botte du Chanvrier**, de 10 cartes chacun.

Les achats de plusieurs commandes s’additionnent **pour chaque fleur**, y compris tous les achats historiques déjà payés et valides. Acheter 1 g puis 2 g d’une fleur coche sa case ; cela ne remplace pas l’achat des autres fleurs. Si le programme comporte cinq fleurs, il faut atteindre 3 g pour chacune. Acheter 15 g d’une seule fleur ne suffit pas.

Le bonus est **unique par client**, pas par commande. Acheter davantage, passer une nouvelle commande complète ou demander à nouveau la synchronisation ne redonne aucun cadeau. Un client déjà récompensé avec une ancienne version du bonus est également considéré comme récompensé.

Ce bonus ne nécessite aucun avis et s’ajoute aux packs habituels de commande, aux avantages de fidélité, à la monnaie de jeu et aux récompenses du Carnet.

## Liste des fleurs et achats historiques

La migration `20261003000200_contest_bundle_cumulative_rewards.sql` définit la version 3 cumulative. Elle fixe une liste commune de fleurs pour le programme ; la progression n’utilise pas une sélection différente pour chaque client ou chaque commande. Toutes les cultures comptent ensemble.

La sélection de départ vient des produits distincts reliés à une entrée publiée du parcours `concours`, dans une saison active et non archivée. Les fleurs doivent avoir des prix et poids valides, sans variantes dont le poids serait ambigu. Une liste vide ou invalide ne permet aucune attribution. Le stock disponible ne réduit pas la liste : une rupture ne supprime pas une fleur de la condition.

Tous les achats historiques valides de ces fleurs sont pris en compte, même antérieurs au lancement initial. Les anciens instantanés de commande et les reçus des versions 1 et 2 restent conservés. Ils ne sont pas réécrits pour fabriquer un nouvel historique de poids ou un second bonus.

## Poids et paiement retenus

Le calcul cumule les lignes des commandes du client : `quantity × unit_weight_grams`, avec la catégorie et le poids enregistrés à l’achat. Plusieurs lignes du même produit, dans la même commande ou dans plusieurs commandes, s’additionnent. Les composants de packs commerciaux, déjà éclatés en lignes produits par le checkout, comptent aussi lorsque leurs quantités et leurs prix sont valides.

Les lignes gratuites, les poids manquants ou invalides et les références de variantes `produit::variante` ne comptent pas. Les anciens instantanés de variantes peuvent contenir le poids du produit de base ; le système ne déduit aucun poids du nom ou du suffixe d’une variante.

Les achats retenus exigent un paiement confirmé `paid`, une date de paiement valide, une commande non annulée, non archivée et sans contrôle de paiement en attente. `pending`, `failed` et `not_configured` ne valent pas paiement confirmé. Le bénéficiaire vient du compte de la commande ; une ancienne commande invitée ne peut être rapprochée que d’une adresse de compte vérifiée et non ambiguë. Les montants du panier restent une estimation séparée tant que le paiement n’est pas confirmé.

## Attribution et reprise

Les trois cadeaux et leur reçu sont attribués dans une seule transaction. Le reçu `kq_contest_bundle_reward_grants` conserve le bénéficiaire, les fleurs requises, les grammes cumulés, les commandes contributrices et la carte épique tirée. Une contrainte d’unicité protège le bénéficiaire de la version 3 ; l’existence d’un reçu des versions 1 ou 2 bloque également tout nouveau cadeau. L’attribution est sérialisée par client pour couvrir deux paiements ou demandes simultanés.

Le champ `orderId` du reçu cumulatif désigne la dernière commande contributrice éligible, utilisée comme référence. Il ne signifie pas que toutes les fleurs doivent avoir été achetées dans cette commande. Les autres commandes contributrices restent enregistrées dans le reçu.

Les packs Buddies utilisent les tickets habituels, sans rattachement direct à `lottery_tickets.order_id`, pour ne pas empêcher la création des packs habituels liés au montant de la commande. Les cinq packs La Botte ont chacun `card_count = 10`, la source `contest_bundle` et une clé unique par commande et numéro de pack.

L’attribution se déclenche après un paiement confirmé ; les déclencheurs différés couvrent aussi une commande payée dont les lignes arrivent ensuite. La synchronisation authentifiée permet de reprendre une attribution manquante, notamment lorsque des achats historiques remplissent déjà la condition. Une lecture de la progression ne crée aucun cadeau. Une erreur d’attribution ne remet pas en cause un paiement réel. L’attribution reste bloquée si les collections et cartes nécessaires sont indisponibles. Une annulation après attribution ne reprend pas automatiquement des cartes déjà données.

## Interface et accès

Dans le Carnet, la couverture annonce le bonus Concours. Dans le sommaire, la barre Concours porte la mention « Bonus cadeau » et un chevron : un clic déplie le post-it juste en dessous, avant les trois cultures ; un second clic le referme. Le post-it est fermé à l’ouverture du carnet. Ce bouton fonctionne aussi au clavier et annonce son état ouvert ou fermé. Le rappel reste présent en tête de chaque chapitre Concours et sur les fiches concernées.

Une fois le post-it déplié, la liste des fleurs est directement visible. Pour un client connecté, chaque ligne indique les grammes déjà achetés ; sa case se coche automatiquement quand le cumul atteint 3 g. Ces cases décrivent les achats validés et ne se cochent pas manuellement. Les noms permettent de rejoindre les fiches, y compris dans une autre culture. Un visiteur anonyme voit l’offre mais doit se connecter pour connaître sa progression.

Quand toutes les cases sont cochées et que le bonus n’a pas encore été attribué, « Débloquer mon bonus » demande la synchronisation au serveur. Le bouton ne donne pas lui-même de cadeau : le serveur revérifie les paiements et l’absence de reçu. Un échec reste visible et permet une nouvelle tentative. Après attribution, le message « Bonus déjà débloqué » remplace la possibilité de réclamer un nouveau bonus. Aucun avis de dégustation n’est requis.

Le serveur charge l’offre et, pour la session connectée, sa progression personnelle. Aucune progression d’un autre client n’est transmise. Une offre absente ou impossible à charger n’empêche pas l’ouverture du Carnet. La note et sa liste restent dans le défilement normal de la page sur mobile comme sur ordinateur.

Le carnet actualise la progression par une lecture au montage et au retour d’onglet, notamment après un paiement. Cette lecture ne déclenche aucune attribution. Une ancienne réponse ne peut pas écraser le résultat d’un déblocage réussi ; une session expirée efface la progression personnelle affichée et propose la connexion.

Le panier distingue les grammes déjà payés de ceux ajoutés au panier et estime leur total pour chaque fleur. Changer les quantités actualise cette estimation sans transformer le panier en achats acquis. Un client déjà récompensé ne reçoit pas la promesse d’un deuxième bonus. L’aperçu n’est jamais une preuve d’attribution.

La confirmation et le détail d’une commande payée affichent uniquement un reçu enregistré pour cette commande. Un reçu acquis reste consultable même si l’offre est ensuite indisponible. La carte épique et les packs se retrouvent dans les collections et réserves habituelles.

`GET /api/account/contest-bundle-rewards` fournit l’offre courante et ne fait aucune attribution. La propriété `progress` est `null` pour un visiteur anonyme ; seuls la progression et les reçus du compte connecté sont inclus. `POST` déclenche une synchronisation pour l’identité de session, sans bénéficiaire ni quantité de récompense choisis par le navigateur. Les tables restent privées ; les RPC de lecture et de synchronisation sont réservées au serveur `service_role`.

## Vérification

- Tests unitaires du calcul d’aperçu : cumul déjà payé et panier, seuils par fleur, quantités invalides, doublons, composants de packs et variantes incertaines.
- Tests des routes et du backend : identité de session, origine des mutations, reçus et indisponibilité de migration.
- Tests PostgreSQL isolés de la migration : commandes historiques, achats fractionnés, attribution atomique unique par client, répétitions, anciens bénéficiaires et coexistence avec les récompenses habituelles.
- `node scripts/audit-contest-bundle-rewards.mjs` : composants réels et API simulée, progression du panier, reçus, erreurs et affichage à 320, 390 et 1 440 px. Rapport et captures dans `output/contest-bundle-rewards/`.
- `node scripts/audit-contest-bundle-notebook.mjs` : vrai Carnet avec offre fictive, accordéon sous la barre Concours, ouverture et fermeture au clavier, cases de progression anonyme/nulle/partielle/complète, attribution simulée et reprise après erreur, anciens bénéficiaires, navigation entre cultures et affichage mobile/ordinateur. Tous les appels d’API sont interceptés par la simulation locale. Rapport et captures dans `output/contest-bundle-notebook/`.
- `npm run check:supabase-grants` : permissions explicites des tables et fonctions.

## Historique des migrations et état de déploiement

La migration cumulative `20261003000200_contest_bundle_cumulative_rewards.sql` a été appliquée le 3 octobre 2026. Elle était la seule migration restante dans la prévisualisation. La vérification distante en lecture seule confirme le seuil de **3 g cumulés par fleur**, une progression anonyme `null`, les cinq fleurs requises, les cadeaux inchangés et les refus d’accès direct aux tables privées (HTTP 403). Rapport : `output/contest-bundle-cumulative/verification.json`.

Une vérification ciblée de 13 comptes possédant des achats historiques retrouve une progression issue de ces anciennes commandes pour chacun. Aucun de ces 13 comptes n’atteint toutes les conditions et aucun n’est marqué récompensé. Ces lectures n’ont attribué aucun cadeau. Rapport : `output/contest-bundle-cumulative/history-verification.json`.

La migration `20261002000200_contest_bundle_rewards.sql` a été appliquée le 2 octobre 2026 au projet Supabase lié `eyowwwpdmfrulhkpvlnf`, à la demande de l’utilisateur. Un lot isolé dans `output/contest-bundle-migration/deploy` a permis de prévisualiser puis d’appliquer uniquement cette migration avec `supabase db push --linked --yes --workdir output/contest-bundle-migration/deploy`. La migration du centre de mailing a ensuite été appliquée séparément le même jour.

L’activation enregistrée est le **2 octobre 2026 à 21 h 31 min 58 s, heure de Paris** (`2026-10-02T19:31:58.719901Z`). Le contrôle distant initial en lecture seule a confirmé `available = true` et les cinq fleurs requises : Cake Brulée, Strawnana OG, Legendary Platinium, White Cbg et Shaolin. Ce rapport historique précède l’abaissement du seuil à 3 g. Les trois tables privées refusent l’accès direct de `service_role` (HTTP 403, `42501`) et la RPC refuse le rôle anonyme. Aucun cadeau ni commande de test n’a été créé lors de cette vérification. Rapport : `output/contest-bundle-migration/verification.json`.

Cette première version concernait les nouvelles commandes prises individuellement. La publication du code de l’interface reste distincte de l’application des migrations.

Le 3 octobre 2026, la migration `20261003000100_contest_bundle_three_grams.sql` a été appliquée au même projet via `supabase db push --linked --yes`, après une prévisualisation ne proposant que cette migration. La vérification distante a confirmé le passage à **3 g par fleur**, les mêmes cinq fleurs et cadeaux, ainsi que la date de lancement et les permissions privées conservées. À cette étape, les anciennes commandes conservaient la règle enregistrée lors de leur création. Cette attribution par commande a ensuite été remplacée par la version cumulative décrite ci-dessus, sans modifier les reçus déjà acquis. Rapport : `output/contest-bundle-three-grams/verification.json`.
