import { describe, expect, it, vi } from "vitest";
import { advanceVillageDialogue, VILLAGE_NPC_INTERVENTIONS, type NpcDialogue } from "./village-npc-dialogue";

describe("authored village interventions", () => {
  it("keeps every exact Breton phrase and repetition in order", () => {
    expect(VILLAGE_NPC_INTERVENTIONS.breton.map(item => item.segments)).toEqual([
      ["Demat !"],
      ["Galette saucisse, je t’aiiimmeee ! J’en mangerais des kilos…", "Dans toute l’Ille-et-Vilaine…", "Avec du lait ribot…", "Et si tu m’abandonnes, alors je m’empoisonne avec des tripes de Caen et des rillettes du Maaaannnns !"],
      ["Blaaaaaanc sur Rouuuuuuuuge, rien ne bouuuuge ! Rouuuuge sur Blaaaaanc, tout fout le caaaaamp !"],
      ["C’est dans dix ans, je m’en irai…", "J’entends le loup et le renard chanter…", "C’est dans dix ans, je m’en irai…", "J’entends le loup et le renard chanter…", "J’entends le loup, le renard et la belette…", "J’entends le loup et le renard chanter…", "J’entends le loup, le renard et la belette…", "J’entends le loup et le renard chanter…", "C’est dans neuf ans, je m’en irai !"],
    ]);
  });

  it("keeps exact fisherman jokes, ellipses and final segments", () => {
    expect(VILLAGE_NPC_INTERVENTIONS.fisherman.map(item => item.segments)).toEqual([
      ["Horizon pas net, reste à la buvette."], ["Les Bretons ne sont pas têtus…", "Ils ont juste raison."],
      ["Qui pisse contre le vent se rince les dents."], ["En Bretagne, on n’a pas de montagnes…", "Mais on a une bonne descente…"],
      ["On boira du lait quand les vaches mangeront du raisin…"],
    ]);
  });

  it("advances one whole segment per activation and excludes the preceding intervention", () => {
    for (const id of ["breton", "fisherman"] as const) {
      for (let choice = 0; choice < VILLAGE_NPC_INTERVENTIONS[id].length; choice++) {
        let dialogue = advanceVillageDialogue(id, null, () => (choice + 0.01) / VILLAGE_NPC_INTERVENTIONS[id].length);
        const selected = dialogue.interventionId, segments = [...dialogue.segments];
        for (let segment = 0; segment < segments.length; segment++) {
          if (segment) dialogue = advanceVillageDialogue(id, dialogue, () => 0.99);
          expect(dialogue.interventionId).toBe(selected); expect(dialogue.segment).toBe(segment);
          expect(dialogue.text).toBe(segments[segment]); expect(dialogue.text.trim()).not.toBe("");
          expect(dialogue.readingMs).toBeGreaterThanOrEqual(4800);
        }
        expect(advanceVillageDialogue(id, dialogue, () => choice / 10).interventionId).not.toBe(selected);
        // Closing mid-song can retain its last state as memory without continuing it on reopen.
        expect(advanceVillageDialogue(id, { ...dialogue, segment: segments.length - 1 }, () => 0).interventionId).not.toBe(selected);
      }
    }
  });

  it("keeps independent NPC state and handles random boundaries", () => {
    let previous: NpcDialogue | undefined;
    for (const roll of [0, 1, -1, Number.NaN, Infinity]) {
      const next = advanceVillageDialogue("fisherman", previous, () => roll);
      expect(next.text).toBeTruthy(); expect(Number.isFinite(next.emphasis)).toBe(true);
      previous = { ...next, segment: next.segments.length - 1 };
    }
    const breton = advanceVillageDialogue("breton", null, () => 0.9);
    const fisherman = advanceVillageDialogue("fisherman", breton, () => 0);
    expect(fisherman.segment).toBe(0); expect(fisherman.interventionId).toBe("horizon");
    expect(breton.segment).toBe(0);
  });

  it("draws random only at the start of an intervention", () => {
    const random = vi.fn(() => 0.99);
    let dialogue = advanceVillageDialogue("breton", null, random);
    for (let i = 1; i < 9; i++) dialogue = advanceVillageDialogue("breton", dialogue, random);
    expect(random).toHaveBeenCalledTimes(1);
    advanceVillageDialogue("breton", dialogue, random);
    expect(random).toHaveBeenCalledTimes(2);
  });
});
