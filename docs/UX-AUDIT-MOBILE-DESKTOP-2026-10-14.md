# Audit UX smartphone et ordinateur du 14 octobre 2026

La priorité est de rendre chaque parcours facile à quitter et à reprendre. Les problèmes les plus nets concernent le retour à l’Arène dans le Placard, les fermetures qui défilent hors écran, les fenêtres superposées et le comportement du bouton Retour. Le mobile représente 90 % des utilisateurs selon le cadrage fourni : les corrections et leur recette doivent commencer sur téléphone.

Ce bilan décrit les problèmes relevés avant correction dans les parcours clients et joueurs. Après validation du plan, les corrections ont été implémentées dans le dépôt local ; le suivi de réalisation et les preuves de recette figurent en fin de document. Aucune publication n’a été effectuée. Les travaux déjà présents dans l’entrepôt ont été conservés.

## Périmètre et niveau de preuve

Revue du code et des styles : accueil actif, navigation globale, compte et authentification, Arène, Placard et ses activités, carnet, albums, boutique, producteurs, produits, panier, livraison, retours de paiement, commentaires et cookies. L’administration n’entre pas dans ce périmètre destiné aux utilisateurs du site.

Vérifications navigateur dans Chromium local, avec composants et styles réels, données fictives et adaptateurs Next :

- Placard et collection : 320 × 568, 390 × 844, 430 × 932, paysage 844 × 390, ordinateur 1440 × 900. Les activités de destination sont simulées ; leur contenu n’est donc pas validé par cette sonde.
- Détail de carte et carnet : 320 × 568, 390 × 844, 844 × 390 et 1440 × 900.
- Fiche producteur et médias : 390 × 844 et 1440 × 900, Analyse et Vidéo.
- Menu global : script existant passé à 320 × 740, 390 × 844, 667 × 390, puis passage à 1440 px ; invité/membre, liens longs, focus et fermeture.
- Panier : **16 scénarios passés**, aucune erreur JavaScript, à 320 × 740, 390 × 844, 667 × 390 et 1440 × 1000 : invité, membre, vide et noms longs. Sonde dérivée du script existant avec brouillon de livraison adapté, bonus simulés indisponibles, paiement et Point Relais simulés. Cela valide les interactions locales du panier, pas la transaction ou les services externes.

**Navigateur** signifie reproduit dans ces conditions. **Code** signifie mécanisme identifié dans les composants actifs. **À vérifier** désigne une hypothèse ou un effet dépendant du navigateur, du réseau ou du contenu. Il reste une recette sur Safari iPhone et Chrome Android physiques, avec compte connecté, clavier réel et backend de test. Les paiements, ventes et autres actions réelles n’ont pas été déclenchés. Les performances de production ne sont pas mesurées par ces aperçus.

## Corrections prioritaires

P1 désigne une sortie difficile, une interaction inaccessible, une perte de travail ou une reprise manquante. P2 désigne le confort, la compréhension et la continuité du parcours. La priorité ne constitue pas une mesure de fréquence en production.

### P1 Sorties et fenêtres

**UX01 — Retour à l’Arène enfoui dans le Placard. Navigateur, mobile et ordinateur.** Sur mobile, il faut ouvrir Menu puis chercher après neuf activités et l’aide. À 320 × 568, le lien commence vers y = 778 : il est entièrement hors écran à l’ouverture. Son texte mesure 11 px. À 390 × 844 il est visible tout en bas du tiroir, mais reste absent de l’écran de jeu. Sur ordinateur, il est au pied de la barre latérale, également en 11 px. Ce constat porte sur sa position et sa hiérarchie visuelle ; il ne démontre pas un contraste de couleur insuffisant.

Correction : un bouton explicite **« Retour à l’Arène »**, visible sans ouvrir un menu, dans un en-tête compact qui reste accessible en défilant. Même vocabulaire et même présentation dans le Placard et le carnet ; conserver « Le quartier » pour le retour interne au jeu. Prévoir la variante paysage sans cumuler trop de barres fixes.

Sources : `src/components/placard/KqPlacardNavigation.tsx:45–63`, `PlacardPlayerShell.module.css:16–17,39–46`. Preuves : [menu au début](../output/ux-audit-2026-10-14/shell/menu-top-320.png), [menu en bas](../output/ux-audit-2026-10-14/shell/menu-bottom-320.png), [ordinateur](../output/ux-audit-2026-10-14/shell/initial-1440.png).

