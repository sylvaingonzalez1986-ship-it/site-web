import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const MARKET_ROUTES = new Set([
  "dry-sift",
  "static-sift",
  "ice-water-hash",
  "rosin-trial",
  "rosin-selection",
  "rosin-premium",
  "rosin-signature",
  "hash-signature",
]);

function parseUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function responseKeys(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.keys(payload).sort()
    : [];
}

function responseDigest(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const baseUrl = (process.env.PLACARD_SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const workspaceRoot = resolve(process.cwd());
const reportDirectory = resolve(
  workspaceRoot,
  String(process.env.PLACARD_SMOKE_REPORT_DIR || "output/placard-smoke-tests").trim(),
);
const reportDirectoryFromRoot = relative(workspaceRoot, reportDirectory);
if (
  !reportDirectoryFromRoot
  || reportDirectoryFromRoot === ".."
  || reportDirectoryFromRoot.startsWith(`..${sep}`)
  || isAbsolute(reportDirectoryFromRoot)
) {
  throw new Error("PLACARD_SMOKE_REPORT_DIR doit désigner un sous-dossier du projet.");
}

const cookie = String(process.env.PLACARD_SMOKE_COOKIE || "").trim();
const action = String(process.env.PLACARD_SMOKE_ACTION || "").trim().toLowerCase();
const runId = String(process.env.PLACARD_SMOKE_RUN_ID || "").trim();
const cardCode = String(process.env.PLACARD_SMOKE_CARD_CODE || "").trim();
const battleId = String(process.env.PLACARD_SMOKE_BATTLE_ID || "").trim();
const flowerId = String(process.env.PLACARD_SMOKE_FLOWER_ID || "").trim();
const marketRoute = String(process.env.PLACARD_SMOKE_MARKET_ROUTE || "").trim().toLowerCase();
const equipmentCode = String(process.env.PLACARD_SMOKE_EQUIPMENT_CODE || "").trim();

delete process.env.PLACARD_SMOKE_COOKIE;
delete process.env.PLACARD_SMOKE_RUN_ID;
delete process.env.PLACARD_SMOKE_CARD_CODE;
delete process.env.PLACARD_SMOKE_BATTLE_ID;
delete process.env.PLACARD_SMOKE_FLOWER_ID;
delete process.env.PLACARD_SMOKE_EQUIPMENT_CODE;

const burnConfirmation = process.env.PLACARD_SMOKE_CONFIRM_BURNS === "LOCAL_BURNS_ONLY";
const marketConfirmation = process.env.PLACARD_SMOKE_CONFIRM_MARKET === "LOCAL_MARKET_ONLY";
const equipmentConfirmation = process.env.PLACARD_SMOKE_CONFIRM_EQUIPMENT === "LOCAL_EQUIPMENT_ONLY";
const databaseConfirmation = process.env.PLACARD_SMOKE_CONFIRM_DATABASE === "LOCAL_SUPABASE_ONLY";
const configuredSupabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const databaseUrl = parseUrl(configuredSupabaseUrl);
const isLocalDatabase = databaseUrl
  ? /^(127\.0\.0\.1|localhost)$/i.test(databaseUrl.hostname)
  : false;
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);

if (!isLocal) {
  throw new Error("Ce test transactionnel refuse toujours les cibles distantes.");
}
if (!databaseConfirmation) {
  throw new Error("PLACARD_SMOKE_CONFIRM_DATABASE=LOCAL_SUPABASE_ONLY est requis.");
}
if (!configuredSupabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL doit être fourni dans l’environnement du processus ; ce script ne lit aucun fichier de configuration secret.",
  );
}
if (!isLocalDatabase) {
  throw new Error(
    "Smoke test refusé : le serveur local est configuré avec une base Supabase distante ou inconnue.",
  );
}
if (!cookie) {
  throw new Error("PLACARD_SMOKE_COOKIE est requis pour le compte de recette local.");
}
if (!["card", "verdict", "bot-challenge", "equipment", "market"].includes(action)) {
  throw new Error("PLACARD_SMOKE_ACTION doit valoir card, verdict, bot-challenge, equipment ou market.");
}
if ((action === "card" || action === "verdict" || action === "bot-challenge") && !burnConfirmation) {
  throw new Error("PLACARD_SMOKE_CONFIRM_BURNS=LOCAL_BURNS_ONLY est requis.");
}
if (action === "market" && !marketConfirmation) {
  throw new Error("PLACARD_SMOKE_CONFIRM_MARKET=LOCAL_MARKET_ONLY est requis.");
}
if (action === "equipment" && !equipmentConfirmation) {
  throw new Error("PLACARD_SMOKE_CONFIRM_EQUIPMENT=LOCAL_EQUIPMENT_ONLY est requis.");
}
if (action === "card" && (!runId || !cardCode)) {
  throw new Error("PLACARD_SMOKE_RUN_ID et PLACARD_SMOKE_CARD_CODE sont requis pour tester un burn.");
}
if (action === "verdict" && !battleId) {
  throw new Error("PLACARD_SMOKE_BATTLE_ID est requis pour tester un verdict.");
}
if (action === "bot-challenge" && !flowerId) {
  throw new Error("PLACARD_SMOKE_FLOWER_ID est requis pour tester un duel bot et ses défis.");
}
if (action === "market" && (!flowerId || !equipmentCode || !MARKET_ROUTES.has(marketRoute))) {
  throw new Error(
    "PLACARD_SMOKE_FLOWER_ID, PLACARD_SMOKE_EQUIPMENT_CODE et une PLACARD_SMOKE_MARKET_ROUTE de transformation sont requis.",
  );
}
if (action === "equipment" && !equipmentCode) {
  throw new Error("PLACARD_SMOKE_EQUIPMENT_CODE est requis pour tester un achat de matériel.");
}

