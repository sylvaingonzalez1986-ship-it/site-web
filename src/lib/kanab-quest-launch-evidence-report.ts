export const KQ_LAUNCH_EVIDENCE_REQUIREMENTS = [
  "artwork-review",
  "mobile-audit",
  "load-test",
  "manual-mobile-review",
  "smoke-card",
  "smoke-verdict",
  "smoke-bot-challenge",
  "smoke-equipment",
  "smoke-market",
  "retro-notebook",
  "retro-heritage",
  "retro-producer",
] as const;

export type KqLaunchEvidenceRequirementCode = typeof KQ_LAUNCH_EVIDENCE_REQUIREMENTS[number];

export type KqLaunchEvidenceRequirement = {
  code: KqLaunchEvidenceRequirementCode;
  label: string;
  passed: boolean;
  detail: string;
};

export type KqLaunchEvidenceReport = {
  schema: "kanab-quest-launch-evidence-v1";
  generatedAt: string;
  maxAgeDays: number;
  requirements: KqLaunchEvidenceRequirement[];
  invalidReportCount: number;
  passed: boolean;
};

const NEXT_ACTIONS: Record<KqLaunchEvidenceRequirementCode, string> = {
  "artwork-review": "Terminer la revue du socle graphique et de chaque Héritage producteur actif, puis exporter la preuve.",
  "mobile-audit": "Relancer l’audit Lighthouse des trois vues avec deux comptes.",
  "load-test": "Relancer le test de charge v2 sur les sept routes en lecture seule.",
  "manual-mobile-review": "Valider puis exporter la checklist v3 sur iPhone et Android physiques.",
  "smoke-card": "Exécuter le smoke test local d’une carte brûlée.",
  "smoke-verdict": "Exécuter le smoke test local d’un verdict de duel.",
  "smoke-bot-challenge": "Exécuter le smoke test local d’un duel bot qui crédite un défi sans double gain.",
  "smoke-equipment": "Exécuter le smoke test local d’achat-installation d’un matériel neuf.",
  "smoke-market": "Exécuter le smoke test local d’une vente avec rejeu idempotent.",
  "retro-notebook": "Simuler puis exécuter toute la chaîne rétro Carnet sur la copie de recette.",
  "retro-heritage": "Simuler puis exécuter toute la chaîne rétro Héritage sur la copie de recette.",
  "retro-producer": "Simuler puis exécuter toute la chaîne rétro Producteurs sur la copie de recette.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 600)
    : fallback;
}

export function importKqLaunchEvidenceReport(value: string | unknown): KqLaunchEvidenceReport {
  const source = typeof value === "string" ? JSON.parse(value) as unknown : value;
  const report = asRecord(source);
  if (!report || report.schema !== "kanab-quest-launch-evidence-v1") {
    throw new Error("Rapport consolidé du Placard invalide ou incompatible.");
  }
  const generatedAt = typeof report.generatedAt === "string" ? report.generatedAt : "";
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("Date du rapport consolidé invalide.");
  }
  const maxAgeDays = Number(report.maxAgeDays);
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 90) {
    throw new Error("Fenêtre de fraîcheur du rapport invalide.");
  }
  if (!Array.isArray(report.requirements)) {
    throw new Error("Liste des preuves de recette absente.");
  }
  const requirements = report.requirements.flatMap((value) => {
    const requirement = asRecord(value);
    const code = String(requirement?.code ?? "") as KqLaunchEvidenceRequirementCode;
    if (!requirement || !KQ_LAUNCH_EVIDENCE_REQUIREMENTS.includes(code)) return [];
    if (typeof requirement.passed !== "boolean") return [];
    return [{
      code,
      label: cleanText(requirement.label, code),
      passed: requirement.passed,
      detail: cleanText(requirement.detail, "Aucun détail fourni."),
    }];
  });
  if (
    requirements.length !== KQ_LAUNCH_EVIDENCE_REQUIREMENTS.length
    || new Set(requirements.map((item) => item.code)).size !== KQ_LAUNCH_EVIDENCE_REQUIREMENTS.length
    || !KQ_LAUNCH_EVIDENCE_REQUIREMENTS.every((code) => requirements.some((item) => item.code === code))
  ) {
    throw new Error("Le rapport ne contient pas les 12 preuves de recette attendues.");
  }
  const storedInvalidReportCount = Number(report.invalidReportCount);
  const invalidReportCount = Array.isArray(report.invalidReports)
    ? report.invalidReports.length
    : Number.isInteger(storedInvalidReportCount) && storedInvalidReportCount >= 0
      ? storedInvalidReportCount
      : 0;
  const derivedPassed = requirements.every((requirement) => requirement.passed) && invalidReportCount === 0;
  if (report.passed !== derivedPassed) {
    throw new Error("La décision globale du rapport est incohérente avec ses preuves.");
  }
  return {
    schema: "kanab-quest-launch-evidence-v1",
    generatedAt,
    maxAgeDays,
    requirements,
    invalidReportCount,
    passed: derivedPassed,
  };
}

