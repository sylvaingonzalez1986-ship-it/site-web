"use client";

import { useEffect, useState } from "react";
import { Check, Gift, LockKeyhole, PackageOpen, Sprout } from "lucide-react";
import type { KqProducerRewardProgress } from "@/lib/kanab-quest-producer-rewards";

async function fetchProducerRewardCampaigns(signal?: AbortSignal) {
  const response = await fetch("/api/contest/producer-rewards", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Progression indisponible");
  const payload = await response.json() as { campaigns?: KqProducerRewardProgress[] };
  return Array.isArray(payload.campaigns) ? payload.campaigns : [];
}

export function ProducerRewardJourney({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [campaigns, setCampaigns] = useState<KqProducerRewardProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetchProducerRewardCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
    };
    window.addEventListener("kq:producer-rewards-changed", refresh);
    void fetchProducerRewardCampaigns(controller.signal)
      .then(setCampaigns)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCampaigns([]);
      })
      .finally(() => setLoaded(true));
    return () => {
      controller.abort();
      window.removeEventListener("kq:producer-rewards-changed", refresh);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || (loaded && campaigns.length === 0)) return null;

  return (
    <section className="mb-8 rounded border-2 border-ink bg-cream p-4 shadow-[5px_5px_0_#17130e] md:p-6" aria-labelledby="producer-journey-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Carnet → Placard</p>
          <h2 id="producer-journey-title" className="mt-1 font-display text-3xl uppercase leading-none text-ink">Parcours des producteurs</h2>
        </div>
        <p className="max-w-lg text-sm font-semibold text-charcoal">Chaque avis validé offre un booster La Botte de 10 cartes. Termine le parcours d’un producteur, puis débloque son Héritage depuis la fiche d’une de ses fleurs.</p>
      </header>
      {!loaded ? <div className="mt-5 h-24 animate-pulse rounded bg-white/70" aria-label="Chargement des parcours" /> : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <article key={campaign.campaignId} className="rounded border-2 border-ink bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-charcoal">{campaign.reviewedCount}/{campaign.requiredCount} fleurs</span>
                  <h3 className="font-display text-2xl uppercase text-ink">{campaign.producerName}</h3>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink ${campaign.heritageGranted ? "bg-yellow" : "bg-mint"}`}>
                  {campaign.heritageGranted ? <Gift aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-ink bg-cream">
                <span className="block h-full bg-green" style={{ width: `${campaign.requiredCount ? (campaign.reviewedCount / campaign.requiredCount) * 100 : 0}%` }} />
              </div>
              <ul className="mt-4 grid gap-2">
                {campaign.entries.map((entry) => (
                  <li key={entry.entryId} className="flex items-center gap-2 text-sm font-bold text-ink">
                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink ${entry.reviewed ? "bg-green text-white" : "bg-cream"}`}>
                      {entry.reviewed ? <Check size={14} aria-hidden="true" /> : <Sprout size={14} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                    <small className="uppercase text-charcoal">{entry.track === "concours" ? "Concours" : "Regular"}</small>
                    {entry.boosterGranted ? <PackageOpen size={17} aria-label="Booster obtenu" /> : null}
                  </li>
                ))}
              </ul>
              <footer className="mt-4 border-t-2 border-dashed border-ink/30 pt-3">
                <strong className="block text-sm text-ink">Héritage : {campaign.heritageName}</strong>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-charcoal">{campaign.heritageDescription}</p>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
