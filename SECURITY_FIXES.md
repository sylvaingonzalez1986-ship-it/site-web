# Correctifs de sécurité — 10 novembre 2026

**Complément du 11 novembre :** à la demande de terminer les problèmes connus, le lot D01–D03 renforce les dépendances, les limites de flux et les journaux ; il ajoute une politique de nouveaux mots de passe à 12 caractères et l'isolation Vercel. [État, preuves et actions personnelles restantes](docs/security-closure-2026-11-11.md). Le commit S01–S14 `3c1dd318` est en production et la reconnexion admin a été confirmée par l'utilisateur. Les paragraphes suivants retracent la préparation antérieure.

**Livraison demandée le 11 novembre 2026 :** après confirmation de la reprise locale du jeu et de l’accès admin, l’utilisateur autorise la mise en production. Il précise ensuite qu’il committe le jeu à part : ce commit couvre **S01–S14 et le parcours de reconnexion**, sans les fichiers Personnel/production autonome. Vérification courante de la base : **272 contrôles de métadonnées réussis**, cinq migrations présentes et identiques aux fichiers locaux ; aucune migration à rejouer. La configuration Vercel du nouveau mot de passe est traitée séparément des fichiers Git. Les anciennes consignes « tests uniquement » ci-dessous sont historiques.

Validation de livraison : build Next/Turbopack complet et TypeScript réussis, 141 pages générées et middleware racine inclus. Cette compilation isolée utilise un catalogue et des articles fictifs vides ; son artefact n’est pas déployé, Vercel reconstruit les sources. L’empreinte du mot de passe validé localement est installée dans la configuration **Production** Vercel et vérifiée en mémoire ; les valeurs preview/development sont conservées. Aucun secret n’entre dans le commit. Preuves : `output/release-validation-20261111/report.json`, `output/migrations-20261111/readiness-metadata.json` et `output/release-20261111/`.

**Mise à jour du 11 novembre 2026 :** à la demande explicite de l’utilisateur, les quatre migrations `20261110000200` à `20261110000500` ont été appliquées au projet Supabase lié `eyowwwpdmfrulhkpvlnf`. Les 28 contrôles préalables et 146 contrôles après application passent ; aucune migration ne reste en attente. Les permissions et les définitions des fonctions correspondent aux fichiers locaux. Aucun code applicatif ni paramètre administrateur n’a été déployé ou changé. [Preuve d’application](output/migrations-20261111/completion.json). Les mentions d’absence de migration distante ci-dessous décrivent la phase d’audit et de recette antérieure à cette demande.

Suite au « OK GO », les constats S01 à S14 de [l’audit initial](SECURITY_AUDIT.md) ont fait l’objet de corrections locales et de tests de non-régression. Ce document décrit le code préparé ; il ne décrit pas l’état de la production. Aucun paiement, remboursement, e-mail réel, migration distante ou déploiement n’a été effectué.

Complément de préparation admin : une vérification distante en lecture seule, par `HEAD` sur la relation `admin_sessions` avec zéro ligne demandée, a renvoyé 404. Aucun contenu de données ni secret n’a été exposé ; aucune configuration ou donnée distante n’a été modifiée. Le projet local habituel partage la base de production selon l’utilisateur ; les essais de connexion ont donc utilisé une instance Supabase locale distincte.

Consigne confirmée ensuite : **tests uniquement, aucun push ni déploiement en production**. Le complément du 11 novembre est terminé dans l’environnement local isolé ; il n’a modifié aucun fichier applicatif ni aucune configuration réelle. La nouvelle empreinte admin reste non installée.

## Corrections

