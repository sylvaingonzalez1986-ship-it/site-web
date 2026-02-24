"use client";

import { Award, ShoppingBag, Tag, Ticket, User as UserIcon, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { LotterySection } from "@/components/account/LotterySection";
import { OrderDetailModal } from "@/components/account/OrderDetailModal";
import { useCmsStore } from "@/hooks/useCmsStore";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import {
  getBadgeBenefitsText,
  getBadgeDiscountPercent,
  isBadgeEligibleForFreeShipping,
  parseBadgeBenefitsLines,
} from "@/lib/loyalty-tier-benefits";
import { formatPrice } from "@/lib/utils";
import type { CmsOrder, OrderStatus } from "@/types/store";

const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  pending_payment: "Paiement en attente",
  paid: "Payee",
  processing: "En preparation",
  shipped: "Expediee",
  cancelled: "Annulee",
};

const paymentStateLabels: Record<CmsOrder["paymentState"], string> = {
  pending: "En attente",
  paid: "Paye",
  failed: "Echec",
  not_configured: "Validation manuelle",
};

type ProfileTab = "fidelite" | "loterie" | "commandes" | "infos" | "promos";

type ProfileTabDefinition = {
  key: ProfileTab;
  label: string;
  icon: LucideIcon;
};

const profileTabs: ProfileTabDefinition[] = [
  { key: "fidelite", label: "Fidelite", icon: Award },
  { key: "loterie", label: "Loterie", icon: Ticket },
  { key: "commandes", label: "Commandes", icon: ShoppingBag },
  { key: "infos", label: "Mes infos", icon: UserIcon },
  { key: "promos", label: "Promos", icon: Tag },
];

function parseProfileTab(value: string | null): ProfileTab | null {
  if (!value) {
    return null;
  }

  if (value === "fidelite" || value === "loterie" || value === "commandes" || value === "infos" || value === "promos") {
    return value;
  }

  return null;
}

function formatNotificationBadge(value: number): string {
  if (value > 99) {
    return "99+";
  }

  return String(value);
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "U";
}

