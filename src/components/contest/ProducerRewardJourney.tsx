"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Gift, LockKeyhole, Sprout } from "lucide-react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import {
  findKqProducerRewardForEntry,
  type KqProducerRewardProgress,
} from "@/lib/kanab-quest-producer-rewards";

async function fetchProducerRewardCampaigns(signal?: AbortSignal) {
  const response = await fetch("/api/contest/producer-rewards", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Progression indisponible");
  const payload = await response.json() as { campaigns?: KqProducerRewardProgress[] };
  return Array.isArray(payload.campaigns) ? payload.campaigns : [];
}

export function ProducerRewardJourney({
  isAuthenticated,
  embedded = false,
  entryId,
  onCampaignsChange,
}: {
  isAuthenticated: boolean;
  embedded?: boolean;
  entryId?: string;
  onCampaignsChange?: (campaigns: KqProducerRewardProgress[]) => void;
}) {
  const [campaigns, setCampaigns] = useState<KqProducerRewardProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    const updateCampaigns = (nextCampaigns: KqProducerRewardProgress[]) => {
      setCampaigns(nextCampaigns);
      onCampaignsChange?.(nextCampaigns);
    };
    const refresh = () => {
      void fetchProducerRewardCampaigns().then(updateCampaigns).catch(() => updateCampaigns([]));
    };
    window.addEventListener("kq:producer-rewards-changed", refresh);
    void fetchProducerRewardCampaigns(controller.signal)
      .then(updateCampaigns)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) updateCampaigns([]);
      })
      .finally(() => setLoaded(true));
    return () => {
      controller.abort();
      window.removeEventListener("kq:producer-rewards-changed", refresh);
    };
  }, [isAuthenticated, onCampaignsChange]);

  if (!isAuthenticated || (loaded && campaigns.length === 0)) return null;
  const selectedCampaign = entryId
    ? findKqProducerRewardForEntry(campaigns, entryId)
    : campaigns[0] ?? null;
  if (loaded && !selectedCampaign) return null;

  return (
    <section className={`${embedded ? "" : "mb-8"} rounded border-2 border-ink bg-cream p-4 shadow-[5px_5px_0_#17130e] md:p-6`} aria-labelledby="producer-journey-title">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Carnet → Placard</p>
          <h2 id="producer-journey-title" className="mt-1 font-display text-3xl uppercase leading-none text-ink">Collection du producteur</h2>
        </div>
        <p className="max-w-lg break-words text-sm font-semibold text-charcoal">Chaque producteur possède une carte Héritage. Fais valider ton avis sur l’une de ses fleurs éligibles pour la débloquer automatiquement.</p>
      </header>
      {!loaded ? <div className="mt-5 h-24 animate-pulse rounded bg-white/70" aria-label="Chargement des parcours" /> : (
        <div className="mt-5 min-w-0">
          {(selectedCampaign ? [selectedCampaign] : []).map((campaign) => (
            <article key={campaign.campaignId} className="min-w-0 overflow-hidden rounded border-2 border-ink bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-charcoal">Carte du producteur</span>
                  <h3 className="break-words font-display text-2xl uppercase leading-tight text-ink">{campaign.producerName}</h3>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink ${campaign.heritageGranted ? "bg-yellow" : "bg-mint"}`}>
                  {campaign.heritageGranted ? <Gift aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-ink bg-cream">
                <span className="block h-full bg-green" style={{ width: campaign.heritageGranted ? "100%" : "0%" }} />
              </div>
              <div className="mt-4 grid min-w-0 items-start gap-4 sm:grid-cols-[minmax(125px,160px)_minmax(0,1fr)]">
                <div className={`relative mx-auto aspect-[2/3] w-full max-w-40 overflow-hidden rounded border-2 border-ink bg-cream shadow-[3px_3px_0_#17130e] ${campaign.heritageGranted ? "" : "grayscale"}`}>
                  {(campaign.heritageImage || getKqCardArtwork(campaign.heritageCode)) ? (
                    <Image
                      src={campaign.heritageImage || getKqCardArtwork(campaign.heritageCode) || ""}
                      alt={`Carte Héritage ${campaign.heritageName} de ${campaign.producerName}`}
                      fill
                      sizes="160px"
                      className="object-contain"
                    />
                  ) : null}
                  {!campaign.heritageGranted ? <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded border-2 border-ink bg-white/90 px-2 py-1 text-[9px] font-black uppercase"><LockKeyhole size={12} /> Bloquée</span> : null}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-green">Fleurs éligibles</p>
                  <ul className="mt-2 grid gap-2">
                    {campaign.entries.map((entry) => (
                      <li key={entry.entryId} className="flex items-center gap-2 text-sm font-bold text-ink">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream"><Sprout size={14} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 break-words">{entry.title}</span>
                        <small className="shrink-0 uppercase text-charcoal">{entry.track === "concours" ? "Concours" : "Regular"}</small>
                      </li>
                    ))}
                  </ul>
                  <footer className="mt-4 border-t-2 border-dashed border-ink/30 pt-3">
                    <strong className="block break-words text-sm text-ink">Héritage : {campaign.heritageName}</strong>
                    <p className="mt-1 break-words text-xs font-semibold leading-relaxed text-charcoal">{campaign.heritageDescription}</p>
                    <p className="mt-2 break-words text-xs font-black text-ink">{campaign.heritageGranted ? "Carte débloquée et disponible dans ton album." : "Fais valider ton avis sur une des fleurs ci-dessus pour révéler cette carte."}</p>
                  </footer>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
