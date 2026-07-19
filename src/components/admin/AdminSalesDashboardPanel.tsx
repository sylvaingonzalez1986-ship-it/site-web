"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminProductSalesDashboard,
  AdminSalesPeriodSummary,
  AdminSalesProductSummary,
} from "@/types/sales-dashboard";

type SalesView = "all" | "month" | "week";
type SortKey = "revenue" | "quantity" | "orders";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const integerFormatter = new Intl.NumberFormat("fr-FR");
const parisDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
});
const parisDateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return parisDateFormatter.format(new Date(parsed));
}

function formatGeneratedAt(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return parisDateTimeFormatter.format(new Date(parsed));
}

function formatPeriodOption(period: AdminSalesPeriodSummary): string {
  if (!period.startsAt || !period.endsAt) {
    return period.periodLabel;
  }
  return `${period.periodLabel} (${formatDate(period.startsAt)} - ${formatDate(period.endsAt)})`;
}

function sortProducts(
  products: AdminSalesProductSummary[],
  sortKey: SortKey,
): AdminSalesProductSummary[] {
  return [...products].sort((a, b) => {
    if (sortKey === "quantity" && b.quantitySold !== a.quantitySold) {
      return b.quantitySold - a.quantitySold;
    }
    if (sortKey === "orders" && b.ordersCount !== a.ordersCount) {
      return b.ordersCount - a.ordersCount;
    }
    if (b.revenueTtc !== a.revenueTtc) {
      return b.revenueTtc - a.revenueTtc;
    }
    if (b.quantitySold !== a.quantitySold) {
      return b.quantitySold - a.quantitySold;
    }
    return a.productName.localeCompare(b.productName, "fr");
  });
}

export function AdminSalesDashboardPanel() {
  const [dashboard, setDashboard] = useState<AdminProductSalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [view, setView] = useState<SalesView>("all");
  const [periodKey, setPeriodKey] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  const loadDashboard = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/sales-dashboard", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus(payload?.error || "Impossible de charger les ventes.");
        setDashboard(null);
        return;
      }

      const payload = (await response.json()) as { dashboard?: AdminProductSalesDashboard };
      setDashboard(payload.dashboard ?? null);
      setStatus("Ventes chargees.");
    } catch {
      setStatus("Erreur reseau sur le dashboard ventes.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const periods = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    if (view === "week") {
      return dashboard.byWeek;
    }
    if (view === "month") {
      return dashboard.byMonth;
    }
    return [dashboard.allTime];
  }, [dashboard, view]);

  useEffect(() => {
    if (view === "all") {
      setPeriodKey("all");
      return;
    }

    if (periods.length === 0) {
      setPeriodKey("");
      return;
    }

    if (!periods.some((period) => period.periodKey === periodKey)) {
      setPeriodKey(periods[0].periodKey);
    }
  }, [periodKey, periods, view]);

  const selectedPeriod = useMemo(() => {
    if (!dashboard) {
      return null;
    }
    if (view === "all") {
      return dashboard.allTime;
    }
    return periods.find((period) => period.periodKey === periodKey) ?? periods[0] ?? null;
  }, [dashboard, periodKey, periods, view]);

  const products = useMemo(
    () => (selectedPeriod ? sortProducts(selectedPeriod.products, sortKey) : []),
    [selectedPeriod, sortKey],
  );

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-ink">Dashboard ventes</h2>
          {dashboard && (
            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-charcoal">
              Mis a jour {formatGeneratedAt(dashboard.generatedAt)}
            </p>
          )}
        </div>
        <button type="button" className="btn-cartoon btn-secondary" onClick={loadDashboard}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading || !dashboard || !selectedPeriod ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement ventes...</div>
      ) : dashboard.allTime.products.length === 0 ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">
          Aucune vente realisee a comptabiliser.
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">CA TTC</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(selectedPeriod.revenueTtc)}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Produits vendus</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {formatInteger(selectedPeriod.quantitySold)}
              </p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Commandes</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {formatInteger(selectedPeriod.ordersCount)}
              </p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">TVA</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(selectedPeriod.vatAmount)}</p>
            </article>
          </div>

          <div className="card-cartoon bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[auto,1fr,auto] lg:items-center">
              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "Depuis le debut"],
                  ["month", "Par mois"],
                  ["week", "Par semaine"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`pill-cartoon px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                      view === value ? "bg-[#1a1a1a] text-white" : "bg-[#f7f4ee] text-ink"
                    }`}
                    onClick={() => setView(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                {view !== "all" && (
                  <select
                    className="h-11 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm"
                    value={selectedPeriod.periodKey}
                    onChange={(event) => setPeriodKey(event.target.value)}
                  >
                    {periods.map((period) => (
                      <option key={period.periodKey} value={period.periodKey}>
                        {formatPeriodOption(period)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <select
                className="h-11 border-2 border-[#1a1a1a] bg-white px-3 text-sm"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                <option value="revenue">Tri CA TTC</option>
                <option value="quantity">Tri quantite</option>
                <option value="orders">Tri commandes</option>
              </select>
            </div>
          </div>

          <article className="card-cartoon bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">{selectedPeriod.periodLabel}</h3>
                <p className="text-sm text-charcoal">
                  {selectedPeriod.startsAt && selectedPeriod.endsAt
                    ? `${formatDate(selectedPeriod.startsAt)} - ${formatDate(selectedPeriod.endsAt)}`
                    : "Toutes les ventes realisees"}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                CA HT {formatMoney(selectedPeriod.revenueHt)}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#f4f1ea]">
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Produit</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Categorie</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Quantite</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Commandes</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">CA TTC</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">CA HT</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">TVA</th>
                    <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Derniere vente</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.productId}>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        <div className="font-semibold text-ink">{product.productName}</div>
                        <div className="text-xs text-charcoal">{product.productId}</div>
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        <span className="pill-cartoon bg-[#f7f4ee] px-2 py-1 text-xs">
                          {product.category ?? (product.isCurrentProduct ? "-" : "Historique")}
                        </span>
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        {formatInteger(product.quantitySold)}
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        {formatInteger(product.ordersCount)}
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2 font-semibold">
                        {formatMoney(product.revenueTtc)}
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        {formatMoney(product.revenueHt)}
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        {formatMoney(product.vatAmount)}
                      </td>
                      <td className="border border-[#1a1a1a] px-2 py-2">
                        {formatDate(product.lastSoldAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
