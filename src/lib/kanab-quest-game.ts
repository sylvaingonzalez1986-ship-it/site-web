import {
  KQ_HERITAGE_CARDS,
  resolveKqHeritageCard,
  type KqHeritageCard,
  type KqHeritageEffect,
  type KqHeritageTiming,
} from "@/lib/kanab-quest-heritage";
import {
  getKqEquipmentDefinition,
  summarizeKqEquipmentLoadout,
} from "@/lib/kanab-quest-equipment";
import {
  calculateKqEquipmentQualityBonus,
  calculateKqHarvestGrams,
} from "@/lib/kanab-quest-market";

export const KQ_STAGES = ["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"] as const;

export type KqStage = (typeof KQ_STAGES)[number];
export type KqTiming = "passive" | "before-roll" | "after-roll";
export type KqCardCategory = "substrate" | "pbi" | "equipment" | "know-how" | "luck";
export type KqSupportEffect = "reroll-neutral" | "pbi-success" | "pbi-strong-success" | "pbi-success-xp" | "cancel-danger" | "reveal-pest" | "reroll-two-low" | "neutral-to-success" | "four-keep-three" | "three-to-success"
  | "water-test" | "pest-monitor" | "double-danger-shield" | "moisture-calibration"
  | "harvest-four-quality" | "harvest-cool" | "danger-to-neutral" | "clean-cut"
  | "compliance-clearance" | "illegal-power" | "bill-relief" | "theft-guard"
  | "root-aeration" | "living-soil-buffer" | "starter-stability"
  | "hydroponic-control" | "aeroponic-precision" | "perlite-drainage"
  | "biochar-buffer" | "organic-feed" | "pbi-thrips-relief";
export type KqSituationTag = "roots" | "water" | "climate" | "pest" | "flower" | "harvest" | "drying" | "energy" | "compliance" | "security";
export type KqPest = "aphids" | "mites" | "thrips";
export type KqBuddieEffect = "none" | "starting-xp-1" | "starting-xp-2" | "starting-xp-3" | "starting-xp-4";
export const KQ_HAND_SIZE = 5;
export const KQ_HERITAGE_RESERVE_SIZE = 3;
const KQ_EFFECT_NOTICE_LIMIT = 12;

function appendKqEffectNotice(notices: string[] | undefined, notice: string) {
  return [...(notices ?? []), notice].slice(-KQ_EFFECT_NOTICE_LIMIT);
}

export function getKqEffectNoticeKind(notice: string): "applied" | "missed" {
  return /aucun dé|non déclench|effet non déclench/i.test(notice) ? "missed" : "applied";
}

export const KQ_COLLECTIONS = {
  buddies: { code: "KANAB_QUEST_2026", title: "Buddies", totalCards: 52 },
  support: { code: "BOTTE_DU_CHANVRIER_2026", title: "La Botte du Chanvrier", totalCards: 36, alphaCards: 36 },
} as const;

export type KqBuddie = {
  code: string;
  name: string;
  cardNumber: number;
  rarity: "common" | "silver" | "gold" | "epic" | "legendary";
  ability: string;
  effect: KqBuddieEffect;
  advantageLevel: 0 | 1 | 2 | 3 | 4;
};

export type KqSupportCard = {
  code: string;
  name: string;
  category: KqCardCategory;
  rarity: "common" | "uncommon" | "rare";
  xpCost: number;
  timing: KqTiming;
  description: string;
  tags: KqSituationTag[];
  targets?: KqPest[];
  effect: KqSupportEffect;
};

export type KqCultureSystemProfile = {
  cardCode: "BOTTE-001" | "BOTTE-007" | "BOTTE-008" | "BOTTE-009";
  technique: string;
  mastery: "Accessible" | "Technique" | "Expert" | "Patiente";
  electricity: "Faible" | "Pompe continue" | "Critique";
};

export const KQ_CULTURE_SYSTEM_PROFILES: readonly KqCultureSystemProfile[] = [
  {
    cardCode: "BOTTE-001",
    technique: "Mélange organique drainant",
    mastery: "Accessible",
    electricity: "Faible",
  },
  {
    cardCode: "BOTTE-007",
    technique: "Solution nutritive en circuit fermé",
    mastery: "Technique",
    electricity: "Pompe continue",
  },
  {
    cardCode: "BOTTE-008",
    technique: "Racines suspendues et brumisées",
    mastery: "Expert",
    electricity: "Critique",
  },
  {
    cardCode: "BOTTE-009",
    technique: "Écosystème organique biologiquement actif",
    mastery: "Patiente",
    electricity: "Faible",
  },
] as const;

export function getKqCultureSystemProfile(cardCode: string) {
  return KQ_CULTURE_SYSTEM_PROFILES.find((profile) => profile.cardCode === cardCode) ?? null;
}

export type KqSituation = {
  code: string;
  stage: KqStage;
  name: string;
  story: string;
  difficulty: 1 | 2 | 3;
  tags: KqSituationTag[];
  pest?: KqPest;
  incident?: "electricity-bill" | "ddtm-inspection" | "crop-theft";
  successTrait: string;
  fragileTrait: string;
  failureTrait: string;
};

export type KqOutcome = "critical" | "success" | "fragile" | "failure";

export type KqEquipmentRunProfile = ReturnType<typeof summarizeKqEquipmentLoadout> & {
  codes: string[];
};

export type KqGameState = {
  seed: number;
  challengeDayKey?: string;
  startedAt?: string;
  completedAt?: string;
  varietyCode: string;
  varietyName: string;
  deckCodes: string[];
  handCodes?: string[];
  heritageReserveCodes?: string[];
  handRedrawsUsed?: number;
  heritageCode?: string;
  heritageName?: string;
  heritageTiming?: KqHeritageTiming;
  heritageEffect?: KqHeritageEffect;
  heritageProducerName?: string;
  heritageImageUrl?: string;
  heritageUsed?: boolean;
  heritageArmed?: boolean;
  collectionCodes: string[];
  situationCodes: string[];
  stageIndex: number;
  phase: "prepare" | "rolled" | "resolved" | "complete";
  xp: number;
  quality: number;
  equipment?: KqEquipmentRunProfile;
  equipmentQualityBonus?: number;
  harvestGrams?: number;
  powerOutage?: boolean;
  harvestLossPercent?: number;
  dice: [number, number, number] | null;
  bonusDie?: number | null;
  effectNotices?: string[];
  rollNonce: number;
  pressure: number;
  cancelledDangers: number;
  preparationPlayed: boolean;
  reactionPlayed: boolean;
  revealedPest: KqPest | null;
  playedThisStage: string[];
  usedCards: string[];
  traits: string[];
  combos: string[];
  lastOutcome: KqOutcome | null;
  history: Array<{
    stage: KqStage;
    situation: string;
    dice: [number, number, number];
    total: number;
    target: number;
    outcome: KqOutcome;
    trait: string;
    dangers?: number;
    sparks?: number;
    pressureAfter?: number;
    combos?: string[];
    qualityDelta?: number;
    xpGain?: number;
    harvestLossPercent?: number;
  }>;
};

export function getKqStateHeritage(state: Pick<KqGameState,
  "heritageCode" | "heritageName" | "heritageTiming" | "heritageEffect" | "heritageProducerName" | "heritageImageUrl"
>) {
  return resolveKqHeritageCard(state);
}

const KQ_BUDDIE_NAMES = [
  "L’Arbre Mère - Toutes Variétés", "Charlotte’s Web", "Cannatonic", "Harlequin", "ACDC",
  "Sour Space Candy", "Hawaiian Haze", "Lifter", "Elektra", "Suver Haze", "Cherry Wine",
  "Ringo’s Gift", "Remedy", "Sour Tsunami", "Harle-Tsu", "Stephen Hawking Kush", "Pennywise",
  "Sweet and Sour Widow", "Special Sauce", "Strawberry CBD", "Amnesia Haze CBD",
  "White Widow CBD", "Skywalker OG CBD", "Bubba Kush CBD", "OG Kush CBD", "Gelato CBD",
  "Gorilla Glue CBD", "Blue Dream CBD", "Pineapple Express CBD", "Lemon Haze CBD",
  "Critical Mass CBD", "Super Lemon Haze CBD", "Skunk CBD", "Afghan CBD", "Cheese CBD",
  "Mango Haze CBD", "Dinamed CBD", "Baox", "Berry Blossom", "The Wife", "Therapy CBD",
  "Dancehall", "Frank’s Gift", "Valentine X", "Carmagnola", "Cherry Abacus", "Magic Bullet",
  "Otto II", "Swiss Dream CBD", "CB Dream", "CBD Kush", "Diesel CBD",
] as const;

const KQ_BUDDIE_ABILITIES: Record<KqBuddieEffect, string> = {
  none: "Buddie commun : aucun avantage de jeu.",
  "starting-xp-1": "Avantage Argent I : +1 XP au départ de la culture.",
  "starting-xp-2": "Avantage Or II : +2 XP au départ de la culture.",
  "starting-xp-3": "Avantage Épique III : +3 XP au départ de la culture.",
  "starting-xp-4": "Avantage Légendaire IV : +4 XP au départ de la culture.",
};

export const KQ_BUDDIES: KqBuddie[] = KQ_BUDDIE_NAMES.map((name, index) => {
  const cardNumber = index + 1;
  const rarity: KqBuddie["rarity"] = cardNumber === 1
    ? "legendary"
    : cardNumber <= 4
      ? "epic"
      : cardNumber <= 9
        ? "gold"
        : cardNumber <= 19
          ? "silver"
          : "common";
  const advantageLevel: KqBuddie["advantageLevel"] = rarity === "legendary" ? 4
    : rarity === "epic" ? 3
      : rarity === "gold" ? 2
        : rarity === "silver" ? 1
          : 0;
  const effect: KqBuddieEffect = advantageLevel === 0 ? "none" : `starting-xp-${advantageLevel}` as KqBuddieEffect;
  return {
    code: `HH2026-${String(cardNumber).padStart(3, "0")}`,
    name,
    cardNumber,
    rarity,
    ability: KQ_BUDDIE_ABILITIES[effect],
    effect,
    advantageLevel,
  };
});

