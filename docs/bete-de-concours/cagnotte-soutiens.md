# Cagnotte des producteurs

Implémentation du 11 novembre 2026. Bénéficiaire : SASU Les Champs Bretons. Soutien ponctuel sans contrepartie, distinct des ventes et des achats du jeu. La migration Supabase a été appliquée à la demande de l’utilisateur ; aucun paiement réel, réglage Viva, webhook distant ou déploiement applicatif n’a été exécuté pendant cette tâche.

Choix confirmé par l’utilisateur : **pas d’objectif**. Conserver `goal_cents = NULL` et le champ objectif vide dans l’administration. Le montant collecté et les soutiens restent visibles, sans jauge ni pourcentage. Ce comportement est déjà implémenté et testé.

Source Viva communiquée par l’utilisateur : **7188**, configurée localement dans `.env.local` sous `VIVA_SUPPORT_SOURCE_CODE`. Elle est distincte de la source boutique configurée. Reporter cette variable dans l’environnement d’hébergement avant publication ; l’état de la source, ses retours et ses webhooks dans Viva restent à vérifier.

Migration `20261111000300` appliquée le 11 novembre 2026 au projet lié `eyowwwpdmfrulhkpvlnf` (Site Web Les Chanvriers Bretons), dont l’URL correspond à celle de l’application. Elle était la seule migration en attente ; le contrôle CLI après application confirme que la base est à jour. Les vérifications distantes en lecture seule confirment la cagnotte fermée sans objectif, zéro contribution et remboursement, les lectures serveur prévues, le refus des quatre tables aux visiteurs et le refus d’accès direct au journal d’audit même pour le serveur. Les quatre tables et cinq RPC sont présentes dans les métadonnées. Aucun versement ni enregistrement de test créé. Rapport : `output/support-campaign-migration/verification.json`. Avant application : 14 tests SQL réussis et contrôle des permissions des 378 migrations réussi.

## Parcours livré

- Encart du Quartier et page partageable `/soutenir` : cumul, objectif facultatif, contributions publiques paginées, formulaire pseudo/montant, publication du pseudo et du montant sur choix explicites. Pseudo du chanvrier prérempli pour un joueur connecté ; identité réelle jamais utilisée comme pseudo.
- Montants de 1 à 1 000 € en centimes entiers. Le serveur crée un ordre Smart Checkout au montant exact, référence `SOUTIEN:<uuid>`, tags `SOUTIEN` et `KANAB-QUEST`.
- La fiche et un jeton aléatoire de 256 bits sont conservés dans le `sessionStorage` de l’onglet avant tout paiement. Seule l’empreinte du jeton est stockée en base ; le jeton ne figure ni dans les URL, ni dans la liste publique. Sans stockage disponible, aucun paiement n’est lancé.
- Retour `/soutenir/retour` : vérification du paramètre Viva `t` auprès du prestataire, liée à la fiche conservée. Aucun statut n’est déduit du seul retour navigateur. Un onglet sans fiche reçoit des instructions de récupération ; les webhooks continuent leur traitement.
- Une notification répétée ne crée pas de second encaissement. Un échec tardif ne retire pas un encaissement. Les remboursements restent dans un registre séparé et ne peuvent pas être annulés par le rejeu d’un succès.
- Administration → Soutiens : objectif, ouverture, filtre par date de création (heure de Paris), registre paginé, export CSV distinct des ventes, frais réels avec référence du relevé et journal des corrections, masquage des informations publiques, rapprochement d’un identifiant de transaction Viva.

## Activation

1. **Terminé** : `supabase/migrations/20261111000300_producer_support_campaign.sql` est appliquée au projet lié. Les tables sont privées, RLS active, écritures par RPC réservées au serveur. La cagnotte est créée **fermée, sans objectif**.
2. Dans le compte Viva existant, vérifier la source Smart Checkout dédiée **7188**, distincte de la source boutique. Vérifier avec Viva l’acceptation et les frais de cette collecte, point déjà ouvert dans `financement-soutien.json`.
3. Reporter `VIVA_SUPPORT_SOURCE_CODE=7188` dans l’environnement de production de l’hébergement. Réutiliser les identifiants OAuth existants et la clé de vérification des webhooks. Les identifiants `VIVA_MERCHANT_ID` et `VIVA_API_KEY` servent à annuler une session non payée avant de la remplacer.
4. Sur cette source, définir les deux URL de retour (succès et échec) vers `https://www.leschanvriersbretons.com/soutenir/retour`.
5. Valider le parcours dans un environnement de démonstration séparé avec des identifiants et une source Viva de démonstration, puis publier le code applicatif via le workflow habituel. Le site de production conserve `VIVA_ENV=live` et la source 7188.
6. Une fois la route publiée, configurer et vérifier les événements `Transaction Payment Created` (1796), `Transaction Reversal Created` (1797) et `Transaction Failed` (1798) vers `https://www.leschanvriersbretons.com/api/support/viva/webhook`. Le GET de vérification utilise la clé Viva existante. Le webhook boutique ignore la source soutien identifiée ; le webhook soutien ignore les autres sources sans référence locale connue.
7. Dans Admin → Soutiens, laisser le champ objectif vide et ouvrir la collecte. La source doit être configurée pour activer l’ouverture. Fermer la collecte bloque les nouvelles fiches ; les paiements déjà engagés continuent à être rapprochés.

