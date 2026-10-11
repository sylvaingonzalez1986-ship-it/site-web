/** Permanent experience earned through play, separate from spendable culture XP. */
export const CHANVRIER_CAREER_LEVEL_XP = [0, 200, 400, 700, 1200, 1800, 2400, 3000, 3700, 4500] as const;
export const CHANVRIER_CULTURE_XP = 100;
export const CHANVRIER_FAILED_STAGE_XP = 10;
export const CHANVRIER_CULTURE_STAGE_COUNT = 6;

export const CHANVRIER_PROCESSING_FAMILIES = ["sifting", "washing", "pressing"] as const;
export type ChanvrierProcessingFamily = typeof CHANVRIER_PROCESSING_FAMILIES[number];
export type ChanvrierProcessingPractice = Record<ChanvrierProcessingFamily, number>;
export const CHANVRIER_PRACTICE_LABELS: Record<ChanvrierProcessingFamily, string> = {
  sifting: "tamisage", washing: "lavage", pressing: "pressage",
};

export type ChanvrierCareerProgress = {
  xp: number;
  level: number;
  nextLevel: number | null;
  nextLevelXp: number | null;
  xpToNextLevel: number;
  progressPercent: number;
};
export type ChanvrierCareerSnapshot = ChanvrierCareerProgress & {
  completedCultures: number;
  processingPractice: ChanvrierProcessingPractice;
};
export type ChanvrierCareerGate = {
  allowed: boolean;
  requiredLevel: number | null;
  currentLevel: number;
  xpToUnlock: number;
  reason: string | null;
};
export type ChanvrierEquipmentPracticeRequirement = {
  family: ChanvrierProcessingFamily;
  minimumLots: number;
};

const count = (value: number | undefined) => typeof value === "number" && Number.isFinite(value)
  ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;

export function getChanvrierCareerProgress(value: number): ChanvrierCareerProgress {
  const xp = count(value);
  const index = CHANVRIER_CAREER_LEVEL_XP.findLastIndex(threshold => xp >= threshold);
  const currentThreshold = CHANVRIER_CAREER_LEVEL_XP[index];
  const nextLevelXp = CHANVRIER_CAREER_LEVEL_XP[index + 1] ?? null;
  return {
    xp, level: index + 1,
    nextLevel: nextLevelXp === null ? null : index + 2,
    nextLevelXp,
    xpToNextLevel: nextLevelXp === null ? 0 : nextLevelXp - xp,
    progressPercent: nextLevelXp === null ? 100
      : Math.floor((xp - currentThreshold) * 100 / (nextLevelXp - currentThreshold)),
  };
}

/** Recompute the level from authoritative XP; never trust a caller's level field. */
export function createChanvrierCareerSnapshot(input: {
  xp?: number;
  completedCultures?: number;
  processingPractice?: Partial<ChanvrierProcessingPractice> | null;
} = {}): ChanvrierCareerSnapshot {
  return {
    ...getChanvrierCareerProgress(input.xp ?? 0),
    completedCultures: count(input.completedCultures),
    processingPractice: {
      sifting: count(input.processingPractice?.sifting),
      washing: count(input.processingPractice?.washing),
      pressing: count(input.processingPractice?.pressing),
    },
  };
}

/** Award once per official session, regardless of tents, quality, money or cards. */
export function getChanvrierCultureXp(input: {
  status: string;
  cultureDead?: boolean;
  completedStages: number;
}): number {
  const stages = Math.min(CHANVRIER_CULTURE_STAGE_COUNT, count(input.completedStages));
  if (input.status === "completed" && input.cultureDead !== true) return CHANVRIER_CULTURE_XP;
  // Natural terminal losses are persisted as abandoned with the death flag.
  if (input.status === "abandoned" && input.cultureDead === true) return stages * CHANVRIER_FAILED_STAGE_XP;
  return 0;
}

/** Every new catalog item needs an explicit rule; unknown codes remain locked. */
export const CHANVRIER_EQUIPMENT_REQUIRED_LEVELS: Readonly<Record<string, number>> = {
  "TENT-080-STARTER": 1, "LED-150-STARTER": 1, "AIR-STARTER": 1,
  "SECURITY-CAMERA": 1,
  "TENT-120": 2, "LED-300": 2, "AIR-EC6": 2, "CLIMATE-SMART": 2, "DRYING-ROOM": 2,
  "SIFT-TRAY": 3, "SOLAR-BACKUP": 3, "SECURITY-DOG": 3,
  "PRESS-0600": 4,
  "WASHER-25L": 5,
  "AUTO-SIEVE": 6,
  "FREEZE-DRYER": 8,
  "STATIC-PLASMA": 10,
};

