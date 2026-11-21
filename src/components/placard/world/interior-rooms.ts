import { getKqWarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_HANDLING } from "@/lib/kanab-quest-warehouse-handling";
import type { KqWarehouseViewSnapshot } from "../KqWarehouse";
import type { VillageBuildingKind } from "./village-buildings";
import type { InteriorObject, InteriorRoom } from "./interior-types";
import { VILLAGE_PLACES } from "./village-layout";

const obj = (id: string, kind: InteriorObject["kind"], label: string, x: number, z: number, width: number, depth: number, query: string, detail?: string): InteriorObject => ({
  id, kind, label, x, z, width, depth, rotation: 0, href: `/arene/placard?${query}`, detail,
});

const furniture: Record<Exclude<VillageBuildingKind, "warehouse">, InteriorObject[]> = {
  bank: [
    obj("bank", "desk", "Prêts", 1.6, .3, 3.9, 2.45, "view=treasury&pole=bank&section=loans"),
    { ...obj("savings", "safe", "Épargne", 2.83, .97, 1.12, .79, "view=treasury&pole=bank&section=savings"), elevation: 1.02 },
    { ...obj("stocks", "board", "Bourse", -.16, -4.27, 3.9, .3, "view=treasury&pole=bank&section=stocks"), elevation: 1.24 },
    obj("crypto", "desk", "Crypto", -2.89, -.55, 2.52, 1.42, "view=treasury&pole=bank&section=crypto"),
  ],
  office: [
    obj("team", "desk", "Bureau du personnel", 1.65, -1.65, 3.6, 1.35, "view=staff", "Journée de travail et suivi du personnel"),
    obj("team-register", "bookshelf", "Plan de travail", -2.85, -2.5, 2, .85, "view=staff&section=team", "Journée et affectations de l’équipe"),
    obj("recruitment", "board", "Recruter", -2.95, .8, 2.35, .55, "view=staff&section=candidates", "Consulter les candidatures"),
    obj("accounts", "desk", "Ma comptabilité", 3.34, 1.57, 2.35, 1.95, "view=staff&section=accounting", "Factures et comptes"),
  ],
  market: [obj("sales", "counter", "Préparer mes ventes", -3.1, -1.6, 2.8, 1.15, "view=market&section=sales", "Formats, prix et débouchés"), obj("stock", "storage", "Mon stock en vente", 2.7, -1.3, 2.2, 1.15, "view=market&section=dashboard", "Paquets, annonces et commandes"), obj("business", "desk", "Développer mon commerce", -2.9, 1.5, 2.1, 1, "view=market&section=management"), obj("communication", "board", "Communiquer", 2.7, -3.45, 2.3, .45, "view=social")],
  missions: [
    obj("missions", "board", "Mes défis", -2.2, -2.1, 4, .65, "view=missions", "Objectifs et récompenses"),
    obj("community", "board", "Missions de la communauté", 2.6, -.85, 3.35, .65, "view=missions&section=community", "Retrouver les missions collectives"),
  ],
  arena: [obj("jury", "podium", "Jury & duels", -.65, -1.45, 3.4, 1.45, "view=arena", "Présenter mes Fleurs et participer aux duels"), obj("arena-storage", "storage", "Préparer mes Fleurs", 3.65, -.9, 1.6, 1.05, "view=harvests&section=storage", "Vérifier l’affinage des récoltes")],
  collection: [obj("quiz", "podium", "Jouer à QuizzShow", 0, -2.4, 3.6, 1.3, "view=school"), obj("library", "bookshelf", "Lire l’encyclopédie", -3.8, -.7, 1.4, .65, "view=school&section=learn", "Les connaissances et leurs sources")],
  shop: [obj("packs", "cards", "Packs Botte du Chanvrier", -2.65, -2.15, 2.45, 1.25, "view=shop"), obj("collection", "cards", "Ma collection", -.65, 1.2, 2.5, 1.65, "view=shop&tab=collection", "Cartes et albums"), obj("buddies", "cards", "Packs Buddies", 2.75, -2.15, 2.3, 1.25, "view=shop&section=buddies")],
};

export function createInteriorRoom(id: VillageBuildingKind, snapshot: KqWarehouseViewSnapshot | null = null): InteriorRoom {
  const name = VILLAGE_PLACES.find(place => place.id === id)!.name;
  let width = 11, depth = 9;
  let objects: InteriorObject[];
  let workArea: InteriorRoom["workArea"];
  if (id === "warehouse") {
    // Unknown server data is represented by a loading state, never by invented equipment.
    const layout = snapshot ? getKqWarehouseSpatialLayout(snapshot.state) : null;
    workArea = { width: layout?.width ?? 10, depth: layout?.depth ?? 10 };
    width = workArea.width + 3; depth = workArea.depth + 6;
    objects = (layout?.items ?? []).map(item => {
      const culture = snapshot?.state.zones.find(zone => zone.id === item.id);
      const run = snapshot?.activeRuns?.find(run => run.zoneId === item.id);
      const reserved = snapshot?.productionReservation?.zoneId === item.id;
      const deviceCode = item.deviceCode ?? culture?.lightingCode;
      const device = getKqWarehouseDevice(deviceCode ?? "");
      return { ...item, deviceCode, label: item.name, solid: true, movable: true, active: !!run || reserved,
        href: run ? `/arene/placard?view=game&zone=${encodeURIComponent(item.id)}&run=${encodeURIComponent(run.runId)}` : item.href,
        detail: item.kind === "partition" ? `${Math.max(item.width, item.depth)} m · Paroi de séparation` : [device?.name, `${item.width * item.depth} m²`, run ? "Culture en cours" : reserved ? "Production commerciale" : ""].filter(Boolean).join(" · ") };
    });
    for (const item of snapshot?.state.handlingPlacements ?? []) {
      objects.push({ ...obj(item.code, "handling", KQ_WAREHOUSE_HANDLING[item.code].name,
        item.x + .5 - workArea.width / 2, item.y + .5 - workArea.depth / 2, 1, 1, "view=workshop&catalog=equipment&equipment=" + item.code),
        solid: true, deviceCode: item.code });
    }
    const front = workArea.depth / 2 + 1.25;
    objects.push(obj("warehouse-plan", "desk", "Équipements et réserve", -width / 2 + 1.8, front, 2, .85, "view=workshop", "Inventaire, options, Buddies et retrait des zones"),
      obj("workshop", "workbench", "Ouvrir l’Atelier", width / 2 - 1.8, front, 2, .9, "view=workshop&section=processing", "Trim, machines et transformation"),
      obj("harvests", "board", "Mes récoltes", -width / 2 + .5, -workArea.depth / 2 - .6, .7, .35, "view=harvests", "Stockage, affinage et jury"));
  } else {
    objects = furniture[id].map(object => ({ ...object }));
    if (id === "collection") objects.push({ id: "host", kind: "character", label: "Accueil", x: 3.7, z: 1.5, width: .65, depth: .65, rotation: 0, href: objects[0].href, detail: "Retrouver les activités de ce lieu" });
  }
  objects.push({ id: "exit", kind: "exit", label: "Sortir au village", x: 0, z: depth / 2 - .3, width: 1.7, depth: .3, rotation: 0, solid: false });
  return { id, name, width, depth, height: id === "warehouse" ? 4.6 : 4, spawn: [0, depth / 2 - 1.2], objects, workArea };
}
