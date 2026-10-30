# Audit de clarté et plan de simplification de Kanab Quest

29 octobre 2026 — État actuel, après les changements de navigation, de stockage, de jury, de commerce et de règlement des factures.

**Appréciation globale : 6/10 pour la simplicité d’utilisation.** Le jeu possède une identité forte, une boucle intéressante et de bons outils locaux. Son principal frein est la continuité : le joueur doit encore relier des noms, des états et des écrans pour comprendre la prochaine décision. Sur mobile, certaines pages donnent beaucoup de place à leur présentation avant de laisser agir.

La recommandation centrale est de construire l’expérience autour d’une récolte identifiable et de sa prochaine action, avec des destinations stables et une information présentée au moment utile. La direction artistique papier et cartoon mérite d’être conservée.

**1. Périmètre et méthode**

Cet audit porte sur les composants actuellement utilisés dans le dépôt, y compris les modifications locales. Il remplace, pour le diagnostic actuel, les constats initiaux du premier audit du même jour ; celui-ci reste un historique des changements.

Trois examens complémentaires ont couvert l’architecture et les retours de navigation, l’apprentissage et la compréhension du jeu, puis l’interface et le mobile. La synthèse comprend aussi une lecture détaillée du Commerce et des Finances.

35 états visuels ont été observés dans Chromium à 320, 390 et 1 440 pixels de large, avec une hauteur de fenêtre de 844 pixels. Les composants sont actuels, les données sont fictives. Le Quartier utilise le véritable shell ; plusieurs autres vues sont observées comme composants isolés. Culture est observée en mode Prototype local. Certaines récoltes fictives représentent des états historiques : les règles métier ont été vérifiées séparément dans le code.

Les notes sont des appréciations expertes, et non des mesures de satisfaction ou de rétention. Aucun test avec de vrais joueurs, aucune certification d’accessibilité ni mesure de performance en production n’est revendiqué. Les observations ne comprennent aucune opération sur un compte réel.

L’approche s’appuie sur les principes Apple de simplicité, de cohérence, de contrôle laissé à l’utilisateur et de hiérarchie. La présentation progressive doit préserver l’accès aux fonctions utiles. Ces principes servent de grille de lecture ; les recommandations ci-dessous sont spécifiques au jeu. [Apple — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout).

**2. Notes de l’état actuel**

| Dimension | Note /10 | Motif principal |
| --- | ---: | --- |
| Identité visuelle | 8,5 | Univers reconnaissable, illustrations et matériaux cohérents. |
| Profondeur des décisions | 8 | Variété, cartes, contenant, transformation, circuit et prix offrent de vrais choix. |
| Compréhension de la boucle | 7 | L’affinage précède désormais le jury ; quelques aides et termes restent décalés. |
| Architecture et repérage | 6,5 | Les destinations principales sont mieux séparées ; les adresses secondaires et leurs noms varient. |
| Continuité entre les écrans | 6 | Des retours et sous-sections perdent le contexte du lot ou du projet. |
| Prévisibilité des décisions | 7,5 | Coûts, prévisions et confirmations solides ; conséquences du jury à mieux distinguer. |
| Hiérarchie visuelle | 5,5 | Résumés, graphiques, navigation et actions se concurrencent encore. |
| Lisibilité et efficacité mobile | 5,5 | Absence de débordement sur l’échantillon, mais petites polices et cartes très hautes. |
| Première prise en main | 5,5 | Formation riche et interactive, mais longue avant une première décision de jeu. |
| Reprise après une absence | 6 | Conseil contextuel présent ; attente, urgence et opportunité restent insuffisamment distinguées. |

La note globale privilégie l’expérience d’une personne qui apprend et revient jouer. Ce n’est pas une moyenne statistique. Les contrôles fonctionnels des paiements ne suffisent pas à démontrer que le jeu est facile à comprendre.

**3. Les améliorations déjà présentes**

Ces éléments fonctionnent comme fondations de la suite et ne constituent plus des tâches à refaire :

- La barre mobile propose Quartier, Culture, Récoltes, Commerce et Plus.
- Commerce distingue Vendre, Mon stock en vente et Développer, avec une Synthèse.
- L’Atelier de l’Entrepôt gère les machines et renvoie vers Commerce pour la transformation et la vente.
- Le stockage distingue stock total, vrac en contenants, paquets emballés, annonces actives ou en pause.
- Le choix du contenant existe par lot ; les comparaisons d’équipement et l’aménagement sont repliés.
- L’affinage intervient avant le jury.
- Les liens génériques redondants vers les factures ont été retirés ; le paiement global existe avec total et confirmation.
- Finances ouvre sur les factures. Bilan, journal et plan comptable sont déjà derrière Comptabilité détaillée.
- Culture offre une action principale fixe sur mobile et une prévision des conséquences.
- Le Quartier propose une action contextuelle avant la carte.

Un raccourci pertinent ne constitue pas un doublon à supprimer. Depuis une facture, un stock ou un matériel manquant, il est utile de rejoindre directement la tâche correspondante. La condition est d’ouvrir la même destination, avec le bon contexte et un retour compréhensible.

**4. Ce qui produit encore le sentiment de fouillis**

**4.1. L’objet principal arrive trop bas sur plusieurs pages.** Dans Mon stock en vente, navigation, titre, création d’annonce, développement de boutique, filtres, deuxième titre et compteur précèdent la première annonce. Dans Stockage, cartes, détails des annonces, explication des unités, alerte, graphique et inventaire précèdent les lots. Chacun de ces éléments peut être utile ; leur ordre ne correspond pas toujours à l’intention d’entrée.

**4.2. Les visualisations ajoutent parfois une étape de lecture.** Finances présente le montant dû, sa répartition et sa couverture par la trésorerie avant le paiement global. Pour quelqu’un venu régler ses factures, les deux graphiques peuvent suivre l’action. Une insuffisance de fonds doit rester immédiatement visible sous forme de montant manquant.

**4.3. Le même bien change souvent de nom.** Buddie, variété, Fleur, récolte, lot, vrac, produit, paquet et annonce décrivent des objets ou des étapes différents. Le joueur a besoin d’un lien permanent entre eux. La distinction entre support du duel et quantité commercialisable est particulièrement importante.

**4.4. Les accès au stockage ne conservent pas tous le même contexte.** Culture ouvre le stockage dans Entrepôt ; Commerce l’ouvre dans Récoltes ; le Quartier emploie les deux selon l’état. Les deux entrées ont une utilité, mais elles doivent converger vers une même fiche de lot. Certains retours depuis le jury perdent également la provenance exacte.

**4.5. La formation présente de nombreux systèmes avant la première boucle maîtrisée.** La Relève est interactive et utilise les vrais écrans, ce qui est une force. Ses neuf chapitres couvrent cependant rénovation, aménagement, cartes, culture, affinage, jury, livraison, boutique et comptes. L’essai est fermable ; sa longueur peut néanmoins donner l’impression qu’il faut comprendre l’entreprise entière pour commencer.

**4.6. L’interface distingue encore trop peu action, attente et possibilité.** Un lot bien rangé en affinage peut être présenté comme une récolte à protéger. Un équipement abordable peut être suggéré alors qu’il n’est pas urgent. Un joueur de retour doit voir ce qui demande une intervention et ce qui progresse seul.

**5. Constats concrets à corriger en priorité**

P1 signifie ici « à traiter avant d’ajouter de nouveaux systèmes ». P2 désigne une clarification structurelle à préparer après ces corrections.

| Priorité | Constat actuel | Changement concret | Critère de réussite |
| --- | --- | --- | --- |
| P1 | Nom d’annonce comprimé sur mobile. | Recomposer la carte : nom suffisamment large, statut sur une ligne distincte, prix et quantité lisibles. | Une variété au nom long reste identifiable à 320 et 390 px sans empilement de fragments de mots. |
| P1 | Libellés financiers mobiles à environ 9 px. | Remonter la taille des informations utiles et réduire les répétitions. | Les montants, leurs intitulés et les échéances se lisent sans zoom. |
| P1 | Paiement global situé après trois cartes et deux visualisations. | Réunir montant dû, disponible après règlement et bouton dans le premier bloc. | Le paiement et son coût sont visibles ensemble avant les analyses secondaires. |
| P1 | Le jury avertit de la destruction de la Fleur sans expliquer aussi clairement la conservation du stock. | Nommer la Fleur d’Arène consommée et la quantité de récolte conservée. | Avant confirmation, le joueur sait précisément ce qu’il perd et garde. |
| P1 | Six heures réelles d’affinage surtout annoncées après la culture. | Annoncer ce délai avant le lancement ; afficher ensuite une heure de disponibilité. | L’attente après récolte est prévisible. |
| P1 | Aide de première vente encore résumée en culture → duel. | Reprendre la chronologie Culture → Récolte → Rangement et affinage → Jury → Vente. | Toutes les aides décrivent le même ordre. |
| P1 | Des résumés proposent « à ranger ou à vendre » avant que la vente soit autorisée. | Adapter le texte à l’état réel : « À ranger avant le jury » lorsque nécessaire. | Aucune consigne ne propose une action encore interdite. |
| P1 | « Transformer et vendre » sur la carte ouvre la Synthèse. | Ouvrir Vendre directement ; conserver Commerce comme entrée générique vers la Synthèse. | Le libellé du raccourci décrit son résultat. |
| P1 | Retours de jury parfois inexacts. | Conserver origine, sous-section et lot sélectionné. | Revenir restitue la tâche commencée. |
| P2 | Pause et retrait du rayon font presque le même travail. | Présenter une commande unique pour arrêter les ventes et une pour les reprendre. | Le joueur n’a plus à choisir entre deux arrêts équivalents. |
| P2 | Studio, Merch et Promouvoir perdent leur sous-section au rechargement ou après un détour. | Donner une adresse stable à ces destinations et restaurer leur sélection. | Le retour ouvre le bon module, sans repasser par Site internet. |
| P2 | L’accueil ne connaît pas encore les principaux problèmes de finances ou de ventes. | Étendre la priorité contextuelle à quelques événements réellement actionnables. | Un blocage commercial ou une échéance importante reste découvrable sans parcourir tout le menu. |

Les anciens états paused et closed peuvent rester compatibles en base pendant l’unification de leur présentation. « Jeter les paquets » reste une commande distincte, avec son avertissement de perte définitive.

Le constat sur le surplus est ciblé : les nouveaux lots avant jury ont généralement une échéance de vente automatique nulle et cet automatisme désactivé. L’audit ne conclut pas à une vente automatique systématiquement annoncée ou effectuée avant jury.

**6. Ce que montrent les captures mobiles**

Mesures à 390 × 844 pixels ; coordonnées depuis le haut du document. Elles décrivent des scénarios précis, pas des moyennes d’utilisation.

| Vue observée | Données fictives | Observation |
| --- | --- | --- |
| Quartier avec shell | Culture en cours | Reprendre est immédiatement visible. La page mesure 868 px. |
| Mon stock en vente | Une annonce | Le nom dispose de 48 px de largeur ; Modifier le prix commence à y = 1 127 px. Page de 1 548 px. |
| Stockage dans Entrepôt | Trois lots et cinq modèles de contenants | Contenants installés à y = 1 007 px ; lots à y = 1 676 px ; premier Choisir un contenant à y = 2 219 px. |
| Factures | Cinq lignes de factures détaillées | Régler toutes commence à y = 775 px, dans le composant observé sans navigation globale. Page de 4 236 px. |
| Culture après lancer | Partie de démonstration | La validation reste accessible dans une zone fixe près du bas de l’écran. |

Une longue page contenant de nombreuses factures n’est pas un défaut en soi. La distance jusqu’à l’action et la lisibilité de chaque ligne sont les problèmes à résoudre. Les enveloppes et volumes diffèrent : les hauteurs ne doivent pas être converties en classement absolu des écrans.

Aucun débordement horizontal n’a été constaté dans les 35 états. Les actions critiques observées ont une hauteur d’au moins 44 px ; le contrôle clavier échantillonné dans Culture montre un focus visible. Ces résultats ne couvrent pas tout le jeu, tous les lecteurs d’écran ni tous les niveaux de zoom.

**7. Organisation cible des écrans**

La navigation principale actuelle constitue une base valable. Le travail prioritaire concerne les responsabilités et la continuité des destinations.

| Destination | Ce que le joueur doit comprendre ou faire en premier | Ce qui vient ensuite |
| --- | --- | --- |
| Quartier | Voici ce qui demande ton attention et comment reprendre. | Carte, activités secondaires, objectif personnel. |
| Culture | Situation actuelle, choix possibles, conséquence attendue, action. | Explications, historique et analyses détaillées. |
| Mes récoltes | Mes lots, leur état et la prochaine action de chacun. | Répartition globale, comparaison et historique. |
| Entrepôt → Stockage | Mes stocks et contenants disponibles, puis les lots à ranger. | Inventaire complet, règles de capacité, aménagement, gammes et climat. |
| Entrepôt → Atelier | Mes machines, leur disponibilité et leur entretien. | Achat et développement du matériel ; lien contextualisé vers la préparation commerciale. |
| Commerce → Vendre | Choisir un lot puis avancer dans une préparation et un circuit. | Comparaison détaillée, demandes clients, règles de calcul. |
| Mon stock en vente | Quantité, prix, état, commandes et action sur chaque annonce. | Nouvelle annonce, historique, données avancées ; développement accessible depuis sa destination existante. |
| Développer | Mon prochain projet choisi et ses conditions. | Site, identité, produits dérivés et communication avec adresses stables. |
| Finances | Disponible, factures dues, règlement et manque éventuel. | Échéances futures, TVA, analyses, banque et comptabilité détaillée. |
| Missions | Mon objectif épinglé, sa prochaine étape et sa récompense. | Autres parcours facultatifs. |

Conserver les stocks et contenants en tête du stockage respecte la demande utilisateur. Leur présentation peut devenir plus compacte : disponibilité visible, éventuel manque, accès direct aux lots concernés. Le tableau détaillé ne doit pas repousser tous les choix de rangement très loin dans la page.

L’aperçu de stock dans Entrepôt et la gestion des récoltes peuvent coexister. **Une fiche commune de lot** relie ces entrées : même identité, mêmes données, mêmes commandes, retour exact au point d’origine. L’aménagement reste dans Entrepôt.

