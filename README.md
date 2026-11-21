This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Paiement Bitcoin — Lightning

Dans le panier, le client connecté sélectionne **Carte bancaire** (Viva) ou
**Bitcoin — Lightning** (Swiss Bitcoin Pay) avant d’appuyer sur « Payer ».
Si Lightning est indisponible, le panier l’indique et la carte reste accessible.
Les commandes et les factures restent en euros. Une seule demande de paiement
porte sur le total TTC, port et remises compris. Le compte Swiss Bitcoin Pay
applique le réglage marchand existant **95 % EUR / 5 % BTC**.
[API marchande Swiss Bitcoin Pay](https://docs.swiss-bitcoin-pay.ch/).

### Mise en service

1. Appliquer `supabase/migrations/20261121000100_swiss_bitcoin_pay.sql` dans
   l’ordre des migrations, avant le déploiement du code.
2. Dans les variables de **production** Vercel, renseigner
   `SWISS_BITCOIN_PAY_API_KEY` (ou la variable existante `swiss_bitcoin`) avec la clé marchande et
   `SWISS_BITCOIN_PAY_WEBHOOK_SECRET` avec un secret aléatoire indépendant.
   Utiliser `https://www.leschanvriersbretons.com` pour `NEXT_PUBLIC_SITE_URL`
   et conserver le `CRON_SECRET` utilisé par les tâches du site.
   Le serveur transmet à Swiss Bitcoin Pay l’URL et l’en-tête privé
   `x-sbp-webhook-secret` à chaque création. Le webhook est
   `POST /api/checkout/bitcoin/webhook`.
3. Vérifier dans Vercel que `GET /api/cron/swiss-bitcoin-pay` tourne toutes
   les cinq minutes avec le secret de cron. Son résultat JSON indique le
   nombre de tentatives vérifiées et d’échecs. Les erreurs de vérification
   rendent une réponse HTTP 503 et les reprises sont planifiées en base.
   [Tâches planifiées Vercel](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).
4. Passer `SWISS_BITCOIN_PAY_ENABLED` à `true` et redéployer. La disponibilité
   dépend de la présence des secrets et d’une origine HTTPS. Vérifier sur
   ordinateur et mobile que les deux moyens de paiement sont proposés.
   Dans un essai marchand autorisé, contrôler le total avant paiement, puis
   fermer la page et vérifier que la commande, la facture et les avantages
   apparaissent dans le compte et l’administration. Comparer ensuite
   l’identifiant et le montant avec le tableau de bord Swiss Bitcoin Pay.

Aucun environnement d’essai n’est documenté dans l’API marchande publique.
Les tests du dépôt simulent le prestataire. Les notifications et la reprise
relisent la facture par son identifiant sur l’API du fournisseur. La reprise
suit les anciennes factures expirées pendant sept jours. Le webhook peut
encore signaler un paiement au-delà.

### Reprise et rapprochement

- Le délai de paiement Lightning demandé est de dix minutes. La boutique
  vérifie le stock au checkout et décompte les unités sous verrou à la
  confirmation. Les articles restent disponibles à la vente entre ces deux
  étapes. Les remises et lots sont conservés pendant la reprise, puis
  libérés après une heure si la commande demeure impayée et sans facture
  payable ni incident à examiner. En cas de stock insuffisant, de règlement
  tardif ou de doublon, l’administration affiche une alerte.
- En cas de réponse de création perdue, retrouver la facture dans le tableau
  de bord Swiss Bitcoin Pay et saisir son identifiant dans le détail de la
  commande. Le site contrôle la référence opaque, l’identifiant et le montant
  auprès du prestataire. Si aucune facture n’a été émise et que la période
  d’incertitude d’une heure est écoulée, retirer la commande impayée depuis
  l’administration pour libérer le panier et les remises. Le client peut alors
  recommencer. Si la bascule Viva a échoué avant d’enregistrer son code,
  retrouver l’opération Viva avec la référence « Commande » suivie du numéro
  de commande avant tout retrait ou nouvel essai.
- Dans **Admin → Commandes**, ouvrir le détail ou utiliser **Export paiements
  Bitcoin (CSV)**. Retrouver les transactions par identifiant de facture et
  référence du paiement, puis rapprocher les conversions, frais et virements
  avec les relevés marchands. L’API publique ne documente pas l’unité du
  montant dans le détail Lightning payé. Le montant BTC payé et les montants
  de règlement marchand restent donc inconnus dans l’export tant que la source
  ne les fournit pas avec une unité vérifiable. Les versements groupés se
  rapprochent dans le relevé du prestataire.
  [Swiss Bitcoin Pay](https://swiss-bitcoin-pay.ch/).
- L’API marchande ne documente pas de remboursement. Pour un paiement en
  revue, vérifier l’encaissement auprès du prestataire, effectuer le
  remboursement avec le prestataire si nécessaire, puis conserver la
  référence, le montant, l’unité et la date du remboursement dans le dossier
  comptable de la commande. Le traitement des commandes sous alerte reste
  suspendu.

Pour désactiver les nouvelles demandes, remettre `SWISS_BITCOIN_PAY_ENABLED`
à `false` et redéployer. Conserver le webhook, son secret et le cron pour
terminer le suivi des factures déjà créées. Viva reste disponible.

## Ventes et règlements producteurs

Dans **Admin → Ventes**, l'onglet **Producteurs et règlements** s'ouvre sur la vue
**Par mois**. Chaque mois présente les producteurs, leurs ventes, le dû, le déjà
réglé et le reste à payer. Le bouton **Saisir un montant déjà réglé** préremplit
le producteur et le mois ; renseigner le montant effectivement versé et sa date
réelle. Ces deux champs restent vides pour la saisie d'un règlement antérieur.
Le formulaire affiche les règlements déjà enregistrés et le solde courant ;
la validation met à jour le déjà réglé et le reste à payer.

Sélectionner un producteur et une plage de mois, ou laisser les mois vides pour
voir tout l'historique. La vue **Cumul sur la période** regroupe les mois pour
les règlements par tranche de 100 g.
Le montant dû correspond par défaut à **80 % des ventes HT**, après remises et
hors livraison. Les 20 % restants constituent la marge boutique. Les grammes
vendus sont cumulés sur la sélection, avec un repère tous les 100 g ; ce volume
inclut les ventes déjà réglées, tandis que le solde déduit les paiements.

**Règlement de cette période** enregistre un paiement déjà effectué, total ou
partiel, avec sa date réelle et sa référence. Un règlement peut couvrir plusieurs
mois : il est réparti sur les soldes les plus anciens de la plage, puis tout
excédent apparaît comme avance sur le dernier mois. L'historique conserve le
virement unique et ses éventuelles annulations de saisie avec motif. Aucun
virement bancaire n'est déclenché. Une nouvelle tentative du même formulaire
utilise le même identifiant pour éviter un double enregistrement.

Le détail mensuel permet de définir, au besoin, un tarif particulier par référence
ou variante (par unité, par gramme avec poids explicite, ou en pourcentage HT).
Un tarif s'applique depuis son mois d'effet jusqu'au suivant ; sa correction
recalcule les mois concernés. Les ventes payées ou historiques `not_configured`
sont retenues, hors commandes annulées/archivées et cadeaux synthétiques, selon
le mois de création de commande en Europe/Paris.

Avant déploiement, appliquer
`supabase/migrations/20261003000300_producer_settlements.sql`.
Cette migration crée les
tables privées de tarifs/règlements et fige le producteur et le poids des nouvelles
lignes de commande. L'historique est reconstitué avec le catalogue encore présent ;
les attributions ou poids impossibles à retrouver sont signalés dans l'interface.
Pour les variantes, seuls les libellés de poids explicites tels que « 5 g » sont
convertis, sans reprendre le poids d'un autre format.

La migration a été appliquée le 3 octobre 2026 au projet Supabase lié
`eyowwwpdmfrulhkpvlnf`, à la demande de l'utilisateur. Elle était la seule en
attente ; l'historique distant et la prévisualisation après application confirment
que la base est à jour. Le recalcul des récompenses du jeu est désactivé uniquement
pendant la reprise des anciennes lignes de commande, puis réactivé dans la même
transaction. La publication du code de l'interface reste une étape distincte.
Les vérifications distantes confirment l'accès serveur aux nouvelles tables et
colonnes, le refus des tables de règlements aux visiteurs anonymes et la
cohérence des attributions producteurs. Aucun paiement de test n'a été créé.
Rapport : `output/producer-settlements-migration/verification.json`.

Vérifications : `npx vitest run src/lib/producer-settlements.test.ts
src/lib/producer-settlements-backend.test.ts
src/app/api/admin/producer-settlements/route.test.ts`,
`npm run check:supabase-grants`, `node scripts/test-producer-settlements.mjs`
(PostgreSQL isolé via PGlite ; chemin du module en argument si nécessaire) et
`node scripts/audit-admin-producer-settlements.mjs` (navigateur, données fictives).

## Centre de mailing admin

Dans l’admin, **La communauté → Centre de mailing** permet de préparer des
brouillons, sélectionner des contacts, personnaliser le message avec `{{prenom}}`,
envoyer un test à une adresse choisie, puis confirmer l’envoi et suivre les résultats.
Les promotions ciblent les abonnés newsletter actifs ; les informations sans
promotion ciblent les comptes clients confirmés. Les désinscrits sont exclus dans
les deux cas, y compris lorsqu’ils se désinscrivent après la préparation du message.

Mise en service :

1. Appliquer `supabase/migrations/20261002000100_admin_mailing.sql` **avant** de
   déployer le code. Cette migration est aussi nécessaire à l’export et à la
   suppression des données personnelles des comptes clients.
2. Conserver les paramètres SMTP `NEWSLETTER_*` existants et renseigner
   `NEXT_PUBLIC_SITE_URL` avec l’URL HTTPS publique en production.
3. Prévoir un `MAILING_UNSUBSCRIBE_SECRET` stable d’au moins 32 caractères.
   Si cette variable est vide, `ADMIN_SESSION_SECRET` est utilisé. Changer le
   secret invalide les anciens liens : le conserver entre les déploiements.
4. Dans l’admin, envoyer volontairement un test vers sa propre adresse avant
   une première campagne réelle. Les tests automatisés n’envoient aucun e-mail.

Laisser l’onglet ouvert pendant l’envoi. Le bouton **Pause** arrête le traitement
après le message courant ; fermer l’onglet interrompt également les demandes
suivantes. L’historique permet de reprendre les destinataires encore en attente.
La file est persistée en base, avec au plus un message en cours par campagne et
un nouveau départ par seconde pour l’ensemble des campagnes. Un envoi interrompu
reste en cours jusqu’à cinq minutes puis devient « résultat incertain » lors de
la reprise. Il n’est jamais renvoyé automatiquement. « Envoyé » signifie accepté
par le serveur SMTP ; les ouvertures, clics et rebonds ultérieurs ne sont pas suivis.
Une panne de connexion, un refus d’authentification ou une limitation temporaire
du fournisseur arrête l’envoi en conservant les autres destinataires en attente.

Chaque destinataire reçoit un message individuel avec désinscription signée
(confirmation publique et en-tête One-Click). Une campagne accepte au maximum
10 000 adresses. L’interface affiche les 50 dernières campagnes et les 100 derniers
résultats d’une campagne ; les compteurs portent sur tous les destinataires.

Vérifications : `npx vitest run src/lib/mailing-policy.test.ts
src/lib/mailing-email.test.ts src/lib/mailing-routes.test.ts
src/lib/mailing-backend.test.ts`, `npm run check:supabase-grants`, puis
`node scripts/audit-admin-mailing.mjs` pour l’audit navigateur avec données fictives.

La migration du centre a été appliquée le 2 octobre 2026 au projet Supabase lié
`eyowwwpdmfrulhkpvlnf`, à la demande de l’utilisateur. La prévisualisation après
application confirme que toutes les migrations sont à jour. Les vérifications
distantes confirment la lecture serveur des campagnes et destinataires, la
présence des six RPC, le refus des accès anonymes et la protection de la table
de dispatch. Aucun e-mail n’a été envoyé et aucune campagne de test n’a été créée.
Rapport : `output/admin-mailing-migration/verification.json`.
La publication du code de l’interface reste une étape distincte.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
