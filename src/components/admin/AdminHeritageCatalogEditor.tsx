"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LotteryCardImageUpload } from "@/components/admin/LotteryCardImageUpload";
import {
  filterAndSortKqHeritageAdminCards,
  getKqHeritageAdminCardStatus,
  type KqHeritageAdminCardFilter,
} from "@/lib/kanab-quest-heritage-admin";

type Heritage = {
  code: string; name: string; timing: string; effect: string; description: string;
  imageUrl: string; isActive: boolean; advantage: string; drawback: string;
  producerId: string | null; producerName: string; producerImage: string; autoManaged: boolean;
};
type HeritageEffectOption = {
  effect: string; timing: string; label: string; description: string; drawback: string;
  assignedCardCode: string | null; assignedProducerName: string; isAvailable: boolean;
};
type HeritageSummary = {
  totalCards: number; activeCards: number; pendingEditorialCards: number; hiddenCards: number;
  archivedCards: number; totalEffects: number; availableEffects: number; duplicateActiveEffects: number;
};

const EMPTY_SUMMARY: HeritageSummary = {
  totalCards: 0, activeCards: 0, pendingEditorialCards: 0, hiddenCards: 0,
  archivedCards: 0, totalEffects: 0, availableEffects: 0, duplicateActiveEffects: 0,
};

