import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => mocks }));
import { getKqPlayerBattle, getKqPlayerBattles, mapKqPlayerCoreSnapshot } from "./kanab-quest-backend";

type Row = Record<string, unknown>;
type Read = { table: string; columns: string; ids?: unknown[]; limit?: number };
const owner = "11111111-1111-4111-8111-111111111111";
const rival = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const date = (value: number) => new Date(Date.UTC(2026, 9, 1, 0, value)).toISOString();
const stats = { appearance: 70, aroma: 80, vigor: 65, mastery: 72, regularity: 68 };
const rounds = [{ code: "visual-impact", label: "Impact visuel", explanation: "Présentation", playerScore: 72, opponentScore: 68, winner: "player" }];
let rows: Record<string, Row[]>;
let reads: Read[];

function flower(value: number): Row {
  return {
    id: id(value), variety_name: `Fleur ${value}`, quality: 80, traits: ["dense"],
    battle_stats: stats, rules_version: 3, status: "burned", created_at: date(0),
    cannabinoid_report: { detail: "cannabinoid".repeat(300) },
    cultivation_profile: { detail: "cultivation".repeat(300) },
    terpene_report: { detail: "terpene".repeat(300) },
  };
}

function human(value: number, status = "verdict", playerOne = owner, playerTwo = rival) {
  const first = flower(value * 2 + 1000), second = flower(value * 2 + 1001);
  rows.kq_flowers.push(first, second);
  const battle = {
    id: id(value), player_one_id: playerOne, player_two_id: playerTwo,
    flower_one_id: first.id, flower_two_id: second.id, status, seed: 42,
    rounds: status === "verdict" ? rounds : [], winner_id: status === "verdict" ? playerOne : null,
    locked_at: date(value), verdict_at: status === "verdict" ? date(value + 1) : null,
  };
  rows.kq_battles.push(battle);
  return battle;
}

function bot(value: number, userId = owner) {
  const player = flower(value + 3000);
  rows.kq_flowers.push(player);
  const battle = {
    id: id(value), user_id: userId, flower_id: player.id, seed: 43, rounds,
    winner: "player", experience_awarded: 4, verdict_at: date(value),
    bot_flower: {
      id: `bot-${value}`, ownerName: "Bot", variety: "Bot fleur", tier: "Premium",
      status: "burned", createdAt: date(0), integrityCode: "BOT", traits: [], stats,
      rulesVersion: 3, cannabinoidReport: player.cannabinoid_report,
      cultivationProfile: player.cultivation_profile, terpeneReport: player.terpene_report,
    },
  };
  rows.kq_bot_battles.push(battle);
  return battle;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = { kq_battles: [], kq_bot_battles: [], kq_flowers: [] };
  reads = [];
  mocks.from.mockImplementation((table: string) => {
    const read: Read = { table, columns: "*" };
    const filters: Array<(row: Row) => boolean> = [];
    const ordering: Array<{ key: string; ascending: boolean }> = [];
    let single = false;
    const query = {
      select(columns: string) { read.columns = columns; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      neq(key: string, value: unknown) { filters.push(row => row[key] !== value); return query; },
      or(value: string) {
        const terms = value.split(",").map(term => term.split(".eq."));
        filters.push(row => terms.some(([key, expected]) => row[key] === expected));
        return query;
      },
      in(key: string, values: unknown[]) {
        read.ids = values;
        filters.push(row => values.includes(row[key]));
        return query;
      },
      order(key: string, options: { ascending: boolean }) { ordering.push({ key, ...options }); return query; },
      limit(limit: number) { read.limit = limit; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve: (value: unknown) => unknown) {
        reads.push(read);
        const selected = (rows[table] ?? []).filter(row => filters.every(filter => filter(row)))
          .sort((left, right) => {
            for (const { key, ascending } of ordering) {
              const comparison = String(left[key]).localeCompare(String(right[key]));
              if (comparison) return ascending ? comparison : -comparison;
            }
            return 0;
          })
          .slice(0, read.limit ?? Infinity)
          .map(row => Object.fromEntries(read.columns.split(",").map(key => [key, row[key]])));
        return Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }).then(resolve);
      },
    };
    return query;
  });
});

