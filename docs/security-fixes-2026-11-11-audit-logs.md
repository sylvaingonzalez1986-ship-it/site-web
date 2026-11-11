# D03 — Écriture et surveillance des journaux

`src/lib/audit-log.ts` conserve l’API `logAuditEvent(): void`. Elle capture les données de l’événement puis enregistre une fonction asynchrone avec `after` de Next. Cette fonction attend l’INSERT Supabase, borné par un signal d'abandon de cinq secondes : le travail est rattaché à la fin de la requête, au lieu de laisser une promesse détachée. Le client privilégié est créé dans cette fonction, et ses erreurs ne cassent pas la réponse métier.

Les erreurs SQL, transport ou configuration ne sont jamais imprimées avec leur contenu. Les logs techniques utilisent uniquement des messages constants. Un échec d’écriture déclenche aussi, lorsque Sentry est configuré et activé, un événement d’erreur avec `logger=audit-log`, `component=audit-log` et le fingerprint `audit-log / write-failed`. Le processeur de cet événement reconstruit une liste blanche : ID, horodatage, environnement, version, niveau et libellés constants. Requête, utilisateur, IP, email, exception, breadcrumbs, pièces jointes et extras hérités sont exclus. Le flush Sentry est attendu, avec une borne de deux secondes.

Le filtre final `beforeSend` reconstruit cette même liste blanche après les traitements du SDK : Sentry 11 réinjecte autrement des métadonnées de propagation après les processeurs de scope. Un test avec le véritable SDK et un transport mémoire reproduit ce cas puis vérifie l'absence du marqueur privé dans toute l'enveloppe, y compris ses en-têtes et pièces jointes. Les autres événements explicitement capturés par l'application conservent leur comportement ; ce filtre ne prétend pas supprimer toute donnée passée manuellement à `captureException`.

## Signaux à surveiller

- `audit_log_write_failed` : au moins une écriture n’a pas été confirmée ; ouvrir un incident et vérifier Supabase, ses permissions et sa disponibilité.
- `audit_log_schedule_failed` : Next n’a pas pu enregistrer le travail, ou les données ne peuvent pas être copiées ; vérifier le contexte d’appel. Aucune promesse de secours détachée n’est lancée.
- `audit_log_alert_unavailable` : Sentry est absent ou désactivé ; le signal reste dans les logs de la plateforme.
- `audit_log_alert_failed` : la capture ou le flush n’a pas abouti ; contrôler le transport de supervision.

La règle Sentry proposée est une alerte dès la première occurrence de `component:audit-log` dans l’environnement de production configuré, puis une notification de régression. Les signaux de planification et de supervision doivent également être surveillés dans les logs Vercel. Aucune règle distante ni destination de notification n’est gérée dans ce dépôt ; aucun connecteur Sentry n’est disponible pendant cette intervention. L’émission est implémentée et testée localement, mais la réception réelle et la notification d’un opérateur ne sont pas attestées.

Le contrôle de configuration réalisé par l’agent chargé de l’exploitation le 11 novembre confirme l’absence de configuration Sentry dans Vercel et en local. Le canal externe est donc inactif actuellement ; les signaux constants restent disponibles dans les logs de la plateforme. Il faut provisionner la destination Sentry et sa règle de notification avant de présenter l’alerte comme opérationnelle.

## Rétention et limites

La table `audit_logs` est append-only pour l’application : RLS interdit l’accès client, et `service_role` ne reçoit que INSERT dans la migration explicite des grants. Aucun mécanisme de purge, calendrier de rétention ou export d’archives n’a été trouvé. Cette correction conserve l’historique. La durée de conservation et une éventuelle purge après export vérifié doivent être décidées explicitement ; aucun délai arbitraire ni DELETE n’est ajouté.

`after` prolonge le cycle de vie dans les limites de durée de la plateforme. Ce n’est pas une file persistante : une interruption du processus, un dépassement de durée ou une panne de stockage peut encore perdre un événement. Aucun retry d’INSERT n’est effectué après une réponse ambiguë, pour éviter les doublons dans une table sans clé d’idempotence fournie par l’appelant. L’alerte signale une absence de confirmation, pas la preuve que PostgreSQL n’a rien enregistré. Les champs métier autorisés (acteur, IP, metadata) restent dans la table privée ; ils ne sont pas envoyés avec les alertes techniques.

Les tests utilisent des transports simulés et, pour l'expiration, le véritable builder PostgREST : attente de promesses différées, capture avant mutation, erreurs SQL/client/transport, planification indisponible, élimination de contexte sensible, attente du flush et absence de supervision. Le test d'expiration confirme l'annulation de la requête après cinq secondes, puis le signal d'alerte, sans retry. Aucun appel distant ni événement Sentry transmis n’est nécessaire.

Validation locale du 11 novembre : 58 tests réussis dans sept fichiers (audit, limites, identité admin, choix du nouveau mot de passe et réinitialisation), avec Next 16.4.6 / Sentry 11.12.0. Une première tentative pendant le remplacement de Next avait échoué au chargement du module ; la suite complète a ensuite été relancée avec succès après la fin de l’installation.

Recette Auth supplémentaire : `node scripts/rehearse-auth-password-local.mjs --run`, après démarrage explicite du seul projet `output/admin-rehearsal`, a passé sept contrôles sur le véritable GoTrue local v2.186.0 avec `minimum_password_length=12` et `secure_password_change=true` effectivement chargés. Connexion avec un ancien mot de passe de huit caractères conservée ; nouveau mot de passe de onze caractères refusé ; session fictive vieillie de 25 heures refusée ; session fraîche et récupération par `admin.generateLink` local acceptant douze caractères ; reconnexion réussie et anciens mots de passe/jeton consommé refusés. Comptes fictifs supprimés, zéro requête externe et aucun email envoyé. Preuve : `output/admin-rehearsal/auth-password-report.json`. Cette recette couvre l’API Auth, sans rejouer l’interface Next ni affirmer la version du service hébergé.

Références : guide installé `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` ; [migration Sentry v11](https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v10-to-v11/), notamment la suppression de `Scope.clear()` et les nouveaux réglages de collecte.