async function requestJson(path, init = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    ...init,
    headers: {
      accept: "application/json",
      cookie,
      ...(init.body ? { "content-type": "application/json" } : {}),
      "user-agent": "placard-local-transaction-smoke/2.0",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({ error: "Réponse non JSON." }));
  return { response, payload, durationMs: Math.round(performance.now() - startedAt) };
}

function requireOk(result, label) {
  if (!result.response.ok) {
    throw new Error(`${label} refusé (HTTP ${result.response.status}).`);
  }
  return result.payload;
}

function readProgressSnapshot(payload, label) {
  const progress = payload?.progress;
  if (progress === null) {
    return { seasonPoints: 0, arenaExperience: 0, burnedFlowers: 0, claimedChallengeCodes: [] };
  }
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    throw new Error(`${label} ne contient pas de progression exploitable.`);
  }
  if (!Array.isArray(progress.claimedChallengeCodes)
    || progress.claimedChallengeCodes.some((code) => typeof code !== "string" || !/^\d{4}-\d{2}-\d{2}:[a-z0-9-]+$/.test(code))) {
    throw new Error(`${label} ne contient pas de liste de défis valide.`);
  }
  const snapshot = {
    seasonPoints: Number(progress.seasonPoints),
    arenaExperience: Number(progress.arenaExperience),
    burnedFlowers: Number(progress.burnedFlowers),
    claimedChallengeCodes: Array.isArray(progress.claimedChallengeCodes)
      ? progress.claimedChallengeCodes.map(String).sort()
      : [],
  };
  if (
    !Number.isInteger(snapshot.seasonPoints)
    || !Number.isFinite(snapshot.arenaExperience)
    || !Number.isInteger(snapshot.burnedFlowers)
  ) {
    throw new Error(`${label} contient des compteurs invalides.`);
  }
  return snapshot;
}

function nearlyEqual(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.000_001;
}

const bootstrapResult = await requestJson("/api/arena/placard/bootstrap");
if (bootstrapResult.response.status !== 200) {
  throw new Error(
    `Préflight Placard refusé : bootstrap HTTP ${bootstrapResult.response.status}. Vérifiez la session locale.`,
  );
}

const marketTrace = {
  equipmentReadStatus: null,
  purchaseAttempted: false,
  purchaseStatus: null,
  installationStatus: null,
  routePlanStatus: null,
  marketReadStatus: null,
  firstSaleStatus: null,
  replayStatus: null,
};

const equipmentTrace = {
  initialReadStatus: null,
  firstPurchaseStatus: null,
  replayStatus: null,
  installationStatus: null,
  finalReadStatus: null,
};