| Constats | Changement | Preuve principale |
|---|---|---|
| S01 | Récompenses accessibles uniquement au serveur ; ancienne surcharge fermée ; barème également validé en SQL. | Vraie migration dans PGlite, refus des rôles clients et montants hostiles, récompenses légitimes et idempotence. |
| S02, S05 | Suppression de l’élévation automatique depuis les routes de compte. Session admin persistante, liée à l’identité Auth vérifiée et à l’allowlist ; révocation au logout/récupération de compte, invalidation après rotation des paramètres admin. | Signatures réelles, routes et garde, stockage simulé ; ACL et cascade de suppression dans PostgreSQL embarqué. |
| S03 | Comparaison littérale des e-mails historiques ; lecture et anonymisation via RPC serveur, sans repli ILIKE. | Identités fictives A/B, caractères spéciaux et anonymisation exécutés avec les vrais RPC. |
| S04 | Retrait des écritures client sur les profils, y compris les GRANT par colonne ; accès serveur explicite. | Tests SQL sous rôles anon/authenticated/service_role. |
| S06 | Réponse publique des commentaires limitée aux champs affichés ; notes de modération, identifiant client et identité du modérateur exclus. | Test de la réponse de la route publique. |
| S07 | Variante canonique obligatoire, prix serveur et inventaire strict ; packs à variantes non représentées refusés. | Routes de checkout et inventaire SQL réel. |
| S08 | Paiement/statut/suivi/inventaire/réservations administrateur dans une transaction ; retour arrière intégral sur erreur ; expédition non payée ou sous alerte refusée. | Tests SQL d’atomicité et routes administrateur. |
| S09 | Annulation Viva avant archivage ; capture tardive enregistrée et visible sous alerte, sans livraison ni bonus automatiques. | Permutations des événements, collision d’une remise réutilisée et requête de liste admin. |
| S10 | Webhook occupé : 503 avec Retry-After, acquittement des doublons seulement après traitement terminé. | Tests des routes et reprise. |
| S11 | Confirmation newsletter explicite par POST depuis un e-mail ; jeton aléatoire de 256 bits, empreinte seule en base, expiration 24 h et usage unique ; plafonds IP/adresse/global ; réponse sans état d’abonnement. | Routes simulées et vrais RPC dans PGlite, rejeu/expiration/remplacement/désinscription/suppression du compte. |
| S12, S13 | IPv6 valide et normalisée ; aucun budget local de secours en cas d’indisponibilité ou de réponse incohérente du limiteur partagé. | Tests IPv4/IPv6 et refus sur pannes du RPC. |
| S14 | Banc ACL réconcilié avec toutes les migrations et les appels actuels, séquences et droits par colonne compris. | 375 migrations analysées et opérations réellement exécutées sous rôles dans le banc isolé. |

Les URL newsletter ne sont pas envoyées par le composant Analytics. La désinscription et la suppression de compte invalident atomiquement les liens de confirmation en attente. Les données fictives et adaptateurs de test n’utilisent aucune variable de production.

Détails : [base de données](docs/security-fixes-2026-11-10-database.md), [paiements](docs/security-fixes-2026-11-10-payments.md).

## Livraison à préparer sur environnement isolé

### Condition préalable : conserver un accès administrateur utilisable

L’utilisateur a signalé qu’il utilise une session administrateur sur iPhone et craint de perdre son accès. **Ne pas déployer la bascule des sessions avant d’avoir vérifié la reconnexion et la récupération avec lui.** Aucun changement de production n’a été effectué pendant cette vérification.

Il a depuis confirmé disposer de l’e-mail/mot de passe du compte et avoir accès à Vercel, avec `ADMIN_PASSWORD_HASH` présent et `ADMIN_TOTP_SECRET` absent dans les variables Production. Le [guide de reconnexion et récupération](docs/admin-access-recovery.md) et l’outil hors ligne `scripts/admin-access.mjs` sont préparés. Après vérification négative du mot de passe connu, l’utilisateur a créé une nouvelle empreinte dans un fichier local exclu de Git ; son format a été validé sans afficher de valeur. **Elle n’a pas été installée dans Vercel.** La page de connexion guide désormais le retour depuis le compte client, la validation admin et le TOTP optionnel ; les erreurs de session proposent une reconnexion sans déconnexion automatique. Ce complément passe 71 tests ciblés et un essai du terminal Windows avec valeurs fictives.

