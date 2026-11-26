# Aperçu éditorial du guide d’analyse

Lot `find-report` pour [Comment lire une analyse laboratoire CBD ?](https://www.leschanvriersbretons.com/analyse-laboratoire-cbd). Le socle versionne le texte et les destinations possibles. L’activation du lot ajoute uniquement l’identifiant `find-report` à `src/app/analyse-laboratoire-cbd/seo-content.json`.

## Changement visible

Le bloc « Où trouver le rapport d’analyse ? » suit « La réponse courte ». Le lecteur peut ouvrir la catégorie fleurs, repérer le producteur sur la fiche, puis lire le PDF si le lien apparaît. Si la fiche indique l’absence de publication, elle ne donne pas accès aux résultats du lot. Le guide breton explique comment vérifier le lieu de culture indiqué.

Le crawl initial ne relevait aucun lien vers la catégorie fleurs ni vers le guide breton dans cette page. Le guide d’analyse était déjà lié depuis la catégorie fleurs et depuis le guide naturel. Le nouveau bloc apporte un trajet retour vers les fiches au moment où le lecteur apprend à identifier le lot. [Crawl initial](crawl-public-2026-11-26.json)

Le 26 novembre 2026, Sour RNA proposait un lien « Voir l’analyse laboratoire » et Small Bud Mix affichait l’absence d’analyse publiée. La variante décrit les deux cas sans inscrire de référence de produit, de valeur de laboratoire ou d’indication de disponibilité. [Libellés du HTML public](verifications-fiches-2026-11-26.json)

## Recette locale du 26 novembre

Next.js 16.4.6 en développement et Chrome 157 sur Windows. Le navigateur rend les deux versions de la route réelle. Le test utilise un catalogue public fictif vide, avec des contextes invités neufs, le refus des cookies facultatifs et les seuls contrôles de développement masqués pour les captures. La fixture ne simule pas la limitation de débit des API du pied de page. Les deux destinations du guide ont rendu leur H1 attendu. [Rapport avant](avant-recette.json) · [Rapport après](apres-recette.json)

| Fenêtre | Avant | Après |
| --- | --- | --- |
| 320 × 844, tactile émulé | [Capture](avant-320.webp) | [Capture](apres-320.webp) |
| 390 × 844, tactile émulé | [Capture](avant-390.webp) | [Capture](apres-390.webp) |
| 1 440 × 900, bureau | [Capture](avant-1440.webp) | [Capture](apres-1440.webp) |

Le guide répond 200 dans les deux versions. Le titre, la description, le H1, la canonique, les directives d’indexation et les types JSON-LD correspondent. Le HTML initial après activation contient une seule occurrence du nouveau H2 et ses deux liens. Aucune des trois largeurs ne déborde. Les liens sont soulignés et le focus clavier est perceptible.

À 390 px, toucher le lien « catalogue des fleurs CBD » a affiché la catégorie. À 1 440 px, Tab vers le second lien puis Entrée a ouvert le guide breton. Les requêtes HTTP publiques initiales permettent aussi de vérifier les destinations et le contrôle d’âge sur une entrée directe. La recette s’arrête à la navigation et à la lecture.

## Mesure

Le parcours visé part du guide, atteint une fiche fleur puis cherche le numéro de lot. Les impressions, clics, positions, visites et ventes attribuées sont N/D. Aucun gain de trafic ou de vente n’est déduit de la recette. Le premier contrôle après mise en ligne consiste à relire le HTML public du guide et à rejouer ses liens.
