"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Snapshot = {
  producers: Array<{ id: string; name: string; image: string }>;
  entries: Array<{ id: string; title: string; producerId: string; track: "regular" | "concours" }>;
  heritages: Array<{ code: string; name: string; description: string; effectCode: string; assignedProducerId: string | null }>;
  campaigns: Array<{ id: string; producerId: string; heritageCode: string; version: number; status: "draft" | "active" | "archived"; entryIds: string[] }>;
};

export function AdminProducerRewardCampaigns() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [producerId, setProducerId] = useState("");
  const [heritageCode, setHeritageCode] = useState("");
  const [entryIds, setEntryIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [retroCursor, setRetroCursor] = useState<number | null>(0);
  const [retroPending, setRetroPending] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/placard/producer-rewards", { cache: "no-store" });
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Parcours producteurs indisponibles.");
    setSnapshot(payload);
    setProducerId((current) => current || payload.producers[0]?.id || "");
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Chargement impossible."));
  }, [load]);

  const producerEntries = useMemo(
    () => snapshot?.entries.filter((entry) => entry.producerId === producerId) ?? [],
    [producerId, snapshot],
  );
  const currentCampaign = useMemo(() => {
    const campaigns = snapshot?.campaigns.filter((campaign) => campaign.producerId === producerId) ?? [];
    return campaigns.find((campaign) => campaign.status === "draft")
      ?? campaigns.find((campaign) => campaign.status === "active")
      ?? null;
  }, [producerId, snapshot]);

  useEffect(() => {
    setHeritageCode(currentCampaign?.heritageCode ?? "");
    setEntryIds(currentCampaign?.entryIds ?? []);
  }, [currentCampaign, producerId]);

  const save = async (activate: boolean) => {
    if (!producerId || !heritageCode || entryIds.length === 0 || saving) return;
    if (activate && !window.confirm("Activer ce parcours ? Sa liste de fleurs deviendra la référence pour les récompenses.")) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/placard/producer-rewards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ producerId, heritageCode, entryIds, activate }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(activate ? "Parcours activé." : "Brouillon enregistré.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const runRetro = async () => {
    if (retroCursor === null || retroPending) return;
    if (retroCursor === 0 && !window.confirm("Analyser les anciens avis validés et attribuer les récompenses manquantes ?")) return;
    setRetroPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/placard/producer-rewards/retro", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cursor: retroCursor }),
      });
      const payload = await response.json() as { error?: string; live?: boolean; processed?: number; flowerBoostersGranted?: number; heritagesGranted?: number; nextCursor?: number | null };
      if (!response.ok) throw new Error(payload.error || "Rétro-attribution impossible.");
      setRetroCursor(payload.nextCursor ?? null);
      setStatus(payload.live
        ? `${payload.processed ?? 0} avis traités · ${payload.flowerBoostersGranted ?? 0} booster(s) · ${payload.heritagesGranted ?? 0} Héritage(s).`
        : "Le nouveau système est encore verrouillé : aucune attribution effectuée.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rétro-attribution impossible.");
    } finally {
      setRetroPending(false);
    }
  };

  return (
    <article className="cartoon-border bg-[#eaf4df] p-6 xl:col-span-2">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Carnet → Héritages</p>
      <h4 className="mt-1 font-display text-2xl">Parcours des producteurs</h4>
      <p className="mt-2 max-w-3xl text-sm">Chaque fleur cochée offrira un booster de 10 cartes après validation de l’avis. Compléter toute la liste débloquera l’Héritage associé.</p>
      <button type="button" className="btn-cartoon btn-secondary mt-3" disabled={retroPending || retroCursor === null} onClick={() => void runRetro()}>
        {retroPending ? "Traitement…" : retroCursor === null ? "Anciens avis traités" : retroCursor === 0 ? "Préparer la rétro-attribution" : "Traiter le lot suivant"}
      </button>
      {status ? <p className="mt-3 border-2 border-ink bg-white p-3 text-sm font-bold" role="status">{status}</p> : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div>
          <label className="text-xs font-black uppercase tracking-[0.1em]" htmlFor="reward-producer">Producteur</label>
          <select id="reward-producer" className="mt-2 min-h-11 w-full border-2 border-ink bg-white px-3" value={producerId} onChange={(event) => setProducerId(event.target.value)}>
            {(snapshot?.producers ?? []).map((producer) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
          </select>
          <p className="mt-2 text-xs text-charcoal">{snapshot?.producers.length ?? 0} producteur(s) dans le catalogue. Les nouveaux producteurs s’ajoutent depuis la rubrique Producteurs.</p>
          <label className="mt-5 block text-xs font-black uppercase tracking-[0.1em]" htmlFor="reward-heritage">Carte Héritage</label>
          <select id="reward-heritage" className="mt-2 min-h-11 w-full border-2 border-ink bg-white px-3" value={heritageCode} onChange={(event) => setHeritageCode(event.target.value)}>
            <option value="">Choisir une carte</option>
            {(snapshot?.heritages ?? []).map((heritage) => (
              <option key={heritage.code} value={heritage.code} disabled={Boolean(heritage.assignedProducerId && heritage.assignedProducerId !== producerId)}>
                {heritage.name}{heritage.assignedProducerId && heritage.assignedProducerId !== producerId ? " · déjà attribuée" : ""}
              </option>
            ))}
          </select>
          {heritageCode ? <p className="mt-2 text-xs font-semibold text-charcoal">{snapshot?.heritages.find((item) => item.code === heritageCode)?.description}</p> : null}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em]">Fleurs requises</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {producerEntries.map((entry) => (
              <label key={entry.id} className="flex cursor-pointer items-center gap-3 border-2 border-ink bg-white p-3 text-sm font-bold">
                <input type="checkbox" className="h-5 w-5" checked={entryIds.includes(entry.id)} onChange={(event) => setEntryIds((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} />
                <span className="min-w-0 flex-1">{entry.title}</span>
                <small className="uppercase text-charcoal">{entry.track}</small>
              </label>
            ))}
            {producerEntries.length === 0 ? <p className="border-2 border-dashed border-ink p-4 text-sm">Aucune fleur publiée n’est reliée à ce producteur.</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-cartoon btn-secondary" disabled={saving || !heritageCode || entryIds.length === 0} onClick={() => void save(false)}>Enregistrer le brouillon</button>
            <button type="button" className="btn-cartoon btn-primary" disabled={saving || !heritageCode || entryIds.length === 0} onClick={() => void save(true)}>Activer le parcours</button>
            {currentCampaign ? <span className="self-center text-xs font-black uppercase">Version {currentCampaign.version} · {currentCampaign.status}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
