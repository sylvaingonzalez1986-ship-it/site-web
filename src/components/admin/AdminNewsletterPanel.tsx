"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewsletterSubscriber } from "@/types/newsletter";

type AdminNewsletterResponse = {
  subscribers: NewsletterSubscriber[];
  error: string;
};

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Date(parsed).toLocaleString("fr-FR");
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminNewsletterPanel() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Chargement...");
  const [query, setQuery] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const loadSubscribers = async () => {
    setLoading(true);
    setStatus("Chargement...");

    try {
      const response = await fetch("/api/admin/newsletter", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as AdminNewsletterResponse | null;

      if (!response.ok) {
        setStatus(payload?.error ?? "Erreur de chargement.");
        return;
      }

      const nextSubscribers = Array.isArray(payload?.subscribers) ? payload.subscribers : [];
      setSubscribers(nextSubscribers);
      setStatus(`${nextSubscribers.length} contact(s) charge(s).`);
    } catch {
      setStatus("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscribers();
  }, []);

  const filteredSubscribers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return subscribers.filter((subscriber) => {
      if (showOnlyActive && subscriber.status !== "active") {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        subscriber.email.toLowerCase().includes(normalizedQuery) ||
        subscriber.source.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, showOnlyActive, subscribers]);

  const activeEmails = useMemo(
    () =>
      filteredSubscribers
        .filter((subscriber) => subscriber.status === "active")
        .map((subscriber) => subscriber.email),
    [filteredSubscribers],
  );

  const copyActiveEmails = async () => {
    if (activeEmails.length === 0) {
      setStatus("Aucun e-mail actif a copier.");
      return;
    }

    const text = activeEmails.join(", ");
    if (!navigator.clipboard.writeText) {
      setStatus("Copie non supportee sur ce navigateur.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${activeEmails.length} e-mail(s) copie(s).`);
    } catch {
      setStatus("Echec de copie.");
    }
  };

  const exportCsv = () => {
    if (filteredSubscribers.length === 0) {
      setStatus("Aucune ligne a exporter.");
      return;
    }

    const header = ["email", "status", "source", "created_at", "updated_at", "last_contacted_at"];
    const rows = filteredSubscribers.map((subscriber) => [
      escapeCsvCell(subscriber.email),
      escapeCsvCell(subscriber.status),
      escapeCsvCell(subscriber.source),
      escapeCsvCell(subscriber.createdAt),
      escapeCsvCell(subscriber.updatedAt),
      escapeCsvCell(subscriber.lastContactedAt ?? ""),
    ]);

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
    downloadCsv(`newsletter-contacts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setStatus(`Export CSV genere (${filteredSubscribers.length} ligne(s)).`);
  };

  return (
    <div className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Newsletter</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-cartoon btn-secondary" onClick={loadSubscribers} disabled={loading}>
            {loading ? "Chargement..." : "Recharger"}
          </button>
          <button type="button" className="btn-cartoon btn-secondary" onClick={copyActiveEmails}>
            Copier emails actifs
          </button>
          <button type="button" className="btn-cartoon btn-primary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-charcoal">
        Cette liste se remplit automatiquement depuis le bouton &quot;Me prevenir&quot; de la page App.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
          placeholder="Recherche e-mail ou source"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="inline-flex h-11 items-center gap-2 border-2 border-[#1a1a1a] bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(event) => setShowOnlyActive(event.target.checked)}
          />
          Actifs uniquement
        </label>
        <div className="inline-flex h-11 items-center border-2 border-[#1a1a1a] bg-white px-3 text-sm font-semibold text-ink">
          {filteredSubscribers.length} résultat(s)
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold text-charcoal">Etat: {status}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#f4f1ea]">
              <th className="border border-[#1a1a1a] px-3 py-2">Email</th>
              <th className="border border-[#1a1a1a] px-3 py-2">Statut</th>
              <th className="border border-[#1a1a1a] px-3 py-2">Source</th>
              <th className="border border-[#1a1a1a] px-3 py-2">Inscription</th>
              <th className="border border-[#1a1a1a] px-3 py-2">Derniere mise a jour</th>
              <th className="border border-[#1a1a1a] px-3 py-2">Dernier contact</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscribers.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-[#1a1a1a] px-3 py-4 text-center text-charcoal">
                  Aucun contact pour le moment.
                </td>
              </tr>
            ) : (
              filteredSubscribers.map((subscriber) => (
                <tr key={`${subscriber.id}-${subscriber.email}`}>
                  <td className="border border-[#1a1a1a] px-3 py-2 font-semibold text-ink">
                    {subscriber.email}
                  </td>
                  <td className="border border-[#1a1a1a] px-3 py-2">{subscriber.status}</td>
                  <td className="border border-[#1a1a1a] px-3 py-2">{subscriber.source}</td>
                  <td className="border border-[#1a1a1a] px-3 py-2">{formatDateTime(subscriber.createdAt)}</td>
                  <td className="border border-[#1a1a1a] px-3 py-2">{formatDateTime(subscriber.updatedAt)}</td>
                  <td className="border border-[#1a1a1a] px-3 py-2">
                    {subscriber.lastContactedAt ? formatDateTime(subscriber.lastContactedAt) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