export function AdminHeritageCatalogEditor() {
  const [cards, setCards] = useState<Heritage[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [draft, setDraft] = useState<Heritage | null>(null);
  const [effectOptions, setEffectOptions] = useState<HeritageEffectOption[]>([]);
  const [summary, setSummary] = useState<HeritageSummary>(EMPTY_SUMMARY);
  const [query, setQuery] = useState("");
  const [cardFilter, setCardFilter] = useState<KqHeritageAdminCardFilter>("all");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/placard/catalog", { cache: "no-store" });
    const payload = await response.json() as {
      heritages?: Heritage[]; supportedHeritageEffects?: HeritageEffectOption[];
      heritageSummary?: HeritageSummary; error?: string;
    };
    if (!response.ok || !payload.heritages) throw new Error(payload.error || "Cartes Héritage indisponibles.");
    setCards(payload.heritages);
    setEffectOptions(payload.supportedHeritageEffects ?? []);
    setSummary(payload.heritageSummary ?? EMPTY_SUMMARY);
    setSelectedCode((current) => current || payload.heritages?.[0]?.code || "");
  }, []);

  useEffect(() => { void load().catch((error) => setStatus(error instanceof Error ? error.message : "Chargement impossible.")); }, [load]);
  const selected = useMemo(() => cards.find((card) => card.code === selectedCode) ?? null, [cards, selectedCode]);
  const activeDraft = draft?.code === selectedCode ? draft : selected;
  const selectedEffect = useMemo(
    () => effectOptions.find((option) => option.effect === activeDraft?.effect) ?? null,
    [activeDraft?.effect, effectOptions],
  );
  const effectOwnedByAnotherCard = Boolean(
    selectedEffect?.assignedCardCode && selectedEffect.assignedCardCode !== activeDraft?.code,
  );
  const filteredCards = useMemo(
    () => filterAndSortKqHeritageAdminCards(cards, query, cardFilter),
    [cardFilter, cards, query],
  );

  async function save() {
    if (!activeDraft || saving) return;
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`/api/admin/placard/catalog/heritages/${encodeURIComponent(activeDraft.code)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(activeDraft),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(`${activeDraft.name} enregistrée.`); setDraft(null); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  return <article className="cartoon-border bg-[#efe7ff] p-6 xl:col-span-2">
    <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Éditeur de collection</p>
    <h4 className="mt-1 font-display text-3xl">Cartes Héritage</h4>
    <p className="mt-2 max-w-3xl text-sm">Une carte est créée automatiquement pour chaque producteur présent sur la plateforme. Elle est archivée si le producteur disparaît, sans retirer les exemplaires déjà gagnés. Chaque producteur actif doit conserver un pouvoir différent parmi les vingt-quatre mécaniques prises en charge.</p>
    {status ? <p className="mt-3 border-2 border-ink bg-white p-3 text-sm font-bold" role="status">{status}</p> : null}
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4" aria-label="État du catalogue Héritage">
      <b className="border-2 border-ink bg-white p-3">{summary.activeCards}<small className="block font-normal">cartes actives</small></b>
      <b className={`border-2 border-ink p-3 ${summary.pendingEditorialCards ? "bg-[#f4bc3c]" : "bg-white"}`}>{summary.pendingEditorialCards}<small className="block font-normal">à éditorialiser</small></b>
      <b className="border-2 border-ink bg-mint p-3">{summary.availableEffects}/{summary.totalEffects}<small className="block font-normal">pouvoirs disponibles</small></b>
      <b className="border-2 border-ink bg-[#f6f0e6] p-3">{summary.archivedCards}<small className="block font-normal">cartes archivées</small></b>
    </div>
    {summary.duplicateActiveEffects > 0 ? <p className="mt-3 border-2 border-red-700 bg-[#ffd2c2] p-3 text-sm font-bold" role="alert">Anomalie : {summary.duplicateActiveEffects} pouvoir(s) actif(s) en doublon. Le préflight restera bloqué.</p> : null}
    <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="border-2 border-ink bg-white p-2">
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider">Rechercher<input className="min-h-11 border-2 border-ink bg-cream px-3 text-sm font-normal normal-case tracking-normal" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producteur, code ou pouvoir…" /></label>
        <label className="mt-2 grid gap-1 text-xs font-black uppercase tracking-wider">Statut<select className="min-h-11 border-2 border-ink bg-cream px-3 text-sm font-bold normal-case tracking-normal" value={cardFilter} onChange={(event) => setCardFilter(event.target.value as KqHeritageAdminCardFilter)}><option value="all">Toutes · {summary.totalCards}</option><option value="pending">À éditorialiser · {summary.pendingEditorialCards}</option><option value="active">Actives · {summary.activeCards}</option><option value="hidden">Masquées · {summary.hiddenCards}</option><option value="archived">Archivées · {summary.archivedCards}</option></select></label>
        <p className="my-2 text-xs font-bold text-charcoal" aria-live="polite">{filteredCards.length} carte(s) affichée(s)</p>
        <div className="max-h-[500px] overflow-y-auto" aria-label="Cartes Héritage filtrées">
        {filteredCards.map((card) => {
          const cardStatus = getKqHeritageAdminCardStatus(card);
          const pendingEditorial = cardStatus === "pending";
          return <button type="button" key={card.code} onClick={() => { setSelectedCode(card.code); setDraft(null); }} className={`mb-2 flex w-full items-center gap-3 border-2 p-3 text-left ${selectedCode === card.code ? "border-green bg-mint" : "border-ink bg-cream"}`}><span className="min-w-0 flex-1"><strong className="block truncate">{card.producerName || "Producteur retiré"}</strong><small className="block truncate">{card.name} · {card.code}</small><small className={`mt-1 block font-bold ${pendingEditorial ? "text-amber-700" : card.isActive ? "text-green" : "text-charcoal"}`}>{pendingEditorial ? "Pouvoir à attribuer" : card.isActive ? "Active" : card.producerId ? "Masquée" : "Archivée"}</small></span><i className={`h-3 w-3 rounded-full border border-ink ${pendingEditorial ? "bg-[#f4bc3c]" : card.isActive ? "bg-green" : "bg-white"}`} /></button>;
        })}
        {filteredCards.length === 0 ? <p className="p-3 text-sm">Aucune carte ne correspond à ce filtre.</p> : null}
        </div>
      </div>
      {activeDraft ? <div className="border-2 border-ink bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><small className="font-black">{activeDraft.code}</small><h5 className="font-display text-2xl">{activeDraft.producerName || "Producteur retiré"}</h5><p className="text-xs text-charcoal">Carte synchronisée avec le catalogue Producteurs</p></div><label className="flex items-center gap-2 font-bold"><input type="checkbox" disabled={!activeDraft.producerId || !selectedEffect || effectOwnedByAnotherCard} checked={activeDraft.isActive} onChange={(event) => setDraft({ ...activeDraft, isActive: event.target.checked })} /> Visible dans le jeu</label></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Nom<input className="border-2 border-ink p-2" value={activeDraft.name} onChange={(event) => setDraft({ ...activeDraft, name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Pouvoir<select className="min-h-11 border-2 border-ink bg-white p-2" value={activeDraft.effect} onChange={(event) => { const option = effectOptions.find((item) => item.effect === event.target.value); setDraft({ ...activeDraft, effect: event.target.value, timing: option?.timing ?? activeDraft.timing, ...(option ? { description: option.description, advantage: option.description, drawback: option.drawback } : {}) }); }}>{!selectedEffect ? <option value={activeDraft.effect} disabled>Choisir un pouvoir unique…</option> : null}{effectOptions.map((option) => { const assignedElsewhere = Boolean(option.assignedCardCode && option.assignedCardCode !== activeDraft.code); const assignmentLabel = option.assignedCardCode === activeDraft.code ? " — attribué à cette carte" : assignedElsewhere ? ` — attribué à ${option.assignedProducerName || option.assignedCardCode}` : " — disponible"; return <option key={option.effect} value={option.effect} disabled={assignedElsewhere}>{option.label} · {option.timing === "passive" ? "passif" : "1 fois/culture"}{assignmentLabel}</option>; })}</select><small className={effectOwnedByAnotherCard ? "text-red-700" : "text-charcoal"}>{!selectedEffect ? "Cette carte attend une mécanique distincte." : effectOwnedByAnotherCard ? `Pouvoir déjà utilisé par ${selectedEffect.assignedProducerName || selectedEffect.assignedCardCode}.` : selectedEffect.assignedCardCode === activeDraft.code ? "Pouvoir réservé à cette carte active." : "Pouvoir libre dans le catalogue actif."}</small></label>
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Description courte<textarea className="min-h-20 border-2 border-ink p-2" value={activeDraft.description} onChange={(event) => setDraft({ ...activeDraft, description: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-green">Avantage</span><textarea className="min-h-24 border-2 border-green p-2" value={activeDraft.advantage} onChange={(event) => setDraft({ ...activeDraft, advantage: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-red-700">Inconvénient</span><textarea className="min-h-24 border-2 border-red-700 p-2" placeholder="Limite ou contrepartie éventuelle" value={activeDraft.drawback} onChange={(event) => setDraft({ ...activeDraft, drawback: event.target.value })} /></label>
        </div>
        <div className="mt-4"><LotteryCardImageUpload value={activeDraft.imageUrl} onChange={(imageUrl) => setDraft({ ...activeDraft, imageUrl })} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 bg-mint p-3 text-xs"><b>Utilisation<small className="block font-normal">{activeDraft.timing === "passive" ? "Passif" : "Une fois par culture"}</small></b><b>Synchronisation<small className="block font-normal">{activeDraft.producerId ? "Producteur présent" : "Archivée"}</small></b></div>
        <button className="btn-cartoon btn-primary mt-4" type="button" disabled={saving || !selectedEffect || effectOwnedByAnotherCard || activeDraft.name.trim().length < 3 || activeDraft.description.trim().length < 10 || activeDraft.advantage.trim().length < 3} onClick={() => void save()}>Enregistrer l’Héritage</button>
      </div> : null}
    </div>
  </article>;
}
