import type { KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import type { KqEnergyMode } from "@/lib/kanab-quest-energy";
import type { KqGameState } from "@/lib/kanab-quest-game";
import type { KqCareProduct, getKqCannabinoidReport, KqTerpeneReport } from "@/lib/kanab-quest-care";
import type { KqBuddieCultivationProfile } from "@/lib/kanab-quest-buddie-cultivation";
import type { KqStorageContainer, KqStorageMethod, KqStorageMethodCode, KqStorageProjection } from "@/lib/kanab-quest-storage";

export type KqApiBurnReceipt = {
  id: string;
  cardInstanceId: string;
  cardCode: string;
  stageIndex: number;
  useKind: "substrate" | "support" | "pbi";
  burnedAt: string;
};

export type KqOfficialFlower = {
  cultivationProfile?: KqBuddieCultivationProfile;
  terpeneReport?: KqTerpeneReport;
  rulesVersion?: number;
  cannabinoidReport?: ReturnType<typeof getKqCannabinoidReport>;
  id: string;
  runId: string;
  varietyCode: string;
  varietyName: string;
  quality: number;
  traits: string[];
  combos: string[];
  stats: Record<string, number>;
  status: "available" | "queued" | "locked" | "burned";
  createdAt: string;
  queuedAt: string | null;
  lockedAt: string | null;
  burnedAt: string | null;
};

export type KqFlowerRival = {
  rulesVersion?: number;
  cannabinoidReport?: ReturnType<typeof getKqCannabinoidReport>;
  flowerId: string;
  varietyName: string;
  quality: number;
  traits: string[];
  stats: Record<string, number>;
  createdAt: string;
  opponentType: "human" | "bot";
  opponentName?: string;
  experienceReward?: number;
  remainingBotDuels?: number;
};

export type KqOfficialBattle = {
  id: string;
  status: "locked" | "verdict" | "cancelled";
  seed: number;
  playerFlower: { id: string; variety: string; stats: Record<string, number>; rulesVersion?: number; cannabinoidReport?: ReturnType<typeof getKqCannabinoidReport> };
  opponentFlower: { id: string; variety: string; stats: Record<string, number>; rulesVersion?: number; cannabinoidReport?: ReturnType<typeof getKqCannabinoidReport> };
  rounds: Array<{ code: string; label: string; explanation: string; playerScore: number; opponentScore: number; winner: "player" | "opponent" }>;
  winner: "player" | "opponent" | null;
  lockedAt: string;
  verdictAt: string | null;
  opponentType?: "human" | "bot";
  experienceAwarded?: number;
};

export type KqBattleVerdictReceipt = {
  battleId: string;
  status: "verdict";
  rounds: KqOfficialBattle["rounds"];
  winner: "player" | "opponent";
  burnedAt: string;
  experienceAwarded: number;
  challengePoints: number;
  opponentChallengePoints: number;
  completedChallenges: Array<{ code: string; title: string; points: number }>;
  pvpBoosterGranted: boolean;
  pvpBoosterCardCount: number;
  rankProfile: null | { rating: number; seasonPoints: number; wins: number; losses: number; streak: number; burnedFlowers: number };
  replayed: boolean;
};

type ApiError = { error?: string };
export type KqApiScope = "admin" | "player";

export function createKqScopedRequest(
  scope: KqApiScope,
  request: typeof fetch = fetch,
): typeof fetch {
  const basePath = scope === "player" ? "/api/arena/placard" : "/api/admin/placard";
  return async (input, init) => {
    if (typeof input !== "string" || !input.startsWith("/api/admin/placard")) {
      return request(input, init);
    }
    const response = await request(`${basePath}${input.slice("/api/admin/placard".length)}`, init);
    if (scope === "player" && response.ok && init?.method === "POST" && typeof window !== "undefined"
      && /\/(?:actions|verdict|battles|bot-battles)$/.test(input)) {
      // A resolved roll or an empty queue poll is not a completed achievement event.
      void response.clone().json().then(payload => {
        if (payload.persistedFlower || payload.persistedFlowers?.length || payload.status === "verdict" || payload.verdict) {
          window.dispatchEvent(new Event("arena:progress-updated"));
        }
      }).catch(() => {});
    }
    return response;
  };
}

async function readKqResponse<T>(response: Response): Promise<T> {
  let payload: T & ApiError;
  try {
    payload = await response.json() as T & ApiError;
  } catch {
    throw new Error(`Réponse de Kanab Quest illisible (HTTP ${response.status}). Actualise la culture pour vérifier son état, sans relancer les dés.`);
  }
  if (!response.ok) throw new Error(payload.error || "Le serveur de Kanab Quest ne répond pas.");
  return payload;
}

export type KqCareInventory = Array<{ productCode: string; quantity: number }>;
export type KqStorageSnapshot = {
  serverNow: string; cashCents: number; ownedMethodCodes: KqStorageMethodCode[]; defaultMethodCode: KqStorageMethodCode;
  catalog: readonly KqStorageMethod[];
  containers: readonly KqStorageContainer[];
  ownedContainers: Record<string, number>;
  /** Purchased containers currently placed in the shared floor plan. */
  installedContainers?: Record<string, number>;
  capacity: { totalUnits: number; usedUnits: number; freeUnits: number; reservedUnits: number; overflowUnits: number };
  overflowSales: Array<{ flowerId: string; units: number; payoutCents: number; netPayoutCents: number; soldAt: string; automatic: boolean }>;
  lots: Array<{ flowerId: string; varietyName: string; harvestGrams: number; flowerStatus: string; projection: KqStorageProjection;
    overflowOffer?: { units: number; payoutCents: number; netPayoutCents: number } }>;
};
export async function getKqRemoteStorage(request: typeof fetch = fetch) {
  return readKqResponse<KqStorageSnapshot>(await request("/api/admin/placard/storage", { cache: "no-store" }));
}
export async function changeKqRemoteStorage(input: {
  action: "buy" | "select-default" | "assign" | "sell-overflow"; methodCode?: KqStorageMethodCode;
  containerCode?: string; quantity?: number; flowerId?: string; requestKey: string;
}, request: typeof fetch = fetch) {
  return readKqResponse<KqStorageSnapshot>(await request("/api/admin/placard/storage", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }));
}
export type KqCareShop = { cashCents: number; basicCarePriceCents?: number; inventory: KqCareInventory; catalog: readonly KqCareProduct[] };

