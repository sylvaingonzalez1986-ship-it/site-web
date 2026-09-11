# Le Placard : sol vivant commun

Toutes les cultures indoor partent sur sol vivant. Le choix d’un mode de culture et la consommation d’une carte au lancement sont supprimés. Le sol est un élément du cadre de jeu, sans bonus passif automatique sur les dés.

Les quatre cartes retirées du catalogue jouable sont `BOTTE-001` (Terreau horticole), `BOTTE-007` (Hydroponie recirculante), `BOTTE-008` (Aéroponie haute pression) et `BOTTE-009` (Sol vivant). La Botte compte désormais 32 cartes. Les amendements et outils qui sont des cartes de soutien restent disponibles.

## Comportement

- Démarrage possible avec un deck vide, sans carte installée et sans reçu de consommation au départ.
- Retrait des quatre cartes de l’album jouable, des recommandations et des tirages locaux.
- Disparition de leurs bonus passifs et de la pénalité de coupure propre à l’aéroponie ; l’incident de courant conserve sa règle commune.
- Reprise des sauvegardes locales et des decks favoris : retrait des anciens substrats, conservation de la progression et des copies de soutien.
- Conservation des fichiers d’illustration, des définitions historiques, des anciennes copies possédées et des reçus de consommation. Aucun remboursement automatique n’est ajouté.

## Migration Supabase appliquée

La migration `supabase/migrations/20260910000100_kq_living_soil_default.sql` a été appliquée le 10 septembre 2026 au projet Supabase lié `eyowwwpdmfrulhkpvlnf`. Elle permet les decks vides, remplace la fonction de démarrage, désactive les quatre cartes pour les futurs boosters et adapte les états des cultures actives aux nouvelles règles. Les cultures terminées restent archivées.

La migration doit accompagner la mise en ligne : les anciens clients qui envoient une carte de substrat au démarrage devront recharger l’application. Les contrôles de possession des cartes de soutien, de Buddie, de jetons et d’Héritage restent en place.

Application effectuée avec `supabase db push --linked --yes`, après vérification qu’elle était la seule migration en attente. La connexion authentifiée de la machine fonctionne hors de l’environnement restreint. Après application, `supabase migration list --linked` confirme la version `20260910000100` des deux côtés, et `supabase db push --linked --dry-run` confirme que la base distante est à jour. Cette opération ne déploie pas le code de l’application.

## Vérification locale

Tests du moteur, de la persistance, du catalogue, des récompenses et de l’API, dont une culture complète sans carte et la reprise des quatre anciens substrats. TypeScript et ESLint contrôlés. L’aperçu navigateur isolé utilise le vrai composant de préparation et des données locales ; il couvre 320, 390 et 1440 pixels ainsi que le démarrage sans consommation. Ses captures sont dans `output/placard-workshop/soil/`.

La migration SQL a été relue mais n’a pas été exécutée sur une instance PostgreSQL de test : Docker n’était pas accessible dans cette session.
