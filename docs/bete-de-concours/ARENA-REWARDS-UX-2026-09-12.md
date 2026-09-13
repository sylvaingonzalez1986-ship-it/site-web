# Arène — récompenses et expérience du classement

Intégration du 12 septembre 2026, après validation du plan UI/UX.

## Parcours livré

- Entrée de l’Arène : annonce explicite des fleurs à gagner, du taux de contribution et du partage 90/10, avec accès au classement.
- Classement : bocal en tête, montant et taux de la semaine, échéance si renseignée, prochaines étapes personnelles, rangs sélectionnables et parts estimées. Le classement compact conserve les récompenses. La propre position reste accessible hors Top 10.
- Bocal : bouton accessible ouvrant le détail du calcul ; remplissage sur une échelle fixe de 1 000 g, sans remise à zéro aux paliers. Le compteur continue au-delà. Animation uniquement sur hausse observée, actualisation toutes les 60 secondes lorsque la page est visible et au retour sur la fenêtre.
- Explications : commandes éligibles → contribution hebdomadaire → classement général → bon en grammes utilisable dans le panier. Le dé collectif est secondaire et repliable.
- Clôture : lancers masqués hors période active. Après attribution, le compte reçoit son gain réel depuis les attributions enregistrées, pas une projection du classement courant.
- Accessibilité : boutons clavier, états annoncés, focus après ouverture, réduction des mouvements et affichage sans débordement mobile.

## Règles conservées

Le calcul porte sur les **grammes de fleurs vendus éligibles**, pas le chiffre d’affaires ni les ventes virtuelles du Placard. Les taux hebdomadaires restent 1/4/7/10 %, selon les dés collectifs. La contribution de la semaine reste provisoire et peut diminuer si le taux collectif baisse.

Top 10 : 27 %, 18 %, 13,5 %, 6,75 % aux rangs 4 et 5, 3,6 % aux rangs 6 à 10. Fleur Surprise : 10 % pour un participant éligible hors Top 10. Trois duels requis par défaut, selon la saison. Les arrondis existants restent inchangés. Un rang inéligible ne transfère pas automatiquement sa part au suivant.

## Migration nécessaire avant une nouvelle clôture

`supabase/migrations/20260912000100_arena_customer_reward_standings_snapshot.sql`

La nouvelle RPC conserve dans la même transaction le classement fourni par le serveur et la clôture commerciale existante. L’attribution utilise ensuite ce classement enregistré, sans relire le classement d’une saison ultérieure. Les informations personnelles sont construites avec l’identifiant de session côté serveur et servies avec un cache privé désactivé.

La migration est **préparée, non appliquée à la base distante**. Les lectures des saisons actives restent compatibles avant migration. La nouvelle action de clôture nécessite la migration. Une ancienne saison déjà figée sans instantané exige de retrouver et vérifier ses résultats historiques ; l’application refuse d’inventer un classement de clôture à partir de celui d’aujourd’hui.

Les récompenses déjà attribuées restent consultables. Le bouton du joueur ouvre ses récompenses dans le panier ; le bon ne déclenche pas une expédition automatique. Aucune saison ni attribution réelle n’a été modifiée pendant les vérifications.

## Vérification

- 21 tests ciblés : répartition et arrondis, paliers, période de lancer, identité privée, classement figé, attribution réelle, séparation des saisons, refus d’attribution sans instantané.
- Vérification Chrome avec données de démonstration sur 320, 390, 768 et 1 440 px : absence de débordement, sélection des rangs, ouverture du bocal, dé simulé, visiteur, indisponibilité, chargement, clôture, attribution et entrée de l’Arène.
- Script reproductible : `node scripts/audit-arena-rewards.mjs`, avec le serveur local sur le port 3000. Il crée une page de démonstration temporaire, simule uniquement l’API des dés puis retire la page. Captures et résultats : `output/arena-rewards/`.
- Le parcours bêta authentifié et la transaction SQL restent à vérifier en environnement de recette après application de la migration. Les tests navigateur n’utilisent aucun compte ni cadeau réel.

Compilation de production et ESLint ciblé terminés avec succès. Des lectures Supabase ont échoué pendant la génération des pages ; la compilation a néanmoins terminé (code 0). La page de démonstration a été retirée et ne figure pas dans les routes du build.
