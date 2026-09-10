# Audit des illustrations Situation du Placard

Date de l'audit : 2 septembre 2026

## Périmètre

- 30 illustrations de situation, de `SIT-001` à `SIT-030` ;
- 1 illustration d'état pour la coupure de courant ;
- comparaison avec le modèle de Sylvain défini dans `PLACARD-DA-V2.md` ;
- contrôle de la lisibilité à l'échelle d'une carte et en plein format.

Le contact sheet de travail est généré par :

```powershell
node scripts/generate-kanab-quest-situation-contact-sheet.mjs
```

Il est écrit dans `output/placard-situation-audit-20260902.webp`.

## Verdict

Les 31 illustrations sont cohérentes et peuvent rester en production dans leur
version `v2`. Une régénération n'apporterait pas de gain suffisant et risquerait
de dégrader la continuité du personnage.

Chaque scène respecte les invariants suivants :

- format carré et sujet lisible dans la zone centrale ;
- contours noirs réguliers, aplats, trame imprimée et palette commune ;
- un gag ou un symbole distinct pour identifier l'incident sans lire son titre ;
- Sylvain conserve son visage crème, sa casquette turquoise et beige, sa
  salopette turquoise, ses gants et ses proportions de mascotte cartoon ;
- aucune illustration n'est réutilisée pour deux situations différentes.

## Scènes de mécanique prioritaire

| Code | Lecture visuelle validée | Point de fidélité |
| --- | --- | --- |
| `SIT-021` | Facture démesurée et compteur électrique dans le rouge | Sylvain inquiet reste immédiatement reconnaissable |
| `SIT-024` | Contrôle administratif et pile de dossiers instable | La contrôleuse reste secondaire face à Sylvain et aux papiers |
| `SIT-027` | Voleur emportant la production sous une ombre de renard | Le vol et le surnom « renard à deux pattes » se comprennent ensemble |
| Coupure | Placard éteint, plantes dans l'ombre et lampe frontale | La faible lumière sert la mécanique sans perdre la silhouette de Sylvain |

## Contrôles automatisés associés

- `src/lib/kanab-quest-situation-artwork.test.ts` vérifie la couverture exacte
  du catalogue, les fichiers locaux et l'unicité des chemins ;
- `src/lib/kanab-quest-artwork-quality.test.ts` vérifie l'absence de bitmap
  dupliqué, le format carré, la résolution minimale et le budget de transfert ;
- `src/lib/kanab-quest-artwork-review.test.ts` maintient l'inventaire de revue
  utilisé par le panneau d'administration.

La validation éditoriale finale du contact sheet reste une décision humaine de
lancement. Elle ne nécessite plus de production graphique supplémentaire tant
qu'aucune scène précise n'est refusée.
