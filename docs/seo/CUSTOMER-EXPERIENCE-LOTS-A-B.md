# Expérience client — lots A et B

## Livré dans le code

- Ajout sans connexion depuis les cartes et les fiches produits, confirmation et accès direct au panier.
- Panier conservé sur le navigateur pendant 48 heures, avec reprise de l'ancien stockage de session. Les coordonnées et informations de compte ne sont pas enregistrées dans ce panier.
- Conservation lors de la connexion et réouverture au retour. Un nouvel onglet retrouve le panier enregistré.
- Calcul des modifications avant mise à jour de React : les refus de stock sont retournés correctement, y compris lors d'ajouts successifs.
- Contrôle des formats disponibles, plafonds de quantité et limites de stock.
- Panier visiteur simplifié, estimation domicile/relais, connexion demandée seulement pour poursuivre la commande.
- Accueil : quatre produits achetables avant la philosophie ; production propre prioritaire, partenaires identifiés.
- Deux colonnes sur mobile, quatre sur grand écran ; introduction plus courte et bouton boutique avant l'illustration sur mobile.
- Bloc livraison retiré de l'accueil à la demande de l'utilisateur. Les frais et avantages de fidélité restent présentés dans le panier.

## Étude du paiement invité — proposition à valider séparément

Le lot A validé prévoit une étude du paiement invité. Il n'est pas activé par ces changements : le compte reste nécessaire au paiement.

### Dépendances constatées

1. src/app/api/checkout/viva/route.ts exige une session client, puis lit sa date de naissance avant de créer le paiement.
2. Le calcul des avantages dépend du client : fidélité, parrainage, bons et packs.
3. src/components/checkout/VivaPaymentReturnPage.tsx vérifie l'appartenance de la commande à la session avant d'en afficher le détail.
4. Le suivi, la reprise des paiements et les factures passent actuellement par les routes du compte.

### Parcours proposé

Panier → coordonnées et contrôle d'âge → livraison → récapitulatif → paiement → confirmation → proposition facultative de créer un compte.

### Mise en œuvre proposée

- Introduire une identité de commande invitée indépendante du compte ; vérifier schéma, contraintes et règles d'accès avant migration.
- Conserver la validation serveur des prix, formats, stocks, adresse et majorité. Le panier navigateur ne fait jamais autorité pour le paiement.
- Utiliser un identifiant de tentative et une preuve d'accès signée pour la confirmation, la reprise et le suivi. Ne pas autoriser l'accès avec le seul numéro de commande ou une adresse email déclarée.
- Appliquer les mêmes règles de calcul et de réservation de stock que pour une commande connectée.
- Décision commerciale : fidélité et packs réservés au compte, ou attribution différée après vérification d'email. Éviter toute attribution multiple.
- Proposer le rattachement des commandes après vérification d'email, sans inscription marketing automatique.

### Critères d'acceptation avant activation

Commande invitée payée, annulée et reprise ; webhook reçu deux fois ; retour sans cookie ; accès à une autre commande refusé ; majorité manquante ; stock insuffisant ; format désactivé ; compte existant avec la même adresse ; attribution unique des avantages ; panier vidé seulement après paiement confirmé.

## Validation des lots livrés

- Tests : cart-mutations, cart-session-storage, home-featured-products, shipping.
- Script : node scripts/audit-customer-ab.mjs, serveur local sur http://localhost:3000.
- Rendus 320, 390 et 1440 px ; produits disponibles avant la philosophie, colonnes, absence de débordement.
- Ajout visiteur, lien de retour vers le panier, nouvel onglet, connexion simulée préservant les lignes.
- Captures et résultats dans output/customer-ab/.
- Aucun compte réel créé ni commande passée dans le scénario ; paiement Viva réel non testé.

## Mesure après publication

Comparer ajouts au panier, passages à la connexion, commandes payées et chiffre d'affaires par visite sur mobile et PC. Utiliser des périodes et sources de trafic comparables. Les validations techniques ne prouvent pas un gain de conversion.
