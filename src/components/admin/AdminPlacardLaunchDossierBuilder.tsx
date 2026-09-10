"use client";

import { Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getKqLaunchDossier,
  getKqLaunchDossierSectionChecks,
  KQ_LAUNCH_DOSSIER_ENV_KEY,
  KQ_LAUNCH_ODDS_VERSION,
  type KqLaunchDossier,
  type KqLaunchPrize,
} from "@/lib/kanab-quest-launch-approvals";

const PRIZE_TIERS: Array<{ code: KqLaunchPrize["tierCode"]; label: string }> = [
  { code: "champion", label: "Champion" },
  { code: "podium", label: "Podium" },
  { code: "finalist", label: "Finaliste" },
  { code: "participant", label: "Participant" },
];

function buildDraft(source?: KqLaunchDossier): KqLaunchDossier {
  return {
    parsed: true,
    seasonCode: source?.seasonCode || "KQ-2026-S1",
    startsAt: source?.startsAt || "",
    endsAt: source?.endsAt || "",
    timezone: source?.timezone || "Europe/Paris",
    territory: source?.territory || "",
    minimumAge: source?.minimumAge || 18,
    eligibility: source?.eligibility || "",
    prizes: PRIZE_TIERS.map((tier) => source?.prizes.find((prize) => prize.tierCode === tier.code) ?? {
      tierCode: tier.code,
      label: "",
      quantity: 0,
      stock: 0,
      unitValueCents: 0,
      fulfillment: "",
    }),
    oddsVersion: source?.oddsVersion || KQ_LAUNCH_ODDS_VERSION,
    publicRulesUrl: source?.publicRulesUrl || "",
    contactEmail: source?.contactEmail || "",
  };
}

