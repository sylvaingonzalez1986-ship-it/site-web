import { describe, expect, it } from "vitest";
import { applyKqRunAction, buildKqLaunchReadiness, buildKqNotebookRewardPreview, countKqInventoryCopies, isKqFinalArtworkUrl, mapKqCardBurnResult, mapKqSeasonRolloverPreview, mapKqStartRunResult, prepareKqCardPlay } from "@/lib/supabase/kanab-quest-backend";
import { KQ_CARDS, startKqGame } from "@/lib/kanab-quest-game";

describe("Kanab Quest Supabase inventory mapping", () => {
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
      publicRulesApproved: false,
    });
    expect(report.contentReady).toBe(false);
    expect(report.blockers).toContain("Règlement public, lots et probabilités validés");
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
      heritageCards: Array.from({ length: 12 }, () => ({ image_url: "", is_active: false })),
      supportCards: Array.from({ length: 36 }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 15 }, () => ({ is_active: false })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      publicRulesApproved: true,
    });
    expect(report.checks).toContainEqual({
      code: "player-access-dormant",
      label: "Accès joueur au Placard encore fermé",
      ready: true,
    });
    expect(report.safelyDormant).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("12 illustrations Héritage distinctes");
    expect(report.blockers).toContain("2 missions carnet → Placard actives");
  });
  it("detects unsafe season rewards before launch", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: Array.from({ length: 12 }, (_, index) => ({ image_url: `/h-${index}.webp`, is_active: false })),
      supportCards: Array.from({ length: 36 }, () => ({ image_url: "/card.webp", is_active: false })),
      supportCollectionActive: false,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: true })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code, index) => ({ tier_code, is_active: index === 0 })),
      seasonGrantCount: 1,
      publicRulesApproved: true,
    });
    expect(report.blockers).toContain("36 illustrations La Botte distinctes");
    expect(report.safelyDormant).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("Aucune récompense de saison prématurée");
    expect(report.blockers).toContain("Récompenses de saison encore inactives");
  });
  it("distinguishes complete content from a safely activatable launch", () => {
    const report = buildKqLaunchReadiness({
      heritageCards: Array.from({ length: 12 }, (_, index) => ({ image_url: `/h-${index}.webp`, is_active: false })),
      supportCards: Array.from({ length: 36 }, (_, index) => ({ image_url: `/card-${index}.webp`, is_active: true })),
      supportCollectionActive: true,
      notebookRules: Array.from({ length: 2 }, () => ({ is_active: true })),
      seasonRules: ["champion", "podium", "finalist", "participant"].map((tier_code) => ({ tier_code, is_active: false })),
      seasonGrantCount: 0,
      publicRulesApproved: true,
    });
    expect(report.activationStillRequired.at(-1)).toBe(
      "Basculer KQ_PLAYER_API_LIVE en dernier, puis effectuer le test fumée avec un compte client de recette",
    );
    expect(report.contentReady).toBe(true);
    expect(report.safelyDormant).toBe(false);
    expect(report.readyForActivation).toBe(false);
    expect(report.blockers).toContain("Collection La Botte encore inactive");
    expect(report.activationStillRequired).toContain(
      "Exécuter les rétro-attributions Carnet puis Héritage par lots depuis l’interface admin",
    );
  });
  it("previews only the two active notebook missions", () => {
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
      rewardsLive: true,
      unlockedBadges: 2,
      alreadyGranted: 1,
      pendingBadges: 1,
      pendingSupportBoosters: 1,
      pendingCultureTokens: 0,
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
    expect(result.nextState.usedCards).toEqual(["BOTTE-001", "BOTTE-017"]);
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
    const supportCodes = KQ_CARDS
      .filter((card) => card.category !== "substrate" && card.category !== "pbi")
      .slice(0, 12)
      .map((card) => card.code);
    const state = startKqGame(44, {
      heritageCode: "HERITAGE-003",
      deckCodes: ["BOTTE-001", ...supportCodes],
    });
    const firstHandCard = state.handCodes?.[0];
    const firstReserveCard = state.heritageReserveCodes?.[0];
    const swapped = applyKqRunAction(state, "heritage-swap", { handIndex: 0, reserveIndex: 0 });
    expect(swapped.handCodes?.[0]).toBe(firstReserveCard);
    expect(swapped.heritageReserveCodes?.[0]).toBe(firstHandCard);
    expect(() => applyKqRunAction(state, "heritage-swap", { handIndex: 99, reserveIndex: 0 })).toThrow("pas disponible");
  });
});
