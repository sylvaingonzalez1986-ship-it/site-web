export const SYLVAIN_INVITATION = {
  title: "Un coup de main de Loïc ?",
  body: "Je peux te montrer comment ouvrir ton entrepôt et lancer une première culture. Tu joues à ton rythme. Le guide se met en pause quand tu le souhaites.",
  action: "Commencer avec Loïc",
};

const INITIAL_LESSONS = ["warehouse", "install", "prepare", "supplies", "launch", "next"] as const;
const CONTEXT_LESSONS = ["coverage", "cleaning", "irrigation", "inputs", "care", "zones", "staff", "air", "camera",
  "alarm", "subscription", "harvest", "drying", "storage", "trim", "processing", "encyclopedia", "quiz",
  "commerce", "missions", "cards", "bank", "networks", "quarter"] as const;

export type SylvainLessonId = (typeof INITIAL_LESSONS)[number] | (typeof CONTEXT_LESSONS)[number];

type SylvainDestination = {
  view: "hub" | "workshop" | "game" | "harvests" | "staff" | "school" | "market" | "missions" | "shop" | "treasury" | "social";
  section?: string;
  href?: string;
};

export type SylvainLesson = {
  id: SylvainLessonId;
  kind: "initial" | "context";
  title: string;
  body: string;
  instruction?: string;
  action: string;
  target: string;
  fallback: string | null;
  targets: readonly string[];
  destination: SylvainDestination;
};

const WAREHOUSE = { view: "workshop", section: "equipment" } as const;
const CAMPAIGN = { view: "game", href: "/arene/placard?view=game&campaign=1" } as const;
const HARVESTS = { view: "harvests", section: "storage" } as const;
const WORKSHOP = { view: "workshop", section: "processing" } as const;

