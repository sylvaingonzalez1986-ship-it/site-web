const REQUIRED_MOBILE_VIEWS = ["hud", "equipment-catalog", "market"];
const REQUIRED_LOAD_PATHS = [
  "/arene/placard",
  "/api/arena/placard/bootstrap",
  "/api/arena/placard/rankings",
  "/api/arena/placard/flowers",
  "/api/arena/placard/battles",
  "/api/arena/placard/equipment",
  "/api/arena/placard/market",
];
const REQUIRED_MANUAL_MOBILE_PROFILES = ["ios-safari", "android-chrome"];
const REQUIRED_MANUAL_MOBILE_CHECKS = [
  "physical-device",
  "hud-readability",
  "touch-navigation",
  "equipment-catalog",
  "cart-controls",
  "market-controls",
  "virtual-keyboard",
  "safe-areas",
  "orientation",
  "outdoor-contrast",
];
const REQUIRED_SMOKE_ACTIONS = ["card", "verdict", "bot-challenge", "equipment", "market"];
const REQUIRED_RETRO_KINDS = ["notebook", "heritage", "producer"];

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function reportTimestamp(report) {
  const value = report.generatedAt ?? report.exportedAt;
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function latest(entries) {
  return [...entries].sort((left, right) => (
    (reportTimestamp(right.report) ?? 0) - (reportTimestamp(left.report) ?? 0)
  ))[0] ?? null;
}

function isLocalHost(value) {
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`http://${value}`);
    return /^(localhost|127\.0\.0\.1)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function sourceSummary(entry) {
  return entry ? { source: entry.source, generatedAt: new Date(reportTimestamp(entry.report)).toISOString() } : null;
}

function assessLoadReport(report) {
  if (report.schema !== "kanab-quest-load-test-v2") {
    return { passed: false, detail: "Preuve de charge obsolète : relancer la recette v2 sur les sept routes." };
  }
  if (report.mode !== "read-only") {
    return { passed: false, detail: "La preuve de charge n’est pas en lecture seule." };
  }
  if (Number(report.authenticatedAccounts) < 2) {
    return { passed: false, detail: "La preuve de charge exige au moins deux comptes authentifiés." };
  }
  if (!Array.isArray(report.failedPaths) || report.failedPaths.length > 0 || report.passed !== true) {
    const failedPaths = Array.isArray(report.failedPaths) ? report.failedPaths.map(String) : [];
    return {
      passed: false,
      detail: failedPaths.length > 0
        ? `Budget de charge dépassé : ${failedPaths.join(", ")}.`
        : "La preuve de charge v2 ne porte pas de verdict positif.",
    };
  }
  for (const path of REQUIRED_LOAD_PATHS) {
    const metrics = report.byPath?.[path];
    if (!metrics || Number(metrics.requests) < 1) {
      return { passed: false, detail: `Route absente de la preuve de charge : ${path}.` };
    }
    if (metrics.withinBudget !== true) {
      return { passed: false, detail: `Budget p95 non respecté pour ${path}.` };
    }
  }
  return { passed: true, detail: "Les sept routes sont couvertes et respectent leurs budgets de charge." };
}

function assessManualMobileReview(report, cutoff, latestAllowedTimestamp) {
  const exportedAt = reportTimestamp(report);
  if (exportedAt === null) {
    return { passed: false, detail: "La preuve mobile ne contient pas de date d’export valide." };
  }
  if (exportedAt < cutoff || exportedAt > latestAllowedTimestamp) {
    return { passed: false, detail: "La preuve mobile est expirée ou datée dans le futur." };
  }
  if (
    report.schema !== "kanab-quest-mobile-manual-review-v3"
    || report.manifestId !== "placard-mobile-manual-2x10-v3"
  ) {
    return {
      passed: false,
      detail: "Preuve mobile obsolète : refaire puis exporter la checklist v3 sur les deux appareils.",
    };
  }
  if (
    !Array.isArray(report.profiles)
    || report.profiles.length !== REQUIRED_MANUAL_MOBILE_PROFILES.length
    || report.summary?.readyForLaunch !== true
    || Number(report.summary?.total) !== 20
    || Number(report.summary?.passed) !== 20
    || Number(report.summary?.failed) !== 0
    || Number(report.summary?.pending) !== 0
    || Number(report.summary?.approvedProfiles) !== 2
  ) {
    return { passed: false, detail: "La preuve mobile v3 n’atteste pas les 20 contrôles obligatoires." };
  }

  const profiles = new Map(report.profiles.map((profile) => [profile?.code, profile]));
  if (profiles.size !== REQUIRED_MANUAL_MOBILE_PROFILES.length) {
    return { passed: false, detail: "La preuve mobile v3 ne contient pas les deux profils physiques attendus." };
  }
  for (const profileCode of REQUIRED_MANUAL_MOBILE_PROFILES) {
    const profile = profiles.get(profileCode);
    if (!profile || !Array.isArray(profile.checks) || profile.checks.length !== REQUIRED_MANUAL_MOBILE_CHECKS.length) {
      return { passed: false, detail: `Checklist incomplète pour le profil ${profileCode}.` };
    }
    const checks = new Map(profile.checks.map((check) => [check?.code, check]));
    if (checks.size !== REQUIRED_MANUAL_MOBILE_CHECKS.length) {
      return { passed: false, detail: `Contrôles mobiles dupliqués ou manquants pour ${profileCode}.` };
    }
    for (const checkCode of REQUIRED_MANUAL_MOBILE_CHECKS) {
      const check = checks.get(checkCode);
      if (check?.status !== "passed") {
        return { passed: false, detail: `Contrôle ${checkCode} non validé pour ${profileCode}.` };
      }
      if (checkCode === "market-controls" && check?.protocolId !== "mobile-market-sale-v2") {
        return { passed: false, detail: `Protocole de vente mobile v2 absent pour ${profileCode}.` };
      }
      if (checkCode === "cart-controls" && check?.protocolId !== "mobile-equipment-purchase-v1") {
        return { passed: false, detail: `Protocole d’achat matériel mobile v1 absent pour ${profileCode}.` };
      }
      const reviewedAt = typeof check?.reviewedAt === "string" ? Date.parse(check.reviewedAt) : Number.NaN;
      if (!Number.isFinite(reviewedAt)) {
        return { passed: false, detail: `Date de contrôle invalide pour ${checkCode} sur ${profileCode}.` };
      }
      if (reviewedAt < cutoff || reviewedAt > latestAllowedTimestamp) {
        return { passed: false, detail: `Contrôle ${checkCode} expiré ou daté dans le futur pour ${profileCode}.` };
      }
    }
  }
  return {
    passed: true,
    detail: "Les 20 contrôles sont validés, dont un achat de matériel et une vente réelle sans double débit sur chaque téléphone.",
  };
}

function executionMatchesPreview(kind, preview, execution) {
  const previewCounts = asRecord(preview.counts);
  const executionCounts = asRecord(execution.counts);
  if (kind === "notebook") {
    return Number(executionCounts.granted ?? 0) === Number(previewCounts.pending ?? 0)
      && Number(executionCounts.alreadyGranted ?? 0) === Number(previewCounts.alreadyGranted ?? 0);
  }
  if (kind === "heritage") {
    return Number(executionCounts.awarded ?? 0) === Number(previewCounts.pendingUnits ?? 0)
      && Number(executionCounts.alreadyAwarded ?? 0) === Number(previewCounts.alreadyAwarded ?? 0);
  }
  return Number(executionCounts.flowerBoostersGranted ?? 0) === Number(previewCounts.pendingFlowerBoosters ?? 0)
    && Number(executionCounts.heritagesGranted ?? 0) === Number(previewCounts.pendingHeritages ?? 0);
}

function assessRetroChain(kind, entries) {
  const candidates = entries.filter(({ report }) => (
    report.schema === "kanab-quest-retro-evidence-v1"
    && report.kind === kind
    && report.gates?.live === true
    && report.gates?.writeAllowed === true
  ));
  const previews = candidates.filter(({ report }) => report.mode === "preview");
  const executions = candidates.filter(({ report }) => report.mode === "execute");
  const sources = [];
  const visited = new Set();
  let cursor = 0;

  for (let step = 0; step < 1_000; step += 1) {
    if (visited.has(cursor)) return { passed: false, sources, detail: "Cycle de curseur détecté." };
    visited.add(cursor);
    const cursorPreviews = previews
      .filter(({ report }) => report.cursor === cursor)
      .sort((left, right) => (reportTimestamp(right.report) ?? 0) - (reportTimestamp(left.report) ?? 0));
    let selected = null;
    for (const previewEntry of cursorPreviews) {
      const preview = previewEntry.report;
      const pending = Number(preview.pending ?? 0);
      if (pending === 0) {
        selected = { previewEntry, executionEntry: null };
        break;
      }
      const executionEntry = latest(executions.filter(({ report }) => (
        report.cursor === cursor
        && report.previewFingerprint === preview.previewFingerprint
        && report.nextCursor === preview.nextCursor
        && executionMatchesPreview(kind, preview, report)
      )));
      if (executionEntry) {
        selected = { previewEntry, executionEntry };
        break;
      }
    }
    if (!selected) {
      return { passed: false, sources, detail: `Preuve complète absente au curseur ${cursor}.` };
    }
    sources.push(sourceSummary(selected.previewEntry));
    if (selected.executionEntry) sources.push(sourceSummary(selected.executionEntry));
    const nextCursor = selected.previewEntry.report.nextCursor;
    if (nextCursor === null) {
      return { passed: true, sources, detail: `${visited.size} lot(s) vérifié(s) jusqu’à la fin.` };
    }
    if (!Number.isSafeInteger(nextCursor) || nextCursor < 0) {
      return { passed: false, sources, detail: "Curseur suivant invalide." };
    }
    cursor = nextCursor;
  }
  return { passed: false, sources, detail: "Chaîne de lots trop longue." };
}

export function analyzePlacardLaunchEvidence(input) {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now());
  const requestedMaxAgeDays = Number(input.maxAgeDays ?? 14);
  const maxAgeDays = Number.isFinite(requestedMaxAgeDays)
    ? Math.max(1, Math.min(90, requestedMaxAgeDays))
    : 14;
  const cutoff = now.getTime() - maxAgeDays * 86_400_000;
  const allReports = (input.reports ?? []).map((entry) => ({
    source: String(entry.source ?? "rapport-inconnu.json"),
    report: asRecord(entry.report),
  }));
  const reports = allReports.flatMap((entry) => {
    const report = asRecord(entry.report);
    const timestamp = reportTimestamp(report);
    return timestamp !== null && timestamp >= cutoff && timestamp <= now.getTime() + 300_000
      ? [{ source: entry.source, report }]
      : [];
  });

  const artwork = latest(reports.filter(({ report }) => {
    const assets = Array.isArray(report.assets) ? report.assets : [];
    const total = assets.length;
    const supportCount = assets.filter((asset) => asset?.group === "support").length;
    const heritageCount = assets.filter((asset) => asset?.group === "heritage").length;
    const situationCount = assets.filter((asset) => asset?.group === "situation").length;
    const equipmentCount = assets.filter((asset) => asset?.group === "equipment").length;
    return report.schema === "kanab-quest-artwork-review-v3"
      && typeof report.manifestId === "string"
      && report.manifestId.startsWith(`artwork-${total}-`)
      && report.summary?.readyForLaunch === true
      && Number(report.summary?.approved) === total
      && Number(report.summary?.pending) === 0
      && Number(report.summary?.rework) === 0
      && Number(report.inventory?.total) === total
      && Number(report.inventory?.heritage) === heritageCount
      && supportCount === 36
      && heritageCount >= 1
      && situationCount === 31
      && equipmentCount === 22
      && total === 89 + heritageCount
      && new Set(assets.map((asset) => asset?.code)).size === total
      && new Set(assets.map((asset) => asset?.src)).size === total
      && assets.every((asset) => asset?.status === "approved" && typeof asset?.src === "string" && asset.src.length > 0);
  }));

  const assessedLoadReports = reports
    .filter(({ report }) => String(report.schema ?? "").startsWith("kanab-quest-load-test-"))
    .map((entry) => ({ ...entry, assessment: assessLoadReport(entry.report) }));
  const load = latest(assessedLoadReports.filter(({ assessment }) => assessment.passed));
  const latestLoadAttempt = latest(assessedLoadReports);

  const mobile = latest(reports.filter(({ report }) => (
    report.schema === "kanab-quest-mobile-audit-v2"
    && report.passed === true
    && Number(report.accounts) >= 2
    && Array.isArray(report.auditedViews)
    && REQUIRED_MOBILE_VIEWS.every((view) => report.auditedViews?.includes(view))
    && report.globalChecks?.viewCoverage === true
  )));

  const manualMobileCandidates = allReports.filter(({ report }) => (
    String(report.schema ?? "").startsWith("kanab-quest-mobile-manual-review-")
    || String(report.manifestId ?? "").startsWith("placard-mobile-manual-")
  ));
  const assessedManualMobile = manualMobileCandidates.map((entry) => ({
    ...entry,
    assessment: assessManualMobileReview(entry.report, cutoff, now.getTime() + 300_000),
  }));
  const manualMobile = latest(assessedManualMobile.filter(({ assessment }) => assessment.passed));
  const latestManualMobileAttempt = latest(assessedManualMobile);

  const smokeChecks = REQUIRED_SMOKE_ACTIONS.map((action) => {
    const evidence = latest(reports.filter(({ report }) => (
      report.schema === "kanab-quest-transaction-smoke-v2"
      && report.action === action
      && report.succeeded === true
      && isLocalHost(String(report.databaseHost ?? ""))
      && (action !== "bot-challenge" || (
        report.checks?.receiptMatchesTarget === true
        && Number.isInteger(Number(report.checks?.challengePoints))
        && Number(report.checks?.challengePoints) > 0
        && Number.isFinite(Number(report.checks?.experienceAwarded))
        && Number(report.checks?.experienceAwarded) > 0
        && report.checks?.seasonPointsConfirmed === true
        && report.checks?.experienceConfirmed === true
        && report.checks?.burnedFlowersConfirmed === true
        && report.checks?.flowerBurnConfirmed === true
        && report.checks?.challengeClaimsSynced === true
        && report.checks?.replayRejected === true
        && report.checks?.noDoubleCreditConfirmed === true
      ))
      && (action !== "market" || (
        report.checks?.replayConfirmed === true
        && report.checks?.masteryMatchedPlan === true
        && report.checks?.receiptMatchesTarget === true
      ))
      && (action !== "equipment" || (
        report.checks?.replayConfirmed === true
        && report.checks?.receiptMatchesTarget === true
        && report.checks?.cashDeltaConfirmed === true
        && report.checks?.inventoryConfirmed === true
        && report.checks?.installationConfirmed === true
        && report.checks?.finalCashConfirmed === true
      ))
    )));
    return {
      code: `smoke-${action}`,
      label: `Smoke test ${action}`,
      passed: Boolean(evidence),
      sources: evidence ? [sourceSummary(evidence)] : [],
      detail: evidence ? "Transaction locale validée." : "Preuve locale valide absente.",
    };
  });

  const retroChecks = REQUIRED_RETRO_KINDS.map((kind) => {
    const chain = assessRetroChain(kind, reports);
    return {
      code: `retro-${kind}`,
      label: `Rétro-attribution ${kind}`,
      ...chain,
    };
  });

  const requirements = [
    {
      code: "artwork-review",
      label: "Revue humaine du socle graphique et des Héritages producteurs actifs",
      passed: Boolean(artwork),
      sources: artwork ? [sourceSummary(artwork)] : [],
      detail: artwork ? "Manifeste intégralement approuvé." : "Rapport intégral approuvé absent.",
    },
    {
      code: "mobile-audit",
      label: "Audit mobile multi-vues et multi-comptes",
      passed: Boolean(mobile),
      sources: mobile ? [sourceSummary(mobile)] : [],
      detail: mobile ? "HUD, catalogue matériel et marché validés." : "Rapport mobile valide absent.",
    },
    {
      code: "load-test",
      label: "Test de charge en lecture seule",
      passed: Boolean(load),
      sources: load ? [sourceSummary(load)] : [],
      detail: load
        ? load.assessment.detail
        : latestLoadAttempt?.assessment.detail ?? "Rapport de charge valide absent.",
    },
    {
      code: "manual-mobile-review",
      label: "Recette humaine sur appareils physiques",
      passed: Boolean(manualMobile),
      sources: manualMobile ? [sourceSummary(manualMobile)] : [],
      detail: manualMobile
        ? manualMobile.assessment.detail
        : latestManualMobileAttempt?.assessment.detail ?? "Preuve complète des deux appareils physiques absente.",
    },
    ...smokeChecks,
    ...retroChecks,
  ];

  return {
    schema: "kanab-quest-launch-evidence-v1",
    generatedAt: now.toISOString(),
    maxAgeDays,
    freshReportCount: reports.length,
    requirements,
    passed: requirements.every((requirement) => requirement.passed),
  };
}