**UX02 — La croix du menu Placard disparaît en descendant. Navigateur, petit mobile et paysage.** À 320 × 568, après défilement jusqu’au retour Arène, la croix se retrouve à y = −270 px ; en paysage, à −448 px. Il reste possible de remonter ou de toucher le fond extérieur, mais la fermeture explicite a disparu.

Correction : séparer l’en-tête de fermeture de la liste défilante, ou rendre cet en-tête permanent. Garder une cible d’au moins 44 px, déjà présente sur ce bouton. Source : `PlacardPlayerShell.module.css:28–31` ; mêmes captures qu’UX01.

**UX03 — Même défaut dans les fenêtres de l’album, avec comportement clavier incomplet. Navigateur pour le détail de carte ; code pour récompenses et doublons.** À 320 × 568, après 124 px de défilement dans une carte, sa croix de 40 × 40 px sort de l’écran. Le défaut apparaît aussi en paysage. Échap ne ferme pas cette fenêtre, le focus reste sur le bouton d’origine et peut atteindre le contenu derrière. À 390 × 844 avec cette carte courte, la croix reste visible : le défaut dépend bien de la hauteur et du contenu.

Correction : en-tête permanent « Fermer », corps seul défilant, focus déplacé dans la fenêtre puis restitué, fond inerte, Échap sur ordinateur. Appliquer aussi cette structure au détail commande, dont la fermeture est dans la zone défilante. Sources : `lottery/CardDetailModal.tsx:31–48`, `lottery/AlbumExperience.module.css:850–869,1103–1114`, `account/OrderDetailModal.tsx:164–190`. Preuve : [carte après défilement](../output/ux-audit-2026-10-14/album/card-bottom-320.png).

**UX04 — Analyse et Vidéo s’ouvrent derrière la fiche producteur. Navigateur, mobile et ordinateur.** Parcours : boutique → producteur → un produit → Analyse/Vidéo. La fiche producteur a une couche à 500, les médias une couche à 150. Les quatre combinaisons testées sont masquées ; le point situé au centre du média appartient à la fiche producteur. Échap ferme aussi la fiche parente, au lieu de fermer uniquement le média.

Correction : une gestion commune des fenêtres imbriquées ; seul le niveau supérieur reçoit les interactions et Échap. Sa fermeture doit restituer la fiche producteur et sa position. Sources : `globals.css:8225–8228`, `boutique/ProductAnalysisModal.tsx:69`, `ProductVideoModal.tsx:40`, `ProductCardActions.tsx:92–109,160–173`. Preuves : [mobile](../output/ux-audit-2026-10-14/producer/hidden-analysis-390.png), [ordinateur](../output/ux-audit-2026-10-14/producer/hidden-analysis-1440.png), [mesures](../output/ux-audit-2026-10-14/producer/report.json).

**UX05 — Les fenêtres du jury ne partagent pas le comportement des dialogues récents. Code, mobile et ordinateur.** Leurs fonds sont à `z-index:80`, contre 100 pour le dock mobile : celui-ci peut rester devant et masquer des actions basses. Les confirmations n’ont pas de gestion commune du focus, d’Échap et du verrouillage du fond. Certains verdicts disposent déjà d’un bouton « Fermer » sticky : il faut le préserver, pas le recréer inutilement.

Correction : migrer confirmations et verdicts vers le même dialogue que les autres fenêtres, avec une couche supérieure au dock et un contenu de fond réellement inactif. Vérifier les verdicts longs et les confirmations en petite hauteur. Sources : `placard/KanabQuestDicePrototype.tsx:2142–2196,2644`, `KanabQuestDicePrototype.module.css:134`, `PlacardPlayerShell.module.css:42`. Recouvrement réel des boutons à reproduire sur les différents états du jury.

**UX06 — Une requête jury suspendue bloque les moyens de fermeture prévus. Code, condition réseau.** Annuler/Retour et le fond cliquable sont désactivés pendant `matchmakingLoading`, sans délai maximal explicite sur ces requêtes. Une attente prolongée peut donc enfermer l’utilisateur dans la confirmation. Les packs et le profil ont déjà des délais : ce défaut n’est pas général à tout le jeu.

