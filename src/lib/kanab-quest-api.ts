import type { KqGameState } from "@/lib/kanab-quest-game";

export type KqApiBurnReceipt = {
  id: string;
  cardInstanceId: string;
  cardCode: string;
  stageIndex: number;
  useKind: "substrate" | "support" | "pbi";
  burnedAt: string;
};

export type KqOfficialFlower = {
  id: string;
  runId: string;
  varietyCode: string;
  varietyName: string;
  quality: number;
  traits: string[];
  combos: string[];
  stats: Record<string, number>;
  status: "available" | "locked" | "burned";
  createdAt: string;
  lockedAt: string | null;
  burnedAt: string | null;
};

export type KqFlowerRival = {
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
  playerFlower: { id: string; variety: string; stats: Record<string, number> };
  opponentFlower: { id: string; variety: string; stats: Record<string, number> };
  rounds: Array<{ code: string; label: string; explanation: string; playerScore: number; opponentScore: number; winner: "player" | "opponent" }>;
  winner: "player" | "opponent" | null;
  lockedAt: string;
  verdictAt: string | null;
  opponentType?: "human" | "bot";
  experienceAwarded?: number;
};

type ApiError = { error?: string };
export type KqApiScope = "admin" | "player";

export function createKqScopedRequest(
  scope: KqApiScope,
  request: typeof fetch = fetch,
): typeof fetch {
  const basePath = scope === "player" ? "/api/arena/placard" : "/api/admin/placard";
  return (input, init) => {
    if (typeof input !== "string" || !input.startsWith("/api/admin/placard")) {
      return request(input, init);
    }
    return request(`${basePath}${input.slice("/api/admin/placard".length)}`, init);
  };
}

async function readKqResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(payload.error || "Le serveur du Placard ne répond pas.");
  return payload;
}

export async function startKqRemoteRun(
  input: { buddieCode: string; deckCodes: string[]; cultureTokens?: number; heritageCode?: string },
  request: typeof fetch = fetch,
) {
  const response = await request("/api/admin/placard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readKqResponse<{ runId: string; state: KqGameState; burnReceipt: KqApiBurnReceipt; cultureTokenBalance: number }>(response);
}

export async function getKqRemoteActiveRun(request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/runs", { cache: "no-store" });
  return readKqResponse<{ activeRun: null | {
    runId: string; state: KqGameState; startedAt: string; updatedAt: string; burnReceipts: KqApiBurnReceipt[];
  } }>(response);
}

export async function getKqRemoteFlowers(request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/flowers", { cache: "no-store" });
  return readKqResponse<{ flowers: KqOfficialFlower[] }>(response);
}

export async function getKqRemoteFlowerRivals(flowerId: string, request: typeof fetch = fetch) {
  const response = await request(`/api/admin/placard/flowers/${encodeURIComponent(flowerId)}/rivals`, { cache: "no-store" });
  return readKqResponse<{ rivals: KqFlowerRival[] }>(response);
}

export async function lockKqRemoteBattle(flowerId: string, rivalFlowerId: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/battles", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ flowerId, rivalFlowerId }),
  });
  return readKqResponse<{ battleId: string; seed: number; status: string }>(response);
}

export async function finalizeKqRemoteBotBattle(flowerId: string, botCode: string, request: typeof fetch = fetch) {
  const response = await request("/api/admin/placard/bot-battles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flowerId, botCode }),
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
  return readKqResponse<{
    battleId: string; status: "verdict"; rounds: KqOfficialBattle["rounds"];
    winner: "player" | "opponent"; burnedAt: string;
    challengePoints: number;
    opponentChallengePoints: number;
    completedChallenges: Array<{ code: string; title: string; points: number }>;
    pvpBoosterGranted: boolean;
    pvpBoosterCardCount: number;
    rankProfile: null | { rating: number; seasonPoints: number; wins: number; losses: number; streak: number; burnedFlowers: number };
    replayed: boolean;
  }>(response);
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
