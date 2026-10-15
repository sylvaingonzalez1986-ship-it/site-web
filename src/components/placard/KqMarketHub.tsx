"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, FlaskConical, LayoutDashboard, ReceiptText, Settings2, TrendingUp } from "lucide-react";
import { KqCommerceDesk } from "./KqCommerceDesk";
import { KqTreasuryManagement } from "./KqTreasuryManagement";
import styles from "./KqMarketHub.module.css";

export type KqMarketSection = "demands" | "sales" | "dashboard" | "management";

const sections = [
  { code: "demands", label: "Demandes du moment", icon: TrendingUp },
  { code: "sales", label: "Vendre ma production", icon: FlaskConical },
  { code: "dashboard", label: "Mes ventes", icon: LayoutDashboard },
  { code: "management", label: "Ma boutique", icon: Settings2 },
] as const;

export function KqMarketHub({ onOpenShop, onOpenTreasury, onOpenStorage, onOpenCulture, section, onSectionChange, initialFlowerId }: {
  onOpenShop: (equipmentCode?: string) => void;
  onOpenTreasury?: () => void;
  onOpenStorage?: () => void;
  onOpenCulture?: () => void;
  section?: KqMarketSection;
  onSectionChange?: (section: KqMarketSection) => void;
  initialFlowerId?: string;
}) {
  const id = useId();
  const [localSection, setLocalSection] = useState<KqMarketSection>(initialFlowerId ? "sales" : "demands");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
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
  function select(next: KqMarketSection) {
    setLocalSection(next);
    onSectionChange?.(next);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % sections.length
      : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length
        : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(sections[next].code);
    tabs.current[next]?.focus();
  }
  return <div className={styles.hub}>
    <div className={styles.navigation}><div className={styles.tabs} role="tablist" aria-label="Mon commerce">{sections.map((item, index) => {
      const Icon = item.icon;
      const active = item.code === activeSection;
      return <button key={item.code} type="button" ref={node => { tabs.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-selected={active} aria-controls={`${id}-${item.code}-panel`} tabIndex={active ? 0 : -1} onClick={() => select(item.code)} onKeyDown={event => navigate(event, index)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></button>;
    })}</div></div>
    {activeSection !== "management" ? <div ref={commercePanel} id={`${id}-${activeSection}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeSection}-tab`}>
      <KqCommerceDesk key={initialFlowerId ?? ""} initialFlowerId={initialFlowerId} mode={activeSection} onModeChange={next => { focusDestination.current = next; select(next); }} onOpenShop={onOpenShop} onOpenTreasury={onOpenTreasury} onOpenStorage={onOpenStorage} onOpenCulture={onOpenCulture} onOpenBusiness={() => { focusDestination.current = "management"; select("management"); }} />
    </div> : <div id={`${id}-management-panel`} role="tabpanel" aria-labelledby={`${id}-management-tab`}>
      <main className={styles.management}>
        <h1 className="sr-only" ref={managementHeading} tabIndex={-1}>Ma boutique</h1>
        <KqTreasuryManagement onOpenShop={onOpenShop} section="management" onPrepareStock={() => { focusDestination.current = "sales"; select("sales"); }} onViewSales={() => { focusDestination.current = "dashboard"; select("dashboard"); }} />
        <Link className={styles.accounting} href="/arene/placard?view=treasury&pole=accounting" prefetch={false} onClick={event => { if (onOpenTreasury) { event.preventDefault(); onOpenTreasury(); } }}><ReceiptText size={19} aria-hidden="true" /><span>Mes factures<small>Montants à régler et prochaines échéances dans Finances.</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
      </main>
    </div>}
  </div>;
}
