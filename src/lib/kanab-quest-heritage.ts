export type KqHeritageTiming = "passive" | "once-per-run";

export const KQ_HERITAGE_STARTING_XP_BONUS = 2;
export const KQ_HERITAGE_STARTING_BONUS_DESCRIPTION = "+2 XP au départ.";

export const KQ_HERITAGE_EFFECTS = [
  "root-danger-to-spark",
  "starting-xp-two",
  "opening-hand-reserve",
  "climate-danger-to-spark",
  "two-extra-redraws",
  "failure-to-fragile",
  "neutral-to-spark",
  "free-pest-mastery",
  "flower-neutrals-to-success",
  "drying-lowest-to-spark",
  "dangers-to-success",
  "five-keep-three",
  "germination-lowest-to-strong",
  "rooting-pressure-reset",
  "growth-danger-reroll",
  "flower-success-to-spark",
  "harvest-theft-shield",
  "drying-fragile-to-success",
  "first-success-xp-two",
  "critical-quality-boost",
  "calm-target-relief",
  "first-danger-shield",
  "spark-pressure-relief",
  "fragile-quality-boost",
  "flower-lowest-plus-three",
] as const;

export type KqHeritageEffect = (typeof KQ_HERITAGE_EFFECTS)[number];

export type KqHeritageCard = {
  code: string;
  name: string;
  timing: KqHeritageTiming;
  effect: KqHeritageEffect;
  description: string;
  imageUrl?: string;
  producerId?: string;
  producerName?: string;
};

export type KqHeritageEffectTemplate = Pick<KqHeritageCard, "name" | "timing" | "effect" | "description"> & {
  drawback: string;
};

export const KQ_HERITAGE_CARDS: readonly KqHeritageCard[] = [
  { code: "HERITAGE-001", name: "Racines solides", timing: "once-per-run", effect: "root-danger-to-spark", description: "+2 XP au départ. En Enracinement, le dé le plus faible devient automatiquement une Étincelle." },
  { code: "HERITAGE-002", name: "Réserve du jardinier", timing: "passive", effect: "starting-xp-two", description: "+4 XP au départ pour financer les soins et les cartes de la culture." },
  { code: "HERITAGE-003", name: "Main prévoyante", timing: "once-per-run", effect: "opening-hand-reserve", description: "+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10." },
  { code: "HERITAGE-004", name: "Climat stable", timing: "once-per-run", effect: "climate-danger-to-spark", description: "+2 XP au départ. Le dé le plus faible devient une Étincelle face au Climat, ou au Séchage si le pouvoir reste disponible." },
  { code: "HERITAGE-005", name: "Second regard", timing: "passive", effect: "two-extra-redraws", description: "+2 XP au départ. Accorde deux changements de main supplémentaires par culture." },
  { code: "HERITAGE-006", name: "Reprise vigoureuse", timing: "once-per-run", effect: "failure-to-fragile", description: "+2 XP au départ. Le premier échec devient une réussite, avec ses gains de Qualité et d’XP." },
  { code: "HERITAGE-007", name: "Instinct du cultivateur", timing: "once-per-run", effect: "neutral-to-spark", description: "+2 XP au départ. Après un lancer, transforme le dé le plus faible en Étincelle." },
  { code: "HERITAGE-008", name: "Bouclier biologique", timing: "once-per-run", effect: "free-pest-mastery", description: "+2 XP au départ. Active +2 XP supplémentaires et révèle le ravageur présent, sans frais." },
  { code: "HERITAGE-009", name: "Floraison maîtrisée", timing: "once-per-run", effect: "flower-neutrals-to-success", description: "+2 XP au départ. En Floraison, transforme tous les Dangers et dés neutres en réussites." },
  { code: "HERITAGE-010", name: "Affinage patient", timing: "once-per-run", effect: "drying-lowest-to-spark", description: "+2 XP au départ. Au Séchage, transforme le dé le plus faible en Étincelle." },
  { code: "HERITAGE-011", name: "Héritage de la canopée", timing: "once-per-run", effect: "dangers-to-success", description: "+2 XP au départ. Transforme tous les Dangers d’un lancer, même protégés, en réussites." },
  { code: "HERITAGE-012", name: "Signature du maître", timing: "once-per-run", effect: "five-keep-three", description: "+2 XP au départ. Lance cinq dés et conserve les trois meilleurs." },
] as const;

