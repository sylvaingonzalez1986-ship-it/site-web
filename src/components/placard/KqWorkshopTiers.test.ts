import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { KqWorkshopTiers } from "./KqWorkshopTiers";

const expert = createChanvrierCareerSnapshot({ xp: 4500, completedCultures: 45 });
const render = (props: Partial<Parameters<typeof KqWorkshopTiers>[0]> = {}) => renderToStaticMarkup(createElement(KqWorkshopTiers, {
  code: "PRESS-0600", level: 0, cashCents: 1_000_000, career: expert, onUpdated: vi.fn(), ...props,
}));
describe("workshop tier offers", () => {
  it("offers three direct purchases with their complete prices", () => {
    const html = render();
    expect(html).toContain("Choisir économique"); expect(html).toContain("Choisir standard"); expect(html).toContain("Choisir haut de gamme");
    expect(html).toMatch(/850\s€/); expect(html).toMatch(/1\s360\s€/); expect(html).toMatch(/2\s635\s€/);
    expect(html).not.toMatch(/<button[^>]*disabled/);
    expect(html).not.toMatch(/Lowtemp|HiLyph|Resinator|Plasmastatic/);
  });
  it("credits existing levels and keeps acquired higher levels", () => {
    const intermediate = render({ level: 2 });
    expect(intermediate).toContain("Ta gamme actuelle"); expect(intermediate).toMatch(/425\s€/);
    expect(intermediate).not.toContain("Choisir économique");
    const high = render({ level: 9 });
    expect(high).toContain("Niveau actuel 9"); expect(high).toContain("416 g / lot"); expect(high).not.toContain("<button");
  });
  it("keeps career, cash and maintenance gates visible before payment", () => {
    expect(render({ cashCents: 0 })).toContain("Il manque");
    expect(render({ career: createChanvrierCareerSnapshot() })).toContain("Niveau métier");
    const broken = render({ level: 1, maintenanceDue: true });
    expect(broken).toContain("Entretiens la machine");
    expect(broken.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });
});
