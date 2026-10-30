import type { KqHubAttentionNotice, KqHubAttentionResult } from "./kanab-quest-hub-attention";

export type KqPlacardHubDestination = "game" | "storage" | "arena" | "market" | "shop";

export type KqPlacardNextAction = {
  destination: KqPlacardHubDestination;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
};

type KqPlacardResumeAction = Omit<KqPlacardNextAction, "destination"> & {
  destination: KqPlacardHubDestination | "treasury";
  options?: KqHubAttentionNotice["options"];
};

export type KqPlacardHubSnapshot = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  curingFlowerCount?: number;
};

export function getKqPlacardNextAction(input: KqPlacardHubSnapshot & { equipmentGoalAffordable?: boolean }): KqPlacardNextAction {
  if (input.activeRun) {
    return {
      destination: "game",
      eyebrow: "Culture en cours",
      title: "Reprends là où tu t’es arrêté",
      description: "Ta partie officielle est sauvegardée. Termine la prochaine étape avant de préparer une autre culture.",
      buttonLabel: "Reprendre",
    };
  }
  if (input.readyLotCount > 0) {
    return {
      destination: "market",
      eyebrow: "Activité prête",
      title: `${input.readyLotCount} lot${input.readyLotCount > 1 ? "s" : ""} à valoriser`,
      description: "Le jury a rendu son verdict. Choisis maintenant entre vente brute, transformation ou biomasse.",
      buttonLabel: "Vendre mes lots",
    };
  }
  if (input.availableFlowerCount > 0) {
    return {
      destination: "arena",
      eyebrow: "Fleur disponible",
      title: "Présente ta fleur au jury",
      description: `${input.availableFlowerCount} Fleur${input.availableFlowerCount > 1 ? "s sont prêtes" : " est prête"} après affinage à passer devant le jury, face à un adversaire tiré au hasard.`,
      buttonLabel: "Entrer dans la file",
    };
  }
  if ((input.curingFlowerCount ?? 0) > 0) {
    return {
      destination: "storage",
      eyebrow: "Affinage en cours",
      title: "Ta récolte s’affine avant le jury",
      description: `${input.curingFlowerCount} lot${input.curingFlowerCount! > 1 ? "s sont" : " est"} en affinage. Consulte le rangement et l’heure de disponibilité de chaque lot.`,
      buttonLabel: "Ouvrir le stockage",
    };
  }
  return {
    destination: "game",
    eyebrow: "Prochaine récolte",
    title: "Lance une nouvelle culture",
    description: "Choisis ton mode de culture, ton Buddie et tes cartes Botte du Chanvrier, puis construis un lot assez bon pour ta réputation.",
    buttonLabel: "Préparer la culture",
  };
}

/** Server evidence used by the resume card; dates are never inferred from a visit. */
export type KqPlacardResumeStorage = {
  serverNow: string;
  lots: readonly {
    flowerStatus: string;
    projection: {
      stage: "curing" | "ready";
      readyAt: string;
      capacity?: { overflowUnits: number; overflowDeadlineAt: string | null; automaticOverflowSale?: boolean };
    };
  }[];
};
export type KqPlacardResume = {
  primary: KqPlacardResumeAction | null;
  kind: "storage" | "culture" | "market" | "jury" | "curing" | "new-culture" | "finance" | "sales" | "unknown";
  tone: "attention" | "ready" | "waiting" | "unknown";
  facts: string[];
  factActions: KqHubAttentionNotice[];
  attentionStatus: string | null;
  canRefreshAttention: boolean;
};

export type KqPlacardResumeAttention = {
  finance: KqHubAttentionResult | null;
  sales: KqHubAttentionResult | null;
  loading: boolean;
};

const realDate = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
}).format(new Date(date));

