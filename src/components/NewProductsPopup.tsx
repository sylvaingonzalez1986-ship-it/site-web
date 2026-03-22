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

export function NewProductsPopup() {
  const { store, loading } = useCmsStore();
  const pathname = usePathname();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

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
    setOpen(false);
  }, [featuredSignature]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (loading || pathname.startsWith("/admin") || featuredProducts.length === 0) {
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

  if (!open || featuredProducts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-4 md:p-6">
      <div className="absolute inset-0" onClick={dismiss} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border-2 border-[#1a1a1a] bg-[#fff8ec] shadow-[10px_10px_0_#1a1a1a]"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#1a1a1a] bg-[linear-gradient(135deg,#ffe07a_0%,#ffd14a_48%,#fff0b8_100%)] px-5 py-5 md:px-7">
          <div>
            <h2 id={titleId} className="font-display text-3xl leading-none text-ink md:text-4xl">
              Nouveauté
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismiss}
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-2 md:p-7 xl:grid-cols-4">
          {featuredProducts.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-[24px] border-2 border-[#1a1a1a] bg-white shadow-[5px_5px_0_#1a1a1a]"
            >
              <div className="relative aspect-[4/3] border-b-2 border-[#1a1a1a] bg-[#f3ead8]">
                <Image
                  src={product.images?.[0] ?? product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>

              <div className="space-y-4 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="pill-cartoon bg-[#fff4bf] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                    {categoryLabels[product.category] ?? product.category}
                  </span>
                  {isProductCultureModeEligible(product.category) && product.cultureMode ? (
                    <ProductCultureBadge cultureMode={product.cultureMode} className="text-[11px]" />
                  ) : null}
                </div>

                <div>
                  <h3 className="font-display text-2xl leading-none text-ink">{product.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-charcoal">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-2xl leading-none text-ink">{formatPrice(product.price)}</p>
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
      </div>
    </div>,
    document.body,
  );
}
