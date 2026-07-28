export const PLACARD_TOTAL_DAYS = 9;
export const PLACARD_DRYING_DAY = 7;
export const PLACARD_CURING_DAY = 8;

export type PlacardAction =
  | "inspect-canopy"
  | "measured-irrigation"
  | "renew-air"
  | "adjust-light"
  | "check-drainage"
  | "climate-control"
  | "canopy-training"
  | "sanitary-scouting"
  | "check-runoff"
  | "space-flowers"
  | "control-drying-air"
  | "inspect-drying"
  | "stabilize-storage"
  | "vent-containers"
  | "sensory-check";

export type PlacardSetup = {
  code: "eco" | "balanced" | "performance";
  name: string;
  description: string;
  light: number;
  airflow: number;
  water: number;
  sobrietyBonus: number;
};

export type PlacardDailyEvent = {
  code: "stable" | "humid" | "warm" | "cool";
  label: string;
  description: string;
  waterDelta: number;
  airflowDelta: number;
  lightDelta: number;
};

export type PlacardVariety = {
  code: string;
  name: string;
  cardNumber: number;
  rarity: "common" | "silver" | "gold" | "epic";
  difficulty: 1 | 2 | 3;
  aroma: string;
  description: string;
  traits: {
    vigor: number;
    resilience: number;
    aroma: number;
    efficiency: number;
  };
};

export type PlacardCultureState = {
  varietyCode: string;
  setupCode: PlacardSetup["code"];
  day: number;
  health: number;
  vigor: number;
  water: number;
  airflow: number;
  light: number;
  stress: number;
  biomass: number;
  aromaPotential: number;
  observationBonus: number;
  seed: number;
  history: Array<{
    day: number;
    action: PlacardAction;
    eventCode?: PlacardDailyEvent["code"];
    eventLabel?: string;
    summary: string;
  }>;
  harvested: boolean;
};

export type PlacardBiologicalIndicator = {
  code: "water-status" | "root-activity" | "leaf-function" | "canopy" | "sanitary-pressure" | "maturity";
  label: string;
  status: string;
  detail: string;
  value: number;
  tone: "good" | "watch" | "alert" | "neutral";
};

export type PlacardActionAssessment = {
  level: "recommended" | "situational" | "poor-window";
  reason: string;
  advantage: string;
  drawback: string;
};

export type PlacardQuickStatus = {
  code: "water" | "comfort" | "form";
  label: string;
  value: string;
  emoji: string;
  tone: "good" | "watch" | "alert";
};

export const PLACARD_SETUPS: PlacardSetup[] = [
  {
    code: "eco",
    name: "Économe",
    description: "Peu énergivore, mais demande davantage d’attention.",
    light: 46,
    airflow: 48,
    water: 54,
    sobrietyBonus: 10,
  },
  {
    code: "balanced",
    name: "Équilibrée",
    description: "Une installation stable pour découvrir une variété.",
    light: 54,
    airflow: 55,
    water: 58,
    sobrietyBonus: 3,
  },
  {
    code: "performance",
    name: "Performance",
    description: "Plus de ressources et de potentiel, avec moins de sobriété.",
    light: 68,
    airflow: 63,
    water: 60,
    sobrietyBonus: -8,
  },
];

const PLACARD_DAILY_EVENTS: PlacardDailyEvent[] = [
  { code: "stable", label: "Climat stable", description: "Le placard conserve son équilibre aujourd’hui.", waterDelta: 0, airflowDelta: 0, lightDelta: 0 },
  { code: "humid", label: "Air humide", description: "L’humidité ralentit le renouvellement de l’air.", waterDelta: 3, airflowDelta: -7, lightDelta: 0 },
  { code: "warm", label: "Journée chaude", description: "La plante consomme davantage d’eau sous la lampe.", waterDelta: -7, airflowDelta: -2, lightDelta: 3 },
  { code: "cool", label: "Nuit fraîche", description: "La demande en eau baisse légèrement.", waterDelta: 4, airflowDelta: 2, lightDelta: -3 },
];

export type PlacardHarvest = {
  aspect: number;
  nose: number;
  complexity: number;
  cleanliness: number;
  sobriety: number;
  comboBonus: number;
  combos: PlacardCombo[];
  total: number;
};