export function AdminPlacardLaunchDossierBuilder({ initialDossier }: { initialDossier?: KqLaunchDossier }) {
  const [draft, setDraft] = useState<KqLaunchDossier>(() => buildDraft(initialDossier));
  const [notice, setNotice] = useState("");

  const payload = useMemo(() => ({
    seasonCode: draft.seasonCode,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timezone: draft.timezone,
    territory: draft.territory,
    minimumAge: draft.minimumAge,
    eligibility: draft.eligibility,
    prizes: draft.prizes,
    oddsVersion: draft.oddsVersion,
    publicRulesUrl: draft.publicRulesUrl,
    contactEmail: draft.contactEmail,
  }), [draft]);
  const json = useMemo(() => JSON.stringify(payload), [payload]);
  const normalizedDossier = useMemo(() => getKqLaunchDossier({
    [KQ_LAUNCH_DOSSIER_ENV_KEY]: json,
  }), [json]);
  const checks = useMemo(() => getKqLaunchDossierSectionChecks(normalizedDossier), [normalizedDossier]);
  const ready = checks.every((check) => check.ready);
  const totalPrizeValueCents = draft.prizes.reduce((sum, prize) => (
    sum + prize.quantity * prize.unitValueCents
  ), 0);

  const setPrize = (tierCode: KqLaunchPrize["tierCode"], patch: Partial<KqLaunchPrize>) => {
    setDraft((current) => ({
      ...current,
      prizes: current.prizes.map((prize) => prize.tierCode === tierCode ? { ...prize, ...patch } : prize),
    }));
  };

  const copyEnvironmentLine = async () => {
    try {
      await navigator.clipboard.writeText(`${KQ_LAUNCH_DOSSIER_ENV_KEY}=${json}`);
      setNotice("Variable copiée. Relis-la avant toute configuration de recette ou production.");
    } catch {
      setNotice("Copie automatique indisponible : utilise le téléchargement JSON.");
    }
  };

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "placard-launch-dossier-s1.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Dossier téléchargé. Aucun changement n’a été appliqué au serveur.");
  };

  return (
    <article className="cartoon-border bg-[#fff0c9] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Saison 1 · assistant de décision</p>
          <h4 className="mt-1 font-display text-2xl">Préparer le dossier de lancement</h4>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">
            Remplis et contrôle l’instantané public. Cet assistant ne sauvegarde rien, ne change aucun verrou et ne vaut pas approbation.
          </p>
        </div>
        <b className={`border-2 border-ink px-3 py-2 text-sm ${ready ? "bg-[#bfe5c4]" : "bg-white"}`}>
          {checks.filter((check) => check.ready).length}/5 sections prêtes
        </b>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {checks.map((check) => (
          <div className={`border-2 border-ink p-3 text-sm ${check.ready ? "bg-[#bfe5c4]" : "bg-white"}`} key={check.code}>
            <b>{check.ready ? "✓" : "○"} {check.label}</b>
            {!check.ready ? <small className="mt-1 block text-charcoal">{check.issues.join(" · ")}</small> : null}
          </div>
        ))}
      </div>

      <details className="mt-4 border-2 border-ink bg-white p-4">
        <summary className="cursor-pointer font-bold">Ouvrir la fiche Saison 1</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">Code saison<input className="min-h-11 border-2 border-ink px-3 font-normal" value={draft.seasonCode} onChange={(event) => setDraft({ ...draft, seasonCode: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Fuseau<input className="min-h-11 border-2 border-ink px-3 font-normal" value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Ouverture ISO avec fuseau<input className="min-h-11 border-2 border-ink px-3 font-normal" placeholder="2026-10-01T10:00:00+02:00" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Clôture ISO avec fuseau<input className="min-h-11 border-2 border-ink px-3 font-normal" placeholder="2026-11-01T18:00:00+01:00" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Territoire<input className="min-h-11 border-2 border-ink px-3 font-normal" value={draft.territory} onChange={(event) => setDraft({ ...draft, territory: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">Âge minimal<input className="min-h-11 border-2 border-ink px-3 font-normal" type="number" min={18} value={draft.minimumAge} onChange={(event) => setDraft({ ...draft, minimumAge: Number(event.target.value) })} /></label>
          <label className="grid gap-1 text-sm font-bold md:col-span-2">Conditions d’éligibilité<textarea className="min-h-24 border-2 border-ink p-3 font-normal" value={draft.eligibility} onChange={(event) => setDraft({ ...draft, eligibility: event.target.value })} /></label>
        </div>

        <h5 className="mt-6 font-display text-xl">Lots · valeur totale {(totalPrizeValueCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</h5>
        <div className="mt-3 grid gap-3">
          {PRIZE_TIERS.map((tier) => {
            const prize = draft.prizes.find((item) => item.tierCode === tier.code)!;
            return (
              <fieldset className="grid gap-3 border-2 border-ink bg-[#f6f0e6] p-3 md:grid-cols-6" key={tier.code}>
                <legend className="px-2 font-display text-lg">{tier.label}</legend>
                <label className="grid gap-1 text-xs font-bold md:col-span-2">Nature du lot<input className="min-h-10 border-2 border-ink px-2 font-normal" value={prize.label} onChange={(event) => setPrize(tier.code, { label: event.target.value })} /></label>
                <label className="grid gap-1 text-xs font-bold">Quantité<input className="min-h-10 border-2 border-ink px-2 font-normal" type="number" min={0} value={prize.quantity} onChange={(event) => setPrize(tier.code, { quantity: Number(event.target.value) })} /></label>
                <label className="grid gap-1 text-xs font-bold">Stock<input className="min-h-10 border-2 border-ink px-2 font-normal" type="number" min={0} value={prize.stock} onChange={(event) => setPrize(tier.code, { stock: Number(event.target.value) })} /></label>
                <label className="grid gap-1 text-xs font-bold">Valeur unitaire €<input className="min-h-10 border-2 border-ink px-2 font-normal" type="number" min={0} step="0.01" value={prize.unitValueCents / 100} onChange={(event) => setPrize(tier.code, { unitValueCents: Math.round(Number(event.target.value) * 100) })} /></label>
                <label className="grid gap-1 text-xs font-bold">Remise<input className="min-h-10 border-2 border-ink px-2 font-normal" value={prize.fulfillment} onChange={(event) => setPrize(tier.code, { fulfillment: event.target.value })} /></label>
              </fieldset>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">Version des probabilités<input className="min-h-11 border-2 border-ink px-3 font-normal" value={draft.oddsVersion} onChange={(event) => setDraft({ ...draft, oddsVersion: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold">URL HTTPS du règlement<input className="min-h-11 border-2 border-ink px-3 font-normal" type="url" value={draft.publicRulesUrl} onChange={(event) => setDraft({ ...draft, publicRulesUrl: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-bold md:col-span-2">Email de recours<input className="min-h-11 border-2 border-ink px-3 font-normal" type="email" value={draft.contactEmail} onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })} /></label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-cartoon btn-secondary" type="button" onClick={() => void copyEnvironmentLine()}><Copy size={15} /> Copier la variable</button>
          <button className="btn-cartoon btn-secondary" type="button" onClick={downloadJson}><Download size={15} /> Télécharger le JSON</button>
        </div>
        {notice ? <p className="mt-3 border-2 border-ink bg-[#fff0c9] p-3 text-sm font-bold" role="status">{notice}</p> : null}
      </details>
    </article>
  );
}
