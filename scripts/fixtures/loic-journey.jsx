import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/app/globals.css';
import { PlacardPlayerShell } from '/src/components/placard/PlacardPlayerShell';
import { QuarterCharacterGate } from '/src/components/contest/QuarterCharacterGate';
import { createKqWarehouseEmpty, getKqWarehouseQuote } from '/src/lib/kanab-quest-warehouse';
import { proposeFirstWarehousePlan } from '/src/lib/kanab-quest-warehouse-first-plan';
import { sylvainStorageKey } from '/src/lib/kanab-quest-sylvain-guide';
import { KQ_STARTING_CASH_CENTS } from '/src/lib/kanab-quest-equipment';
import { createReleveCultureTransport } from '/src/lib/kanab-quest-releve-culture';
import { createKqReleveProduction } from '/src/lib/kanab-quest-releve-production';
import { createKqStaffState, projectKqStaffSnapshot } from '/src/lib/kanab-quest-staff';
import { getKqWarehouseInputPack, KQ_WAREHOUSE_PREPARATION_CATALOG } from '/src/lib/kanab-quest-warehouse-preparations';

import { previewPreparations } from '/scripts/fixtures/warehouse-preparations-preview.mjs';
import { getKqBusinessClock, KQ_GAME_DAY_MS } from '/src/lib/kanab-quest-business';
import { KQ_PLAYER_DAILY_HOURS } from '/src/lib/kanab-quest-player-work';
import { getKqWarehouseStationEntrance } from '/src/lib/kanab-quest-warehouse-stations';
import { KQ_ACTIVE_CARDS } from '/src/lib/kanab-quest-game';
import { getKqBuddieCultivationProfile } from '/src/lib/kanab-quest-buddie-cultivation';
import { installPlacardCardShopFixture } from '/scripts/fixtures/placard-card-shop.mjs';

