import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260901000200_kq_culture_card_artwork_v2.sql",
), "utf8");

describe("Kanab Quest culture artwork migration", () => {
  it("publishes the three renamed V2 card fronts", () => {
    expect(migration).toContain("botte-007-hydroponie-recirculante-front-v2.webp");
    expect(migration).toContain("botte-008-aeroponie-haute-pression-front-v2.webp");
    expect(migration).toContain("botte-021-engrais-bio-complet-front-v2.webp");
    expect(migration).toContain("UPDATE public.lottery_card_definitions");
  });
});
