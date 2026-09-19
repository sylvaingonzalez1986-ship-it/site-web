# Préouverture de l’Arène

En production jusqu’au 15 octobre 2026 à 00 h 00 (Europe/Paris), tous les visiteurs voient l’onglet Arène et son accueil. Un compte client connecté peut créer et modifier son personnage, sans accès bêta. L’authentification, la validation, la limitation des requêtes et le bonus unique de spécialité restent appliqués.

Pour les comptes sans accès bêta, Carnet, Placard et Classement changent normalement le décor. Leur bouton d’entrée affiche « Rendez-vous le 15 octobre ». Les liens directs renvoient vers l’accueil avec le décor correspondant et la bulle ouverte. Le tutoriel de jeu est suspendu pour ces comptes. Les API publiques d’activité renvoient 423 ; seules la visibilité du menu et la lecture/écriture du personnage sont disponibles. Les aperçus administrateur gardent leurs protections existantes. Le développement local conserve les outils de test habituels.

Les comptes bêta et administrateurs conservent l’accès complet aux activités et au tutoriel, sous les commutateurs existants. Le middleware vérifie l’identité auprès de Supabase Auth puis lit le registre privé `contest_beta_testers` ; les cookies et métadonnées fournis par le navigateur ne suffisent jamais à accorder cet accès. Les pages et API revérifient les droits côté serveur. Le Pack des Pionniers reste bloqué jusqu’au 15 octobre pour tous les comptes.

Le verrou temporel expire à cette date, mais ne remplace pas les commutateurs et conditions de lancement existants : CONTEST_FEATURE_ENABLED, CONTEST_FEATURE_ALLOW_PRODUCTION, CONTEST_BETA_ACCESS_ENABLED, KQ_PLAYER_API_LIVE et son dossier de lancement. Les vérifier lors de l’ouverture publique. La distribution groupée du Pack des Pionniers reste une action à lancer le 15 octobre ; aucune tâche planifiée n’a été créée.

## Vérification

- `npx.cmd vitest run` : droits, identité, origine des requêtes, liens directs et borne exacte de lancement.
- `node scripts/audit-arena-prelaunch.mjs` : composants réels avec API simulée ; formats 320, 390, 768 et 1440 px, trois décors, bulle, création/modification et visiteur déconnecté.
- `node scripts/test-pioneer-pack.mjs` : migration réelle en PostgreSQL isolé, refus avant lancement et attribution à l’ouverture.
- `node scripts/test-chanvrier-customization.mjs` : personnalisation, bonus unique et épargne en PostgreSQL isolé.
- `npm.cmd run build`, puis `next start` : accueil 200, activités 423, pages internes redirigées, personnage anonyme 401.
