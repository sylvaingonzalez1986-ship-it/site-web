"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { KQ_CARDS } from "@/lib/kanab-quest-game";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import albumStyles from "@/components/lottery/AlbumExperience.module.css";

type BotteSnapshot = {
  collection?: { cards?: Array<{ code: string; ownedCopies: number }> };
  heritage?: {
    collectionActive?: boolean;
    cards?: Array<{
      code: string; name: string; description: string; imageUrl?: string;
      ownedCopies: number; isActive: boolean; producerName?: string;
    }>;
    fragmentBalance?: number;
  } | null;
};

type HeritageCard = NonNullable<NonNullable<BotteSnapshot["heritage"]>["cards"]>[number];

type DisplayCard = {
  code: string;
  name: string;
  rarity?: string;
  description: string;
  imageUrl?: string;
  producerName?: string;
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
  const artwork = card.imageUrl || getKqCardArtwork(card.code);
  const discovered = copies > 0;

  return (
    <article
      className={`min-w-0 overflow-hidden border-2 border-ink shadow-[4px_4px_0_#1a1a1a] ${
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
          {permanent ? card.producerName || "Héritage permanent" : "La Botte · consommable"}
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

function HeritageCraftModal({
  cards,
  fragmentBalance,
  craftingCode,
  notice,
  onCraft,
  onClose,
}: {
  cards: HeritageCard[];
  fragmentBalance: number;
  craftingCode: string | null;
  notice: string;
  onCraft: (card: HeritageCard) => void;
  onClose: () => void;
}) {
  useBodyScrollLock(true);

  return (
    <div className="fixed inset-0 z-[220] overflow-y-auto bg-[#10201be8] p-3 sm:p-6" role="presentation" onClick={onClose}>
      <section className="mx-auto my-3 w-full max-w-3xl border-2 border-ink bg-cream shadow-[7px_7px_0_#f4bc3c]" role="dialog" aria-modal="true" aria-labelledby="heritage-craft-title" onClick={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b-2 border-ink bg-[#dcebdd] p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-green">Atelier Héritage · 5 fragments</p>
            <h2 className="font-display text-2xl uppercase leading-none text-ink sm:text-3xl" id="heritage-craft-title">Choisis une carte manquante</h2>
            <p className="mt-2 text-sm text-charcoal">Solde disponible : <strong>{fragmentBalance} fragments</strong></p>
          </div>
          <button className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-white" type="button" onClick={onClose} aria-label="Fermer l’atelier Héritage"><X aria-hidden="true" /></button>
        </header>

        <div className="p-4 sm:p-5">
          {notice ? <p className="mb-4 border-2 border-ink bg-white p-3 text-sm font-bold" role="status">{notice}</p> : null}
          {cards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => {
                const artwork = card.imageUrl || getKqCardArtwork(card.code);
                const busy = craftingCode === card.code;
                return (
                  <button className="grid min-h-32 grid-cols-[82px_1fr] gap-3 border-2 border-ink bg-white p-3 text-left shadow-[3px_3px_0_#1a1a1a] disabled:cursor-wait disabled:opacity-60" type="button" key={card.code} disabled={craftingCode !== null || fragmentBalance < 5} onClick={() => onCraft(card)}>
                    <span className="relative block aspect-[2/3] overflow-hidden border-2 border-ink bg-[#d7d1c5]">
                      {artwork ? <Image src={artwork} alt="" fill sizes="82px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 self-center">
                      <small className="block truncate font-black uppercase tracking-wider text-green">{card.producerName || "Producteur"}</small>
                      <strong className="mt-1 block font-display text-lg uppercase leading-none text-ink">{card.name}</strong>
                      <span className="mt-2 block text-xs leading-relaxed text-charcoal">{card.description}</span>
                      <b className="mt-3 inline-flex items-center gap-1 border-2 border-ink bg-[#f4bc3c] px-2 py-1 text-xs uppercase text-ink"><Sparkles size={13} aria-hidden="true" />{busy ? "Fabrication…" : "Fabriquer · 5 fragments"}</b>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="border-2 border-ink bg-white p-5 text-center text-sm font-bold">Tu possèdes déjà tous les Héritages producteurs actuellement disponibles.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function BotteAlbumCollection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [snapshot, setSnapshot] = useState<BotteSnapshot | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [craftOpen, setCraftOpen] = useState(false);
  const [craftingCode, setCraftingCode] = useState<string | null>(null);
  const [craftNotice, setCraftNotice] = useState("");

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
  const heritageCards = (snapshot?.heritage?.cards ?? []).filter((card) => card.isActive || card.ownedCopies > 0);
  const heritageOwned = heritageCards.filter((card) => card.ownedCopies > 0).length;
  const craftableHeritages = heritageCards.filter((card) => card.isActive && card.ownedCopies <= 0);
  const fragmentBalance = Number(snapshot?.heritage?.fragmentBalance ?? 0);
  const canOpenCraft = snapshot?.heritage?.collectionActive === true && craftableHeritages.length > 0 && fragmentBalance >= 5;

  async function craftHeritage(card: HeritageCard) {
    if (craftingCode || fragmentBalance < 5 || !card.isActive || card.ownedCopies > 0) return;
    setCraftingCode(card.code);
    setCraftNotice("");
    try {
      const response = await fetch("/api/arena/placard/heritage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardCode: card.code }),
      });
      const body = await response.json().catch(() => null) as {
        fragmentBalance?: number;
        draw?: { cardCode?: string } | null;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error || "Fabrication impossible.");
      const craftedCode = body?.draw?.cardCode || card.code;
      setSnapshot((current) => current?.heritage ? {
        ...current,
        heritage: {
          ...current.heritage,
          fragmentBalance: Number(body?.fragmentBalance ?? Math.max(0, fragmentBalance - 5)),
          cards: (current.heritage.cards ?? []).map((candidate) => candidate.code === craftedCode
            ? { ...candidate, ownedCopies: Math.max(1, candidate.ownedCopies) }
            : candidate),
        },
      } : current);
      setCraftNotice(`${card.name} rejoint ton album.`);
    } catch (craftError) {
      setCraftNotice(craftError instanceof Error ? craftError.message : "Fabrication impossible.");
    } finally {
      setCraftingCode(null);
    }
  }

  return (
    <div className={albumStyles.gameCollection}>
      <header className={albumStyles.gameCollectionHeader}>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#91d9c9]">Collection de jeu du Placard</p>
        <h2 className="mt-2 font-display text-3xl uppercase leading-none text-[#fffaf1] sm:text-5xl">
          La Botte du Chanvrier
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#e1f1e9]">
          Les cartes La Botte sont consommées quand tu les joues. Les Héritages restent dans ton
          album et peuvent accompagner plusieurs cultures.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Progression La Botte">
        <div className="border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a]">
          <strong className="font-display text-2xl text-ink">{supportOwned}/{KQ_CARDS.length}</strong>
          <span className="block text-xs text-charcoal">La Botte découvertes</span>
        </div>
        <div className="border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a]">
          <strong className="font-display text-2xl text-ink">{heritageOwned}/{heritageCards.filter((card) => card.isActive).length}</strong>
          <span className="block text-xs text-charcoal">Héritages découverts</span>
        </div>
        <div className="col-span-2 border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#1a1a1a] sm:col-span-1">
          <strong className="font-display text-2xl text-ink">{fragmentBalance}</strong>
          <span className="block text-xs text-charcoal">Fragments Héritage</span>
          <button className="mt-2 min-h-10 w-full border-2 border-ink bg-[#f4bc3c] px-2 text-xs font-black uppercase text-ink disabled:cursor-not-allowed disabled:bg-[#ddd8ce] disabled:text-charcoal" type="button" disabled={!canOpenCraft} onClick={() => { setCraftNotice(""); setCraftOpen(true); }}>
            {craftableHeritages.length === 0 && snapshot?.heritage?.collectionActive
              ? "Collection complète"
              : fragmentBalance < 5
                ? `${Math.max(0, 5 - fragmentBalance)} fragment(s) manquant(s)`
                : "Fabriquer une carte"}
          </button>
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
          <p className="text-xs font-black uppercase tracking-[0.14em] text-green">{KQ_CARDS.length} cartes à collectionner</p>
          <h2 className="font-display text-2xl uppercase text-ink">Cartes La Botte</h2>
          <p className="text-sm text-charcoal">Auxiliaires, équipements et savoir-faire pour tes cultures sur sol vivant.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {KQ_CARDS.map((card) => (
            <CollectionCard key={card.code} card={card} copies={supportCopies.get(card.code) ?? 0} permanent={false} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a6500]">Une carte par producteur présent</p>
          <h2 className="font-display text-2xl uppercase text-ink">Héritages de concours</h2>
          <p className="text-sm text-charcoal">Des avantages permanents réutilisables : ces cartes ne brûlent pas.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {heritageCards.map((card) => (
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
      {craftOpen ? <HeritageCraftModal cards={craftableHeritages} fragmentBalance={fragmentBalance} craftingCode={craftingCode} notice={craftNotice} onCraft={(card) => void craftHeritage(card)} onClose={() => { if (!craftingCode) setCraftOpen(false); }} /> : null}
    </div>
  );
}
