"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, ShoppingBag, Zap } from 'lucide-react';
import { getKqOperationsProgress, type KqOperationsLessonId } from '@/lib/kanab-quest-operations-lesson';
import { createKqOperationsSession } from '@/lib/kanab-quest-operations-session';
import type { KqEnergyMode } from '@/lib/kanab-quest-energy';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import { KqLessonTentProvider } from './KqTentSelector';
import { KqEquipmentCatalogModal } from './KqEquipmentCatalogModal';
import { KqWarehouseEntry } from './KqWarehouseEntry';
import { KqCommerceDesk } from './KqCommerceDesk';
import { KqEnergyPanel } from './KqEnergyPanel';
import styles from './KqPlayableOperationsLesson.module.css';

type Props = { lesson: KqOperationsLessonId; onProgress?: (progress: { instruction: string; complete: boolean }) => void };

function Lesson({ lesson, onProgress }: Props) {
  const [session] = useState(() => createKqOperationsSession(lesson));
  const [api] = useState(() => createKqTutorialApi(session.request));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [view, setView] = useState<'catalog' | 'warehouse' | 'market' | 'energy'>(lesson === 'equipment' ? 'catalog' : lesson);
  const [initialCode, setInitialCode] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<KqEnergyMode>('balanced');
  const [notice, setNotice] = useState('');
  const progress = getKqOperationsProgress(state);
  const { instruction, complete } = progress;
  useEffect(() => { session.restore(); }, [session]);
  useEffect(() => { onProgress?.({ instruction, complete }); }, [onProgress, instruction, complete]);
  const show = (next: typeof view, code?: string) => { setInitialCode(code); setNotice(''); setView(next); };
  return <KqTutorialApiProvider api={api}><KqLessonTentProvider>
    <section className={styles.lesson} data-playable-operations={lesson} data-operations-complete={progress.complete || undefined}>
      <nav className={styles.nav} aria-label="Espaces de cet essai">
        {lesson === 'market' ? <button type="button" aria-pressed={view === 'market'} onClick={() => show('market')}>Transformation et vente</button> : null}
        <button type="button" aria-pressed={view === 'catalog'} onClick={() => show('catalog')}><ShoppingBag size={16} />Boutique</button>
        <button type="button" aria-pressed={view === 'warehouse'} onClick={() => show('warehouse')}><Box size={16} />Entrepôt</button>
        <button type="button" aria-pressed={view === 'energy'} onClick={() => show('energy')}><Zap size={16} />Énergie</button>
      </nav>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      <div className={styles.surface}>
        {view === 'catalog' ? <KqEquipmentCatalogModal initialEquipmentCode={initialCode} onClose={() => show('warehouse')} onOpenWorkshop={code => show('warehouse', code)} /> : null}
        {view === 'warehouse' ? <KqWarehouseEntry initialEquipmentCode={initialCode} onClose={() => show(lesson === 'market' ? 'market' : 'catalog')} onOpenShop={code => show('catalog', code)} /> : null}
        {view === 'market' ? <KqCommerceDesk onOpenShop={code => show('catalog', code)} onOpenTreasury={() => setNotice('L’atelier Trésorerie te permet de manipuler ces factures et abonnements. Reviens aux espaces d’apprentissage pour l’ouvrir.')} /> : null}
        {view === 'energy' ? <div className={styles.energy}><KqEnergyPanel selectedMode={mode} onModeChange={setMode} productionUnits={state.tents.length} /><p>Ce réglage est essayé ici. Dans une partie, tu choisis ce mode avant de lancer ta culture.</p></div> : null}
      </div>
      {progress.complete ? <div className={styles.completion} data-workshop-complete><strong>Geste réussi dans ton installation d’essai.</strong><button type="button" onClick={() => { session.restart(); api.notify('kq:equipment-updated'); show(lesson === 'equipment' ? 'catalog' : lesson); }}>Recommencer cet essai</button></div> : null}
    </section>
  </KqLessonTentProvider></KqTutorialApiProvider>;
}

export function KqPlayableOperationsLesson(props: Props) { return <Lesson key={props.lesson} {...props} />; }
