"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LotteryCardImageUpload } from "@/components/admin/LotteryCardImageUpload";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import type {
  LotteryBonusDefinition,
  LotteryBonusOption,
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

type BonusDraft = {
  code: string;
  title: string;
  description: string;
  imageUrl: string;
  quotaPerCycle: string;
  isActive: boolean;
};

type BonusOptionDraft = {
  label: string;
  kind: LotteryBonusOption["kind"];
  giftWeightGrams: string;
  giftProductSku: string;
  giftLabel: string;
  customPayload: string;
  sortOrder: string;
};

const rarityLabels: Record<LotteryCardRarity, string> = {
  common: "Commune",
  silver: "Silver",
  gold: "Gold",
  epic: "Epique",
  legendary: "Legendaire",
};

const CARD_RARITIES: LotteryCardRarity[] = ["common", "silver", "gold", "epic", "legendary"];

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

const emptyBonusDraft = (): BonusDraft => ({
  code: "",
  title: "",
  description: "",
  imageUrl: "",
  quotaPerCycle: "0",
  isActive: true,
});

const emptyBonusOptionDraft = (): BonusOptionDraft => ({
  label: "",
  kind: "custom",
  giftWeightGrams: "",
  giftProductSku: "",
  giftLabel: "",
  customPayload: "{}",
  sortOrder: "100",
});