Correction : attente bornée, message actionnable et possibilité de quitter la présentation. Après une soumission, distinguer « fermer cet écran » de « annuler l’action serveur » ; au retour, relire le résultat avant toute nouvelle tentative pour éviter les opérations en double. Sources : `KanabQuestDicePrototype.tsx:559–568,2143–2144,2196`, `src/lib/kanab-quest-api.ts:241–246,283–285`.

### P1 Continuité et premières visites

**UX07 — Retour ferme la collection et change aussi d’activité. Navigateur.** Après Quartier → Culture → Collections, Retour navigateur ferme Collections et revient au Quartier. Il ne retrouve donc pas Culture, pourtant visible juste avant l’ouverture de la collection. Reproduit dans les cinq formats du Placard. Les activités sont historisées, la collection est seulement un état local.

Correction : définir un contrat partagé : Retour ferme d’abord la couche active, puis revient à l’activité précédente. Traiter ouverture directe, navigation explicite, Retour/Avance et fenêtres imbriquées sans accumuler d’entrées d’historique inutiles. Le menu global présente une logique similaire à contrôler sur téléphone réel. Sources : `PlacardPlayerShell.tsx:148,161,188–203`, `navigation/MobileNavigation.tsx:25–35`.

**UX08 — Le plan d’entrepôt non enregistré se perd lors d’un changement d’activité. Code.** Le brouillon réside dans le composant ; Culture/Quartier le démontent sans garde de sortie. Le bouton Enregistrer existe, mais rien ne protège le travail oublié.

Correction : conserver un brouillon identifié par compte et révision, et proposer à la sortie « Continuer l’édition », « Enregistrer », « Abandonner ». Ne pas enregistrer automatiquement un aménagement qui entraîne un débit : le coût doit rester confirmé. Sources : `placard/KqWarehouse.tsx:162,195–213,437`, `PlacardPlayerShell.tsx:124–148,257`.

**UX09 — La politique cookies reste derrière la fenêtre de consentement. Code.** En première visite, « Lire la politique cookies » change de page, mais la fenêtre reste ouverte tant qu’aucun choix n’est fait. Il n’existe pas non plus de bouton consommant `openSettings`, alors que l’interface promet de pouvoir rouvrir les préférences.

Correction : permettre de lire la politique sans devoir d’abord choisir, avec retour clair au choix ; ajouter « Gérer mes cookies » au footer et dans la page dédiée. Sources : `cookies/CookieConsentProvider.tsx:38–65,73,112`, `CookieConsentModal.tsx:205–207,237–242,304–309`, `Footer.tsx:105`.

**UX10 — La popup nouveautés peut devenir non fermable ou interrompre une autre fenêtre. Code, conditions spécifiques.** Sa fermeture écrit dans `localStorage` avant de fermer : si le stockage lève une erreur, la croix, le fond et Échap échouent. Avec des produits mis en avant, elle peut apparaître après 2,2 secondes sans arbitrage avec les cookies ou une saisie ; les pages de compte et de contrôle d’âge ne sont pas exclues.

Correction : fermer indépendamment de la mémorisation ; protéger le stockage par `try/catch`. N’afficher qu’une interruption prioritaire à la fois, différer les nouveautés et exclure les parcours d’accès. Source : `NewProductsPopup.tsx:82–87,100–107,129–166`. Injecter les erreurs de stockage et ouvrir plusieurs couches lors de la recette.

**UX11 — Livraison et paiement ne proposent pas toujours une reprise claire. Code ; paiement tardif à confirmer en exécution.** Point Relais dit « Réessaie dans quelques secondes » sans bouton de relance ; attendre ne relance pas la recherche. Le retour de paiement prévoit dix rafraîchissements à deux secondes d’intervalle, mais son texte continue de demander d’attendre ; la durée effective dépend des remontages de l’effet.

Correction : « Réessayer » près de l’erreur de livraison, sans ressaisie ; état d’attente prolongée du paiement avec « Vérifier le statut » et « Voir ma commande ». Ne pas inciter à payer une seconde fois. Sources : `MondialRelayPicker.tsx:101–113`, `checkout/VivaPaymentReturnEffects.tsx:30–39`, `VivaPaymentReturnPage.tsx:117–119`.

