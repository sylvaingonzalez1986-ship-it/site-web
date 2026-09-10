import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(
  process.cwd(),
  "supabase/migrations/20260905000200_kq_random_duel_queue.sql",
), "utf8");
const fairnessMigration = readFileSync(join(
  process.cwd(),
  "supabase/migrations/20260905000300_kq_random_duel_queue_fairness.sql",
), "utf8");
const openMatchingMigration = readFileSync(join(
  process.cwd(),
  "supabase/migrations/20260906000200_kq_random_duel_open_matching.sql",
), "utf8");
const playerRoute = readFileSync(join(
  process.cwd(),
  "src/app/api/arena/placard/battles/route.ts",
), "utf8");
const gameUi = readFileSync(join(
  process.cwd(),
  "src/components/placard/KanabQuestDicePrototype.tsx",
), "utf8");

describe("Kanab Quest random duel queue", () => {
  it("allows only one anonymous waiting Flower per player", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_random_battle_queue");
    expect(migration).toContain("flower_id UUID PRIMARY KEY");
    expect(migration).toContain("owner_id UUID NOT NULL UNIQUE");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.kq_random_battle_queue FROM PUBLIC, anon, authenticated");
  });

  it("selects and claims a compatible opponent atomically at random", () => {
    expect(fairnessMigration).toContain("ORDER BY random()");
    expect(fairnessMigration).toContain("FOR UPDATE OF queue_entry, candidate_flower SKIP LOCKED");
    expect(fairnessMigration).toContain("abs(candidate_flower.quality - v_flower.quality) <= 8");
    expect(fairnessMigration).toContain("now() - INTERVAL '24 hours'");
    expect(fairnessMigration).toContain("'matchStatus', 'queued'");
    expect(fairnessMigration).toContain("'matchStatus', 'matched'");
  });

  it("prevents starvation while preserving a random opponent", () => {
    const oldestPoolIndex = fairnessMigration.indexOf("ORDER BY queue_entry.queued_at ASC");
    const poolLimitIndex = fairnessMigration.indexOf("LIMIT 12", oldestPoolIndex);
    const randomDrawIndex = fairnessMigration.indexOf("ORDER BY random()", poolLimitIndex);
    expect(fairnessMigration).toContain("WITH candidate_pool AS MATERIALIZED");
    expect(oldestPoolIndex).toBeGreaterThan(0);
    expect(poolLimitIndex).toBeGreaterThan(oldestPoolIndex);
    expect(randomDrawIndex).toBeGreaterThan(poolLimitIndex);
  });

  it("matches any two distinct waiting players and retries durable queue entries", () => {
    expect(openMatchingMigration).toContain("queue_entry.owner_id <> p_player_id");
    expect(openMatchingMigration).not.toContain("candidate_flower.quality");
    expect(openMatchingMigration).not.toContain("recent_battle");
    expect(openMatchingMigration).toContain("v_was_queued := TRUE");
    expect(openMatchingMigration).toContain("WHERE flower_id = v_flower.id AND owner_id = p_player_id");
    expect(openMatchingMigration).toContain("ORDER BY random()");
  });

  it("allows withdrawal only before a battle claims the Flower", () => {
    const leaveFunction = migration.slice(migration.indexOf("rpc_kq_leave_random_battle_queue"));
    expect(leaveFunction).toContain("kq_random_queue_already_matched");
    expect(leaveFunction).toContain("SET status = 'available', locked_at = NULL");
    expect(leaveFunction).toContain("status = 'locked'");
  });

  it("accepts only one Flower id from the player and removes manual rival selection", () => {
    expect(playerRoute).toContain("enqueueKqPlayerRandomBattle(session.customerId, flowerId)");
    expect(playerRoute).not.toContain("rivalFlowerId");
    expect(gameUi).toContain("Duel aléatoire");
    expect(gameUi).toContain("Le serveur choisira au hasard une Fleur appartenant à un autre joueur");
    expect(gameUi).toContain("pollKqRemoteRandomBattleQueue");
    expect(gameUi).toContain("quelle que soit sa qualité");
    expect(gameUi).not.toContain("compatible à ±8 qualité");
    expect(gameUi).not.toContain("selectedRivalId");
    expect(gameUi).not.toContain("Défier {selectedRival.name}");
  });
});
