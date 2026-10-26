# Préouverture de l’Arène

En production jusqu’au 1er novembre 2026 à 00 h 00 (Europe/Paris), tous les visiteurs voient l’onglet Arène et son accueil. Un compte client connecté peut créer et modifier son personnage, sans accès bêta. L’authentification, la validation, la limitation des requêtes et le bonus unique de spécialité restent appliqués.

Le Carnet est ouvert au public avant le jeu. Les visiteurs peuvent consulter les fleurs, leurs notes validées et le classement des fleurs. Depuis le marché ou une fiche produit, « Noter cette fleur » ouvre directement la fleur choisie et son formulaire. La connexion reste nécessaire pour enregistrer une note ; le retour de connexion conserve la fleur choisie. L’achat éligible, le pseudo, la validation, la modération et les limites de requêtes restent obligatoires. Les données personnelles d’un carnet restent liées à l’identité vérifiée du client.

Le Carnet ne dépend plus des commutateurs de bêta du jeu. `CONTEST_NOTEBOOK_ENABLED` est actif par défaut ; `false` permet une fermeture temporaire du Carnet. `PRODUCT_TASTING_STOREFRONT_ENABLED` contrôle l’affichage des notes et liens dans le marché et les fiches produits.

Pour les comptes sans accès bêta, Placard et Classement du jeu restent fermés : leur bouton d’entrée affiche « Rendez-vous le 1er novembre » et leurs liens directs renvoient vers l’accueil. Le tutoriel de jeu reste suspendu. Les API du jeu et les réclamations de récompenses du jeu renvoient 423. Les routes du Carnet, de ses profils publics et de ses avis sont accessibles avec leurs contrôles propres ; les écritures conservent notamment la vérification d’origine. Les aperçus administrateur gardent leurs protections existantes. Le développement local conserve les outils de test habituels.

Les comptes bêta et administrateurs conservent l’accès complet aux activités et au tutoriel, sous les commutateurs existants. Le middleware vérifie l’identité auprès de Supabase Auth puis lit le registre privé `contest_beta_testers` ; les cookies et métadonnées fournis par le navigateur ne suffisent jamais à accorder cet accès. Les pages et API revérifient les droits côté serveur. Le Pack des Pionniers reste bloqué jusqu’au 30 octobre 2026 à 00 h 00 (Europe/Paris) pour tous les comptes, puis devient récupérable depuis l’album, indépendamment de l’ouverture de l’Arène.

Le verrou temporel du jeu expire le 1er novembre, mais ne remplace pas les commutateurs et conditions de lancement existants : CONTEST_FEATURE_ENABLED, CONTEST_FEATURE_ALLOW_PRODUCTION, CONTEST_BETA_ACCESS_ENABLED, KQ_PLAYER_API_LIVE et son dossier de lancement. Les vérifier lors de l’ouverture publique du jeu. La distribution groupée du Pack des Pionniers reste une action à lancer à partir du 30 octobre ; aucune tâche planifiée n’a été créée.

## Remise à zéro avant ouverture du Carnet

Le 25 octobre 2026, la migration `20261025000100_reset_notebook_for_public_opening.sql` a été appliquée au projet Supabase lié. Elle a supprimé les 12 avis de test, leurs 120 notes détaillées et leur vote, ainsi que les points et badges non réclamés qui en dépendaient. La vérification distante confirme zéro avis, note, arôme, terpène et vote ; les 22 fiches fleurs et les 222 commandes sont conservées.

Une archive privée `contest_notebook_reset_archive`, inaccessible aux rôles de l’API, conserve les données précédentes. Son marqueur empêche une nouvelle exécution de supprimer les avis des clients. Les récompenses déjà attribuées et leurs reçus sont conservés pour éviter une double attribution. Les anciens brouillons du navigateur ne sont plus repris : le Carnet utilise désormais la version 2.

Rapport de vérification local : `output/notebook-public-opening/verification.json`.

L’ouverture a été publiée le même jour sur `https://www.leschanvriersbretons.com` (déploiement Vercel `dpl_Ag2StYRa6yQYHQswwjZPKE8NDeWJ`). La compilation de production et TypeScript ont réussi. Le contrôle public confirme le Carnet et les liens de notation accessibles, 17 fleurs publiées sans ancien avis, la connexion exigée pour les notes personnelles et le jeu toujours fermé. Rapport : `output/notebook-public-opening/live-verification.json`.

## Vérification

- `npx.cmd vitest run` : droits, identité, origine des requêtes, liens directs et borne exacte de lancement.
- `node scripts/audit-arena-prelaunch.mjs` : composants réels avec API simulée ; formats 320, 390, 768 et 1440 px, Carnet ouvert et jeu fermé, création/modification du personnage, accès depuis le marché et une fiche fleur, retour de connexion conservant la fleur choisie.
- `node scripts/test-notebook-public-opening-reset.mjs` et sa variante `--cascade` : remise à zéro atomique, permissions privées, conservation des achats et récompenses, réexécution préservant les nouveaux avis.
- `node scripts/test-pioneer-pack.mjs` : migrations réelles en PostgreSQL isolé, refus avant le 30 octobre et attribution dès la libération du pack.
- `node scripts/test-chanvrier-customization.mjs` : personnalisation, bonus unique et épargne en PostgreSQL isolé.
- `npx.cmd vitest run src/lib/contest-notebook-access.test.ts src/lib/arena-opening.test.ts src/components/contest/ContestArenaPage.test.ts src/app/api/contest/reviews/route.test.ts src/lib/supabase/contest-review-access.test.ts` : Carnet public, sélection de fleur conservée, compte ordinaire autorisé à soumettre, achat et modération préservés, jeu toujours fermé.
- `npm.cmd run build`, puis `next start` : accueil et Carnet 200, activités du jeu 423, Placard redirigé, notes personnelles et personnage anonymes 401.
