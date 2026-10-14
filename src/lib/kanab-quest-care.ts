import type { KqGameState, KqOutcome, KqPest, KqSituation } from "./kanab-quest-game";

/** Biological observations are sourced; points, prices and turns are game rules.
 * Cannabinoid percentages below are explicitly fictional game values, never
 * measured cultivar chemistry, real schedules or expected crop responses. */
export type KqCannabinoidFamily = "cbd" | "cbg" | "thc" | "cbdv" | "thcv" | "cbc" | "cbn";
export type KqCannabinoidAnalyte = KqCannabinoidFamily | "cbda" | "cbga" | "thca" | "cbdva" | "thcva" | "cbca" | "cbna";
export type KqCannabinoidRates = Record<KqCannabinoidAnalyte, number>;
export type KqCannabinoidTotals = Record<KqCannabinoidFamily, number>;
export type KqCannabinoidProfile = { code: string; name: string; targets: KqCannabinoidTotals };
/** Seven families (14 compounds + 7 calculated totals) offered by LABEXAN.
 * This is a game panel, not a COFRAC-accredited report. A laboratory's actual
 * accredited scope is narrower and must be checked against its current annex.
 * Acid factors account for CO2 mass lost from the corresponding molecule;
 * they are not application coefficients or instructions for processing. */
export const KQ_CANNABINOID_FAMILIES: readonly {
  code: KqCannabinoidFamily; name: string; neutralCode: KqCannabinoidFamily;
  acidCode: KqCannabinoidAnalyte; neutralLabel: string; acidLabel: string; acidFactor: number;
}[] = [
  { code: "cbd", name: "CBD", neutralCode: "cbd", acidCode: "cbda", neutralLabel: "CBD", acidLabel: "CBDA", acidFactor: 0.877 },
  { code: "cbg", name: "CBG", neutralCode: "cbg", acidCode: "cbga", neutralLabel: "CBG", acidLabel: "CBGA", acidFactor: 0.878 },
  { code: "thc", name: "Δ9-THC", neutralCode: "thc", acidCode: "thca", neutralLabel: "Δ9-THC", acidLabel: "THCA", acidFactor: 0.877 },
  { code: "cbdv", name: "CBDV", neutralCode: "cbdv", acidCode: "cbdva", neutralLabel: "CBDV", acidLabel: "CBDVA", acidFactor: 0.867 },
  { code: "thcv", name: "THCV", neutralCode: "thcv", acidCode: "thcva", neutralLabel: "THCV", acidLabel: "THCVA", acidFactor: 0.867 },
  { code: "cbc", name: "CBC", neutralCode: "cbc", acidCode: "cbca", neutralLabel: "CBC", acidLabel: "CBCA", acidFactor: 0.877 },
  { code: "cbn", name: "CBN", neutralCode: "cbn", acidCode: "cbna", neutralLabel: "CBN", acidLabel: "CBNA", acidFactor: 0.876 },
];
/** Primary sources support genetic influence and the distinction between
 * concentration and biomass. None supplies these fictional numerical targets. */
