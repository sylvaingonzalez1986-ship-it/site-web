"use client";

import Link from "@/components/navigation/NavigationLink";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Gift, Menu, ShoppingCart, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import type { LoyaltyBadge } from "@/types/loyalty";
import styles from "./MobileNavigation.module.css";

type Props = {
  open: boolean;
  pathname: string;
  links: Array<{ href: string; label: string }>;
  onClose: () => void;
  onCart: () => void;
  totalItems: number;
  welcomePack: boolean;
  member: { name: string; badge: LoyaltyBadge } | null;
};

export function MobileNavigation({ open, pathname, links, onClose, onCart, totalItems, welcomePack, member }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    modal?.showModal();
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("popstate", onClose);
    return () => { window.removeEventListener("popstate", onClose); desktop.removeEventListener("change", closeOnDesktop); modal?.close(); previous?.focus?.({ preventScroll: true }); };
  }, [open, onClose]);

  return <dialog ref={dialog} id="mobile-nav" className={styles.menu} aria-labelledby="mobile-nav-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.rail}><span>Les Chanvriers Bretons</span><button type="button" onClick={onClose} aria-label="Fermer le menu"><X aria-hidden="true" /></button></div>
    <div className={styles.content}>
      <header className={styles.heading}><p><Menu size={14} aria-hidden="true" /> Fais comme chez toi</p><h2 id="mobile-nav-title">Où on va ?</h2><span>Du champ à la communauté.</span></header>
      <nav aria-label="Navigation principale mobile" className={styles.links}>
        {links.map((link, index) => {
          const active = pathname === link.href || (link.href !== "/" && link.href !== "/profil" && pathname.startsWith(link.href + "/"));
          const pack = welcomePack && link.href === "/profil/collection";
          return <Link key={link.href} href={link.href} onClick={onClose} aria-current={active ? "page" : undefined} className={styles.link}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span className={styles.label}>{link.label}{pack && <small><Gift size={12} aria-hidden="true" />Pack offert</small>}</span><ArrowUpRight aria-hidden="true" />
          </Link>;
        })}
      </nav>
      <footer className={styles.footer}>
        {member && <Link href="/profil?tab=fidelite" onClick={onClose} className={styles.member}>
          <LoyaltyBadgeIllustration badgeId={member.badge.id} unlocked={member.badge.unlocked} size="sm" />
          <span><small>Bienvenue {member.name}</small><strong>{member.badge.unlocked ? `Le club · ${member.badge.label}` : "Le club des Chanvriers"}</strong><em>Mes avantages fidélité</em></span><ArrowUpRight size={18} aria-hidden="true" />
        </Link>}
        <button type="button" className={styles.cart} onClick={() => { onClose(); onCart(); }}><ShoppingCart size={19} aria-hidden="true" /><span>Mon panier</span><b>{totalItems}</b></button>
        <p>Du chanvre. Des copains. Du bon sens.</p>
      </footer>
    </div>
  </dialog>;
}