const botChallengeTrace = {
  initialProgressStatus: null,
  initialFlowersStatus: null,
  firstBattleStatus: null,
  postBattleProgressStatus: null,
  postBattleFlowersStatus: null,
  replayStatus: null,
  finalProgressStatus: null,
};

async function runBurnScenario() {
  const path = action === "card"
    ? `/api/arena/placard/runs/${encodeURIComponent(runId)}/cards`
    : `/api/arena/placard/battles/${encodeURIComponent(battleId)}/verdict`;
  const body = action === "card" ? JSON.stringify({ cardCode }) : undefined;
  const result = await requestJson(path, { method: "POST", body });
  return {
    routeTemplate: action === "card"
      ? "/api/arena/placard/runs/[runId]/cards"
      : "/api/arena/placard/battles/[battleId]/verdict",
    targetReference: action === "card" ? runId : battleId,
    status: result.response.status,
    durationMs: result.durationMs,
    succeeded: result.response.ok,
    responseKeys: responseKeys(result.payload),
    responseDigest: responseDigest(result.payload),
    checks: {
      bootstrapAuthenticated: true,
      mutationAccepted: result.response.ok,
    },
  };
}

async function runEquipmentScenario() {
  const startedAt = performance.now();
  const initialResult = await requestJson("/api/arena/placard/equipment");
  equipmentTrace.initialReadStatus = initialResult.response.status;
  const initial = requireOk(initialResult, "Lecture initiale de l’atelier");
  const initialOwnedCodes = Array.isArray(initial.ownedCodes) ? initial.ownedCodes.map(String) : [];
  if (initialOwnedCodes.includes(equipmentCode)) {
    throw new Error("Le matériel de recette est déjà possédé : choisissez une référence neuve pour prouver le débit.");
  }
  const catalog = Array.isArray(initial.catalog) ? initial.catalog : [];
  const equipment = catalog.find((item) => String(item?.code ?? "") === equipmentCode);
  if (!equipment?.purchasable) {
    throw new Error("Le matériel de recette n’est pas achetable dans le catalogue local.");
  }
  const initialCashCents = Number(initial.cashCents);
  const catalogPriceCents = Number(equipment.priceCents);
  if (!Number.isInteger(initialCashCents) || !Number.isInteger(catalogPriceCents) || catalogPriceCents < 1) {
    throw new Error("Le solde ou le prix du matériel de recette est invalide.");
  }
  if (initialCashCents < catalogPriceCents) {
    throw new Error("Le compte de recette n’a pas assez de trésorerie pour ce matériel.");
  }

  const requestKey = randomUUID();
  const purchaseBody = JSON.stringify({ requestKey, equipmentCodes: [equipmentCode] });
  const firstPurchase = await requestJson("/api/arena/placard/equipment", { method: "POST", body: purchaseBody });
  equipmentTrace.firstPurchaseStatus = firstPurchase.response.status;
  const firstReceipt = requireOk(firstPurchase, "Premier achat local de matériel");
  const replayPurchase = await requestJson("/api/arena/placard/equipment", { method: "POST", body: purchaseBody });
  equipmentTrace.replayStatus = replayPurchase.response.status;
  const replayReceipt = requireOk(replayPurchase, "Rejeu de l’achat local de matériel");
  const stableReceiptFields = ["purchaseId", "totalPriceCents", "cashAfterCents"];
  const sameReceipt = stableReceiptFields.every((field) => firstReceipt?.[field] === replayReceipt?.[field])
    && JSON.stringify(firstReceipt?.equipmentCodes) === JSON.stringify(replayReceipt?.equipmentCodes);
  const receiptMatchesTarget = Array.isArray(firstReceipt?.equipmentCodes)
    && firstReceipt.equipmentCodes.length === 1
    && firstReceipt.equipmentCodes[0] === equipmentCode
    && Number(firstReceipt.totalPriceCents) === catalogPriceCents;
  const replayConfirmed = firstReceipt?.replayed === false
    && replayReceipt?.replayed === true
    && sameReceipt;
  const cashDeltaConfirmed = Number(firstReceipt?.cashAfterCents) === initialCashCents - catalogPriceCents;

  const installationResult = await requestJson("/api/arena/placard/equipment", {
    method: "PATCH",
    body: JSON.stringify({ equipmentCode }),
  });
  equipmentTrace.installationStatus = installationResult.response.status;
  const installation = requireOk(installationResult, "Installation du matériel acheté");
  const finalResult = await requestJson("/api/arena/placard/equipment");
  equipmentTrace.finalReadStatus = finalResult.response.status;
  const final = requireOk(finalResult, "Lecture finale de l’atelier");
  const finalOwnedCodes = Array.isArray(final.ownedCodes) ? final.ownedCodes.map(String) : [];
  const finalEquippedCodes = Array.isArray(final.equippedCodes) ? final.equippedCodes.map(String) : [];
  const inventoryConfirmed = finalOwnedCodes.includes(equipmentCode);
  const installationConfirmed = installation?.equipmentCode === equipmentCode
    && installation?.equipped === true
    && finalEquippedCodes.includes(equipmentCode);
  const finalCashConfirmed = Number(final.cashCents) === Number(firstReceipt?.cashAfterCents);
  const succeeded = replayConfirmed
    && receiptMatchesTarget
    && cashDeltaConfirmed
    && inventoryConfirmed
    && installationConfirmed
    && finalCashConfirmed;

  return {
    routeTemplate: "/api/arena/placard/equipment",
    targetReference: equipmentCode,
    status: firstPurchase.response.status,
    durationMs: Math.round(performance.now() - startedAt),
    succeeded,
    responseKeys: responseKeys(firstReceipt),
    responseDigest: responseDigest({ firstReceipt, replayReceipt }),
    checks: {
      bootstrapAuthenticated: true,
      firstPurchaseStatus: firstPurchase.response.status,
      replayStatus: replayPurchase.response.status,
      receiptMatchesTarget,
      replayConfirmed,
      cashDeltaConfirmed,
      inventoryConfirmed,
      installationConfirmed,
      finalCashConfirmed,
    },
  };
}