## Améliorations de deuxième priorité

| Référence | Constat | Action proposée |
| --- | --- | --- |
| UX12 Carnet | Navigateur : le lien « L’Arène » est un texte de 12 px sans bouton matérialisé. La croix replie le livre et reste dans le carnet ; elle ne quitte pas la page. Sa cible de 44 px est déjà correcte. | Rendre la sortie Arène évidente et renommer l’action locale « Replier le carnet ». Source : `contest/ContestTastingBook.tsx:174,225–227`, CSS `:33–36`. |
| UX13 Formulaires | Code : compte et livraison utilisent beaucoup de placeholders, qui disparaissent pendant la saisie ; téléphone/code postal n’ont pas toujours les claviers adaptés. | Libellés persistants, autocomplete, clavier téléphone, mode numérique pour CP, afficher/masquer le mot de passe, erreurs liées aux champs et annoncées. Sources : `account/AccountLoginForm.tsx:50–70`, `AccountRegisterForm.tsx:95–200`, `CartDrawer.tsx:765–857`. |
| UX14 Achat mobile | Code : le résumé sticky du panier est réservé aux largeurs ≥900 px. Dans une fiche produit à une colonne, l’achat arrive après la galerie et la description. | Rendre le total et l’action facilement accessibles après défilement ; bandeau mobile compact seulement lorsque l’action originale est hors écran. Ne pas masquer livraison, messages ou contenu. Sources : `CartDrawer.module.css:112–122`, `app/boutique/[category]/[slug]/page.tsx:244–321`. |
| UX15 Conservation du contexte | Code : filtres boutique et écrans de l’album sont en état local. Le Placard force le début d’activité et désactive la restauration native du scroll. | URL pour les états utiles à partager/recharger ; restauration de la position sur Retour, tout en conservant la protection contre les sauts vers le footer. Sources : `boutique/BoutiquePageClient.tsx:70–73`, `account/CollectionAlbumClient.tsx:100–133`, `hooks/useGameViewport.ts:42–47`. |
| UX16 Erreurs de saisie | Code : réinitialisation du mot de passe et commentaire ont un `try/finally` sans message de panne réseau. Le retour de connexion pour commenter mène à `/blog`, pas à l’article. | Conserver les données, annoncer l’échec, proposer Réessayer ; revenir à l’article et aux commentaires. Sources : `account/PasswordResetRequestForm.tsx:29–57`, `blog/BlogCommentSection.tsx:65–78,124`. |
| UX17 Navigation ordinateur | Code : pas d’état actif sur les liens desktop. Sous 1180 px, logo masqué et texte réduit à 0,64 rem. Le débordement avec beaucoup de liens CMS reste à tester. | État actif, texte lisible, regroupement des liens secondaires et breakpoint dépendant de l’espace disponible. Sources : `Navbar.tsx:202–231,306–340`, `globals.css:9367–9378`. |
| UX18 Gestes et accessibilité | Code/à vérifier : en mode édition, le plan capte les gestes avec `touch-action:none`. Le bandeau défilant reste animé malgré la réduction des mouvements. Pas de lien d’évitement global. | Mode de manipulation clairement signalé, sortie « Terminer » et zone de scroll atteignable ; arrêter le bandeau en mouvement réduit ; ajouter « Aller au contenu ». Sources : `KqWarehousePlan.module.css:69–72,166`, `globals.css:9685–9690`, `app/layout.tsx:237–240`. |

La possibilité de défiler autour des cartes et plans doit être jugée sur téléphone physique. Un geste capté par une carte n’est pas, à lui seul, la preuve d’une impasse.

## Éléments à conserver

- Le menu global dispose d’un dialogue natif, d’une fermeture persistante, de grandes cibles et d’une restitution du focus ; sa vérification navigateur est passée.
- Le panier possède déjà une fermeture de 44 px et un en-tête séparé du contenu défilant ; ses 16 scénarios locaux passent. C’est une base utile pour harmoniser les autres fenêtres.
- Collections récentes et ouverture des boosters ont déjà des mécanismes de fermeture plus complets que certaines anciennes fenêtres.
- Le Placard possède une navigation d’activité par URL, un état actif, des zones sûres pour le dock et un feedback de navigation.
- Le carnet conserve ses brouillons de dégustation ; le profil a déjà une fermeture sticky. Ces mécanismes doivent survivre à la refonte.
- L’accueil actif est `HomeEditorialExperience`, avec actions placées avant la grande illustration sur mobile. Ne pas réimplémenter les anciens composants d’accueil.