describe("bounded official battle history", () => {
  it("returns the latest 25 human and bot fights together and hydrates only their Flowers", async () => {
    for (let value = 1; value <= 60; value++) {
      if (value % 2) human(value);
      else bot(value);
    }
    human(500, "verdict", outsider, rival);
    bot(501, outsider);

    const history = await getKqPlayerBattles(owner);
    expect(history.map(battle => battle.id)).toEqual(Array.from({ length: 25 }, (_, index) => id(60 - index)));
    expect(history.some(battle => battle.opponentType === "human")).toBe(true);
    expect(history.some(battle => battle.opponentType === "bot")).toBe(true);
    const flowerReads = reads.filter(read => read.table === "kq_flowers");
    expect(flowerReads).toHaveLength(1);
    expect(new Set(flowerReads[0].ids)).toEqual(new Set(history.flatMap(battle => (
      battle.opponentType === "human"
        ? [battle.playerFlower.id, battle.opponentFlower.id]
        : [battle.playerFlower.id]
    ))));
    expect(flowerReads[0].columns).not.toMatch(/cannabinoid_report|cultivation_profile|terpene_report/);
    expect(JSON.stringify(history)).not.toMatch(/cannabinoidReport|cultivationProfile|terpeneReport/);
    expect(history[0].rounds).toEqual(rounds);
    expect(history[0].playerFlower.stats).toEqual(stats);
    expect(history[0].experienceAwarded).toBe(4);
    expect(rows.kq_battles).toHaveLength(31);
    expect(rows.kq_bot_battles).toHaveLength(31);
  });

  it("keeps old pending verdicts outside the archive cap, including player-two duels", async () => {
    human(1, "locked", rival, owner);
    human(2, "locked", outsider, rival);
    for (let value = 10; value < 40; value++) bot(value);

    const history = await getKqPlayerBattles(owner);
    expect(history.filter(battle => battle.status !== "locked")).toHaveLength(25);
    expect(history.filter(battle => battle.status === "locked")).toMatchObject([{
      id: id(1), playerFlower: { id: id(1003) }, opponentFlower: { id: id(1002) },
      rounds: [], winner: null, experienceAwarded: 0,
    }]);
  });

  it("honors a smaller bootstrap budget and uses deterministic ordering for ties", async () => {
    const first = human(10), second = bot(11);
    second.verdict_at = first.verdict_at!;
    for (let value = 1; value < 10; value++) bot(value);
    expect((await getKqPlayerBattles(owner, 3)).map(battle => battle.id)).toEqual([id(11), id(10), id(9)]);
  });

  it("includes a just-resolved older lock among the latest verdicts", async () => {
    const oldLock = human(1);
    oldLock.verdict_at = date(100);
    for (let value = 10; value < 70; value++) human(value);
    human(90, "cancelled");
    const history = await getKqPlayerBattles(owner);
    expect(history).toHaveLength(25);
    expect(history[0]).toMatchObject({ id: id(1), verdictAt: date(100) });
    expect(history[1]).toMatchObject({ id: id(90), status: "cancelled" });
  });

  it("retains cancelled outcomes and correctly inverts player-two scores", async () => {
    human(1, "verdict", rival, owner);
    human(2, "cancelled");
    const history = await getKqPlayerBattles(owner);
    expect(history[0]).toMatchObject({ status: "cancelled", winner: null, rounds: [], experienceAwarded: 0 });
    expect(history[1]).toMatchObject({
      winner: "opponent", playerFlower: { id: id(1003) },
      rounds: [{ playerScore: 68, opponentScore: 72, winner: "opponent" }],
    });
  });

  it("keeps full reports and direct access to older owned battles for the verdict engine", async () => {
    human(1, "locked");
    for (let value = 10; value < 40; value++) bot(value);
    const detail = await getKqPlayerBattle(owner, id(1));
    expect(detail?.playerFlower).toHaveProperty("cannabinoidReport");
    expect(detail?.playerFlower).toHaveProperty("cultivationProfile");
    expect(detail?.playerFlower).toHaveProperty("terpeneReport");
    expect(await getKqPlayerBattle(outsider, id(1))).toBeNull();
  });

  it("does not hydrate Flowers for an empty history and rejects oversized history requests", async () => {
    expect(await getKqPlayerBattles(owner)).toEqual([]);
    expect(reads.some(read => read.table === "kq_flowers")).toBe(false);
    const previousReads = reads.length;
    for (const limit of [0, 26, 1.5, NaN]) {
      await expect(getKqPlayerBattles(owner, limit)).rejects.toThrow("Limite de duels invalide.");
    }
    expect(reads).toHaveLength(previousReads);
  });

  it("loads the frozen harvest version and success evidence for history and verdict reads", async () => {
    human(1);
    Object.assign(rows.kq_flowers[0], { quality: 26, harvest_tier_version: 2, successful_stages: 3, critical_stages: 3 });
    Object.assign(rows.kq_flowers[1], { quality: 14 });
    const history = await getKqPlayerBattles(owner);
    const detail = await getKqPlayerBattle(owner, id(1));
    for (const battle of [history[0], detail!]) {
      expect(battle.playerFlower).toMatchObject({ tier: "Fleur exceptionnelle", harvestTierVersion: 2, successfulStages: 3, criticalStages: 3 });
      expect(battle.opponentFlower.tier).toBe("Fleur légendaire");
    }
  });

  it("keeps the initial snapshot at 12 archived fights plus received pending verdicts, without analysis reports", () => {
    const archived = Array.from({ length: 15 }, (_, index) => {
      const battle = bot(index + 10);
      return {
        id: battle.id, seed: battle.seed, playerFlower: flower(index + 3010),
        opponentFlower: battle.bot_flower, rounds, winner: "player", experienceAwarded: 4,
        lockedAt: battle.verdict_at, verdictAt: battle.verdict_at,
      };
    });
    const pending = { id: id(1), status: "locked", seed: 42, playerFlower: flower(1002),
      opponentFlower: flower(1003), rounds: [], winner: null, lockedAt: date(1), verdictAt: null };
    const snapshot = mapKqPlayerCoreSnapshot({ humanBattles: [pending], botBattles: archived });
    expect(snapshot.battles.filter(battle => battle.status !== "locked")).toHaveLength(12);
    expect(snapshot.battles.find(battle => battle.id === id(1))).toMatchObject({ status: "locked" });
    expect(JSON.stringify(snapshot.battles)).not.toMatch(/cannabinoidReport|cultivationProfile|terpeneReport/);
  });
});
