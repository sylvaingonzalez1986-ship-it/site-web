import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import type { KqStaffCandidate, KqStaffRole, KqStaffSkills, KqStaffTrait, KqStaffRecruitment } from "./kanab-quest-staff-types";

export const KQ_STAFF_RECRUITMENT_DAYS = 15;

const FEMALE_PORTRAITS = new Set(["anna", "lucie", "samira", "nora", "ines", "lea"]);
// Adjacent periods use disjoint first names, so the whole board visibly changes.
const FEMALE_NAMES = ["Camille", "Louise", "Ninon", "Élodie", "Morgane", "Alice", "Aïcha", "Chloé", "Manon", "Emma", "Salomé", "Clara"];
const MALE_NAMES = ["Arthur", "Noé", "Baptiste", "Mehdi", "Émile", "Gabin", "Théo", "Malo", "Raphaël", "Enzo"];
const SURNAMES = ["Le Roux", "Garnier", "Dupont", "Le Goff", "Roussel", "Benali", "Mercier", "Leclerc", "Masson", "Guérin", "Perrin", "Rivière", "Le Corre", "Lemoine", "Le Bihan", "Rolland", "Le Guen", "Marchand", "Collet", "Robin", "Chevalier", "Ollivier", "Diallo", "Durand"];
const TRAITS: KqStaffTrait[] = ["meticulous", "quick", "learner", "outgoing", "versatile", "organized"];
const BIOGRAPHIES: Record<KqStaffRole, string> = {
  worker: "Un nouveau parcours agricole, de la culture aux coups de main à l’atelier.",
  grower: "Une expérience de la culture et de la transformation pour accompagner l’équipe.",
  processor: "Un parcours tourné vers l’atelier et la préparation des récoltes.",
  commercial: "Des idées pour faire connaître la ferme et rencontrer de nouvelles boutiques.",
  administrator: "Un parcours consacré aux dossiers, aux échéances et aux fournisseurs.",
};

/** Stable local generator: reopening a board cannot reroll its offers. */
function recruitmentRandom(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return (max: number) => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ value >>> 15, value | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return Math.floor(((mixed ^ mixed >>> 14) >>> 0) / 4294967296 * max);
  };
}

export function getKqStaffRecruitment(startedAt: string, serverNow: string): { candidates: KqStaffCandidate[]; recruitment: KqStaffRecruitment } {
  const origin = Date.parse(startedAt), now = Date.parse(serverNow);
  if (!Number.isFinite(origin) || !Number.isFinite(now)) throw new Error("Calendrier de recrutement indisponible.");
  const cycle = Math.floor(Math.max(0, now - origin) / (KQ_STAFF_RECRUITMENT_DAYS * KQ_GAME_DAY_MS));
  const startDay = cycle * KQ_STAFF_RECRUITMENT_DAYS + 1;
  const nextDay = startDay + KQ_STAFF_RECRUITMENT_DAYS;
  const recruitment = { cycle, startDay, nextDay, refreshAt: new Date(origin + (nextDay - 1) * KQ_GAME_DAY_MS).toISOString() };
  // Keep launch offers compatible; already hired employees retain their full stored profile.
  if (cycle === 0) return { recruitment, candidates: structuredClone(KQ_STAFF_CANDIDATES) };
  const random = recruitmentRandom(`${origin}:${cycle}`);
  let female = 0, male = 0;
  const candidates = KQ_STAFF_CANDIDATES.map(template => {
    const name = FEMALE_PORTRAITS.has(template.code)
      ? FEMALE_NAMES[(cycle - 1) % 2 * 6 + female++]
      : MALE_NAMES[(cycle - 1) % 2 * 5 + male++];
    const skills = Object.fromEntries(Object.entries(template.skills).map(([skill, experience]) => {
      const rank = Math.floor(Math.sqrt(experience / 100));
      const adjusted = Math.max(0, Math.min(9, rank + random(3) - 1));
      return [skill, adjusted * adjusted * 100];
    })) as KqStaffSkills;
    // Salaries never fall below the already validated template/classification minimum.
    const hourlyCents = Math.round(template.hourlyCents * (1 + random(13) / 100));
    return { ...structuredClone(template), code: `staff-${cycle}-${template.code}`, portraitCode: template.code,
      name: `${name} ${SURNAMES[random(SURNAMES.length)]}`, skills, hourlyCents,
      trait: TRAITS[random(TRAITS.length)], biography: BIOGRAPHIES[template.role] };
  });
  return { recruitment, candidates };
}