## Plan d’implémentation

### Lot 1 Rendre les sorties fiables

Traiter UX01–06, la fermeture de popup d’UX10 et la clarté du carnet UX12. Commencer par les corrections visibles du retour Arène et de la croix du menu, puis partager une structure de dialogue : en-tête permanent, contenu défilant, fermeture explicite, gestion du focus, du fond et des couches.

Réutiliser `useBodyScrollLock` et les bonnes implémentations existantes. Remplacer progressivement les fenêtres ad hoc de l’album, du jury, du détail commande et des médias. Borner l’attente jury sans confondre fermeture et annulation serveur.

**Acceptation :** chaque écran et chaque fenêtre possède une sortie explicite visible au début et en fin de contenu, y compris à 320 × 568 et en paysage. Un média s’affiche au-dessus du producteur ; fermer le média conserve la fiche. Une requête suspendue aboutit à un état compréhensible avec reprise.

Estimation indicative : **2 à 3 jours de réalisation**, après fixation des comportements communs.

### Lot 2 Fiabiliser Retour et les reprises

Traiter UX07–11 et UX15. Définir l’historique des fenêtres au-dessus des routes actuelles, puis protéger les brouillons de l’entrepôt et restaurer scroll/filtres. Ajouter l’accès aux préférences cookies et l’arbitrage des interruptions. Ajouter les reprises de livraison et de statut de paiement.

Le contrat Retour dépend du système de fenêtres du lot 1. Pour les actions qui modifient le jeu ou une commande, toujours vérifier le résultat serveur avant de réessayer ; aucune relance automatique d’une opération incertaine.

**Acceptation :** Culture → Collections → Retour reste dans Culture ; Retour/Avance fonctionne aussi après un lien direct. Un aménagement non enregistré n’est jamais perdu silencieusement. Le réseau peut être coupé puis rétabli sans ressaisie complète ni double action.

Estimation indicative : **2 à 3 jours**.

### Lot 3 Améliorer les parcours mobiles et ordinateur

Traiter UX13–14 et UX16–18. Améliorer les formulaires, les messages d’erreur et l’accès au total sur mobile. Ajuster la navigation desktop/tablette, les états actifs, le comportement des plans et la réduction des animations.

Privilégier les actions principales, avec un seul bandeau utile à la fois. Vérifier les champs avec le clavier ouvert et les boutons près des bords ; les zones tactiles visées sont de 44 à 48 px. Le repère de 44 px correspond au critère renforcé AAA du W3C, pas à une affirmation de conformité globale du site. Voir [Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). Pour les fenêtres, suivre [le modèle de dialogue modal W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) : focus contenu, Échap et retour du focus.

**Acceptation :** chaque champ conserve un libellé visible après saisie ; une erreur indique comment poursuivre. Total et achat restent faciles à retrouver sans masquer le contenu. La rubrique active est identifiable sur ordinateur, le clavier permet de quitter les fenêtres, le mouvement réduit est respecté.

Estimation indicative : **2 à 3 jours**.

### Lot 4 Recette et publication progressive

Prévoir **1 à 2 jours** de recette, intégrés aux lots puis complétés sur appareils physiques. Ordre conseillé : sorties et fenêtres en premier, continuité ensuite, confort enfin. L’ensemble représente **7 à 11 jours de réalisation et recette à titre indicatif**, pour une personne connaissant le projet, hors incident backend ou changement de périmètre.

