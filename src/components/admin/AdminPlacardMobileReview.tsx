"use client";

import { Download, Smartphone, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  buildKqPlacardMobileReviewReport,
  getKqPlacardMobileReviewKey,
  importKqPlacardMobileReviewReport,
  KQ_PLACARD_MOBILE_REVIEW_CHECKS,
  KQ_PLACARD_MOBILE_REVIEW_PROFILES,
  parseKqPlacardMobileReviewState,
  summarizeKqPlacardMobileReview,
  type KqPlacardMobileReviewState,
  type KqPlacardMobileReviewStatus,
} from "@/lib/kanab-quest-mobile-manual-review";

const STORAGE_KEY = "kq-admin-mobile-manual-review-v3";

export function AdminPlacardMobileReview() {
  const [state, setState] = useState<KqPlacardMobileReviewState>({});
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const summary = summarizeKqPlacardMobileReview(state);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setState(parseKqPlacardMobileReviewState(window.localStorage.getItem(STORAGE_KEY)));
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, storageReady]);

  const setDecision = (
    profileCode: string,
    checkCode: string,
    status: KqPlacardMobileReviewStatus | undefined,
  ) => {
    const key = getKqPlacardMobileReviewKey(profileCode, checkCode);
    setState((current) => {
      const next = { ...current };
      if (status) next[key] = { status, reviewedAt: new Date().toISOString() };
      else delete next[key];
      return next;
    });
  };

  const exportReview = () => {
    const payload = buildKqPlacardMobileReviewReport(state);
    const url = URL.createObjectURL(new Blob(
      [`${JSON.stringify(payload, null, 2)}\n`],
      { type: "application/json" },
    ));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `placard-mobile-manual-review-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importReview = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = importKqPlacardMobileReviewReport(await file.text());
      setState(imported.state);
      setNotice(`${imported.restored} contrôle(s) restauré(s) · ${imported.missing} contrôle(s) absent(s).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import de la recette mobile impossible.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <article className="cartoon-border bg-[#e8f4e7] p-6" aria-labelledby="placard-mobile-review-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Appareils réels · recette humaine</p>
          <h4 id="placard-mobile-review-title" className="mt-1 font-display text-2xl">Checklist mobile iOS et Android</h4>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">
            À remplir uniquement après manipulation du Placard sur les deux téléphones physiques. Aucun modèle, compte, email ou commentaire libre n’est enregistré.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importReview(event.target.files?.[0])} />
          <button className="btn-cartoon btn-secondary" type="button" onClick={() => importInputRef.current?.click()}>
            <Upload size={15} /> Importer
          </button>
          <button className="btn-cartoon btn-secondary" type="button" onClick={exportReview}>
            <Download size={15} /> Exporter la preuve
          </button>
        </div>
      </header>

      <p className={`mt-4 border-2 border-ink p-3 text-sm font-bold ${summary.readyForLaunch ? "bg-[#bfe5c4]" : summary.failed > 0 ? "bg-[#ffd2c2]" : "bg-white"}`} role="status">
        {summary.readyForLaunch
          ? "Recette physique prête : les 20 contrôles sont validés."
          : `${summary.pending} contrôle(s) à tester · ${summary.failed} blocage(s) · ${summary.approvedProfiles}/2 appareil(s) validé(s).`}
      </p>
      {notice ? <p className="mt-2 text-sm font-semibold text-charcoal" role="status">{notice}</p> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {KQ_PLACARD_MOBILE_REVIEW_PROFILES.map((profile) => {
          const profilePassed = KQ_PLACARD_MOBILE_REVIEW_CHECKS.every((check) => (
            state[getKqPlacardMobileReviewKey(profile.code, check.code)]?.status === "passed"
          ));
          return (
            <section className={`border-2 border-ink p-4 ${profilePassed ? "bg-[#bfe5c4]" : "bg-white"}`} key={profile.code} aria-labelledby={`mobile-review-${profile.code}`}>
              <div className="flex items-start gap-3 border-b-2 border-ink pb-3">
                <span className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-[#f4c642] shadow-[2px_2px_0_#111]"><Smartphone aria-hidden="true" size={21} /></span>
                <div><h5 id={`mobile-review-${profile.code}`} className="font-display text-xl">{profile.name}</h5><p className="text-xs text-charcoal">{profile.description}</p></div>
              </div>
              <div className="mt-3 grid gap-2">
                {KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => {
                  const status = state[getKqPlacardMobileReviewKey(profile.code, check.code)]?.status ?? "pending";
                  return (
                    <div className="grid gap-2 border-2 border-ink bg-[#f6f0e6] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-review-status={status} key={check.code}>
                      <div>
                        <span className="text-sm font-semibold leading-snug">{check.label}</span>
                        {check.procedure?.length ? (
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-snug text-charcoal">
                            {check.procedure.map((step) => <li key={step}>{step}</li>)}
                          </ol>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button className={`min-h-11 border-2 border-ink px-2 text-[10px] font-black uppercase ${status === "passed" ? "bg-[#bfe5c4]" : "bg-white"}`} type="button" aria-pressed={status === "passed"} onClick={() => setDecision(profile.code, check.code, "passed")}>OK</button>
                        <button className={`min-h-11 border-2 border-ink px-2 text-[10px] font-black uppercase ${status === "failed" ? "bg-[#ff9b78]" : "bg-white"}`} type="button" aria-pressed={status === "failed"} onClick={() => setDecision(profile.code, check.code, "failed")}>Bloqué</button>
                        <button className={`min-h-11 border-2 border-ink px-2 text-[10px] font-black uppercase ${status === "pending" ? "bg-[#f4c642]" : "bg-white"}`} type="button" aria-pressed={status === "pending"} onClick={() => setDecision(profile.code, check.code, undefined)}>À tester</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