export function getChanvrierEquipmentRequiredLevel(code: string): number | null {
  return Object.hasOwn(CHANVRIER_EQUIPMENT_REQUIRED_LEVELS, code)
    ? CHANVRIER_EQUIPMENT_REQUIRED_LEVELS[code] : null;
}

export function getChanvrierEquipmentPracticeRequirement(code: string): ChanvrierEquipmentPracticeRequirement | null {
  if (code === "AUTO-SIEVE") return { family: "washing", minimumLots: 3 };
  if (code === "FREEZE-DRYER") return { family: "washing", minimumLots: 6 };
  if (code === "STATIC-PLASMA") return { family: "sifting", minimumLots: 10 };
  return null;
}

/** Machine levels remain compatible with old saves; only future upgrades are gated. */
export function getChanvrierEquipmentUpgradeRequiredLevel(code: string, targetLevel: number): number | null {
  const acquisitionLevel = getChanvrierEquipmentRequiredLevel(code);
  if (acquisitionLevel === null || code.endsWith("-STARTER")
    || !Number.isInteger(targetLevel) || targetLevel < 2 || targetLevel > 10) return null;
  return Math.max(acquisitionLevel, targetLevel >= 7 ? 8 : targetLevel >= 4 ? 5 : 1);
}

/** The second warehouse opens at five tents; its remaining tents use the same gate. */
export function getChanvrierExpansionRequiredLevel(nextProductionUnits: number): number | null {
  if (!Number.isInteger(nextProductionUnits) || nextProductionUnits < 2 || nextProductionUnits > 8) return null;
  return nextProductionUnits >= 5 ? 10 : nextProductionUnits === 4 ? 7 : nextProductionUnits === 3 ? 5 : 3;
}

export function getChanvrierCareerGate(xp: number, requiredLevel: number | null): ChanvrierCareerGate {
  const progress = getChanvrierCareerProgress(xp);
  if (requiredLevel === null || !Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > CHANVRIER_CAREER_LEVEL_XP.length) {
    return { allowed: false, requiredLevel: null, currentLevel: progress.level, xpToUnlock: 0, reason: "Évolution indisponible." };
  }
  const xpToUnlock = Math.max(0, CHANVRIER_CAREER_LEVEL_XP[requiredLevel - 1] - progress.xp);
  return {
    allowed: xpToUnlock === 0, requiredLevel, currentLevel: progress.level, xpToUnlock,
    reason: xpToUnlock === 0 ? null : `Niveau métier ${requiredLevel} requis · encore ${xpToUnlock.toLocaleString("fr-FR")} XP métier.`,
  };
}

/** For new acquisitions only. Already owned equipment stays usable and repairable. */
export function getChanvrierEquipmentAccess(
  career: Pick<ChanvrierCareerSnapshot, "xp" | "processingPractice">,
  code: string,
): ChanvrierCareerGate & {
  requiredPractice: ChanvrierEquipmentPracticeRequirement | null;
  practiceLots: number;
  practiceLotsRemaining: number;
} {
  const gate = getChanvrierCareerGate(career.xp, getChanvrierEquipmentRequiredLevel(code));
  const requiredPractice = getChanvrierEquipmentPracticeRequirement(code);
  const practiceLots = requiredPractice ? count(career.processingPractice[requiredPractice.family]) : 0;
  const practiceLotsRemaining = requiredPractice ? Math.max(0, requiredPractice.minimumLots - practiceLots) : 0;
  const practiceReason = requiredPractice && practiceLotsRemaining > 0
    ? `Pratique du ${CHANVRIER_PRACTICE_LABELS[requiredPractice.family]} : ${practiceLots}/${requiredPractice.minimumLots} lots transformés.` : null;
  return {
    ...gate,
    allowed: gate.allowed && practiceLotsRemaining === 0,
    requiredPractice, practiceLots, practiceLotsRemaining,
    reason: [gate.reason, practiceReason].filter(Boolean).join(" ") || null,
  };
}
