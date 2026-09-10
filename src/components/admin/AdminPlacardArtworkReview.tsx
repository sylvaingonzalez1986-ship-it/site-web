"use client";

import { Download, Search, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildKqArtworkReviewAssets,
  buildKqArtworkReviewReport,
  getKqArtworkReviewStatus,
  importKqArtworkReviewReport,
  parseKqArtworkReviewState,
  summarizeKqArtworkReview,
  type KqArtworkReviewAsset,
  type KqArtworkReviewState,
  type KqArtworkReviewStatus,
  type KqArtworkReviewGroup,
} from "@/lib/kanab-quest-artwork-review";

type GroupFilter = "all" | KqArtworkReviewGroup;
type StatusFilter = "all" | "pending" | KqArtworkReviewStatus;

const STORAGE_KEY = "kq-admin-artwork-review-v2";

const groupOptions: Array<{ value: GroupFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "support", label: "La Botte" },
  { value: "heritage", label: "Héritages" },
  { value: "situation", label: "Situations" },
  { value: "equipment", label: "Équipements" },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "pending", label: "À contrôler" },
  { value: "approved", label: "Validés" },
  { value: "rework", label: "À retoucher" },
];

export function AdminPlacardArtworkReview() {
  const [statuses, setStatuses] = useState<KqArtworkReviewState>({});
  const [heritages, setHeritages] = useState<Array<{
    code: string; name: string; imageUrl: string; producerImage: string;
    producerName: string; isActive: boolean;
  }>>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<KqArtworkReviewAsset | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [reviewStateReady, setReviewStateReady] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/admin/placard/catalog", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { heritages?: typeof heritages; error?: string };
        if (!response.ok || !payload.heritages) throw new Error(payload.error || "Catalogue Héritage indisponible.");
        if (!mounted) return;
        setHeritages(payload.heritages);
        setCatalogReady(true);
      })
      .catch((error) => {
        if (mounted) setCatalogNotice(error instanceof Error ? error.message : "Catalogue Héritage indisponible.");
      });
    return () => { mounted = false; };
  }, []);

  const reviewAssets = useMemo(
    () => catalogReady ? buildKqArtworkReviewAssets(heritages) : [],
    [catalogReady, heritages],
  );

  useEffect(() => {
    if (!storageReady || !catalogReady) return;
    setStatuses(parseKqArtworkReviewState(window.localStorage.getItem(STORAGE_KEY), reviewAssets));
    setReviewStateReady(true);
  }, [catalogReady, reviewAssets, storageReady]);

  useEffect(() => {
    if (!storageReady || !catalogReady || !reviewStateReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [catalogReady, reviewStateReady, statuses, storageReady]);

  useEffect(() => {
    if (!selectedAsset) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedAsset(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedAsset]);

  const counts = useMemo(() => summarizeKqArtworkReview(statuses, reviewAssets), [reviewAssets, statuses]);
  const heritageCount = useMemo(() => reviewAssets.filter((asset) => asset.group === "heritage").length, [reviewAssets]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return reviewAssets.filter((asset) => {
      const status = getKqArtworkReviewStatus(statuses, asset);
      return (groupFilter === "all" || asset.group === groupFilter)
        && (statusFilter === "all" || status === statusFilter)
        && (!normalizedQuery || `${asset.code} ${asset.name}`.toLocaleLowerCase("fr").includes(normalizedQuery));
    });
  }, [groupFilter, query, reviewAssets, statusFilter, statuses]);

  const setReviewStatus = (asset: KqArtworkReviewAsset, status: KqArtworkReviewStatus | undefined) => {
    if (asset.placeholder && status === "approved") return;
    setStatuses((current) => {
      const next = { ...current };
      if (status) next[asset.code] = { status, src: asset.src, reviewedAt: new Date().toISOString() };
      else delete next[asset.code];
      return next;
    });
  };

  const exportReview = () => {
    if (!catalogReady) return;
    const payload = buildKqArtworkReviewReport(statuses, new Date().toISOString(), reviewAssets);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `placard-artwork-review-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importReview = async (file: File | undefined) => {
    if (!file || !catalogReady) return;
    try {
      const result = importKqArtworkReviewReport(await file.text(), reviewAssets);
      setStatuses(result.state);
      setImportNotice(
        `${result.accepted} décision(s) restaurée(s) · ${result.staleCodes.length} visuel(s) modifié(s) remis à contrôler · ${result.missingCodes.length} absent(s) · ${result.unknownCodes.length} étranger(s) ignoré(s).`,
      );
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "Import du rapport impossible.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <article className="cartoon-border bg-[#fff0c9] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Direction artistique · recette humaine</p>
          <h4 className="mt-1 font-display text-2xl">Planche de validation des {reviewAssets.length || "…"} visuels actifs</h4>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">
            Le socle graphique reste fixe ; les {heritageCount} cartes Héritage affichées ici suivent automatiquement les producteurs présents. Contrôle la fidélité de Sylvain, la lisibilité du gag, le cadrage et l’absence de texte parasite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importReview(event.target.files?.[0])} />
          <button className="btn-cartoon btn-secondary" type="button" disabled={!catalogReady} onClick={() => importInputRef.current?.click()}>
            <Upload size={15} /> Importer
          </button>
          <button className="btn-cartoon btn-secondary" type="button" disabled={!catalogReady} onClick={exportReview}>
            <Download size={15} /> Exporter le rapport
          </button>
        </div>
      </div>

      <p className={`mt-4 border-2 border-ink p-3 text-sm font-bold ${counts.readyForLaunch ? "bg-[#bfe5c4]" : "bg-white"}`} role="status">
        {!catalogReady
          ? "Chargement du catalogue producteur avant la revue…"
          : counts.readyForLaunch
            ? `Préflight humain prêt : les ${reviewAssets.length} visuels actifs sont validés.`
            : `Préflight humain ouvert : ${counts.pending} à contrôler et ${counts.rework} à retoucher.`}
      </p>
      {catalogNotice ? <p className="mt-2 border-2 border-red-700 bg-[#ffd2c2] p-3 text-sm font-bold" role="alert">{catalogNotice}</p> : null}
      {importNotice ? <p className="mt-2 text-sm font-semibold text-charcoal" role="status">{importNotice}</p> : null}

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <b className="border-2 border-ink bg-white p-3">{counts.approved}<small className="block font-normal">validés</small></b>
        <b className="border-2 border-ink bg-[#ffd2c2] p-3">{counts.rework}<small className="block font-normal">à retoucher</small></b>
        <b className="border-2 border-ink bg-[#f6f0e6] p-3">{counts.pending}<small className="block font-normal">à contrôler</small></b>
      </div>

      <details className="mt-4 border-2 border-ink bg-white p-3">
        <summary className="cursor-pointer font-bold">Ouvrir la planche de contrôle</summary>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="flex min-h-11 items-center gap-2 border-2 border-ink bg-white px-3">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Rechercher un visuel</span>
            <input className="min-w-0 flex-1 bg-transparent py-2 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code ou nom…" />
          </label>
          <select className="min-h-11 border-2 border-ink bg-white px-3 font-bold" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} aria-label="Filtrer par famille">
            {groupOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="min-h-11 border-2 border-ink bg-white px-3 font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrer par statut">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-charcoal">{filteredAssets.length} visuel(s) affiché(s)</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {filteredAssets.map((asset) => {
            const reviewStatus = getKqArtworkReviewStatus(statuses, asset);
            return (
              <article className="flex min-w-0 flex-col border-2 border-ink bg-[#f6f0e6] p-2 shadow-[3px_3px_0_#1a1a1a]" data-review-status={reviewStatus} key={asset.code}>
                <button type="button" className={`relative w-full overflow-hidden border-2 border-ink bg-[#e6e0d4] ${asset.format === "portrait" ? "aspect-[2/3]" : "aspect-square"}`} onClick={() => setSelectedAsset(asset)} aria-label={`Agrandir ${asset.name}`}>
                  <Image src={asset.src} alt={asset.alt} fill sizes="(max-width: 768px) 45vw, 190px" className="object-cover" />
                </button>
                <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-green">{asset.groupLabel} · {asset.code}</span>
                <strong className="mt-1 text-sm leading-tight">{asset.name}</strong>
                <div className="mt-auto grid grid-cols-3 gap-1 pt-3">
                  <button className={`min-h-10 border-2 border-ink text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${reviewStatus === "approved" ? "bg-[#bfe5c4]" : "bg-white"}`} type="button" disabled={asset.placeholder} title={asset.placeholder ? "Ajoute d’abord une illustration finale dans le catalogue Héritage." : undefined} aria-label={`Valider ${asset.name}`} aria-pressed={reviewStatus === "approved"} onClick={() => setReviewStatus(asset, "approved")}>OK</button>
                  <button className={`min-h-10 border-2 border-ink text-xs font-black ${reviewStatus === "rework" ? "bg-[#ff9b78]" : "bg-white"}`} type="button" aria-label={`Demander une retouche pour ${asset.name}`} aria-pressed={reviewStatus === "rework"} onClick={() => setReviewStatus(asset, "rework")}>Retouche</button>
                  <button className={`min-h-10 border-2 border-ink text-xs font-black ${reviewStatus === "pending" ? "bg-[#f4bc3c]" : "bg-white"}`} type="button" aria-label={`Remettre ${asset.name} à contrôler`} aria-pressed={reviewStatus === "pending"} onClick={() => setReviewStatus(asset, undefined)}>À voir</button>
                </div>
              </article>
            );
          })}
        </div>
      </details>

      {selectedAsset ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#10201be8] p-4" role="presentation" onClick={() => setSelectedAsset(null)}>
          <section className="relative grid max-h-[calc(100dvh-2rem)] w-full max-w-4xl grid-rows-[auto_1fr] overflow-hidden border-2 border-ink bg-[#f6f0e6] shadow-[8px_8px_0_#f4bc3c]" role="dialog" aria-modal="true" aria-labelledby="artwork-review-preview-title" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-white p-3">
              <div><small className="font-black uppercase tracking-wider text-green">{selectedAsset.groupLabel} · {selectedAsset.code}</small><h5 className="font-display text-xl" id="artwork-review-preview-title">{selectedAsset.name}</h5></div>
              <button className="grid size-11 place-items-center border-2 border-ink bg-white" type="button" onClick={() => setSelectedAsset(null)} aria-label="Fermer l’aperçu"><X /></button>
            </header>
            <div className="min-h-0 overflow-auto p-4">
              <div className={`relative mx-auto max-h-[75dvh] max-w-2xl overflow-hidden border-2 border-ink bg-white ${selectedAsset.format === "portrait" ? "aspect-[2/3]" : "aspect-square"}`}>
                <Image src={selectedAsset.src} alt={selectedAsset.alt} fill sizes="(max-width: 768px) 90vw, 672px" className="object-contain" priority />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
