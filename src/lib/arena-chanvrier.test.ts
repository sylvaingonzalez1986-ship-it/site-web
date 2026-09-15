import { describe, expect, it } from "vitest";
import { parseChanvrierProfile, getChanvrierStartingXp, CHANVRIER_STRENGTHS } from "./arena-chanvrier";
import { startKqGame, KQ_BUDDIES } from "./kanab-quest-game";
import { getKqMachineCondition } from "./kanab-quest-maintenance";
import { quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";
const profile = { nickname: "Chanvrier29", gender: "female", skin: "brown", clothing: "teal", strength: "green-thumb" };
const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Lot", route: "raw", batchRoute: "raw", juryScore: 9, initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000, baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
const state: KqCommerceState = { revision: 0, cashCents: 100000, reputation: 200, clients: 20, computerOwned: true, internetRenew: true,
  campaign: { id: "cycle", revision: 0, reputation: 200, clientsStart: 20, event: "normal", internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 }, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} };
describe("chanvrier choices and benefits", () => {
  it("accepts only the four strengths and curated appearance, without trusting extra fields", () => {
    for (const choice of CHANVRIER_STRENGTHS) expect(parseChanvrierProfile({ ...profile, strength: choice.code, cash: 999999, userId: "someone" })).toEqual({ ...profile, strength: choice.code });
    for (const change of [{ nickname: "<script>" }, { nickname: "aa" }, { gender: "unknown" }, { strength: "all" }, { skin: "url(x)" }, { clothing: "red" }]) expect(parseChanvrierProfile({ ...profile, ...change })).toBeNull();
  });
  it("adds four XP to every Buddie rarity without changing its existing XP bonus", () => {
    for (const buddie of KQ_BUDDIES) {
      const normal = startKqGame(15, { varietyCode: buddie.code, startingXp: 1 });
      const boosted = startKqGame(15, { varietyCode: buddie.code, startingXp: 1 + getChanvrierStartingXp("green-thumb") });
      expect(boosted.xp).toBe(normal.xp + 4);
      expect(normal.xp).toBe(1 + buddie.advantageLevel);
    }
    expect(getChanvrierStartingXp("treasurer")).toBe(0);
  });
  it("doubles sales capacity, not the price per gram, and retains quality refusals", () => {
    for (const channel of ["online", "cbd-shop"] as const) {
      const usual = quoteKqCommerce(state, stock, channel);
      const boosted = quoteKqCommerce({ ...state, strength: "merchant" }, stock, channel);
      expect(boosted.maxUnits).toBeGreaterThanOrEqual(usual.maxUnits * 2);
      expect(boosted.unitCents).toBe(usual.unitCents);
      expect(quoteKqCommerce({ ...state, strength: "merchant" }, { ...stock, juryScore: 3 }, channel).maxUnits).toBe(0);
    }
    expect(quoteKqCommerce({ ...state, strength: "merchant" }, stock, "wholesale")).toEqual(quoteKqCommerce(state, stock, "wholesale"));
  });
  it("recruits twice as fast for an identical good delivery and does not protect bad quality", () => {
    const online = quoteKqCommerce(state, stock, "online", "advised", 180);
    const commercial = quoteKqCommerce({ ...state, strength: "merchant" }, stock, "online", "advised", 180);
    expect(commercial.clientsAfter - state.clients).toBe(2 * (online.clientsAfter - state.clients));
    expect(quoteKqCommerce({ ...state, strength: "merchant" }, stock, "cbd-shop").shopPartnersAfter).toBe(2);
    for (const strength of [undefined, "merchant"] as const) expect(quoteKqCommerce({ ...state, strength }, { ...stock, juryScore: 6 }, "online", "advised").clientsAfter).toBeLessThan(state.clients);
  });
  it("does not reward splitting good shop deliveries into many transactions", () => {
    const whole = quoteKqCommerce({ ...state, strength: "merchant" }, stock, "cbd-shop", "advised", 1000);
    const partial = structuredClone({ ...state, strength: "merchant" as const });
    let last = whole;
    for (let n = 0; n < 10; n++) {
      last = quoteKqCommerce(partial, stock, "cbd-shop", "advised", 100);
      partial.shopPartners = last.shopPartnersAfter; partial.shopRecruitment = last.shopRecruitmentAfter;
      partial.campaign!.shopGoodUnits = last.shopGoodUnitsAfter; partial.campaign!.shopUsed += last.shopCost;
    }
    expect(last.shopPartnersAfter).toBe(whole.shopPartnersAfter);
    expect(last.shopRecruitmentAfter).toBe(whole.shopRecruitmentAfter);
  });
});
describe("machine maintenance", () => {
  it("stops standard machines at 10 cycles and improved machines at 20", () => {
    expect(getKqMachineCondition("PRESS-0600", 1, 9)).toMatchObject({ remaining: 1, due: false });
    expect(getKqMachineCondition("PRESS-0600", 1, 10)).toMatchObject({ remaining: 0, due: true });
    expect(getKqMachineCondition("PRESS-0600", 5, 19)).toMatchObject({ remaining: 1, due: false });
    expect(getKqMachineCondition("PRESS-0600", 5, 20)).toMatchObject({ remaining: 0, due: true });
    expect(getKqMachineCondition("FREEZE-DRYER", 1, 19)?.interval).toBe(20);
    expect(getKqMachineCondition("LED-300", 1, 15)).toBeNull();
    expect(getKqMachineCondition("SIFT-TRAY", 1, 15)).toBeNull();
  });
  it("makes the same repair free for the handyperson and keeps wear", () => {
    const normal = getKqMachineCondition("PRESS-0600", 1, 10, 3)!;
    const free = getKqMachineCondition("PRESS-0600", 1, 10, 3, "handyperson");
    expect(normal.repairCents).toBe(5100);
    expect(free).toEqual({ ...normal, repairCents: 0 });
    expect(getKqMachineCondition("FREEZE-DRYER", 10, 20)?.repairCents).toBe(20000);
  });
});
