"use client";

import { CheckCircle2, CircleAlert, FileCheck2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getKqCombinedLaunchStatus,
  importKqLaunchEvidenceReport,
  parseStoredKqLaunchEvidenceReport,
  summarizeKqLaunchEvidenceReport,
  type KqLaunchEvidenceReport,
} from "@/lib/kanab-quest-launch-evidence-report";

const STORAGE_KEY = "kq-admin-launch-evidence-v1";
const MAX_REPORT_BYTES = 1_000_000;

export function AdminPlacardLaunchEvidence({
  serverReadinessAvailable,
  serverReadyForActivation,
  serverBlockers,
}: {
  serverReadinessAvailable: boolean;
  serverReadyForActivation: boolean;
  serverBlockers: readonly string[];
}) {
  const [report, setReport] = useState<KqLaunchEvidenceReport | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const summary = report ? summarizeKqLaunchEvidenceReport(report) : null;
  const combined = getKqCombinedLaunchStatus({
    report,
    serverReadinessAvailable,
    serverReadyForActivation,
    serverBlockers,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReport(parseStoredKqLaunchEvidenceReport(window.localStorage.getItem(STORAGE_KEY)));
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (report) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [report, storageReady]);

  const importReport = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_REPORT_BYTES) throw new Error("Rapport refusé : taille supérieure à 1 Mo.");
      const imported = importKqLaunchEvidenceReport(await file.text());
      setReport(imported);
      setNotice("Rapport consolidé importé et contrôlé.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import du rapport impossible.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearReport = () => {
    setReport(null);
    setNotice("Rapport local retiré. Les fichiers de preuve d’origine ne sont pas modifiés.");
  };

  return (
    <article className="cartoon-border bg-[#fff0c9] p-6" aria-labelledby="placard-launch-evidence-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Recette · 12 preuves obligatoires</p>
          <h4 id="placard-launch-evidence-title" className="mt-1 font-display text-2xl">Dossier de preuves consolidé</h4>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">
            Lance le vérificateur hors ligne, puis importe ici son dernier rapport JSON. Seule sa synthèse expurgée est conservée dans ce navigateur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importReport(event.target.files?.[0])} />
          <button className="btn-cartoon btn-secondary" type="button" onClick={() => inputRef.current?.click()}>
            <Upload size={15} /> Importer le rapport
          </button>
          {report ? (
            <button className="btn-cartoon btn-secondary" type="button" onClick={clearReport}>
              <Trash2 size={15} /> Retirer
            </button>
          ) : null}
        </div>
      </header>

      {notice ? <p className="mt-3 border-2 border-ink bg-white p-3 text-sm font-semibold" role="status">{notice}</p> : null}

      {!report || !summary ? (
        <div className="mt-4 grid gap-2 border-2 border-ink bg-white p-4">
          <b>Aucun rapport consolidé importé.</b>
          <code className="w-fit max-w-full overflow-x-auto bg-ink px-3 py-2 text-xs text-white">npm run verify:placard:launch-evidence</code>
          <p className="text-xs text-charcoal">Préflight serveur : {serverReadinessAvailable ? serverReadyForActivation ? "prêt" : "bloqué" : "indisponible"}.</p>
        </div>
      ) : (
        <>
          <section className={`mt-4 border-2 border-ink p-4 ${combined.readyForActivationWindow ? "bg-[#bfe5c4]" : "bg-[#ffd2c2]"}`} aria-label="Verdict croisé des preuves et du préflight serveur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-display text-xl">
                {combined.readyForActivationWindow ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                {combined.title}
              </span>
              <b className="border-2 border-ink bg-white px-3 py-2 text-xs uppercase">{summary.passedCount}/{summary.total} preuves</b>
            </div>
            <p className="mt-2 text-sm"><b>Prochaine action :</b> {combined.nextAction}</p>
            <p className="mt-2 text-xs text-charcoal">
              Rapport du {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt))}
              {summary.fresh ? " · preuve encore fraîche" : " · preuve expirée"}
              {report.invalidReportCount > 0 ? ` · ${report.invalidReportCount} fichier(s) JSON invalide(s)` : ""}
            </p>
            <p className="mt-1 text-xs font-bold">Ce voyant n’active ni collection, ni récompense, ni accès joueur.</p>
          </section>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {report.requirements.map((requirement) => (
              <section className={`border-2 border-ink p-3 ${requirement.passed ? "bg-[#e8f4e7]" : "bg-white"}`} key={requirement.code}>
                <div className="flex items-start gap-2">
                  {requirement.passed
                    ? <CheckCircle2 className="mt-0.5 shrink-0 text-green" aria-hidden="true" size={18} />
                    : <FileCheck2 className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" size={18} />}
                  <div>
                    <b className="text-sm">{requirement.label}</b>
                    <p className="mt-1 text-xs leading-snug text-charcoal">{requirement.detail}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