async function runBotChallengeScenario() {
  const startedAt = performance.now();
  const initialProgressResult = await requestJson("/api/arena/placard/me");
  botChallengeTrace.initialProgressStatus = initialProgressResult.response.status;
  const initialProgress = readProgressSnapshot(
    requireOk(initialProgressResult, "Lecture initiale de la progression"),
    "La lecture initiale",
  );
  const initialFlowersResult = await requestJson("/api/arena/placard/flowers");
  botChallengeTrace.initialFlowersStatus = initialFlowersResult.response.status;
  const initialFlowersPayload = requireOk(initialFlowersResult, "Lecture initiale des Fleurs");
  const initialFlowers = Array.isArray(initialFlowersPayload.flowers) ? initialFlowersPayload.flowers : [];
  const selectedFlower = initialFlowers.find((flower) => String(flower?.id ?? "") === flowerId);
  if (!selectedFlower || selectedFlower.status !== "available") {
    throw new Error("La Fleur de recette doit être disponible et ne pas être engagée dans la file aléatoire.");
  }

  const battleBody = JSON.stringify({ flowerId });
  const firstBattle = await requestJson("/api/arena/placard/bot-battles", {
    method: "POST",
    body: battleBody,
  });
  botChallengeTrace.firstBattleStatus = firstBattle.response.status;
  const firstReceipt = requireOk(firstBattle, "Duel bot local");
  const challengePoints = Number(firstReceipt?.challengePoints);
  const experienceAwarded = Number(firstReceipt?.experienceAwarded);
  const claimedChallengeCodes = Array.isArray(firstReceipt?.claimedChallengeCodes)
    ? firstReceipt.claimedChallengeCodes.map(String).sort()
    : [];
  const completedChallenges = Array.isArray(firstReceipt?.completedChallenges)
    ? firstReceipt.completedChallenges
    : [];
  const uniqueClaims = new Set(claimedChallengeCodes);
  const claimedChallengePointSum = claimedChallengeCodes.reduce((sum, code) => {
    const challenge = completedChallenges.find((candidate) => String(candidate?.code ?? "") === code);
    const points = Number(challenge?.points);
    return sum + (Number.isInteger(points) && points > 0 ? points : Number.NaN);
  }, 0);
  if (
    !Number.isInteger(challengePoints)
    || challengePoints < 1
    || !Number.isFinite(experienceAwarded)
    || experienceAwarded <= 0
    || claimedChallengeCodes.length < 1
    || uniqueClaims.size !== claimedChallengeCodes.length
    || claimedChallengePointSum !== challengePoints
  ) {
    throw new Error(
      "La Fleur doit provenir d’une culture locale qui valide au moins un défi quotidien encore non encaissé.",
    );
  }

  const receiptMatchesTarget = firstReceipt?.playerFlower?.id === flowerId;
  const postBattleProgressResult = await requestJson("/api/arena/placard/me");
  botChallengeTrace.postBattleProgressStatus = postBattleProgressResult.response.status;
  const postBattleProgress = readProgressSnapshot(
    requireOk(postBattleProgressResult, "Lecture de la progression après duel"),
    "La lecture après duel",
  );
  const postBattleFlowersResult = await requestJson("/api/arena/placard/flowers");
  botChallengeTrace.postBattleFlowersStatus = postBattleFlowersResult.response.status;
  const postBattleFlowersPayload = requireOk(postBattleFlowersResult, "Lecture des Fleurs après duel");
  if (!Array.isArray(postBattleFlowersPayload?.flowers)) {
    throw new Error("La lecture après duel ne contient pas de liste de Fleurs valide.");
  }
  const postBattleFlowers = postBattleFlowersPayload.flowers;
  const seasonPointsConfirmed = postBattleProgress.seasonPoints - initialProgress.seasonPoints === challengePoints;
  const experienceConfirmed = nearlyEqual(
    postBattleProgress.arenaExperience - initialProgress.arenaExperience,
    experienceAwarded,
  );
  const burnedFlowersConfirmed = postBattleProgress.burnedFlowers - initialProgress.burnedFlowers === 1;
  const flowerBurnConfirmed = !postBattleFlowers.some((flower) => String(flower?.id ?? "") === flowerId);
  const initialClaimKeys = new Set(initialProgress.claimedChallengeCodes);
  const newClaimKeys = postBattleProgress.claimedChallengeCodes.filter((claimKey) => !initialClaimKeys.has(claimKey));
  const challengeClaimsSynced = newClaimKeys.length === claimedChallengeCodes.length
    && claimedChallengeCodes.every((code) => newClaimKeys.some((claimKey) => claimKey.endsWith(`:${code}`)));

  const replayBattle = await requestJson("/api/arena/placard/bot-battles", {
    method: "POST",
    body: battleBody,
  });
  botChallengeTrace.replayStatus = replayBattle.response.status;
  const replayRejected = replayBattle.response.status === 409;
  const finalProgressResult = await requestJson("/api/arena/placard/me");
  botChallengeTrace.finalProgressStatus = finalProgressResult.response.status;
  const finalProgress = readProgressSnapshot(
    requireOk(finalProgressResult, "Lecture finale de la progression"),
    "La lecture finale",
  );
  const noDoubleCreditConfirmed = replayRejected
    && finalProgress.seasonPoints === postBattleProgress.seasonPoints
    && nearlyEqual(finalProgress.arenaExperience, postBattleProgress.arenaExperience)
    && finalProgress.burnedFlowers === postBattleProgress.burnedFlowers
    && JSON.stringify(finalProgress.claimedChallengeCodes) === JSON.stringify(postBattleProgress.claimedChallengeCodes);
  const succeeded = receiptMatchesTarget
    && seasonPointsConfirmed
    && experienceConfirmed
    && burnedFlowersConfirmed
    && flowerBurnConfirmed
    && challengeClaimsSynced
    && noDoubleCreditConfirmed;

  return {
    routeTemplate: "/api/arena/placard/bot-battles",
    targetReference: flowerId,
    status: firstBattle.response.status,
    durationMs: Math.round(performance.now() - startedAt),
    succeeded,
    responseKeys: responseKeys(firstReceipt),
    responseDigest: responseDigest({ firstReceipt, replay: replayBattle.payload }),
    checks: {
      bootstrapAuthenticated: true,
      firstBattleStatus: firstBattle.response.status,
      replayStatus: replayBattle.response.status,
      receiptMatchesTarget,
      challengePoints,
      experienceAwarded,
      seasonPointsConfirmed,
      experienceConfirmed,
      burnedFlowersConfirmed,
      flowerBurnConfirmed,
      challengeClaimsSynced,
      replayRejected,
      noDoubleCreditConfirmed,
    },
  };
}

