# Retour aux PBI par passage complet

La migration `20261118000100` permet de revenir aux anciennes fonctions de soin tout en conservant les cultures, la trésorerie, le stock en m² et les reçus avec leurs coordonnées. Les anciennes fonctions ne peuvent utiliser le reliquat en m² que lorsqu’il couvre un passage complet sur la culture choisie.

## Préparer les deux versions

Depuis la racine du dépôt, utiliser `psql` avec la connexion de recette locale configurée et le rôle propriétaire des fonctions. La commande suivante enregistre les définitions installées de la boutique, de l’achat, de l’application et du rejeu. L’exécuter **avant** la migration. Pour une base déjà migrée, produire ce premier fichier sur une copie de recette arrêtée à la migration précédente.

```powershell
$env:PGCLIENTENCODING = 'UTF8'
psql -X -qAt -v ON_ERROR_STOP=1 -f scripts/sql/capture-kq-care-version.sql -o soins-passages.sql
```

Exécuter la même capture **après** la migration, avec `-o soins-secteurs.sql`. Conserver les deux fichiers avec les versions applicatives correspondantes. Les restaurations utilisent la colonne `target` et les fonctions privées installées par la migration.

## Revenir à l’ancienne version

L’ancien moteur interprète un auxiliaire à l’échelle de toute la culture et refuse certaines sauvegardes ayant deux applications du même produit au même bilan. Laisser terminer les cultures ou campagnes portant des plants infestés ou des applications ciblées. Suspendre ensuite les requêtes de jeu, y compris les actions en vol, pendant le changement de version.

```powershell
psql -X -v ON_ERROR_STOP=1 -f soins-passages.sql
```

Le script vérifie sous verrou les trois listes `care.problems`, `care.applications` et `care.interventions` des cultures actives. Si une liste contient un champ `plants` ou une `target` correspondant à son type, la transaction s’arrête avec `kq_care_active_spatial_runs`. Reprendre alors ces parties avec le moteur par secteurs. Après un retour réussi, remettre en service la version applicative par passages.

Les archives gardent leur JSON complet. Pour relire les archives ciblées, utiliser la version par secteurs. Les essais conservés dans le navigateur échappent au contrôle PostgreSQL. Pour poursuivre un tel essai, conserver le stockage du même navigateur et de la même origine, puis le rouvrir avec la version par secteurs.

## Réactiver les secteurs

Suspendre les requêtes de jeu, restaurer les fonctions, puis remettre en service la version applicative par secteurs.

```powershell
psql -X -v ON_ERROR_STOP=1 -f soins-secteurs.sql
```

La recette `node scripts/test-placard-culture-care.mjs` exerce les deux scripts dans PostgreSQL local isolé. Elle compare les sauvegardes, soldes, quantités, heures et reçus avant et après chaque restauration, puis vérifie un achat, une application et le rejeu des reçus des deux versions.

## Revenir aux seuls auxiliaires par secteur

La migration `20261118000400` étend les secteurs aux quatre intrants. Avec la version actuelle du script de capture, enregistrer les fonctions **avant** cette migration dans `soins-pbi-secteurs.sql`, puis **après** dans `soins-tous-secteurs.sql`. Pour une base déjà migrée, produire la première capture sur une copie de recette arrêtée avant `20261118000400`. Ces captures incluent la fonction qui exprime la réserve en passages ou en m².

Pour revenir à la version où seuls les auxiliaires s’appliquent par secteur, suspendre les requêtes de jeu puis restaurer `soins-pbi-secteurs.sql` avec la commande `psql` ci-dessus. Le contrôle sous verrou refuse la restauration avec `kq_care_active_input_sectors` tant qu’une culture active contient un intrant ciblé ou des plants localisés pour un trouble autre que les pucerons, les thrips ou les tétranyques. Laisser les joueurs terminer ces cultures avec la version complète. Pour la réactiver, suspendre les requêtes puis restaurer `soins-tous-secteurs.sql` et sa version applicative. La recette vérifie le reliquat des intrants dans les deux versions.
