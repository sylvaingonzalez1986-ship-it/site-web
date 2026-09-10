import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hud = readFileSync(join(process.cwd(), "src/components/placard/KqPlacardHud.tsx"), "utf8");
const inventory = readFileSync(join(process.cwd(), "src/components/placard/KqEquipmentInventoryModal.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "src/components/placard/KqEquipmentInventoryModal.module.css"), "utf8");

describe("Kanab Quest equipment inventory policy", () => {
  it("keeps the workshop HUD compact until the player expands it", () => {
    expect(hud).toContain("const [hudExpanded, setHudExpanded] = useState(false)");
    expect(hud).toContain('aria-controls="placard-hud-details"');
    expect(hud).toContain("aria-expanded={hudExpanded}");
    expect(hud).toContain('hidden={!hudExpanded}');
    expect(hud).toContain('aria-label="Résumé de l’atelier"');
    expect(hud).toContain('hudExpanded ? "Replier" : "Dérouler"');
  });

  it("opens a dedicated inventory from the Placard hub", () => {
    expect(hud).toContain("KqEquipmentInventoryModal");
    expect(hud).toContain("setInventoryOpen(true)");
    expect(hud).toContain("Inventaire");
  });

  it("shows owned equipment by slot and makes replacements explicit", () => {
    expect(inventory).toContain("KQ_EQUIPMENT_SLOT_LABELS");
    expect(inventory).toContain("En réserve");
    expect(inventory).toContain("Remplace :");
    expect(inventory).toContain("Contrepartie : {equipment.tradeoff}");
    expect(inventory).toContain("Un seul équipement actif par emplacement.");
    expect(inventory).toContain("getKqEquipmentRequirementState");
    expect(inventory).toContain("purchasedCodes");
    expect(inventory).toContain("Cet équipement doit être acheté avant de pouvoir être installé.");
  });

  it("installs owned equipment through the durable equipment endpoint", () => {
    expect(inventory).toContain('fetch("/api/arena/placard/equipment"');
    expect(inventory).toContain('method: "PATCH"');
    expect(inventory).toContain("JSON.stringify({ equipmentCode: equipment.code })");
    expect(inventory).toContain('new Event("kq:equipment-updated")');
  });

  it("keeps the dialog usable on a smartphone", () => {
    expect(styles).toContain("@media (max-width:680px)");
    expect(styles).toContain("height:100dvh");
    expect(styles).toContain("min-height:46px");
    expect(styles).toContain("env(safe-area-inset-bottom)");
  });
});
