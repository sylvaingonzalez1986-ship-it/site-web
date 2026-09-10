import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getKqSituationArtwork,
  KQ_POWER_OUTAGE_ARTWORK,
  KQ_SITUATION_ARTWORK,
} from "@/lib/kanab-quest-situation-artwork";
import { KQ_SITUATIONS } from "@/lib/kanab-quest-game";

describe("Kanab Quest situation artwork", () => {
  it("ships one distinct local WebP for every situation and the outage", () => {
    const artwork = [...Object.values(KQ_SITUATION_ARTWORK), KQ_POWER_OUTAGE_ARTWORK];
    expect(artwork).toHaveLength(31);
    expect(new Set(artwork.map((item) => item.src)).size).toBe(31);
    artwork.forEach((item) => {
      expect(item.src.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", item.src.slice(1))), item.src).toBe(true);
      expect(item.alt.length).toBeGreaterThan(30);
    });
  });

  it.each(["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"])("covers every %s situation with dedicated artwork", (stage) => {
    const stageCodes = KQ_SITUATIONS
      .filter((situation) => situation.stage === stage)
      .map((situation) => situation.code);

    expect(stageCodes).toHaveLength(5);
    stageCodes.forEach((code) => expect(KQ_SITUATION_ARTWORK[code], code).toBeDefined());
  });

  it("covers the complete situation catalog without an extra or missing code", () => {
    const situationCodes = KQ_SITUATIONS.map((situation) => situation.code).sort();
    expect(situationCodes).toHaveLength(30);
    expect(Object.keys(KQ_SITUATION_ARTWORK).sort()).toEqual(situationCodes);
  });

  it("gives an active outage priority over the current incident", () => {
    expect(getKqSituationArtwork("SIT-021")?.src).toContain("facture-electricite");
    expect(getKqSituationArtwork("SIT-021", true)).toBe(KQ_POWER_OUTAGE_ARTWORK);
    expect(getKqSituationArtwork("SIT-001")?.src).toContain("depart-hesitant");
    expect(getKqSituationArtwork("SIT-999")).toBeNull();
  });
});
