"use client";

import type { KqReleveProductionChapter, KqReleveProductionState } from '@/lib/kanab-quest-releve-production';
import type { KqClientRunSelection } from '@/lib/kanab-quest-client-run-selection';
import { KqReleveNativeWarehouse } from './KqReleveNativeWarehouse';
import { KqReleveNativeCulture } from './KqReleveNativeCulture';

type Props = {
  chapter: KqReleveProductionChapter; state: KqReleveProductionState;
  onChange: (state: KqReleveProductionState) => void; embedded?: boolean;
  onOpenCulture?: () => void; onOpenWarehouse?: () => void; onOpenArena?: () => void;
  onOpenGame?: () => void; onOpenMarket?: (flowerId?: string) => void; onOpenStorage?: () => void; onOpenRun?: (selection: KqClientRunSelection) => void;
};

/** Narrative state feeds the same screens mounted by the player shell. */
export function KqReleveProduction({ chapter, state, onChange, onOpenCulture, onOpenWarehouse, onOpenArena, onOpenGame, onOpenMarket, onOpenStorage, onOpenRun }: Props) {
  return chapter === 'plan' || chapter === 'buddies' || chapter === 'expansion'
    ? <KqReleveNativeWarehouse chapter={chapter} state={state} onChange={onChange} onOpenCulture={onOpenCulture} />
    : <KqReleveNativeCulture chapter={chapter} state={state} onChange={onChange} onOpenWarehouse={onOpenWarehouse} onOpenArena={onOpenArena}
      onOpenGame={onOpenGame ?? onOpenCulture} onOpenMarket={onOpenMarket} onOpenStorage={onOpenStorage} onOpenRun={onOpenRun} />;
}