| Axe | Cas à valider | Résultat attendu |
| --- | --- | --- |
| Téléphones | 320, 360, 390, 430 px ; portrait/paysage ; Safari iOS et Chrome Android | Sorties accessibles, aucune action recouverte, aucun défilement horizontal involontaire |
| Clavier mobile | Connexion, inscription, livraison, commentaire, notes | Champ et erreur visibles ; fermeture accessible ; scroll restauré quand le clavier se ferme |
| Fenêtres | Haut/bas de contenu, fenêtres imbriquées, Échap, clic extérieur | Seule la fenêtre supérieure se ferme ; son parent et sa position sont conservés |
| Navigation | Retour Android, geste Safari, Retour/Avance desktop, lien direct, rechargement | Couche puis activité ; pas de saut inattendu ni historique pollué |
| Données | Brouillon d’entrepôt, notes carnet, coordonnées et filtres | Pas de perte silencieuse ; séparation des données entre comptes |
| Défaillances | Offline, requête suspendue, 401/403/500, stockage indisponible | Message utile, sortie possible, reprise sans répétition d’une mutation |
| Ordinateur | 768, 1024, 1280, 1440 px ; clavier ; zoom 200 % | Menu lisible, état actif, focus visible et correctement restitué |
| Accessibilité | Mouvement réduit, lecteur d’écran sur dialogues/formulaires | Fond inerte, titres et erreurs annoncés, pas d’animation imposée |

Actualiser les tests de parcours au fil des corrections. Certains scripts existants sont en retard sur l’application : l’audit de navigation attend encore la carte v5 alors que le composant affiche v6 ; le scénario panier ne fournissait plus le brouillon de livraison ni les lectures des nouveaux bonus. Leurs échecs initiaux ne prouvent pas un défaut du site. Les sondes adaptées restent isolées dans `output/`.

Avant publication, exécuter les tests ciblés du projet et la recette des parcours concernés. Pour la performance, mesurer une version de production à données représentatives : chargement de l’Arène, ouverture de collection et réactivité au toucher sur mobile modeste. Ne pas utiliser les temps de compilation de Vite comme mesure utilisateur.

## Preuves et reprise du travail

Captures et mesures dans [output/ux-audit-2026-10-14](../output/ux-audit-2026-10-14/) :

- [Placard et historique](../output/ux-audit-2026-10-14/shell/report.json)
- [Détail de carte et clavier](../output/ux-audit-2026-10-14/album/report.json)
- [Carnet](../output/ux-audit-2026-10-14/book/report.json)
- [Producteur et médias](../output/ux-audit-2026-10-14/producer/report.json)
- [Panier](../output/ux-audit-2026-10-14/cart/report.json)

Les fichiers `output/` sont des preuves locales, généralement ignorées par Git ; les joindre au suivi de correction si le bilan est partagé hors du poste. Les références de lignes décrivent l’état du code au 14 octobre 2026.

## Mise en œuvre après validation du plan

Les lots de correction sont implémentés localement. Les numéros UX ci-dessus décrivent les défauts initiaux, pas leur état après correction. Aucun changement de base de données, paiement réel, commit ou déploiement n’a été effectué.

| Références | Correction réalisée |
| --- | --- |
| UX01–02, UX12 | Bouton jaune « Retour à l’Arène » permanent dans le Placard et le carnet ; en-tête de menu conservant la fermeture pendant le défilement ; action locale renommée « Replier le carnet ». |
| UX03–05 | Socle `AppDialog` natif : fermeture permanente, corps défilant, fond inactif, focus et Échap. Migration des cartes, récompenses, recyclage, commande, producteur, médias et confirmations/résultats du jeu. |
| UX06 | Requêtes du jury bornées à 20 secondes ; fermeture disponible pendant l’attente ; réponse tardive sans réouverture imposée. En cas d’incertitude, relecture de l’état serveur puis bouton « Vérifier le résultat » si nécessaire, sans rejouer automatiquement la mutation. |
| UX07 | Historique partagé pour les fenêtres et menus : Retour ferme la couche supérieure et conserve l’activité. Navigation explicite après fermeture des entrées transitoires. |
| UX08 | Brouillon d’entrepôt identifié par compte et révision, conservé dans l’onglet ; récupération explicite si le serveur a changé. Confirmation avant navigation explicite, coût affiché avant installation. Repli mémoire si le stockage est interdit, protection au rechargement et isolation lors d’un changement de compte. |
| UX09–10 | Politique cookies consultable avant décision, préférences réouvrables depuis le footer et la politique. Nouveautés différées pendant consentement, fenêtre ou saisie ; fermeture possible même sans stockage. |
| UX11 | Relance Point Relais sans ressaisie ; délai de recherche borné. Attente de confirmation de paiement bornée puis vérification du statut et accès aux commandes. |
| UX13–14 | Libellés persistants, autocomplete et claviers adaptés ; visibilité des mots de passe, erreurs réseau annoncées. Actions mobiles contextuelles sur produit et panier, masquées pendant la saisie pour dégager le clavier. |
| UX15 | Filtres boutique et écran/collection/page de l’album conservés dans l’URL, paramètres du profil préservés. Restauration du scroll de l’album et des activités du Placard, y compris après chargement tardif, sans saut vers le footer. |
| UX16–18 | Retour de connexion vers les commentaires de l’article, conservation du texte en cas d’erreur. Navigation desktop active et lisible ; lien d’évitement, mouvement réduit ; bouton « Terminer la manipulation » du plan. |

