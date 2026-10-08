export type ArenaPlayerSummary = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  supportPackCount: number;
  buddiePackCount: number;
};

export type ArenaResumeAction = {
  id: "culture" | "market" | "jury" | "buddies" | "support";
  title: string;
  description: string;
  label: string;
  href: string;
};

export function parseArenaPlayerSummary(value: unknown): ArenaPlayerSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.activeRun !== "boolean") return null;
  for (const key of ["readyLotCount", "availableFlowerCount", "supportPackCount", "buddiePackCount"] as const) {
    if (typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0) return null;
  }
  return row as ArenaPlayerSummary;
}

export function getArenaResumeActions(summary: ArenaPlayerSummary): ArenaResumeAction[] {
  const actions: ArenaResumeAction[] = [];
  if (summary.activeRun) actions.push({ id: "culture", title: "Ta culture t’attend", description: "Ta progression est sauvegardée. Reprends ta partie là où tu l’as laissée.", label: "Reprendre ma culture", href: "/arene/placard?view=game" });
  if (summary.readyLotCount > 0) actions.push({ id: "market", title: `${summary.readyLotCount} lot${summary.readyLotCount > 1 ? "s" : ""} à vendre`, description: "Le jury a rendu son verdict. Tu peux transformer ou vendre ta récolte.", label: "Retrouver ma récolte", href: "/arene/placard?view=market" });
  if (summary.availableFlowerCount > 0) actions.push({ id: "jury", title: `${summary.availableFlowerCount} Fleur${summary.availableFlowerCount > 1 ? "s" : ""} à présenter`, description: "Ta récolte est prête à être évaluée. Retrouve les jurys et les duels.", label: "Présenter ma Fleur", href: "/arene/placard?view=arena" });
  if (summary.buddiePackCount > 0) actions.push({ id: "buddies", title: `${summary.buddiePackCount} pack${summary.buddiePackCount > 1 ? "s" : ""} Buddies à ouvrir`, description: "Tes packs t’attendent dans ta collection.", label: "Ouvrir mes packs Buddies", href: "/profil/collection" });
  if (summary.supportPackCount > 0) actions.push({ id: "support", title: `${summary.supportPackCount} pack${summary.supportPackCount > 1 ? "s" : ""} Botte du Chanvrier à ouvrir`, description: "Retrouve tes cartes de soutien à la Boutique du Placard.", label: "Ouvrir mes packs de soutien", href: "/arene/placard?view=shop" });
  if (!actions.length) actions.push({ id: "culture", title: "Ta prochaine récolte commence ici", description: "Retrouve ton placard pour préparer une nouvelle culture.", label: "Préparer ma culture", href: "/arene/placard?view=game" });
  return actions;
}
