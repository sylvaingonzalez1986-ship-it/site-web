This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
