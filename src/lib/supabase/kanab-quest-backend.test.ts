import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyKqPlayerRunAction, applyKqRunAction, buildKqLaunchReadiness, buildKqNotebookRewardPreview, countKqInventoryCopies, getKqRandomTrainingBotCode, isKqFinalArtworkUrl, mapKqCardBurnResult, mapKqChallengeClaimKeys, mapKqPlayerCoreSnapshot, mapKqSeasonRolloverPreview, mapKqStartRunResult, prepareKqCardPlay, startKqPlayerRun } from "@/lib/supabase/kanab-quest-backend";
import { KQ_ACTIVE_CARDS, startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";
import { KQ_HERITAGE_EFFECTS } from "@/lib/kanab-quest-heritage";
import { getKqLaunchDossier, KQ_LAUNCH_ODDS_VERSION } from "@/lib/kanab-quest-launch-approvals";

const database = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => database }));

const APPROVED_LAUNCH_DECISIONS = {
  seasonCalendarApproved: true,
  seasonPrizesApproved: true,
  seasonTerritoryApproved: true,
  collectionOddsApproved: true,
  publicRulesApproved: true,
} as const;

const ALIGNED_EQUIPMENT_CATALOG = KQ_EQUIPMENT_CATALOG.map((equipment) => ({
  code: equipment.code,
  price_cents: equipment.priceCents,
  is_purchasable: equipment.purchasable,
  is_active: true,
}));

const DORMANT_LAUNCH_FEATURES = {
  heritagePurchaseDrawsLive: false,
  notebookRewardsLive: false,
  producerNotebookRewardsLive: false,
  seasonRewardsLive: false,
  publicPlayerApiLive: false,
} as const;

function heritageReadinessCards(imageAt: (index: number) => string) {
  return Array.from({ length: 12 }, (_, index) => ({
    image_url: imageAt(index),
    is_active: false,
    effect_code: KQ_HERITAGE_EFFECTS[index],
  }));
}

const COMPLETE_LAUNCH_DOSSIER = getKqLaunchDossier({
  KQ_LAUNCH_DOSSIER_JSON: JSON.stringify({
    seasonCode: "KQ-2026-S1",
    startsAt: "2026-10-01T10:00:00+02:00",
    endsAt: "2026-11-01T18:00:00+01:00",
    timezone: "Europe/Paris",
    territory: "France métropolitaine",
    minimumAge: 18,
    eligibility: "Résidence principale en France métropolitaine.",
    prizes: [
      { tierCode: "champion", label: "Champion", quantity: 1, stock: 1, unitValueCents: 10_000, fulfillment: "Envoi suivi" },
      { tierCode: "podium", label: "Podium", quantity: 3, stock: 3, unitValueCents: 5_000, fulfillment: "Envoi suivi" },
      { tierCode: "finalist", label: "Finaliste", quantity: 10, stock: 10, unitValueCents: 1_000, fulfillment: "Envoi suivi" },
      { tierCode: "participant", label: "Participant", quantity: 100, stock: 100, unitValueCents: 0, fulfillment: "Attribution numérique" },
    ],
    oddsVersion: KQ_LAUNCH_ODDS_VERSION,
    publicRulesUrl: "https://leschanvriersbretons.com/reglement-jeu-promo",
    contactEmail: "jeu@leschanvriersbretons.com",
  }),
});

