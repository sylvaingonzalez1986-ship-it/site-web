---
name: lcb-ui-ux
description: Examiner, maqueter ou implémenter un parcours web de la boutique ou une interface du Quartier. À mobiliser pour navigation, fiches produits, formulaires, panier, paiement, menus de jeu, HUD ou accessibilité.
---

# Web design, UI et UX

Identifie l’écran, la tâche que la personne doit réussir, l’état initial et les tailles cibles. Reproduis le parcours dans un navigateur et garde une capture de référence. Consigne le geste bloqué, l’élément qui le provoque et son effet observable. Commence par un écran quand il suffit à trancher.

- **Boutique.** Retrouve les couleurs et typographies dans `src/app/globals.css`, le composant de navigation dans `src/components/navigation/`, les actions produit dans `src/components/boutique/ProductDetailActions.tsx` et le panier dans `src/components/CartDrawer.tsx`. Pour le paiement, suis `src/components/CheckoutButton.tsx` jusqu’à l’écran concerné. Conserve le prix, les conditions, les erreurs de saisie, les choix de l’utilisateur et le récapitulatif visibles à l’étape utile.
- **Jeu.** Suis les règles de matériaux et les références de composants d’AGENTS.md. Le menu commun part de `src/components/placard/KqPlacardNavigation.tsx`. Prends les images de `docs/bete-de-concours/menu-quartier/` comme référence pour ce menu. Coordonne avec le spécialiste 3D le cadrage, le HUD, la création de personnage et les interactions entre bâtiments lorsque l’interface recouvre la scène.
- **Maquette et réalisation.** Réutilise les composants de marque. Commence par une capture annotée ou un prototype local dimensionné à l’écran cible. Si le brief demande une maquette éditable et qu’un document Pencil est ouvert, utilise le MCP configuré. Donne à chaque contrôle ses états utiles (focus, actif, indisponible avec raison) et au parcours ses états de chargement, vide, erreur et succès. Si l’implémentation est demandée, branche la variante retenue dans les routes et composants existants.
- **Recette.** Dans Chrome local avec Puppeteer, vérifie sur ordinateur et mobile, jusqu’à 320 px pour le jeu. Essaie clavier et interaction tactile, focus visible et restitué, libellés accessibles, contraste, défilement et débordements. Rejoue les états critiques avec des données de test, notamment retour, erreur et reprise du panier ou du formulaire. Utilise les fixtures pour le paiement. Lis la cible et les sorties de `scripts/audit-boutique-ui.mjs` avant usage. Reprends deux captures avec les mêmes données, dimensions, zoom et état pour comparer maquette acceptée et intégration.

Livre le parcours essayé, les tailles, les constats priorisés, la preuve et les états restant à vérifier. Indique si le résultat provient d’une prévisualisation, d’une émulation ou d’un appareil réel. Fais trancher par Sylvain les alternatives qui changent la marque, le parcours commercial ou les règles du jeu.
