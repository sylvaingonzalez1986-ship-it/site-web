# Douze nouvelles situations et rotation des cultures

Le catalogue passe de 38 à 50 situations, avec exactement deux ajouts pour chacune des six étapes. Les codes existants et les parcours déjà enregistrés sont conservés.

| Étape | Nouvelles situations | Total |
| --- | --- | --- |
| Germination | SIT-039 Semis filant · SIT-040 Fonte des semis | 8 |
| Enracinement | SIT-041 Motte bousculée · SIT-042 Substrat qui repousse l’eau | 9 |
| Croissance | SIT-043 Attache trop serrée · SIT-044 Dépôts de sels | 8 |
| Floraison | SIT-045 Sonde trompeuse · SIT-046 Pollen indésirable | 9 |
| Récolte | SIT-047 Ciseaux encrassés · SIT-048 Étiquettes mélangées | 8 |
| Séchage & affinage | SIT-049 Joint de bocal fatigué · SIT-050 Poussière au séchoir | 8 |

Chaque ajout possède sa narration, sa difficulté, ses familles de cartes compatibles et ses trois traits de résultat. Les effets sur la qualité utilisent la résolution commune du jeu. Il n’y a pas de nouvelle facture automatique ni de nouvelle sanction réglementaire liée à ces événements.

Les cartes restent cohérentes avec le problème : pas de Voile d’ombrage sur le manque de lumière de SIT-039, pas de Palissage ou d’Effeuillage pour régler le pollen de SIT-046. Papiers en règle reste réservé au contrôle DDTM ; Récolte par lots peut aider à gérer SIT-048. Ces contraintes sont vérifiées avant de dépenser une carte ou de l’XP.

## Rotation

Les cultures lancées côté serveur ne fournissaient pas l’historique au tirage. Elles chargent désormais les douze dernières cultures terminées ou abandonnées du joueur, dans un ordre stable du plus récent au plus ancien. Pour un abandon, seules les étapes atteintes comptent.

Le tirage privilégie les situations absentes de cet historique, puis celles dont le dernier passage est le plus ancien. Le résultat reste déterministe pour des entrées identiques. Les parcours enregistrés ne sont pas recalculés.

Le vol reste un risque indépendant : sa probabilité est doublée à domicile. Avec huit situations de récolte, le tirage ordinaire passe à 2/8 à domicile et 1/8 en domiciliation extérieure, contre 2/6 et 1/6 auparavant. Il peut donc revenir malgré un vol récent. Les événements imposés par une mission peuvent également revenir si aucune autre situation ne satisfait ses contraintes.

Les contraintes de missions sont résolues ensemble pour qu’une nouvelle situation imposée n’efface pas un autre objectif. Elles conservent le résultat du tirage de vol, sauf demande explicite d’une mission de sécurité.

## Ancrage dans la réalité

Les scènes sont des adaptations ludiques de principes horticoles et de gestion des lots. Les références ci-dessous étayent les phénomènes, pas les valeurs de dés ou les probabilités du jeu. Les références générales sur les végétaux sont transposées au décor de chanvre du Placard.

