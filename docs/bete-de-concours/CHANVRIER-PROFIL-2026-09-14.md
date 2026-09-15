# Profil de chanvrier — 14 septembre 2026

La première arrivée dans l’arène propose la création du personnage avant le tutoriel. Un onglet « Ma carte », portant le portrait et le surnom, déplie ensuite la carte de chanvrier au-dessus du bouton Guide. Elle présente le personnage en grand, sa spécialité, son bonus et un bouton de personnalisation. Elle se replie avec Échap, un clic extérieur ou son bouton de fermeture ; l’animation respecte la préférence de réduction des mouvements. Elle réutilise les données et l’illustration déjà chargées. Deux modèles, masculin et féminin, reprennent les contours noirs, les proportions et la trame de Sylvain. Six couleurs de vêtements et six teintes de peau sont disponibles. L’apparence n’influence aucun résultat.

Le surnom reprend les règles existantes du classement (3 à 24 caractères, lettres sans accent, chiffres, point, tiret et soulignement). Il reste synchronisé avec le profil public. L’apparence et le surnom sont modifiables ; la spécialité est définitive après sa première sauvegarde.

## Spécialités

| Choix | Effet effectif |
| --- | --- |
| Main Verte | +4 XP dès le début de chaque nouvelle culture, cumulables avec la rareté du Buddie et l’héritage. |
| Trésorier | Capital de départ de 2 000 € : +1 650 € une seule fois, en complément des 350 € habituels. Les Trésoriers déjà créés avec l’ancien bonus reçoivent uniquement le complément de 1 300 €, sans modifier leurs dépenses et gains antérieurs. |
| Commercial | Capacité de vente ×2 en ligne et en CBD shop, progression du recrutement ×2, jusqu’à 10 clients et 2 partenaires par cycle. Les prix unitaires, exigences de qualité et pertes de clientèle restent applicables. Les grossistes sont inchangés. |
| Bricoleur | Réparations des machines gratuites. Le joueur doit toujours les remettre en route dans l’entrepôt. |

## Usure des machines

Une culture terminée ajoute un cycle d’usure aux machines de transformation présentes dans son installation enregistrée au démarrage. Une culture abandonnée ne compte pas. L’usure antérieure à cette mise à jour n’est pas reconstituée. Le plateau manuel de tamisage est exempté.

- Niveaux 1 à 4 : réparation tous les 10 cycles.
- Niveaux 5 à 10 : tous les 20 cycles.
- Lyophilisateur : tous les 20 cycles, quel que soit son niveau.
- Prix : 6 % du prix de base, majoré de 5 % par niveau supplémentaire, arrondi au centime supérieur, entre 10 et 200 €. Exemple : presse à 850 €, niveau 1 → 51 €.

L’entrepôt affiche l’usure, l’échéance, le tarif et le bouton de réparation. Un avertissement avant la culture signale l’échéance imminente. Une machine usée empêche uniquement les nouvelles transformations qui la nécessitent ; les lots déjà transformés restent vendables. Les anciens appels de vente qui transformaient immédiatement sont également protégés.

Les bonus et paiements sont contrôlés côté serveur : verrouillage du portefeuille, vérification de propriété, version de l’état mécanique, prix recalculé, reçus idempotents et fonctions réservées au rôle de service. Un nouvel essai avec la même demande de réparation ne débite pas deux fois.

## Mise en service

Appliquer dans cet ordre, avant de publier le code applicatif :

1. `20260914000100_arena_chanvrier_profiles.sql`
2. `20260914000200_kq_machine_maintenance.sql`
3. `20260914000300_chanvrier_treasurer_starting_capital.sql` — capital du Trésorier à 2 000 € et complément pour les profils existants.
4. `20260914000400_chanvrier_green_thumb_xp.sql` — Main Verte : +4 XP par nouvelle culture.

Les migrations 003 et 004 ont aussi été appliquées le 14 septembre 2026 après validation SQL. Le bonus Main Verte est attribué au démarrage ; les cultures déjà commencées conservent leurs XP.

Les deux migrations ont été appliquées à la base distante le 14 septembre 2026, après vérification dans une transaction annulée. Leur absence provoquait une erreur 503 au chargement du guide et du profil : « Réessayer le guide » répétait la même erreur. Les lectures réelles de `arena_chanvrier_profiles`, `arena_journey_progress`, de la relation portefeuille/profil et des colonnes d’usure ont ensuite été vérifiées via l’API Supabase (HTTP 200). Le bouton de relance affiche maintenant un message et un état de chargement, et empêche les clics répétés pendant la requête. Les remplacements de fonctions existantes vérifient les fragments attendus et échouent explicitement si la définition distante a divergé.

Le profil est inclus dans la requête du tutoriel ; aucun appel HTTP supplémentaire au chargement. La spécialité est jointe aux lectures existantes du portefeuille et du commerce. L’illustration WebP unique (environ 134 Ko) est servie par le site, sans transfert d’image depuis Supabase. Les variantes de couleur sont calculées dans le navigateur.

## Illustration

Asset : `public/contest/avatars/chanvrier-duo-v1.webp`. Référence : `public/contest/mascot/arena-lobby-sylvain-v1.png`.

Outil : génération intégrée `image_gen`, puis édition de la même image et encodage WebP avec Sharp. Consignes artistiques : duo masculin/féminin en pied, proportions et visage de Sylvain, contours noirs épais, trame imprimée, vêtements bleus et peau pêche pour permettre la recoloration, poses lisibles, sans texte. L’édition finale remplace le damier de la première sortie par un fond crème uni en conservant les personnages.

## Vérifications

- `npm run test:ci` : 221 fichiers, 1 187 tests réussis, couverture globale des lignes 52,21 %.
- ESLint : aucun avertissement ni erreur sur les sources modifiées et ajoutées.
- `npm run build` : compilation de production réussie.
- `node scripts/audit-chanvrier-profile.mjs` : 320, 375 et 1 280 pixels ; profil avant tutoriel, variantes en direct, personnage féminin, sauvegarde unique, absence de débordement horizontal.
- `supabase/tests/chanvrier_profiles.sql` : scénarios transactionnels sur bonus unique, spécialité définitive, synchronisation du surnom, XP de rareté cumulée, rejet d’XP falsifiés, usure non répétée, blocage de transformation, propriété de machine, réparation payante/gratuite, idempotence et permissions. Toujours exécuter dans une transaction annulée.

Captures locales : `output/chanvrier-profile/appearance-1280.png`, `appearance-375.png`, `strength-320.png`.
