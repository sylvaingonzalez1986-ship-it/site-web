# Recette locale du lot 3

La campagne synthétique a produit et vendu 638,7 g en trois lots. Les trois analyses totalisent 135 €. La recette vérifie aussi une analyse à 45 €, une interruption avant récolte sans analyse et seize anciennes factures d’analyses conservées à l’identique. Le rapprochement vérifie le même reçu, le même stock et le même solde après rejeu. La note du jury est fixée à 9/10 dans la fixture et les horloges de conservation sont avancées pour atteindre l’échéance. [Rapprochement chiffré](fiabilite-rapprochement.json)

PostgreSQL 18.7 a exécuté 1 005 contrôles cumulés. Les deux connexions `service_role` ont attendu l’une après l’autre sur une même révision de plan, sur la dernière dose partagée de protection biologique et sur une vente du même stock. La tentative concurrente a été refusée dans chacun des trois cas. La course aux intrants oppose deux consommations de la dose. [Contention mesurée](fiabilite-contention.json)

`warehouse_condition_invalid` venait d’un catalogue historique. Pour `MH-TS1000`, `SJ-DF16E350` et `SIM-WATER-02`, les bases historiques étaient respectivement de 14 900, 14 900 et 1 900 cts. La migration des tarifs les fait concorder avec les nouvelles bases de 19 295, 16 200 et 271 cts. La fixture charge aussi la migration existante qui calcule l’exemption de pose du chariot à partir du tarif courant. Les recettes de l’usure, de la postrécolte et de la capacité ont respectivement validé 875, 1 044 et 159 contrôles, avec des tests communs entre les deux premières.

## Relancer sous Windows x64

Depuis la racine du dépôt avec les dépendances Node du projet installées, récupérer les versions utilisées par la recette et initialiser le cluster local dans le répertoire de sortie. Les téléchargements nécessitent un accès au registre npm. Le serveur écoute uniquement en boucle locale. Le dossier de données peut être réutilisé pour une nouvelle recette.

```powershell
$kqPgRoot = Join-Path $PWD 'output/placard-reliability/postgres'
New-Item -ItemType Directory -Path $kqPgRoot -Force | Out-Null
npm.cmd pack @embedded-postgres/windows-x64@18.7.0-beta.19 --pack-destination $kqPgRoot
npm.cmd pack postgres@4.1.1 --pack-destination $kqPgRoot
tar -xzf (Join-Path $kqPgRoot 'embedded-postgres-windows-x64-18.7.0-beta.19.tgz') -C $kqPgRoot
$kqPgClient = Join-Path $kqPgRoot 'client'
New-Item -ItemType Directory -Path $kqPgClient -Force | Out-Null
tar -xzf (Join-Path $kqPgRoot 'postgres-4.1.1.tgz') -C $kqPgClient
$kqPgNative = Join-Path $kqPgRoot 'package/native'
$kqPgData = Join-Path $kqPgRoot 'data'
$kqInit = Get-ChildItem -Path $kqPgNative -Recurse -Filter initdb.exe | Select-Object -First 1
if (-not (Test-Path (Join-Path $kqPgData 'PG_VERSION'))) {
  & $kqInit.FullName -D $kqPgData --username=postgres --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
}
$kqPostgres = Get-ChildItem -Path $kqPgNative -Recurse -Filter postgres.exe | Select-Object -First 1
& $kqPostgres.FullName -D $kqPgData -h 127.0.0.1 -p 55439
```

Dans un deuxième terminal à la racine du dépôt, lancer la recette. Elle vérifie l’adresse et le dossier de données du serveur avant de créer une base jetable, puis ferme les connexions et supprime cette base à la fin. `KQ_TEST_POSTGRES_PORT` permet de choisir un autre port local si celui du bloc précédent est occupé.

```powershell
$env:KQ_TEST_POSTGRES_CLIENT = 'output/placard-reliability/postgres/client/package/src/index.js'
node scripts/test-placard-shared-campaigns.mjs
```

Les fichiers générés sont `output/placard-reliability/contention.json` et `output/placard-reliability/reconciliation.json`. Une fois la recette terminée, utiliser `Ctrl+C` dans le premier terminal ou arrêter ce cluster avec `pg_ctl.exe`.

Pour la reprise navigateur, utiliser Chromium ou Chrome installé localement. La recette ouvre le catalogue avec un compte fictif, interrompt une réponse après la validation de l’achat et retrouve la même clé, les 100 doses et les 913,70 € de caisse. Elle vérifie également le refus du devis périmé et l’absence de reprise sur le second compte. Le rapport est généré dans `output/warehouse-preparation-recovery/rapport.json`.

```powershell
$env:KQ_WAREHOUSE_AUDIT_PORT = '3421'
node scripts/audit-warehouse-shop-first.mjs --recovery-only
```