const LESSONS: Record<SylvainLessonId, Omit<SylvainLesson, "id" | "kind" | "target" | "fallback">> = {
  warehouse: {
    title: "Ouvrir l’entrepôt",
    instruction: "Entre dans l’Entrepôt et ouvre le Pilotage.",
    body: "Depuis le Quartier, ouvre l’Entrepôt. Le Pilotage rassemble le plan, les priorités et les étapes en cours.",
    action: "Repérer le Pilotage", targets: ["warehouse"], destination: WAREHOUSE,
  },
  install: {
    title: "Installer ta première zone",
    instruction: "Ouvre Aménager, puis propose un plan de départ.",
    body: "Dans Aménager, « Proposer un plan de départ » dessine une zone avec support et lampe, un filet de séchage et des bocaux. Tu peux aussi placer le matériel à la main. Vérifie le devis et le solde avant d’enregistrer.",
    action: "Repérer l’aménagement", targets: ["install-confirm", "install-review", "install-placement", "install-lighting", "install-support", "install-first", "install-shop", "install-empty"], destination: WAREHOUSE,
  },
  prepare: {
    title: "Choisir une variété",
    instruction: "Choisis un Buddie disponible pour ta zone.",
    body: "Dans une zone opérationnelle, choisis un Buddie disponible. Si ton album est vide, ouvre d’abord ton pack de bienvenue à la Maison des cartes. Reviens ensuite à la zone pour y placer la variété.",
    action: "Repérer le choix du Buddie", targets: ["prepare-choice", "prepare-buddie", "prepare-pack-open", "prepare-pack-welcome", "prepare-packs", "prepare-open", "install-empty"], destination: WAREHOUSE,
  },
  supplies: {
    title: "Vérifier les stocks avant le semis",
    instruction: "Dans le récapitulatif, ouvre « Doses avant le semis ».",
    body: "Dans le récapitulatif du semis, ouvre « Doses avant le semis ». Regarde les quantités disponibles et les charges prévues. Les soins en culture dépendent des réserves disponibles au semis.",
    action: "Repérer le récapitulatif", targets: ["supplies", "supplies-open", "prepare-buddie", "prepare-open"], destination: CAMPAIGN,
  },
  launch: {
    title: "Lancer ta première culture",
    instruction: "Vérifie le coût du cycle, puis confirme si tout te convient.",
    body: "Vérifie la zone, la variété et le montant affichés, puis confirme le semis si tout te convient. Si le jeu bloque la confirmation, corrige le motif indiqué dans le récapitulatif.",
    action: "Repérer la confirmation", targets: ["launch-refresh", "launch", "supplies-open", "prepare-buddie", "prepare-open"], destination: CAMPAIGN,
  },
  next: {
    title: "Repérer la prochaine échéance",
    instruction: "Ouvre le suivi de ta culture pour voir sa prochaine échéance.",
    body: "Suis ta culture et regarde l’étape, son échéance et les tâches proposées. Si une action doit attendre, retrouve sa date dans le cycle ou dans le Pilotage.",
    action: "Repérer la prochaine étape", targets: ["next", "next-open", "warehouse"], destination: WAREHOUSE,
  },
  coverage: {
    title: "Lire la couverture sur le plan",
    body: "Sélectionne une zone ou un appareil et compare les mètres carrés desservis à la surface de la zone. Regarde la portée dans le plan avant de déplacer ou d’ajouter du matériel.",
    action: "Repérer le détail de la couverture", targets: ["coverage", "zones"], destination: WAREHOUSE,
  },
  cleaning: {
    title: "Suivre le nettoyage",
    body: "Dans Nettoyage, choisis qui fera le passage et vérifie ses heures disponibles. Commence par l’aspiration. Le registre indique quand tu pourras laver le sol et quand il faudra renouveler le nettoyage.",
    action: "Repérer les passages", targets: ["cleaning"], destination: WAREHOUSE,
  },
  irrigation: {
    title: "Vérifier l’irrigation",
    body: "Le panneau Irrigation indique quelles zones la centrale dessert. Si tu décides de préparer un mélange, vérifie la quantité, la couverture et les réserves, puis enregistre le mélange.",
    action: "Repérer la centrale et ses réserves", targets: ["irrigation"], destination: WAREHOUSE,
  },
  inputs: {
    title: "Comparer les réserves d’intrants",
    body: "Le registre montre le stock physique et ce qui est encore utilisable par une culture. Examine les réserves et le conditionnement avant d’acheter pour un prochain semis.",
    action: "Repérer le registre", targets: ["inputs"], destination: WAREHOUSE,
  },
  care: {
    title: "Choisir un soin en culture",
    body: "Ouvre le bilan de santé et repère le foyer. Si tu choisis de traiter cette case, vérifie les charges disponibles, applique le soin et consulte le résultat.",
    action: "Repérer le bilan de santé", targets: ["care", "next"], destination: CAMPAIGN,
  },
  zones: {
    title: "Gérer tes zones",
    body: "La fiche d’une zone indique son matériel, son état et les actions possibles. Si tu agrandis l’activité, vérifie le devis de la deuxième zone éclairée et retrouve-la sur le plan après l’enregistrement.",
    action: "Repérer les actions de la zone", targets: ["zones", "warehouse"], destination: WAREHOUSE,
  },
  staff: {
    title: "Organiser le travail",
    body: "Dans Personnel, consulte les heures disponibles et les échéances de paie. Si tu confies une tâche, vérifie la durée, la personne et les coûts, puis retrouve la tâche confirmée au planning.",
    action: "Repérer l’équipe et le planning", targets: ["staff"], destination: { view: "staff" },
  },
  air: {
    title: "Vérifier l’extraction d’air",
    body: "Dans l’entrepôt, l’extraction d’air dessert des zones de culture. Le plan indique le flux, la portée et les mètres carrés couverts par chaque appareil.",
    action: "Repérer la ventilation", targets: ["air", "coverage"], destination: WAREHOUSE,
  },
  camera: {
    title: "Lire la couverture des caméras",
    body: "Dans Sécurité, prévisualise l’orientation et les zones surveillées. Si tu veux poser ou déplacer une caméra, vérifie le montant affiché puis retrouve la couverture enregistrée sur le plan.",
    action: "Repérer les caméras", targets: ["camera", "security"], destination: WAREHOUSE,
  },
  alarm: {
    title: "Repérer l’alarme",
    body: "La fiche Sécurité indique l’emplacement de l’alarme à la porte sud. Si tu décides de l’installer, vérifie le montant puis retrouve son état dans la fiche après confirmation.",
    action: "Repérer l’alarme de la porte sud", targets: ["alarm", "security"], destination: WAREHOUSE,
  },
  subscription: {
    title: "Suivre la télésurveillance",
    body: "La télésurveillance demande une alarme installée. Si tu choisis ce service, vérifie le tarif et le renouvellement. Une fois la période activée, retrouve son échéance dans la fiche.",
    action: "Repérer le service et son échéance", targets: ["subscription", "security"], destination: WAREHOUSE,
  },
  harvest: {
    title: "Retrouver ta récolte",
    body: "Quand la culture atteint la récolte, ouvre son bilan pour voir les quantités obtenues et la suite proposée. Les lots disponibles se retrouvent dans Mes récoltes.",
    action: "Repérer le bilan ou les lots", targets: ["harvest", "next"], destination: HARVESTS,
  },
  drying: {
    title: "Comparer la capacité de séchage",
    body: "Au Pilotage, compare la capacité de la salle et les quantités affichées. Une estimation sur le plan sert à préparer la place. Le bilan de récolte donne la quantité effectivement obtenue.",
    action: "Repérer le séchage", targets: ["drying"], destination: WAREHOUSE,
  },
  storage: {
    title: "Suivre le stockage et l’affinage",
    body: "Dans Mes récoltes, consulte le contenant, la capacité libre et la date de fin d’affinage du lot. L’affinage se poursuit pendant les autres tâches et pendant ton absence.",
    action: "Repérer les lots et leurs contenants", targets: ["storage"], destination: HARVESTS,
  },
  trim: {
    title: "Planifier le trim",
    body: "À l’Atelier, choisis un lot et compare les durées et les effets sur sa présentation. Si tu réserves des heures pour le trim, retrouve le travail confirmé et son avancement sur le lot.",
    action: "Repérer le poste de trim", targets: ["trim", "workshop"], destination: WORKSHOP,
  },
  processing: {
    title: "Découvrir les transformations de l’Atelier",
    body: "L’Atelier propose le trim et les extractions de produits à partir des lots. Pour une transformation, vérifie les quantités, les machines nécessaires et le résultat proposé.",
    action: "Repérer les extractions et les machines", targets: ["processing", "workshop"], destination: WORKSHOP,
  },
  encyclopedia: {
    title: "Chercher dans l’encyclopédie",
    body: "Dans QuizzShow, l’encyclopédie permet d’ouvrir une fiche et d’en consulter les sources. Cherche un sujet rencontré dans ta partie pour retrouver l’explication.",
    action: "Repérer les fiches", targets: ["encyclopedia"], destination: { view: "school", section: "learn" },
  },
  quiz: {
    title: "Découvrir le tournoi QuizzShow",
    body: "Ouvre le tournoi pour voir les sessions et leurs conditions. Tu peux revenir à l’encyclopédie pour approfondir le sujet avant de rejoindre une session.",
    action: "Repérer les sessions du tournoi", targets: ["quiz"], destination: { view: "school", section: "tournament" },
  },
  commerce: {
    title: "Comparer les offres de vente",
    body: "Sélectionne un lot disponible dans Commerce. Compare les quantités, le montant net et le délai de chaque offre avant de confirmer une vente.",
    action: "Repérer les débouchés", targets: ["commerce"], destination: { view: "market", section: "sales" },
  },
  missions: {
    title: "Choisir une mission",
    body: "Dans Mes missions, vérifie la durée, les conditions et la récompense d’une mission disponible. Consulte le temps restant avant de t’engager.",
    action: "Repérer les missions disponibles", targets: ["missions"], destination: { view: "missions" },
  },
  cards: {
    title: "Retrouver tes cartes",
    body: "La Maison des cartes réunit les packs disponibles et les albums. Regarde les Buddies que tu peux cultiver et les cartes Botte du Chanvrier que tu peux jouer pendant un cycle.",
    action: "Repérer les packs et les albums", targets: ["cards"], destination: { view: "shop" },
  },
  bank: {
    title: "Lire une proposition de financement",
    body: "À la Banque, compare le coût du financement et ses échéances au solde prévisionnel de ta ferme avant de choisir une offre.",
    action: "Repérer les offres et échéances", targets: ["bank"], destination: { view: "treasury", section: "loans" },
  },
  networks: {
    title: "Consulter tes activités de réseau",
    body: "Dans Mes réseaux, parcours les activités et les partenariats disponibles. Regarde les conditions, les ressources engagées et les échéances avant de choisir.",
    action: "Repérer les activités de réseau", targets: ["networks"], destination: { view: "social" },
  },
  quarter: {
    title: "Reprendre la main dans le Quartier",
    body: "Retrouve les bâtiments et le planning dans le Quartier. Avant de choisir ta prochaine activité, regarde le temps disponible et les échéances de ton équipe.",
    action: "Repérer le planning du Quartier", targets: ["quarter"], destination: { view: "hub" },
  },
};

