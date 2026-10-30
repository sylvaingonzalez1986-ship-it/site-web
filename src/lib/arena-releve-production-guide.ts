import { getReleveWarehouseGuide } from './arena-releve-warehouse-guide';
import type { ReleveGuideStep } from "@/lib/arena-releve-guide";
import { canPerformKqBasicCare, KQ_BASIC_CARE_PRICE_CENTS } from "./kanab-quest-care";
import { canActivateKqHeritage, canPlayKqCard, getKqHandCodes, getKqStageDisplayName, isKqCultureDead, KQ_ACTIVE_CARDS, KQ_STAGES } from "./kanab-quest-game";
import { getKqReleveHarvests, type KqReleveProductionChapter, type KqReleveProductionState } from "./kanab-quest-releve-production";
import { projectKqStorageLot } from "./kanab-quest-storage";

const attribute = (name: string, value: string) => `[data-${name}=${JSON.stringify(value)}]`;

/** Candidates describe real controls. The guide chooses the first visible, enabled one. */
export function getReleveProductionGuide(chapter: KqReleveProductionChapter, state: KqReleveProductionState): ReleveGuideStep[] {
  const steps: ReleveGuideStep[] = [];
  const scope = `[data-releve-production="${chapter}"]`;
  const add = (id: string, title: string, instruction: string, selector: string, kind: ReleveGuideStep["kind"] = "button") => {
    steps.push({ id: `${chapter}:${id}`, title, instruction, selector, kind, scope });
  };
  const marked = (milestone: string) => state.milestones.includes(milestone);

  if (chapter === "plan" || chapter === "expansion" || chapter === "buddies") return getReleveWarehouseGuide(chapter, state);

  if (chapter === "launch") {
    if (state.game) return steps;
    add("confirm-start", "Le devis de ta campagne", "Vérifie les charges, puis commence : tes zones partiront ensemble.", "[data-culture-confirm-start]");
    if (!marked("deck-chosen")) {
      add("deck-open", "Tes soutiens", "Ouvre tes cartes de soutien pour préparer ton deck.", '[data-setup-choice="cards"]:not([open]) > summary', "summary");
      if (!marked("native-deck-inspected")) add("deck", "Prépare une carte de soutien", "Ajoute une copie avec +. Elle sera consommée seulement si tu la joues.", '[data-setup-choice="cards"] button[aria-label^="Ajouter une copie"]');
      add("deck-keep", "Ton deck est prêt", "Garde ces cartes pour passer à ton Héritage.", '[data-setup-choice="cards"] [data-culture-keep-choice]');
    }
    if (!marked("heritage-chosen")) {
      add("heritage-open", "Le pouvoir de ton Héritage", "Ouvre ton Héritage : cette carte reste dans ta collection.", '[data-setup-choice="heritage"]:not([open]) > summary', "summary");
      if (!marked("native-heritage-inspected")) add("heritage", "Équipe ton Héritage", "Choisis le pouvoir qui accompagnera ta campagne.", '[data-setup-choice="heritage"] button[aria-label^="Équiper"]');
      add("heritage-keep", "Un pouvoir pour la campagne", "Garde ce choix. Tu pourras utiliser son pouvoir au bon moment.", '[data-setup-choice="heritage"] [data-culture-keep-choice]');
    }
    add("start", "Ta première campagne commence", "Lance la campagne pour voir les charges avant confirmation.", "[data-culture-preparation] > button");
    return steps;
  }

  const game = state.game;
  if (!game) return steps;
  if (chapter === "culture") {
    if (isKqCultureDead(game)) {
      add("retry", "On reprend cette étape ensemble", "Dans cet essai, préparer une nouvelle culture reprend ton dernier point de contrôle.", '[data-culture-recovery-action="prepare"]');
      return steps;
    }
    add("confirm-card", "Vérifie le coût de ce soutien", "Vérifie l’effet et le coût en XP. Brûler et jouer consomme une copie de l’album d’essai.", "[data-culture-confirm-card]");
    if (!marked("health-read")) {
      add("health", "Commence par observer", "Ouvre Soins et suivi : santé, problèmes et interventions sont gratuits à consulter.", '[data-care-toggle][aria-expanded="false"]');
    }
    if (game.phase === "complete") {
      if (!marked("recap-read")) add("recap", "Ta récolte a une histoire", "Ouvre le journal et les cartes de ta campagne pour retrouver les résultats.", "[data-culture-campaign-recap] > summary", "summary");
      return steps;
    }
    const stageName = getKqStageDisplayName(KQ_STAGES[game.stageIndex]);
    if (game.phase === "resolved") {
      add(`advance-${game.stageIndex}`, game.stageIndex === 5 ? "Découvre ce que tu as produit" : `${stageName} : bilan enregistré`, game.stageIndex === 5 ? "Découvre la récolte de tes Buddies et la quantité obtenue !" : "Regarde les effets de ce bilan, puis passe à l’étape suivante.", '[data-culture-primary-action][data-action="advance"]');
      return steps;
    }
    if (game.care && game.care.vitality < 65 && canPerformKqBasicCare(game).allowed && state.cashCents >= KQ_BASIC_CARE_PRICE_CENTS) {
      add(`care-open-${game.stageIndex}`, "La vitalité baisse", "Ouvre le suivi : un entretien commun à 5 € peut aider au prochain bilan.", '[data-care-toggle][aria-expanded="false"]');
      add(`care-${game.stageIndex}`, "Un entretien pour accompagner la reprise", "Prévois l’entretien à 5 € pour le prochain bilan. Il ne répare pas les pertes déjà subies.", "[data-care-basic]");
    }
    const timing = game.phase === "prepare" ? "before-roll" : "after-roll";
    const alreadyTriedTiming = game.usedCards.some(code => KQ_ACTIVE_CARDS.find(card => card.code === code)?.timing === timing);
    const playable = getKqHandCodes(game).map(code => KQ_ACTIVE_CARDS.find(card => card.code === code))
      .filter(card => card && card.timing === timing && canPlayKqCard(game, card).allowed && state.supportInventory[card.code] > 0)
      .sort((left, right) => left!.xpCost - right!.xpCost)[0];
    if (!alreadyTriedTiming && playable) {
      add(`hand-open-${game.stageIndex}`, "Tes cartes sont là", game.phase === "prepare" ? "Ouvre Préparer une carte pour regarder ta main." : "Ouvre Jouer une réaction avant de valider.", "[data-culture-hand]:not([open]) > summary", "summary");
      add(`card-${game.stageIndex}-${timing}`, game.phase === "prepare" ? "Essaie une préparation" : "Tu peux encore réagir", `Ouvre « ${playable.name} » : effet et coût de ${playable.xpCost} XP à vérifier avant de jouer.`, `${attribute("action-card", playable.code)} > [data-game-card-artwork]`, 'element');
    }
    if (game.phase === "prepare") {
      add(`roll-${game.stageIndex}`, `${stageName} : à toi de lancer`, "Lance les dés : 1 = danger, 4 ou 5 = réussite, 6 = étincelle. Tes soutiens sont prêts ?", '[data-culture-primary-action][data-action="roll"]');
    } else {
      if (canActivateKqHeritage(game).allowed) add(`heritage-${game.stageIndex}`, "Ton Héritage peut intervenir", "Tu peux activer ton Héritage maintenant, ou le garder et valider le résultat.", '[aria-label^="Héritage équipé"] button');
      add(`resolve-${game.stageIndex}`, "Valide ton choix", "Tes réactions sont terminées ? Vérifie la prévision, puis valide ce bilan.", '[data-culture-primary-action][data-action="resolve"]');
    }
    return steps;
  }

  if (chapter === "jury") {
    if (getKqReleveHarvests(state).some(harvest => !harvest.battle && projectKqStorageLot(harvest.storage, state.clock).stage === "curing")) {
      add("storage", "Affine ta récolte avant le jury", "Ouvre ton stockage pour voir chaque variété et son contenant.", "[data-releve-jury-storage]");
      add("mature", "Laisse les arômes se développer", "Vérifie tes contenants, puis termine les six heures d’affinage avec l’horloge fictive de cet essai.", '[data-releve-guide="mature"]');
      return steps;
    }
    add("confirm-training", "Ton premier entraînement", "Confirme le jury. La Fleur de cet essai sera consommée, ton lot reste disponible.", "[data-culture-confirm-training]");
    add("confirm-verdict", "Le jury est prêt", "Confirme ce verdict pour découvrir les trois manches de la rencontre.", "[data-culture-confirm-verdict]");
    add("return-jury", "Retrouve ta Fleur au jury", "L’affinage est terminé. Retourne au jury pour présenter ta Fleur.", '[data-releve-jury-return]');
    for (const { zoneId, game: harvest, battle } of getKqReleveHarvests(state)) {
      if (!battle) {
        add(`present-${zoneId}`, "Présente ta Fleur au jury", `Choisis Entraînement pour ${harvest.varietyName}. Ton lot restera disponible pour la vente.`, `[data-culture-training-flower="releve-flower-${zoneId}"]`);
        return steps;
      }
      if (battle.status !== "verdict") {
        add(`verdict-${zoneId}`, "Lance la rencontre", "Demande le verdict de ce duel pour découvrir les trois manches.", `[data-pending-battle]${attribute("battle-id", battle.id)} button`);
        return steps;
      }
      const revealed = state.revealedRounds[zoneId] ?? 0;
      if (revealed < battle.rounds.length) {
        if (!marked(`jury-analysis:${zoneId}`)) add(`analysis-${zoneId}`, "Les trois manches du jury", "Ouvre Manches et analyse du jury pour comparer les scores.", `${attribute("battle-id", battle.id)} [data-verdict-analysis] > summary`, "summary");
        add(`close-verdict-${zoneId}`, "Ton verdict est enregistré", "Ferme le verdict pour retrouver ta réserve et poursuivre l’aventure.", `[data-verdict-result]${attribute("battle-id", battle.id)} button[aria-label="Fermer le verdict"]`);
        add(`archive-${zoneId}`, "Retrouve le jury", "Ouvre ce résultat pour revoir les trois manches de ta Fleur.", `[data-archived-jury-recap]${attribute("battle-id", battle.id)} > summary`, "summary");
        return steps;
      }
    }
    if (getKqReleveHarvests(state).every(harvest => !!harvest.battle && state.milestones.includes(`jury-read:${harvest.zoneId}`))) return [];
  }
  return steps;
}
