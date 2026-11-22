# Premier parcours du Quartier

Revue locale du 22 novembre 2026. Chromium 157 sous Windows, à 1440 × 900 et en émulation tactile à 320 × 710. Contrôles complémentaires à 320 × 540, 390 × 844 et en paysage dans l’atelier. Composants du dépôt et réponses de jeu isolées. Les constats de fréquence décrivent le scénario reproduit. Aucune mesure de fréquence auprès des joueurs.

## Recette locale du premier semis après corrections

Le compte fictif commence sans personnage ni carte Buddie. À 320 × 540 et 320 × 710 au toucher, puis à 1440 × 900 au clavier, les deux choix de l’invitation sont accessibles dès l’ouverture. Échap conserve le surnom et l’apparence. La commande d’abandon réinitialise ces choix. La proposition de plan est accessible sous Aménager. [Recette et 54 contrôles](../../../output/parcours-loic/loic-welcome/rapport.json) · [Invitation à 320 × 540](../../../output/parcours-loic/loic-welcome/invitation-320x540.png)

Après un refus, la recette retrouve le devis et soumet le même plan. Le seul débit est de 786,74 €, avec 213,26 € en caisse. Le panneau de confirmation permet de revoir le plan, puis de passer directement à la variété. Avec un album vide, le focus arrive sur la commande qui donne accès au pack offert. Le joueur ferme le guide, reprend l’étape au rechargement, ouvre un pack gratuit, affecte une carte, consulte ses stocks et sème. Le Carnet affiche les six gestes validés et présente séparément les 24 fiches facultatives. [Confirmation mobile](../../../output/parcours-loic/loic-welcome/confirmation-travaux-320x540.png) · [Carnet](../../../output/parcours-loic/loic-welcome/carnet-320.png)

La fiche de la zone installée propose aussi « Choisir mon Buddie » dans Pilotage et Aménager. Loïc nomme ces deux chemins et « Me montrer » ouvre le choix de la zone. À 968 × 536, la recette clavier atteint le bouton de sélection du carrousel. Avec l’album vide, le toucher atteint les packs. Les bords et le centre des commandes restent dégagés dans les deux cas. [Recette à 968 × 536](../../../output/parcours-loic/choix-zone/rapport.json) · [Fiche de la zone](../../../output/parcours-loic/choix-zone/fiche-zone-remplie.png)

## Constats avant les corrections

| Constat | Sévérité | Fréquence observée | Confiance | Effort estimé |
|---|---|---|---|---|
| UX01 · Plus de lien vers la préparation après le devis | Haute | Les deux formats, à chaque installation de départ observée | Haute | Moyen |
| UX02 · Plan de départ hors du premier écran en Aménager | Moyenne | 320 × 710, après chaque entrée à l’état initial | Haute | Faible à moyen |
| UX03 · Le compteur du Carnet dilue la fin du départ | Moyenne | Dès l’achèvement des six étapes | Haute sur l’interface, moyenne sur la confusion | Faible |
| UX04 · L’atelier perd la saisie lors d’une interruption | Moyenne | Les deux formats, à chaque fermeture avant validation | Haute | Faible à moyen |
| UX05 · Invitation tronquée sur écran court | Moyenne | 320 × 540 au chargement | Haute | Faible à moyen |

## UX01 · Relier la confirmation au prochain geste

