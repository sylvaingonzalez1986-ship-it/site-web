# Publication SEO restreinte

La seule proposition admissible est la variante `find-report` du guide `/analyse-laboratoire-cbd`. Le contenu et ses liens figurent déjà dans le registre relu. Le commit doit ajouter cet ID dans `src/app/analyse-laboratoire-cbd/seo-content.json` à partir du `master` courant. Seul le propriétaire peut étendre le registre ou la règle de publication pendant une revue distincte.

## Proposition et validation

Après activation, **Publication SEO restreinte** consulte le registre sur `master` et ouvre une seule PR depuis `seo/candidat/find-report` si la variation manque. `github-actions[bot]` crée le commit du sélecteur et la branche avec son jeton natif. Les ouvertures suivantes réutilisent la même PR. Une PR fermée garde le lot fermé, y compris après un retour arrière. L’identité qui propose des contenus conserve un accès de lecture.

Le workflow confirme la preview Vercel sur le SHA exact et le déploiement précédent. Il exécute ensuite la CI du dépôt sur ce SHA, le build et le rendu Next avec catalogue fictif sur boucle locale. Tout échec bloque la publication. Le déclenchement à la demande reste en lecture seule. Pour la recette locale, `node scripts/seo-release/prepare.mjs <SHA-master> find-report` renvoie un SHA et laisse les branches et le répertoire de travail intacts.

## Activation par le propriétaire

État GitHub observé le 26 novembre 2026. `master` n’a aucune règle effective. La permission par défaut des workflows est `read`, `can_approve_pull_request_reviews=false`, `SEO_RELEASE_ENABLED` est inactif et l’environnement `seo-preview` est absent. Le propriétaire peut préparer ces réglages une fois après validation du pilote.

- Le `master` observé le 26 novembre 2026 est sans protection. Dans ce cas, GitHub avance `master` sur le SHA validé avec `force: false`. Si des règles sont présentes, le workflow exige une PR et des contrôles strictement à jour dans les règles effectives pour utiliser la fusion native. Réserver les tags `seo-published/**` et `seo-production-resolved/**` au workflow et au propriétaire et les protéger contre modifications et suppressions.
- Autoriser GitHub Actions à créer des PR dans les réglages du dépôt. Le workflow appelle la CI du dépôt directement sur le SHA candidat. Les exécutions `pull_request` déclenchées par le jeton natif peuvent rester en attente d’approbation GitHub. [Jeton natif GitHub Actions](https://docs.github.com/en/actions/concepts/security/github_token)
- Vérifier que Vercel accepte les mises à jour du jeton natif, que `master` correspond à la production et que les previews sont isolées des secrets de production. Le projet observé est `site` dans `sylvains-projects-d3690ef6`. Son intégration doit renseigner les environnements Preview et Production dans GitHub. Vérifier aussi que le dernier déploiement de production permet Instant Rollback. [Vercel pour GitHub](https://vercel.com/docs/git/vercel-for-github)
- Réserver l’environnement GitHub `seo-preview` à `master`. Si une preview protégée exige un accès d’automatisation déjà disponible, déclarer `SEO_PREVIEW_BYPASS_TOKEN` uniquement dans cet environnement. Pour valider manuellement une PR pilote ouverte par un opérateur sur la branche dédiée, `SEO_RELEASE_PROPOSER_ID` peut contenir son ID GitHub numérique. La publication planifiée accepte exclusivement `github-actions[bot]`.
- Confirmer 0 € de dépense nouvelle dans les quotas et limites de facturation GitHub et Vercel, puis déclarer `SEO_RELEASE_COST_CEILING_EUR=0`. La variable bloque le workflow en l’absence de cette confirmation. Les limites de facturation effectives se règlent chez les fournisseurs.
- Après validation du premier lot et vérification de ces réglages, définir `SEO_RELEASE_ENABLED=true`. La valeur absente ou différente de `true` maintient la publication automatique en pause.

Le journal réserve au plus deux lots par semaine ISO en heure de Paris, dont au plus un nouveau contenu. Il impose 28 jours révolus entre deux lots automatiques sur la même page. L’ajout d’une section compte comme un contenu nouveau. La réservation précède la fusion et reste comptée même si GitHub la refuse ensuite. Les publications manuelles suivent le circuit du propriétaire.

## Pause et retour arrière

Une réservation `seo-published/<identifiant>` suspend automatiquement les publications jusqu’à l’apparition du tag `seo-production-resolved/<identifiant>`. Le workflow crée ce tag après vérification du SHA et du rendu publics. Après un délai dépassé ou une erreur d’accès, inspecter le déploiement et relancer le job de vérification. Cette situation suspend les publications sans modifier le site.

Pour mettre le circuit en pause, passer `SEO_RELEASE_ENABLED` à `false` et annuler les exécutions actives. Si une régression est confirmée et que le lot est le dernier déploiement actif, sélectionner **Instant Rollback** dans Vercel avec le déploiement précédent indiqué dans le résumé du job `merge`. Depuis un clone actualisé avec `git fetch origin`, `node scripts/seo-release/rollback.mjs <SHA-base> <SHA-publié>` produit un commit qui rétablit le seul fichier autorisé. Créer une branche sur ce SHA et ouvrir une PR de retour arrière. Si `master` a changé, la commande s’arrête et le propriétaire décide du correctif ciblé. Une fois le rendu rétabli et vérifié, le propriétaire peut créer le tag `seo-production-resolved/<identifiant>` sur le SHA public vérifié. Conserver la réservation dans le journal. [Instant Rollback Vercel](https://vercel.com/docs/instant-rollback)
