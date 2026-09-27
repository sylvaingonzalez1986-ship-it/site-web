# Monnaie de jeu à chaque commande

Barème validé : **10 € de jeu pour 1 € de produits payé**, après toutes les remises et hors frais de livraison. Le bonus revient à chaque commande, y compris pour les mêmes produits. Il s'ajoute aux récompenses du Carnet, sans nécessiter d'avis. Exemple : 50 € de produits + 5 € de livraison donnent 500 € de jeu.

Le montant proportionnel évite d'avantager le fractionnement : deux commandes de 25 € de produits donnent ensemble le même bonus qu'une commande de 50 €. Le calcul conserve les centimes : 12,34 € donnent 123,40 € de jeu. Une commande de produits gratuits ne rapporte rien.

## Déclenchement et historique

La migration `20260927000500_kq_order_cash_rewards.sql` enregistre la date d'activation. Seuls les premiers paiements confirmés à partir de cette date sont éligibles ; les commandes historiques ne sont pas recréditées. Une commande en attente avant activation peut recevoir le bonus si son premier paiement est confirmé ensuite.

Le déclencheur différé relit l'état final de la commande : paiement `paid`, commande non annulée, non archivée et sans contrôle de paiement en attente. Il couvre les confirmations Viva et les validations manuelles. L'état `not_configured` ne vaut pas confirmation de paiement.

Un reçu immuable par identifiant de commande conserve le bénéficiaire, la base nette en centimes, le montant de jeu, la date et la version du barème. Répéter une notification de paiement, modifier la commande ou rouvrir sa confirmation ne verse rien de plus. Une annulation ultérieure ne retire pas automatiquement des gains déjà versés ; le site ne dispose pas encore d'une procédure de remboursement avec reprise des récompenses.

Le crédit met à jour le portefeuille Kanab Quest et son journal comptable. Une erreur de récompense ne doit pas invalider un paiement réel : le versement reste récupérable par la synchronisation authentifiée, appelée à l'ouverture du Placard, du détail ou de la confirmation d'une commande payée. Les commandes sans compte sont rapprochées uniquement d'une adresse de compte vérifiée et non ambiguë.

## Affichage et accès

Le panier affiche une estimation sur le montant des produits après remises. La confirmation et le détail de commande affichent uniquement un reçu réellement enregistré. L'interface masque le programme tant que sa migration n'est pas disponible.

Les tables de configuration et de reçus sont privées, sans accès direct pour les rôles de l'API. Les RPC de lecture et de synchronisation sont réservées au serveur `service_role`. L'API publique ne fournit que le barème aux visiteurs ; les reçus et la synchronisation utilisent exclusivement l'identité de la session, jamais un bénéficiaire ou un montant envoyés par le navigateur.

## Vérification

- Tests Vitest : estimation, précision des montants, isolation des sessions, refus des réponses invalides, migration absente et limitation des synchronisations.
- `scripts/test-order-cash-rewards.mjs` : comportement SQL isolé, crédits, répétitions, exclusions, permissions et comptabilité.
- `scripts/audit-order-cash-rewards.mjs` : composants réels et API simulée, montants mis à jour, reçus, erreurs et affichage de 320 à 1 440 px.
- `npm run check:supabase-grants` : privilèges explicites des objets SQL.
