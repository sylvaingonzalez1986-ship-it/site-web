"use client";

import { AlertTriangle, Calculator, CheckCircle2, ExternalLink, Gauge } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildKqEconomyBalanceReport,
  type KqEconomyBalanceStatus,
} from "@/lib/kanab-quest-economy-balance";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { formatKqReputationDelta } from "@/lib/kanab-quest-market";

const STATUS_LABELS: Record<KqEconomyBalanceStatus, string> = {
  baseline: "Référence",
  unavailable: "Verrouillée",
  dominated: "Dominée",
  "too-fast": "Très rapide",
  balanced: "Équilibrée",
  slow: "Longue",
  excessive: "Excessive",
};

const STATUS_STYLES: Record<KqEconomyBalanceStatus, string> = {
  baseline: "bg-white",
  unavailable: "bg-[#e8e5dd] text-charcoal",
  dominated: "bg-[#ffd8cc] text-red-800",
  "too-fast": "bg-[#fff0ae] text-[#815500]",
  balanced: "bg-[#dff1df] text-green",
  slow: "bg-[#ffe5b8] text-[#815500]",
  excessive: "bg-[#ffd8cc] text-red-800",
};

export function AdminPlacardEconomyReview() {
  const [juryScore, setJuryScore] = useState(8.8);
  const [harvestGrams, setHarvestGrams] = useState(100);
  const [routeSaleCount, setRouteSaleCount] = useState(3);
  const report = useMemo(() => buildKqEconomyBalanceReport({
    juryScore,
    harvestGrams,
    routeSaleCount,
  }), [juryScore, harvestGrams, routeSaleCount]);

  return (
    <section className="cartoon-border bg-[#e8f4e7] p-6" aria-labelledby="placard-economy-review-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Économie · simulation en lecture seule</p>
          <h3 id="placard-economy-review-title" className="mt-1 font-display text-3xl">Table d’équilibrage du marché</h3>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">
            Compare chaque transformation à la meilleure vente sans machine pour le même lot. L’amortissement utilise uniquement le surplus de gain et la réputation inclut le bonus ponctuel du palier simulé : aucune donnée joueur n’est modifiée.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border-2 border-ink bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_#111]">
          <Calculator aria-hidden="true" size={17} /> scénario libre
        </span>
      </header>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="border-2 border-ink bg-white p-4">
          <span className="flex items-center justify-between gap-3 text-sm font-black"><b>Note du jury</b><strong>{juryScore.toFixed(1)}/10</strong></span>
          <input className="mt-3 w-full accent-green" type="range" min="0" max="10" step="0.1" value={juryScore} onChange={(event) => setJuryScore(Number(event.target.value))} />
        </label>
        <label className="border-2 border-ink bg-white p-4">
          <span className="flex items-center justify-between gap-3 text-sm font-black"><b>Poids du lot</b><strong>{harvestGrams} g</strong></span>
          <input className="mt-3 w-full accent-green" type="range" min="20" max="500" step="10" value={harvestGrams} onChange={(event) => setHarvestGrams(Number(event.target.value))} />
        </label>
        <label className="border-2 border-ink bg-white p-4">
          <span className="flex items-center justify-between gap-3 text-sm font-black"><b>Vente dans la filière</b><strong>n° {routeSaleCount}</strong></span>
          <input className="mt-3 w-full accent-green" type="range" min="1" max="10" step="1" value={routeSaleCount} onChange={(event) => setRouteSaleCount(Number(event.target.value))} />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-6">
        <b className="border-2 border-ink bg-white p-3">{report.baselineName}<small className="block font-normal">référence · {formatKqCash(report.baselinePayoutCents)}</small></b>
        <b className="border-2 border-ink bg-[#dff1df] p-3">{report.signals.balanced}<small className="block font-normal">voie(s) équilibrée(s)</small></b>
        <b className="border-2 border-ink bg-[#ffd8cc] p-3">{report.signals.dominated}<small className="block font-normal">voie(s) dominée(s)</small></b>
        <b className="border-2 border-ink bg-[#fff0ae] p-3">{report.signals.tooFast}<small className="block font-normal">amortissement(s) rapide(s)</small></b>
        <b className="border-2 border-ink bg-[#fff0ae] p-3">{report.priceAnchors.alignedCount}/{report.priceAnchors.totalCount}<small className="block font-normal">tarifs publics alignés à ±10 %</small></b>
        <b className="border-2 border-ink bg-[#dff1df] p-3">+{report.expertise.activeBonusReputation}<small className="block font-normal">réputation de palier à la vente n° {report.expertise.saleCount}</small></b>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Paliers de réputation d’expertise">
        {report.expertise.milestones.map((milestone) => (
          <span key={milestone.code} className={`border-2 border-ink px-3 py-2 font-black shadow-[2px_2px_0_#111] ${milestone.saleCount === routeSaleCount ? "bg-[#f4c642]" : "bg-white"}`}>
            {milestone.name} · vente {milestone.saleCount} · +{milestone.bonusReputation} réputation
          </span>
        ))}
      </div>

      {report.signals.dominated > 0 ? (
        <p className="mt-4 flex items-start gap-2 border-2 border-ink bg-[#fff0e8] p-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" size={19} />
          <span><strong>{report.signals.dominated} voie(s) rapporte(nt) moins que {report.baselineName.toLowerCase()}.</strong> Elles peuvent encore donner davantage de réputation, mais leur intérêt financier doit être revu.</span>
        </p>
      ) : report.signals.tooFast === 0 ? (
        <p className="mt-4 flex items-center gap-2 border-2 border-ink bg-[#dff1df] p-3 text-sm" role="status"><CheckCircle2 aria-hidden="true" size={19} /><strong>Aucune transformation disponible n’est dominée dans ce scénario.</strong></p>
      ) : null}
      {report.signals.tooFast > 0 ? (
        <p className="mt-3 flex items-start gap-2 border-2 border-ink bg-[#fff7cf] p-3 text-sm" role="status">
          <Gauge className="mt-0.5 shrink-0 text-[#9a5b17]" aria-hidden="true" size={19} />
          <span><strong>{report.signals.tooFast} investissement(s) s’amortisse(nt) en moins de trois récoltes.</strong> Le prix réel du matériel reste conservé ; capacité et rendement sont les leviers à surveiller pendant la recette.</span>
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto border-2 border-ink bg-white">
        <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
          <thead className="bg-green text-white">
            <tr>
              <th className="p-3">Voie</th>
              <th className="p-3">Kit minimal</th>
              <th className="p-3 text-right">Investissement</th>
              <th className="p-3 text-right">Gain du lot</th>
              <th className="p-3 text-right">Écart référence</th>
              <th className="p-3 text-right">Réputation lot</th>
              <th className="p-3 text-right">Bonus expertise</th>
              <th className="p-3 text-right">Réputation totale</th>
              <th className="p-3 text-right">Amortissement</th>
              <th className="p-3">Signal</th>
            </tr>
          </thead>
          <tbody>
            {report.projections.map((projection) => (
              <tr className="border-t-2 border-ink align-top" key={projection.route}>
                <td className="p-3"><strong className="block text-sm">{projection.name}</strong><small>jury ≥ {projection.minimumJuryScore.toFixed(1)}</small></td>
                <td className="max-w-56 p-3">{projection.equipmentNames.length > 0 ? projection.equipmentNames.join(" + ") : "Kit de départ"}</td>
                <td className="p-3 text-right font-bold">{formatKqCash(projection.acquisitionCostCents)}</td>
                <td className="p-3 text-right font-bold">{projection.available ? formatKqCash(projection.payoutCents) : "—"}</td>
                <td className={`p-3 text-right font-bold ${projection.comparisonDeltaCents > 0 ? "text-green" : projection.comparisonDeltaCents < 0 ? "text-red-700" : ""}`}>
                  {projection.available ? `${projection.comparisonDeltaCents > 0 ? "+" : ""}${formatKqCash(projection.comparisonDeltaCents)}` : "—"}
                </td>
                <td className="p-3 text-right font-bold">{projection.available ? `+${projection.reputationGain}` : "—"}</td>
                <td className="p-3 text-right font-bold text-green">{projection.available && projection.expertiseBonusReputation > 0 ? `+${projection.expertiseBonusReputation}` : "—"}</td>
                <td className="p-3 text-right font-black">{projection.available ? formatKqReputationDelta(projection.totalReputationGain) : "—"}</td>
                <td className="p-3 text-right font-bold">
                  {projection.paybackHarvests === null ? "—" : `${projection.paybackHarvests.toLocaleString("fr-FR")} récolte(s)`}
                  {projection.paybackHarvests !== null ? <small className="block font-normal text-charcoal">cible {projection.targetPaybackMin}–{projection.targetPaybackMax}</small> : null}
                </td>
                <td className="p-3"><span className={`inline-flex border-2 border-ink px-2 py-1 font-black uppercase ${STATUS_STYLES[projection.status]}`}>{STATUS_LABELS[projection.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-4 border-2 border-ink bg-white">
        <summary className="cursor-pointer bg-[#f4c642] px-4 py-3 text-sm font-black uppercase">
          Voir les {report.priceAnchors.totalCount} équivalents et leurs sources
        </summary>
        <div className="overflow-x-auto border-t-2 border-ink">
          <table className="min-w-[900px] w-full border-collapse text-left text-xs">
            <thead className="bg-[#20251c] text-white"><tr><th className="p-3">Équipement du jeu</th><th className="p-3">Équivalent réel</th><th className="p-3 text-right">Prix public US</th><th className="p-3 text-right">Prix constaté</th><th className="p-3">Source</th></tr></thead>
            <tbody>{report.priceAnchors.items.map((anchor) => (
              <tr className="border-t-2 border-ink align-top" key={anchor.code}>
                <td className="p-3"><strong>{anchor.name}</strong><small className="block text-charcoal">jeu · {formatKqCash(Math.round(anchor.gamePriceUsd * 100))}</small></td>
                <td className="p-3">{anchor.productLabel}</td>
                <td className="p-3 text-right font-bold">{formatKqCash(Math.round(anchor.referencePriceUsd * 100))}{anchor.priceKind === "starting-at" ? <small className="block font-normal">à partir de</small> : null}</td>
                <td className="p-3 text-right font-bold">{anchor.observedPriceCents ? formatKqCash(anchor.observedPriceCents) : "—"}</td>
                <td className="p-3"><a className="inline-flex items-center gap-1 font-bold text-green underline" href={anchor.sourceUrl} target="_blank" rel="noreferrer">{anchor.seller}<ExternalLink aria-hidden="true" size={13} /></a><small className="block text-charcoal">relevé le {anchor.checkedAt}</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-white p-3 text-xs text-charcoal">
        <span className="inline-flex items-center gap-2"><Gauge aria-hidden="true" size={17} /><strong>Zone cible :</strong> 3–18 récoltes · jusqu’à 36 pour Signature · bonus expertise aux ventes 3, 6 et 10.</span>
        <span>Prix publics US vérifiés le {report.priceAnchors.checkedAt ?? "—"} · hors livraison et taxes locales · monnaie fictive non convertible.</span>
      </footer>
    </section>
  );
}
