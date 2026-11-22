import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/app/globals.css';
import { ArenaCustomerRewardPot } from '/src/components/contest/ArenaCustomerRewards';
import { ArenaPrizeDeliveryForm } from '/src/components/contest/ArenaPrizeDeliveryForm';
import { ARENA_CUSTOMER_PRIZE_FORMULA } from '/src/lib/arena-customer-rewards';

const key = 'arena-prize-delivery-fixture';
const delivery = { id: '00000000-0000-4000-8000-000000000001', seasonCode: 'SAISON-TEST', kind: 'ranking', grams: 27, orderId: sessionStorage.getItem(key) };
const calls = window.prizeDeliveryCalls = [];
window.fetch = async (input, init) => {
  const url = new URL(input, location.href);
  const method = init?.method ?? 'GET';
  calls.push({ path: url.pathname, method });
  if (url.pathname !== '/api/arena/rewards/delivery' || method !== 'POST') throw new Error('Appel inattendu');
  const body = JSON.parse(init.body);
  if (body.grantId !== delivery.id || body.postalCode !== '29200') return Response.json({ error: 'Données incorrectes' }, { status: 422 });
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    sessionStorage.setItem(key, 'LOT-AR-TEST-1');
    throw new TypeError('Réponse de confirmation interrompue');
  }
  return Response.json({ orderId: stored, grams: 27, totalCents: 0 });
};

const pool = { seasonCode: delivery.seasonCode, formulaVersion: ARENA_CUSTOMER_PRIZE_FORMULA, status: 'settled',
  rankingFormulaVersion: 'arena-v3-tasting-first', poolGrams: 100, baseGrams: 100, carryInGrams: 0, reportGrams: 73,
  wholePoolGrams: 100, currentWeekGrams: 0, minimumHumanBattles: 3,
  topRewards: [{ leaderboardRank: 1, rewardRank: 1, pseudo: 'Camille', shareBps: 2700, estimatedGrams: 27 }],
  viewer: { rank: 1, battles: 3, estimatedGrams: 27, grant: { grams: 27, kind: 'ranking' } },
  weeklyDice: { rateBps: 100, rollCount: 0, eligibleFlowerGrams: 0 },
  milestone: { nextGrams: 250 }, surpriseReward: { estimatedGrams: 10, eligiblePlayers: 0 } };

createRoot(document.getElementById('root')).render(location.pathname === '/arene/lots'
  ? <main className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-8"><h1>Mes lots de l’Arène</h1><p>27 g de fleurs</p><ArenaPrizeDeliveryForm delivery={delivery} /></main>
  : <ArenaCustomerRewardPot rankingId="classement" rewardPool={pool} onRewardPoolChange={() => {}} loading={false} unavailable={false} viewerPseudo="Camille" />);
