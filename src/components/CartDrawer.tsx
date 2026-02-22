"use client";

import { Minus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckoutButton } from "@/components/CheckoutButton";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import { getCustomerCheckoutEligibility } from "@/lib/customer-checkout-eligibility";
import { getBadgeDiscountPercent } from "@/lib/loyalty-tier-benefits";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";

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
  ticketId: string;
  ticketNumber: string;
  rewardType: "discount" | "gift";
  prizeName: string;
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
    addToCart,
    decreaseQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { user, loyalty, tickets, lotteryConfig } = useCustomerSession();
  const { store: cmsStore } = useCmsStore();

  const [shippingName, setShippingName] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("France");
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [selectedLotteryTicketId, setSelectedLotteryTicketId] = useState("");
  const [lotteryLoading, setLotteryLoading] = useState(false);
  const [lotteryError, setLotteryError] = useState<string | null>(null);
  const [lotterySuccess, setLotterySuccess] = useState<string | null>(null);
  const [lotteryPreview, setLotteryPreview] = useState<LotteryPreview | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
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
  }, [open, user]);

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

  const redeemableWinningTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status === "scratched" &&
          ticket.isWin === true &&
          !ticket.redeemedAt &&
          Boolean(ticket.prize?.name),
      ),
    [tickets],
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
  }, [selectedLotteryTicketId, totalPrice, badgeDiscountPercent]);

  useEffect(() => {
    if (
      selectedLotteryTicketId &&
      !redeemableWinningTickets.some((ticket) => ticket.id === selectedLotteryTicketId)
    ) {
      setSelectedLotteryTicketId("");
      setLotteryPreview(null);
    }
  }, [redeemableWinningTickets, selectedLotteryTicketId]);

  const checkoutAmount =
    lotteryPreview?.discountedTotal ?? promoPreview?.discountedTotal ?? totalAfterBadgeDiscount;
  const lotteryTicketThreshold = useMemo(() => {
    const threshold = Number(lotteryConfig?.ticketThresholdEuros ?? 20);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return 20;
    }

    return threshold;
  }, [lotteryConfig?.ticketThresholdEuros]);
  const estimatedEarnedTickets = useMemo(() => {
    if (!isAuthenticated || !lotteryConfig?.isActive) {
      return 0;
    }

    return Math.floor(Math.max(checkoutAmount, 0) / lotteryTicketThreshold);
  }, [checkoutAmount, isAuthenticated, lotteryConfig?.isActive, lotteryTicketThreshold]);
  const missingForNextTicket = useMemo(() => {
    if (!isAuthenticated || !lotteryConfig?.isActive) {
      return null;
    }

    const safeAmount = Math.max(checkoutAmount, 0);
    const remainder = safeAmount % lotteryTicketThreshold;
    const missing = remainder === 0 ? lotteryTicketThreshold : lotteryTicketThreshold - remainder;
    return Number(missing.toFixed(2));
  }, [checkoutAmount, isAuthenticated, lotteryConfig?.isActive, lotteryTicketThreshold]);
  const displayedBadgeDiscountPercent =
    lotteryPreview?.badgeDiscountPercent ?? promoPreview?.badgeDiscountPercent ?? badgeDiscountPercent;
  const displayedBadgeDiscountAmount =
    lotteryPreview?.badgeDiscountAmount ?? promoPreview?.badgeDiscountAmount ?? badgeDiscountAmount;
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
          shippingAddress.trim() &&
          shippingCity.trim() &&
          shippingPostalCode.trim() &&
          shippingCountry.trim(),
      ),
    [
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

    if (selectedLotteryTicketId) {
      setPromoError("Le ticket gagnant n'est pas cumulable avec un code promo.");
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
      setPromoError("Impossible de verifier le code promo.");
    } finally {
      setPromoLoading(false);
    }
  };

  const applyLotteryTicket = async () => {
    setLotteryError(null);
    setLotterySuccess(null);
    setPromoError(null);

    if (!selectedLotteryTicketId) {
      setLotteryError("Selectionne un ticket gagnant.");
      return;
    }

    if (promoCode.trim()) {
      setLotteryError("Le ticket gagnant n'est pas cumulable avec un code promo.");
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
          action: "validate_ticket",
          amount: totalPrice,
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
          lotteryTicketId: selectedLotteryTicketId,
        }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        ticketId?: string;
        ticketNumber?: string;
        rewardType?: "discount" | "gift";
        prizeName?: string;
        giftLabel?: string;
        lotteryDiscountPercent?: number;
        lotteryDiscountAmount?: number;
        badgeDiscountPercent?: number;
        badgeDiscountAmount?: number;
        discountedTotal?: number;
        error?: string;
      };

      if (!response.ok || !data.valid || !data.ticketId || !data.ticketNumber || !data.rewardType || !data.prizeName) {
        setLotteryPreview(null);
        setLotteryError(data.error ?? "Ticket gagnant invalide.");
        return;
      }

      setLotteryPreview({
        ticketId: data.ticketId,
        ticketNumber: data.ticketNumber,
        rewardType: data.rewardType,
        prizeName: data.prizeName,
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
          ? `Ticket ${data.ticketNumber} applique (${data.lotteryDiscountPercent ?? 0}% de reduction).`
          : `Ticket ${data.ticketNumber} applique (lot ajoute a la commande).`,
      );
    } catch {
      setLotteryPreview(null);
      setLotteryError("Impossible de verifier le ticket gagnant.");
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
        className={`safe-area-top safe-area-bottom safe-area-x fixed right-0 top-0 z-50 flex h-[100vh] h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden border-l-4 border-[#1a1a2e] bg-[#fff8f0] p-4 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Ton Panier ({totalItems})</h2>
          <button
            type="button"
            className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 pb-4">
            {items.length === 0 && (
              <div className="cartoon-panel bg-white p-5 text-sm">
                {authLoading
                  ? "Verification de la session..."
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

            {items.map((item) => (
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
                    onClick={() => removeFromCart(item.id)}
                    className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
                    aria-label={`Retirer ${item.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decreaseQuantity(item.id)}
                    className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
                    aria-label={`Diminuer ${item.name}`}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const added = addToCart(item);
                      if (!added) {
                        goToLogin();
                      }
                    }}
                    className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3"
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
            ))}

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
                  placeholder="Telephone"
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  value={shippingAddress}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  placeholder="Adresse"
                />
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
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={promoCode}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      setPromoCode(value);
                      if (value.trim()) {
                        setSelectedLotteryTicketId("");
                      }
                    }}
                    placeholder="Code promo (optionnel)"
                    disabled={Boolean(selectedLotteryTicketId)}
                  />
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                    disabled={promoLoading || items.length === 0 || Boolean(selectedLotteryTicketId)}
                    onClick={applyPromoCode}
                  >
                    {promoLoading ? "..." : "Appliquer"}
                  </button>
                </div>
                <div className="grid grid-cols-[1fr,auto] gap-2">
                  <select
                    className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                    value={selectedLotteryTicketId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedLotteryTicketId(nextId);
                      if (nextId) {
                        setPromoCode("");
                        setPromoPreview(null);
                        setPromoError(null);
                        setPromoSuccess(null);
                      }
                    }}
                    disabled={redeemableWinningTickets.length === 0 || promoCode.trim().length > 0}
                  >
                    <option value="">Ticket gagnant (optionnel)</option>
                    {redeemableWinningTickets.map((ticket) => (
                      <option key={ticket.id} value={ticket.id}>
                        {ticket.ticketNumber} - {ticket.prize?.name ?? "Lot"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                    disabled={lotteryLoading || !selectedLotteryTicketId || items.length === 0 || promoCode.trim().length > 0}
                    onClick={applyLotteryTicket}
                  >
                    {lotteryLoading ? "..." : "Utiliser ticket"}
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

        <div className="cartoon-panel mt-3 shrink-0 bg-white p-4">
          <div className="flex items-center justify-between text-lg font-extrabold">
            <span>Total panier</span>
            <span>{formatPrice(totalPrice)} TTC</span>
          </div>
          {displayedBadgeDiscountPercent > 0 && (
            <div className="mt-2 text-sm text-green-700">
              Reduction fidelite ({loyalty.currentBadge.label}): -{formatPrice(displayedBadgeDiscountAmount)} (
              {displayedBadgeDiscountPercent}%)
            </div>
          )}
          {promoPreview && (
            <div className="mt-2 text-sm text-green-700">
              Reduction code {promoPreview.code}: -{formatPrice(promoPreview.promoDiscountAmount)} (
              {promoPreview.promoDiscountPercent}%)
            </div>
          )}
          {lotteryPreview?.rewardType === "discount" && (
            <div className="mt-2 text-sm text-green-700">
              Ticket {lotteryPreview.ticketNumber}: -{formatPrice(lotteryPreview.lotteryDiscountAmount)} (
              {lotteryPreview.lotteryDiscountPercent}%)
            </div>
          )}
          {lotteryPreview?.rewardType === "gift" && (
            <div className="mt-2 text-sm text-green-700">
              Ticket {lotteryPreview.ticketNumber}: lot ajoute ({lotteryPreview.giftLabel ?? lotteryPreview.prizeName})
            </div>
          )}
          <div className="mt-1 text-sm font-semibold text-ink">
            A payer: {formatPrice(checkoutAmount)} TTC
          </div>
          <div className="mt-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
              Tickets loterie apres achat
            </p>
            {!isAuthenticated ? (
              <p className="mt-1 text-sm text-charcoal">
                Connecte-toi pour cumuler des tickets.
              </p>
            ) : !lotteryConfig ? (
              <p className="mt-1 text-sm text-charcoal">
                Configuration loterie indisponible pour le moment.
              </p>
            ) : !lotteryConfig.isActive ? (
              <p className="mt-1 text-sm text-charcoal">
                Loterie actuellement desactivee.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Tu vas gagner {estimatedEarnedTickets} ticket{estimatedEarnedTickets > 1 ? "s" : ""}.
                </p>
                <p className="mt-1 text-xs text-charcoal">
                  Regle: 1 ticket par tranche de {formatPrice(lotteryTicketThreshold)} TTC payee.
                </p>
                {missingForNextTicket !== null && (
                  <p className="mt-1 text-xs text-charcoal">
                    Encore {formatPrice(missingForNextTicket)} TTC pour 1 ticket supplementaire.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="mt-3">
            <CheckoutButton
              amount={totalPrice}
              amountToPay={checkoutAmount}
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
              }}
              promoCode={promoPreview?.code || undefined}
              lotteryTicketId={lotteryPreview?.ticketId || undefined}
              disabled={!canCheckout || authLoading || !isAuthenticated || !checkoutEligibility.allowed}
              onSuccess={() => {
                clearCart();
                setPromoCode("");
                setPromoPreview(null);
                setPromoError(null);
                setPromoSuccess(null);
                setSelectedLotteryTicketId("");
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
                Completer les informations de livraison pour payer.
              </p>
            )}
            {!authLoading && isAuthenticated && !checkoutEligibility.allowed && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-charcoal">
                  {checkoutEligibility.error ?? "Profil non eligible a la commande."}
                </p>
                <button
                  type="button"
                  onClick={goToProfile}
                  className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                >
                  Completer mon profil
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
