import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { getKqProductionExpansion } from "@/lib/kanab-quest-production";
import { KqCareerProgress } from "./KqCareerProgress";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqProductionCapacity } from "./KqProductionCapacity";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";
import { KqWarehouseOverview } from "./KqWarehouseOverview";
import { KQ_STARTING_EQUIPMENT_CODES } from "@/lib/kanab-quest-equipment";
import { KqEnergyPanel } from "./KqEnergyPanel";
import { quoteKqTentEnergy } from "@/lib/kanab-quest-energy";

const novice = createChanvrierCareerSnapshot();
const expert = createChanvrierCareerSnapshot({ xp: 4500, completedCultures: 45 });

describe("career requirements in the warehouse", () => {
  it("explains permanent XP and the next material milestone", () => {
    const html = renderToStaticMarkup(createElement(KqCareerProgress, { career: novice }));
    expect(html).toContain("0 XP permanents");
    expect(html).toContain("encore 200 XP");
    expect(html).toContain("Prochain palier matériel");
    expect(html).toContain("ne servent pas à payer les cartes");
    expect(html).toMatch(/role="meter"[^>]*aria-label="Vers le niveau 2"[^>]*aria-valuemin="0"[^>]*aria-valuemax="200"[^>]*aria-valuenow="0"[^>]*aria-valuetext="0 \/ 200 XP"/);
  });

  it("requires career experience for an upgrade even with enough cash and explains it", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentUpgrade, {
      code: "LED-300", level: 3, cashCents: 1000000, career: novice, onUpdated: vi.fn(),
    }));
    expect(html).toContain("Niveau métier 5 requis");
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("Aménagement");
    expect(html).not.toContain("Nouveau look");
  });

  it("announces the borrowed career in the tutorial", () => {
    const tutorialProps = {
      api: createKqTutorialApi(vi.fn()),
      children: createElement(KqCareerProgress, { career: expert, compact: true }),
    };
    const html = renderToStaticMarkup(createElement(KqTutorialApiProvider, tutorialProps));
    expect(html).toContain("XP de démonstration");
    expect(html).toContain("Niveau prêté pour cet exercice");
    expect(html).not.toContain("XP permanents");
  });

  it("permits an experienced upgrade only when the budget also covers it", () => {
    const render = (cashCents: number) => renderToStaticMarkup(createElement(KqEquipmentUpgrade, {
      code: "PRESS-0600", level: 3, cashCents, career: expert, onUpdated: vi.fn(),
    }));
    expect(render(1000000)).not.toMatch(/<button[^>]*disabled/);
    expect(render(1000000)).toContain("Changement de configuration");
    expect(render(0)).toMatch(/<button[^>]*disabled/);
    expect(render(0)).toContain("Il manque");
  });

  it("keeps the current advanced machine level visible without granting a further upgrade", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentUpgrade, {
      code: "PRESS-0600", level: 8, cashCents: 1000000, career: novice, onUpdated: vi.fn(),
    }));
    expect(html).toContain('aria-valuenow="8"');
    expect(html).toContain("Atelier avancé");
    expect(html).toContain("Niveau métier 8 requis");
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("offers preventive service before the machine stops, but no service for a new machine", () => {
    const condition = { cycles: 2, interval: 10, remaining: 8, due: false, repairCents: 1000, version: 1 };
    const render = (cycles: number) => renderToStaticMarkup(createElement(KqMachineMaintenance, {
      code: "PRESS-0600", cashCents: 10000, condition: { ...condition, cycles }, onUpdated: vi.fn(),
    }));
    expect(render(2)).toMatch(/Entretenir · 10\s€/);
    expect(render(2)).toContain("au même prix qu’une réparation");
    expect(render(2)).not.toMatch(/<button[^>]*disabled/);
    expect(render(0)).not.toContain("<button");
  });

  it("shows services once per building and preserves per-tent recaps for an active legacy culture", () => {
    const service = "DRYING-ROOM";
    const buildings = [1, 2].map(buildingNumber => ({ buildingNumber, anchorTentNumber: buildingNumber === 1 ? 1 : 5,
      ownedCodes: [service], purchasedCodes: [service], equippedCodes: [service], levels: { [service]: buildingNumber }, maintenance: {}, cultureWear: {},
    }));
    const tents = Array.from({length: 6}, (_, index) => ({tentNumber: index + 1, ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES], equippedCodes: [...KQ_STARTING_EQUIPMENT_CODES], levels: {}}));
    const render = (equipmentScopeVersion: 2 | 3) => renderToStaticMarkup(createElement(KqWarehouseOverview, {
      tents: equipmentScopeVersion === 3 ? tents : tents.map(tent => ({...tent, ownedCodes: [...tent.ownedCodes, service], equippedCodes: [...tent.equippedCodes, service]})),
      buildings: equipmentScopeVersion === 3 ? buildings : [], equipmentScopeVersion, selectedTentNumber: 2, selectedSlot: "flower-drying",
      disabled: false, loading: false, error: "", onRetry: vi.fn(), onSelect: vi.fn(),
    }));
    const modern = render(3), legacy = render(2);
    expect(modern.match(/data-building-recap-slot="flower-drying"/g)).toHaveLength(2);
    expect(modern).not.toContain('data-recap-slot="flower-drying"');
    expect(modern).toContain("Un équipement pour les tentes 5 à 8");
    expect(legacy.match(/data-recap-slot="flower-drying"/g)).toHaveLength(6);
    expect(legacy).not.toContain("data-building-recap=");
  });

  it("describes upgrade coverage using the account scope, not only the equipment code", () => {
    const render = (equipmentScopeVersion: 2 | 3) => renderToStaticMarkup(createElement(KqEquipmentUpgrade, {
      code: "DRYING-ROOM", level: 1, cashCents: 1000000, career: expert, tentNumber: 6, equipmentScopeVersion, onUpdated: vi.fn(),
    }));
    expect(render(3)).toContain("aux tentes de l’entrepôt 2");
    expect(render(2)).toContain("uniquement la tente 6");
  });

  it("keeps old electricity invoices scoped to tents while new invoices identify physical building services", () => {
    const tents = [1, 2].map(tentNumber => ({tentNumber, codes: [...KQ_STARTING_EQUIPMENT_CODES, "DRYING-ROOM"], levels: {}}));
    const render = (lockedScope: "tent" | "building") => renderToStaticMarkup(createElement(KqEnergyPanel, {
      lockedScope, lockedTents: tents, lockedQuote: quoteKqTentEnergy(tents, "balanced", lockedScope),
    }));
    const modern = render("building"), legacy = render("tent");
    expect(modern).toContain("Entrepôt 1 · ");
    // The chart also names the equipment; count only the scoped invoice lines.
    expect(modern.match(/Entrepôt 1 · Pièce séchoir · niv\. 1/g)).toHaveLength(1);
    expect(modern).not.toMatch(/Tente \d+ · Pièce séchoir/);
    expect(legacy).not.toContain("Entrepôt 1 · ");
    expect(legacy.match(/Tente [12] · Pièce séchoir · niv\. 1/g)).toHaveLength(2);
    expect(legacy).toContain("Tente 1 · Pièce séchoir");
    expect(legacy).toContain("Tente 2 · Pièce séchoir");
    expect(legacy).toContain("Ce devis reste inchangé");
  });

  it("holds the second tent until career level three even when the player can afford it", () => {
    const html = renderToStaticMarkup(createElement(KqProductionCapacity, {
      production: getKqProductionExpansion(1), cashCents: 35000, career: novice,
      storageCapacity: { freeUnits: 1000, totalUnits: 1500 }, expansionEnergyCents: 414,
      activeRun: false, disabled: false, onUpdated: vi.fn(), onPendingChange: vi.fn(),
    }));
    expect(html).toContain("Niveau métier 3 requis");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Ajouter cette tente/);
    expect(html).toMatch(/Solde après achat<\/dt><dd>50\s€/);
    expect(html).toContain("100 g sur 150 g");
    expect(html).toMatch(/≈ 4,14\s€/);
    expect(html).toContain("Jusqu’à 500 g");
  });

  it("opens the second warehouse with just one tent and buys its next tent independently", () => {
    const render = (units: number) => renderToStaticMarkup(createElement(KqProductionCapacity, {
      production: getKqProductionExpansion(units), cashCents: 3000000, career: expert,
      activeRun: false, disabled: false, onUpdated: vi.fn(), onPendingChange: vi.fn(),
    }));
    const opening = render(4);
    expect(opening).toContain("Ouvrir le second entrepôt");
    expect(opening).toContain("+ 1 tente · 4 places");
    expect(opening).not.toContain("+ 4 tentes");
    expect(opening).not.toMatch(/<button[^>]*disabled/);
    const nextTent = render(5);
    expect(nextTent).toContain("Ta 6e tente");
    expect(nextTent).not.toContain("Ouvrir le second entrepôt");
    expect(nextTent).toMatch(/Ajouter cette tente · 300\s€/);
  });
});
