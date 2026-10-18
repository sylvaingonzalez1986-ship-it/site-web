import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { KQ_STARTING_EQUIPMENT_CODES } from "@/lib/kanab-quest-equipment";
import { getKqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import { KqWarehouseEntry } from "./KqWarehouseEntry";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqWorkshopMachineSummary } from "./KqWorkshopMachineSummary";

const expert = createChanvrierCareerSnapshot({ xp: 4500, completedCultures: 45 });
const machineCodes = ["PRESS-0600", "WASHER-25L"];
const inventory: ComponentProps<typeof KqEquipmentInventoryModal> = {
  workshopOnly: true,
  embedded: true,
  ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES, ...machineCodes],
  purchasedCodes: machineCodes,
  equippedCodes: [...KQ_STARTING_EQUIPMENT_CODES, ...machineCodes],
  levels: { "PRESS-0600": 3, "WASHER-25L": 2 },
  cashCents: 1000000,
  career: expert,
  maintenance: { "PRESS-0600": { cycles: 2, interval: 10, remaining: 8, due: false, repairCents: 1000, version: 1 } },
  loading: false,
  loadError: "",
  onClose: vi.fn(),
  onOpenShop: vi.fn(),
  onRetry: vi.fn(),
};

describe("processing workshop embedded in the warehouse", () => {
  it("shows the six processing machines without opening a popup for an old cultivation deep link", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentInventoryModal, { ...inventory, initialSlot: "lighting" }));
    expect([...html.matchAll(/data-warehouse-slot="([^"]+)"/g)].map(match => match[1])).toEqual([
      "sifting", "washing", "filtration", "static-separation", "press", "drying",
    ]);
    expect(html).toContain('aria-label="Atelier de transformation, vue de dessus"');
    expect(html).not.toContain('data-workshop-machine-dialog');
    expect(html).toContain("Mes machines");
    expect(html).not.toContain("Voir le décor");
    expect(html).not.toContain("Bilan de la tente");
    expect(html).not.toContain("Charges et énergie");
    expect(html).not.toContain("XP permanents");
  });

  it("keeps the owned machine level, career eligibility and preventive service usable", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(KqEquipmentUpgrade, { workshopOnly: true, code: "PRESS-0600", level: 3, cashCents: inventory.cashCents, career: expert, onUpdated: vi.fn() }),
      createElement(KqMachineMaintenance, { code: "PRESS-0600", condition: inventory.maintenance!["PRESS-0600"], cashCents: inventory.cashCents, onUpdated: vi.fn() }),
    ));
    expect(html).toContain('aria-valuenow="3"');
    const upgradeButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes("Niveau 4 · "));
    expect(upgradeButton).toBeDefined();
    expect(upgradeButton).not.toContain("disabled=");
    expect(html).not.toContain("Chargement de la progression");
    expect(html).not.toContain("Niveau métier 5 requis");
    expect(html).toMatch(/Entretenir · 10\s€/);
    expect(html).toContain("prochaine transformation");
    expect(html).not.toContain("toutes les tentes");
  });

  it("retains the career restriction inside the machine improvement panel", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentUpgrade, { workshopOnly: true, code: "PRESS-0600", level: 3, cashCents: inventory.cashCents, career: createChanvrierCareerSnapshot(), onUpdated: vi.fn() }));
    expect(html).toContain("Niveau métier 5 requis");
    const upgradeButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes("Niveau 4 · "));
    expect(upgradeButton).toContain('disabled=""');
  });

  it("combines the current machine level and condition with two direct actions", () => {
    const html = renderToStaticMarkup(createElement(KqWorkshopMachineSummary, {
      code: "WASHER-25L", level: 9, condition: getKqMachineCondition("WASHER-25L", 9, 3)!,
      cashCents: inventory.cashCents, career: expert, installed: true, onUpdated: vi.fn(),
    }));
    expect(html).toContain('data-workshop-machine-summary="WASHER-25L"');
    expect(html).toContain('aria-label="Niveau du matériel" aria-valuemin="1" aria-valuemax="10" aria-valuenow="9"');
    expect(html).toContain('aria-label="État de la machine" aria-valuemin="0" aria-valuemax="100" aria-valuenow="85"');
    expect(html).toContain("17 lots avant entretien");
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.find(button => button.includes("data-machine-upgrade"))).toContain("Améliorer · niv. 10");
    expect(buttons.find(button => button.includes("data-machine-maintenance"))).toContain("Entretenir");
    expect(buttons.every(button => !button.includes("disabled="))).toBe(true);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Trois gammes");
  });

  it("keeps repair available while a worn-out machine blocks improvement", () => {
    const html = renderToStaticMarkup(createElement(KqWorkshopMachineSummary, {
      code: "WASHER-25L", level: 9, condition: getKqMachineCondition("WASHER-25L", 9, 20)!,
      cashCents: inventory.cashCents, career: expert, onUpdated: vi.fn(),
    }));
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons.find(button => button.includes("data-machine-upgrade"))).toContain('disabled=""');
    const repair = buttons.find(button => button.includes("data-machine-maintenance"));
    expect(repair).toContain("Réparer");
    expect(repair).not.toContain("disabled=");
    expect(html).toContain("Entretiens cette machine avant de l’améliorer.");
    expect(html).toContain('aria-valuenow="0"');
  });

  it("retains both graphical statuses at maximum level after maintenance", () => {
    const html = renderToStaticMarkup(createElement(KqWorkshopMachineSummary, {
      code: "WASHER-25L", level: 10, condition: getKqMachineCondition("WASHER-25L", 10, 0)!,
      cashCents: inventory.cashCents, career: expert, onUpdated: vi.fn(),
    }));
    expect(html).toContain('aria-valuenow="10"');
    expect(html).toContain('aria-valuenow="100"');
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.every(button => button.includes('disabled=""'))).toBe(true);
    expect(buttons.find(button => button.includes("data-machine-upgrade"))).toContain("Niveau maximum");
    expect(buttons.find(button => button.includes("data-machine-maintenance"))).toContain("À jour");
  });

  it("explains missing condition data without inventing a healthy machine", () => {
    const html = renderToStaticMarkup(createElement(KqWorkshopMachineSummary, {
      code: "WASHER-25L", level: 9, cashCents: inventory.cashCents, career: expert, onUpdated: vi.fn(),
    }));
    expect(html).toContain("État d’usure indisponible.");
    expect(html).toContain("Actualiser l’état");
    expect(html).not.toContain('aria-label="État de la machine"');
    expect(html).not.toContain("data-machine-maintenance");
  });

  it("allows free compact maintenance while explaining insufficient paid maintenance funds", () => {
    const condition = getKqMachineCondition("WASHER-25L", 9, 3)!;
    const render = (repairCents: number) => renderToStaticMarkup(createElement(KqMachineMaintenance, {
      compact: true, code: "WASHER-25L", condition: { ...condition, repairCents }, cashCents: 0, onUpdated: vi.fn(),
    }));
    expect(render(0)).toContain("Entretenir · gratuit");
    expect(render(0)).not.toMatch(/<button[^>]*disabled/);
    expect(render(condition.repairCents)).toMatch(/<button[^>]*disabled/);
    expect(render(condition.repairCents)).toContain("Il manque");
  });

  it("opens the actual workshop entry on a live account without nesting the new warehouse", () => {
    const html = renderToStaticMarkup(createElement(KqWarehouseEntry, {
      workshopOnly: true, embedded: true, initialSection: "storage", onClose: vi.fn(), onOpenShop: vi.fn(),
    }));
    expect(html).toContain('data-workshop-only="true"');
    expect(html.match(/data-warehouse-slot=/g)).toHaveLength(6);
    expect(html).toContain("Mes machines");
    expect(html).not.toContain("Chambre de culture");
  });

  it("opens a machine-only catalogue even when an old cultivation recommendation is supplied", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentCatalogModal, {
      workshopOnly: true, embedded: true, initialEquipmentCode: "LED-300", onClose: vi.fn(),
    }));
    expect(html).toContain('data-workshop-only="true"');
    expect(html).toContain('data-embedded="true"');
    expect(html).toContain("Équiper mon atelier");
    expect(html).toContain("Toutes les machines");
    expect(html).toContain("Déjà possédés");
    expect(html).not.toContain("Intrants");
    expect(html).not.toContain("Vente en ligne");
    expect(html).not.toContain("Tente 1");
    expect(html).not.toContain("Culture :");
  });
});
