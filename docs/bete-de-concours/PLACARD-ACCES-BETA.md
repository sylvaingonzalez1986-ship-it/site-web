# Bêta publique de Kanab Quest

Tout joueur peut entrer dans le Quartier avec un compte gratuit. Un visiteur qui ouvre `/arene/placard` est dirigé vers la connexion et retrouve ensuite sa destination. Les cartes, les cultures et la progression sont rattachées à l’identité vérifiée de son compte. Le hall, le Carnet et les classements sont consultables sans connexion.

## Réglages de production

Pour ouvrir la bêta après la préouverture de l’Arène, le déploiement utilise les valeurs suivantes.

```dotenv
CONTEST_FEATURE_ENABLED=true
CONTEST_FEATURE_ALLOW_PRODUCTION=true
CONTEST_BETA_ACCESS_ENABLED=false
```

Sur ce déploiement, une consultation anonyme de `GET /api/contest/access` doit renvoyer `activitiesOpen: true`. Une lecture anonyme de `GET /api/arena/placard/bootstrap` doit renvoyer 401. Un compte ordinaire connecté peut créer son personnage et retrouver sa partie.

Pour repasser en test privé pendant la bêta, définir `CONTEST_BETA_ACCESS_ENABLED=true` et redéployer. Les comptes autorisés proviennent du registre serveur `contest_beta_testers` et de la liste d’administration. Les lots réels conservent leurs contrôles dédiés. Le lancement de la saison dotée utilise `KQ_PLAYER_API_LIVE`, les cinq validations et le dossier de saison.
