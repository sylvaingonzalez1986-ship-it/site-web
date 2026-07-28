import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapKqStoredBattleRounds } from "@/lib/supabase/kanab-quest-backend";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725003200_kq_canonical_battle_rounds.sql"),
  "utf8",
);

const rounds = [{
  code: "visual-impact",
  label: "Impact visuel",
  explanation: "Test",
  playerScore: 82,
  opponentScore: 71,
  winner: "player" as const,
}];

describe("Kanab Quest canonical battle rounds", () => {
  it("stores player-one scores even when player two requested the verdict", () => {
    expect(migration).toContain("IF p_user_id = v_battle.player_two_id");
    expect(migration).toContain("'playerScore', round_value->'opponentScore'");
    expect(migration).toContain("'roundsStoredFrom', 'player_one'");
  });

  it("keeps player-one reads unchanged and inverts player-two reads", () => {
    expect(mapKqStoredBattleRounds(rounds, false)).toEqual(rounds);
    expect(mapKqStoredBattleRounds(rounds, true)).toEqual([{
      ...rounds[0],
      playerScore: 71,
      opponentScore: 82,
      winner: "opponent",
    }]);
  });

  it("round-trips the stored jury result without losing fields", () => {
    expect(mapKqStoredBattleRounds(mapKqStoredBattleRounds(rounds, true), true)).toEqual(rounds);
  });
});
