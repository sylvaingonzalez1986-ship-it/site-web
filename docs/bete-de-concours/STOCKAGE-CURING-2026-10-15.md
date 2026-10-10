# Stockage et affinage après récolte

## Application en base le 10 octobre 2026

À la demande de l’utilisateur, les migrations `20261007000200_kq_first_culture_rescue`, `20261010000100_kq_culture_care` et `20261010000200_storage_curing` ont été appliquées avec succès au projet Supabase lié `eyowwwpdmfrulhkpvlnf`, dont la référence correspond à la configuration du site. La prévisualisation ne proposait que ces trois migrations. Le registre distant confirme les trois versions et la prévisualisation suivante indique que la base est à jour.

Vérification distante terminée le 10 octobre à 13 h 04, heure de Paris : les six nouvelles tables refusent l’accès direct de `service_role` (HTTP 403, code 42501), les six RPC attendues figurent dans le schéma de l’API et la colonne `kq_commerce_quotes.storage_revision` est accessible au serveur. Ces contrôles utilisaient uniquement les métadonnées et des lectures avec `limit=0` ; aucune RPC de compte joueur n’a été appelée. Rapport : `output/storage-curing/migration-verification.json`.

Cette application concerne la base seulement. Le nouveau code du jeu doit être publié pour produire les devis et options comprenant les informations de stockage désormais requises par la base. Aucun reset ni déploiement de l’application n’a été effectué lors de cette opération.

L’évolution vers les contenants unitaires et la gestion du surplus a ensuite été appliquée au même projet : `20261010000300_storage_capacity.sql` et `20261010000400_storage_overflow_cron.sql`. Le registre distant confirme les deux versions. La seconde migration installe le job PostgreSQL `kq-storage-overflow-sales`, sous le rôle permanent `postgres`, toutes les cinq minutes.

Vérification distante complémentaire terminée le 10 octobre à 13 h 24, heure de Paris : les deux tables privées refusent l’accès direct de `service_role` ; les deux nouvelles RPC figurent dans le schéma de l’API. Un appel du traitement automatique limité à un compte a répondu HTTP 200 avec zéro compte échu, zéro vente et zéro erreur. Aucun compte joueur n’a été modifié par cette vérification. Rapport : `output/storage-curing/capacity-migration-verification.json`. Le code du site reste à publier pour afficher les achats en quantité et le suivi du surplus ; l’ancien RPC d’achat forfaitaire est désormais inaccessible.

Validation locale de cette évolution : TypeScript et ESLint valides, 132 tests ciblés, 88 assertions SQL et 29 contrôles navigateur sur ordinateur et mobile. Le job planifié lui-même n’est pas exécuté par les tests locaux ; son traitement a été appelé séparément sur la base distante comme indiqué ci-dessus.

La réduction du curing à **6 heures réelles** a été appliquée le 10 octobre 2026 à 17 h 19, heure de Paris, avec la migration `20261010000700_storage_curing_six_hours.sql`. Le lot isolé ne proposait que cette migration ; `20261010000500_botte_situations_epic.sql`, également en attente, a été exclue. Le registre distant confirme la version `20261010000700` et la prévisualisation suivante confirme que ce lot est à jour. Les échéances existantes supérieures à six heures ont été raccourcies depuis leur verdict initial, avec incrément de révision pour invalider les anciennes offres. Le code de l’interface n’a pas été déployé par cette opération. Reçu : `output/storage-curing-six-hours/application.json`.

Le délai du surplus sans contenant a ensuite été ramené à **1 heure réelle après le verdict** avec `20261010000800_storage_overflow_one_hour.sql`, appliquée le 10 octobre 2026 à 17 h 34, heure de Paris. Seule cette migration a été proposée puis appliquée au même projet ; le registre distant et la prévisualisation du lot isolé confirment l’application. Les délais existants plus longs ont été raccourcis sans redémarrer l’attente ; les surplus déjà échus sont traités par le mécanisme habituel, sans vente exécutée par la migration. Validation : tests ciblés réussis, 144 assertions SQL capacité, 237 assertions SQL stockage, contrôle des permissions sur 282 migrations et 34 contrôles navigateur. Cette opération ne publie pas le code de l’interface. Reçu : `output/storage-overflow-one-hour/application.json`.

