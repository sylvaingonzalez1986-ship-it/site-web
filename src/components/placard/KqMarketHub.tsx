"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, FlaskConical, LayoutDashboard, ReceiptText, Settings2 } from "lucide-react";
import { KqCommerceDesk } from "./KqCommerceDesk";
import { KqTreasuryManagement } from "./KqTreasuryManagement";
import styles from "./KqMarketHub.module.css";

export type KqMarketSection = "sales" | "dashboard" | "management";

const sections = [
  { code: "sales", label: "Transformer et vendre", description: "Lots, shops et ventes en ligne", icon: FlaskConical },
  { code: "dashboard", label: "Tableau de bord", description: "Paquets, ventes et annonces en ligne", icon: LayoutDashboard },
  { code: "management", label: "Gérer mon activité", description: "Ma boutique, ma marque et mon audience", icon: Settings2 },
] as const;

export function KqMarketHub({ onOpenShop, onOpenTreasury, onOpenStorage, section, onSectionChange }: {
  onOpenShop: (equipmentCode?: string) => void;
  onOpenTreasury?: () => void;
  onOpenStorage?: () => void;
  section?: KqMarketSection;
  onSectionChange?: (section: KqMarketSection) => void;
}) {
  const id = useId();
  const [localSection, setLocalSection] = useState<KqMarketSection>("sales");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const managementHeading = useRef<HTMLHeadingElement>(null);
  const commercePanel = useRef<HTMLDivElement>(null);
  const focusDestination = useRef<KqMarketSection | null>(null);
  const activeSection = section ?? localSection;
  useEffect(() => {
    if (activeSection === focusDestination.current) {
      focusDestination.current = null;
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
    <div className={styles.navigation}><div className={styles.tabs} role="tablist" aria-label="Les espaces du Marché">{sections.map((item, index) => {
      const Icon = item.icon;
      const active = item.code === activeSection;
      return <button key={item.code} type="button" ref={node => { tabs.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-selected={active} aria-controls={`${id}-${item.code}-panel`} tabIndex={active ? 0 : -1} onClick={() => select(item.code)} onKeyDown={event => navigate(event, index)}><Icon size={23} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight className={styles.arrow} size={18} aria-hidden="true" /></button>;
    })}</div></div>
    {activeSection !== "management" ? <div ref={commercePanel} id={`${id}-${activeSection}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeSection}-tab`}>
      <KqCommerceDesk key={activeSection} mode={activeSection} onModeChange={next => { focusDestination.current = next; select(next); }} onOpenShop={onOpenShop} onOpenTreasury={onOpenTreasury} onOpenStorage={onOpenStorage} onOpenBusiness={() => { focusDestination.current = "management"; select("management"); }} />
    </div> : <div id={`${id}-management-panel`} role="tabpanel" aria-labelledby={`${id}-management-tab`}>
      <main className={styles.management}>
        <h1 className="sr-only" ref={managementHeading} tabIndex={-1}>Gérer mon activité</h1>
        <KqTreasuryManagement onOpenShop={onOpenShop} section="management" />
        <Link className={styles.accounting} href="/arene/placard?view=treasury&pole=accounting" prefetch={false} onClick={event => { if (onOpenTreasury) { event.preventDefault(); onOpenTreasury(); } }}><ReceiptText size={19} aria-hidden="true" /><span>Factures et comptabilité<small>Retrouve tes comptes au Bureau.</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
      </main>
    </div>}
  </div>;
}
