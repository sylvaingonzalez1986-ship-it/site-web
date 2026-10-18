"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Clock3, RotateCcw } from 'lucide-react';
import { createReleveCommerceTransport } from '@/lib/kanab-quest-releve-commerce';
import { createKqReleveWorkshop, getKqReleveWorkshopProgress, KQ_RELEVE_WORKSHOP_STORAGE_KEY, readKqReleveWorkshop, type KqReleveWorkshopState } from '@/lib/kanab-quest-releve-workshop';
import { KqCommerceDesk } from './KqCommerceDesk';
import { KqEquipmentCatalogModal } from './KqEquipmentCatalogModal';
import { KqWarehouseEntry } from './KqWarehouseEntry';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import styles from './KqReleveWorkshop.module.css';

function restore() {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(KQ_RELEVE_WORKSHOP_STORAGE_KEY);
    const saved = raw ? readKqReleveWorkshop(JSON.parse(raw)) : null;
    return { state: saved ?? createKqReleveWorkshop(), warning: raw && !saved ? 'Le dossier enregistré était incomplet. Sylvain a préparé un nouvel essai.' : '' };
  } catch { return { state: createKqReleveWorkshop(), warning: 'La reprise sur cet appareil est indisponible. Tu peux terminer cette rencontre pendant cette visite.' }; }
}