export function parseStoredKqLaunchEvidenceReport(value: string | null) {
  if (!value) return null;
  try {
    return importKqLaunchEvidenceReport(value);
  } catch {
    return null;
  }
}

export function summarizeKqLaunchEvidenceReport(
  report: KqLaunchEvidenceReport,
  now = new Date(),
) {
  const generatedAt = Date.parse(report.generatedAt);
  const ageMs = now.getTime() - generatedAt;
  const fresh = ageMs >= -300_000 && ageMs <= report.maxAgeDays * 86_400_000;
  const passedCount = report.requirements.filter((requirement) => requirement.passed).length;
  const firstFailure = report.requirements.find((requirement) => !requirement.passed) ?? null;
  return {
    total: report.requirements.length,
    passedCount,
    blockedCount: report.requirements.length - passedCount,
    fresh,
    readyForLaunch: report.passed && fresh,
    nextAction: !fresh
      ? "Relancer le vérificateur : ce rapport consolidé a expiré."
      : firstFailure
        ? NEXT_ACTIONS[firstFailure.code]
        : "Toutes les preuves sont réunies. Conserver les verrous fermés jusqu’à la fenêtre d’activation.",
    nextRequirement: firstFailure,
  };
}

export function getKqCombinedLaunchStatus(input: {
  report: KqLaunchEvidenceReport | null;
  serverReadinessAvailable: boolean;
  serverReadyForActivation: boolean;
  serverBlockers: readonly string[];
  now?: Date;
}) {
  const evidence = input.report
    ? summarizeKqLaunchEvidenceReport(input.report, input.now)
    : null;
  if (!evidence) {
    return {
      code: "missing-evidence" as const,
      readyForActivationWindow: false,
      title: "Dossier de recette absent",
      nextAction: "Générer puis importer le rapport consolidé des 12 preuves.",
    };
  }
  if (!evidence.readyForLaunch) {
    return {
      code: "evidence-blocked" as const,
      readyForActivationWindow: false,
      title: "Dossier de recette bloqué",
      nextAction: evidence.nextAction,
    };
  }
  if (!input.serverReadinessAvailable) {
    return {
      code: "server-unavailable" as const,
      readyForActivationWindow: false,
      title: "Préflight serveur indisponible",
      nextAction: "Recharger le pilotage admin et rétablir le préflight serveur.",
    };
  }
  if (!input.serverReadyForActivation) {
    return {
      code: "server-blocked" as const,
      readyForActivationWindow: false,
      title: "Préflight serveur bloqué",
      nextAction: input.serverBlockers[0]
        ? `Résoudre le premier blocage serveur : ${input.serverBlockers[0]}.`
        : "Résoudre les contrôles serveur encore bloquants.",
    };
  }
  return {
    code: "ready" as const,
    readyForActivationWindow: true,
    title: "Fenêtre d’activation prête à préparer",
    nextAction: "Conserver tous les flux fermés jusqu’à la fenêtre coordonnée, puis ouvrir l’accès joueur en dernier.",
  };
}
