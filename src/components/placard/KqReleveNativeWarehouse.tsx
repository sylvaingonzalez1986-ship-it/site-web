"use client";

import { useLayoutEffect, useMemo, useState, type MouseEvent } from 'react';
import { PackOpeningFlowModal } from '@/components/account/PackOpeningFlowModal';
import { KQ_BUDDIES } from '@/lib/kanab-quest-game';
import { getBuddieArtwork } from '@/lib/buddie-artwork';
import { applyKqReleveProductionAction, KQ_RELEVE_BUDDIES, type KqReleveProductionState } from '@/lib/kanab-quest-releve-production';
import { createReleveWarehouseTransport } from '@/lib/kanab-quest-releve-warehouse';
import type { LotteryCollectedCard, LotteryTicket, ScratchResult } from '@/types/lottery';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import { KqWarehouse } from './KqWarehouse';

type Props = {
  chapter: 'plan' | 'buddies' | 'expansion'; state: KqReleveProductionState;
  onChange: (state: KqReleveProductionState) => void; onOpenCulture?: () => void;
};

export function KqReleveNativeWarehouse({ chapter, state, onChange, onOpenCulture }: Props) {
  const [notice, setNotice] = useState('');
  const [store] = useState(() => {
    let current = state, change = onChange;
    return {
      getState: () => current,
      setState: (next: KqReleveProductionState) => { current = next; change(next); },
      sync: (next: KqReleveProductionState, callback: Props['onChange']) => { current = next; change = callback; },
    };
  });
  useLayoutEffect(() => { store.sync(state, onChange); }, [store, state, onChange]);
  const [ticket, setTicket] = useState<LotteryTicket | null>(() => chapter === 'buddies' && state.ownedBuddies.length < 3 ? {
    id: 'releve-buddies', userId: 'releve', ticketNumber: 'Le pack prêté par Sylvain', orderAmount: 0,
    status: 'available', createdAt: new Date(state.clock).toISOString(),
  } : null);
  const commit = store.setState;
  const api = useMemo(() => createKqTutorialApi(createReleveWarehouseTransport(store)), [store]);
  const draftStore = useMemo(() => ({
    read: (revision: number) => store.getState().revision === revision ? store.getState().draftWarehouse : null,
    write: (draft: KqReleveProductionState['draftWarehouse']) => {
      if (JSON.stringify(draft) !== JSON.stringify(store.getState().draftWarehouse)) commit(applyKqReleveProductionAction(store.getState(), { type: 'draft', warehouse: draft }));
    },
  }), [commit, store]);
  const mark = (milestone: 'zone-inspected' | 'quote-read' | 'charges-read' | 'profile-read') => {
    if (!store.getState().milestones.includes(milestone)) commit(applyKqReleveProductionAction(store.getState(), { type: 'mark', milestone }));
  };
  const observe = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-warehouse-action="configure"], [data-warehouse-action="configure-selected"], [data-warehouse-zone-action="furnish"], [data-warehouse-zone-action="dimensions"]')) mark('zone-inspected');
    if (event.target.closest('[data-warehouse-quote-details] > summary')) mark('quote-read');
    if (event.target.closest('[data-warehouse-summary-tab="costs"]')) mark('charges-read');
    if (event.target.closest('[data-warehouse-buddie-card], [data-buddie-variety-card]')) mark('profile-read');
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (link && new URL(link.href, window.location.href).pathname.startsWith('/arene')) {
      event.preventDefault(); event.stopPropagation();
      if (new URL(link.href, window.location.href).searchParams.get('view') === 'game') onOpenCulture?.();
    }
  };
  const openPack = async (): Promise<ScratchResult> => {
    let next = store.getState();
    while (next.ownedBuddies.length < KQ_RELEVE_BUDDIES.length) next = applyKqReleveProductionAction(next, { type: 'reveal-buddie' });
    commit(next); api.notify('kq:collection-updated');
    const at = new Date(next.clock).toISOString();
    const cards: LotteryCollectedCard[] = KQ_RELEVE_BUDDIES.map(code => {
      const card = KQ_BUDDIES.find(item => item.code === code)!;
      return { id: `releve-${code}`, collectionId: 'releve-buddies', collectionCode: 'buddies', collectionTitle: 'Buddies',
        code, name: card.name, rarity: card.rarity, cardNumber: card.cardNumber, visualPrompt: '', description: card.ability,
        imageUrl: getBuddieArtwork(code) ?? '', isActive: true, createdAt: at, updatedAt: at,
        ownedCount: 1, isOwned: true, isDuplicate: false };
    });
    const byRarity = { common: 0, silver: 0, gold: 0, epic: 0, legendary: 0 };
    cards.forEach(card => { byRarity[card.rarity]++; });
    return { ticketId: 'releve-buddies', ticketNumber: 'Le pack prêté par Sylvain', scratchedAt: at, card: cards[0], cards,
      inventory: { totalCards: KQ_BUDDIES.length, uniqueOwned: cards.length, totalOwnedCopies: cards.length, duplicateCopies: 0, byRarity } };
  };
  return <KqTutorialApiProvider api={api}><div data-releve-production={chapter} data-releve-native="warehouse" onClickCapture={observe} onAuxClickCapture={observe}
    onKeyDownCapture={event => { if (ticket && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTicket(null); } }}>
    {notice ? <p role="status">{notice}</p> : null}
    <KqWarehouse embedded draftStore={draftStore} onOpenCulture={() => onOpenCulture?.()} onClose={() => {}}
      onOpenHarvests={() => setNotice('Cette rencontre prépare ton installation. La conservation des récoltes se découvre dans la suite de La Relève.')}
      onOpenMarket={() => setNotice('Cette rencontre prépare ton installation. La vente se découvre dans la rencontre Commerce de La Relève.')} />
    <PackOpeningFlowModal inline ticket={ticket} onOpen={openPack} onClose={() => setTicket(null)} />
    {chapter === 'buddies' && !ticket && state.ownedBuddies.length < 3 ? <button type="button" data-releve-guide="buddie-pack" onClick={() => setTicket({ id: 'releve-buddies', userId: 'releve', ticketNumber: 'Le pack prêté par Sylvain', orderAmount: 0, status: 'available', createdAt: new Date(state.clock).toISOString() })}>Ouvrir le pack prêté par Sylvain</button> : null}
  </div></KqTutorialApiProvider>;
}
