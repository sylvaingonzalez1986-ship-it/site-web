export type KqHeritageTiming = "passive" | "once-per-run";

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
  { code: "HERITAGE-001", name: "Racines solides", timing: "once-per-run", effect: "root-danger-to-spark", description: "Le premier Danger en Enracinement devient une Étincelle." },
  { code: "HERITAGE-002", name: "Réserve du jardinier", timing: "passive", effect: "starting-xp-two", description: "Commence chaque culture avec 2 XP supplémentaires." },
  { code: "HERITAGE-003", name: "Main prévoyante", timing: "once-per-run", effect: "opening-hand-reserve", description: "À la première étape, pioche 8 cartes et compose une main de 5." },
  { code: "HERITAGE-004", name: "Climat stable", timing: "once-per-run", effect: "climate-danger-to-spark", description: "Le premier Danger d’une situation Climat devient une Étincelle." },
  { code: "HERITAGE-005", name: "Second regard", timing: "passive", effect: "two-extra-redraws", description: "Accorde deux changements de main supplémentaires par culture." },
  { code: "HERITAGE-006", name: "Reprise vigoureuse", timing: "once-per-run", effect: "failure-to-fragile", description: "Le premier échec de la culture devient un résultat Fragile." },
  { code: "HERITAGE-007", name: "Instinct du cultivateur", timing: "once-per-run", effect: "neutral-to-spark", description: "Après un lancer, transforme un dé neutre en Étincelle." },
  { code: "HERITAGE-008", name: "Bouclier biologique", timing: "once-per-run", effect: "free-pest-mastery", description: "Révèle gratuitement le premier ravageur et accorde 2 XP." },
  { code: "HERITAGE-009", name: "Floraison maîtrisée", timing: "once-per-run", effect: "flower-neutrals-to-success", description: "Pendant la Floraison, transforme tous les dés neutres en réussites." },
  { code: "HERITAGE-010", name: "Affinage patient", timing: "once-per-run", effect: "drying-lowest-to-spark", description: "À la dernière étape, transforme le dé le plus faible en Étincelle." },
  { code: "HERITAGE-011", name: "Héritage de la canopée", timing: "once-per-run", effect: "dangers-to-success", description: "Transforme tous les Dangers d’un lancer en réussites." },
  { code: "HERITAGE-012", name: "Signature du maître", timing: "once-per-run", effect: "five-keep-three", description: "Lance cinq dés et conserve les trois meilleurs." },
] as const;