- **SIT-039 et SIT-040** : manque de lumière et fonte des semis. Un semis effondré n’est pas présenté comme guérissable ; la réussite protège ses voisins. [University of Minnesota — Starting seeds indoors](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/starting-seeds-indoors), [How to prevent seedling damping off](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/yard-and-garden-problems/how-to-prevent-seedling-damping-off).
- **SIT-041** : perturbation de la motte et des racines lors du déplacement. Transposition du principe de choc racinaire, sans reprendre les prescriptions destinées aux arbres. [University of Minnesota — Planting and transplanting trees and shrubs](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/planting-and-transplanting-trees-and-shrubs).
- **SIT-042** : certains substrats peuvent repousser l’eau lorsqu’ils sont difficiles à réhumidifier. [University of Maryland — Growing media for containers](https://extension.umd.edu/resource/growing-media-potting-soil-containers).
- **SIT-043** : un lien de soutien doit laisser de la place à la tige et ne pas la blesser. [Iowa State University — Staking perennials](https://yardandgarden.extension.iastate.edu/how-to/staking-perennials).
- **SIT-044** : accumulation de sels, ralentissement et pointes brunies. Le récit demande un contrôle et ne présente pas une croûte blanche comme un diagnostic suffisant. [University of Maryland — Watering indoor plants](https://www.extension.umd.edu/resource/watering-indoor-plants).
- **SIT-045** : une mesure doit représenter les conditions au niveau des plantes. [UMass Amherst — Selecting and maintaining thermostats](https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/selecting-maintaining-thermostats).
- **SIT-046** : fleurs mâles productrices de pollen, pollinisation et formation de graines chez le chanvre. [University of Missouri — Industrial hemp](https://extension.missouri.edu/publications/mx80).
- **SIT-047 et SIT-050** : propreté des outils, surfaces et contenants, maîtrise des souillures. Nettoyer le matériel ne garantit pas qu’un lot exposé soit sain. [University of Minnesota — Cleaning and sanitizing tools, harvest containers and surfaces](https://extension.umn.edu/agriculture/farm-operations-and-systems/farm-food-safety/cleaning-and-sanitizing-tools-harvest-containers-and-surfaces), [Penn State — Preventing contamination before, during and after harvest](https://extension.psu.edu/preventing-contamination-before-during-and-after-harvest).
- **SIT-048** : identifier les lots et conserver leur correspondance avec le registre de récolte. La scène du prélèvement labo est une adaptation au jeu. [Penn State — Sample harmonized food safety plan, Traceability](https://extension.psu.edu/sample-harmonized-food-safety-plan).
- **SIT-049** : l’étanchéité protège les végétaux séchés des échanges d’humidité. Le joint fissuré matérialise cette perte de protection. [Penn State — Preserving herbs by drying](https://extension.psu.edu/preserving-herbs-by-drying).

## Illustrations

Outil : **image_gen intégré**, un appel distinct par illustration, puis conversion WebP avec Sharp. Références : mascotte `public/contest/mascot/tasting/tasting-verdict.png` et placard `situation-SIT-001-depart-hesitant-v3.webp`.

Les douze assets sont enregistrés dans `public/app/kanab-quest/situations/`, sous les noms `situation-SIT-039-…-v1.webp` à `situation-SIT-050-…-v1.webp`, sauf SIT-043 qui utilise sa version `v2` retouchée pour conserver une tige continue sous l’attache. Carrés 1200 × 1200, avec textes alternatifs propres à chaque scène. L’éclairage horticole reste éteint pour le séchage et l’affinage.

Prompts, références, sources générées et exports : [SIT-039 à SIT-044](./situations-039-044.prompts.json), [SIT-045 à SIT-050](./situations-045-050.prompts.json).

## Vérification

Validation achevée le 22 septembre 2026 :

- 157 tests ciblés du moteur, de l’historique serveur, des missions, de la domiciliation, des cartes et des sauvegardes réussis après ajout des 50 situations.
- Suite générale : 243 fichiers et 1 423 tests exécutés ; 1 418 réussis au premier passage. Quatre assertions du manifeste de revue attendaient encore 108 assets / 39 scènes ; elles attendent désormais 120 assets / 51 scènes, coupure comprise. Un test indépendant de fonctionnalité concours avait dépassé son délai sous la charge globale.
- Reprise des quatre fichiers concernés par la revue, les images et le délai : **31 tests réussis**, avec deux workers. Les cinq échecs initiaux sont résolus ; aucun assouplissement de timeout ni modification du test concours.
- `tsc --noEmit` et ESLint sur les fichiers TypeScript modifiés : réussis.
- Revue visuelle des douze images, contrôle des proportions carrées, dimensions 1200 × 1200, fichiers WebP uniques et budget mobile. Une retouche de SIT-043 conserve une tige continue. Chaque image finale pèse moins de 360 000 octets.
- Planche de revue locale : `output/placard-situations-20260921/contact-sheet.png`.

Ces changements de situations et d’illustrations ne nécessitent aucune migration de schéma Supabase.
