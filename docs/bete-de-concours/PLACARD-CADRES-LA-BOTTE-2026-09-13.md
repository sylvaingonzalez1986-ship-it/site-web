# Cadres La Botte dans le style de l’arène

Les 32 cartes jouables utilisent un cadre vert profond et crème, une typographie condensée, un cartouche XP jaune et une bordure liée à l'utilité. Les illustrations sources et leur cadrage dans le recto sont conservés (zone 840 × 730, position 92 × 194). Aucune règle de jeu, rareté ou probabilité de pack n'est modifiée.

| Utilité principale | Repère | Sens |
| --- | --- | --- |
| Protection | Menthe · bouclier | Limiter les Dangers ou protéger la récolte |
| Diagnostic | Bleu · loupe | Identifier le ravageur |
| Relance & dés | Mauve · dé | Relancer ou obtenir un dé supplémentaire |
| Qualité | Jaune · étoile | Obtenir un bonus de qualité |
| Réussite | Vert clair · coche | Corriger les dés ou faciliter le seuil demandé |
| Anti-ravageurs | Abricot · insecte | Utiliser un auxiliaire PBI ciblé |

La couleur est doublée d'un libellé et d'un pictogramme. Le moment d'utilisation occupe une ligne fixe sous le rôle. Les situations concernées, l'effet et la limite restent séparés. La rareté apparaît dans le pied de carte avec son nom et un à quatre losanges, indépendamment du rôle.

Le générateur existant produit les nouveaux contours sans génération d'illustrations : `node scripts/generate-kanab-quest-card-fronts.mjs --support-only`. Les fichiers `botte-*-front-v5.webp` remplacent les rectos v4 du travail en cours ; le nouveau nom évite de conserver un ancien cadre dans le cache d'images. Le catalogue local et la migration indoor déjà préparée utilisent ces chemins. Cette migration n'a pas été exécutée sur une base distante.

La même légende accompagne le deck et l'inventaire. Les explications HTML reprennent les six rôles. La grille s'adapte aux tablettes et le carrousel mobile est conservé. Dans l'album, la rareté et le coût sont sous le titre : aucune pastille ne recouvre le cartouche XP du recto.

Vérification : génération des 32 rectos avec contrôle des longueurs de texte, tests des fichiers et du catalogue, audit navigateur des six rôles aux largeurs 320, 390, 768 et 1440 px. Captures locales dans `output/placard-indoor-deck/`.
