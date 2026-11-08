import { getKqStaffLevel } from "./kanab-quest-staff";
import type { KqStaffSkill, KqStaffSkills } from "./kanab-quest-staff-types";

/** Base game work time. SQL owns the debit; elapsed machine time is separate. */
export const KQ_PLAYER_ACTION_COSTS = {
  culture: { start: 0, roll: 0.5, resolve: 0, advance: 0, redraw: 0, heritage: 0, card: 0, "heritage-swap": 0, care: 0, "buy-care": 0.5 },
  commerce: { prepare: 1, sell: 0.5, "create-shop": 0.5, "rename-shop": 0.5, advertise: 1, "pay-lab": 0.5, "pay-supplier": 0.5, "pay-all-invoices": 0.5, "buy-computer": 0.5, "renew-shop": 0.5 },
  online: { "buy-packaging": 0.5, "create-listing": 1, "update-listing": 0.5, "upgrade-site": 0.5, "buy-upgrade": 0.5, "buy-studio-level": 0.5, "choose-studio-style": 0.5, "buy-merch-module": 0.5, "buy-merch-stock": 0.5, "update-merch": 0.5, "start-marketing": 1 },
  social: { choose: 0.5, "sponsor-accept": 0.5, "sponsor-post": 1 },
  storage: { buy: 0.5, assign: 0.5, place: 0.5, "sell-overflow": 0.5 },
  warehouse: { save: 0.5, "remove-zone": 0.5 },
  equipment: { purchase: 0.5, upgrade: 0.5, repair: 0.5, replace: 0.5, install: 0.5, "workshop-tier": 0.5 },
  administration: { "pay-energy": 0.5 },
} as const;

export type KqPlayerActionDomain = keyof typeof KQ_PLAYER_ACTION_COSTS;
/** Each gesture uses its own workstation skill, never the overall career level. */
export const KQ_PLAYER_ACTION_SKILLS = {
  commerce: { prepare: "processing", sell: "sales", "create-shop": "administration", "rename-shop": "administration", advertise: "communication", "pay-lab": "administration", "pay-supplier": "administration", "pay-all-invoices": "administration", "buy-computer": "administration", "renew-shop": "administration" },
  online: { "buy-packaging": "administration", "create-listing": "sales", "update-listing": "sales", "upgrade-site": "administration", "buy-upgrade": "administration", "buy-studio-level": "administration", "choose-studio-style": "administration", "buy-merch-module": "administration", "buy-merch-stock": "administration", "update-merch": "sales", "start-marketing": "communication" },
  social: { choose: "communication", "sponsor-accept": "communication", "sponsor-post": "communication" },
  storage: { buy: "administration", assign: "processing", place: "processing", "sell-overflow": "sales" },
  warehouse: { save: "administration", "remove-zone": "administration" },
  equipment: { purchase: "administration", upgrade: "administration", repair: "processing", replace: "processing", install: "processing", "workshop-tier": "administration" },
  administration: { "pay-energy": "administration" },
} as const;

export function getKqPlayerActionSkill(domain: KqPlayerActionDomain, action: string): KqStaffSkill | null {
  if (domain === "culture") return null;
  const actions = KQ_PLAYER_ACTION_SKILLS[domain] as Readonly<Record<string, KqStaffSkill>>;
  return Object.hasOwn(actions, action) ? actions[action] : null;
}
export function getKqCommunicationActionLevel(experience: number): number {
  return getKqStaffLevel(Number.isFinite(experience) ? experience : 0);
}
export function getKqPlayerActionLevel(domain: KqPlayerActionDomain, action: string, skills: Partial<KqStaffSkills> = {}): number | null {
  const skill = getKqPlayerActionSkill(domain, action);
  return skill ? getKqCommunicationActionLevel(skills[skill] ?? 0) : null;
}
export function getKqPlayerActionHours(domain: KqPlayerActionDomain, action: string, skills: Partial<KqStaffSkills> = {}): number {
  const actions = KQ_PLAYER_ACTION_COSTS[domain] as Readonly<Record<string, number>>;
  const base = Object.hasOwn(actions, action) ? actions[action] : 0;
  const level = getKqPlayerActionLevel(domain, action, skills);
  // Preserve each gesture's base: a half-hour gesture becomes 0.05 h at level 10.
  return level === null ? base : Math.round(base * (11 - level) * 10) / 100;
}

export const KQ_PLAYER_ACTION_COST_GROUPS = [
  { label: "Une étape de culture, une seule fois", domain: "culture", action: "roll" },
  { label: "Conditionner des fleurs", domain: "commerce", action: "prepare" },
  { label: "Créer une annonce", domain: "online", action: "create-listing" },
  { label: "Publicité, campagne marketing ou publication sponsorisée", domain: "commerce", action: "advertise" },
  { label: "Publication ordinaire ou signature d’un partenariat", domain: "social", action: "choose" },
  { label: "Vendre ou modifier une annonce", domain: "commerce", action: "sell" },
  { label: "Ranger, entretenir ou installer un équipement", domain: "storage", action: "place" },
  { label: "Achats, factures et organisation", domain: "administration", action: "pay-energy" },
  { label: "Acheter des soins", domain: "culture", action: "buy-care" },
] as const;