Après « Installer le plan · 786,74 € », la trésorerie de la fixture passe de 1 000 € à 213,26 €. Loïc annonce « Choisir une variété », mais l’entrepôt reste dans Aménager et « Préparer mes cultures » est absent. « Me montrer » disparaît, la position de défilement du panneau reste à 1 462 px sur mobile et 741 px sur ordinateur, et le focus revient au document. Le bouton Pilotage est bien présent, à −1 015 px et −451 px du haut de la fenêtre. Remonter puis passer en Pilotage laisse la zone sélectionnée et le raccourci reste absent. Ouvrir ensuite « Priorités » restitue « Préparer mes cultures » et « Me montrer » peut lui rendre le focus. Ce détour demande de remonter et d’activer deux autres commandes. La recette intégrale passait déjà parce qu’elle enchaîne par un détour au QuizzShow qui rouvre le Pilotage. Proposer, après le premier enregistrement, un lien vers Pilotage ou un accès explicite à la préparation avec une destination de focus. Couvrir l’enchaînement direct dans la recette. [Mobile](ux-apres-installation-320.png) · [Ordinateur](ux-apres-installation-1440.png) · [Recherche du repère](../../../src/components/placard/KqFarmGuide.tsx#L245) · [Basculement de mode](../../../src/components/placard/KqWarehouse.tsx#L925) · [Accès dans Priorités](../../../src/components/placard/KqWarehouse.tsx#L1256) · [Détour de la recette](../../../scripts/audit-loic-journey.mjs#L171).

## UX02 · Exposer le plan de départ près du choix Aménager

À 320 × 710, aussitôt après avoir sélectionné Aménager, « Proposer un plan de départ » commence à y = 927 px. Le panneau s’arrête à y = 698 et présente d’abord la trésorerie, le bouton de retour, les modes, la réserve et les métriques. Sur ordinateur, le bouton est visible à y = 564. « Me montrer » permet de rejoindre l’action sur mobile. Donner une place au plan de départ dans le premier écran du nouvel entrepôt. [Avant défilement](ux-amenager-320.png) · [Position du bouton dans le composant](../../../src/components/placard/KqWarehouse.tsx#L1438).

## UX03 · Rendre la fin du départ visible dans le Carnet

Après consultation de la prochaine échéance, le guide valide les six étapes de départ. Le Carnet en compte 7 sur 30, avec le repère du Quartier et les futures fiches. Son en-tête affiche « Étapes validées 7 / 30 », sans indiquer que le départ est terminé. Les six étapes sont bien validées par le moteur. Le compteur de départ peut figurer auprès d’une indication de fin, au-dessus des autres apprentissages. [Carnet à la fin](ux-carnet-fin-320.png) · [Calcul du compteur](../../../src/components/placard/KqTutorialLibrary.tsx#L27) · [Vérification de la prochaine échéance](../../../scripts/audit-loic-journey.mjs#L341).

## UX04 · Conserver la saisie de l’avatar quand l’atelier se ferme

En saisissant « Marin29 », puis Échap avant la confirmation, le focus revient à « Créer mon personnage ». À la réouverture, le surnom est vide à 320 et à 1440 px. Le dialogue démonté recrée le brouillon initial. Après une validation complète, un seul POST local sauvegarde le profil et le village revient après rechargement. Conserver les choix sur la page en cas de fermeture et diriger le focus vers le village ou l’invitation après la création. [Atelier à 320 px](ux-avatar-320.png) · [Montage du dialogue](../../../src/components/contest/QuarterCharacterGate.tsx#L85) · [Initialisation du brouillon](../../../src/components/contest/ChanvrierProfileEditor.tsx#L29).

## UX05 · Maintenir les deux choix de départ à portée de doigt

À 320 × 540, le premier écran montre le texte de l’invitation et la croix. Les deux boutons commencent à y = 146,5 px, avec 0 px visible dans un panneau haut de 146 px pour 206 px de contenu. Un glissement tactile ou Tab fait défiler les 60 px restants et expose les 44 px de chaque bouton. À 320 × 710, les deux actions sont visibles au chargement. Réserver la place des deux commandes et laisser défiler le texte si nécessaire. [Invitation à 320 × 540](ux-invitation-320x540.png) · [Invitation à 320 × 710](ux-village-320.png) · [Zone de défilement](../../../src/components/placard/KqFarmGuide.module.css#L1).

## Vérifications positives

- Six activations minimum entre l’invitation et l’installation avec le guide, à 320 et 1440 px. Les quatre premières produisent uniquement le brouillon. « Voir le devis » donne 786,74 € à payer et 213,26 € de solde après. Le refus simulé laisse le brouillon et la trésorerie intacts, puis le prix est débité une seule fois. La variante personnalisée de l’avatar a demandé six activations depuis « Les clés de la grange », en plus de la saisie du surnom. [Devis mobile](ux-devis-320.png) · [Assertion de débit](../../../scripts/audit-loic-journey.mjs#L150).
- Deux parcours Loïc de 17 points de contrôle. Le guide ne croise pas géométriquement son repère et ne provoque pas de débordement horizontal aux tailles de la recette. Pause, fermeture, retour par le menu, aide, relecture et rechargement préservent l’état attendu. Échap ferme le Carnet et replace le focus sur son déclencheur. 191,7 px pour l’invitation mobile, contre 121,1 px sur ordinateur. Le parcours va jusqu’à la prochaine échéance et la relecture.
- La variante à collection vide passe 16 contrôles sur mobile. Elle réclame et ouvre une seule fois le pack de bienvenue, révèle trois Buddies communs sans débit ni achat, puis permet de lancer la première campagne et de passer volontairement l’étape suivante.
- Le village passe ses 21 contrôles. Neuf pancartes accessibles à 320 et 390 px, menu, zoom, choix des trois personnages, courrier et repli HTML après perte de WebGL. Les paysages, éclairages, personnages et enseignes donnent des repères visuels cohérents. Les enseignes utilisent du texte HTML sur leurs plaques, y compris en mode nuit. L’entrepôt conserve le même vocabulaire visuel dans son plan, son papier, ses devis et ses boutons. [Village de jour](ux-village-1440.png) · [Arrivée de nuit](ux-village-320.png).
- Le studio d’avatar passe sa recette en portrait, en paysage et à 320 px. Les réglages rouvrent le personnage et un refus de sauvegarde 503 peut être retenté. Le portrait 2D de secours est contrôlé sans WebGL.
- La recette de navigation fournit cinq groupes de preuves partielles, dont le repli WebGL à 320 px, les onze destinations sur ordinateur et le garde-brouillon. Elle s’arrête ensuite sur l’ancien attribut `data-farm-guide`, explicitement absent dans la recette Loïc actuelle. La couverture après ce point reste à rétablir. [Attente obsolète](../../../scripts/audit-world-3d-navigation-scenarios.mjs#L165) · [Assertion Loïc actuelle](../../../scripts/audit-loic-journey.mjs#L107).

## Fluidité et limites

Échantillons d’environ 2,4 s sur le poste d’audit partagé, scène au repos et animation active. Les effacements WebGL espacés de plus de 2 ms approchent la cadence du canvas. Les rappels du navigateur caractérisent la régularité de la boucle JS. [Mesures et résultats détaillés](mesures-experience.json).

| Rendu du village | Fenêtre | Rappels sur l’intervalle | Effacements du canvas | Intervalle médian entre rappels |
|---|---|---:|---:|---:|
| Intel Iris Xe, ANGLE D3D11 | 320 × 710 | 145 / 2,40 s | 73 | 16,7 ms |
| Intel Iris Xe, ANGLE D3D11 | 1440 × 900 | 145 / 2,40 s | 145 | 16,7 ms |
| SwiftShader forcé, ANGLE Vulkan | 390 × 844 | 7 / 2,42 s | 7 | 483,3 ms |
| SwiftShader forcé, ANGLE Vulkan | 1440 × 900 | 6 / 3,02 s | 6 | 700,0 ms |

L’aperçu d’avatar en marche sur Intel tient 149 et 145 images sur environ 2,4 s, avec un 95ᵉ percentile de 17,4 ms à 1360 × 900 et de 17,2 ms à 390 × 844. Sur ce poste, la scène du village est fluide avec accélération et nettement ralentie sous SwiftShader forcé. Ce second relevé indique une sensibilité au rendu logiciel avec une charge concurrente. La taille de l’échantillon limite l’usage des mesures de queue et la comparaison des formats. Le délai individuel entre sauvegarde du profil et apparition de l’invitation est d’environ 0,6 s, puis le village est prêt au bout de 3,1 s sur ordinateur et 8,0 s dans le passage mobile. Les deux passages ont réutilisé le serveur local dans un ordre différent de la recette automatisée.

La variante de création relie le composant d’entrée au shell avec un compte de fixture. Restent à mesurer auprès de joueurs la compréhension, le temps de tâche et la découverte après interruption. Les appareils physiques, Safari, Firefox, les lecteurs d’écran et le transfert de progression entre appareils restent à vérifier. L’entrée Next et l’authentification relèvent de l’autre volet de l’audit.
