import type { KqBattle } from "./kanab-quest-battle";
import { canActivateKqHeritage, getKqZeroSuccessStageCount, isKqCultureDead, KQ_CARDS, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createLocalKqRepository, type KqRepository } from "./kanab-quest-repository";
import { KQ_TRIAL_EQUIPMENT, startKqTrialCulture } from "./kanab-quest-trial";
import { createKqWorkshop } from "./kanab-quest-workshops";

export type KqPlayableLessonId = "cards" | "culture" | "jury";
export type KqPlayableLessonProgress = { instruction: string; complete: boolean };
export type KqPlayableLessonSnapshot = { game: KqGameState; battle: KqBattle | null; setupOpen: boolean; revealedRounds: number };
type LessonStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type KqPlayableLessonPort = {
  repository: KqRepository;
  storage: LessonStorage;
  initialGame: KqGameState;
  setupOpen: boolean;
  startGame: (config: Parameters<typeof startKqGame>[1]) => KqGameState;
  onProgress: (snapshot: KqPlayableLessonSnapshot) => void;
};

export const KQ_PLAYABLE_ASSISTANCE_NOTICE = "Essai assisté : un dé passe à 4 pour poursuivre jusqu’à la récolte fictive.";
const LESSON_TIME = "2026-09-16T12:00:00.000Z";

export function kqPlayableLessonPrefix(scope: string, lesson: KqPlayableLessonId) {
  return `kq-playable-lesson-v2:${encodeURIComponent(scope)}:${lesson}:`;
}

/** Even auxiliary preferences and transaction journals remain in this exercise. */
export function createKqLessonStorage(scope: string, lesson: KqPlayableLessonId, backing?: LessonStorage): LessonStorage {
  const prefix = kqPlayableLessonPrefix(scope, lesson);
  const memory = new Map<string, string>();
  let unavailable = false;
  return {
    getItem(key) {
      if (!unavailable && backing) {
        try { const value = backing.getItem(prefix + key); if (value !== null) memory.set(key, value); return value; }
        catch { unavailable = true; }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      if (!unavailable && backing) try { backing.setItem(prefix + key, value); } catch { unavailable = true; }
    },
    removeItem(key) {
      memory.delete(key);
      if (!unavailable && backing) try { backing.removeItem(prefix + key); } catch { unavailable = true; }
    },
  };
}

export function createKqPlayableLesson(lesson: KqPlayableLessonId, storage: LessonStorage, onProgress: KqPlayableLessonPort["onProgress"]): KqPlayableLessonPort {
  const initialGame = lesson === "jury" ? createKqWorkshop("jury").game! : startKqTrialCulture();
  return {
    repository: createLocalKqRepository(storage), storage, initialGame, setupOpen: lesson === "cards", onProgress,
    startGame: (config) => startKqGame(2, {
      ...config, startedAt: LESSON_TIME, recentSituationCodes: undefined, challengeDayKey: undefined,
      requiredSituationTags: [], startingXp: 1, equipmentCodes: KQ_TRIAL_EQUIPMENT,
      collectionCodes: KQ_CARDS.map(card => card.code), firstCultureRescue: undefined,
    }),
  };
}

/** Prepare a visible die before resolution; official game functions stay intact. */
export function assistKqPlayableLesson(game: KqGameState): KqGameState {
  if (game.phase !== "rolled" || !game.dice || getKqZeroSuccessStageCount(game) < 1 || game.dice.some(die => die >= 4)) return game;
  const dice = [...game.dice] as [number, number, number];
  dice[dice.indexOf(Math.max(...dice))] = 4;
  return { ...game, dice, effectNotices: [...(game.effectNotices ?? []), KQ_PLAYABLE_ASSISTANCE_NOTICE].slice(-12) };
}

export function getKqPlayableLessonProgress(lesson: KqPlayableLessonId, snapshot: KqPlayableLessonSnapshot): KqPlayableLessonProgress {
  const { game, battle, setupOpen, revealedRounds } = snapshot;
  const complete = lesson === "cards" ? !setupOpen
    : lesson === "jury" ? battle?.status === "verdict" && revealedRounds >= battle.rounds.length
      : game.phase === "complete" && !isKqCultureDead(game) && game.history.length === 6;
  if (complete) return { complete: true, instruction: lesson === "cards" ? "Préparation lancée : tes choix sont enregistrés dans cet essai." : lesson === "jury" ? "Les trois manches sont révélées. Compare les notes et les critères du jury." : "Ta Fleur est récoltée. Consulte sa qualité, sa quantité et les cartes consommées." };
  if (setupOpen) return { complete: false, instruction: "Choisis un Buddie, compose ta main et sélectionne un Héritage dans les vrais carrousels. Prépare ensuite la culture et confirme son lancement fictif." };
  if (lesson === "jury") return { complete: false, instruction: !battle ? "Une Fleur récoltée t’est prêtée. Trouve un adversaire pour engager ton duel fictif." : battle.status === "locked" ? "Compare les deux Fleurs et les critères, puis demande et confirme le verdict." : "Observe les trois manches : chaque jury valorise des caractéristiques différentes." };
  if (game.phase === "prepare") return { complete: false, instruction: "Lis la situation. Choisis une préparation dans tes cartes ou conserve-les, puis lance les dés sur le tapis." };
  if (game.phase === "rolled") return { complete: false, instruction: canActivateKqHeritage(game).allowed ? "Ton Héritage est disponible. Essaie son pouvoir, puis observe le résultat prévu avant de valider l’étape." : "Observe les dés et le résultat prévu. Tu peux jouer une réaction avant de valider l’étape." };
  return { complete: false, instruction: "Lis le résultat : qualité, XP et pression ont évolué. Passe à l’étape suivante pour poursuivre ta culture. Un dé est assisté si nécessaire pour atteindre la récolte." };
}
