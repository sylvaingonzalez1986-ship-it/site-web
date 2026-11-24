"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ShopCardOrigin } from "@/components/ProductCard";
import { ProducerDetailPanel } from "@/components/boutique/ProducerDetailPanel";
import { restoreShopPanelBeforePaint } from "@/components/boutique/ShopResultsRestore";
import { AppDialog } from "@/components/ui/AppDialog";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";
import theme from "./MarketTheme.module.css";
import styles from "./ProducerTcgModal.module.css";

type ProducerTcgModalProps = {
  open: boolean;
  producers: Producer[];
  selectedProducerId: string | null;
  productsByProducerId: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId?: Record<string, PublicContestProductTastingSummary>;
  onClose: () => void;
  onSelectProducer: (producerId: string) => void;
  origin: ShopCardOrigin;
};

export function ProducerTcgModal({ open, producers, selectedProducerId, productsByProducerId, addButtonLabel, lowStockThresholdGrams, producerPartnerLabel, producerWebsiteLabel, tastingSummariesByProductId = {}, onClose, onSelectProducer, origin }: ProducerTcgModalProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const openProducerRef = useRef<string | null>(null);
  const selectedIndex = useMemo(() => producers.findIndex(producer => producer.id === selectedProducerId), [producers, selectedProducerId]);
  const selectedProducer = selectedIndex >= 0 ? producers[selectedIndex] : null;
  const selectedProducts = selectedProducer ? productsByProducerId.get(selectedProducer.id) ?? [] : [];
  const go = useCallback((direction: -1 | 1) => {
    if (selectedIndex < 0 || producers.length < 2) return;
    onSelectProducer(producers[(selectedIndex + direction + producers.length) % producers.length].id);
  }, [onSelectProducer, producers, selectedIndex]);

  useLayoutEffect(() => {
    const previousProducer = openProducerRef.current;
    openProducerRef.current = open ? selectedProducer?.id ?? null : null;
    if (open) {
      restoreShopPanelBeforePaint();
      return;
    }
    if (!previousProducer || document.activeElement !== document.body) return;
    // A dialog reconstructed from its URL may lack a connected opener.
    document.querySelector<HTMLElement>(`[data-producer-id="${CSS.escape(previousProducer)}"]`)?.focus({ preventScroll: true });
  }, [open, selectedProducer?.id]);

  if (!selectedProducer) return null;
  const controls = <nav className={styles.controls} aria-label="Parcourir les producteurs"
    onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); event.stopPropagation(); go(event.key === "ArrowLeft" ? -1 : 1);
    }}
    onTouchStart={event => { const touch = event.touches[0]; touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
    onTouchEnd={event => {
      const start = touchStartRef.current, end = event.changedTouches[0]; touchStartRef.current = null;
      if (!start || !end || Math.abs(end.clientX - start.x) < 50 || Math.abs(end.clientY - start.y) > 35) return;
      go(end.clientX > start.x ? -1 : 1);
    }}>
    <button type="button" data-ui-commerce="secondary" data-ui-shape="control" onClick={() => go(-1)} disabled={producers.length < 2} aria-label="Producteur précédent"><ChevronLeft size={20} aria-hidden="true" /></button>
    <span>Producteurs <strong>{selectedIndex + 1} / {producers.length}</strong></span>
    <button type="button" data-ui-commerce="secondary" data-ui-shape="control" onClick={() => go(1)} disabled={producers.length < 2} aria-label="Producteur suivant"><ChevronRight size={20} aria-hidden="true" /></button>
  </nav>;
  return <AppDialog historyManagedByUrl open={open} onClose={onClose} title={controls} label={`Fiche producteur ${selectedProducer.name}`} closeLabel="Fermer la fiche producteur" className={`${theme.surface} ${styles.dialog}`} headerClassName={styles.header} bodyClassName={styles.body}>
    <ProducerDetailPanel origin={{ ...origin, producer: selectedProducer.id }} producer={selectedProducer} products={selectedProducts} addButtonLabel={addButtonLabel}
      lowStockThresholdGrams={lowStockThresholdGrams} producerPartnerLabel={producerPartnerLabel} producerWebsiteLabel={producerWebsiteLabel}
      tastingSummariesByProductId={tastingSummariesByProductId} onClose={onClose} showCloseButton={false} />
  </AppDialog>;
}