export const KQ_HERITAGE_EFFECT_TEMPLATES: readonly KqHeritageEffectTemplate[] = [
  { ...KQ_HERITAGE_CARDS[0], drawback: "Ne se déclenche qu’en Enracinement et une seule fois." },
  { ...KQ_HERITAGE_CARDS[1], drawback: "N’améliore directement aucun lancer de dés." },
  { ...KQ_HERITAGE_CARDS[2], drawback: "La réserve disparaît après le premier lancer de la culture." },
  { ...KQ_HERITAGE_CARDS[3], drawback: "Ne se déclenche que face à une Situation Climat." },
  { ...KQ_HERITAGE_CARDS[4], drawback: "Change la main, sans garantir de meilleurs dés ni rendre d’XP." },
  { ...KQ_HERITAGE_CARDS[5], drawback: "Le résultat sauvé reste Fragile et le pouvoir est ensuite consommé." },
  { ...KQ_HERITAGE_CARDS[6], drawback: "Exige un dé neutre après le lancer et ne transforme qu’un seul dé." },
  { ...KQ_HERITAGE_CARDS[7], drawback: "Reste sans effet pendant les étapes dépourvues de ravageur caché." },
  { ...KQ_HERITAGE_CARDS[8], drawback: "Réservé à la Floraison et exige au moins un dé neutre." },
  { ...KQ_HERITAGE_CARDS[9], drawback: "Réservé à la dernière étape de Séchage & affinage." },
  { ...KQ_HERITAGE_CARDS[10], drawback: "Doit être activé après un lancer contenant un Danger non protégé." },
  { ...KQ_HERITAGE_CARDS[11], drawback: "Doit être armé avant le lancer et ne fonctionne qu’une fois." },
  { name: "Élan de semis", timing: "once-per-run", effect: "germination-lowest-to-strong", description: "En Germination, transforme le dé le plus faible en réussite forte.", drawback: "Réservé à la Germination ; le dé transformé devient 5, jamais une Étincelle." },
  { name: "Racines décompressées", timing: "once-per-run", effect: "rooting-pressure-reset", description: "En Enracinement, ramène immédiatement la Pression à zéro après le lancer.", drawback: "Ne modifie aucun dé et exige une Pression déjà supérieure à zéro." },
  { name: "Croissance résiliente", timing: "once-per-run", effect: "growth-danger-reroll", description: "En Croissance, relance un Danger non protégé.", drawback: "La relance peut produire un nouveau Danger et reste limitée à la Croissance." },
  { name: "Pistils étincelants", timing: "once-per-run", effect: "flower-success-to-spark", description: "En Floraison, transforme une réussite ordinaire en Étincelle.", drawback: "Exige un dé 4 ou 5 : ce pouvoir ne sauve pas un lancer sans réussite." },
  { name: "Mémoire du gardien", timing: "passive", effect: "harvest-theft-shield", description: "Annule toute perte de récolte lors du Renard à deux pattes.", drawback: "N’apporte aucun bonus hors de la Situation de vol de production." },
  { name: "Dernier affinage", timing: "once-per-run", effect: "drying-fragile-to-success", description: "Au Séchage & affinage, transforme un résultat Fragile en réussite.", drawback: "Ne corrige ni un échec complet ni une autre étape de la culture." },
  { name: "Premier élan", timing: "passive", effect: "first-success-xp-two", description: "La première réussite ou réussite critique de la culture rapporte 2 XP supplémentaires.", drawback: "Le bonus ne s’applique qu’au premier résultat réussi, même tardif." },
  { name: "Exigence du jury", timing: "passive", effect: "critical-quality-boost", description: "Chaque réussite critique rapporte 1 point de Qualité supplémentaire.", drawback: "N’apporte rien aux réussites ordinaires, résultats Fragiles ou échecs." },
  { name: "Culture zen", timing: "passive", effect: "calm-target-relief", description: "À Pression zéro, réduit de 1 la difficulté de la Situation, sans descendre sous 1.", drawback: "Le bonus disparaît dès que la Pression monte au-dessus de zéro." },
  { name: "Parade ancestrale", timing: "once-per-run", effect: "first-danger-shield", description: "Annule automatiquement le premier Danger non protégé d’un lancer.", drawback: "Le Danger est seulement annulé : il ne devient ni réussite ni Étincelle." },
  { name: "Soupape lumineuse", timing: "once-per-run", effect: "spark-pressure-relief", description: "La première Étincelle obtenue ramène la Pression deux niveaux plus bas.", drawback: "Exige une Étincelle et une Pression positive ; ne modifie pas le résultat des dés." },
  { name: "Art du compromis", timing: "passive", effect: "fragile-quality-boost", description: "Un résultat Fragile rapporte 2 points de Qualité au lieu de 1.", drawback: "N’améliore jamais un échec et ne rapporte aucun XP supplémentaire." },
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
  return {
    code: input.heritageCode,
    name: input.heritageName?.trim() || legacy?.name || template.name,
    timing: input.heritageTiming ?? legacy?.timing ?? template.timing,
    effect,
    description: legacy?.description ?? template.description,
    ...(input.heritageProducerName ? { producerName: input.heritageProducerName } : {}),
    ...(input.heritageImageUrl ? { imageUrl: input.heritageImageUrl } : {}),
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