export const KQ_HERITAGE_EFFECT_TEMPLATES: readonly KqHeritageEffectTemplate[] = [
  { ...KQ_HERITAGE_CARDS[0], drawback: "Automatique à l’Enracinement, une fois par culture. Les Étincelles déjà obtenues sont conservées." },
  { ...KQ_HERITAGE_CARDS[1], drawback: "Les 4 XP sont disponibles dès le départ, sans activation ni dépense de carte." },
  { ...KQ_HERITAGE_CARDS[2], drawback: "Échanges gratuits dans la réserve avant le premier lancer. Les cartes échangées sont conservées." },
  { ...KQ_HERITAGE_CARDS[3], drawback: "Une activation automatique ; le Séchage sert de relais si aucune Situation Climat ne l’a déclenchée." },
  { ...KQ_HERITAGE_CARDS[4], drawback: "Trois changements de main gratuits au total, à répartir entre les étapes avant leur préparation." },
  { ...KQ_HERITAGE_CARDS[5], drawback: "Sauvetage automatique une fois par culture. Les réussites déjà obtenues restent intactes." },
  { ...KQ_HERITAGE_CARDS[6], drawback: "Une activation après le lancer, sur un Danger, un neutre ou une réussite ordinaire." },
  { ...KQ_HERITAGE_CARDS[7], drawback: "Une activation avant ou après le lancer. Les XP sont accordés même sans ravageur caché." },
  { ...KQ_HERITAGE_CARDS[8], drawback: "Une activation en Floraison. Tous les dés de 1 à 3 passent à 4, les meilleurs restent inchangés." },
  { ...KQ_HERITAGE_CARDS[9], drawback: "Une activation après le lancer du Séchage. Une Étincelle déjà obtenue reste une Étincelle." },
  { ...KQ_HERITAGE_CARDS[10], drawback: "Une activation après un lancer contenant un Danger. Les protections existantes restent disponibles." },
  { ...KQ_HERITAGE_CARDS[11], drawback: "À préparer une fois avant le lancer. Les trois meilleures valeurs des cinq dés sont retenues." },
  { name: "Élan de semis", timing: "once-per-run", effect: "germination-lowest-to-strong", description: "+2 XP au départ. En Germination, améliore le dé le plus faible jusqu’à 5, sans jamais diminuer un dé.", drawback: "Une activation en Germination si un dé vaut moins de 5. Les 5 et les Étincelles sont préservés." },
  { name: "Racines décompressées", timing: "once-per-run", effect: "rooting-pressure-reset", description: "+2 XP au départ. En Enracinement, ramène la Pression à zéro et améliore le dé le plus faible jusqu’à 4.", drawback: "Une activation après le lancer. La réussite supplémentaire reste disponible même à Pression zéro." },
  { name: "Croissance résiliente", timing: "once-per-run", effect: "growth-danger-reroll", description: "+2 XP au départ. En Croissance, relance le dé le plus faible : une réussite de 4 minimum est garantie.", drawback: "Une activation sur un dé de 1 à 3. La relance donne 4, 5 ou 6 et ne peut plus échouer." },
  { name: "Pistils étincelants", timing: "once-per-run", effect: "flower-success-to-spark", description: "+2 XP au départ. En Floraison, les dés 4 et 5 deviennent des Étincelles ; à défaut, le dé le plus faible passe à 6.", drawback: "Une activation après le lancer de Floraison, utile même lorsque le lancer ne contient aucune réussite." },
  { name: "Mémoire du gardien", timing: "passive", effect: "harvest-theft-shield", description: "+2 XP au départ. Protège intégralement la récolte contre le vol et accorde +1 Qualité à la Récolte.", drawback: "Protection permanente contre le Renard à deux pattes. Le bonus de Récolte est acquis avec tout résultat." },
  { name: "Dernier affinage", timing: "once-per-run", effect: "drying-fragile-to-success", description: "+2 XP au départ. Au Séchage, transforme un échec ou un résultat Fragile en réussite.", drawback: "Sauvetage automatique au Séchage, avec les gains de réussite. L’affinage en entrepôt continue ensuite." },
  { name: "Premier élan", timing: "passive", effect: "first-success-xp-two", description: "+2 XP au départ. La première réussite rapporte +3 XP, puis chaque réussite suivante rapporte +1 XP.", drawback: "Les réussites ordinaires et critiques déclenchent ce bonus, à chaque étape de la culture." },
  { name: "Exigence du jury", timing: "passive", effect: "critical-quality-boost", description: "+2 XP au départ. Chaque réussite gagne +1 Qualité, ou +2 Qualité pour une réussite critique.", drawback: "Bonus automatique cumulable sur toutes les étapes réussies, de la Germination au Séchage." },
  { name: "Culture zen", timing: "passive", effect: "calm-target-relief", description: "+2 XP au départ. À Pression 0, 1 ou 2, réduit la difficulté de 1, avec un minimum de 1.", drawback: "Allègement automatique à chaque étape tant que la Pression reste au plus à 2." },
  { name: "Parade ancestrale", timing: "once-per-run", effect: "first-danger-shield", description: "+2 XP au départ. Le premier Danger non protégé devient automatiquement une Étincelle.", drawback: "Une protection automatique qui apporte aussi une réussite et l’XP de l’Étincelle." },
  { name: "Soupape lumineuse", timing: "once-per-run", effect: "spark-pressure-relief", description: "+2 XP au départ. La première Étincelle obtenue avec une Pression positive fait baisser celle-ci de 2.", drawback: "Le pouvoir reste disponible tant que la Pression est à zéro, puis se déclenche automatiquement." },
  { name: "Art du compromis", timing: "passive", effect: "fragile-quality-boost", description: "+2 XP au départ. Un résultat Fragile rapporte 3 Qualité ; un échec ne fait plus perdre de Qualité.", drawback: "Bonus automatique à chaque résultat Fragile ou échec, cumulable sur toute la culture." },
  { name: "Floraison généreuse", timing: "once-per-run", effect: "flower-lowest-plus-three", description: "+2 XP au départ. En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6.", drawback: "Une activation en Floraison. Le plus faible dé progresse et les autres valeurs sont conservées." },
] as const;