async function runMarketScenario() {
  const startedAt = performance.now();
  const equipmentResult = await requestJson("/api/arena/placard/equipment");
  marketTrace.equipmentReadStatus = equipmentResult.response.status;
  const initialEquipment = requireOk(equipmentResult, "Lecture de l’atelier");
  const ownedCodes = Array.isArray(initialEquipment.ownedCodes) ? initialEquipment.ownedCodes.map(String) : [];
  const equippedCodes = Array.isArray(initialEquipment.equippedCodes) ? initialEquipment.equippedCodes.map(String) : [];
  const purchaseAttempted = !ownedCodes.includes(equipmentCode);
  marketTrace.purchaseAttempted = purchaseAttempted;

  if (purchaseAttempted) {
    const purchaseResult = await requestJson("/api/arena/placard/equipment", {
      method: "POST",
      body: JSON.stringify({ requestKey: randomUUID(), equipmentCodes: [equipmentCode] }),
    });
    marketTrace.purchaseStatus = purchaseResult.response.status;
    requireOk(purchaseResult, "Achat local de la machine");
  }

  if (!equippedCodes.includes(equipmentCode)) {
    const installationResult = await requestJson("/api/arena/placard/equipment", {
      method: "PATCH",
      body: JSON.stringify({ equipmentCode }),
    });
    marketTrace.installationStatus = installationResult.response.status;
    requireOk(installationResult, "Installation de la machine");
  }

  const routePlanResult = await requestJson("/api/arena/placard/equipment", {
    method: "PATCH",
    body: JSON.stringify({ action: "route-plan", route: marketRoute, equipmentCode }),
  });
  marketTrace.routePlanStatus = routePlanResult.response.status;
  const routePlan = requireOk(routePlanResult, "Épinglage de la mission d’atelier");
  if (routePlan.route !== marketRoute || routePlan.equipmentCode !== equipmentCode) {
    throw new Error("Le serveur n’a pas conservé la mission d’atelier demandée.");
  }

  const marketResult = await requestJson("/api/arena/placard/market");
  marketTrace.marketReadStatus = marketResult.response.status;
  const market = requireOk(marketResult, "Préparation du marché");
  const lots = Array.isArray(market.lots) ? market.lots : [];
  const lot = lots.find((candidate) => String(candidate?.flowerId ?? "") === flowerId);
  const option = Array.isArray(lot?.options)
    ? lot.options.find((candidate) => candidate?.route === marketRoute)
    : null;
  if (!lot || lot.status !== "ready") {
    throw new Error("Le lot local demandé n’est pas prêt à être vendu.");
  }
  if (!option?.available) {
    throw new Error("La machine installée et la note du jury ne rendent pas cette transformation disponible.");
  }

  const saleRequestKey = randomUUID();
  const saleBody = JSON.stringify({ flowerId, requestKey: saleRequestKey, route: marketRoute });
  const firstSale = await requestJson("/api/arena/placard/market", { method: "POST", body: saleBody });
  marketTrace.firstSaleStatus = firstSale.response.status;
  const secondSale = firstSale.response.ok
    ? await requestJson("/api/arena/placard/market", { method: "POST", body: saleBody })
    : null;
  marketTrace.replayStatus = secondSale?.response.status ?? null;
  const firstReceipt = firstSale.payload;
  const secondReceipt = secondSale?.payload ?? null;
  const stableReceiptFields = [
    "receiptId",
    "flowerId",
    "route",
    "payoutCents",
    "reputationGain",
    "cashAfterCents",
    "reputationAfter",
  ];
  const sameReceipt = Boolean(secondReceipt) && stableReceiptFields.every(
    (field) => firstReceipt?.[field] === secondReceipt?.[field],
  );
  const routeSales = Number(firstReceipt?.routeMastery?.routeSales ?? 0);
  const masteryMatchedPlan = firstReceipt?.routeMastery?.matchedPlan === true;
  const receiptMatchesTarget = firstReceipt?.flowerId === flowerId && firstReceipt?.route === marketRoute;
  const replayConfirmed = firstReceipt?.replayed === false
    && secondReceipt?.replayed === true
    && sameReceipt;
  const succeeded = firstSale.response.ok
    && secondSale?.response.ok === true
    && replayConfirmed
    && masteryMatchedPlan
    && receiptMatchesTarget
    && Number.isInteger(routeSales)
    && routeSales >= 1;

  return {
    routeTemplate: "/api/arena/placard/market",
    targetReference: flowerId,
    status: firstSale.response.status,
    durationMs: Math.round(performance.now() - startedAt),
    succeeded,
    responseKeys: responseKeys(firstReceipt),
    responseDigest: responseDigest({ firstReceipt, secondReceipt }),
    checks: {
      bootstrapAuthenticated: true,
      equipmentOwned: true,
      purchaseAttempted,
      purchaseStatus: marketTrace.purchaseStatus,
      equipmentInstalled: true,
      installationStatus: marketTrace.installationStatus,
      routePlanPinned: true,
      lotEligible: true,
      firstSaleStatus: firstSale.response.status,
      replayStatus: secondSale?.response.status ?? null,
      receiptMatchesTarget,
      replayConfirmed,
      masteryMatchedPlan,
      routeSales,
      expertiseBonusReputation: Math.max(
        0,
        Math.trunc(Number(firstReceipt?.routeMastery?.expertiseBonusReputation ?? 0)),
      ),
    },
  };
}

