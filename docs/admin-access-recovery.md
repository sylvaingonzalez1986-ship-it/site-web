# Préparer la reconnexion administrateur

Consigne active du 11 novembre 2026 : **l’utilisateur confirme que le jeu et l’accès local semblent rétablis, puis demande la mise en production des changements**. Cette demande remplace l’interdiction de publication précédente. La livraison inclut la configuration Vercel du mot de passe préparé ; sa valeur ne doit jamais entrer dans Git. Les étapes de diagnostic ci-dessous décrivent l’état avant cette livraison.

Configuration de livraison vérifiée le 11 novembre : `ADMIN_PASSWORD_HASH` **Production** Vercel correspond désormais exactement à l’empreinte préparée et utilisée localement. Les autres cibles Vercel gardent leur valeur précédente ; allowlist identique au local, secret de signature présent et TOTP absent. Le nouveau déploiement utilisera donc le nouveau mot de passe administrateur, après connexion au compte autorisé. Les anciens cookies admin v1 devront être renouvelés. La compilation isolée complète passe et la base satisfait 272 contrôles de métadonnées ; le suivi du déploiement est enregistré sous `output/release-20261111/`.

## Reprise du 11 novembre 2026 : erreur 503 locale

Cause confirmée hors réseau avec le vrai chargeur `@next/env` : l’empreinte de `.env.local` était valide en lecture brute mais ses caractères `$` non échappés étaient interprétés comme des références à des variables par Next.js. La valeur effective était donc invalide, provoquant un 503 de configuration pour un mot de passe non vide lorsque les contrôles précédents avaient réussi.

L’empreinte du nouveau mot de passe déjà préparé a été installée **uniquement dans `.env.development.local`**, fichier ignoré et non suivi par Git, avec les `$` échappés. Le chargeur Next confirme que l’empreinte effective de développement est valide et identique au fichier préparé. Les autres entrées de développement, `.env.local` et la configuration chargée en mode production sont inchangés. Aucun mot de passe en clair consulté ou enregistré, aucune valeur secrète affichée.

Une nouvelle requête distante `HEAD /rest/v1/admin_sessions?select=token_hash&limit=0` a renvoyé **200** : la table est accessible en lecture au moment de ce contrôle. Zéro ligne demandée, aucune mutation. Cela remplace le constat de disponibilité 404 plus ancien ci-dessous, sans prouver à lui seul toutes les opérations d’écriture. Aucune migration supplémentaire effectuée pendant ce diagnostic.

**Prochaine vérification :** redémarrer complètement le serveur de développement (`Ctrl+C`, puis `npm run dev`) et essayer le nouveau mot de passe sur `/admin/login`, avec le compte autorisé connecté. Cette connexion réelle reste à confirmer par l’utilisateur. Ne pas confondre l’empreinte locale active avec celle de Vercel, restée inchangée. L’outil hors ligne `admin-access.mjs` lit un seul fichier brut : son défaut `.env.local` vise encore l’ancienne empreinte et il n’interprète pas les échappements Next de `.env.development.local` ; ne pas utiliser son résultat comme validation de cette configuration effective.

## Historique de préparation

État au 10 novembre 2026 : l’utilisateur dispose de l’e-mail et du mot de passe de son compte et confirme pouvoir accéder à Vercel. Son iPhone conserve une session admin. Il a confirmé séparément la présence de `ADMIN_PASSWORD_HASH` et l’absence de `ADMIN_TOTP_SECRET` dans les variables Vercel Production. Il a ensuite préparé un nouveau mot de passe administrateur et confirmé sa saisie dans l’outil local. L’empreinte est enregistrée dans `output/admin-access/password-hash-1794348005361-c9e1b4a8.txt` ; son format a été vérifié sans l’afficher et le fichier est exclu de Git. **Cette nouvelle empreinte n’est pas installée dans Vercel ni dans la configuration de l’application.** Aucun accès existant n’a été changé et aucun déploiement n’a été effectué.

## Vérifier sans utiliser la session iPhone