## Totaux et rapprochement

Le compteur affiche les versements confirmés diminués des remboursements vérifiés, avant frais. Sans objectif, aucune jauge ni aucun pourcentage n’est affiché. La date « suivi depuis » correspond à la création de ce registre. Les anciens versements Quick Pay ne sont pas importés automatiquement et ne doivent pas être ajoutés à la main comme un total fictif. Leur éventuelle reprise demande un import distinct, rapproché transaction par transaction, sans inventer de pseudo ni de consentement public.

Les frais inconnus sont `NULL`, pas zéro. Le détail public présente les frais et le net après frais uniquement lorsque tous les frais des versements confirmés ont été rapprochés. Ce net ne représente pas le solde bancaire ni l’argent disponible après dépenses. Les exports filtrent les fiches par date de création, avec leur cumul de remboursements/frais connu au moment de l’export ; la colonne « Confirmé le » désigne la confirmation locale, pas une date de règlement bancaire.

Viva peut utiliser la source `Default` pour un remboursement. Le serveur vérifie séparément la transaction négative et le paiement original : même ordre, montant original exact, devise EUR et source soutien sur l’original. `ParentId` reçu par webhook n’est qu’un indice ; il ne suffit jamais à autoriser une écriture. Une absence de référence vérifiable entraîne un rapprochement, jamais un montant supposé.

Un paiement remboursé dont le détail des annulations manque, une contestation ou un encaissement après annulation place le versement en rapprochement. Le total exact et la jauge sont alors suspendus publiquement. Les statuts de contestation sont pris en compte lorsqu’ils sont retournés par Viva lors d’une vérification ; il n’y a pas de synchronisation périodique des litiges indépendante dans cette version. Utiliser le registre et les relevés Viva pour les contrôler.

En cas de création distante incertaine, ne pas recréer un ordre automatiquement : conserver la référence, rechercher `SOUTIEN:<uuid>` dans Viva, puis rapprocher la transaction dans l’administration. Un échec d’authentification avant création est réessayable avec la même fiche. Le rattachement d’un ordre à une fiche manquante exige que la référence marchande retournée par Viva corresponde exactement. Une annulation concerne uniquement une session non encaissée ; les remboursements sont opérés dans Viva puis vérifiés ici.

La séparation est logique et comptable dans le logiciel : elle n’implique pas des virements de règlement bancaire séparés par Viva. Aucun stock, facture de vente, point fidélité, ticket, parrainage ou bonus n’est créé par ces routes.

## Vérification locale

Tests ciblés : `support-campaign.test.ts`, `support-viva.test.ts`, `support-routes.test.ts`, `support-campaign-sql.test.ts`, avec la migration complète exécutée dans PGlite. Régressions de création/vérification/webhook Viva boutique également contrôlées.

Résultat : 133 tests réussis dans dix fichiers, TypeScript global et ESLint ciblé réussis ; `npm run check:supabase-grants` valide les 378 migrations. La revue finale du parcours de paiement n’a relevé aucun blocage dans son périmètre.

Recette navigateur existante : `node scripts/audit-placard-journey-continuity.mjs --financial-support-only`. Douze groupes à 320/390/1440 px couvrent formulaire, double soumission, reprise, annulation, confidentialité, états indisponibles, objectif absent, rapprochement, exclusion du tutoriel, retour et administration. Les API et paiements sont simulés ; aucune requête externe. Rapport et captures : `output/placard-journey-continuity/financial-support-report.json`.

## Sources techniques vérifiées

- [Création d’un ordre Viva](https://developer.viva.com/tutorials/payments/create-a-payment-order/)
- [Intégration et vérification Smart Checkout](https://developer.viva.com/smart-checkout/smart-checkout-integration/)
- [Notification de remboursement](https://developer.viva.com/webhooks-for-payments/transaction-reversal-created/)
- [Source utilisée pour un remboursement](https://developer.viva.com/tutorials/payments/issue-a-refund/)