- Le format v2 invalide les anciens cookies administrateur. La session du téléphone devra donc être renouvelée après livraison. L’élévation reste limitée à quatre heures ; les routes de compte ne la renouvellent plus automatiquement.
- Le nouveau parcours nécessite une session du compte autorisé, le mot de passe administrateur distinct configuré par `ADMIN_PASSWORD_HASH` et, uniquement s’il est configuré, le code de l’application correspondant à `ADMIN_TOTP_SECRET`. Une clé physique n’est pas requise par ce code. La configuration effective de production et la disponibilité de ces moyens pour l’utilisateur ne sont pas encore vérifiées.
- Identifier d’abord le parcours actuellement utilisé, sans demander de mot de passe ou de code dans le chat. Un accès admin qui apparaît automatiquement après la connexion client ne prouve pas que le mot de passe administrateur est connu ou configuré.
- Tester le nouveau parcours sur iPhone dans une session séparée de recette avec des données fictives, en conservant la session habituelle intacte. Se reconnecter sur l’ancienne version de production ne valide pas le nouveau contrôle administrateur.
- Vérification intermédiaire effectuée avec `node scripts/audit-admin-arena.mjs --login` : 32 scénarios et 14 contrôles du focus passent à 320/390 px, sans débordement ni erreur navigateur. [Rapport local](output/admin-arena/login-report.json). Ce premier test Chromium utilise des identités et réponses API fictives ; la recette locale réelle ci-dessous complète cette preuve.
- Vérification complémentaire avec `node scripts/rehearse-admin-local.mjs --run` : **10 contrôles et 16 requêtes passent** avec Supabase Auth/PostgreSQL réels, comptes fictifs, routes admin originales et projet Next isolé. Persistance, déconnexion, refus du rejeu et rotation suivie d’une reconnexion sont validés. [Rapport](output/admin-rehearsal/report.json). La connexion initiale du compte utilise le SDK Auth ; l’interface compte, le middleware et Safari ne sont pas couverts par ce test. Comptes fictifs supprimés, serveur et conteneurs dédiés arrêtés, aucun fichier d’environnement réel chargé par le serveur de test.
- Recette navigateur réelle avec `node scripts/rehearse-admin-local.mjs --run --browser` : **18 contrôles, 42 requêtes et 24 captures à 320/390 px**. Les vrais formulaires, API, Auth et PostgreSQL locaux valident connexion, refus d’identifiants incorrects, absence d’élévation automatique, déconnexions/reconnexions, rotation et compte interdit. Origine et CSP du middleware original sont vérifiées. [Rapport navigateur](output/admin-rehearsal/browser-report.json). Les adaptations limitées de la fixture, les diagnostics React dev bloqués et les exclusions HTTPS/Safari sont détaillés dans le [guide de récupération](docs/admin-access-recovery.md). Aucun code applicatif modifié pour ces tests ; tous les services dédiés et comptes fictifs ont été nettoyés ou arrêtés.
- Vérifier un accès indépendant à l’hébergement et préparer/tester en recette la récupération de la configuration administrateur en cas de mot de passe perdu. La récupération du compte client seule ne réinitialise pas le mot de passe administrateur distinct. Ne pas rétablir l’élévation automatique pour contourner un blocage.

### Ordre de livraison

