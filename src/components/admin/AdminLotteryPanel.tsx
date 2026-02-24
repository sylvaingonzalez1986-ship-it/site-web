﻿"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { LotteryConfig, LotteryPrize, LotteryPrizeRarity, LotteryStats } from "@/types/lottery";

const rarityLabels: Record<LotteryPrizeRarity, string> = {
  common: "Commun",
  rare: "Rare",
  epic: "Epique",
  legendary: "Legendaire",
};

const rarityBadgeClass: Record<LotteryPrizeRarity, string> = {
  common: "bg-[#e9e2d4] text-ink",
  rare: "bg-[#cdeae3] text-[#0a7b61]",
  epic: "bg-[#fbe4b5] text-[#8a4b00]",
  legendary: "bg-[#f5d2d2] text-[#8a1f1f]",
};

type PrizeDraft = {
  name: string;
  description: string;
  rarity: LotteryPrizeRarity;
  probabilityPercent: string;
  imageUrl: string;
  valueEuros: string;
  stock: string;
  isActive: boolean;
};

function emptyPrizeDraft(): PrizeDraft {
  return {
    name: "",
    description: "",
    rarity: "common",
    probabilityPercent: "0",
    imageUrl: "",
    valueEuros: "0",
    stock: "",
    isActive: true,
  };
}

function toProbabilityFromPercent(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }

  return Number((parsed / 100).toFixed(6));
}

function toMoney(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }

  return Number(parsed.toFixed(2));
}

