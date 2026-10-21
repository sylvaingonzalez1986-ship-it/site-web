import { describe, expect, it } from "vitest";
import {
  parseKqContractBoard, parseKqContractBoardResult, parseKqRenewableAttempt, parseKqRenewableCommand,
  type KqContractBoard, type KqRenewableAttempt,
} from "./kanab-quest-renewable-contracts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const offers: KqContractBoard["offers"] = [
  { code: "pure-grower", minimumQuality: 8, maxCardsUsed: 0, rewardCents: 1000 },
  { code: "steady-hand", minimumQuality: 10, maxCardsUsed: 2, rewardCents: 1500 },
  { code: "fine-flower", minimumQuality: 12, maxCardsUsed: null, rewardCents: 2000 },
];
const board: KqContractBoard = { version: 2, unlocked: true, canAccept: true, reason: null, offers, current: null, completedCount: 0 };
const accepted: KqRenewableAttempt = { ...offers[0], id, status: "accepted", runId: null, quality: null, cardsUsed: null, reason: null };
const succeeded: KqRenewableAttempt = { ...accepted, status: "succeeded", runId, quality: 8, cardsUsed: 0 };
const receipt: KqRenewableAttempt = { ...succeeded, status: "claimed", cashAfterCents: 101000 };

describe("renewable contract data boundary", () => {
  it("retains server thresholds and prizes, including an explicit unlimited card budget", () => {
    const adjusted = { ...board, offers: offers.map(offer => ({ ...offer, minimumQuality: offer.minimumQuality + 1, rewardCents: offer.rewardCents + 50 })) };
    expect(parseKqContractBoard(adjusted)).toEqual(adjusted);
    expect(parseKqContractBoard(board)?.offers[2].maxCardsUsed).toBeNull();
  });

  it.each([
    { version: 1 }, { unlocked: "true" }, { canAccept: 1 }, { reason: undefined }, { current: undefined },
    { completedCount: -1 }, { completedCount: 1.5 }, { offers: offers.slice(0, 2) },
    { offers: [offers[0], offers[0], offers[2]] },
    { offers: [offers[0], offers[1], { ...offers[2], code: "invented" }] },
    { offers: [offers[0], offers[1], { ...offers[2], rewardCents: 0 }] },
    { offers: [offers[0], offers[1], { ...offers[2], rewardCents: 2 ** 31 }] },
    { offers: [offers[0], offers[1], { ...offers[2], maxCardsUsed: undefined }] },
    { offers: [offers[0], offers[1], { ...offers[2], minimumQuality: NaN }] },
  ])("rejects malformed or incomplete boards: %j", patch => {
    expect(parseKqContractBoard({ ...board, ...patch })).toBeNull();
  });

  it("allows a locked board without manufacturing progress or acceptance", () => {
    const locked = { ...board, unlocked: false, canAccept: false };
    expect(parseKqContractBoard(locked)).toEqual(locked);
    for (const patch of [{ canAccept: true }, { current: accepted }, { completedCount: 1 }]) {
      expect(parseKqContractBoard({ ...locked, ...patch })).toBeNull();
    }
  });

  it("preserves unknown and negative active quality without declaring victory", () => {
    const active = { ...accepted, status: "active", runId };
    expect(parseKqRenewableAttempt(active)).toEqual(active);
    expect(parseKqRenewableAttempt({ ...active, quality: -2, cardsUsed: 0 })).toMatchObject({ quality: -2, cardsUsed: 0, status: "active" });
    expect(parseKqRenewableAttempt({ ...succeeded, status: "active" })?.status).toBe("active");
  });

  it.each([
    { id: "missing" }, { runId: null }, { quality: null }, { quality: 7 }, { quality: "8" },
    { quality: Infinity }, { cardsUsed: null }, { cardsUsed: 1 }, { cardsUsed: -1 },
    { cardsUsed: 0.5 }, { reason: undefined }, { status: "won" },
    { cashAfterCents: 101000 },
  ])("refuses an unproven or incoherent successful attempt: %j", patch => {
    expect(parseKqRenewableAttempt({ ...succeeded, ...patch })).toBeNull();
  });

  it("requires zero played cards for Au naturel but permits cards when the offer has no cap", () => {
    expect(parseKqRenewableAttempt(succeeded)).toEqual(succeeded);
    expect(parseKqRenewableAttempt({ ...succeeded, cardsUsed: 1 })).toBeNull();
    expect(parseKqRenewableAttempt({ ...succeeded, ...offers[2], quality: 12, cardsUsed: 6 })).toMatchObject({ status: "succeeded", cardsUsed: 6 });
  });

  it("does not attach a pre-start or cancelled attempt to a run or its metrics", () => {
    for (const status of ["accepted", "cancelled"]) {
      expect(parseKqRenewableAttempt({ ...accepted, status })).toMatchObject({ status });
      for (const patch of [{ runId }, { quality: 0 }, { cardsUsed: 0 }]) {
        expect(parseKqRenewableAttempt({ ...accepted, status, ...patch })).toBeNull();
      }
    }
  });

  it("permits no second acceptance while a contract is pending or succeeded", () => {
    for (const current of [accepted, { ...succeeded, status: "active" }, succeeded]) {
      expect(parseKqContractBoard({ ...board, current })).toBeNull();
    }
    expect(parseKqContractBoard({ ...board, current: receipt, completedCount: 1 })).not.toBeNull();
    expect(parseKqContractBoard({ ...board, current: receipt })).toBeNull();
  });

  it("strips unrelated private fields from its public projection", () => {
    const parsed = parseKqContractBoard({ ...board, userId: id, ledger: ["private"], offers: offers.map(offer => ({ ...offer, internalCost: 999 })) });
    expect(parsed).toEqual(board);
  });

  it("accepts a historical claim receipt alongside a newer current attempt", () => {
    const result = {
      board: { ...board, canAccept: false, completedCount: 1, current: { ...accepted, id: otherId } },
      receipt, replayed: true,
    };
    expect(parseKqContractBoardResult(result)).toEqual(result);
  });

  it("requires a confirmed payment receipt and coherent unlocked history", () => {
    const valid = { board: { ...board, completedCount: 1, current: receipt }, receipt, replayed: false };
    expect(parseKqContractBoardResult(valid)).toEqual(valid);
    for (const patch of [
      { receipt: succeeded }, { receipt: { ...receipt, cashAfterCents: undefined } },
      { receipt: { ...receipt, cashAfterCents: -1 } }, { replayed: undefined },
      { board: { ...board, unlocked: false, canAccept: false } },
      { board: { ...board, current: null } },
    ]) expect(parseKqContractBoardResult({ ...valid, ...patch })).toBeNull();
  });
});

describe("renewable contract commands", () => {
  it("keeps the same caller-generated attempt id for safe retries", () => {
    const command = { action: "accept", code: "steady-hand", attemptId: id };
    expect(parseKqRenewableCommand(command)).toEqual(command);
    expect(parseKqRenewableCommand(JSON.parse(JSON.stringify(command)))).toEqual(command);
    for (const action of ["cancel", "claim"]) {
      expect(parseKqRenewableCommand({ action, attemptId: id })).toEqual({ action, attemptId: id });
    }
  });

  it.each([
    null, [], {}, { action: "accept", code: "pure-grower" },
    { action: "accept", code: "light-hand", attemptId: id },
    { action: "accept", code: "constructor", attemptId: id },
    { action: "accept", code: "pure-grower", attemptId: "invalid" },
    { action: "claim", attemptId: id, code: "pure-grower" },
    { action: "claim", attemptId: id, userId: otherId },
    { action: "claim", attemptId: id, rewardCents: 999999 },
    { action: "claim", attemptId: id, quality: 100 },
    { action: "win", attemptId: id },
  ])("rejects commands that supply identity, outcome, money, or an undefined operation: %j", input => {
    expect(parseKqRenewableCommand(input)).toBeNull();
  });
});
