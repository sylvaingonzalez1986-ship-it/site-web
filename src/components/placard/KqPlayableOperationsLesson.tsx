"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, PackageCheck, ShoppingBag, Store, Zap } from 'lucide-react';
import { createClientRequestKey } from '@/lib/client-request-key';
import { getKqOperationsCommerce, getKqOperationsProgress, type KqOperationsLessonId } from '@/lib/kanab-quest-operations-lesson';
import { createKqOperationsSession } from '@/lib/kanab-quest-operations-session';
import type { KqEnergyMode } from '@/lib/kanab-quest-energy';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import { KqLessonTentProvider } from './KqTentSelector';
import { KqEquipmentCatalogModal } from './KqEquipmentCatalogModal';
import { KqWarehouseEntry } from './KqWarehouseEntry';
import { KqCommerceDesk } from './KqCommerceDesk';
import { KqHarvestStorage } from './KqHarvestStorage';
import { KqOnlineBusiness } from './KqOnlineBusiness';
import { KqSocialNetworks } from './KqSocialNetworks';
import { KqPrintedArt } from './KqPrintedArt';
import { KqEnergyPanel } from './KqEnergyPanel';
import styles from './KqPlayableOperationsLesson.module.css';

type Props = { lesson: KqOperationsLessonId; onProgress?: (progress: { instruction: string; complete: boolean }) => void };

function Lesson({ lesson, onProgress }: Props) {
  const [session] = useState(() => createKqOperationsSession(lesson));
  const [api] = useState(() => createKqTutorialApi(session.request));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [view, setView] = useState<'catalog' | 'warehouse' | 'harvests' | 'market' | 'energy' | 'business' | 'social'>(lesson === 'equipment' ? 'catalog' : lesson);
  const [marketMode, setMarketMode] = useState<'sales' | 'dashboard'>('sales');
  const [flowerId, setFlowerId] = useState<string>();
  const [listingId, setListingId] = useState<string>();
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
      action: 'online', command: 'advance-online-time', payload: { hours: 24 }, requestKey: createClientRequestKey(),
    }) });
    const result = await response.json();
    setNotice(response.ok ? '24 heures fictives se sont écoulées dans cet essai. Tes ventes, tes réseaux et ton énergie mentale ont avancé.' : result.error);
    if (response.ok) { api.notify('kq:equipment-updated'); api.notify('kq:social-updated'); }
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
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'market' && marketMode === 'sales'} onClick={() => { setMarketMode('sales'); show('market'); }}>Commerce · Vendre</button> : null}
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'market' && marketMode === 'dashboard'} onClick={() => { setMarketMode('dashboard'); show('market'); }}>Mon stock en vente</button> : null}
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'business'} onClick={() => show('business')}><Store size={16} aria-hidden="true" />Commerce · Développer</button> : null}
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'social'} onClick={() => show('social')}><span style={{ width: 24, flexShrink: 0 }}><KqPrintedArt kind="social" sizes="24px" /></span>Réseaux</button> : null}
        <button type="button" aria-pressed={view === 'catalog'} onClick={() => show('catalog')}><ShoppingBag size={16} />Acheter du matériel</button>
        <button type="button" aria-pressed={view === 'warehouse' && warehouseSection === 'equipment'} onClick={() => show('warehouse')}><Box size={16} />Entrepôt</button>
        <button type="button" aria-pressed={view === 'harvests'} onClick={() => show('harvests')}><PackageCheck size={16} aria-hidden="true" />Conserver mes récoltes</button>
        <button type="button" aria-pressed={view === 'energy'} onClick={() => show('energy')}><Zap size={16} />Énergie</button>
      </nav>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {lesson === 'market' && (view === 'business' || view === 'social' || (view === 'market' && !!state.trial.commerce.online?.listings.length)) ? <div className={styles.clock}><span>Le temps de cet essai est fictif.</span><button type="button" onClick={() => void advanceOnline()}>Avancer de 24 h fictives</button></div> : null}
      <div className={styles.surface}>
        {view === 'catalog' ? <KqEquipmentCatalogModal initialEquipmentCode={initialCode} onClose={() => show('warehouse')} onOpenWorkshop={code => show('warehouse', code)} /> : null}
        {view === 'warehouse' ? <KqWarehouseEntry initialSection={warehouseSection} initialFlowerId={flowerId} initialEquipmentCode={initialCode} onClose={() => show(lesson === 'market' ? 'market' : 'catalog')} onOpenShop={code => show('catalog', code)} onOpenHarvests={id => { setFlowerId(id); show('harvests'); }} onOpenMarket={id => { setFlowerId(id); setMarketMode('sales'); show('market'); }} /> : null}
        {view === 'harvests' ? <KqHarvestStorage initialFlowerId={flowerId} showOverviewLink={false} onOpenOverview={() => show('harvests')} onOpenWarehouse={id => { setFlowerId(id); show('warehouse'); setWarehouseSection('storage'); }} onOpenMarket={id => { setFlowerId(id); setMarketMode('sales'); show('market'); }} /> : null}
        {view === 'market' ? <KqCommerceDesk initialFlowerId={flowerId} initialListingId={listingId} mode={marketMode} onModeChange={(next, id) => { setMarketMode(next === 'dashboard' ? 'dashboard' : 'sales'); setListingId(id); }} onOpenShop={(code, id) => { if (id) setFlowerId(id); show('catalog', code); }} onOpenStorage={id => { setFlowerId(id); show('harvests'); }} onOpenBusiness={() => show('business')} onOpenTreasury={() => setNotice('Pour consulter les factures et les comptes, ouvre la rencontre Gérer mon commerce puis Finances.')} /> : null}
        {view === 'business' ? <div className={styles.business}><KqOnlineBusiness data={getKqOperationsCommerce(state)} now={state.trial.clock} busy={businessBusy} onOpenShop={() => show('catalog', 'COMPUTER')} onPrepareStock={() => { setMarketMode('sales'); show('market'); }} onViewSales={id => { setListingId(id); setMarketMode('dashboard'); show('market'); }} onAsk={(title, description, body) => { setBusinessError(''); setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() } }); }} /></div> : null}
        {view === 'social' ? <KqSocialNetworks /> : null}
        {view === 'energy' ? <div className={styles.energy}><KqEnergyPanel selectedMode={mode} onModeChange={setMode} productionUnits={state.tents.length} /><p>Ce réglage est essayé ici. Dans une partie, tu choisis ce mode avant de lancer ta culture.</p></div> : null}
      </div>
      {progress.complete ? <div className={styles.completion} data-workshop-complete><strong>Geste réussi dans ton installation d’essai.</strong><button type="button" onClick={() => { session.restart(); api.notify('kq:equipment-updated'); show(lesson === 'equipment' ? 'catalog' : lesson); }}>Recommencer cet essai</button></div> : null}
      {confirmation ? <dialog ref={dialog} className={styles.confirmation} aria-labelledby="operations-business-confirm-title" onCancel={event => { if (businessBusy) event.preventDefault(); else setConfirmation(null); }}><h2 id="operations-business-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>{businessError ? <p role="alert">{businessError}</p> : null}<footer><button type="button" disabled={businessBusy} onClick={() => setConfirmation(null)}>Revenir</button><button type="button" disabled={businessBusy} onClick={() => void confirmBusiness()}>{businessBusy ? 'Validation…' : 'Confirmer dans cet essai'}</button></footer></dialog> : null}
    </section>
  </KqLessonTentProvider></KqTutorialApiProvider>;
}

export function KqPlayableOperationsLesson(props: Props) { return <Lesson key={props.lesson} {...props} />; }