export async function getKqRemoteCareShop(request: typeof fetch = fetch) {
  return readKqResponse<KqCareShop>(await request("/api/admin/placard/care", { cache: "no-store" }));
}

export async function purchaseKqRemoteCareProduct(input: { productCode: string; quantity: number; requestKey: string }, request: typeof fetch = fetch) {
  return readKqResponse<{ cashCents: number; inventory: KqCareInventory; totalPriceCents: number; replayed: boolean }>(await request("/api/admin/placard/care", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function applyKqRemoteCare(runId: string, input: { productCode?: string; action?: "basic"; basicPriceCents?: number; requestKey: string; expectedUpdatedAt?: string }, request: typeof fetch = fetch) {
  return readKqResponse<{ state: KqGameState; updatedAt: string; cashCents: number; chargedCents: number; inventory: KqCareInventory; replayed: boolean }>(await request(`/api/admin/placard/runs/${encodeURIComponent(runId)}/care`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function startKqRemoteRun(
  input: { buddieCode: string; deckCodes: string[]; cultureTokens?: number; heritageCode?: string; energyMode?: KqEnergyMode; expectedEnergyCents?: number; zoneId?: string; campaign?: boolean; requestKey?: string },
  request: typeof fetch = fetch,
) {
  const response = await request("/api/admin/placard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readKqResponse<{ runId: string; state: KqGameState; burnReceipt: KqApiBurnReceipt | null; freeSubstrate: boolean; cultureTokenBalance: number; buddieRotation: KqBuddieRotation; replayed?: boolean }>(response);
}

export type KqRemoteActiveRun = {
  runId: string; zoneId: string | null; buddieCode: string; state: KqGameState;
  startedAt: string; updatedAt: string; burnReceipts: KqApiBurnReceipt[];
};
export type KqRunSelection = { runId?: string; zoneId?: string };

export async function getKqRemoteActiveRun(request: typeof fetch = fetch, selection: KqRunSelection = {}) {
  const query = new URLSearchParams();
  if (selection.runId !== undefined) query.set("runId", selection.runId);
  if (selection.zoneId !== undefined) query.set("zoneId", selection.zoneId);
  const response = await request(`/api/admin/placard/runs${query.size ? `?${query}` : ""}`, { cache: "no-store" });
  return readKqResponse<{ activeRun: KqRemoteActiveRun | null; activeRuns: KqRemoteActiveRun[] }>(response);
}

export async function getKqRemoteFlowers(request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/flowers", { cache: "no-store" });
  return readKqResponse<{ flowers: KqOfficialFlower[] }>(response);
}

export async function getKqRemoteFlowerRivals(flowerId: string, request: typeof fetch = fetch) {
  const response = await request(`/api/admin/placard/flowers/${encodeURIComponent(flowerId)}/rivals`, { cache: "no-store" });
  return readKqResponse<{ rivals: KqFlowerRival[] }>(response);
}

export async function enqueueKqRemoteRandomBattle(flowerId: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/battles", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "join", flowerId }),
  });
  return readKqResponse<{
    matchStatus: "queued";
    flowerId: string;
    queuedAt: string;
    replayed: boolean;
  } | {
    matchStatus: "matched";
    flowerId: string;
    opponentFlowerId: string;
    battleId: string;
    matchedAt: string;
    verdictPending: boolean;
    verdict: KqBattleVerdictReceipt | null;
  }>(response);
}

export async function pollKqRemoteRandomBattleQueue(flowerId: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/battles", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "poll", flowerId }),
  });
  return readKqResponse<{
    matchStatus: "idle" | "queued" | "matched";
    flowerId?: string;
    queuedAt?: string;
    battleId?: string;
    verdictPending?: boolean;
    verdict?: KqBattleVerdictReceipt | null;
  }>(response);
}

export async function leaveKqRemoteRandomBattleQueue(flowerId: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/battles", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "leave", flowerId }),
  });
  return readKqResponse<{ left: boolean; flowerId: string; replayed: boolean }>(response);
}

export async function finalizeKqRemoteBotBattle(flowerId: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/bot-battles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flowerId }),
  });
  return readKqResponse<{
    battleId: string;
    status: "verdict";
    rounds: KqOfficialBattle["rounds"];
    winner: "player" | "opponent";
    burnedAt: string;
    experienceAwarded: number;
    todayCount: number;
    dailyLimit: number;
    opponentType: "bot";
    opponentFlower: {
      ownerName: string;
      variety: string;
    };
    challengePoints: number;
    claimedChallengeCodes: string[];
    completedChallenges: Array<{
      code: string;
      title: string;
      points: number;
    }>;
    rewardCard: null | {
      code: string;
      name: string;
      rarity: string;
      description: string;
      imageUrl: string;
    };
  }>(response);
}

