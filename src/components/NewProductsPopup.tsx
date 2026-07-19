"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProductCultureBadge } from "@/components/ProductCultureBadge";
import { categoryLabels, isProductCultureModeEligible } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import firstVisitStyles from "@/components/FirstVisitExperience.module.css";

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
  return `${value.toFixed(2).replace(".", ",")} EUR`;
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  const selector = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
  );
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

  window.localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(value));
}

function isPaymentReturnPath(pathname: string): boolean {
  return (
    pathname.startsWith("/paiement") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/payment") ||
    pathname === "/success" ||
    pathname === "/failure"
  );
}

export function NewProductsPopup() {
  const { store, loading } = useCmsStore();
  const pathname = usePathname();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const productsContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  const featuredProducts = useMemo(
    () => store.products.filter((product) => product.featuredInPopup === true).slice(0, 4),
    [store.products],
  );

  const featuredSignature = useMemo(() => {
    const ids = featuredProducts.map((product) => product.id).sort().join(",");
    return `${store.updatedAt || "no-update"}:${ids}`;
  }, [featuredProducts, store.updatedAt]);

  const dismiss = useCallback(() => {
    writeStoredPopupState({
      signature: featuredSignature,
      dismissedAt: Date.now(),
    });
    setActiveProductIndex(0);
    setOpen(false);
  }, [featuredSignature]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (
      loading ||
      pathname.startsWith("/admin") ||
      isPaymentReturnPath(pathname) ||
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

    const timer = window.setTimeout(() => {
      setActiveProductIndex(0);
      setOpen(true);
    }, POPUP_OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [featuredProducts.length, featuredSignature, loading, pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        return;
      }

      const currentIndex = focusable.findIndex((element) => element === document.activeElement);

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        }
        return;
      }

      if (currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousActive?.focus();
    };
  }, [dismiss, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const container = productsContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [featuredSignature, open]);

  const handleProductsScroll = useCallback(() => {
    const container = productsContainerRef.current;
    if (!container) {
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) {
      return;
    }

    const viewportCenter = container.scrollLeft + container.clientWidth / 2;
    const nearestIndex = children.reduce((closestIndex, child, index) => {
      const closestCenter = children[closestIndex]!.offsetLeft + children[closestIndex]!.clientWidth / 2;
      const nextCenter = child.offsetLeft + child.clientWidth / 2;
      const closestDistance = Math.abs(closestCenter - viewportCenter);
      const nextDistance = Math.abs(nextCenter - viewportCenter);
      return nextDistance < closestDistance ? index : closestIndex;
    }, 0);

    setActiveProductIndex(nearestIndex);
  }, []);

  if (!open || featuredProducts.length === 0) {
    return null;
  }

  return createPortal(
    <div className={firstVisitStyles.backdrop}>
      <div className="absolute inset-0" onClick={dismiss} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${firstVisitStyles.dialog} safe-area-bottom z-10 flex max-w-5xl flex-col overflow-hidden`}
      >
        <div className={firstVisitStyles.hero}>
          <div className={firstVisitStyles.heroCopy}>
            <p className={firstVisitStyles.eyebrow}>Fraîchement arrivé au marché</p>
            <h2 id={titleId} className={firstVisitStyles.title}>
              Les nouveautés des copains.
            </h2>
          </div>
          <Image className={firstVisitStyles.heroVisual} src="/mascots/boutique-market.png" alt="" width={150} height={150} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismiss}
            className={firstVisitStyles.close}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-4 pb-2 pt-3 sm:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            Balaye pour voir les autres produits
          </p>
        </div>

        <div
          ref={productsContainerRef}
          onScroll={handleProductsScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-visible px-4 pb-5 scroll-px-4 scroll-smooth overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden sm:grid sm:flex-none sm:grid-cols-2 sm:gap-4 sm:overflow-x-visible sm:overflow-y-auto sm:p-7 xl:grid-cols-4"
        >
          {featuredProducts.map((product) => (
            <article
              key={product.id}
              className="min-w-[78vw] shrink-0 snap-center snap-always overflow-hidden rounded-[24px] border-2 border-[#1a1a1a] bg-white shadow-[5px_5px_0_#1a1a1a] sm:min-w-0 sm:shrink sm:snap-none"
            >
              <div className="relative aspect-[3/2] border-b-2 border-[#1a1a1a] bg-[#f3ead8] sm:aspect-[4/3]">
                <Image
                  src={product.images?.[0] ?? product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 639px) 78vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>

              <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="pill-cartoon bg-[#fff4bf] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                    {categoryLabels[product.category] ?? product.category}
                  </span>
                  {isProductCultureModeEligible(product.category) && product.cultureMode ? (
                    <ProductCultureBadge cultureMode={product.cultureMode} className="text-[11px]" />
                  ) : null}
                </div>

                <div>
                  <h3 className="font-display text-xl leading-none text-ink sm:text-2xl">{product.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-charcoal">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-xl leading-none text-ink sm:text-2xl">
                    {formatPrice(product.price)}
                  </p>
                  <Link
                    href={`/boutique/${categorySlugs[product.category] ?? `${product.category}-cbd`}/${product.id}`}
                    onClick={dismiss}
                    className="btn-cartoon btn-primary inline-flex h-10 items-center justify-center px-4 text-xs leading-none"
                  >
                    Voir
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {featuredProducts.length > 1 ? (
          <div className="flex items-center justify-center gap-2 px-4 pb-4 sm:hidden">
            {featuredProducts.map((product, index) => (
              <span
                key={product.id}
                className={`h-2.5 w-2.5 rounded-full border border-[#1a1a1a] transition-colors ${
                  index === activeProductIndex ? "bg-[#1a1a1a]" : "bg-[#fff8ec]"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
