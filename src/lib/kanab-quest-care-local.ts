import { applyKqCareProduct, canApplyKqCareProduct, canPerformKqBasicCare, getKqCareProduct, KQ_BASIC_CARE_PRICE_CENTS, performKqBasicCare } from "./kanab-quest-care";
import type { KqGameState } from "./kanab-quest-game";
import { KQ_STARTING_CASH_CENTS } from "./kanab-quest-equipment";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

export type KqCareStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type KqLocalCareWallet = { cashCents: number; inventory: Record<string, number> };
const walletKey = "kanab-quest-care-simulation-v1";
const journalKey = "kanab-quest-care-journal-v1";
const gameKey = "kanab-quest-dice-prototype-v7";

function validWallet(value: unknown): value is KqLocalCareWallet {
  if (!value || typeof value !== "object") return false;
  const wallet = value as KqLocalCareWallet;
  return Number.isSafeInteger(wallet.cashCents) && wallet.cashCents >= 0 && !!wallet.inventory && typeof wallet.inventory === "object"
    && Object.entries(wallet.inventory).every(([code, count]) => !!getKqCareProduct(code) && Number.isSafeInteger(count) && count >= 0);
}

export function recoverKqLocalCare(storage: KqCareStorage) {
  const raw = storage.getItem(journalKey);
  if (!raw) return;
  const journal = JSON.parse(raw) as { game: unknown; wallet: unknown };
  const game = parseKqGameSave(JSON.stringify(journal.game));
  if (!game || !validWallet(journal.wallet)) throw new Error("Sauvegarde du suivi local invalide.");
  storage.setItem(gameKey, encodeKqSave(game));
  storage.setItem(walletKey, JSON.stringify(journal.wallet));
  storage.removeItem(journalKey);
}

export function loadKqLocalCare(storage: KqCareStorage): KqLocalCareWallet {
  recoverKqLocalCare(storage);
  const raw = storage.getItem(walletKey);
  if (!raw) return { cashCents: KQ_STARTING_CASH_CENTS, inventory: {} };
  const value: unknown = JSON.parse(raw);
  if (!validWallet(value)) throw new Error("Réserve locale illisible.");
  return value;
}

export function buyKqLocalCare(storage: KqCareStorage, productCode: string) {
  const wallet = loadKqLocalCare(storage);
  const product = getKqCareProduct(productCode);
  if (!product) throw new Error("Produit inconnu.");
  if (wallet.cashCents < product.priceCents) throw new Error("Trésorerie de simulation insuffisante.");
  const next = { cashCents: wallet.cashCents - product.priceCents, inventory: { ...wallet.inventory, [productCode]: (wallet.inventory[productCode] ?? 0) + 1 } };
  storage.setItem(walletKey, JSON.stringify(next));
  return next;
}

export function applyKqLocalCare(storage: KqCareStorage, state: KqGameState, productCode?: string): KqGameState {
  const wallet = loadKqLocalCare(storage);
  const permission = productCode ? canApplyKqCareProduct(state, productCode) : canPerformKqBasicCare(state);
  if (!permission.allowed) throw new Error(permission.reason);
  const saved = parseKqGameSave(storage.getItem(gameKey));
  if (saved?.care && saved.seed === state.seed && saved.startedAt === state.startedAt && saved.varietyCode === state.varietyCode) {
    const stageIndex = state.stageIndex + Number(state.phase === "resolved");
    const alreadyApplied = productCode
      ? saved.care.applications.some(item => item.productCode === productCode && item.stageIndex === stageIndex)
      : saved.care.lastBasicCareStage === stageIndex
        || saved.care.history.some(item => item.kind === "intervention" && !item.productCode && item.stageIndex === stageIndex);
    // A failed storage write can leave React on the pre-payment state. Recovery
    // above completed that transaction; return its current state, without a fee.
    if (alreadyApplied) return saved;
    const missingApplication = saved.care.applications.some(item => !state.care?.applications.some(current => current.productCode === item.productCode && current.stageIndex === item.stageIndex));
    if (saved.stageIndex > state.stageIndex || saved.history.length > state.history.length || missingApplication
      || (saved.care.lastBasicCareStage ?? -1) > (state.care?.lastBasicCareStage ?? -1)) {
      throw new Error("Le suivi local a changé. Recharge la culture avant de payer une autre intervention.");
    }
  }
  if (productCode && !(wallet.inventory[productCode] > 0)) throw new Error("Aucune charge en réserve.");
  if (!productCode && wallet.cashCents < KQ_BASIC_CARE_PRICE_CENTS) throw new Error("Trésorerie de simulation insuffisante pour cet entretien.");
  const next = productCode ? applyKqCareProduct(state, productCode) : performKqBasicCare(state);
  const nextWallet = productCode
    ? { ...wallet, inventory: { ...wallet.inventory, [productCode]: wallet.inventory[productCode] - 1 } }
    : { ...wallet, cashCents: wallet.cashCents - KQ_BASIC_CARE_PRICE_CENTS };
  // Recovery completes both writes before the next session can be loaded.
  storage.setItem(journalKey, JSON.stringify({ game: JSON.parse(encodeKqSave(next)), wallet: nextWallet }));
  recoverKqLocalCare(storage);
  return next;
}
