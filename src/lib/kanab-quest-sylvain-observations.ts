import type { SylvainObservations } from "./kanab-quest-sylvain-guide";

function isObservable(node: Element): boolean {
  for (let element: Element | null = node; element; element = element.parentElement) {
    if (element.matches('[hidden],[inert],[aria-hidden="true"],dialog:not([open])')) return false;
    if (element.matches("details:not([open])") && element !== node) {
      const summary = element.querySelector(":scope > summary");
      if (!summary?.contains(node)) return false;
    }
    const styles = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (styles?.display === "none" || styles?.visibility === "hidden" || styles?.visibility === "collapse") return false;
  }
  return true;
}

const discoveries: { id: string; context: string; evidence?: string }[] = [
  { id: "coverage", context: "[data-coverage-details]:not([data-coverage-details=zone])", evidence: "[data-sylvain-warehouse-room]:not([data-sylvain-warehouse-draft]) [data-coverage-details]:not([data-coverage-details=zone])" },
  { id: "cleaning", context: "[data-warehouse-clean-step]:enabled, [data-sylvain-cleaning-pending]", evidence: "[data-sylvain-seen~=cleaning]" },
  { id: "irrigation", context: "[data-sylvain-irrigation-unprogrammed=true]", evidence: "[data-sylvain-seen~=irrigation]" },
  { id: "inputs", context: "[data-warehouse-inputs] [data-warehouse-input]", evidence: "[data-sylvain-seen~=inputs]" },
  { id: "care", context: "[data-sylvain-run] [data-culture-care]:is([data-expanded=true],[data-critical=true])", evidence: "[data-sylvain-run][data-sylvain-care-confirmed=true]" },
  { id: "zones", context: "[data-coverage-details=zone], [data-warehouse-zone-menu]" },
  { id: "staff", context: "[data-staff-desk][data-guide-staff-ready=true]", evidence: "[data-sylvain-seen~=staff]" },
  { id: "air", context: "[data-warehouse-air-panel]", evidence: "[data-sylvain-seen~=air]" },
  { id: "camera", context: "[data-sylvain-installed-cameras]:not([data-sylvain-installed-cameras='0'])", evidence: "[data-sylvain-seen~=camera]" },
  { id: "alarm", context: "[data-sylvain-alarm=owned]", evidence: "[data-sylvain-seen~=alarm]" },
  { id: "subscription", context: "[data-sylvain-monitoring=suspended][data-sylvain-period-paid=true]", evidence: "[data-sylvain-seen~=subscription]" },
  { id: "harvest", context: "[data-guide-harvest-confirmed], [data-sylvain-seen~=harvest]", evidence: "[data-guide-harvest-confirmed=true], [data-sylvain-seen~=harvest]" },
  { id: "drying", context: "[data-sylvain-warehouse-room=drying] [data-post-harvest=drying]", evidence: "[data-sylvain-warehouse-room=drying][data-sylvain-warehouse-mode=pilotage] [data-post-harvest=drying]" },
  { id: "storage", context: "[data-sylvain-seen~=storage] [data-conservation-lot]", evidence: "[data-sylvain-seen~=storage] :is([data-conservation-lot] time[datetime], [data-guide-curing-ready=true])" },
  { id: "trim", context: "[data-guide-trim-ready=true] [data-guide-trim-state=required], [data-open-trim]", evidence: "[data-guide-trim-ready=true] :is([data-guide-trim-state=queued],[data-guide-trim-state=running],[data-guide-trim-state=complete])" },
  { id: "processing", context: "[data-warehouse-extracts][data-commerce-lot], [data-workshop-machine-dialog]", evidence: "[data-tutorial-observation=processing], [data-sylvain-seen~=processing]" },
  { id: "encyclopedia", context: "[data-cannabis-reference]", evidence: "[data-cannabis-article]" },
  { id: "quiz", context: "[data-school-quiz], [data-school-challenge], [data-school-tournament]", evidence: "[data-school-tournament][data-tutorial-ready=true] [data-tournament-event], [data-quiz-feedback], [data-school-quiz-result], [data-challenge-feedback], [data-guide-school-answered=true]" },
  { id: "quarter", context: "[data-village-season][data-village-phase]", evidence: "[data-village-season][data-village-phase]" },
  { id: "commerce", context: "[data-commerce-lot]:not([data-warehouse-extracts])", evidence: "[data-sylvain-seen~=commerce]" },
  { id: "missions", context: "[data-sylvain-seen~=missions]", evidence: "[data-sylvain-seen~=missions] [data-mission-track]" },
  { id: "cards", context: "[data-sylvain-seen~=cards], [data-buddie-collection-detail]", evidence: "[data-buddie-collection-detail], [data-sylvain-seen~=cards]" },
  { id: "bank", context: "[data-bank-offer], [data-bank-active-loan]", evidence: "[data-sylvain-seen~=bank]" },
  { id: "networks", context: "[data-sylvain-seen~=networks]", evidence: "[data-sylvain-seen~=networks]" },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function hasRunId(value: Record<string, unknown> | undefined): boolean {
  return typeof value?.runId === "string" && value.runId.trim().length > 0;
}

/** Recover account facts from successful official reads, without recording visits. */
export function getLoicHistoricalAchievements(payload: unknown): string[] {
  const data = asRecord(payload);
  if (!data || data.error) return [];
  const runs = Array.isArray(data.activeRuns) ? data.activeRuns : [];
  const hasRun = [data.activeRun, ...runs].some(value => {
    const run = asRecord(value);
    return hasRunId(run) && typeof asRecord(run?.state)?.phase === "string";
  });
  const flowers = Array.isArray(data.flowers) ? data.flowers : [];
  const hasHarvest = flowers.some(value => {
    const flower = asRecord(value);
    return hasRunId(flower) && typeof flower?.id === "string" && flower.id.trim().length > 0;
  });
  if (hasHarvest) return ["install", "prepare", "launch", "harvest"];
  return hasRun ? ["install", "prepare", "launch"] : [];
}

export function readSylvainObservations(root: ParentNode): SylvainObservations {
  function find(selector: string): Element | undefined {
    const element = "nodeType" in root && root.nodeType === 1 ? root as Element : undefined;
    if (element?.matches(selector) && isObservable(element)) return element;
    return Array.from(root.querySelectorAll(selector)).find(isObservable);
  }
  const achieved: string[] = [];
  const relevant: string[] = [];
  const hints: Record<string, string> = {};
  const warehouse = find("[data-sylvain-warehouse-room=culture]");
  const culturePreparation = find("[data-sylvain-culture-setup] [data-culture-buddies]");
  const supplies = find("[data-launch-supplies]");
  const officialRun = find("[data-sylvain-run], [data-sylvain-active-run]");
  const controls = (name: string) => find(`[data-sylvain-target~="${name}"]:not(:disabled):not([aria-disabled=true])`);
  const installedZones = Math.max(...[warehouse, culturePreparation]
    .map(node => Number(node?.getAttribute("data-guide-saved-zone-count") ?? 0)));

  if (warehouse?.getAttribute("data-sylvain-warehouse-mode") === "pilotage") achieved.push("warehouse");
  if (officialRun || installedZones > 0) achieved.push("install");
  if (officialRun || find("[data-sylvain-preparation=ready]")) achieved.push("prepare");
  if (find("[data-launch-supplies] details[open][data-sylvain-supplies-ready=true]")) achieved.push("supplies");
  if (officialRun) achieved.push("launch");
  if (find("[data-warehouse-production][data-sylvain-run], [data-sylvain-run] [data-culture-work-status][data-work-source]")) achieved.push("next");
  if (installedZones > 1) achieved.push("zones");

  if (find("[data-warehouse-sylvain-loading]")) hints.warehouse = "L’entrepôt s’ouvre. Attends l’affichage du plan enregistré et du pilotage.";
  const payable = find("[data-warehouse-plan-payable-cents]");
  const shortfall = find("[data-warehouse-plan-shortfall-cents]");
  if (shortfall?.textContent) hints.install = shortfall.textContent.trim();
  else if (payable?.textContent && (controls("install-confirm") || find("[data-warehouse-cell-save]:enabled"))) {
    hints.install = `Ton devis indique ${payable.textContent.trim()} à payer maintenant. Vérifie les éléments du plan avant d’enregistrer.`;
  } else if (controls("install-placement")) {
    hints.install = "Choisis une case libre pour tracer une zone, ou une zone existante pour y ajouter le matériel.";
  } else if (controls("install-first")) {
    hints.install = "Le plan de départ place les trois zones. Pour choisir toi-même leurs emplacements, ouvre « Ajouter du matériel ». Place un filet du rayon Séchage sur une case libre, puis des bocaux du rayon Stockage sur une autre. Vérifie le devis avant de confirmer.";
  } else if (warehouse?.getAttribute("data-sylvain-warehouse-draft") === "true") {
    hints.install = "Tu as un brouillon. Vérifie les zones, leur éclairage et le montant dans le devis avant d’enregistrer.";
  } else if (Number(warehouse?.getAttribute("data-sylvain-draft-zone-count")) > 0 && !achieved.includes("install")) {
    hints.install = "Une zone est dessinée. Ajoute une lampe, vérifie le devis, puis enregistre pour la mettre en service.";
  }

  if (controls("prepare-pack-open")) hints.prepare = "Tu as un pack prêt à ouvrir. Après avoir découvert tes cartes, choisis Terminer, puis reviens à ta préparation pour choisir un Buddie.";
  else if (controls("prepare-pack-welcome")) hints.prepare = "Récupère ton pack de bienvenue offert, puis ouvre-le pour ajouter tes premiers Buddies à ton album.";
  else if (find("[data-empty-buddie-collection]")) hints.prepare = "Ta collection est vide. Découvre les Packs Buddies, puis reviens affecter une variété à ta zone.";
  else if (find("[data-culture-buddies][aria-busy=true]")) hints.prepare = "L’affectation est en cours d’enregistrement.";
  else if (controls("prepare-choice")) hints.prepare = "Choisis un Buddie disponible dans le carrousel de ta zone.";
  else if (controls("prepare-buddie")) hints.prepare = "Ouvre « Choisir » sur la zone à laquelle tu veux affecter une variété.";
  else if (culturePreparation && !achieved.includes("prepare")) {
    const reason = find("[data-culture-preparation] p[role=status]")?.textContent?.trim();
    if (reason) hints.prepare = reason;
  }
  if (supplies && !controls("supplies")) {
    hints.supplies = supplies.querySelector('[role="alert"]')?.textContent?.trim() || "Attends la vérification des doses avant le semis.";
  }
  const launchReason = find("[data-sylvain-launch-reason]")?.textContent?.trim();
  if (launchReason) hints.launch = launchReason;
  const cleaningPending = find("[data-sylvain-cleaning-pending]")?.getAttribute("data-sylvain-cleaning-pending");
  if (cleaningPending === "vacuum" || cleaningPending === "mop") {
    hints.cleaning = `${cleaningPending === "vacuum" ? "L’aspiration" : "Le lavage"} est en cours. Tu peux quitter l’entrepôt et revenir à l’échéance affichée.`;
  } else if (find("[data-sylvain-cleaning-renew=true]")) hints.cleaning = "L’aspiration a expiré. Tu peux relancer un passage avec l’aspirateur que tu possèdes déjà. L’écran indique les heures et l’échéance du passage.";
  if (find("[data-sylvain-irrigation-unprogrammed=true]")) hints.irrigation = "Aucun mélange n’est en attente pour cette centrale. Consulte tes doses libres avant de préparer un nouveau mélange.";
  if (find("[data-sylvain-installed-cameras='0']")) hints.camera = "Aucune caméra n’est posée. Tu peux consulter son prix et sa portée dans Sécurité.";
  if (find("[data-sylvain-alarm=owned]")) hints.alarm = "L’alarme est en réserve. L’installation à la porte sud est gratuite.";
  if (find("[data-sylvain-monitoring=suspended][data-sylvain-period-paid=true]")) hints.subscription = "La période payée est encore valable. Tu peux reprendre la télésurveillance sans nouveau débit.";

  for (const lesson of discoveries) {
    if (find(lesson.context)) relevant.push(lesson.id);
    if (lesson.evidence && find(lesson.evidence)) achieved.push(lesson.id);
  }
  const personalZoneCount = warehouse?.getAttribute("data-sylvain-eligible-zone-count");
  const explicitInstallRecovery = find("[data-sylvain-culture-recovery=install]");
  const explicitPrepareRecovery = find("[data-sylvain-culture-recovery=prepare]");
  let recovery: SylvainObservations["recovery"];
  if (!officialRun) {
    if (explicitInstallRecovery || personalZoneCount === "0") recovery = "install";
    else if (explicitPrepareRecovery || Number(personalZoneCount) > 0 && warehouse?.getAttribute("data-guide-assigned-zone-count") === "0") recovery = "prepare";
  }
  return { achieved, relevant, hints, recovery };
}
