import { CONTEST_SCORE_CRITERIA, type ContestScoreCriterion } from "@/types/contest";
import { NOTEBOOK_LESSON_CRITERIA, NOTEBOOK_LESSON_FIELDS, NOTEBOOK_LESSON_SCORE_SCALE } from "./contest-notebook-lesson";
import type { ReleveGuideStep } from "./arena-releve-guide";

type NotebookCheckpoint = ReleveGuideStep & { page: number };
const scope = "[data-tasting-book]";
const checkpoint = (id: string, page: number, title: string, instruction: string, selector: string, readySelector?: string, pendingLabel?: string): NotebookCheckpoint => ({
  id: `notebook:${id}`, page, title, instruction, selector, scope, kind: "element",
  checkpoint: { label: "Continuer", readySelector, pendingLabel },
});
const score = (criterion: ContestScoreCriterion, page: number) => checkpoint(
  `score-${criterion}`, page, NOTEBOOK_LESSON_CRITERIA[criterion].title, NOTEBOOK_LESSON_CRITERIA[criterion].instruction,
  `[data-notebook-criterion="${criterion}"] input[type="range"]`,
  `[data-notebook-criterion="${criterion}"][data-notebook-evaluated="true"]`, "Ajuste ou confirme la note",
);

/** One explanation at a time, acknowledged by the player after trying the real field. */
export const NOTEBOOK_LESSON_CHECKPOINTS: readonly NotebookCheckpoint[] = [
  checkpoint("mode", 0, NOTEBOOK_LESSON_FIELDS.mode.title, NOTEBOOK_LESSON_FIELDS.mode.instruction,
    '[data-notebook-method][aria-pressed="true"]', '[data-notebook-mode-confirmed="true"]', "Choisis un mode dans la fiche"),
  checkpoint("mode-details", 0, NOTEBOOK_LESSON_FIELDS.modeDetails.title, NOTEBOOK_LESSON_FIELDS.modeDetails.instruction,
    "[data-notebook-mode-details]"),
  checkpoint("score-scale", 1, "Les notes · comprendre l’échelle", NOTEBOOK_LESSON_SCORE_SCALE,
    '[data-notebook-criterion="appearance"] input[type="range"]'),
  ...CONTEST_SCORE_CRITERIA.slice(0, 3).map(criterion => score(criterion, 1)),
  checkpoint("aromas", 2, NOTEBOOK_LESSON_FIELDS.aromas.title, NOTEBOOK_LESSON_FIELDS.aromas.instruction,
    '[data-notebook-aroma="citrus"]', '[data-notebook-aroma="citrus"]:checked', "Coche Agrumes dans la fiche"),
  checkpoint("aromas-multiple", 2, "Plusieurs arômes · plusieurs cases",
    "Contrairement au mode, les arômes permettent plusieurs choix à la fois. Imagine une nuance florale en plus du citron : coche Floral en gardant Agrumes. Un second clic retire une case ; dans ton Carnet, coche seulement ce que tu reconnais.",
    '[data-notebook-page="2"]:not(:has([data-notebook-aroma="citrus"]:checked)) [data-notebook-aroma="citrus"], [data-notebook-page="2"]:has([data-notebook-aroma="citrus"]:checked) [data-notebook-aroma="floral"]', '[data-notebook-page="2"]:has([data-notebook-aroma="citrus"]:checked) [data-notebook-aroma="floral"]:checked', "Garde Agrumes et coche Floral"),
  checkpoint("other-aroma", 2, NOTEBOOK_LESSON_FIELDS.otherAroma.title,
    "Une nuance ne correspond à aucune famille proposée ? Coche Autre : un champ apparaît pour lui donner un nom. Essaie cette case sur notre fiche fictive ; ce choix restera facultatif dans ton Carnet.",
    '[data-notebook-aroma="other"]', '[data-notebook-aroma="other"]:checked', "Coche Autre pour voir le champ"),
  checkpoint("other-aroma-detail", 2, "Ta nuance · lui donner un nom", NOTEBOOK_LESSON_FIELDS.otherAroma.instruction,
    "[data-notebook-other-aroma]", '[data-notebook-other-aroma][data-notebook-filled="true"]', "Écris une nuance fictive"),
  checkpoint("aromas-review", 2, "Tes cases · décrire avant de noter",
    "Tu sais maintenant cocher, combiner et préciser les familles. Tu peux retirer Autre pour voir son champ se refermer, ou garder ta nuance. Les cases décrivent le profil ; les trois curseurs suivants jugent séparément la qualité du nez, son intensité et sa complexité.",
    '[data-notebook-aroma="other"]'),
  ...CONTEST_SCORE_CRITERIA.slice(3, 6).map(criterion => score(criterion, 2)),
  ...CONTEST_SCORE_CRITERIA.slice(6, 9).map(criterion => score(criterion, 3)),
  checkpoint("profile", 4, "Le bilan · lire ta note et le dessin",
    "Ta note est la moyenne des critères déjà évalués ; l’impression générale y comptera aussi. Le dessin compare tes neuf notes d’aspect, d’odeur et de goût : plus le tracé s’éloigne du centre, plus la note est haute. La moyenne des joueurs apparaît lorsqu’il existe des avis validés.",
    '[data-score="player"]'),
  score("overall_impression", 4),
  checkpoint("comment", 4, NOTEBOOK_LESSON_FIELDS.comment.title, NOTEBOOK_LESSON_FIELDS.comment.instruction,
    "[data-notebook-comment]", '[data-notebook-comment][data-notebook-filled="true"]', "Écris ou préremplis ton avis"),
  checkpoint("recap", 4, NOTEBOOK_LESSON_FIELDS.recap.title, NOTEBOOK_LESSON_FIELDS.recap.instruction,
    "[data-notebook-submit]"),
];

