import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";
import type { KqHarvestRow } from "./kanab-quest-harvests";
import { getKqHarvestStep } from "./kanab-quest-harvests";
import { getKqCommerceStockQuality, type KqCommerceRawLot, type KqCommerceStock } from "./kanab-quest-commerce";
import { KQ_MARKET_ROUTES } from "./kanab-quest-market";
import type { KqStorageProjection } from "./kanab-quest-storage";

export type KqLotSummarySource = { kind: "harvest"; row: KqHarvestRow }
  | { kind: "storage"; lot: KqStorageSnapshot["lots"][number] }
  | { kind: "raw"; lot: KqCommerceRawLot }
  | { kind: "product"; stock: KqCommerceStock };

export type KqLotSummary = {
  flowerId: string;
  productId?: string;
  name: string;
  harvestedAt: string | null;
  quantity: { label: string; grams: number | null; equivalent: boolean };
  quality: { label: string; value: number | null; unit: "points" | "/ 10" };
  state: string;
  next: string;
  progress: number | null;
  readyAt: string | null;
  exposedGrams: number | null;
  productName?: string;
  juryScore?: number;
};

const amount = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const score = (value: unknown): number | null => { const valid = amount(value); return valid !== null && valid <= 10 ? valid : null; };
const date = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const grams = (units: unknown) => { const value = amount(units); return value === null ? null : value / 10; };

function summary(input: { flowerId: string; name: string; status: string; storage?: KqStorageProjection; createdAt?: string; quantity?: KqLotSummary["quantity"] }): KqLotSummary {
  const { storage, status } = input;
  const judged = status === "burned";
  const beforeJury = status === "available" || status === "queued" || status === "locked";
  const ready = storage?.stage === "ready";
  const progress = amount(storage?.progressPercent);
  const quantity = input.quantity ?? { label: "Vrac restant", grams: grams(storage?.capacity?.totalUnits), equivalent: true };
  const exposedGrams = grams(storage?.capacity?.overflowUnits);
  let state = "État à vérifier", next = "Actualise le suivi du lot pour connaître la prochaine étape.";
  if (status === "queued") { state = "Adversaire recherché"; next = "Suis la recherche depuis le jury. Le stock récolté est conservé."; }
  else if (status === "locked") { state = "Duel en cours"; next = "Termine le passage au jury pour ouvrir la vente."; }
  else if (exposedGrams !== null && exposedGrams > 0) {
    state = "À ranger";
    next = judged ? "Choisis un contenant pour protéger le surplus ou consulte l’offre du grossiste."
      : beforeJury ? "Choisis un contenant pour protéger le surplus. La vente viendra après le jury."
      : "Protège le surplus et vérifie le passage au jury avant de choisir une vente.";
  }
  else if (judged && !input.quantity && getKqHarvestStep(status, storage) === "storage") { state = "Stock à vérifier"; next = "Actualise le stockage pour confirmer la quantité restante et les possibilités de vente."; }
  else if (storage?.stage === "curing") { state = "Affinage en cours"; next = judged ? "Le grossiste peut proposer une reprise avant la fin, selon son quota." : beforeJury ? "L’affinage avance hors connexion. Le jury vient ensuite." : "L’affinage avance hors connexion. Le passage au jury reste à vérifier."; }
  else if (ready && status === "available") { state = "Prêt pour le jury"; next = "Présente la Fleur d’Arène au jury. Ton stock récolté sera conservé."; }
  else if (judged) {
    state = ready && quantity.grams !== null && quantity.grams > 0 && exposedGrams === 0 ? "Prêt à vendre" : "Après le jury";
    next = "Compare les préparations et les offres disponibles pour ce lot.";
  }
  if (judged && quantity.grams === 0) {
    state = "Plus de vrac";
    next = "Vérifie les éventuels paquets déjà créés dans Mon stock en vente.";
  }
  return {
    flowerId: input.flowerId, name: input.name, harvestedAt: date(storage?.harvestedAt) ?? date(input.createdAt),
    quantity,
    quality: { label: judged ? "Qualité actuelle" : beforeJury ? "Qualité estimée" : "Qualité du lot", value: score(storage?.conditionScore), unit: "/ 10" },
    state, next, progress: storage?.stage === "curing" && progress !== null ? Math.min(99.9, progress) : null,
    readyAt: storage?.stage === "curing" ? date(storage.readyAt) : null,
    exposedGrams,
  };
}

/** The same harvest identity across screens; product grams never stand for flower equivalents. */
export function getKqLotSummary(source: KqLotSummarySource): KqLotSummary {
  if (source.kind === "harvest") {
    if (source.row.lot) return getKqLotSummary({ kind: "storage", lot: source.row.lot });
    const flower: KqOfficialFlower | undefined = source.row.flower;
    const result = summary({ flowerId: source.row.id, name: source.row.name, status: flower?.status ?? "unknown", storage: flower?.storage, createdAt: flower?.createdAt });
    if (!flower?.storage) result.quality = { label: "Qualité de culture", value: amount(flower?.quality), unit: "points" };
    return result;
  }
  if (source.kind === "storage") {
    const { lot } = source;
    return summary({ flowerId: lot.flowerId, name: lot.varietyName, status: lot.flowerStatus, storage: lot.projection });
  }
  if (source.kind === "raw") {
    const { lot } = source;
    const result = summary({ flowerId: lot.flowerId, name: lot.varietyName, status: "burned", storage: lot.storage,
      quantity: { label: "Fleurs à préparer", grams: amount(lot.harvestGrams), equivalent: false } });
    result.juryScore = score(lot.juryScore) ?? undefined;
    return result;
  }
  const { stock } = source;
  const result = summary({ flowerId: stock.flowerId, name: stock.name, status: "burned", storage: stock.storage,
    quantity: { label: "Produit restant en vrac", grams: grams(stock.remainingUnits), equivalent: false } });
  result.productId = stock.id;
  result.productName = stock.route === "raw" ? "Fleurs entières" : KQ_MARKET_ROUTES.find(route => route.code === stock.route)?.name ?? stock.route;
  const deltaKnown = !stock.storage || (typeof stock.storage.qualityDelta === "number" && Number.isFinite(stock.storage.qualityDelta));
  result.quality = { label: "Qualité commerciale", value: score(stock.juryScore) === null || !deltaKnown ? null : score(getKqCommerceStockQuality(stock)), unit: "/ 10" };
  result.juryScore = score(stock.juryScore) ?? undefined;
  const processingAt = date(stock.processingReadyAt);
  const serverNow = date(stock.storage?.serverNow);
  if (stock.processingReadyAt && (!processingAt || !serverNow || Date.parse(processingAt) > Date.parse(serverNow))) {
    result.state = processingAt && serverNow ? "Transformation en cours" : "Préparation à vérifier";
    result.next = processingAt && serverNow ? "Le produit pourra être proposé à la vente après la fin de sa préparation." : "Actualise le lot pour confirmer la fin de sa préparation.";
    result.readyAt = processingAt; result.progress = null;
  } else if (result.state === "Prêt à vendre") {
    result.state = "Produit prêt à vendre";
    result.next = "Compare les offres pour ce produit. Les paquets déjà créés restent dans Mon stock en vente.";
  } else if (result.state === "Après le jury") {
    result.state = "Produit préparé";
    result.next = "Vérifie le stock et les offres disponibles pour ce produit.";
  }
  return result;
}