## Parcours retenu

La sixième opération devient **Séchage** à l’écran. L’identifiant historique `Séchage & affinage` reste interne pour préserver les situations, illustrations et historiques. Terminer cette opération ne signifie plus que le lot a terminé son affinage commercial.

Le parcours retenu est **récolte et séchage → jury/duel → affinage → vente**. Le verdict déclenche 6 heures réelles d’affinage, indépendamment du calendrier du jeu. L’attente avant le jury ne compte pas dans ce délai. Avant maturité, seul le grossiste reprend le lot. Cette durée, ce point de départ et cette restriction sont des règles économiques du jeu : ils ne constituent ni un protocole réel ni une durée scientifique universelle. L’installation de stockage protège le lot pendant cette attente ; elle ne raccourcit pas le délai.

## Ce que montrent les études

- **Baek, Grab et Chen, 2025**, étude expérimentale sur deux cultivars de chanvre : trois semaines de curing après différents séchages n’ont pas modifié significativement les cannabinoïdes totaux dans les conditions étudiées. Des conversions entre formes acides et neutres ont été observées. Les auteurs demandent davantage de données expérimentales sur l’affinage. L’étude ne permet pas de promettre un gain aromatique systématique ou de fixer un optimum à deux mois. [Article primaire, Plants 14(3), 414](https://pmc.ncbi.nlm.nih.gov/articles/PMC11821007/).
- **Milay et al., 2020**, suivi chimique après récolte : l’expérience comprend un mois d’affinage préalable, puis étudie le stockage. Les terpènes diminuent avec le temps dans les conditions testées ; la composition cannabinoïde évolue aussi. Conserver un profil ne revient donc pas à fabriquer de nouveaux composés. [Article primaire, Frontiers in Plant Science 11:583605](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2020.583605/full).
- **Spadafora et al., 2024**, comparaison de séchages et de contenants : les effets sur les composés volatils et sur les formes acides/neutres des cannabinoïdes diffèrent. Un contenant favorable à un critère n’est pas automatiquement supérieur pour tous les autres. [Article primaire, Analytical and Bioanalytical Chemistry](https://pubmed.ncbi.nlm.nih.gov/38702447/).

Conséquence de conception : la maturité commerciale progresse avec le temps, tandis que la conservation peut se dégrader. Une meilleure installation limite les pertes simulées ; elle ne restaure pas des terpènes déjà perdus, n’augmente pas automatiquement le rendement et ne bonifie pas un taux de THC plus élevé. Les profils chimiques affichés restent simulés. Le jury historique reste un instantané du lot évalué, distinct de son état commercial courant.

Ces études ne constituent pas un comparatif indépendant des cinq familles de stockage du catalogue. Les protections attribuées aux contenants sont des coefficients de jeu ; les promesses commerciales des fabricants ne sont pas traitées comme des mesures scientifiques de ces coefficients.

## Références réelles du catalogue

Prix publics relevés sur les pages des fabricants, dans leur devise d’origine. Les formats diffèrent ; livraison, fiscalité et disponibilité ne sont pas comparées. Ces repères ne sont pas les prix des installations du jeu.

| Famille | Référence et prix public indicatif | Usage documenté et limite retenue |
| --- | --- | --- |
| Bocal hermétique | **Le Parfait Color Vis 1 L : 4,30 €**. Le Parfait Super 1 L : lot de six à 20,90 €, soit 3,48 € par bocal. | Verre réutilisable, fermeture hermétique, conservation alimentaire générale. Le fabricant réserve plutôt Color Vis aux ouvertures fréquentes : éviter de présenter Super comme un appareil spécialisé validé pour le curing. [Color Vis](https://www.leparfait.com/fr/products/le-parfait%C2%AE-color-vis), [Super](https://www.leparfait.com/fr/products/le-parfait%C2%AE-super?variant=44652524110163). |
| Sachets techniques | **Grove Bags TerpLoc Window Pouch**, plusieurs formats du huitième d’once à la livre. | Emballage souple multicouche dont le fabricant décrit des propriétés de perméabilité et de protection pour la conservation. Son faible prix unitaire ne prouve aucune supériorité générale sur le verre. Le prix d’appel de 0,35 USD correspond au plus petit format, pas à tous les sachets. [Formats, dimensions et prix](https://grovebags.com/products/terploc-window-pouch-single). |
| Bocal et régulateur passif | **Vivi Fresh, anciennement Boveda Herbal : 14,99 USD pour dix sachets du petit format** ; bocal vendu séparément. | Consommable de régulation passive bidirectionnelle, destiné à accompagner un contenant hermétique. Il a une durée de service limitée et ne remplace pas le séchage. Ne pas confondre la gamme de conservation Fresh avec la gamme Cure. [Fiche et conditionnement](https://store.vivipacks.com/products/vivi-fresh), [changement de marque](https://help.bovedainc.com/what-happened-to-boveda-herbal). |
| Contenant inox et régulateur | **CVault avec sachet Fresh inclus : dès 18,99 USD**, pour la plus petite référence de 7 g. | Inox, joint, protection contre la lumière, logement pour régulateur. La robustesse du contenant et la consommation de sachets constituent les différences matérielles principales. Le fabricant précise que le lot doit déjà être séché ; ce prix d’entrée n’est pas celui d’un grand contenant. [CVault](https://store.vivipacks.com/products/cvault). |
| Armoire active | **Cannatrol Cool Cure C : 999 USD ; C+ : 1 049 USD ; C2 : 1 199 USD**. | Appareil électrique actif présenté pour séchage, affinage et stockage. Investissement, capacité et dépendance à l’alimentation le distinguent des contenants passifs. Aucune promesse de gain terpénique chiffré n’est reprise comme fait indépendant. [Comparatif officiel des modèles](https://cannatrols.com/pages/cool-cure-models). |

Les bocaux Fido de Bormioli Rocco constituent une autre référence de contenant hermétique généraliste ; aucun prix fabricant comparable n’a été retenu. [Catalogue du fabricant](https://www.bormiolirocco.com/upload/catalogues/KITCHEN%20_GLASSWARE%20_2023.pdf).

## Contenants unitaires et capacités

La demande du 10 octobre remplace les installations forfaitaires illimitées par des **contenants achetés à l’unité, en plusieurs exemplaires**. Deux bocaux de 1 L sont offerts au départ, soit une capacité totale de 100 g dans le jeu. Tous les achats supplémentaires sont payants. Le catalogue reste commun à toutes les tentes du joueur.

| Contenant | Format réel documenté | Capacité retenue dans le jeu | Prix unitaire du jeu |
| --- | --- | ---: | ---: |
| Bocal Le Parfait Color Vis | 1 L | 50 g | 5 € |
| Bocal Le Parfait Color Vis | 2 L | 100 g | 9 € |
| Bocal Le Parfait Color Vis | 3 L | 150 g | 12 € |
| Sachet Grove Bags TerpLoc | 1 oz | 28 g | 3 € |
| Sachet Grove Bags TerpLoc | 1 lb | 454 g | 15 € |
| Bocal et régulateur Boveda / Vivi Fresh | Bocal de 1 L et régulateur passif | 50 g | 9 € |
| Contenant CVault et Vivi Fresh | 2 oz, annoncé pour 50 à 56 g | 56 g | 35 € |
| Contenant CVault et Vivi Fresh | 1 lb | 454 g | 120 € |
| Armoire Cannatrol Cool Cure | Stockage sec annoncé jusqu’à 4,5 lb | 2 000 g | 1 800 € |

Les volumes Le Parfait de 1 L, 2 L et 3 L sont documentés par [le fabricant](https://www.leparfait.com/fr/pages/les-bocaux-le-parfait-a-vis). **50 g par litre est une convention d’équilibrage du jeu**, pas une conversion physique universelle ni une capacité de fleurs annoncée par Le Parfait : la masse réelle dépend notamment du produit, de sa densité et de son état. Le bocal accompagné d’un régulateur conserve la même capacité de jeu.

Les formats Grove Bags sont ceux de [la fiche TerpLoc Window Pouch](https://grovebags.com/products/terploc-window-pouch-single). Les masses en grammes sont arrondies à partir des formats nominaux en onces et livres. [CVault](https://store.vivipacks.com/products/cvault) donne aussi des capacités pour les fleurs : le catalogue retient le haut de la plage nominale du petit modèle et arrondit la livre à 454 g. Pour Cannatrol, [la FAQ officielle](https://cannatrols.com/pages/faq) distingue la capacité de stockage sec de 4,5 lb, environ 2 041 g, de celle du cycle sur produit humide. Le jeu utilise **2 000 g de capacité de stockage sec**, sans reprendre un protocole de séchage.

Tous les prix de cette table sont **des prix du jeu par contenant**, indépendants des prix publics et des devises des fabricants. Les coefficients de conservation sont également des choix de jeu, sans prétendre mesurer un classement scientifique de ces marques. La durée d’affinage reste identique pour tous les formats.

## Affectation, occupation et surplus

Au verdict, le jeu réserve les contenants disponibles pour le nouveau lot. La famille choisie par défaut est prioritaire ; les autres familles sont ensuite utilisées selon leur protection. Plusieurs formats et plusieurs familles peuvent accueillir une même récolte. **Un contenant entier appartient à un seul lot à la fois** : une place inutilisée dans un bocal déjà réservé n’est pas partageable avec une autre récolte. Cela évite de simuler des mélanges entre lots et oblige à dimensionner réellement l’entrepôt.

Le joueur suit les contenants possédés, les unités occupées et libres, ainsi que les grammes protégés et le surplus. Acheter de nouveaux contenants permet de mettre à l’abri ce surplus avant sa cession. Changer de famille conserve les pertes déjà subies et l’échéance d’affinage ; le modèle tient compte du temps passé sous chaque protection sans restaurer rétroactivement la qualité.

**Le surplus dispose d’1 heure réelle après le verdict avant sa vente automatique au grossiste.** Le joueur peut acheter la capacité manquante ou céder ce surplus plus tôt. Ce délai court et la reprise automatique sont des règles de gestion du jeu choisies pour rendre le manque de place concret ; ils ne décrivent pas une durée biologique de conservation. Les quantités déjà abritées restent dans l’entrepôt. Un achat tardif ne permet pas de récupérer une quantité déjà vendue.

La vente hors connexion est exécutée dans PostgreSQL par le job Supabase Cron `kq-storage-overflow-sales`, toutes les cinq minutes, avec au plus 100 comptes traités par passage. L’échéance reste exactement fixée à 1 heure réelle après le verdict : elle est vérifiée avant chaque achat et changement de stockage. Hors connexion, le versement apparaît au passage suivant du job, normalement dans les cinq minutes qui suivent, avec un délai supplémentaire possible si la file dépasse 100 comptes. Le reçu reste consultable dans l’entrepôt. Ce mécanisme ne dépend pas de l’ouverture d’une page ni du navigateur. [Documentation Supabase Cron](https://supabase.com/docs/guides/cron/quickstart).

La reprise du surplus utilise un tarif de déstockage constant de **0,54 € du jeu par gramme brut**, identique en vente manuelle ou automatique : 30 % d’une valeur de référence de 1,80 €/g. Elle ne rapporte ni réputation ni clients. Les retenues habituelles de trésorerie s’appliquent au produit de la vente et le reçu distingue le montant brut du montant effectivement crédité. Ce tarif appartient à l’économie du jeu ; ce n’est pas un prix de marché réel.

Une récolte comportant encore du surplus ne peut pas être préparée ni transformée : il faut d’abord le stocker ou le céder. Ce verrou empêche de contourner la limite de stockage en changeant simplement la forme commerciale du produit. Après transformation, les produits issus du même lot conservent une réservation exprimée en **équivalent de fleurs d’origine**. Les ventes libèrent progressivement cette réservation ; une vente partielle peut laisser un contenant partiellement utilisé, et un contenant n’est rendu disponible qu’une fois entièrement libéré. L’équivalent fleurs est une simplification comptable du jeu, pas une mesure du volume physique d’un extrait.

Cette version ne simule pas l’autonomie ou le remplacement périodique des régulateurs, ni une consommation électrique propre à l’armoire. Les limites de capacité sont en revanche effectives pour tous les contenants, y compris l’armoire active. Le jury reste un instantané inchangé, tandis que la qualité commerciale dépend de la conservation.

## Tutoriels et limites de livraison

Les exercices restent isolés du compte. La culture fictive montre un lot à présenter au jury puis à affiner ; après le verdict, la leçon de vente avance explicitement sa propre horloge de 6 heures pour prêter un lot mûr et permettre de comparer tous les circuits sans attendre 6 heures réelles. Elle prête aussi suffisamment de bocaux pour ne pas détourner l’exercice de son objectif de vente. Cette assistance est annoncée et ne s’applique jamais à l’inventaire ni au calendrier officiel du joueur.

L’adaptateur local des ateliers prend en charge la consultation du stockage, l’achat répété de contenants en quantité, le choix par défaut, l’affectation d’un lot et la vente de surplus. L’atelier Entrepôt présente un lot juste après son verdict avec les deux bocaux de départ ; son surplus permet d’apprendre à acheter la place manquante ou à vendre au grossiste. L’atelier Marché prête un lot arrivé à maturité et suffisamment de bocaux. Les achats consomment uniquement le budget fictif, les demandes rejouées ne débitent pas deux fois et une affectation ne modifie ni l’échéance ni les pertes déjà accumulées. Les stocks pédagogiques portent les projections de conservation et de capacité : la restriction au grossiste s’applique réellement tant qu’ils ne sont pas mûrs, la préparation est bloquée en présence de surplus et les ventes libèrent l’équivalent fleurs. Aucun appel de cet adaptateur ne bascule vers le réseau.

Le point de départ est vérifié à plusieurs niveaux : `battle.burnedAt` pour les exercices et `kq_flowers.burned_at` pour les lots officiels. La date de récolte sert à la traçabilité, pas à raccourcir l’attente après le duel. Le verdict et ses notes restent conservés ; les devis commerciaux utilisent l’état courant du lot.

Les intitulés visibles distinguent le séchage joué avec les dés de l’affinage ultérieur dans l’entrepôt. Les noms internes et chemins d’illustration historiques ne sont pas renommés. La révision générale des cartes Botte du Chanvrier reste un chantier distinct.

## Présentation des contenants — 10 octobre

Le catalogue présente neuf illustrations réalistes distinctes : trois bocaux
Color Vis à vis orange, deux sachets TerpLoc, le bocal accompagné de Vivi Fresh,
deux CVault en inox et une armoire Cannatrol Cool Cure Original à porte vitrée.
Les photos des fabricants servent de références de forme et de matière. Ces
visuels ont été produits avec l’outil intégré `image_gen` ; références, prompts
et chemins des fichiers sont conservés dans `storage-containers.prompts.json`.

Les WebP locaux sont dans `public/app/kanab-quest/storage/`, en 896 × 896 pixels,
entre 25 et 58 Kio par image. La grille affiche trois colonnes sur grand écran,
deux sur tablette et une sur mobile. Les images restent entières, avec capacité,
protection de jeu, inventaire, prix unitaire, quantité et total d’achat à proximité.
Le résumé vert met en avant la place libre et le surplus ; l’échéance de vente
automatique reste accessible avant le catalogue. Les cinq niveaux visuels de
protection représentent l’équilibrage existant, sans créer une mesure scientifique.

L’audit `scripts/audit-storage-curing.mjs` vérifie le chargement des neuf visuels,
les formats 320/768/1440 pixels, les achats en quantité et la conservation des
parcours de curing et de vente de surplus. Les captures et résultats sont dans
`output/storage-curing/`.

## Remise à zéro prévue le 15 octobre

Lors du reset transactionnel du jeu et du classement, supprimer explicitement les lignes de `public.kq_storage_requests`, `public.kq_storage_overflow_sales`, `public.kq_storage_containers` et `public.kq_storage_accounts` pour les comptes inclus dans le reset. Supprimer les reçus de surplus avant les fleurs, car leur clé étrangère utilise `ON DELETE RESTRICT`. Cela efface les reçus de demandes et de surplus, les quantités de contenants et le choix par défaut ; supprimer seulement les fleurs laisserait l’inventaire en place. La prochaine initialisation redonne exactement les deux bocaux de départ.

Les lots de `public.kq_storage_lots` sont supprimés par la clé étrangère `flower_id` avec `ON DELETE CASCADE` lors de la suppression des fleurs correspondantes. Inclure ces opérations dans la même transaction que le reste du reset et vérifier les cinq tables sur le périmètre concerné avant validation. Cette note prépare la procédure ; aucun reset n’est exécuté par ce chantier.
