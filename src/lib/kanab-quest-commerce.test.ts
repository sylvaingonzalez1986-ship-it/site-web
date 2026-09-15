import { describe, expect, it } from "vitest";
import { quoteKqCommerce, getKqCommerceReplenishment, getKqCommerceCapacity, type KqCommerceState, type KqCommerceStock, type KqCommerceOffer } from "./kanab-quest-commerce";
const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Test", route: "raw", batchRoute: "raw", juryScore: 9, initialUnits: 1200, remainingUnits: 1200, equivalentUnits: 1200, originalUnits: 1200, baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
const state: KqCommerceState = { revision: 0, cashCents: 100000, reputation: 1500, clients: 100, computerOwned: true, internetRenew: true,
  campaign: { id: "cycle", revision: 0, reputation: 1500, clientsStart: 100, event: "normal", internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 }, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} };
function consume(s: KqCommerceState, item: KqCommerceStock, q: KqCommerceOffer) {
  item.remainingUnits -= q.units; item.repExact = q.repExactAfter; item.repRounded = q.repRoundedAfter; item.payoutExact = q.payoutExactAfter; item.payoutRounded = q.payoutRoundedAfter;
  s.clients = q.clientsAfter; s.shopPartners=q.shopPartnersAfter; s.shopRecruitment=q.shopRecruitmentAfter; s.shopChurn=q.shopChurnAfter;
  if (s.campaign) { s.campaign.directUsed += q.directCost; s.campaign.shopUsed += q.shopCost; s.campaign.shopGoodUnits=q.shopGoodUnitsAfter; s.campaign.shopBadUnits=q.shopBadUnitsAfter; s.campaign.goodUnits = q.goodUnitsAfter; s.campaign.disappointmentUnits = q.disappointmentAfter; }
}
describe("Three sales channels", () => {
  it("keeps fractional shop progress at database precision after crossing a partner threshold", () => {
    const large = { ...stock, initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000 };
    for (const strength of [undefined, "merchant"] as const) {
      const fractional = { ...state, strength, shopPartners: 8, campaign: { ...state.campaign!, shopPartnersStart: 8, shopRecruitmentStart: 1000.1, shopChurnStart: 2000.1 } };
      const good = quoteKqCommerce(fractional, large, "cbd-shop");
      expect(good.shopRecruitmentAfter).toBe(1000.1);
      expect(good.shopPartnersAfter).toBe(strength === "merchant" ? 10 : 9);
      const bad = quoteKqCommerce(fractional, { ...large, juryScore: 6.5 }, "cbd-shop");
      expect(bad.shopChurnAfter).toBe(2000.1);
      expect(bad.shopPartnersAfter).toBe(6);
      expect(JSON.parse(JSON.stringify(good)).shopRecruitmentAfter).toBe(1000.1);
    }
  });

  it("distinguishes satisfaction from actual customer gains and losses", () => {
    expect(quoteKqCommerce(state, stock, "online", "advised", 200)).toMatchObject({ satisfaction: "satisfied", clientsBefore: 100, clientsAfter: 100 });
    expect(quoteKqCommerce(state, stock, "online")).toMatchObject({ satisfaction: "satisfied", clientsBefore: 100, clientsAfter: 103 });
    expect(quoteKqCommerce(state, { ...stock, juryScore: 7.5 }, "online")).toMatchObject({ satisfaction: "neutral", clientsAfter: 100 });
    expect(quoteKqCommerce(state, { ...stock, juryScore: 6 }, "online")).toMatchObject({ satisfaction: "disappointed", clientsBefore: 100, clientsAfter: 89 });
    expect(quoteKqCommerce(state, stock, "cbd-shop")).toMatchObject({ satisfaction: "satisfied", clientsAfter: 100 });
    expect(quoteKqCommerce(state, { ...stock, juryScore: 6.5 }, "cbd-shop")).toMatchObject({ satisfaction: "disappointed", clientsAfter: 100 });
    expect(quoteKqCommerce(state, { ...stock, juryScore: 0 }, "wholesale")).toMatchObject({ satisfaction: "not-applicable", clientsAfter: 100 });
  });
  it("prices shop quality and the frozen partner network without outranking direct sales", () => {
    const expected = [[6.5,40],[7,45],[8,50],[9,55]];
    for (const [juryScore,percent] of expected) {
      expect(quoteKqCommerce(state,{...stock,juryScore},"cbd-shop").shopPricePercent).toBe(percent);
      const established={...state,shopPartners:20,campaign:{...state.campaign!,shopPartnersStart:20}};
      const shop=quoteKqCommerce(established,{...stock,juryScore},"cbd-shop");
      expect(shop.shopPricePercent).toBe(percent+4);
      expect(shop.unitCents).toBeLessThan(quoteKqCommerce(established,{...stock,juryScore},"online","discovery").unitCents);
    }
    expect(quoteKqCommerce(state,{...stock,route:"dry-sift",juryScore:8.5},"cbd-shop").shopPricePercent).toBe(45);
    expect(quoteKqCommerce(state,{...stock,route:"dry-sift",juryScore:9},"cbd-shop").shopPricePercent).toBe(50);
    expect(quoteKqCommerce(state,{...stock,route:"dry-sift",juryScore:9.5},"cbd-shop").shopPricePercent).toBe(55);
  });
  it("carries small deliveries across cycles, caps recruitment and keeps prospecting possible", () => {
    const first=quoteKqCommerce(state,stock,"cbd-shop");
    expect(first).toMatchObject({shopPartnersAfter:0,shopRecruitmentAfter:4800});
    const next={...state,shopRecruitment:4800,campaign:{...state.campaign!,shopRecruitmentStart:4800}};
    expect(quoteKqCommerce(next,stock,"cbd-shop")).toMatchObject({shopPartnersAfter:1,shopRecruitmentAfter:3600});
    const large={...stock,initialUnits:10000,remainingUnits:10000,equivalentUnits:10000,originalUnits:10000};
    const full=quoteKqCommerce(state,large,"cbd-shop");
    expect(full.maxUnits).toBe(4000);expect(full.shopPartnersAfter).toBe(1);
    const established={...state,shopPartners:20,campaign:{...state.campaign!,shopPartnersStart:20}};
    expect(quoteKqCommerce(established,large,"cbd-shop")).toMatchObject({maxUnits:9000,shopPartnersAfter:20});
    expect(quoteKqCommerce(established,{...large,juryScore:6.5},"cbd-shop").shopPartnersAfter).toBe(15);
  });
  it("does not lose a whole partner for a tiny bad sale or increase prices by splitting a lot", () => {
    const established={...state,shopPartners:4,campaign:{...state.campaign!,shopPartnersStart:4}};
    const bad={...stock,juryScore:6.5};
    expect(quoteKqCommerce(established,bad,"cbd-shop","advised",1).shopPartnersAfter).toBe(4);
    const whole=quoteKqCommerce(established,bad,"cbd-shop");
    const s=structuredClone(established), item=structuredClone(bad);let income=0;
    for(let i=0;i<1200;i++){const q=quoteKqCommerce(s,item,"cbd-shop","advised",1);income+=q.payoutCents;consume(s,item,q);}
    expect(s.shopPartners).toBe(whole.shopPartnersAfter);expect(s.shopChurn).toBe(whole.shopChurnAfter);expect(income).toBe(whole.payoutCents);
    expect(quoteKqCommerce(s,stock,"cbd-shop").shopPricePercent).toBe(57);
    for(const channel of ["online","wholesale"] as const)expect(quoteKqCommerce(s,stock,channel).shopPartnersAfter).toBe(s.shopPartners);
  });
  it("has distinct professional tariffs independent of reputation and the chosen online price", () => {
    expect(quoteKqCommerce(state, stock, "cbd-shop").unitCents).toBe(99);
    expect(quoteKqCommerce(state, stock, "wholesale").unitCents).toBe(54);
    expect(quoteKqCommerce({ ...state, reputation: 0 }, stock, "cbd-shop", "premium").unitCents).toBe(99);
    expect(quoteKqCommerce({ ...state, reputation: 3000 }, stock, "wholesale", "premium").unitCents).toBe(54);
  });
  it("requires both the computer and a paid cycle online, with no such barrier for wholesalers", () => {
    expect(quoteKqCommerce({ ...state, computerOwned: false }, stock, "online").maxUnits).toBe(0);
    expect(quoteKqCommerce({ ...state, campaign: { ...state.campaign!, internetPaid: false } }, stock, "online").maxUnits).toBe(0);
    expect(quoteKqCommerce({ ...state, computerOwned: false, campaign: null }, stock, "wholesale").maxUnits).toBe(1200);
  });
  it("quotes poor raw flowers to wholesalers at the same price, without reputation", () => {
    const bad = { ...stock, juryScore: 0 };
    expect(quoteKqCommerce(state, bad, "online").maxUnits).toBe(0);
    expect(quoteKqCommerce(state, bad, "cbd-shop").maxUnits).toBe(0);
    expect(quoteKqCommerce(state, bad, "wholesale")).toMatchObject({ maxUnits: 1200, unitCents: 54, reputationDelta: 0 });
    expect(quoteKqCommerce(state, { ...stock, juryScore: 6.5 }, "cbd-shop").unitCents).toBe(72);
  });
  it("preserves premium prices at high reputation without guaranteeing all stock will sell", () => {
    const large = { ...stock, initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000 };
    const normal = quoteKqCommerce(state, large, "online", "premium");
    const weakMarket = { ...state, campaign: { ...state.campaign!, event: "promotion" }, ownVolumes: { raw: 10000 } };
    const saturated = quoteKqCommerce(weakMarket, large, "online", "premium");
    expect(saturated.unitCents).toBe(normal.unitCents);
    expect(saturated.maxUnits).toBeLessThan(normal.maxUnits);
    expect(normal.maxUnits).toBeLessThan(large.remainingUnits);
  });
  it("keeps the online unit price above the shop even at a low tariff in the worst market", () => {
    const saturated = { ...state, reputation: 0, ownVolumes: { raw: 10000 }, campaign: { ...state.campaign!, event: "promotion" } };
    for (const juryScore of [6.5, 7, 8, 9]) {
      const item = { ...stock, juryScore };
      expect(quoteKqCommerce(saturated, item, "online", "discovery").unitCents).toBeGreaterThan(quoteKqCommerce(saturated, item, "cbd-shop").unitCents);
    }
  });
  it("shares demand across all lots and policies; another listing cannot reset the quota", () => {
    const s = structuredClone({ ...state, campaign: { ...state.campaign!, reputation: 0, clientsStart: 0 } });
    const item = structuredClone(stock);
    const first = quoteKqCommerce(s, item, "online");
    consume(s, item, first);
    expect(quoteKqCommerce(s, { ...stock, id: "second" }, "online", "discovery").maxUnits).toBe(0);
    expect(quoteKqCommerce(s, item, "cbd-shop").maxUnits).toBeGreaterThan(0);
    expect(getKqCommerceCapacity(1500).baseUnits).toBe(2000);
  });
  it("does not create extra reputation, income or clients when splitting a sale", () => {
    for (const channel of ["online", "cbd-shop", "wholesale"] as const) {
      const whole = quoteKqCommerce(state, stock, channel, "advised", 300);
      const s = structuredClone(state), item = structuredClone(stock);
      let money = 0, reputation = 0;
      for (let i = 0; i < 300; i++) { const q = quoteKqCommerce(s, item, channel, "advised", 1); money += q.payoutCents; reputation += q.reputationDelta; consume(s, item, q); }
      expect(money).toBe(whole.payoutCents); expect(reputation).toBe(whole.reputationDelta);
      expect(s.clients).toBe(whole.clientsAfter);
    }
  });
  it("sums fractional cents across different channels and prices", () => {
    const s = structuredClone(state), item = { ...stock, baseUnitCents: 177.777777 };
    let exact = 0, paid = 0;
    for (let i = 0; i < 80; i++) {
      const q = quoteKqCommerce(s, item, i % 2 ? "online" : "cbd-shop", i % 3 ? "premium" : "discovery", 1);
      exact += q.unitCents / 10; paid += q.payoutCents; consume(s, item, q);
    }
    expect(paid).toBe(Math.round(exact));
  });
  it("weights customer losses by actual online volume, caps losses and preserves clients offline", () => {
    const bad = { ...stock, juryScore: 6 };
    const one = quoteKqCommerce(state, bad, "online", "advised", 1);
    const many = quoteKqCommerce(state, bad, "online");
    expect(one.clientsAfter).toBe(100);
    expect(many.clientsAfter).toBeLessThan(100);
    expect(many.clientsAfter).toBeGreaterThanOrEqual(75);
    expect(quoteKqCommerce(state, bad, "wholesale").clientsAfter).toBe(100);
    const s = structuredClone(state), item = structuredClone(bad); const units = many.units;
    for (let i = 0; i < units; i++) consume(s, item, quoteKqCommerce(s, item, "online", "advised", 1));
    expect(s.clients).toBe(many.clientsAfter);
  });
  it("keeps a prospect market at zero clients and caps client growth per campaign", () => {
    const s = { ...state, clients: 0, campaign: { ...state.campaign!, clientsStart: 0 } };
    const q = quoteKqCommerce(s, stock, "online");
    expect(q.maxUnits).toBeGreaterThan(0); expect(q.clientsAfter).toBeLessThanOrEqual(5);
  });
  it("compares concentrates using their input allocation and keeps returned stock units integral", () => {
    const hash = { ...stock, route: "dry-sift" as const, initialUnits: 216, remainingUnits: 216, baseUnitCents: 1600 };
    const q = quoteKqCommerce(state, hash, "cbd-shop", "advised", 108);
    expect(q.equivalentSold).toBe(600); expect(q.shopCost).toBe(600);
    expect(q.units).toBe(108); expect(Number.isSafeInteger(q.payoutCents)).toBe(true);
  });
});