export const KQ_CARDS: KqSupportCard[] = [
  { code: "BOTTE-001", name: "Terreau horticole", category: "substrate", rarity: "common", xpCost: 0, timing: "passive", description: "Sur Racines ou Eau, si aucun dé ne réussit, transforme le meilleur dé neutre en 4.", tags: ["roots", "water"], effect: "starter-stability" },
  { code: "BOTTE-002", name: "Chrysope affamée", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre pucerons ou thrips.", tags: ["pest"], targets: ["aphids", "thrips"], effect: "pbi-success" },
  { code: "BOTTE-003", name: "Petit ventilateur", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Climat ou Séchage.", tags: ["climate", "drying"], effect: "cancel-danger" },
  { code: "BOTTE-004", name: "Loupe d’inspection", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Identifie un ravageur et ouvre ta réserve de cartes PBI.", tags: ["pest"], effect: "reveal-pest" },
  { code: "BOTTE-005", name: "Arrosage mesuré", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Eau ou Racines.", tags: ["water", "roots"], effect: "reroll-neutral" },
  { code: "BOTTE-006", name: "Deuxième chance", category: "luck", rarity: "rare", xpCost: 2, timing: "after-roll", description: "Relance les deux dés les plus faibles.", tags: [], effect: "reroll-two-low" },
  { code: "BOTTE-007", name: "Hydroponie recirculante", category: "substrate", rarity: "uncommon", xpCost: 0, timing: "passive", description: "Sur Eau ou Floraison, relance un dé neutre et garde la meilleure face ; une coupure arrête les pompes.", tags: ["water", "flower"], effect: "hydroponic-control" },
  { code: "BOTTE-008", name: "Aéroponie haute pression", category: "substrate", rarity: "rare", xpCost: 0, timing: "passive", description: "Sur Racines, Eau ou Climat, transforme un dé neutre en 5 ; une coupure transforme les deux meilleurs dés en Dangers.", tags: ["roots", "water", "climate"], effect: "aeroponic-precision" },
  { code: "BOTTE-009", name: "Sol vivant", category: "substrate", rarity: "rare", xpCost: 0, timing: "passive", description: "Sur Racines ou Ravageur, la vie du sol amortit le premier Danger en résultat neutre.", tags: ["roots", "pest"], effect: "living-soil-buffer" },
  { code: "BOTTE-010", name: "Coccinelle à sept points", category: "pbi", rarity: "rare", xpCost: 3, timing: "after-roll", description: "Transforme un dé faible en réussite forte contre les pucerons.", tags: ["pest"], targets: ["aphids"], effect: "pbi-strong-success" },
  { code: "BOTTE-011", name: "Amblyseius swirskii", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre des acariens ou thrips révélés.", tags: ["pest"], targets: ["mites", "thrips"], effect: "pbi-success" },
  { code: "BOTTE-012", name: "Aphidius colemani", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre les pucerons et rapporte +1 XP en cas de succès.", tags: ["pest"], targets: ["aphids"], effect: "pbi-success-xp" },
  { code: "BOTTE-013", name: "Pot en tissu", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Transforme un Danger en résultat neutre sur Racines ou Eau, mais gagne 1 Pression car le pot sèche vite.", tags: ["roots", "water"], effect: "root-aeration" },
  { code: "BOTTE-014", name: "Hygromètre vintage", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Annule un Danger sur une Situation Eau, Climat ou Séchage.", tags: ["water", "climate", "drying"], effect: "cancel-danger" },
  { code: "BOTTE-015", name: "Palissage doux", category: "know-how", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite pendant la Floraison.", tags: ["flower"], effect: "neutral-to-success" },
  { code: "BOTTE-016", name: "Séchage patient", category: "know-how", rarity: "rare", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite pendant le Séchage.", tags: ["drying"], effect: "neutral-to-success" },
  { code: "BOTTE-017", name: "Main verte", category: "luck", rarity: "common", xpCost: 1, timing: "before-roll", description: "Lance quatre dés et conserve les trois meilleurs.", tags: [], effect: "four-keep-three" },
  { code: "BOTTE-018", name: "Testeur pH–EC", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Relance le dé le plus faible sur une Situation Eau ou Racines et gagne 1 XP si le résultat s’améliore.", tags: ["water", "roots"], effect: "water-test" },
  { code: "BOTTE-019", name: "Perlite calibrée", category: "equipment", rarity: "common", xpCost: 1, timing: "after-roll", description: "Sur Racines ou Eau, corrige le plus mauvais dé : un 1 devient 2, ou un 2 devient 4.", tags: ["roots", "water"], effect: "perlite-drainage" },
  { code: "BOTTE-020", name: "Biochar inoculé", category: "know-how", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Sur Racines ou Ravageur, transforme le premier Danger en neutre et réduit la Pression de 1.", tags: ["roots", "pest"], effect: "biochar-buffer" },
  { code: "BOTTE-021", name: "Engrais bio complet", category: "know-how", rarity: "rare", xpCost: 2, timing: "after-roll", description: "Sur Racines ou Floraison, avec exactement deux réussites, transforme un dé neutre en Étincelle.", tags: ["roots", "flower"], effect: "organic-feed" },
  { code: "BOTTE-022", name: "Phytoseiulus persimilis", category: "pbi", rarity: "rare", xpCost: 3, timing: "after-roll", description: "Transforme un dé faible en réussite forte contre les acariens.", tags: ["pest"], targets: ["mites"], effect: "pbi-strong-success" },
  { code: "BOTTE-023", name: "Orius laevigatus", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Contre les thrips, transforme un dé faible en réussite et réduit la Pression de 1.", tags: ["pest"], targets: ["thrips"], effect: "pbi-thrips-relief" },
  { code: "BOTTE-024", name: "Tensiomètre", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Eau.", tags: ["water"], effect: "cancel-danger" },
  { code: "BOTTE-025", name: "Plaque engluée de suivi", category: "equipment", rarity: "uncommon", xpCost: 1, timing: "before-roll", description: "Identifie le ravageur et récupère 1 XP pour préparer une réponse PBI.", tags: ["pest"], effect: "pest-monitor" },
  { code: "BOTTE-026", name: "Extracteur bien réglé", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Annule jusqu’à deux Dangers sur une Situation Climat ou Séchage.", tags: ["climate", "drying"], effect: "double-danger-shield" },
  { code: "BOTTE-027", name: "Papiers en règle", category: "equipment", rarity: "rare", xpCost: 3, timing: "before-roll", description: "Face à un contrôle DDTM, présente le dossier complet : les trois dés deviennent des réussites.", tags: ["compliance"], effect: "compliance-clearance" },
  { code: "BOTTE-028", name: "Branchement illégal", category: "luck", rarity: "uncommon", xpCost: 1, timing: "after-roll", description: "Après un mauvais jet sur la facture, transforme les deux dés les plus faibles en réussites mais gagne 2 Pression.", tags: ["energy"], effect: "illegal-power" },
  { code: "BOTTE-029", name: "Effeuillage mesuré", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Floraison ou Climat.", tags: ["flower", "climate"], effect: "reroll-neutral" },
  { code: "BOTTE-030", name: "Sonde d’humidité", category: "equipment", rarity: "rare", xpCost: 2, timing: "after-roll", description: "Pendant le Séchage, transforme un 2 en 4 ou un 3 en 5.", tags: ["drying"], effect: "moisture-calibration" },
  { code: "BOTTE-031", name: "Échéancier négocié", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Sur une Situation Énergie, réduit de 1 le nombre de réussites exigées par le créancier.", tags: ["energy"], effect: "bill-relief" },
  { code: "BOTTE-032", name: "Loupe à trichomes", category: "equipment", rarity: "rare", xpCost: 2, timing: "before-roll", description: "En Récolte, lance quatre dés, garde les trois meilleurs et gagne 1 Qualité en cas de réussite.", tags: ["harvest"], effect: "harvest-four-quality" },
  { code: "BOTTE-033", name: "Récolte au frais", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger en Récolte et réduit la Pression de 1 si la protection se déclenche.", tags: ["harvest", "climate"], effect: "harvest-cool" },
  { code: "BOTTE-034", name: "Gros molosse", category: "equipment", rarity: "rare", xpCost: 2, timing: "before-roll", description: "Protège toute la récolte contre le Renard à deux pattes, quel que soit le résultat des dés.", tags: ["security"], effect: "theft-guard" },
  { code: "BOTTE-035", name: "Récolte par lots", category: "know-how", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "En Récolte, transforme un Danger en résultat neutre pour isoler la partie fragile du lot.", tags: ["harvest"], effect: "danger-to-neutral" },
  { code: "BOTTE-036", name: "Sécateur propre", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger en Récolte et rapporte 1 XP si l’étape est réussie.", tags: ["harvest"], effect: "clean-cut" },
];

export function getKqCardTradeoff(card: KqSupportCard) {
  if (card.effect === "reveal-pest") return { benefit: "Révèle le ravageur et ouvre les PBI compatibles.", risk: "Consomme l’unique préparation du tour sans modifier directement les dés." };
  if (card.effect === "reroll-neutral") return { benefit: "Donne une nouvelle chance à un dé neutre.", risk: "La relance peut produire un Danger." };
  if (card.effect === "reroll-two-low") return { benefit: "Relance les deux dés les plus faibles.", risk: "Une nouvelle face peut être moins bonne que la précédente." };
  if (card.effect === "cancel-danger") return { benefit: "Protège le lancer contre un Danger.", risk: "La protection est perdue si aucun 1 ne sort." };
  if (card.effect === "neutral-to-success") return { benefit: "Transforme automatiquement un dé neutre en réussite.", risk: "La carte est perdue si aucun dé neutre ne sort." };
  if (card.effect === "four-keep-three") return { benefit: "Lance quatre dés et conserve les trois meilleurs.", risk: "Occupe l’unique préparation disponible." };
  if (card.effect === "three-to-success") return { benefit: "Transforme immédiatement un 3 en réussite.", risk: "Occupe l’unique réaction disponible." };
  if (card.effect === "water-test") return { benefit: "Relance le dé le plus faible et rembourse 1 XP si la mesure améliore le résultat.", risk: "La relance reste définitive et peut être moins bonne." };
  if (card.effect === "pest-monitor") return { benefit: "Identifie le ravageur à faible coût et ouvre la réserve PBI.", risk: "Ne modifie pas directement les dés." };
  if (card.effect === "double-danger-shield") return { benefit: "Peut annuler deux Dangers sur le même lancer.", risk: "Coûte 2 XP même si aucun Danger ne sort." };
  if (card.effect === "moisture-calibration") return { benefit: "Convertit précisément un dé neutre selon sa valeur.", risk: "Réservée au Séchage et exige un 2 ou un 3." };
  if (card.effect === "harvest-four-quality") return { benefit: "Sécurise le lancer et ajoute 1 Qualité sur une bonne récolte.", risk: "Réservée à la Récolte et coûte 2 XP." };
  if (card.effect === "harvest-cool") return { benefit: "Protège la récolte et fait retomber la Pression si nécessaire.", risk: "La baisse de Pression exige qu’un Danger soit effectivement annulé." };
  if (card.effect === "danger-to-neutral") return { benefit: "Isole un Danger sans garantir une réussite.", risk: "Occupe l’unique réaction et exige un Danger." };
  if (card.effect === "clean-cut") return { benefit: "Protège le lancer et rembourse 1 XP si la récolte réussit.", risk: "Réservée à la Récolte." };
  if (card.effect === "compliance-clearance") return { benefit: "Garantit immédiatement trois réussites pendant le contrôle DDTM.", risk: "Coûte 3 XP et ne sert que sur cette Situation administrative." };
  if (card.effect === "illegal-power") return { benefit: "Transforme les deux dés les plus faibles en réussites et évite la coupure.", risk: "Ajoute immédiatement 2 Pression et brûle la carte." };
  if (card.effect === "bill-relief") return { benefit: "Réduit de 1 le seuil de réussite de la facture électrique.", risk: "Ne change aucune face de dé et reste réservé aux Situations Énergie." };
  if (card.effect === "theft-guard") return { benefit: "Empêche toute perte de quantité lors du vol de récolte.", risk: "Ne change pas le verdict du jury et coûte 2 XP." };
  if (card.effect === "root-aeration") return { benefit: "Transforme un Danger en résultat neutre sur Racines ou Eau.", risk: "Le pot sèche vite : jouer la carte ajoute immédiatement 1 Pression." };
  if (card.effect === "living-soil-buffer") return { benefit: "La biologie du Sol vivant amortit automatiquement le premier Danger sur Racines ou Ravageur.", risk: "Le résultat devient seulement neutre et le système n'accélère pas les autres étapes." };
  if (card.effect === "starter-stability") return { benefit: "Garantit une réussite à partir d’un dé neutre quand les Racines n’en obtiennent aucune.", risk: "Ne se déclenche ni si une réussite est déjà présente, ni sur un lancer composé uniquement de Dangers." };
  if (card.effect === "hydroponic-control") return { benefit: "Relance un dé neutre sans jamais conserver un résultat inférieur sur Eau ou Floraison.", risk: "La circulation de la solution dépend de l'électricité." };
  if (card.effect === "aeroponic-precision") return { benefit: "Transforme automatiquement un dé neutre en réussite forte sur trois familles de Situations.", risk: "Une coupure de courant transforme les deux meilleurs dés en Dangers." };
  if (card.effect === "perlite-drainage") return { benefit: "Corrige le plus mauvais résultat : un Danger devient neutre ou un 2 devient réussite.", risk: "Ne transforme jamais un 1 directement en réussite et consomme la réaction." };
  if (card.effect === "biochar-buffer") return { benefit: "Amortit un Danger et fait baisser la Pression si le tampon se déclenche.", risk: "Coûte 2 XP avant de savoir si un Danger sortira." };
  if (card.effect === "organic-feed") return { benefit: "Convertit un résultat déjà solide en Étincelle et augmente le plafond de qualité.", risk: "Exige exactement deux réussites et un dé neutre après le lancer." };
  if (card.effect === "pbi-thrips-relief") return { benefit: "Corrige un dé faible contre les thrips et réduit immédiatement la Pression de 1.", risk: "Ne cible que les thrips et brûle l’unique réaction de l’étape." };
  if (card.effect === "pbi-success-xp") return { benefit: "Transforme un dé faible en réussite et peut rapporter 1 XP supplémentaire.", risk: "Brûle une PBI de la réserve et utilise l’unique réaction." };
  if (card.category === "pbi") return { benefit: "Transforme un dé faible en réussite et neutralise le ravageur ciblé.", risk: "Brûle une PBI de la réserve et utilise l’unique réaction." };
  return { benefit: card.description, risk: "La copie est définitivement brûlée après utilisation." };
}

export function getKqCultureSystemSummary(deckCodes: readonly string[]) {
  const card = KQ_CARDS.find((candidate) => (
    candidate.category === "substrate" && deckCodes.includes(candidate.code)
  ));
  if (!card) return null;
  const profile = getKqCultureSystemProfile(card.code);
  if (!profile) return null;
  return {
    code: card.code,
    name: card.name,
    technique: profile.technique,
    mastery: profile.mastery,
    electricity: profile.electricity,
  };
}

export const KQ_SITUATIONS: KqSituation[] = [
  { code: "SIT-001", stage: "Germination", name: "Départ hésitant", story: "La première pousse cherche son rythme.", difficulty: 1, tags: ["roots", "water"], successTrait: "Départ vigoureux", fragileTrait: "Départ prudent", failureTrait: "Germination lente" },
  { code: "SIT-007", stage: "Germination", name: "Nuit un peu fraîche", story: "La jeune pousse attend que les conditions deviennent plus accueillantes.", difficulty: 2, tags: ["climate", "roots"], successTrait: "Réveil énergique", fragileTrait: "Départ courageux", failureTrait: "Pousse frileuse" },
  { code: "SIT-002", stage: "Enracinement", name: "Substrat compact", story: "Les racines rencontrent une zone moins accueillante.", difficulty: 2, tags: ["roots"], successTrait: "Racines solides", fragileTrait: "Racines patientes", failureTrait: "Enracinement fragile" },
  { code: "SIT-008", stage: "Enracinement", name: "Réserve irrégulière", story: "Certaines zones du substrat sèchent plus vite que les autres.", difficulty: 2, tags: ["water", "roots"], successTrait: "Réserve équilibrée", fragileTrait: "Racines adaptables", failureTrait: "Racines assoiffées" },
  { code: "SIT-003", stage: "Croissance", name: "Traces sous les feuilles", story: "De petits visiteurs se sont installés, mais il faut encore les identifier.", difficulty: 2, tags: ["pest"], pest: "aphids", successTrait: "Feuillage protégé", fragileTrait: "Quelques marques", failureTrait: "Feuillage affaibli" },
  { code: "SIT-009", stage: "Croissance", name: "Poussée désordonnée", story: "La plante grandit vite, mais sa structure manque d’équilibre.", difficulty: 2, tags: ["climate", "flower"], successTrait: "Structure harmonieuse", fragileTrait: "Canopée sauvage", failureTrait: "Croissance déséquilibrée" },
  { code: "SIT-013", stage: "Croissance", name: "Feuillage ponctué", story: "De minuscules marques apparaissent ; la Loupe permettra d’identifier leur origine.", difficulty: 3, tags: ["pest"], pest: "mites", successTrait: "Acariens maîtrisés", fragileTrait: "Feuillage surveillé", failureTrait: "Pression d’acariens" },
  { code: "SIT-014", stage: "Croissance", name: "Reflets argentés", story: "Des stries claires apparaissent sur les jeunes feuilles ; une inspection révélera les visiteurs.", difficulty: 2, tags: ["pest"], pest: "thrips", successTrait: "Thrips maîtrisés", fragileTrait: "Marques contenues", failureTrait: "Jeunes feuilles marquées" },
  { code: "SIT-004", stage: "Floraison", name: "Coup de chaud", story: "La température grimpe au pire moment.", difficulty: 2, tags: ["climate", "flower"], successTrait: "Floraison expressive", fragileTrait: "Floraison résistante", failureTrait: "Arômes discrets" },
  { code: "SIT-010", stage: "Floraison", name: "Canopée trop dense", story: "Les fleurs se serrent et l’air circule moins facilement.", difficulty: 3, tags: ["flower", "climate"], successTrait: "Fleurs bien réparties", fragileTrait: "Floraison compacte", failureTrait: "Floraison étouffée" },
  { code: "SIT-005", stage: "Récolte", name: "Fenêtre idéale", story: "Il faut choisir le bon moment sans se précipiter.", difficulty: 2, tags: ["harvest"], successTrait: "Récolte précise", fragileTrait: "Récolte honnête", failureTrait: "Récolte précipitée" },
  { code: "SIT-011", stage: "Récolte", name: "Maturation inégale", story: "Toutes les fleurs ne semblent pas prêtes au même instant.", difficulty: 2, tags: ["harvest", "flower"], successTrait: "Tri méticuleux", fragileTrait: "Lot contrasté", failureTrait: "Tri approximatif" },
  { code: "SIT-006", stage: "Séchage & affinage", name: "Lot encore humide", story: "Le cœur du lot évolue moins vite que l’extérieur.", difficulty: 2, tags: ["drying", "climate"], successTrait: "Arômes préservés", fragileTrait: "Séchage acceptable", failureTrait: "Séchage irrégulier" },
  { code: "SIT-012", stage: "Séchage & affinage", name: "Séchage trop pressé", story: "L’extérieur du lot évolue rapidement et menace son équilibre.", difficulty: 3, tags: ["drying", "climate"], successTrait: "Affinage patient", fragileTrait: "Séchage rapide", failureTrait: "Arômes dissipés" },
  { code: "SIT-015", stage: "Germination", name: "Coque tenace", story: "La jeune pousse peine à se libérer complètement de son enveloppe.", difficulty: 2, tags: ["roots"], successTrait: "Émergence nette", fragileTrait: "Pousse volontaire", failureTrait: "Départ contraint" },
  { code: "SIT-016", stage: "Germination", name: "Surface trop sèche", story: "La couche supérieure perd son humidité plus vite que prévu.", difficulty: 2, tags: ["water", "roots"], successTrait: "Humidité régulière", fragileTrait: "Réveil tardif", failureTrait: "Levée irrégulière" },
  { code: "SIT-017", stage: "Germination", name: "Excès d’humidité", story: "Le jeune système racinaire manque d’air dans un milieu trop chargé en eau.", difficulty: 3, tags: ["water", "roots"], successTrait: "Départ bien aéré", fragileTrait: "Pousse sensible", failureTrait: "Racines engorgées" },
  { code: "SIT-018", stage: "Enracinement", name: "Pot qui retient l’eau", story: "L’eau s’évacue lentement et réduit l’air disponible autour des racines.", difficulty: 3, tags: ["water", "roots"], successTrait: "Drainage maîtrisé", fragileTrait: "Racines vigilantes", failureTrait: "Zone asphyxiée" },
  { code: "SIT-019", stage: "Enracinement", name: "Bord du pot colonisé", story: "Les racines atteignent rapidement les limites de leur espace.", difficulty: 2, tags: ["roots"], successTrait: "Chevelu dense", fragileTrait: "Racines contenues", failureTrait: "Croissance freinée" },
  { code: "SIT-020", stage: "Enracinement", name: "Arrosage trop rapproché", story: "Le substrat n’a pas eu le temps de retrouver son équilibre entre deux apports.", difficulty: 2, tags: ["water", "roots"], successTrait: "Cycle bien réglé", fragileTrait: "Rythme ajusté", failureTrait: "Racines paresseuses" },
  { code: "SIT-021", stage: "Croissance", name: "La facture qui pique", story: "Le compteur a tourné avec les lampes. Si les dés ne passent pas, le fournisseur coupe le courant pour l’étape suivante.", difficulty: 2, tags: ["energy", "climate"], incident: "electricity-bill", successTrait: "Facture maîtrisée", fragileTrait: "Échéance tendue", failureTrait: "Courant coupé" },
  { code: "SIT-022", stage: "Floraison", name: "Air trop humide", story: "L’humidité reste haute au cœur des fleurs et demande une bonne circulation d’air.", difficulty: 3, tags: ["climate", "flower"], successTrait: "Fleurs bien aérées", fragileTrait: "Humidité contenue", failureTrait: "Floraison humide" },
  { code: "SIT-023", stage: "Floraison", name: "Branches chargées", story: "Le poids des fleurs met les branches les plus fines à l’épreuve.", difficulty: 2, tags: ["flower"], successTrait: "Charpente solide", fragileTrait: "Branches souples", failureTrait: "Port affaissé" },
  { code: "SIT-024", stage: "Floraison", name: "Contrôle DDTM", story: "Une contrôleuse demande les justificatifs pendant que Sylvain tente de retrouver le bon classeur.", difficulty: 3, tags: ["compliance"], incident: "ddtm-inspection", successTrait: "Dossier irréprochable", fragileTrait: "Papiers éparpillés", failureTrait: "Contrôle défavorable" },
  { code: "SIT-025", stage: "Récolte", name: "Trichomes contrastés", story: "Les signes de maturité ne racontent pas exactement la même histoire partout.", difficulty: 3, tags: ["harvest", "flower"], successTrait: "Lecture précise", fragileTrait: "Choix prudent", failureTrait: "Maturité mal estimée" },
  { code: "SIT-026", stage: "Récolte", name: "Matinée trop chaude", story: "La température monte rapidement et menace la fraîcheur aromatique du lot.", difficulty: 2, tags: ["harvest", "climate"], successTrait: "Fraîcheur préservée", fragileTrait: "Récolte accélérée", failureTrait: "Arômes échauffés" },
  { code: "SIT-027", stage: "Récolte", name: "Renard à deux pattes", story: "Quelqu’un vient de repartir avec une caisse de la production. Sans protection, une partie du poids final disparaît.", difficulty: 3, tags: ["harvest", "security"], incident: "crop-theft", successTrait: "Voleur repoussé", fragileTrait: "Caisse entamée", failureTrait: "Production dérobée" },
  { code: "SIT-028", stage: "Séchage & affinage", name: "Air trop sec", story: "L’extérieur des fleurs sèche vite alors que leur cœur demande encore du temps.", difficulty: 3, tags: ["drying", "climate"], successTrait: "Séchage progressif", fragileTrait: "Surface sèche", failureTrait: "Fleurs cassantes" },
  { code: "SIT-029", stage: "Séchage & affinage", name: "Bocal trop rempli", story: "Le lot manque d’espace pour retrouver un équilibre homogène.", difficulty: 2, tags: ["drying"], successTrait: "Affinage homogène", fragileTrait: "Lot surveillé", failureTrait: "Affinage inégal" },
  { code: "SIT-030", stage: "Séchage & affinage", name: "Parfum encore vert", story: "Les premières notes végétales dominent encore et demandent de la patience.", difficulty: 2, tags: ["drying"], successTrait: "Bouquet affiné", fragileTrait: "Profil jeune", failureTrait: "Notes végétales" },
];

const clampSeed = (seed: number) => Math.abs(Math.floor(seed)) % 100000;

function deterministicDie(seed: number, stageIndex: number, nonce: number, dieIndex: number) {
  const x = Math.sin(seed * 12.9898 + stageIndex * 78.233 + nonce * 39.425 + dieIndex * 11.137) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 6) + 1;
}

export function getKqSituation(state: Pick<KqGameState, "stageIndex">) {
  const code = "situationCodes" in state ? (state as Pick<KqGameState, "situationCodes">).situationCodes[state.stageIndex] : undefined;
  return KQ_SITUATIONS.find((situation) => situation.code === code) ?? KQ_SITUATIONS.filter((situation) => situation.stage === KQ_STAGES[state.stageIndex])[0];
}

export type KqCultureSystemSituationStatus = {
  tone: "active" | "neutral" | "danger";
  label: string;
  detail: string;
};

const KQ_CULTURE_TAG_LABELS: Partial<Record<KqSituationTag, string>> = {
  roots: "Racines",
  water: "Eau",
  climate: "Climat",
  pest: "Ravageurs",
  flower: "Floraison",
};

export function getKqCultureSystemSituationStatus(
  state: Pick<KqGameState, "deckCodes" | "stageIndex" | "situationCodes" | "powerOutage">,
): KqCultureSystemSituationStatus | null {
  const situation = getKqSituation(state);
  const summary = getKqCultureSystemSummary(state.deckCodes);
  const card = summary ? KQ_CARDS.find((candidate) => candidate.code === summary.code) : null;
  if (!summary || !card) return null;

  if (state.powerOutage && card.effect === "aeroponic-precision") {
    return {
      tone: "danger",
      label: "Coupure critique",
      detail: "Les pompes sont arrêtées : le bonus est suspendu et les deux meilleurs dés deviendront des Dangers.",
    };
  }
  if (state.powerOutage && card.effect === "hydroponic-control") {
    return {
      tone: "danger",
      label: "Pompe arrêtée",
      detail: "La relance hydroponique est suspendue et la coupure transformera le meilleur dé en Danger.",
    };
  }
  if (state.powerOutage) {
    return {
      tone: "danger",
      label: "Coupure en cours",
      detail: "Le mode garde sa règle passive, mais la coupure transformera le meilleur dé en Danger.",
    };
  }

  const matches = card.tags.some((tag) => situation.tags.includes(tag));
  if (matches) {
    return {
      tone: "active",
      label: "Avantage actif",
      detail: getKqCardTradeoff(card).benefit,
    };
  }
  const specialties = card.tags
    .map((tag) => KQ_CULTURE_TAG_LABELS[tag])
    .filter((label): label is string => Boolean(label));
  return {
    tone: "neutral",
    label: "Effet en veille",
    detail: specialties.length > 0
      ? `Ce mode intervient surtout sur : ${specialties.join(" · ")}.`
      : "Ce mode n’intervient pas directement sur cette Situation.",
  };
}

export function buildKqScenarioPath(seed: number, recentSituationCodes: string[] = [], requiredTags: KqSituationTag[] = [], allowedPests: KqPest[] = []) {
  const path = KQ_STAGES.map((stage, stageIndex) => {
    const pool = KQ_SITUATIONS.filter((situation) => situation.stage === stage);
    const fresh = pool.filter((situation) => !recentSituationCodes.includes(situation.code));
    const candidates = fresh.length > 0 ? fresh : pool;
    return candidates[Math.abs(seed * 7 + stageIndex * 11) % candidates.length].code;
  });
  requiredTags.forEach((tag, tagIndex) => {
    if (path.some((code) => {
      const situation = KQ_SITUATIONS.find((item) => item.code === code);
      return situation?.tags.includes(tag) && (tag !== "pest" || allowedPests.length === 0 || Boolean(situation.pest && allowedPests.includes(situation.pest)));
    })) return;
    const tagged = KQ_SITUATIONS.filter((situation) => situation.tags.includes(tag));
    const candidates = tag === "pest" && allowedPests.length > 0
      ? tagged.filter((situation) => situation.pest && allowedPests.includes(situation.pest))
      : tagged;
    if (candidates.length === 0) return;
    const fresh = candidates.filter((situation) => !recentSituationCodes.includes(situation.code));
    const pool = fresh.length > 0 ? fresh : candidates;
    const replacement = pool[Math.abs(seed * 13 + tagIndex * 17) % pool.length];
    path[KQ_STAGES.indexOf(replacement.stage)] = replacement.code;
  });
  return path;
}

export function startKqGame(
  seed = Date.now(),
  config: { varietyCode?: string; deckCodes?: string[]; collectionCodes?: string[]; recentSituationCodes?: string[]; challengeDayKey?: string; requiredSituationTags?: KqSituationTag[]; allowedPests?: KqPest[]; startingXp?: number; startedAt?: string; heritageCode?: string; heritageCard?: KqHeritageCard; equipmentCodes?: string[] } = {},
): KqGameState {
  const buddie = KQ_BUDDIES.find((item) => item.code === config.varietyCode) ?? KQ_BUDDIES[0];
  const requestedDeck = config.deckCodes ?? KQ_CARDS.slice(0, 6).map((card) => card.code);
  const requestedCards = requestedDeck
    .map((code) => KQ_CARDS.find((card) => card.code === code))
    .filter((card): card is KqSupportCard => Boolean(card) && card?.category !== "pbi");
  const requestedSubstrate = requestedCards.find((card) => card.category === "substrate");
  let substrateAdded = false;
  const deckCodes = requestedCards.filter((card) => {
    if (card.category !== "substrate") return true;
    if (card.code !== requestedSubstrate?.code || substrateAdded) return false;
    substrateAdded = true;
    return true;
  }).map((card) => card.code);
  if (!deckCodes.some((code) => KQ_CARDS.find((card) => card.code === code)?.category === "substrate")) deckCodes.unshift("BOTTE-001");
  const situationCodes = buildKqScenarioPath(clampSeed(seed), config.recentSituationCodes, config.requiredSituationTags, config.allowedPests);
  const substrate = KQ_CARDS.find((card) => deckCodes.includes(card.code) && card.category === "substrate") ?? KQ_CARDS[0];
  const heritage = config.heritageCard
    ?? KQ_HERITAGE_CARDS.find((card) => card.code === config.heritageCode);
  const equipmentCodes = [...new Set(config.equipmentCodes ?? [])]
    .filter((code) => Boolean(getKqEquipmentDefinition(code)));
  const equipment = { codes: equipmentCodes, ...summarizeKqEquipmentLoadout(equipmentCodes) };
  const initialState: KqGameState = {
    seed: clampSeed(seed), ...(config.challengeDayKey ? { challengeDayKey: config.challengeDayKey } : {}), ...(config.startedAt ? { startedAt: config.startedAt } : {}), varietyCode: buddie.code, varietyName: buddie.name, deckCodes,
    collectionCodes: config.collectionCodes ?? KQ_CARDS.map((card) => card.code),
    situationCodes,
    ...(heritage ? {
      heritageCode: heritage.code,
      heritageName: heritage.name,
      heritageTiming: heritage.timing,
      heritageEffect: heritage.effect,
      ...(heritage.producerName ? { heritageProducerName: heritage.producerName } : {}),
      ...(heritage.imageUrl ? { heritageImageUrl: heritage.imageUrl } : {}),
      heritageUsed: false,
      heritageArmed: false,
    } : {}),
    stageIndex: 0, phase: "prepare", xp: Math.max(1, config.startingXp ?? 1) + buddie.advantageLevel + (heritage?.effect === "starting-xp-two" ? 2 : 0), quality: 0, equipment, dice: null, bonusDie: null, effectNotices: [
      ...(buddie.advantageLevel > 0 ? [`${buddie.name} : +${buddie.advantageLevel} XP au départ.`] : []),
      ...(heritage?.effect === "starting-xp-two" ? [`${heritage.name} : +2 XP au départ.`] : []),
      ...(equipmentCodes.length > 0 ? [`Installation : ${equipmentCodes.length} équipement${equipmentCodes.length > 1 ? "s" : ""} · ${equipment.powerWatts} W.`] : []),
      ...(equipment.pressureDelta > 0 ? [`Grande installation : +${equipment.pressureDelta} Pression au départ.`] : []),
    ],
    rollNonce: 0, pressure: Math.max(0, Math.min(4, equipment.pressureDelta)), cancelledDangers: 0, powerOutage: false, harvestLossPercent: 0,
    preparationPlayed: false, reactionPlayed: false, revealedPest: null, playedThisStage: [substrate.code], usedCards: [substrate.code],
    traits: [], combos: [], lastOutcome: null, history: [],
  };
  const openingDraw = drawKqAvailableHandCodes(initialState, heritage?.effect === "opening-hand-reserve" ? KQ_HAND_SIZE + KQ_HERITAGE_RESERVE_SIZE : KQ_HAND_SIZE);
  return {
    ...initialState,
    handCodes: openingDraw.slice(0, KQ_HAND_SIZE),
    ...(openingDraw.length > KQ_HAND_SIZE ? { heritageReserveCodes: openingDraw.slice(KQ_HAND_SIZE) } : {}),
    handRedrawsUsed: 0,
  };
}

export function canPlayKqCard(state: KqGameState, card: KqSupportCard) {
  const situation = getKqSituation(state);
  if (!situation || state.phase === "resolved" || state.phase === "complete") return { allowed: false, reason: "L’étape est déjà terminée." };
  const ownsCard = state.collectionCodes.includes(card.code);
  const collectionPbi = card.category === "pbi" && state.revealedPest !== null && ownsCard;
  if (card.category === "pbi" && !ownsCard) return { allowed: false, reason: "Cette carte PBI n’est pas dans ta collection." };
  if (!state.deckCodes.includes(card.code) && !collectionPbi) return { allowed: false, reason: "Cette carte n’est pas dans le deck." };
  if (!collectionPbi && card.category !== "substrate" && !getKqHandCodes(state).includes(card.code)) return { allowed: false, reason: "Cette carte n’est pas dans ta main pour cette étape." };
  if (card.timing === "passive") return { allowed: false, reason: "Ce Substrat est déjà actif." };
  const deckCopies = state.deckCodes.filter((code) => code === card.code).length;
  const usedCopies = state.usedCards.filter((code) => code === card.code).length;
  if (!collectionPbi && usedCopies >= deckCopies) return { allowed: false, reason: "Toutes les copies de cette carte ont été utilisées." };
  if (collectionPbi && card.category === "pbi" && state.playedThisStage.includes(card.code)) return { allowed: false, reason: "Cet auxiliaire a déjà été utilisé à cette étape." };
  if (state.xp < card.xpCost) return { allowed: false, reason: `Il faut ${card.xpCost} XP.` };
  if (card.category === "pbi" && !state.revealedPest) return { allowed: false, reason: "Utilise d’abord la Loupe d’inspection." };
  if (card.category === "pbi" && state.revealedPest && !card.targets?.includes(state.revealedPest)) return { allowed: false, reason: "Cet auxiliaire ne cible pas le ravageur révélé." };
  if (card.timing === "before-roll" && state.phase !== "prepare") return { allowed: false, reason: "À jouer avant les dés." };
  if (card.timing === "after-roll" && state.phase !== "rolled") return { allowed: false, reason: "À jouer après les dés." };
  if (card.timing === "before-roll" && state.preparationPlayed) return { allowed: false, reason: "Une préparation a déjà été jouée." };
  if (card.timing === "after-roll" && state.reactionPlayed) return { allowed: false, reason: "Une réaction a déjà été jouée." };
  if (card.effect === "three-to-success" && state.dice && !state.dice.includes(3)) return { allowed: false, reason: "Il faut un dé affichant 3 à transformer." };
  if (card.effect === "moisture-calibration" && state.dice && !state.dice.some((die) => die === 2 || die === 3)) return { allowed: false, reason: "Il faut un dé affichant 2 ou 3 à calibrer." };
  if (card.effect === "danger-to-neutral" && state.dice && !state.dice.includes(1)) return { allowed: false, reason: "Il faut un Danger à isoler." };
  if (card.effect === "perlite-drainage" && state.dice && !state.dice.some((die) => die === 1 || die === 2)) return { allowed: false, reason: "Il faut un dé affichant 1 ou 2 à corriger." };
  if (card.effect === "organic-feed" && state.dice && (state.dice.filter((die) => die >= 4).length !== 2 || !state.dice.some((die) => die === 2 || die === 3))) return { allowed: false, reason: "Il faut exactement deux réussites et un dé neutre." };
  if (card.effect === "reroll-two-low" && state.dice && state.dice.every((die) => die >= 4)) return { allowed: false, reason: "Aucun dé faible ne justifie cette relance." };
  if (card.effect === "illegal-power" && situation.incident !== "electricity-bill") return { allowed: false, reason: "Cette prise de risque ne répond qu’à la facture électrique." };
  if (card.effect === "illegal-power" && state.dice && ["success", "critical"].includes(previewKqResolution(state)?.outcome ?? "")) return { allowed: false, reason: "La facture est déjà maîtrisée : inutile de prendre ce risque." };
  if (card.category === "pbi" && state.dice && state.dice.every((die) => die >= 4)) return { allowed: false, reason: "Tous les dés sont déjà des réussites." };
  if (card.tags.length > 0 && !card.tags.some((tag) => situation.tags.includes(tag))) return { allowed: false, reason: "Cette carte ne répond pas à la Situation." };
  return { allowed: true, reason: card.timing === "before-roll" ? "Prépare le lancer." : "Peut modifier le résultat." };
}

function drawKqAvailableHandCodes(
  state: Pick<KqGameState, "deckCodes" | "usedCards" | "seed" | "stageIndex" | "handRedrawsUsed">,
  limit = KQ_HAND_SIZE,
) {
  const burnsLeft = state.usedCards.reduce<Record<string, number>>((counts, code) => {
    counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});
  const remaining = state.deckCodes.filter((code) => {
    const card = KQ_CARDS.find((item) => item.code === code);
    if (!card || card.category === "substrate" || card.category === "pbi") return false;
    if ((burnsLeft[code] ?? 0) <= 0) return true;
    burnsLeft[code] -= 1;
    return false;
  });
  return remaining
    .map((code, index) => ({
      code,
      index,
      order: Math.sin((state.seed + 1) * 17.137 + (state.stageIndex + 1) * 31.733 + (index + 1) * 11.919 + ((state.handRedrawsUsed ?? 0) + 1) * 53.417),
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.code);
}

export function getKqHandCodes(state: Pick<KqGameState, "deckCodes" | "usedCards" | "seed" | "stageIndex" | "handCodes" | "handRedrawsUsed">) {
  return Array.isArray(state.handCodes) ? state.handCodes : drawKqAvailableHandCodes(state);
}

export function redrawKqHand(state: KqGameState): KqGameState {
  const supportPlayedThisStage = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.category !== "substrate");
  const redrawLimit = getKqStateHeritage(state)?.effect === "two-extra-redraws" ? 3 : 1;
  if (state.phase !== "prepare" || state.preparationPlayed || supportPlayedThisStage || (state.handRedrawsUsed ?? 0) >= redrawLimit) return state;
  const nextState = { ...state, handCodes: undefined, heritageReserveCodes: undefined, handRedrawsUsed: (state.handRedrawsUsed ?? 0) + 1 };
  return { ...nextState, handCodes: drawKqAvailableHandCodes(nextState) };
}

export function swapKqHeritageHandCard(state: KqGameState, handIndex: number, reserveIndex: number): KqGameState {
  const heritage = getKqStateHeritage(state);
  const hand = getKqHandCodes(state);
  const reserve = state.heritageReserveCodes ?? [];
  if (
    heritage?.effect !== "opening-hand-reserve"
    || state.stageIndex !== 0
    || state.phase !== "prepare"
    || state.heritageUsed
    || state.preparationPlayed
    || !Number.isInteger(handIndex)
    || !Number.isInteger(reserveIndex)
    || handIndex < 0
    || handIndex >= hand.length
    || reserveIndex < 0
    || reserveIndex >= reserve.length
  ) return state;
  const nextHand = [...hand];
  const nextReserve = [...reserve];
  [nextHand[handIndex], nextReserve[reserveIndex]] = [nextReserve[reserveIndex], nextHand[handIndex]];
  return {
    ...state,
    handCodes: nextHand,
    heritageReserveCodes: nextReserve,
    effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} : échange effectué, la main reste à ${KQ_HAND_SIZE} cartes.`),
  };
}

export function canActivateKqHeritage(state: KqGameState) {
  const heritage = getKqStateHeritage(state);
  if (!heritage) return { allowed: false, reason: "Aucun Héritage équipé." };
  if (heritage.timing === "passive") return { allowed: false, reason: "Cet Héritage est passif." };
  if (state.heritageUsed) return { allowed: false, reason: "Cet Héritage a déjà été utilisé." };
  if (heritage.effect === "five-keep-three") {
    if (state.heritageArmed) return { allowed: false, reason: "Le quatrième dé est déjà armé." };
    return state.phase === "prepare"
      ? { allowed: true, reason: "Arme le quatrième dé pour ce lancer." }
      : { allowed: false, reason: "À activer avant le lancer." };
  }
  if (heritage.effect === "free-pest-mastery") {
    const pest = getKqSituation(state).pest;
    return pest && state.revealedPest === null && ["prepare", "rolled"].includes(state.phase)
      ? { allowed: true, reason: "Révèle gratuitement le ravageur." }
      : { allowed: false, reason: "Aucun ravageur caché à inspecter." };
  }
  if (state.phase !== "rolled" || !state.dice) return { allowed: false, reason: "À activer après le lancer." };
  if (heritage.effect === "germination-lowest-to-strong" && state.stageIndex !== 0) return { allowed: false, reason: "Réservé à la Germination." };
  if (heritage.effect === "rooting-pressure-reset" && state.stageIndex !== 1) return { allowed: false, reason: "Réservé à l’Enracinement." };
  if (heritage.effect === "rooting-pressure-reset" && state.pressure <= 0) return { allowed: false, reason: "La Pression est déjà à zéro." };
  if (heritage.effect === "growth-danger-reroll" && state.stageIndex !== 2) return { allowed: false, reason: "Réservé à la Croissance." };
  if (heritage.effect === "growth-danger-reroll" && state.dice.filter((die) => die === 1).length <= state.cancelledDangers) return { allowed: false, reason: "Aucun Danger non protégé à relancer." };
  if (heritage.effect === "flower-success-to-spark" && state.stageIndex !== 3) return { allowed: false, reason: "Réservé à la Floraison." };
  if (heritage.effect === "flower-success-to-spark" && !state.dice.some((die) => die === 4 || die === 5)) return { allowed: false, reason: "Aucune réussite ordinaire à transformer." };
  if (heritage.effect === "flower-neutrals-to-success" && KQ_STAGES[state.stageIndex] !== "Floraison") return { allowed: false, reason: "Réservé à la Floraison." };
  if (heritage.effect === "drying-lowest-to-spark" && state.stageIndex !== KQ_STAGES.length - 1) return { allowed: false, reason: "Réservé au séchage et à l’affinage." };
  if (heritage.effect === "neutral-to-spark" && !state.dice.some((die) => die === 2 || die === 3)) return { allowed: false, reason: "Aucun dé neutre à transformer." };
  if (heritage.effect === "flower-neutrals-to-success" && !state.dice.some((die) => die === 2 || die === 3)) return { allowed: false, reason: "Aucun dé neutre à transformer." };
  if (heritage.effect === "dangers-to-success" && state.dice.filter((die) => die === 1).length <= state.cancelledDangers) return { allowed: false, reason: "Aucun Danger non protégé à transformer." };
  return [
    "neutral-to-spark",
    "flower-neutrals-to-success",
    "drying-lowest-to-spark",
    "dangers-to-success",
    "germination-lowest-to-strong",
    "rooting-pressure-reset",
    "growth-danger-reroll",
    "flower-success-to-spark",
  ].includes(heritage.effect)
    ? { allowed: true, reason: "Pouvoir disponible." }
    : { allowed: false, reason: "Cet Héritage se déclenche automatiquement." };
}

export function activateKqHeritage(state: KqGameState): KqGameState {
  const permission = canActivateKqHeritage(state);
  if (!permission.allowed) return state;
  const heritage = getKqStateHeritage(state)!;
  if (heritage.effect === "five-keep-three") {
    return { ...state, heritageArmed: true, effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} armée : le prochain lancer utilisera 5 dés.`) };
  }
  if (heritage.effect === "free-pest-mastery") {
    return { ...state, heritageUsed: true, xp: state.xp + 2, revealedPest: getKqSituation(state).pest ?? null, effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} : ravageur identifié gratuitement et +2 XP.`) };
  }
  if (heritage.effect === "rooting-pressure-reset") {
    return {
      ...state,
      pressure: 0,
      heritageUsed: true,
      effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} : la Pression retombe à zéro.`),
    };
  }
  const dice = [...state.dice!] as [number, number, number];
  let rollNonce = state.rollNonce;
  let cancelledDangers = state.cancelledDangers;
  if (heritage.effect === "neutral-to-spark") {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    dice[index] = 6;
  } else if (heritage.effect === "flower-neutrals-to-success") {
    dice.splice(0, dice.length, ...dice.map((die) => die === 2 || die === 3 ? 4 : die) as [number, number, number]);
  } else if (heritage.effect === "drying-lowest-to-spark") {
    const index = dice.indexOf(Math.min(...dice));
    dice[index] = 6;
  } else if (heritage.effect === "dangers-to-success") {
    dice.splice(0, dice.length, ...dice.map((die) => die === 1 ? 4 : die) as [number, number, number]);
    cancelledDangers = 0;
  } else if (heritage.effect === "germination-lowest-to-strong") {
    const index = dice.indexOf(Math.min(...dice));
    dice[index] = 5;
  } else if (heritage.effect === "growth-danger-reroll") {
    const dangerIndexes = dice.flatMap((die, index) => die === 1 ? [index] : []);
    const index = dangerIndexes[Math.min(cancelledDangers, dangerIndexes.length - 1)];
    if (index !== undefined) {
      rollNonce += 1;
      dice[index] = deterministicDie(state.seed, state.stageIndex, rollNonce, index);
    }
  } else if (heritage.effect === "flower-success-to-spark") {
    const index = dice.findIndex((die) => die === 4 || die === 5);
    dice[index] = 6;
  }
  return {
    ...state, dice, rollNonce, cancelledDangers, heritageUsed: true,
    effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} activé : ${heritage.description}`),
  };
}

export function getKqVisibleActionCards(state: KqGameState) {
  const handCodes = getKqHandCodes(state);
  return KQ_CARDS.filter((card) => {
    if (card.timing === "passive") return false;
    if (handCodes.includes(card.code)) return true;
    return card.category === "pbi"
      && state.revealedPest !== null
      && state.collectionCodes.includes(card.code)
      && Boolean(card.targets?.includes(state.revealedPest));
  });
}

export function playKqCard(state: KqGameState, cardCode: string): KqGameState {
  const card = KQ_CARDS.find((item) => item.code === cardCode);
  if (!card) throw new Error("Carte inconnue.");
  const permission = canPlayKqCard(state, card);
  if (!permission.allowed) return state;

  let dice = state.dice;
  const diceBefore = state.dice ? [...state.dice] : null;
  let rollNonce = state.rollNonce;
  let revealedPest = state.revealedPest;
  if (["reveal-pest", "pest-monitor"].includes(card.effect) && getKqSituation(state).pest) revealedPest = getKqSituation(state).pest ?? null;
  if (card.effect === "reroll-two-low" && dice) {
    const indexes = [0, 1, 2].sort((a, b) => dice![a] - dice![b]).slice(0, 2);
    const nextDice: [number, number, number] = [...dice];
    indexes.forEach((index, offset) => { nextDice[index] = deterministicDie(state.seed, state.stageIndex, rollNonce + offset + 1, index); });
    dice = nextDice;
    rollNonce += 2;
  }
  let pressureRelief = 0;
  if (dice && ["pbi-success", "pbi-success-xp", "pbi-thrips-relief"].includes(card.effect)) {
    const index = dice.findIndex((die) => die < 4);
    if (index >= 0) {
      dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
      if (card.effect === "pbi-thrips-relief") pressureRelief = 1;
    }
  }
  if (dice && card.effect === "pbi-strong-success") {
    const index = dice.findIndex((die) => die < 4);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 5 : die) as [number, number, number];
  }
  if (dice && card.effect === "three-to-success") {
    const index = dice.findIndex((die) => die === 3);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
  }
  let effectXpRefund = card.effect === "pest-monitor" ? 1 : 0;
  if (dice && card.effect === "water-test") {
    const index = dice.indexOf(Math.min(...dice));
    const previous = dice[index];
    const next = deterministicDie(state.seed, state.stageIndex, rollNonce + 1, index);
    dice = dice.map((die, dieIndex) => dieIndex === index ? next : die) as [number, number, number];
    rollNonce += 1;
    if (next > previous) effectXpRefund += 1;
  }
  if (dice && card.effect === "moisture-calibration") {
    const threeIndex = dice.findIndex((die) => die === 3);
    const index = threeIndex >= 0 ? threeIndex : dice.findIndex((die) => die === 2);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? (die === 3 ? 5 : 4) : die) as [number, number, number];
  }
  if (dice && card.effect === "danger-to-neutral") {
    const index = dice.findIndex((die) => die === 1);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 3 : die) as [number, number, number];
  }
  if (dice && card.effect === "perlite-drainage") {
    const dangerIndex = dice.findIndex((die) => die === 1);
    const index = dangerIndex >= 0 ? dangerIndex : dice.findIndex((die) => die === 2);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? (die === 1 ? 2 : 4) : die) as [number, number, number];
  }
  if (dice && card.effect === "organic-feed") {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 6 : die) as [number, number, number];
  }
  if (dice && card.effect === "illegal-power") {
    const indexes = [0, 1, 2].sort((left, right) => dice![left] - dice![right]).slice(0, 2);
    dice = dice.map((die, index) => indexes.includes(index) ? 4 : die) as [number, number, number];
  }

  const effectNotice = diceBefore && dice
    ? `${card.name} : ${diceBefore.join(" · ")} → ${dice.join(" · ")}.${pressureRelief ? " Pression −1." : ""}`
    : ["reveal-pest", "pest-monitor"].includes(card.effect) && revealedPest
      ? `${card.name} : ${revealedPest === "aphids" ? "pucerons" : revealedPest === "mites" ? "acariens" : "thrips"} identifiés, réserve PBI ouverte.`
      : `${card.name} activée : ${card.description}`;
  return {
    ...state, xp: state.xp - card.xpCost + effectXpRefund, dice, rollNonce, revealedPest,
    pressure: Math.max(0, Math.min(4, state.pressure + (card.effect === "illegal-power" ? 2 : card.effect === "root-aeration" ? 1 : 0) - pressureRelief)),
    preparationPlayed: state.preparationPlayed || card.timing === "before-roll",
    reactionPlayed: state.reactionPlayed || card.timing === "after-roll",
    playedThisStage: [...state.playedThisStage, card.code], usedCards: [...state.usedCards, card.code],
    effectNotices: appendKqEffectNotice(state.effectNotices, effectNotice),
  };
}

export function rollKqDice(state: KqGameState): KqGameState {
  if (state.phase !== "prepare") return state;
  const situation = getKqSituation(state);
  let nonce = state.rollNonce + 1;
  const playedEffects = state.playedThisStage.map((code) => KQ_CARDS.find((card) => card.code === code)).filter((card) => card?.timing !== "passive").map((card) => card?.effect);
  const mainVerte = playedEffects.includes("four-keep-three") || playedEffects.includes("harvest-four-quality");
  const heritageFiveDice = state.heritageArmed && getKqStateHeritage(state)?.effect === "five-keep-three";
  const dieCount = heritageFiveDice ? 5 : mainVerte ? 4 : 3;
  let rolled = Array.from({ length: dieCount }, (_, index) => deterministicDie(state.seed, state.stageIndex, nonce, index));
  let bonusDie: number | null = null;
  const effectNotices = [...(state.effectNotices ?? [])];
  if (dieCount > 3) {
    const sorted = [...rolled].sort((a, b) => b - a);
    bonusDie = sorted.at(-1) ?? null;
    rolled = sorted.slice(0, 3);
    effectNotices.push(heritageFiveDice
      ? `Signature du maître : 5 dés lancés, les 2 moins bons écartés, les 3 meilleurs conservés.`
      : `Main verte : 4 dés lancés, ${bonusDie} écarté, les 3 meilleurs conservés.`);
  }
  let dice = rolled as [number, number, number];
  let rollPressureRelief = 0;
  const substrate = KQ_CARDS.find((card) => state.deckCodes.includes(card.code) && card.category === "substrate");
  const substrateMatches = substrate?.tags.some((tag) => situation.tags.includes(tag)) ?? false;
  const shouldRerollNeutral = (substrate?.effect === "reroll-neutral" && substrateMatches) || playedEffects.includes("reroll-neutral");
  if (shouldRerollNeutral) {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    if (index >= 0) {
      const previous = dice[index];
      nonce += 1;
      dice = dice.map((die, dieIndex) => dieIndex === index ? deterministicDie(state.seed, state.stageIndex, nonce, index) : die) as [number, number, number];
      effectNotices.push(`${playedEffects.includes("reroll-neutral") ? "Carte de relance" : substrate?.name ?? "Substrat"} : dé neutre ${previous} relancé en ${dice[index]}.`);
    }
    else effectNotices.push(`${playedEffects.includes("reroll-neutral") ? "Carte de relance" : substrate?.name ?? "Substrat"} : aucun dé neutre, relance non déclenchée.`);
  }
  if (substrate?.effect === "hydroponic-control" && substrateMatches && !state.powerOutage) {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    if (index >= 0) {
      const previous = dice[index];
      nonce += 1;
      const rerolled = deterministicDie(state.seed, state.stageIndex, nonce, index);
      dice = dice.map((die, dieIndex) => dieIndex === index ? Math.max(previous, rerolled) : die) as [number, number, number];
      effectNotices.push(rerolled < previous
        ? `Hydroponie : relance ${rerolled}, la face neutre ${previous} est conservée.`
        : `Hydroponie : la face neutre ${previous} s’améliore en ${rerolled}.`);
    } else effectNotices.push("Hydroponie : aucun dé neutre, correction pH–EC non déclenchée.");
  }
  if (substrate?.effect === "aeroponic-precision" && substrateMatches && !state.powerOutage) {
    const threeIndex = dice.findIndex((die) => die === 3);
    const index = threeIndex >= 0 ? threeIndex : dice.findIndex((die) => die === 2);
    if (index >= 0) {
      const previous = dice[index];
      dice = dice.map((die, dieIndex) => dieIndex === index ? 5 : die) as [number, number, number];
      effectNotices.push(`Aéroponie : la brumisation précise transforme le dé ${previous} en réussite forte.`);
    } else effectNotices.push("Aéroponie : aucun dé neutre à pousser vers une réussite forte.");
  }
  if (substrate?.effect === "starter-stability" && substrateMatches && !dice.some((die) => die >= 4)) {
    const neutralIndexes = dice.flatMap((die, index) => die === 2 || die === 3 ? [index] : []);
    const index = neutralIndexes.sort((left, right) => dice[right] - dice[left])[0];
    if (index !== undefined) {
      const previous = dice[index];
      dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
      effectNotices.push(`Terreau horticole : aucune réussite, le meilleur dé neutre ${previous} devient 4.`);
    } else effectNotices.push("Terreau horticole : aucun dé neutre à stabiliser dans ce lancer de Dangers.");
  }
  if (substrate?.effect === "living-soil-buffer" && substrateMatches) {
    const index = dice.findIndex((die) => die === 1);
    if (index >= 0) {
      dice = dice.map((die, dieIndex) => dieIndex === index ? 3 : die) as [number, number, number];
      effectNotices.push("Sol vivant : le premier Danger est amorti par le tampon biologique.");
    } else effectNotices.push("Sol vivant : aucun Danger à amortir sur ce lancer.");
  }
  if (playedEffects.includes("root-aeration")) {
    const index = dice.findIndex((die) => die === 1);
    if (index >= 0) {
      dice = dice.map((die, dieIndex) => dieIndex === index ? 3 : die) as [number, number, number];
      effectNotices.push("Pot en tissu : un Danger devient neutre grâce à l’aération des racines.");
    } else effectNotices.push("Pot en tissu : aucun Danger à amortir, mais le substrat sèche plus vite.");
  }
  if (playedEffects.includes("biochar-buffer")) {
    const index = dice.findIndex((die) => die === 1);
    if (index >= 0) {
      dice = dice.map((die, dieIndex) => dieIndex === index ? 3 : die) as [number, number, number];
      rollPressureRelief = 1;
      effectNotices.push("Biochar inoculé : un Danger devient neutre et la Pression baisse de 1.");
    } else effectNotices.push("Biochar inoculé : aucun Danger à tamponner, les 2 XP sont dépensés.");
  }
  const convertNeutral = playedEffects.includes("neutral-to-success");
  if (convertNeutral) {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    if (index >= 0) {
      const previous = dice[index];
      dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
      effectNotices.push(`Transformation réussie : le dé neutre ${previous} devient 4.`);
    }
    else effectNotices.push("Transformation prête, mais aucun dé neutre : effet non déclenché.");
  }
  if (playedEffects.includes("compliance-clearance")) {
    dice = [4, 4, 4];
    effectNotices.push("Papiers en règle : dossier accepté, les trois dés deviennent des réussites.");
  }
  if (state.powerOutage) {
    const affectedCount = substrate?.effect === "aeroponic-precision" ? 2 : 1;
    const indexes = [0, 1, 2].sort((left, right) => dice[right] - dice[left]).slice(0, affectedCount);
    const previous = indexes.map((index) => dice[index]).join(" et ");
    dice = dice.map((die, dieIndex) => indexes.includes(dieIndex) ? 1 : die) as [number, number, number];
    effectNotices.push(substrate?.effect === "aeroponic-precision"
      ? `Coupure de courant : les pompes aéroponiques s'arrêtent, les dés ${previous} deviennent des Dangers.`
      : `Coupure de courant : le meilleur dé ${previous} devient un Danger.`);
  }
  let cancelledDangers = playedEffects.includes("double-danger-shield") ? 2
    : playedEffects.some((effect) => ["cancel-danger", "harvest-cool", "clean-cut"].includes(effect ?? "")) ? 1 : 0;
  const heritage = getKqStateHeritage(state);
  const heritageDangerShield = !state.heritageUsed
    && heritage?.effect === "first-danger-shield"
    && dice.filter((die) => die === 1).length > cancelledDangers;
  if (heritageDangerShield) {
    cancelledDangers += 1;
    effectNotices.push(`${heritage.name} : un Danger non protégé est annulé.`);
  }
  const openingHandConsumed = !state.heritageUsed && heritage?.effect === "opening-hand-reserve" && state.stageIndex === 0;
  const rootSpark = !state.heritageUsed
    && heritage?.effect === "root-danger-to-spark"
    && KQ_STAGES[state.stageIndex] === "Enracinement"
    && dice.filter((die) => die === 1).length > cancelledDangers;
  const climateSpark = !state.heritageUsed
    && heritage?.effect === "climate-danger-to-spark"
    && situation.tags.includes("climate")
    && dice.filter((die) => die === 1).length > cancelledDangers;
  const automaticSpark = rootSpark || climateSpark;
  if (automaticSpark) {
    const dangerIndexes = dice.flatMap((die, index) => die === 1 ? [index] : []);
    const index = dangerIndexes[Math.min(cancelledDangers, dangerIndexes.length - 1)];
    if (index !== undefined) dice[index] = 6;
    effectNotices.push(`${heritage?.name} : un Danger devient une Étincelle.`);
  }
  if (cancelledDangers > 0) {
    const cancelledNow = Math.min(cancelledDangers, dice.filter((die) => die === 1).length);
    effectNotices.push(cancelledNow > 0
      ? `Protection déclenchée : ${cancelledNow} Danger annulé${cancelledNow > 1 ? "s" : ""}.`
      : "Protection prête, mais aucun Danger : effet non déclenché.");
  }
  return {
    ...state,
    pressure: Math.max(0, state.pressure - rollPressureRelief),
    phase: "rolled",
    rollNonce: nonce,
    cancelledDangers,
    dice,
    bonusDie,
    effectNotices: effectNotices.slice(-KQ_EFFECT_NOTICE_LIMIT),
    heritageUsed: heritageFiveDice || automaticSpark || heritageDangerShield ? true : state.heritageUsed,
    ...(openingHandConsumed ? { heritageUsed: true, heritageReserveCodes: undefined } : {}),
    heritageArmed: false,
  };
}

export function previewKqResolution(state: KqGameState) {
  const situation = getKqSituation(state);
  if (!situation || !state.dice) return null;
  const target = getKqStageTarget(state);
  const total = state.dice.filter((die) => die >= 4).length;
  const sparks = state.dice.filter((die) => die === 6).length;
  const dangers = Math.max(0, state.dice.filter((die) => die === 1).length - state.cancelledDangers);
  const outcome: KqOutcome = total === 3 ? "critical" : total >= target && dangers === 0 ? "success" : total >= Math.max(1, target - 1) ? "fragile" : "failure";
  return { target, total, outcome, dangers, sparks };
}

export function getKqStageTarget(state: KqGameState) {
  const situation = getKqSituation(state);
  const billRelief = situation.tags.includes("energy")
    && state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "bill-relief");
  const calmRelief = state.pressure === 0 && getKqStateHeritage(state)?.effect === "calm-target-relief";
  return Math.max(1, Math.min(3, situation.difficulty - (billRelief ? 1 : 0) - (calmRelief ? 1 : 0) + (state.pressure >= 3 ? 1 : 0)));
}

export function resolveKqStage(state: KqGameState): KqGameState {
  if (state.phase !== "rolled" || !state.dice) return state;
  const situation = getKqSituation(state);
  const result = previewKqResolution(state);
  if (!situation || !result) return state;
  const heritage = getKqStateHeritage(state);
  const failureRecovery = !state.heritageUsed && heritage?.effect === "failure-to-fragile" && result.outcome === "failure";
  const dryingRecovery = !state.heritageUsed
    && heritage?.effect === "drying-fragile-to-success"
    && state.stageIndex === KQ_STAGES.length - 1
    && result.outcome === "fragile";
  const effectiveOutcome: KqOutcome = failureRecovery ? "fragile" : dryingRecovery ? "success" : result.outcome;
  const trait = effectiveOutcome === "critical" || effectiveOutcome === "success" ? situation.successTrait : effectiveOutcome === "fragile" ? situation.fragileTrait : situation.failureTrait;
  const harvestQualityBonus = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "harvest-four-quality")
    && (effectiveOutcome === "critical" || effectiveOutcome === "success") ? 1 : 0;
  const heritageQualityBonus = effectiveOutcome === "critical" && heritage?.effect === "critical-quality-boost" ? 1
    : effectiveOutcome === "fragile" && heritage?.effect === "fragile-quality-boost" ? 1
    : 0;
  const qualityDelta = (effectiveOutcome === "critical" ? 3 : effectiveOutcome === "success" ? 2 : effectiveOutcome === "fragile" ? 1 : -1) + harvestQualityBonus + heritageQualityBonus;
  const aphidiusBonus = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "pbi-success-xp") && (result.outcome === "critical" || result.outcome === "success") ? 1 : 0;
  const playedPbi = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.category === "pbi");
  const stageCombos = [
    ...(state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "reveal-pest") && playedPbi ? ["PBI ciblée"] : []),
    ...(effectiveOutcome === "critical" ? ["Coup parfait"] : []),
    ...(state.playedThisStage.filter((code) => KQ_CARDS.find((card) => card.code === code)?.timing !== "passive").length >= 2 ? ["Main bien préparée"] : []),
    ...(situation.incident === "ddtm-inspection" && state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "compliance-clearance") ? ["Dossier béton"] : []),
    ...(situation.incident === "crop-theft" && state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "theft-guard") ? ["Gardien du lot"] : []),
    ...(situation.incident === "electricity-bill" && (state.equipment?.unlocks.includes("power-backup") ?? false) && (effectiveOutcome === "fragile" || effectiveOutcome === "failure") ? ["Autonomie solaire"] : []),
  ];
  const newCombos = stageCombos.filter((combo) => !state.combos.includes(combo));
  const cleanCutBonus = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "clean-cut")
    && (effectiveOutcome === "critical" || effectiveOutcome === "success") ? 1 : 0;
  const firstSuccessfulStage = (effectiveOutcome === "critical" || effectiveOutcome === "success")
    && !state.history.some((entry) => entry.outcome === "critical" || entry.outcome === "success");
  const heritageXpBonus = heritage?.effect === "first-success-xp-two" && firstSuccessfulStage ? 2 : 0;
  const xpGain = (effectiveOutcome === "critical" ? 3 : effectiveOutcome === "success" ? 2 : 1) + result.sparks + aphidiusBonus + cleanCutBonus + heritageXpBonus + (newCombos.includes("PBI ciblée") ? 1 : 0);
  const cooledHarvest = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "harvest-cool")
    && state.dice.filter((die) => die === 1).length > 0;
  const pressureBeforeHeritage = Math.max(0, Math.min(4, state.pressure + result.dangers - (effectiveOutcome === "critical" ? 1 : 0) - (cooledHarvest ? 1 : 0)));
  const sparkPressureRelief = !state.heritageUsed
    && heritage?.effect === "spark-pressure-relief"
    && result.sparks > 0
    && pressureBeforeHeritage > 0;
  const pressureAfter = Math.max(0, pressureBeforeHeritage - (sparkPressureRelief ? 2 : 0));
  const heritageNotices = [
    ...(failureRecovery ? [`${heritage?.name} : le premier échec devient Fragile.`] : []),
    ...(dryingRecovery ? [`${heritage?.name} : le résultat Fragile de l’affinage devient une réussite.`] : []),
    ...(heritageXpBonus > 0 ? [`${heritage?.name} : première réussite, +2 XP.`] : []),
    ...(heritageQualityBonus > 0 ? [`${heritage?.name} : +1 Qualité sur ce résultat ${effectiveOutcome === "critical" ? "critique" : "Fragile"}.`] : []),
    ...(sparkPressureRelief ? [`${heritage?.name} : l’Étincelle fait baisser la Pression de 2.`] : []),
  ];
  const hasPowerBackup = state.equipment?.unlocks.includes("power-backup") ?? false;
  const billFailed = situation.incident === "electricity-bill" && (effectiveOutcome === "fragile" || effectiveOutcome === "failure");
  const powerOutage = state.powerOutage ? false : billFailed && !hasPowerBackup;
  const theftProtected = (state.equipment?.unlocks.includes("theft-protection") ?? false)
    || state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "theft-guard")
    || heritage?.effect === "harvest-theft-shield";
  const theftLoss = situation.incident === "crop-theft" && !theftProtected
    ? effectiveOutcome === "failure" ? 35 : effectiveOutcome === "fragile" ? 15 : 0
    : 0;
  const incidentNotices = [
    ...(billFailed && hasPowerBackup ? ["Panneau solaire : la batterie prend le relais, aucune coupure."] : []),
    ...(powerOutage ? ["Facture impayée : coupure de courant à la prochaine étape."] : []),
    ...(situation.incident === "crop-theft" && theftProtected ? [
      heritage?.effect === "harvest-theft-shield"
        ? `${heritage.name} : la mémoire du gardien protège toute la récolte.`
        : state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "theft-guard")
          ? "Gros molosse : récolte intégralement protégée."
          : "Caméra cabossée : le vol est stoppé avant la sortie.",
    ] : []),
    ...(theftLoss > 0 ? [`Renard à deux pattes : -${theftLoss} % sur le poids final.`] : []),
  ];
  const heritageEffectNotices = heritageNotices.reduce((notices, notice) => appendKqEffectNotice(notices, notice), state.effectNotices);
  const nextNotices = incidentNotices.reduce((notices, notice) => appendKqEffectNotice(notices, notice), heritageEffectNotices);
  return {
    ...state, phase: "resolved", xp: state.xp + xpGain, quality: state.quality + qualityDelta,
    pressure: pressureAfter,
    powerOutage,
    harvestLossPercent: Math.min(80, (state.harvestLossPercent ?? 0) + theftLoss),
    heritageUsed: failureRecovery || dryingRecovery || sparkPressureRelief ? true : state.heritageUsed,
    effectNotices: nextNotices,
    traits: [...state.traits, trait], combos: [...state.combos, ...newCombos], lastOutcome: effectiveOutcome,
    history: [...state.history, {
      stage: situation.stage,
      situation: situation.name,
      dice: state.dice,
      total: result.total,
      target: result.target,
      outcome: effectiveOutcome,
      trait,
      dangers: result.dangers,
      sparks: result.sparks,
      pressureAfter,
      combos: newCombos,
      qualityDelta,
      xpGain,
      harvestLossPercent: theftLoss,
    }],
  };
}

export function advanceKqStage(state: KqGameState): KqGameState {
  if (state.phase !== "resolved") return state;
  if (state.stageIndex >= KQ_STAGES.length - 1) {
    const projection = getKqRunProjection(state);
    const { equipmentQualityBonus, projectedQuality: quality, harvestGrams } = projection;
    const equipmentNotice = equipmentQualityBonus > 0 || (state.equipment?.quantityPercent ?? 0) > 0
      ? `Matériel durable : +${equipmentQualityBonus} Qualité · récolte estimée ${harvestGrams.toLocaleString("fr-FR")} g.`
      : `Récolte estimée : ${harvestGrams.toLocaleString("fr-FR")} g.`;
    return {
      ...state,
      phase: "complete",
      quality,
      equipmentQualityBonus,
      harvestGrams,
      effectNotices: appendKqEffectNotice(state.effectNotices, equipmentNotice),
      completedAt: state.completedAt ?? new Date().toISOString(),
    };
  }
  const stageIndex = state.stageIndex + 1;
  const substrate = KQ_CARDS.find((card) => state.deckCodes.includes(card.code) && card.category === "substrate");
  const nextState: KqGameState = {
    ...state, stageIndex, phase: "prepare", dice: null, bonusDie: null, effectNotices: [], cancelledDangers: 0,
    preparationPlayed: false, reactionPlayed: false, revealedPest: null,
    playedThisStage: substrate ? [substrate.code] : [], lastOutcome: null,
  };
  return { ...nextState, handCodes: drawKqAvailableHandCodes(nextState), heritageReserveCodes: undefined };
}

const KQ_HARVEST_TIERS = [
  { minimumQuality: 0, name: "Récolte artisanale" },
  { minimumQuality: 6, name: "Belle pousse" },
  { minimumQuality: 10, name: "Qualité concours" },
  { minimumQuality: 14, name: "Fleur légendaire" },
] as const;

export function getKqHarvestTier(quality: number) {
  return [...KQ_HARVEST_TIERS].reverse().find((tier) => quality >= tier.minimumQuality)?.name
    ?? KQ_HARVEST_TIERS[0].name;
}

export type KqRunProjection = {
  currentQuality: number;
  equipmentQualityBonus: number;
  projectedQuality: number;
  tier: string;
  nextTier: string | null;
  qualityToNextTier: number;
  successfulStages: number;
  remainingStages: number;
  harvestGrams: number;
  harvestLossPercent: number;
};

export type KqHarvestBreakdown = {
  stageQuality: number;
  equipmentQualityBonus: number;
  finalQuality: number;
  successfulStages: number;
  quantityPercent: number;
  grossHarvestGrams: number;
  harvestLossPercent: number;
  lostHarvestGrams: number;
  finalHarvestGrams: number;
};

/**
 * Gives the player a transparent snapshot of the existing end-of-run formula.
 * It only counts results already resolved; future stages remain deliberately
 * unknown and can still raise or lower this projection.
 */
export function getKqRunProjection(state: KqGameState): KqRunProjection {
  const successfulStages = state.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const equipmentQualityBonus = state.phase === "complete"
    ? state.equipmentQualityBonus ?? 0
    : calculateKqEquipmentQualityBonus(state.equipment?.qualityMaxBonus ?? 0, successfulStages);
  const projectedQuality = state.phase === "complete" ? state.quality : state.quality + equipmentQualityBonus;
  const tierIndex = Math.max(0, KQ_HARVEST_TIERS.findLastIndex((tier) => projectedQuality >= tier.minimumQuality));
  const nextTier = KQ_HARVEST_TIERS[tierIndex + 1] ?? null;
  const harvestLossPercent = Math.max(0, Math.min(80, state.harvestLossPercent ?? 0));
  const grossHarvestGrams = calculateKqHarvestGrams({
    quality: projectedQuality,
    successfulStages,
    quantityPercent: state.equipment?.quantityPercent ?? 0,
  });
  const harvestGrams = state.phase === "complete" && state.harvestGrams !== undefined
    ? state.harvestGrams
    : Math.round(grossHarvestGrams * (1 - harvestLossPercent / 100) * 10) / 10;

  return {
    currentQuality: state.quality,
    equipmentQualityBonus,
    projectedQuality,
    tier: KQ_HARVEST_TIERS[tierIndex].name,
    nextTier: nextTier?.name ?? null,
    qualityToNextTier: nextTier ? Math.max(0, nextTier.minimumQuality - projectedQuality) : 0,
    successfulStages,
    remainingStages: Math.max(0, KQ_STAGES.length - state.history.length),
    harvestGrams,
    harvestLossPercent,
  };
}

/** Exact audit trail for the two formulas applied when a culture completes. */
export function getKqHarvestBreakdown(state: KqGameState): KqHarvestBreakdown {
  const successfulStages = state.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const equipmentQualityBonus = state.equipmentQualityBonus
    ?? calculateKqEquipmentQualityBonus(state.equipment?.qualityMaxBonus ?? 0, successfulStages);
  const finalQuality = state.phase === "complete" ? state.quality : state.quality + equipmentQualityBonus;
  const quantityPercent = state.equipment?.quantityPercent ?? 0;
  const grossHarvestGrams = calculateKqHarvestGrams({ quality: finalQuality, successfulStages, quantityPercent });
  const harvestLossPercent = Math.max(0, Math.min(80, state.harvestLossPercent ?? 0));
  const calculatedFinalGrams = Math.round(grossHarvestGrams * (1 - harvestLossPercent / 100) * 10) / 10;
  const finalHarvestGrams = state.phase === "complete" && state.harvestGrams !== undefined
    ? state.harvestGrams
    : calculatedFinalGrams;

  return {
    stageQuality: finalQuality - equipmentQualityBonus,
    equipmentQualityBonus,
    finalQuality,
    successfulStages,
    quantityPercent,
    grossHarvestGrams,
    harvestLossPercent,
    lostHarvestGrams: Math.round(Math.max(0, grossHarvestGrams - finalHarvestGrams) * 10) / 10,
    finalHarvestGrams,
  };
}
