import {
  isKqHeritageEffect,
  KQ_HERITAGE_EFFECT_TEMPLATES,
} from "@/lib/kanab-quest-heritage";

export type KqHeritageAdminCardSummarySource = {
  code: string;
  effect: string;
  isActive: boolean;
  producerId: string | null;
  producerName: string;
};

export type KqHeritageAdminEffectOption = {
  effect: string;
  timing: string;
  label: string;
  description: string;
  drawback: string;
  assignedCardCode: string | null;
  assignedProducerName: string;
  isAvailable: boolean;
};

export type KqHeritageAdminSummary = {
  totalCards: number;
  activeCards: number;
  pendingEditorialCards: number;
  hiddenCards: number;
  archivedCards: number;
  totalEffects: number;
  availableEffects: number;
  duplicateActiveEffects: number;
};

export type KqHeritageAdminCardStatus = "active" | "pending" | "hidden" | "archived";
export type KqHeritageAdminCardFilter = "all" | KqHeritageAdminCardStatus;

export function isKqHeritagePendingEditorialEffect(effect: string) {
  return effect.startsWith("pending-editorial-") || !isKqHeritageEffect(effect);
}

export function getKqHeritageAdminCardStatus(
  card: KqHeritageAdminCardSummarySource,
): KqHeritageAdminCardStatus {
  if (!card.producerId) return "archived";
  if (isKqHeritagePendingEditorialEffect(card.effect)) return "pending";
  return card.isActive ? "active" : "hidden";
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

const KQ_HERITAGE_STATUS_ORDER: Record<KqHeritageAdminCardStatus, number> = {
  pending: 0,
  active: 1,
  hidden: 2,
  archived: 3,
};

export function filterAndSortKqHeritageAdminCards<T extends KqHeritageAdminCardSummarySource>(
  cards: readonly T[],
  query: string,
  filter: KqHeritageAdminCardFilter,
): T[] {
  const normalizedQuery = normalizeSearchValue(query);
  return cards
    .filter((card) => {
      const status = getKqHeritageAdminCardStatus(card);
      if (filter !== "all" && status !== filter) return false;
      if (!normalizedQuery) return true;
      return normalizeSearchValue(`${card.code} ${card.producerName} ${card.effect}`).includes(normalizedQuery);
    })
    .sort((left, right) => {
      const statusDelta = KQ_HERITAGE_STATUS_ORDER[getKqHeritageAdminCardStatus(left)]
        - KQ_HERITAGE_STATUS_ORDER[getKqHeritageAdminCardStatus(right)];
      if (statusDelta !== 0) return statusDelta;
      return left.producerName.localeCompare(right.producerName, "fr", { sensitivity: "base" })
        || left.code.localeCompare(right.code);
    });
}

export function buildKqHeritageAdminState(
  cards: readonly KqHeritageAdminCardSummarySource[],
): { effectOptions: KqHeritageAdminEffectOption[]; summary: KqHeritageAdminSummary } {
  const activeAssignments = new Map<string, KqHeritageAdminCardSummarySource[]>();

  for (const card of cards) {
    if (!card.producerId || !card.isActive || !isKqHeritageEffect(card.effect)) continue;
    const assignments = activeAssignments.get(card.effect) ?? [];
    assignments.push(card);
    activeAssignments.set(card.effect, assignments);
  }

  const effectOptions = KQ_HERITAGE_EFFECT_TEMPLATES.map((template) => {
    const assignment = activeAssignments.get(template.effect)?.[0];
    return {
      effect: template.effect,
      timing: template.timing,
      label: template.name,
      description: template.description,
      drawback: template.drawback,
      assignedCardCode: assignment?.code ?? null,
      assignedProducerName: assignment?.producerName ?? "",
      isAvailable: !assignment,
    };
  });

  const statuses = cards.map(getKqHeritageAdminCardStatus);
  const activeCards = statuses.filter((status) => status === "active").length;
  const pendingEditorialCards = statuses.filter((status) => status === "pending").length;
  const hiddenCards = statuses.filter((status) => status === "hidden").length;
  const archivedCards = statuses.filter((status) => status === "archived").length;
  const duplicateActiveEffects = [...activeAssignments.values()]
    .reduce((count, assignments) => count + Math.max(0, assignments.length - 1), 0);

  return {
    effectOptions,
    summary: {
      totalCards: cards.length,
      activeCards,
      pendingEditorialCards,
      hiddenCards,
      archivedCards,
      totalEffects: effectOptions.length,
      availableEffects: effectOptions.filter((option) => option.isAvailable).length,
      duplicateActiveEffects,
    },
  };
}