export function isKqHeritageEffect(value: unknown): value is KqHeritageEffect {
  return typeof value === "string" && KQ_HERITAGE_EFFECTS.includes(value as KqHeritageEffect);
}

export function isKqHeritageTiming(value: unknown): value is KqHeritageTiming {
  return value === "passive" || value === "once-per-run";
}

export function getKqHeritageEffectTemplate(effect: KqHeritageEffect) {
  return KQ_HERITAGE_EFFECT_TEMPLATES.find((card) => card.effect === effect)!;
}

/** Match the deployed engine while the editorial database migration is pending. */
export function getKqHeritagePresentationMetadata(card: {
  code: string;
  effectCode: string;
  description: string;
  imageUrl: string;
  producerId?: string | null;
  producerName?: string;
}) {
  if (card.effectCode !== "opening-hand-reserve") {
    return { description: card.description, imageUrl: card.imageUrl };
  }
  const officialOldFront = card.code === "HERITAGE-003"
    && (card.producerId === "producer-1773870509228-7130"
      || (!card.producerId && card.producerName === "Terracanna"))
    && card.imageUrl === "/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v5.webp";
  return {
    description: getKqHeritageEffectTemplate("opening-hand-reserve").description,
    imageUrl: officialOldFront
      ? "/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v6.webp"
      : card.imageUrl,
  };
}

export function resolveKqHeritageCard(input: {
  heritageCode?: string;
  heritageName?: string;
  heritageTiming?: KqHeritageTiming;
  heritageEffect?: KqHeritageEffect;
  heritageProducerName?: string;
  heritageImageUrl?: string;
}): KqHeritageCard | undefined {
  if (!input.heritageCode) return undefined;
  const legacy = KQ_HERITAGE_CARDS.find((card) => card.code === input.heritageCode);
  const effect = input.heritageEffect ?? legacy?.effect;
  if (!effect) return undefined;
  const template = getKqHeritageEffectTemplate(effect);
  const fallback = legacy?.effect === effect ? legacy : template;
  // Saved runs retain their signed database identity. Only the rendered card
  // aliases the old official recto; no run or heritage state is rewritten.
  const presentation = getKqHeritagePresentationMetadata({
    code: input.heritageCode,
    effectCode: effect,
    description: fallback.description,
    imageUrl: input.heritageImageUrl ?? "",
    producerName: input.heritageProducerName,
  });
  return {
    code: input.heritageCode,
    name: input.heritageName?.trim() || fallback.name,
    timing: input.heritageTiming ?? fallback.timing,
    effect,
    description: presentation.description,
    ...(input.heritageProducerName ? { producerName: input.heritageProducerName } : {}),
    ...(presentation.imageUrl ? { imageUrl: presentation.imageUrl } : {}),
  };
}

export const KQ_HERITAGE_DUPLICATE_FRAGMENTS = 1;
export const KQ_HERITAGE_CRAFT_COST = 5;

function heritageRandom(seed: number, salt: number) {
  let value = (Math.abs(Math.floor(seed)) + salt * 0x9e3779b1) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x100000000;
}

export function drawKqHeritageCard(input: {
  seed: number;
  ownedCodes?: string[];
  cards?: readonly KqHeritageCard[];
}) {
  const cards = input.cards?.length ? input.cards : KQ_HERITAGE_CARDS;
  const owned = new Set(input.ownedCodes ?? []);
  const missingPool = cards.filter((card) => !owned.has(card.code));
  const pool = missingPool.length > 0 ? missingPool : cards;
  const card = pool[Math.floor(heritageRandom(input.seed, 1) * pool.length)] ?? pool[0];
  return {
    card,
    duplicate: owned.has(card.code),
  };
}