export const KQ_CANNABINOID_SOURCES = [
  "https://pubmed.ncbi.nlm.nih.gov/33103246/",
  "https://pubmed.ncbi.nlm.nih.gov/32322682/",
  "https://www.mdpi.com/2073-4395/10/3/372",
  "https://www.nature.com/articles/s41598-025-96761-6",
  "https://www.labexan.com/produits-cbd/",
  "https://tools.cofrac.fr/annexes/sect1/1-5810.pdf",
  "https://pubmed.ncbi.nlm.nih.gov/28861498/",
  "https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2020.583605/full",
] as const;
const CANNABINOID_GAME_PROFILES: readonly KqCannabinoidProfile[] = [
  { code: "GAME-CBD-SOFT", name: "Profil fictif — CBD doux", targets: { cbd: 8, cbg: 0.8, thc: 0.12, cbdv: 0.15, thcv: 0.02, cbc: 0.25, cbn: 0 } },
  { code: "GAME-CBD-ROUND", name: "Profil fictif — CBD rond", targets: { cbd: 12, cbg: 1.1, thc: 0.18, cbdv: 0.5, thcv: 0.03, cbc: 0.4, cbn: 0 } },
  { code: "GAME-CBD-CBG", name: "Profil fictif — CBD, nuances CBG", targets: { cbd: 10, cbg: 3, thc: 0.15, cbdv: 0.08, thcv: 0.01, cbc: 0.3, cbn: 0 } },
  { code: "GAME-CBD-RICH", name: "Profil fictif — CBD ample", targets: { cbd: 16, cbg: 0.6, thc: 0.25, cbdv: 0.12, thcv: 0.04, cbc: 0.45, cbn: 0 } },
];
/** Stable fictional identity. Deliberately independent of rarity and run seed. */
export function getKqCannabinoidProfile(varietyCode: string): KqCannabinoidProfile {
  let hash = 2166136261;
  for (const character of varietyCode) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const profile = CANNABINOID_GAME_PROFILES[(hash >>> 0) % CANNABINOID_GAME_PROFILES.length];
  return { ...profile, targets: { ...profile.targets } };
}
export function getKqCannabinoidReport(state: Pick<KqGameState, "varietyCode" | "care" | "cultivationProfile">) {
  const profile: KqCannabinoidProfile = state.cultivationProfile
    ? { code: `GAME-BUDDIE-V1-${state.cultivationProfile.buddieCode}`, name: "Profil fictif du Buddie",
      targets: { ...state.cultivationProfile.cannabinoidTargets } }
    : getKqCannabinoidProfile(state.varietyCode);
  const expression = state.care?.cannabinoidExpression ?? 55;
  const score = Math.round(Math.min(99, Math.max(35, Number.isFinite(expression) ? expression : 55)));
  const conversion = Math.min(20, Math.max(0, state.care?.cannabinoidConversion ?? 5)) / 100;
  const oxidation = Math.min(20, Math.max(0, state.care?.cannabinoidOxidation ?? 0)) / 100;
  const precise = (value: number) => Math.round(value * 10000) / 10000;
  const rates = {} as KqCannabinoidRates;
  const totals = {} as KqCannabinoidTotals;
  for (const family of KQ_CANNABINOID_FAMILIES) {
    const potential = profile.targets[family.code] * score / 99;
    rates[family.neutralCode] = potential * conversion;
    rates[family.acidCode] = potential * (1 - conversion) / family.acidFactor;
  }
  // A bounded fictional aging transfer. Only existing THC is consumed, with
  // the molecular mass difference accounted for; no new potential is created.
  const degradedThc = rates.thc * oxidation;
  rates.thc -= degradedThc;
  rates.cbn += degradedThc * (310.44 / 314.47);
  const degradedThca = rates.thca * oxidation;
  rates.thca -= degradedThca;
  rates.cbna += degradedThca * (354.45 / 358.48);
  for (const family of KQ_CANNABINOID_FAMILIES) {
    rates[family.neutralCode] = precise(rates[family.neutralCode]);
    rates[family.acidCode] = precise(rates[family.acidCode]);
    totals[family.code] = precise(rates[family.neutralCode] + family.acidFactor * rates[family.acidCode]);
  }
  return { profile, rates, totals, score, simulated: true as const };
}

/** Fictional total and sensory notes; legacy cultures retain their index only. */
export function getKqTerpeneReport(state: Pick<KqGameState, "care" | "cultivationProfile">) {
  if (!state.cultivationProfile) return undefined;
  const expression = state.care?.terpenes ?? 55;
  const score = Math.round(Math.min(99, Math.max(35, Number.isFinite(expression) ? expression : 55)));
  return {
    potentialPercent: state.cultivationProfile.terpenePotentialPercent,
    totalPercent: Math.round(state.cultivationProfile.terpenePotentialPercent * score / 99 * 10_000) / 10_000,
    score,
    notes: [...state.cultivationProfile.terpeneNotes],
    simulated: true as const,
  };
}

export type KqTerpeneReport = NonNullable<ReturnType<typeof getKqTerpeneReport>>;