function toStock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }

  return Math.max(0, Math.floor(parsed));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function AdminLotteryPanel() {
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [newPrize, setNewPrize] = useState<PrizeDraft>(emptyPrizeDraft());
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingPrize, setCreatingPrize] = useState(false);
  const [savingPrizeId, setSavingPrizeId] = useState<string | null>(null);
  const [deletingPrizeId, setDeletingPrizeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Chargement loterie...");

  const activeProbabilityTotal = useMemo(
    () => prizes.filter((prize) => prize.isActive).reduce((sum, prize) => sum + prize.probability, 0),
    [prizes],
  );

  const loadData = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/lottery", { cache: "no-store" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStatus(data?.error ?? "Impossible de charger la loterie.");
        return;
      }

      const data = (await response.json()) as {
        config: LotteryConfig;
        prizes: LotteryPrize[];
        stats: LotteryStats;
      };

      setConfig(data.config);
      setPrizes(data.prizes);
      setStats(data.stats);
      setStatus("Loterie chargee.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur de chargement loterie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    setSavingConfig(true);
    setStatus("Sauvegarde configuration loterie...");

    try {
      const response = await fetch("/api/admin/lottery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketThresholdEuros: config.ticketThresholdEuros,
          isActive: config.isActive,
        }),
      });

      const data = (await response.json()) as {
        config: LotteryConfig;
        stats: LotteryStats;
        error: string;
      };

      if (!response.ok || !data.config) {
        setStatus(data.error ?? "Erreur sauvegarde loterie.");
        return;
      }

      setConfig(data.config);
      if (data.stats) {
        setStats(data.stats);
      }
      setStatus("Configuration loterie sauvegardee.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur sauvegarde loterie.");
    } finally {
      setSavingConfig(false);
    }
  };

  const createPrize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const probability = toProbabilityFromPercent(newPrize.probabilityPercent);
    const valueEuros = toMoney(newPrize.valueEuros);
    const stock = toStock(newPrize.stock);

    if (!Number.isFinite(probability) || !Number.isFinite(valueEuros) || (stock !== null && Number.isNaN(stock))) {
      setStatus("Valeurs lot invalides.");
      return;
    }

    setCreatingPrize(true);
    setStatus("Creation du lot...");

    try {
      const response = await fetch("/api/admin/lottery/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPrize.name,
          description: newPrize.description,
          rarity: newPrize.rarity,
          probability,
          imageUrl: newPrize.imageUrl,
          valueEuros,
          stock,
          isActive: newPrize.isActive,
        }),
      });

      const data = (await response.json()) as { prize: LotteryPrize; error: string };

      const createdPrize = data.prize;
      if (!response.ok || !createdPrize) {
        setStatus(data.error ?? "Impossible de creer le lot.");
        return;
      }

      setPrizes((current) => [...current, createdPrize]);
      setNewPrize(emptyPrizeDraft());
      setStatus("Lot cree.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur creation lot.");
    } finally {
      setCreatingPrize(false);
    }
  };

  const updatePrizeField = <K extends keyof LotteryPrize>(
    prizeId: string,
    key: K,
    value: LotteryPrize[K],
  ) => {
    setPrizes((current) =>
      current.map((prize) => (prize.id === prizeId ? { ...prize, [key]: value } : prize)),
    );
  };

  const savePrize = async (prize: LotteryPrize) => {
    setSavingPrizeId(prize.id);
    setStatus(`Sauvegarde du lot ${prize.name}...`);

    try {
      const response = await fetch(`/api/admin/lottery/prizes/${encodeURIComponent(prize.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prize.name,
          description: prize.description,
          rarity: prize.rarity,
          probability: prize.probability,
          imageUrl: prize.imageUrl,
          valueEuros: prize.valueEuros,
          stock: prize.stock,
          isActive: prize.isActive,
        }),
      });

      const data = (await response.json()) as { prize: LotteryPrize; error: string };

      const updatedPrize = data.prize;
      if (!response.ok || !updatedPrize) {
        setStatus(data.error ?? "Erreur mise a jour lot.");
        return;
      }

      setPrizes((current) =>
        current.map((item) => (item.id === updatedPrize.id ? updatedPrize : item)),
      );
      setStatus(`Lot ${updatedPrize.name} mis a jour.`);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur mise a jour lot.");
    } finally {
      setSavingPrizeId(null);
    }
  };

  const deletePrize = async (prize: LotteryPrize) => {
    const confirmed = window.confirm(`Supprimer le lot \"${prize.name}\" `);
    if (!confirmed) {
      return;
    }

    setDeletingPrizeId(prize.id);
    setStatus(`Suppression du lot ${prize.name}...`);

    try {
      const response = await fetch(`/api/admin/lottery/prizes/${encodeURIComponent(prize.id)}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { success: boolean; error: string };
      if (!response.ok || !data.success) {
        setStatus(data.error ?? "Suppression lot impossible.");
        return;
      }

      setPrizes((current) => current.filter((item) => item.id !== prize.id));
      setStatus("Lot supprime.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur suppression lot.");
    } finally {
      setDeletingPrizeId(null);
    }
  };

  return (
    <div className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Loterie</h2>
        <button
          type="button"
          className="btn-cartoon btn-secondary"
          onClick={() => void loadData()}
          disabled={loading}
        >
          Rafraichir
        </button>
      </div>

      <p className="mt-2 text-sm text-charcoal">{status}</p>

      {loading && <p className="mt-4 text-charcoal">Chargement...</p>}

      {!loading && config && (
        <>
          <section className="card-cartoon mt-6 bg-white p-5">
            <h3 className="font-display text-2xl text-ink">Configuration</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-xs uppercase tracking-[0.08em] text-charcoal">
                Seuil euros TTC / ticket
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  type="number"
                  min={1}
                  step="0.01"
                  value={config.ticketThresholdEuros}
                  onChange={(event) =>
                    setConfig((current) =>
                      current
                        ? {
                            ...current,
                            ticketThresholdEuros: Number(event.target.value) || current.ticketThresholdEuros,
                          }
                        : current,
                    )
                  }
                />
              </label>

              <label className="flex items-center gap-2 border-2 border-[#1a1a1a] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.isActive}
                  onChange={(event) =>
                    setConfig((current) =>
                      current ? { ...current, isActive: event.target.checked } : current,
                    )
                  }
                />
                Loterie active
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-10"
                  onClick={() => void saveConfig()}
                  disabled={savingConfig}
                >
                  {savingConfig ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </section>

          <section className="card-cartoon mt-6 bg-white p-5">
            <h3 className="font-display text-2xl text-ink">Lots</h3>
            <p className="mt-2 text-sm text-charcoal">
              Probabilite active totale: <span className="font-semibold text-ink">{formatPercent(activeProbabilityTotal)}</span>
            </p>
            {activeProbabilityTotal > 1 && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                La somme des probabilites actives depasse 100%.
              </p>
            )}

            <form className="mt-5 grid gap-3 md:grid-cols-7" onSubmit={createPrize}>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                placeholder="Nom du lot"
                value={newPrize.name}
                onChange={(event) => setNewPrize((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <select
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                value={newPrize.rarity}
                onChange={(event) =>
                  setNewPrize((current) => ({ ...current, rarity: event.target.value as LotteryPrizeRarity }))
                }
              >
                {Object.entries(rarityLabels).map(([rarity, label]) => (
                  <option key={rarity} value={rarity}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="Proba %"
                value={newPrize.probabilityPercent}
                onChange={(event) =>
                  setNewPrize((current) => ({ ...current, probabilityPercent: event.target.value }))
                }
              />
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                placeholder="Valeur €"
                value={newPrize.valueEuros}
                onChange={(event) => setNewPrize((current) => ({ ...current, valueEuros: event.target.value }))}
              />
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                type="number"
                min={0}
                step={1}
                placeholder="Stock (vide = infini)"
                value={newPrize.stock}
                onChange={(event) => setNewPrize((current) => ({ ...current, stock: event.target.value }))}
              />
              <button
                type="submit"
                className="btn-cartoon btn-secondary h-10"
                disabled={creatingPrize}
              >
                {creatingPrize ? "Creation..." : "Ajouter"}
              </button>

              <textarea
                className="min-h-20 border-2 border-[#1a1a1a] p-2 text-sm md:col-span-5"
                placeholder="Description"
                value={newPrize.description}
                onChange={(event) => setNewPrize((current) => ({ ...current, description: event.target.value }))}
              />
              <input
                className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                placeholder="Image URL (optionnel)"
                value={newPrize.imageUrl}
                onChange={(event) => setNewPrize((current) => ({ ...current, imageUrl: event.target.value }))}
              />
              <label className="md:col-span-7 flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={newPrize.isActive}
                  onChange={(event) => setNewPrize((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Lot actif
              </label>
            </form>

            <div className="mt-6 grid gap-4">
              {prizes.length === 0 && <p className="text-sm text-charcoal">Aucun lot configure.</p>}

              {prizes.map((prize) => (
                <article key={prize.id} className="card-cartoon bg-[#f9f7f2] p-4">
                  <div className="grid gap-3 md:grid-cols-7">
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                      value={prize.name}
                      onChange={(event) => updatePrizeField(prize.id, "name", event.target.value)}
                    />
                    <select
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      value={prize.rarity}
                      onChange={(event) =>
                        updatePrizeField(prize.id, "rarity", event.target.value as LotteryPrizeRarity)
                      }
                    >
                      {Object.entries(rarityLabels).map(([rarity, label]) => (
                        <option key={rarity} value={rarity}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={(prize.probability * 100).toFixed(4)}
                      onChange={(event) =>
                        updatePrizeField(
                          prize.id,
                          "probability",
                          Math.max(0, Number((Number(event.target.value) / 100).toFixed(6)) || 0),
                        )
                      }
                    />
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={prize.valueEuros}
                      onChange={(event) =>
                        updatePrizeField(prize.id, "valueEuros", Number(event.target.value) || 0)
                      }
                    />
                    <input
                      className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                      type="number"
                      min={0}
                      step={1}
                      value={prize.stock ?? ""}
                      placeholder="infini"
                      onChange={(event) => {
                        const nextValue = event.target.value.trim();
                        updatePrizeField(
                          prize.id,
                          "stock",
                          nextValue ? Math.max(0, Math.floor(Number(nextValue) || 0)) : null,
                        );
                      }}
                    />
                    <label className="flex items-center gap-2 border-2 border-[#1a1a1a] px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={prize.isActive}
                        onChange={(event) => updatePrizeField(prize.id, "isActive", event.target.checked)}
                      />
                      Actif
                    </label>
                  </div>

                  <textarea
                    className="mt-3 min-h-20 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                    value={prize.description}
                    onChange={(event) => updatePrizeField(prize.id, "description", event.target.value)}
                  />

                  <input
                    className="mt-3 h-10 w-full border-2 border-[#1a1a1a] px-2 text-sm"
                    placeholder="Image URL"
                    value={prize.imageUrl}
                    onChange={(event) => updatePrizeField(prize.id, "imageUrl", event.target.value)}
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className={`pill-cartoon px-3 py-1 text-xs ${rarityBadgeClass[prize.rarity]}`}>
                      {rarityLabels[prize.rarity]} - {formatPercent(prize.probability)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                        disabled={savingPrizeId === prize.id}
                        onClick={() => void savePrize(prize)}
                      >
                        {savingPrizeId === prize.id ? "Sauvegarde..." : "Sauvegarder"}
                      </button>
                      <button
                        type="button"
                        className="btn-cartoon btn-primary h-9 px-3 text-xs"
                        disabled={deletingPrizeId === prize.id}
                        onClick={() => void deletePrize(prize)}
                      >
                        {deletingPrizeId === prize.id ? "Suppression..." : "Supprimer"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {stats && (
            <section className="card-cartoon mt-6 bg-white p-5">
              <h3 className="font-display text-2xl text-ink">Statistiques</h3>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Tickets</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{stats.totalTickets}</p>
                </div>
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Disponibles</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{stats.availableTickets}</p>
                </div>
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Grattes</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{stats.scratchedTickets}</p>
                </div>
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Gagnants</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{stats.winningTickets}</p>
                </div>
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Taux de gain</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{formatPercent(stats.winRate)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <h4 className="font-semibold text-ink">Gains par raret</h4>
                  <ul className="mt-2 grid gap-1 text-sm text-charcoal">
                    {stats.byRarity.map((entry) => (
                      <li key={entry.rarity}>
                        {rarityLabels[entry.rarity]}: <span className="font-semibold text-ink">{entry.wins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card-cartoon bg-[#f9f7f2] p-3">
                  <h4 className="font-semibold text-ink">Lots les plus gagnes</h4>
                  {stats.byPrize.length === 0 ? (
                    <p className="mt-2 text-sm text-charcoal">Aucun gain enregistre.</p>
                  ) : (
                    <ul className="mt-2 grid gap-1 text-sm text-charcoal">
                      {stats.byPrize.slice(0, 8).map((entry) => (
                        <li key={entry.prizeId}>
                          {entry.prizeName} ({rarityLabels[entry.rarity]}):{" "}
                          <span className="font-semibold text-ink">{entry.wins}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 card-cartoon bg-[#f9f7f2] p-3">
                <h4 className="font-semibold text-ink">Derniers grattages</h4>
                {stats.recentScratches.length === 0 ? (
                  <p className="mt-2 text-sm text-charcoal">Aucun grattage pour le moment.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                      <thead>
                        <tr>
                          <th className="border border-[#1a1a1a] px-2 py-1">Ticket</th>
                          <th className="border border-[#1a1a1a] px-2 py-1">Commande</th>
                          <th className="border border-[#1a1a1a] px-2 py-1">Résultat</th>
                          <th className="border border-[#1a1a1a] px-2 py-1">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentScratches.map((entry) => (
                          <tr key={`${entry.ticketNumber}-${entry.scratchedAt}`}>
                            <td className="border border-[#1a1a1a] px-2 py-1">{entry.ticketNumber}</td>
                            <td className="border border-[#1a1a1a] px-2 py-1">{entry.orderId ?? "-"}</td>
                            <td className="border border-[#1a1a1a] px-2 py-1">
                              {entry.isWin ? `${entry.prizeName ?? "Gain"} (${entry.rarity ? rarityLabels[entry.rarity] : "-"})` : "Perdu"}
                            </td>
                            <td className="border border-[#1a1a1a] px-2 py-1">
                              {new Date(entry.scratchedAt).toLocaleString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}




