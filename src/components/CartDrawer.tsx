"use client";

import { Minus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckoutButton } from "@/components/CheckoutButton";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

type PromoPreview = {
  code: string;
  discountPercent: number;
  discountAmount: number;
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
  const { user } = useCustomerSession();

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

  useEffect(() => {
    setPromoPreview(null);
    setPromoError(null);
    setPromoSuccess(null);
  }, [promoCode, totalPrice]);

  const checkoutAmount = promoPreview?.discountedTotal ?? totalPrice;

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
        discountPercent?: number;
        discountAmount?: number;
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
        discountPercent: data.discountPercent ?? 0,
        discountAmount: data.discountAmount ?? 0,
        discountedTotal: data.discountedTotal ?? totalPrice,
      });
      setPromoSuccess(
        `Code ${data.code} applique (${data.discountPercent ?? 0}% de reduction).`,
      );
    } catch {
      setPromoPreview(null);
      setPromoError("Impossible de verifier le code promo.");
    } finally {
      setPromoLoading(false);
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
                    onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                    placeholder="Code promo (optionnel)"
                  />
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                    disabled={promoLoading || items.length === 0}
                    onClick={applyPromoCode}
                  >
                    {promoLoading ? "..." : "Appliquer"}
                  </button>
                </div>
                {promoError && <p className="text-sm font-semibold text-red-700">{promoError}</p>}
                {promoSuccess && <p className="text-sm font-semibold text-green-700">{promoSuccess}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="cartoon-panel mt-3 shrink-0 bg-white p-4">
          <div className="flex items-center justify-between text-lg font-extrabold">
            <span>Total</span>
            <span>{formatPrice(totalPrice)} TTC</span>
          </div>
          {promoPreview && (
            <div className="mt-2 text-sm text-green-700">
              Reduction: -{formatPrice(promoPreview.discountAmount)} ({promoPreview.discountPercent}%)
            </div>
          )}
          <div className="mt-1 text-sm font-semibold text-ink">
            A payer: {formatPrice(checkoutAmount)} TTC
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
              promoCode={promoPreview?.code || promoCode.trim().toUpperCase() || undefined}
              disabled={!canCheckout || authLoading || !isAuthenticated}
              onSuccess={() => {
                clearCart();
                setPromoCode("");
                setPromoPreview(null);
                setPromoError(null);
                setPromoSuccess(null);
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
          </div>
        </div>
      </aside>
    </>
  );
}
