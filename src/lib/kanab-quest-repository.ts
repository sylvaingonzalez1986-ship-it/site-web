import type { KqBattle } from "@/lib/kanab-quest-battle";
import { KQ_BUDDIES, KQ_CARDS, type KqGameState } from "@/lib/kanab-quest-game";
import { encodeKqSave, parseKqBattleSave, parseKqGameSave, parseKqRankSave } from "@/lib/kanab-quest-persistence";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";

export const KQ_LOCAL_KEYS = {
  game: "kanab-quest-dice-prototype-v7",
  battle: "kanab-quest-battle-prototype-v4",
  battleHistory: "kanab-quest-battle-history-v1",
  inventory: "kanab-quest-botte-inventory-v1",
  burnJournal: "kanab-quest-burn-journal-v1",
  burnHistory: "kanab-quest-burn-history-v1",
  verdictJournal: "kanab-quest-verdict-journal-v1",
  ranking: "kanab-quest-rank-prototype-v3",
  favoriteDeck: "kanab-quest-favorite-deck-v1",
  onboardingSeen: "kanab-quest-onboarding-seen-v1",
} as const;

export type KqFavoriteDeck = { buddieCode: string; substrateCode: string; supportCodes: string[] };

export type KqSessionSnapshot = {
  game: KqGameState | null;
  battle: KqBattle | null;
  battleHistory: KqBattle[];
  ranking: KqRankProfile | null;
  inventory: Record<string, number> | null;
  burnHistory: KqBurnReceipt[];
  favoriteDeck: KqFavoriteDeck | null;
  onboardingSeen: boolean;
};

export type KqBurnReceipt = { id: string; cardCode: string; runSeed: number; stageIndex: number; useKind: "substrate" | "support" | "pbi"; burnedAt: string };

