import { KQ_CARD_ARTWORK } from "@/lib/kanab-quest-artwork";
import { getKqEquipmentArtwork, KQ_EQUIPMENT_ARTWORK } from "@/lib/kanab-quest-equipment-artwork";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KQ_CARDS, KQ_SITUATIONS } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";
import {
  KQ_POWER_OUTAGE_ARTWORK,
  KQ_SITUATION_ARTWORK,
} from "@/lib/kanab-quest-situation-artwork";

export type KqArtworkReviewGroup = "support" | "heritage" | "situation" | "equipment";

export type KqArtworkReviewAsset = {
  code: string;
  name: string;
  group: KqArtworkReviewGroup;
  groupLabel: string;
  src: string;
  alt: string;
  format: "portrait" | "square";
  placeholder?: boolean;
};

export type KqArtworkReviewHeritageSource = {
  code: string;
  name: string;
  imageUrl: string;
  producerImage?: string;
  producerName?: string;
  isActive: boolean;
};

export const KQ_ARTWORK_REVIEW_ASSETS: readonly KqArtworkReviewAsset[] = [
  ...KQ_CARDS.map((card) => ({
    code: card.code,
    name: card.name,
    group: "support" as const,
    groupLabel: "La Botte",
    src: KQ_CARD_ARTWORK[card.code],
    alt: `Carte La Botte « ${card.name} »`,
    format: "portrait" as const,
  })),
  ...KQ_HERITAGE_CARDS.map((card) => ({
    code: card.code,
    name: card.name,
    group: "heritage" as const,
    groupLabel: "Héritage",
    src: KQ_CARD_ARTWORK[card.code],
    alt: `Carte Héritage « ${card.name} »`,
    format: "portrait" as const,
  })),
  ...KQ_SITUATIONS.map((situation) => ({
    code: situation.code,
    name: situation.name,
    group: "situation" as const,
    groupLabel: "Situation",
    src: KQ_SITUATION_ARTWORK[situation.code].src,
    alt: KQ_SITUATION_ARTWORK[situation.code].alt,
    format: "square" as const,
  })),
  {
    code: "STATUS-POWER-OUTAGE",
    name: "Coupure de courant",
    group: "situation",
    groupLabel: "État de jeu",
    src: KQ_POWER_OUTAGE_ARTWORK.src,
    alt: KQ_POWER_OUTAGE_ARTWORK.alt,
    format: "square",
  },
  ...Object.keys(KQ_EQUIPMENT_ARTWORK).flatMap((code) => {
    const equipment = getKqEquipmentDefinition(code);
    if (!equipment) return [];
    const artwork = getKqEquipmentArtwork(equipment.code);
    if (!artwork) return [];
    return [{
      code: equipment.code,
      name: equipment.name,
      group: "equipment" as const,
      groupLabel: "Équipement",
      src: artwork.src,
      alt: artwork.alt,
      format: "square" as const,
    }];
  }),
];

export function buildKqArtworkReviewAssets(
  heritages: readonly KqArtworkReviewHeritageSource[],
): readonly KqArtworkReviewAsset[] {
  const dynamicHeritages = heritages
    .filter((card) => card.isActive)
    .map((card) => {
      const imageUrl = card.imageUrl.trim();
      return {
        code: card.code,
        name: card.name,
        group: "heritage" as const,
        groupLabel: "Héritage producteur",
        src: imageUrl || card.producerImage?.trim() || "/mascots/home-producer.png",
        alt: `Carte Héritage « ${card.name} » de ${card.producerName || "producteur inconnu"}`,
        format: "portrait" as const,
        placeholder: !imageUrl,
      };
    });

  return [
    ...KQ_ARTWORK_REVIEW_ASSETS.filter((asset) => asset.group === "support"),
    ...dynamicHeritages,
    ...KQ_ARTWORK_REVIEW_ASSETS.filter((asset) => asset.group === "situation"),
    ...KQ_ARTWORK_REVIEW_ASSETS.filter((asset) => asset.group === "equipment"),
  ];
}

export const KQ_ARTWORK_REVIEW_SCHEMA = "kanab-quest-artwork-review-v3";

export type KqArtworkReviewStatus = "approved" | "rework";

export type KqArtworkReviewDecision = {
  status: KqArtworkReviewStatus;
  src: string;
  reviewedAt: string;
};

export type KqArtworkReviewState = Partial<Record<string, KqArtworkReviewDecision>>;

function isReviewStatus(value: unknown): value is KqArtworkReviewStatus {
  return value === "approved" || value === "rework";
}

function isReportStatus(value: unknown): value is KqArtworkReviewStatus | "pending" {
  return value === "pending" || isReviewStatus(value);
}

