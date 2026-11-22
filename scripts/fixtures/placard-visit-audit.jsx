import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/app/globals.css';
import retro from '/src/components/contest/ArenaRetro.module.css';
import { KqPlacardLobby } from '/src/components/placard/KqPlacardLobby';
import { KqTutorialApiProvider, createKqTutorialApi } from '/src/components/placard/KqTutorialApiContext';
import { createKqStorageLot, projectKqStorageLot } from '/src/lib/kanab-quest-storage';

const query = new URLSearchParams(location.search);
const owner = query.get('owner');
const day = Number(query.get('day'));
const dayMs = 24 * 60 * 60 * 1000;
const start = Date.parse('2026-11-10T10:00:00.000Z');
const now = start + day * dayMs;
const serverNow = new Date(now).toISOString();
const due = start + 5 * dayMs;
const capacity = { totalUnits: 500, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: 500 }], overflowDeadlineAt: null };
const care = { terpenes: 80, cannabinoidExpression: 80, cannabinoidConversion: 0, cannabinoidOxidation: 0 };
const varietyCode = 'HH2026-001';
const harvestedAt = new Date(start).toISOString();
const juryLot = createKqStorageLot({ flowerId: 'curing-lot', harvestedAt, preJury: true, capacity,
  baseline: { varietyCode, juryScore: 7, aroma: 80, care } });
const marketLot = createKqStorageLot({ flowerId: 'listed-lot', harvestedAt, capacity,
  baseline: { varietyCode, juryScore: 5.84, aroma: 80, care } });
const projection = projectKqStorageLot(juryLot, now);
const sale = projectKqStorageLot(marketLot, now);

// A €22 supplier invoice is due after 120 hours. The fixture provides the
// server snapshot after the due event takes the remaining €20 from the wallet.
const paidCents = now >= due ? 2000 : 0;
const remainingCents = 2200 - paidCents;
const supplier = { id: 'invoice-due', remainingCents, dueAt: new Date(due).toISOString() };
const listing = { id: 'listing-lot-retour', name: 'Lot du retour', remainingPackets: 3,
  status: sale.conditionScore < 5.8 ? 'quality-blocked' : 'active', qualityScore: sale.conditionScore };
const storage = { serverNow, lots: [{ flowerId: juryLot.flowerId, flowerStatus: 'available', projection },
  { flowerId: marketLot.flowerId, flowerStatus: 'burned', projection: sale }] };
const equipment = { activeRun: true, readyLotCount: 0, availableFlowerCount: projection.stage === 'ready' ? 1 : 0,
  curingFlowerCount: projection.stage === 'curing' ? 1 : 0, trimFlowerCount: 0, ownedCodes: [], cashCents: 2000 - paidCents };
const commerce = { business: { serverNow, lab: { outstandingCents: 0, overdueCents: 0, invoices: [] }, suppliers: {
  outstandingCents: remainingCents, overdueCents: now >= due ? remainingCents : 0, invoices: [supplier],
} }, online: { version: 1, serverNow, site: { createdAt: harvestedAt, active: true }, listings: [listing] } };

window.requests = [];
window.navigation = [];
window.visitEvidence = { serverNow, protectedLot: { stage: projection.stage, readyAt: projection.readyAt }, supplier,
  paidCents, cashCents: equipment.cashCents, listing };

const responses = { equipment, storage, commerce };
const api = { ...createKqTutorialApi(async (input, init = {}) => {
  const path = new URL(String(input), location.origin).pathname;
  const method = init.method ?? 'GET';
  window.requests.push({ path, method });
  const payload = responses[path.split('/').at(-1)];
  if (method !== 'GET' || !payload) throw new Error(`Unexpected request ${method} ${path}`);
  return Response.json(payload);
}), isTutorial: false };

createRoot(document.getElementById('root')).render(<div className={retro.surface}>
  <KqTutorialApiProvider api={api}>
    <KqPlacardLobby visitOwnerId={owner} onOpen={(view, options) => window.navigation.push({ view, options })} />
  </KqTutorialApiProvider>
</div>);
