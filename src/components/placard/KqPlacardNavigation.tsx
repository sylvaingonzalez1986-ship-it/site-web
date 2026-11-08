"use client";

import { CircleHelp, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqHelpDashboard, KqHelpGrid, KqHelpSteps } from "./KqHelpDashboard";
import { ArenaLearningLauncher } from "../contest/ArenaLearningLauncher";
import styles from "./PlacardPlayerShell.module.css";

export type PlacardNavKey = "hub" | "game" | "harvests" | "workshop" | "market" | "social" | "treasury" | "staff" | "collection" | "missions" | "shop";
const primary = [
  { key: "hub", label: "Mon quartier", art: "quarter", building: null },
  { key: "game", label: "Culture", art: "culture", building: "warehouse" },
  { key: "harvests", label: "Mes récoltes", art: "harvest", building: "warehouse" },
  { key: "market", label: "Commerce", art: "commerce", building: "market" },
  { key: "workshop", label: "Entrepôt", art: "warehouse", building: "warehouse" },
] as const;
const mobilePrimary = primary.filter(({ key }) => key !== "workshop");
const secondary = [
  { key: "treasury", label: "Finances", art: "accounts", building: "bank" },
  { key: "staff", label: "Personnel", art: "staff", building: "office" },
  { key: "social", label: "Réseaux", art: "social", building: "market" },
  { key: "collection", label: "Collections", art: "collection", building: "collection" },
  { key: "missions", label: "Missions", art: "missions", building: "missions" },
  { key: "shop", label: "Packs de cartes", art: "card-shop", building: "shop" },
] as const;
const activityGroups = [
  { label: "Produire", items: primary.filter(item => item.key === "game" || item.key === "harvests" || item.key === "workshop") },
  { label: "Vendre et communiquer", items: [...primary.filter(item => item.key === "market"), ...secondary.filter(item => item.key === "social")] },
  { label: "Organiser", items: secondary.filter(item => item.key === "staff" || item.key === "treasury").toReversed() },
  { label: "Cartes et défis", items: secondary.filter(item => item.key === "collection" || item.key === "missions" || item.key === "shop") },
];

