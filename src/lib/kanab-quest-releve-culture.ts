import { createKqFlower } from "./kanab-quest-battle";
import { KQ_BUDDIE_ROTATION_REQUIRED } from "./kanab-quest-buddie-rotation";
import { getKqCampaignParticipants, getKqCampaignWarehouse } from "./kanab-quest-campaign";
import { getKqCannabinoidReport, getKqTerpeneReport, KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_PRODUCTS } from "./kanab-quest-care";
import { KQ_HERITAGE_CARDS } from "./kanab-quest-heritage";
import { getKqCardArtwork } from "./kanab-quest-artwork";
import { KQ_ACTIVE_CARDS } from "./kanab-quest-game";
import { KQ_REWARD_BALANCE } from "./kanab-quest-reward-balance";
import { applyKqBattleToRanking, createKqRankProfile } from "./kanab-quest-ranking";
import { applyKqReleveProductionAction, getKqReleveHarvests, getKqReleveStorageContainers, type KqReleveProductionAction, type KqReleveProductionState } from "./kanab-quest-releve-production";
import { createReleveWarehouseTransport, getReleveNativeCollection } from "./kanab-quest-releve-warehouse";
import type { KqApiBurnReceipt, KqOfficialBattle, KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";
import { getKqStorageInventory, KQ_STORAGE_METHODS, projectKqStorageLot } from "./kanab-quest-storage";
import { getKqStorageStockBreakdown } from "./kanab-quest-storage-breakdown";
import { getKqJuryScoreFromRounds } from "./kanab-quest-market";
import type { KqEnergyQuote, KqEnergySnapshot } from "./kanab-quest-energy";

type Port = { getState: () => KqReleveProductionState; setState: (next: KqReleveProductionState) => void };
const now = (state: KqReleveProductionState) => new Date(state.clock).toISOString();
const flowerId = (zoneId: string) => `releve-flower-${zoneId}`;
const rotation = (state: KqReleveProductionState) => ({ requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED, recentBuddieCodes: state.recentBuddieCodes });
const careInventory = (state: KqReleveProductionState) => Object.entries(state.careInventory).map(([productCode, quantity]) => ({ productCode, quantity }));
const rank = (state: KqReleveProductionState) => Object.entries(state.battles).reduce((profile, [zoneId, battle]) => state.milestones.includes(`jury-ranked:${zoneId}`)
  ? applyKqBattleToRanking(profile, battle, battle.opponentRating) : profile, createKqRankProfile());

export function getReleveNativeFlowers(state: KqReleveProductionState): KqOfficialFlower[] {
  return getKqReleveHarvests(state).map(({ zoneId, game, battle, storage }) => {
    const flower = createKqFlower(game, "La ferme d’essai");
    return { id: flowerId(zoneId), runId: state.game!.campaign!.members.find(member => member.zoneId === zoneId)!.runId,
      varietyCode: game.varietyCode, varietyName: game.varietyName, quality: game.quality, traits: game.traits, combos: game.combos,
      stats: battle?.playerFlower.stats ?? flower.stats, status: battle?.status === "verdict" ? "burned" : battle ? "locked" : "available", createdAt: game.completedAt ?? now(state),
      storage: projectKqStorageLot(storage, state.clock, storage.juryApplied && battle?.status === "verdict" ? getKqJuryScoreFromRounds(battle.rounds, "player") : undefined),
      queuedAt: null, lockedAt: battle ? now(state) : null, burnedAt: battle?.burnedAt ?? null,
      rulesVersion: game.rulesVersion, cultivationProfile: game.cultivationProfile,
      cannabinoidReport: getKqCannabinoidReport(game), terpeneReport: getKqTerpeneReport(game) };
  });
}

export function getReleveProductionStorageSnapshot(state: KqReleveProductionState): KqStorageSnapshot {
  const harvests = getKqReleveHarvests(state), ownedContainers = getKqReleveStorageContainers(state);
  const containers = getKqStorageInventory(ownedContainers, harvests.flatMap(row => row.storage.capacity!.allocations));
  const lots = harvests.map(({ zoneId, game, battle, storage }) => ({ flowerId: flowerId(zoneId), varietyName: game.varietyName,
    harvestGrams: game.harvestGrams!, flowerStatus: battle?.status === "verdict" ? "burned" : battle ? "locked" : "available",
    projection: projectKqStorageLot(storage, state.clock, storage.juryApplied && battle?.status === "verdict" ? getKqJuryScoreFromRounds(battle.rounds, "player") : undefined) }));
  const totalUnits = containers.reduce((sum, row) => sum + row.ownedQuantity * row.capacityUnits, 0);
  const usedUnits = lots.reduce((sum, row) => sum + row.projection.capacity!.totalUnits, 0);
  const reservedUnits = lots.reduce((sum, row) => sum + row.projection.capacity!.reservedCapacityUnits, 0);
  const stockBreakdown = getKqStorageStockBreakdown({ capacities: harvests.map(row => row.storage.capacity!), listings: [], stocks: [] })!;
  return { serverNow: now(state), cashCents: state.cashCents, catalog: KQ_STORAGE_METHODS, containers, lots, stockBreakdown,
    ownedContainers, installedContainers: ownedContainers, ownedMethodCodes: [...new Set(containers.filter(row => row.ownedQuantity > 0).map(row => row.methodCode))],
    defaultMethodCode: "STORAGE-GLASS", overflowSales: [],
    capacity: { totalUnits, usedUnits, reservedUnits, freeUnits: Math.max(0, totalUnits - reservedUnits), overflowUnits: stockBreakdown.bulkOverflowUnits } };
}

export function getReleveNativeBattles(state: KqReleveProductionState): KqOfficialBattle[] {
  return Object.entries(state.battles).map(([zoneId, battle]) => ({
    id: battle.id, status: battle.status, seed: state.game?.seed ?? 2026, rounds: battle.rounds, winner: battle.winner,
    playerFlower: { ...battle.playerFlower, id: flowerId(zoneId) }, opponentFlower: battle.opponentFlower,
    lockedAt: now(state), verdictAt: battle.burnedAt ?? null, opponentType: state.milestones.includes(`jury-ranked:${zoneId}`) ? "human" : "bot",
    experienceAwarded: state.milestones.includes(`jury-ranked:${zoneId}`) ? KQ_REWARD_BALANCE.pvpExperienceByWonRounds[battle.rounds.filter(round => round.winner === "player").length as 0 | 1 | 2 | 3] : KQ_REWARD_BALANCE.training.arenaExperience.min,
  }));
}

function receipts(state: KqReleveProductionState): KqApiBurnReceipt[] {
  return (state.game?.usedCards ?? []).map((cardCode, index) => ({ id: `releve-burn-${index}-${cardCode}`, cardInstanceId: `releve-copy-${index}`,
    cardCode, stageIndex: state.game!.stageIndex, useKind: "support", burnedAt: now(state) }));
}

export function getReleveNativeCultureSession(state: KqReleveProductionState) {
  const activeRun = state.game ? { runId: state.game.campaign!.leaderRunId, zoneId: state.game.campaign!.members[0].zoneId,
    buddieCode: state.game.varietyCode, state: state.game, startedAt: state.game.startedAt, updatedAt: now(state), burnReceipts: receipts(state) } : null;
  return { activeRun, activeRuns: activeRun && state.game?.phase !== "complete" ? [activeRun] : [],
    flowers: getReleveNativeFlowers(state), battles: getReleveNativeBattles(state), progress: null, warnings: [], buddieRotation: rotation(state) };
}

function energySnapshot(state: KqReleveProductionState): KqEnergySnapshot {
  const warehouse = getKqCampaignWarehouse(getKqCampaignParticipants(state.warehouse, state.revision));
  const quote: KqEnergyQuote = { version: 1, mode: "balanced", lines: warehouse ? [{ code: "WAREHOUSE-CULTURE", name: "Chambre de culture", level: 1,
    watts: warehouse.powerWatts, hours: 1, wattHours: Math.round(warehouse.energyKwh * 1000) }] : [], totalWattHours: Math.round((warehouse?.energyKwh ?? 0) * 1000),
    solarPercent: 0, tariffCentsPerKwh: 30, totalCents: warehouse?.energyCostCents ?? 0, savingsCents: 0 };
  const dues = state.ledger.filter(row => row.kind === "energy" && row.status === "due");
  return { ...(warehouse ? { warehouse } : {}), cashCents: state.cashCents, productionUnits: 1,
    outstandingCents: dues.reduce((sum, row) => sum + row.amountCents, 0), invoiceCount: dues.length, bestGramsPerKwh: null,
    invoices: [], quotes: { eco: quote, balanced: quote, intensive: quote } };
}

/** The player UI uses this in-memory transport; no request can fall through to fetch. */
export function createReleveCultureTransport(port: Port): typeof fetch {
  const warehouseRequest = createReleveWarehouseTransport(port);
  const replay = new Map<string, unknown>();
  const act = (action: KqReleveProductionAction) => { const next = applyKqReleveProductionAction(port.getState(), action); port.setState(next); return next; };
  return async (input, init) => {
    if (init?.signal?.aborted) throw new DOMException("Essai fermé", "AbortError");
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "https://releve.invalid");
    const path = url.pathname.replace(/^\/api\/admin\/placard/, "/api/arena/placard").replace(/^\/api\/arena\/placard/, "");
    const method = init?.method ?? "GET";
    let body: Record<string, unknown> = {};
    try {
      if (init?.body) body = JSON.parse(String(init.body));
      const state = port.getState();
      const requestKey = typeof body.requestKey === "string" ? `${path}:${body.requestKey}` : null;
      if (requestKey && replay.has(requestKey)) return Response.json({ ...replay.get(requestKey) as object, replayed: true });
      const respond = (value: object) => { if (requestKey) replay.set(requestKey, value); return Response.json(value); };
      if (method === "GET" && path === "/bootstrap") return respond({
        collection: getReleveNativeCollection(state).collection, ownedBuddieCodes: state.ownedBuddies, ownedBuddies: state.ownedBuddies.map(code => ({ code, ownedCopies: 1 })),
        heritage: { collectionActive: true, cards: KQ_HERITAGE_CARDS.filter(card => ["HERITAGE-001", "HERITAGE-007"].includes(card.code)).map(card => ({ ...card,
          effectCode: card.effect, imageUrl: getKqCardArtwork(card.code) ?? "", isActive: true, ownedCopies: 1 })) },
        buddieRotation: rotation(state), playerSession: getReleveNativeCultureSession(state), routePlan: null, warnings: [],
      });
      if (method === "GET" && ["/session", "/runs"].includes(path)) return respond(getReleveNativeCultureSession(state));
      if (method === "GET" && path === "/rankings") return respond({ entries: [] });
      if (method === "GET" && path === "/me") return respond({ progress: null });
      if (method === "GET" && path === "/flowers") return respond({ flowers: getReleveNativeFlowers(state) });
      if (method === "GET" && path === "/storage") {
        return respond(getReleveProductionStorageSnapshot(state));
      }
      if (method === "POST" && path === "/storage") {
        if (body.action !== "place") throw new Error("Choisis le contenant de chaque variété dans cet essai.");
        const next = act({ type: "storage-place", flowerId: String(body.flowerId), containerCode: String(body.containerCode) });
        return respond(getReleveProductionStorageSnapshot(next));
      }
      if (method === "GET" && path === "/battles") return respond({ battles: getReleveNativeBattles(state) });
      if (method === "GET" && path === "/energy") return respond(energySnapshot(state));
      if (method === "POST" && path === "/energy") {
        const due = energySnapshot(state).outstandingCents;
        if (Number(body.expectedCents) !== due || due > state.cashCents) throw new Error("Vérifie les factures et le solde avant de payer.");
        const next = { ...state, cashCents: state.cashCents - due, ledger: state.ledger.map(row => row.kind === "energy" ? { ...row, status: "paid" as const } : row) };
        port.setState(next); return respond({ paidCents: due, cashCents: next.cashCents });
      }
      // La Relève has no profession bonus; make its absence explicit so the
      // preparation can distinguish it from an unavailable official profile.
      if (method === "GET" && path === "/equipment") return respond({ routePlan: null, strength: null });
      if (path === "/care" && method === "GET") {
        if (!state.milestones.includes("health-read")) act({ type: "mark", milestone: "health-read" });
        return respond({ cashCents: state.cashCents, basicCarePriceCents: KQ_BASIC_CARE_PRICE_CENTS, inventory: careInventory(state), catalog: KQ_CARE_PRODUCTS });
      }
      if (path === "/care" && method === "POST") {
        const quantity = Number(body.quantity ?? 1);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Quantité invalide.");
        let next = state;
        for (let index = 0; index < quantity; index++) next = applyKqReleveProductionAction(next, { type: "buy-care", code: String(body.productCode) });
        port.setState(next);
        return respond({ cashCents: next.cashCents, inventory: careInventory(next), totalPriceCents: state.cashCents - next.cashCents, replayed: false });
      }
      if (path === "/runs" && method === "POST") {
        let next = state;
        if (!next.game) {
          if (Number(body.expectedEnergyCents) !== energySnapshot(state).quotes.balanced.totalCents) throw new Error("Les charges ont changé. Relis le devis de campagne.");
          next = applyKqReleveProductionAction(next, { type: "deck", codes: body.deckCodes as string[] });
          next = applyKqReleveProductionAction(next, { type: "heritage-choice", code: typeof body.heritageCode === "string" ? body.heritageCode : null });
          next = applyKqReleveProductionAction(next, { type: "launch" }); port.setState(next);
        }
        return respond({ runId: next.game!.campaign!.leaderRunId, state: next.game, burnReceipt: null, freeSubstrate: true, cultureTokenBalance: 0, buddieRotation: rotation(next) });
      }
      const run = path.match(/^\/runs\/([^/]+)\/(actions|cards|care)$/);
      if (run && method === "POST") {
        if (run[1] !== state.game?.campaign?.leaderRunId) throw new Error("Cette campagne n’est pas celle de l’essai.");
        if (run[2] === "actions") {
          const action = String(body.action);
          if (!["roll", "resolve", "advance", "redraw", "heritage", "heritage-swap"].includes(action)) throw new Error("Action inconnue.");
          const next = action === "heritage-swap" ? act({ type: "heritage-swap", handIndex: Number(body.handIndex), reserveIndex: Number(body.reserveIndex) })
            : act({ type: action as "roll" | "resolve" | "advance" | "redraw" | "heritage" });
          const flowers = getReleveNativeFlowers(next);
          return respond({ state: next.game, persistedFlower: flowers[0] ?? null, persistedFlowers: flowers });
        }
        if (run[2] === "cards") { const next = act({ type: "play", code: String(body.cardCode) }); return respond({ state: next.game, burnReceipt: receipts(next).at(-1)! }); }
        if (typeof body.productCode !== "string" && body.basicPriceCents !== KQ_BASIC_CARE_PRICE_CENTS) throw new Error("Actualise le tarif de l’entretien.");
        const next = typeof body.productCode === "string" ? act({ type: "apply-care", code: body.productCode }) : act({ type: "basic-care" });
        return respond({ state: next.game, updatedAt: now(next), cashCents: next.cashCents, chargedCents: state.cashCents - next.cashCents, inventory: careInventory(next), replayed: false });
      }
      const verdictRequest = path.match(/^\/battles\/([^/]+)\/verdict$/);
      if (method === "POST" && (path === "/bot-battles" || path === "/battles" || verdictRequest)) {
        const harvest = getKqReleveHarvests(state).find(item => verdictRequest
          ? item.battle?.id === decodeURIComponent(verdictRequest[1]) : flowerId(item.zoneId) === body.flowerId);
        if (!harvest) throw new Error("Cette Fleur n’est pas disponible dans l’essai.");
        if (path === "/battles" && body.action === "leave") return respond({ left: false, flowerId: body.flowerId, replayed: false });
        if (path === "/battles" && body.action === "poll" && !harvest.battle) return respond({ matchStatus: "idle" });
        const ranked = path === "/battles" || !!verdictRequest;
        const replayed = harvest.battle?.status === "verdict";
        let next = applyKqReleveProductionAction(state, { type: "duel", zoneId: harvest.zoneId });
        next = applyKqReleveProductionAction(next, { type: "verdict", zoneId: harvest.zoneId });
        const battle = next.battles[harvest.zoneId];
        const reward = battle.winner === "player" ? KQ_ACTIVE_CARDS.find(card => card.code === "BOTTE-005") : undefined;
        const rewardCount = reward ? ranked ? KQ_REWARD_BALANCE.pvp.winnerCardCount : KQ_REWARD_BALANCE.training.winnerCardCount : 0;
        if (!replayed) next = { ...next, supportInventory: reward ? { ...next.supportInventory, [reward.code]: (next.supportInventory[reward.code] ?? 0) + rewardCount } : next.supportInventory,
          milestones: [...next.milestones, `jury-reward:${harvest.zoneId}`, ...(ranked ? [`jury-ranked:${harvest.zoneId}`] : [])] };
        port.setState(next);
        if (ranked) {
          const verdict = { battleId: battle.id, status: "verdict", rounds: battle.rounds, winner: battle.winner,
            burnedAt: battle.burnedAt, experienceAwarded: KQ_REWARD_BALANCE.pvpExperienceByWonRounds[battle.rounds.filter(round => round.winner === "player").length as 0 | 1 | 2 | 3],
            challengePoints: 0, opponentChallengePoints: 0, completedChallenges: [], pvpBoosterGranted: !!reward,
            pvpBoosterCardCount: rewardCount, rankProfile: rank(next), replayed };
          return respond(verdictRequest ? verdict : { matchStatus: "matched", flowerId: flowerId(harvest.zoneId), opponentFlowerId: battle.opponentFlower.id, battleId: battle.id,
            matchedAt: now(next), verdictPending: false, verdict });
        }
        return respond({ battleId: battle.id, status: "verdict", rounds: battle.rounds, winner: battle.winner, burnedAt: battle.burnedAt,
          experienceAwarded: KQ_REWARD_BALANCE.training.arenaExperience.min, todayCount: Object.keys(next.battles).length, dailyLimit: 5,
          opponentType: "bot", opponentFlower: battle.opponentFlower, challengePoints: 0, claimedChallengeCodes: [], completedChallenges: [],
          rewardCard: reward ? { ...reward, imageUrl: getKqCardArtwork(reward.code) ?? "" } : null, replayed });
      }
      return warehouseRequest(input, init);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Action indisponible dans cet essai." }, { status: 400 }); }
  };
}