const entrySteps: ReleveGuideStep[] = [
  { id: "notebook:resume-notes", title: "Retrouve les pages à compléter", instruction: "Reprends la dégustation : nous retrouverons ensemble le prochain champ à découvrir.", text: "Continuer la dégustation", scope },
  { id: "notebook:taste", title: "Ta fiche d’entraînement", instruction: "Cette Fleur d’essai nous servira à apprendre les choix, les cases à cocher et les dix notes du vrai Carnet. Ouvre ses pages de dégustation ; tout ce que tu renseignes ici reste fictif.", text: "Déguster cette fleur", scope },
  { id: "notebook:flower", title: "Choisis la Fleur d’essai", instruction: "Ouvre cette Fleur pour découvrir sa fiche, puis ses pages de dégustation.", selector: "button[data-book-entry]", scope },
  { id: "notebook:chapter", title: "Ouvre le chapitre Indoor", instruction: "La Fleur prêtée se trouve dans Regular, catégorie Indoor. Clique pour la retrouver.", selector: 'button[data-track="regular"][data-culture="indoor"]', scope },
  { id: "notebook:cover", title: "Ouvrons ton Carnet", instruction: "Clique sur la couverture pour feuilleter le Carnet et découvrir la Fleur d’entraînement.", selector: 'button[aria-label="Ouvrir mon carnet de dégustation"]', scope },
  { id: "notebook:contents", title: "Retrouvons la Fleur d’essai", instruction: "La fiche d’entraînement se trouve dans Regular, puis Indoor. Ouvre la table des matières pour y revenir ; tes notes d’essai sont conservées.", selector: '[data-tasting-book]:not([data-notebook-view="tasting"]) button[aria-label="Table des matières"]', scope },
];

export function getNotebookLessonGuide(acknowledged: readonly string[]): ReleveGuideStep[] {
  const index = NOTEBOOK_LESSON_CHECKPOINTS.findIndex(step => !acknowledged.includes(step.id));
  const current = NOTEBOOK_LESSON_CHECKPOINTS[index];
  const page = current?.page ?? 4;
  const pageNames = ["Démarrer", "Aspect", "Odeur", "Goût", "Verdict"];
  const progressLabel = current ? `Repère ${index + 1}/${NOTEBOOK_LESSON_CHECKPOINTS.length}` : "Prêt à terminer";
  const target: ReleveGuideStep = current
    ? { ...current, progressLabel }
    : { id: "notebook:submit", title: "Termine ta fiche d’entraînement", instruction: "Les choix, les dix notes et le commentaire sont prêts. Clique sur Envoyer mon avis pour essayer la validation ; aucun avis réel n’est publié dans cet exercice.", selector: "[data-notebook-submit]", scope, progressLabel };
  return [
    target,
    // If Autre is deselected during its lesson, bring back its native field.
    ...(current?.id === "notebook:other-aroma-detail" ? [{ id: "notebook:restore-other", title: "Retrouve le champ Autre", instruction: "Recoche Autre pour faire réapparaître le champ et essayer de nommer une nuance.", selector: '[data-notebook-aroma="other"]', scope }] : []),
    { id: `notebook:next-page-${page}`, title: `La suite · ${pageNames[page]}`, instruction: `Nous avons parcouru les choix de cette page. Clique sur Suivant pour découvrir ${page === 1 ? "ce que jugent les trois lignes d’aspect" : page === 2 ? "les cases d’arômes, puis les trois notes du nez" : page === 3 ? "ce que jugent le goût, la douceur et la persistance" : "le jugement d’ensemble, le commentaire et la relecture"}.`, selector: `[data-notebook-page="${page - 1}"] [data-notebook-next]`, scope, progressLabel },
    { id: `notebook:resume-page-${page}`, title: `Reprenons · ${pageNames[page]}`, instruction: `Reviens à la page ${pageNames[page]} pour ${current ? `découvrir le prochain repère avec moi : ${current.title.toLocaleLowerCase("fr")}` : "terminer ta fiche"}. Tes choix déjà saisis sont conservés.`, selector: `[data-notebook-page-link="${page}"]:not([aria-current="page"])`, scope, progressLabel },
    ...entrySteps,
  ];
}