Dans Vercel, ouvrir le projet du site puis **Environment Variables**, avec le filtre **Production**. Vérifier la présence de `ADMIN_PASSWORD_HASH` et `ADMIN_TOTP_SECRET`, et que `ADMIN_ALLOWED_EMAILS` autorise le compte prévu. Ne pas modifier ces variables pendant cette vérification. Les réglages de Vercel peuvent différer de ceux du déploiement actif : leurs modifications s’appliquent aux nouveaux déploiements. [Documentation Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

Ouvrir un terminal PowerShell sur l’ordinateur :

```powershell
Set-Location -LiteralPath 'C:\lesiteinternetquitue'
node scripts/admin-access.mjs verify-vercel
```

L’outil demande d’abord la valeur de `ADMIN_PASSWORD_HASH` copiée depuis Vercel, puis le mot de passe à vérifier. Les deux saisies sont masquées. Elles restent dans le processus local : aucun appel réseau, journal, fichier ou modification de compte. Ne fournir aucun secret dans les arguments de commande ni dans le chat.

Si le terminal indique « Empreinte administrateur absente ou invalide » avant de demander le mot de passe, le mot de passe n’a pas été testé. La saisie peut être vide/incomplète ; l’ancienne version de l’outil refusait aussi certaines variantes base64 acceptées par le site. Ce défaut de compatibilité est corrigé et les nouveaux messages distinguent ces cas sans afficher la copie.

Sous Windows, éviter le collage de l’empreinte dans le terminal avec :

```powershell
node scripts/admin-access.mjs verify-vercel --clipboard
```

**Lancer d’abord la commande**, puis, lorsqu’elle attend, copier la valeur complète depuis Vercel. Revenir au terminal et appuyer sur Entrée **sans coller**. L’outil lit alors le presse-papiers en mémoire, sans l’afficher ni l’enregistrer. Il demande ensuite le mot de passe : **le taper au clavier, ou le copier puis appuyer sur Ctrl+V dans le terminal avant Entrée**. Copier le mot de passe sans le coller ne le saisit pas. Ce mode ne change aucune configuration et n’utilise pas la session du téléphone.

- **CORRESPOND** : le mot de passe valide l’empreinte fournie. Cela confirme ce couple empreinte/mot de passe, pas encore le fonctionnement du déploiement ni l’étape TOTP.
- **NE CORRESPOND PAS** : le mot de passe du compte ne correspond pas à ce mot de passe administrateur. Aucun accès existant n’est modifié.
- Empreinte absente, invalide ou impossible à consulter : préparer un nouveau mot de passe connu via l’étape suivante, sans changer immédiatement la production.

Pour comparer uniquement au fichier local `.env.local`, utiliser `node scripts/admin-access.mjs verify`. Le résultat local ne prouve pas que Vercel emploie la même configuration. `node scripts/admin-access.mjs status` affiche uniquement des états de configuration, jamais leurs valeurs.

## Préparer un nouveau mot de passe si nécessaire

```powershell
node scripts/admin-access.mjs prepare
```

Choisir une phrase de passe de 16 à 256 caractères et la confirmer. L’outil crée une empreinte compatible avec l’application dans `output/admin-access/password-hash-….txt`, répertoire exclu de Git. Il ne conserve pas le mot de passe en clair et n’écrit dans aucun fichier d’environnement. Conserver le mot de passe dans son gestionnaire ; l’empreinte seule ne permet pas de le retrouver.

Ce fichier contient uniquement la future valeur de `ADMIN_PASSWORD_HASH`. Ne pas le publier. Son installation dans Vercel et le déploiement correspondant sont une étape ultérieure : **préparer ce fichier ne change pas l’accès au site**. Après installation et vérification, supprimer le fichier d’empreinte local devenu inutile.

Si un TOTP est déjà configuré en production, vérifier aussi que le code à six chiffres est disponible dans l’application d’authentification correspondante. Ne pas activer un TOTP inconnu ou retirer la protection pour réussir le test.

## Conditions de bascule

L’utilisateur accepte désormais une déconnexion temporaire, à condition de pouvoir se reconnecter ensuite. Cela permet de renouveler la session lors de la livraison ; la vérification préalable de la reconnexion reste nécessaire.

L’utilisateur confirme que son site local utilise **le même projet Supabase que Vercel**. `.env.development.local` ne fournit pas de base distincte : un démarrage ordinaire de développement n’est donc pas une recette isolée. Une instance dédiée sous `output/admin-rehearsal`, projet local `admin-access-rehearsal`, ports Supabase 55321/55322 et Next 55310, a permis de vérifier le cœur du parcours avec Auth et PostgreSQL réels, sans changer les fichiers d’environnement habituels. Le serveur et les conteneurs dédiés sont maintenant arrêtés ; les autres conteneurs Docker sont laissés intacts.

Vérification distante limitée : une requête **HEAD** sur `/rest/v1/admin_sessions?select=token_hash&limit=0`, avec la configuration Supabase locale dont l’utilisateur confirme qu’elle vise aussi la production, a retourné **404**. Aucune ligne, aucun contenu de réponse ni secret n’a été affiché. La disponibilité de cette table via la Data API n’est donc pas validée ; distinguer table absente, exposition et droits dans la préparation de livraison. Cette vérification n’a appliqué aucune migration ni modification distante.

1. Accès au compte autorisé disponible ; mot de passe administrateur connu et vérifié ; accès Vercel conservé ; code TOTP disponible s’il est configuré.
2. Migrations de sécurité appliquées et parcours testé dans une recette isolée avec comptes fictifs. La table `admin_sessions` et le RPC de limitation doivent fonctionner ; leur absence bloque volontairement la connexion.
3. Sur iPhone, vérifier dans la recette l’enchaînement « connexion au compte → mot de passe administrateur → code de vérification si demandé → administration », puis la reconnexion après expiration/révocation. La navigation privée de production n’est pas une recette isolée.
4. Tester la procédure de récupération en recette : préparer une nouvelle empreinte, l’installer dans la configuration de recette et redémarrer/redéployer cette recette, puis vérifier la reconnexion. Conserver le code corrigé et les contrôles d’autorisation.
5. Après validation de ces points, installer au besoin l’empreinte connue dans Vercel (valeur littérale sans guillemets), puis livrer les migrations avant le code selon [SECURITY_FIXES.md](../SECURITY_FIXES.md). Ne pas modifier simultanément d’autres secrets sans nécessité.

La bascule invalidera l’ancien cookie administrateur de l’iPhone. La nouvelle session admin expire après quatre heures. Un échec de connexion doit être traité par la configuration, les migrations ou la récupération préparée, sans rétablir l’ancien accès automatique depuis les routes client.

## État vérifié

- L’utilisateur a exécuté la vérification hors ligne contre l’empreinte copiée de Vercel : format accepté, puis **NE CORRESPOND PAS**. Il a ensuite précisé avoir copié le mot de passe puis appuyé sur Entrée, sans indiquer de collage : **ce premier résultat est non concluant**, car l’ancien outil retournait également NE CORRESPOND PAS pour une saisie vide. La nouvelle version distingue ce cas, prend en charge Ctrl+V et ne déclare une incompatibilité qu’après réception d’un mot de passe. Aucune valeur secrète n’a été partagée avec l’agent.
- Outil hors ligne : vérification cryptographique, génération compatible, saisie masquée, refus des pipes/arguments secrets et annulation contrôlée testés avec des valeurs fictives.
- Essai interactif dans un véritable terminal Windows : saisies fictives masquées et résultat CORRESPOND, sans écriture ni appel réseau.
- **71 tests ciblés réussis** sur l’outil, le mot de passe et sa récupération, les contrôles de session et la page/formulaire de connexion. Le formulaire exige une réussite explicite du serveur et propose un lien de reconnexion du compte si sa session a expiré. Une erreur du service de comptes n’entraîne pas de déconnexion automatique.
- TypeScript global, ESLint ciblé et vérification des espaces du diff : succès.
- Après les difficultés de copie et de saisie : compatibilité base64 corrigée, diagnostics sans secrets, lecture explicite du presse-papiers Windows et refus des saisies vides ajoutés. **25 tests outil/mot de passe, ESLint et TypeScript ciblé passent.** Les tests du presse-papiers utilisent un adaptateur fictif ; aucun presse-papiers réel de l’utilisateur n’a été consulté par l’agent.
- L’utilisateur confirme `ADMIN_PASSWORD_HASH` présent et `ADMIN_TOTP_SECRET` absent dans Vercel Production ; la valeur affichée commence par `scrypt$`. Après correction de la saisie et nouvelle consigne de collage, la vérification a de nouveau retourné **NE CORRESPOND PAS** avec une saisie non vide. La préparation d’un nouveau mot de passe a ensuite réussi : fichier `output/admin-access/password-hash-1794348005361-c9e1b4a8.txt`, empreinte seule, format compatible et exclusion Git confirmés. Le mot de passe en clair n’a pas été transmis à l’agent. L’empreinte de production et la session iPhone restent hors de ces opérations.
- Navigateur isolé : `node scripts/audit-admin-arena.mjs --login` réussit **32 scénarios et 14 contrôles du focus** à 320 et 390 px, avec 34 captures, sans débordement ni erreur navigateur. Absence de compte, compte interdit, redirection locale, erreurs de service/session, réussite explicite et TOTP facultatif sont couverts. [Rapport local](../output/admin-arena/login-report.json). Identités, API et navigation simulées ; aucun fichier d’environnement chargé, aucun appel à l’API réelle ni réseau externe. Serveur et navigateur arrêtés après le test. Ce test Chromium ne valide ni Supabase ni Safari sur iPhone réel.
- Recette réelle locale : `node scripts/rehearse-admin-local.mjs --run` réussit **10 contrôles et 16 requêtes HTTP** sur les routes admin originales copiées dans un projet Next isolé. Auth Supabase réel vérifie deux comptes fictifs ; le test couvre refus sans compte/non autorisé/mauvais mot de passe, session persistante après redémarrage, liaison au compte, déconnexion avec suppression en base, refus du rejeu, invalidation après rotation et reconnexion avec le nouveau mot de passe fictif. [Rapport local](../output/admin-rehearsal/report.json). Aucun mot de passe utilisateur employé ; comptes fictifs supprimés après l’essai. Réseau limité aux deux ports HTTP locaux ; les trois diagnostics publics de version Next ont été bloqués explicitement, aucun autre appel inattendu. Syntaxe et ESLint des deux scripts passent.
- Limites de cette première recette API : connexion initiale au compte via le SDK Auth réel et cookies SSR, sans exécuter `/api/account/login` ni son interface ; middleware, transport HTTPS/Secure, autres écrans et Safari sur iPhone exclus. Le schéma local contient uniquement les dépendances du parcours admin, pas toutes les migrations de livraison. Le complément navigateur ci-dessous relie désormais les formulaires aux services locaux réels.
- Compatibilité de compilation contrôlée sur trois microprojets isolés avec Next 16.4.1 : `next build` par défaut inclut bien le middleware racine avec `src/app`, tandis que `next build --webpack` l’ignore à cet emplacement et l’inclut sous `src/middleware.ts`. Chaque build a réussi et son résultat a été servi localement pour contrôler le header témoin. [Preuve Webpack](../output/admin-middleware-discovery/result.json), [preuve du compilateur par défaut](../output/admin-middleware-discovery/result-default.json). La commande du dépôt est `next build` ; cette différence ne démontre pas un défaut de la commande actuelle ni de la production. Aucun middleware applicatif n’a été déplacé.
- **Complément navigateur du 11 novembre 2026 réussi** : `node scripts/rehearse-admin-local.mjs --run --browser`, **18 contrôles**, **42 requêtes HTTP réelles**, **24 captures à 320/390 px**, champs vidés avant chaque capture. Les vrais formulaires exécutent les vraies API compte/admin et Supabase Auth local. Vérification d’âge, conservation du chemin de retour, refus des mauvais mots de passe, connexion au compte sans élévation automatique, accès admin, déconnexion/reconnexion du compte et de l’admin, rotation du mot de passe avec refus des anciennes sessions/ancien mot de passe, et compte interdit passent. Les 20 soumissions sont comparées aux valeurs fictives attendues en mémoire ; seuls des booléens sont enregistrés. [Rapport navigateur](../output/admin-rehearsal/browser-report.json).
- Les contrôles d’origine et la CSP du middleware original sont exécutés : POST sans origine ou avec une origine étrangère refusés en 403 ; nonce présent et absence d’`unsafe-eval`. Le test emploie un wrapper de page minimal et un contexte panier limité au cache du compte ; la destination admin et ses boutons de déconnexion sont des témoins locaux qui appellent la vraie garde et les vraies API. Le middleware est copié **à octets identiques** sous `src/middleware.ts` uniquement dans la fixture, pour être chargé par Webpack dev ; son emplacement applicatif reste inchangé. Les source maps de cette fixture évitent les wrappers `eval` de Webpack. Les diagnostics React dev identifiés exactement par source map restent bloqués par CSP et sont comptés séparément. Aucun autre refus CSP, erreur de page ou appel réseau inattendu. Les saisies automatisées attendent que la page soit hydratée.
- Limites restantes : Chromium aux dimensions téléphone, **pas Safari sur iPhone physique**, développement HTTP sans validation du transport HTTPS/Secure ; shell boutique, autres écrans et ensemble des migrations hors de ce scénario. Il ne s’agit pas d’une validation de la production. Syntaxe, ESLint ciblé, contrôle des espaces du diff et `check:supabase-grants` (**375 migrations**) réussis ; la fixture de compte possède aussi ses permissions explicites. Comptes fictifs supprimés, navigateur/serveur Next et conteneurs dédiés arrêtés ; autres conteneurs laissés intacts.
- **Checkpoint : les tests locaux autorisés de connexion et récupération sont terminés. Aucun push, déploiement, modification de configuration réelle ou migration distante pendant cette étape.** La nouvelle empreinte reste préparée seulement. Le 404 précédemment observé sur `admin_sessions` et la validation HTTPS/Safari restent des points de livraison éventuelle ; ne pas engager de bascule en production sans nouvelle instruction de l’utilisateur.
