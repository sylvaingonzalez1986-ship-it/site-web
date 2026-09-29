"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { AdminCustomer } from "@/types/customer";
import type { LoyaltySummary } from "@/types/loyalty";
import type { CmsOrder, OrderStatus } from "@/types/store";
import type { AdminCustomerCollectionSummary } from "@/types/lottery";
import { rarityAccentColor, rarityLabels, RARITY_ORDER } from "@/lib/lottery-card-ui";
import {
  getBadgeTierHomeDeliveryBenefitLabel,
  getBadgeTierRelayBenefitLabel,
} from "@/lib/loyalty-tier-benefits";

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
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  cancelled: "Annulée",
};

const collectionRewardStatusLabels: Record<"locked" | "claimable" | "claimed", string> = {
  locked: "Verrouillée",
  claimable: "Récompense disponible",
  claimed: "Récompensée",
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getShippingBenefitLabel(badgeId: LoyaltySummary["currentBadge"]["id"], unlocked: boolean): string {
  if (unlocked) {
    return `${getBadgeTierRelayBenefitLabel(badgeId)} / ${getBadgeTierHomeDeliveryBenefitLabel(badgeId)}`;
  }

  return "Point relais au seuil standard / Domicile au tarif standard";
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
      <div className="admin-customers-panel cartoon-border min-w-0 bg-cream p-3 sm:p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={() => setSelectedCustomerId(null)}
          >
            Retour liste clients
          </button>
          {status && <p role="status" className="text-sm font-semibold text-charcoal">{status}</p>}
        </div>

        {loadingDetail || !detail ? (
          <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement fiche client...</div>
        ) : (
          <div className="mt-4 grid gap-6">
            <article className="card-cartoon bg-white p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#f7f4ee] font-display text-2xl text-ink">
                  {getInitials(detail.customer.firstName, detail.customer.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xl font-semibold text-ink">
                    {detail.customer.firstName} {detail.customer.lastName}
                  </p>
                  <p className="break-all text-sm text-charcoal">{detail.customer.email}</p>
                  <p className="text-xs text-charcoal">
                    Inscrit le {new Date(detail.customer.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-xs text-charcoal">
                    Date de naissance: {detail.customer.dateOfBirth || "Non renseignée"}
                  </p>
                </div>
                <div className="w-full rounded-xl border border-[#003f30]/20 bg-[#f7f4ee] p-3 sm:ml-auto sm:w-auto sm:max-w-xs">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-charcoal">Fidélité</p>
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
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Prénom
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Nom
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink md:col-span-2">
                  Adresse e-mail
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] bg-[#f4f4f4] px-3 font-normal" type="email" value={detail.customer.email} readOnly />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Téléphone
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink md:col-span-2">
                  Adresse
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Ville
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Code postal
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink md:col-span-2">
                  Pays
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" autoComplete="country-name" value={country} onChange={(event) => setCountry(event.target.value)} />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink md:col-span-2">
                  Notes internes
                  <textarea
                    className="min-h-24 min-w-0 border-2 border-[#1a1a1a] p-3 font-normal"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes internes admin"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Points bonus
                  <input
                    type="number"
                    inputMode="numeric"
                    className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal"
                    value={loyaltyPoints}
                    onChange={(event) => setLoyaltyPoints(event.target.value)}
                    placeholder="Points bonus"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-3 self-end border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#118575]"
                    checked={contestBetaEnabled}
                    onChange={(event) => setContestBetaEnabled(event.target.checked)}
                  />
                  Accès bêta L&apos;Arène
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

              <button type="submit" disabled={saving} className="btn-cartoon btn-primary mt-4 w-full sm:w-auto">
                {saving ? "Sauvegarde..." : "Sauvegarder client"}
              </button>
            </form>

            <article className="card-cartoon bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Codes promo</h3>
              <form onSubmit={addPromo} className="mt-3 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Code promo
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" placeholder="CODEPROMO" autoCapitalize="characters" autoCorrect="off" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Réduction (%)
                  <input className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal" type="number" inputMode="numeric" min={1} max={80} value={promoPercent} onChange={(event) => setPromoPercent(event.target.value)} />
                </label>
                <button type="submit" className="btn-cartoon btn-secondary min-h-11 px-4" disabled={addingPromo}>
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
                      className="btn-cartoon btn-secondary ml-auto min-h-11 px-3 text-xs"
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
              <form onSubmit={grantTickets} className="mt-3 grid items-end gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Nombre de packs
                  <input
                    className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    value={ticketGrantCount}
                    onChange={(event) => setTicketGrantCount(event.target.value)}
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
                  Raison de l&apos;attribution
                  <input
                    className="h-11 min-w-0 border-2 border-[#1a1a1a] px-3 font-normal"
                    value={ticketGrantReason}
                    onChange={(event) => setTicketGrantReason(event.target.value)}
                    placeholder="Raison de l'attribution"
                  />
                </label>
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
                        Complétion {formatPercent(collectionSummary.summary.completionPercent)}
                      </p>
                    </div>
                    <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                      <p className="text-charcoal">Copies possédées</p>
                      <p className="text-lg font-semibold text-ink">
                        {collectionSummary.summary.totalOwnedCopies}
                      </p>
                      <p className="text-xs text-charcoal">
                        Doublons : {collectionSummary.summary.duplicateCopies}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded border-2 border-[#1a1a1a]">
                    <div className="hidden border-b border-[#1a1a1a] bg-[#efebe4] px-3 py-2 text-xs font-semibold text-ink md:grid md:grid-cols-[1fr_0.9fr_0.75fr_0.75fr_1fr] md:gap-2">
                      <p>Rareté</p>
                      <p className="text-right">Possédées</p>
                      <p className="text-right">Doublons</p>
                      <p className="text-right">Complétion</p>
                      <p>Récompense</p>
                    </div>
                    {RARITY_ORDER.map((rarity) => {
                      const pageSummary = collectionSummary.pages.find((entry) => entry.rarity === rarity);
                      if (!pageSummary) {
                        return null;
                      }

                      return (
                        <div key={rarity} className="grid grid-cols-2 items-center gap-3 border-b border-[#dedede] px-3 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_0.9fr_0.75fr_0.75fr_1fr] md:gap-2">
                          <div className="col-span-2 flex items-center gap-2 md:col-span-1">
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
                          <p className="md:text-right">
                            <span className="block text-xs text-charcoal md:hidden">Possédées</span>
                            {pageSummary.ownedUnique} / {pageSummary.totalSlots - pageSummary.missingCount}
                          </p>
                          <p className="md:text-right"><span className="block text-xs text-charcoal md:hidden">Doublons</span>{pageSummary.duplicateCopies}</p>
                          <p className="md:text-right"><span className="block text-xs text-charcoal md:hidden">Complétion</span>{formatPercent(pageSummary.completionPercent)}</p>
                          <p className="text-xs capitalize">
                            <span className="block text-charcoal md:hidden">Récompense</span>
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
                      <p className="break-all font-semibold text-ink">{order.id}</p>
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
    <div className="admin-customers-panel cartoon-border min-w-0 bg-cream p-3 sm:p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Clients ({customers.length})</h2>
        {status && <p role="status" className="text-sm font-semibold text-charcoal">{status}</p>}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
          Rechercher un client
          <input
            className="h-11 min-w-0 border-2 border-[#1a1a1a] bg-white px-3 font-normal"
            type="search"
            placeholder="Nom, e-mail, ville…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
          Trier les clients
          <select
            className="h-11 min-w-0 border-2 border-[#1a1a1a] bg-white px-3 font-normal"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as "name" | "createdAt" | "totalSpent")}
          >
            <option value="createdAt">Date d&apos;inscription</option>
            <option value="name">Nom</option>
            <option value="totalSpent">Total dépensé</option>
          </select>
        </label>
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
              className="admin-customer-card card-cartoon min-w-0 w-full bg-white p-4 text-left hover:bg-[#f7f4ee]"
              onClick={() => setSelectedCustomerId(customer.id)}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#f7f4ee] font-semibold text-ink">
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="truncate text-sm text-charcoal">{customer.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="pill-cartoon px-3 py-1 text-xs font-semibold text-ink">{customer.currentBadge.label}</span>
                {customer.contestBetaEnabled ? (
                  <span className="rounded-full border-2 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-ink">
                    Beta concours
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#003f30]/15 pt-3 text-sm text-ink sm:grid-cols-4">
                <p className="min-w-0 break-words"><span className="block text-xs text-charcoal">Ville</span>{customer.city || "—"}</p>
                <p><span className="block text-xs text-charcoal">Commandes</span>{customer.ordersCount}</p>
                <p className="font-semibold"><span className="block text-xs font-normal text-charcoal">Total dépensé</span>{formatPrice(customer.totalSpent)}</p>
                <p><span className="block text-xs text-charcoal">Inscription</span>{new Date(customer.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