export function KqPlacardNavigation({ active, onNavigate, onHighlight, unavailable, localNavigation = false, showLearning = true }: {
  active: PlacardNavKey;
  onNavigate: (key: PlacardNavKey) => void;
  onHighlight: (building: string | null) => void;
  unavailable?: Partial<Record<PlacardNavKey, string>>;
  localNavigation?: boolean;
  showLearning?: boolean;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const history = useOverlayHistory(open, () => {
    drawer.current?.close();
    setOpen(false);
    onHighlight(null);
    if (localNavigation && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  });
  const closeMenu = history.close;
  useBodyScrollLock(open);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const closeOnDesktop = () => { if (media.matches && drawer.current?.open) closeMenu(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [closeMenu]);
  const navigate = (key: PlacardNavKey) => {
    if (unavailable?.[key]) return;
    if (open && localNavigation) {
      // Retire only the drawer entry. Full navigation also retires the story
      // underneath, which must stay open when moving within a teaching session.
      history.close();
      onNavigate(key);
    } else if (open) history.navigate(() => onNavigate(key));
    else onNavigate(key);
  };
  const availability = (key: PlacardNavKey, label: string) => {
    const reason = unavailable?.[key];
    return reason ? { disabled: true, title: reason, 'aria-label': `${label} · ${reason}`, 'data-placard-unavailable': true } : {};
  };
  const items = (mobile = false) => <>
    <div className={styles.navBrand}>
      <div className={styles.navMasthead}>
        <strong>KANAB<br />QUEST</strong>
        <KqPrintedArt kind="quarter" className={styles.brandArt} />
      </div>
    </div>
    <nav aria-label={mobile ? "Toutes les activités de Kanab Quest" : "Navigation de Kanab Quest"}>
      <div className={styles.navGroup}>
        {primary.filter(item => item.key === "hub").map(item => <button key={item.key} type="button" data-placard-nav={item.key} aria-current={active === item.key ? "page" : undefined} {...availability(item.key, item.label)} onClick={() => navigate(item.key)} onMouseEnter={() => onHighlight(item.building)} onMouseLeave={() => onHighlight(null)} onFocus={() => onHighlight(item.building)} onBlur={() => onHighlight(null)}>
          <span className={styles.navMark} aria-hidden="true"><KqPrintedArt kind={item.art} className={styles.navArt} /></span>
          <span className={styles.navLabel}>{item.label}</span>
          <span className={styles.navArrow} aria-hidden="true">›</span>
        </button>)}
      </div>
      {activityGroups.map(group => <div className={styles.navGroup} role="group" aria-label={group.label} key={group.label}>
        <p className={styles.navGroupLabel}>{group.label}</p>
        {group.items.map(item => <button key={item.key} type="button" data-placard-nav={item.key} aria-current={active === item.key ? "page" : undefined} {...availability(item.key, item.label)} onClick={() => navigate(item.key)} onMouseEnter={() => onHighlight(item.building)} onMouseLeave={() => onHighlight(null)} onFocus={() => onHighlight(item.building)} onBlur={() => onHighlight(null)}>
          <span className={styles.navMark} aria-hidden="true"><KqPrintedArt kind={item.art} className={styles.navArt} /></span>
          <span className={styles.navLabel}>{item.label}</span>
          <span className={styles.navArrow} aria-hidden="true">›</span>
        </button>)}
      </div>)}
    </nav>
    <div className={styles.navFooter}>
      {!localNavigation && showLearning ? <div className={styles.learningEntry} data-placard-learning-entry><ArenaLearningLauncher className={styles.learningButton} /></div> : null}
      <details><summary><CircleHelp size={17} aria-hidden="true" /> Comment jouer</summary><KqHelpDashboard>
        <KqHelpSteps art="culture" steps={[
          { label: "Cultive", art: "culture" },
          { label: "Mes récoltes", detail: "Retrouve ta récolte et l’action disponible.", art: "harvest" },
          { label: "Commerce", detail: "Prépare la vente.", art: "commerce" },
        ]} />
        <KqHelpGrid art="quarter" items={[
          { label: "Entrepôt", value: "Matériel", detail: "Achats et gestion.", art: "warehouse" },
          { label: "Packs de cartes", value: "Acquérir et ouvrir", art: "card-shop" },
          { label: "Collections", value: "Tes albums", art: "collection" },
          { label: "Réseaux", value: "Publications, aventures, partenariats", art: "social" },
        ]} />
      </KqHelpDashboard></details>
    </div>
  </>;
  return <>
    <aside className={styles.sidebar}>{items()}</aside>
    <nav className={styles.mobileNav} aria-label="Accès rapides de Kanab Quest">
      {mobilePrimary.map(item => <button key={item.key} type="button" aria-current={active === item.key ? "page" : undefined} {...availability(item.key, item.label)} onClick={() => navigate(item.key)}><KqPrintedArt kind={item.art} className={styles.mobileArt} /><span>{item.key === "hub" ? "Quartier" : item.key === "harvests" ? "Récoltes" : item.label}</span></button>)}
      <button type="button" ref={trigger} aria-haspopup="dialog" aria-label="Plus d’activités" aria-expanded={open} onClick={() => { drawer.current?.showModal(); setOpen(true); }}><Menu size={21} aria-hidden="true" /><span>Plus</span></button>
    </nav>
    <dialog ref={drawer} className={styles.navDrawer} aria-label="Menu de Kanab Quest" onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); event.stopPropagation(); history.close(); }} onClick={event => { if (event.target === event.currentTarget) history.close(); }}>
      <header className={styles.drawerHeader}><strong>Le guide du quartier</strong><button className={styles.drawerClose} type="button" aria-label="Fermer le menu" onClick={history.close}><X size={22} aria-hidden="true" /></button></header>
      <div className={styles.drawerBody}>{items(true)}</div>
    </dialog>
  </>;
}