export const SYLVAIN_LESSONS: readonly SylvainLesson[] = [...INITIAL_LESSONS, ...CONTEXT_LESSONS].map(id => ({
  ...LESSONS[id],
  id,
  kind: (INITIAL_LESSONS as readonly SylvainLessonId[]).includes(id) ? "initial" : "context",
  target: LESSONS[id].targets[0],
  fallback: LESSONS[id].targets[1] ?? null,
}));

export type SylvainObservations = {
  achieved: readonly string[];
  relevant: readonly string[];
  hints: Readonly<Record<string, string>>;
  recovery?: "install" | "prepare";
};

export type SylvainState = {
  mode: "invited" | "active" | "paused" | "off";
  completed: SylvainLessonId[];
  skipped: SylvainLessonId[];
  selected: SylvainLessonId | null;
};

type LessonStatus = "completed" | "skipped" | "available" | "later";
type SylvainAction =
  | { type: "start" | "pause" | "resume" | "off" | "follow" }
  | { type: "skip"; observations?: SylvainObservations }
  | { type: "select"; id: SylvainLessonId; observations: SylvainObservations }
  | { type: "observe"; observations: SylvainObservations };

const EMPTY_OBSERVATIONS: SylvainObservations = { achieved: [], relevant: [], hints: {} };
const RECOVERY_HINTS = {
  install: "Il te faut de nouveau une zone éclairée. Ouvre Aménager, équipe la zone et enregistre le plan.",
  prepare: "Affecte de nouveau un Buddie disponible à ta zone, puis enregistre avant d’ouvrir le récapitulatif.",
};
const STORAGE_VERSION = "v1";

