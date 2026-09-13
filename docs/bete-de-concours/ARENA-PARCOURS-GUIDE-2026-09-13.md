# Parcours guidé : du Carnet au Placard

La première visite connectée sur `/profil` ou dans `/arene` propose un accueil illustré, puis neuf étapes : Carnet, collection La Botte, comptoir de la boutique, bonus du matériel, installation et charges, préparation de culture, jury, vente et missions. Le guide attend la fermeture du bandeau de consentement.

La boutique distingue les points des euros du jeu. Le rayon matériel explique la quantité potentielle des tentes, le rendement et la qualité maximale des LED, la régularité apportée par l’extraction et le climat, les prérequis, les niveaux et la consommation électrique. Une qualité maximale supérieure ne garantit pas une meilleure note. Les machines de transformation, le jury et les trois circuits de vente relient les investissements aux revenus futurs.

Pendant la visite de la boutique, le guide reste dans la fenêtre active et son parcours clavier. Ouvrir une fiche produit le masque ; la fermer le fait revenir. Sur mobile, l’explication du comptoir laisse visibles la caisse et le livre du matériel. L’étape installation ouvre maintenant l’entrepôt illustré (`view=workshop`) : box, équipements, séchoir améliorable et estimation des charges.

Les boutons **Ouvrir ici · essayer** ouvrent le Carnet, la collection ou le livre du matériel. Le joueur peut agrandir les cartes et revenir au parcours. Les boutons Suivant et Précédent changent d’étape ; ils ne soumettent aucun avis, ne lancent aucune culture et ne réclament aucune récompense. Les visites guidées de la boutique portent `guide=1` et suspendent sa réclamation automatique du pack de bienvenue. Les achats manuels restent disponibles. Le tutoriel peut être passé à tout moment puis relancé avec **Guide**. Les anciennes explications de l’Arène et du Placard restent accessibles manuellement.

## Progression et déploiement

`GET/POST /api/arena/tutorial` utilise l’identité authentifiée et le contrôle d’accès du Placard. La migration `20260913000900_arena_guided_journey.sql` ajoute une préférence par compte/version, protégée par RLS et accessible uniquement au rôle service côté serveur. Elle ne modifie pas l’économie du jeu.

Les migrations `20260913000900_arena_guided_journey.sql` puis `20260913001000_arena_journey_shop_steps.sql` doivent être appliquées à Supabase pour conserver la progression entre appareils. La seconde autorise les neuf étapes de la version 2 en conservant les lignes de la version 1. La copie locale est également isolée par compte et version. Les écritures locales en attente sont synchronisées lors d’une prochaine visite. Un navigateur bloquant le stockage peut utiliser la sauvegarde serveur ; si les deux sauvegardes échouent, le joueur peut réessayer sans perdre l’étape affichée. Une panne d’authentification/lecture ne lance pas un nouveau parcours à l’aveugle.

Les comptes existants n’ayant pas suivi cette nouvelle version reçoivent également l’invitation une fois. Le guide ne s’affiche pas dans le panier, le paiement ou les pages de catalogue.

## Vérifications

- Tests unitaires de progression, abandon/reprise, validation des données et isolation des comptes.
- Tests API : accès connecté, identité imposée côté serveur, validation, erreurs privées, migration absente.
- `node scripts/audit-arena-journey.mjs` : vrai tutoriel, vrai accueil du Placard, vraie collection, vraie boutique, vrai catalogue et vrai entrepôt ; autres pages et API simulées localement. Parcours complet, zoom, fiches produit, navigation clavier dans les fenêtres, cookies, rechargement, comptes distincts, abandon/rejeu, stockage bloqué, reprise des sauvegardes et échecs d’écriture. Aucune écriture de gameplay ni connexion à Supabase.
- Captures et rapport local dans `output/arena-journey`, sur 320, 390, 768, 1440 pixels et en paysage 844 × 390.
- Résultats : 1 163 tests sur 215 fichiers réussis ; ESLint et compilation Next.js réussis. La compilation locale signale des lectures du catalogue Supabase indisponibles pendant la revalidation du cache, sans échec de build.
- Migrations exécutées sur PostgreSQL local (PGlite) : accès du rôle service, refus des rôles publics, bornes d’étape, conservation de la version 1, sauvegarde de l’étape 9 en version 2, statuts et suppression en cascade du compte vérifiés. Aucune migration distante appliquée.
