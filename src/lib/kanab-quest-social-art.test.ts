import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getKqSocialArtwork, getKqSocialProducerArtwork, KQ_SOCIAL_ARTWORK } from "./kanab-quest-social-art";
import { KQ_SOCIAL_V2_SCENARIOS as KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";

const revisedScenes = new Set(["ig-first-frame", "ig-comment", "ig-collab", "ig-return", "ig-demand", "ig-identity", "ig-open-house", "ig-creative-call", "ig-live-glitch"]);

describe("archived illustrations and observed producer subjects", () => {
  it("maps each real situation to one distinct local illustration and truthful background description", () => {
    expect(KQ_SOCIAL_SCENARIOS).toHaveLength(54);
    expect(Object.keys(KQ_SOCIAL_ARTWORK).sort()).toEqual(KQ_SOCIAL_SCENARIOS.map(scene => scene.id).sort());
    const paths = new Set<string>(), descriptions = new Set<string>(), placements = new Set<string>();
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const art = getKqSocialArtwork(scene.id)!;
      expect(art, scene.id).toEqual(KQ_SOCIAL_ARTWORK[scene.id]);
      expect(Object.keys(art).sort()).toEqual(["alt", "playerPlacement", "src"]);
      expect(art.src).toBe(`/app/kanab-quest/social/scenes/${scene.id}${revisedScenes.has(scene.id) ? "-cbd-v2" : ""}.webp`);
      expect(art.alt.length, scene.id).toBeGreaterThan(30);
      expect(art.alt.length).toBeLessThan(500);
      expect(art.alt).not.toMatch(/Sylvain|\{\{|https?:|image générée|placeholder/i);
      expect(["left", "center", "none"]).toContain(art.playerPlacement);
      paths.add(art.src);descriptions.add(art.alt);placements.add(art.playerPlacement);
    }
    expect(paths.size).toBe(54);
    expect(descriptions.size).toBe(54);
    expect([...placements].sort()).toEqual(["center", "left", "none"]);
  });

  it("does not borrow another situation's illustration for unknown or inherited object keys", () => {
    for (const id of ["", "unknown-scene", "ig-first-frame.webp", "../../workshop", "toString", "constructor", "__proto__"]) {
      expect(getKqSocialArtwork(id), id).toBeUndefined();
    }
  });

  it("keeps all 54 archived pictures and the neutral producer scene within the asset budgets", async () => {
    const files = await readdir(resolve(process.cwd(), "public/app/kanab-quest/social/scenes"));
    const sources = [...KQ_SOCIAL_SCENARIOS.map(scene => ({ id: scene.id, ...getKqSocialArtwork(scene.id)! })), { id: "producer-journal", ...getKqSocialProducerArtwork() }];
    expect(files.filter(file => file.endsWith(".webp")).sort()).toEqual(sources.map(source => source.src.split("/").at(-1)).sort());
    const evidence = await Promise.all(sources.map(async scene => {
      const source = scene;
      const file = await readFile(resolve(process.cwd(), `public${source.src}`));
      const metadata = await sharp(file).metadata();
      expect(metadata.format, scene.id).toBe("webp");
      expect(metadata.width, scene.id).toBeGreaterThanOrEqual(512);
      expect(metadata.width, scene.id).toBeLessThanOrEqual(1024);
      expect(metadata.height, scene.id).toBe(metadata.width);
      const pixels = await sharp(file).removeAlpha().raw().toBuffer();
      expect(file.byteLength, `${scene.id} stays below 180 kB`).toBeLessThan(180_000);
      return { bytes: file.byteLength, file: createHash("sha256").update(file).digest("hex"), pixels: createHash("sha256").update(pixels).digest("hex") };
    }));
    expect(new Set(evidence.map(item => item.file)).size).toBe(55);
    expect(new Set(evidence.map(item => item.pixels)).size).toBe(55);
    expect(evidence.reduce((sum, item) => sum + item.bytes, 0)).toBeLessThan(8_000_000);
  }, 60_000);
});
