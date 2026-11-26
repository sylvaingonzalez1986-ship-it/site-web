"use client";

import { Check, LockKeyhole, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "@/components/navigation/NavigationLink";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import { navigateWithDraftGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { ArenaLearningLauncher } from "../contest/ArenaLearningLauncher";
import { KqPrintedArt } from "./KqPrintedArt";
import styles from "./PlacardPlayerShell.module.css";

const destinations = {
  hub: { label: "Mon quartier", short: "Quartier", art: "quarter", building: null },
  game: { label: "Culture", short: "Culture", art: "culture", building: "warehouse" },
  harvests: { label: "Mes récoltes", short: "Récoltes", art: "harvest", building: "warehouse" },
  workshop: { label: "Entrepôt", short: "Entrepôt", art: "warehouse", building: "warehouse" },
  market: { label: "Commerce", short: "Commerce", art: "commerce", building: "market" },
  treasury: { label: "Banque", short: "Banque", art: "accounts", building: "bank" },
  staff: { label: "Personnel", short: "Personnel", art: "staff", building: "office" },
  social: { label: "Réseaux", short: "Réseaux", art: "social", building: "market" },
  missions: { label: "Missions", short: "Missions", art: "missions", building: "missions" },
  school: { label: "QuizzShow", short: "QuizzShow", art: "school", building: "school" },
  shop: { label: "Maison des cartes", short: "Cartes", art: "card-shop", building: "shop" },
} as const;
type DestinationKey = keyof typeof destinations;
export type PlacardNavKey = DestinationKey | "collection";

const activityGroups = [
  { label: "Produire et vendre", keys: ["game", "harvests", "workshop", "market"] },
  { label: "Gérer ma partie", keys: ["treasury", "staff", "social", "missions"] },
  { label: "Apprendre et jouer", keys: ["school", "shop"] },
] as const;
const mobileKeys = ["hub", "game", "harvests", "market"] as const;
const arenaHref = "/arene";

export function KqPlacardNavigation({ active, locationLabel, onNavigate, onHighlight, unavailable, localNavigation = false, showLearning = true, drawerOnly = false, contextAction }: {
  active: PlacardNavKey;
  locationLabel?: string;
  onNavigate: (key: PlacardNavKey) => void;
  onHighlight: (building: string | null) => void;
  unavailable?: Partial<Record<PlacardNavKey, string>>;
  localNavigation?: boolean;
  showLearning?: boolean;
  drawerOnly?: boolean;
  contextAction?: ReactNode;
}) {
  const router = useRouter();
  const drawerId = useId();
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const currentKey = active === "collection" ? "shop" : active;
  const currentLabel = locationLabel ?? destinations[currentKey].short;
  const history = useOverlayHistory(open, () => {
    drawer.current?.close();
    setOpen(false);
    onHighlight(null);
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  });
  const closeMenu = history.close;
  useBodyScrollLock(open);
  useEffect(() => {
    if (drawerOnly) return;
    const media = window.matchMedia("(min-width: 1001px)");
    const closeOnDesktop = () => { if (media.matches && drawer.current?.open) closeMenu(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [closeMenu, drawerOnly]);

  function navigate(key: DestinationKey) {
    if (unavailable?.[key]) return;
    if (open && localNavigation) {
      // Moving within a lesson keeps its containing dialog and its history entry.
      history.close();
      onNavigate(key);
    } else if (open) history.navigate(() => onNavigate(key));
    else onNavigate(key);
  }

  function arenaLink(compact = false) {
    return <Link href={arenaHref} prefetch={false} className={styles.arenaReturn} data-compact={compact || undefined} aria-label="Retour à l’Arène" onNavigate={event => {
      event.preventDefault();
      const leave = () => navigateWithDraftGuard(() => navigateAfterOverlays(() => router.push(arenaHref)));
      if (open && !localNavigation) history.navigate(leave);
      else leave();
    }}>
      <KqPrintedArt kind="arena" variant="menu" className={styles.commandArt} />
      {compact ? <><span className={styles.fullReturn}>Retour à l’Arène</span><span className={styles.shortReturn}>Arène</span></> : <span>Retour à l’Arène</span>}
    </Link>;
  }

  function menuTrigger(quick = false) {
    return <button type="button" className={styles.menuTrigger} ref={trigger} aria-haspopup="dialog" aria-label={quick ? "Plus d’activités" : "Ouvrir le menu du quartier"} aria-describedby={`${drawerId}-trigger-location`} aria-expanded={open} aria-controls={drawerId}
      onClick={() => { drawer.current?.showModal(); setOpen(true); }}>
      <KqPrintedArt kind="menu" variant="menu" className={styles.commandArt} />
      {quick ? <span>Plus</span> : <span className={styles.triggerLabel}>Menu<small>{currentLabel}</small></span>}
      <span id={`${drawerId}-trigger-location`} hidden>Rubrique actuelle · {currentLabel}</span>
    </button>;
  }

  function destination(key: DestinationKey, quick = false) {
    const item = destinations[key];
    const reason = unavailable?.[key];
    const current = currentKey === key;
    return <button type="button" key={key} className={styles.navDestination} data-placard-nav={key}
      aria-current={current ? "page" : undefined} disabled={!!reason} title={reason}
      aria-label={reason ? `${item.label} · ${reason}` : undefined} data-placard-unavailable={reason ? true : undefined}
      onClick={() => navigate(key)} onMouseEnter={() => onHighlight(item.building)} onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(item.building)} onBlur={() => onHighlight(null)}>
      <KqPrintedArt kind={item.art} variant="menu" className={styles.navArt} />
      <span className={styles.navLabel}>{quick ? item.short : item.label}</span>
      {current ? <Check className={styles.navState} size={14} strokeWidth={3} aria-hidden="true" />
        : reason ? <LockKeyhole className={styles.navState} size={12} aria-hidden="true" /> : null}
    </button>;
  }

  const directory = (mobile = false) => <div className={styles.directoryBody}>
    <nav aria-label={mobile ? "Toutes les activités de Kanab Quest" : "Navigation de Kanab Quest"}>
      {destination("hub")}
      {activityGroups.map(group => <div className={styles.navGroup} role="group" aria-label={group.label} key={group.label}>
        <p className={styles.navGroupLabel}>{group.label}</p>
        {group.keys.map(key => destination(key))}
      </div>)}
    </nav>
    {unavailable && [...new Set(Object.values(unavailable))].map(reason => <p key={reason} className={styles.availabilityNote}><LockKeyhole size={13} aria-hidden="true" />{reason}</p>)}
    {!localNavigation && showLearning && <div className={styles.learningEntry} data-placard-learning-entry><ArenaLearningLauncher className={styles.learningButton} /></div>}
  </div>;

  return <>
    {drawerOnly ? <>{menuTrigger()}{contextAction}{arenaLink(true)}</> : <>
      <aside className={styles.sidebar}>
        <div className={styles.drawerHeader}><h2>Destinations</h2></div>
        {directory()}
        <div className={styles.navFooter}>{arenaLink()}</div>
      </aside>
      <nav className={styles.mobileNav} aria-label="Accès rapides de Kanab Quest">
        {mobileKeys.map(key => destination(key, true))}{menuTrigger(true)}{arenaLink(true)}
      </nav>
    </>}
    <dialog ref={drawer} id={drawerId} className={styles.navDrawer} data-drawer-only={drawerOnly || undefined} aria-label="Menu de Kanab Quest" aria-describedby={locationLabel ? `${drawerId}-location` : undefined}
      onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
      onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}
      onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className={styles.drawerSheet}>
        <header className={styles.drawerHeader}>
          <div>
            <h2>Destinations</h2>
            {locationLabel ? <p id={`${drawerId}-location`} className={styles.drawerLocation}>Rubrique actuelle · {locationLabel}</p> : null}
          </div>
          <button className={styles.drawerClose} type="button" aria-label="Fermer le menu" onClick={closeMenu}><X size={21} aria-hidden="true" /></button>
        </header>
        {directory(true)}
        <div className={styles.navFooter}>{arenaLink()}</div>
      </div>
    </dialog>
  </>;
}