describe("real-time shared demand", () => {
  const noon = Date.parse("2026-09-15T12:00:00Z");
  const hour = 3600000;
  const initial = () => ({ ...structuredClone(state), reputation: 312, clients: 0,
    campaign: { ...structuredClone(state.campaign!), reputation: 312, clientsStart: 0 },
    demand: { serverNow: new Date(noon).toISOString(), updatedAt: new Date(noon).toISOString(), onlineDebt: 1, shopDebt: 1, growthResetsAt: new Date(noon + 24 * hour).toISOString() } });
  const large = { ...stock, initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000 };
  it("refills online in four hours, shops in twelve, without completing a culture", () => {
    const account = initial();
    expect(quoteKqCommerce(account, large, "online").maxUnits).toBe(0);
    expect(quoteKqCommerce(account, large, "online", "advised", undefined, noon + hour).maxUnits).toBe(225);
    expect(quoteKqCommerce(account, large, "online", "advised", undefined, noon + 4 * hour).maxUnits).toBe(900);
    expect(quoteKqCommerce(account, large, "cbd-shop", "advised", undefined, noon + 6 * hour).maxUnits).toBe(2000);
    expect(quoteKqCommerce(account, large, "cbd-shop", "advised", undefined, noon + 12 * hour).maxUnits).toBe(4000);
  });
  it("caps offline accumulation, clamps backward time, and trusts the server timestamp by default", () => {
    const account = initial();
    expect(getKqCommerceReplenishment(account, "online", noon - hour)?.availableFraction).toBe(0);
    expect(getKqCommerceReplenishment(account, "online", noon + 240 * hour)?.availableFraction).toBe(1);
    account.demand.serverNow = new Date(noon + hour).toISOString();
    expect(getKqCommerceReplenishment(account, "online")?.remainingMs).toBe(3 * hour);
  });
  it("does not reset either balance when changing harvest or lot", () => {
    const account = initial();
    account.campaign.id = "another-harvest";
    account.campaign.directUsed = 0;
    for (const item of [large, { ...large, id: "another-lot", route: "dry-sift" as const }]) {
      expect(quoteKqCommerce(account, item, "online").units).toBe(0);
      expect(quoteKqCommerce(account, item, "cbd-shop").units).toBe(0);
    }
  });
  it("converts shared equivalent mass to transformed product units", () => {
    const account = initial();
    const hash = { ...large, route: "dry-sift" as const, initialUnits: 2000, remainingUnits: 2000 };
    expect(quoteKqCommerce(account, hash, "cbd-shop", "advised", undefined, noon + 6 * hour).units).toBe(400);
    expect(quoteKqCommerce(account, hash, "cbd-shop", "advised", undefined, noon + 6 * hour).shopCost).toBe(2000);
  });
  it("doubles merchant throughput without doubling refill speed a second time", () => {
    const account = { ...initial(), strength: "merchant" as const };
    expect(quoteKqCommerce(account, large, "online", "advised", undefined, noon + hour).units).toBe(450);
    expect(getKqCommerceReplenishment(account, "online", noon + hour)?.remainingMs).toBe(3 * hour);
  });
  it("preserves quality refusals and immediate wholesale with empty demand", () => {
    const account = initial();
    const poor = { ...large, juryScore: 4 };
    expect(quoteKqCommerce(account, poor, "online", "advised", undefined, noon + 24 * hour).units).toBe(0);
    expect(quoteKqCommerce(account, poor, "cbd-shop", "advised", undefined, noon + 24 * hour).units).toBe(0);
    expect(quoteKqCommerce(account, poor, "wholesale").units).toBe(large.remainingUnits);
  });
  it("keeps price and sale rounding stable as time passes for a fixed quantity", () => {
    const account = initial();
    const early = quoteKqCommerce(account, large, "online", "premium", 50, noon + hour);
    const later = quoteKqCommerce(account, large, "online", "premium", 50, noon + 2 * hour);
    expect(later.payoutCents).toBe(early.payoutCents);
    expect(later.directCost).toBe(early.directCost);
    expect(later.maxUnits).toBeGreaterThan(early.maxUnits);
  });
  it("retains the recruitment ceiling when orders refill within the same growth period", () => {
    const account = initial(); account.campaign.goodUnits = 900; account.clients = 5;
    account.campaign.shopGoodUnits = 6000; account.shopPartners = 1;
    const online = quoteKqCommerce(account, large, "online", "advised", undefined, noon + 4 * hour);
    const shops = quoteKqCommerce(account, large, "cbd-shop", "advised", undefined, noon + 12 * hour);
    expect(online.clientsAfter).toBe(5); expect(shops.shopPartnersAfter).toBe(1);
  });
});
