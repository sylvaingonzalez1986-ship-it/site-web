import { describe, expect, it } from "vitest";
import { createVillageNpcTapGate } from "./village-npc-pointer";

describe("village NPC physical gestures", () => {
  it("consumes each completed touch once, allowing successive real touches", () => {
    const gate = createVillageNpcTapGate();
    for (let i = 0; i < 3; i++) {
      gate.down(1, 20, 20); gate.claim(1, "breton");
      expect(gate.consume("breton")).toBe(false);
      gate.up(1); expect(gate.consume("breton")).toBe(true);
      expect(gate.consume("breton")).toBe(false);
    }
  });
  it("rejects a drag returning to its start, pinch, cancellation and a different target", () => {
    const gate = createVillageNpcTapGate();
    gate.down(1, 20, 20); gate.claim(1, "breton"); gate.move(1, 40, 20); gate.move(1, 20, 20); gate.up(1);
    expect(gate.consume("breton")).toBe(false);
    gate.down(1, 20, 20); gate.claim(1, "fisherman"); gate.down(2, 21, 21); gate.up(2); gate.up(1);
    expect(gate.consume("fisherman")).toBe(false);
    gate.down(1, 20, 20); gate.claim(1, "loic"); gate.cancel(); gate.up(1);
    expect(gate.consume("loic")).toBe(false);
    gate.down(1, 20, 20); gate.claim(1, "loic"); gate.up(1);
    expect(gate.consume("breton")).toBe(false); expect(gate.consume("loic")).toBe(true);
  });
});
