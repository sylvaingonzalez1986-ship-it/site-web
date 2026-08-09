import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";

export const KQ_STAGES = ["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"] as const;

export type KqStage = (typeof KQ_STAGES)[number];
export type KqTiming = "passive" | "before-roll" | "after-roll";
export type KqCardCategory = "substrate" | "pbi" | "equipment" | "know-how" | "luck";
export type KqSupportEffect = "reroll-neutral" | "pbi-success" | "pbi-strong-success" | "pbi-success-xp" | "cancel-danger" | "reveal-pest" | "reroll-two-low" | "neutral-to-success" | "four-keep-three" | "three-to-success";
export type KqSituationTag = "roots" | "water" | "climate" | "pest" | "flower" | "harvest" | "drying";
export type KqPest = "aphids" | "mites" | "thrips";
export type KqBuddieEffect = "opening-four-dice" | "flower-neutral-success" | "climate-danger-shield";
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

export type KqSituation = {
  code: string;
  stage: KqStage;
  name: string;
  story: string;
  difficulty: 1 | 2 | 3;
  tags: KqSituationTag[];
  pest?: KqPest;
  successTrait: string;
  fragileTrait: string;
  failureTrait: string;
};

export type KqOutcome = "critical" | "success" | "fragile" | "failure";

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
  heritageUsed?: boolean;
  heritageArmed?: boolean;
  collectionCodes: string[];
  situationCodes: string[];
  stageIndex: number;
  phase: "prepare" | "rolled" | "resolved" | "complete";
  xp: number;
  quality: number;
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
  }>;
};

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
  "opening-four-dice": "Bon départ : lance 4 dés et garde les 3 meilleurs au premier lancer.",
  "flower-neutral-success": "Floraison : transforme un dé neutre en réussite pendant la Floraison.",
  "climate-danger-shield": "Résilience : annule un Danger sur les Situations Climat.",
};

export const KQ_BUDDIES: KqBuddie[] = KQ_BUDDIE_NAMES.map((name, index) => {
  const cardNumber = index + 1;
  const effect: KqBuddieEffect = cardNumber % 3 === 0
    ? "opening-four-dice"
    : cardNumber % 3 === 1
      ? "flower-neutral-success"
      : "climate-danger-shield";
  const rarity: KqBuddie["rarity"] = cardNumber === 1
    ? "legendary"
    : cardNumber <= 4
      ? "epic"
      : cardNumber <= 9
        ? "gold"
        : cardNumber <= 19
          ? "silver"
          : "common";
  return {
    code: `HH2026-${String(cardNumber).padStart(3, "0")}`,
    name,
    cardNumber,
    rarity,
    ability: KQ_BUDDIE_ABILITIES[effect],
    effect,
  };
});

