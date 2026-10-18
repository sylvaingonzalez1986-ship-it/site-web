import { KQ_ACTIVE_CARDS, isKqCultureDead } from './kanab-quest-game';
import { getKqCardArtwork } from './kanab-quest-artwork';
import { getKqWarehouseQuote, getKqWarehouseSummary, isKqWarehouseState } from './kanab-quest-warehouse';
import { applyKqReleveProductionAction, type KqReleveProductionState } from './kanab-quest-releve-production';

export type ReleveProductionStore = { getState: () => KqReleveProductionState; setState: (state: KqReleveProductionState) => void };

export function getReleveNativeCollection(state: KqReleveProductionState) {
  return {
    ownedBuddieCodes: state.ownedBuddies,
    buddieRotation: { requiredDistinctBuddies: 5, recentBuddieCodes: state.recentBuddieCodes },
    collection: {
      ownerFound: true, collectionActive: true, cultureTokenBalance: 0,
      inventory: state.supportInventory, availableInventory: state.supportInventory,
      cards: KQ_ACTIVE_CARDS.map(card => ({ code: card.code, name: card.name, rarity: card.rarity,
        description: card.effect, imageUrl: getKqCardArtwork(card.code) ?? '', isActive: true,
        ownedCopies: state.supportInventory[card.code] ?? 0 })),
    },
  };
}

export function getReleveNativeWarehouse(state: KqReleveProductionState) {
  const summary = getKqWarehouseSummary(state.warehouse);
  const game = state.game;
  const active = !!game && game.phase !== 'complete' && !isKqCultureDead(game);
  return {
    state: state.warehouse, revision: state.revision, cashCents: state.cashCents,
    activeRun: active, activeRuns: active ? game.campaign?.members.map(member => ({
      runId: member.runId, zoneId: member.zoneId, buddieCode: member.buddieCode,
      phase: game.phase, stageIndex: game.stageIndex, startedAt: game.startedAt,
      campaignId: game.campaign?.id, leaderRunId: game.campaign?.leaderRunId,
    })) ?? [] : [],
    completedRuns: game?.phase === 'complete' ? game.campaign?.members.map(member => ({ runId: member.runId, zoneId: member.zoneId, buddieCode: member.buddieCode })) ?? [] : [],
    legacyActiveRun: false, migrationCreditCents: 0, stockGrams: 0, storageReservedGrams: 0,
    reservedHarvestGrams: active ? summary.estimatedHarvestGrams : 0,
    storageCapacityGrams: summary.storageCapacityGrams, salesGramsPerDay: 0, context: { available: true },
  };
}

/** The real warehouse contract, backed exclusively by the story's saved farm. */
export function createReleveWarehouseTransport(store: ReleveProductionStore): typeof fetch {
  return async (input, init) => {
    if (init?.signal?.aborted) throw new DOMException('Essai fermé', 'AbortError');
    const url = new URL(input instanceof Request ? input.url : String(input), 'https://releve.invalid');
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const current = store.getState();
    try {
      if (url.pathname === '/api/arena/placard/collection' && method === 'GET') return Response.json(getReleveNativeCollection(current));
      if (url.pathname === '/api/arena/placard/storage' && method === 'GET') return Response.json({ serverNow: new Date(current.clock).toISOString(), lots: [] });
      if (url.pathname === '/api/arena/placard/warehouse') {
        if (method === 'GET') return Response.json(getReleveNativeWarehouse(current));
        if (method === 'PATCH') {
          const body = JSON.parse(typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.text() : '{}');
          if (!isKqWarehouseState(body.state) || body.expectedRevision !== current.revision) return Response.json({ error: 'Ce plan a changé. Actualise avant de continuer.' }, { status: 409 });
          const quote = getKqWarehouseQuote(body.state, current.warehouse);
          if (quote.totalCostCents !== body.expectedCostCents) return Response.json({ error: 'Le devis a changé. Vérifie le montant avant de confirmer.' }, { status: 409 });
          let next = applyKqReleveProductionAction(current, { type: 'draft', warehouse: body.state });
          next = applyKqReleveProductionAction(next, { type: 'save-plan' });
          store.setState(next);
          return Response.json(getReleveNativeWarehouse(next));
        }
      }
      return Response.json({ error: 'Cette activité se découvre dans sa propre étape de La relève.' }, { status: 404 });
    } catch (reason) {
      return Response.json({ error: reason instanceof Error ? reason.message : 'Action indisponible.' }, { status: 400 });
    }
  };
}
