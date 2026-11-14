export type KqSchoolSection = "home" | "learn" | "tournament" | "ranking";

export function resolveKqSchoolSection(section: string | null | undefined, moduleId?: string, passageId?: string): KqSchoolSection {
  if (section === "home" || section === "learn" || section === "ranking") return section;
  if (section === "tournament" || section === "quiz" || section === "workshops") return "tournament";
  if (!section && (moduleId || passageId)) return "learn";
  return "home";
}