export type KqCareProduct = {
  code: string; kind: "input" | "pbi"; name: string; priceCents: number;
  description: string; sourceUrl: string; targets: string[];
  /** Fictional severity reductions at the first and second operation checks. */
  pbi?: { role: string; reductions: readonly [number, number] };
};
export const KQ_CARE_PRODUCTS: KqCareProduct[] = [
  { code: "CARE-COMPOST-TEA", kind: "input", name: "Thé de compost", priceCents: 900, description: "Soutien conditionnel du sol. Une opération réussie auprès de racines fragiles active un bénéfice limité ; aucun rendement garanti.", sourceUrl: "https://www.mdpi.com/2223-7747/10/8/1638", targets: ["roots"] },
  { code: "CARE-VERMICOMPOST", kind: "input", name: "Lombricompost", priceCents: 1400, description: "Amendement organique, inspiré de Worm·Humus. Accompagne progressivement un trouble nutritif identifié dans la simulation.", sourceUrl: "https://biobizz.com/products/worm-humus", targets: ["nutrition"] },
  { code: "CARE-ORGANIC-FEED", kind: "input", name: "Engrais organique", priceCents: 1600, description: "Inspiré de Bio·Grow et Bio·Bloom. Un apport pertinent et une opération réussie peuvent soutenir la production. Incompatible avec un stress salin.", sourceUrl: "https://biobizz.com/products/bio-grow", targets: ["nutrition"] },
  { code: "CARE-SEAWEED", kind: "input", name: "Extrait d’algues", priceCents: 1200, description: "Inspiré d’Alg·A·Mic. Soutien modeste face au stress, sans restauration des pertes déjà subies.", sourceUrl: "https://biobizz.com/products/alg-a-mic", targets: ["stress"] },
  { code: "CARE-APHIDIUS", kind: "pbi", name: "Aphidius colemani", priceCents: 1200, description: "Parasitoïde de certaines espèces de pucerons. Option économique : contient le foyer au premier bilan, puis réduit sa gravité de 2 niveaux au second dans le jeu.", sourceUrl: "https://www.koppert.fr/aphipar/", targets: ["aphids"], pbi: { role: "Économique · action différée", reductions: [0, 2] } },
  { code: "CARE-PHYTOSEIULUS", kind: "pbi", name: "Phytoseiulus persimilis", priceCents: 1400, description: "Prédateur spécialisé des tétranyques. Contient le foyer puis réduit sa gravité de 2 niveaux au second bilan de jeu. Application bloquée tant qu’un stress thermique est présent.", sourceUrl: "https://www.koppert.fr/spidex/", targets: ["mites"], pbi: { role: "Spécialiste des tétranyques", reductions: [0, 2] } },
  { code: "CARE-SWIRSKII", kind: "pbi", name: "Amblyseius swirskii", priceCents: 1100, description: "Prédateur notamment des jeunes larves de thrips. Option économique pour les petits foyers : contention puis baisse de 1 niveau au second bilan de jeu.", sourceUrl: "https://www.koppert.fr/swirski-mite/", targets: ["thrips"], pbi: { role: "Économique · petits foyers", reductions: [0, 1] } },
  { code: "CARE-ORIUS", kind: "pbi", name: "Orius laevigatus", priceCents: 1800, description: "Prédateur des larves et adultes de thrips. Plus coûteux, mais plus fort sur un foyer installé : contention puis baisse de 2 niveaux au second bilan de jeu.", sourceUrl: "https://www.koppert.fr/thripor-l/", targets: ["thrips"], pbi: { role: "Action forte · foyer installé", reductions: [0, 2] } },
  { code: "CARE-CHRYSOPERLA", kind: "pbi", name: "Chrysoperla carnea", priceCents: 1400, description: "Ses larves consomment des pucerons et certains thrips. Une charge peut suivre ces deux foyers ensemble : contention puis baisse de 1 niveau chacun au second bilan de jeu. Ne couvre pas tous les stades de tous les thrips.", sourceUrl: "https://www.koppert.fr/chrysopa/", targets: ["aphids", "thrips"], pbi: { role: "Polyvalent · deux cibles", reductions: [0, 1] } },
  { code: "CARE-COCCINELLA", kind: "pbi", name: "Coccinelle à sept points", priceCents: 1600, description: "Coccinella septempunctata, prédatrice de pucerons, utile sur les colonies installées. Renfort rapide : baisse de 1 niveau au premier bilan, puis de 2 au second dans le jeu. Aucun effet avant validation.", sourceUrl: "https://ephytia.inrae.fr/fr/C/20817/Biocontrol-Coccinella-septempunctata", targets: ["aphids"], pbi: { role: "Renfort rapide · dès le premier bilan", reductions: [1, 2] } },
];
export const getKqCareProduct = (code: string) => KQ_CARE_PRODUCTS.find(product => product.code === code);
export type KqCareProblemDefinition = {
  code: string; name: string; family: "nutrition" | "pest" | "stress";
  target: string; symptoms: readonly [string, string]; sourceUrl: string;
};
const nutritionSource = "https://www.mdpi.com/2076-3417/9/20/4432";
export const KQ_CARE_PROBLEMS: KqCareProblemDefinition[] = [
  { code: "NITROGEN", name: "Carence en azote", family: "nutrition", target: "nutrition", symptoms: ["Le feuillage ancien pâlit progressivement.", "Le jaunissement s’étend avec une croissance ralentie."], sourceUrl: nutritionSource },
  { code: "PHOSPHORUS", name: "Carence en phosphore", family: "nutrition", target: "nutrition", symptoms: ["La croissance ralentit et certaines feuilles anciennes se marquent.", "Des zones abîmées apparaissent sur le feuillage ancien."], sourceUrl: nutritionSource },
  { code: "POTASSIUM", name: "Carence en potassium", family: "nutrition", target: "nutrition", symptoms: ["Les bordures des feuilles anciennes jaunissent.", "Des lésions progressent depuis le bord des feuilles."], sourceUrl: nutritionSource },
  { code: "MAGNESIUM", name: "Carence en magnésium", family: "nutrition", target: "nutrition", symptoms: ["Les nervures contrastent avec le tissu pâli des feuilles anciennes.", "Le pâlissement entre les nervures gagne du terrain."], sourceUrl: nutritionSource },
  { code: "CALCIUM", name: "Carence en calcium", family: "nutrition", target: "nutrition", symptoms: ["Les jeunes feuilles présentent des déformations.", "Des tissus jeunes se dégradent et la croissance devient irrégulière."], sourceUrl: nutritionSource },
  { code: "IRON", name: "Carence en fer", family: "nutrition", target: "nutrition", symptoms: ["Les jeunes feuilles pâlissent entre les nervures.", "Le jeune feuillage devient nettement plus clair."], sourceUrl: nutritionSource },
  { code: "APHIDS", name: "Foyer de pucerons", family: "pest", target: "aphids", symptoms: ["De petits insectes groupés sont visibles sous le feuillage.", "Les colonies persistent et de nouvelles feuilles se déforment."], sourceUrl: "https://ipm.ucanr.edu/PMG/PESTNOTES/pn7404.html" },
  { code: "MITES", name: "Foyer de tétranyques", family: "pest", target: "mites", symptoms: ["De fines ponctuations apparaissent sur les feuilles.", "Les ponctuations s’étendent et de fins fils deviennent visibles."], sourceUrl: "https://ipm.ucanr.edu/PMG/PESTNOTES/pn7405.html" },
  { code: "THRIPS", name: "Foyer de thrips", family: "pest", target: "thrips", symptoms: ["Des plages argentées marquent le feuillage.", "De nouvelles stries et de petits points sombres sont observés."], sourceUrl: "https://ipm.ucanr.edu/PMG/PESTNOTES/pn7429.html" },
  { code: "ROOTS", name: "Stress racinaire", family: "stress", target: "roots", symptoms: ["La motte reste humide et la pousse ralentit.", "Un jaunissement accompagne la mauvaise aération racinaire."], sourceUrl: "https://extension.umn.edu/agriculture/crop-production/small-grains/wheat-flooding-and-waterlogging" },
  { code: "SALTS", name: "Accumulation de sels", family: "stress", target: "stress", symptoms: ["Des dépôts clairs et des pointes abîmées appellent une vérification.", "Le flétrissement persiste malgré un substrat humide."], sourceUrl: "https://www.extension.umd.edu/resource/excess-fertilizer-or-salt-damage-flowers" },
  { code: "HEAT", name: "Stress thermique", family: "stress", target: "stress", symptoms: ["Le feuillage perd temporairement sa tenue pendant l’épisode chaud.", "Certaines parties exposées restent abîmées après le retour au calme."], sourceUrl: "https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat" },
];
export const getKqCareProblem = (code: string) => KQ_CARE_PROBLEMS.find(problem => problem.code === code);
export type KqCareProblem = { code: string; severity: 1 | 2 | 3; status: "suspected" | "confirmed"; trend: "worsening" | "stable" | "recovering"; appearedAt: number; variant: 0 | 1 };
export type KqCareIntervention = { productCode: string; stageIndex: number; remainingSteps: number; status: "installing" | "active" };
export type KqCareEvent = { stageIndex: number; kind: "observation" | "intervention" | "resolution"; message: string; vitalityDelta: number; terpenesDelta: number; cannabinoidDelta?: number; productCode?: string };
export type KqCareState = {
  version: 1; vitality: number; terpenes: number; cannabinoidExpression: number;
  cannabinoidConversion: number; cannabinoidOxidation: number; yieldBonusPercent: number; yieldLossPercent: number;
  problems: KqCareProblem[]; interventions: KqCareIntervention[];
  applications: { productCode: string; stageIndex: number }[];
  lastBasicCareStage: number | null; history: KqCareEvent[];
};
export const KQ_CARE_SEVERITY_LABELS = { 1: "Léger", 2: "Marqué", 3: "Critique" } as const;
export const KQ_CARE_TREND_LABELS = { worsening: "S’aggrave", stable: "Stabilisé", recovering: "En récupération" } as const;
/** Per-operation game cost. The transaction layer charges before saving care. */
export const KQ_BASIC_CARE_PRICE_CENTS = 500;
/** Ambient surprises stop at two ongoing problems. Explicit situations remain
 * visible, up to one new problem per living-plant stage (five in total).
 * Keep the persistence ceiling aligned with kq_care_state_valid in SQL. */
