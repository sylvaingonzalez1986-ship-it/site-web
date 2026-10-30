"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FlaskConical, LayoutDashboard, Settings2, ShoppingBag, TrendingUp } from "lucide-react";
import { KqCommerceDesk } from "./KqCommerceDesk";
import { KqTreasuryManagement } from "./KqTreasuryManagement";
import type { KqOnlineBusinessTab } from "./KqOnlineBusiness";
import { KqPrintedArt } from "./KqPrintedArt";
import type { KqCommerceReceipt } from "@/lib/kanab-quest-commerce";
import styles from "./KqMarketHub.module.css";

/** Keep the existing section URLs and tutorial destinations. */
export type KqMarketSection = "overview" | "demands" | "sales" | "dashboard" | "management";

const sections = [
  { code: "sales", label: "Vendre", icon: FlaskConical },
  { code: "dashboard", label: "Mon stock en vente", icon: ShoppingBag },
  { code: "management", label: "Développer", icon: Settings2 },
] as const;

export function KqMarketHub({ onOpenShop, onOpenTreasury, onOpenStorage, onOpenCulture, section, onSectionChange, managementView, onManagementViewChange, initialFlowerId, initialLotId, onLotSelectionChange, initialReceipt, initialListingId }: {
  onOpenShop: (equipmentCode?: string, flowerId?: string) => void;
  onOpenTreasury?: () => void;
  onOpenStorage?: (flowerId?: string, lotId?: string) => void;
  onOpenCulture?: () => void;
  section?: KqMarketSection;
  onSectionChange?: (section: KqMarketSection, listingId?: string, businessView?: KqOnlineBusinessTab) => void;
  managementView?: KqOnlineBusinessTab;
  onManagementViewChange?: (view: KqOnlineBusinessTab) => void;
  initialFlowerId?: string;
  initialLotId?: string;
  onLotSelectionChange?: (selectedId: string | undefined, flowerId?: string) => void;
  initialReceipt?: KqCommerceReceipt;
  initialListingId?: string;
}) {
  const [localSection, setLocalSection] = useState<KqMarketSection>(initialListingId ? "dashboard" : initialFlowerId || initialLotId ? "sales" : "overview");
  const [localManagementView, setLocalManagementView] = useState<KqOnlineBusinessTab>("site");
  const managementDestination = managementView ?? localManagementView;
  const [listingSelection, setListingSelection] = useState({ entry: initialListingId, value: initialListingId });
  // URL history can change the target without remounting the whole commerce hub.
  // Keep local destinations (notably the merch workshop) when leaving that target.
  if (listingSelection.entry !== initialListingId) {
    setListingSelection({ entry: initialListingId, value: initialListingId });
  }
  const selectedListingId = listingSelection.entry === initialListingId ? listingSelection.value : initialListingId;
  const managementHeading = useRef<HTMLHeadingElement>(null);
  const commercePanel = useRef<HTMLDivElement>(null);
  const focusDestination = useRef<KqMarketSection | null>(null);
  const activeSection = section ?? localSection;
  useEffect(() => {
    if (activeSection === focusDestination.current) {
      focusDestination.current = null;
      // A demand or campaign can target an individual listing. Preserve that focus.
      if (commercePanel.current?.contains(document.activeElement) && document.activeElement?.closest("[data-online-listings-heading], [data-online-listing]")) return;
      const target = activeSection === "management" ? managementHeading.current : commercePanel.current?.querySelector<HTMLHeadingElement>("[data-commerce-view-heading]");
      target?.focus();
    }
  }, [activeSection]);
  function select(next: KqMarketSection, destination?: KqOnlineBusinessTab, listingId?: string) {
    if (destination) setLocalManagementView(destination);
    if (next === "dashboard") setListingSelection({ entry: initialListingId, value: listingId });
    focusDestination.current = next;
    setLocalSection(next);
    onSectionChange?.(next, listingId, destination ?? managementDestination);
  }
  function viewSales(listingId?: string) {
    select("dashboard", undefined, listingId);
  }
  return <div className={styles.hub}>
    <div className={styles.workspace}>
      <nav className={styles.navigation} aria-label="Commerce">
        <div className={styles.navigationHeading}>
          <div className={styles.identity}><KqPrintedArt kind="commerce" className={styles.shopMark} /><strong>Commerce</strong></div>
          <button type="button" className={styles.summaryLink} aria-current={activeSection === "overview" ? "page" : undefined} onClick={() => select("overview")}><LayoutDashboard size={16} aria-hidden="true" />Synthèse</button>
        </div>
        <div className={styles.tabs}>{sections.map(item => {
          const Icon = item.icon;
          const active = item.code === activeSection || (item.code === "sales" && activeSection === "demands");
          return <button key={item.code} type="button" data-market-section={item.code} aria-current={active ? "page" : undefined} onClick={() => item.code === "dashboard" ? viewSales() : select(item.code)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></button>;
        })}</div>
      </nav>
      {activeSection !== "management" ? <div className={styles.content} ref={commercePanel}>
        {activeSection === "sales" ? <div className={styles.contextLinks}><button type="button" className={styles.back} onClick={() => select("demands")}><TrendingUp size={16} aria-hidden="true" />Demandes clients · voir les primes<ArrowRight size={16} aria-hidden="true" /></button></div> : activeSection === "demands" ? <button type="button" className={styles.back} onClick={() => select("sales")}><ArrowLeft size={16} aria-hidden="true" />Retour à mes lots</button> : null}
        <KqCommerceDesk initialFlowerId={initialFlowerId} initialLotId={initialLotId} onLotSelectionChange={onLotSelectionChange} initialReceipt={initialReceipt} initialListingId={selectedListingId} mode={activeSection} onModeChange={(next, listingId) => select(next, undefined, listingId)} onOpenShop={onOpenShop} onOpenTreasury={onOpenTreasury} onOpenStorage={onOpenStorage} onOpenCulture={onOpenCulture} onOpenBusiness={() => select("management")} onOpenMerch={() => select("management", "merch")} />
      </div> : <div className={styles.content}>
        <main className={styles.management}>
          <h1 className="sr-only" ref={managementHeading} tabIndex={-1}>Développer ma boutique</h1>
          <KqTreasuryManagement onOpenShop={onOpenShop} section="management" view={managementDestination} onViewChange={next => { setLocalManagementView(next); onManagementViewChange?.(next); }} onPrepareStock={() => select("sales")} onViewSales={viewSales} />
        </main>
      </div>}
    </div>
  </div>;
}
