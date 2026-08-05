"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, LockKeyhole, Sparkles } from "lucide-react";
import {
  findKqProducerRewardForEntry,
  type KqProducerRewardProgress,
} from "@/lib/kanab-quest-producer-rewards";

export function ContestHeritageUnlockCard({
  entryId,
  isAuthenticated,
}: {
  entryId: string;
  isAuthenticated: boolean;
}) {
  const [campaign, setCampaign] = useState<KqProducerRewardProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    void fetch("/api/contest/producer-rewards", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Progression Héritage indisponible.");
        return response.json() as Promise<{ campaigns?: KqProducerRewardProgress[] }>;
      })
      .then((payload) => setCampaign(findKqProducerRewardForEntry(payload.campaigns ?? [], entryId)))
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Progression Héritage indisponible.");
        }
      })
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, [entryId, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <aside className="mt-4 rounded border-2 border-ink bg-cream p-4 text-sm text-charcoal">
        <strong className="block text-ink">Une carte Héritage est liée au parcours de ce producteur.</strong>
        <Link href="/compte/connexion" className="mt-2 inline-flex font-black text-green underline">Connecte-toi pour voir ta progression.</Link>
      </aside>
    );
  }
  if (!loaded) {
    return <div className="mt-4 h-28 animate-pulse rounded border-2 border-ink/20 bg-cream" aria-label="Chargement de la récompense Héritage" />;
  }
  if (!campaign) {
    return (
      <aside className="mt-4 rounded border-2 border-dashed border-ink bg-cream p-4 text-sm text-charcoal">
        <strong className="block text-ink">Carte Héritage du producteur</strong>
        <p className="mt-1">{error ?? "Aucune carte n’est encore associée à cette fleur. Son producteur doit d’abord être renseigné et son parcours activé."}</p>
      </aside>
    );
  }

  const stateLabel = campaign.heritageGranted
    ? "Carte débloquée"
    : "Avis à faire valider";

  return (
    <aside className="mt-4 overflow-hidden rounded border-2 border-ink bg-[#f7edcf] shadow-[3px_3px_0_#17130e]" aria-labelledby={`heritage-${campaign.campaignId}`}>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#7d4b11]">Récompense du producteur</p>
            <h3 id={`heritage-${campaign.campaignId}`} className="mt-1 font-display text-xl uppercase leading-none text-ink">{campaign.heritageName}</h3>
          </div>
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 text-[10px] font-black uppercase leading-tight ${campaign.heritageGranted ? "bg-green text-white" : campaign.completed ? "bg-yellow text-ink" : "bg-white text-ink"}`}>
            {campaign.heritageGranted ? <Gift size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
            {stateLabel}
          </span>
        </div>

        <div className="mt-4 grid items-start gap-4 sm:grid-cols-[minmax(150px,190px)_minmax(0,1fr)]">
          <div className={`relative mx-auto aspect-[2/3] w-full max-w-[210px] overflow-hidden rounded border-2 border-ink bg-white shadow-[3px_3px_0_rgba(23,19,14,0.18)] ${campaign.heritageGranted ? "" : "grayscale"}`}>
            {campaign.heritageImage ? <Image src={campaign.heritageImage} alt={`Carte Héritage ${campaign.heritageName}`} fill sizes="(max-width: 639px) 210px, 190px" className="object-contain" /> : <Sparkles className="absolute inset-0 m-auto" aria-hidden="true" />}
          </div>

          <div className="min-w-0 rounded border-2 border-ink/20 bg-white/60 p-3">
            <p className="mt-2 text-xs font-semibold leading-relaxed text-charcoal">{campaign.heritageDescription}</p>
            <p className="mt-3 text-xs font-black leading-snug text-ink">{campaign.heritageGranted ? "Cette carte permanente est disponible dans ton album." : `Fais valider ton avis sur cette fleur ou une autre fleur de ${campaign.producerName} pour débloquer automatiquement la carte.`}</p>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-ink bg-white p-3">
        {campaign.heritageGranted ? (
          <Link href="/arene/placard" className="inline-flex min-h-11 w-full items-center justify-center border-2 border-ink bg-green px-4 text-xs font-black uppercase text-white shadow-[2px_2px_0_#17130e]">Équiper dans le Placard</Link>
        ) : (
          <div className="flex min-h-11 w-full items-center justify-center border-2 border-ink bg-[#ded8ca] px-4 text-center text-xs font-black uppercase text-ink">
            Carte débloquée après validation de l’avis
          </div>
        )}
        {error ? <p className="mt-2 text-xs font-bold text-red-800" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}
