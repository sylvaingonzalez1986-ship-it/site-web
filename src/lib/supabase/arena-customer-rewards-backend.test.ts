import { beforeEach, describe, expect, it, vi } from "vitest";
import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";
import type { ArenaCustomerRewardStanding } from "@/lib/arena-customer-rewards";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), leaderboard: vi.fn(), cache: new Map<string, Promise<unknown>>() }));
vi.mock("next/cache", () => ({
 unstable_cache: (loader: () => Promise<unknown>, keys: string[]) => () => {
  const key = keys.join(":"); if (!mocks.cache.has(key)) mocks.cache.set(key, loader()); return mocks.cache.get(key);
 }, revalidateTag: () => mocks.cache.clear(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqArenaLeaderboardInternal: mocks.leaderboard }));
import { freezeArenaCustomerRewardSeason, getArenaCustomerRewardPool, settleArenaCustomerRewards } from "./arena-customer-rewards-backend";
const standing = { playerId: "customer-1", leaderboardRank: 1, pseudo: "Camille", score: 900, rating: 1200, wins: 2, losses: 1 };
let status: string;
let snapshot: ArenaCustomerRewardStanding[] | null;
let grant: { gift_weight_grams: number; kind: string } | null;
let seasonRankingFormulaVersion: string | undefined;
beforeEach(() => {
 vi.clearAllMocks(); mocks.cache.clear(); status = "active"; snapshot = null; grant = null; seasonRankingFormulaVersion = undefined;
 mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "rpc_arena_refresh_customer_reward_pool" ? {seasonCode:"S1", status, poolGrams:100, minHumanBattles:3} : {executed:true} }));
 mocks.leaderboard.mockResolvedValue({ seasonCode:"S1", entries:[{...standing,userId:standing.playerId,rank:1}] });
 mocks.from.mockImplementation((table: string) => {
  const query = {select:vi.fn(),in:vi.fn(),order:vi.fn(),limit:vi.fn(),eq:vi.fn(),single:vi.fn(),maybeSingle:vi.fn()};
  for (const key of ["select","in","order","limit","eq"] as const) query[key].mockReturnValue(query);
  query.single.mockImplementation(async()=>({error:null,data:{standings_snapshot:snapshot,ranking_formula_version:seasonRankingFormulaVersion}}));
  query.maybeSingle.mockImplementation(async()=>({error:null,data:table === "arena_customer_reward_grants" ? grant : {season_code:"S1"}}));
  return query;
 });
});
describe("reward season data", () => {
 it("identifies the viewer by customer id and keeps estimates private", async () => {
  const personal = await getArenaCustomerRewardPool({viewerId:"customer-1"});
  expect(personal.viewer).toMatchObject({rank:1,battles:3,estimatedGrams:27});
  expect((await getArenaCustomerRewardPool()).viewer).toBeNull();
  expect(JSON.stringify(personal.topRewards)).not.toContain("customer-1");
 });
 it("reads a frozen ranking without refreshing a new season", async () => {
  status="frozen"; snapshot=[standing];
  const pool=await getArenaCustomerRewardPool({viewerId:"customer-1"});
  expect(pool.topRewards[0]).toMatchObject({pseudo:"Camille",estimatedGrams:27});
  expect(mocks.leaderboard).not.toHaveBeenCalled();
 });
 it("shows the actual grant after settlement, not a current projection", async () => {
  status="settled"; grant={gift_weight_grams:12,kind:"surprise"};
  const pool=await getArenaCustomerRewardPool({viewerId:"customer-1"});
  expect(pool.viewer?.grant).toEqual({grams:12,kind:"surprise"});
  expect(mocks.leaderboard).not.toHaveBeenCalled();
 });
 it("does not allocate a different season's ranking", async () => {
  mocks.leaderboard.mockResolvedValue({seasonCode:"S2",entries:[{...standing,userId:standing.playerId,rank:1}]});
  expect((await getArenaCustomerRewardPool()).topRewards).toEqual([]);
 });
 it("passes the standings to the transactional freeze", async () => {
  await freezeArenaCustomerRewardSeason(true);
  expect(mocks.leaderboard).toHaveBeenCalledWith({forceRefresh:true});
  expect(mocks.rpc).toHaveBeenCalledWith("rpc_arena_freeze_customer_reward_snapshot",{p_season_code:"S1",p_execute:true,p_standings:[standing]});
 });
 it("shares common reward calculations but keeps viewer projections separate", async () => {
  const first = await getArenaCustomerRewardPool({viewerId:"customer-1"});
  const second = await getArenaCustomerRewardPool({viewerId:"customer-2"});
  expect(first.viewer?.rank).toBe(1);
  expect(second.viewer?.rank).toBeNull();
  expect(mocks.rpc.mock.calls.filter(([name])=>name === "rpc_arena_refresh_customer_reward_pool")).toHaveLength(1);
  await getArenaCustomerRewardPool({fresh:true,viewerId:"customer-1"});
  expect(mocks.rpc.mock.calls.filter(([name])=>name === "rpc_arena_refresh_customer_reward_pool")).toHaveLength(2);
 });
 it("refuses to reconstruct a legacy frozen season when issuing rewards", async () => {
  status="frozen";
  await expect(settleArenaCustomerRewards(true)).rejects.toThrow("Aucun classement figé");
  expect(mocks.rpc.mock.calls.some(([name])=>name === "rpc_arena_settle_customer_rewards")).toBe(false);
 });

 it("marks a new tasting-only player eligible and gives tied players distinct public identifiers", async () => {
  mocks.leaderboard.mockResolvedValue({seasonCode:"S1",formulaVersion:ARENA_FORMULA_VERSION,entries:[
   {...standing,userId:"customer-1",rank:1,wins:0,losses:0,tastedFlowerCount:1,score:100},
   {...standing,userId:"customer-2",rank:1,wins:0,losses:0,tastedFlowerCount:1,score:100},
  ]});
  const pool=await getArenaCustomerRewardPool({viewerId:"customer-1"});
  expect(pool.rankingFormulaVersion).toBe(ARENA_FORMULA_VERSION);
  expect(pool.minimumTastedFlowers).toBe(1);
  expect(pool.viewer).toMatchObject({rank:1,battles:0,tastedFlowerCount:1,eligible:true,estimatedGrams:23});
  expect(pool.topRewards.map(entry=>entry.estimatedGrams)).toEqual([23,22]);
  expect(new Set(pool.topRewards.map(entry=>entry.entryKey)).size).toBe(2);
  expect(pool.topRewards[0]).toMatchObject({tiedPlayers:2,occupiedThroughRank:2,shareBps:2250});
  expect(JSON.stringify(pool.topRewards)).not.toContain("customer-");
 });

 it("stores the v3 scoring version and qualifying tastings in the transactional freeze", async () => {
  mocks.leaderboard.mockResolvedValue({seasonCode:"S1",formulaVersion:ARENA_FORMULA_VERSION,entries:[
   {...standing,userId:standing.playerId,rank:1,tastedFlowerCount:2,score:348.5},
  ]});
  await freezeArenaCustomerRewardSeason(true);
  expect(mocks.rpc).toHaveBeenCalledWith("rpc_arena_freeze_customer_reward_snapshot",{
   p_season_code:"S1",p_execute:true,p_standings:[{...standing,score:348.5,tastedFlowerCount:2,rankingFormulaVersion:ARENA_FORMULA_VERSION}],
  });
 });

 it("settles tied v3 snapshots with more than ten recipients without losing decimal scores or eligibility metadata", async () => {
  status="frozen";
  snapshot=Array.from({length:15},(_,index)=>({...standing,playerId:`customer-${String(index+1).padStart(2,"0")}`,score:1234.5,wins:0,losses:0,tastedFlowerCount:1,rankingFormulaVersion:ARENA_FORMULA_VERSION}));
  await settleArenaCustomerRewards(true);
  const settlement=mocks.rpc.mock.calls.find(([name])=>name==="rpc_arena_settle_customer_rewards")?.[1];
  expect(settlement.p_top_rewards).toHaveLength(15);
  expect(settlement.p_top_rewards.every((entry:{grams:number;score:number;shareBps:number})=>entry.grams===6&&entry.score===1234.5&&entry.shareBps===600)).toBe(true);
  expect(settlement.p_top_rewards[0]).toMatchObject({tastedFlowerCount:1,rankingFormulaVersion:ARENA_FORMULA_VERSION});
  expect(settlement.p_surprise_candidates).toEqual([]);
  expect(mocks.leaderboard).not.toHaveBeenCalled();
 });

 it("keeps old snapshots on duel eligibility even when they contain tasting-like metadata", async () => {
  status="frozen";snapshot=[{...standing,wins:0,losses:0,tastedFlowerCount:4}];
  const pool=await getArenaCustomerRewardPool({viewerId:standing.playerId});
  expect(pool.minimumTastedFlowers).toBeNull();
  expect(pool.viewer).toMatchObject({eligible:false,tastedFlowerCount:4,estimatedGrams:null});
  expect(pool.topRewards).toEqual([]);
  expect(mocks.leaderboard).not.toHaveBeenCalled();
 });

 it("retains frozen season eligibility metadata when its snapshot is empty", async () => {
  status="frozen";snapshot=[];seasonRankingFormulaVersion=ARENA_FORMULA_VERSION;
  const pool=await getArenaCustomerRewardPool();
  expect(pool.rankingFormulaVersion).toBe(ARENA_FORMULA_VERSION);
  expect(pool.minimumTastedFlowers).toBe(1);
  expect(mocks.leaderboard).not.toHaveBeenCalled();
 });

 it("omits thousands of zero-gram public projections while preserving a tied viewer's zero estimate", async () => {
  mocks.leaderboard.mockResolvedValue({seasonCode:"S1",formulaVersion:ARENA_FORMULA_VERSION,entries:
   Array.from({length:2500},(_,index)=>({...standing,userId:`customer-${String(index+1).padStart(4,"0")}`,rank:1,wins:0,losses:0,tastedFlowerCount:1,score:100}))
  });
  const pool=await getArenaCustomerRewardPool({viewerId:"customer-2500"});
  expect(pool.eligiblePlayers).toBe(2500);
  expect(pool.topRewards).toHaveLength(90);
  expect(pool.topRewards.every(entry=>entry.estimatedGrams===1&&entry.tiedPlayers===2500)).toBe(true);
  expect(pool.viewer).toMatchObject({rank:1,eligible:true,estimatedGrams:0});
  expect(pool.surpriseReward.eligiblePlayers).toBe(0);
 });
});
