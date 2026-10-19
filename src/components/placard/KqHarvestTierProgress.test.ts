import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getKqHarvestTierProgress } from "@/lib/kanab-quest-harvest-tiers";
import { KqHarvestTierProgress } from "./KqHarvestTierProgress";

function render(quality: number, successfulStages: number, criticalStages: number, harvestTierVersion?: 2, remainingStages = 6) {
  const projection = {
    ...getKqHarvestTierProgress(quality, { harvestTierVersion, successfulStages, criticalStages }),
    successfulStages,
    criticalStages,
    remainingStages,
  };
  return renderToStaticMarkup(createElement(KqHarvestTierProgress, { projection }));
}

describe("remaining harvest tier requirements", () => {
  it("keeps legendary progress open when quality is sufficient but performance is not", () => {
    const html = render(26, 3, 1, 2);
    expect(html).toContain("Prochain palier : Fleur légendaire.");
    expect(html).toContain("Qualité requise atteinte.");
    expect(html).toContain("Étapes réussies : 3/4 (encore 1)");
    expect(html).toContain("Critiques : 1/2 (encore 1)");
    expect(html).toContain("Une étape critique compte aussi comme réussie.");
    expect(html).not.toContain("Palier maximal atteint");
  });

  it("shows both quality and critical-stage requirements before the last tier", () => {
    const html = render(20, 4, 0, 2);
    expect(html).toContain("Encore 6 points de Qualité.");
    expect(html).toContain("Étapes réussies : 4/4 (atteint)");
    expect(html).toContain("Critiques : 0/2 (encore 2)");
  });

  it("describes missing conditions as final when no stage remains", () => {
    const html = render(26, 3, 1, 2, 0);
    expect(html).toContain("Culture terminée : palier Fleur légendaire non atteint.");
    expect(html).toContain("Qualité requise atteinte.");
    expect(html).toContain("Étapes réussies : 3/4 (il manquait 1)");
    expect(html).toContain("Critiques : 1/2 (il manquait 1)");
    expect(html).not.toContain("Prochain palier");
    expect(html).not.toContain("encore");
    expect(html).not.toContain("Palier maximal atteint");
  });

  it("announces the highest tier only once all modern conditions are satisfied", () => {
    expect(render(26, 4, 2, 2)).toBe("Palier maximal atteint.");
  });

  it("keeps the archived scale free from modern performance conditions", () => {
    expect(render(14, 0, 0)).toBe("Palier maximal atteint.");
    const html = render(10, 0, 0);
    expect(html).toContain("Encore 4 points de Qualité.");
    expect(html).not.toContain("Étapes réussies");
  });
});