1. Isoler ces changements des travaux du jeu déjà présents et vérifier la version réellement déployée. Ne pas envoyer tout le dossier de travail indistinctement.
2. Appliquer en recette les migrations de sécurité `20261110000200` à `20261110000500`, dans l’ordre et après leurs prérequis. Elles ferment les droits, remplacent les RPC sensibles et créent les deux tables de sessions/confirmations. Les appliquer avant le nouveau code : les nouveaux appels échouent de façon fermée si leur migration manque.
3. Vérifier la configuration existante `ADMIN_ALLOWED_EMAILS`, `ADMIN_PASSWORD_HASH` et `ADMIN_SESSION_SECRET`. Les anciennes sessions admin sont invalidées ; une reconnexion au compte puis au formulaire admin est nécessaire. `ADMIN_TOTP_SECRET`, s’il est configuré, utilise le code à six chiffres d’une application d’authentification. Aucune clé physique n’a été ajoutée comme prérequis. L’activation initiale du TOTP n’a pas été effectuée à distance.
4. Déployer en recette et vérifier connexion/déconnexion/récupération, profils A/B, commandes et e-mails avec identités fictives, messagerie de test et Viva sandbox. Tester aussi les courses avec plusieurs connexions PostgreSQL ; les tests embarqués couvrent des permutations mais ne prouvent pas les courses distantes.
5. Vérifier le montant/devise/marchand et les reprises réelles de Viva, la visibilité des captures tardives et le blocage de leur expédition. Les remboursements restent une procédure externe explicite ; aucun bouton générique ne simule désormais une régression d’un paiement confirmé.
6. Après validation et choix du déploiement, appliquer la procédure de livraison et vérifier les ACL effectives. Ne pas rétablir les anciens grants ni l’ancien mécanisme d’élévation admin pour résoudre une difficulté de connexion.

## Limites et travaux restants

- La configuration Supabase/Vercel/Viva et les données historiques restent non vérifiées. Examiner les récompenses anormales, commandes déjà incohérentes et abonnements hérités avant de leur faire confiance ; aucun nettoyage destructif automatique n’a été réalisé.
- Les points de durcissement D01–D03 de l’audit restent séparés : mise à niveau Next.js testée, plafonnement des corps en lecture de flux sur tous les endpoints concernés, fiabilité des écritures d’audit. Les dépendances n’ont pas été changées dans ce lot.
- L’indisponibilité des contrôles persistants bloque désormais les opérations concernées. Prévoir la supervision du RPC de limitation et des nouvelles tables, ainsi qu’une purge périodique des sessions expirées. Une panne d’envoi de confirmation ne crée pas d’abonnement actif.
- Pas de build de déploiement exécuté avec les fichiers d’environnement locaux : il pourrait charger des accès réels. Les tests de source et SQL sont locaux ; une compilation et recette avec configuration fictive restent nécessaires avant production.
- Daybreak est indépendant de la configuration du site. Les corrections réalisées n’ont demandé aucune connexion supplémentaire de ChatGPT aux données de production ni clé de sécurité physique.

## Validation et reprise

Les tests d’audit qui démontraient les défauts ont été convertis en tests de refus après correction. Ne pas les présenter comme une nouvelle reproduction des anciennes vulnérabilités.

Résultats effectivement obtenus :

- Suite globale : 573 fichiers, 7 011 tests ; 7 005 réussites au premier passage, deux attentes de l’ancien format de session et quatre dépassements de délai. Après adaptation des attentes et relance des cinq fichiers concernés avec `--maxWorkers=2` : **30/30 tests réussis**. Les autres fichiers n’ont pas été relancés inutilement.
- TypeScript global `--noEmit --incremental false` : succès. ESLint ciblé sur les fichiers du correctif et contrôle des espaces du diff : succès.
- Contrôle de convention : **375 migrations** ; banc ACL actuel : **211 opérations SQL sous rôle**, succès. Régressions SQL récompenses/profils et sessions/newsletter : succès.
- Paiements : **133 tests ciblés** réussis, avec les RPC réels dans PGlite. Suppression de compte/e-mails : **12 tests** réussis. Tests d’authentification, protections publiques et limitation, puis récupération de compte/middleware : **97 tests ciblés** réussis. Ces nombres recoupent la suite globale et ne doivent pas être additionnés à son total.

Commandes reproductibles sans fichier d’environnement ni service distant :

```powershell
.\node_modules\.bin\vitest.cmd run --maxWorkers=2
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
npm.cmd run check:supabase-grants
node scripts/security-audit-2026-11-10-database.mjs
node scripts/test-supabase-data-api-grants.mjs
node scripts/test-security-sessions-newsletter.mjs
```

Checkpoint : code et tests de S01–S14 préparés et validés localement ; aucun déploiement. Prochaine tâche bornée : préparer une recette isolée et relever les ACL/configurations déployées, sans refaire l’audit complet. Les durcissements D01–D03 restent ouverts.