const key = 'loic-local-fixture';
const empty = createKqWarehouseEmpty();
const startedAt = new Date().toISOString();
const params = new URLSearchParams(location.search);
const welcome = params.has('welcome');
const avatar = params.has('avatar');
const zoneChoice = params.has('zone-choice');
const starter = zoneChoice ? getKqWarehouseQuote(proposeFirstWarehousePlan(empty), empty) : null;
if (zoneChoice && !localStorage.getItem(sylvainStorageKey(key))) {
  localStorage.setItem(sylvainStorageKey(key), JSON.stringify({ mode: 'active', completed: ['warehouse', 'install'], skipped: [] }));
}
let character = JSON.parse(sessionStorage.getItem('loic-character'));
let farm = JSON.parse(sessionStorage.getItem(key)) ?? {
  ...createKqReleveProduction(), clock: Date.now(), warehouse: starter?.nextState ?? empty, draftWarehouse: starter?.nextState ?? empty, revision: starter ? 1 : 0,
  ownedBuddies: welcome ? [] : ['HH2026-020','HH2026-021','HH2026-022'], recentBuddieCodes: [],
  supportInventory: {}, deckCodes: [], heritageCode: null, cashCents: KQ_STARTING_CASH_CENTS - (starter?.totalCostCents ?? 0),
};
const request = createReleveCultureTransport({
  getState: () => farm,
  setState: next => { farm = next; sessionStorage.setItem(key, JSON.stringify(next)); },
});
const api = { calls: [], rejectNextSave: false, read: () => structuredClone(farm) };
window.loicFixture = api;
const original = window.fetch.bind(window);
if (welcome) installPlacardCardShopFixture(KQ_ACTIVE_CARDS, getKqBuddieCultivationProfile);
const shop = welcome ? window.fetch.bind(window) : null;
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) return original(input, init);
  const path = url.pathname, method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  api.calls.push({ path, method, body });
  const json = body => Response.json(body);
  if (shop && (['/api/account/tickets', '/api/account/welcome-pack', '/api/account/collection', '/api/arena/placard/boosters'].includes(path)
    || path.startsWith('/api/account/tickets/'))) {
    const response = await shop(input, init);
    if (response.ok && method === 'POST' && path.endsWith('/scratch')) {
      const inventory = window.__fixture.buddieCounts;
      farm = { ...farm, ownedBuddies: Object.keys(inventory).filter(code => inventory[code] > 0) };
      sessionStorage.setItem(key, JSON.stringify(farm));
    }
    return response;
  }
  if (path.endsWith('/warehouse') && method === 'PATCH') {
    if (api.rejectNextSave) {
      api.rejectNextSave = false;
      return Response.json({ error: 'Installation refusée. Vérifie le devis puis réessaie.' }, { status: 400 });
    }
    const response = await request(input, init), snapshot = await response.json();
    if (!response.ok) return Response.json(snapshot, {status: response.status});
    return json({...snapshot, receipt: { requestKey: body.requestKey, revision: snapshot.revision,
      chargedCents: body.expectedCostCents, investmentCents: body.expectedCostCents, creditUsedCents: 0, replayed: false }});
  }
  if (path.endsWith('/equipment')) return json({ cashCents: farm.cashCents, activeRun: !!farm.game, readyLotCount: 0,
    availableFlowerCount: 0, curingFlowerCount: 0, ownedCodes: [], routePlan: null, strength: null,
    businessClock: { startedAt, serverNow: new Date().toISOString() } });
  if (path.endsWith('/preparations')) {
    const seedTools = new URLSearchParams(location.search).has('cleaning');
    const extras = JSON.parse(sessionStorage.getItem('loic-preparations')) ?? {
      previewCalendarOrigin: startedAt, previewInputInventory: seedTools ? {'WAREHOUSE-VACUUM':1, 'WAREHOUSE-MOP':1} : {},
    };
    const clockOffsetMs = Number(sessionStorage.getItem('loic-clock-offset') ?? 0);
    const result = previewPreparations({...extras, cashCents:farm.cashCents, state:farm.warehouse}, init, {
      catalog:KQ_WAREHOUSE_PREPARATION_CATALOG, packFor:getKqWarehouseInputPack, gameClock:getKqBusinessClock,
      dayMs:KQ_GAME_DAY_MS, dailyHours:KQ_PLAYER_DAILY_HOURS, entrance:getKqWarehouseStationEntrance(farm.warehouse.floor),
      now: Date.now() + clockOffsetMs, save: ({ cashCents, ...saved }) => {
        delete saved.state;
        farm.cashCents = cashCents;
        sessionStorage.setItem(key, JSON.stringify(farm));
        sessionStorage.setItem('loic-preparations', JSON.stringify(saved));
      },
    });
    return Response.json({...await result.json(), quoteKey:'a'.repeat(64)}, {status:result.status});
  }
  if (path.endsWith('/staff')) return json(projectKqStaffSnapshot({ state:createKqStaffState(startedAt), revision:0,
    serverNow:new Date().toISOString(), cashCents:farm.cashCents, context:{businessStartedAt:startedAt,
      reputation:0,instagramFollowers:0,shopPartners:0,activeRuns:[],processingBatches:[],supplierInvoices:[],trimLots:[]} }));
  if (path.endsWith('/tutorial')) return json({ userId:key, chanvrier:character });
  if (path === '/api/arena/chanvrier' && method === 'POST' && avatar) {
    character = body;
    sessionStorage.setItem('loic-character', JSON.stringify(character));
    return json({ profile:character, created:true });
  }
  if (path.endsWith('/social/player')) return json({ firstName:'Camille', profile:character });
  if (path.endsWith('/missions')) return json({collectionActive:true, missions:[]});
  return request(input, init);
};
const village = <PlacardPlayerShell draftOwnerId={key}/>;
createRoot(document.getElementById('root')).render(avatar ? <QuarterCharacterGate ownerId={key}>{village}</QuarterCharacterGate> : village);
