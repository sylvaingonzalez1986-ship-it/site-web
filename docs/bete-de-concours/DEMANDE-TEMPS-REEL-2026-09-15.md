# Demande commerciale en temps réel — 15 septembre 2026

La demande commerciale est désormais indépendante du nombre de cultures terminées. Une capacité commune à tous les lots se renouvelle progressivement : 4 heures en ligne, 12 heures pour les CBD shops. Les grossistes restent disponibles immédiatement, au tarif réduit existant.

## Équilibrage

- Capacité initiale inchangée : 40 à 280 g équivalents fleurs en ligne selon le palier de réputation, majorée jusqu’à 25 % avec la clientèle ; 400 à 900 g pour les shops selon les partenaires, ajustés par l’événement commercial.
- À 312 réputation, sans client fidèle, 90 g en ligne : une heure après épuisement, 22,5 g reviennent, avant modulation par la qualité, le prix et la saturation.
- Le Commercial conserve une capacité et un débit doublés ; les durées de recharge restent 4 h et 12 h.
- Les produits transformés consomment la même capacité en équivalent fleurs : changer de lot ou de filière ne crée pas de commandes supplémentaires.
- Hors connexion, la recharge s’arrête au plafond. Aucun cumul de journées de demande.
- Les compteurs de fidélisation sont conservés d’une culture à l’autre pendant 24 h : jusqu’à 5 nouveaux clients et 1 boutique, ou 10 clients et 2 boutiques pour le Commercial. Les règles existantes de qualité, de progression fractionnaire et de départs restent applicables.
- Au premier accès après 24 h, les compteurs, le réseau de référence et la réputation de référence sont actualisés. Les périodes manquées ne s’accumulent pas. La tendance commerciale est également conservée pendant cette période, pour empêcher de la relancer en terminant une culture.
- Le bonus tarifaire de réputation continue d’utiliser la réputation actuelle. La capacité et le bonus du réseau de boutiques utilisent le bilan de la période de 24 h.
- L’ordinateur et Internet gardent leurs règles existantes : 450 € d’achat permanent et 15 € par culture terminée avec reconduction activée. La recharge de demande ne facture pas de nouvelle culture.

## Calcul et cohérence

Le compte conserve une dette de demande normalisée entre 0 et 1 pour chaque circuit et un horodatage serveur. Dette restante = max(0, dette enregistrée − temps écoulé / durée de recharge). La demande disponible est la capacité multipliée par (1 − dette restante).

Le navigateur avance le dernier instant serveur grâce à une horloge monotone. Il actualise les estimations toutes les 15 secondes lorsque la page est visible, sans requête réseau. Une réouverture après plus d’une minute et le changement de période de 24 h actualisent le snapshot. Les lectures simultanées du composant sont regroupées.

Chaque confirmation est précédée d’une offre calculée et enregistrée côté serveur. Son prix et sa quantité restent fixes pendant dix minutes au maximum, jusqu’à la fin de la période courante si celle-ci arrive plus tôt. Une offre expirée propose de recalculer. Toute autre mutation du compte peut toujours nécessiter une nouvelle offre.

La vente vérifie et consomme la demande dans la même transaction verrouillée que le portefeuille et le stock. Les nouvelles commandes ne modifient pas les révisions et ne rendent donc pas une offre invalide à elles seules. Les horodatages ne peuvent pas reculer en cas de contention entre transactions. Les reprises grossistes ne consomment aucun de ces budgets. Les ventes restent idempotentes et les écritures privées au serveur.

## Migration et validation

Migration : `20260915000300_kq_realtime_commerce_demand.sql`. Elle convertit la capacité déjà consommée du cycle courant en dette, sans remettre les commandes à zéro. Aucun historique ni stock n’est supprimé.

Validation : tests unitaires des recharges, produits transformés, spécialité, prix et plafonds ; transaction SQL annulée couvrant la consommation, les cultures suivantes, les périodes de 24 h, les permissions, les horodatages et la régression d’arrondi des ventes ; audit navigateur à 320, 375, 768 et 1 280 pixels avec contrôle des requêtes et des offres expirées. Audit visuel reproductible pendant cette session dans `output/commerce-realtime/audit.mjs`.
