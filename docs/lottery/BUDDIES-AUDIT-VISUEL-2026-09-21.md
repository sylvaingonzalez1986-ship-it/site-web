# Buddies — audit visuel et direction de refonte

Analyse du 21 septembre 2026. Périmètre : les 52 cartes HH2026 actives, leurs illustrations réellement référencées dans Supabase, les consignes historiques et les principaux composants de présentation.

**Recommandation : conserver l'identité cartoon et les bonnes scènes, reprendre les 52 illustrations avec une référence de dessin commune, puis les monter dans un seul gabarit décliné en cinq cadres de rareté.** Le nom détermine le sujet et ses accessoires ; la rareté détermine le cadre **et un degré croissant de finition de l'illustration**. Les Épiques et la Légendaire doivent présenter des scènes nettement plus riches et fournies que les autres. La propreté du dessin, la cohérence anatomique et la lisibilité restent exigées à tous les niveaux.

Précision utilisateur intégrée après l'audit initial : l'homogénéité porte sur le style et le gabarit ; la richesse du décor, les matières, l'éclairage et les détails augmentent avec la rareté.

Précision utilisateur ultérieure sur les cartes non possédées : conserver leur illustration visible en niveaux de gris et atténuée, avec le nom remplacé par « Carte mystère ». Ce choix remplace le masquage complet de l'illustration retenu dans la première intégration v2 ; les constats historiques ci-dessous restent inchangés.

## Éléments effectivement vérifiés

