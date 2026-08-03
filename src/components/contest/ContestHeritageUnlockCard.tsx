"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Gift, LockKeyhole, Sparkles } from "lucide-react";
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
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthenticated) {
      setLoaded(true);
      setCampaign(null);
      return;
    }
    const response = await fetch("/api/contest/producer-rewards", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("Progression Héritage indisponible.");
    const payload = await response.json() as { campaigns?: KqProducerRewardProgress[] };
    setCampaign(findKqProducerRewardForEntry(payload.campaigns ?? [], entryId));
    setLoaded(true);
  }, [entryId, isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setMessage(null);
    setError(null);
    void load(controller.signal).catch((loadError: unknown) => {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setLoaded(true);
        setError(loadError instanceof Error ? loadError.message : "Progression Héritage indisponible.");
      }
    });
    return () => controller.abort();
  }, [load]);

  async function claim() {
    if (!campaign || claiming || !campaign.completed || campaign.heritageGranted) return;
    setClaiming(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/contest/producer-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.campaignId, entryId }),
      });
      const payload = await response.json() as {
        campaign?: KqProducerRewardProgress | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Déblocage impossible.");
      if (payload.campaign) setCampaign(payload.campaign);
      else await load();
      setMessage(`${campaign.heritageName} a rejoint ton album.`);
      window.dispatchEvent(new Event("kq:producer-rewards-changed"));
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Déblocage impossible.");
    } finally {
      setClaiming(false);
    }
  }

  if (!loaded) {
    return <div className="mt-4 h-28 animate-pulse rounded border-2 border-ink/20 bg-cream" aria-label="Chargement de la récompense Héritage" />;
  }
  if (!isAuthenticated) {
    return (
      <aside className="mt-4 rounded border-2 border-ink bg-cream p-4 text-sm text-charcoal">
        <strong className="block text-ink">Une carte Héritage est liée au parcours de ce producteur.</strong>
        <Link href="/compte/connexion" className="mt-2 inline-flex font-black text-green underline">Connecte-toi pour voir ta progression.</Link>
      </aside>
    );
  }
  if (!campaign) return error ? <p className="mt-4 text-xs font-bold text-red-800">{error}</p> : null;

  const missing = Math.max(0, campaign.requiredCount - campaign.reviewedCount);
  const stateLabel = campaign.heritageGranted
    ? "Carte débloquée"
    : campaign.completed
      ? "Prête à débloquer"
      : `${missing} avis validé${missing > 1 ? "s" : ""} restant${missing > 1 ? "s" : ""}`;

  return (
    <aside className="mt-4 overflow-hidden rounded border-2 border-ink bg-[#f7edcf] shadow-[3px_3px_0_#17130e]" aria-labelledby={`heritage-${campaign.campaignId}`}>
      <div className="grid grid-cols-[84px_1fr] gap-3 p-3 sm:grid-cols-[112px_1fr] sm:p-4">
        <div className="relative aspect-[2/3] overflow-hidden rounded border-2 border-ink bg-white">
          {campaign.heritageImage ? <Image src={campaign.heritageImage} alt={`Carte Héritage ${campaign.heritageName}`} fill sizes="112px" className="object-cover" /> : <Sparkles className="absolute inset-0 m-auto" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#7d4b11]">Récompense du producteur</p>
          <h3 id={`heritage-${campaign.campaignId}`} className="mt-1 font-display text-xl uppercase leading-none text-ink">{campaign.heritageName}</h3>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-charcoal">{campaign.heritageDescription}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-black text-ink">
            {campaign.heritageGranted ? <Gift size={17} aria-hidden="true" /> : campaign.completed ? <Check size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}
            <span>{stateLabel}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-ink bg-white" aria-label={`${campaign.reviewedCount} fleurs validées sur ${campaign.requiredCount}`}>
            <span className="block h-full bg-green" style={{ width: `${campaign.requiredCount ? (campaign.reviewedCount / campaign.requiredCount) * 100 : 0}%` }} />
          </div>
          <small className="mt-1 block font-bold text-charcoal">{campaign.reviewedCount}/{campaign.requiredCount} fleurs goûtées et validées</small>
        </div>
      </div>
      <div className="border-t-2 border-ink bg-white p-3">
        {campaign.heritageGranted ? (
          <Link href="/arene/placard" className="inline-flex min-h-11 w-full items-center justify-center border-2 border-ink bg-green px-4 text-xs font-black uppercase text-white shadow-[2px_2px_0_#17130e]">Équiper dans le Placard</Link>
        ) : (
          <button type="button" onClick={() => void claim()} disabled={!campaign.completed || claiming} className="inline-flex min-h-11 w-full items-center justify-center border-2 border-ink bg-yellow px-4 text-xs font-black uppercase text-ink shadow-[2px_2px_0_#17130e] disabled:cursor-not-allowed disabled:bg-[#ded8ca] disabled:opacity-70">
            {claiming ? "Déblocage…" : campaign.completed ? "Débloquer cette carte Héritage" : `Encore ${missing} avis à faire valider`}
          </button>
        )}
        {message ? <p className="mt-2 text-xs font-bold text-green" role="status">{message}</p> : null}
        {error ? <p className="mt-2 text-xs font-bold text-red-800" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}