export function getKqPlacardResume(snapshot: KqPlacardHubSnapshot | null, storage: KqPlacardResumeStorage | null, attention?: KqPlacardResumeAttention): KqPlacardResume {
  const exposed = storage?.lots.filter(lot => typeof lot.projection.capacity?.overflowUnits === "number" && lot.projection.capacity.overflowUnits > 0) ?? [];
  const overflowUnits = exposed.reduce((total, lot) => total + lot.projection.capacity!.overflowUnits, 0);
  const serverNow = storage ? Date.parse(storage.serverNow) : NaN;
  const curingLots = storage?.lots.filter(lot => lot.flowerStatus === "available" && lot.projection.stage === "curing") ?? [];
  const curingCount = Math.max(snapshot?.curingFlowerCount ?? 0, curingLots.length);
  // A missing allocation or an incomplete/stale pair of responses cannot mean "all stored".
  const timingKnown = curingCount > 0 && curingLots.length === curingCount
    && (snapshot?.curingFlowerCount === undefined || snapshot.curingFlowerCount === curingCount)
    && curingLots.every(lot => Number.isFinite(Date.parse(lot.projection.readyAt)) && Date.parse(lot.projection.readyAt) > serverNow);
  const protectedCuring = timingKnown && curingLots.every(lot => lot.projection.capacity?.overflowUnits === 0);
  const readyAt = timingKnown ? curingLots.map(lot => lot.projection.readyAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0] : null;
  const waitingDescription = readyAt
    ? `${protectedCuring ? `${curingCount === 1 ? "Ce lot est rangé" : "Ces lots sont rangés"}. L’affinage avance automatiquement.` : "Le rangement reste à vérifier."} ${curingCount === 1 ? "Fin prévue" : "Premier lot prêt"} le ${realDate(readyAt)} (heure de Paris).`
    : "Le rangement et l’heure de fin ne sont pas confirmés. Consulte le stockage pour vérifier tes lots ; l’accès au jury reste validé par le serveur.";

  let primary: KqPlacardResumeAction | null = null;
  let kind: KqPlacardResume["kind"] = "unknown";
  let tone: KqPlacardResume["tone"] = "unknown";
  if (overflowUnits > 0) {
    kind = "storage"; tone = "attention";
    const deadlines = exposed.flatMap(lot => {
      const capacity = lot.projection.capacity!;
      return capacity.automaticOverflowSale !== false && capacity.overflowDeadlineAt && Number.isFinite(Date.parse(capacity.overflowDeadlineAt)) ? [capacity.overflowDeadlineAt] : [];
    }).sort((a, b) => Date.parse(a) - Date.parse(b));
    primary = {
      destination: "storage", eyebrow: "À protéger",
      title: `${(overflowUnits / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sans contenant`,
      description: `Volume en équivalent fleurs. ${deadlines[0] ? `Prochaine vente automatique au grossiste prévue le ${realDate(deadlines[0])} (heure de Paris).` : "Consulte les lots exposés et leurs conditions de stockage."}`,
      buttonLabel: "Ranger mes récoltes",
    };
  } else if (snapshot) {
    primary = getKqPlacardNextAction({ ...snapshot, curingFlowerCount: curingCount });
    kind = snapshot.activeRun ? "culture" : snapshot.readyLotCount > 0 ? "market" : snapshot.availableFlowerCount > 0 ? "jury" : curingCount > 0 ? "curing" : "new-culture";
    tone = "ready";
    if (kind === "curing") {
      tone = protectedCuring ? "waiting" : "unknown";
      primary = { ...primary, eyebrow: protectedCuring ? "Attente automatique" : "Affinage à vérifier",
        title: protectedCuring ? curingCount === 1 ? "Ta récolte s’affine" : "Tes récoltes s’affinent" : "Vérifie le suivi de tes récoltes",
        description: waitingDescription, buttonLabel: protectedCuring ? "Voir l’affinage" : "Vérifier le stockage" };
    }
  }

  // Exposure is always first. Confirmed debt and blocked sales then precede
  // ordinary activity; a future invoice does not interrupt a playable loop.
  const finance = attention?.finance?.notice;
  const sales = attention?.sales?.notice;
  let selectedNotice: KqHubAttentionNotice | null = null;
  if (kind !== "storage") {
    if (finance?.severity === "urgent") selectedNotice = finance;
    else if (sales) selectedNotice = sales;
    else if (finance && (kind === "new-culture" || tone === "waiting" || primary === null)) selectedNotice = finance;
  }
  if (selectedNotice) {
    kind = selectedNotice.destination === "treasury" ? "finance" : "sales";
    tone = selectedNotice.severity === "upcoming" ? "ready" : "attention";
    primary = { destination: selectedNotice.destination, options: selectedNotice.options,
      eyebrow: selectedNotice.severity === "upcoming" ? "Échéance à préparer" : kind === "finance" ? "Échéance atteinte" : "Ventes à vérifier",
      title: selectedNotice.title, description: selectedNotice.description, buttonLabel: selectedNotice.buttonLabel };
  }

  const factActions = [finance, sales].filter((notice): notice is KqHubAttentionNotice => Boolean(notice && notice !== selectedNotice))
    .sort((left, right) => Number(left.severity === "upcoming") - Number(right.severity === "upcoming"));
  const facts: string[] = factActions.map(notice => notice.summary);
  if (!snapshot) facts.push("Le suivi des activités est indisponible ; aucune activité n’est supposée terminée.");
  if (!storage && kind !== "curing") facts.push("Le rangement des récoltes n’a pas pu être vérifié.");
  if (snapshot?.activeRun && kind !== "culture") facts.push("Ta culture est sauvegardée et prête à reprendre.");
  if (snapshot && snapshot.readyLotCount > 0 && kind !== "market") facts.push(`${snapshot.readyLotCount} lot${snapshot.readyLotCount > 1 ? "s prêts" : " prêt"} à vendre dans Commerce.`);
  if (snapshot && snapshot.availableFlowerCount > 0 && kind !== "jury") facts.push(`${snapshot.availableFlowerCount} Fleur${snapshot.availableFlowerCount > 1 ? "s d’Arène prêtes" : " d’Arène prête"} pour le jury.`);
  if (curingCount > 0 && kind !== "curing") facts.push(protectedCuring && readyAt ? `Affinage automatique : ${curingCount} lot${curingCount > 1 ? "s rangés" : " rangé"}, ${curingCount > 1 ? "première fin" : "fin"} le ${realDate(readyAt)} (Paris).` : readyAt ? `Affinage : fin prévue le ${realDate(readyAt)} (Paris), rangement à vérifier.` : `${curingCount} lot${curingCount > 1 ? "s" : ""} en affinage ; rangement et échéance à vérifier.`);
  const missingFinance = attention && attention.finance?.complete !== true;
  const missingSales = attention && attention.sales?.complete !== true;
  const attentionStatus = !attention ? null : attention.loading ? "Factures et ventes en cours de vérification."
    : missingFinance && missingSales ? "Le suivi des factures et des ventes reste à vérifier."
    : missingFinance ? "Le suivi des factures reste partiel."
    : missingSales ? "Le suivi des ventes reste à vérifier." : null;
  const canRefreshAttention = Boolean(attention && !attention.loading && (missingFinance || missingSales));
  if (attentionStatus && !canRefreshAttention) facts.push(attentionStatus);
  // Failed or partial reads must retain their recovery command even on busy accounts.
  const visibleFacts = canRefreshAttention && attentionStatus ? [...facts.slice(0, 1), attentionStatus] : facts.slice(0, 2);
  return { primary, kind, tone, facts: visibleFacts,
    factActions: factActions.filter(notice => visibleFacts.includes(notice.summary)), attentionStatus,
    canRefreshAttention };
}
