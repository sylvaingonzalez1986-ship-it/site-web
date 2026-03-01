"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LotteryCardImageUpload } from "@/components/admin/LotteryCardImageUpload";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import type {
  LotteryCardDefinition,
  LotteryCardRarity,
  LotteryConfig,
  LotteryStats,
} from "@/types/lottery";

type AdminCustomerListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type CardDraft = {
  code: string;
  cardNumber: string;
  name: string;
  rarity: LotteryCardRarity;
  visualPrompt: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
};

const rarityLabels: Record<LotteryCardRarity, string> = {
  common: "Commune",
  silver: "Silver",
  gold: "Gold",
  epic: "Epique",
  legendary: "Legendaire",
};

const emptyCardDraft = (): CardDraft => ({
  code: "",
  cardNumber: "",
  name: "",
  rarity: "common",
  visualPrompt: "",
  description: "",
  imageUrl: "",
  isActive: true,
});

export function AdminLotteryPanel() {
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [cards, setCards] = useState<LotteryCardDefinition[]>([]);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [status, setStatus] = useState("Chargement loterie...");
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [cardDraft, setCardDraft] = useState<CardDraft>(emptyCardDraft());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualTicketCount, setManualTicketCount] = useState("1");
  const [manualTicketReason, setManualTicketReason] = useState("Attribution manuelle loterie");
  const [grantingTickets, setGrantingTickets] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [archivingCardId, setArchivingCardId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);

    try {
      const [lotteryResponse, customersResponse] = await Promise.all([
        fetch("/api/admin/lottery", { cache: "no-store" }),
        fetch("/api/admin/customers", { cache: "no-store" }),
      ]);

      const lotteryPayload = (await lotteryResponse.json()) as {
        config?: LotteryConfig;
        cards?: LotteryCardDefinition[];
        stats?: LotteryStats;
        error?: string;
      };

      if (!lotteryResponse.ok || !lotteryPayload.config) {
        setStatus(lotteryPayload.error ?? "Impossible de charger la loterie.");
        return;
      }

      const nextCards = (lotteryPayload.cards ?? []).sort((left, right) => left.cardNumber - right.cardNumber);
      setConfig(lotteryPayload.config);
      setCards(nextCards);
      setStats(lotteryPayload.stats ?? null);

      if (customersResponse.ok) {
        const customersPayload = (await customersResponse.json()) as { customers?: AdminCustomerListItem[] };
        setCustomers(customersPayload.customers ?? []);
      }

      setSelectedCardId((current) =>
        current && nextCards.some((card) => card.id === current) ? current : nextCards[0]?.id ?? "",
      );
      setStatus("Loterie chargee.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  useEffect(() => {
    if (!selectedCard) {
      setCardDraft(emptyCardDraft());
      return;
    }

    setCardDraft({
      code: selectedCard.code,
      cardNumber: String(selectedCard.cardNumber),
      name: selectedCard.name,
      rarity: selectedCard.rarity,
      visualPrompt: selectedCard.visualPrompt,
      description: selectedCard.description,
      imageUrl: selectedCard.imageUrl,
      isActive: selectedCard.isActive,
    });
  }, [selectedCard]);

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    const response = await fetch("/api/admin/lottery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eurosPerTicket: config.eurosPerTicket,
        maxTicketsPerOrder: config.maxTicketsPerOrder,
        collectionTitle: config.collectionTitle,
        albumSubtitle: config.albumSubtitle,
        albumBoosterTitle: config.albumBoosterTitle,
        albumBoosterDescription: config.albumBoosterDescription,
        commonWeight: config.cardWeights.common,
        silverWeight: config.cardWeights.silver,
        goldWeight: config.cardWeights.gold,
        epicWeight: config.cardWeights.epic,
        legendaryWeight: config.cardWeights.legendary,
        isActive: config.isActive,
      }),
    });

    const payload = (await response.json()) as { config?: LotteryConfig; error?: string };
    if (!response.ok || !payload.config) {
      setStatus(payload.error ?? "Sauvegarde configuration impossible.");
      return;
    }

    setConfig(payload.config);
    setStatus("Configuration sauvegardee.");
    await loadData();
  };

  const saveCard = async () => {
    setSavingCard(true);

    try {
      const response = await fetch(
        selectedCardId ? `/api/admin/lottery/cards/${encodeURIComponent(selectedCardId)}` : "/api/admin/lottery/cards",
        {
          method: selectedCardId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: cardDraft.code,
            cardNumber: Number(cardDraft.cardNumber),
            name: cardDraft.name,
            rarity: cardDraft.rarity,
            visualPrompt: cardDraft.visualPrompt,
            description: cardDraft.description,
            imageUrl: cardDraft.imageUrl,
            isActive: cardDraft.isActive,
          }),
        },
      );

      const payload = (await response.json()) as { card?: LotteryCardDefinition; error?: string };
      if (!response.ok || !payload.card) {
        setStatus(payload.error ?? "Sauvegarde carte impossible.");
        return;
      }

      setSelectedCardId(payload.card.id);
      setStatus(selectedCardId ? "Carte mise a jour." : "Carte creee.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur sauvegarde carte.");
    } finally {
      setSavingCard(false);
    }
  };

  const archiveCard = async (cardId: string) => {
    setArchivingCardId(cardId);

    try {
      const response = await fetch(`/api/admin/lottery/cards/${encodeURIComponent(cardId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) {
        setStatus(payload.error ?? "Archivage carte impossible.");
        return;
      }

      if (selectedCardId === cardId) {
        setSelectedCardId("");
      }
      setStatus("Carte archivee.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur archivage carte.");
    } finally {
      setArchivingCardId(null);
    }
  };

  const grantTickets = async () => {
    if (!selectedCustomerId) {
      setStatus("Selectionne un client pour attribuer des packs.");
      return;
    }

    setGrantingTickets(true);
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(selectedCustomerId)}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketCount: Number(manualTicketCount),
          reason: manualTicketReason.trim() || "Attribution manuelle loterie",
        }),
      });

      const payload = (await response.json()) as { granted?: number; error?: string };
      if (!response.ok || !payload.granted) {
        setStatus(payload.error ?? "Attribution packs impossible.");
        return;
      }

      setManualTicketCount("1");
      setManualTicketReason("Attribution manuelle loterie");
      setStatus(`${payload.granted} pack(s) attribue(s).`);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur attribution packs.");
    } finally {
      setGrantingTickets(false);
    }
  };

  const activeCards = cards.filter((card) => card.isActive);

  return (
    <div className="grid gap-6">
      <section className="card-cartoon bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-ink">Configuration TCG</h3>
            <p className="mt-1 text-sm text-charcoal">
              1 pack = 3 cartes tirees. Les poids ci-dessous pilotent la rarete de chaque carte a l&apos;ouverture.
            </p>
          </div>
          <p className="text-sm font-semibold text-ink">{status}</p>
        </div>

        {config && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Euros par pack</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={1}
                value={config.eurosPerTicket}
                onChange={(event) =>
                  setConfig({ ...config, eurosPerTicket: Number(event.target.value) || config.eurosPerTicket })
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Max packs / commande</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={1}
                value={config.maxTicketsPerOrder}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    maxTicketsPerOrder: Number(event.target.value) || config.maxTicketsPerOrder,
                  })
                }
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-ink">Titre collection</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={config.collectionTitle}
                onChange={(event) => setConfig({ ...config, collectionTitle: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-ink">Sous-titre album</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={config.albumSubtitle}
                onChange={(event) => setConfig({ ...config, albumSubtitle: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-ink">Titre bloc boosters</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={config.albumBoosterTitle}
                onChange={(event) => setConfig({ ...config, albumBoosterTitle: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2 xl:col-span-4">
              <span className="font-semibold text-ink">Description bloc boosters</span>
              <textarea
                className="min-h-[88px] border-2 border-[#1a1a1a] px-3 py-2 text-sm"
                value={config.albumBoosterDescription}
                onChange={(event) => setConfig({ ...config, albumBoosterDescription: event.target.value })}
              />
            </label>
            {(["common", "silver", "gold", "epic", "legendary"] as const).map((rarity) => (
              <label key={rarity} className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Poids {rarityLabels[rarity]}</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  type="number"
                  min={0}
                  value={config.cardWeights[rarity]}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      cardWeights: {
                        ...config.cardWeights,
                        [rarity]: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={config.isActive}
                onChange={(event) => setConfig({ ...config, isActive: event.target.checked })}
              />
              Collection active
            </label>
          </div>
        )}

        <button type="button" className="btn-cartoon btn-primary mt-4 h-10 px-4 text-xs" onClick={() => void saveConfig()}>
          Sauvegarder
        </button>
      </section>

      <section className="card-cartoon bg-white p-5">
        <h3 className="font-display text-2xl text-ink">Attribuer des packs</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_1fr_auto]">
          <select
            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
            value={selectedCustomerId}
            onChange={(event) => setSelectedCustomerId(event.target.value)}
          >
            <option value="">Selectionner un client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.email} - {customer.firstName} {customer.lastName}
              </option>
            ))}
          </select>
          <input
            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
            type="number"
            min={1}
            value={manualTicketCount}
            onChange={(event) => setManualTicketCount(event.target.value)}
          />
          <input
            className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
            value={manualTicketReason}
            onChange={(event) => setManualTicketReason(event.target.value)}
          />
          <button
            type="button"
            className="btn-cartoon btn-secondary h-10 px-4 text-xs"
            onClick={() => void grantTickets()}
            disabled={grantingTickets}
          >
            {grantingTickets ? "..." : "Attribuer"}
          </button>
        </div>
      </section>

      <section className="card-cartoon bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-ink">Cartes TCG</h3>
            <p className="mt-1 text-sm text-charcoal">
              Le set complet est seedé en base. Tu pourras ajouter les illustrations plus tard.
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary h-10 px-4 text-xs"
            onClick={() => {
              setSelectedCardId("");
              setCardDraft(emptyCardDraft());
            }}
          >
            Nouvelle carte
          </button>
        </div>

        <div className="mt-4 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="card-cartoon bg-[#f9f7f2] p-4">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Carte existante</span>
              <select
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={selectedCardId}
                onChange={(event) => setSelectedCardId(event.target.value)}
              >
                <option value="">Nouvelle carte</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    #{card.cardNumber} - {card.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Code</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={cardDraft.code}
                  onChange={(event) => setCardDraft({ ...cardDraft, code: event.target.value })}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-ink">Numero</span>
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    type="number"
                    min={1}
                    value={cardDraft.cardNumber}
                    onChange={(event) => setCardDraft({ ...cardDraft, cardNumber: event.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-ink">Rarete</span>
                  <select
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={cardDraft.rarity}
                    onChange={(event) =>
                      setCardDraft({ ...cardDraft, rarity: event.target.value as LotteryCardRarity })
                    }
                  >
                    {(["common", "silver", "gold", "epic", "legendary"] as const).map((rarity) => (
                      <option key={rarity} value={rarity}>
                        {rarityLabels[rarity]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Nom</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={cardDraft.name}
                  onChange={(event) => setCardDraft({ ...cardDraft, name: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Illustration</span>
                <LotteryCardImageUpload
                  value={cardDraft.imageUrl}
                  onChange={(imageUrl) => setCardDraft({ ...cardDraft, imageUrl })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">URL image manuelle</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={cardDraft.imageUrl}
                  onChange={(event) => setCardDraft({ ...cardDraft, imageUrl: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Prompt visuel</span>
                <textarea
                  className="min-h-[120px] border-2 border-[#1a1a1a] px-3 py-2 text-sm"
                  value={cardDraft.visualPrompt}
                  onChange={(event) => setCardDraft({ ...cardDraft, visualPrompt: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Description</span>
                <textarea
                  className="min-h-[120px] border-2 border-[#1a1a1a] px-3 py-2 text-sm"
                  value={cardDraft.description}
                  onChange={(event) => setCardDraft({ ...cardDraft, description: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={cardDraft.isActive}
                  onChange={(event) => setCardDraft({ ...cardDraft, isActive: event.target.checked })}
                />
                Carte active
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-cartoon btn-primary h-10 px-4 text-xs"
                onClick={() => void saveCard()}
                disabled={savingCard}
              >
                {savingCard ? "..." : selectedCardId ? "Mettre a jour" : "Creer la carte"}
              </button>
              {selectedCardId && (
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-10 px-4 text-xs"
                  onClick={() => void archiveCard(selectedCardId)}
                  disabled={archivingCardId === selectedCardId}
                >
                  {archivingCardId === selectedCardId ? "..." : "Archiver"}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`card-cartoon p-4 text-left ${
                  selectedCardId === card.id ? "bg-[#fff1d6]" : "bg-[#f9f7f2]"
                }`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-charcoal">
                      #{card.cardNumber} - {rarityLabels[card.rarity]}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-ink">{card.name}</p>
                  </div>
                  <span className="pill-cartoon px-2 py-1 text-xs">{card.isActive ? "Actif" : "Inactif"}</span>
                </div>
                <div className="mt-3 relative h-40 overflow-hidden rounded-[14px] border-2 border-[#1a1a1a] bg-white">
                  {isRenderableImageSource(card.imageUrl) ? (
                    isRemoteImageUrl(card.imageUrl) ? (
                      <img
                        src={card.imageUrl}
                        alt={`Carte ${card.name}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Image src={card.imageUrl} alt={`Carte ${card.name}`} fill sizes="240px" className="object-cover" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold text-charcoal">
                      Sans illustration
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-charcoal line-clamp-3">{card.description}</p>
                <p className="mt-2 font-mono text-[11px] text-charcoal">{card.code}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {stats && (
        <section className="card-cartoon bg-white p-5">
          <h3 className="font-display text-2xl text-ink">Statistiques</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Packs</p>
              <p className="mt-1 text-xl font-semibold text-ink">{stats.totalTickets}</p>
            </div>
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Disponibles</p>
              <p className="mt-1 text-xl font-semibold text-ink">{stats.availableTickets}</p>
            </div>
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Ouverts</p>
              <p className="mt-1 text-xl font-semibold text-ink">{stats.scratchedTickets}</p>
            </div>
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Copies obtenues</p>
              <p className="mt-1 text-xl font-semibold text-ink">{stats.totalCollectedCopies}</p>
            </div>
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Cartes uniques</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {stats.uniqueCollectedCards}/{stats.totalCardDefinitions}
              </p>
            </div>
            <div className="card-cartoon bg-[#f9f7f2] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Completion</p>
              <p className="mt-1 text-xl font-semibold text-ink">{stats.completionPercent}%</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {stats.byCardRarity.map((entry) => (
              <div key={entry.rarity} className="card-cartoon bg-[#fff8ea] p-3">
                <p className="text-sm font-semibold text-ink">{rarityLabels[entry.rarity]}</p>
                <p className="mt-1 text-xs text-charcoal">
                  {entry.ownedUnique}/{entry.defined} cartes uniques
                </p>
                <p className="mt-1 text-xs text-charcoal">{entry.ownedCopies} copies totales</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            {stats.recentScratches.map((entry) => (
              <div key={`${entry.ticketNumber}-${entry.scratchedAt}`} className="card-cartoon bg-[#f9f7f2] p-3">
                <p className="font-mono text-xs text-ink">{entry.ticketNumber}</p>
                <p className="mt-1 text-sm text-charcoal">
                  {entry.cardName ? `#${entry.cardNumber} - ${entry.cardName}` : "Carte inconnue"}{" "}
                  {entry.cardRarity ? `(${rarityLabels[entry.cardRarity]})` : ""}
                </p>
                <p className="mt-1 text-xs text-charcoal">
                  {new Date(entry.scratchedAt).toLocaleString("fr-FR")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && activeCards.length === 0 && (
        <p className="text-sm font-semibold text-ink">Aucune carte active pour le moment.</p>
      )}
    </div>
  );
}
