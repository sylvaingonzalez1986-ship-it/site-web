import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { KQ_STARTING_EQUIPMENT_CODES } from "@/lib/kanab-quest-equipment";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import { KqWarehouseEntry } from "./KqWarehouseEntry";

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
  it("shows only the six processing slots and resolves a cultivation deep link to the press", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentInventoryModal, { ...inventory, initialSlot: "lighting" }));
    expect([...html.matchAll(/data-warehouse-slot="([^"]+)"/g)].map(match => match[1])).toEqual([
      "sifting", "washing", "filtration", "static-separation", "press", "drying",
    ]);
    expect(html).toMatch(/data-warehouse-slot="press"[^>]*aria-pressed="true"/);
    expect(html).toContain("Mes machines");
    expect(html).not.toContain("Voir le décor");
    expect(html).not.toContain("Bilan de la tente");
    expect(html).not.toContain("Charges et énergie");
    expect(html).not.toContain("XP permanents");
  });

  it("keeps the owned machine level, career eligibility and preventive service usable", () => {
    const html = renderToStaticMarkup(createElement(KqEquipmentInventoryModal, inventory));
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
    const html = renderToStaticMarkup(createElement(KqEquipmentInventoryModal, { ...inventory, career: createChanvrierCareerSnapshot() }));
    expect(html).toContain("Niveau métier 5 requis");
    const upgradeButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes("Niveau 4 · "));
    expect(upgradeButton).toContain('disabled=""');
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