export function KqReleveWorkshop({ onComplete }: { onComplete?: () => void }) {
  const [saved, setSaved] = useState(restore);
  const state = saved.state, current = useRef(state), workspace = useRef<HTMLDivElement>(null);
  const completeCallback = useRef(onComplete), notified = useRef(false);
  const [place, setPlace] = useState<'machines' | 'catalog' | 'counter'>('machines');
  const [equipmentCode, setEquipmentCode] = useState('SIFT-TRAY');
  const [notice, setNotice] = useState(''), [deskVersion, setDeskVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => { current.current = state; completeCallback.current = onComplete; }, [state, onComplete]);
  const commit = useRef<(next: KqReleveWorkshopState) => void>(() => undefined);
  useLayoutEffect(() => {
    commit.current = next => {
      current.current = next;
      let warning = '';
      try { window.localStorage.setItem(KQ_RELEVE_WORKSHOP_STORAGE_KEY, JSON.stringify(next)); }
      catch { warning = 'Cette progression reste disponible pendant la visite, mais sa sauvegarde sur cet appareil a échoué.'; }
      setSaved({ state: next, warning });
    };
  }, []);
  const api = useMemo(() => createKqTutorialApi(createReleveCommerceTransport({
    getState: () => current.current.commerce,
    setState: commerce => commit.current({ ...current.current, commerce }),
  })), []);
  const progress = getKqReleveWorkshopProgress(state);
  const guidePhase = !state.careerRead ? 'career' : progress.processing ? 'processing' : progress.transformed ? state.maintenanceRead ? 'complete' : 'maintenance' : state.commerce.lots[0].prepared ? 'retry' : 'route';
  useEffect(() => { if (progress.complete && !notified.current) { notified.current = true; completeCallback.current?.(); } }, [progress.complete]);
  // Read the actual catalogue/maintenance surfaces; no re-created machine sheet.
  useEffect(() => {
    const key = place === 'catalog' && !state.careerRead ? 'careerRead' : place === 'machines' && progress.transformed && !state.maintenanceRead ? 'maintenanceRead' : null;
    if (!key) return;
    const selector = key === 'careerRead' ? '[data-workshop-tiers]' : '[aria-label="Entretien de la machine"]';
    let recorded = false;
    const seen = new IntersectionObserver(entries => {
      if (recorded || !entries.some(entry => entry.isIntersecting)) return;
      recorded = true; commit.current({ ...current.current, [key]: true });
    });
    const elements = new Set<Element>();
    const sync = () => workspace.current?.querySelectorAll(selector).forEach(element => { if (!elements.has(element)) { elements.add(element); seen.observe(element); } });
    const observer = new MutationObserver(sync);
    if (workspace.current) observer.observe(workspace.current, { childList: true, subtree: true });
    sync();
    return () => { observer.disconnect(); seen.disconnect(); };
  }, [place, progress.transformed, state.careerRead, state.maintenanceRead]);
  const remainingMinutes = Math.ceil(Math.max(0, ...state.commerce.operations.trial.commerce.stocks.map(stock => stock.processingReadyAt ? Date.parse(stock.processingReadyAt) - state.commerce.operations.trial.clock : 0)) / 60_000);
  async function finishProcessing() {
    setBusy(true); setNotice('');
    try {
      const response = await api.request('/api/releve/commerce', { method: 'POST', body: JSON.stringify({ action: 'finish-processing' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Le temps fictif n’a pas pu avancer.');
      api.notify('kq:commerce-updated'); api.notify('kq:equipment-updated');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Le temps fictif n’a pas pu avancer.'); }
    finally { setBusy(false); }
  }
  function restart() {
    notified.current = false; commit.current(createKqReleveWorkshop()); setDeskVersion(value => value + 1);
    setPlace('machines'); setNotice('Un nouveau lot de démonstration est prêt.');
  }
  function localLink(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!target || !new URL(target.href, window.location.href).pathname.startsWith('/arene')) return;
    event.preventDefault(); event.stopPropagation(); setNotice('Cette porte possède sa propre rencontre dans le quartier. Ton dossier d’atelier reste ici.');
  }
  const otherVisit = () => setNotice('Cette activité possède sa propre rencontre dans le quartier.');
  const openCatalog = (code?: string) => { setEquipmentCode(code ?? 'SIFT-TRAY'); setPlace('catalog'); };
  return <KqTutorialApiProvider api={api}><div ref={workspace} className={styles.visit} data-releve-workshop={guidePhase} data-releve-workshop-place={place} onClickCapture={localLink} onAuxClickCapture={localLink}>
    <nav className={styles.toolbar} aria-label="Parcours de l’essai d’atelier">
      <button type="button" data-releve-guide="workshop-counter" aria-pressed={place === 'counter'} onClick={() => setPlace('counter')}>Transformer le lot</button>
      <button type="button" data-releve-guide="workshop-maintenance" aria-pressed={place === 'machines'} onClick={() => { setEquipmentCode('SIFT-TRAY'); setPlace('machines'); }}>Mes machines</button>
      {progress.processing ? <button type="button" data-releve-guide="workshop-finish" disabled={busy} onClick={() => void finishProcessing()}><Clock3 size={19} aria-hidden="true" />Avancer jusqu’à la fin · {remainingMinutes} min</button> : null}
      <button type="button" className={styles.restart} aria-label="Recommencer ce dossier prêté" data-releve-guide="workshop-restart" onClick={restart}><RotateCcw size={17} aria-hidden="true" /></button>
    </nav>
    {saved.warning ? <p className={styles.notice} role="status">{saved.warning}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {place === 'catalog' ? <KqEquipmentCatalogModal embedded workshopOnly initialEquipmentCode={equipmentCode} onClose={() => setPlace('machines')} onOpenWorkshop={code => { setEquipmentCode(code ?? 'SIFT-TRAY'); setPlace('machines'); }} />
      : place === 'machines' ? <KqWarehouseEntry key={deskVersion} embedded workshopOnly initialEquipmentCode={equipmentCode} onClose={() => setPlace('counter')} onOpenShop={openCatalog} />
        : <KqCommerceDesk key={deskVersion} mode="sales" initialFlowerId="releve-workshop" onOpenShop={openCatalog} onOpenBusiness={otherVisit} onOpenStorage={otherVisit} onOpenTreasury={otherVisit} onOpenCulture={otherVisit} />}
  </div></KqTutorialApiProvider>;
}
