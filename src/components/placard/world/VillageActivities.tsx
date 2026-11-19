"use client";

import Link from "next/link";
import { buildingRoomHref, isIsometricBuilding } from "@/lib/kanab-quest-world-mode";
import { useEffect, type RefObject } from "react";
import { ArrowRight, Bitcoin, Boxes, ChartCandlestick, DoorOpen, Landmark, Megaphone, PackageCheck, PiggyBank, ShoppingBag, Sprout, Store, Swords, Target, UsersRound, Wallet, Warehouse, X, type LucideIcon } from "lucide-react";
import type { VillageBuildingKind } from "./village-buildings";
import { villageBuildingStatus, type VillageSnapshot } from "./useVillageActivity";
import styles from "./VillagePrototype.module.css";

type Activity = { label: string; detail: string; href: string; Icon: LucideIcon };

// Same activities and section parameters as KqPlacardMap / PlacardPlayerShell.
// Unknown player state keeps neutral wording until the shared snapshot arrives.
const ACTIVITIES: Record<VillageBuildingKind, readonly Activity[]> = {
  warehouse: [
    { label: "Entrer", detail: "", href: "/arene/placard?view=workshop", Icon: DoorOpen },
    { label: "Ma culture", detail: "Cultiver et récolter", href: "/arene/placard?view=game", Icon: Sprout },
    { label: "Ouvrir l’Atelier", detail: "Trim et machines", href: "/arene/placard?view=workshop&section=processing", Icon: Warehouse },
    { label: "Mes récoltes", detail: "Stockage, affinage et jury", href: "/arene/placard?view=harvests", Icon: PackageCheck },
  ],
  market: [
    { label: "Préparer mes ventes", detail: "Formats, prix et débouchés", href: "/arene/placard?view=market&section=sales", Icon: Store },
    { label: "Mon stock en vente", detail: "Paquets, annonces et commandes", href: "/arene/placard?view=market&section=dashboard", Icon: PackageCheck },
    { label: "Développer mon commerce", detail: "Boutique en ligne, marque et audience", href: "/arene/placard?view=market&section=management", Icon: Target },
    { label: "Communiquer", detail: "Réseaux sociaux et partenariats", href: "/arene/placard?view=social", Icon: Megaphone },
  ],
  bank: [
    { label: "Prêts", detail: "Parler au banquier", href: "/arene/placard?view=treasury&pole=bank&section=loans", Icon: Landmark },
    { label: "Épargne", detail: "", href: "/arene/placard?view=treasury&pole=bank&section=savings", Icon: PiggyBank },
    { label: "Bourse", detail: "", href: "/arene/placard?view=treasury&pole=bank&section=stocks", Icon: ChartCandlestick },
    { label: "Crypto", detail: "", href: "/arene/placard?view=treasury&pole=bank&section=crypto", Icon: Bitcoin },
  ],
  office: [
    { label: "Gérer mon équipe", detail: "Ma journée, personnel et recrutements", href: "/arene/placard?view=staff", Icon: UsersRound },
    { label: "Ma comptabilité", detail: "Factures et comptes", href: "/arene/placard?view=staff&section=accounting", Icon: Wallet },
  ],
  shop: [
    { label: "Mes packs", detail: "Packs et Maison des cartes", href: "/arene/placard?view=shop", Icon: ShoppingBag },
    { label: "Ma collection", detail: "Parcourir mon album", href: "/arene/placard?view=shop&tab=collection", Icon: Boxes },
  ],
  arena: [{ label: "Jury & duels", detail: "Présenter mes Fleurs et participer aux duels", href: "/arene/placard?view=arena", Icon: Swords }],
  missions: [{ label: "Mes missions", detail: "Défis et récompenses", href: "/arene/placard?view=missions", Icon: Target }],
  collection: [{ label: "Entrer", detail: "", href: "/arene/placard?view=school", Icon: DoorOpen }],
};

export function VillageActivities({ id, name, nodeRef, fallback, onClose, snapshot, onNavigate }: {
  id: VillageBuildingKind;
  name: string;
  nodeRef: RefObject<HTMLElement | null>;
  fallback: boolean;
  onClose: () => void;
  snapshot: VillageSnapshot | null;
  onNavigate?: (href: string) => void;
}) {
  useEffect(() => { nodeRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true }); }, [id, nodeRef]);
  const activities = isIsometricBuilding(id)
    ? [{ label: "Entrer", detail: "", href: buildingRoomHref(id), Icon: DoorOpen }, ...ACTIVITIES[id]]
    : ACTIVITIES[id];
  return <aside ref={nodeRef} id="village-building-activities" className={styles.bubble} data-building={id} data-fallback={fallback || undefined}
    aria-label={`Lieu sélectionné : ${name}`}>
    <div className={styles.bubbleSheet}>
      <div className={styles.detailHeading}>
        <h2>{name}</h2>
        <button type="button" className={styles.iconControl} aria-label="Fermer les activités du bâtiment" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      {villageBuildingStatus(id, snapshot) ? <p className={styles.activityStatus}>{villageBuildingStatus(id, snapshot)}</p> : null}
      <nav className={styles.activities} aria-label={`Activités · ${name}`}>
        {activities.map(({ label, detail, href, Icon }) => <Link className={styles.activity} href={href} key={href} prefetch={false} onClick={event => {
          if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); onNavigate(href);
        }}>
          <Icon size={21} aria-hidden="true" /><span>{href === "/arene/placard?view=game" && snapshot ? snapshot.activeRun ? "Reprendre ma culture" : "Commencer une culture" : label}{detail && <small>{href.endsWith("section=sales") && snapshot?.readyLotCount ? `${snapshot.readyLotCount} lot${snapshot.readyLotCount > 1 ? "s" : ""} à valoriser` : detail}</small>}</span><ArrowRight size={16} aria-hidden="true" />
        </Link>)}
      </nav>
    </div>
  </aside>;
}
