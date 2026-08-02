"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LotteryCardImageUpload } from "@/components/admin/LotteryCardImageUpload";

type Card = { id: string; code: string; cardNumber: number; name: string; rarity: string; description: string; imageUrl: string; isActive: boolean; category: string; timing: string; effect: string; xpCost: number; tags: string[]; targets: string[]; advantage: string; drawback: string; rulesVersion: number };
type Catalog = { collection: { code: string; title: string; description: string; imageUrl: string; isActive: boolean }; cards: Card[]; supportedEffects: string[] };

export function AdminBotteCatalogEditor() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Card | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/placard/catalog", { cache: "no-store" });
    const payload = await response.json() as Catalog & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Catalogue indisponible.");
    setCatalog(payload);
    setSelectedId((value) => value || payload.cards[0]?.id || "");
  }, []);

  useEffect(() => { void load().catch((error) => setStatus(error instanceof Error ? error.message : "Chargement impossible.")); }, [load]);
  const selected = useMemo(() => catalog?.cards.find((card) => card.id === selectedId) ?? null, [catalog, selectedId]);
  const activeDraft = draft?.id === selectedId ? draft : selected;

  async function saveCollection() {
    if (!catalog || saving) return;
    setSaving(true); setStatus("");
    try {
      const response = await fetch("/api/admin/placard/catalog", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(catalog.collection) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus("Collection enregistrée."); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  async function saveCard() {
    if (!activeDraft || saving) return;
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`/api/admin/placard/catalog/cards/${encodeURIComponent(activeDraft.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(activeDraft) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(`${activeDraft.name} enregistrée.`); setDraft(null); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  if (!catalog) return <article className="cartoon-border bg-cream p-6"><p>{status || "Chargement de La Botte…"}</p></article>;
  return <article className="cartoon-border bg-[#fff0c9] p-6 xl:col-span-2">
    <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Éditeur de collection</p>
    <h4 className="mt-1 font-display text-3xl">La Botte</h4>
    <p className="mt-2 max-w-3xl text-sm">Modifie les textes et illustrations sans toucher aux calculs sensibles du moteur. Les effets exécutables sont affichés en lecture seule.</p>
    {status ? <p className="mt-3 border-2 border-ink bg-white p-3 text-sm font-bold" role="status">{status}</p> : null}
    <details className="mt-5 border-2 border-ink bg-white p-4">
      <summary className="cursor-pointer font-display text-xl">Identité de la collection</summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">Nom<input className="border-2 border-ink p-2" value={catalog.collection.title} onChange={(event) => setCatalog({ ...catalog, collection: { ...catalog.collection, title: event.target.value } })} /></label>
        <label className="flex items-center gap-2 self-end border-2 border-ink p-3 text-sm font-bold"><input type="checkbox" checked={catalog.collection.isActive} onChange={(event) => setCatalog({ ...catalog, collection: { ...catalog.collection, isActive: event.target.checked } })} /> Collection active</label>
        <label className="grid gap-1 text-sm font-bold md:col-span-2">Présentation<textarea className="min-h-24 border-2 border-ink p-2" value={catalog.collection.description} onChange={(event) => setCatalog({ ...catalog, collection: { ...catalog.collection, description: event.target.value } })} /></label>
        <div className="md:col-span-2"><LotteryCardImageUpload value={catalog.collection.imageUrl} onChange={(imageUrl) => setCatalog({ ...catalog, collection: { ...catalog.collection, imageUrl } })} /></div>
      </div>
      <button className="btn-cartoon btn-primary mt-4" type="button" disabled={saving} onClick={() => void saveCollection()}>Enregistrer la collection</button>
    </details>
    <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="max-h-[650px] overflow-y-auto border-2 border-ink bg-white p-2" aria-label="Cartes La Botte">
        {catalog.cards.map((card) => <button type="button" key={card.id} onClick={() => { setSelectedId(card.id); setDraft(null); }} className={`mb-2 flex w-full items-center gap-3 border-2 p-2 text-left ${selectedId === card.id ? "border-green bg-mint" : "border-ink bg-cream"}`}><span className="w-8 font-black">#{card.cardNumber}</span><span className="min-w-0 flex-1"><strong className="block truncate">{card.name}</strong><small>{card.category} · {card.rarity}</small></span><i className={`h-3 w-3 rounded-full border border-ink ${card.isActive ? "bg-green" : "bg-white"}`} /></button>)}
      </div>
      {activeDraft ? <div className="border-2 border-ink bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><small className="font-black">{activeDraft.code}</small><h5 className="font-display text-2xl">Carte #{activeDraft.cardNumber}</h5></div><label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={activeDraft.isActive} onChange={(event) => setDraft({ ...activeDraft, isActive: event.target.checked })} /> Active</label></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">Nom<input className="border-2 border-ink p-2" value={activeDraft.name} onChange={(event) => setDraft({ ...activeDraft, name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Rareté<select className="border-2 border-ink p-2" value={activeDraft.rarity} onChange={(event) => setDraft({ ...activeDraft, rarity: event.target.value })}><option value="common">Commune</option><option value="silver">Argent</option><option value="gold">Or</option></select></label>
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Description courte<textarea className="min-h-16 border-2 border-ink p-2" value={activeDraft.description} onChange={(event) => setDraft({ ...activeDraft, description: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-green">Avantage</span><textarea className="min-h-24 border-2 border-green p-2" value={activeDraft.advantage} onChange={(event) => setDraft({ ...activeDraft, advantage: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-red-700">Inconvénient</span><textarea className="min-h-24 border-2 border-red-700 p-2" placeholder="Coût, limite ou contrepartie" value={activeDraft.drawback} onChange={(event) => setDraft({ ...activeDraft, drawback: event.target.value })} /></label>
        </div>
        <div className="mt-4"><LotteryCardImageUpload value={activeDraft.imageUrl} onChange={(imageUrl) => setDraft({ ...activeDraft, imageUrl })} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 bg-mint p-3 text-xs"><b>Catégorie<small className="block font-normal">{activeDraft.category}</small></b><b>Moment<small className="block font-normal">{activeDraft.timing}</small></b><b>Effet serveur<small className="block font-normal">{activeDraft.effect}</small></b><b>Coût XP<small className="block font-normal">{activeDraft.xpCost}</small></b></div>
        <button className="btn-cartoon btn-primary mt-4" type="button" disabled={saving || activeDraft.name.trim().length < 3 || activeDraft.advantage.trim().length < 3} onClick={() => void saveCard()}>Enregistrer la carte</button>
      </div> : null}
    </div>
  </article>;
}