export const sylvainStorageKey = (accountId: string) => `kq:sylvain-guide:${STORAGE_VERSION}:${encodeURIComponent(accountId)}`;

function initialState(): SylvainState {
  return { mode: "invited", completed: [], skipped: [], selected: null };
}

function isLessonId(value: unknown): value is SylvainLessonId {
  return typeof value === "string" && Object.hasOwn(LESSONS, value);
}

function readLessonIds(value: unknown): SylvainLessonId[] {
  return Array.isArray(value) ? [...new Set(value.filter(isLessonId))] : [];
}

export function readSylvainState(storage: Pick<Storage, "getItem"> | null | undefined, accountId: string | null | undefined): SylvainState {
  if (!storage || !accountId) return initialState();
  try {
    const saved = JSON.parse(storage.getItem(sylvainStorageKey(accountId)) ?? "null") as Partial<SylvainState> | null;
    if (!saved || (saved.mode !== "active" && saved.mode !== "paused" && saved.mode !== "off")) return initialState();
    const completed = readLessonIds(saved.completed);
    return {
      mode: saved.mode,
      completed,
      skipped: readLessonIds(saved.skipped).filter(id => !completed.includes(id)),
      selected: isLessonId(saved.selected) ? saved.selected : null,
    };
  } catch {
    return initialState();
  }
}

