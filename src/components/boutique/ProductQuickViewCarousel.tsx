"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { ProductAnalysisModal } from "@/components/boutique/ProductAnalysisModal";
import { useCart } from "@/context/CartContext";
import { categoryLabels, type Product } from "@/data/products";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isRemoteImageUrl } from "@/lib/image-source";
import { getSelectableVariantOptions, isProductInStock } from "@/lib/product-stock";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { Producer } from "@/types/store";

type ProductQuickViewCarouselProps = {
  productId: string | null;
  products: Product[];
  producersById: Map<string, Producer>;
  addButtonLabel: string;
  onChangeProductId: (productId: string) => void;
  onClose: () => void;
};

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_HINT_STORAGE_KEY = "boutique-swipe-hint-seen";

export function ProductQuickViewCarousel({
  productId,
  products,
  producersById,
  addButtonLabel,
  onChangeProductId,
  onClose,
}: ProductQuickViewCarouselProps) {
  const router = useRouter();
  const { addToCart, authLoading, isAuthenticated } = useCart();
  const [analysisProductId, setAnalysisProductId] = useState<string | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);
  const touchSwipingRef = useRef(false);

  useBodyScrollLock(Boolean(productId));

  const activeProduct = useMemo(
    () => (productId ? products.find((item) => item.id === productId) ?? null : null),
    [productId, products],
  );

  const carouselProducts = useMemo(() => {
    if (!activeProduct) {
      return [];
    }

    const seen = new Set<string>();
    return products.filter((item) => {
      if (item.category !== activeProduct.category || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [activeProduct, products]);

  const activeIndex = useMemo(() => {
    if (!activeProduct) {
      return -1;
    }
    return carouselProducts.findIndex((item) => item.id === activeProduct.id);
  }, [activeProduct, carouselProducts]);

  const activeProducer = useMemo(() => {
    if (!activeProduct?.producerId) {
      return undefined;
    }
    return producersById.get(activeProduct.producerId);
  }, [activeProduct, producersById]);
  const selectableVariants = useMemo(
    () => (activeProduct ? getSelectableVariantOptions(activeProduct) : []),
    [activeProduct],
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  const canNavigate = carouselProducts.length > 1 && activeIndex >= 0;
  const selectedVariant =
    selectableVariants.find((option) => option.id === selectedVariantId) ?? 
    selectableVariants[0];
  const requiresVariantSelection = (activeProduct?.variantOptions?.length ?? 0) > 0;
  const inStock = activeProduct ? isProductInStock(activeProduct) : false;
  const canAddCurrentSelection = inStock && (!requiresVariantSelection || Boolean(selectedVariant));
  const closeQuickView = useCallback(() => {
    setAnalysisProductId(null);
    onClose();
  }, [onClose]);
  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.)
    }
  }, []);

  const navigate = (delta: -1 | 1) => {
    if (!canNavigate) {
      return;
    }
    dismissSwipeHint();

    const nextIndex =
      (activeIndex + delta + carouselProducts.length) % carouselProducts.length;
    const nextProduct = carouselProducts[nextIndex];
    if (!nextProduct) {
      return;
    }

    onChangeProductId(nextProduct.id);
  };

  const handleAddToCart = () => {
    if (!activeProduct || authLoading || !canAddCurrentSelection) {
      return;
    }

    const added = addToCart(activeProduct);
    if (added) {
      return;
    }

    if (isAuthenticated) {
      return;
    }

    const nextPath =
      typeof window === "undefined"
        ? "/boutique"
        : `${window.location.pathname}${window.location.search}`;
    router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!canNavigate) {
      return;
    }
    dismissSwipeHint();

    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchDeltaXRef.current = 0;
    touchSwipingRef.current = false;
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!canNavigate || touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (!touchSwipingRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    touchSwipingRef.current = true;
    touchDeltaXRef.current = deltaX;
    event.preventDefault();
  };

  const resetSwipe = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
    touchSwipingRef.current = false;
  };

  const onTouchEnd = () => {
    if (!canNavigate) {
      return;
    }

    if (touchSwipingRef.current) {
      if (touchDeltaXRef.current <= -SWIPE_THRESHOLD_PX) {
        navigate(1);
      } else if (touchDeltaXRef.current >= SWIPE_THRESHOLD_PX) {
        navigate(-1);
      }
    }

    resetSwipe();
  };

  useEffect(() => {
    if (!activeProduct) {
      return;
    }

    const navigateWithinCategory = (delta: -1 | 1) => {
      if (!canNavigate) {
        return;
      }

      const nextIndex =
        (activeIndex + delta + carouselProducts.length) % carouselProducts.length;
      const nextProduct = carouselProducts[nextIndex];
      if (!nextProduct) {
        return;
      }

      onChangeProductId(nextProduct.id);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeQuickView();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateWithinCategory(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateWithinCategory(-1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProduct, closeQuickView, canNavigate, activeIndex, carouselProducts, onChangeProductId]);

  useEffect(() => {
    if (!productId || !canNavigate || typeof window === "undefined") {
      setShowSwipeHint(false);
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === "1";
    } catch {
      alreadySeen = false;
    }

    if (alreadySeen) {
      setShowSwipeHint(false);
      return;
    }

    const touchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const smallViewport = window.matchMedia("(max-width: 1024px)").matches;
    if (!touchDevice && !smallViewport) {
      setShowSwipeHint(false);
      return;
    }

    setShowSwipeHint(true);
    try {
      window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors.
    }

    const timer = window.setTimeout(() => {
      setShowSwipeHint(false);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [productId, canNavigate, activeProduct?.id]);

  if (!activeProduct || typeof document === "undefined") {
    return null;
  }

  const activeImage = activeProduct.images?.[0] || activeProduct.image;
  const hasPromo = !selectedVariant && hasActiveProductPromo(activeProduct);
  const displayedPrice = selectedVariant ? selectedVariant.price : activeProduct.price;
  const activeCategoryLabel = categoryLabels[activeProduct.category];
  const activeAnalysisUrl = activeProduct.analysisPdf ?? "";

  return createPortal(
    <div className="safe-area-top safe-area-bottom safe-area-x fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-2 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer l'apercu produit"
        onClick={closeQuickView}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-start md:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Apercu produit ${activeProduct.name}`}
          className="relative my-auto flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full min-h-0 flex-col overflow-hidden cartoon-border bg-cream p-3 md:h-auto md:max-h-[min(92dvh,860px)] md:p-6"
        >
          <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 flex items-start justify-between gap-3 border-b-2 border-[#1a1a1a] bg-cream px-3 py-3 md:static md:mx-0 md:mt-0 md:mb-4 md:border-b-0 md:bg-transparent md:p-0">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
                Apercu produit
              </p>
              <h3 className="font-display text-2xl text-ink md:text-4xl">{activeProduct.name}</h3>
            </div>
            <button
              type="button"
              onClick={closeQuickView}
              className="btn-cartoon btn-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y [-webkit-overflow-scrolling:touch]">
            <div className="grid gap-5 md:grid-cols-[1.1fr_1fr] md:items-start">
              <div
                className="cartoon-border relative aspect-square overflow-hidden bg-white"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={resetSwipe}
              >
                <Image
                  src={activeImage}
                  alt={activeProduct.name}
                  fill
                  sizes="(max-width: 768px) 92vw, 54vw"
                  unoptimized={isRemoteImageUrl(activeImage)}
                  className="object-cover"
                />
                {activeProduct.badge && (
                  <span className="absolute left-3 top-3 z-10 border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-1 text-xs font-bold uppercase tracking-wide">
                    {activeProduct.badge}
                  </span>
                )}
                {hasPromo && (
                  <span className="promo-banner absolute right-3 top-3 z-10 px-3 py-1 text-xs">
                    Moins {activeProduct.promoPercent}%
                  </span>
                )}
                {!inStock && (
                  <span className="absolute left-3 bottom-3 z-10 border-2 border-[#1a1a1a] bg-[#f8d7da] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7f1d1d]">
                    Rupture de stock
                  </span>
                )}
                {showSwipeHint && canNavigate && (
                  <div className="swipe-hint pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-center justify-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#fff8f0]/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink md:text-xs">
                    <ChevronLeft size={14} />
                    <span>Glisse pour changer d&apos;article</span>
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
                  {activeCategoryLabel}
                </p>

                {activeProducer && (
                  <div className="cartoon-border flex items-center gap-2 bg-yellow px-3 py-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
                      <Image
                        src={activeProducer.image}
                        alt={activeProducer.name}
                        fill
                        sizes="32px"
                        unoptimized={isRemoteImageUrl(activeProducer.image)}
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{activeProducer.name}</p>
                      <p className="truncate text-[11px] text-charcoal">
                        {[activeProducer.department, activeProducer.region].filter(Boolean).join(", ") ||
                          activeProducer.location}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-sm leading-relaxed text-charcoal">{activeProduct.description}</p>

                {activeProduct.analysisPdf && (
                  <button
                    type="button"
                    onClick={() => setAnalysisProductId(activeProduct.id)}
                    className="inline-flex min-h-[38px] w-fit items-center rounded-full border-2 border-[#1a1a1a] bg-[#e8f7f2] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0a7b61] transition-colors hover:bg-[#d7f0e8]"
                  >
                    Analyse
                  </button>
                )}
                {!inStock && (
                  <p className="inline-flex w-fit items-center border-2 border-[#1a1a1a] bg-[#f8d7da] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7f1d1d]">
                    Rupture de stock
                  </p>
                )}
                {selectableVariants.length > 0 && (
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-charcoal">
                      {activeProduct.variantLabel?.trim() || "Taille"}
                    </label>
                    <select
                      className="h-10 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm"
                      value={selectedVariant?.id ?? ""}
                      onChange={(event) => setSelectedVariantId(event.target.value)}
                    >
                      {selectableVariants.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} - {formatPrice(option.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-3">
                  {hasPromo ? (
                    <div className="flex flex-col">
                      <span className="price-original text-sm">{formatPrice(activeProduct.originalPrice)}</span>
                      <div className="flex items-end gap-2">
                        <span className="price-promo text-xl">{formatPrice(activeProduct.price)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <p className="text-xl font-bold text-ink">{formatPrice(displayedPrice)}</p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={authLoading || !canAddCurrentSelection}
                    className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center gap-2 px-4 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={15} /> {inStock ? addButtonLabel : "Rupture"}
                  </button>
                </div>
              </div>
            </div>

            {canNavigate && (
              <>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center p-0 md:inline-flex"
                  onClick={() => navigate(-1)}
                  aria-label="Produit precedent"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center p-0 md:inline-flex"
                  onClick={() => navigate(1)}
                  aria-label="Produit suivant"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 pb-1 text-xs font-semibold text-charcoal">
              {canNavigate && (
                <button
                  type="button"
                  className="btn-cartoon btn-secondary inline-flex h-9 w-9 items-center justify-center p-0 md:hidden"
                  onClick={() => navigate(-1)}
                  aria-label="Produit precedent"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <span>
                {Math.max(activeIndex + 1, 1)} / {Math.max(carouselProducts.length, 1)} - meme categorie
              </span>
              {canNavigate && (
                <button
                  type="button"
                  className="btn-cartoon btn-secondary inline-flex h-9 w-9 items-center justify-center p-0 md:hidden"
                  onClick={() => navigate(1)}
                  aria-label="Produit suivant"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeAnalysisUrl && (
        <ProductAnalysisModal
          open={analysisProductId === activeProduct.id}
          productName={activeProduct.name}
          analysisUrl={activeAnalysisUrl}
          onClose={() => setAnalysisProductId(null)}
        />
      )}
    </div>,
    document.body,
  );
}



