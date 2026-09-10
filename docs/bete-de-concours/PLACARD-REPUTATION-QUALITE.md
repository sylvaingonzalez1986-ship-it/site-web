# Réputation par qualité — 9 septembre 2026

Barème d’équilibrage du jeu, pas une norme de qualité réelle. La note du jury
déjà attribuée au lot est utilisée ; aucun nouveau tirage ni bonus de machine.

| Filière | Baisse | Stable | Hausse |
| --- | --- | --- | --- |
| Fleur brute, hash tamisé, hash eau-glace | < 7 | 7 à 7,9 | ≥ 8 |
| Rosin, Static Sift, Hash Signature | < 8 | 8 à 8,7 | ≥ 8,8 |
| Biomasse | Jamais | Toujours | Jamais |

Les seuils existants d’accès aux recettes restent applicables : un lot interdit
à une recette ne devient pas transformable. Prix, rendements, capacité, matériel
et fonctionnement du duel restent inchangés.

Variation de base, avec le multiplicateur existant de chaque filière :

- Sous le seuil neutre : perte arrondie de `(seuil neutre − note) × 4 × multiplicateur`, au moins 1 point.
- Zone neutre : 0 point.
- Dès le seuil positif : gain arrondi de `(note − seuil positif + 1) × 4 × multiplicateur`.

Exemples : 7,5 en hash tamisé = 0 ; 7,5 en Rosin Sélection = −4 ;
8,8 en Rosin Premium = +10, hors éventuelle prime d’expertise.

Les primes aux ventes 3, 6 et 10 ne sont attribuées que si la variation de base
est positive. Les ventes continuent de compter pour l’expérience de filière ;
une prime non obtenue sur une vente neutre ou mauvaise n’est pas reportée.

La réputation globale reste ≥ 0. Le reçu conserve la variation réellement
appliquée : avec 2 points disponibles et une pénalité de 4, il indique −2.
Le bilan cumulé d’une filière peut être négatif. Une baisse peut réduire le
titre de réputation et le score composite déjà utilisé au classement.

La migration `20260909000100` autorise les variations signées et recalcule la
réputation côté SQL. Elle conserve verrouillages, atomicité et rejouabilité des
reçus. Aucun solde ou reçu passé n’est recalculé. Les devis doivent porter
`reputationPolicyVersion: 2` ; un ancien serveur doit être mis à jour avant
de reprendre les ventes. Les devis des lots non vendus sont rafraîchis par le serveur.

L’interface affiche le barème court de chaque recette, la variation signée,
un avertissement avant une vente pénalisante et le solde projeté, limité à zéro.

Vérification SQL isolée (sans Supabase local ni données de joueurs) :

```powershell
npm.cmd install --prefix output/reputation-test-tools --no-save --ignore-scripts --package-lock=false @electric-sql/pglite
node scripts/test-placard-quality-reputation.mjs
```
