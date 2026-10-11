"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, PackageCheck, ShoppingBag, Store, Zap } from 'lucide-react';
import { getKqOperationsCommerce, getKqOperationsProgress, type KqOperationsLessonId } from '@/lib/kanab-quest-operations-lesson';
import { createKqOperationsSession } from '@/lib/kanab-quest-operations-session';
import type { KqEnergyMode } from '@/lib/kanab-quest-energy';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import { KqLessonTentProvider } from './KqTentSelector';
import { KqEquipmentCatalogModal } from './KqEquipmentCatalogModal';
import { KqWarehouseEntry } from './KqWarehouseEntry';
import { KqCommerceDesk } from './KqCommerceDesk';
import { KqOnlineBusiness } from './KqOnlineBusiness';
import { KqEnergyPanel } from './KqEnergyPanel';
import styles from './KqPlayableOperationsLesson.module.css';

type Props = { lesson: KqOperationsLessonId; onProgress?: (progress: { instruction: string; complete: boolean }) => void };

function Lesson({ lesson, onProgress }: Props) {
  const [session] = useState(() => createKqOperationsSession(lesson));
  const [api] = useState(() => createKqTutorialApi(session.request));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [view, setView] = useState<'catalog' | 'warehouse' | 'market' | 'energy' | 'business'>(lesson === 'equipment' ? 'catalog' : lesson);
  const [initialCode, setInitialCode] = useState<string | undefined>(undefined);
  const [warehouseSection, setWarehouseSection] = useState<'equipment' | 'storage'>('equipment');
  const [mode, setMode] = useState<KqEnergyMode>('balanced');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; body: Record<string, unknown> } | null>(null);
  const [businessBusy, setBusinessBusy] = useState(false);
  const [businessError, setBusinessError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const progress = getKqOperationsProgress(state);
  const { instruction, complete } = progress;
  useEffect(() => { session.restore(); }, [session]);
  useEffect(() => { onProgress?.({ instruction, complete }); }, [onProgress, instruction, complete]);
  useEffect(() => { if (confirmation && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [confirmation]);
  const show = (next: typeof view, code?: string) => { setInitialCode(code); setWarehouseSection('equipment'); setNotice(''); setView(next); };
  const advanceOnline = async () => {
    const response = await session.request('/api/arena/placard/commerce', { method: 'POST', body: JSON.stringify({
      action: 'online', command: 'advance-online-time', payload: { hours: 24 }, requestKey: crypto.randomUUID(),
    }) });
    const result = await response.json();
    setNotice(response.ok ? '24 heures fictives se sont écoulées dans cet essai. Observe tes ventes et les retours clients.' : result.error);
    if (response.ok) api.notify('kq:equipment-updated');
  };
  const confirmBusiness = async () => {
    if (!confirmation || businessBusy) return;
    setBusinessBusy(true); setBusinessError('');
    try {
      const response = await session.request('/api/arena/placard/commerce', { method: 'POST', body: JSON.stringify(confirmation.body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConfirmation(null); api.notify('kq:equipment-updated');
    } catch (error) { setBusinessError(error instanceof Error ? error.message : 'Action indisponible dans cet essai.'); }
    finally { setBusinessBusy(false); }
  };
  return <KqTutorialApiProvider api={api}><KqLessonTentProvider>
    <section className={styles.lesson} data-playable-operations={lesson} data-operations-complete={progress.complete || undefined}>
      <nav className={styles.nav} aria-label="Espaces de cet essai">
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'market'} onClick={() => show('market')}>Marché · Transformer et vendre</button> : null}
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'business'} onClick={() => show('business')}><Store size={16} aria-hidden="true" />Marché · Gérer mon activité</button> : null}
        <button type="button" aria-pressed={view === 'catalog'} onClick={() => show('catalog')}><ShoppingBag size={16} />Boutique</button>
        <button type="button" aria-pressed={view === 'warehouse' && warehouseSection === 'equipment'} onClick={() => show('warehouse')}><Box size={16} />Entrepôt</button>
        <button type="button" aria-pressed={view === 'warehouse' && warehouseSection === 'storage'} onClick={() => { show('warehouse'); setWarehouseSection('storage'); }}><PackageCheck size={16} aria-hidden="true" />Stockage & curing</button>
        <button type="button" aria-pressed={view === 'energy'} onClick={() => show('energy')}><Zap size={16} />Énergie</button>
      </nav>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {lesson === 'market' && (view === 'market' || view === 'business') && state.trial.commerce.online?.listings.length ? <div className={styles.clock}><span>Le temps de cet essai est fictif.</span><button type="button" onClick={() => void advanceOnline()}>Avancer de 24 h fictives</button></div> : null}
      <div className={styles.surface}>
        {view === 'catalog' ? <KqEquipmentCatalogModal initialEquipmentCode={initialCode} onClose={() => show('warehouse')} onOpenWorkshop={code => show('warehouse', code)} /> : null}
        {view === 'warehouse' ? <KqWarehouseEntry initialSection={warehouseSection} initialEquipmentCode={initialCode} onClose={() => show(lesson === 'market' ? 'market' : 'catalog')} onOpenShop={code => show('catalog', code)} /> : null}
        {view === 'market' ? <KqCommerceDesk onOpenShop={code => show('catalog', code)} onOpenStorage={() => { show('warehouse'); setWarehouseSection('storage'); }} onOpenBusiness={() => show('business')} onOpenTreasury={() => setNotice('Pour consulter les factures et les comptes, ouvre l’atelier Gérer mon commerce puis Bureau · Comptabilité.')} /> : null}
        {view === 'business' ? <div className={styles.business}><KqOnlineBusiness data={getKqOperationsCommerce(state)} now={state.trial.clock} busy={businessBusy} onOpenShop={() => show('catalog', 'COMPUTER')} onAsk={(title, description, body) => { setBusinessError(''); setConfirmation({ title, description, body: { ...body, requestKey: crypto.randomUUID() } }); }} /></div> : null}
        {view === 'energy' ? <div className={styles.energy}><KqEnergyPanel selectedMode={mode} onModeChange={setMode} productionUnits={state.tents.length} /><p>Ce réglage est essayé ici. Dans une partie, tu choisis ce mode avant de lancer ta culture.</p></div> : null}
      </div>
      {progress.complete ? <div className={styles.completion} data-workshop-complete><strong>Geste réussi dans ton installation d’essai.</strong><button type="button" onClick={() => { session.restart(); api.notify('kq:equipment-updated'); show(lesson === 'equipment' ? 'catalog' : lesson); }}>Recommencer cet essai</button></div> : null}
      {confirmation ? <dialog ref={dialog} className={styles.confirmation} aria-labelledby="operations-business-confirm-title" onCancel={event => { if (businessBusy) event.preventDefault(); else setConfirmation(null); }}><h2 id="operations-business-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>{businessError ? <p role="alert">{businessError}</p> : null}<footer><button type="button" disabled={businessBusy} onClick={() => setConfirmation(null)}>Revenir</button><button type="button" disabled={businessBusy} onClick={() => void confirmBusiness()}>{businessBusy ? 'Validation…' : 'Confirmer dans cet essai'}</button></footer></dialog> : null}
    </section>
  </KqLessonTentProvider></KqTutorialApiProvider>;
}

export function KqPlayableOperationsLesson(props: Props) { return <Lesson key={props.lesson} {...props} />; }
