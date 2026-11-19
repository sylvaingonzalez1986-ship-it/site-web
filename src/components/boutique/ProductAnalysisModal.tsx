"use client";

import { useMemo } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { normalizeAnalysisUrl } from "@/lib/product-analysis-url";
import styles from "./ProductMediaDialog.module.css";

type ProductAnalysisModalProps = {
  open: boolean;
  productName: string;
  analysisUrl: string;
  onClose: () => void;
};

export function ProductAnalysisModal({
  open,
  productName,
  analysisUrl,
  onClose,
}: ProductAnalysisModalProps) {
  const safeUrl = useMemo(() => normalizeAnalysisUrl(analysisUrl), [analysisUrl]);
  if (!safeUrl) {
    return null;
  }

  return (
    <AppDialog open={open} onClose={onClose} title={`Analyse · ${productName}`} label={`Analyse ${productName}`} className={styles.analysis} bodyClassName={styles.analysisBody}
      footer={<a href={safeUrl} target="_blank" rel="noreferrer" className={styles.externalLink}>Ouvrir le PDF dans un nouvel onglet</a>}>
          <iframe
            title={`Analyse PDF ${productName}`}
            src={safeUrl}
            className={styles.pdf}
          />
    </AppDialog>
  );
}
