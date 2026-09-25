"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useEffect, useId, useState } from "react";
import { Check, Dices, Gift, LockKeyhole, ShoppingBag } from "lucide-react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { findKqProducerRewardForEntry, type KqProducerRewardProgress } from "@/lib/kanab-quest-producer-rewards";

async function fetchProducerRewardCampaigns(signal?: AbortSignal) {
  const response = await fetch("/api/contest/producer-rewards", { cache: "no-store", signal });
  if (!response.ok) throw new Error("La progression du producteur est momentanément indisponible.");
  const payload = await response.json() as { campaigns?: KqProducerRewardProgress[] };
  return Array.isArray(payload.campaigns) ? payload.campaigns : [];
}

const formatGameEuros = (cents: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
}).format(cents / 100);

export function ProducerRewardJourney({
  isAuthenticated, embedded = false, entryId, onCampaignsChange,
}: {
  isAuthenticated: boolean;
  embedded?: boolean;
  entryId?: string;
  onCampaignsChange?: (campaigns: KqProducerRewardProgress[]) => void;
}) {
  const titleId = useId();
  const [campaigns, setCampaigns] = useState<KqProducerRewardProgress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedProducerId, setSelectedProducerId] = useState("");
  const [pending, setPending] = useState<"completion" | "purchase-buddie" | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetchProducerRewardCampaigns(controller.signal)
        .then((next) => {
          setCampaigns(next);
          onCampaignsChange?.(next);
          setError("");
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Progression indisponible.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    };
    window.addEventListener("kq:producer-rewards-changed", refresh);
    refresh();
    return () => {
      controller.abort();
      window.removeEventListener("kq:producer-rewards-changed", refresh);
    };
  }, [isAuthenticated, onCampaignsChange]);

  const campaign = entryId
    ? findKqProducerRewardForEntry(campaigns, entryId)
    : campaigns.find((item) => item.producerId === selectedProducerId) ?? campaigns[0] ?? null;

  const claim = async (action: "completion" | "purchase-buddie") => {
    if (!campaign || pending) return;
    setPending(action);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/contest/producer-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, producerId: campaign.producerId }),
      });
      const payload = await response.json() as { error?: string; campaign?: KqProducerRewardProgress | null; receipt?: { alreadyGranted?: boolean } };
      if (!response.ok) throw new Error(payload.error || "Récompense indisponible. Réessaie dans un instant.");
      const nextCampaign = payload.campaign;
      if (nextCampaign) {
        const updated = campaigns.map((item) => item.producerId === nextCampaign.producerId ? nextCampaign : item);
        setCampaigns(updated);
        onCampaignsChange?.(updated);
      }
      setNotice(action === "completion" ? "Ton bonus de dégustation est disponible dans le Placard." : payload.receipt?.alreadyGranted ? "Tu as déjà reçu le Buddie de ce producteur." : "Ton Buddie a rejoint ta collection !");
      window.dispatchEvent(new Event("kq:producer-rewards-changed"));
      window.dispatchEvent(new Event("kq:collection-updated"));
      window.dispatchEvent(new Event("kq:boosters-updated"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Récompense indisponible.");
    } finally {
      setPending(null);
    }
  };

  if (!isAuthenticated) return <p className="rounded border-2 border-ink bg-cream p-4 text-sm font-semibold"><Link href="/compte/connexion" className="font-black underline">Connecte-toi</Link> pour suivre tes dégustations et retrouver tes récompenses.</p>;
  if (loaded && !campaign && !error) return null;

  return <section className={(embedded ? "" : "mb-8 ") + "min-w-0 rounded border-2 border-ink bg-cream p-4 shadow-[4px_4px_0_#17130e]"} aria-labelledby={titleId}>
    <header>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green">Les découvertes du producteur</p>
      <h2 id={titleId} className="mt-1 break-words font-display text-3xl uppercase leading-tight text-ink">{campaign?.producerName ?? "Ton parcours de dégustation"}</h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal">Regular ou Concours, chaque fleur compte dans le même parcours.</p>
    </header>
    {!entryId && campaigns.length > 1 ? <label className="mt-3 block text-xs font-bold">Choisir un producteur<select value={campaign?.producerId ?? ""} onChange={(event) => { setSelectedProducerId(event.target.value); setNotice(""); }} className="mt-1 min-h-11 w-full rounded border-2 border-ink bg-white px-3">{campaigns.map((item) => <option key={item.producerId} value={item.producerId}>{item.producerName}</option>)}</select></label> : null}
    {!loaded ? <p role="status" className="mt-4 text-sm">Chargement de tes dégustations…</p> : null}
    {campaign ? <div className="mt-4 grid min-w-0 gap-4">
      <div className="rounded border-2 border-ink bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-black"><span>{campaign.reviewedCount} / {campaign.requiredCount} fleurs dégustées</span><span className="text-green">{campaign.completionReward.granted ? "Bonus reçu" : formatGameEuros(campaign.completionReward.cashCents) + " dans le jeu"}</span></div>
        <progress className="mt-3 block h-3 w-full accent-green" value={campaign.reviewedCount} max={Math.max(1, campaign.requiredCount)} aria-label="Fleurs dégustées avec un avis validé" />
        <p className="mt-3 text-xs leading-relaxed text-charcoal">{campaign.completionReward.granted ? "Tu as reçu le bonus de ce producteur. Continue tes découvertes à ton rythme." : "Goûte toutes ses fleurs du carnet et fais valider tes avis pour recevoir le bonus, une fois par producteur."}</p>
        {campaign.completed && !campaign.completionReward.granted ? <button type="button" disabled={!!pending} onClick={() => void claim("completion")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border-2 border-ink bg-yellow px-3 text-xs font-black disabled:opacity-50"><Gift size={17} aria-hidden="true" />{pending === "completion" ? "Attribution…" : "Récupérer mon bonus"}</button> : null}
      </div>

      <ul className="grid gap-2" aria-label="Fleurs du producteur">
        {campaign.entries.map((flower) => <li key={flower.productId || flower.entryId} className="flex flex-wrap items-center gap-2 rounded border border-ink/20 bg-white/70 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 break-words font-bold">{flower.title}</span>
          <span className={flower.purchased ? "inline-flex items-center gap-1 text-green" : "inline-flex items-center gap-1 text-charcoal"}><ShoppingBag size={13} aria-hidden="true" />{flower.purchased ? "Achetée" : "À découvrir"}</span>
          <span className={flower.reviewed ? "inline-flex items-center gap-1 font-bold text-green" : "inline-flex items-center gap-1 font-bold text-charcoal"}>{flower.reviewed ? <Check size={14} aria-hidden="true" /> : null}{flower.reviewed ? "Avis validé" : "À déguster"}</span>
        </li>)}
      </ul>

      <div className="rounded border-2 border-ink bg-[#fff3c4] p-3">
        <h3 className="flex items-center gap-2 font-display text-xl uppercase"><Dices size={20} aria-hidden="true" /> Ton Buddie surprise</h3>
        {campaign.purchaseReward.granted ? campaign.purchaseReward.card ? <div className="mt-3 flex items-center gap-3">
          {campaign.purchaseReward.card.imageUrl ? <Image src={campaign.purchaseReward.card.imageUrl} alt={campaign.purchaseReward.card.name} width={96} height={144} sizes="96px" className="h-auto w-24 shrink-0 rounded" /> : null}
          <div className="min-w-0"><p className="text-xs font-black uppercase">Buddie {campaign.purchaseReward.card.rarity === "gold" ? "Or" : "Argent"}</p><strong className="mt-1 block break-words">{campaign.purchaseReward.card.name}</strong><Link href="/profil/collection" className="mt-2 inline-flex min-h-11 items-center text-xs font-black underline">Ouvrir ma collection</Link></div>
        </div> : <p className="mt-3 text-xs font-bold">Tu as déjà reçu le Buddie de ce producteur.</p> : <>
          <p className="mt-2 text-xs leading-relaxed">Achète toutes les fleurs de ce parcours pour tirer un Buddie au hasard parmi les cartes Argent et Or disponibles. Un tirage par producteur ; tes achats peuvent venir de plusieurs commandes.</p>
          <p className="mt-2 text-xs font-black">{campaign.purchasedCount} / {campaign.requiredCount} fleurs achetées</p>
          <button type="button" disabled={!campaign.purchaseReward.eligible || !!pending} onClick={() => void claim("purchase-buddie")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border-2 border-ink bg-green px-3 text-xs font-black text-white disabled:bg-white disabled:text-charcoal disabled:opacity-60">{campaign.purchaseReward.eligible ? <Dices size={17} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}{pending === "purchase-buddie" ? "Tirage en cours…" : campaign.purchaseReward.eligible ? "Tirer mon Buddie" : "Complète les achats pour tirer"}</button>
        </>}
      </div>

      {campaign.heritageCode ? <details className="rounded border-2 border-ink bg-white p-3">
        <summary className="cursor-pointer text-sm font-black">Carte Héritage · {campaign.heritageGranted ? "Débloquée" : "Au premier avis éligible validé"}</summary>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {campaign.heritageImage || getKqCardArtwork(campaign.heritageCode) ? <Image src={campaign.heritageImage || getKqCardArtwork(campaign.heritageCode)!} alt={"Carte Héritage " + campaign.heritageName} width={120} height={180} sizes="120px" className={"h-auto w-28 rounded " + (campaign.heritageGranted ? "" : "grayscale")} /> : null}
          <div className="min-w-0 flex-1 basis-36"><strong className="block text-sm">{campaign.heritageName}</strong><p className="mt-1 text-xs leading-relaxed">{campaign.heritageDescription}</p><p className="mt-2 text-xs font-semibold">{campaign.heritageGranted ? "Disponible dans ton album et utilisable dans le Placard." : "Un premier avis validé sur une fleur éligible du producteur débloque cette carte."}</p></div>
        </div>
      </details> : null}
    </div> : null}
    {notice ? <p role="status" className="mt-3 text-sm font-bold text-green">{notice}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm font-bold text-red-800">{error}</p> : null}
  </section>;
}
