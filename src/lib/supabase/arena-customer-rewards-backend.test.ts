import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), leaderboard: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqArenaLeaderboardInternal: mocks.leaderboard }));
import { freezeArenaCustomerRewardSeason, getArenaCustomerRewardPool, settleArenaCustomerRewards } from "./arena-customer-rewards-backend";
const standing = { playerId: "customer-1", leaderboardRank: 1, pseudo: "Camille", score: 900, rating: 1200, wins: 2, losses: 1 };
let status: string;
let snapshot: typeof standing[] | null;
let grant: { gift_weight_grams: number; kind: string } | null;
beforeEach(() => {
 vi.clearAllMocks(); status = "active"; snapshot = null; grant = null;
 mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "rpc_arena_refresh_customer_reward_pool" ? {seasonCode:"S1", status, poolGrams:100, minHumanBattles:3} : {executed:true} }));
 mocks.leaderboard.mockResolvedValue({ seasonCode:"S1", entries:[{...standing,userId:standing.playerId,rank:1}] });
 mocks.from.mockImplementation((table: string) => {
  const query = {select:vi.fn(),in:vi.fn(),order:vi.fn(),limit:vi.fn(),eq:vi.fn(),single:vi.fn(),maybeSingle:vi.fn()};
  for (const key of ["select","in","order","limit","eq"] as const) query[key].mockReturnValue(query);
  query.single.mockImplementation(async()=>({error:null,data:{standings_snapshot:snapshot}}));
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
  expect(mocks.rpc).toHaveBeenCalledWith("rpc_arena_freeze_customer_reward_snapshot",{p_season_code:"S1",p_execute:true,p_standings:[standing]});
 });
 it("refuses to reconstruct a legacy frozen season when issuing rewards", async () => {
  status="frozen";
  await expect(settleArenaCustomerRewards(true)).rejects.toThrow("Aucun classement figé");
  expect(mocks.rpc.mock.calls.some(([name])=>name === "rpc_arena_settle_customer_rewards")).toBe(false);
 });
});