describe("Kanab Quest Supabase inventory mapping", () => {
  it("draws one stable training bot without accepting a player choice", () => {
    const first = getKqRandomTrainingBotCode(
      "88888888-8888-8888-8888-888888888888",
      "99999999-9999-9999-9999-999999999999",
      "2026-09-05",
    );
    expect(first).toMatch(/^bot-(sylvain|charles|maya)$/);
    expect(getKqRandomTrainingBotCode(
      "88888888-8888-8888-8888-888888888888",
      "99999999-9999-9999-9999-999999999999",
      "2026-09-05",
    )).toBe(first);
  });
  it("maps the consolidated player snapshot and derives its league", () => {
    expect(mapKqPlayerCoreSnapshot({
      activeRun: null,
      humanBattles: [],
      botBattles: [],
      flowers: [{
        id: "flower-1", runId: "run-1", varietyCode: "VAR-1", varietyName: "Lifter",
        quality: 81, traits: ["dense"], combos: [], stats: { vigor: 7 }, status: "available",
        createdAt: "2026-08-13T10:00:00Z", lockedAt: null, burnedAt: null,
      }],
      progress: {
        seasonCode: "KQ-2026-S1", rank: 8, rating: 1075, seasonPoints: 120,
        wins: 5, losses: 2, streak: 2, burnedFlowers: 7, arenaExperience: 31,
        leaderboardGeneratedAt: "2026-08-13", updatedAt: "2026-08-13T10:00:00Z",
      },
    }, [{ flowerId: "flower-1", queuedAt: "2026-08-13T10:05:00Z" }], ["2026-09-07:clean-sweep"])).toMatchObject({
      activeRun: null,
      flowers: [{ id: "flower-1", quality: 81, stats: { vigor: 7 }, status: "queued", queuedAt: "2026-08-13T10:05:00Z" }],
      battles: [],
      progress: { rank: 8, rating: 1075, league: "Pousse I", leagueProgress: 50, pointsToNextLeague: 25, claimedChallengeCodes: ["2026-09-07:clean-sweep"] },
    });
  });
  it("maps durable daily challenge receipts and rejects malformed rows", () => {
    expect(mapKqChallengeClaimKeys([
      { challenge_day: "2026-09-07", challenge_code: "clean-sweep" },
      { challenge_day: "2026-09-07", challenge_code: "clean-sweep" },
      { challenge_day: "bad-date", challenge_code: "jury-edge" },
      null,
    ])).toEqual(["2026-09-07:clean-sweep"]);
  });
  it("maps versioned harvest titles consistently in collections and compact battle snapshots", () => {
    const examples = [
      { id: "legacy", quality: 14, expected: "Fleur légendaire" },
      { id: "contest", quality: 14, harvestTierVersion: 2, successfulStages: 6, criticalStages: 6, expected: "Qualité concours" },
      { id: "exceptional", quality: 26, harvestTierVersion: 2, successfulStages: 3, criticalStages: 3, expected: "Fleur exceptionnelle" },
      { id: "legendary", quality: 26, harvestTierVersion: 2, successfulStages: 4, criticalStages: 2, expected: "Fleur légendaire" },
      { id: "missing-evidence", quality: 30, harvestTierVersion: 2, expected: "Fleur exceptionnelle" },
    ];
    const snapshot = mapKqPlayerCoreSnapshot({ flowers: examples, humanBattles: examples.map(flower => ({
      id: `battle-${flower.id}`, status: "verdict", rounds: [], winner: "player",
      lockedAt: "2026-10-18T10:00:00Z", verdictAt: "2026-10-18T10:01:00Z",
      playerFlower: { id: flower.id, quality: flower.quality, variety_name: "Fleur",
        harvest_tier_version: flower.harvestTierVersion,
        successful_stages: flower.successfulStages, critical_stages: flower.criticalStages,
        battle_stats: {}, status: "burned", created_at: "2026-10-18T09:00:00Z" },
      opponentFlower: { id: "old-rival", quality: 14, battle_stats: {} },
    })) });
    expect(snapshot.flowers.map(flower => flower.tier)).toEqual(examples.map(flower => flower.expected));
    for (const example of examples) {
      const battle = snapshot.battles.find(item => item.id === `battle-${example.id}`)!;
      expect(battle.playerFlower.tier).toBe(example.expected);
      expect(battle.opponentFlower.tier).toBe("Fleur légendaire");
    }
    expect(snapshot.flowers[0]).not.toHaveProperty("harvestTierVersion");
    expect(snapshot.flowers[3]).toMatchObject({ harvestTierVersion: 2, successfulStages: 4, criticalStages: 2 });
  });
  it("rejects draft artwork while accepting local and hosted final assets", () => {
    expect(isKqFinalArtworkUrl("/cards/botte-01.webp")).toBe(true);
    expect(isKqFinalArtworkUrl("https://cdn.test/cards/heritage-01.webp")).toBe(true);
    expect(isKqFinalArtworkUrl("/cards/placeholder-01.webp")).toBe(false);
    expect(isKqFinalArtworkUrl("/cards/heritage-draft.webp")).toBe(false);
    expect(isKqFinalArtworkUrl("cards/relative-without-slash.webp")).toBe(false);
  });
  it("blocks activation until the public rules are explicitly approved", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: [],
      supportCards: [],
      supportCollectionActive: false,
      notebookRules: [],
      seasonRules: [],
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: {
        ...APPROVED_LAUNCH_DECISIONS,
        publicRulesApproved: false,
      },
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
    });
    expect(report.contentReady).toBe(false);
    expect(report.blockers).toContain("Règlement public relu et approuvé");
  });
  it("can become ready for activation with complete content and every public feature dormant", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards((index) => `/h-${index}.webp`),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: false })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
      featureFlags: DORMANT_LAUNCH_FEATURES,
    });

    expect(report).toMatchObject({ contentReady: true, safelyDormant: true, readyForActivation: true, blockers: [] });
    expect(report.checks).toContainEqual({
      code: "notebook-rules",
      label: "2 missions carnet → Kanab Quest configurées",
      ready: true,
    });
  });
  it("blocks launch when two producer Heritages share a mechanic", () => {
    const heritageCards = heritageReadinessCards((index) => `/h-${index}.webp`);
    heritageCards[1] = { ...heritageCards[1], effect_code: heritageCards[0].effect_code };
    const report = buildKqLaunchReadiness({
      heritageCards,
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: false })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
      featureFlags: DORMANT_LAUNCH_FEATURES,
    });
    expect(report.contentReady).toBe(false);
    expect(report.blockers).toContain("12 pouvoirs Héritage distincts et pris en charge");
  });
  it("blocks activation when producer rewards are already live", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards((index) => `/h-${index}.webp`),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: false })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
      featureFlags: { ...DORMANT_LAUNCH_FEATURES, producerNotebookRewardsLive: true },
    });

    expect(report).toMatchObject({ contentReady: true, safelyDormant: false, readyForActivation: false });
    expect(report.blockers).toContain("Récompenses des avis producteurs encore inactives");
  });
  it("explains every blocker before a season rollover", () => {
    expect(mapKqSeasonRolloverPreview("S1", "S2", {
      players: 14, eligiblePlayers: 9, missingRewardGrants: 2, lockedBattles: 1, ready: false,
    })).toMatchObject({
      players: 14,
      eligiblePlayers: 9,
      ready: false,
      blockers: [
        "2 récompense(s) de saison restent à attribuer",
        "1 duel(s) sont encore verrouillés",
      ],
    });
  });

  it("never reports rollover readiness without a planned season", () => {
    expect(mapKqSeasonRolloverPreview("S1", null)).toMatchObject({
      ready: false,
      blockers: ["Aucune prochaine saison planifiée"],
    });
  });
  it("reports missing artwork while confirming the activated rewards are not dormant", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards(() => ""),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 15 }, () => ({ is_active: false })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
    });
    expect(report.checks).toContainEqual({
      code: "player-access-dormant",
      label: "Accès joueur à Kanab Quest encore fermé",
      ready: true,
    });
    expect(report.safelyDormant).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("12 illustrations Héritage producteur");
    expect(report.blockers).toContain("2 missions carnet → Kanab Quest configurées");
  });
  it("detects unsafe season rewards before launch", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards((index) => `/h-${index}.webp`),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, () => ({ image_url: "/card.webp", is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: true })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code, index) => ({ tier_code, is_active: index === 0 })),
      seasonGrantCount: 1,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
    });
    expect(report.blockers).toContain(`${KQ_ACTIVE_CARDS.length} illustrations Botte du Chanvrier distinctes`);
    expect(report.safelyDormant).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("Aucune récompense de saison prématurée");
    expect(report.blockers).toContain("Récompenses de saison encore inactives");
  });
  it("distinguishes complete content from a safely activatable launch", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards((index) => `/h-${index}.webp`),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: true })),
      supportCollectionActive: true,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: true })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG,
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
    });
    expect(report.activationStillRequired.at(-1)).toBe(
      "Basculer KQ_PLAYER_API_LIVE en dernier, puis effectuer le test fumée avec un compte client de recette",
    );
    expect(report.contentReady).toBe(true);
    expect(report.safelyDormant).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("Collection Botte du Chanvrier encore inactive");
    expect(report.activationStillRequired).toContain(
      "Exécuter les rétro-attributions des missions Carnet puis des avis producteurs depuis l’interface admin",
    );
  });
  it("blocks launch when a Supabase checkout price diverges from the verified catalog", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: heritageReadinessCards((index) => `/h-${index}.webp`),
      supportCards: Array.from({ length: KQ_ACTIVE_CARDS.length }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: true })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      equipmentCatalog: ALIGNED_EQUIPMENT_CATALOG.map((equipment) => (
        equipment.code === "LED-300" ? { ...equipment, price_cents: 1 } : equipment
      )),
      launchApprovals: APPROVED_LAUNCH_DECISIONS,
      launchDossier: COMPLETE_LAUNCH_DOSSIER,
    });
    expect(report.contentReady).toBe(false);
    expect(report.blockers).toContain("14 prix boutique Supabase alignés sur le catalogue");
  });
  it("offers no retired mission rewards even when badges and historical grants exist", () => {
    expect(buildKqNotebookRewardPreview(
      [
        { id: 11, badge_id: "badge-first" },
        { id: 12, badge_id: "badge-aroma" },
      ],
      [
        { id: "badge-first", code: "premier-carnet", label: "Premier Carnet" },
        { id: "badge-aroma", code: "combo-aromatique", label: "Combo Aromatique" },
      ],
      [11],
    )).toMatchObject({
      rewardsLive: false,
      unlockedBadges: 0,
      alreadyGranted: 0,
      pendingBadges: 0,
      pendingSupportBoosters: 0,
      pendingCultureTokens: 0,
      badges: [],
    });
  });
  it("counts physical copies and ignores unrelated definitions", () => {
    expect(
      countKqInventoryCopies(
        [{ id: "a", code: "BOTTE-001" }, { id: "b", code: "BOTTE-002" }],
        [
          { card_definition_id: "a" },
          { card_definition_id: "a" },
          { card_definition_id: "outside" },
        ],
      ),
    ).toEqual({ "BOTTE-001": 2, "BOTTE-002": 0 });
  });

  it("maps the atomic run and substrate burn receipt", () => {
    expect(mapKqStartRunResult({
      run: { id: "run-1" },
      cultureTokenBalance: 4,
      burnReceipt: {
        id: "burn-1",
        card_instance_id: "copy-1",
        card_code: "BOTTE-001",
        stage_index: 0,
        use_kind: "substrate",
        burned_at: "2026-07-25T09:00:00.000Z",
      },
    })).toEqual({
      runId: "run-1",
      cultureTokenBalance: 4,
      freeSubstrate: false,
      burnReceipt: {
        id: "burn-1",
        cardInstanceId: "copy-1",
        cardCode: "BOTTE-001",
        stageIndex: 0,
        useKind: "substrate",
        burnedAt: "2026-07-25T09:00:00.000Z",
      },
    });
  });

  it("accepts a run started with the free standard substrate", () => {
    expect(mapKqStartRunResult({
      run: { id: "run-free" },
      cultureTokenBalance: 0,
      freeSubstrate: true,
      burnReceipt: null,
    })).toEqual({
      runId: "run-free",
      cultureTokenBalance: 0,
      freeSubstrate: true,
      burnReceipt: null,
    });
  });

  it("computes a legal support transition before asking Supabase to burn it", () => {
    const state = startKqGame(9, { deckCodes: ["BOTTE-001", "BOTTE-017"] });
    const result = prepareKqCardPlay({ ...state, handCodes: ["BOTTE-017"] }, "BOTTE-017");
    expect(result.useKind).toBe("support");
    expect(result.nextState.usedCards).toEqual(["BOTTE-017"]);
  });

  it("refuses to replay the passive substrate", () => {
    expect(() => prepareKqCardPlay(startKqGame(9), "BOTTE-001")).toThrow("invalide");
  });

  it("maps an atomic support burn and its resulting state", () => {
    expect(mapKqCardBurnResult({
      state: { xp: 2 },
      burnReceipt: {
        id: "burn-2", card_instance_id: "copy-2", card_code: "BOTTE-004",
        stage_index: 0, use_kind: "support", burned_at: "2026-07-25T10:00:00.000Z",
      },
    })).toEqual({
      state: { xp: 2 },
      burnReceipt: {
        id: "burn-2", cardInstanceId: "copy-2", cardCode: "BOTTE-004",
        stageIndex: 0, useKind: "support", burnedAt: "2026-07-25T10:00:00.000Z",
      },
    });
  });

  it("replays ordinary game actions on the trusted server engine", () => {
    const state = startKqGame(12);
    expect(applyKqRunAction(state, "roll").phase).toBe("rolled");
    expect(() => applyKqRunAction(state, "resolve")).toThrow("pas disponible");
  });

  it("activates an equipped one-shot Heritage power on the trusted server engine", () => {
    const state = startKqGame(12, { heritageCode: "HERITAGE-012" });
    const activated = applyKqRunAction(state, "heritage");
    expect(activated.heritageUsed).toBe(false);
    expect(activated.heritageArmed).toBe(true);
    expect(() => applyKqRunAction(activated, "heritage")).toThrow("pas disponible");
  });

  it("validates Main prévoyante exchanges on the trusted server engine", () => {
    const supportCodes = KQ_ACTIVE_CARDS
      .filter((card) => card.category !== "substrate" && card.category !== "pbi")
      .slice(0, 13)
      .map((card) => card.code);
    const state = startKqGame(44, {
      heritageCode: "HERITAGE-003",
      deckCodes: ["BOTTE-001", ...supportCodes],
    });
    expect(state.handCodes).toHaveLength(10);
    expect(state.heritageReserveCodes).toHaveLength(3);
    const lastHandCard = state.handCodes?.[9];
    const firstReserveCard = state.heritageReserveCodes?.[0];
    const swapped = applyKqRunAction(state, "heritage-swap", { handIndex: 9, reserveIndex: 0 });
    expect(swapped.handCodes).toHaveLength(10);
    expect(swapped.heritageReserveCodes).toHaveLength(3);
    expect(swapped.handCodes?.[9]).toBe(firstReserveCard);
    expect(swapped.heritageReserveCodes?.[0]).toBe(lastHandCard);
    expect(swapped.usedCards).toEqual(state.usedCards);
    expect([...swapped.handCodes!, ...swapped.heritageReserveCodes!].sort())
      .toEqual([...state.handCodes!, ...state.heritageReserveCodes!].sort());
    expect(() => applyKqRunAction(state, "heritage-swap", { handIndex: 10, reserveIndex: 0 })).toThrow("pas disponible");
    expect(() => applyKqRunAction(state, "heritage-swap", { handIndex: 99, reserveIndex: 0 })).toThrow("pas disponible");
  });
});

