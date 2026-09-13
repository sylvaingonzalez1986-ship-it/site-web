import { getKqCardTradeoff, type KqSituationTag, type KqSupportCard } from "@/lib/kanab-quest-game";

export const KQ_SITUATION_TAG_LABELS: Record<KqSituationTag, string> = {
  roots: "Racines", water: "Eau", climate: "Climat", pest: "Ravageurs",
  flower: "Floraison", harvest: "Récolte", drying: "Séchage", energy: "Énergie",
  compliance: "Administratif", security: "Sécurité", light: "Éclairage", hygiene: "Hygiène",
};

// Presentation only: these roles never change costs, effects or pack odds.
export const KQ_CARD_ROLES = {
  protection: { label: "Protection", color: "#71c5ab", icon: "shield" },
  diagnosis: { label: "Diagnostic", color: "#92cee0", icon: "search" },
  dice: { label: "Relance & dés", color: "#dfb4e9", icon: "dice" },
  quality: { label: "Qualité", color: "#f4c43d", icon: "star" },
  success: { label: "Réussite", color: "#b8d787", icon: "check" },
  pest: { label: "Anti-ravageurs", color: "#efb07c", icon: "bug" },
} as const;

export function getKqCardRole(card: KqSupportCard) {
  const effect = card.effect;
  const role = card.category === "pbi" ? "pest"
    : ["reveal-pest", "pest-monitor"].includes(effect) ? "diagnosis"
    : ["patient-curing", "harvest-four-quality"].includes(effect) ? "quality"
    : ["reroll-neutral", "reroll-two-low", "four-keep-three", "thermal-check", "leaf-thinning"].includes(effect) ? "dice"
    : ["cancel-danger", "double-danger-shield", "shade-screen", "hygiene-buffer", "harvest-cool", "theft-guard", "danger-to-neutral", "clean-cut"].includes(effect) ? "protection"
    : "success";
  return { key: role, ...KQ_CARD_ROLES[role] };
}

export function getKqCardGuide(card: KqSupportCard) {
  const tradeoff = getKqCardTradeoff(card);
  return {
    ...tradeoff,
    timing: card.timing === "before-roll" ? "Avant les dés" : card.timing === "after-roll" ? "Après les dés" : "Passif",
    scope: card.tags.length ? card.tags.map((tag) => KQ_SITUATION_TAG_LABELS[tag]).join(" · ") : "Toutes les situations",
  };
}