export const KQ_CARE_MAX_PROBLEMS = 5;
export function createKqCareState(): KqCareState {
  return { version: 1, vitality: 100, terpenes: 55, cannabinoidExpression: 55, cannabinoidConversion: 5, cannabinoidOxidation: 0, yieldBonusPercent: 0, yieldLossPercent: 0, problems: [], interventions: [], applications: [], lastBasicCareStage: null, history: [] };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const appendEvent = (care: KqCareState, event: KqCareEvent): KqCareState => ({ ...care, history: [...care.history, event].slice(-48) });
const interventionStage = (state: KqGameState) => state.stageIndex + Number(state.phase === "resolved");
const permission = (allowed: boolean, reason: string) => ({ allowed, reason });
function canIntervene(state: KqGameState) {
  if (state.rulesVersion !== 3 || !state.care) return permission(false, "Cette culture conserve ses règles historiques.");
  if (state.phase === "complete" || state.cultureDead) return permission(false, "Cette culture est terminée.");
  if (interventionStage(state) >= 5) return permission(false, "Après récolte, le suivi concerne la conservation du lot.");
  return permission(true, "Disponible entre les opérations ; le prochain bilan applique les effets.");
}
export function canApplyKqCareProduct(state: KqGameState, code: string) {
  const access = canIntervene(state);
  if (!access.allowed || !state.care) return access;
  const product = getKqCareProduct(code);
  if (!product) return permission(false, "Produit inconnu.");
  const stageIndex = interventionStage(state);
  if (state.care.interventions.some(item => item.productCode === code)) return permission(false, "Cette intervention est encore active.");
  if (state.care.applications.some(item => item.productCode === code && item.stageIndex === stageIndex)) return permission(false, "Déjà utilisé pour ce bilan.");
  if (state.care.interventions.length >= 4) return permission(false, "Quatre interventions sont déjà en cours. Attends le prochain bilan.");
  if (state.care.applications.length >= 12) return permission(false, "Le nombre maximal d’interventions de cette culture est atteint.");
  if (product.kind === "input") {
    const inputs = state.care.applications.filter(item => getKqCareProduct(item.productCode)?.kind === "input");
    if (inputs.length >= 2) return permission(false, "Deux apports maximum par culture.");
    if (inputs.some(item => item.stageIndex === stageIndex)) return permission(false, "Un seul intrant par bilan.");
    if (inputs.some(item => item.productCode === code)) return permission(false, "Cet intrant a déjà été utilisé dans cette culture.");
    if (code === "CARE-ORGANIC-FEED" && state.care.problems.some(item => item.code === "SALTS")) return permission(false, "Un stress salin est présent : cet apport est inadapté.");
  } else {
    if (stageIndex >= 4) return permission(false, "Trop tard pour une nouvelle PBI : ses deux bilans doivent tenir avant la fin de la récolte. La charge reste en réserve.");
    if (code === "CARE-PHYTOSEIULUS" && state.care.problems.some(item => item.code === "HEAT")) return permission(false, "Stress thermique actif : Phytoseiulus ne peut pas s’installer. Attends le rétablissement ; la charge reste en réserve.");
    const targets = state.care.problems.map(item => getKqCareProblem(item.code)?.target);
    if (!product.targets.some(target => targets.includes(target))) return permission(false, "Aucun foyer compatible observé dans cette culture.");
    if (state.care.interventions.some(item => {
      const active = getKqCareProduct(item.productCode);
      return active?.kind === "pbi" && active.targets.some(target => product.targets.includes(target));
    })) return permission(false, "Un auxiliaire agit déjà sur cette cible ; attendre son bilan.");
  }
  return permission(true, product.pbi
    ? `Une charge, deux bilans. ${product.pbi.reductions[0] ? "Recul du foyer dès le premier bilan." : "Installation puis recul du foyer au second bilan."}`
    : "Une charge sera consommée. Effet suivi aux prochaines validations.");
}
export function applyKqCareProduct(state: KqGameState, code: string): KqGameState {
  if (!canApplyKqCareProduct(state, code).allowed || !state.care) return state;
  const product = getKqCareProduct(code)!;
  const stageIndex = interventionStage(state);
  const care = appendEvent({ ...state.care,
    applications: [...state.care.applications, { productCode: code, stageIndex }],
    interventions: [...state.care.interventions, { productCode: code, stageIndex, remainingSteps: product.kind === "pbi" || code === "CARE-VERMICOMPOST" ? 2 : 1, status: "installing" }],
  }, { stageIndex, kind: "intervention", message: `${product.name} : intervention engagée, bilan à la prochaine validation.`, vitalityDelta: 0, terpenesDelta: 0, productCode: code });
  return { ...state, care };
}
export function canPerformKqBasicCare(state: KqGameState) {
  const access = canIntervene(state);
  if (!access.allowed) return access;
  if (state.care?.lastBasicCareStage === interventionStage(state)) return permission(false, "Entretien déjà activé pour cette étape.");
  return permission(true, "Entretien payant, une fois par étape : accompagne la récupération au prochain bilan, sans dé supplémentaire.");
}
export function performKqBasicCare(state: KqGameState): KqGameState {
  if (!state.care || !canPerformKqBasicCare(state).allowed) return state;
  const stageIndex = interventionStage(state);
  return { ...state, care: appendEvent({ ...state.care, lastBasicCareStage: stageIndex }, { stageIndex, kind: "intervention", message: "Entretien engagé pour cette étape : surveillance et entretien, effet au prochain bilan.", vitalityDelta: 0, terpenesDelta: 0 }) };
}

/** Entering a stage reveals an observation once. Reading the panel never advances it. */
export function observeKqCareStage(state: KqGameState, situation: KqSituation): KqGameState {
  if (state.rulesVersion !== 3 || !state.care || state.stageIndex >= 5) return state;
  const { care, stageIndex } = state;
  if (care.history.some(item => item.kind === "observation" && item.stageIndex === stageIndex)) return state;
  // Avalanche both the seed and stage before choosing a family: a linear
  // generator whose multiplier is divisible by five biases the family draw.
  let choice = state.seed ^ Math.imul(stageIndex + 13, 0x9e3779b9);
  choice = Math.imul(choice ^ (choice >>> 16), 0x85ebca6b);
  choice = Math.imul(choice ^ (choice >>> 13), 0xc2b2ae35);
  choice = (choice ^ (choice >>> 16)) >>> 0;
  const explicit = situation.pest?.toUpperCase()
    ?? ({ "SIT-017": "ROOTS", "SIT-018": "ROOTS", "SIT-020": "ROOTS", "SIT-044": "SALTS", "SIT-004": "HEAT", "SIT-045": "HEAT" } as Record<string, string>)[situation.code];
  const recentTrouble = care.history.some(item => item.kind === "resolution" && item.stageIndex === stageIndex - 1 && item.vitalityDelta <= -15);
  // This seeded draw is independent of the situation card and of real elapsed
  // time. One observation per stage, with recovery room after a difficult check.
  const ambientFamily = choice % 5 === 0 ? "nutrition" : choice % 5 === 1 ? "pest" : undefined;
  const candidates = KQ_CARE_PROBLEMS.filter(item => item.family === ambientFamily && !care.problems.some(problem => problem.code === item.code));
  const ambient = stageIndex >= 1 && stageIndex <= 3 && !recentTrouble && care.problems.length < 2 && candidates.length
    ? candidates[(choice >>> 4) % candidates.length].code : undefined;
  const candidate = explicit ?? ambient;
  const definition = candidate ? getKqCareProblem(candidate) : undefined;
  const canAdd = definition && care.problems.length < KQ_CARE_MAX_PROBLEMS && !care.problems.some(item => item.code === definition.code);
  const problem: KqCareProblem | undefined = canAdd ? { code: definition.code, severity: 1, status: definition.family === "pest" ? "confirmed" : "suspected", trend: "stable", appearedAt: stageIndex, variant: (choice % 2) as 0 | 1 } : undefined;
  return { ...state, care: appendEvent({ ...care, problems: problem ? [...care.problems, problem] : care.problems }, { stageIndex, kind: "observation", message: problem && definition ? definition.symptoms[problem.variant] : care.problems.length ? "Le suivi reprend les foyers présents ; aucun nouveau trouble observé." : "Observation calme : aucun problème actif détecté.", vitalityDelta: 0, terpenesDelta: 0 }) };
}

/** One deterministic health tick per resolved operation; no additional random roll. */
export function resolveKqCareStage(state: KqGameState, situation: KqSituation, outcome: KqOutcome, relevantOperation: boolean): KqCareState | undefined {
  if (state.rulesVersion !== 3 || !state.care) return state.care;
  const care = state.care;
  const won = outcome === "success" || outcome === "critical";
  const biological = !situation.incident && !situation.tags.some(tag => tag === "compliance" || tag === "security" || tag === "energy");
  const lot = state.stageIndex >= 5;
  const basic = care.lastBasicCareStage === state.stageIndex;
  const active = care.interventions.filter(item => item.stageIndex <= state.stageIndex && item.remainingSteps > 0);
  let support = 0;
  let yieldBonus = care.yieldBonusPercent;
  const notes: string[] = [];
  for (const intervention of active) {
    const product = getKqCareProduct(intervention.productCode)!;
    if (product.kind !== "input" || lot) continue;
    const compatible = product.targets.some(target => care.problems.some(problem => {
      const definition = getKqCareProblem(problem.code)!;
      return target === definition.target || target === definition.family;
    })) || (product.code === "CARE-COMPOST-TEA" && situation.tags.includes("roots"));
    if (!compatible) { notes.push(`${product.name} : soutien non activé, aucune situation compatible.`); continue; }
    if (product.code === "CARE-SEAWEED") support += 3;
    else if (won) {
      support += 2;
      yieldBonus = Math.min(10, yieldBonus + (product.code === "CARE-ORGANIC-FEED" ? 5 : 2));
    } else if (outcome === "fragile") support += 1;
    notes.push(`${product.name} : ${won || product.code === "CARE-SEAWEED" ? "soutien activé" : "bénéfice limité par le résultat"}.`);
  }
  let damage = 0;
  const problems = lot ? [] : care.problems.flatMap(problem => {
    const definition = getKqCareProblem(problem.code)!;
    const pbi = active.find(item => {
      const product = getKqCareProduct(item.productCode)!;
      return product.kind === "pbi" && product.targets.includes(definition.target);
    });
    const blockedPbi = pbi?.productCode === "CARE-PHYTOSEIULUS" && care.problems.some(item => item.code === "HEAT");
    const pbiEstablished = Boolean(pbi && !blockedPbi);
    // Every auxiliary contains damage while establishing. The predatory
    // ladybird also reduces severity at its first check; application itself
    // never changes a problem. These levels are game balance, not efficacy data.
    const pbiReduction = pbiEstablished && pbi
      ? getKqCareProduct(pbi.productCode)?.pbi?.reductions[pbi.status === "installing" ? 0 : 1] ?? 0 : 0;
    const nutritionHelp = definition.family === "nutrition" && active.some(item => getKqCareProduct(item.productCode)?.targets.includes("nutrition"));
    const operationHelp = biological && won && (basic || relevantOperation || situation.tags.includes(definition.family === "pest" ? "pest" : definition.target === "roots" ? "roots" : "climate"));
    const reduction = pbiReduction + Number(operationHelp || (nutritionHelp && won));
    const increase = biological && outcome === "failure" && !basic && !pbiEstablished ? 1 : 0;
    const nextSeverity = problem.severity + increase - reduction;
    if (pbi) notes.push(`${getKqCareProduct(pbi.productCode)!.name} · ${definition.name} : ${blockedPbi ? "action perturbée par le stress thermique" : pbiReduction ? `recul de ${pbiReduction} niveau${pbiReduction > 1 ? "x" : ""} au bilan` : "installation et contention du foyer"}.`);
    if (nextSeverity <= 0) { notes.push(`${definition.name} : problème résorbé ; les pertes antérieures restent enregistrées.`); return []; }
    damage += Math.max(0, problem.severity * 3 - Number(pbiEstablished) * 3 - Number(basic) * 2);
    return [{ ...problem, severity: clamp(nextSeverity, 1, 3) as 1 | 2 | 3, status: "confirmed" as const, trend: reduction > 0 ? "recovering" as const : increase > 0 ? "worsening" as const : "stable" as const }];
  });
  const operationDelta = biological ? outcome === "critical" ? 7 : won ? 4 : outcome === "fragile" ? -4 : -16 : 0;
  const vitality = lot ? care.vitality : clamp(care.vitality + operationDelta - damage + support + (basic ? 3 : 0) + (biological && won && relevantOperation ? 2 : 0), 0, 100);
  // Aromatic expression develops in flowering and is preserved at harvest/drying;
  // general vitality is not used as a substitute for a terpene measurement.
  const aromatic = biological && state.stageIndex >= 3;
  const terpDelta = aromatic ? (outcome === "critical" ? 10 : won ? 7 : outcome === "fragile" ? -2 : -8) + (won && relevantOperation ? 2 : 0) : 0;
  const terpenes = clamp(care.terpenes + terpDelta, 35, 99);
  // Fidelity to the fictional genetic potential, not a competition for THC.
  // Inputs never increase this expression directly. An operation's outcome,
  // maturation and preservation are the only game contributions.
  const cannabinoidDelta = aromatic ? lot ? (outcome === "failure" ? -5 : outcome === "fragile" ? -2 : 0)
    : (outcome === "critical" ? 20 : won ? 14 : outcome === "fragile" ? 0 : -5) + (won && relevantOperation ? 2 : 0) : 0;
  const cannabinoidExpression = clamp(care.cannabinoidExpression + cannabinoidDelta, 35, 99);
  // These percentages are abstract game-state coefficients. They represent
  // postharvest redistribution and aging, not real temperature/time settings.
  const cannabinoidConversion = lot && biological ? clamp(care.cannabinoidConversion + (outcome === "critical" ? 2 : won ? 3 : outcome === "fragile" ? 6 : 10), 0, 20) : care.cannabinoidConversion;
  const cannabinoidOxidation = lot && biological ? clamp(care.cannabinoidOxidation + (outcome === "failure" ? 8 : outcome === "fragile" ? 3 : 0), 0, 20) : care.cannabinoidOxidation;
  if (lot && biological) notes.push("Répartition acides/neutres modifiée dans le lot ; un taux neutre en hausse ne signifie pas un gain de qualité.");
  if (cannabinoidOxidation > care.cannabinoidOxidation) notes.push("Vieillissement du profil : formation simulée de CBN/CBNA à partir d’une partie du THC/THCA, sans bonus de qualité.");
  const yieldLossPercent = lot ? care.yieldLossPercent : clamp(care.yieldLossPercent + (biological && outcome === "failure" ? 3 : 0) + (damage >= 8 ? 2 : 0), 0, 40);
  const next = { ...care, vitality, terpenes, cannabinoidExpression, cannabinoidConversion, cannabinoidOxidation, yieldBonusPercent: yieldBonus, yieldLossPercent, problems,
    interventions: lot ? [] : active.filter(item => item.remainingSteps > 1).map(item => ({ ...item, remainingSteps: item.remainingSteps - 1, status: "active" as const })) };
  return appendEvent(next, { stageIndex: state.stageIndex, kind: "resolution", message: `${lot ? "État du lot" : "Vitalité"} : ${vitality - care.vitality >= 0 ? "+" : ""}${vitality - care.vitality}. Expression des terpènes : ${terpenes - care.terpenes >= 0 ? "+" : ""}${terpenes - care.terpenes}. Expression cannabinoïde : ${cannabinoidExpression - care.cannabinoidExpression >= 0 ? "+" : ""}${cannabinoidExpression - care.cannabinoidExpression}. ${notes.join(" ")}`.trim(), vitalityDelta: vitality - care.vitality, terpenesDelta: terpenes - care.terpenes, cannabinoidDelta: cannabinoidExpression - care.cannabinoidExpression });
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const int = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
export function isKqCareState(value: unknown): value is KqCareState {
  if (!record(value) || value.version !== 1 || !int(value.vitality, 0, 100) || !int(value.terpenes, 35, 99) || !int(value.cannabinoidExpression, 35, 99)
    || !int(value.cannabinoidConversion, 0, 20) || !int(value.cannabinoidOxidation, 0, 20)
    || !int(value.yieldBonusPercent, 0, 10) || !int(value.yieldLossPercent, 0, 40)
    || !(value.lastBasicCareStage === null || int(value.lastBasicCareStage, 0, 4))) return false;
  if (!Array.isArray(value.problems) || value.problems.length > KQ_CARE_MAX_PROBLEMS || value.problems.some(item => !record(item)
    || !getKqCareProblem(String(item.code)) || !int(item.severity, 1, 3) || !int(item.appearedAt, 0, 4) || !int(item.variant, 0, 1)
    || !["suspected", "confirmed"].includes(String(item.status)) || !["worsening", "stable", "recovering"].includes(String(item.trend)))) return false;
  if (new Set(value.problems.map(item => item.code)).size !== value.problems.length) return false;
  if (!Array.isArray(value.applications) || value.applications.length > 12 || value.applications.some(item => !record(item) || !getKqCareProduct(String(item.productCode)) || !int(item.stageIndex, 0, 4))) return false;
  if (new Set(value.applications.map(item => `${item.productCode}:${item.stageIndex}`)).size !== value.applications.length) return false;
  const inputs = value.applications.filter(item => getKqCareProduct(item.productCode)?.kind === "input");
  if (inputs.length > 2 || new Set(inputs.map(item => item.productCode)).size !== inputs.length || new Set(inputs.map(item => item.stageIndex)).size !== inputs.length) return false;
  if (!Array.isArray(value.interventions) || value.interventions.length > 4 || value.interventions.some(item => !record(item)
    || !getKqCareProduct(String(item.productCode)) || !int(item.stageIndex, 0, 4) || !int(item.remainingSteps, 1, 2)
    || !["installing", "active"].includes(String(item.status))
    || !(value.applications as Record<string, unknown>[]).some(application => application.productCode === item.productCode && application.stageIndex === item.stageIndex))) return false;
  if (new Set(value.interventions.map(item => item.productCode)).size !== value.interventions.length) return false;
  if (!Array.isArray(value.history) || value.history.length > 48 || value.history.some(item => !record(item)
    || !int(item.stageIndex, 0, 5) || !["observation", "intervention", "resolution"].includes(String(item.kind))
    || typeof item.message !== "string" || item.message.length > 3000 || !int(item.vitalityDelta, -100, 100)
    || !int(item.terpenesDelta, -64, 64) || (item.cannabinoidDelta !== undefined && !int(item.cannabinoidDelta, -64, 64))
    || (item.productCode !== undefined && !getKqCareProduct(String(item.productCode))))) return false;
  return true;
}

/** Cards retained in historical albums but replaced by the permanent health panel. */
export const KQ_CARE_LEGACY_CARD_PRODUCTS: Record<string, string> = {
  "BOTTE-002": "CARE-CHRYSOPERLA", "BOTTE-010": "CARE-COCCINELLA", "BOTTE-011": "CARE-SWIRSKII",
  "BOTTE-012": "CARE-APHIDIUS", "BOTTE-022": "CARE-PHYTOSEIULUS", "BOTTE-023": "CARE-ORIUS",
};
export const KQ_CARE_REPLACED_CARD_CODES = ["BOTTE-004", "BOTTE-025", ...Object.keys(KQ_CARE_LEGACY_CARD_PRODUCTS)];
export function isKqCareReplacedCard(code: string) { return (KQ_CARE_REPLACED_CARD_CODES as readonly string[]).includes(code); }
export const KQ_CARE_PEST_LABELS: Record<KqPest, string> = { aphids: "Pucerons", mites: "Tétranyques", thrips: "Thrips" };