export async function getKqRemoteBattles(request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/battles", { cache: "no-store" });
  return readKqResponse<{ battles: KqOfficialBattle[] }>(response);
}

export async function finalizeKqRemoteBattle(battleId: string, request: typeof fetch = fetch) {
  const response = await request(`/api/admin/placard/battles/${encodeURIComponent(battleId)}/verdict`, { method: "POST" });
  return readKqResponse<KqBattleVerdictReceipt>(response);
}

export async function playKqRemoteCard(
  runId: string,
  cardCode: string,
  request: typeof fetch = fetch,
) {
  const response = await request(`/api/admin/placard/runs/${encodeURIComponent(runId)}/cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardCode }),
  });
  return readKqResponse<{ state: KqGameState; burnReceipt: KqApiBurnReceipt }>(response);
}

export async function applyKqRemoteAction(
  runId: string,
  action: "roll" | "resolve" | "advance" | "redraw" | "heritage",
  request: typeof fetch = fetch,
) {
  const response = await request(`/api/admin/placard/runs/${encodeURIComponent(runId)}/actions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
  });
  return readKqResponse<{
    state: KqGameState;
    persistedFlower: null | { id: string; status: string; createdAt: string };
    persistedFlowers?: Array<{ id: string; runId?: string; zoneId?: string; status: string; createdAt: string }>;
  }>(response);
}

export async function swapKqRemoteHeritageCard(
  runId: string,
  handIndex: number,
  reserveIndex: number,
  request: typeof fetch = fetch,
) {
  const response = await request(`/api/admin/placard/runs/${encodeURIComponent(runId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "heritage-swap", handIndex, reserveIndex }),
  });
  return readKqResponse<{ state: KqGameState; persistedFlower: null }>(response);
}