- Lecture seule de `lottery_card_definitions` : 52 cartes actives avec une image chacune, soit 33 communes, 10 argent, 5 or, 3 épiques et 1 légendaire.
- Téléchargement et examen visuel des 52 images, en cinq planches. Examen individuel supplémentaire de L'Arbre Mère, Cherry Wine et Harlequin.
- Les 52 prompts stockés en base correspondent aux prompts du catalogue documentaire. Ils ne décrivent cependant pas toujours le résultat actuel : The Wife, par exemple, porte un tailleur dans l'image et un tablier dans le prompt.
- Les originaux sont tous des PNG : 16 images de 1696 × 2528 (#1–16), 21 de 848 × 1264 (#17–37), 15 de 1024 × 1536 (#38–52). Les trois groupes de dimensions accompagnent des changements de traitement visuel ; ils ne suffisent pas à établir comment les images ont été produites.
- Le code des principaux écrans a été lu. Les recadrages signalés ci-dessous découlent de leurs règles CSS ; cet audit n'inclut pas une nouvelle session de captures de chaque écran dans le navigateur.

Les planches sont des assemblages de contrôle des images existantes, pas des propositions de nouvelles illustrations. Les noms et raretés placés sous les vignettes proviennent du catalogue.

| Planches locales, non versionnées | Contenu |
| --- | --- |
| [Cartes 1 à 12](../../output/buddies-audit/current-1-12.png) | Légendaire, épiques, or, début argent |
| [Cartes 13 à 24](../../output/buddies-audit/current-13-24.png) | Argent et début communes |
| [Cartes 25 à 36](../../output/buddies-audit/current-25-36.png) | Communes avec plusieurs types de bordures |
| [Cartes 37 à 48](../../output/buddies-audit/current-37-48.png) | Transition vers les images sans cadre |
| [Cartes 49 à 52](../../output/buddies-audit/current-49-52.png) | Dernières communes |

Les copies d'audit sont dans `output/buddies-audit/images/`. Le catalogue lu et les dimensions sont conservés dans `catalog-live.json` et `image-metadata.json` du même dossier. Les copies ont été réduites à 1024 px de large au maximum pour l'inspection ; les dimensions ci-dessus sont celles des originaux.

## Diagnostic visuel

### 1. La rareté n'a pas de silhouette stable

Les bordures sont souvent dessinées dans les illustrations. Elles changent d'une carte à l'autre, y compris dans la même rareté : les cinq cartes or présentent respectivement une scène musicale sans cadre continu, un rectangle doré, un contour tropical, des rideaux et des coins ornés d'éclairs. Ces décors peuvent rester dans les scènes, mais ne doivent plus faire office de cadre de collection.

La hiérarchie est aussi brouillée entre raretés. Les argent mêlent argent et or, parfois avec davantage d'ornements que les or. Blue Dream (#28) et Mango Haze (#36), pourtant communes, ont des bordures argentées. Les quinze dernières cartes (#38–52) sont sans cadre graphique comparable à celui des premières communes. Les trois épiques ne partagent pas de contour reconnaissable.

Ajouter une bordure CSS autour de ces fichiers laisserait les anciennes bordures à l'intérieur : il faut d'abord disposer de scènes sans cadre intégré.

### 2. La famille de personnages existe, mais son exécution varie

Les yeux, les bras souples, les gants blancs et les chaussures rétro donnent déjà une identité aux Buddies. Il serait inutile de supprimer cette base.

Les différences viennent surtout de l'échelle du personnage, de la densité du décor, du grain, des ombres et de la saturation. Harlequin remplit beaucoup la scène tandis qu'Elektra est plus petit dans un environnement spatial chargé. Les dernières cartes ont souvent davantage de vide et un fond très pâle ; Cherry Abacus (#46) et CBD Kush (#51) ont un dessin plus vif, plus contrasté et plus dynamique que plusieurs voisines.

L'Arbre Mère doit conserver sa silhouette d'arbre : c'est une exception narrative pertinente, à harmoniser par le trait, le visage, les gants et le cadre plutôt qu'en le transformant en fleur ordinaire.

### 3. Des détails sans rapport avec le sujet affaiblissent la série

- Notes de musique sur de nombreuses cartes non musicales : colle, citron, fromage, mangue, etc.
- Clé décorative sur Cherry Wine ; clés et autres symboles peu pertinents sur plusieurs argent.
- Panneaux « Old » et poteaux sur Skunk, Afghan et Cheese.
- Petites ailes sur Carmagnola et Cherry Abacus, sans justification par le nom ou la scène.
- Tache sombre sous le cor de Swiss Dream, dont le sens est incertain.
- Textes intégrés « Buds Express » et « BOOM », malgré la consigne historique sans texte.
- Petit symbole gris en étoile dans le coin inférieur droit de certaines images (#4–6), ressemblant à une marque apposée. Son origine n'a pas été établie.

Ces observations ne prouvent pas un procédé particulier de génération. Elles justifient une vérification individuelle des accessoires et des coins de chaque image.

### 4. L'interface transforme encore la carte selon l'écran

| Surface | Constat dans le code | Conséquence |
| --- | --- | --- |
| Album | Ratio global `0.72`, illustration `object-cover`, titre en dessous ; contour de 2 px avec accent à environ 33 % d'opacité | La place réservée au titre raccourcit la fenêtre et accentue le recadrage ; la rareté reste discrète. |
| Fiche détaillée | Fenêtre `3:4`, illustration `object-cover` | Une image proche de `2:3` perd environ 11 % de sa hauteur totale si elle remplit la largeur. |
| Ouverture de booster | Carte `2:3`, image `contain`, nom et rareté dans un bandeau distinct | Présentation différente de l'album et du carrousel. |
| Carrousel Buddies | Image `2:3` avec `object-cover`, pas de cadre de rareté spécifique | Le cadre dépend essentiellement du fichier ; le contour jaune indique la sélection. |

Les libellés varient également entre « Silver / Gold » et « Argent / Or ». Les palettes sont définies à plusieurs endroits, avec notamment des communes beige dans l'album et menthe dans l'ouverture de booster.

Sources : [AlbumCardSlot](../../src/components/lottery/AlbumCardSlot.tsx), [styles de l'album](../../src/components/lottery/AlbumExperience.module.css), [styles globaux](../../src/app/globals.css), [CardDetailModal](../../src/components/lottery/CardDetailModal.tsx), [PackOpeningAnimation](../../src/components/lottery/PackOpeningAnimation.tsx), [styles d'ouverture](../../src/components/lottery/PackOpening.module.css), [KqBuddieCarousel](../../src/components/placard/KqBuddieCarousel.tsx), [styles du carrousel](../../src/components/placard/KqBuddieCarousel.module.css), [tokens de rareté](../../src/lib/lottery-card-ui.ts).

## Direction proposée : un gabarit, cinq cadres

La silhouette extérieure, les marges, la fenêtre d'illustration, le cartouche de nom, le numéro et l'emplacement de la rareté restent identiques. Pour le cadre, les couleurs, les motifs du contour et le symbole de rareté changent. Les ornements restent dans l'espace réservé au cadre et n'empiètent pas progressivement sur l'illustration. À l'intérieur de cette même fenêtre, la scène gagne en richesse et en finition selon la rareté.

Les couleurs suivantes sont une proposition de direction, pas une palette déjà appliquée ou mesurée pour le contraste.

| Rareté | Couleur dominante du cadre | Traitement distinctif | Repère complémentaire |
| --- | --- | --- | --- |
| Commune | Ivoire `#F3E8D1`, encre vert profond `#173D32` | Contour simple, papier mat, très peu d'ornements | Graine + « Commune » |
| Argent | Acier clair `#C5D1DA`, ardoise `#405566` | Double filet et petites gravures régulières | Losange + « Argent » |
| Or | Or chaud `#D7AD42`, brun `#624715` | Double filet doré et courts rayons dans les coins | Soleil + « Or » |
| Épique | Violet `#7950AE`, lilas `#DCC4F5` | Motif stellaire et médaillon étoilé | Étoile + « Épique » |
| Légendaire | Vert presque noir `#102A25`, or lumineux `#E7BD59` | Contour sombre, or et halo ; motif botanique exceptionnel | Couronne botanique + « Légendaire » |

Le légendaire doit rester identifiable face à une carte or, même sans animation. La couleur est doublée d'un motif, d'un symbole et d'un libellé. Un état « sélectionné » reste un indicateur d'interface extérieur au cadre, pour ne pas être confondu avec une rareté.

Proposition de gabarit à prototyper sur un recto de **1024 × 1536** :

- Marge extérieure constante de 48 px.
- Zone du nom entre y = 48 et y = 180, avec deux lignes possibles et une typographie stable.
- Fenêtre de scène x = 64, y = 204, largeur = 896, hauteur = 1120, soit un ratio **4:5**.
- Pied de carte x = 48, y = 1348, largeur = 928, hauteur = 140, contenant numéro et rareté.
- Descriptions longues et informations contextuelles à côté de la carte ou dans la fiche, pour préserver la lisibilité du recto.

Ce choix distingue le ratio de la carte finale (`2:3`) de celui de la scène (`4:5`). Il exige de recomposer les scènes pour cette fenêtre : recadrer automatiquement les anciens fichiers `2:3` couperait encore des accessoires. Les dimensions proposées doivent être éprouvées avec les noms les plus longs et la plus petite taille réelle de l'album.

## Charte commune des illustrations

- Choisir une référence principale du personnage et une courte planche de proportions. Le visage de Strawberry/Cherry Wine/Gelato fournit une base proche de la majorité actuelle ; le dynamisme de Cherry Abacus peut inspirer les poses sans reprendre ses ailes parasites.
- Fleur de chanvre personnifiée, silhouette et volumes cohérents, bras et jambes souples, gants blancs et chaussures de même famille. Expressions et poses variées.
- Même famille d'encrage sombre, couleurs maîtrisées et trame rétro fine. Les ombres restent dessinées dans le vocabulaire cartoon ; modelé, lumière secondaire, reflets et textures se développent avec la rareté. Une carte Épique ou Légendaire reste dans le même univers graphique, avec une exécution plus élaborée.
- Personnage occupant généralement 65 à 75 % de la hauteur utile de scène, à vérifier visuellement plutôt que comme contrainte rigide. Exceptions composées pour l'Arbre Mère, Therapy allongé ou un accessoire encombrant.
- Un sujet et un accessoire principal immédiatement liés au nom. Des éléments secondaires enrichissent la scène selon la rareté, à condition de soutenir ce thème. Le contraste et la lumière hiérarchisent visage, action et décor pour que la richesse ne masque pas le Buddie.
- Visage, mains et accessoire distinctif dans une zone sûre ; aucun élément indispensable ne passe sous les cartouches.
- Scène générée sans cadre, texte, numéro, badge ni marque. Les métadonnées et les ornements du cadre sont ajoutés par un rendu déterministe.
- Propreté et résolution suffisante pour toutes les cartes, avec un degré de finition croissant : détails du personnage et de ses accessoires, construction du décor, profondeur, matières et éclairage. Le saut est marqué entre Or et Épique, puis entre Épique et Légendaire. Une commune reste une illustration achevée et soignée.

## Échelle de finition des illustrations

Cette progression concerne l'image elle-même. Elle doit rester perceptible lorsque le cadre et le libellé de rareté sont masqués. Les repères ci-dessous sont des consignes de composition, pas un quota d'objets à ajouter : chaque détail doit contribuer au nom, au lieu ou à l'action.

| Rareté | Composition et décor | Personnage, matières et lumière | Impression recherchée |
| --- | --- | --- | --- |
| Commune | Un gag visuel, un accessoire fort, fond simple avec quelques indices de lieu. Silhouette et action lisibles immédiatement. | Volumes simples, aplats soignés, ombre principale et texture légère. Tenue et accessoire peu ornés. | Personnage attachant dans une vignette claire et finie. |
| Argent | Une petite scène située, un second plan identifiable et quelques détails narratifs utiles. | Accessoires plus travaillés, premières différences de matière, ombres mieux articulées et reflets discrets. | Illustration plus raffinée, avec un contexte à découvrir. |
| Or | Décor construit, plusieurs plans lisibles et pose plus expressive. Des détails secondaires relient le personnage à son environnement. | Costume et accessoires détaillés, matières différenciées, lumière directionnelle et accents lumineux cohérents. | Scène généreuse et animée, avec une finition sensiblement supérieure à l'Argent. |
| Épique | Grande scène narrative occupant la fenêtre : premier plan, action centrale et arrière-plan élaboré. Décor spécifique au Buddie, effets atmosphériques intégrés et détails à découvrir en grand. | Costume ou accessoires très travaillés, textures locales, reflets et contre-jour motivés par la scène. La lumière relie l'action aux différents plans. | Illustration spectaculaire, nettement plus riche et fournie qu'une Or. |
| Légendaire | Composition monumentale et singulière, plusieurs profondeurs, environnement ample et détails narratifs dans toute la scène. Le sujet central reste dominant. | Finition maximale : modelé cartoon plus subtil, textures botaniques fines, lumière exceptionnelle, reflets et atmosphère soigneusement composés. | Pièce maîtresse de la collection, clairement au-dessus des Épiques par l'ampleur et le soin de l'image. |

La progression se joue sur plusieurs axes ensemble. Ajouter un halo, augmenter la saturation ou remplir le fond de particules ne suffit pas à faire monter une carte de niveau. Les détails se concentrent autour du sujet et des éléments narratifs, avec des zones de repos pour préserver la lecture en vignette. Les communes conservent la même exigence de netteté et d'export que les cartes rares.

### Traitement attendu pour les trois Épiques et la Légendaire

- **Charlotte's Web — Épique :** conserver le Buddie et sa grande toile ; construire une véritable architecture de fils tendus entre plusieurs plans, avec croisements précis, gouttes éclairées et profondeur du ciel. La toile devient un environnement spectaculaire lié au nom, avec le personnage clairement détaché au centre.
- **Cannatonic — Épique :** conserver le laboratoire et la magie des potions ; détailler établi, verrerie, instruments et arrière-plan, avec un flacon de tonique principal. Les lueurs colorées des potions se reflètent sur les gants, le costume et les objets proches. Chaque accessoire sert l'atelier du personnage.
- **Harlequin — Épique :** conserver la représentation musicale ; développer une scène de théâtre complète, avec rideaux aux plis travaillés, boiseries, plancher en perspective et éclairage de spectacle. Soigner les losanges du costume et les détails du luth. La richesse vient du théâtre et du personnage.
- **L'Arbre Mère — Légendaire :** conserver l'arbre, son feuillage varié et le globe ; composer un arbre monumental dont racines et branches structurent un vaste paysage vivant. Différencier feuilles, bourgeons, écorce et ramifications tout en gardant une silhouette lisible. Le globe lumineux éclaire les mains et le tronc, puis la lumière se diffuse dans la canopée. Les multiples formes botaniques et les ramifications doivent exprimer « Mère / Toutes Variétés ». Cette image reçoit la plus grande ampleur de décor et le plus haut degré de finition de la série.

Les quatre cartes gardent leurs scènes et leur personnalité. Leur reprise doit développer une composition complète et des détails cohérents avec leur nom, avec un contrôle particulier de la lecture du visage dans les zones les plus fournies.

« En lien avec le nom » signifie que le rapprochement doit être compréhensible en regardant le titre et la scène. Il n'impose pas d'illustrer mécaniquement chaque syllabe, ni de représenter « CBD » sur tous les accessoires.

Pour les noms opaques, définir un ancrage éditorial documenté avant la génération. Un jeu de mots peut être choisi consciemment, mais ne doit pas être présenté comme la véritable origine d'une variété. Aucune recherche d'étymologie ou d'histoire botanique externe n'a été réalisée dans cet audit.

## Revue des 52 cartes : sujet à conserver ou à corriger

Toutes les cartes sont concernées par l'harmonisation de dessin, le nouveau cadre et l'échelle de finition ci-dessus. La colonne « Décision » porte uniquement sur la scène et sa relation au nom : « Conserver » signifie conserver son idée, tout en reprenant son exécution au degré de finition requis. Les propositions sont des directions artistiques ; elles ne constituent pas des affirmations historiques sur les variétés.

| Nº | Buddie | Décision sur la scène | Correction ou point de vigilance |
| ---: | --- | --- | --- |
| 1 | L'Arbre Mère — Toutes Variétés | Conserver et développer | Arbre monumental, feuillage diversifié, globe lumineux, paysage et racines reliés : appliquer la finition maximale décrite pour la Légendaire, avec une ramure riche mais lisible. |
| 2 | Charlotte's Web | Conserver et développer | La toile est la signature. Garder le héros en suspension et construire l'architecture de fils, les reflets et la profondeur attendus d'une Épique. |
| 3 | Cannatonic | Renforcer et développer | Garder l'atelier et les potions ; développer le laboratoire au niveau Épique avec un flacon de tonique principal. Le tonique est une lecture créative, pas une étymologie démontrée. |
| 4 | Harlequin | Conserver et développer | Garder scène, musique et costume à losanges. Enrichir théâtre, matières et éclairage au niveau Épique ; retirer les potions flottantes qui ne servent pas ce sujet. |
| 5 | ACDC | Conserver | Guitare, micro et éclairs font un ensemble lisible. Simplifier le décor pour distinguer la scène de celle d'Elektra. |
| 6 | Sour Space Candy | Renforcer | Garder astronaute et bonbon ; rendre l'acidulé perceptible par les cristaux du bonbon et une expression légèrement piquante. |
| 7 | Hawaiian Haze | Renforcer légèrement | Garder chemise, collier de fleurs, coco et plage. Une brume lumineuse discrète peut compléter le nom. |
| 8 | Lifter | Conserver | Haltérophilie immédiatement compréhensible. Simplifier rideaux et ornements ; vérifier jambes et chaussures lors de la reprise. |
| 9 | Elektra | Conserver | Éclairs et geste électrique suffisent. Agrandir le personnage et réduire les planètes et notes de musique. |
| 10 | Suver Haze | Documenter / réorienter | Le détective n'explique pas « Suver ». L'enquête peut subsister dans la brume si un motif nominal pertinent est défini ; ne pas conserver la loupe comme seule justification. |
| 11 | Cherry Wine | Conserver | Verre et cerises à montrer dans la scène elle-même. Retirer clé et notes musicales ; ne pas dépendre des cerises situées dans l'ancien cadre. |
| 12 | Ringo's Gift | Conserver | Le cadeau fonctionne. Distinguer forme, emballage et geste de Frank's Gift ; retirer le thème Noël s'il n'est pas voulu. |
| 13 | Remedy | Conserver | Personnage soignant et thermomètre traduisent le nom. Nettoyer les symboles secondaires ; rester dans le registre fictionnel. |
| 14 | Sour Tsunami | Renforcer | Conserver surf et grande vague, avec un discret indice acidulé. Retirer les objets secondaires qui n'aident pas à lire la scène. |
| 15 | Harle-Tsu | Reconcevoir | Le combattant à bandeau est peu explicite. Proposer un arlequin sur une vague : la description locale mentionne Harlequin et Sour Tsunami comme parents. |
| 16 | Stephen Hawking Kush | Renforcer | Garder le savant, remplacer le tableau scientifique générique par un motif cosmologique clair : étoiles, orbites ou trou noir schématique. |
| 17 | Pennywise | Conserver | Clown et ballon constituent une signature lisible. Harmoniser le costume et la composition. |
| 18 | Sweet and Sour Widow | Renforcer | Garder voile noir et personnage ; ajouter une opposition simple douce/acidulée, par exemple bonbon et citron. Retirer clés et montre sans lien. |
| 19 | Special Sauce | Conserver | Garder préparation culinaire, récipient et sauce. Une grande louche rendrait le geste plus lisible que les petits accessoires actuels. |
| 20 | Strawberry CBD | Conserver | Panier et fraises lisibles ; bonne référence de proportions. Retirer les notes de musique et les fruits réservés aux coins du cadre. |
| 21 | Amnesia Haze CBD | Reconcevoir le gag | La montre suggère surtout l'hypnose. Garder l'accessoire mais montrer un personnage distrait qui cherche ce qu'il tient, avec une légère brume. |
| 22 | White Widow CBD | Reconcevoir | La neige traduit « White », pas « Widow ». Proposer un voile blanc ou une mise en scène autour d'une toile blanche, puis choisir cette convention pour la famille Widow. |
| 23 | Skywalker OG CBD | Conserver / renforcer | Garder le héros à épée lumineuse ; un chemin de nuages rendrait « marcheur du ciel » plus explicite. |
| 24 | Bubba Kush CBD | Documenter / réorienter | Roi, couronne et trône n'ont pas de lien nominal établi dans le catalogue. Ne pas reconduire la royauté par défaut. |
| 25 | OG Kush CBD | Clarifier l'interprétation | La radio et la chaîne dorée peuvent constituer un parti pris culturel, mais le lien n'est pas évident pour tous. Définir l'intention avant de reconduire la scène. |
| 26 | Gelato CBD | Conserver | Glace à plusieurs boules immédiatement lisible. Garder le gag de la fonte et simplifier les petits motifs. |
| 27 | Gorilla Glue CBD | Renforcer | Garder les mains collées. Ajouter un seul indice de gorille lisible, par exemple un pictogramme sur le pot de colle, sans transformer le Buddie en autre espèce. |
| 28 | Blue Dream CBD | Renforcer légèrement | Bonnet et nuage fonctionnent déjà. Affirmer le bleu de la scène, retirer le cadre argenté et les notes musicales. |
| 29 | Pineapple Express CBD | Conserver | Le train-ananas combine très bien les deux mots. Garder le mouvement et supprimer la petite inscription intégrée à l'image. |
| 30 | Lemon Haze CBD | Renforcer légèrement | Garder le citron pressé et l'expression. Une brume citronnée légère suffit pour compléter « Haze ». |
| 31 | Critical Mass CBD | Reconcevoir | La dynamite illustre surtout l'explosion. Préférer une masse qui atteint un seuil : balance chargée ou empilement qui menace de basculer. |
| 32 | Super Lemon Haze CBD | Renforcer | Conserver le superhéros mais agrandir le signe citron dans la scène ; les citrons placés seulement dans le cadre disparaîtront. Différencier clairement sa pose de #30. |
| 33 | Skunk CBD | Conserver | Queue bicolore immédiatement reconnaissable. Retirer les panneaux et poteaux ; garder le masque uniquement s'il sert clairement le gag. |
| 34 | Afghan CBD | Documenter / réorienter | Le tapis volant donne un imaginaire trop général. Rechercher un ancrage visuel géographique ou botanique pertinent avant de choisir le décor. |
| 35 | Cheese CBD | Conserver | Fromage et geste d'étirement fonctionnent. Retirer les éléments de route et les notes musicales. |
| 36 | Mango Haze CBD | Renforcer légèrement | Garder le jonglage de mangues. Réduire les accessoires, ajouter éventuellement une légère brume chaude et retirer la bordure argentée. |
| 37 | Dinamed CBD | Documenter / clarifier | L'ADN renvoie au thème scientifique de la description, mais n'explique pas directement le nom. Définir cet ancrage éditorial ; retirer le cadre scientifique intégré. |
| 38 | Baox | Documenter / réorienter | Le bouclier ne permet pas de comprendre le nom. Fixer un motif justifiable avant de refaire la scène. |
| 39 | Berry Blossom | Renforcer | Garder le bouquet, avec des baies assez grandes pour être identifiées. À petite taille, l'image actuelle se lit surtout comme un bouquet de fleurs. |
| 40 | The Wife | Reconcevoir les indices | La scène actuelle est une personne en tailleur avec café et porte-documents. Elle peut rester, mais une alliance ou un indice de couple doit rendre le titre compréhensible. Ne pas revenir au tablier par automatisme. |
| 41 | Therapy CBD | Conserver | Divan et carnet constituent une scène lisible. Préserver la pose allongée en agrandissant suffisamment visage et accessoires dans la fenêtre. |
| 42 | Dancehall | Réorienter | Le DJ disco traduit la musique en général. Conserver l'ambiance musicale, mais privilégier une vraie pose de danse et un décor cohérent avec l'intention dancehall. |
| 43 | Frank's Gift | Conserver | Garder cadeau et geste de présentation. Différencier le paquet de #12 ; simplifier la tenue si elle concurrence l'objet. |
| 44 | Valentine X | Renforcer légèrement | Cupidon et cœur fonctionnent. Deux flèches croisées peuvent évoquer le X sans ajouter de texte. |
| 45 | Carmagnola | Documenter / réorienter | La roue suggère l'agriculture ancienne, sans lien spécifique établi avec le nom. Choisir un ancrage documenté ; retirer les ailes. |
| 46 | Cherry Abacus | Conserver | Boulier à cerises : excellent lien nominal. Conserver le geste énergique, harmoniser saturation et proportions, retirer les petites ailes. |
| 47 | Magic Bullet | Conserver | Magie et projectile doré rendent le nom lisible. Un seul chapeau suffit ; garder le ton de tour de magie. |
| 48 | Otto II | Documenter / réorienter | La clé de mécanicien n'explique pas Otto II. Ne pas prendre la proximité « Otto / auto » pour une origine démontrée du nom. |
| 49 | Swiss Dream CBD | Renforcer | Garder le cor et un paysage alpin plus lisible ; ajouter une dimension onirique. Nettoyer la tache sombre au sol. |
| 50 | CB Dream | Conserver / différencier | L'attrape-rêves explique le rêve. Garder un geste distinct des scènes de sommeil de #28 et #49 ; harmoniser l'échelle du personnage. |
| 51 | CBD Kush | Documenter / réorienter | La lanterne et la fumée donnent une scène lisible mais peu liée au nom. Définir l'ancrage de Kush avant de conserver l'objet ; harmoniser le rendu très saturé. |
| 52 | Diesel CBD | Conserver | Pompe ancienne et attitude détendue fonctionnent. Garder cet univers de station rétro avec la finition soignée mais simple d'une Commune. |

Familles à comparer côte à côte : cadeaux (#12/#43), Widow (#18/#22), rêve (#28/#49/#50), citron (#30/#32), électricité (#5/#9), superhéros (#2/#9/#32). Une famille peut partager des indices sans répéter la même pose ou le même accessoire.

## Mise en œuvre recommandée après cet audit

1. Fixer la référence du personnage, le gabarit, les cinq variantes de cadre et l'échelle de finition. Produire une comparaison des cadres avec une même illustration de contrôle pour vérifier leur distinction indépendamment du sujet.
2. Préparer cinq cartes pilotes : Strawberry (commune), Cherry Wine (argent), ACDC (or), Harlequin (épique), L'Arbre Mère (légendaire). Comparer également leurs scènes sans cadre pour vérifier la progression de finition et les sauts Or → Épique → Légendaire. Ajouter White Widow comme pilote de correction sémantique.
3. Pour chaque scène, fournir l'image actuelle comme référence de composition, la liste « conserver / corriger / retirer » et les exigences de finition de sa rareté. Utiliser une référence de style commune à chaque génération et les pilotes du niveau concerné ; nommer explicitement les plans, matières et sources de lumière attendus dans la consigne.
4. Séparer les assets de scène et le rendu final. Un composant commun `BuddieCard` doit être utilisé dans l'album, le détail, l'ouverture et le carrousel. Les cadres et textes proviennent de données partagées et de SVG/CSS ; un éventuel export bitmap doit être produit avec le même gabarit.
5. Examiner les réutilisations dans les cartes Fleurs pour choisir explicitement la scène seule ou la carte complète. Les deux usages existent aujourd'hui sous une même URL générique ; éviter une substitution globale sans cette distinction.
6. Reprendre les 52 scènes par petits lots, puis contrôler la collection entière. Les noms opaques doivent avoir leur intention définie avant leur lot, pas après une génération arbitraire.
7. Versionner les nouveaux chemins d'images et leur manifeste, conserver l'association précédente pour retour arrière, puis intégrer les images validées. Garder codes, numéros, raretés et règles de jeu stables.

## Critères de validation

- À petite taille, les cinq raretés restent discernables par contour, symbole et libellé, y compris en niveaux de gris.
- Deux cartes d'une même rareté ont exactement la même géométrie de cadre et les mêmes zones de texte.
- Le lecteur peut expliquer le lien entre nom et illustration ; un nom opaque possède une intention éditoriale écrite et vérifiée.
- La collection partage proportions, famille d'encrage et traitement de trame, avec des poses variées et un degré de finition croissant selon la rareté.
- Sans cadre ni libellé, la progression de décor, profondeur, matières et éclairage reste perceptible ; les Épiques paraissent nettement plus élaborées que les Or, et la Légendaire domine les Épiques par son ampleur et sa finition. Une scène qui repose uniquement sur sa bordure pour paraître rare doit être reprise.
- La comparaison en vignette confirme la lisibilité du personnage et de son action ; l'examen en grand révèle les détails supplémentaires des Épiques et de la Légendaire.
- Les détails ajoutés servent le nom ou sa scène. Les effets lumineux ont une source compréhensible et les zones de repos empêchent le décor de concurrencer le visage.
- Aucun ancien cadre, texte parasite, objet sans rapport, membre supplémentaire ou symbole inexpliqué ne reste dans la scène.
- Le nom et les éléments distinctifs restent lisibles dans la plus petite vignette réelle ; les longs noms ne changent pas la hauteur du gabarit.
- Le recto complet est identique dans l'album, le détail, le booster et le carrousel, sans recadrage destructif. Les états manquant/sélectionné/doublon restent des états d'interface cohérents.
- Une carte non possédée conserve son illustration en niveaux de gris et atténuée ; son nom reste masqué sous « Carte mystère ».

Cet audit ne modifie ni l'application ni les images en production. Il livre le diagnostic, les planches de référence et la direction de reprise carte par carte.