export interface KqRepository {
  loadSession(): Promise<KqSessionSnapshot>;
  saveGame(game: KqGameState): Promise<void>;
  saveBattle(battle: KqBattle | null): Promise<void>;
  saveRanking(ranking: KqRankProfile): Promise<void>;
  saveInventory(inventory: Record<string, number>): Promise<void>;
  saveFavoriteDeck(deck: KqFavoriteDeck | null): Promise<void>;
  saveOnboardingSeen(seen: boolean): Promise<void>;
  saveBurnTransaction(game: KqGameState, inventory: Record<string, number>, receipt: KqBurnReceipt): Promise<void>;
  saveVerdictTransaction(battle: KqBattle, ranking: KqRankProfile, inventory?: Record<string, number>): Promise<void>;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createLocalKqRepository(storage: KeyValueStorage): KqRepository {
  const parseInventory = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Object.entries(value).some(([code, count]) => !/^BOTTE-\d{3}$/.test(code) || !Number.isInteger(count) || (count as number) < 0)) return null;
    return value as Record<string, number>;
  };
  const loadBurnJournal = () => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KQ_LOCAL_KEYS.burnJournal) ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      const game = parseKqGameSave(JSON.stringify(record.game));
      const inventory = parseInventory(record.inventory);
      const receipt = record.receipt as KqBurnReceipt | undefined;
      return game && inventory && receipt?.id ? { game, inventory, receipt } : null;
    } catch { return null; }
  };
  const loadBurnHistory = () => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KQ_LOCAL_KEYS.burnHistory) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is KqBurnReceipt => Boolean(entry && typeof entry === "object" && typeof (entry as KqBurnReceipt).id === "string" && /^BOTTE-\d{3}$/.test((entry as KqBurnReceipt).cardCode))).slice(0, 100);
    } catch { return []; }
  };
  const appendBurnReceipt = (receipt: KqBurnReceipt) => {
    const history = [receipt, ...loadBurnHistory().filter((entry) => entry.id !== receipt.id)].slice(0, 100);
    storage.setItem(KQ_LOCAL_KEYS.burnHistory, JSON.stringify(history));
  };
  const loadFavoriteDeck = () => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KQ_LOCAL_KEYS.favoriteDeck) ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const deck = parsed as KqFavoriteDeck;
      const substrate = KQ_CARDS.find((card) => card.code === deck.substrateCode);
      if (!KQ_BUDDIES.some((buddie) => buddie.code === deck.buddieCode) || substrate?.category !== "substrate" || !Array.isArray(deck.supportCodes)) return null;
      if (deck.supportCodes.some((code) => {
        const card = KQ_CARDS.find((item) => item.code === code);
        return !card || card.category === "substrate" || card.category === "pbi";
      })) return null;
      return deck;
    } catch { return null; }
  };
  const loadVerdictJournal = () => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KQ_LOCAL_KEYS.verdictJournal) ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      const battle = parseKqBattleSave(JSON.stringify(record.battle));
      const ranking = parseKqRankSave(JSON.stringify(record.ranking));
      const inventory = record.inventory === undefined ? null : parseInventory(record.inventory);
      return battle?.status === "verdict" && ranking ? { battle, ranking, inventory } : null;
    } catch { return null; }
  };
  const loadBattleHistory = () => {
    try {
      const raw = storage.getItem(KQ_LOCAL_KEYS.battleHistory);
      const entries: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) return [];
      return entries.map((entry) => parseKqBattleSave(JSON.stringify(entry))).filter((entry): entry is KqBattle => entry?.status === "verdict").slice(0, 20);
    } catch {
      return [];
    }
  };
  return {
    async loadSession() {
      const journal = loadBurnJournal();
      const verdictJournal = loadVerdictJournal();
      if (journal) {
        storage.setItem(KQ_LOCAL_KEYS.game, encodeKqSave(journal.game));
        storage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(journal.inventory));
        appendBurnReceipt(journal.receipt);
        storage.removeItem(KQ_LOCAL_KEYS.burnJournal);
      }
      if (verdictJournal) {
        storage.setItem(KQ_LOCAL_KEYS.battle, encodeKqSave(verdictJournal.battle));
        storage.setItem(KQ_LOCAL_KEYS.ranking, encodeKqSave(verdictJournal.ranking));
        if (verdictJournal.inventory) storage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(verdictJournal.inventory));
        const history = [verdictJournal.battle, ...loadBattleHistory().filter((entry) => entry.id !== verdictJournal.battle.id)].slice(0, 20);
        storage.setItem(KQ_LOCAL_KEYS.battleHistory, JSON.stringify(history.map((entry) => JSON.parse(encodeKqSave(entry)))));
        storage.removeItem(KQ_LOCAL_KEYS.verdictJournal);
      }
      return {
        game: journal?.game ?? parseKqGameSave(storage.getItem(KQ_LOCAL_KEYS.game)),
        battle: verdictJournal?.battle ?? parseKqBattleSave(storage.getItem(KQ_LOCAL_KEYS.battle)),
        battleHistory: loadBattleHistory(),
        ranking: verdictJournal?.ranking ?? parseKqRankSave(storage.getItem(KQ_LOCAL_KEYS.ranking)),
        inventory: journal?.inventory ?? verdictJournal?.inventory ?? (() => {
          try {
            const parsed: unknown = JSON.parse(storage.getItem(KQ_LOCAL_KEYS.inventory) ?? "null");
            return parseInventory(parsed);
          } catch { return null; }
        })(),
        burnHistory: loadBurnHistory(),
        favoriteDeck: loadFavoriteDeck(),
        onboardingSeen: storage.getItem(KQ_LOCAL_KEYS.onboardingSeen) === "1",
      };
    },
    async saveGame(game) {
      storage.setItem(KQ_LOCAL_KEYS.game, encodeKqSave(game));
    },
    async saveBattle(battle) {
      if (battle) {
        storage.setItem(KQ_LOCAL_KEYS.battle, encodeKqSave(battle));
        if (battle.status === "verdict") {
          const history = [battle, ...loadBattleHistory().filter((entry) => entry.id !== battle.id)].slice(0, 20);
          storage.setItem(KQ_LOCAL_KEYS.battleHistory, JSON.stringify(history.map((entry) => JSON.parse(encodeKqSave(entry)))));
        }
      }
      else storage.removeItem(KQ_LOCAL_KEYS.battle);
    },
    async saveRanking(ranking) {
      storage.setItem(KQ_LOCAL_KEYS.ranking, encodeKqSave(ranking));
    },
    async saveInventory(inventory) {
      storage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(inventory));
    },
    async saveFavoriteDeck(deck) {
      if (deck) storage.setItem(KQ_LOCAL_KEYS.favoriteDeck, JSON.stringify(deck));
      else storage.removeItem(KQ_LOCAL_KEYS.favoriteDeck);
    },
    async saveOnboardingSeen(seen) {
      if (seen) storage.setItem(KQ_LOCAL_KEYS.onboardingSeen, "1");
      else storage.removeItem(KQ_LOCAL_KEYS.onboardingSeen);
    },
    async saveBurnTransaction(game, inventory, receipt) {
      const journal = { game: JSON.parse(encodeKqSave(game)), inventory, receipt };
      storage.setItem(KQ_LOCAL_KEYS.burnJournal, JSON.stringify(journal));
      storage.setItem(KQ_LOCAL_KEYS.game, encodeKqSave(game));
      storage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(inventory));
      appendBurnReceipt(receipt);
      storage.removeItem(KQ_LOCAL_KEYS.burnJournal);
    },
    async saveVerdictTransaction(battle, ranking, inventory) {
      if (battle.status !== "verdict") throw new Error("A verdict transaction requires a resolved battle.");
      const journal = { battle: JSON.parse(encodeKqSave(battle)), ranking: JSON.parse(encodeKqSave(ranking)), ...(inventory ? { inventory } : {}) };
      storage.setItem(KQ_LOCAL_KEYS.verdictJournal, JSON.stringify(journal));
      storage.setItem(KQ_LOCAL_KEYS.battle, encodeKqSave(battle));
      const history = [battle, ...loadBattleHistory().filter((entry) => entry.id !== battle.id)].slice(0, 20);
      storage.setItem(KQ_LOCAL_KEYS.battleHistory, JSON.stringify(history.map((entry) => JSON.parse(encodeKqSave(entry)))));
      storage.setItem(KQ_LOCAL_KEYS.ranking, encodeKqSave(ranking));
      if (inventory) storage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(inventory));
      storage.removeItem(KQ_LOCAL_KEYS.verdictJournal);
    },
  };
}