describe("ten-card hands through server run actions", () => {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const requestKey = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const updatedAt = "2026-10-20T12:00:00.000Z";
  const support = KQ_ACTIVE_CARDS.filter(card => card.category !== "substrate" && card.category !== "pbi").slice(0, 13).map(card => card.code);
  const initial = () => startKqGame(44, { varietyCode: "HH2026-002", deckCodes: support });
  const persisted = (state: KqGameState) => {
    database.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { state, status: "active", updated_at: updatedAt }, error: null }),
    }));
    database.rpc.mockImplementation(async (_name: string, args: { p_next_state: KqGameState }) => ({
      data: { state: args.p_next_state, flower: null }, error: null,
    }));
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns all ten persisted cards on a retried server launch without a second draw", async () => {
    const state = initial();
    database.rpc.mockResolvedValueOnce({ data: {
      run: { id: runId, state }, freeSubstrate: true, burnReceipt: null, replayed: true,
    }, error: null });
    database.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { recent_buddie_codes: [state.varietyCode] }, error: null }),
    }));
    const result = await startKqPlayerRun(owner, { zoneId: "starter", requestKey, buddieCode: state.varietyCode, deckCodes: support });
    expect(result.state.handCodes).toHaveLength(10);
    expect(result.state.handCodes).toEqual(state.handCodes);
    expect(result.replayed).toBe(true);
    expect(database.rpc).toHaveBeenCalledTimes(1);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_zone_run_receipt", expect.objectContaining({ p_user_id: owner, p_request_key: requestKey }));
  });

  it("redraws a stored five-card hand to ten without changing XP, stock or played copies", async () => {
    const state = initial();
    state.handCodes = state.handCodes!.slice(0, 5);
    persisted(state);
    const result = await applyKqPlayerRunAction(owner, runId, "redraw");
    expect(result.state.handCodes).toHaveLength(10);
    expect(result.state.handRedrawsUsed).toBe(1);
    expect(result.state.xp).toBe(state.xp);
    expect(result.state.deckCodes).toEqual(state.deckCodes);
    expect(result.state.usedCards).toEqual(state.usedCards);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_update_run_state", expect.objectContaining({
      p_user_id: owner, p_run_id: runId, p_expected_updated_at: updatedAt, p_action: "redraw",
    }));
  });

  it("rejects a pointless redraw before writing or consuming its allowance", async () => {
    const state = startKqGame(44, { deckCodes: support.slice(0, 10) });
    const before = structuredClone(state);
    persisted(state);
    await expect(applyKqPlayerRunAction(owner, runId, "redraw")).rejects.toThrow("pas disponible");
    expect(database.rpc).not.toHaveBeenCalled();
    expect(state).toEqual(before);
    expect(state.handRedrawsUsed).toBe(0);
  });

  it("preserves a historical five-card hand when only the dice are rolled", async () => {
    const state = initial();
    state.handCodes = state.handCodes!.slice(0, 5);
    persisted(state);
    const result = await applyKqPlayerRunAction(owner, runId, "roll");
    expect(result.state.handCodes).toEqual(state.handCodes);
    expect(result.state.handCodes).toHaveLength(5);
  });

  it("draws ten at the next stage through the saved-state server path", async () => {
    const state = applyKqRunAction({ ...initial(), phase: "rolled", dice: [6, 6, 6] }, "resolve");
    state.handCodes = state.handCodes!.slice(0, 5);
    persisted(state);
    const result = await applyKqPlayerRunAction(owner, runId, "advance");
    expect(result.state.stageIndex).toBe(1);
    expect(result.state.handCodes).toHaveLength(10);
    expect(result.state.usedCards).toEqual(state.usedCards);
    expect(result.state.deckCodes).toEqual(state.deckCodes);
  });

  it("sends index nine Heritage swaps with the same physical hand and reserve sizes", async () => {
    const state = startKqGame(44, { varietyCode: "HH2026-002", deckCodes: support, heritageCode: "HERITAGE-003" });
    persisted(state);
    const result = await applyKqPlayerRunAction(owner, runId, "heritage-swap", { handIndex: 9, reserveIndex: 2 });
    expect(result.state.handCodes).toHaveLength(10);
    expect(result.state.heritageReserveCodes).toHaveLength(3);
    expect(result.state.handCodes?.[9]).toBe(state.heritageReserveCodes?.[2]);
    expect(result.state.heritageReserveCodes?.[2]).toBe(state.handCodes?.[9]);
    expect(result.state.usedCards).toEqual(state.usedCards);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_swap_heritage_hand", expect.objectContaining({
      p_user_id: owner, p_run_id: runId, p_expected_updated_at: updatedAt,
    }));
  });

  it("does not create extra physical copies or permit a second use of the same copy", async () => {
    const state = startKqGame(9, { deckCodes: ["BOTTE-017"] });
    const { nextState } = prepareKqCardPlay(state, "BOTTE-017");
    expect(nextState.usedCards).toEqual(["BOTTE-017"]);
    const resolved = applyKqRunAction({ ...nextState, phase: "rolled", dice: [6, 6, 6] }, "resolve");
    persisted(resolved);
    const result = await applyKqPlayerRunAction(owner, runId, "advance");
    expect(result.state.handCodes).toEqual([]);
    expect(result.state.deckCodes).toEqual(["BOTTE-017"]);
    expect(() => prepareKqCardPlay(result.state, "BOTTE-017")).toThrow();
  });
});
