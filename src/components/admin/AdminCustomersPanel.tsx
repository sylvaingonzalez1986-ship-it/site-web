"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { formatPrice } from "@/lib/utils";
import type { AdminCustomer } from "@/types/customer";
import type { LoyaltySummary } from "@/types/loyalty";
import type { CmsOrder, OrderStatus } from "@/types/store";
import type { AdminCustomerCollectionSummary } from "@/types/lottery";
import { rarityAccentColor, rarityLabels, RARITY_ORDER } from "@/lib/lottery-card-ui";
import { getBadgeFreeShippingThreshold } from "@/lib/loyalty-tier-benefits";

type AdminCustomerListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  loyaltyPoints: number;
  contestBetaEnabled: boolean;
  currentBadge: LoyaltySummary["currentBadge"];
};

type AdminCustomerDetail = {
  customer: AdminCustomer;
  orders: CmsOrder[];
  loyalty: LoyaltySummary & {
    basePoints: number;
    bonusPoints: number;
    totalPoints: number;
  };
};

const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  pending_payment: "Paiement en attente",
  paid: "PayÃ©e",
  processing: "En prÃ©paration",
  shipped: "ExpÃ©diÃ©e",
  cancelled: "AnnulÃ©e",
};

const collectionRewardStatusLabels: Record<"locked" | "claimable" | "claimed", string> = {
  locked: "VerrouillÃ©e",
  claimable: "RÃ©compense disponible",
  claimed: "RÃ©compensÃ©e",
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getShippingBenefitLabel(badgeId: LoyaltySummary["currentBadge"]["id"], unlocked: boolean): string {
  const threshold = getBadgeFreeShippingThreshold(badgeId, unlocked);
  if (threshold === null) {
    return "Livraison offerte";
  }
  if (typeof threshold === "number") {
    return `Livraison offerte des ${threshold} EUR`;
  }
  return "Livraison standard";
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "U";
}

export function AdminCustomersPanel() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "totalSpent">("createdAt");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState("10");
  const [addingPromo, setAddingPromo] = useState(false);
  const [ticketGrantCount, setTicketGrantCount] = useState("1");
  const [ticketGrantReason, setTicketGrantReason] = useState("Attribution manuelle admin");
  const [grantingTickets, setGrantingTickets] = useState(false);
  const [collectionSummary, setCollectionSummary] = useState<AdminCustomerCollectionSummary | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [notes, setNotes] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState("0");
  const [contestBetaEnabled, setContestBetaEnabled] = useState(false);

  const loadCustomers = async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/admin/customers", { cache: "no-store" });
      if (!response.ok) {
        setStatus("Impossible de charger les clients.");
        return;
      }

      const data = (await response.json()) as { customers: AdminCustomerListItem[] };
      setCustomers(data.customers);
    } finally {
      setLoadingList(false);
    }
  };

  const loadCustomerDetail = async (customerId: string) => {
    setLoadingDetail(true);
    setLoadingCollection(true);
    setStatus(null);
    setCollectionSummary(null);

    try {
      const [customerResponse, collectionResponse] = await Promise.all([
        fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/collection`, {
          cache: "no-store",
        }),
      ]);

      if (!customerResponse.ok) {
        setStatus("Impossible de charger la fiche client.");
        setDetail(null);
        return;
      }

      const data = (await customerResponse.json()) as AdminCustomerDetail;
      setDetail(data);

      if (collectionResponse.ok) {
        const collectionData = (await collectionResponse.json()) as AdminCustomerCollectionSummary;
        setCollectionSummary(collectionData);
      } else {
        setCollectionSummary(null);
      }
    } finally {
      setLoadingDetail(false);
      setLoadingCollection(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) {
      setDetail(null);
      setCollectionSummary(null);
      setLoadingCollection(false);
      return;
    }

    void loadCustomerDetail(selectedCustomerId);
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setFirstName(detail.customer.firstName);
    setLastName(detail.customer.lastName);
    setPhone(detail.customer.phone);
    setAddress(detail.customer.address);
    setCity(detail.customer.city);
    setPostalCode(detail.customer.postalCode);
    setCountry(detail.customer.country || "France");
    setNotes(detail.customer.notes);
    setLoyaltyPoints(String(detail.customer.loyaltyPoints));
    setContestBetaEnabled(detail.customer.contestBetaEnabled);
  }, [detail]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = customers.filter((customer) => {
      if (!query) {
        return true;
      }

      return (
        customer.firstName.toLowerCase().includes(query) ||
        customer.lastName.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query)
      );
    });

    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortBy === "name") {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      if (sortBy === "totalSpent") {
        return b.totalSpent - a.totalSpent;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return sorted;
  }, [customers, search, sortBy]);

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId) {
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(selectedCustomerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          address,
          city,
          postalCode,
          country,
          notes,
          loyaltyPoints: Number(loyaltyPoints),
          contestBetaEnabled,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setStatus(data.error ?? "Erreur sauvegarde client.");
        return;
      }

      const data = (await response.json()) as AdminCustomerDetail;
      setDetail(data);
      await loadCustomers();
      setStatus("Client mis a jour.");
    } finally {
      setSaving(false);
    }
  };

  const addPromo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId) {
      return;
    }

    setAddingPromo(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(selectedCustomerId)}/promo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: promoCode.trim().toUpperCase(),
            discountPercent: Number(promoPercent),
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setStatus(data.error ?? "Erreur ajout code promo.");
        return;
      }

      setPromoCode("");
      setPromoPercent("10");
      setStatus("Code promo ajoute.");
      await loadCustomerDetail(selectedCustomerId);
    } finally {
      setAddingPromo(false);
    }
  };

  const grantTickets = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId) {
      return;
    }

    setGrantingTickets(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(selectedCustomerId)}/tickets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketCount: Number(ticketGrantCount),
            reason: ticketGrantReason.trim() || "Attribution manuelle admin",
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setStatus(data.error ?? "Erreur attribution packs.");
        return;
      }

      setTicketGrantCount("1");
      setTicketGrantReason("Attribution manuelle admin");
      setStatus("Packs attribues.");
      await loadCustomerDetail(selectedCustomerId);
    } finally {
      setGrantingTickets(false);
    }
  };

  if (selectedCustomerId) {
    return (
      <div className="cartoon-border bg-cream p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={() => setSelectedCustomerId(null)}
          >
            Retour liste clients
          </button>
          {status && <p className="text-sm font-semibold text-charcoal">{status}</p>}
        </div>

        {loadingDetail || !detail ? (
          <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement fiche client...</div>
        ) : (
          <div className="mt-4 grid gap-6">
            <article className="card-cartoon bg-white p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#f7f4ee] font-display text-2xl text-ink">
                  {getInitials(detail.customer.firstName, detail.customer.lastName)}
                </div>
                <div>
                  <p className="text-xl font-semibold text-ink">
                    {detail.customer.firstName} {detail.customer.lastName}
                  </p>
                  <p className="text-sm text-charcoal">{detail.customer.email}</p>
                  <p className="text-xs text-charcoal">
                    Inscrit le {new Date(detail.customer.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-xs text-charcoal">
                    Date de naissance: {detail.customer.dateOfBirth || "Non renseignÃ©"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <LoyaltyBadgeIllustration
                    badgeId={detail.loyalty.currentBadge.id}
                    unlocked={detail.loyalty.currentBadge.unlocked}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">{detail.loyalty.currentBadge.label}</p>
                    <p className="text-xs text-charcoal">{detail.loyalty.totalPoints} points</p>
                    <p className="mt-1 text-xs text-charcoal">
                      {getShippingBenefitLabel(detail.loyalty.currentBadge.id, detail.loyalty.currentBadge.unlocked)}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <form onSubmit={saveCustomer} className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Informations client</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="h-11 border-2 border-[#1a1a1a] px-3" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="PrÃ©nom" />
                <input className="h-11 border-2 border-[#1a1a1a] px-3" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Nom" />
                <input className="h-11 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-3 md:col-span-2" value={detail.customer.email} readOnly />
                <input className="h-11 border-2 border-[#1a1a1a] px-3" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="TÃ©lÃ©phone" />
                <input className="h-11 border-2 border-[#1a1a1a] px-3 md:col-span-2" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Adresse" />
                <input className="h-11 border-2 border-[#1a1a1a] px-3" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville" />
                <input className="h-11 border-2 border-[#1a1a1a] px-3" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Code postal" />
                <input className="h-11 border-2 border-[#1a1a1a] px-3 md:col-span-2" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Pays" />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <textarea
                  className="min-h-24 border-2 border-[#1a1a1a] p-3 md:col-span-2"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes internes admin"
                />
                <input
                  type="number"
                  className="h-11 border-2 border-[#1a1a1a] px-3"
                  value={loyaltyPoints}
                  onChange={(event) => setLoyaltyPoints(event.target.value)}
                  placeholder="Points bonus"
                />
                <label className="flex min-h-11 items-center gap-3 border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#118575]"
                    checked={contestBetaEnabled}
                    onChange={(event) => setContestBetaEnabled(event.target.checked)}
                  />
                  Acces beta Bete de concours
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-charcoal">
                <span className="pill-cartoon px-3 py-1">Points commandes: {detail.loyalty.basePoints}</span>
                <span className="pill-cartoon px-3 py-1">Points bonus: {detail.loyalty.bonusPoints}</span>
                <span className="pill-cartoon px-3 py-1">Total: {detail.loyalty.totalPoints}</span>
                <span className="pill-cartoon px-3 py-1">Commandes: {detail.orders.length}</span>
                {detail.customer.contestBetaEnabled ? (
                  <span className="pill-cartoon bg-yellow px-3 py-1 text-ink">Beta concours active</span>
                ) : null}
              </div>

              <button type="submit" disabled={saving} className="btn-cartoon btn-primary mt-4">
                {saving ? "Sauvegarde..." : "Sauvegarder client"}
              </button>
            </form>

            <article className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Codes promo</h3>
              <form onSubmit={addPromo} className="mt-3 grid gap-2 md:grid-cols-[1fr,160px,auto]">
                <input className="h-11 border-2 border-[#1a1a1a] px-3" placeholder="CODEPROMO" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} />
                <input className="h-11 border-2 border-[#1a1a1a] px-3" type="number" min={1} max={80} value={promoPercent} onChange={(event) => setPromoPercent(event.target.value)} />
                <button type="submit" className="btn-cartoon btn-secondary h-11 px-4" disabled={addingPromo}>
                  {addingPromo ? "..." : "Ajouter"}
                </button>
              </form>

              <div className="mt-4 grid gap-2">
                {detail.customer.promoCodes.length === 0 && (
                  <p className="text-sm text-charcoal">Aucun code promo.</p>
                )}
                {detail.customer.promoCodes.map((promo) => (
                  <div key={`${promo.code}-${promo.createdAt}`} className="flex flex-wrap items-center gap-2 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-2 text-sm">
                    <span className="font-bold text-ink">{promo.code}</span>
                    <span>{promo.discountPercent}%</span>
                    <span className="text-xs">{promo.used ? "Utilise" : "Actif"}</span>
                    <button
                      type="button"
                      className="btn-cartoon btn-secondary ml-auto h-8 px-3 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(promo.code);
                        setStatus(`Code ${promo.code} copie.`);
                      }}
                    >
                      Copier
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Pack promo</h3>
              <form onSubmit={grantTickets} className="mt-3 grid gap-2 md:grid-cols-[220px,1fr,auto]">
                <input
                  className="h-11 border-2 border-[#1a1a1a] px-3"
                  type="number"
                  min={1}
                  max={200}
                  value={ticketGrantCount}
                  onChange={(event) => setTicketGrantCount(event.target.value)}
                />
                <input
                  className="h-11 border-2 border-[#1a1a1a] px-3"
                  value={ticketGrantReason}
                  onChange={(event) => setTicketGrantReason(event.target.value)}
                  placeholder="Raison de l'attribution"
                />
                <button
                  type="submit"
                  className="btn-cartoon btn-secondary h-11 px-4"
                  disabled={grantingTickets}
                >
                  {grantingTickets ? "..." : "Attribuer packs"}
                </button>
              </form>
              <p className="mt-3 text-xs text-charcoal">
                Attribution manuelle de packs promotionnels (1 a 200).
              </p>
            </article>

            <article className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Collection Kanab Quest</h3>
              <p className="mt-1 text-sm text-charcoal">{collectionSummary?.collectionTitle ?? "Album client"}</p>

              {loadingCollection && !collectionSummary ? (
                <p className="mt-3 text-sm text-charcoal">Chargement de la collection...</p>
              ) : null}

              {!loadingCollection && !collectionSummary && (
                <p className="mt-3 text-sm text-charcoal">Aucune carte dans la collection.</p>
              )}

              {collectionSummary ? (
                <>
                  <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                      <p className="text-charcoal">Collection unique</p>
                      <p className="text-lg font-semibold text-ink">
                        {collectionSummary.summary.ownedUnique} / {collectionSummary.summary.totalCards} cartes
                      </p>
                      <p className="text-xs text-charcoal">
                        ComplÃ©tion {formatPercent(collectionSummary.summary.completionPercent)}
                      </p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                      <p className="text-charcoal">Copies possÃ©dÃ©es</p>
                      <p className="text-lg font-semibold text-ink">
                        {collectionSummary.summary.totalOwnedCopies}
                      </p>
                      <p className="text-xs text-charcoal">
                        Doublons : {collectionSummary.summary.duplicateCopies}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded border-2 border-[#1a1a1a]">
                    <div className="grid border-b border-[#1a1a1a] bg-[#efebe4] px-3 py-2 text-xs font-semibold text-ink md:grid-cols-[1fr,0.9fr,0.75fr,0.75fr,1fr]">
                      <p>RaretÃ©</p>
                      <p className="text-right">PossÃ©dÃ©es</p>
                      <p className="text-right">Doublons</p>
                      <p className="text-right">ComplÃ©tion</p>
                      <p>RÃ©compense</p>
                    </div>
                    {RARITY_ORDER.map((rarity) => {
                      const pageSummary = collectionSummary.pages.find((entry) => entry.rarity === rarity);
                      if (!pageSummary) {
                        return null;
                      }

                      return (
                        <div key={rarity} className="grid items-center gap-2 border-b border-[#dedede] px-3 py-3 text-sm last:border-b-0 md:grid-cols-[1fr,0.9fr,0.75fr,0.75fr,1fr]">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-[#1a1a1a]"
                              style={{ backgroundColor: rarityAccentColor[rarity] }}
                              aria-hidden="true"
                            />
                            <p>
                              <span className="font-semibold">{rarityLabels[rarity]}</span>{" "}
                              <span className="text-xs text-charcoal">{pageSummary.label}</span>
                            </p>
                          </div>
                          <p className="text-right">
                            {pageSummary.ownedUnique} / {pageSummary.totalSlots - pageSummary.missingCount}
                          </p>
                          <p className="text-right">{pageSummary.duplicateCopies}</p>
                          <p className="text-right">{formatPercent(pageSummary.completionPercent)}</p>
                          <p className="text-xs capitalize">
                            {collectionRewardStatusLabels[pageSummary.rewardStatus]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </article>

            <article className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Historique commandes ({detail.orders.length})</h3>
              <div className="mt-4 grid gap-3">
                {detail.orders.length === 0 && (
                  <p className="text-sm text-charcoal">Aucune commande pour ce client.</p>
                )}
                {detail.orders.map((order) => (
                  <article key={order.id} className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{order.id}</p>
                      <p className="text-xs text-charcoal">
                        {new Date(order.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <p className="text-sm text-charcoal">
                      Statut: {orderStatusLabels[order.status]} - Paiement: {order.paymentState}
                    </p>
                    <p className="text-sm font-semibold text-ink">{formatPrice(order.totalAmount)}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Clients ({customers.length})</h2>
        {status && <p className="text-sm font-semibold text-charcoal">{status}</p>}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr,220px]">
        <input
          className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
          placeholder="Recherche nom, email, ville"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as "name" | "createdAt" | "totalSpent")}
        >
          <option value="createdAt">Tri: date inscription</option>
          <option value="name">Tri: nom</option>
          <option value="totalSpent">Tri: total depense</option>
        </select>
      </div>

      {loadingList ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement clients...</div>
      ) : (
        <div className="mt-4 grid gap-3">
          {filteredCustomers.length === 0 && (
            <p className="text-charcoal">Aucun client trouve.</p>
          )}
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="card-cartoon w-full bg-white p-4 text-left hover:bg-[#f7f4ee]"
              onClick={() => setSelectedCustomerId(customer.id)}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#f7f4ee] font-semibold text-ink">
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="truncate text-sm text-charcoal">{customer.email}</p>
                </div>
                {customer.contestBetaEnabled ? (
                  <span className="rounded-full border-2 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-ink">
                    Beta concours
                  </span>
                ) : null}
                <div className="flex items-center gap-2">
                  <LoyaltyBadgeIllustration
                    badgeId={customer.currentBadge.id}
                    unlocked={customer.currentBadge.unlocked}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-charcoal sm:grid-cols-4">
                <p>Ville: {customer.city || "-"}</p>
                <p>Commandes: {customer.ordersCount}</p>
                <p>Total: {formatPrice(customer.totalSpent)}</p>
                <p>Inscription: {new Date(customer.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