export function ProfilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    orders,
    tickets,
    lotteryConfig,
    availableTicketCount,
    loyalty,
    loading,
    refresh,
  } = useCustomerSession();
  const { store: cmsStore } = useCmsStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CmsOrder | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("fidelite");

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = parseProfileTab(params.get("tab"));
      if (requestedTab) {
        setActiveTab((current) => (current === requestedTab ? current : requestedTab));
        return;
      }

      if (params.has("tab")) {
        params.delete("tab");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user.firstName);
    setLastName(user.lastName);
    setDateOfBirth(user.dateOfBirth ?? "");
    setPhone(user.phone);
    setAddress(user.address);
    setCity(user.city);
    setPostalCode(user.postalCode);
    setCountry(user.country || "France");
  }, [user]);

  if (loading) {
    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-8">Chargement du profil...</div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-8">Session invalide.</div>
        </div>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          phone,
          address,
          city,
          postalCode,
          country,
        }),
      });

      if (!response.ok) {
        setStatus("Erreur mise a jour profil.");
        return;
      }

      setStatus("Profil mis a jour.");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" });
    router.replace("/");
  };

  const setActiveTabAndSync = (tab: ProfileTab) => {
    setActiveTab(tab);

    const nextParams =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    nextParams.set("tab", tab);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const getTabNotification = (tab: ProfileTab): string | null => {
    if (tab === "loterie" && availableTicketCount > 0) {
      return formatNotificationBadge(availableTicketCount);
    }

    if (tab === "infos" && !user.dateOfBirth) {
      return "!";
    }

    if (tab === "promos") {
      const activePromos = user.promoCodes.filter((promo) => !promo.used).length;
      if (activePromos > 0) {
        return formatNotificationBadge(activePromos);
      }
    }

    return null;
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("fr-FR");
  const profileContent = cmsStore.content.profile;
  const popupTitle = profileContent.badgeBenefitsModalTitle.trim() || "Avantages du palier";
  const popupHint =
    profileContent.badgeBenefitsModalHint.trim() || "Chaque ligne correspond a un avantage.";

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container grid gap-8">
        <article className="cartoon-border bg-cream p-6 md:p-8">
          <h1 className="section-title">MON PROFIL</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#fff] font-display text-2xl text-ink">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-charcoal">{user.email}</p>
              <p className="text-xs text-charcoal">Membre depuis le {memberSince}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points</p>
              <p className="mt-1 text-2xl font-bold text-ink">{loyalty.points}</p>
            </div>
            <div className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points bonus admin</p>
              <p className="mt-1 text-2xl font-bold text-ink">{user.loyaltyPoints}</p>
            </div>
            <div className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Euros comptabilises</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatPrice(loyalty.totalEligibleSpend)}</p>
            </div>
            <div className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Commandes eligibles</p>
              <p className="mt-1 text-2xl font-bold text-ink">{loyalty.eligibleOrdersCount}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" onClick={logout} className="btn-cartoon btn-secondary">
              Se deconnecter
            </button>
          </div>
        </article>

        <article className="cartoon-border bg-cream p-4 md:p-6">
          <div
            className="flex flex-nowrap gap-2 overflow-x-auto md:flex-wrap"
            role="tablist"
            aria-label="Sections du profil"
          >
            {profileTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const notification = getTabNotification(tab.key);

              return (
                <button
                  key={tab.key}
                  id={`profile-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`profile-tabpanel-${tab.key}`}
                  className={`pill-cartoon relative flex min-h-[44px] shrink-0 items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.09em] transition-colors ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "border-2 border-[#1a1a1a] bg-white text-ink hover:bg-[#f0f0f0]"
                  }`}
                  onClick={() => setActiveTabAndSync(tab.key)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {notification && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--orange)] px-1 text-[10px] font-bold text-white">
                      {notification}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </article>

        <article
          id={`profile-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`profile-tab-${activeTab}`}
          className="cartoon-border bg-cream p-6 md:p-8"
        >
          {activeTab === "fidelite" && (
            <>
              <div className="card-cartoon bg-white p-6">
                <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Badge actuel</p>
                <div className="mt-3 flex items-center gap-3">
                  <LoyaltyBadgeIllustration
                    badgeId={loyalty.currentBadge.id}
                    unlocked={loyalty.currentBadge.unlocked}
                    size="md"
                  />
                  <div>
                    <h2 className="font-display text-3xl text-ink">{loyalty.currentBadge.label}</h2>
                    <p className="text-sm text-charcoal">{loyalty.currentBadge.description}</p>
                    <p className="mt-1 text-xs font-semibold text-ink">
                      {isBadgeEligibleForFreeShipping(
                        loyalty.currentBadge.id,
                        loyalty.currentBadge.unlocked,
                      )
                        ? "Livraison offerte active (badge Argent+)"
                        : "Livraison offerte a partir du badge Argent"}
                    </p>
                    {!loyalty.currentBadge.unlocked && (
                      <p className="mt-1 text-xs font-semibold text-charcoal">A debloquer</p>
                    )}
                  </div>
                </div>

                {loyalty.nextBadge ? (
                  <div className="mt-6">
                    <p className="text-sm text-charcoal">
                      Encore <span className="font-semibold text-ink">{loyalty.pointsToNextBadge} points</span> pour atteindre{" "}
                      <span className="font-semibold text-ink">{loyalty.nextBadge.label}</span>.
                    </p>
                    <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-[#1a1a1a] bg-white">
                      <div
                        className="h-full bg-[#0a7b61]"
                        style={{ width: `${loyalty.progressToNextBadge}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm font-semibold text-ink">Niveau maximal atteint.</p>
                )}
              </div>

              <div className="mt-4 card-cartoon bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-charcoal">
                      Tickets de grattage
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {availableTicketCount} disponible{availableTicketCount > 1 ? "s" : ""} / {tickets.length} total
                    </p>
                    {!lotteryConfig?.isActive && (
                      <p className="mt-1 text-xs text-charcoal">Loterie actuellement desactivee.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTabAndSync("loterie")}
                    className="btn-cartoon btn-secondary h-10 px-3 text-xs"
                  >
                    Ouvrir mes tickets
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-3xl">Mes badges</h2>
                  <p className="text-sm text-charcoal">1 EUR depense = 1 point</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {loyalty.badges.map((badge) => (
                    <div key={badge.id} className="group relative">
                      <article
                        className={`card-cartoon h-full p-4 text-left transition-colors hover:bg-[#f7f4ee] ${
                          badge.unlocked ? "bg-[#e8f7f2]" : "bg-white"
                        }`}
                        tabIndex={0}
                      >
                        <div className="mb-3">
                          <LoyaltyBadgeIllustration badgeId={badge.id} unlocked={badge.unlocked} />
                        </div>
                        <p className="text-xs uppercase tracking-[0.08em] text-charcoal">{badge.minPoints}+ pts</p>
                        <p className="mt-1 font-semibold text-ink">{badge.label}</p>
                        <p className="mt-1 text-xs text-charcoal">{badge.description}</p>
                        <p className="mt-2 text-xs font-semibold text-ink">
                          {badge.unlocked ? "Debloque" : "Verrouille"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-charcoal">Survole pour voir les avantages</p>
                      </article>
                      <div className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-3 w-[min(20rem,90vw)] -translate-x-1/2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        <div className="card-cartoon bg-white p-4 text-left shadow-lg">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                            {popupTitle}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-ink">
                            {badge.label} - {badge.minPoints}+ points
                          </p>
                          <p className="mt-1 text-xs font-semibold text-ink">
                            Reduction permanente: {getBadgeDiscountPercent(profileContent, badge.id)}%
                          </p>
                          <p className="mt-1 text-xs font-semibold text-ink">
                            Livraison offerte:{" "}
                            {isBadgeEligibleForFreeShipping(badge.id, badge.unlocked)
                              ? "Oui (a partir de ce palier)"
                              : "Non"}
                          </p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal">
                            {popupHint}
                          </p>
                          {(() => {
                            const benefits = parseBadgeBenefitsLines(
                              getBadgeBenefitsText(profileContent, badge.id),
                            );
                            if (benefits.length === 0) {
                              return (
                                <p className="mt-2 text-xs text-charcoal">
                                  Aucun avantage specifique configure pour ce palier.
                                </p>
                              );
                            }

                            return (
                              <ul className="mt-2 grid gap-1 text-xs text-ink">
                                {benefits.map((benefit, index) => (
                                  <li key={`${badge.id}-benefit-${index}`} className="leading-relaxed">
                                    - {benefit}
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "loterie" && (
            <LotterySection tickets={tickets} config={lotteryConfig} onRefresh={refresh} />
          )}

          {activeTab === "commandes" && (
            <>
              <h2 className="font-display text-3xl">Mes commandes ({sortedOrders.length})</h2>
              {sortedOrders.length === 0 && (
                <p className="mt-4 text-charcoal">Aucune commande pour le moment.</p>
              )}

              <div className="mt-4 grid gap-4">
                {sortedOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="card-cartoon w-full bg-white p-4 text-left transition-colors hover:bg-[#f7f4ee]"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{order.id}</p>
                      <p className="text-sm text-charcoal">
                        {new Date(order.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-charcoal">
                      Statut: {orderStatusLabels[order.status]} - Paiement: {paymentStateLabels[order.paymentState]}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      Total: {formatPrice(order.totalAmount)}
                    </p>
                    <div className="mt-2 grid gap-1 text-sm text-charcoal">
                      {order.items.map((item, idx) => (
                        <p key={`${order.id}-${idx}`}>
                          {item.quantity} x {item.name} - {formatPrice(item.lineTotal)}
                        </p>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "infos" && (
            <>
              <h2 className="font-display text-3xl">Mes informations</h2>
              <form onSubmit={onSubmit} className="mt-6 grid gap-3 md:grid-cols-2">
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Prenom"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Nom"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-3 text-base md:col-span-2"
                  value={user.email}
                  readOnly
                  placeholder="Email"
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base md:col-span-2"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  placeholder="Date de naissance"
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Telephone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base md:col-span-2"
                  placeholder="Adresse"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Ville"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
                  placeholder="Code postal"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                />
                <input
                  className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base md:col-span-2"
                  placeholder="Pays"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
                <button type="submit" disabled={saving} className="btn-cartoon btn-primary h-12 md:col-span-2">
                  {saving ? "Sauvegarde..." : "Mettre a jour le profil"}
                </button>
              </form>

              {status && <p className="mt-3 text-sm font-semibold text-green-700">{status}</p>}
              {!user.dateOfBirth && (
                <p className="mt-2 text-sm font-semibold text-red-700">
                  Renseigne ta date de naissance pour pouvoir passer commande (18+ requis).
                </p>
              )}
            </>
          )}

          {activeTab === "promos" && (
            <>
              <h2 className="font-display text-3xl">Mes codes promo</h2>
              {user.promoCodes.length === 0 ? (
                <p className="mt-4 text-charcoal">Aucun code promo attribue pour le moment.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {user.promoCodes.map((promo) => (
                    <article key={`${promo.code}-${promo.createdAt}`} className="card-cartoon bg-white p-4">
                      <p className="text-lg font-bold text-ink">{promo.code}</p>
                      <p className="text-sm text-charcoal">{promo.discountPercent}% de reduction</p>
                      <p className="mt-1 text-xs font-semibold text-ink">
                        {promo.used ? "Utilise" : "Actif"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </article>
      </div>
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </section>
  );
}