const scenarioStartedAt = performance.now();
let scenarioError = null;
let result;
try {
  result = action === "market"
    ? await runMarketScenario()
    : action === "equipment"
      ? await runEquipmentScenario()
      : action === "bot-challenge"
        ? await runBotChallengeScenario()
        : await runBurnScenario();
} catch (error) {
  scenarioError = error;
  result = {
    routeTemplate: action === "card"
      ? "/api/arena/placard/runs/[runId]/cards"
      : action === "verdict"
        ? "/api/arena/placard/battles/[battleId]/verdict"
        : action === "bot-challenge"
          ? "/api/arena/placard/bot-battles"
        : action === "equipment"
          ? "/api/arena/placard/equipment"
          : "/api/arena/placard/market",
    targetReference: action === "card"
      ? runId
      : action === "verdict"
        ? battleId
        : action === "equipment"
          ? equipmentCode
          : flowerId,
    status: action === "market"
      ? marketTrace.firstSaleStatus
      : action === "equipment"
        ? equipmentTrace.firstPurchaseStatus
        : action === "bot-challenge"
          ? botChallengeTrace.firstBattleStatus
        : null,
    durationMs: Math.round(performance.now() - scenarioStartedAt),
    succeeded: false,
    responseKeys: [],
    responseDigest: createHash("sha256").update(`${action}:scenario-failed`).digest("hex"),
    checks: action === "market"
      ? { bootstrapAuthenticated: true, scenarioCompleted: false, ...marketTrace }
      : action === "equipment"
        ? { bootstrapAuthenticated: true, scenarioCompleted: false, ...equipmentTrace }
        : action === "bot-challenge"
          ? { bootstrapAuthenticated: true, scenarioCompleted: false, ...botChallengeTrace }
          : { bootstrapAuthenticated: true, scenarioCompleted: false },
  };
}
const generatedAt = new Date().toISOString();
const reportFileName = `placard-smoke-${action}-${generatedAt.replace(/[:.]/g, "-")}.json`;
const reportPath = resolve(reportDirectory, reportFileName);
const artifactPath = relative(workspaceRoot, reportPath).split(sep).join("/");
const summary = {
  schema: "kanab-quest-transaction-smoke-v2",
  generatedAt,
  artifactPath,
  mode: "local-transaction",
  databaseHost: databaseUrl?.host ?? "unknown",
  action,
  routeTemplate: result.routeTemplate,
  targetFingerprint: createHash("sha256")
    .update(`${action}:${result.targetReference}`)
    .digest("hex")
    .slice(0, 16),
  status: result.status,
  durationMs: result.durationMs,
  succeeded: result.succeeded,
  responseKeys: result.responseKeys,
  responseDigest: result.responseDigest,
  checks: result.checks,
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(JSON.stringify(summary, null, 2));
if (scenarioError) {
  console.error(scenarioError instanceof Error ? scenarioError.message : "Scénario transactionnel interrompu.");
}
if (!result.succeeded) process.exitCode = 1;
