"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartBenefitSummaryModal } from "@/components/cart/CartBenefitSummaryModal";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCmsStore } from "@/hooks/useCmsStore";
import { getCustomerCheckoutEligibility } from "@/lib/customer-checkout-eligibility";
import {
  getBadgeDiscountPercent,
  getBadgeExtraBoosterPacksPerOrder,
  getBadgeBenefitsText,
  getBadgeFreeShippingThreshold,
  parseBadgeBenefitsLines,
} from "@/lib/loyalty-tier-benefits";
import { computeLotteryTicketBreakdown } from "@/lib/lottery-ticket-calculations";
import { getAvailableQuantity } from "@/lib/product-stock";
import { hasActiveProductPromo } from "@/lib/product-promo";
import {
  computeReferralFirstOrderDiscountAmount,
  isReferralFirstOrderDiscountEligible,
  REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
} from "@/lib/referral-first-order-discount";
import {
  computeShippingFee,
  getFreeShippingProgressMessage,
  getShippingPricingConfig,
  type DeliveryMethod,
  type MondialRelayPoint,
} from "@/lib/shipping";
import { formatPrice } from "@/lib/utils";

const CheckoutButton = dynamic(
  () => import("@/components/CheckoutButton").then((mod) => mod.CheckoutButton),
  { ssr: false },
);

const MondialRelayPicker = dynamic(
  () => import("@/components/MondialRelayPicker").then((mod) => mod.MondialRelayPicker),
  { ssr: false },
);

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

type PromoPreview = {
  code: string;
  promoDiscountPercent: number;
  promoDiscountAmount: number;
  badgeDiscountPercent: number;
  badgeDiscountAmount: number;
  discountedTotal: number;
};