Les quatre accès mobiles fréquents restent stables. Finances et les autres activités restent accessibles depuis Plus et depuis des liens contextuels utiles. Une alerte financière importante doit aussi pouvoir remonter au Quartier. Apple souligne le coût de découverte des destinations cachées et l’intérêt de conserver l’état de navigation : un menu secondaire doit rester un choix réfléchi. [Apple — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

**8. La fiche de lot comme repère permanent**

Le haut de la fiche doit répondre à cinq questions : quelle récolte, quelle quantité, où est-elle, dans quel état, quelle action maintenant ?

| Élément | Présentation proposée |
| --- | --- |
| Identité | Variété + date de récolte, conservées à toutes les étapes. |
| Quantité | Grammes réels ou équivalent fleurs explicitement nommé ; parts en vrac et emballées distinctes. |
| État | À ranger, en affinage, prêt pour le jury, verdict disponible, prêt à vendre, partiellement en vente, vendu. |
| Blocage ou attente | Manque de contenant chiffré, heure de disponibilité, prérequis de vente ou de qualité. |
| Commande | Action précise adaptée à l’état ; coût et conséquence à proximité lorsqu’ils existent. |
| Détails | Historique, qualité, contenant, transformations et règles accessibles à la demande. |

Un lot réparti entre vrac et paquets conserve plusieurs sous-quantités ; il ne doit pas être réduit à un statut unique trompeur. Plusieurs récoltes de la même variété restent identifiables. Le choix du contenant reste volontaire et respecte les réservations propres à chaque lot.

Une présentation d’étapes courte peut accompagner cette fiche : **Récolte → Rangement et affinage → Jury → Préparation → Vente**. Elle indique l’étape réelle et n’insinue pas que les paquets reviennent en vrac lorsqu’une annonce est arrêtée.

**9. Règles d’information et de langage**

Chaque écran doit comporter trois niveaux : l’essentiel pour décider, les explications utiles à la décision actuelle, puis les références avancées. Les panneaux déroulants conviennent aux formules, comparateurs et historiques. Un coût, un prérequis ou une perte définitive doit rester visible avant validation.

| Terme ou message actuel | Règle recommandée |
| --- | --- |
| Ma boutique, Marché, comptoir, Commerce utilisés comme instructions | Employer le nom exact du menu dans les indications opérationnelles. Les dialogues peuvent conserver le langage du village. |
| « Ma boutique → Site internet » | « Commerce → Développer → Site internet ». |
| « Merch » | « Produits dérivés », avec un libellé adapté à la place disponible. |
| « Fleur » dans une confirmation de jury | « Fleur d’Arène » ; expliquer séparément ce qui arrive au stock commercial. |
| Points de culture, qualité, note du jury | Garder leurs noms et unités distincts ; expliquer leur relation lors du passage d’une étape à l’autre. |
| Temps en jours de jeu et jours réels | Mettre l’heure réelle de disponibilité ou de paiement en premier ; conversion en information secondaire. |
| « Protège ta récolte » lorsque tout est rangé | « Tout est rangé · affinage en cours », accompagné de l’heure de fin. |
| État absent du serveur | « Information indisponible » ou action de réessai ; jamais un zéro inventé. |

Pour le jury, exemple de structure à compléter avec les données réelles : « La Fleur d’Arène sera utilisée une seule fois. Ton stock de [quantité] restera disponible après le verdict. » Les différences entre jury immédiat, adversaire et classement restent expliquées.

Pour l’attente : « Affinage terminé aujourd’hui à [heure] · encore [durée] ». L’état précise si le lot est entièrement rangé ou si une intervention reste nécessaire. Les ventes estimées restent clairement séparées des recettes réellement reçues.

**10. Une première expérience plus courte**

Je recommande deux entrées explicites : une première récolte accompagnée avec installation d’essai prête, puis La Relève complète comme apprentissage libre. Le jeu explique une décision au moment où elle apparaît. Les variantes avancées restent accessibles sans devenir des préalables à la première action.

| Moment | Ce qu’il faut enseigner |
| --- | --- |
| Première décision | Situation, résultat recherché, choix simple et conséquence. |
| Fin de culture | Quantité obtenue, qualité estimée et rangement. |
| Affinage | Temps réel, contenant choisi, différence entre attente et problème. |
| Jury | Utilisation de la Fleur d’Arène et conservation du stock. |
| Première vente | Un circuit compréhensible, recette nette et confirmation. |
| Après réussite | Choisir un progrès : meilleure culture, stockage, nouveau débouché. |

Le temps accéléré de l’essai doit rester explicitement fictif. Avant la première vraie culture, annoncer les six heures réelles d’affinage. À la sortie de l’essai, préciser que les achats et recettes de démonstration restent dans l’essai, puis montrer la situation personnelle du joueur.

Une interruption de La Relève doit proposer une reprise nommée, par exemple le chapitre sauvegardé. L’utilisateur conserve la liberté de revenir directement à sa partie. Cette approche suit l’intérêt d’un apprentissage interactif, court et contextuel décrit par Apple. [Apple — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding).

**11. Reprendre une partie et choisir un objectif**

Le Quartier doit distinguer une action nécessaire, une activité prête à jouer et une attente qui avance seule. Une action principale peut être complétée par deux informations secondaires utiles, plutôt que par un ensemble de cartes toutes prioritaires.

La règle de priorité doit dépendre d’un risque ou d’une échéance réelle : stock exposé, blocage de vente, verdict prêt, facture importante. Elle doit aussi respecter le projet choisi. Le simple fait de pouvoir acheter un équipement ne suffit pas à en faire une urgence.

Un objectif volontaire épinglé peut relier Missions, Culture et Commerce. Les autres objectifs continuent à progresser et restent consultables. Les investissements, réseaux, produits dérivés et placements se découvrent progressivement, avec des accès stables.

Un bilan « pendant ton absence » est utile seulement si les événements nécessaires existent réellement. Il ne faut pas reconstruire une histoire de ventes ou de progression à partir d’un solde courant.

**12. Direction visuelle et accessibilité**

Conserver les scènes, enseignes, illustrations, crème, teal, or et orange chaud. Réserver les cadres les plus présents aux grands ensembles et aux nombres essentiels. À l’intérieur d’un registre, utiliser des lignes et de l’espace pour organiser les données, conformément au système graphique existant.

La commande principale d’une décision reçoit l’accent fort. Les commandes secondaires restent clairement reconnaissables ; elles n’ont pas toutes besoin d’une grande surface d’accent. Une rangée d’annonces peut contenir plusieurs commandes utiles : la règle est de rendre leur importance compréhensible, pas d’imposer arbitrairement un seul bouton à toute la page.

Sur mobile, une carte d’annonce devrait répartir nom, état, quantité, prix et actions sur des rangées lisibles. Le badge ne doit pas comprimer le nom. Un contenu textuel important ne doit pas être miniaturisé pour faire tenir une grille.

Comme cible de conception à tester : corps utile autour de 16 px, informations secondaires nécessaires autour de 14 px, contrôles tactiles confortables d’environ 44 px. Ce sont des objectifs ergonomiques pour ce jeu, pas une affirmation des minimums WCAG. WCAG 2.2 définit notamment une cible minimale de 24 × 24 pixels CSS ou des exceptions d’espacement pour le critère 2.5.8. [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

Vérifier ensuite clavier, ordre de focus, retour après dialogue, zoom à 200 %, petits écrans, taille du texte, contraste sur texture, réduction des animations et lecture des états sans dépendre de la couleur. Une action fixe ne doit pas masquer les données nécessaires à sa confirmation.

**13. Plan de réalisation priorisé**

Les tailles indiquent un effort relatif, sans promesse de durée.

| Lot | Travail | Effort | Condition de passage au suivant |
| --- | --- | --- | --- |
| 1 — Cohérence immédiate | Carte d’annonce mobile, polices critiques, paiement global en tête, texte du jury, durée avant lancement, aides et surplus, raccourci Transformer et vendre. | Petit à moyen | Aucun message contradictoire sur les parcours vérifiés ; nom, coût et conséquence lisibles sur mobile. |
| 2 — Continuité des lots | Fiche commune, provenance et retours exacts, persistance des sous-sections, arrêt/reprise unifiés des annonces. | Moyen à important | Rangement → jury → vente → retour conserve la bonne récolte et la bonne sous-section. |
| 3 — Priorité dans chaque écran | Lots à ranger accessibles tôt, stock en vente avant les raccourcis secondaires, filtres Récoltes allégés, analyses financières secondaires mieux regroupées. | Moyen | Les tâches fréquentes sont accomplies sans parcourir les analyses secondaires. |
| 4 — Apprentissage et reprise | Entrée courte, sortie d’essai explicite, reprise de chapitre, accueil action/attente, objectif épinglé. | Important | Nouveaux joueurs et joueurs de retour réussissent les tâches de validation sans accompagnement. |

Il est possible de prototyper en parallèle la nouvelle hiérarchie de Stockage, Mon stock en vente et Finances. La fiche commune et les retours doivent néanmoins être stabilisés avant de multiplier de nouveaux parcours guidés.

Les garanties techniques à conserver sont précises : montants et autorisations du serveur, états inconnus distincts de zéro, pas de double comptage du stock, compatibilité des anciennes récoltes et annonces, paiements atomiques et rejouables. La navigation ne doit déclencher aucune nouvelle commande manuelle de vente ou de paiement. Les ventes et règlements automatiques prévus par l’horloge du jeu gardent leurs règles et leurs explications.

La réduction des éléments à l’écran ne doit pas automatiser les choix du joueur. Variété, carte, contenant, transformation, circuit et prix restent de vraies décisions.

**14. Validation avec des joueurs**

Faire une première série qualitative avec 5 à 8 personnes qui découvrent le jeu, puis quelques joueurs connaissant déjà ses systèmes. Les petits échantillons servent à trouver les incompréhensions ; ils ne prouvent pas un gain statistique de rétention. Refaire les mêmes tâches après prototype.

| Scénario | Tâche sans assistance | Ce qu’on observe |
| --- | --- | --- |
| Première visite | Faire une première décision de culture et expliquer sa conséquence. | Temps avant action comprise, hésitations, besoin d’aide. |
| Récolte nouvelle | Ranger une variété dans un contenant choisi. | Contenant trouvé, quantité comprise, différence libre/occupé/à installer. |
| Affinage | Dire quand le lot sera disponible et s’il faut agir maintenant. | Compréhension du temps réel et de l’état sécurisé. |
| Jury | Expliquer ce qui sera utilisé et ce qui sera conservé. | Compréhension avant confirmation. |
| Vente | Retrouver le même lot et choisir son circuit. | Perte de contexte, retours, recherches dans d’autres pages. |
| Gestion du rayon | Modifier un prix, arrêter puis reprendre les ventes. | Confusion des états, visibilité du stock restant, lecture des conséquences. |
| Finances | Régler les factures puis expliquer la trésorerie restante. | Découverte du bouton, compréhension du montant et de la TVA réservée. |
| Retour après absence | Choisir la prochaine action utile. | Temps pour distinguer urgence, attente et opportunité. |

Cibles initiales proposées, à ajuster après le premier passage : prochaine action comprise en dix secondes ; première décision de démonstration en moins de trois minutes ; au moins quatre personnes sur cinq réussissent les tâches fréquentes sans aide ; aucune ambiguïté non résolue sur une perte définitive ou un débit avant confirmation.

Compléter avec des observations de navigation : destination d’entrée, tâche commencée, détours, abandons, aide ouverte, retour au bon lot. Ne pas utiliser la réduction du nombre d’onglets comme critère de succès à elle seule.

**15. Preuves et références dans le projet**

| Sujet | Références actuelles |
| --- | --- |
| Navigation principale | `src/components/placard/KqPlacardNavigation.tsx:15` ; `:23` |
| Commerce et sous-destinations | `KqMarketHub.tsx:14` ; `:32` ; `KqOnlineBusiness.tsx:51` ; `:67` |
| Stockage depuis différents lieux | `PlacardPlayerShell.tsx:378` ; `:388` ; `KqPlacardLobby.tsx:115` ; `:121` |
| Retours du jury | `KqWarehouseHarvests.tsx:123` ; `PlacardPlayerShell.tsx:315` ; `:351` |
| Raccourci Transformer et vendre | `KqPlacardMap.tsx:231` ; `PlacardPlayerShell.tsx:135` |
| Aide de première vente | `KqShopOverview.tsx:120` |
| Pause et retrait du rayon | `KqOnlineStore.tsx:42` ; `:54` ; `:56` ; `supabase/migrations/20261011150000_kq_online_commerce.sql:505` |
| Carte d’annonce mobile | `KqOnlineStore.tsx:49` ; `KqOnlineStore.module.css:73` ; `:75` ; `:76` ; `:128` |
| Ordre des informations financières | `KqTreasuryInvoices.tsx:39` ; `:44` ; `:54` ; `:57` |
| Police financière mobile | `KqTreasuryInvoices.module.css:62` |
| Ordre des informations de stockage | `KqStorageInventory.tsx:53` ; `:60` ; `:66` ; `:68` ; `:70` ; `KqHarvestStorage.tsx:115` ; `:125` |
| Instruction de surplus | `KqStorageStatus.tsx:15` ; `KqStorageInventory.tsx:67` ; `KqWarehouseHarvests.tsx:167` |
| Confirmation du jury | `KanabQuestDicePrototype.tsx:2339` ; `:2377` ; explication pédagogique `src/lib/arena-releve-production-guide.ts:104` |
| Durée avant/après culture | `KanabQuestDicePrototype.tsx:2337` ; `:2465` ; `KqReleveNativeCulture.tsx:113` |
| Neuf chapitres de La Relève | `src/lib/arena-releve.ts:55` ; `src/lib/kanab-quest-releve-production.ts:324` |
| Introduction et reprise | `src/components/contest/ArenaGameEntry.tsx:31` ; `ArenaLearningHub.tsx:111` |
| Prochaine action | `src/lib/kanab-quest-hub.ts:11` ; `KqPlacardLobby.tsx:93` |

Les noms de composants sans chemin complet se trouvent dans `src/components/placard/`, sauf indication contraire. Les numéros de ligne décrivent l’état examiné et peuvent évoluer avec les prochaines modifications.

Les 35 observations JSON et les captures correspondantes sont conservées dans `output/clarity-audit-current/`. Les captures les plus utiles à la discussion sont :

- [Quartier mobile](../../output/clarity-audit-current/navigation/quartier-390-viewport.png)
- [Mon stock en vente mobile](../../output/clarity-audit-current/commerce/commerce-stock-390-viewport.png)
- [Stockage mobile](../../output/clarity-audit-current/storage/storage-390-full.png)
- [Factures mobile](../../output/clarity-audit-current/finances/finances-390-viewport.png)
- [Culture mobile](../../output/clarity-audit-current/culture/culture-prepare-390-viewport.png)
- [Synthèse du commerce sur ordinateur](../../output/clarity-audit-current/commerce/commerce-overview-1440-viewport.png)

Ce diagnostic décrit l’état avant les corrections. Le suivi ci-dessous distingue les changements réalisés du reste du plan.

**16. Premier lot de clarification réalisé le 29 octobre 2026**

- Les annonces donnent davantage de place au nom sur mobile. Les informations essentielles font au moins 14 px et les boutons au moins 48 px. À 390 px, le nom passe de 48 à 214 px de largeur. À 320 px, la carte devient plus haute pour préserver la lisibilité.
- Finances affiche d’abord le total, le disponible, le solde après règlement et le paiement global. Les graphiques sont accessibles dans un détail repliable. Les données manquantes affichent « À actualiser ». L’en-tête comptable utilise l’illustration de la destination, dans un chapitre plus court.
- Le lancement annonce les six heures réelles d’affinage. Les confirmations du jury distinguent la Fleur d’Arène consommée du stock récolté conservé. L’aide à la première vente suit le parcours culture → stockage et affinage → jury → vente.
- Les consignes de surplus tiennent compte du passage au jury. Elles restent neutres si les données ne permettent pas de le déterminer ; les anciennes échéances de vente automatique valides restent annoncées.
- « Transformer et vendre » ouvre directement Vendre. Les liens du jury conservent le lieu d’origine, la sous-section Stockage et le lot sélectionné.

Contrôles locaux : 21 scénarios de paiement, 15 scénarios d’annonces, trois parcours de navigation, six observations intégrées de Finances et 23 scénarios du jury. Les 32 tests unitaires ciblés, TypeScript et ESLint passent. Le paiement intégré est entièrement visible sur les fenêtres de 320 × 844 et 390 × 844 px testées. Les opérations des recettes sont simulées ; aucun paiement joueur n’a été effectué.

Preuves : `output/pay-all-invoices/report.json`, `output/online-listing-readability/comparison.json`, `output/placard-navigation/clarity-report.json`, `output/clarity-lot1/finance/integrated-report.json`, `output/clarity-lot1-learning/jury/results.json`. Aperçus : [Finances après correction](../../output/clarity-lot1/finance/integrated-normal-390-viewport.png), [annonce après correction](../../output/online-listing-readability/after/original-390-card.png).

Limites de vérification : le parcours global de navigation conserve une alerte sur la largeur interne de la carte à 320 px (302 px de contenu pour 298 px disponibles), sans débordement du document. Les parcours ciblés corrigés passent ; la géométrie de cette carte reste à traiter séparément. La confirmation du jury défile verticalement à 320 × 568 px, avec fermeture et actions accessibles.

À la fin de ce premier lot, la fiche commune, la simplification des états commerciaux, la hiérarchie générale du stockage et l’accompagnement des premières parties restaient à réaliser. La suite est suivie ci-dessous. Les notes de cet audit ne constituent pas une nouvelle mesure après correction ; celle-ci nécessite les tests utilisateurs proposés plus haut.

**17. Deuxième lot de clarification réalisé le 29 octobre 2026**

La même fiche accompagne désormais une récolte dans Récoltes, Stockage et la préparation de vente. Elle donne la variété, la référence du lot, la date de récolte, la quantité, la qualité actuelle, l’état et la prochaine action. Le produit préparé conserve aussi sa propre référence : deux produits issus d’une même récolte restent distincts. La note obtenue au jury est consultable dans un détail séparé ; elle ne remplace pas la qualité actuelle.

Les unités sont explicites. Le stockage indique le volume restant en équivalent fleurs, hors paquets déjà emballés dans Commerce ; la fiche du produit indique ses grammes réels. Les points de culture ne sont pas présentés comme une note sur dix. Une donnée absente reste à confirmer ; une fin d’affinage ne suffit pas, à elle seule, à annoncer qu’un lot est autorisé à la vente. Lorsque les fleurs sont indisponibles, le résumé ne fabrique plus un compteur « Jury et duels : 0 ».

Les liens conservent le produit exact et les sous-sections de Développer. Rechargement, Précédent, Suivant et retour depuis le stockage retrouvent le contexte transmis. Si le produit demandé n’existe plus, le jeu l’indique et propose de revenir aux autres lots, sans sélectionner silencieusement un autre produit de la même variété. Le lien de rangement depuis une fiche transmet son lot réel, même lorsque l’entrée initiale désignait seulement la récolte.

« Ajouter des contenants » ouvre directement l’aménagement dans l’Entrepôt, avec le lot concerné et son retour. Une visite ordinaire du stockage conserve ce panneau replié. L’ouverture est demandée à l’entrée ; le joueur peut ensuite refermer le panneau sans qu’une actualisation des données le rouvre.

La gestion des annonces utilise une seule paire de commandes : « Mettre en pause » et « Reprendre la vente ». Les anciennes annonces retirées sont regroupées avec les annonces en pause. « Jeter les paquets » reste une action définitive distincte, avec quantité, perte et absence de remboursement explicites avant confirmation. La pause et la reprise annoncent la remise à zéro de la progression de la commande en cours ; le simulateur applique désormais la même règle que le serveur, sans affecter les autres annonces.

Validation locale :

- Douze observations de la fiche commune, dans Récoltes, Stockage, Commerce en vrac et Commerce transformé, à 320, 390 et 1440 px. Identité, unités, qualité, détails au clavier et absence de débordement vérifiés.
- Navigation Commerce vérifiée aux mêmes largeurs : sous-sections, historique, rechargement, produit exact parmi plusieurs produits d’une même récolte, origine et retour. Des cas supplémentaires couvrent les données indisponibles, les anciennes routes et les produits introuvables. Cette recette isole les destinations Récoltes, Entrepôt et Jury ; elle ne remplace pas leur recette intégrée.
- Sept cas intégrés avec les vrais composants Récoltes, Stockage et Entrepôt, dont quatre largeurs de 320 à 1440 px et les échecs partiels de chargement. Filtres, focus du lot, retour, récupération et compte vide vérifiés.
- Vingt-sept scénarios du cycle des annonces et quinze scénarios de lisibilité. Les 102 tests ciblés du simulateur de vente et des états d’annonce passent, ainsi que les tests de fiche, de sélection et d’orientation des récoltes. TypeScript et ESLint passent sur les vérifications réalisées.

Les parcours utilisent des données et opérations locales. Aucun paiement, vente ou changement de stock d’un joueur réel n’a été effectué pour ces recettes. Ce deuxième lot n’ajoute aucune migration.

Preuves : `output/clarity-lot2-learning/browser/results.json`, `output/clarity-lot2/navigation/report.json`, `output/clarity-lot2/navigation/context-report.json`, `output/placard-harvests-navigation/harvests-report.json`, `output/online-listing-lifecycle/report.json`. Aperçus : [fiche de stockage à 320 px](../../output/clarity-lot2-learning/browser/storage-card-320.png), [fiche avant préparation à 390 px](../../output/clarity-lot2-learning/browser/raw-card-390.png), [ancienne annonce présentée en pause](../../output/online-listing-lifecycle/legacy-paused-390.png).

La suite du plan porte sur la priorité des informations dans chaque écran, puis sur l’apprentissage et la reprise de partie. Les recettes techniques valident les comportements observés ; la facilité de compréhension reste à mesurer avec les joueurs selon la section 14.

**18. Troisième lot : priorité aux tâches fréquentes**

Cette étape réorganise les écrans autour de ce que le joueur vient faire. Les règles de culture, d’affinage, de vente et de paiement restent celles du jeu. Les données de référence et les visualisations restent consultables.

| Écran | Ce qui apparaît d’abord | Informations secondaires |
| --- | --- | --- |
| Stockage | Quantités de vrac et de paquets, contenants disponibles, alerte de vrac exposé et accès au lot à ranger. | Répartition détaillée des paquets, graphique et règles de rangement dans un volet fermé ; explication de l’affinage après les lots. |
| Récoltes | Un filtre avec les nombres de récoltes, puis les fiches et leur prochaine action. | Répartition par étape après les lots, dans un volet fermé. Les comptes incomplets restent explicitement partiels. |
| Mon stock en vente | Un seul titre visible, un résumé court, les filtres utiles et les annonces. | Création d’une nouvelle annonce après le stock existant ; accès au développement conservé dans la navigation. |
| Finances | Total, paiement global, catégories et factures individuelles. | Répartition et règles de règlement réunies après les factures. Les échéances et la TVA sont regroupées dans un registre compact. |

Stockage conserve la distinction entre vrac en contenants et paquets déjà emballés dans Commerce. Les contenants achetés mais non installés ne sont pas comptés comme libres. Le raccourci de rangement rejoint une fiche existante ; il ne choisit pas automatiquement les contenants du joueur.

Dans Finances, les montants et dates de prélèvement à venir restent affichés. Les règles de calcul, les explications de TVA et les détails historiques sont repliés. Les montants manquants, les fonds insuffisants et les confirmations de paiement restent explicites.

Les mesures avant/après utilisent les mêmes données locales et les mêmes dimensions de fenêtre. Elles décrivent l’espace occupé et l’accès aux commandes, pas un gain de compréhension mesuré auprès de joueurs.

| Observation | Largeur | Avant → après, en px arrondis |
| --- | ---: | ---: |
| Premier contenant dans Stockage | 320 px | 864 → 361 |
| Premier contenant dans Stockage | 390 px | 774 → 334 |
| Première fiche de lot dans Stockage | 320 px | 1 624 → 1 351 |
| Première fiche dans Toutes mes récoltes | 390 px | 518 → 298 |
| Première annonce dans Mon stock en vente | 390 px | 626 → 324 |
| Commande « Modifier le prix » de cette annonce | 390 px | 1 055 → 744 |
| Première facture fournisseur dans Finances | 390 px | 744 → 630 |
| Hauteur du registre des échéances et de la TVA | 320 px | 1 319 → 701 |

Les positions sont mesurées depuis le haut de chaque recette. Commerce inclut son vrai conteneur `KqMarketHub`, mais pas le HUD global. Finances utilise les vrais composants de gestion des factures, sans l’en-tête global de Finances. Les valeurs servent à comparer avant et après un même écran ; elles ne permettent pas de comparer directement les écrans entre eux.

Contrôles locaux : 24 cas de Stockage ; 10 cas de Récoltes, dont les filtres au clavier, les données partielles, les lots ciblés et le compte vide ; 15 observations et 21 scénarios de clavier/navigation dans Commerce, complétés par 27 scénarios du cycle des annonces et trois parcours de prix/ciblage ; 15 observations de Finances et 21 scénarios de paiement. Les captures ont été inspectées : l’espacement entre l’estimation commerciale et les boutons a été corrigé pour que l’anneau de focus ne recouvre pas le texte. Un chevron rend le filtre des récoltes immédiatement identifiable comme menu déroulant. Les opérations sont simulées, sans transaction sur un compte réel.

Preuves : `output/clarity-lot3/storage/before-report.json` et `after-report.json`, `output/clarity-lot3-harvests/browser/before-results.json` et `after-results.json`, `output/clarity-lot3/commerce/comparison.json` et `after/report.json`, `output/clarity-lot3/finance/before/report.json` et `after/report.json`, `output/pay-all-invoices/report.json`. Aperçus : [Stockage à 320 px](../../output/clarity-lot3/storage/after-mixed-320.png), [Récoltes à 390 px](../../output/clarity-lot3-harvests/browser/after-overview-390.png), [Mon stock en vente à 390 px](../../output/clarity-lot3/commerce/after/normal-390-viewport.png), [échéances et TVA à 320 px](../../output/clarity-lot3/finance/after/upcoming-320.png).

TypeScript global, ESLint ciblé et les contrôles de diff passent sur l’état final. Cette étape n’ajoute aucune migration.

Une fiche riche peut toujours dépasser la hauteur d’un petit écran. Les quantités, les échéances, les avertissements et le choix du contenant sont conservés. La prochaine étape du plan porte sur l’apprentissage et la reprise de partie ; les tests avec de vrais joueurs restent à réaliser.

**19. Quatrième lot : première partie et reprise**

La première visite propose maintenant trois choix explicites : une première récolte accompagnée avec une installation prête, l’entrée directe dans le Quartier, ou l’histoire complète de La Relève. Le parcours long ne s’ouvre plus automatiquement. Un joueur qui a choisi son Quartier le retrouve aux visites suivantes ; un essai interrompu propose une reprise nommée, sans lancer le didacticiel à sa place.

L’essai court traverse quatre étapes : culture, rangement et affinage, jury, puis première vente. Le joueur choisit sa variété, l’usage éventuel d’une carte, son contenant, la préparation du lot, la quantité et le circuit de vente accessible. Le devis affiche la recette TTC, la TVA et le montant net avant confirmation. Les moteurs existants calculent les résultats ; le scénario de culture préparé est signalé comme tel. Les machines et la vente en ligne restent à découvrir dans La Relève et ses rencontres.

L’attente accélérée est explicitement fictive. Dans le jeu, l’affinage dure six heures réelles après la récolte, avant le jury. La présentation au jury distingue la Fleur d’Arène consommée du stock conservé. Le bilan de sortie montre la recette nette et le stock restant de l’essai, indique qu’aucun de ces biens ou gains ne passe dans la partie, puis propose le Quartier ou la suite de l’apprentissage.

« Apprendre à jouer » reste accessible depuis le menu et le Quartier. Il distingue essai court, La Relève et rencontres. Une histoire commencée reprend par le nom de son chapitre ; l’essai court reprend par son étape. Leurs sauvegardes sont séparées et rattachées au compte dans ce navigateur. Une indisponibilité du stockage local est annoncée ; ouvrir le menu d’aide ne réécrit plus le registre des rencontres.

| Au retour dans le Quartier | Comportement |
| --- | --- |
| Vrac sans contenant confirmé | Le rangement devient l’action prioritaire ; quantité et échéance de vente automatique sont affichées lorsqu’elles sont connues. |
| Culture en cours, vente ou jury disponibles | Une action principale et au plus deux informations complémentaires. Le serveur confirme la disponibilité du jury. |
| Lots en affinage et rangement confirmé | « Attente automatique », avec l’heure de fin connue. Le joueur comprend qu’aucune intervention immédiate n’est nécessaire. |
| Données manquantes ou contradictoires | État à vérifier ou résumé indisponible ; aucune fin d’activité ni quantité n’est inventée. |
| Budget suffisant pour du matériel | Cette seule condition ne produit plus une recommandation prioritaire d’achat. |

Le joueur peut épingler volontairement un défi depuis Missions. Le Quartier affiche alors son objectif, sa progression réelle et un accès à l’action concernée. Le choix peut être remplacé ou retiré ; les autres missions continuent de progresser. Les objectifs de rangement rejoignent Stockage, ceux de préparation rejoignent Vendre, et ceux de demande aromatique rejoignent la demande correspondante. Une récompense prête renvoie vers Missions : elle n’est jamais récupérée par l’épinglage ou la navigation. Sans objectif choisi, le Quartier conserve une commande discrète et ne charge pas de progression supplémentaire.

Les essais et leurs opérations commerciales restent locaux. Les vérifications navigateur utilisent des réponses simulées et n’effectuent aucune transaction sur un compte joueur. Cette étape ne nécessite aucune migration.

Validation locale à 320, 390 et 1440 px :

- Entrée et aide : 12 scénarios couvrent choix explicites, accès direct mémorisé, reprise nommée, navigation au clavier, changement de compte, cookies et stockage local indisponible. Le retour au Quartier passe par la navigation existante et sa garde de brouillon, y compris depuis le menu mobile.
- Essai court : trois parcours complets, pause, rechargement pendant l’affinage sans accélération automatique, reprise du devis identique, annulation, confirmation et deux sorties. Un cas supplémentaire vérifie un navigateur sans sauvegarde locale.
- Quartier : 39 observations avec les vrais composants de reprise, de carte et d’objectif, sans le HUD global. Une action principale, au plus deux informations complémentaires, absence de débordement, requêtes pendantes puis récupération vérifiées.
- Objectif épinglé : 29 observations avec les vrais composants Missions et objectif. Épinglage au clavier, remplacement, retrait et restitution du focus, progression nulle réelle, erreur puis récupération, récompense disponible, objectif terminé, isolation des comptes et des didacticiels. Aucun épinglage ne déclenche d’écriture d’API.

Preuves : `output/clarity-lot4-entry/browser/results.json`, `output/clarity-lot4/quick-trial/report.json`, `output/clarity-lot4/quartier/report.json`, `output/pinned-mission-lot4/report.json`. Aperçus : [première visite à 390 px](../../output/clarity-lot4-entry/browser/entry-choice-390.png), [devis de l’essai à 320 px](../../output/clarity-lot4/quick-trial/sale-confirm-320.png), [bilan fictif à 320 px](../../output/clarity-lot4/quick-trial/exit-320.png), [rangement prioritaire à 390 px](../../output/clarity-lot4/quartier/mixed-390-viewport.png), [attente et objectif à 320 px](../../output/clarity-lot4/quartier/waiting-goal-320-viewport.png).

Les 81 tests ciblés de l’entrée, de l’essai court, de la première culture et sa récupération, de la session La Relève, du Quartier et des missions passent. TypeScript global et ESLint ciblé passent. Les captures ont été inspectées et l’espacement sous la progression de l’objectif a été ajusté pour préserver le focus de son bouton.

Ces contrôles vérifient les états et les interactions ; ils ne constituent pas un test de compréhension avec de nouveaux joueurs. Certaines décisions détaillées de l’essai nécessitent un défilement vertical à 320 px. Les objectifs de la section 14 et la réévaluation des notes restent à mesurer avec ces joueurs.

**20. Cinquième lot : des raccourcis qui aboutissent à la bonne action**

Cette passe traite les détours qui subsistaient après la réduction de densité. Un écran plus court ne suffit pas si son bouton principal ouvre un éditeur fermé, recommande un achat inutile ou fait perdre le point de départ.

| Friction constatée | Correction |
| --- | --- |
| « Ranger ce lot » défilait jusqu’à la fiche, sans ouvrir le choix du contenant. | Le raccourci ouvre le sélecteur du lot exact et lui donne le focus. Deux récoltes de la même variété restent distinctes. |
| Un surplus proposait d’abord d’ajouter des contenants, même avec assez de contenants installés. | Le choix parmi les contenants disponibles devient prioritaire. L’achat ne l’est que si le manque est confirmé ; des réservations inconnues invitent à vérifier et actualiser. |
| Une culture ouverte depuis Missions perdait son retour après sélection ou passage par l’équipement. | L’origine Missions est conservée dans la navigation, y compris après rechargement et reprise de la préparation. La garde du brouillon reste active. Une culture ouverte directement garde son retour habituel vers l’Entrepôt. |
| Une enseigne pouvait rester hors champ au clavier sur la carte agrandie. L’aide était coupée sur petit écran. | La carte révèle l’enseigne qui reçoit le focus ; l’aide mobile prend sa place dans la page et se referme avec Échap. Le débordement interne du panneau Jury à 320 px, signalé au premier lot, est corrigé. |
| « Vendre » pouvait annoncer une réserve vide alors que des récoltes affinaient ou que des paquets existaient déjà. | L’état vide distingue les récoltes en attente, les paquets préparés et l’absence confirmée de lot. Il mène vers la récolte concernée, « Mon stock en vente » ou les cultures. Une lecture indisponible reste explicitement inconnue. |
| La synthèse Commerce poussait vers l’ouverture du site avant d’exploiter un lot vendable. | Un lot accessible aux circuits professionnels mène d’abord au choix du circuit. Le site et l’ordinateur ne sont plus présentés comme préalables à cette vente. |
| Un lien vers une annonce épuisée, jetée ou absente ouvrait la liste sans expliquer sa disparition. | Un avis explicite indique l’état de l’annonce demandée et permet de consulter les autres annonces disponibles, sans en ouvrir une à sa place. |

Le rangement conserve un modèle de contenant choisi pour le lot entier, selon la règle existante. Le calcul exclut les réservations des autres lots et les contenants achetés mais non installés ; il permet de réutiliser les contenants déjà réservés au lot sélectionné. Ouvrir le sélecteur ou la confirmation ne réserve rien automatiquement.

Les messages de chargement et de navigation reprennent aussi les matériaux papier des autres commandes. Les illustrations, la géométrie des bâtiments et leurs zones de clic sont conservées.

Vérifications locales à 320, 390 et 1440 px :

- Stockage : 7 tests unitaires, 9 scénarios navigateur et 3 contrôles visuels finaux. Lot exact, focus clavier, confirmation sans rangement, manque prouvé, inventaire partiel et récupération après actualisation sont couverts.
- Missions → Culture : trois parcours avec sélection de culture, historique navigateur, rechargement, détour par l’équipement, préparation conservée et annulation/confirmation du retour. Le conteneur de navigation et Missions sont réels ; Culture et Entrepôt sont remplacés par des destinations de recette pour isoler la navigation.
- Carte : 24 vérifications des destinations de bâtiments et 24 déplacements du focus sur la carte agrandie ; aide, menu et restitution du focus contrôlés aux trois largeurs. Le déplacement tactile de la carte ne déclenche pas de navigation. Aucun débordement de page ni collision des enseignes n’est observé dans ces cas.
- Commerce : 51 cas navigateur couvrent le comptoir vide, les paquets existants, l’affinage, le surplus, le jury disponible ou en attente, les chargements, les données partielles et les erreurs avec récupération. Ils vérifient aussi la priorité des circuits professionnels, l’attente de transformation et les annonces absentes, terminées ou en pause. Le passage vers Stockage utilise le vrai composant et conserve le lot ; « Suivre le duel » transmet la même récolte. Les contrôles de navigation des lots précédents passent à nouveau : retours Commerce/Stockage/Jury, lien de lot résolu, historique et récupération d’un lien périmé.

Preuves : `output/clarity-storage-actions/browser/results.json`, `output/clarity-storage-actions/browser/visual-results.json`, `output/clarity-lot5/mission-navigation/report.json`, `output/clarity-lot5/navigation/after/report.json`. Aperçus : [choix du contenant à 320 px](../../output/clarity-storage-actions/browser/choose-exact-lot-320.png), [retour vers Missions à 390 px](../../output/clarity-lot5/mission-navigation/culture-return-390.png), [focus sur la carte à 320 px](../../output/clarity-lot5/navigation/after/zoom-keyboard-320.png), [aide de la carte à 320 px](../../output/clarity-lot5/navigation/after/help-320-full.png).

Preuves Commerce : `output/clarity-lot5/commerce/before/report.json`, `output/clarity-lot5/commerce/after/report.json`, `output/clarity-lot2/navigation/context-report.json`. Aperçus : [récolte en affinage à 320 px](../../output/clarity-lot5/commerce/after/curing-320.png), [vente sans site à 320 px](../../output/clarity-lot5/commerce/after/unopened-320.png), [annonce absente à 390 px](../../output/clarity-lot5/commerce/after/missing-390.png). Les captures ont été inspectées, notamment les chiffres et l’espace autour du focus du sélecteur de contenant.

Les 43 tests ciblés de disponibilité des contenants, d’orientation commerciale, de sélection des lots, de stratégie commerciale et d’état des annonces passent. TypeScript global, ESLint ciblé et la vérification de diff passent sur les changements de ce lot.

Les recettes emploient des données locales simulées, sans transaction sur un compte réel. Aucun changement des règles de vente, de réservation ou de paiement, et aucune migration, n’est nécessaire pour ce lot. Les notes d’expert initiales restent des repères historiques ; l’amélioration de la compréhension doit toujours être mesurée avec les joueurs de la section 14.

**21. Sixième lot : les échéances et blocages visibles au Quartier**

Le point P2 sur la découverte des problèmes financiers et commerciaux est désormais traité pour les factures datées et les blocages de vente confirmés. Le Quartier utilise son résumé existant : une action principale, complétée par deux informations au maximum. Il ne crée pas de nouveau tableau de bord à parcourir.

| Situation confirmée | Ce que propose le Quartier |
| --- | --- |
| Vrac sans contenant | Le rangement reste prioritaire, même avec une facture échue ou une boutique suspendue. |
| Facture de laboratoire ou fournisseur arrivée à échéance | « Voir mes factures » ouvre Finances sur les factures. Le résumé nomme la catégorie, le reste à payer sur une facture précise et sa date réelle. |
| Paquets proposés à la vente, bloqués par une qualité insuffisante | « Vérifier ces paquets » ouvre l’annonce exacte dans Mon stock en vente. Le résumé indique la quantité et le seuil concerné ; il ne suggère aucune destruction. |
| Boutique existante suspendue avec des paquets actifs de qualité suffisante | « Vérifier ma boutique » ouvre sa gestion. Aucun achat ni redémarrage automatique n’est déclenché. |
| Prochaine facture sous 24 heures réelles | Elle reste secondaire à une culture, un lot vendable ou un jury disponible. Elle peut devenir l’action principale pendant une attente automatique ou avant une nouvelle culture. |
| Annonces volontairement en pause, fermées, épuisées ou jetées | Elles ne sont pas transformées en urgences. Un site jamais créé n’est pas présenté comme une panne. |
| Lecture incomplète ou en échec | Le suivi reste « à vérifier », avec une commande d’actualisation visible, même si deux autres activités attendent. Aucune absence de dette ou de blocage n’est déduite. |

Les factures échues passent avant les blocages commerciaux ; ceux-ci passent avant les activités ordinaires. Les autres alertes confirmées deviennent des accès secondaires. Une facture à venir ne prend pas le dessus sur un rangement encore incertain. Cette hiérarchie s’appuie sur des états connus ; elle ne reconstitue pas un récit « pendant ton absence ».

La lecture financière porte sur les factures datées du laboratoire et des fournisseurs. Elle vérifie les soldes et dates de chaque catégorie indépendamment : une catégorie manquante ne supprime pas une facture confirmée de l’autre, et ne devient pas un total nul. Le résumé ne prétend pas donner toutes les dettes ni calculer la trésorerie après règlement. L’électricité, le climat, la TVA et les autres échéances restent détaillés dans Finances, selon leurs règles existantes.

Le seuil commercial utilise la qualité exacte du serveur. L’affichage reste limité à deux décimales ; si l’arrondi donnerait 5,8 pour une valeur légèrement inférieure, le texte indique « qualité inférieure à 5,8/10 ». Les quantités d’une annonce ne sont pas agrégées avec celles d’un autre lot. Une suspension indique un arrêt des commandes, sans promettre de demande ni de vente après réactivation.

Une seule lecture supplémentaire, `commerce?shop=1`, alimente les deux suivis. Elle ne bloque pas la reprise de culture, expire après dix secondes si nécessaire et s’actualise toutes les soixante secondes lorsque l’onglet est visible, ainsi qu’après les événements du jeu concernés. L’endpoint conserve ses règlements temporels habituels ; le résumé n’envoie aucune commande manuelle de paiement, d’achat, de mise en vente ou de destruction. Aucune nouvelle API ni migration n’est ajoutée.

Validation locale :

- 62 tests ciblés passent pour la reprise, l’ordre des priorités, les factures et les annonces. Ils couvrent notamment les limites temporelles, les paiements partiels, les catégories absentes, les identifiants ambigus, les pauses volontaires et le seuil de qualité.
- 76 observations navigateur initiales à 320, 390 et 1440 px, puis 9 observations ciblées après les dernières corrections. Chargement non bloquant, délai dépassé, récupération au clavier et actualisation après règlement simulé sont vérifiés.
- Les 39 observations de reprise du quatrième lot passent à nouveau, avec un suivi financier et commercial vide connu dans les jeux de données. Le scénario de récupération attend correctement le retour du panneau après son chargement.
- Les vrais composants du Quartier, de la carte et du conteneur de navigation sont utilisés. Les destinations Finances et Commerce sont remplacées par des témoins dans ces tests de routage : pôle Factures et identifiant exact de l’annonce sont vérifiés, sans effectuer une transaction.
- Les captures ont été inspectées : une action principale de 48 px minimum, des commandes secondaires sur papier, au plus deux informations et aucun débordement horizontal dans les cas observés. Le statut incomplet conserve une place et son bouton d’actualisation sur un compte chargé.

Preuves : `output/clarity-lot6/quartier/report.json`, `output/clarity-lot6/quartier/report-targeted.json`, `output/clarity-lot4/quartier/report.json`. Recette reproductible : `node scripts/audit-quartier-attention-lot6.mjs`. Aperçus : [facture échue à 320 px](../../output/clarity-lot6/quartier/overdue-320-viewport.png), [rangement et alertes secondaires à 320 px](../../output/clarity-lot6/quartier/mixed-320-viewport.png), [annonce bloquée à 390 px](../../output/clarity-lot6/quartier/quality-390-viewport.png), [suivi indisponible sur un compte chargé à 320 px](../../output/clarity-lot6/quartier/busy-unknown-320-viewport.png).

TypeScript global et ESLint ciblé passent. Les vérifications utilisent exclusivement des données locales simulées et n’effectuent aucune transaction sur un compte réel. La priorité choisie et la compréhension de ces messages restent à valider avec les joueurs ; les notes initiales de l’audit ne sont pas automatiquement réévaluées.

**22. Septième lot : des mots stables et une aide qui mène au bon endroit**

Cette passe corrige les décalages entre les menus actuels, leurs explications et le guide La Relève. Le joueur doit pouvoir suivre une instruction en retrouvant les mêmes mots à l’écran. Elle corrige aussi une frise de stockage encore accessible qui plaçait le jury avant l’affinage.

| Friction constatée | Correction |
| --- | --- |
| « Merch », « collections » et « produits dérivés » désignaient la même destination. | « Produits dérivés » devient le nom de l’onglet et des accès dans Commerce, le Studio et La Relève. Les descriptions peuvent toujours parler d’une collection. |
| Des instructions renvoyaient à « Mes ventes », « Activité » ou « Développer ma boutique », absents des menus actuels. | Les chemins reprennent « Vendre », « Mon stock en vente » et « Développer », puis le nom exact du sous-onglet. |
| Les liens de la synthèse vers les produits dérivés perdaient la sous-destination lorsqu’ils étaient ouverts directement. | Leur URL précise la destination, comme le clic normal. Le rechargement et l’ouverture du lien conservent l’onglet attendu. |
| Le guide cherchait d’anciens onglets et un menu « Rubriques » disparu. | Il cible les boutons actuels de Commerce. Après publication des produits dérivés, il mène vers Mon stock en vente, le rayon Produits dérivés, puis « Stock, rythme et versements ». Il ne renvoie plus vers leur fabrication. |
| Un bilan déjà déplié avant l’avance du temps pouvait rester hors écran, sans cible proposée par le guide. | Le guide peut montrer le contenu déjà ouvert des bilans de campagne et de produits dérivés. Le bouton d’aide le révèle et lui donne le focus, sans refermer les détails. |
| Une frise d’inventaire enseignait encore Récolte → Jury → Curing. | Elle présente Récolte → Rangement → Affinage → Jury et duel → Vente. Les aides précisent six heures réelles dès la récolte, avant le jury, même hors connexion. |
| Les aides alternaient « curing » et « affinage », et pouvaient laisser croire que le jury consommait toute la récolte. | « Affinage » est repris dans les écrans de récolte, stockage, bilan, aides et missions concernés. La Fleur d’Arène utilisée pour le jury est distinguée du stock conservé pour la vente. |
| Certaines missions qualité décrivaient une note différente de celle utilisée pour compter leur progression. | Les livraisons aux boutiques indiquent la qualité au moment de chaque vente. La mission des dix lots affinés explique sa note de référence : lot commercial, sinon jury, sinon estimation à la récolte. |

Les règles économiques, critères de progression, identifiants internes et coûts ne changent pas. Les panneaux et commandes conservent leur matériau illustré ; aucun nouveau bloc d’aide permanent n’est ajouté. Le vocabulaire technique peut rester présent dans les clés de données sans apparaître comme nom de rubrique.

Validation locale :

- 89 tests existants passent : simulations Commerce, produits dérivés et réseaux sociaux, reprise au Quartier, missions et essai guidé.
- 15 observations navigateur à 320, 390 et 1440 px vérifient les vrais composants Commerce et l’inventaire intégré. L’onglet Produits dérivés reste lisible ; flèches, Home, Entrée, historique, rechargement, liens de la synthèse et raccourcis du Studio aboutissent à la bonne section. La frise présente les cinq étapes dans le bon ordre.
- 30 observations supplémentaires vérifient le vrai guide La Relève avec Commerce dans une boîte de dialogue. Les trois destinations principales sont retrouvées ; la préparation et le suivi des produits dérivés conduisent aux commandes visibles attendues. « Aide : me montrer » donne le focus à la cible, activable au clavier.
- 6 cas complémentaires couvrent les bilans de produits dérivés et de campagne déjà ouverts mais entièrement hors écran, aux trois largeurs. Le guide retrouve le contenu, le révèle et lui donne un focus visible avec l’aide au clavier, en conservant le bilan ouvert.
- Aucun débordement horizontal, erreur JavaScript, appel externe ni écriture API n’est relevé pendant ces parcours. Les états des essais sont préparés localement avant l’ouverture des écrans ; les recettes vérifient la navigation et n’effectuent pas d’achat ou de vente depuis l’interface.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Les captures mobiles finales ont été inspectées.

Preuves : `output/clarity-lot7/after/report.json`, `output/clarity-lot7/guides/report.json`, `output/clarity-lot7/guides/reports-open.json`. Recettes : `node scripts/audit-clarity-language-lot7.mjs` et `node scripts/audit-releve-navigation-lot7.mjs` ; l’option `--reports-only` isole les six cas de bilans déjà ouverts. Les captures `before` ont été produites pendant les modifications et ne constituent pas une référence avant/après fiable ; seules les observations finales sont utilisées ici.

Aperçus : [Produits dérivés à 320 px](../../output/clarity-lot7/after/develop-products-320-viewport.png), [ordre du stockage à 320 px](../../output/clarity-lot7/after/storage-timeline-320-viewport.png), [guide vers le suivi des produits dérivés à 320 px](../../output/clarity-lot7/guides/products-report-320.png).

Cette passe porte sur les parcours cités, sans prétendre supprimer chaque ancien terme dans tous les composants historiques. L’ancien essai `KqGuidedTrial`, actuellement sans point de montage dans l’application, conserve les tarifs utilisés par son propre moteur ; seule sa terminologie est harmonisée. Aucune migration n’est nécessaire. La compréhension et la facilité de jeu restent à mesurer avec de nouveaux joueurs selon la section 14 ; les notes initiales ne sont pas relevées sur la seule base de tests techniques.

**23. Huitième lot : préparer une culture et comprendre sa prochaine décision**

Cette passe revient au cœur du jeu. Elle traite les détours avant la première culture, l’accès aux cartes pendant un tour, la lecture des dés et la place du budget avant le lancement.

| Friction constatée | Correction |
| --- | --- |
| Sans Buddie, Culture renvoyait vers l’album ; le sélecteur de variété pouvait ensuite ouvrir un carrousel vide. | Le bloc « Tes Buddies » explique le prérequis et propose « Découvrir les Packs Buddies ». Il ne propose plus de sélecteur vide. Une collection non vérifiée conserve son état inconnu et sa commande d’actualisation. |
| Un détour vers les Packs pouvait perdre la zone, la campagne ou le retour vers Missions. | Le détour conserve ces informations et la préparation sauvegardée. Retour, historique et rechargement réouvrent le contexte attendu. L’accès aux Packs ne déclenche aucun achat. |
| « Voir mes possibilités · N cartes » défilait vers la santé et les options, avec la main encore fermée. | Lorsqu’une carte est jouable, le raccourci ouvre directement la main, affiche le filtre Jouables et donne le focus à son en-tête. Sans carte jouable, il conserve l’accès aux possibilités et aux soins. Aucune carte n’est sélectionnée ou consommée par cette navigation. |
| « 6 · Étincelle » n’indiquait pas qu’un 6 compte aussi comme une réussite. | La légende affiche « Réussite +1 XP », en conservant « Étincelle » pour reconnaître les effets des cartes. Les intervalles « 2–3 » et « 4–5 » restent sur une ligne. |
| « Qualité X » pouvait être confondu avec la note du lot sur 10. | Le bandeau indique « Qualité de culture · X pts estimés ». Le calcul et la distinction avec les notes du jury et du stock restent consultables dans les détails. Aucun maximum ni conversion n’est inventé. |
| La confirmation plaçait les explications avant les charges. | Un seul titre présente la décision, puis le budget et sa répartition apparaissent en premier. L’absence de carte consommée au départ et les six heures réelles d’affinage restent visibles ; les règles détaillées des cartes sont repliées. |
| Les compteurs du deck utilisaient des libellés à 10 px et une explication à 11 px. | Les repères utiles passent à 14 px et les explications secondaires à 13 px. Les trois compteurs restent alignés, y compris lorsque certaines valeurs sont inconnues. |

Les montants proposés, les permissions de jeu, les chances des dés, les critères de cartes jouables et les règles de consommation restent inchangés. Le bouton de lancement reste bloqué tant que le devis attendu n’est pas disponible. Les illustrations des cartes et les matériaux papier sont conservés.

Dans la scène de recette à 320 × 844 px, le budget de 66,70 € apparaît désormais avant les explications et les boutons Annuler/Commencer sont visibles dès l’ouverture. Avant cette modification, Commencer commençait à y = 976 px. À 320 × 422 px, le budget reste visible dès l’ouverture ; les détails et les boutons nécessitent un défilement. Ce dernier format reproduit l’espace CSS disponible d’une fenêtre de 640 × 844 px agrandie à 200 %, sans constituer une mesure de zoom natif du navigateur.

Validation locale :

- 108 tests existants passent pour l’affectation des Buddies, la préparation du deck, les brouillons, la sélection d’une culture et les conséquences prévues d’un tour.
- 24 observations navigateur couvrent huit états à 320, 390 et 1440 px : préparation, réaction, santé critique, XP insuffisants, préparation ou réaction déjà utilisée, stock épuisé et main vide. Le raccourci ouvre la main et rétablit le filtre Jouables ; le focus et l’accès aux soins sont conservés. Sur ordinateur, l’ouverture habituelle de la main reste disponible au clavier. Deux contrôles visuels complémentaires vérifient les valeurs des faces de dés sans retour à la ligne à 320 et 390 px.
- 18 cas de navigation vérifient l’entrée Packs Buddies et les retours, avec ou sans brouillon, après historique ou rechargement. Les états de collection vide, inconnue et possédée sont distingués. Les provenances Commerce et Récoltes/Stockage restent conservées. Ces tests utilisent le vrai conteneur de navigation et le vrai bloc Buddies ; les destinations sont simulées pour isoler les retours des achats.
- 12 observations de préparation couvrent les quatre formats, le deck et ses données partielles, le devis de départ en chargement ou en erreur puis sa récupération, et le vrai écran Culture sans Buddie. Le lancement reste bloqué lorsque nécessaire ; Escape ferme la confirmation et restitue son bouton d’ouverture.
- Les recettes finales ne relèvent aucune erreur JavaScript, aucun appel externe ni requête de mutation. Les captures ont été inspectées. TypeScript global, ESLint ciblé et contrôle de diff passent.

Preuves : `output/clarity-lot8/decisions/results.json`, `output/clarity-lot8/decisions/visual-results.json`, `output/clarity-lot8/buddie-navigation/report.json`, `output/clarity-lot8/culture-observe/after/report.json`. Recettes reproductibles : `scripts/audit-culture-decisions-lot8.mjs`, `scripts/audit-buddie-preparation-navigation-lot8.mjs`, `scripts/audit-culture-observe-lot8.mjs`.

Aperçus : [budget avant lancement à 320 px](../../output/clarity-lot8/culture-observe/after/start-cost-320.png), [budget avec hauteur réduite](../../output/clarity-lot8/culture-observe/after/start-cost-reflow-640-at-200.png), [compteurs du deck à 320 px](../../output/clarity-lot8/culture-observe/after/deck-320.png), [légende et décision du tour à 320 px](../../output/clarity-lot8/decisions/dice-legend-320.png).

Les montants et états sont fictifs, calculés ou fournis par les recettes locales. Aucun achat ni lancement de culture n’a été effectué sur un compte réel. Cette passe améliore des interactions vérifiables ; elle ne mesure pas encore leur compréhension par de nouveaux joueurs. Les notes initiales de l’audit restent inchangées.

**24. Neuvième lot : retrouver son matériel et comprendre son état**

Cette passe traite les détours entre Culture, Missions, l’Entrepôt et sa Boutique. Le diagnostic a porté sur les composants effectivement montés : l’Atelier utilise encore l’inventaire des machines partagé avec les anciens écrans. Ses défauts de chargement affectent donc le parcours actuel.

| Friction constatée | Correction |
| --- | --- |
| La Boutique ouvrait Éclairage même depuis Séchage, Stockage ou Atelier. Un appareil demandé pouvait être perdu en route. | L’ouverture reprend le rayon correspondant à la pièce. Une entrée ciblée retrouve le rayon et la fiche du modèle demandé, sans l’ajouter au devis. |
| Un conseil de Missions pouvait recommander un équipement de l’ancien catalogue absent de l’Entrepôt actuel. | Le prochain objectif d’atelier est limité aux machines de transformation proposées dans ce parcours. Un ancien lien non pris en charge reçoit une explication, sans substituer arbitrairement un modèle. |
| Depuis Culture, la zone était sélectionnée mais sa configuration restait hors écran sur mobile. | L’arrivée ciblée révèle la zone demandée et lui donne le focus une seule fois. Elle n’ouvre pas automatiquement un devis et ne modifie pas le plan. |
| « Achat du matériel » et « Déjà possédé » mélangeaient prix neuf, matériel installé et réserve. | Le prix est identifié comme une référence neuve. Les quantités installées et en réserve proviennent du plan enregistré ; les changements encore au devis ne deviennent pas des achats acquis. Le devis conserve le montant à payer. |
| Avant le premier chargement ou après son échec, l’Atelier affichait zéro euro et aucune machine acquise. | Les données inconnues affichent un état de vérification ou d’erreur avec Réessayer. Après un chargement réussi, une actualisation échouée conserve le dernier inventaire en le signalant comme non actualisé. |
| Sur mobile, une machine installée et une machine en réserve avaient presque le même cartouche. | Les états « Installée », « À installer » et « À entretenir » sont écrits dans les cartouches, avec une action accessible correspondante. Leur lecture ne dépend plus d’une couleur ou d’une infobulle. |

Les coûts, conditions d’achat, réservations et règles d’entretien ne changent pas. Les panneaux papier et la géométrie illustrée de l’atelier sont conservés. Une zone active n’est plus qualifiée de « prête à cultiver » avant la vérification des Buddies et des cartes sur la page de préparation.

La densité générale du Plan reste un sujet distinct : à 320 px, les quatre chiffres, l’accès à Culture, la sélection des zones et les outils retardent l’apparition du plan. Le panneau latéral reprend également une action Configurer déjà présente sur le plan. Cette passe corrige l’arrivée ciblée ; elle ne prétend pas avoir supprimé cette répétition ni achevé une refonte du plan.

Validation du neuvième lot : 134 tests passent, dont 107 sur les devis, la réserve, les brouillons et les prérequis, et 27 sur les équipements et le ciblage des destinations. Les 69 observations navigateur comprennent 24 parcours Boutique/Missions, 30 états d’inventaire et récupérations, et 15 arrivées ciblées dans l’Entrepôt, à 320, 390 et 1440 px. Les vrais composants utilisent uniquement des réponses locales simulées ; aucune transaction n’a été effectuée sur un compte réel. TypeScript global et ESLint ciblé passent.

Les cas incluent le rayon et la fiche exacts, les anciens codes indisponibles, les climatiseurs, la réserve inchangée pendant un devis, les zones verrouillées ou inexistantes, le focus après récupération et l’absence de défilement répété après actualisation. Les cartouches de machines sont vérifiés sans chevauchement ni découpe. À 320 px, l’arrivée ciblée rend le bouton Configurer visible à y = 633 au lieu de le laisser hors écran à y = 1938. Les positions sont mesurées sur l’Entrepôt isolé, sans l’en-tête général du jeu.

Preuves : `output/clarity-lot9/navigation/report.json`, `output/clarity-lot9/workshop/results.json`, `output/clarity-lot9/warehouse/after/report.json`. Recettes : `scripts/audit-warehouse-navigation-lot9.mjs`, `scripts/audit-workshop-inventory-lot9.mjs`, `scripts/audit-warehouse-observe-lot9.mjs`. Aperçus : [état des machines à 320 px](../../output/clarity-lot9/workshop/maintenance-320.png), [arrivée sur la zone demandée](../../output/clarity-lot9/warehouse/after/from-culture-320-viewport.png), [équipement demandé dans le bon rayon](../../output/clarity-lot9/warehouse/after/target-product-320.png).

**25. Dixième lot : regrouper les commandes du Plan**

À la demande de poursuivre, cette passe traite les répétitions identifiées juste au-dessus. Le panneau de la zone sélectionnée rassemble son identité, sa surface, son état et l’unique bouton « Configurer cette zone ». Il est plus court et précède le plan sur mobile. L’ordre de lecture et de tabulation suit cette présentation ; une zone en culture reste verrouillée.

La création commence directement par Culture, Séchage ou Stockage, sous « Tracer une nouvelle zone ». Le bouton générique Nouvelle zone en doublon disparaît. Les outils Voir, Déplacer et Taille restent à côté du plan, ainsi que l’aide repliée, l’annulation par Échap et la commande Terminer la manipulation. Les raccourcis par double appui et par Entrée continuent d’ouvrir le même éditeur d’équipement.

En mode Aménager, le retour vers la préparation des cultures se trouve après le plan. Pendant un devis, un seul groupe Annuler/Installer présente le montant à payer sous le plan ; la confirmation conserve ses coûts détaillés. L’apparition de ces commandes n’agrandit pas le panneau placé au-dessus du plan, pour garder la géométrie stable pendant les manipulations. Le mode Suivre les cultures conserve son propre parcours.

Validation locale :

- 18 observations à 320, 390 et 1440 px passent : entrée habituelle, entrée ciblée, zone libre avec d’autres cultures en cours, zone verrouillée, identifiant absent et matériel recherché. Elles vérifient l’unicité du bouton de configuration, sa visibilité initiale sur mobile, l’ordre de tabulation, les retours et l’absence de débordement horizontal.
- Les 13 cas de la recette de l’éditeur passent : dessin, choix d’éclairage et d’extraction, modules, déplacement, redimensionnement, séchage, stockage, brouillon conservé, erreur puis reprise, budget insuffisant, zone verrouillée et commandes au clavier. Les formats comprennent 320 × 568, 390 × 844, 844 × 390 et 1440 × 900 px. La position du plan reste stable pendant le dessin et à la fermeture de l’éditeur.
- Les paiements de cette seconde recette sont exclusivement simulés dans la mémoire du navigateur. Aucun achat, enregistrement ou autre transaction n’est envoyé à un compte réel.
- TypeScript global, ESLint ciblé et contrôle de diff passent après les modifications.

Dans la scène habituelle à 320 × 844 px, Configurer est visible entre y = 676 et y = 726, sans défilement automatique. La page passe de 2152 à 1928 px de hauteur par rapport à la scène de référence du neuvième lot. Le plan lui-même reste sous le premier écran : cette passe améliore l’accès à la décision et retire les commandes répétées, sans prétendre faire tenir toute l’installation sur un écran. Les captures mobiles et ordinateur ont été inspectées.

Preuves : `output/clarity-lot10/plan/after/report.json`, `output/warehouse-zone-dialog/report.json`. Recettes : `scripts/audit-warehouse-plan-clarity-lot10.mjs` et `scripts/audit-warehouse-zone-dialog.mjs`. Aperçus : [entrée habituelle à 320 px](../../output/clarity-lot10/plan/after/normal-320-viewport.png), [Plan à 1440 px](../../output/clarity-lot10/plan/after/normal-1440-viewport.png).

Ces deux lots ne nécessitent pas de migration. La compréhension par de nouveaux joueurs reste à mesurer ; les notes initiales de l’audit ne sont pas automatiquement relevées.

**26. Onzième lot : des actions cohérentes après la récolte**

Cette passe corrige des contradictions entre l’état d’un lot et les boutons proposés dans Récoltes et Stockage. La priorité de rangement est désormais distinguée de l’étape réelle du parcours : un surplus peut demander une action immédiate sans faire disparaître un duel en cours.

| Friction constatée | Correction |
| --- | --- |
| Un lot classé en surplus perdait son bouton de suivi du duel, alors que son résumé indiquait « Duel en cours ». | « Protéger le surplus » reste l’action principale. « Suivre le duel » reste accessible à côté, au clavier comme au toucher. Le filtre Jury et duels retrouve aussi ce lot. |
| Un lot affiné avant le jury pouvait perdre son accès au jury lorsqu’il avait un surplus. | L’accès au jury reste proposé lorsque l’affinage est confirmé terminé. Le rangement est conseillé en premier, sans ajouter de nouvelle condition de jeu. |
| « Plus de vrac » pouvait être suivi de « Préparer la vente », puis d’un sélecteur de contenant inutile. | Un lot jugé dont le vrac restant est confirmé à zéro propose « Voir mon stock en vente ». Il ne propose plus de ranger des fleurs absentes. Le texte parle d’éventuels paquets et ne prétend pas que tout a été vendu. |
| Une quantité manquante ou une phase inconnue pouvait conduire vers une vente ou être assimilée à de l’affinage. | Le lot propose une vérification. Le stock inconnu reste « À confirmer », distinct de zéro. Le résumé et les boutons partagent la même lecture de l’état. |
| Le retour depuis Commerce risquait de perdre la section ou le lot de départ. | L’ouverture de Mon stock en vente conserve l’origine Récoltes, Stockage ou Entrepôt/Stockage et l’identifiant du lot pour le retour. La destination est le registre général des ventes, sans inventer une annonce correspondante. |

La répartition repliée distingue les lots sans vrac des lots prêts à vendre. Elle compte chaque récolte une seule fois et explique la priorité des surplus lorsque ceux-ci concernent aussi le jury. Les étapes connues restent comptées quand une autre source de données est indisponible. Les règles de vente, les offres monétaires et l’affinage avant le jury ne changent pas.

Validation locale :

- 53 tests passent sur les étapes des récoltes, les résumés communs, les actions du stockage, l’affinage avant le jury et les conseils de Commerce. Ils couvrent notamment les quantités nulles, absentes, négatives ou non finies et les états combinant jury et surplus.
- 19 contrôles navigateur utilisent les vrais composants Récoltes, Stockage et Entrepôt à 320, 390 et 1440 px : accès au jury, ordre de tabulation, filtres, destinations de Commerce, focus du lot, absence de bouton de rangement pour un vrac épuisé, erreur de lecture puis récupération et absence de débordement horizontal.
- 9 parcours complémentaires utilisent le vrai conteneur de navigation et le vrai Commerce. Les écrans de départ y sont simulés pour isoler leurs callbacks. Ils vérifient la destination Mon stock en vente, le rechargement, le retour au lot et les boutons précédent/suivant du navigateur depuis les trois origines, aux mêmes largeurs.
- Les recettes finales ne relèvent aucune erreur JavaScript, aucun appel externe et aucune mutation. TypeScript global, ESLint ciblé et contrôle de diff passent. Les captures mobiles et ordinateur ont été inspectées.

Preuves : `output/clarity-lot11/actions/report.json` et `output/clarity-lot11/navigation/report.json`. Recettes : `scripts/audit-harvest-actions-lot11.mjs` et `scripts/audit-harvest-market-navigation-lot11.mjs`. Aperçus : [duel avec surplus à 320 px](../../output/clarity-lot11/actions/duel-320.png), [vrac épuisé et quantité inconnue à 320 px](../../output/clarity-lot11/actions/empty-storage-320.png), [actions à 1440 px](../../output/clarity-lot11/actions/duel-1440.png).

Les données et états sont simulés localement ; aucune opération n’a été effectuée sur un compte réel. Cette passe ne nécessite pas de migration. Les notes de l’audit restent inchangées en l’absence d’une mesure de compréhension auprès de nouveaux joueurs.

**27. Douzième lot : arriver sur la bonne décision au jury**

Le jury affichait le classement avant les Fleurs d’Arène. L’arrivée depuis un lot en duel donnait le focus à sa carte, alors que la demande de verdict se trouvait plus bas dans l’historique. Les Fleurs consommées encombraient également la réserve ; après fermeture du résultat, l’historique ne proposait pas de retrouver leur lot dans Commerce.

La page porte désormais le nom du menu, « Jury & duels », et commence par la réserve. « Classement et progression » se trouve après les duels, dans un volet fermé à l’ouverture. Les résultats précèdent leurs statistiques, elles aussi repliées. Les lignes d’historique utilisent des séparations plus discrètes et leurs dates et libellés secondaires sont plus lisibles sur mobile.

| Situation | Comportement désormais proposé |
| --- | --- |
| Fleur prête ou en affinage | La réserve conserve les cartes illustrées et leurs commandes existantes. Le jury reste conditionné à la fin d’affinage confirmée. |
| Duel verrouillé demandé depuis une récolte | L’arrivée révèle le duel et donne le focus à son bloc, à proximité de l’unique bouton « Demander le verdict ». La carte propose « Voir le duel » pour rejoindre ce même endroit. |
| Verdict connu pour le lot demandé | L’historique ouvre la page contenant le bon résultat, même au-delà des cinq premières lignes. Le joueur peut ensuite fermer ce résultat ou changer de page librement. |
| Fleur déjà consommée | Elle quitte la réserve et reste consultable dans Mes duels. Un verdict confirmé prime sur une ancienne réponse qui la disait encore disponible. |
| Lot absent de la réserve chargée | Un message nomme le lot et propose de rechercher son verdict dans les duels récents ou de retrouver son stockage. Aucun autre lot n’est choisi à sa place. |
| Historique pas encore chargé | Le texte invite à charger les résultats précédents ; il ne prétend plus que le joueur n’a jamais disputé de duel. |
| Échec de lecture de la réserve | L’erreur et Réessayer remplacent l’affirmation d’une réserve vide. Le classement indisponible n’affiche pas de chiffres de remplacement. |
| Consultation d’un verdict, récent ou archivé | « Voir ce lot dans Commerce » conserve l’identifiant de la récolte. Le bouton de retour de Commerce revient au jury avec cette même identité. |

Les confirmations restent obligatoires avant soumission. Les textes distinguent la Fleur d’Arène consommée et le stock conservé lors du verdict. L’ouverture de Commerce vérifie ensuite le stock actuel : un ancien reçu ne constitue pas une garantie qu’il reste une quantité à vendre aujourd’hui. La récupération d’une action dont la réponse est incertaine reste accessible après fermeture de la fenêtre de confirmation.

Validation locale :

- 39 tests ciblés passent : choix du lot ou du duel demandé, verdict prioritaire sur une réponse ancienne, annulation antérieure, absence de substitution, analyse des manches, règles des duels et affinage avant jury.
- 20 contrôles navigateur utilisent les vrais écrans Jury et Historique à 320, 390 et 1440 px. Ils couvrent la hiérarchie, le duel verrouillé, la confirmation au clavier sans soumission, le résultat en deuxième page, la fermeture et la pagination volontaires, le chargement d’un ancien résultat, les lots introuvables, les erreurs et leur récupération.
- 3 parcours supplémentaires utilisent le vrai conteneur de navigation et le vrai Commerce, avec un jury simulé pour isoler son callback. Ils vérifient le produit issu de la bonne récolte, le retour au jury, le rechargement et l’historique du navigateur aux trois largeurs.
- Les 23 scénarios existants du jury passent également : fin d’affinage confirmée par le serveur, confirmations, verdicts, petits écrans et paysage, réponse lente, fermeture volontaire et récupération après délai dépassé sans deuxième soumission. Leurs opérations sont simulées dans la mémoire du navigateur.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Aucun débordement horizontal n’est relevé dans les nouvelles recettes ; les captures mobiles et ordinateur ont été inspectées.

Dans le composant isolé, sans l’en-tête général du jeu, la réserve commence à y = 141 px sur les fenêtres de 320 et 390 × 844 px, et à y = 241 px sur ordinateur. Les cartes conservent leur format illustré : à 390 px et sur ordinateur, certaines commandes restent sous le premier écran. Cette passe retire l’obstacle du classement et corrige les arrivées ciblées ; elle ne prétend pas faire tenir toutes les cartes et toutes les actions dans un écran.

Preuves : `output/clarity-lot12/jury/report.json`, `output/clarity-lot12/navigation/report.json` et `output/ux-implementation/jury/results.json`. Recettes : `scripts/audit-jury-clarity-lot12.mjs`, `scripts/audit-jury-commerce-navigation-lot12.mjs` et `scripts/audit-ux-jury.mjs`. Aperçus : [réserve à 320 px](../../output/clarity-lot12/jury/normal-320.png), [arrivée sur un duel en attente](../../output/clarity-lot12/jury/locked-320.png), [jury sur ordinateur](../../output/clarity-lot12/jury/normal-1440.png).

Aucune transaction réelle, aucun déploiement et aucune migration n’ont été effectués. Les résultats décrivent des contrôles locaux avec des données fictives ; les notes initiales restent inchangées en attendant des essais de compréhension avec de nouveaux joueurs.

**28. Treizième lot : choisir le mode de jury avant de parcourir les cartes**

La réserve commençait par les grandes cartes illustrées, puis les analyses et enfin les commandes. Le joueur devait descendre avant de choisir un duel ; le mot « entraînement » pouvait également laisser croire à un essai sans consommation de la Fleur d’Arène.

Chaque fleur se présente désormais comme une ligne de registre : variété, qualité de culture en points, référence du lot, état et action. Les contours des cartes illustrées sont conservés dans « Carte et analyses », fermé à l’arrivée. Les règles détaillées et récompenses passent après la réserve. Les volets affichent un chevron qui change de sens à l’ouverture, avec un libellé et une zone de clic utilisables au clavier et sur mobile.

| Décision | Information visible avant de choisir |
| --- | --- |
| Duel classé | Adversaire joueur, attente possible, classement et série en jeu. |
| Entraînement immédiat | Adversaire automatique, sans attente ni effet sur le classement ou la série. |
| Conséquence commune | La Fleur d’Arène est consommée au verdict dans les deux modes ; le stock récolté est conservé. Cette conséquence reste également dans la confirmation. |
| Affinage en cours ou inconnu | Progression réelle ou état à vérifier, puis accès au stockage du bon lot. Aucun choix de duel anticipé. |
| Duel déjà engagé | État explicite et accès au duel existant, sans nouvelle soumission. |

Les confirmations du duel classé et de l’entraînement rappellent désormais la variété et la référence choisies. L’ordre de tabulation suit l’ordre visuel : duel classé, entraînement, carte et analyses. La fermeture de la confirmation rend le focus à son bouton d’origine. L’arrivée depuis une récolte précise conserve cette sélection, même lorsqu’elle correspond à la troisième fleur de la réserve.

Validation locale :

- 22 contrôles navigateur dédiés passent à 320, 390 et 1440 px, avec un contrôle supplémentaire intégré à cette série sur écran de 320 × 568 px. Ils couvrent les deux confirmations sans soumission, le clavier, le retour du focus, les cartes et analyses dépliées, quatre fleurs dont une au nom long, le lot ciblé, l’affinage en cours, l’état inconnu et le duel engagé.
- Les 20 contrôles du lot précédent passent : arrivées sur les verdicts, recherche et pagination, erreurs de chargement et récupération. Les 23 scénarios existants passent également, notamment la réponse lente et la récupération après délai dépassé sans double soumission. Total : 65 contrôles navigateur.
- Aucun débordement horizontal de page ni erreur JavaScript n’est relevé dans la recette dédiée. Les commandes principales mesurent au moins 44 px de hauteur. Les tableaux d’analyse conservent leur propre zone de défilement.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Les captures mobiles, avec plusieurs fleurs, et ordinateur ont été inspectées.

Dans le composant isolé, sans l’en-tête général du jeu, le bas des deux boutons se situe respectivement à 470 et 570 px sur les fenêtres de 320 et 390 × 844 px ; sur ordinateur, ils sont côte à côte et se terminent à 529 px. Cette mesure concerne une première fleur prête et ne garantit pas que tous les lots tiennent sur un écran. Une réserve importante reste une liste verticale ; consulter les cartes pour les comparer demande maintenant d’ouvrir leurs volets. Les notes de compréhension restent inchangées sans essais auprès de joueurs.

Preuves : `output/clarity-lot13/jury/report.json`, `output/clarity-lot12/jury/report.json` et `output/ux-implementation/jury/results.json`. Recette dédiée : `scripts/audit-jury-decisions-lot13.mjs`. Aperçus : [choix à 390 px](../../output/clarity-lot13/jury/decisions-390.png), [plusieurs fleurs à 320 px](../../output/clarity-lot13/jury/multiple-320.png), [choix sur ordinateur](../../output/clarity-lot13/jury/decisions-1440.png), [carte et analyses dépliées](../../output/clarity-lot13/jury/card-expanded-1440.png).

Les réponses serveur sont simulées localement. La recette dédiée refuse toute mutation ; les soumissions des scénarios existants restent simulées en mémoire. Aucun compte réel, migration ou déploiement n’a été modifié.

**29. Quatorzième lot : trouver un objectif jouable et sa récompense**

Dans Mes objectifs, le bilan global, la légende des récompenses, six boutons de filtre et les grandes illustrations précédaient les commandes des défis. Une récompense dont le versement était indisponible pouvait être comptée « à récupérer ». Les packs déjà gagnés se trouvaient en bas de la page.

La page présente désormais un titre compact, les trois familles de missions, un résumé chiffré court et un seul sélecteur de parcours. Le filtre « Récompenses prêtes » montre uniquement les objectifs dont la récompense est effectivement disponible selon les données reçues. Le bilan graphique et les règles restent dans des volets fermés après les objectifs. Les scènes de chaque parcours sont conservées sous forme de vignettes ; la description de l’objectif, sa progression et la récompense restent visibles avant son bouton.

| Situation reçue du serveur | Présentation et action |
| --- | --- |
| Récompense disponible sur l’étape courante | Le parcours apparaît avant les objectifs en cours. Le bouton nomme la récompense à récupérer. |
| Mission en cours | Progression réelle, récompense à gagner, action correspondante et épinglage volontaire au Quartier. |
| Objectif atteint, récompense indisponible | État explicite, récupération désactivée, exclusion du filtre des récompenses prêtes. L’argent du jeu conserve ses règles de disponibilité propres. |
| Étape verrouillée | Prérequis affiché et parcours détaillé consultable ; aucune commande de lancement ni épinglage prématuré. |
| Parcours terminé | Placé après les parcours actifs ; étapes et récompenses précédentes restent consultables. |
| Pack ancien déjà gagné | Accès avant la liste des parcours. Lorsqu’un reçu propose déjà d’ouvrir le pack qui vient d’être gagné, ce reçu porte l’action. |
| Échec de l’actualisation | L’ancien résumé est nommé « Dernier état connu » et ses récupérations sont bloquées jusqu’à une lecture réussie. Une première lecture en échec n’invente pas de progression nulle. |
| Réponse sans mission | Message explicite de données vides ; aucun parcours terminé ni mission supplémentaire n’est fabriqué depuis le catalogue. |

La priorité ne remplace pas le choix du joueur : le filtre de parcours reste utilisable, aucun objectif n’est épinglé automatiquement et les autres missions continuent de progresser. Le tri se limite à la première étape non récupérée de chaque parcours ; une étape ultérieure déjà avancée ne contourne pas sa précédente récompense.

Mesure de la position du bas du premier bouton de mission, à données et dimensions identiques :

| Fenêtre | Avant | Après |
| --- | ---: | ---: |
| 320 × 844 px | 1 783 px | 818 px |
| 390 × 844 px | 1 609 px | 796 px |
| 1440 × 844 px | 1 579 px | 796 px |

Ces vues utilisent le vrai centre de missions et les vrais contrôles d’épinglage avec une navigation locale de recette, sans le HUD général du jeu. Les positions mesurent le gain dans ce contexte ; elles ne garantissent pas que tous les objectifs, ou un objectif au texte long, tiennent dans le premier écran. Les cinq parcours restent présents par défaut et nécessitent encore un défilement sur mobile.

Validation locale :

- 20 tests ciblés passent, dont 8 nouveaux cas sur la priorité de l’étape courante, les récompenses indisponibles, l’argent du jeu sans collection active, les anciens packs, les états verrouillés et les données vides.
- 26 contrôles navigateur dédiés passent : 320, 390 et 1440 px, filtres, épinglage au clavier, priorité des récompenses, verrouillage, anciens packs, parcours terminés, erreurs initiales, récupération et erreur après un premier chargement réussi. La recette refuse toute écriture de jeu.
- Les 29 observations existantes de l’objectif épinglé passent : remplacement, retrait et restitution du focus, progression zéro réelle, compte distinct, essai isolé, sauvegarde indisponible et récupération après erreur.
- Les parcours Missions → Culture passent aux trois largeurs avec le vrai conteneur de navigation : culture sélectionnée, détour par le matériel, retour, rechargement, historique et garde du brouillon. Les destinations Culture et Entrepôt sont simulées pour isoler ces retours.
- La recette existante des 30 missions passe à quatre largeurs, avec récupérations d’argent, de cartes et de packs simulées en mémoire, anciens packs, connexion absente, erreur, indisponibilité de collection et parcours terminés.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Les captures mobiles et ordinateur ont été inspectées ; aucun débordement horizontal de page ni erreur JavaScript n’est relevé dans la recette dédiée.

Preuves : `output/clarity-lot14/before/report.json`, `output/clarity-lot14/after/report.json`, `output/pinned-mission-lot4/report.json`, `output/clarity-lot5/mission-navigation/report.json` et `output/placard-missions/report.json`. Recette dédiée : `scripts/audit-missions-clarity-lot14.mjs`. Aperçus : [à 320 px](../../output/clarity-lot14/after/viewport-320.png), [à 390 px](../../output/clarity-lot14/after/viewport-390.png), [sur ordinateur](../../output/clarity-lot14/after/viewport-1440.png).

Aucune opération sur un compte réel, migration ni mise en production. Les notes de l’audit restent inchangées : ces validations vérifient la présentation et les comportements, pas encore la compréhension par de nouveaux joueurs.

**30. Quinzième lot : comprendre la préparation avant de passer à la vente**

Après le jury, la fiche complète de récolte et une grande illustration repoussaient le choix du produit sous les 1 000 px sur mobile. Les quantités, les charges et le délai étaient dispersés. La confirmation rappelait le nom du produit et un montant, sans reprendre les quantités utilisées, le résultat prévu ni le reste conservé.

La préparation tient désormais dans un panneau centré sur la décision : variété, référence du lot, qualité actuelle, produit à préparer, quantités, coût, délai et bouton de continuation. Le sélecteur conserve le comportement natif et le clavier, avec une enseigne illustrée et une flèche visible. La fiche complète de récolte et les détails du produit, dont la scène d’atelier, se déplient après l’action. Les avertissements de stockage, de matériel et de trésorerie restent visibles.

| Situation | Information présentée avant de confirmer |
| --- | --- |
| Fleurs entières ou biomasse | Quantité préparée, coût prévu et absence de passage en atelier. Le bouton nomme le produit. |
| Transformation | Fleurs utilisées → produit prévu, avec les deux quantités issues de l’offre reçue. Le coût est annoncé comme débité à la confirmation. |
| Préparation partielle | Reste conservé séparément, nommé fleurs ou biomasse selon sa destination. |
| Travail différé | Minutes réelles de travail, distinctes de l’attente des lots déjà en atelier. Une durée absente reste « à confirmer ». |
| Matériel manquant | Produit consultable, motif du verrouillage visible, préparation désactivée. |
| Trésorerie insuffisante | Montant manquant et trésorerie disponible, en plus du coût total. |
| Surplus sans contenant | Quantité à ranger et accès au stockage de cette récolte ; la préparation reste bloquée. Le lien conserve aussi le lot en l’absence du rappel de navigation interne. |
| Échec d’actualisation | Dernières données conservées, erreur visible, préparation désactivée jusqu’à une lecture réussie. |

La confirmation reprend le même récapitulatif chiffré, la variété, la référence du lot et le produit. Elle précise que le choix de vente vient ensuite et qu’un produit transformé ne pourra être vendu qu’une fois le travail terminé. Annuler rend le focus au bouton d’origine. Les calculs économiques, les contrôles serveur et les clés de requête sont conservés.

Mesures sur la même récolte et avec le vrai conteneur Commerce, sans le HUD général du jeu :

| Fenêtre | Début du sélecteur avant → après | Bas de l’action avant → après |
| --- | ---: | ---: |
| 320 × 844 px | 1 074 → 584 px | 1 410 → 933 px |
| 390 × 844 px | 1 059 → 569 px | 1 360 → 878 px |
| 1440 × 844 px | 614 → 389 px | 887 → 708 px |

Le premier choix apparaît donc 490 px plus haut sur les deux mobiles de recette. Le bouton reste sous le premier écran mobile : la navigation et les conditions de préparation occupent encore de la place. Les lots avec un reste, une erreur ou un prérequis nécessitent davantage de défilement. Ces mesures ne constituent pas un test de compréhension auprès de joueurs.

Validation locale :

- 28 contrôles navigateur dédiés passent : 320, 390 et 1440 px, choix des produits, navigation au clavier, annulation, restitution du focus, fiche dépliée, lien vers le lot exact, transformations partielles, biomasse, verrouillage, manque d’argent, durée inconnue, surplus, erreur d’actualisation et récupération.
- À 320 × 568 px, le refus d’un coût modifié reste visible sans faux succès. Le parcours préparation → offre → vente passe avec le moteur d’essai local et la référence exacte de la récolte.
- Les 4 scénarios existants de récupération de vente passent : offre modifiée, conservation modifiée, échec du recalcul et réponse perdue. La nouvelle offre demande une nouvelle confirmation ; vérifier une vente incertaine réutilise sa requête.
- 51 tests existants passent sur le moteur d’essai, la sélection des lots et leur fiche commune. TypeScript global, ESLint ciblé et contrôle de diff passent.
- Captures mobiles et ordinateur inspectées ; aucun débordement horizontal ni erreur JavaScript dans la recette dédiée. Le premier démarrage de l’ancienne recette de récupération a échoué lors de l’optimisation Vite, sur une page vide ; la relance avec les dépendances préparées passe.

Preuves : `output/clarity-lot15/before/report.json`, `output/clarity-lot15/after/report.json` et `output/placard-commerce-quote-recovery/report.json`. Recette dédiée : `scripts/audit-preparation-clarity-lot15.mjs`. Aperçus : [préparation à 390 px](../../output/clarity-lot15/after/raw-390.png), [sur ordinateur](../../output/clarity-lot15/after/raw-1440.png), [confirmation à 320 px](../../output/clarity-lot15/after/partial-confirm-320.png).

Les lectures et les transactions de recette restent simulées localement. Aucun compte réel, migration ni déploiement n’a été modifié. Les notes de compréhension de l’audit restent inchangées jusqu’aux essais avec de nouveaux joueurs.

**31. Seizième lot : comparer les modes de vente sur les mêmes critères**

Le choix du circuit faisait passer la boutique en ligne avant les débouchés à paiement immédiat. Les trois grandes cartes mélangeaient montants, quantités, quotas, qualité, réseau et règles de renouvellement. Le montant TTC était plus visible que sa distinction avec le versement net. Sur mobile, la comparaison commençait après la fiche détaillée du lot, à 949–1 063 px dans la recette.

La page « Choisir où vendre » présente maintenant les CBD shops, les grossistes puis la boutique en ligne. Cet ordre est fixe : aucune recommandation de rentabilité ni sélection automatique n’est déduite des seules recettes TTC. Les trois choix partagent une feuille et des séparateurs simples, avec leurs illustrations réduites en vignettes. Chacun possède un vrai bouton distinct ; lire la fiche ne déclenche plus l’ouverture du circuit.

| Critère | Vente aux professionnels | Boutique en ligne |
| --- | --- | --- |
| Paiement | Immédiat à la vente, après consultation de l’offre et confirmation. | Ventes progressives, même hors connexion. |
| Quantité | Grammes repris comparés aux grammes de ce produit encore en vrac. | Formats de 5 ou 10 g, avec emballages en supplément. |
| Montant | Estimation TTC et prix au gramme ; une prime partielle est signalée comme moyenne. | Prix libres, frais du site reçus dans les données, audience à développer. Aucun revenu hypothétique n’est affiché. |
| Conditions | Motif de refus ou d’épuisement des commandes, seuil de qualité et risque pour le réseau lorsqu’applicables. | Ordinateur, ouverture ou suspension du site, qualité, maturité, préparation, quantité minimale et contenants restent explicités selon l’état du lot. |
| Action | « Voir l’offre » ou « Voir les conditions ». | « Préparer mes paquets » ou « Voir les conditions ». |

Le texte précédant la comparaison annonce les estimations TTC, la TVA et les factures échues. Le versement net reste établi par la confirmation serveur. Les règles de renouvellement des commandes et le détail des prélèvements sont regroupés dans un volet ; les quantités disponibles et les délais de renouvellement restent consultables dans chaque offre.

La fiche du produit garde sa variété, sa référence de produit, son état, sa quantité et sa qualité commerciale visibles. Les échéances, l’affinage et les avertissements de stockage restent affichés. La date de récolte, la référence de fleur, la note historique du jury et l’accès au stockage sont regroupés dans « Détails du lot et stockage ». Ce mode compact s’applique uniquement au choix du circuit ; les autres fiches conservent leur présentation complète.

Mesures à stock et fenêtre identiques, avec le vrai conteneur Commerce et sans le HUD général du jeu :

| Fenêtre | Début de la comparaison avant → après | Fin des trois choix avant → après |
| --- | ---: | ---: |
| 320 × 844 px | 1 063 → 822 px | 2 180 → 1 722 px |
| 390 × 844 px | 949 → 764 px | 1 994 → 1 635 px |
| 1440 × 844 px | 637 → 492 px | 1 001 → 793 px |

Sur ordinateur, les trois boutons tiennent désormais dans la fenêtre de recette de 844 px. Sur mobile, comparer les trois circuits nécessite encore du défilement ; la hauteur de la comparaison seule baisse d’environ 17 à 19 %. Les situations bloquées et les noms longs peuvent prendre plus de place. L’ordre des circuits a changé : ces mesures concernent le panneau complet, pas une équivalence entre les anciennes grandes cartes cliquables et les nouveaux boutons.

Validation locale :

- 34 scénarios navigateur dédiés passent à 320, 390 et 1440 px : montants et quantités issus du calcul existant, ordre de tabulation, destinations de vente, consultation du lot exact, ordinateur manquant, boutique suspendue, qualité refusée, transformation, affinage, biomasse, quotas épuisés, reprise partielle et ancien modèle de vente directe en ligne.
- Une lecture de l’offre serveur ouvre la confirmation avec le versement net ; annuler ne vend rien. Les autres parcours de comparaison ne déclenchent aucune écriture de jeu.
- Les contrôles de navigation du conteneur du jeu passent : stockage du produit résolu, retour au même produit, historique, liens anciens ou invalides et récupération d’un lot manquant. Les destinations externes au Commerce restent simulées dans cette recette.
- Les 28 contrôles du lot 15 passent à nouveau, dont préparation → offre → vente avec le moteur d’essai local. Les 62 tests ciblés sur les offres commerciales, les fiches et la sélection de lots passent également.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Captures ordinateur et mobiles inspectées, sans débordement horizontal ni erreur JavaScript dans la recette dédiée.

Preuves : `output/clarity-lot16/before/report.json`, `output/clarity-lot16/after/report.json`, `output/clarity-lot2/navigation/context-report.json` et `output/clarity-lot15/after/report.json`. Recette dédiée : `scripts/audit-sales-channels-lot16.mjs`. Aperçus : [comparaison à 390 px](../../output/clarity-lot16/after/ready-390.png), [sur ordinateur](../../output/clarity-lot16/after/ready-1440.png), [quotas épuisés à 320 px](../../output/clarity-lot16/after/quota-320.png).

Aucun calcul économique, migration ou compte réel n’a été modifié ; les changements restent locaux, sans déploiement. Les notes de compréhension restent inchangées en l’absence d’essais avec de nouveaux joueurs.

**32. Dix-septième lot : choisir sa quantité et comprendre le versement**

L’offre sélectionnée plaçait une grande illustration et des règles de vente avant le réglage de quantité, lui-même caché dans un volet. Le bouton « Vendre ce lot » demandait en réalité une offre au serveur : aucune vente n’avait encore lieu. Le champ vide signifiait « vendre le maximum », y compris quand le joueur venait d’effacer sa saisie.

La nouvelle feuille rapproche les informations nécessaires à la décision :

- La quantité à vendre est directement visible et préremplie au maximum disponible. Le bouton « Maximum » permet de retrouver cette quantité après une modification.
- L’« Estimation TTC » et son prix au gramme précèdent une barre de répartition, en grammes, entre « À vendre » et « Restera en stock ». Les valeurs restent lisibles sans distinguer les couleurs. Une prime limitée à une partie du lot indique un prix moyen.
- La réserve de TVA et les factures échues sont annoncées avant « Voir le montant net ». Ce bouton ouvre l’offre serveur ; « Confirmer » reste une action distincte dans le dialogue, avec les prélèvements et le versement exact.
- Les refus, la qualité minimale, les risques pour les partenaires et les primes restent visibles. Les répétitions de prix et de prime ont été retirées. L’illustration, le renouvellement des commandes et les barèmes sont consultables sous l’action dans des volets fermés.
- La fiche compacte du lot s’applique aussi à l’offre : variété, produit, quantité, qualité et alertes restent visibles ; les références complémentaires et l’accès au stockage sont dépliables.

La saisie distingue désormais un choix du maximum d’un champ effacé. Une quantité vide, négative, nulle, supérieure aux commandes ou incompatible avec le pas de 0,1 g bloque la consultation de l’offre. Aucune estimation ajustée silencieusement n’est affichée pour cette saisie. Si le quota diminue après actualisation, la valeur tapée est conservée et le joueur doit la corriger. Une actualisation échouée bloque une nouvelle demande d’offre, tout en conservant la possibilité de vérifier une vente dont la réponse a été perdue.

Le retour du focus après annulation capture le bouton avant sa désactivation pendant le calcul asynchrone. Échap ferme la confirmation, rend le focus à « Voir le montant net » et conserve la quantité. Le recalcul d’une offre modifiée et la vérification d’une réponse perdue conservent leurs règles existantes.

Position du bas du bouton de consultation, mesurée depuis le haut du document à stock et fenêtre identiques, avec le vrai conteneur Commerce et sans le HUD général du jeu :

| Fenêtre | Grossistes avant → après | CBD shops avant → après |
| --- | ---: | ---: |
| 320 × 844 px | 1 647 → 1 380 px | 1 877 → 1 461 px |
| 390 × 844 px | 1 528 → 1 308 px | 1 734 → 1 369 px |
| 1440 × 844 px | 1 048 → 935 px | 1 232 → 956 px |

L’action remonte de 220 à 416 px sur les mobiles de recette, avec une quantité éditable sans ouverture préalable. Elle reste sous le premier écran : la navigation, la fiche du lot et les conditions visibles demandent encore du défilement. Ces mesures ne prouvent pas à elles seules une meilleure compréhension par de nouveaux joueurs.

Validation locale :

- 31 contrôles navigateur dédiés passent à 320, 390 et 1440 px : quantités en dixièmes, stock restant, maximum, annulation au clavier, retour du focus, conditions dépliées, refus, affinage, transformation, quotas, saisies invalides, réduction de capacité, échec d’actualisation, échec de calcul puis confirmation d’une seule vente. L’ancien parcours de vente directe en ligne conserve son choix de prix.
- Les 34 contrôles du choix des circuits et les 28 contrôles de préparation passent à nouveau. Les 4 scénarios de récupération de vente passent également : offre modifiée, conservation modifiée, erreur de recalcul et réponse réseau perdue avec réutilisation de la même demande.
- 76 tests ciblés passent sur les quantités, les offres commerciales, la sélection et le résumé des lots. TypeScript global, ESLint ciblé et contrôle de diff passent.
- Captures mobiles et ordinateur inspectées ; aucun débordement horizontal ni erreur JavaScript dans la recette dédiée. Un premier passage a détecté la perte du focus après le calcul asynchrone ; le correctif est couvert par les annulations au clavier des deux circuits et des trois largeurs.

Preuves : `output/clarity-lot17/before/report.json`, `output/clarity-lot17/after/report.json`, `output/clarity-lot16/after/report.json`, `output/clarity-lot15/after/report.json` et `output/placard-commerce-quote-recovery/report.json`. Recette dédiée : `scripts/audit-sale-offer-lot17.mjs`. Aperçus : [offre à 390 px](../../output/clarity-lot17/after/cbd-shop-390.png), [sur ordinateur](../../output/clarity-lot17/after/cbd-shop-1440.png), [quota épuisé à 320 px](../../output/clarity-lot17/after/quota-320.png).

Les transactions de recette utilisent des données simulées localement. Aucun compte réel ni migration n’a été modifié ; aucun déploiement n’a été effectué. Les notes de compréhension restent inchangées jusqu’aux essais avec de nouveaux joueurs.

**33. Dix-huitième lot : agir directement sur la zone de culture**

Le plan devient le point d’entrée des actions d’une zone. Un clic, un appui ou le clavier ouvre trois choix : **Aménager**, **Buddies**, **Supprimer**. La boutique reçoit la zone et calcule les achats nécessaires pour sa surface ; le carrousel affecte le Buddie à cette zone. Les dimensions et les règles d’usure sont repliées. Les cultures en cours restent consultables, mais verrouillent les changements de matériel et de Buddie.

La suppression présente le choix entre conservation en réserve et revente. Le montant de reprise est fourni et vérifié par le serveur avant confirmation. Il suit la règle choisie : 80 % du prix payé à 20 % d’usure, 50 % à mi-usure, puis une baisse jusqu’à zéro. Le matériel conserve son usure lors d’un déplacement ou d’une réutilisation. Les prix historiques inconnus sont signalés ; les appareils concernés restent en réserve. Une réponse perdue se vérifie avec la même demande, sans seconde vente.

Le menu montre aussi l’effet sur le rendement. Chaque nouvelle culture terminée ajoute 5 points d’usure aux équipements utilisés ; la réserve ne s’use pas. Le potentiel lié au matériel est de 75 % à mi-usure et de 50 % en fin d’usure. Les estimations du plan, de l’inspecteur et de la préparation utilisent le même état, figé au lancement. Les résultats des anciennes parties ne changent pas.

L’entraînement conserve une suppression dans le brouillon, avec matériel en réserve et sans revente. Ses objectifs reconnaissent le menu, le devis de la boutique et les fiches du nouveau carrousel.

Les règles et la migration sont détaillées dans [le document Entrepôt](PLACARD-ENTREPOT-V2.md#actions-par-zone-usure-et-occasion--30-octobre-2026). Recettes : `scripts/test-placard-warehouse-condition.mjs`, `scripts/audit-warehouse-zone-actions.mjs` et `output/warehouse-zone-actions/report.json`. Les contrôles couvrent l’inventaire, la comptabilité, les devis périmés, les tentatives concurrentes, les gestes et les petites largeurs. Aucun compte réel utilisé pour les recettes. À la demande du propriétaire, la migration a été appliquée à la base liée le 30 octobre 2026 : permissions, fonctions, historique et accès API vérifiés, sans initialisation de données joueur. Les 349 migrations sont synchronisées. Preuves dans `output/warehouse-condition-migration/`. Le site n’a pas été publié par cette opération.

**34. Dix-neuvième lot : comprendre sa réserve avant d’acheter**

Le suivi d’usure rendait insuffisant un inventaire limité aux quantités : deux appareils du même modèle peuvent maintenant avoir des états différents. Le bilan de l’entrepôt utilisait aussi le brouillon pour présenter « ce que tu possèdes ». Enfin, la boutique affichait d’abord le tarif neuf complet, même quand la réserve évitait cet achat.

- **Ma réserve** donne un accès direct au registre existant, avec déplacement du focus. Les modèles, quantités et groupes d’usure sont immédiatement lisibles ; les graphiques passent dans des volets secondaires. Appareils et modules en m² restent distincts.
- **Ma réserve actuelle** provient du plan enregistré. Modifier le devis ne change pas ce matériel possédé. **Après installation du plan** est une projection séparée et repliée ; un devis invalide affiche une explication au lieu de reprendre les quantités actuelles comme résultat futur.
- Dans la boutique, chaque modèle distingue le matériel **conservé sur place**, **réutilisé** et **à acheter neuf** pour la zone. Le montant mis en avant concerne les achats neufs de ce modèle affectés à cette zone, hors pose. Le prix catalogue complet reste consultable en référence.
- Le volet d’état détaille les quantités à chaque niveau d’usure. Le réemploi tient compte des autres zones modifiées dans le même plan, sans attribuer à tort tout matériel réutilisé à la réserve actuelle. Le devis final conserve les achats du plan entier, la pose, la préparation et les crédits éventuels.
- L’absence de suivi affiche une usure inconnue. Elle ne devient pas une promesse de matériel neuf. La consultation, la comparaison et l’annulation du brouillon ne déclenchent pas d’achat.

Les règles d’allocation, d’usure, de rendement et de revente restent celles du lot précédent. Aucune réparation ni gestion manuelle des appareils n’est ajoutée.

Validation locale :

- 17 scénarios navigateur dédiés passent : réserve et navigation clavier à 320, 390 et 1440 px, groupes d’usure 20/80 %, modules en m², suivi absent, réemploi complet et partiel, brouillon, annulation, plan invalide et culture active. Les deux sauvegardes simulées vérifient la mise à jour de la réserve et la conservation de l’usure : aucun achat dans le premier cas, un appareil à 329 € hors pose et 378,35 € au total dans le second.
- Les 22 scénarios du menu des zones passent à nouveau, dont boutique ciblée, Buddies, suppression, revente, reprise après réponse perdue et progression de l’entraînement.
- 72 tests ciblés passent sur sept fichiers : devis, usure, réserve, réemploi, modules, ciblage boutique et brouillons. Les cas de réemploi couvrent aussi plusieurs zones concurrentes dans le devis et la division d’un groupe de modules, sans modification des données d’origine.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Captures mobile et ordinateur inspectées ; aucun débordement horizontal ni erreur navigateur dans la recette dédiée. Le contrôle TypeScript porte sur l’application ; aucune compilation de production n’a été lancée pour ce lot.

Preuves : `output/clarity-lot19/report.json`, `output/warehouse-zone-actions/report.json` et `scripts/audit-warehouse-reserve-lot19.mjs`. Aperçus : [réserve à 320 px](../../output/clarity-lot19/reserve-320.png), [réserve sur ordinateur](../../output/clarity-lot19/reserve-1440.png), [achat partiel](../../output/clarity-lot19/shop-partial-main.png). Les composants réels utilisent des réponses API simulées localement ; les captures n’incluent pas l’en-tête général du jeu. Aucun compte réel, migration ni déploiement n’a été modifié pour ce lot. Les notes de compréhension restent inchangées jusqu’aux essais avec de nouveaux joueurs.

**35. Vingtième lot : comprendre le devis de tout le plan**

Après la clarification de la boutique, l’installation conservait des présentations dispersées : un simple montant sous le plan, le tarif neuf d’une zone mêlé aux dépenses globales dans l’éditeur, et une sauvegarde depuis Buddies pouvant aussi installer le matériel choisi ailleurs. Un devis invalide pouvait afficher zéro euro dans certains récapitulatifs.

Le récapitulatif commun **Devis du plan** réunit maintenant le montant **À payer maintenant**, la **Trésorerie après** et le nombre de zones concernées. Son volet détaille les zones ajoutées, modifiées ou retirées, les achats neufs, l’aménagement, la pose et le crédit de reprise. Les lignes viennent du devis existant ; les charges de culture et de climatisation restent annoncées séparément.

Dans la boutique, **Voir le devis** ramène à ce récapitulatif avec le focus, sans installation. Le montant du pied de boutique correspond au devis du plan entier, crédit déduit. Les commandes d’enregistrement restent à côté du même récapitulatif dans le plan, le dialogue Buddies, l’éditeur de dimensions et la garde de sortie. Les références tarifaires de la seule zone restent dans un volet nommé explicitement.

**Annuler les modifications du plan** annonce son périmètre global. Fermer une boutique ou un dialogue conserve le brouillon. Un devis indisponible affiche **À calculer** et bloque l’installation ; une vraie installation gratuite garde son montant nul. Si la trésorerie manque, le montant manquant est indiqué près de l’action. Le crédit utilisé est visible avant ouverture du détail.

Les dialogues utilisent le corps défilable pour garder coût, détail et action accessibles sur les petites hauteurs. Après l’enregistrement depuis Buddies, le focus revient à « Retour aux actions de la zone » lorsque le bouton d’enregistrement disparaît ; la confirmation reste annoncée. Le détail conserve le marqueur de progression de La Relève.

Validation locale :

- 17 scénarios navigateur dédiés passent : 320, 390 et 1440 px, clavier et petite hauteur, retour depuis la boutique, deux zones dont un changement de Buddie, annulation globale, réemploi complet et partiel, crédits partiel et total, fonds insuffisants et devis invalide. Les dialogues Buddies et dimensions présentent le même montant que le plan.
- Les installations simulées vérifient le coût brut envoyé, le crédit consommé, le débit net et une seule requête par action. La sauvegarde depuis Buddies couvre aussi le retour du focus et la tabulation suivante dans le dialogue. Le premier essai a détecté la disparition du focus ; sa restauration intervient désormais après la mise à jour du dialogue.
- Les 22 scénarios des actions par zone passent à nouveau, dont la revente, la reprise après réponse perdue et la progression de l’entraînement. Les 84 tests ciblés passent sur huit fichiers : devis, présentation des modifications, crédits, réserve, usure, réemploi, modules, ciblage et brouillons.
- TypeScript global, ESLint ciblé et contrôle de diff passent. Les captures mobile et ordinateur sont inspectées ; aucun débordement horizontal ni erreur navigateur dans la recette dédiée.

Preuves : `scripts/audit-warehouse-plan-lot20.mjs`, `output/clarity-lot20/report.json` et `output/warehouse-zone-actions/report.json`. Aperçus : [devis à 320 px](../../output/clarity-lot20/plan-320.png), [sur ordinateur](../../output/clarity-lot20/plan-1440.png), [détail depuis Buddies](../../output/clarity-lot20/buddies-plan-320.png). Les recettes utilisent les composants réels et des réponses API locales simulées, sans l’en-tête général du jeu. Aucune migration, transaction sur compte réel ou publication n’a été effectuée pour ce lot. Les notes de compréhension restent inchangées en attendant les essais avec des joueurs.

**36. Vingt-et-unième lot : savoir ce qu’on lance et quand on paiera**

La préparation parlait de cultures, puis sa confirmation introduisait une « campagne » sans rappeler ses participants. Le budget regroupait les charges, mais l’échéance des consommables restait dans un volet et celle de l’électricité manquait dans cette version du panneau. Un rafraîchissement conservait également un devis précédent utilisable pour confirmer.

- **Lancer mes cultures ?** reprend le vocabulaire de la préparation. Le nombre de Buddies et la surface précèdent le budget. Le volet **Buddies et zones** permet de vérifier chaque variété, son emplacement et sa surface ; il explique que ces affectations et l’équipement sont figés au lancement. Les projections détaillées ne sont pas répétées.
- Les **Charges prévues** montrent le total et deux lignes avec leurs montants : **électricité facturée à la récolte**, **consommables à régler sous cinq jours réels après le lancement**. Les montants proviennent de la réponse serveur. Le graphique est conservé dans **Répartition des charges**, avec l’explication des soins supplémentaires.
- Un devis en cours de lecture, en erreur ou incomplet bloque le lancement. L’ancien total disparaît pendant l’actualisation ; une donnée absente ou nulle ne devient pas un prix zéro. Un vrai devis gratuit reste valide. Chaque ouverture demande une nouvelle vérification. Les charges d’une culture déjà lancée restent issues de ses données enregistrées.
- Les cartes non consommées au départ, le sol vivant inclus et les six heures réelles d’affinage avant jury et vente restent visibles. Le détail des cartes se replie. Les boutons, les chiffres et les volets restent accessibles à 320 px et au clavier ; les échéances et actions se consultent par défilement sur les petites hauteurs.

La revue technique a aussi détecté un risque de périmètre : une affectation modifiée dans un autre onglet pouvait conserver le même prix électrique. Le lancement transmet désormais la révision du plan présenté. Le serveur refuse un plan différent avant création, y compris si seul un autre Buddie a changé. **Actualiser la préparation** relit les affectations après une erreur. La recherche préalable du reçu conserve les reprises après réponse perdue ; la validation SQL existante protège les changements entre lecture et écriture. Les anciennes requêtes sans cette précondition restent compatibles.

Les échéances ont été vérifiées dans les migrations existantes : facture fournisseur créée au lancement avec échéance à 120 heures, sans débit initial des consommables ; facture électrique à la récolte. Aucune règle économique ou migration n’est ajoutée.

Validation locale : 140 tests ciblés passent sur neuf fichiers, dont les nouvelles gardes de révision et les reprises idempotentes. TypeScript global, ESLint ciblé et contrôle de diff passent. Les 18 scénarios navigateur dédiés couvrent un et deux Buddies à 320, 390 et 1440 px, une hauteur de 422 px, les volets et le focus au clavier, les devis inconnus ou incomplets, l’actualisation après un montant connu, la réouverture, un vrai zéro, la relance après erreur et le retour à une préparation actualisée. Aucune erreur JavaScript ni requête externe ; les captures finales ont été inspectées. Les 12 scénarios de préparation du lot 8 et les 15 contrôles de campagne partagée passent également, dont le lancement après réponse perdue et le parcours jusqu’aux deux récoltes.

Recette dédiée : `scripts/audit-culture-launch-lot21.mjs`, rapport `output/clarity-lot21/report.json`. Elle contrôle les composants réels avec des réponses API locales simulées, dont des prix volontairement différents du calcul local. Aperçus : [confirmation à 320 px](../../output/clarity-lot21/launch-2-320.png), [sur ordinateur](../../output/clarity-lot21/launch-2-1440.png), [écran court](../../output/clarity-lot21/launch-2-320-short.png). Aucun compte réel, aucune migration ni publication n’ont été modifiés. Les notes de compréhension restent inchangées jusqu’aux essais avec de nouveaux joueurs.

**37. Vingt-deuxième lot : trouver un produit de soin sans parcourir tout le catalogue**

La réserve ouvrait systématiquement les quatre intrants du sol, même face à des pucerons et avec un auxiliaire déjà possédé. Les protections biologiques restaient dans un autre rayon. Au chargement et après certaines erreurs de lecture, l’interface pouvait afficher « 0 en réserve » sans avoir vérifié le stock. Les cartes de produits superposaient illustration, explication, prix, achat et utilisation en petits caractères.

- **Produits de soin** est accessible avant l’entretien général. La réserve ouvre **Pour cette culture**, qui regroupe les produits dont les cibles correspondent aux problèmes observés. Les rayons **Intrants du sol vivant** et **Protection biologique** restent accessibles pour consulter tout le catalogue. La boutique ouverte hors culture conserve ses deux rayons.
- La correspondance d’une cible n’est pas une promesse d’efficacité ou une autorisation d’utiliser le produit. Les raisons de refus restent visibles : chaleur, cible déjà suivie, fenêtre d’intervention dépassée et limites d’apports. Une culture sans problème affiche un état explicite, sans inventer un besoin de soin.
- Le registre met le **stock**, l’action **Utiliser · 1 charge** et le **prix pour acheter une charge** avant les explications repliées. Les illustrations sont conservées en format compact. Les lignes sont séparées par des traits d’encre ; les commandes gardent les panneaux illustrés. Les textes utiles passent à au moins 13 px et les deux rayons secondaires partagent une rangée sur petit écran.
- **Acheter** ajoute une charge ; **Utiliser** consomme une charge possédée. L’achat ne déclenche aucune intervention. Les effets restent évalués lors des bilans. Le catalogue tarifé du serveur fournit les prix ; un tarif absent reste indisponible, sans recours silencieux à un prix local.
- Une réserve en cours de lecture, incomplète ou en erreur affiche **À vérifier**. **Actualiser la réserve** permet de récupérer les données. Les nouveaux achats et utilisations restent bloqués tant que leurs données ne sont pas connues ; les vérifications de demandes déjà envoyées restent possibles pour récupérer leur reçu.

La reprise d’un achat interrompu conserve sa clé par produit pendant l’ouverture de la réserve. Elle peut donc retrouver un achat déjà débité même si la trésorerie ne suffit plus pour un nouvel achat. La reprise d’une intervention conserve la demande du suivi et peut retrouver la dernière charge déjà consommée. Une intervention confirmée suivie d’un échec de lecture du stock garde son succès, avec une réserve à actualiser. Cette protection ne promet pas une reprise après fermeture ou rechargement de la réserve.

Une ancienne phrase du bilan de santé annonçait encore l’affinage après le jury. Elle indique maintenant l’affinage avant le jury et la vente, conformément au parcours déjà établi. Les règles de soin, leurs coûts, leurs effets et les migrations restent inchangés.

Validation : 142 tests ciblés passent sur six fichiers, dont 32 nouveaux cas sur le ciblage et la distinction entre données inconnues, vrais zéros et tarifs serveur. TypeScript global, ESLint ciblé et contrôle de diff passent. Les 26 contrôles de la recette navigateur dédiée passent à 320, 390 et 1440 px : navigation clavier, restrictions, données manquantes, actualisations, achats séparés des interventions, reprise après réponse perdue et accès aux produits avant l’entretien général. Les 74 contrôles historiques des soins passent également. Les deux scripts se terminent normalement, sans erreur navigateur, débordement horizontal ni requête externe. Les composants réels sont utilisés avec un serveur de jeu simulé localement.

Dans la scène de recette avec des pucerons et deux charges d’Aphidius déjà possédées, le premier bouton d’utilisation disponible se trouve à y = 516 px sur une fenêtre de 320 px de large, 471 px à 390 px et 267 px à 1440 px. Avant ce lot, aucun produit utilisable n’apparaissait dans le rayon ouvert par défaut : il fallait changer de rayon. Les listes demandent encore du défilement ; cette mesure de scène isolée ne démontre pas à elle seule une meilleure compréhension du jeu.

Preuves : `scripts/audit-care-reserve-lot22.mjs`, `output/clarity-lot22/before/report.json`, `output/clarity-lot22/after/report.json` et `output/culture-care/result.json`. Aperçus : [réserve à 320 px](../../output/clarity-lot22/after/reserve-320.png), [sur ordinateur](../../output/clarity-lot22/after/reserve-1440.png), [suivi complet](../../output/clarity-lot22/after/integrated-390.png). La comparaison porte sur des scènes locales, sans l’en-tête général du jeu. Aucun compte réel, aucune migration ni publication n’ont été modifiés. Les notes de compréhension restent inchangées en attendant des essais avec de nouveaux joueurs.

**38. Vingt-troisième lot : comprendre une carte avant de la dépenser**

La confirmation empilait « Consulter une carte », « Jouer une carte » et « Brûler [nom] ? », puis les copies, le coût, la comparaison et deux blocs d’explications. Dans la scène testée, le bouton de confirmation se trouvait hors du premier écran aux trois largeurs examinées, y compris sur ordinateur. Ce lot porte sur la décision après ouverture d’une carte ; l’accès à la main et ses filtres, simplifiés au lot 8, restent en place.

- Le **nom de la carte** devient le seul titre d’identification. Son effet et sa limite restent visibles ; les règles, situations adaptées, valeurs de qualité, XP et pression sont repliables. Les volets disposent de chevrons visibles sur mobile et de cibles d’au moins 44 px.
- Le **coût en XP**, la **copie détruite**, les XP disponibles et le nombre de copies dans l’album accompagnent **Jouer la carte** dans le bas fixe du dialogue. Déplier les règles ou faire défiler la comparaison ne déplace plus les commandes hors de l’écran.
- La comparaison **Sans la carte / Avec la carte** reste conditionnelle à la validation avec les dés et soins affichés. La santé utilise deux jauges sur une même échelle **0–100**. Une valeur de 15/100 ne peut plus remplir une barre simplement parce qu’elle est la meilleure des deux. Les pertes, secours et déclenchements d’Héritage restent indiqués ; aucun résultat futur n’est révélé pour une préparation ou une relance aléatoire.
- Les raisons de refus restent visibles et associées au bouton désactivé. Une ancienne notification est effacée à l’ouverture d’une nouvelle consultation. Pendant l’envoi, **Fermer** remplace **Annuler**, avec un message précisant que la fermeture n’annule pas la demande. Une erreur reste accessible près des commandes, y compris au clavier lorsqu’elle doit défiler.

Le dialogue utilise son propre composant et ses propres styles, sans modifier les confirmations du jury. Il conserve les panneaux et commandes illustrés, le focus au clavier et l’échelle typographique lisible. Les permissions, coûts, effets du moteur et appels de consommation restent inchangés. Consulter, déplier ou annuler ne joue aucune carte.

Limite existante identifiée à la relecture : ce lot n’ajoute pas de récupération automatique d’un reçu après perte d’une réponse réseau. Le bouton bloqué pendant l’envoi évite un deuxième clic concurrent ; cela ne constitue pas une garantie de reprise après interruption. Aucune consommation n’est renvoyée automatiquement. La vérification explicite après interruption est traitée au lot 24 ci-dessous.

La documentation de culture a également été alignée sur le parcours déjà établi : séchage, affinage, puis jury. Une ancienne phrase plaçait encore le curing après le verdict.

Validation : **163 tests** passent sur quatre fichiers couvrant le moteur, les prévisions de carte et de tour, ainsi que les permissions et retours au joueur. TypeScript global, ESLint ciblé et contrôle du diff passent. Les **23 scénarios navigateur dédiés** et les **15 scénarios historiques des cartes** passent également : états bloqués, aléatoire, résultat défavorable, assistance pédagogique, navigation clavier, annulation tactile, retour du focus, consommation unique, fermeture pendant l’envoi et refus serveur. Les scènes utilisent les composants réels et le moteur du jeu, avec une API ou un dépôt simulés localement ; aucun compte réel n’est sollicité.

À 320 × 844, 390 × 844 et 1440 × 900, la confirmation auparavant hors vue devient visible dès l’ouverture. À **320 × 422**, coût et commandes restent accessibles même avec un nom long et une longue erreur ; cette dernière se parcourt au clavier. Les explications nécessitent toujours du défilement sur cette faible hauteur. Ces observations de présentation ne démontrent pas à elles seules une meilleure compréhension par de nouveaux joueurs ; les notes de l’audit restent inchangées.

Preuves : `scripts/audit-card-choice-lot23.mjs`, `output/clarity-lot23/before/report.json`, `output/clarity-lot23/after/report.json` et `output/placard-card-decisions/report.json`. Aperçus : [carte à 320 px](../../output/clarity-lot23/after/reaction-320x844.png), [sur ordinateur](../../output/clarity-lot23/after/reaction-1440x900.png), [écran court avec erreur](../../output/clarity-lot23/after/server-error-long-title-320x422.png). Les recettes se terminent sans erreur navigateur, débordement horizontal ni requête externe. Aucune migration ni publication n’a été effectuée.

**39. Vingt-quatrième lot : reprendre après une confirmation de carte perdue**

Le contrôle initial reproduit une ambiguïté : une carte est consommée côté serveur, mais sa réponse est perdue. L’écran conserve alors trois copies au lieu des deux restantes, permet une nouvelle confirmation et laisse continuer la culture après fermeture de la fenêtre. Un joueur ne peut pas savoir si son action a réussi.

- **Vérifier ma culture** remplace le bouton de jeu quand la confirmation est incertaine. Le dialogue annonce que cette vérification ne dépense ni carte ni XP. Les anciennes valeurs sont signalées comme étant à vérifier et la comparaison d’effets est suspendue.
- Fermer la fenêtre conserve un panneau **Carte à vérifier** dans la culture. Le focus et le défilement ramènent à ce panneau, y compris après la restauration de position par l’historique du navigateur. Continuer l’étape, changer la main, échanger une carte ou appliquer un soin attend la vérification.
- La vérification relit la culture concernée, l’album, puis la même culture. Elle exige deux états et reçus concordants et un inventaire complet. Les valeurs vérifiées remplacent les anciennes ; aucune copie supplémentaire n’est soustraite et aucune consommation n’est renvoyée.
- Un reçu retrouvé confirme **Carte déjà jouée**. Sans reçu correspondant, le message annonce uniquement cette absence et invite à consulter les cartes avant de décider. Une erreur, un inventaire incomplet, une autre culture ou un état ayant changé pendant la lecture maintiennent le blocage et permettent de vérifier à nouveau.
- Une confirmation normale attend désormais la fin du chargement de l’album. Une nouvelle demande précise l’étape à laquelle la carte est jouée : le serveur refuse une demande retardée arrivée à une étape ultérieure, puis conserve son contrôle transactionnel de version existant. Les coûts, effets et limites de cartes restent inchangés.

Les verrous synchrones empêchent deux envois ou vérifications concurrents dans cet écran. Les réponses anciennes ne remplacent pas le résultat d’une reprise plus récente ou d’une autre culture. Joueur et administrateur utilisent la même validation, malgré leurs deux formats de réponse d’album. Une culture terminée ailleurs est retirée des cultures actives ; ses récoltes sont relues pour présenter le bilan actuel.

La reprise ne constitue pas une nouvelle transaction d’idempotence en base. L’absence de reçu lors d’une lecture n’est pas la preuve qu’une demande a été annulée. Le verrou de reprise reste local au composant ; un rechargement complet utilise la lecture normale du serveur. Le lot n’ajoute aucune migration ni relance automatique de consommation.

Validation locale : **215 tests ciblés sur huit fichiers** passent, couvrant récupération, réponses incomplètes, format admin, confirmation, étape périmée, concurrence transactionnelle existante, aperçu et retours joueur. TypeScript global, ESLint ciblé et contrôle de diff passent. La recette de reprise contrôle les composants réels et le moteur avec une API locale simulée, sans compte réel : réponse perdue, refus avant consommation, fermeture et réouverture, double clic, lecture lente ou en erreur, inventaire incomplet, mauvaise culture, état divergent et actualisation de l’album pendant le choix.

Les **16 scénarios navigateur dédiés** passent, dont la culture achevée dans un autre onglet avant vérification. Les **23 contrôles de confirmation du lot 23** et les **15 contrôles historiques de décisions** passent aussi : **54 contrôles au total**, sans erreur navigateur ni requête externe. La recette historique attend désormais les deux frames du retour de focus avant son assertion ; ses exigences de comportement sont conservées.

Les captures sont inspectées à 320, 390 et 1440 px, ainsi qu’à **320 × 422**. Le bouton de vérification reste visible dans le dialogue et après sa fermeture, avec une cible d’au moins 44 px dans le dialogue. La recette contrôle aussi le clavier, le toucher, le retour du focus et l’absence de débordement. Une confirmation reçue normalement n’ajoute aucune étape de vérification au joueur. Les notes de compréhension restent inchangées en attendant les essais avec de nouveaux joueurs.

Preuves : `scripts/audit-card-recovery-lot24.mjs`, `output/clarity-lot24/before/report.json`, `output/clarity-lot24/after/report.json` (15 scénarios) et `output/clarity-lot24/after/completed-report.json` (culture achevée ailleurs). Aperçus : [reprise sur écran court](../../output/clarity-lot24/after/lost-response-320x422.png), [après fermeture](../../output/clarity-lot24/after/closed-recovery-320.png), [culture vérifiée](../../output/clarity-lot24/after/recovered-390.png). Les changements restent locaux, sans publication.

**40. Vingt-cinquième lot : lire son bilan de récolte avant ses détails**

Après le résultat et le bouton de rangement, le bilan solo affichait encore un long panneau ouvert : cartes consommées et conservées, charges, récit, santé, calculs de qualité et de rendement, journal des six étapes, traits et carte Fleur. L’affinage y était expliqué une deuxième fois. Dans une campagne, les taux chimiques et les notes aromatiques occupaient chaque fiche avant le lien vers le lot.

- **Le résultat passe en premier.** Le panneau de récolte présente les grammes et les points de qualité de culture avant le paragraphe explicatif. Le bouton de rangement garde sa destination exacte et le délai d’affinage reste annoncé. Les unités ne confondent plus qualité de culture et note du jury sur 10.
- **Le bilan solo se consulte à la demande.** Trois volets fermés réunissent **Journal et cartes**, **Charges et factures** et **Ma Fleur d’Arène**. Le journal conserve le récit, les copies, la santé et le bulletin ; la carte conserve ses traits. Les contrats, primes et erreurs associées restent visibles en dehors de ces volets. Une seule phrase distingue la Fleur consommée au jury du stock conservé pour la vente.
- **Les résultats par variété sont plus lisibles.** Le registre de campagne donne la variété, la zone, les grammes, les points de qualité et le lien existant vers la suite du lot. Taux, notes aromatiques, palier et analyse restent dans **Profil et détails**. Les lignes utilisent de simples séparateurs ; les profils et journaux ont des commandes accessibles au clavier et des libellés lisibles sur mobile.
- **Une donnée absente ne devient pas un résultat.** Le résumé de campagne reprend les résultats du même helper que le panneau principal. Une quantité historique illisible reste inconnue ; un zéro réel reste zéro. La reconstruction existante des résultats de campagne à partir du journal ne change pas. En solo, une quantité nulle ou inconnue ne produit ni bulletin de récolte recalculé ni carte Fleur. La carte affichée provient de la Fleur officielle de cette culture précise ; en son absence, le volet indique **Fleur à confirmer**.
- **Le bulletin précise sa portée.** Les points portent leur unité et le nombre d’étapes correspond au journal disponible. Dans une campagne, le calcul de la variété meneuse nomme cette variété et sa zone ; il ne doit pas être lu comme la somme des autres récoltes.

Mesures du même scénario avant/après, composants réels avec données locales simulées : à **320 px**, le bilan solo passe de **5 633 à 955 px** de hauteur initiale. Le panneau des deux variétés passe de **891,5 à 630,5 px** ; la page campagne complète passe de **1 733 à 1 501 px**. Sur ordinateur, le panneau campagne reste d’une hauteur comparable. Ce sont des mesures de présentation, sans démonstration de compréhension ou de satisfaction par de nouveaux joueurs. Aucun détail n’est supprimé pour obtenir cette réduction : il reste accessible dans les volets appropriés, lorsqu’il correspond à des données connues.

Validation locale : **38 tests ciblés** passent sur les résultats de récolte, les campagnes et les paliers. **23 contrôles navigateur dédiés** couvrent 320, 390 et 1440 px, une hauteur de 422 px, le clavier et le focus, les quantités et qualités, le bon identifiant de stockage, les profils repliés, les récoltes nulles ou inconnues, les cultures mortes, la qualité officielle et l’absence de Fleur correspondante. Les **15 contrôles historiques de campagne** passent également, du lancement jusqu’aux deux récoltes, avec réponse perdue et rechargement. TypeScript global, ESLint ciblé et contrôle de diff passent.

Les **30 scénarios historiques des moments de jeu** passent aussi, soit **68 contrôles navigateur au total**. Deux attentes anciennes de cette recette ont été alignées sur le comportement existant : le libellé « Fleur d’Arène » et les trois notifications d’actualisation d’une mission confirmée après fermeture. L’absence de reçu, d’animation et de son après fermeture reste vérifiée ; le contrat garde l’exigence d’absence de notification. Rapport : `output/placard-game-moments/report.json`.

La recette dédiée ne produit aucune écriture, erreur JavaScript ni requête externe. À 320 × 422, le bouton de rangement reste accessible par défilement ; sa visibilité immédiate dans cette faible hauteur n’est pas revendiquée. Les captures mobiles et ordinateur ont été inspectées. Préparation, projections pendant la culture, calculs, prix, destinations des liens et règles de consommation restent inchangés. Aucune migration ni publication n’a été effectuée. Les notes de l’audit restent inchangées en attendant des essais avec de nouveaux joueurs.

Preuves : `scripts/audit-harvest-summary-lot25.mjs`, `output/clarity-lot25/before/report.json`, `output/clarity-lot25/after/report.json` et `output/placard-shared-campaigns/report.json`. Aperçus : [bilan solo à 320 px](../../output/clarity-lot25/after/solo-320.png), [résultats par variété](../../output/clarity-lot25/after/campaign-320.png), [campagne sur ordinateur](../../output/clarity-lot25/after/campaign-1440.png).

Suite repérée lors de ce lot, traitée au lot 26 ci-dessous : **Main prévoyante** proposait encore des échanges après une préparation, alors que le moteur les refusait ; **Changer ma main** retirait aussi sa réserve d’échange sans l’annoncer clairement.

**41. Vingt-sixième lot : ajuster sa main en comprenant chaque décision**

Le contrôle initial reproduit les deux ambiguïtés : les cartes à échanger restent actives après une préparation jouée, et la nouvelle pioche ne prévient pas de la disparition de la réserve. Sur téléphone, les listes de la main et de la réserve s’empilent dans un long encart ; sur ordinateur, le choix à retirer disparaît derrière l’autre onglet. Les noms seuls ne permettent pas de comparer les effets.

- **Ajuster ma main** regroupe ces décisions dans un volet replié. Son résumé conserve le nombre de changements disponibles **pour cette culture** et le nombre de cartes en réserve. La consultation et le jeu des cartes restent dans la main principale.
- **Main prévoyante** suit un choix progressif : carte à retirer, carte à faire entrer, puis récapitulatif et **Échanger**. Le nom sortant reste visible pendant le choix entrant. Sélectionner ou consulter ne déclenche aucune écriture. Les effets sont lisibles ; situations, limites et coût pour jouer la carte sont consultables dans ses détails. L’échange lui-même affiche **0 XP · aucune copie brûlée**.
- **Repiocher toute ma main** distingue le quota de culture des étapes. Le tirage reste aléatoire et peut reprendre certaines cartes ; il ne garantit pas une carte immédiatement jouable. Si une réserve existe, son retrait est annoncé avec sa quantité et demande une confirmation dans le volet. Les copies de l’album restent conservées. Sans réserve, aucune confirmation supplémentaire n’est ajoutée.
- **Les disponibilités viennent du moteur.** Une permission commune à l’interface et à la mutation d’échange donne la raison du refus, notamment après une préparation. Un échange n’exige pas que la carte entrante soit immédiatement jouable. Les positions de deux copies identiques restent distinctes et leur échange légal annonce une main identique. Le nombre de changements, les XP, les copies et les règles de l’Héritage ne changent pas.
- **Les choix suivent l’état de la culture.** Une modification de la main, de la phase, une préparation, un lancer, une reprise ou un changement de culture invalident la sélection. Le chargement initial et les confirmations en cours suspendent les commandes. Un verrou synchrone empêche deux échanges concurrents dans cet écran, qui pourraient autrement s’inverser. Les erreurs et les résultats se lisent dans le volet ; le focus suit les étapes, le récapitulatif et le résultat.

La présentation conserve les commandes et feuilles illustrées du jeu. Les anciennes listes violettes et leurs styles devenus inutilisés sont retirés. Le fond jaune plein de la main devient une feuille papier ; **Rôle des cartes** retrouve un texte d’encre contrasté. Les effets et détails des choix utilisent une police de lecture, sans majuscules imposées. Les registres peuvent défiler et les détails restent consultables, y compris les cartes de réserve quand l’échange est bloqué ; aucune nouvelle règle économique, migration ou publication n’est introduite.

La protection contre deux clics simultanés n’est pas une garantie d’idempotence réseau. L’API existante reçoit les indices de cartes et conserve son contrôle transactionnel : elle ne vérifie pas une empreinte de la main vue dans un autre onglet avant sa lecture serveur. Une réponse d’échange ou de nouvelle pioche perdue peut rester ambiguë ; ce lot n’ajoute aucun renvoi automatique de la demande. Les garanties de reprise des cartes consommées au lot 24 restent distinctes.

Validation métier : **167 tests** passent sur le moteur, le backend existant et les ajustements de main, dont **33 nouveaux cas** sur les permissions, permutations, doublons, héritages dynamiques, indices invalides, conservation des ressources, retrait de la réserve et quota conservé entre les étapes.

Les **21 scénarios navigateur dédiés** passent : choix progressifs, consultation sans écriture, confirmation et annulation de nouvelle pioche, limite de culture y compris après avancement, trois changements avec l’Héritage approprié, doublons, double clic synchrone, attente serveur, lancer en cours, confirmation de carte incertaine et refus serveur. Les **15 contrôles historiques de reprise du lot 24** passent sans modifier leurs assertions : **36 contrôles navigateur** au total, sans erreur JavaScript, erreur console ni appel externe. Les scènes emploient le composant joueur réel et le moteur, avec une API locale simulée ; elles ne touchent aucun compte réel. TypeScript global, ESLint ciblé et contrôle de diff passent.

Le volet fermé mesure **85,4 px à 320 et 390 px**, et **67,3 px à 1440 px** dans la scène de recette. L’ancienne hauteur n’a pas été enregistrée : aucun ratio avant/après n’est revendiqué. Ces contrôles vérifient les interactions et la présentation ; les notes de compréhension restent inchangées en attendant des essais avec de nouveaux joueurs.

La revue visuelle a permis de corriger deux problèmes supplémentaires : les confirmations pouvaient défiler sous la barre fixe sur écran court, et le focus du résultat pouvait arriver avant son affichage par React. Le défilement aligne désormais le bloc utile en haut de l’écran et le message reçoit le focus après affichage. Une dernière passe de **8 scénarios de capture**, sous-ensemble des scénarios dédiés, passe sur les fichiers finaux. À **320 × 422**, le bouton **Échanger** occupe y = 166–210 px et celui de confirmation de pioche y = 121–165 px ; la barre fixe commence à y = 279 px. Les deux commandes de 44 px reçoivent bien les interactions. Le récapitulatif, les coûts d’échange et l’avertissement restent lisibles. Les captures à 320, 390 et 1440 px ont été inspectées.

Preuves : `scripts/audit-hand-adjustment-lot26.mjs`, `output/clarity-lot26/before/report.json`, `output/clarity-lot26/after/report.json`, `output/clarity-lot26/after/visual-report.json` et `output/clarity-lot24/after/report.json`. Aperçus : [échange sur écran court](../../output/clarity-lot26/after/swap-choice-320x422.png), [confirmation de pioche](../../output/clarity-lot26/after/redraw-warning-320x422.png), [choix sur ordinateur](../../output/clarity-lot26/after/swap-choice-1440x900.png). Les changements restent locaux, sans publication.

**42. Vingt-septième lot : comprendre son prêt avant le marché bancaire**

Le guichet présentait la situation du marché, la réputation, le taux courant et la durée d’un futur prêt avant le contrat déjà signé. Le remboursement arrivait après un grand échéancier. L’offre demandait aussi de traverser plusieurs graphiques avant son bouton ; la confirmation ouvrait les sept lignes du calendrier avant ses commandes. Ces présentations mélangeaient le suivi d’une dette existante et la découverte d’une nouvelle offre.

- **Mon prêt passe en premier.** Le dossier donne le restant dû, la trésorerie, la première échéance incomplètement réglée, son reliquat et sa date réelle. Une échéance passée porte « Échéance à régulariser » ; le retard total fourni par le serveur reste distinct de cette seule ligne. La dernière date du contrat ne devient jamais la prochaine échéance. Le taux signé est visible et reste indépendant du marché.
- **Solder reste une décision explicite.** Le bouton porte le montant à débiter. Les fonds manquants ou le solde estimé après remboursement l’accompagnent. Les intérêts convenus restent dus, sans frais supplémentaires. La progression du remboursement demeure visible ; le graphique interactif et les sept lignes passent dans **Échéancier et contrat**. Les rattrapages sont décrits comme effectués pendant le jeu, sans promettre un prélèvement hors connexion à la seconde exacte.
- **Emprunter commence par les montants.** Plafond autorisé, trésorerie, saisie, intérêts fixes, total et sept prélèvements précèdent **Examiner le contrat**. Le délai réel est prioritaire : cinq jours entre prélèvements, premier prélèvement cinq jours après signature, durée totale de trente-cinq jours. Curseur et montants rapides, répartition, graphique du crédit, marché et règles restent accessibles dans des volets fermés.
- **Un dossier bloqué explique la condition.** Les points manquants ou la date d’ancienneté sont affichés lorsqu’ils sont connus. Sans date, le texte explique le prérequis sans en inventer une. Les données bancaires restent validées avant affichage ; une réponse incomplète ne produit pas de montants nuls.
- **La confirmation garde le coût près des commandes.** Le dialogue natif conserve le comportement de fermeture et présente un corps défilant avec un pied fixe. Capital, intérêts et total restent consultables ; le pied rappelle l’engagement chiffré. Le calendrier complet est replié. Retour et confirmation restent accessibles sur écran court, avec boucle clavier et retour du focus. Les erreurs reçoivent le focus et peuvent défiler.
- **Une demande interrompue se vérifie.** La clé d’idempotence existante est conservée pour réessayer le même contrat. Le bouton devient **Vérifier le prêt** ou **Vérifier le remboursement**. La vérification d’un remboursement reste possible si une actualisation montre une trésorerie déjà débitée ; l’estimation d’un second débit est alors masquée. Une nouvelle opération demeure soumise à ses conditions. Aucune nouvelle règle bancaire ni transaction en base n’est ajoutée.

Les panneaux restent en papier illustré, les contrôles utilisent leurs enseignes et les informations utiles gagnent une taille lisible. Les sections internes emploient des séparateurs simples. Les boutons bloqués ont aussi été vérifiés dans le véritable guichet **Financer et placer**, dont un style hérité réintroduisait un rectangle sous leur illustration.

Dans la même scène isolée à **320 px**, le début du bouton d’examen du contrat passe de **1 532 à 562 px** dans le document. Le prêt en cours passe de **545 à 94 px**, et son bouton de remboursement de **1 080 à 489 px** ; en retard, ce bouton passe de **1 239 à 529 px**. À **320 × 422**, les commandes de confirmation, auparavant sous le contenu initial du prêt, sont visibles et cliquables entre y = 338 et 395 px dans la scène finale. Ces mesures ne couvrent pas la hauteur de toute la navigation du jeu et ne démontrent pas, à elles seules, une meilleure compréhension par de nouveaux joueurs.

Validation : **62 tests** passent sur le résumé bancaire, les règles et le backend existant, dont **12 cas** pour les reliquats, dates exactes, paiements partiels et fonds disponibles. Les **31 contrôles navigateur** passent sur le composant réel avec API simulée locale : 320, 390 et 1440 px, écran court, clavier, toucher, contrats, consultations sans écriture, formats invalides, conditions d’accès, offre expirée, erreurs, double clic et reprises avec la même clé sans double débit. Deux contrôles vérifient aussi le composant sous le véritable guichet bancaire. Aucune erreur JavaScript ou console, aucune requête externe. TypeScript global, ESLint ciblé et contrôle de diff passent.

Preuves : `scripts/audit-bank-clarity-lot27.mjs`, `output/clarity-lot27/before/report.json` et `output/clarity-lot27/after/report.json`. Aperçus : [prêt en cours à 320 px](../../output/clarity-lot27/after/active-320x844.png), [confirmation sur écran court](../../output/clarity-lot27/after/offer-confirmation-320x422.png), [offre sur ordinateur](../../output/clarity-lot27/after/offer-1440x900.png). Aucun compte réel, aucune migration ni publication n’ont été modifiés. Les notes de compréhension restent inchangées.

Prochains points à examiner : l’amélioration du site, où la maquette précède encore coût et prérequis, puis les produits dérivés, où déblocage, fabrication et mise en vitrine peuvent être mieux présentés selon l’état du joueur. Ils ne sont pas modifiés dans ce lot.

**43. Vingt-huitième lot : décider d’une amélioration du site avant de regarder sa maquette**

L’écran affichait six niveaux et une grande maquette avant le prix d’achat. Les conditions déjà remplies occupaient autant de place que les obstacles réels. L’hébergement du site actuel se trouvait après tout ce parcours, même lorsque les ventes étaient suspendues. La confirmation pouvait repousser son montant et ses boutons sous le premier écran d’un téléphone.

- **Le niveau actuel et la prochaine décision passent en premier.** Le titre devient **Améliorer mon site**, ou **Mon site** au niveau maximal. Le panneau présente le prochain niveau, son coût unique après déduction des niveaux précédents, son hébergement tous les cinq jours réels et son effet estimé sur la cadence. Les visites et les commandes ne sont pas présentées comme des gains garantis. Après un achat confirmé, l’objectif avance au niveau suivant.
- **Les deux coûts sont distincts.** La première période de cinq jours réels incluse et la reconduction automatiquement activée à l’achat sont annoncées avant **Examiner l’amélioration** et répétées dans la confirmation. Le coût cumulé d’un niveau plus lointain reste consultable, avec l’obligation visible d’acheter les niveaux dans l’ordre. Le serveur continue de recalculer le débit et les prérequis.
- **Les obstacles utiles restent ouverts.** Trésorerie manquante, commandes, confiance, abonnés, photos et identité non acquises restent visibles. Les achats séparés portent leur prix et leur destination. Les prérequis remplis passent dans un volet fermé. Les six niveaux, la maquette et les graphiques de comparaison restent accessibles à la demande. Les niveaux non proposés par un ancien service restent indisponibles.
- **L’hébergement actuel précède l’amélioration.** Lorsqu’il est actif, un résumé donne son tarif, sa prochaine échéance et l’état de reconduction ; les commandes de gestion se déplient. Lorsqu’il est suspendu, la réactivation et son prix restent ouverts, avec le montant manquant si nécessaire. Le tarif fourni par le serveur prévaut pour le niveau installé et le calcul de l’écart avec le suivant. Les comparatifs généraux sont explicitement nommés « tarifs catalogue ».
- **Les données inconnues restent inconnues.** Un solde, tarif, niveau ou prérequis invalide affiche « à confirmer ». Un tarif inconnu ne produit pas d’écart fictif ; une trésorerie inconnue ne débloque pas d’achat. Les boutons conservent leur matériau illustré, y compris dans le véritable parent de gestion.
- **La confirmation garde la décision accessible.** Le dialogue de gestion conserve son montant et ses deux boutons dans un pied fixe. Description et erreur défilent séparément. Le focus commence sur **Revenir**, reste dans le dialogue au clavier et retourne au déclencheur après annulation. La fermeture reste bloquée pendant l’envoi. Les requêtes, le verrou contre les doubles clics et les clés de reprise ne changent pas. Ce dialogue étant partagé avec les factures, leur parcours a été vérifié à nouveau.

Dans la même scène isolée à **320 px**, le coût d’achat passe de **812 à 234 px** depuis le début du composant ; le bouton passe de **1 003 à 666 px**. À **390 px**, ce bouton passe de **1 003 à 618 px**. Sur un écran de **320 × 422**, le montant de confirmation occupe y = 314–341 px et les boutons y = 351–395 px ; leur visibilité et leur réception des interactions sont contrôlées. Ces mesures n’incluent pas toute la navigation du jeu et ne remplacent pas des essais de compréhension avec de nouveaux joueurs.

Validation : **223 tests existants** passent sur le commerce en ligne, le moteur local et le backend. **52 contrôles navigateur dédiés** couvrent les composants réels, leurs parents de gestion, 320/390/1440 px, l’écran court, les conditions, le clavier, le toucher, la consultation sans achat, les tarifs serveur, les inconnues, le refus serveur et le double clic. Les **21 contrôles de règlement des factures** passent également, notamment la réponse perdue avec reprise de la même demande et débit unique, soit **73 contrôles navigateur**. TypeScript global, ESLint ciblé, syntaxe du script et contrôle de diff passent. Les captures mobiles et ordinateur sont inspectées ; aucune erreur JavaScript, erreur console ou requête externe dans la recette dédiée.

Preuves : `scripts/audit-site-progression-lot28.mjs`, `output/clarity-lot28/before/report.json`, `output/clarity-lot28/after/report.json`, `output/clarity-lot28/after/edge-report.json` et `output/pay-all-invoices/report.json`. Aperçus : [amélioration à 320 px](../../output/clarity-lot28/after/ready-320x844.png), [confirmation sur écran court](../../output/clarity-lot28/after/confirmation-320x422.png), [amélioration sur ordinateur](../../output/clarity-lot28/after/ready-1440x900.png). Les achats des recettes utilisent des données en mémoire ; aucun compte réel ni règle économique n’est modifié. Aucune migration ni publication. Les notes de compréhension restent inchangées.

Prochain point identifié : clarifier les produits dérivés en mettant le stock existant et l’action utile avant les détails de déblocage, de fabrication et de mise en vitrine. Ce parcours n’est pas modifié dans ce lot.

**44. Vingt-neuvième lot : gérer ses produits dérivés selon leur état réel**

Le catalogue illustré et le suivi de vitrine précédaient l’éditeur sur téléphone. Celui-ci empilait toujours le déblocage, la fabrication et le prix, même avec un atelier verrouillé ou un stock déjà prêt. Les ventes historiques occupaient le premier résumé à la place du stock disponible.

- **Le stock passe en tête.** Trois valeurs distinguent les articles restants, ceux en vitrine et ceux en réserve. La jauge compte séparément les références occupant une place. À l’ouverture, une référence en réserve avec du stock est proposée avant une référence active, puis un produit sans stock. Le choix complet des six produits reste dans un volet, avec leur stock, leur prix enregistré et les collections encore à débloquer.
- **L’état détermine l’étape utile.** Un atelier verrouillé présente son achat unique et ses conditions ; les formulaires de fabrication et de prix ne sont pas affichés. Un atelier acquis sans stock présente la fabrication et annonce la mise en vitrine comme prochaine étape. Un stock en réserve ouvre directement le prix et la publication. Une référence déjà active commence par son stock, son prix et son état ; modification et réapprovisionnement se déplient à la demande.
- **Les coûts restent explicites.** Le prix de l’atelier est distinct de la fabrication payée d’avance, de la trésorerie manquante et des frais de vente. La limite de 500 articles est indiquée par référence. La mise en vitrine conserve sa confirmation sans débit immédiat. Suggestions de prix et décomposition restent consultables ; la marge est estimée avant TVA et autres charges, et la cadence porte l’unité « articles / jour réel ».
- **Une modification annonce son effet.** Dès que le prix ou la publication change, un avertissement visible avant l’enregistrement précise la remise à zéro de la progression vers la prochaine vente. La confirmation le répète. Réapprovisionner conserve prix et progression. Une boutique suspendue conserve ses références en vitrine avec l’indication « ventes suspendues » ; leur retrait reste possible, y compris lorsque la vitrine est pleine.
- **Les données incomplètes ne produisent pas un résultat fictif.** Prix, quantités et collections invalides bloquent les actions concernées. Un tarif, une cadence ou un prérequis inconnu reste à confirmer. L’estimation de l’offre proposée utilise le lecteur d’activité qui valide l’audience et le Studio. L’historique utilise les reçus validés : un code inconnu ne fait plus échouer l’affichage et un versement absent ne devient pas zéro. Ventes, chiffre d’affaires et valeur du stock se trouvent dans un volet secondaire, avec la distinction entre valeur de fabrication et montant récupérable.

L’éditeur a été extrait dans `KqMerchProductEditor.tsx` avec son style propre. Les illustrations des articles restent présentes, les contrôles conservent les enseignes, les lignes intérieures restent sobres et les textes utiles gagnent en lisibilité. Les boutons désactivés sont également contrôlés sous le véritable parent de gestion.

Dans la même scène à **320 px**, le début de l’éditeur passe de **800 à 286 px** depuis le début de l’atelier. Pour un produit en réserve, le champ de prix passe de **1 255 à 567 px**, et l’enregistrement de **1 582 à 940 px**. L’écran initial d’une référence active passe de **1 641 à 792 px** de hauteur. Le déblocage arrive à 614 px au lieu de 1 062 px ; la fabrication d’un premier stock à 711 px au lieu de 1 083 px. Sur ordinateur, l’abandon des deux colonnes fait descendre certains boutons : le gain n’est pas uniforme dans tous les états. Ces mesures portent sur le composant isolé et ne démontrent pas la compréhension de nouveaux joueurs.

Validation : **245 tests existants** passent sur les produits dérivés, l’activité, le moteur local et le backend. Les **54 contrôles navigateur dédiés** passent à 320, 390 et 1440 px, ainsi qu’à 320 × 422 : états conditionnels, choix des six produits, clavier, toucher, données inconnues, plafond, prix, progression, confirmations et parcours complet via le vrai parent de gestion. Les **20 contrôles historiques** passent aussi, soit **74 contrôles navigateur uniques**. Ils vérifient notamment les ventes après 24 heures simulées, l’absence de ventes pendant une suspension, le maintien d’un prix non enregistré et du focus lors d’une actualisation du stock, les débits exacts et le refus des commandes invalides.

La recette historique ouvre désormais les nouveaux volets avant d’interagir ; ses assertions économiques ne sont pas modifiées. TypeScript global, ESLint ciblé, syntaxe des scripts et contrôle de diff passent. Une passe finale de 17 scénarios actualise les captures et la mesure des volets fermés, sans les compter deux fois. Les captures mobiles, ordinateur et confirmations courtes sont inspectées. Aucun débordement, erreur navigateur ni accès externe dans les recettes.

Preuves : `scripts/audit-merch-clarity-lot29.mjs`, `scripts/audit-placard-merch.mjs`, `output/clarity-lot29/before/report.json`, `output/clarity-lot29/after/report.json`, `output/clarity-lot29/after/layout-report.json` et `output/merch/report.json`. Aperçus : [stock en réserve à 320 px](../../output/clarity-lot29/after/stock-reserve-320x844-full.png), [référence en vente à 320 px](../../output/clarity-lot29/after/active-320x844.png), [atelier sur ordinateur](../../output/clarity-lot29/after/stock-reserve-1440x900.png). Les commandes des recettes utilisent uniquement des données en mémoire. Aucune règle économique, migration ou publication n’est modifiée. Les notes de compréhension restent inchangées.

Prochain point identifié : le Studio, où les ateliers, les paliers et une grande illustration précèdent encore le coût de la prochaine amélioration. La direction artistique peut aussi être consultée séparément des achats. Ce parcours n’est pas modifié dans ce lot.

**45. Trentième lot : choisir une amélioration du Studio avant d’explorer les détails**

Le Studio empilait les trois ateliers, leurs trois paliers, une illustration puis la décision d’achat. La direction artistique occupait ensuite une seconde section entièrement ouverte. Les conditions remplies prenaient autant de place que les obstacles restant à lever.

- **Le niveau actuel et le prochain achat passent en premier.** Les trois ateliers conservent une illustration compacte, leur niveau et leurs paliers acquis. L’ouverture privilégie une prochaine amélioration accessible, puis un atelier encore à développer. Le panneau présente son bénéfice, son coût unique sans abonnement et la trésorerie. Les multiplicateurs sont exprimés en pourcentages ; le texte précise qu’il s’agit du bonus total du niveau, et les prévisions ne deviennent pas des ventes garanties. Après un achat confirmé, l’objectif avance au niveau suivant.
- **Les obstacles restent visibles.** Les fonds manquants, la boutique suspendue, les commandes, la confiance et les autres ateliers requis restent près du bouton. Les conditions remplies sont repliées. Les trois paliers restent consultables dans un volet séparé ; un palier lointain distingue son prix propre du coût des paliers restants de ce même atelier, avec l’obligation de les acquérir dans l’ordre. Le clic ou la validation au clavier ramène le focus sur la décision, située au-dessus du catalogue. Les flèches permettent toujours de parcourir les choix.
- **La direction devient une décision séparée.** Un volet fermé indique le style appliqué et la gratuité du changement. À l’ouverture, le joueur voit les trois styles, les produits compatibles, le bonus et la pénalité éventuels, puis la comparaison d’un produit réellement en vente. L’application conserve sa confirmation gratuite. La maquette se consulte dans un second volet, après ces effets et l’action ; elle ne masque plus les conséquences commerciales.
- **Les comparaisons restent fondées sur les données disponibles.** Le lecteur extrait conserve la cadence, le ratio de prix et la référence fournis par le serveur pour les récoltes. Un ancien lot sans offre calculée peut être estimé localement seulement si ses données sont lisibles. Les produits dérivés utilisent la cadence de chaque référence ; les unités distinguent paquets et articles par jour réel. Le candidat ne change que le Studio : audience, prix et publication restent constants. Une valeur inconnue ou un état Studio invalide ne devient pas zéro ni un achat ancien supposé. Une suspension connue conserve sa cadence nulle réelle.

Les commandes, tarifs, règles de progression et confirmations du jeu sont conservés. Les premiers achats historiques de photo et d’identité restent disponibles avec leur commande d’origine. Les améliorations avancées non prises en charge et les achats déjà acquis restent indisponibles. La direction a été extraite dans `KqBrandDirection.tsx`, et les comparaisons dans `kq-studio-preview.ts`. Les panneaux et contrôles gardent leurs matériaux illustrés ; les séparateurs intérieurs restent sobres et les explications utiles sont lisibles à 320 px.

Dans la même scène à **320 px**, le Studio initial passe de **2 214 à 997 px** de hauteur. Le bouton d’amélioration passe de **795 à 577 px** depuis le début du composant. Avec le premier palier photo déjà acquis, la hauteur passe de **2 344 à 997 px**, et le bouton de **890 à 577 px**. Au niveau maximal, l’écran passe de **2 192 à 751 px**. Ces mesures concernent les volets initialement fermés dans une scène isolée ; elles n’incluent pas toute la navigation du jeu et ne démontrent pas la compréhension de nouveaux joueurs.

Validation : **272 tests** passent sur le Studio, les comparaisons, l’activité de boutique, le moteur local et le backend, dont **18 nouveaux cas** sur les valeurs serveur, les estimations anciennes et les données incomplètes. Les **52 contrôles navigateur dédiés** et les **27 vérifications historiques** passent, soit **79 contrôles**. Ils couvrent les neuf paliers, les trois directions, 320/390/1440 px, le clavier, le toucher, le focus sur la décision, les états anciens et invalides, les coûts exacts et les effets réels sur la cadence. Les confirmations utilisent également le véritable parent de gestion à **320 × 568** : montant et commandes visibles, annulation, refus serveur, double clic sans double débit et reprise avec la même clé. Les commandes des recettes utilisent uniquement des données en mémoire.

La recette historique ouvre les nouveaux volets avant interaction et adapte le contrôle de focus ; ses assertions économiques sont conservées. TypeScript global, ESLint ciblé, syntaxe des scripts et contrôle de diff passent. Les captures initiales, directions, maquettes et confirmations sont inspectées sur mobile et ordinateur. Aucun débordement, erreur JavaScript ou console, ni accès extérieur dans les recettes. Aucun compte réel, règle économique, migration ou publication n’est modifié. Les notes de compréhension restent inchangées.

Preuves : `scripts/audit-studio-clarity-lot30.mjs`, `scripts/audit-placard-studio.mjs`, `output/clarity-lot30/before/report.json`, `output/clarity-lot30/after/report.json` et `output/studio/report.json`. Aperçus : [Studio initial à 320 px](../../output/clarity-lot30/after/ready-320x844-full.png), [prochain palier sur ordinateur](../../output/clarity-lot30/after/owned-next-1440x900.png), [choix de direction](../../output/clarity-lot30/after/direction-decision-320.png), [confirmation sur écran court](../../output/clarity-lot30/after/upgrade-confirmation-320x568.png).

Prochain point identifié : la préparation des campagnes marketing, où objectifs, audiences, budgets, règles et graphiques s’empilent avant l’action de lancement. Les états de campagne en cours et terminée devront rester distincts, avec coût, durée et risques visibles avant engagement. Ce parcours n’est pas modifié dans ce lot.

**46. Trente et unième lot : préparer une campagne en comprenant son engagement**

L’écran plaçait quatre cartes d’objectif, trois publics, trois budgets et plusieurs graphiques avant l’action. Sur téléphone, le panneau sombre de prévisions dominait la page. Pendant une campagne, le calendrier précédait le budget engagé et le stock ; la formulation des abonnés pouvait laisser croire qu’ils avaient déjà été crédités.

- **Trois choix compacts précèdent l’engagement.** L’objectif, le produit et le public utilisent des menus natifs avec une flèche visible, utilisables au clavier et au toucher. Le stock et le format du produit sont rappelés hors du menu, dont le texte peut être tronqué sur téléphone. Prix et qualité restent visibles, avec l’accès à leur ajustement. Les trois budgets payants conservent leur prix et leur volume de visites ciblées prévu avant adéquation au public, pour comprendre ce qu’apporte une dépense supérieure. L’essai offert reste utilisable une seule fois.
- **Le coût et les risques restent ouverts.** Le panneau distingue le débit total, non remboursable, la durée d’occupation, la préparation sans trafic ciblé et la diffusion. La trésorerie et le montant manquant sont explicites. Contribution supplémentaire après budget et abonnés restent nommés comme des estimations. Une contribution négative, un public mal adapté, une satisfaction insuffisante, une rupture possible, une expiration d’hébergement ou un prérequis bloquant restent visibles avant l’action. La campagne continue pendant une rupture ou une pause du produit ; la préparation peut aussi laisser le stock se vendre naturellement.
- **Les calculs se consultent à la demande.** Le graphique de contribution et la jauge de satisfaction sont conservés dans les prévisions détaillées, avec ventes supplémentaires, seuil de couverture du budget et prix de référence. Un autre volet décrit l’objectif, les abonnés par commande et le délai entre campagnes, mesuré depuis le début de la précédente. La comparaison reste après TVA, frais, emballage et budget, avant coût de production et charges fixes. Elle ne présente ni revenu brut ni bénéfice garanti.
- **Une campagne engagée montre son état actuel.** Préparation, diffusion et bilan en attente sont distingués. Budget déjà payé, stock réel et commandes précèdent la progression vers l’objectif. Les abonnés sont nommés « à recevoir au bilan » et « pas encore crédités ». Le calendrier est replié. Un produit en pause conserve sa quantité réelle avec son état, et une boutique suspendue ne paraît plus vendre. Le lien vers le produit reste accessible ; aucune seconde campagne ne peut être préparée pendant l’occupation du créneau.
- **Les bilans restent des résultats enregistrés.** L’historique fermé présente les abonnés du dernier bilan lorsque les dates et données permettent de l’identifier. Ses lignes distinguent budget payé, commandes satisfaisantes, ventes versées et abonnés gagnés. Elles rappellent que les commandes incluent le trafic naturel et que les versements ne constituent pas le bénéfice de la campagne. Les données manquantes restent indisponibles, y compris pour une ancienne version non reconnue.

Le lecteur `kq-marketing-view.ts` valide les données avant d’utiliser la simulation existante : un solde inconnu ne débloque plus un budget, une date invalide ne fait plus échouer l’affichage, et une audience ou un stock absent ne devient pas zéro. Les coûts catalogue restent connus séparément des prévisions ; le serveur conserve la validation finale du coût, de la disponibilité et de l’historique des récoltes. Les calculs de campagne, tarifs, commandes et règles économiques ne sont pas modifiés. Le suivi et les bilans sont extraits dans `KqMarketingStatus.tsx`. Les contrôles conservent les enseignes illustrées et les surfaces utilisent les feuilles claires du jeu, sans le grand fond sombre de l’ancien panneau de prévisions.

Dans la même scène à **320 px**, l’essai offert passe de **2 409 à 1 310 px** de hauteur, et son bouton de **2 140 à 1 049 px** depuis le début du composant. La campagne payante passe de **2 462 à 1 629 px**, avec son bouton de **2 193 à 1 368 px**. Le suivi en préparation passe de **1 008 à 873 px**, et celui en diffusion de **1 025 à 873 px**. Sur ordinateur, le suivi actif devient légèrement plus haut, **603 à 625 px**, avec des valeurs plus lisibles : le gain n’est pas uniforme. Ces mesures concernent la scène isolée, volets fermés, et ne démontrent pas la compréhension de nouveaux joueurs.

Validation : **256 tests** passent sur le lecteur, le marketing, le commerce en ligne, le moteur local et le backend, dont **23 nouveaux cas** sur les données manquantes, les coûts connus et la conservation exacte des calculs. Les **90 contrôles navigateur uniques** passent : 30 combinaisons objectif/budget/public, états gratuit et payants, prérequis, inconnues, clavier et toucher, stock limité, campagne active, bilan et confirmations réelles à **320 × 568**. Les montants et commandes restent exacts ; le double clic ne produit qu’un débit, l’annulation ne dépense rien et le refus conserve l’erreur et la même clé lors d’une nouvelle tentative. Les versions actives inconnues n’héritent plus d’une récompense supposée de l’ancien système.

La dernière passe actualise les 20 mesures responsives et ajoute deux contrôles sur les chevrons des menus, le stock visible et les alertes précédant le lancement, sans recompter les scénarios déjà passés. Captures à 320, 390 et 1440 px, graphique ouvert et confirmations courtes inspectés. TypeScript global, ESLint ciblé, syntaxe du script et contrôle de diff passent. Aucun débordement, erreur JavaScript ou console, ni accès extérieur. Les essais utilisent des données en mémoire : aucun compte réel, règle économique, migration ou publication n’est modifié. Les notes de compréhension restent inchangées.

Preuves : `scripts/audit-marketing-clarity-lot31.mjs`, `output/clarity-lot31/before/report.json`, `output/clarity-lot31/after/report.json` et `output/clarity-lot31/after/layout-report.json`. Aperçus : [campagne payante à 320 px](../../output/clarity-lot31/after/paid-320x844-full.png), [suivi sur ordinateur](../../output/clarity-lot31/after/active-1440x900.png), [confirmation sur écran court](../../output/clarity-lot31/after/paid-confirmation-320x568.png).

Prochain point identifié : la publicité générale, encore accessible à travers deux volets imbriqués, avec les graphiques avant l’état de la publicité active. Il faudra mettre l’effet en cours et son échéance en premier, puis rendre le coût, la durée et les limites d’une offre faciles à comparer. Ce parcours n’est pas modifié dans ce lot.

**47. Trente-deuxième lot : comprendre sa publicité avant de parcourir les offres**

La publicité générale demandait d’ouvrir deux volets successifs. Ses deux graphiques précédaient le suivi de la publicité engagée. Les trois offres conservaient chacune un bouton indisponible pendant une diffusion, et les jours de jeu dominaient la lecture de leur durée réelle. Une campagne terminée pouvait disparaître localement avant que le serveur ait confirmé sa clôture.

- **Une seule entrée donne déjà l’état utile.** Le volet « Publicité générale de la boutique » affiche son prix de départ lorsqu’il est libre. Pendant une publicité, son résumé conserve le bonus, le nom de l’offre et la date réelle de fin. Si le site devient inactif, il annonce « Bonus indisponible · campagne continue », même fermé. Le suivi ouvert présente ces valeurs et une progression de durée avant les comparaisons.
- **Le choix devient compact.** Les trois offres sont des choix exclusifs au clavier et au toucher. Chacune montre son prix, sa durée réelle et son bonus. Une seule action porte le montant de l’offre sélectionnée. Le paiement unique, l’absence de reconduction, la fin prévue et la trésorerie restent visibles avant engagement. Les graphiques de prix et de fréquentation restent disponibles dans un volet fermé, avec leurs unités séparées.
- **Les limites restent près de la décision.** Le texte distingue cette publicité des campagnes ciblées et des produits dérivés. Une hausse de fréquentation ne devient pas une promesse de commandes. Trésorerie manquante, site inactif et échéance d’hébergement précédant la fin restent visibles et les avertissements pertinents se retrouvent dans la confirmation. Le site de base n’hérite pas d’un abonnement fictif. Les anciens comptes sans commerce en ligne conservent l’indication de ventes manuelles.
- **Le stock manquant mène à l’action utile.** En l’absence de fleurs actuellement vendables, un avertissement invite à vérifier stock, publication et qualité, avec accès à « Mon stock en vente ». Il apparaît aussi pendant une publicité active. Une annonce épuisée ou dégradée n’est pas assimilée à une annonce supprimée ; des données illisibles ne deviennent pas un stock nul. L’avertissement ne crée pas un nouveau prérequis d’achat.
- **Un engagement existant ne devient pas un nouvel achat.** Une publicité active, prévue ou échue conserve son créneau jusqu’à actualisation serveur. Le suivi utilise le bonus et les dates réellement fournis ; aucun ancien prix payé n’est inventé à partir du catalogue actuel. Un état, montant ou calendrier inconnu reste à confirmer et bloque le lancement concerné. Pendant un engagement, les offres se consultent sans trois boutons d’achat inutilisables.

La présentation est extraite dans `KqAdvertisingPanel.tsx` et ses données sont validées par `kq-advertising-view.ts`. Les anciens styles publicitaires devenus inutilisés sont retirés. Le parent de gestion et le parcours historique réutilisent ce composant ; le volet doublon dans les campagnes est supprimé. Les choix et commandes conservent leurs enseignes illustrées, le suivi sa feuille claire et les lignes internes leurs séparateurs sobres. Les prix, durées, multiplicateurs, commandes et règles économiques ne sont pas modifiés.