### Recette locale après correction

Les sondes utilisent Chromium et les composants réels avec données et API simulées. Les requêtes externes sont bloquées. Les dimensions couvrent le petit smartphone, le paysage et l’ordinateur ; ces tests ne remplacent pas les gestes et claviers de vrais appareils.

- Navigation Placard : **5 formats**, retour Arène visible et cliquable, fermeture accessible en bas du menu, Retour de collection conservant l’activité. [Rapport](../output/ux-implementation/navigation/shell/report.json).
- Carnet : **4 formats**, sorties visibles, repli explicite et absence de débordement. [Rapport](../output/ux-implementation/book/report.json).
- Panier : **16 scénarios** ; parcours commerce : **8 scénarios**, incluant livraison hors ligne, délai dépassé, réponse invalide, paiement prolongé, commentaire et filtres. [Panier](../output/ux-implementation/commerce/cart/report.json), [parcours](../output/ux-implementation/commerce/flows/report.json).
- Album et URL : **5 scénarios**, mobile/desktop, Retour et rechargement, scroll, paramètres du profil, valeurs invalides et aperçu non connecté. [Rapport](../output/ux-implementation/navigation/album-url/report.json).
- Consentement, nouveautés, compte et navigation globale : **17 scénarios**, stockage bloqué, erreurs réseau, priorité des interruptions, mouvement réduit et lien d’évitement. [Rapport](../output/ux-implementation/global/report.json).
- Entrepôt : **7 scénarios**, 320/390/844/1440 px, récupération du brouillon, confirmation, Retour, enregistrement, révision ancienne, changement de compte et stockage interdit. [Rapport](../output/ux-implementation/warehouse/report.json).
- Jury : **5 scénarios**, sortie visible à 320 px, paysage et desktop ; fermeture pendant requête, réponse tardive, délai réel de 20 secondes, échec de relecture puis reprise sans seconde mutation. [Rapport](../output/ux-implementation/jury/results.json).
- Fenêtres : **30 combinaisons de fenêtre et taille d’écran**, dont carte, récompense, recyclage, commande et producteur ; contrôles complémentaires des médias imbriqués, du focus, du remplacement d’une fenêtre et de la navigation depuis une fenêtre enfant. [Rapport](../output/ux-implementation/dialogs/results.json).
- Scroll du jeu : **390 et 1440 px**, Retour/Avance, chargement tardif et vues imbriquées, priorité à la restauration jusqu’à la prochaine interaction. [Rapport](../output/game-scroll/report.json).

Les tests unitaires ciblés couvrent historique, brouillon, règles d’entrepôt, navigation, panier, checkout, cookies et authentification. TypeScript et lint ont également été exécutés sur les changements. Scripts pérennes ajoutés : `audit-ux-global.mjs`, `audit-ux-dialogs.mjs`, `audit-ux-jury.mjs`, `audit-ux-warehouse.mjs` ; le test `audit-game-scroll.mjs` a été étendu. Les autres sondes adaptées sont conservées avec leurs preuves dans `output/ux-implementation/`.

### À effectuer avant publication

Recette sur Safari iPhone et Chrome Android physiques, clavier ouvert et gestes Retour ; parcours avec compte et backend de test, puis vérification des services externes de livraison/paiement. Mesurer les performances sur une version de production représentative. Les brouillons en mémoire seule survivent aux changements de vue, mais pas à un rechargement complet si le navigateur interdit le stockage : l’interface le signale et demande confirmation avant départ explicite.