export const KQ_CARDS: KqSupportCard[] = [
  { code: "BOTTE-001", name: "Terreau universel", category: "substrate", rarity: "common", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Racines.", tags: ["roots"], effect: "reroll-neutral" },
  { code: "BOTTE-002", name: "Chrysope affamée", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre pucerons ou thrips.", tags: ["pest"], targets: ["aphids", "thrips"], effect: "pbi-success" },
  { code: "BOTTE-003", name: "Petit ventilateur", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Climat ou Séchage.", tags: ["climate", "drying"], effect: "cancel-danger" },
  { code: "BOTTE-004", name: "Loupe d’inspection", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Identifie un ravageur et ouvre ta réserve de cartes PBI.", tags: ["pest"], effect: "reveal-pest" },
  { code: "BOTTE-005", name: "Arrosage mesuré", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Eau ou Racines.", tags: ["water", "roots"], effect: "reroll-neutral" },
  { code: "BOTTE-006", name: "Deuxième chance", category: "luck", rarity: "rare", xpCost: 2, timing: "after-roll", description: "Relance les deux dés les plus faibles.", tags: [], effect: "reroll-two-low" },
  { code: "BOTTE-007", name: "Fibre de coco", category: "substrate", rarity: "uncommon", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Eau.", tags: ["water"], effect: "reroll-neutral" },
  { code: "BOTTE-008", name: "Mélange drainant", category: "substrate", rarity: "uncommon", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Eau ou Séchage.", tags: ["water", "drying"], effect: "reroll-neutral" },
  { code: "BOTTE-009", name: "Terre vivante", category: "substrate", rarity: "rare", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Racines ou Ravageur.", tags: ["roots", "pest"], effect: "reroll-neutral" },
  { code: "BOTTE-010", name: "Coccinelle à sept points", category: "pbi", rarity: "rare", xpCost: 3, timing: "after-roll", description: "Transforme un dé faible en réussite forte contre les pucerons.", tags: ["pest"], targets: ["aphids"], effect: "pbi-strong-success" },
  { code: "BOTTE-011", name: "Amblyseius swirskii", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre des acariens ou thrips révélés.", tags: ["pest"], targets: ["mites", "thrips"], effect: "pbi-success" },
  { code: "BOTTE-012", name: "Aphidius colemani", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre les pucerons et rapporte +1 XP en cas de succès.", tags: ["pest"], targets: ["aphids"], effect: "pbi-success-xp" },
  { code: "BOTTE-013", name: "Pot en tissu", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Racines ou Eau.", tags: ["roots", "water"], effect: "reroll-neutral" },
  { code: "BOTTE-014", name: "Hygromètre vintage", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Annule un Danger sur une Situation Eau, Climat ou Séchage.", tags: ["water", "climate", "drying"], effect: "cancel-danger" },
  { code: "BOTTE-015", name: "Palissage doux", category: "know-how", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite pendant la Floraison.", tags: ["flower"], effect: "neutral-to-success" },
  { code: "BOTTE-016", name: "Séchage patient", category: "know-how", rarity: "rare", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite pendant le Séchage.", tags: ["drying"], effect: "neutral-to-success" },
  { code: "BOTTE-017", name: "Main verte", category: "luck", rarity: "common", xpCost: 1, timing: "before-roll", description: "Lance quatre dés et conserve les trois meilleurs.", tags: [], effect: "four-keep-three" },
  { code: "BOTTE-018", name: "Coup de pouce", category: "luck", rarity: "uncommon", xpCost: 1, timing: "after-roll", description: "Transforme un 3 en réussite après le lancer.", tags: [], effect: "three-to-success" },
  { code: "BOTTE-019", name: "Perlite horticole", category: "substrate", rarity: "common", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Racines ou Eau.", tags: ["roots", "water"], effect: "reroll-neutral" },
  { code: "BOTTE-020", name: "Biochar", category: "substrate", rarity: "uncommon", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Racines ou Séchage.", tags: ["roots", "drying"], effect: "reroll-neutral" },
  { code: "BOTTE-021", name: "Compost mûr", category: "substrate", rarity: "rare", xpCost: 0, timing: "passive", description: "Relance un dé neutre sur une Situation Racines ou Ravageur.", tags: ["roots", "pest"], effect: "reroll-neutral" },
  { code: "BOTTE-022", name: "Phytoseiulus persimilis", category: "pbi", rarity: "rare", xpCost: 3, timing: "after-roll", description: "Transforme un dé faible en réussite forte contre les acariens.", tags: ["pest"], targets: ["mites"], effect: "pbi-strong-success" },
  { code: "BOTTE-023", name: "Orius laevigatus", category: "pbi", rarity: "uncommon", xpCost: 2, timing: "after-roll", description: "Transforme un dé faible en réussite contre les thrips.", tags: ["pest"], targets: ["thrips"], effect: "pbi-success" },
  { code: "BOTTE-024", name: "Tensiomètre", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Eau.", tags: ["water"], effect: "cancel-danger" },
  { code: "BOTTE-025", name: "Filet anti-insectes", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Annule un Danger sur une Situation Ravageur.", tags: ["pest"], effect: "cancel-danger" },
  { code: "BOTTE-026", name: "Brasseur d’air", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Climat ou Séchage.", tags: ["climate", "drying"], effect: "cancel-danger" },
  { code: "BOTTE-027", name: "Timer mécanique", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite sur une Situation Floraison.", tags: ["flower"], effect: "neutral-to-success" },
  { code: "BOTTE-028", name: "Taille apicale", category: "know-how", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite sur une Situation Floraison.", tags: ["flower"], effect: "neutral-to-success" },
  { code: "BOTTE-029", name: "Effeuillage mesuré", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Floraison ou Climat.", tags: ["flower", "climate"], effect: "reroll-neutral" },
  { code: "BOTTE-030", name: "Affinage en bocal", category: "know-how", rarity: "rare", xpCost: 2, timing: "before-roll", description: "Transforme un dé neutre en réussite pendant le Séchage.", tags: ["drying"], effect: "neutral-to-success" },
  { code: "BOTTE-031", name: "Drainage contrôlé", category: "know-how", rarity: "common", xpCost: 1, timing: "before-roll", description: "Relance un dé neutre sur une Situation Eau ou Racines.", tags: ["water", "roots"], effect: "reroll-neutral" },
  { code: "BOTTE-032", name: "Carnet du jardinier", category: "luck", rarity: "rare", xpCost: 2, timing: "before-roll", description: "Lance quatre dés et conserve les trois meilleurs.", tags: [], effect: "four-keep-three" },
  { code: "BOTTE-033", name: "Observation matinale", category: "luck", rarity: "common", xpCost: 1, timing: "after-roll", description: "Transforme un 3 en réussite après le lancer.", tags: [], effect: "three-to-success" },
  { code: "BOTTE-034", name: "Retour au calme", category: "luck", rarity: "rare", xpCost: 2, timing: "after-roll", description: "Relance les deux dés les plus faibles.", tags: [], effect: "reroll-two-low" },
  { code: "BOTTE-035", name: "Quarantaine préventive", category: "equipment", rarity: "uncommon", xpCost: 2, timing: "before-roll", description: "Annule un Danger sur une Situation Ravageur.", tags: ["pest"], effect: "cancel-danger" },
  { code: "BOTTE-036", name: "Bac de rétention", category: "equipment", rarity: "common", xpCost: 1, timing: "before-roll", description: "Annule un Danger sur une Situation Eau.", tags: ["water"], effect: "cancel-danger" },
];

export function getKqCardTradeoff(card: KqSupportCard) {
  if (card.effect === "reveal-pest") return { benefit: "Révèle le ravageur et ouvre les PBI compatibles.", risk: "Consomme l’unique préparation du tour sans modifier directement les dés." };
  if (card.effect === "reroll-neutral") return { benefit: "Donne une nouvelle chance à un dé neutre.", risk: "La relance peut produire un Danger." };
  if (card.effect === "reroll-two-low") return { benefit: "Relance les deux dés les plus faibles.", risk: "Une nouvelle face peut être moins bonne que la précédente." };
  if (card.effect === "cancel-danger") return { benefit: "Protège le lancer contre un Danger.", risk: "La protection est perdue si aucun 1 ne sort." };
  if (card.effect === "neutral-to-success") return { benefit: "Transforme automatiquement un dé neutre en réussite.", risk: "La carte est perdue si aucun dé neutre ne sort." };
  if (card.effect === "four-keep-three") return { benefit: "Lance quatre dés et conserve les trois meilleurs.", risk: "Occupe l’unique préparation disponible." };
  if (card.effect === "three-to-success") return { benefit: "Transforme immédiatement un 3 en réussite.", risk: "Occupe l’unique réaction disponible." };
  if (card.effect === "pbi-success-xp") return { benefit: "Transforme un dé faible en réussite et peut rapporter 1 XP supplémentaire.", risk: "Brûle une PBI de la réserve et utilise l’unique réaction." };
  if (card.category === "pbi") return { benefit: "Transforme un dé faible en réussite et neutralise le ravageur ciblé.", risk: "Brûle une PBI de la réserve et utilise l’unique réaction." };
  return { benefit: card.description, risk: "La copie est définitivement brûlée après utilisation." };
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
  { code: "SIT-021", stage: "Croissance", name: "Tiges qui s’étirent", story: "La plante prend de la hauteur plus vite qu’elle ne renforce sa structure.", difficulty: 2, tags: ["climate", "flower"], successTrait: "Port robuste", fragileTrait: "Silhouette élancée", failureTrait: "Tiges fragiles" },
  { code: "SIT-022", stage: "Floraison", name: "Air trop humide", story: "L’humidité reste haute au cœur des fleurs et demande une bonne circulation d’air.", difficulty: 3, tags: ["climate", "flower"], successTrait: "Fleurs bien aérées", fragileTrait: "Humidité contenue", failureTrait: "Floraison humide" },
  { code: "SIT-023", stage: "Floraison", name: "Branches chargées", story: "Le poids des fleurs met les branches les plus fines à l’épreuve.", difficulty: 2, tags: ["flower"], successTrait: "Charpente solide", fragileTrait: "Branches souples", failureTrait: "Port affaissé" },
  { code: "SIT-024", stage: "Floraison", name: "Floraison irrégulière", story: "Les différentes zones de la plante n’avancent pas au même rythme.", difficulty: 2, tags: ["flower", "climate"], successTrait: "Canopée homogène", fragileTrait: "Fleurs contrastées", failureTrait: "Lot hétérogène" },
  { code: "SIT-025", stage: "Récolte", name: "Trichomes contrastés", story: "Les signes de maturité ne racontent pas exactement la même histoire partout.", difficulty: 3, tags: ["harvest", "flower"], successTrait: "Lecture précise", fragileTrait: "Choix prudent", failureTrait: "Maturité mal estimée" },
  { code: "SIT-026", stage: "Récolte", name: "Matinée trop chaude", story: "La température monte rapidement et menace la fraîcheur aromatique du lot.", difficulty: 2, tags: ["harvest", "climate"], successTrait: "Fraîcheur préservée", fragileTrait: "Récolte accélérée", failureTrait: "Arômes échauffés" },
  { code: "SIT-027", stage: "Récolte", name: "Tri délicat", story: "Quelques fleurs moins régulières doivent être séparées sans déclasser tout le lot.", difficulty: 2, tags: ["harvest"], successTrait: "Sélection exigeante", fragileTrait: "Lot honnête", failureTrait: "Sélection confuse" },
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

function getKqBuddieEffect(varietyCode: string) {
  return KQ_BUDDIES.find((buddie) => buddie.code === varietyCode)?.effect;
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
  config: { varietyCode?: string; deckCodes?: string[]; collectionCodes?: string[]; recentSituationCodes?: string[]; challengeDayKey?: string; requiredSituationTags?: KqSituationTag[]; allowedPests?: KqPest[]; startingXp?: number; startedAt?: string; heritageCode?: string } = {},
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
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === config.heritageCode);
  const initialState: KqGameState = {
    seed: clampSeed(seed), ...(config.challengeDayKey ? { challengeDayKey: config.challengeDayKey } : {}), ...(config.startedAt ? { startedAt: config.startedAt } : {}), varietyCode: buddie.code, varietyName: buddie.name, deckCodes,
    collectionCodes: config.collectionCodes ?? KQ_CARDS.map((card) => card.code),
    situationCodes,
    ...(heritage ? { heritageCode: heritage.code, heritageUsed: false, heritageArmed: false } : {}),
    stageIndex: 0, phase: "prepare", xp: Math.max(1, config.startingXp ?? 1) + (heritage?.effect === "starting-xp-two" ? 2 : 0), quality: 0, dice: null, bonusDie: null, effectNotices: heritage?.effect === "starting-xp-two" ? [`${heritage.name} : +2 XP au départ.`] : [],
    rollNonce: 0, pressure: 0, cancelledDangers: 0,
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
  if (card.effect === "reroll-two-low" && state.dice && state.dice.every((die) => die >= 4)) return { allowed: false, reason: "Aucun dé faible ne justifie cette relance." };
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
  const redrawLimit = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode)?.effect === "two-extra-redraws" ? 3 : 1;
  if (state.phase !== "prepare" || state.preparationPlayed || supportPlayedThisStage || (state.handRedrawsUsed ?? 0) >= redrawLimit) return state;
  const nextState = { ...state, handCodes: undefined, heritageReserveCodes: undefined, handRedrawsUsed: (state.handRedrawsUsed ?? 0) + 1 };
  return { ...nextState, handCodes: drawKqAvailableHandCodes(nextState) };
}

export function swapKqHeritageHandCard(state: KqGameState, handIndex: number, reserveIndex: number): KqGameState {
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
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
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
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
  if (heritage.effect === "flower-neutrals-to-success" && KQ_STAGES[state.stageIndex] !== "Floraison") return { allowed: false, reason: "Réservé à la Floraison." };
  if (heritage.effect === "drying-lowest-to-spark" && state.stageIndex !== KQ_STAGES.length - 1) return { allowed: false, reason: "Réservé au séchage et à l’affinage." };
  if (heritage.effect === "neutral-to-spark" && !state.dice.some((die) => die === 2 || die === 3)) return { allowed: false, reason: "Aucun dé neutre à transformer." };
  if (heritage.effect === "flower-neutrals-to-success" && !state.dice.some((die) => die === 2 || die === 3)) return { allowed: false, reason: "Aucun dé neutre à transformer." };
  if (heritage.effect === "dangers-to-success" && state.dice.filter((die) => die === 1).length <= state.cancelledDangers) return { allowed: false, reason: "Aucun Danger non protégé à transformer." };
  return ["neutral-to-spark", "flower-neutrals-to-success", "drying-lowest-to-spark", "dangers-to-success"].includes(heritage.effect)
    ? { allowed: true, reason: "Pouvoir disponible." }
    : { allowed: false, reason: "Cet Héritage se déclenche automatiquement." };
}

export function activateKqHeritage(state: KqGameState): KqGameState {
  const permission = canActivateKqHeritage(state);
  if (!permission.allowed) return state;
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode)!;
  if (heritage.effect === "five-keep-three") {
    return { ...state, heritageArmed: true, effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} armée : le prochain lancer utilisera 5 dés.`) };
  }
  if (heritage.effect === "free-pest-mastery") {
    return { ...state, heritageUsed: true, xp: state.xp + 2, revealedPest: getKqSituation(state).pest ?? null, effectNotices: appendKqEffectNotice(state.effectNotices, `${heritage.name} : ravageur identifié gratuitement et +2 XP.`) };
  }
  const dice = [...state.dice!] as [number, number, number];
  const rollNonce = state.rollNonce;
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
  if (card.effect === "reveal-pest" && getKqSituation(state).pest) revealedPest = getKqSituation(state).pest ?? null;
  if (card.effect === "reroll-two-low" && dice) {
    const indexes = [0, 1, 2].sort((a, b) => dice![a] - dice![b]).slice(0, 2);
    const nextDice: [number, number, number] = [...dice];
    indexes.forEach((index, offset) => { nextDice[index] = deterministicDie(state.seed, state.stageIndex, rollNonce + offset + 1, index); });
    dice = nextDice;
    rollNonce += 2;
  }
  if (dice && ["pbi-success", "pbi-success-xp"].includes(card.effect)) {
    const index = dice.findIndex((die) => die < 4);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
  }
  if (dice && card.effect === "pbi-strong-success") {
    const index = dice.findIndex((die) => die < 4);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 5 : die) as [number, number, number];
  }
  if (dice && card.effect === "three-to-success") {
    const index = dice.findIndex((die) => die === 3);
    if (index >= 0) dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
  }

  const effectNotice = diceBefore && dice
    ? `${card.name} : ${diceBefore.join(" · ")} → ${dice.join(" · ")}.`
    : card.effect === "reveal-pest" && revealedPest
      ? `${card.name} : ${revealedPest === "aphids" ? "pucerons" : revealedPest === "mites" ? "acariens" : "thrips"} identifiés, réserve PBI ouverte.`
      : `${card.name} activée : ${card.description}`;
  return {
    ...state, xp: state.xp - card.xpCost, dice, rollNonce, revealedPest,
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
  const mainVerte = playedEffects.includes("four-keep-three");
  const boostedOpening = getKqBuddieEffect(state.varietyCode) === "opening-four-dice" && state.stageIndex === 0;
  const heritageFiveDice = state.heritageArmed && KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode)?.effect === "five-keep-three";
  const dieCount = heritageFiveDice ? 5 : mainVerte || boostedOpening ? 4 : 3;
  let rolled = Array.from({ length: dieCount }, (_, index) => deterministicDie(state.seed, state.stageIndex, nonce, index));
  let bonusDie: number | null = null;
  const effectNotices = [...(state.effectNotices ?? [])];
  if (dieCount > 3) {
    const sorted = [...rolled].sort((a, b) => b - a);
    bonusDie = sorted.at(-1) ?? null;
    rolled = sorted.slice(0, 3);
    effectNotices.push(heritageFiveDice
      ? `Signature du maître : 5 dés lancés, les 2 moins bons écartés, les 3 meilleurs conservés.`
      : `${mainVerte ? "Main verte" : state.varietyName} : 4 dés lancés, ${bonusDie} écarté, les 3 meilleurs conservés.`);
  }
  let dice = rolled as [number, number, number];
  const substrate = KQ_CARDS.find((card) => state.deckCodes.includes(card.code) && card.category === "substrate");
  const shouldRerollNeutral = substrate?.tags.some((tag) => situation.tags.includes(tag)) || playedEffects.includes("reroll-neutral");
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
  const convertNeutral = playedEffects.includes("neutral-to-success") || (getKqBuddieEffect(state.varietyCode) === "flower-neutral-success" && KQ_STAGES[state.stageIndex] === "Floraison");
  if (convertNeutral) {
    const index = dice.findIndex((die) => die === 2 || die === 3);
    if (index >= 0) {
      const previous = dice[index];
      dice = dice.map((die, dieIndex) => dieIndex === index ? 4 : die) as [number, number, number];
      effectNotices.push(`Transformation réussie : le dé neutre ${previous} devient 4.`);
    }
    else effectNotices.push("Transformation prête, mais aucun dé neutre : effet non déclenché.");
  }
  const cancelledDangers = (playedEffects.includes("cancel-danger") ? 1 : 0)
    + (getKqBuddieEffect(state.varietyCode) === "climate-danger-shield" && situation.tags.includes("climate") ? 1 : 0);
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
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
    phase: "rolled",
    rollNonce: nonce,
    cancelledDangers,
    dice,
    bonusDie,
    effectNotices: effectNotices.slice(-KQ_EFFECT_NOTICE_LIMIT),
    heritageUsed: heritageFiveDice || automaticSpark ? true : state.heritageUsed,
    ...(openingHandConsumed ? { heritageUsed: true, heritageReserveCodes: undefined } : {}),
    heritageArmed: false,
  };
}

export function previewKqResolution(state: KqGameState) {
  const situation = getKqSituation(state);
  if (!situation || !state.dice) return null;
  const target = Math.min(3, situation.difficulty + (state.pressure >= 3 ? 1 : 0));
  const total = state.dice.filter((die) => die >= 4).length;
  const sparks = state.dice.filter((die) => die === 6).length;
  const dangers = Math.max(0, state.dice.filter((die) => die === 1).length - state.cancelledDangers);
  const outcome: KqOutcome = total === 3 ? "critical" : total >= target && dangers === 0 ? "success" : total >= Math.max(1, target - 1) ? "fragile" : "failure";
  return { target, total, outcome, dangers, sparks };
}

export function resolveKqStage(state: KqGameState): KqGameState {
  if (state.phase !== "rolled" || !state.dice) return state;
  const situation = getKqSituation(state);
  const result = previewKqResolution(state);
  if (!situation || !result) return state;
  const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
  const failureRecovery = !state.heritageUsed && heritage?.effect === "failure-to-fragile" && result.outcome === "failure";
  const effectiveOutcome: KqOutcome = failureRecovery ? "fragile" : result.outcome;
  const trait = effectiveOutcome === "critical" || effectiveOutcome === "success" ? situation.successTrait : effectiveOutcome === "fragile" ? situation.fragileTrait : situation.failureTrait;
  const qualityDelta = effectiveOutcome === "critical" ? 3 : effectiveOutcome === "success" ? 2 : effectiveOutcome === "fragile" ? 1 : -1;
  const aphidiusBonus = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "pbi-success-xp") && (result.outcome === "critical" || result.outcome === "success") ? 1 : 0;
  const playedPbi = state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.category === "pbi");
  const stageCombos = [
    ...(state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.effect === "reveal-pest") && playedPbi ? ["PBI ciblée"] : []),
    ...(effectiveOutcome === "critical" ? ["Coup parfait"] : []),
    ...(state.playedThisStage.filter((code) => KQ_CARDS.find((card) => card.code === code)?.timing !== "passive").length >= 2 ? ["Main bien préparée"] : []),
  ];
  const newCombos = stageCombos.filter((combo) => !state.combos.includes(combo));
  const xpGain = (effectiveOutcome === "critical" ? 3 : effectiveOutcome === "success" ? 2 : 1) + result.sparks + aphidiusBonus + (newCombos.includes("PBI ciblée") ? 1 : 0);
  const pressureAfter = Math.max(0, Math.min(4, state.pressure + result.dangers - (effectiveOutcome === "critical" ? 1 : 0)));
  const heritageNotice = failureRecovery ? `${heritage?.name} : le premier échec devient Fragile.` : null;
  return {
    ...state, phase: "resolved", xp: state.xp + xpGain, quality: state.quality + qualityDelta,
    pressure: pressureAfter,
    heritageUsed: failureRecovery ? true : state.heritageUsed,
    effectNotices: heritageNotice ? appendKqEffectNotice(state.effectNotices, heritageNotice) : state.effectNotices,
    traits: [...state.traits, trait], combos: [...state.combos, ...newCombos], lastOutcome: effectiveOutcome,
    history: [...state.history, { stage: situation.stage, situation: situation.name, dice: state.dice, total: result.total, target: result.target, outcome: effectiveOutcome, trait, dangers: result.dangers, sparks: result.sparks, pressureAfter, combos: newCombos }],
  };
}

export function advanceKqStage(state: KqGameState): KqGameState {
  if (state.phase !== "resolved") return state;
  if (state.stageIndex >= KQ_STAGES.length - 1) return { ...state, phase: "complete", completedAt: state.completedAt ?? new Date().toISOString() };
  const stageIndex = state.stageIndex + 1;
  const substrate = KQ_CARDS.find((card) => state.deckCodes.includes(card.code) && card.category === "substrate");
  const nextState: KqGameState = {
    ...state, stageIndex, phase: "prepare", dice: null, bonusDie: null, effectNotices: [], cancelledDangers: 0,
    preparationPlayed: false, reactionPlayed: false, revealedPest: null,
    playedThisStage: substrate ? [substrate.code] : [], lastOutcome: null,
  };
  return { ...nextState, handCodes: drawKqAvailableHandCodes(nextState), heritageReserveCodes: undefined };
}

export function getKqHarvestTier(quality: number) {
  if (quality >= 14) return "Fleur légendaire";
  if (quality >= 10) return "Qualité concours";
  if (quality >= 6) return "Belle pousse";
  return "Récolte artisanale";
}
