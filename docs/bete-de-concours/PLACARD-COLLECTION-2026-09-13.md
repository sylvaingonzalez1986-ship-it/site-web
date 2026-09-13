# Album personnel La Botte

« Ma collection La Botte » est accessible dans l'en-tête de l'accueil du Placard. « Collection » reste disponible dans la navigation pendant le jeu, le marché et les missions ; la boutique possède son propre accès visible sur le comptoir.

L'album se superpose à l'activité en cours : ouvrir ou fermer la collection ne change pas la vue du Placard et ne remonte pas le composant du jeu. Son code est chargé à la demande.

Les 32 cartes du catalogue sont visibles, y compris les auxiliaires PBI et les cartes manquantes. Les exemplaires disponibles viennent de `GET /api/arena/placard/collection`, sans modification de l'inventaire. Les compteurs décrivent le stock actuel, distinct d'un historique de découverte : jouer une carte peut faire disparaître son dernier exemplaire.

Filtres : toutes, possédées, manquantes, utilité et recherche sans distinction d'accents. Les cartes manquantes sont grisées mais restent cliquables. Une erreur de chargement affiche une action Réessayer, sans présenter un stock inconnu comme une collection vide. L'album se recharge à chaque ouverture et sur l'événement `kq:collection-updated`.

Le clic ouvre la carte en grand au centre de l'écran, en couleur, avec rareté, quantité, coût, timing, situations, effet et limite en texte lisible. Le même agrandissement est disponible depuis la collection La Botte du profil.

Les fenêtres utilisent des dialogues modaux natifs : arrière-plan inactif, navigation clavier contenue dans la fenêtre, fermeture par Échap, croix ou clic à l'extérieur, puis retour du focus au bouton d'origine. Échap ferme d'abord le détail, puis l'album ; dans la boutique, elle reste ouverte et garde son verrouillage de défilement. Sur téléphone, le détail défile verticalement. Une présentation compacte préserve l'accès aux cartes en paysage.

Audit reproductible : `node scripts/audit-placard-collection.mjs`. Composants réels avec réponses locales simulées et réseau distant bloqué ; 320×740, 390×844, 768×1024, 1440×1000 et 844×390. Vérification des quantités, des filtres, des deux fenêtres, du retour de focus, de la boutique, du profil, de l'actualisation, des collections vide/complète et des erreurs réseau. Rapport et captures dans `output/placard-collection/`.
