import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWorkshopTierPrice } from "@/lib/kanab-quest-workshop-machines";
import retail from "@/lib/kanab-quest-workshop-retail.json";
import { KqWorkshopTiers } from "./KqWorkshopTiers";

const expert = createChanvrierCareerSnapshot({ xp: 4500, completedCultures: 45 });
const press = "PRESS-0600";
const tierPrice = (target: number, current = 0) => formatKqCash(getKqWorkshopTierPrice(press, target, current)!);
const render = (props: Partial<Parameters<typeof KqWorkshopTiers>[0]> = {}) => renderToStaticMarkup(createElement(KqWorkshopTiers, {
  code: press, level: 0, cashCents: 3_000_000, career: expert, onUpdated: vi.fn(), ...props,
}));
describe("workshop tier offers", () => {
  it("offers three direct purchases with their complete prices", () => {
    const html = render();
    expect(html).toContain("Choisir économique"); expect(html).toContain("Choisir standard"); expect(html).toContain("Choisir haut de gamme");
    for (const level of [1, 4, 7]) expect(html).toContain(`<b>${tierPrice(level)}</b>`);
    expect(html).not.toMatch(/<button[^>]*disabled/);
    expect(html).toContain("Cadence de base estimée");
    expect(html).toContain("g/h de jeu");
    expect(html).not.toMatch(/Référence de prix|source fabricant|0,90 € par dollar/);
    for (const offer of retail[press]) {
      expect(html).not.toContain(offer.model);
      expect(html).not.toContain(offer.url);
    }
  });
  it("quotes the illustrated washers and deducts the owned machine on upgrade", () => {
    const offers = render({ code: "WASHER-25L", cashCents: 8_580_000 });
    for (const amount of [630_000, 3_480_000, 8_580_000]) expect(offers).toContain(`<b>${formatKqCash(amount)}</b>`);
    expect(offers).not.toContain("Forza TSS-225");
    const owned = render({ code: "WASHER-25L", level: 1, cashCents: 2_850_000 });
    expect(owned).toContain(`<b>${formatKqCash(2_850_000)}</b>`);
    expect(owned).toContain("Passage de gamme");
  });
  it("credits existing levels and keeps acquired higher levels", () => {
    const intermediate = render({ level: 2 });
    expect(intermediate).toContain("Ta gamme actuelle"); expect(intermediate).toContain(`<b>${tierPrice(4, 2)}</b>`);
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