type LotteryPreview = {
  claimId: string;
  rewardType: "discount" | "gift";
  rewardTitle: string;
  rewardDescription: string;
  generatedCode?: string;
  giftLabel?: string;
  lotteryDiscountPercent: number;
  lotteryDiscountAmount: number;
  badgeDiscountPercent: number;
  badgeDiscountAmount: number;
  discountedTotal: number;
};

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const router = useRouter();
  const {
    items,
    totalItems,
    totalPrice,
    isAuthenticated,
    authLoading,
    sessionLoading,
    user,
    orders,
    loyalty,
    lotteryInventory,
    lotteryConfig,
    refreshSession,
    addToCart,
    decreaseQuantity,
    setQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { store: cmsStore } = useCmsStore();

  const [shippingName, setShippingName] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("France");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("home");
  const [selectedRelayPoint, setSelectedRelayPoint] = useState<MondialRelayPoint | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [selectedLotteryRewardClaimId, setSelectedLotteryRewardClaimId] = useState("");
  const [lotteryLoading, setLotteryLoading] = useState(false);
  const [lotteryError, setLotteryError] = useState<string | null>(null);
  const [lotterySuccess, setLotterySuccess] = useState<string | null>(null);
  const [lotteryPreview, setLotteryPreview] = useState<LotteryPreview | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<"loyalty" | "packs" | null>(null);
  const wasOpenRef = useRef(false);
  useBodyScrollLock(open);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    setShippingName(
      user ? `${user.firstName} ${user.lastName}`.trim() : "",
    );
    setShippingEmail(user?.email ?? "");
    setShippingPhone(user?.phone ?? "");
    setShippingAddress(user?.address ?? "");
    setShippingCity(user?.city ?? "");
    setShippingPostalCode(user?.postalCode ?? "");
    setShippingCountry(user?.country || "France");
    setSelectedRelayPoint(null);
    setCartError(null);
    if (isAuthenticated) {
      void refreshSession({ silent: true, force: true });
    }
  }, [isAuthenticated, open, refreshSession, user]);

  const buildCartStockError = (productName: string, maxAvailable?: number) => {
    if (typeof maxAvailable === "number" && maxAvailable > 0) {
      return `Stock maximum atteint pour ${productName} (${maxAvailable} unite${maxAvailable > 1 ? "s" : ""} disponible${maxAvailable > 1 ? "s" : ""}).`;
    }

    return `Le stock disponible pour ${productName} est atteint.`;
  };

  const badgeDiscountPercent = useMemo(() => {
    if (!isAuthenticated || !loyalty.currentBadge.unlocked) {
      return 0;
    }

    return getBadgeDiscountPercent(cmsStore.content.profile, loyalty.currentBadge.id);
  }, [cmsStore.content.profile, isAuthenticated, loyalty.currentBadge.id, loyalty.currentBadge.unlocked]);

  const badgeDiscountAmount = useMemo(
    () => Number(((totalPrice * badgeDiscountPercent) / 100).toFixed(2)),
    [badgeDiscountPercent, totalPrice],
  );

  const totalAfterBadgeDiscount = useMemo(
    () => Number(Math.max(totalPrice - badgeDiscountAmount, 0).toFixed(2)),
    [badgeDiscountAmount, totalPrice],
  );
  const hasManualDiscountChoice = promoCode.trim().length > 0 || selectedLotteryRewardClaimId.length > 0;
  const hasPaidOrders = useMemo(
    () => orders.some((order) => order.paymentState === "paid" || order.paymentState === "not_configured"),
    [orders],
  );
  const hasAutoReferralDiscount = useMemo(
    () =>
      isAuthenticated &&
      !authLoading &&
      !sessionLoading &&
      !promoPreview &&
      !lotteryPreview &&
      isReferralFirstOrderDiscountEligible({
        referredByCode: user?.referredByCode,
        referralRewardedAt: user?.referralRewardedAt,
        hasPaidOrder: hasPaidOrders,
        hasManualDiscount: hasManualDiscountChoice,
      }),
    [
      authLoading,
      sessionLoading,
      hasManualDiscountChoice,
      hasPaidOrders,
      isAuthenticated,
      lotteryPreview,
      promoPreview,
      user?.referredByCode,
      user?.referralRewardedAt,
    ],
  );
  const referralAutoDiscountAmount = useMemo(
    () =>
      hasAutoReferralDiscount
        ? computeReferralFirstOrderDiscountAmount(
            totalAfterBadgeDiscount,
            REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
          )
        : 0,
    [hasAutoReferralDiscount, totalAfterBadgeDiscount],
  );
  const totalAfterAutoReferralDiscount = useMemo(
    () => Number(Math.max(totalAfterBadgeDiscount - referralAutoDiscountAmount, 0).toFixed(2)),
    [referralAutoDiscountAmount, totalAfterBadgeDiscount],
  );

  const availableRewardClaims = useMemo(
    () =>
      (lotteryInventory?.availableClaims ?? []).filter((claim) => {
        if (claim.status !== "available") {
          return false;
        }

        return claim.reward.customPayload?.checkoutRedeemable !== false;
      }),
    [lotteryInventory?.availableClaims],
  );

  useEffect(() => {
    setPromoPreview(null);
    setPromoError(null);
    setPromoSuccess(null);
  }, [promoCode, totalPrice, badgeDiscountPercent]);

  useEffect(() => {
    setLotteryPreview(null);
    setLotteryError(null);
    setLotterySuccess(null);
  }, [selectedLotteryRewardClaimId, totalPrice, badgeDiscountPercent]);

  useEffect(() => {
    if (
      selectedLotteryRewardClaimId &&
      !availableRewardClaims.some((claim) => claim.id === selectedLotteryRewardClaimId)
    ) {
      setSelectedLotteryRewardClaimId("");
      setLotteryPreview(null);
    }
  }, [availableRewardClaims, selectedLotteryRewardClaimId]);

  const checkoutAmount =
    lotteryPreview?.discountedTotal ??
    promoPreview?.discountedTotal ??
    (hasAutoReferralDiscount ? totalAfterAutoReferralDiscount : totalAfterBadgeDiscount);
  const shippingPricingConfig = useMemo(() => getShippingPricingConfig(), []);
  const badgeFreeShippingThreshold = useMemo(
    () => getBadgeFreeShippingThreshold(loyalty.currentBadge.id, loyalty.currentBadge.unlocked),
    [loyalty.currentBadge.id, loyalty.currentBadge.unlocked],
  );
  const shippingFee = useMemo(
    () =>
      computeShippingFee({
        method: deliveryMethod,
        subtotalAfterDiscount: checkoutAmount,
        config: shippingPricingConfig,
        badgeFreeShippingThresholdEur: badgeFreeShippingThreshold,
      }),
    [badgeFreeShippingThreshold, checkoutAmount, deliveryMethod, shippingPricingConfig],
  );
  const finalAmountToPay = useMemo(
    () => Number((checkoutAmount + shippingFee).toFixed(2)),
    [checkoutAmount, shippingFee],
  );
  const shippingRemainingAmount = useMemo(() => {
    if (shippingFee <= 0) {
      return 0;
    }
    const threshold =
      typeof badgeFreeShippingThreshold === "number"
        ? badgeFreeShippingThreshold
        : shippingPricingConfig.freeShippingThresholdEur;
    return Number(Math.max(threshold - checkoutAmount, 0).toFixed(2));
  }, [badgeFreeShippingThreshold, checkoutAmount, shippingFee, shippingPricingConfig.freeShippingThresholdEur]);
  const shippingProgressMessage = useMemo(
    () =>
      getFreeShippingProgressMessage({
        shippingFee,
        shippingRemainingAmount,
        badgeFreeShippingThresholdEur: badgeFreeShippingThreshold,
      }),
    [badgeFreeShippingThreshold, shippingFee, shippingRemainingAmount],
  );
  const earnedProductBonusPoints = useMemo(
    () =>
      items.reduce((total, item) => {
        const bonusPoints =
          Number.isFinite(Number(item.bonusPoints)) && Number(item.bonusPoints) > 0
            ? Math.floor(Number(item.bonusPoints))
            : 0;
        return total + bonusPoints;
      }, 0),
    [items],
  );
  const earnedBaseLoyaltyPoints = useMemo(
    () => Math.max(0, Math.floor(finalAmountToPay)),
    [finalAmountToPay],
  );
  const earnedTotalLoyaltyPoints = useMemo(
    () => earnedBaseLoyaltyPoints + earnedProductBonusPoints,
    [earnedBaseLoyaltyPoints, earnedProductBonusPoints],
  );
  const ticketBreakdown = useMemo(() => computeLotteryTicketBreakdown({
    orderAmount: finalAmountToPay,
    config: lotteryConfig,
    badgeId: loyalty.currentBadge.id,
    badgeUnlocked: isAuthenticated && loyalty.currentBadge.unlocked,
  }), [
    finalAmountToPay,
    isAuthenticated,
    loyalty.currentBadge.id,
    loyalty.currentBadge.unlocked,
    lotteryConfig,
  ]);
  const estimatedEarnedTickets = ticketBreakdown.totalTickets;
  const displayedBadgeDiscountPercent =
    lotteryPreview?.badgeDiscountPercent ?? promoPreview?.badgeDiscountPercent ?? badgeDiscountPercent;
  const displayedBadgeDiscountAmount =
    lotteryPreview?.badgeDiscountAmount ?? promoPreview?.badgeDiscountAmount ?? badgeDiscountAmount;
  const loyaltyBenefitLines = useMemo(() => {
    const lines = parseBadgeBenefitsLines(getBadgeBenefitsText(cmsStore.content.profile, loyalty.currentBadge.id));
    return [
      `Badge actif : ${loyalty.currentBadge.label}`,
      `Reduction automatique : ${displayedBadgeDiscountPercent}%`,
      `Livraison : ${
        badgeFreeShippingThreshold === null
          ? "Offerte"
          : typeof badgeFreeShippingThreshold === "number"
            ? `Offerte des ${badgeFreeShippingThreshold} EUR`
            : "Seuil standard"
      }`,
      `Points gagnes sur cette commande : ${earnedTotalLoyaltyPoints}`,
      ...lines,
    ];
  }, [
    cmsStore.content.profile,
    displayedBadgeDiscountPercent,
    earnedTotalLoyaltyPoints,
    badgeFreeShippingThreshold,
    loyalty.currentBadge.id,
    loyalty.currentBadge.label,
  ]);
  const packsBenefitLines = useMemo(() => {
    const badgeExtraPacks = loyalty.currentBadge.unlocked
      ? getBadgeExtraBoosterPacksPerOrder(loyalty.currentBadge.id)
      : 0;

    return [
      `Base commande : ${ticketBreakdown.baseTickets} pack${ticketBreakdown.baseTickets > 1 ? "s" : ""}`,
      `Bonus badge ${loyalty.currentBadge.label} : ${badgeExtraPacks} pack${badgeExtraPacks > 1 ? "s" : ""}`,
      `Total sur cette commande : ${ticketBreakdown.totalTickets} pack${ticketBreakdown.totalTickets > 1 ? "s" : ""}`,
      `Regle de base : 1 pack tous les ${ticketBreakdown.thresholdEur.toFixed(2)} EUR TTC`,
      `Plafond packs de base : ${ticketBreakdown.maxBaseTicketsPerOrder} par commande`,
    ];
  }, [
    loyalty.currentBadge.id,
    loyalty.currentBadge.label,
    loyalty.currentBadge.unlocked,
    ticketBreakdown.baseTickets,
    ticketBreakdown.maxBaseTicketsPerOrder,
    ticketBreakdown.thresholdEur,
    ticketBreakdown.totalTickets,
  ]);
  const checkoutEligibility = useMemo(
    () => (user ? getCustomerCheckoutEligibility(user) : { allowed: false }),
    [user],
  );

  const canCheckout = useMemo(
    () =>
      Boolean(
        shippingName.trim() &&
          shippingEmail.trim() &&
          shippingPhone.trim() &&
          (deliveryMethod === "relay" || shippingAddress.trim()) &&
          shippingCity.trim() &&
          shippingPostalCode.trim() &&
          shippingCountry.trim() &&
          (deliveryMethod === "home" || selectedRelayPoint),
      ),
    [
      deliveryMethod,
      selectedRelayPoint,
      shippingAddress,
      shippingCity,
      shippingCountry,
      shippingEmail,
      shippingName,
      shippingPhone,
      shippingPostalCode,
    ],
  );

  const applyPromoCode = async () => {
    setPromoError(null);
    setPromoSuccess(null);
    setLotteryError(null);

    if (selectedLotteryRewardClaimId) {
      setPromoError("Le bon loterie n'est pas cumulable avec un code promo.");
      return;
    }

    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoError("Saisis un code promo.");
      return;
    }

    setPromoLoading(true);
    try {
      const response = await fetch("/api/checkout/viva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "validate_promo",
          amount: totalPrice,
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
          promoCode: code,
        }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        code?: string;
        promoDiscountPercent?: number;
        promoDiscountAmount?: number;
        badgeDiscountPercent?: number;
        badgeDiscountAmount?: number;
        discountedTotal?: number;
        error?: string;
      };

      if (!response.ok || !data.valid || !data.code) {
        setPromoPreview(null);
        setPromoError(data.error ?? "Code promo invalide.");
        return;
      }

      setPromoPreview({
        code: data.code,
        promoDiscountPercent: data.promoDiscountPercent ?? 0,
        promoDiscountAmount: data.promoDiscountAmount ?? 0,
        badgeDiscountPercent: data.badgeDiscountPercent ?? badgeDiscountPercent,
        badgeDiscountAmount: data.badgeDiscountAmount ?? badgeDiscountAmount,
        discountedTotal: data.discountedTotal ?? totalAfterBadgeDiscount,
      });
      setPromoSuccess(
        `Code ${data.code} applique (${data.promoDiscountPercent ?? 0}% de reduction code).`,
      );
    } catch {
      setPromoPreview(null);
      setPromoError("Impossible de vérifier le code promo.");
    } finally {
      setPromoLoading(false);
    }
  };

  const applyLotteryRewardClaim = async () => {
    setLotteryError(null);
    setLotterySuccess(null);
    setPromoError(null);

    if (!selectedLotteryRewardClaimId) {
      setLotteryError("Selectionne un bon loterie.");
      return;
    }

    if (promoCode.trim()) {
      setLotteryError("Le bon loterie n'est pas cumulable avec un code promo.");
      return;
    }

    setLotteryLoading(true);
    try {
      const response = await fetch("/api/checkout/viva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "validate_reward_claim",
          amount: totalPrice,
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
          lotteryRewardClaimId: selectedLotteryRewardClaimId,
        }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        claimId?: string;
        rewardType?: "discount" | "gift";
        rewardTitle?: string;
        rewardDescription?: string;
        generatedCode?: string;
        giftLabel?: string;
        lotteryDiscountPercent?: number;
        lotteryDiscountAmount?: number;
        badgeDiscountPercent?: number;
        badgeDiscountAmount?: number;
        discountedTotal?: number;
        error?: string;
      };

      if (!response.ok || !data.valid || !data.claimId || !data.rewardType || !data.rewardTitle) {
        setLotteryPreview(null);
        setLotteryError(data.error ?? "Bon loterie invalide.");
        return;
      }

      setLotteryPreview({
        claimId: data.claimId,
        rewardType: data.rewardType,
        rewardTitle: data.rewardTitle,
        rewardDescription: data.rewardDescription ?? "",
        generatedCode: data.generatedCode,
        giftLabel: data.giftLabel,
        lotteryDiscountPercent: data.lotteryDiscountPercent ?? 0,
        lotteryDiscountAmount: data.lotteryDiscountAmount ?? 0,
        badgeDiscountPercent: data.badgeDiscountPercent ?? badgeDiscountPercent,
        badgeDiscountAmount: data.badgeDiscountAmount ?? badgeDiscountAmount,
        discountedTotal: data.discountedTotal ?? totalAfterBadgeDiscount,
      });
      setPromoCode("");
      setPromoPreview(null);
      setPromoSuccess(null);
      setLotterySuccess(
        data.rewardType === "discount"
          ? `Bon ${data.rewardTitle} applique (${data.lotteryDiscountPercent ?? 0}% de reduction).`
          : `Bon ${data.rewardTitle} applique (cadeau ajoute a la commande).`,
      );
    } catch {
      setLotteryPreview(null);
      setLotteryError("Impossible de verifier le bon loterie.");
    } finally {
      setLotteryLoading(false);
    }
  };

  const goToLogin = () => {
    const nextPath =
      typeof window === "undefined"
        ? "/boutique"
        : `${window.location.pathname}${window.location.search}`;
    onClose();
    router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  };

  const goToProfile = () => {
    onClose();
    router.push("/profil");
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-label="Fermer le panier"
        />
      )}

      <aside
        className={`safe-area-top safe-area-bottom safe-area-x fixed right-0 top-0 z-50 flex h-[100vh] h-[100dvh] max-h-[100dvh] w-full max-w-[96vw] flex-col overflow-hidden border-l-4 border-[#1a1a2e] bg-[#fff8f0] p-4 transition-transform duration-300 md:max-w-2xl lg:max-w-3xl ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Ton Panier ({totalItems})</h2>
          <button
            type="button"
            className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 pb-4">
            {items.length === 0 && (
              <div className="cartoon-panel bg-white p-5 text-sm">
                {authLoading
                  ? "Vérification de la session..."
                  : isAuthenticated
                    ? "Ton panier est vide. Ajoute quelques produits fun."
                    : "Connecte-toi pour ajouter des produits au panier."}
                {!authLoading && !isAuthenticated && (
                  <div className="mt-3">
                    <button type="button" onClick={goToLogin} className="btn-cartoon btn-primary h-10 px-3 text-xs">
                      Se connecter
                    </button>
                  </div>
                )}
              </div>
            )}

            {cartError && (
              <div className="cartoon-panel border-[#7f1d1d] bg-[#f8d7da] p-4 text-sm font-semibold text-[#7f1d1d]">
                {cartError}
              </div>
            )}

            {items.map((item) => {
              const [, itemVariantId = ""] = item.id.split("::", 2);
              const itemAvailableQuantity = getAvailableQuantity(item, itemVariantId);

              return (
                <article key={item.id} className="cartoon-panel bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      {hasActiveProductPromo(item) ? (
                        <div className="text-sm">
                          <span className="price-original">{formatPrice(item.originalPrice)}</span>{" "}
                          <span className="price-promo">{formatPrice(item.price)}</span>{" "}
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                        </div>
                      ) : (
                        <p className="text-sm">
                          {formatPrice(item.price)}{" "}
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCartError(null);
                        removeFromCart(item.id);
                      }}
                      className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
                      aria-label={`Retirer ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCartError(null);
                        decreaseQuantity(item.id);
                      }}
                      className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
                      aria-label={`Diminuer ${item.name}`}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={itemAvailableQuantity ?? 999}
                      value={item.quantity}
                      onChange={(e) => {
                        const value = Number.parseInt(e.target.value, 10);
                        if (Number.isNaN(value) || value < 1) {
                          return;
                        }

                        const result = setQuantity(item.id, value);
                        if (!result.ok && result.reason === "stock_limit") {
                          setCartError(buildCartStockError(item.name, result.maxAvailable));
                          return;
                        }

                        setCartError(null);
                      }}
                      className="h-[44px] w-16 border-2 border-[#1a1a1a] bg-white text-center text-sm font-bold"
                      aria-label={`Quantite ${item.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const result = addToCart(item);
                        if (result.ok) {
                          setCartError(null);
                          return;
                        }

                        if (result.reason === "stock_limit") {
                          setCartError(buildCartStockError(item.name, result.maxAvailable));
                          return;
                        }

                        if (result.reason === "unauthenticated") {
                          goToLogin();
                        }
                      }}
                      disabled={itemAvailableQuantity !== null && item.quantity >= itemAvailableQuantity}
                      className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Augmenter ${item.name}`}
                    >
                      <Plus size={16} />
                    </button>
                    <p className="ml-auto font-bold">
                      {formatPrice(item.quantity * item.price)}{" "}
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                    </p>
                  </div>
                </article>
              );
            })}

            <div className="cartoon-panel bg-white p-4">
              <div className="mt-4 grid gap-2">
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  value={shippingName}
                  onChange={(event) => setShippingName(event.target.value)}
                  placeholder="Nom complet"
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  type="email"
                  value={shippingEmail}
                  onChange={(event) => setShippingEmail(event.target.value)}
                  placeholder="Email"
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  value={shippingPhone}
                  onChange={(event) => setShippingPhone(event.target.value)}
                  placeholder="Téléphone"
                />
                <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                    Mode de livraison
                  </p>
                  <div className="mt-2 inline-flex w-full overflow-hidden rounded border-2 border-[#1a1a1a] bg-white">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
                        deliveryMethod === "home"
                          ? "bg-[#0a7b61] text-white"
                          : "text-ink hover:bg-[#f2ede2]"
                      }`}
                      onClick={() => setDeliveryMethod("home")}
                    >
                      Domicile
                    </button>
                    <button
                      type="button"
                      className={`flex-1 border-l-2 border-[#1a1a1a] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
                        deliveryMethod === "relay"
                          ? "bg-[#0a7b61] text-white"
                          : "text-ink hover:bg-[#f2ede2]"
                      }`}
                      onClick={() => setDeliveryMethod("relay")}
                    >
                      Point relais
                    </button>
                  </div>
                </div>
                {deliveryMethod === "home" && (
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={shippingAddress}
                    onChange={(event) => setShippingAddress(event.target.value)}
                    placeholder="Adresse"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={shippingCity}
                    onChange={(event) => setShippingCity(event.target.value)}
                    placeholder="Ville"
                  />
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={shippingPostalCode}
                    onChange={(event) => setShippingPostalCode(event.target.value)}
                    placeholder="Code postal"
                  />
                </div>
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  value={shippingCountry}
                  onChange={(event) => setShippingCountry(event.target.value)}
                  placeholder="Pays"
                />
                {deliveryMethod === "relay" && (
                  <MondialRelayPicker
                    postalCode={shippingPostalCode}
                    city={shippingCity}
                    country={shippingCountry}
                    selectedPoint={selectedRelayPoint}
                    onSelect={setSelectedRelayPoint}
                    minHeightClassName="min-h-[300px] md:min-h-[360px]"
                  />
                )}
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={promoCode}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      setPromoCode(value);
                      if (value.trim()) {
                        setSelectedLotteryRewardClaimId("");
                      }
                    }}
                    placeholder="Code promo (optionnel)"
                    disabled={Boolean(selectedLotteryRewardClaimId)}
                  />
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                    disabled={promoLoading || items.length === 0 || Boolean(selectedLotteryRewardClaimId)}
                    onClick={applyPromoCode}
                  >
                    {promoLoading ? "..." : "Appliquer"}
                  </button>
                </div>
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <select
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={selectedLotteryRewardClaimId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedLotteryRewardClaimId(nextId);
                      if (nextId) {
                        setPromoCode("");
                        setPromoPreview(null);
                        setPromoError(null);
                        setPromoSuccess(null);
                      }
                    }}
                    disabled={availableRewardClaims.length === 0 || promoCode.trim().length > 0}
                  >
                    <option value="">Bon loterie (optionnel)</option>
                    {availableRewardClaims.map((claim) => (
                      <option key={claim.id} value={claim.id}>
                        {claim.reward.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                    disabled={lotteryLoading || !selectedLotteryRewardClaimId || items.length === 0 || promoCode.trim().length > 0}
                    onClick={applyLotteryRewardClaim}
                  >
                    {lotteryLoading ? "..." : "Utiliser bon"}
                  </button>
                </div>
                {promoError && <p className="text-sm font-semibold text-red-700">{promoError}</p>}
                {promoSuccess && <p className="text-sm font-semibold text-green-700">{promoSuccess}</p>}
                {lotteryError && <p className="text-sm font-semibold text-red-700">{lotteryError}</p>}
                {lotterySuccess && <p className="text-sm font-semibold text-green-700">{lotterySuccess}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="cartoon-panel mt-2 shrink-0 bg-white p-3">
          <div className="flex items-center justify-between text-base font-extrabold">
            <span>Total panier</span>
            <span>{formatPrice(totalPrice)} TTC</span>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
            Livraison: {deliveryMethod === "relay" ? "Point relais" : "Domicile"}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-charcoal">
            {shippingProgressMessage}
          </div>
          {displayedBadgeDiscountPercent > 0 && (
            <div className="mt-1 text-xs text-green-700">
              Fidélité ({loyalty.currentBadge.label}): -{formatPrice(displayedBadgeDiscountAmount)} ({displayedBadgeDiscountPercent}%)
            </div>
          )}
          {hasAutoReferralDiscount && (
            <div className="mt-1 text-xs text-green-700">
              Filleul 1ère commande: -{formatPrice(referralAutoDiscountAmount)} ({REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT}%)
            </div>
          )}
          {promoPreview && (
            <div className="mt-1 text-xs text-green-700">
              Code {promoPreview.code}: -{formatPrice(promoPreview.promoDiscountAmount)} ({promoPreview.promoDiscountPercent}%)
            </div>
          )}
          {lotteryPreview?.rewardType === "discount" && (
            <div className="mt-1 text-xs text-green-700">
              Bon {lotteryPreview.rewardTitle}: -{formatPrice(lotteryPreview.lotteryDiscountAmount)} ({lotteryPreview.lotteryDiscountPercent}%)
            </div>
          )}
          {lotteryPreview?.rewardType === "gift" && (
            <div className="mt-1 text-xs text-green-700">
              Bon {lotteryPreview.rewardTitle}: lot ajouté
            </div>
          )}
          <div className="mt-1 flex items-center justify-between text-xs text-ink">
            <span>Livraison</span>
            <span>{shippingFee <= 0 ? "Offerte" : formatPrice(shippingFee)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm font-bold text-ink">
            <span>À payer</span>
            <span>{formatPrice(finalAmountToPay)} TTC</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSummaryModal("loyalty")}
              className="rounded border border-[#1a1a1a] bg-[#fff7d6] px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-[1px]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-charcoal">Fidélité</p>
              <p className="text-xs font-semibold text-ink">+{earnedTotalLoyaltyPoints} pt{earnedTotalLoyaltyPoints > 1 ? "s" : ""}</p>
            </button>
            <button
              type="button"
              onClick={() => setSummaryModal("packs")}
              className="rounded border border-[#1a1a1a] bg-[#f7f4ee] px-2 py-1.5 text-left transition-transform duration-150 hover:-translate-y-[1px]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-charcoal">Packs</p>
              {!isAuthenticated || !lotteryConfig?.isActive ? (
                <p className="text-xs text-charcoal">—</p>
              ) : (
                <p className="text-xs font-semibold text-ink">+{estimatedEarnedTickets} pack{estimatedEarnedTickets > 1 ? "s" : ""}</p>
              )}
            </button>
          </div>
          <div className="mt-3">
            <CheckoutButton
              amount={totalPrice}
              amountToPay={finalAmountToPay}
              itemsCount={totalItems}
              items={items.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
              }))}
              shipping={{
                name: shippingName,
                email: shippingEmail,
                phone: shippingPhone,
                address: shippingAddress,
                city: shippingCity,
                postalCode: shippingPostalCode,
                country: shippingCountry,
                deliveryMethod,
                deliveryFeeEur: shippingFee,
                relayId: deliveryMethod === "relay" ? selectedRelayPoint?.id : undefined,
                relayName: deliveryMethod === "relay" ? selectedRelayPoint?.name : undefined,
                relayAddress:
                  deliveryMethod === "relay" ? selectedRelayPoint?.address : undefined,
                relayPostalCode:
                  deliveryMethod === "relay" ? selectedRelayPoint?.postalCode : undefined,
                relayCity: deliveryMethod === "relay" ? selectedRelayPoint?.city : undefined,
                relayCountry:
                  deliveryMethod === "relay" ? selectedRelayPoint?.country : undefined,
              }}
              promoCode={promoPreview?.code || undefined}
              lotteryRewardClaimId={lotteryPreview?.claimId || undefined}
              disabled={!canCheckout || authLoading || !isAuthenticated || !checkoutEligibility.allowed}
              onSuccess={() => {
                clearCart();
                setPromoCode("");
                setPromoPreview(null);
                setPromoError(null);
                setPromoSuccess(null);
                setSelectedLotteryRewardClaimId("");
                setLotteryPreview(null);
                setLotteryError(null);
                setLotterySuccess(null);
              }}
            />
            {!authLoading && !isAuthenticated && (
              <p className="mt-2 text-xs font-semibold text-charcoal">
                Connecte-toi pour passer commande.
              </p>
            )}
            {!canCheckout && items.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-charcoal">
                {deliveryMethod === "relay" && !selectedRelayPoint
                  ? "Sélectionne un Point Relais pour payer."
                  : "Compléter les informations de livraison pour payer."}
              </p>
            )}
            {!authLoading && isAuthenticated && !checkoutEligibility.allowed && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-charcoal">
                  {checkoutEligibility.error ?? "Profil non éligible à la commande."}
                </p>
                <button
                  type="button"
                  onClick={goToProfile}
                  className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                >
                  Compléter mon profil
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <CartBenefitSummaryModal
        open={summaryModal === "loyalty"}
        onClose={() => setSummaryModal(null)}
        eyebrow="Fidelite"
        title={loyalty.currentBadge.label}
        hint="Le recapitulatif applique automatiquement les avantages de ton badge sur cette commande."
        lines={loyaltyBenefitLines}
      />
      <CartBenefitSummaryModal
        open={summaryModal === "packs"}
        onClose={() => setSummaryModal(null)}
        eyebrow="Packs booster"
        title="Recap packs"
        hint="Les packs bonus badge s'ajoutent aux packs de base generes par le montant de la commande."
        lines={packsBenefitLines}
      />
    </>
  );
}
