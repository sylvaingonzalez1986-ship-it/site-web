"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, FlaskConical, LayoutDashboard, Settings2, ShoppingBag, TrendingUp } from "lucide-react";
import { KqCommerceDesk } from "./KqCommerceDesk";
import { KqTreasuryManagement } from "./KqTreasuryManagement";
import { KqPrintedArt } from "./KqPrintedArt";
import type { KqCommerceReceipt } from "@/lib/kanab-quest-commerce";
import styles from "./KqMarketHub.module.css";

export type KqMarketSection = "overview" | "demands" | "sales" | "dashboard" | "management";

const sections = [
  { code: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { code: "demands", label: "Demandes clients", icon: TrendingUp },
  { code: "sales", label: "Vendre ma production", icon: FlaskConical },
  { code: "dashboard", label: "Mes ventes", icon: ShoppingBag },
  { code: "management", label: "Développer ma boutique", icon: Settings2 },
] as const;

const sidebarQuery = "(min-width: 981px)";
function subscribeSidebar(listener: () => void) {
  const query = window.matchMedia(sidebarQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const getSidebarLayout = () => window.matchMedia(sidebarQuery).matches;
const getServerSidebarLayout = () => false;

export function KqMarketHub({ onOpenShop, onOpenTreasury, onOpenStorage, onOpenCulture, section, onSectionChange, initialFlowerId, initialReceipt }: {
  onOpenShop: (equipmentCode?: string) => void;
  onOpenTreasury?: () => void;
  onOpenStorage?: () => void;
  onOpenCulture?: () => void;
  section?: KqMarketSection;
  onSectionChange?: (section: KqMarketSection) => void;
  initialFlowerId?: string;
  initialReceipt?: KqCommerceReceipt;
}) {
  const id = useId();
  const [localSection, setLocalSection] = useState<KqMarketSection>(initialFlowerId ? "sales" : "overview");
  const [managementDestination, setManagementDestination] = useState<"activity" | "merch">("activity");
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useSyncExternalStore(subscribeSidebar, getSidebarLayout, getServerSidebarLayout);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const managementHeading = useRef<HTMLHeadingElement>(null);
  const commercePanel = useRef<HTMLDivElement>(null);
  const focusDestination = useRef<KqMarketSection | null>(null);
  const activeSection = section ?? localSection;
  useEffect(() => {
    if (activeSection === focusDestination.current) {
      focusDestination.current = null;
      // A request can target the packet register directly. Keep the desk's
      // precise destination instead of moving focus back to the page heading.
      if (commercePanel.current?.contains(document.activeElement) && document.activeElement?.hasAttribute("data-online-listings-heading")) return;
      const target = activeSection === "management" ? managementHeading.current : commercePanel.current?.querySelector<HTMLHeadingElement>("[data-commerce-view-heading]");
      target?.focus();
    }
  }, [activeSection]);
  function select(next: KqMarketSection, destination: "activity" | "merch" = "activity") {
    if (next === "management") setManagementDestination(destination);
    setLocalSection(next);
    onSectionChange?.(next);
  }
  function selectTab(next: KqMarketSection) {
    if (!sidebar) {
      setMenuOpen(false);
      if (next === activeSection) menuToggle.current?.focus();
      else focusDestination.current = next;
    }
    select(next);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" || (sidebar && event.key === "ArrowDown") ? (index + 1) % sections.length
      : event.key === "ArrowLeft" || (sidebar && event.key === "ArrowUp") ? (index + sections.length - 1) % sections.length
        : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(sections[next].code);
    tabs.current[next]?.focus({ preventScroll: true });
    tabs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  return <div className={styles.hub}>
    <div className={styles.workspace}>
    <div className={styles.navigation}>
      <div className={styles.navigationHeading}>
        <div className={styles.identity}><KqPrintedArt kind="commerce" className={styles.shopMark} /><span><strong>Ma boutique</strong><small>{sidebar ? "Mon espace commerce" : sections.find(item => item.code === activeSection)?.label}</small></span></div>
        <button type="button" ref={menuToggle} className={styles.menuToggle} hidden={sidebar} aria-expanded={menuOpen} aria-controls={`${id}-navigation`} onClick={() => setMenuOpen(open => !open)}>Rubriques<ChevronDown size={16} aria-hidden="true" /></button>
      </div>
      <div id={`${id}-navigation`} className={styles.tabs} hidden={!sidebar && !menuOpen} role="tablist" aria-label="Ma boutique" aria-orientation={sidebar ? "vertical" : "horizontal"} onKeyDown={event => { if (!sidebar && event.key === "Escape") { event.preventDefault(); setMenuOpen(false); menuToggle.current?.focus(); } }}>{sections.map((item, index) => {
      const Icon = item.icon;
      const active = item.code === activeSection;
      return <button key={item.code} type="button" ref={node => { tabs.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-selected={active} aria-controls={`${id}-${item.code}-panel`} tabIndex={active ? 0 : -1} onClick={() => selectTab(item.code)} onKeyDown={event => navigate(event, index)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></button>;
    })}</div></div>
    {activeSection !== "management" ? <div className={styles.content} ref={commercePanel} id={`${id}-${activeSection}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeSection}-tab`}>
      {activeSection !== "overview" ? <button type="button" className={styles.back} onClick={() => { focusDestination.current = "overview"; select("overview"); }}><ArrowLeft size={16} aria-hidden="true" />Vue d’ensemble</button> : null}
      <KqCommerceDesk key={initialFlowerId ?? ""} initialFlowerId={initialFlowerId} initialReceipt={initialReceipt} mode={activeSection} onModeChange={next => { focusDestination.current = next; select(next); }} onOpenShop={onOpenShop} onOpenTreasury={onOpenTreasury} onOpenStorage={onOpenStorage} onOpenCulture={onOpenCulture} onOpenBusiness={() => { focusDestination.current = "management"; select("management"); }} onOpenMerch={() => { focusDestination.current = "management"; select("management", "merch"); }} />
    </div> : <div className={styles.content} id={`${id}-management-panel`} role="tabpanel" aria-labelledby={`${id}-management-tab`}>
      <main className={styles.management}>
        <h1 className="sr-only" ref={managementHeading} tabIndex={-1}>Développer ma boutique</h1>
        <button type="button" className={styles.back} onClick={() => { focusDestination.current = "overview"; select("overview"); }}><ArrowLeft size={16} aria-hidden="true" />Vue d’ensemble</button>
        <KqTreasuryManagement onOpenShop={onOpenShop} section="management" initialView={managementDestination === "merch" ? "merch" : "activity"} onPrepareStock={() => { focusDestination.current = "sales"; select("sales"); }} onViewSales={() => { focusDestination.current = "dashboard"; select("dashboard"); }} />
        <Link className={styles.accounting} href="/arene/placard?view=treasury&pole=accounting" prefetch={false} onClick={event => { if (onOpenTreasury) { event.preventDefault(); onOpenTreasury(); } }}>
          <KqPrintedArt kind="accounts" className={styles.accountingArt} />
          <span className={styles.accountingCopy}><span className={styles.accountingEyebrow}>Le comptoir des comptes</span><strong>Mes factures</strong><small>Montants à régler et prochaines échéances dans Finances.</small></span>
          <span className={styles.accountingAction}>Ouvrir le registre<ArrowRight size={19} aria-hidden="true" /></span>
        </Link>
      </main>
    </div>}
    </div>
  </div>;
}
