"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import { categoryLabels } from "@/data/products";
import styles from "./CartDrawer.module.css";
import dynamic from "next/dynamic";
import { useRouter } from "@/components/navigation/NavigationFeedback";
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
  getBadgeHomeDeliveryFeeEur,
  getBadgeRelayFreeShippingThreshold,
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
  getRelayFreeShippingProgressMessage,
  getRelayFreeShippingThreshold,
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
  const drawerRef = useRef<HTMLDialogElement>(null);
  const wasOpenRef = useRef(false);
  useBodyScrollLock(open);
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (open && !drawer.open) drawer.showModal();
    else if (!open && drawer.open) drawer.close();
    return () => { if (drawer.open) drawer.close(); };
  }, [open]);

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
  const badgeRelayFreeShippingThreshold = useMemo(
    () => getBadgeRelayFreeShippingThreshold(loyalty.currentBadge.id, loyalty.currentBadge.unlocked),
    [loyalty.currentBadge.id, loyalty.currentBadge.unlocked],
  );
  const badgeHomeDeliveryFeeEur = useMemo(
    () => getBadgeHomeDeliveryFeeEur(loyalty.currentBadge.id, loyalty.currentBadge.unlocked),
    [loyalty.currentBadge.id, loyalty.currentBadge.unlocked],
  );
  const homeShippingFee = useMemo(
    () =>
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: checkoutAmount,
        config: shippingPricingConfig,
        badgeRelayFreeShippingThresholdEur: badgeRelayFreeShippingThreshold,
        badgeHomeFeeEur: badgeHomeDeliveryFeeEur,
      }),
    [badgeHomeDeliveryFeeEur, badgeRelayFreeShippingThreshold, checkoutAmount, shippingPricingConfig],
  );
  const relayShippingFee = useMemo(
    () =>
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: checkoutAmount,
        config: shippingPricingConfig,
        badgeRelayFreeShippingThresholdEur: badgeRelayFreeShippingThreshold,
      }),
    [badgeRelayFreeShippingThreshold, checkoutAmount, shippingPricingConfig],
  );
  const shippingFee = deliveryMethod === "relay" ? relayShippingFee : homeShippingFee;
  const relayFreeShippingThreshold = useMemo(
    () =>
      getRelayFreeShippingThreshold({
        config: shippingPricingConfig,
        badgeRelayFreeShippingThresholdEur: badgeRelayFreeShippingThreshold,
      }),
    [badgeRelayFreeShippingThreshold, shippingPricingConfig],
  );
  const finalAmountToPay = useMemo(
    () => Number((checkoutAmount + shippingFee).toFixed(2)),
    [checkoutAmount, shippingFee],
  );
  const relayRemainingAmount = useMemo(() => {
    if (relayShippingFee <= 0 || relayFreeShippingThreshold === null) {
      return 0;
    }
    return Number(Math.max(relayFreeShippingThreshold - checkoutAmount, 0).toFixed(2));
  }, [checkoutAmount, relayFreeShippingThreshold, relayShippingFee]);
  const shippingProgressMessage = useMemo(
    () =>
      getRelayFreeShippingProgressMessage({
        shippingFee: relayShippingFee,
        shippingRemainingAmount: relayRemainingAmount,
        badgeRelayFreeShippingThresholdEur: badgeRelayFreeShippingThreshold,
      }),
    [badgeRelayFreeShippingThreshold, relayRemainingAmount, relayShippingFee],
  );
  const homeDeliveryExplanation = useMemo(() => {
    if (!isAuthenticated || typeof badgeHomeDeliveryFeeEur !== "number") {
      return "Les frais sont calculés selon le mode de livraison choisi.";
    }
    if (homeShippingFee <= 0) {
      return "Ton niveau t'offre la livraison a domicile.";
    }

    if (typeof badgeHomeDeliveryFeeEur === "number" && checkoutAmount < (relayFreeShippingThreshold ?? 0)) {
      return "Le tarif reduit a domicile s'applique des que le seuil de ton niveau est atteint.";
    }

    return "Le tarif reduit de ton niveau est applique a la livraison a domicile.";
  }, [isAuthenticated, badgeHomeDeliveryFeeEur, checkoutAmount, homeShippingFee, relayFreeShippingThreshold]);
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
        relayFreeShippingThreshold === null
          ? "Point relais offert"
          : `Point relais offert des ${relayFreeShippingThreshold} EUR`
      } / ${
        homeShippingFee <= 0
          ? "Domicile offert"
          : typeof badgeHomeDeliveryFeeEur === "number"
            ? `Domicile a ${formatPrice(homeShippingFee)}`
            : "Domicile au tarif standard"
      }`,
      `Points gagnes sur cette commande : ${earnedTotalLoyaltyPoints}`,
      ...lines,
    ];
  }, [
    cmsStore.content.profile,
    displayedBadgeDiscountPercent,
    earnedTotalLoyaltyPoints,
    badgeHomeDeliveryFeeEur,
    loyalty.currentBadge.id,
    loyalty.currentBadge.label,
    homeShippingFee,
    relayFreeShippingThreshold,
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
      setPromoError("La récompense n'est pas cumulable avec un code promo.");
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
      setLotteryError("Sélectionne une récompense.");
      return;
    }

    if (promoCode.trim()) {
      setLotteryError("La récompense n'est pas cumulable avec un code promo.");
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
        setLotteryError(data.error ?? "Récompense invalide.");
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
      setLotteryError("Impossible de vérifier la récompense.");
    } finally {
      setLotteryLoading(false);
    }
  };

  const goToLogin = () => {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("panier", "1");
    const nextPath = returnUrl.pathname + returnUrl.search;
    onClose();
    router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  };

  const goToProfile = () => {
    onClose();
    router.push("/profil?tab=infos");
  };

  return (
    <>
      <dialog
        ref={drawerRef}
        aria-label="Ton panier"
        className={styles.drawer}
        onCancel={(event) => { event.preventDefault(); onClose(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Les Chanvriers Bretons · Le Marché</p>
            <h2>Ton panier<span className={styles.itemCount}>{totalItems}</span></h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer le panier" autoFocus>
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.scrollArea}>
          <div className={styles.content} data-empty={items.length === 0}>
          <div className={styles.items}>
            {items.length === 0 && (
              <div className={styles.emptyCart}>
                <span className={styles.emptyIcon}><ShoppingBag size={36} strokeWidth={1.5} aria-hidden="true" /></span>
                <p className={styles.kicker}>Le Marché t’attend</p>
                <h3>Une belle récolte<br />à composer.</h3>
                <p>Ton panier est vide. Découvre les produits disponibles et ajoute tes favoris.</p>
                <div className="mt-3">
                  <button type="button" onClick={() => { onClose(); router.push("/boutique"); }} className="btn-cartoon btn-primary min-h-11 px-3 text-xs">
                    Découvrir les produits
                  </button>
                </div>
              </div>
            )}

            {cartError && (
              <div className={styles.error} role="alert">
                {cartError}
              </div>
            )}

            {items.map((item) => {
              const [, itemVariantId = ""] = item.id.split("::", 2);
              const itemAvailableQuantity = getAvailableQuantity(item, itemVariantId);

              return (
                <article key={item.id} className={styles.product}>
                  <div className={styles.productHead}>
                    <div className={styles.productImage}>
                      {item.image ? <Image src={item.image} alt="" width={88} height={88} sizes="88px" /> : <ShoppingBag aria-hidden="true" />}
                    </div>
                    <div className={styles.productCopy}>
                      <p className={styles.kicker}>{categoryLabels[item.category]}</p>
                      <h3>{item.name}</h3>
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
                      className={styles.iconButton}
                      aria-label={`Retirer ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className={styles.quantityRow}>
                    <button
                      type="button"
                      onClick={() => {
                        setCartError(null);
                        decreaseQuantity(item.id);
                      }}
                      className={styles.iconButton}
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
                      className={styles.quantityInput}
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
                      className={styles.iconButton}
                      aria-label={`Augmenter ${item.name}`}
                    >
                      <Plus size={16} />
                    </button>
                    <p className={styles.lineTotal}>
                      {formatPrice(item.quantity * item.price)}{" "}
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
                    </p>
                  </div>
                </article>
              );
            })}

            {isAuthenticated && items.length > 0 && <section className={styles.delivery}>
              <p className={styles.kicker}>À la bonne adresse</p>
              <h3>Ta livraison</h3>
              <div className="mt-4 grid gap-2">
                <input
                  className={styles.input}
                  value={shippingName}
                  onChange={(event) => setShippingName(event.target.value)}
                  aria-label="Nom complet"
                  autoComplete="name"
                  placeholder="Nom complet"
                />
                <input
                  className={styles.input}
                  type="email"
                  value={shippingEmail}
                  onChange={(event) => setShippingEmail(event.target.value)}
                  aria-label="Email"
                  autoComplete="email"
                  placeholder="Email"
                />
                <input
                  className={styles.input}
                  value={shippingPhone}
                  onChange={(event) => setShippingPhone(event.target.value)}
                  aria-label="Téléphone"
                  autoComplete="tel"
                  placeholder="Téléphone"
                />
                <div className={styles.deliveryOptions}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                    Mode de livraison
                  </p>
                  <div className={styles.deliverySwitch} role="group" aria-label="Mode de livraison">
                    <button
                      type="button"
                      className={styles.deliveryChoice}
                      aria-pressed={deliveryMethod === "home"}
                      onClick={() => setDeliveryMethod("home")}
                    >
                      Domicile {homeShippingFee <= 0 ? "(offert)" : `(${formatPrice(homeShippingFee)})`}
                    </button>
                    <button
                      type="button"
                      className={styles.deliveryChoice}
                      aria-pressed={deliveryMethod === "relay"}
                      onClick={() => setDeliveryMethod("relay")}
                    >
                      Point relais {relayShippingFee <= 0 ? "(offert)" : `(${formatPrice(relayShippingFee)})`}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-charcoal">
                    {homeDeliveryExplanation}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-charcoal">
                    {shippingProgressMessage}
                  </p>
                </div>
                {deliveryMethod === "home" && (
                  <input
                    aria-label="Adresse de livraison"
                    className={styles.input}
                    value={shippingAddress}
                    onChange={(event) => setShippingAddress(event.target.value)}
                    placeholder="Adresse"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={styles.input}
                    value={shippingCity}
                    onChange={(event) => setShippingCity(event.target.value)}
                    aria-label="Ville"
                  autoComplete="address-level2"
                  placeholder="Ville"
                  />
                  <input
                    className={styles.input}
                    value={shippingPostalCode}
                    onChange={(event) => setShippingPostalCode(event.target.value)}
                    aria-label="Code postal"
                  autoComplete="postal-code"
                  placeholder="Code postal"
                  />
                </div>
                <input
                  className={styles.input}
                  value={shippingCountry}
                  onChange={(event) => setShippingCountry(event.target.value)}
                  aria-label="Pays"
                  autoComplete="country-name"
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
                <div className={styles.codeRow}>
                  <input
                    className={styles.input}
                    value={promoCode}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      setPromoCode(value);
                      if (value.trim()) {
                        setSelectedLotteryRewardClaimId("");
                      }
                    }}
                    aria-label="Code promo (optionnel)"
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
                <div className={styles.codeRow}>
                  <select
                    aria-label="Bon ou cadeau à utiliser"
                    className={styles.input}
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
                    <option value="">Bon / cadeau (optionnel)</option>
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
                    {lotteryLoading ? "..." : "Utiliser"}
                  </button>
                </div>
                {promoError && <p className="text-sm font-semibold text-red-700">{promoError}</p>}
                {promoSuccess && <p className="text-sm font-semibold text-green-700">{promoSuccess}</p>}
                {lotteryError && <p className="text-sm font-semibold text-red-700">{lotteryError}</p>}
                {lotterySuccess && <p className="text-sm font-semibold text-green-700">{lotterySuccess}</p>}
              </div>
            </section>}
          </div>

        {items.length > 0 && <section className={styles.summary} aria-label="Récapitulatif de la commande">
          <p className={styles.kicker}>Le récapitulatif</p>
          <h3>Ta commande</h3>
          <div className="flex items-center justify-between text-base font-extrabold">
            <span>Total panier</span>
            <span>{formatPrice(totalPrice)} TTC</span>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
            Livraison: {deliveryMethod === "relay" ? "Point relais" : "Domicile"}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-charcoal">
            {homeDeliveryExplanation}
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
          <div className={styles.grandTotal}>
            <span>{isAuthenticated ? "À payer" : "Total estimé"}</span>
            <span>{formatPrice(finalAmountToPay)} TTC</span>
          </div>
          {isAuthenticated && <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSummaryModal("loyalty")}
              className={styles.benefit}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-charcoal">Fidélité</p>
              <p className="text-xs font-semibold text-ink">+{earnedTotalLoyaltyPoints} pt{earnedTotalLoyaltyPoints > 1 ? "s" : ""}</p>
            </button>
            <button
              type="button"
              onClick={() => setSummaryModal("packs")}
              className={styles.benefit}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-charcoal">Packs</p>
              {!isAuthenticated || !lotteryConfig?.isActive ? (
                <p className="text-xs text-charcoal">—</p>
              ) : (
                <p className="text-xs font-semibold text-ink">+{estimatedEarnedTickets} pack{estimatedEarnedTickets > 1 ? "s" : ""}</p>
              )}
            </button>
          </div>}
          <div className={styles.checkoutArea}>
            {isAuthenticated && <>
            <ol className={styles.steps} aria-label="Étapes de la commande">
              <li>1. Coordonnées</li>
              <li>2. Récapitulatif</li>
              <li>3. Paiement</li>
            </ol>
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
              cartSnapshot={items}
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
            </>}
            {!authLoading && !isAuthenticated && items.length > 0 && (
              <div className="space-y-2">
                <div className={styles.deliverySwitch} role="group" aria-label="Estimer la livraison">
                  <button type="button" aria-pressed={deliveryMethod === "home"} className={styles.deliveryChoice} onClick={() => setDeliveryMethod("home")}>Domicile</button>
                  <button type="button" aria-pressed={deliveryMethod === "relay"} className={styles.deliveryChoice} onClick={() => setDeliveryMethod("relay")}>Point relais</button>
                </div>
                <p className="text-xs text-charcoal">Ton panier est conservé sur ce navigateur pendant 48 h. Connecte-toi ou crée ton compte pour poursuivre la commande.</p>
                <button type="button" onClick={goToLogin} className="btn-cartoon btn-primary min-h-11 w-full px-3 py-3 text-sm">Continuer ma commande</button>
                <button type="button" onClick={onClose} className="min-h-11 w-full text-sm font-bold underline">Continuer mes achats</button>
              </div>
            )}
            {isAuthenticated && !canCheckout && items.length > 0 && (
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
        </section>}
          </div>
        </div>
      </dialog>
      <CartBenefitSummaryModal
        open={open && summaryModal === "loyalty"}
        onClose={() => setSummaryModal(null)}
        eyebrow="Fidelite"
        title={loyalty.currentBadge.label}
        hint="Le recapitulatif applique automatiquement les avantages de ton badge sur cette commande."
        lines={loyaltyBenefitLines}
      />
      <CartBenefitSummaryModal
        open={open && summaryModal === "packs"}
        onClose={() => setSummaryModal(null)}
        eyebrow="Packs booster"
        title="Recap packs"
        hint="Les packs bonus badge s'ajoutent aux packs de base generes par le montant de la commande."
        lines={packsBenefitLines}
      />
    </>
  );
}