export type PlacardCombo = {
  code: "full-hand" | "observer" | "clean-grow" | "eco-master";
  label: string;
  description: string;
  bonus: number;
};

export const PLACARD_VARIETIES: PlacardVariety[] = [
  {
    code: "HH2026-003",
    name: "Cannatonic",
    cardNumber: 3,
    rarity: "epic",
    difficulty: 2,
    aroma: "Terreux · boisé",
    description: "Polyvalente et expressive quand son environnement reste équilibré.",
    traits: { vigor: 72, resilience: 70, aroma: 82, efficiency: 68 },
  },
  {
    code: "HH2026-005",
    name: "ACDC",
    cardNumber: 5,
    rarity: "gold",
    difficulty: 3,
    aroma: "Citronnelle · épices",
    description: "Potentiel aromatique élevé, mais demande une conduite attentive.",
    traits: { vigor: 65, resilience: 61, aroma: 90, efficiency: 72 },
  },
  {
    code: "HH2026-014",
    name: "Sour Tsunami",
    cardNumber: 14,
    rarity: "silver",
    difficulty: 2,
    aroma: "Agrumes · diesel",
    description: "Vigoureuse, stable et adaptée à une première compétition.",
    traits: { vigor: 80, resilience: 77, aroma: 76, efficiency: 75 },
  },
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value * 10) / 10));