export function AdminLotteryPanel() {
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [cards, setCards] = useState<LotteryCardDefinition[]>([]);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [bonuses, setBonuses] = useState<LotteryBonusDefinition[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [status, setStatus] = useState("Chargement loterie...");
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [cardDraft, setCardDraft] = useState<CardDraft>(emptyCardDraft());
  const [selectedBonusId, setSelectedBonusId] = useState<string>("");
  const [bonusDraft, setBonusDraft] = useState<BonusDraft>(emptyBonusDraft());
  const [bonusOptionDraft, setBonusOptionDraft] = useState<BonusOptionDraft>(emptyBonusOptionDraft());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualTicketCount, setManualTicketCount] = useState("1");
  const [manualTicketReason, setManualTicketReason] = useState("Attribution manuelle loterie");
  const [grantingTickets, setGrantingTickets] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [savingBonus, setSavingBonus] = useState(false);
  const [savingBonusOption, setSavingBonusOption] = useState(false);
  const [archivingCardId, setArchivingCardId] = useState<string | null>(null);
  const [archivingBonusId, setArchivingBonusId] = useState<string | null>(null);
  const [deletingBonusOptionId, setDeletingBonusOptionId] = useState<string | null>(null);

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
        bonuses?: LotteryBonusDefinition[];
        stats?: LotteryStats;
        error?: string;
      };

      if (!lotteryResponse.ok || !lotteryPayload.config) {
        setStatus(lotteryPayload.error ?? "Impossible de charger la loterie.");
        return;
      }

      const nextCards = (lotteryPayload.cards ?? []).sort((left, right) => left.cardNumber - right.cardNumber);
      const nextBonuses = [...(lotteryPayload.bonuses ?? [])].sort((left, right) =>
        left.code.localeCompare(right.code),
      );
      setConfig(lotteryPayload.config);
      setCards(nextCards);
      setBonuses(nextBonuses);
      setStats(lotteryPayload.stats ?? null);

      if (customersResponse.ok) {
        const customersPayload = (await customersResponse.json()) as { customers?: AdminCustomerListItem[] };
        setCustomers(customersPayload.customers ?? []);
      }

      setSelectedCardId((current) =>
        current && nextCards.some((card) => card.id === current) ? current : nextCards[0]?.id ?? "",
      );
      setSelectedBonusId((current) =>
        current && nextBonuses.some((bonus) => bonus.id === current) ? current : nextBonuses[0]?.id ?? "",
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

  const selectedBonus = useMemo(
    () => bonuses.find((bonus) => bonus.id === selectedBonusId) ?? null,
    [bonuses, selectedBonusId],
  );

  const quotaTotal = useMemo(() => {
    if (!config) {
      return 0;
    }
    return CARD_RARITIES.reduce((sum, rarity) => sum + (config.cardQuotas[rarity] ?? 0), 0);
  }, [config]);

  const quotaBudgetOk = config ? quotaTotal === config.cycleSize : false;

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

  useEffect(() => {
    if (!selectedBonus) {
      setBonusDraft(emptyBonusDraft());
      setBonusOptionDraft(emptyBonusOptionDraft());
      return;
    }

    setBonusDraft({
      code: selectedBonus.code,
      title: selectedBonus.title,
      description: selectedBonus.description,
      imageUrl: selectedBonus.imageUrl,
      quotaPerCycle: String(selectedBonus.quotaPerCycle),
      isActive: selectedBonus.isActive,
    });
    setBonusOptionDraft(emptyBonusOptionDraft());
  }, [selectedBonus]);

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    if (!quotaBudgetOk) {
      setStatus(`Le total des quotas doit etre exactement ${config.cycleSize}.`);
      return;
    }

    const response = await fetch("/api/admin/lottery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eurosPerTicket: config.eurosPerTicket,
        maxTicketsPerOrder: config.maxTicketsPerOrder,
        collectionTitle: config.collectionTitle,
        seasonLabel: config.seasonLabel,
        albumSubtitle: config.albumSubtitle,
        albumBoosterTitle: config.albumBoosterTitle,
        albumBoosterDescription: config.albumBoosterDescription,
        cycleSize: config.cycleSize,
        commonQuota: config.cardQuotas.common,
        silverQuota: config.cardQuotas.silver,
        goldQuota: config.cardQuotas.gold,
        epicQuota: config.cardQuotas.epic,
        legendaryQuota: config.cardQuotas.legendary,
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

  const saveBonus = async () => {
    setSavingBonus(true);

    try {
      const response = await fetch(
        selectedBonusId
          ? `/api/admin/lottery/bonuses/${encodeURIComponent(selectedBonusId)}`
          : "/api/admin/lottery/bonuses",
        {
          method: selectedBonusId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: bonusDraft.code,
            title: bonusDraft.title,
            description: bonusDraft.description,
            imageUrl: bonusDraft.imageUrl,
            quotaPerCycle: Number(bonusDraft.quotaPerCycle),
            isActive: bonusDraft.isActive,
          }),
        },
      );

      const payload = (await response.json()) as { bonus?: LotteryBonusDefinition; error?: string };
      if (!response.ok || !payload.bonus) {
        setStatus(payload.error ?? "Sauvegarde carte bonus impossible.");
        return;
      }

      setSelectedBonusId(payload.bonus.id);
      setStatus(selectedBonusId ? "Carte bonus mise a jour." : "Carte bonus creee.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur sauvegarde carte bonus.");
    } finally {
      setSavingBonus(false);
    }
  };

  const archiveBonus = async (bonusId: string) => {
    setArchivingBonusId(bonusId);

    try {
      const response = await fetch(`/api/admin/lottery/bonuses/${encodeURIComponent(bonusId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) {
        setStatus(payload.error ?? "Archivage carte bonus impossible.");
        return;
      }

      if (selectedBonusId === bonusId) {
        setSelectedBonusId("");
      }
      setStatus("Carte bonus archivee.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur archivage carte bonus.");
    } finally {
      setArchivingBonusId(null);
    }
  };

  const createBonusOption = async () => {
    if (!selectedBonusId) {
      setStatus("Selectionne d'abord une carte bonus.");
      return;
    }

    setSavingBonusOption(true);
    try {
      let customPayload: Record<string, unknown> | undefined;
      if (bonusOptionDraft.customPayload.trim()) {
        customPayload = JSON.parse(bonusOptionDraft.customPayload) as Record<string, unknown>;
      }

      const response = await fetch(
        `/api/admin/lottery/bonuses/${encodeURIComponent(selectedBonusId)}/options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: bonusOptionDraft.label,
            kind: bonusOptionDraft.kind,
            giftWeightGrams: Number(bonusOptionDraft.giftWeightGrams),
            giftProductSku: bonusOptionDraft.giftProductSku,
            giftLabel: bonusOptionDraft.giftLabel,
            customPayload,
            sortOrder: Number(bonusOptionDraft.sortOrder),
          }),
        },
      );

      const payload = (await response.json()) as { option?: LotteryBonusOption; error?: string };
      if (!response.ok || !payload.option) {
        setStatus(payload.error ?? "Creation option bonus impossible.");
        return;
      }

      setBonusOptionDraft(emptyBonusOptionDraft());
      setStatus("Option bonus ajoutee.");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur creation option bonus.";
      setStatus(message.includes("JSON") ? "Le JSON customPayload est invalide." : message);
    } finally {
      setSavingBonusOption(false);
    }
  };

  const deleteBonusOption = async (optionId: string) => {
    if (!selectedBonusId) {
      return;
    }

    setDeletingBonusOptionId(optionId);
    try {
      const response = await fetch(
        `/api/admin/lottery/bonuses/${encodeURIComponent(selectedBonusId)}/options/${encodeURIComponent(optionId)}`,
        {
          method: "DELETE",
        },
      );

      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) {
        setStatus(payload.error ?? "Suppression option bonus impossible.");
        return;
      }

      setStatus("Option bonus supprimee.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur suppression option bonus.");
    } finally {
      setDeletingBonusOptionId(null);
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
              Regle du cycle: quotas admin sur 50 000 packs, puis relance automatique d&apos;une nouvelle boucle.
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
              <span className="font-semibold text-ink">Label saison</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={config.seasonLabel}
                onChange={(event) => setConfig({ ...config, seasonLabel: event.target.value })}
                placeholder="Saison 1"
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
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Taille du cycle (packs)</span>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={1000}
                value={config.cycleSize}
                onChange={(event) =>
                  setConfig({ ...config, cycleSize: Math.max(1000, Number(event.target.value) || config.cycleSize) })
                }
              />
            </label>
            <div className="rounded border-2 border-[#1a1a1a] bg-[#fff8dc] px-3 py-2 text-sm font-semibold text-ink md:col-span-2 xl:col-span-3">
              Total quotas: {quotaTotal} / {config.cycleSize}
              <span className={`ml-2 ${quotaBudgetOk ? "text-green-700" : "text-red-700"}`}>
                {quotaBudgetOk ? "(OK)" : "(invalide)"}
              </span>
            </div>
            {CARD_RARITIES.map((rarity) => (
              <label key={rarity} className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Quota {rarityLabels[rarity]} (/ {config.cycleSize})</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  type="number"
                  min={0}
                  value={config.cardQuotas[rarity]}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      cardQuotas: {
                        ...config.cardQuotas,
                        [rarity]: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
                <span className="text-xs text-charcoal">
                  {config.cycleSize > 0 ? (((config.cardQuotas[rarity] ?? 0) / config.cycleSize) * 100).toFixed(2) : "0.00"}%
                </span>
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

        <button
          type="button"
          className="btn-cartoon btn-primary mt-4 h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void saveConfig()}
          disabled={!quotaBudgetOk}
        >
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
            <h3 className="font-display text-2xl text-ink">Cartes Bonus</h3>
            <p className="mt-1 text-sm text-charcoal">
              Ces cartes remplacent 1 slot du pack quand elles sont gagnees. Quota configure par cycle.
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary h-10 px-4 text-xs"
            onClick={() => {
              setSelectedBonusId("");
              setBonusDraft(emptyBonusDraft());
              setBonusOptionDraft(emptyBonusOptionDraft());
            }}
          >
            Nouvelle carte bonus
          </button>
        </div>

        <div className="mt-4 grid gap-5 xl:grid-cols-[380px_1fr]">
          <div className="card-cartoon bg-[#f9f7f2] p-4">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-ink">Carte bonus existante</span>
              <select
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={selectedBonusId}
                onChange={(event) => setSelectedBonusId(event.target.value)}
              >
                <option value="">Nouvelle carte bonus</option>
                {bonuses.map((bonus) => (
                  <option key={bonus.id} value={bonus.id}>
                    {bonus.code} - {bonus.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Code</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={bonusDraft.code}
                  onChange={(event) => setBonusDraft({ ...bonusDraft, code: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Titre</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={bonusDraft.title}
                  onChange={(event) => setBonusDraft({ ...bonusDraft, title: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Description</span>
                <textarea
                  className="min-h-[90px] border-2 border-[#1a1a1a] px-3 py-2 text-sm"
                  value={bonusDraft.description}
                  onChange={(event) => setBonusDraft({ ...bonusDraft, description: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Illustration</span>
                <LotteryCardImageUpload
                  value={bonusDraft.imageUrl}
                  onChange={(imageUrl) => setBonusDraft({ ...bonusDraft, imageUrl })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">Quota par cycle</span>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  type="number"
                  min={0}
                  value={bonusDraft.quotaPerCycle}
                  onChange={(event) => setBonusDraft({ ...bonusDraft, quotaPerCycle: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={bonusDraft.isActive}
                  onChange={(event) => setBonusDraft({ ...bonusDraft, isActive: event.target.checked })}
                />
                Carte bonus active
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-cartoon btn-primary h-10 px-4 text-xs"
                onClick={() => void saveBonus()}
                disabled={savingBonus}
              >
                {savingBonus ? "..." : selectedBonusId ? "Mettre a jour" : "Creer la carte bonus"}
              </button>
              {selectedBonusId && (
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-10 px-4 text-xs"
                  onClick={() => void archiveBonus(selectedBonusId)}
                  disabled={archivingBonusId === selectedBonusId}
                >
                  {archivingBonusId === selectedBonusId ? "..." : "Archiver"}
                </button>
              )}
            </div>

            {selectedBonus && (
              <div className="mt-5 border-t-2 border-[#1a1a1a] pt-4">
                <h4 className="font-display text-lg text-ink">Options du bon</h4>
                <p className="mt-1 text-xs text-charcoal">Ex: 20g de fleurs OU 2 boites de tisane</p>

                <div className="mt-3 grid gap-2">
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    placeholder="Label option"
                    value={bonusOptionDraft.label}
                    onChange={(event) => setBonusOptionDraft({ ...bonusOptionDraft, label: event.target.value })}
                  />
                  <select
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    value={bonusOptionDraft.kind}
                    onChange={(event) =>
                      setBonusOptionDraft({
                        ...bonusOptionDraft,
                        kind: event.target.value as LotteryBonusOption["kind"],
                      })
                    }
                  >
                    <option value="custom">Custom</option>
                    <option value="gift_weight_grams">Gift weight grams</option>
                    <option value="gift_product">Gift product</option>
                  </select>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      placeholder="giftWeightGrams"
                      type="number"
                      min={0}
                      value={bonusOptionDraft.giftWeightGrams}
                      onChange={(event) =>
                        setBonusOptionDraft({ ...bonusOptionDraft, giftWeightGrams: event.target.value })
                      }
                    />
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      placeholder="sortOrder"
                      type="number"
                      min={0}
                      value={bonusOptionDraft.sortOrder}
                      onChange={(event) => setBonusOptionDraft({ ...bonusOptionDraft, sortOrder: event.target.value })}
                    />
                  </div>
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    placeholder="giftProductSku"
                    value={bonusOptionDraft.giftProductSku}
                    onChange={(event) => setBonusOptionDraft({ ...bonusOptionDraft, giftProductSku: event.target.value })}
                  />
                  <input
                    className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                    placeholder="giftLabel"
                    value={bonusOptionDraft.giftLabel}
                    onChange={(event) => setBonusOptionDraft({ ...bonusOptionDraft, giftLabel: event.target.value })}
                  />
                  <textarea
                    className="min-h-[70px] border-2 border-[#1a1a1a] px-2 py-2 text-sm font-mono"
                    placeholder='customPayload JSON (ex: {"choice":"flowers"})'
                    value={bonusOptionDraft.customPayload}
                    onChange={(event) => setBonusOptionDraft({ ...bonusOptionDraft, customPayload: event.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-4 text-xs"
                    onClick={() => void createBonusOption()}
                    disabled={savingBonusOption}
                  >
                    {savingBonusOption ? "..." : "Ajouter option"}
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  {selectedBonus.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between gap-3 rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
                      <div className="text-xs text-charcoal">
                        <p className="font-semibold text-ink">{option.label}</p>
                        <p>
                          {option.kind}
                          {option.giftWeightGrams ? ` · ${option.giftWeightGrams}g` : ""}
                          {option.giftProductSku ? ` · ${option.giftProductSku}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-8 px-3 text-[10px]"
                        onClick={() => void deleteBonusOption(option.id)}
                        disabled={deletingBonusOptionId === option.id}
                      >
                        {deletingBonusOptionId === option.id ? "..." : "Supprimer"}
                      </button>
                    </div>
                  ))}
                  {selectedBonus.options.length < 1 && (
                    <p className="text-xs text-charcoal">Aucune option configuree.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {bonuses.map((bonus) => (
              <button
                key={bonus.id}
                type="button"
                className={`card-cartoon p-4 text-left ${selectedBonusId === bonus.id ? "bg-[#fff1d6]" : "bg-[#f9f7f2]"}`}
                onClick={() => setSelectedBonusId(bonus.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-charcoal">{bonus.code}</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{bonus.title}</p>
                  </div>
                  <span className="pill-cartoon px-2 py-1 text-xs">{bonus.isActive ? "Actif" : "Inactif"}</span>
                </div>
                <div className="mt-2 text-xs text-charcoal">
                  Quota/cycle: <span className="font-semibold text-ink">{bonus.quotaPerCycle}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-charcoal">{bonus.description}</p>
                <div className="mt-2 text-xs text-charcoal">Options: {bonus.options.length}</div>
              </button>
            ))}
            {bonuses.length < 1 && (
              <div className="card-cartoon bg-[#f9f7f2] p-4 text-sm text-charcoal">
                Aucune carte bonus pour l&apos;instant.
              </div>
            )}
          </div>
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