export function buildKqArtworkReviewManifestId(assets: readonly KqArtworkReviewAsset[]) {
  const value = assets.map((asset) => `${asset.code}:${asset.src}`).join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `artwork-${assets.length}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const KQ_ARTWORK_REVIEW_MANIFEST_ID = buildKqArtworkReviewManifestId(KQ_ARTWORK_REVIEW_ASSETS);

export function getKqArtworkReviewStatus(
  state: KqArtworkReviewState,
  asset: KqArtworkReviewAsset,
): KqArtworkReviewStatus | "pending" {
  if (asset.placeholder) return "pending";
  const decision = state[asset.code];
  return decision?.src === asset.src ? decision.status : "pending";
}

export function summarizeKqArtworkReview(
  state: KqArtworkReviewState,
  assets: readonly KqArtworkReviewAsset[] = KQ_ARTWORK_REVIEW_ASSETS,
) {
  const approved = assets.filter((asset) => (
    getKqArtworkReviewStatus(state, asset) === "approved"
  )).length;
  const rework = assets.filter((asset) => (
    getKqArtworkReviewStatus(state, asset) === "rework"
  )).length;
  const pending = assets.length - approved - rework;
  return {
    approved,
    rework,
    pending,
    readyForLaunch: assets.length > 0 && approved === assets.length,
  };
}

function parseReviewAssets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.code !== "string" || typeof candidate.src !== "string" || !isReportStatus(candidate.status)) {
      return [];
    }
    return [{
      code: candidate.code,
      src: candidate.src,
      status: candidate.status,
      reviewedAt: typeof candidate.reviewedAt === "string" ? candidate.reviewedAt : "",
    }];
  });
}

export function parseKqArtworkReviewState(
  value: string | null,
  assets: readonly KqArtworkReviewAsset[] = KQ_ARTWORK_REVIEW_ASSETS,
): KqArtworkReviewState {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const candidates = parsed as Record<string, unknown>;
    return Object.fromEntries(assets.flatMap((asset) => {
      const decision = candidates[asset.code];
      if (!decision || typeof decision !== "object" || Array.isArray(decision)) return [];
      const entry = decision as Record<string, unknown>;
      return entry.src === asset.src && isReviewStatus(entry.status)
        ? [[asset.code, {
            src: asset.src,
            status: entry.status,
            reviewedAt: typeof entry.reviewedAt === "string" ? entry.reviewedAt : "",
          }]]
        : [];
    }));
  } catch {
    return {};
  }
}

export function buildKqArtworkReviewReport(
  state: KqArtworkReviewState,
  exportedAt = new Date().toISOString(),
  assets: readonly KqArtworkReviewAsset[] = KQ_ARTWORK_REVIEW_ASSETS,
) {
  const summary = summarizeKqArtworkReview(state, assets);
  return {
    schema: KQ_ARTWORK_REVIEW_SCHEMA,
    manifestId: buildKqArtworkReviewManifestId(assets),
    exportedAt,
    inventory: {
      total: assets.length,
      heritage: assets.filter((asset) => asset.group === "heritage").length,
    },
    summary,
    assets: assets.map((asset) => ({
      code: asset.code,
      name: asset.name,
      group: asset.group,
      src: asset.src,
      status: getKqArtworkReviewStatus(state, asset),
      reviewedAt: state[asset.code]?.src === asset.src ? state[asset.code]?.reviewedAt : "",
    })),
  };
}

export function importKqArtworkReviewReport(
  value: string | unknown,
  assets: readonly KqArtworkReviewAsset[] = KQ_ARTWORK_REVIEW_ASSETS,
) {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Rapport de revue invalide.");
  }
  const report = parsed as Record<string, unknown>;
  if (report.schema !== KQ_ARTWORK_REVIEW_SCHEMA && report.schema !== "kanab-quest-artwork-review-v2" && report.schema !== "kanab-quest-artwork-review-v1") {
    throw new Error("Version de rapport non prise en charge.");
  }
  if (!Array.isArray(report.assets)) throw new Error("Liste de visuels absente du rapport.");
  const exportedAt = typeof report.exportedAt === "string" ? report.exportedAt : "";
  const importedAssets = parseReviewAssets(report.assets);
  const currentByCode = new Map(assets.map((asset) => [asset.code, asset]));
  const state: KqArtworkReviewState = {};
  const staleCodes: string[] = [];
  const unknownCodes: string[] = [];
  const seenCodes = new Set<string>();

  importedAssets.forEach((entry) => {
    const asset = currentByCode.get(entry.code);
    if (!asset) {
      unknownCodes.push(entry.code);
      return;
    }
    seenCodes.add(entry.code);
    if (asset.src !== entry.src) {
      staleCodes.push(entry.code);
      return;
    }
    if (entry.status === "pending") return;
    state[entry.code] = {
      status: entry.status,
      src: entry.src,
      reviewedAt: entry.reviewedAt || exportedAt,
    };
  });

  return {
    state,
    accepted: Object.keys(state).length,
    staleCodes,
    unknownCodes,
    missingCodes: assets
      .filter((asset) => !seenCodes.has(asset.code))
      .map((asset) => asset.code),
    manifestMatches: report.manifestId === buildKqArtworkReviewManifestId(assets),
  };
}
