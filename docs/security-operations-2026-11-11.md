# Sécurité opérationnelle — constat du 11 novembre 2026

**Application du plan Vercel :** les 46 variables partagées sont désormais limitées à la production ; l'ancienne entrée admin exclusivement preview/development a été supprimée. L'ancienne preview `dpl_ECvDz9Hx4n6sdy36Srq27jLoWAeV` a ensuite été supprimée et son absence vérifiée. Valeurs, protection, déploiement et alias de production inchangés. Preuves : `vercel-isolate-applied-1794392136812-ca368fb6.json` et `vercel-remove-preview-applied-1794392277852-ed0cac0b.json` dans le répertoire de preuves. Le constat et le plan ci-dessous décrivent l'état **avant** ces opérations.

Inspection des API de gestion entre 09:52 et 10:01 UTC, uniquement en lecture. Aucune donnée métier, identité de membre, valeur de secret, sauvegarde ou objet Storage téléchargé. Aucun paramètre distant modifié. Preuves expurgées et scripts GET/HEAD : `output/security-operations-20261111/`.

| Périmètre | Constat vérifié | Suite bornée |
| --- | --- | --- |
| Vercel preview | Protection SSO standard, aucun bypass projet. Une preview READY et son alias renvoient 302 vers Vercel Authentication. | Isoler les environnements et retirer l'ancien build. |
| Variables Vercel | 46 entrées partagées production/preview, dont service_role Supabase, paiement, SMTP, expédition et session admin. | Plan exact par identifiant dans `vercel-isolation-plan.json` : 46 modifications de portées conservant production, suppression de l'ancienne entrée de hash admin réservée preview/development. Valeurs production inchangées. |
| Sauvegardes Supabase | Offre Pro, rétention de 7 jours confirmée par entitlement ; 8 sauvegardes physiques COMPLETED du 4 au 11 novembre. Dernière : 11 novembre 03:33 UTC. PITR désactivé. | Restauration isolée et couverture des objets Storage restent à vérifier ; aucune restauration effectuée ici. |
| Auth Supabase | Confirmation email obligatoire, changement email sécurisé, rotation refresh active (réutilisation 10 s), JWT 1 h. Minimum mot de passe 6, HIBP désactivé, réauthentification désactivée. | Minimum 12 + HIBP + réauthentification après adaptation et tests applicatifs. Offre actuelle compatible, aucun abonnement nécessaire. |
| Console Supabase | Un Owner ; MFA désactivée. | Enrôlement personnel MFA par le propriétaire avant toute obligation MFA de l'organisation. |
| Console Vercel | Offre Pro ; un OWNER ; MFA du compte consulté activée. | Aucun changement préparé. |
| GitHub | Identifiant local existant utilisable sans interaction ; API `/user` HTTP 200 mais champ MFA non communiqué. | Statut MFA non vérifié avec les droits disponibles. |
| Storage | 7 buckets ; `mission-proofs` privé ; 6 buckets publics pour contenus publiés. Chaque bucket possède limites MIME et taille (8, 10 ou 30 Mio). Versioning non disponible dans la configuration lue. | Sauvegarde des fichiers à documenter séparément. |
| Transport DB | SSL enforcement PostgreSQL désactivé. | Vérifier les clients SQL directs avant activation ; les appels Data API applicatifs utilisent HTTPS. |
| WAF | L'API de configuration active répond 404. | Aucune règle WAF spécifique vérifiée. Cela ne signifie pas absence de la protection DDoS générale de Vercel. |
| Sentry | Aucun token, org, projet ou DSN dans le processus ou les fichiers d'environnement présents ; aucun `.sentryclirc` projet/utilisateur ; aucune variable SENTRY Vercel. | Alertes, rétention et offre non vérifiables. La collecte via ces variables n'est pas configurée. |
| Viva demo | Aucun marqueur demo/sandbox/test dans les environnements et endpoints locaux inspectés. | Aucun test de paiement distant exécuté ; accès démo absent des configurations trouvées. |

Le plan Vercel met preview/development sans configuration jusqu'à l'existence de services de test isolés. Il ne modifie ni les secrets ni les sessions de production. Les [changements de variables ne s'appliquent pas aux anciens déploiements](https://vercel.com/docs/environment-variables/managing-environment-variables) : la preview `dpl_ECvDz9Hx4n6sdy36Srq27jLoWAeV` conserverait ses identifiants tant qu'elle existe. Après contrôle du projet, du target et de l'absence de domaine de production, sa suppression utilise `DELETE /v13/deployments/{id}?teamId=…`. Cette action rend ses liens indisponibles et empêche son rollback ; elle ne vise pas la production `dpl_Fyb5HE8oBnuEw8Gy11C3jnQrq4Hs` observée. [API Vercel](https://vercel.com/docs/rest-api/deployments/delete-a-deployment).

Le plan Auth (`supabase-auth-plan.json`) propose exclusivement :

```http
PATCH https://api.supabase.com/v1/projects/eyowwwpdmfrulhkpvlnf/config/auth
Content-Type: application/json

{
  "password_min_length": 12,
  "password_hibp_enabled": true,
  "security_update_password_require_reauthentication": true
}
```

Relire le même endpoint avec GET pour vérifier chaque valeur. Préserver `security_update_password_require_current_password=false`, les limites de session, les clés et le SMTP. Les sept notifications de sécurité email sont actuellement désactivées ; ne pas les activer avant vérification du circuit d'envoi. Selon la [documentation Supabase](https://supabase.com/docs/guides/auth/password-security), une session créée depuis moins de 24 h permet le changement sans nonce ; la compatibilité d'un reset email créant une session fraîche est donc attendue, mais doit être testée avec le parcours applicatif. Une session plus ancienne exige la réauthentification. [Champs et méthode API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

La disponibilité des sauvegardes ne prouve pas une restauration réussie. Les [sauvegardes de base Supabase](https://supabase.com/docs/guides/platform/backups) ne contiennent pas les fichiers Storage ; une copie et une restauration de ces fichiers doivent faire l'objet d'une procédure distincte. Aucun achat PITR ni copie de données de production n'a été lancé.

Pour reprendre : relire les plans et vérifier qu'aucune configuration distante n'a changé, appliquer les seules mesures retenues, produire les preuves après changement, puis mettre à jour ce constat. Les preuves antérieures restent datées ; ce document ne prétend pas que les plans sont déjà appliqués.
