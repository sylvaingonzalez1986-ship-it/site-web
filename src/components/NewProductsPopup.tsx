"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ProductCultureBadge } from "@/components/ProductCultureBadge";
import { categoryLabels, isProductCultureModeEligible } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { AppDialog } from "@/components/ui/AppDialog";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { navigateAfterOverlays } from "@/lib/overlay-history";
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

function isPaymentReturnPath(pathname: string): boolean {
  return (
    pathname.startsWith("/paiement") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/payment") ||
    pathname === "/success" ||
    pathname === "/failure"
  );
}

function isPopupExcludedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/arene") ||
    pathname.startsWith("/compte") || pathname.startsWith("/profil") ||
    pathname === "/age-gate" || pathname === "/politique-cookies" ||
    isPaymentReturnPath(pathname);
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
  if (isPopupExcludedPath(pathname)) return null;
  return <NewProductsPopupContent pathname={pathname} />;
}

function NewProductsPopupContent({ pathname }: { pathname: string }) {
  const { store, loading } = useCmsStore();
  const { consent, showBanner } = useCookieConsent();
  const router = useRouter();
  const titleId = useId();
  const productsContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const dismissedThisVisit = useRef(false);

  const featuredProducts = useMemo(
    () => store.products.filter((product) => product.featuredInPopup === true).slice(0, 4),
    [store.products],
  );

  const featuredSignature = useMemo(() => {
    const ids = featuredProducts.map((product) => product.id).sort().join(",");
    return `${store.updatedAt || "no-update"}:${ids}`;
  }, [featuredProducts, store.updatedAt]);

  const dismiss = useCallback(() => {
    dismissedThisVisit.current = true;
    setActiveProductIndex(0);
    setOpen(false);
    writeStoredPopupState({
      signature: featuredSignature,
      dismissedAt: Date.now(),
    });
  }, [featuredSignature]);

  useEffect(() => {
    if (
      loading || open ||
      !consent || showBanner || dismissedThisVisit.current ||
      isPopupExcludedPath(pathname) ||
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
      setActiveProductIndex(0);
      setOpen(true);
    };
    timer = window.setTimeout(openWhenAvailable, POPUP_OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [consent, featuredProducts.length, featuredSignature, loading, open, pathname, showBanner]);

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

  return (
    <AppDialog open={open} onClose={dismiss} title="Les nouveautés du marché" className={firstVisitStyles.productsDialog}>
        <div className={firstVisitStyles.hero}>
          <div className={firstVisitStyles.heroCopy}>
            <p className={firstVisitStyles.eyebrow}>Fraîchement arrivé au marché</p>
            <h2 id={titleId} className={firstVisitStyles.title}>
              Les nouveautés des copains.
            </h2>
          </div>
          <Image className={firstVisitStyles.heroVisual} src="/mascots/boutique-market.png" alt="" width={150} height={150} />
        </div>

        {featuredProducts.length > 1 && <div className="px-4 pb-2 pt-3 sm:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            Balaye pour voir les autres produits
          </p>
        </div>}

        <div
          ref={productsContainerRef}
          onScroll={handleProductsScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 scroll-px-4 scroll-smooth overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-x-visible sm:p-7 xl:grid-cols-4"
        >
          {featuredProducts.map((product) => (
            <article
              key={product.id}
              data-single={featuredProducts.length === 1 || undefined}
              className={`${firstVisitStyles.productCard} snap-center snap-always overflow-hidden rounded-[24px] border-2 border-[#1a1a1a] bg-white shadow-[5px_5px_0_#1a1a1a] sm:snap-none`}
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
                    onClick={event => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      const destination = event.currentTarget.href;
                      navigateAfterOverlays(() => router.push(destination));
                    }}
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
    </AppDialog>
  );
}
