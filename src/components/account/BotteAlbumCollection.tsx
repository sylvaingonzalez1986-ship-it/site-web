"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { KQ_CARDS } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";

type BotteSnapshot = {
  collection?: { cards?: Array<{ code: string; ownedCopies: number }> };
  heritage?: {
    cards?: Array<{ code: string; ownedCopies: number }>;
    fragmentBalance?: number;
  } | null;
};

type DisplayCard = {
  code: string;
  name: string;
  rarity?: string;
  description: string;
};

const RARITY_LABELS: Record<string, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
};

function CollectionCard({
  card,
  copies,
  permanent,
}: {
  card: DisplayCard;
  copies: number;
  permanent: boolean;
}) {
  const artwork = getKqCardArtwork(card.code);
  const discovered = copies > 0;

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border-2 border-ink shadow-[4px_4px_0_#1a1a1a] ${
        discovered ? "bg-white" : "bg-[#ddd8ce]"
      }`}
    >
      <div className="relative aspect-[2/3] overflow-hidden border-b-2 border-ink bg-[#c9c4b9]">
        {artwork ? (
          <Image
            src={artwork}
            alt={`Carte ${card.name}`}
            fill
            sizes="(max-width: 639px) 44vw, (max-width: 1023px) 28vw, 210px"
            className={`object-cover ${discovered ? "" : "grayscale-[45%] opacity-80"}`}
          />
        ) : null}
        {!permanent && card.rarity ? <span className="absolute right-2 top-2 rounded-full border border-ink bg-cream px-2 py-1 text-[10px] font-black uppercase">
          {RARITY_LABELS[card.rarity] ?? card.rarity}
        </span> : null}
      </div>
      <div className="p-3">
        <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-green">
          {permanent ? "Héritage permanent" : "La Botte · consommable"}
        </span>
        <h3 className="mt-1 font-display text-lg uppercase leading-none text-ink">{card.name}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-charcoal">{card.description}</p>
        <strong className="mt-3 block text-xs text-ink">
          {discovered ? `Dans ton album · ×${copies}` : "À découvrir"}
        </strong>
      </div>
    </article>
  );
}

export function BotteAlbumCollection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [snapshot, setSnapshot] = useState<BotteSnapshot | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    fetch("/api/arena/placard/bootstrap", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as BotteSnapshot & { error?: string };
        if (!response.ok) throw new Error(body?.error ?? "Collection La Botte indisponible.");
        setSnapshot(body);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Collection La Botte indisponible.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isAuthenticated]);

  const supportCopies = useMemo(
    () => new Map((snapshot?.collection?.cards ?? []).map((card) => [card.code, Number(card.ownedCopies)])),
    [snapshot],
  );
  const heritageCopies = useMemo(
    () => new Map((snapshot?.heritage?.cards ?? []).map((card) => [card.code, Number(card.ownedCopies)])),
    [snapshot],
  );
  const supportOwned = KQ_CARDS.filter((card) => (supportCopies.get(card.code) ?? 0) > 0).length;
  const heritageOwned = KQ_HERITAGE_CARDS.filter((card) => (heritageCopies.get(card.code) ?? 0) > 0).length;

  return (
    <div className="grid gap-7">
      <header className="rounded-2xl border-2 border-ink bg-[#dcebdd] p-5 shadow-[5px_5px_0_#1a1a1a] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-green">Collection de jeu du Placard</p>
        <h2 className="mt-2 font-display text-3xl uppercase leading-none text-ink sm:text-5xl">
          La Botte du Chanvrier
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charcoal">
          Les cartes La Botte sont consommées quand tu les joues. Les Héritages restent dans ton
          album et peuvent accompagner plusieurs cultures.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Progression La Botte">
        <div className="border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a]">
          <strong className="font-display text-2xl text-ink">{supportOwned}/36</strong>
          <span className="block text-xs text-charcoal">La Botte découvertes</span>
        </div>
        <div className="border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a]">
          <strong className="font-display text-2xl text-ink">{heritageOwned}/12</strong>
          <span className="block text-xs text-charcoal">Héritages découverts</span>
        </div>
        <div className="col-span-2 border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a] sm:col-span-1">
          <strong className="font-display text-2xl text-ink">{snapshot?.heritage?.fragmentBalance ?? 0}</strong>
          <span className="block text-xs text-charcoal">Fragments Héritage</span>
        </div>
      </section>

      {loading ? (
        <div className="border-2 border-ink bg-white p-5 text-sm font-bold">Chargement de tes cartes…</div>
      ) : null}
      {error ? (
        <div className="border-2 border-red-700 bg-red-50 p-5 text-sm font-bold text-red-800">{error}</div>
      ) : null}

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-green">36 cartes à collectionner</p>
          <h2 className="font-display text-2xl uppercase text-ink">Cartes La Botte</h2>
          <p className="text-sm text-charcoal">Substrats, auxiliaires, équipements et savoir-faire pour tes cultures.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {KQ_CARDS.map((card) => (
            <CollectionCard key={card.code} card={card} copies={supportCopies.get(card.code) ?? 0} permanent={false} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a6500]">12 cartes permanentes</p>
          <h2 className="font-display text-2xl uppercase text-ink">Héritages de concours</h2>
          <p className="text-sm text-charcoal">Des avantages permanents réutilisables : ces cartes ne brûlent pas.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {KQ_HERITAGE_CARDS.map((card) => (
            <CollectionCard key={card.code} card={card} copies={heritageCopies.get(card.code) ?? 0} permanent />
          ))}
        </div>
      </section>

      <Link
        href="/arene/placard"
        className="inline-flex min-h-12 items-center justify-center border-2 border-ink bg-green px-5 text-sm font-black uppercase text-white shadow-[4px_4px_0_#1a1a1a]"
      >
        Jouer au Placard
      </Link>
    </div>
  );
}