const xp = (culture: number, processing: number, communication: number, sales: number, administration: number): KqStaffSkills => ({ culture, processing, communication, sales, administration });
export const KQ_STAFF_CANDIDATES: KqStaffCandidate[] = [
  { code: "anna", name: "Anna Le Gall", role: "worker", trait: "learner", biography: "Débute à la ferme. Son carnet de questions est déjà bien rempli.", hourlyCents: 1231, classification: 1, skills: xp(0, 0, 0, 0, 0), contracts: ["cdi", "cdd", "seasonal"] },
  { code: "mael", name: "Maël Riou", role: "worker", trait: "versatile", biography: "De la parcelle à l’atelier, trouve toujours de quoi donner un coup de main.", hourlyCents: 1340, classification: 4, skills: xp(400, 100, 0, 0, 100), contracts: ["cdi", "cdd", "seasonal"] },
  { code: "lucie", name: "Lucie Morel", role: "worker", trait: "meticulous", biography: "Repère un détail oublié avant même que quelqu’un le cherche.", hourlyCents: 1410, classification: 6, skills: xp(900, 400, 0, 0, 100), contracts: ["cdi", "seasonal"] },
  { code: "samira", name: "Samira Bernard", role: "grower", trait: "organized", biography: "Anticipe la récolte, accompagne l’équipe et connaît son atelier.", hourlyCents: 1887, classification: 10, skills: xp(2500, 1600, 100, 100, 900), contracts: ["cdi"] },
  { code: "yann", name: "Yann Kerjean", role: "grower", trait: "meticulous", biography: "Des années de culture ; son exigence se retrouve jusque dans la transformation.", hourlyCents: 2445, classification: 12, skills: xp(4900, 3600, 400, 100, 900), contracts: ["cdi"] },
  { code: "nora", name: "Nora Martin", role: "processor", trait: "quick", biography: "L’atelier avance vite. Aime aussi prêter main-forte aux récoltes.", hourlyCents: 1479, classification: 7, skills: xp(400, 1600, 0, 0, 100), contracts: ["cdi", "cdd", "seasonal"] },
  { code: "jo", name: "Jo Thomas", role: "processor", trait: "versatile", biography: "Connaît chaque poste de l’atelier, sans perdre la main au champ.", hourlyCents: 1579, classification: 8, skills: xp(900, 2500, 100, 100, 400), contracts: ["cdi", "cdd"] },
  { code: "ines", name: "Inès Laurent", role: "commercial", trait: "outgoing", biography: "Se souvient des prénoms et repart rarement sans un rendez-vous.", hourlyCents: 1579, classification: 8, skills: xp(0, 0, 900, 1600, 400), contracts: ["cdi", "cdd"] },
  { code: "hugo", name: "Hugo Simon", role: "commercial", trait: "learner", biography: "Une idée de publication par minute et l’envie de rencontrer les boutiques.", hourlyCents: 1399, classification: 6, skills: xp(0, 0, 400, 100, 100), contracts: ["cdi", "cdd"] },
  { code: "lea", name: "Léa Nicolas", role: "administrator", trait: "organized", biography: "Les échéances et les factures ont chacune leur place dans son registre.", hourlyCents: 1479, classification: 7, skills: xp(0, 0, 100, 400, 1600), contracts: ["cdi", "cdd"] },
  { code: "malik", name: "Malik Robert", role: "administrator", trait: "versatile", biography: "Passe des comptes aux fournisseurs et sait expliquer les chiffres.", hourlyCents: 1707, classification: 9, skills: xp(100, 100, 400, 900, 2500), contracts: ["cdi", "cdd"] },
];

