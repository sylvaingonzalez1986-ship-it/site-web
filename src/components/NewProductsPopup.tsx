"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductCultureBadge } from "@/components/ProductCultureBadge";
import { categoryLabels, isProductCultureModeEligible } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { AppDialog } from "@/components/ui/AppDialog";
import { KqChapterHeading } from "@/components/placard/KqChapterHeading";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import styles from "./NewProductsPopup.module.css";

const POPUP_STORAGE_KEY = "lcb_new_products_popup";
const POPUP_DISMISS_MS = 24 * 60 * 60 * 1000;
const POPUP_OPEN_DELAY_MS = 2200;

const categorySlugs: Record<string, string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

type StoredPopupState = {
  signature: string;
  dismissedAt: number;
};

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function readStoredPopupState(): StoredPopupState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(POPUP_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredPopupState>;
    if (typeof parsed.signature !== "string" || !Number.isFinite(parsed.dismissedAt)) {
      return null;
    }

    return {
      signature: parsed.signature,
      dismissedAt: Number(parsed.dismissedAt),
    };
  } catch {
    return null;
  }
}

function writeStoredPopupState(value: StoredPopupState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A storage restriction must never prevent closing the popup.
  }
}

function isVisitBusy(): boolean {
  if (document.visibilityState !== "visible") return true;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']")) return true;
  return Array.from(document.querySelectorAll<HTMLElement>("dialog[open], [role='dialog'], [role='alertdialog'], details[open]")).some(element =>
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden",
  );
}

export function NewProductsPopup() {
  const pathname = usePathname();
  // This wrapper survives navigation in the root layout, even if storage is blocked.
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  if (pathname !== "/boutique" || dismissedThisVisit) return null;
  return <NewProductsPopupContent onDismiss={() => setDismissedThisVisit(true)} />;
}

function NewProductsPopupContent({ onDismiss }: { onDismiss: () => void }) {
  const { store, loading } = useCmsStore();
  const { consent, showBanner } = useCookieConsent();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const featuredProducts = useMemo(
    () => store.products.filter((product) => product.featuredInPopup === true).slice(0, 4),
    [store.products],
  );

  // An unrelated CMS edit must not make the same selection reappear.
  const featuredSignature = useMemo(
    () => featuredProducts.map((product) => product.id).sort().join(","),
    [featuredProducts],
  );

  const dismiss = useCallback(() => {
    writeStoredPopupState({
      signature: featuredSignature,
      dismissedAt: Date.now(),
    });
    onDismiss();
  }, [featuredSignature, onDismiss]);

  useEffect(() => {
    if (
      loading || open ||
      !consent || showBanner ||
      featuredProducts.length === 0
    ) {
      return;
    }

    const stored = readStoredPopupState();
    if (
      stored &&
      stored.signature === featuredSignature &&
      Date.now() - stored.dismissedAt < POPUP_DISMISS_MS
    ) {
      return;
    }

    let timer: number;
    const openWhenAvailable = () => {
      if (isVisitBusy()) {
        timer = window.setTimeout(openWhenAvailable, POPUP_OPEN_DELAY_MS);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(openWhenAvailable, POPUP_OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [consent, featuredProducts.length, featuredSignature, loading, open, showBanner]);

  if (!open || featuredProducts.length === 0) {
    return null;
  }

  return (
    <AppDialog
      open={open}
      onClose={dismiss}
      title={<KqChapterHeading art="commerce" title="Nouveautés du marché" compact />}
      className={styles.dialog}
      headerClassName={styles.header}
      bodyClassName={styles.body}
      dialogProps={{ "data-new-products-popup": true }}
    >
      <div className={styles.products}>
        {featuredProducts.map((product) => (
          <article
            key={product.id}
            data-single={featuredProducts.length === 1 || undefined}
            className={styles.product}
          >
            <div className={styles.photo} data-product-photo="new-arrival">
              <Image
                src={product.images?.[0] ?? product.image}
                alt={product.name}
                fill
                sizes="(max-width: 480px) 80px, 112px"
                className={styles.image}
              />
            </div>

            <div className={styles.productBody}>
              <div className={styles.category}>
                <span>
                  {categoryLabels[product.category] ?? product.category}
                </span>
                {isProductCultureModeEligible(product.category) && product.cultureMode ? (
                  <ProductCultureBadge cultureMode={product.cultureMode} className={styles.culture} />
                ) : null}
              </div>

              <h3 className={styles.productName}>{product.name}</h3>

              <div className={styles.actions}>
                <p className={styles.price}>
                  {formatPrice(product.price)}
                </p>
                <Link
                  href={`/boutique/${categorySlugs[product.category] ?? `${product.category}-cbd`}/${product.id}`}
                  onClick={event => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    const destination = event.currentTarget.href;
                    navigateAfterOverlays(() => router.push(destination));
                  }}
                  className={styles.productLink}
                  aria-label={`Voir ${product.name}`}
                >
                  Voir
                </Link>
              </div>
            </div>
            <p className={styles.description}>{product.description}</p>
          </article>
        ))}
      </div>
    </AppDialog>
  );
}
