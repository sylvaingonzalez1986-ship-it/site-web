"use client";

import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, BookOpen, CircleHelp, Landmark, Map, Menu, PackageCheck, ShoppingBag, Sprout, Store, Target, Warehouse, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import styles from "./PlacardPlayerShell.module.css";

export type PlacardNavKey = "hub" | "game" | "harvests" | "workshop" | "market" | "treasury" | "collection" | "missions" | "shop";
const primary = [
  { key: "hub", label: "Mon quartier", icon: Map, building: null },
  { key: "game", label: "Culture", icon: Sprout, building: "warehouse" },
  { key: "harvests", label: "Mes récoltes", icon: PackageCheck, building: "warehouse" },
  { key: "workshop", label: "Entrepôt", icon: Warehouse, building: "warehouse" },
  { key: "market", label: "Commerce", icon: Store, building: "market" },
] as const;
const secondary = [
  { key: "treasury", label: "Finances", icon: Landmark, building: "office" },
  { key: "collection", label: "Collections", icon: BookOpen, building: "collection" },
  { key: "missions", label: "Missions", icon: Target, building: "missions" },
  { key: "shop", label: "Boutique", icon: ShoppingBag, building: "shop" },
] as const;

export function KqPlacardNavigation({ active, onNavigate, onHighlight }: {
  active: PlacardNavKey;
  onNavigate: (key: PlacardNavKey) => void;
  onHighlight: (building: string | null) => void;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const closeOnDesktop = () => { if (media.matches) drawer.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const navigate = (key: PlacardNavKey) => {
    drawer.current?.close();
    setOpen(false);
    onHighlight(null);
    onNavigate(key);
  };
  const items = (mobile = false) => <>
    <div className={styles.navBrand}><span>Les Chanvriers Bretons</span><strong>LE PLACARD<span>.</span></strong><small>Ton quartier, tes récoltes.</small></div>
    <nav aria-label={mobile ? "Toutes les activités du Placard" : "Navigation du Placard"}>
      <div className={styles.navGroup}>{primary.map(item => <button key={item.key} type="button" data-placard-nav={item.key} aria-current={active === item.key ? "page" : undefined} onClick={() => navigate(item.key)} onMouseEnter={() => onHighlight(item.building)} onMouseLeave={() => onHighlight(null)} onFocus={() => onHighlight(item.building)} onBlur={() => onHighlight(null)}><item.icon size={19} aria-hidden="true" /><span>{item.label}</span></button>)}</div>
      <div className={styles.navGroup}><small>Pour aller plus loin</small>{secondary.map(item => <button key={item.key} type="button" data-placard-nav={item.key} aria-current={active === item.key ? "page" : undefined} onClick={() => navigate(item.key)} onMouseEnter={() => onHighlight(item.building)} onMouseLeave={() => onHighlight(null)} onFocus={() => onHighlight(item.building)} onBlur={() => onHighlight(null)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></button>)}</div>
    </nav>
    <div className={styles.navFooter}>
      <details><summary><CircleHelp size={17} aria-hidden="true" /> Comment jouer</summary><p>Cultive, présente ta récolte au jury, puis prépare sa vente. « Mes récoltes » indique à chaque fois ce que tu peux faire.</p><p>L’Entrepôt regroupe les achats et la gestion du matériel. La Boutique propose les packs de cartes ; Collections réunit tes albums.</p></details>
      <Link href="/arene"><ArrowLeft size={16} aria-hidden="true" /> Retour à l’Arène</Link>
    </div>
  </>;
  return <>
    <aside className={styles.sidebar}>{items()}</aside>
    <nav className={styles.mobileNav} aria-label="Accès rapides du Placard">
      {primary.slice(0, 3).map(item => <button key={item.key} type="button" aria-current={active === item.key ? "page" : undefined} onClick={() => navigate(item.key)}><item.icon size={21} aria-hidden="true" /><span>{item.key === "hub" ? "Quartier" : item.key === "harvests" ? "Récoltes" : item.label}</span></button>)}
      <button type="button" ref={trigger} aria-haspopup="dialog" aria-expanded={open} onClick={() => { drawer.current?.showModal(); setOpen(true); }}><Menu size={21} aria-hidden="true" /><span>Menu</span></button>
    </nav>
    <dialog ref={drawer} className={styles.navDrawer} aria-label="Menu du Placard" onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }} onClose={() => { setOpen(false); onHighlight(null); }} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
      <div className={styles.drawerBody}><button className={styles.drawerClose} type="button" aria-label="Fermer le menu" onClick={() => drawer.current?.close()}><X size={22} /></button>{items(true)}</div>
    </dialog>
  </>;
}
