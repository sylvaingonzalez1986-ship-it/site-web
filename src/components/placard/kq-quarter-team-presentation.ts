import { KQ_PROSPECTING_DEPARTMENTS } from "@/lib/kanab-quest-prospecting";
import { KQ_STAFF_CITIES, KQ_STAFF_SKILLS } from "@/lib/kanab-quest-staff";
import { KQ_STAFF_PRODUCTION_STEPS } from "@/lib/kanab-quest-staff-weekly";
import type { KqStaffSnapshot, KqStaffTask, KqStaffTaskKind, KqTeamAssignment } from "@/lib/kanab-quest-staff-types";

export const teamActivityNames: Record<KqStaffTaskKind, string> = {
  ...KQ_STAFF_SKILLS, training: "Formation", trim: "Trim", countryside: "Tournée des campagnes", production: "Production autonome",
};
export const teamHours = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
export const teamTime = (date: string) => new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export function assignmentKind(command: KqTeamAssignment): KqStaffTaskKind {
  if (command.action === "assign-production") return "production";
  if (command.action === "trim") return "trim";
  if (command.action === "train") return "training";
  return command.kind;
}

type TaskIdentity = Pick<KqStaffTask, "kind"> & Partial<Pick<KqStaffTask, "targetId" | "cityId" | "department" | "skill" | "trimMode" | "productionStep">>
  & { cultureShift?: boolean; processingShift?: boolean };

export function teamTaskText(task: TaskIdentity, snapshot: KqStaffSnapshot) {
  const name = task.cultureShift ? "Réserve de culture" : task.processingShift ? "Réserve de transformation" : teamActivityNames[task.kind];
  let place: string;
  switch (task.kind) {
    case "culture":
      place = task.targetId ? (snapshot.context.activeRuns.find(run => run.id === task.targetId)?.name ?? "Culture affectée · Entrepôt") : "Toutes les cultures · Entrepôt";
      break;
    case "processing":
      place = task.targetId ? (snapshot.context.processingBatches.find(lot => lot.flowerId === task.targetId)?.name ?? "Lot affecté · Atelier") : "Toutes les transformations · Atelier";
      break;
    case "trim": {
      const lot = snapshot.context.trimLots?.find(item => item.flowerId === task.targetId);
      place = `${lot?.name ?? "Atelier"} · ${task.trimMode === "machine" ? "Machine" : "À la main"}`;
      break;
    }
    case "training": place = `Formation · ${task.skill ? KQ_STAFF_SKILLS[task.skill] : "Personnel"}`; break;
    case "production": place = `Ferme · ${KQ_STAFF_PRODUCTION_STEPS[task.productionStep ?? "auto"]}`; break;
    case "sales": place = KQ_STAFF_CITIES.find(city => city.id === task.cityId)?.name ?? "Boutiques"; break;
    case "countryside": place = KQ_PROSPECTING_DEPARTMENTS.find(dept => dept.code === task.department)?.name ?? "Boutiques rurales"; break;
    case "communication": place = "Réseaux sociaux de la ferme"; break;
    case "administration": place = "Bureau des fournisseurs"; break;
  }
  return { name, place };
}

export function teamAssignmentText(command: KqTeamAssignment, snapshot: KqStaffSnapshot) {
  return teamTaskText({ ...command, kind: assignmentKind(command),
    ...(command.action === "trim" ? { targetId: command.flowerId, trimMode: command.mode } : {}),
    ...(command.action === "assign" && command.kind === "culture" && snapshot.context.cultureWorkVersion === 1 ? { cultureShift: true } : {}),
    ...(command.action === "assign" && command.kind === "processing" && snapshot.context.processingWorkVersion === 1 ? { processingShift: true } : {}),
  }, snapshot);
}