export function writeSylvainState(storage: Pick<Storage, "setItem"> | null | undefined, accountId: string | null | undefined, state: SylvainState): boolean {
  if (!storage || !accountId) return false;
  try {
    storage.setItem(sylvainStorageKey(accountId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function resolved(state: SylvainState, id: SylvainLessonId) {
  return state.completed.includes(id) || state.skipped.includes(id);
}

function nextInitialLesson(state: SylvainState, observations: SylvainObservations): SylvainLessonId | null {
  if (state.completed.includes("launch")) return resolved(state, "next") ? null : "next";
  return INITIAL_LESSONS.find(id => !resolved(state, id) && (id !== "next" || observations.relevant.includes(id))) ?? null;
}

export function getSylvainGuide(state: SylvainState, observations: SylvainObservations = EMPTY_OBSERVATIONS) {
  const initial = nextInitialLesson(state, observations);
  const launched = state.completed.includes("launch");
  const relevant = new Set(observations.relevant);
  const lessons = SYLVAIN_LESSONS.map(lesson => {
    let status: LessonStatus = "later";
    if (state.completed.includes(lesson.id)) status = "completed";
    else if (state.skipped.includes(lesson.id)) status = "skipped";
    else if (lesson.id === initial || lesson.id === state.selected || relevant.has(lesson.id) || launched) status = "available";
    return { lesson, status };
  });
  const contextual = lessons.find(entry => entry.lesson.kind === "context" && entry.status === "available" && relevant.has(entry.lesson.id))?.lesson.id;
  const selection = state.selected && lessons.find(entry => entry.lesson.id === state.selected);
  const selectedForReading = selection && (selection.status === "completed" || selection.status === "skipped");
  const setupNeeded = initial === "prepare" || initial === "supplies" || initial === "launch";
  const recovery = state.mode === "active" && setupNeeded && observations.recovery
    && state.completed.includes(observations.recovery) && (!selection || selection.lesson.kind === "initial" && !selectedForReading)
    ? observations.recovery : null;
  const currentId = state.mode === "active" ? recovery ?? state.selected ?? initial ?? contextual : null;
  const current = lessons.find(entry => entry.lesson.id === currentId)?.lesson ?? null;
  const replay = !recovery && currentId != null && resolved(state, currentId);
  return {
    current,
    replay,
    recovery: Boolean(recovery),
    hint: current ? observations.hints[current.id] ?? (recovery ? RECOVERY_HINTS[recovery] : null) : null,
    lessons,
    initialComplete: launched && state.completed.includes("next"),
  };
}

export function updateSylvainGuide(state: SylvainState, action: SylvainAction): SylvainState {
  switch (action.type) {
    case "start":
      return state.mode === "invited" ? { ...state, mode: "active" } : state;
    case "resume":
      return state.mode === "paused" || state.mode === "off" ? { ...state, mode: "active" } : state;
    case "pause":
      return state.mode === "active" ? { ...state, mode: "paused" } : state;
    case "off":
      return state.mode === "off" ? state : { ...state, mode: "off" };
    case "follow":
      return state.mode === "active" && state.selected ? { ...state, selected: null } : state;
    case "select": {
      if (state.mode !== "active" || state.selected === action.id) return state;
      const entry = getSylvainGuide(state, action.observations).lessons.find(({ lesson }) => lesson.id === action.id);
      return !entry || entry.status === "later" ? state : { ...state, selected: action.id };
    }
    case "skip": {
      if (state.mode !== "active") return state;
      const guide = getSylvainGuide(state, action.observations);
      return guide.current && !guide.replay && !guide.recovery ? { ...state, skipped: [...state.skipped, guide.current.id], selected: null } : state;
    }
    case "observe": {
      if (state.mode !== "active" || (state.selected && resolved(state, state.selected))) return state;
      const achieved = readLessonIds(action.observations.achieved).filter(id => !state.completed.includes(id));
      if (!achieved.length) return state;
      return {
        ...state,
        completed: [...state.completed, ...achieved],
        skipped: state.skipped.filter(id => !achieved.includes(id)),
        selected: state.selected && achieved.includes(state.selected) ? null : state.selected,
      };
    }
  }
}
