"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LotteryCardImageUpload } from "@/components/admin/LotteryCardImageUpload";

type Heritage = {
  code: string; name: string; timing: string; effect: string; description: string;
  imageUrl: string; isActive: boolean; advantage: string; drawback: string;
};

export function AdminHeritageCatalogEditor() {
  const [cards, setCards] = useState<Heritage[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [draft, setDraft] = useState<Heritage | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/placard/catalog", { cache: "no-store" });
    const payload = await response.json() as { heritages?: Heritage[]; error?: string };
    if (!response.ok || !payload.heritages) throw new Error(payload.error || "Cartes Héritage indisponibles.");
    setCards(payload.heritages);
    setSelectedCode((current) => current || payload.heritages?.[0]?.code || "");
  }, []);

  useEffect(() => { void load().catch((error) => setStatus(error instanceof Error ? error.message : "Chargement impossible.")); }, [load]);
  const selected = useMemo(() => cards.find((card) => card.code === selectedCode) ?? null, [cards, selectedCode]);
  const activeDraft = draft?.code === selectedCode ? draft : selected;

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
    <p className="mt-2 max-w-3xl text-sm">Configure chaque Héritage avant de l’associer à un producteur dans le parcours situé juste dessous. L’effet exécuté pendant une partie reste protégé en lecture seule.</p>
    {status ? <p className="mt-3 border-2 border-ink bg-white p-3 text-sm font-bold" role="status">{status}</p> : null}
    <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="max-h-[650px] overflow-y-auto border-2 border-ink bg-white p-2" aria-label="Cartes Héritage">
        {cards.map((card) => <button type="button" key={card.code} onClick={() => { setSelectedCode(card.code); setDraft(null); }} className={`mb-2 flex w-full items-center gap-3 border-2 p-3 text-left ${selectedCode === card.code ? "border-green bg-mint" : "border-ink bg-cream"}`}><span className="min-w-0 flex-1"><strong className="block truncate">{card.name}</strong><small>{card.code}</small></span><i className={`h-3 w-3 rounded-full border border-ink ${card.isActive ? "bg-green" : "bg-white"}`} /></button>)}
        {cards.length === 0 ? <p className="p-3 text-sm">Aucune carte disponible.</p> : null}
      </div>
      {activeDraft ? <div className="border-2 border-ink bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><small className="font-black">{activeDraft.code}</small><h5 className="font-display text-2xl">Configuration Héritage</h5></div><label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={activeDraft.isActive} onChange={(event) => setDraft({ ...activeDraft, isActive: event.target.checked })} /> Active</label></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Nom<input className="border-2 border-ink p-2" value={activeDraft.name} onChange={(event) => setDraft({ ...activeDraft, name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Description courte<textarea className="min-h-20 border-2 border-ink p-2" value={activeDraft.description} onChange={(event) => setDraft({ ...activeDraft, description: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-green">Avantage</span><textarea className="min-h-24 border-2 border-green p-2" value={activeDraft.advantage} onChange={(event) => setDraft({ ...activeDraft, advantage: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold"><span className="text-red-700">Inconvénient</span><textarea className="min-h-24 border-2 border-red-700 p-2" placeholder="Limite ou contrepartie éventuelle" value={activeDraft.drawback} onChange={(event) => setDraft({ ...activeDraft, drawback: event.target.value })} /></label>
        </div>
        <div className="mt-4"><LotteryCardImageUpload value={activeDraft.imageUrl} onChange={(imageUrl) => setDraft({ ...activeDraft, imageUrl })} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 bg-mint p-3 text-xs"><b>Utilisation<small className="block font-normal">{activeDraft.timing}</small></b><b>Effet du moteur<small className="block font-normal">{activeDraft.effect}</small></b></div>
        <button className="btn-cartoon btn-primary mt-4" type="button" disabled={saving || activeDraft.name.trim().length < 3 || activeDraft.description.trim().length < 10 || activeDraft.advantage.trim().length < 3} onClick={() => void save()}>Enregistrer l’Héritage</button>
      </div> : null}
    </div>
  </article>;
}
