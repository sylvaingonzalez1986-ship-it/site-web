import { describe, expect, it, vi } from "vitest";
import { canActivateKqHeritage, KQ_CARDS } from "./kanab-quest-game";
import {
  canTrialContinue, createKqTrial, kqTrialStorageKey, reduceKqTrial,
  restoreKqTrial, trialCardPermission, trialQuality, trialRoutes, type KqTrialAction,
} from "./kanab-quest-trial";
import {
  createKqWorkshop, isKqWorkshopComplete, kqWorkshopStorageKey,
  KQ_WORKSHOPS, KQ_WORKSHOP_VERSION, reduceKqWorkshop, restoreKqWorkshop,
  type KqWorkshopId,
} from "./kanab-quest-workshops";

function playWorkshop(id: KqWorkshopId) {
  let state = createKqWorkshop(id);
  const actions: KqTrialAction[] = [];
  const act = (action: KqTrialAction) => {
    const next = reduceKqWorkshop(id, state, action);
    expect(next).not.toBe(state);
    state = next;
    actions.push(action);
  };
  switch (id) {
    case "cards":
      for (const value of ["buddie", "deck", "heritage"]) act({ type: "check", value });
      break;
    case "equipment":
      act({ type: "buy" });
      act({ type: "next" });
      for (const code of ["LED-300", "DRYING-ROOM", "SIFT-TRAY"]) act({ type: "install", code });
      act({ type: "mode", mode: "eco" });
      break;
    case "culture":
      for (let stage = 0; stage < 6; stage += 1) {
        if (stage === 0) act({ type: "play", code: "BOTTE-005" });
        if (stage === 2) act({ type: "play", code: "BOTTE-004" });
        if (stage >= 3) {
          const card = KQ_CARDS.find(item => trialCardPermission(state, item.code).allowed);
          if (card) act({ type: "play", code: card.code });
        }
        act({ type: "roll" });
        if (canActivateKqHeritage(state.game!).allowed) act({ type: "heritage" });
        if (stage === 2 && trialCardPermission(state, "BOTTE-002").allowed) act({ type: "play", code: "BOTTE-002" });
        act({ type: "resolve" });
        act({ type: "advance" });
      }
      break;
    case "jury":
      act({ type: "duel" });
      for (let round = 0; round < 3; round += 1) act({ type: "round" });
      break;
    case "market":
      expect(trialRoutes(state).find(route => route.route === "dry-sift")?.available).toBe(true);
      act({ type: "transform", route: "dry-sift" });
      for (const stock of state.commerce.stocks) act({ type: "sell", stockId: stock.id, channel: "wholesale", policy: "advised" });
      break;
  }
  expect(isKqWorkshopComplete(id, state)).toBe(false);
  expect(canTrialContinue(state)).toBe(true);
  act({ type: "next" });
  return { state, actions };
}

