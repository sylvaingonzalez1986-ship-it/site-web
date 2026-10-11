import { describe, expect, it } from "vitest";
import {
  CHANVRIER_CAREER_LEVEL_XP,
  createChanvrierCareerSnapshot,
  getChanvrierCareerGate,
  getChanvrierCareerProgress,
  getChanvrierCultureXp,
  getChanvrierEquipmentAccess,
  getChanvrierEquipmentRequiredLevel,
  getChanvrierEquipmentUpgradeRequiredLevel,
  getChanvrierExpansionRequiredLevel,
} from "./chanvrier-career";
import { KQ_EQUIPMENT_CATALOG } from "./kanab-quest-equipment";

describe("permanent chanvrier career", () => {
  it("gives a predictable journey from two complete cultures to forty-five", () => {
    const cultures = [0, 2, 4, 7, 12, 18, 24, 30, 37, 45];
    cultures.forEach((completedCultures, index) => {
      const xp = completedCultures * getChanvrierCultureXp({ status: "completed", completedStages: 6 });
      const career = createChanvrierCareerSnapshot({ xp, completedCultures });
      expect(career.level).toBe(index + 1);
      expect(career.completedCultures).toBe(completedCultures);
      expect(career.xp).toBe(CHANVRIER_CAREER_LEVEL_XP[index]);
      if (xp > 0) expect(getChanvrierCareerProgress(xp - 1).level).toBe(index);
    });
    expect(getChanvrierCareerProgress(399)).toMatchObject({ level: 2, nextLevel: 3, xpToNextLevel: 1, progressPercent: 99 });
    expect(getChanvrierCareerProgress(900)).toMatchObject({ level: 4, nextLevelXp: 1200, progressPercent: 40 });
    expect(getChanvrierCareerProgress(9000)).toMatchObject({ level: 10, nextLevel: null, nextLevelXp: null, xpToNextLevel: 0, progressPercent: 100 });
  });

  it("credits work after a natural loss but never active runs or voluntary abandonment", () => {
    expect(getChanvrierCultureXp({ status: "abandoned", cultureDead: true, completedStages: 3 })).toBe(30);
    expect(getChanvrierCultureXp({ status: "abandoned", cultureDead: true, completedStages: 60 })).toBe(60);
    expect(getChanvrierCultureXp({ status: "abandoned", completedStages: 5 })).toBe(0);
    expect(getChanvrierCultureXp({ status: "active", completedStages: 6 })).toBe(0);
    expect(getChanvrierCultureXp({ status: "completed", cultureDead: true, completedStages: 6 })).toBe(0);
    expect(getChanvrierCultureXp({ status: "abandoned", cultureDead: true, completedStages: Number.NaN })).toBe(0);
  });

  it("normalizes damaged counters conservatively and recomputes progress", () => {
    for (const xp of [-10, Number.NaN, Infinity, -Infinity]) {
      expect(getChanvrierCareerProgress(xp)).toMatchObject({ xp: 0, level: 1 });
    }
    const career = createChanvrierCareerSnapshot({ xp: 200.9, completedCultures: -1, processingPractice: { washing: Infinity, pressing: 3.8 } });
    expect(career).toMatchObject({ xp: 200, level: 2, completedCultures: 0, processingPractice: { sifting: 0, washing: 0, pressing: 3 } });
    expect(createChanvrierCareerSnapshot().level).toBe(1);
  });

  it("requires an explicit career rule for every current equipment item", () => {
    for (const item of KQ_EQUIPMENT_CATALOG) expect(getChanvrierEquipmentRequiredLevel(item.code), item.code).not.toBeNull();
    for (const code of ["UNKNOWN", "toString", "__proto__"]) {
      expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot({ xp: 9000 }), code)).toMatchObject({ allowed: false, requiredLevel: null });
    }
    expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot(), "SECURITY-CAMERA").allowed).toBe(true);
    expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot({ xp: 699 }), "PRESS-0600")).toMatchObject({ allowed: false, requiredLevel: 4, xpToUnlock: 1 });
    expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot({ xp: 700 }), "PRESS-0600").allowed).toBe(true);
  });

  it("requires genuine practice before advanced machines even at the maximum career level", () => {
    const experienced = createChanvrierCareerSnapshot({ xp: 4500 });
    expect(getChanvrierEquipmentAccess(experienced, "STATIC-PLASMA")).toMatchObject({ allowed: false, requiredLevel: 10, practiceLotsRemaining: 10 });
    expect(getChanvrierEquipmentAccess({ ...experienced, processingPractice: { sifting: 10, washing: 0, pressing: 0 } }, "STATIC-PLASMA").allowed).toBe(true);
    const washedThree = createChanvrierCareerSnapshot({ xp: 3000, processingPractice: { washing: 3 } });
    expect(getChanvrierEquipmentAccess(washedThree, "AUTO-SIEVE").allowed).toBe(true);
    expect(getChanvrierEquipmentAccess(washedThree, "FREEZE-DRYER")).toMatchObject({ allowed: false, practiceLotsRemaining: 3 });
    expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot({ xp: 3000, processingPractice: { washing: 6 } }), "FREEZE-DRYER").allowed).toBe(true);
    expect(getChanvrierEquipmentAccess(createChanvrierCareerSnapshot({ processingPractice: { washing: 10 } }), "FREEZE-DRYER").allowed).toBe(false);
  });

  it("locks advanced adjustments while preserving the ten-level machine model", () => {
    expect([2, 3, 4, 6, 7, 10].map(level => getChanvrierEquipmentUpgradeRequiredLevel("PRESS-0600", level))).toEqual([4, 4, 5, 5, 8, 8]);
    expect(getChanvrierEquipmentUpgradeRequiredLevel("STATIC-PLASMA", 2)).toBe(10);
    expect(getChanvrierEquipmentUpgradeRequiredLevel("FREEZE-DRYER", 4)).toBe(8);
    expect(getChanvrierEquipmentUpgradeRequiredLevel("AIR-STARTER", 2)).toBeNull();
    for (const target of [0, 1, 1.5, 11, Number.NaN]) expect(getChanvrierEquipmentUpgradeRequiredLevel("LED-300", target)).toBeNull();
  });

  it("paces each new tent and requires level ten for the second warehouse", () => {
    expect([2, 3, 4, 5, 6, 7, 8].map(getChanvrierExpansionRequiredLevel)).toEqual([3, 5, 7, 10, 10, 10, 10]);
    expect(getChanvrierCareerGate(4499, getChanvrierExpansionRequiredLevel(5))).toMatchObject({ allowed: false, xpToUnlock: 1 });
    expect(getChanvrierCareerGate(4500, getChanvrierExpansionRequiredLevel(5)).allowed).toBe(true);
    for (const units of [0, 1, 2.5, 9, Number.NaN]) expect(getChanvrierExpansionRequiredLevel(units)).toBeNull();
    for (const level of [null, 0, 11, 1.5, Number.NaN]) expect(getChanvrierCareerGate(9000, level).allowed).toBe(false);
  });
});
