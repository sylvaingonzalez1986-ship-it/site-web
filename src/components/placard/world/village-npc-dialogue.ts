import type { VillageNpcId } from "./village-npc-types";

export type SpeakingVillageNpcId = Exclude<VillageNpcId, "loic">;
export type NpcIntervention = {
  id: string;
  type: "speech" | "song";
  segments: readonly string[];
  emphasis: number;
};

/** Authored local text: a segment is exactly one physical activation. */
export const VILLAGE_NPC_INTERVENTIONS = {
  breton: [
    { id: "salutation", type: "speech", segments: ["Demat !"], emphasis: 0.45 },
    { id: "galette-saucisse", type: "song", segments: [
      "Galette saucisse, je t’aiiimmeee ! J’en mangerais des kilos…",
      "Dans toute l’Ille-et-Vilaine…",
      "Avec du lait ribot…",
      "Et si tu m’abandonnes, alors je m’empoisonne avec des tripes de Caen et des rillettes du Maaaannnns !",
    ], emphasis: 0.8 },
    { id: "blanc-sur-rouge", type: "song", segments: ["Blaaaaaanc sur Rouuuuuuuuge, rien ne bouuuuge ! Rouuuuge sur Blaaaaanc, tout fout le caaaaamp !"], emphasis: 1 },
    { id: "loup-renard-belette", type: "song", segments: [
      "C’est dans dix ans, je m’en irai…",
      "J’entends le loup et le renard chanter…",
      "C’est dans dix ans, je m’en irai…",
      "J’entends le loup et le renard chanter…",
      "J’entends le loup, le renard et la belette…",
      "J’entends le loup et le renard chanter…",
      "J’entends le loup, le renard et la belette…",
      "J’entends le loup et le renard chanter…",
      "C’est dans neuf ans, je m’en irai !",
    ], emphasis: 0.75 },
  ],
  fisherman: [
    { id: "horizon", type: "speech", segments: ["Horizon pas net, reste à la buvette."], emphasis: 0.45 },
    { id: "tetus", type: "speech", segments: ["Les Bretons ne sont pas têtus…", "Ils ont juste raison."], emphasis: 0.6 },
    { id: "vent", type: "speech", segments: ["Qui pisse contre le vent se rince les dents."], emphasis: 0.5 },
    { id: "montagnes", type: "speech", segments: ["En Bretagne, on n’a pas de montagnes…", "Mais on a une bonne descente…"], emphasis: 0.65 },
    { id: "lait", type: "speech", segments: ["On boira du lait quand les vaches mangeront du raisin…"], emphasis: 0.55 },
  ],
} as const satisfies Record<SpeakingVillageNpcId, readonly NpcIntervention[]>;

export type NpcDialogue = {
  npcId: SpeakingVillageNpcId;
  interventionId: string;
  type: "speech" | "song";
  segments: readonly string[];
  segment: number;
  text: string;
  emphasis: number;
  readingMs: number;
};

export function advanceVillageDialogue(id: SpeakingVillageNpcId, previous?: NpcDialogue | null, random: () => number = Math.random): NpcDialogue {
  const interventions: readonly NpcIntervention[] = VILLAGE_NPC_INTERVENTIONS[id];
  const current = previous?.npcId === id ? interventions.find(item => item.id === previous.interventionId) : undefined;
  const continuing = current && previous && previous.segment < current.segments.length - 1;
  const choices = interventions.filter(item => item.id !== current?.id);
  const roll = continuing ? 0 : random();
  const selected = continuing ? current : choices[Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * choices.length)))];
  const segment = continuing ? previous.segment + 1 : 0;
  const text = selected.segments[segment];
  return {
    npcId: id, interventionId: selected.id, type: selected.type, segments: selected.segments, segment, text,
    emphasis: Math.min(1, selected.emphasis + (segment > 0 && segment === selected.segments.length - 1 ? 0.2 : 0)),
    readingMs: Math.max(4800, 2200 + text.length * (selected.type === "song" ? 95 : 80)),
  };
}