describe("independent fictitious Placard workshops", () => {
  it("provides valid prerequisites without completing or playing any selected workshop", () => {
    for (const workshop of KQ_WORKSHOPS) {
      const initial = restoreKqWorkshop(workshop.id, null);
      expect(initial.state.chapter).toBe(workshop.startChapter);
      expect(initial.actions).toEqual([]);
      expect(isKqWorkshopComplete(workshop.id, initial.state)).toBe(false);
      expect(initial.state.receipts).toEqual([]);
      expect(initial.state.game?.firstCultureRescue).toBeUndefined();
    }
    expect(createKqWorkshop("cards")).toMatchObject({ checked: ["notebook"], game: null, bought: false });
    expect(createKqWorkshop("equipment")).toMatchObject({ bought: false, installed: [], commerce: { cashCents: 200000 } });
    expect(createKqWorkshop("culture")).toMatchObject({ bought: true, game: { phase: "prepare", history: [] } });
    expect(createKqWorkshop("jury")).toMatchObject({ game: { phase: "complete" }, battle: null, rounds: 0 });
    const market = createKqWorkshop("market");
    expect(market.game?.history).toHaveLength(6);
    expect(market.rounds).toBe(3);
    expect(trialQuality(market)).toBeGreaterThan(0);
    expect(market.commerce.stocks).toEqual([]);
    expect(market.commerce.campaign).toBeNull();
  });

  for (const workshop of KQ_WORKSHOPS) {
    it(`completes ${workshop.id} only through its interactions and stops at its boundary`, () => {
      const initial = createKqWorkshop(workshop.id);
      expect(reduceKqWorkshop(workshop.id, initial, { type: "next" })).toBe(initial);
      const { state, actions } = playWorkshop(workshop.id);
      expect(actions.length).toBeGreaterThan(0);
      expect(state.chapter).toBe(workshop.endChapter + 1);
      expect(isKqWorkshopComplete(workshop.id, state)).toBe(true);
      for (const action of [{ type: "next" }, { type: "buy" }, { type: "roll" }, { type: "duel" }, { type: "wait" }] as KqTrialAction[]) {
        expect(reduceKqWorkshop(workshop.id, state, action)).toBe(state);
      }
    });

    it(`restores the ${workshop.id} action journal and partial progress on another day`, () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
        const { state, actions } = playWorkshop(workshop.id);
        const envelope = { version: KQ_WORKSHOP_VERSION, workshop: workshop.id, actions };
        const midway = Math.floor(actions.length / 2);
        const partial = restoreKqWorkshop(workshop.id, { ...envelope, actions: actions.slice(0, midway) });
        expect(partial.actions).toHaveLength(midway);
        expect(isKqWorkshopComplete(workshop.id, partial.state)).toBe(false);
        vi.setSystemTime(new Date("2027-03-09T19:42:00Z"));
        expect(restoreKqWorkshop(workshop.id, envelope)).toEqual({ state, actions });
        let continued = partial.state;
        for (const action of actions.slice(midway)) continued = reduceKqWorkshop(workshop.id, continued, action);
        expect(continued).toEqual(state);
      } finally {
        vi.useRealTimers();
      }
    });
  }

  it("keeps workshop storage separate by owner and lesson, preserving the guided v2 journal", () => {
    const actions: KqTrialAction[] = [{ type: "check", value: "notebook" }, { type: "next" }, { type: "check", value: "buddie" }];
    const guided = { version: 2, actions };
    const before = restoreKqTrial(guided);
    for (const workshop of KQ_WORKSHOPS) {
      const exercise = playWorkshop(workshop.id);
      restoreKqWorkshop(workshop.id, { version: 1, workshop: workshop.id, actions: exercise.actions });
      expect(kqWorkshopStorageKey("user-a", workshop.id)).not.toBe(kqTrialStorageKey("user-a"));
      expect(kqWorkshopStorageKey("user-a", workshop.id)).not.toBe(kqWorkshopStorageKey("discovery", workshop.id));
    }
    expect(new Set(KQ_WORKSHOPS.map(workshop => kqWorkshopStorageKey("discovery", workshop.id))).size).toBe(5);
    expect(restoreKqTrial(guided)).toEqual(before);
    expect(before.state.chapter).toBe(1);
    expect(before.state.checked).toEqual(["notebook", "buddie"]);
    expect(actions.reduce(reduceKqTrial, createKqTrial())).toEqual(before.state);
  });

  it("ignores supplied snapshots and rejects malformed, cross-workshop or impossible journals", () => {
    const empty = restoreKqWorkshop("cards", null);
    const { state, actions } = playWorkshop("cards");
    for (const value of [
      null, [], "snapshot", { version: 2, workshop: "cards", actions },
      { version: 1, workshop: "jury", actions },
      { version: 1, actions },
      { version: 1, workshop: "cards", actions: null },
      { version: 1, workshop: "cards", actions: new Array(501).fill({ type: "check", value: "deck" }) },
      { version: 1, workshop: "cards", actions: [null] },
      { version: 1, workshop: "cards", actions: ["next"] },
      { version: 1, workshop: "cards", actions: [{ type: "teleport", chapter: 9 }] },
      { version: 1, workshop: "cards", actions: [{ type: "next" }] },
      { version: 1, workshop: "cards", actions: [...actions, { type: "buy" }] },
    ]) expect(restoreKqWorkshop("cards", value)).toEqual(empty);
    expect(restoreKqWorkshop("cards", { version: 1, workshop: "cards", actions: [], state, cashCents: 99999999 })).toEqual(empty);
    expect(restoreKqWorkshop("cards", { version: 1, workshop: "cards", actions, state: { chapter: 0 } })).toEqual({ state, actions });
  });

  it("returns fresh states so one exercise cannot modify another exercise's supplies", () => {
    const first = createKqWorkshop("market");
    const second = createKqWorkshop("market");
    first.commerce.cashCents = 0;
    first.game!.history[0].total = 0;
    expect(second.commerce.cashCents).toBeGreaterThan(0);
    expect(second.game!.history[0].total).toBe(3);
    expect(createKqWorkshop("market")).toEqual(second);
  });
});