function seededNoise(seed: number, day: number) {
  const x = Math.sin(seed * 12.9898 + day * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function getPlacardDailyEvent(seed: number, day: number) {
  const normalized = (seed * 31 + day * 17) % 100;
  if (normalized < 42) return PLACARD_DAILY_EVENTS[0];
  if (normalized < 62) return PLACARD_DAILY_EVENTS[1];
  if (normalized < 82) return PLACARD_DAILY_EVENTS[2];
  return PLACARD_DAILY_EVENTS[3];
}

const PLACARD_ACTIONS: PlacardAction[] = [
  "inspect-canopy",
  "measured-irrigation",
  "renew-air",
  "adjust-light",
  "check-drainage",
  "climate-control",
  "canopy-training",
  "sanitary-scouting",
  "check-runoff",
];

const PLACARD_POST_HARVEST_ACTIONS: PlacardAction[] = [
  "space-flowers",
  "control-drying-air",
  "inspect-drying",
  "stabilize-storage",
  "vent-containers",
  "sensory-check",
];

export function getPlacardActionHand(state: Pick<PlacardCultureState, "seed" | "day" | "water">) {
  return state.day >= PLACARD_DRYING_DAY ? [...PLACARD_POST_HARVEST_ACTIONS] : [...PLACARD_ACTIONS];
}

export function assessPlacardAction(state: PlacardCultureState, action: PlacardAction): PlacardActionAssessment {
  const tradeoffs: Record<PlacardAction, { advantage: string; drawback: string }> = {
    "inspect-canopy": { advantage: "Précise le diagnostic pendant deux tours.", drawback: "N’améliore directement ni l’eau ni le climat." },
    "measured-irrigation": { advantage: "Rapproche la réserve hydrique de sa cible sans la dépasser.", drawback: state.water > 68 ? "Sur substrat humide, le tour est presque perdu." : "Ne corrige ni l’air ni la lumière." },
    "renew-air": { advantage: "Améliore les échanges et réduit la pression liée à l’humidité.", drawback: "L’effet décroît dès le tour suivant et ne corrige pas l’eau." },
    "adjust-light": { advantage: "Ramène la lumière vers la cible propre au stade.", drawback: "Un réglage inutile consomme le tour sans traiter le stress racinaire." },
    "check-drainage": { advantage: "Repère puis réduit un excès d’eau dans la zone racinaire.", drawback: state.water <= 66 ? "Apporte peu si le substrat draine déjà correctement." : "Ne restaure pas une réserve trop sèche." },
    "climate-control": { advantage: "Rapproche l’extraction de la cible du stade.", drawback: "N’agit que sur l’air ; l’eau et la lampe restent inchangées." },
    "canopy-training": { advantage: "Répartit les apex, la lumière et la circulation d’air.", drawback: state.day >= 2 && state.day <= 4 ? "Provoque un léger stress temporaire." : "Hors croissance, le stress dépasse souvent le bénéfice." },
    "sanitary-scouting": { advantage: "Peut détecter tôt un problème dans les zones denses ou humides.", drawback: "Action préventive : aucun gain de croissance immédiat." },
    "check-runoff": { advantage: "Évite une correction nutritive faite à l’aveugle.", drawback: "Mesurer ne produit pas de biomasse et peut confirmer qu’aucune action n’est requise." },
    "space-flowers": { advantage: "Rend la circulation d’air plus homogène dans le lot.", drawback: state.day === PLACARD_DRYING_DAY ? "Ne réduit pas instantanément l’humidité interne." : "Apporte peu une fois le lot conditionné." },
    "control-drying-air": { advantage: "Modère le flux d’air et protège le lot de la lumière.", drawback: "Un réglage trop tardif ne récupère pas les arômes déjà perdus." },
    "inspect-drying": { advantage: "Repère les écarts entre le centre et l’extérieur du lot.", drawback: "Observe l’évolution sans modifier directement les conditions." },
    "stabilize-storage": { advantage: "Protège le lot par un air modéré et davantage d’obscurité.", drawback: state.day < PLACARD_CURING_DAY ? "Son plein effet commence surtout pendant l’affinage." : "Ne retire pas rapidement un excès d’humidité." },
    "vent-containers": { advantage: "Évacue une partie de l’humidité accumulée en contenant.", drawback: state.day < PLACARD_CURING_DAY ? "Le lot n’est pas encore prêt à être conditionné." : "Une intervention inutile peut accélérer le dessèchement." },
    "sensory-check": { advantage: "Consigne l’évolution du toucher et du profil aromatique.", drawback: "N’agit pas sur le climat et apporte peu si le profil est encore instable." },
  };
  const recommended = (reason: string): PlacardActionAssessment => ({ level: "recommended", reason, ...tradeoffs[action] });
  const situational = (reason: string): PlacardActionAssessment => ({ level: "situational", reason, ...tradeoffs[action] });
  const poorWindow = (reason: string): PlacardActionAssessment => ({ level: "poor-window", reason, ...tradeoffs[action] });
  const event = getPlacardDailyEvent(state.seed, state.day);

  switch (action) {
    case "measured-irrigation":
      return state.water < 48 ? recommended("La réserve hydrique devient limitante.") : state.water > 68 ? poorWindow("Le substrat contient déjà trop d’eau.") : situational("La réserve est encore disponible.");
    case "renew-air":
      return state.airflow < 50 || event.code === "humid" ? recommended("Le renouvellement d’air est insuffisant ou l’air est humide.") : situational("La circulation d’air est déjà correcte.");
    case "adjust-light": {
      const target = state.day <= 2 ? 50 : state.day <= 5 ? 64 : 58;
      return Math.abs(state.light - target) >= 10 ? recommended("La lumière s’écarte nettement de la cible du stade.") : situational("La lumière est proche de la cible actuelle.");
    }
    case "check-drainage":
      return state.water > 66 ? recommended("Un excès d’eau justifie un contrôle du drainage.") : situational("Utile pour confirmer l’état de la zone racinaire.");
    case "climate-control":
      return state.airflow < 48 || state.airflow > 75 ? recommended("Le climat sort de sa zone de fonctionnement stable.") : situational("Le climat ne montre pas de dérive majeure.");
    case "canopy-training":
      return state.day >= 2 && state.day <= 4 ? recommended("La plante est dans sa fenêtre de structuration.") : poorWindow("La structure répond peu à cette intervention à ce stade.");
    case "sanitary-scouting":
      return event.code === "humid" || state.stress > 25 || state.airflow < 48 ? recommended("Les conditions augmentent le besoin d’inspection.") : situational("Aucun signal fort, mais l’inspection reste préventive.");
    case "check-runoff":
      return state.stress > 22 || state.water > 70 ? recommended("Le stress ou l’humidité justifie une mesure avant toute correction.") : situational("Mesure de contrôle, sans déséquilibre évident.");
    case "inspect-canopy":
      return state.observationBonus === 0 ? recommended("Aucun diagnostic approfondi n’est actuellement actif.") : situational("Une observation récente reste valable.");
    case "space-flowers":
      return state.day === PLACARD_DRYING_DAY ? recommended("L’espacement est déterminant au début du séchage.") : poorWindow("Le lot est déjà entré en affinage.");
    case "control-drying-air":
      return state.day === PLACARD_DRYING_DAY || state.airflow < 48 || state.light > 42 ? recommended("Le séchage demande un air modéré et peu de lumière.") : situational("Les conditions sont déjà proches de la cible.");
    case "inspect-drying":
      return recommended("Comparer plusieurs zones limite les erreurs de jugement.");
    case "stabilize-storage":
      return state.day >= PLACARD_CURING_DAY ? recommended("Le lot entre dans sa phase de stockage et d’affinage.") : situational("Prépare la phase suivante sans effet maximal immédiat.");
    case "vent-containers":
      return state.day >= PLACARD_CURING_DAY && state.water > 42 ? recommended("Le lot conserve encore une humidité élevée en contenant.") : state.day < PLACARD_CURING_DAY ? poorWindow("Le lot n’est pas encore conditionné.") : situational("L’humidité ne signale pas d’urgence.");
    case "sensory-check":
      return state.day >= PLACARD_CURING_DAY ? recommended("Le profil du lot peut maintenant être comparé et consigné.") : situational("Le profil évolue encore rapidement pendant le séchage.");
  }
}

export function getPlacardPhase(day: number) {
  if (day <= 1) return "Installation";
  if (day === 2) return "Enracinement";
  if (day <= 4) return "Croissance";
  if (day === 5) return "Transition";
  if (day === 6) return "Floraison";
  if (day === PLACARD_DRYING_DAY) return "Séchage";
  if (day === PLACARD_CURING_DAY) return "Affinage";
  return "Prête au concours";
}

export function getPlacardQuickStatus(state: PlacardCultureState): PlacardQuickStatus[] {
  const postHarvest = state.day >= PLACARD_DRYING_DAY;
  const water = postHarvest
    ? state.water > 62 ? { value: "Encore humide", emoji: "💧", tone: "watch" as const } : state.water < 30 ? { value: "Trop sec", emoji: "🍂", tone: "alert" as const } : { value: "Évolution régulière", emoji: "👌", tone: "good" as const }
    : state.water < 40 ? { value: "A soif", emoji: "💧", tone: "alert" as const } : state.water > 72 ? { value: "Trop arrosée", emoji: "🌊", tone: "watch" as const } : { value: "Bien hydratée", emoji: "👌", tone: "good" as const };
  const comfortScore = state.stress + Math.max(0, 48 - state.airflow) * 0.7;
  const comfort = comfortScore > 38
    ? { value: "Sous pression", emoji: "😵", tone: "alert" as const }
    : comfortScore > 20 ? { value: "A surveiller", emoji: "😓", tone: "watch" as const }
      : { value: "Confortable", emoji: "😊", tone: "good" as const };
  const formScore = postHarvest ? state.aromaPotential : state.health * 0.65 + state.vigor * 0.35;
  const form = formScore >= 78
    ? { value: postHarvest ? "Arômes préservés" : "En pleine forme", emoji: "✨", tone: "good" as const }
    : formScore >= 55 ? { value: "Correcte", emoji: "🌿", tone: "watch" as const }
      : { value: "Fragile", emoji: "🥀", tone: "alert" as const };

  return [
    { code: "water", label: postHarvest ? "Humidité" : "Eau", ...water },
    { code: "comfort", label: "Confort", ...comfort },
    { code: "form", label: postHarvest ? "Qualité" : "Forme", ...form },
  ];
}

export function getPlacardBiologicalReport(state: PlacardCultureState): PlacardBiologicalIndicator[] {
  if (state.day >= PLACARD_DRYING_DAY) {
    const dryingProgress = clamp(((state.day - (PLACARD_DRYING_DAY - 1)) / 3) * 100);
    const moistureControl = clamp(100 - Math.abs(state.water - (state.day === PLACARD_DRYING_DAY ? 46 : 38)) * 2.1);
    const aromaPreservation = clamp(state.aromaPotential - Math.max(0, state.light - 42) * 0.7 - state.stress * 0.25);
    const postHarvestRisk = clamp(Math.max(0, state.water - 55) * 1.2 + Math.max(0, 48 - state.airflow) + state.stress * 0.35);
    return [
      {
        code: "water-status", label: "Humidité résiduelle", value: moistureControl,
        status: state.water > 62 ? "Encore élevée" : state.water > 38 ? "En diminution" : "Faible et homogène",
        detail: "Le suivi porte désormais sur la perte d’humidité de la récolte, plus sur l’irrigation.",
        tone: state.water > 68 ? "alert" : state.water > 48 ? "watch" : "good",
      },
      {
        code: "root-activity", label: "Homogénéité du lot", value: clamp((moistureControl + state.airflow) / 2),
        status: state.airflow >= 48 && state.airflow <= 68 ? "Séchage régulier" : "Écart à corriger",
        detail: "L’espacement et un air modéré évitent que certaines zones évoluent plus vite que d’autres.",
        tone: state.airflow >= 48 && state.airflow <= 68 ? "good" : "watch",
      },
      {
        code: "leaf-function", label: "Préservation aromatique", value: aromaPreservation,
        status: aromaPreservation >= 72 ? "Bien préservée" : aromaPreservation >= 52 ? "À surveiller" : "Dégradation probable",
        detail: state.light > 42 ? "Une exposition lumineuse excessive pénalise la conservation aromatique." : "L’obscurité et une évolution progressive protègent le profil du lot.",
        tone: aromaPreservation >= 70 ? "good" : aromaPreservation >= 50 ? "watch" : "alert",
      },
      {
        code: "canopy", label: "Structure du lot", value: clamp(state.biomass / 1.05),
        status: state.day === PLACARD_DRYING_DAY ? "Fleurs espacées" : "Lot conditionné",
        detail: "La densité du lot influence la circulation de l’air et la régularité du séchage.",
        tone: "neutral",
      },
      {
        code: "sanitary-pressure", label: "Risque post-récolte", value: postHarvestRisk,
        status: postHarvestRisk < 22 ? "Faible" : postHarvestRisk < 46 ? "À surveiller" : "Élevé",
        detail: "Le risque augmente lorsque l’humidité reste élevée avec un renouvellement d’air insuffisant.",
        tone: postHarvestRisk < 22 ? "good" : postHarvestRisk < 46 ? "watch" : "alert",
      },
      {
        code: "maturity", label: "Progression", value: dryingProgress,
        status: getPlacardPhase(state.day), detail: `Jour ${state.day} sur ${PLACARD_TOTAL_DAYS} du cycle simulé.`, tone: "neutral",
      },
    ];
  }

  const phaseLightTarget = state.day <= 2 ? 50 : state.day <= 5 ? 64 : state.day <= 6 ? 58 : 38;
  const waterBalance = clamp(100 - Math.abs(state.water - 58) * 2.4);
  const rootActivity = clamp(state.health * 0.5 + waterBalance * 0.35 + (100 - state.stress) * 0.15);
  const leafFunction = clamp(state.health * 0.35 + waterBalance * 0.25 + (100 - Math.abs(state.light - phaseLightTarget) * 2.2) * 0.4);
  const canopyProgress = clamp(state.biomass / 1.05);
  const sanitaryPressure = clamp(state.stress * 0.5 + Math.max(0, 52 - state.airflow) * 1.15 + Math.max(0, state.water - 70) * 0.8);
  const maturity = clamp(((state.day - 1) / (PLACARD_TOTAL_DAYS - 1)) * 100);

  const waterStatus = state.water < 38
    ? { status: "Déficit marqué", detail: "Réserve faible : croissance et échanges foliaires sont limités.", tone: "alert" as const }
    : state.water < 50
      ? { status: "Dessèchement en cours", detail: "La réserve baisse ; une irrigation mesurée devient pertinente.", tone: "watch" as const }
      : state.water <= 68
        ? { status: "Réserve disponible", detail: "Le substrat reste dans une zone hydrique favorable.", tone: "good" as const }
        : { status: "Substrat trop humide", detail: "L’excès d’eau peut freiner l’oxygénation de la zone racinaire.", tone: "alert" as const };

  return [
    { code: "water-status", label: "État hydrique", value: waterBalance, ...waterStatus },
    {
      code: "root-activity", label: "Activité racinaire", value: rootActivity,
      status: rootActivity >= 75 ? "Active" : rootActivity >= 52 ? "Fonctionnelle" : "Ralentie",
      detail: state.water > 70 ? "L’humidité élevée réduit l’aération du substrat." : "Estimation fondée sur l’eau, le stress et l’état général.",
      tone: rootActivity >= 70 ? "good" : rootActivity >= 48 ? "watch" : "alert",
    },
    {
      code: "leaf-function", label: "Fonction foliaire", value: leafFunction,
      status: leafFunction >= 78 ? "Échanges efficaces" : leafFunction >= 55 ? "Activité correcte" : "Activité limitée",
      detail: Math.abs(state.light - phaseLightTarget) > 14 ? "La lumière est éloignée de la cible de cette phase." : "Lumière et réserve hydrique soutiennent la canopée.",
      tone: leafFunction >= 72 ? "good" : leafFunction >= 50 ? "watch" : "alert",
    },
    {
      code: "canopy", label: "Architecture", value: canopyProgress,
      status: state.day <= 2 ? "Implantation" : state.biomass < 28 ? "Canopée ouverte" : state.biomass < 55 ? "Canopée en construction" : "Canopée structurée",
      detail: state.day >= 2 && state.day <= 4 ? "Fenêtre favorable au palissage et à la répartition des apex." : "La structure reflète la biomasse et le stade atteints.",
      tone: "neutral",
    },
    {
      code: "sanitary-pressure", label: "Pression sanitaire", value: sanitaryPressure,
      status: sanitaryPressure < 22 ? "Faible" : sanitaryPressure < 46 ? "À surveiller" : "Élevée",
      detail: state.airflow < 48 ? "Le faible renouvellement d’air augmente la vigilance nécessaire." : "Aucun signal majeur issu du climat et du stress.",
      tone: sanitaryPressure < 22 ? "good" : sanitaryPressure < 46 ? "watch" : "alert",
    },
    {
      code: "maturity", label: "Développement", value: maturity,
      status: getPlacardPhase(state.day),
      detail: `Jour ${state.day} sur ${PLACARD_TOTAL_DAYS} du cycle simulé.`,
      tone: "neutral",
    },
  ];
}

export function startPlacardCulture(
  varietyCode: string,
  seed = Date.now(),
  setupCode: PlacardSetup["code"] = "balanced",
) {
  const variety = PLACARD_VARIETIES.find((item) => item.code === varietyCode);
  if (!variety) throw new Error("Variété inconnue.");
  const setup = PLACARD_SETUPS.find((item) => item.code === setupCode);
  if (!setup) throw new Error("Installation inconnue.");

  return {
    varietyCode,
    setupCode,
    day: 1,
    health: 88,
    vigor: variety.traits.vigor,
    water: setup.water,
    airflow: setup.airflow,
    light: setup.light,
    stress: 8,
    biomass: 6,
    aromaPotential: variety.traits.aroma * 0.55,
    observationBonus: 0,
    seed: Math.abs(Math.floor(seed)) % 100000,
    history: [],
    harvested: false,
  } satisfies PlacardCultureState;
}

export function advancePlacardCulture(
  current: PlacardCultureState,
  action: PlacardAction,
): PlacardCultureState {
  if (current.harvested) return current;

  const variety = PLACARD_VARIETIES.find((item) => item.code === current.varietyCode);
  if (!variety) throw new Error("Variété inconnue.");

  const dailyEvent = getPlacardDailyEvent(current.seed, current.day);
  const postHarvest = current.day >= PLACARD_DRYING_DAY;
  let water = current.water - (postHarvest ? (current.day === PLACARD_DRYING_DAY ? 12 : 6) : 9) + (postHarvest ? 0 : dailyEvent.waterDelta);
  let airflow = current.airflow + dailyEvent.airflowDelta;
  let light = current.light + dailyEvent.lightDelta;
  let observationBonus = Math.max(0, current.observationBonus - 1);
  let stressRelief = 0;
  let healthBoost = 0;
  let aromaBoost = 0;
  let stressPressure = 0;
  let growthBoost = 0;

  if (action === "measured-irrigation") water += Math.max(0, (62 - water) * 0.85);
  if (action === "renew-air") airflow += 18;
  if (action === "inspect-canopy") observationBonus = 2;
  if (action === "adjust-light") {
    const lightTarget = current.day <= 2 ? 50 : current.day <= 5 ? 64 : current.day <= 6 ? 58 : 38;
    light += (lightTarget - light) * 0.75;
  }
  if (action === "check-drainage") {
    observationBonus = Math.max(observationBonus, 1);
    if (water > 66) water -= Math.min(12, water - 60);
    stressRelief += 3;
  }
  if (action === "climate-control") {
    const airflowTarget = current.day >= 5 ? 66 : 58;
    airflow += (airflowTarget - airflow) * 0.75;
  }
  if (action === "canopy-training") {
    airflow += 5;
    light += 4;
    growthBoost += current.day >= 2 && current.day <= 4 ? 1.8 : 0.3;
    stressPressure += current.day >= 5 ? 3 : 1.5;
  }
  if (action === "sanitary-scouting") {
    observationBonus = Math.max(observationBonus, 1);
    stressRelief += dailyEvent.code === "humid" ? 6 : 3;
    healthBoost += 1;
  }
  if (action === "check-runoff") {
    observationBonus = Math.max(observationBonus, 1);
    stressRelief += 5;
    healthBoost += water > 76 ? 2 : 0.5;
  }
  if (action === "space-flowers") {
    airflow += 12;
    aromaBoost += 1;
  }
  if (action === "control-drying-air") {
    airflow += (55 - airflow) * 0.8;
    light += (30 - light) * 0.7;
    aromaBoost += 2;
  }
  if (action === "inspect-drying") {
    observationBonus = 2;
    stressRelief += 3;
  }
  if (action === "stabilize-storage") {
    airflow += (50 - airflow) * 0.75;
    light += (24 - light) * 0.8;
    aromaBoost += 2;
  }
  if (action === "vent-containers") {
    water -= water > 42 ? 5 : 1;
    stressRelief += 4;
  }
  if (action === "sensory-check") {
    observationBonus = 2;
    aromaBoost += 1.5;
  }

  airflow -= 3;
  light -= 2;

  const noise = seededNoise(current.seed, current.day);
  const waterTarget = postHarvest ? (current.day === PLACARD_DRYING_DAY ? 46 : 38) : 58;
  const waterPenalty = Math.abs(water - waterTarget) * 0.12;
  const airPenalty = Math.max(0, 45 - airflow) * 0.16;
  const lightPenalty = postHarvest
    ? Math.max(0, light - 42) * 0.18
    : Math.max(0, 42 - light) * 0.1 + Math.max(0, light - 78) * 0.15;
  const dailyStress = Math.max(0, waterPenalty + airPenalty + lightPenalty - variety.traits.resilience / 35 + stressPressure);
  const stress = clamp(current.stress * 0.72 + dailyStress + noise * 1.2 - stressRelief);
  const limitingFactor = Math.min(
    clamp(100 - Math.abs(water - waterTarget) * 2),
    clamp(airflow * 1.35),
    clamp(light * 1.25),
    clamp(100 - stress),
  ) / 100;
  const growth = postHarvest ? 0 : (3.8 + variety.traits.vigor / 28) * limitingFactor + growthBoost;
  const aromaGain = postHarvest
    ? aromaBoost - lightPenalty * 0.12
    : (variety.traits.aroma / 45) * limitingFactor * (current.day >= 5 ? 1.7 : 0.55) + aromaBoost;
  const health = clamp(current.health + (limitingFactor - 0.68) * 5 - dailyStress * 0.18 + healthBoost);
  const nextDay = Math.min(PLACARD_TOTAL_DAYS, current.day + 1);
  const harvested = nextDay >= PLACARD_TOTAL_DAYS;

  const labels: Record<PlacardAction, string> = {
    "inspect-canopy": "L’inspection des feuilles et des apex affine le diagnostic des deux prochains tours.",
    "measured-irrigation": water >= 60 ? "L’apport s’arrête à la réserve cible, sans saturer le substrat." : "L’irrigation ramène progressivement le substrat vers sa réserve cible.",
    "renew-air": "Le renouvellement d’air améliore les échanges autour de la canopée.",
    "adjust-light": "La hauteur de lampe est rapprochée de la cible adaptée à cette phase.",
    "check-drainage": water > 66 ? "Le drainage est contrôlé et l’excès d’eau corrigé." : "Le drainage est sain ; aucun apport supplémentaire n’est nécessaire.",
    "climate-control": "L’extraction et l’humidité sont réglées selon le stade de la plante.",
    "canopy-training": current.day >= 2 && current.day <= 4 ? "Le palissage répartit mieux la lumière, au prix d’un léger stress temporaire." : "Le palissage est réalisé hors de sa meilleure fenêtre et apporte peu.",
    "sanitary-scouting": "Le dessous des feuilles et les zones denses sont contrôlés avant qu’un problème ne s’installe.",
    "check-runoff": "Le drainage est mesuré : on corrige un déséquilibre au lieu d’ajouter des nutriments à l’aveugle.",
    "space-flowers": "Le lot est espacé afin d’obtenir une circulation d’air plus homogène.",
    "control-drying-air": "Le flux d’air et l’obscurité sont rapprochés d’une zone de séchage progressive.",
    "inspect-drying": "Plusieurs zones du lot sont contrôlées pour repérer un séchage irrégulier.",
    "stabilize-storage": "Le stockage est stabilisé dans l’obscurité avec un renouvellement d’air modéré.",
    "vent-containers": "Les contenants sont brièvement renouvelés pour évacuer un excès d’humidité.",
    "sensory-check": "L’évolution du toucher et du profil aromatique est consignée sans modifier le lot.",
  };

  return {
    ...current,
    day: nextDay,
    health,
    vigor: clamp(current.vigor + growth * 0.18),
    water: clamp(water),
    airflow: clamp(airflow),
    light: clamp(light),
    stress,
    biomass: clamp(current.biomass + growth, 0, 140),
    aromaPotential: clamp(current.aromaPotential + aromaGain),
    observationBonus,
    harvested,
    history: [
      ...current.history,
      {
        day: current.day,
        action,
        eventCode: postHarvest ? undefined : dailyEvent.code,
        eventLabel: postHarvest ? "Suivi post-récolte" : dailyEvent.label,
        summary: `${postHarvest ? "Le lot poursuit son évolution contrôlée." : dailyEvent.description} ${labels[action]}`,
      },
    ].slice(-12),
  };
}

export function scorePlacardHarvest(state: PlacardCultureState): PlacardHarvest {
  const variety = PLACARD_VARIETIES.find((item) => item.code === state.varietyCode);
  if (!variety) throw new Error("Variété inconnue.");
  const setup = PLACARD_SETUPS.find((item) => item.code === state.setupCode) ?? PLACARD_SETUPS[1];

  const aspect = clamp(state.health * 0.65 + state.vigor * 0.35 - state.stress * 0.18);
  const nose = clamp(state.aromaPotential * 0.78 + variety.traits.aroma * 0.22 - state.stress * 0.12);
  const complexity = clamp((nose + variety.traits.resilience) / 2 - state.stress * 0.1);
  const cleanliness = clamp(state.health - state.stress * 0.28 + state.airflow * 0.12);
  const sobriety = clamp(variety.traits.efficiency + (70 - state.light) * 0.28 + (70 - state.water) * 0.12 + setup.sobrietyBonus);
  const combos = getPlacardCombos(state);
  const comboBonus = Math.min(6, combos.reduce((sum, combo) => sum + combo.bonus, 0));
  const total = clamp((aspect + nose + complexity + cleanliness + sobriety) / 5 + comboBonus);

  return { aspect, nose, complexity, cleanliness, sobriety, comboBonus, combos, total };
}

export function getPlacardCombos(state: PlacardCultureState): PlacardCombo[] {
  const actions = state.history.map((entry) => entry.action);
  const uniqueActions = new Set(actions);
  const observeCount = actions.filter((action) => action === "inspect-canopy").length;
  const combos: PlacardCombo[] = [];

  if (uniqueActions.size >= 5) {
    combos.push({ code: "full-hand", label: "Palette technique", description: "Au moins cinq Techniques différentes ont été utilisées.", bonus: 2 });
  }
  if (observeCount >= 2 && state.stress < 25) {
    combos.push({ code: "observer", label: "Œil du cultivateur", description: "Deux observations et un stress maîtrisé.", bonus: 2 });
  }
  if (state.health >= 85 && state.stress <= 15) {
    combos.push({ code: "clean-grow", label: "Culture propre", description: "Une récolte saine avec très peu de stress.", bonus: 2 });
  }
  if (state.setupCode === "eco" && state.health >= 75) {
    combos.push({ code: "eco-master", label: "Éco-maîtrise", description: "L’installation économe termine en bonne santé.", bonus: 2 });
  }

  return combos;
}
