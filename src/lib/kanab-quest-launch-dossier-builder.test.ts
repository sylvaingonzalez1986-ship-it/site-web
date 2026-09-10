import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/admin/AdminPlacardLaunchDossierBuilder.tsx"),
  "utf8",
);

describe("Kanab Quest launch dossier builder policy", () => {
  it("covers every commercial section without mutating the server", () => {
    expect(source).toContain("5 sections prêtes");
    expect(source).toContain("PRIZE_TIERS.map");
    expect(source).toContain("KQ_LAUNCH_DOSSIER_ENV_KEY");
    expect(source).not.toContain("fetch(");
  });

  it("exports a reviewable artifact and warns that no approval is granted", () => {
    expect(source).toContain("Copier la variable");
    expect(source).toContain("Télécharger le JSON");
    expect(source).toContain("ne vaut pas approbation");
  });
});
