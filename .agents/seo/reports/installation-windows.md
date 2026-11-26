# Opérateur SEO Windows

Le 26 novembre 2026, la tâche `LCB SEO Operator` a terminé son premier cycle avec le code 0. Le relevé quotidien du 26 novembre, la sélection de la semaine du 23 novembre et le bilan de la période du 1er novembre ont abouti en une tentative chacun. L’hebdomadaire a retenu `find-report` et produit un brouillon JSON de quatre champs avec la session ChatGPT existante. Les mesures agrégées étaient indisponibles.

Un second signal a conservé trois tentatives et un seul brouillon. Le Planificateur a ensuite exécuté le signal automatique de 17 h 30. Après actualisation des scripts, la même sélection et les mêmes rapports étaient lisibles. Une fixture HTTP a vérifié les exclusions, les règles robots, l’ancre et la revalidation `304`. Les essais isolés ont confirmé les deux tentatives sur échec, le signal tardif après trois jours, l’inscription des créneaux manqués et l’arrêt d’un relevé en cours avec reprise possible.

## Créneaux

La tâche se réveille toutes les quinze minutes et à l’ouverture de session. À la vérification du 26 novembre, le prochain signal était à 17 h 45. Les prochains traitements sont prévus le vendredi 27 novembre à 07 h 00, le lundi 30 novembre à 07 h 30 et le mardi 1er décembre à 08 h 00, heure de Paris. La tâche utilise la session Windows ouverte. Au retour de la machine, elle traite le dernier créneau dû de chaque cadence et inscrit les créneaux antérieurs manqués dans le journal.

## Contrôle et rapports

Exécuter ces commandes PowerShell depuis la racine du worktree.

```powershell
& ./scripts/seo-operator/windows-task.ps1 -Action Status
& ./scripts/seo-operator/windows-task.ps1 -Action Report -Cadence daily
& ./scripts/seo-operator/windows-task.ps1 -Action Report -Cadence weekly
& ./scripts/seo-operator/windows-task.ps1 -Action Report -Cadence monthly
```

`Status` indique le dernier signal, le prochain réveil du Planificateur, les créneaux dus et les dernières erreurs. Un signal vieux de plus de 28 minutes remonte comme tardif. Les rapports et agrégats se consultent dans la session locale. Déposer la sortie validée de l’import sous le nom `metrics-summary.json` dans `%LOCALAPPDATA%\LCB\SeoOperator\state`.

Ajouter `-Json` à `Report` pour le détail. Le prochain bilan mensuel indiquera les écarts entre deux périodes comparables de 28 jours, les variations observées par page, l’état technique et les questions du panel IA encore à observer.

## Pause, arrêt et reprise

```powershell
& ./scripts/seo-operator/windows-task.ps1 -Action Pause
& ./scripts/seo-operator/windows-task.ps1 -Action Resume
& ./scripts/seo-operator/windows-task.ps1 -Action Stop
& ./scripts/seo-operator/windows-task.ps1 -Action Start
```

`Pause` laisse finir l’opération en cours et suspend les suivantes, tout en conservant le signal horaire. `Stop` désactive les prochains signaux et demande l’annulation de l’opération active. `Start` réactive le Planificateur et lance un contrôle des créneaux dus. Une réservation de brouillon survit à un arrêt. Chaque lot de contenu déjà sélectionné reste écarté du registre. Son ancre publique permet aussi de reconnaître un lot déjà publié après une restauration.

## Sauvegarde de l’état

Après `Stop`, attendre que la tâche soit dans l’état `Disabled` et que `state\run.lock` ait disparu. Archiver localement le dossier `%LOCALAPPDATA%\LCB\SeoOperator\state` entier. Pour une restauration, placer le dossier archivé au même emplacement pendant l’arrêt, vérifier `Status`, puis lancer `Start`. Conserver l’état le plus récent afin de préserver les réservations et plafonds. L’installation ou l’actualisation avec `-Action Install -EnableCodexDrafts` renouvelle la copie des scripts et leurs empreintes, avec l’état durable existant. Les futurs brouillons emploient `gpt-6.2-sol` via la session ChatGPT locale.
