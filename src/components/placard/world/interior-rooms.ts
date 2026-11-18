import { getKqWarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import type { KqWarehouseViewSnapshot } from "../KqWarehouse";
import type { VillageBuildingKind } from "./village-buildings";
import type { InteriorObject, InteriorRoom } from "./interior-types";
import { VILLAGE_PLACES } from "./village-layout";

const obj = (id: string, kind: InteriorObject["kind"], label: string, x: number, z: number, width: number, depth: number, query: string, detail?: string): InteriorObject => ({
  id, kind, label, x, z, width, depth, rotation: 0, href: `/arene/placard?${query}`, detail,
});

const furniture: Record<Exclude<VillageBuildingKind, "warehouse">, InteriorObject[]> = {
  bank: [obj("accounts", "desk", "Ma comptabilité", -3, -1, 2, 1.2, "view=treasury&pole=accounting", "Factures et comptes"), obj("bank", "safe", "Ouvrir la banque", 2.5, -2.8, 2, 1.6, "view=treasury&pole=bank", "Épargne et financement")],
  office: [obj("team", "desk", "Gérer mon équipe", -2.5, -1, 2.2, 1.3, "view=staff", "Journée de travail, personnel et recrutements"), obj("register", "bookshelf", "Consulter le registre", 3, -3, 1.8, .7, "view=staff")],
  market: [obj("sales", "counter", "Préparer mes ventes", -3.3, -1.6, 2.5, 1.1, "view=market&section=sales", "Formats, prix et débouchés"), obj("stock", "storage", "Mon stock en vente", 3.1, -2, 1.8, 1.1, "view=market&section=dashboard", "Paquets, annonces et commandes"), obj("business", "desk", "Développer mon commerce", -3.4, 1.4, 2, 1, "view=market&section=management"), obj("communication", "board", "Communiquer", 2.5, -3.6, 2.4, .4, "view=social")],
  missions: [obj("missions", "board", "Mes missions", 0, -2, 3.2, .65, "view=missions", "Défis, objectifs et récompenses")],
  arena: [obj("jury", "podium", "Jury & duels", 0, -2.3, 3.6, 1.5, "view=arena", "Présenter mes Fleurs et participer aux duels")],
  collection: [obj("quiz", "podium", "Jouer à QuizzShow", 0, -2.4, 3.6, 1.3, "view=school"), obj("library", "bookshelf", "Lire l’encyclopédie", -3.8, -.7, 1.4, .65, "view=school&section=learn", "Les connaissances et leurs sources")],
  shop: [obj("packs", "counter", "Mes packs", -2.8, -1.5, 2.5, 1.2, "view=shop"), obj("collection", "cards", "Ma collection", 2.8, -1.8, 2.2, 1.2, "view=shop&tab=collection", "Cartes, album et Buddies")],
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
    const front = workArea.depth / 2 + 1.25;
    objects.push(obj("warehouse-plan", "desk", "Équipements et réserve", -width / 2 + 1.8, front, 2, .85, "view=workshop", "Inventaire, options, Buddies et retrait des zones"),
      obj("workshop", "workbench", "Ouvrir l’Atelier", width / 2 - 1.8, front, 2, .9, "view=workshop&section=processing", "Trim, machines et transformation"),
      obj("harvests", "board", "Mes récoltes", -width / 2 + .5, -workArea.depth / 2 - .6, .7, .35, "view=harvests", "Stockage, affinage et jury"));
  } else {
    objects = furniture[id].map(object => ({ ...object }));
    objects.push({ id: "host", kind: "character", label: "Accueil", x: 3.7, z: 1.5, width: .65, depth: .65, rotation: 0, href: objects[0].href, detail: "Retrouver les activités de ce lieu" });
  }
  objects.push({ id: "exit", kind: "exit", label: "Sortir au village", x: 0, z: depth / 2 - .3, width: 1.7, depth: .3, rotation: 0, solid: false });
  return { id, name, width, depth, height: id === "warehouse" ? 4.6 : 4, spawn: [0, depth / 2 - 1.2], objects, workArea };
}
