/** Browser-only local store. All purchases mutate this fixture, never a real account. */
export function installPlacardCardShopFixture(supportCards, cultivationProfile) {
  const params = new URLSearchParams(location.search);
  const date = '2026-10-13T12:00:00.000Z';
  const rarities = ['common', 'silver', 'gold', 'epic', 'legendary'];
  const names = { 1: 'L’Arbre Mère', 4: 'Harlequin', 5: 'ACDC', 11: 'Cherry Wine', 20: 'Strawberry CBD' };
  const definitions = Array.from({ length: 52 }, (_, index) => {
    const number = index + 1, code = 'HH2026-' + String(number).padStart(3, '0');
    return { id: 'buddie-' + number, code, cardNumber: number, name: names[number] || 'Buddie ' + number,
      rarity: cultivationProfile(code).rarity, imageUrl: '/app/kanab-quest/buddies/' + code.toLowerCase() + '-scene-v2.webp',
      description: 'Carte de démonstration locale.', visualPrompt: '', collectionId: 'buddies', collectionCode: 'HEMP_HEROES_2026',
      collectionTitle: 'Buddies', isActive: true, createdAt: date, updatedAt: date };
  });
  const counts = params.has('empty') ? {} : params.has('complete') ? Object.fromEntries(supportCards.map(card => [card.code, 1])) : { 'BOTTE-003': 2, 'BOTTE-006': 1, 'BOTTE-013': 3 };
  const fixture = window.__fixture = {
    points: params.has('poor') ? 0 : 1147, supportCounts: counts,
    buddieCounts: params.has('empty') ? {} : params.has('complete') ? Object.fromEntries(definitions.map(card => [card.code, 1])) : { 'HH2026-020': 2, 'HH2026-011': 1, 'HH2026-005': 1 },
    entitlements: params.has('empty') ? [] : [{ id: 'duel', source: 'pvp_win', cardCount: 10, createdAt: date }, { id: 'mission', source: 'mission_reward', cardCount: 10, createdAt: date }],
    tickets: [], supportPurchases: {}, supportOpens: {}, buddieOpens: {}, requests: [],
    failAfterCommit: null, failBeforeCommit: null, failCollection: params.has('fail'), failTickets: false,
    welcomeClaimed: !params.has('welcome'), supportWelcomeClaimed: true, purchaseCommits: { support: 0, buddies: 0 },
  };
  if (params.has('persist')) {
    const saved = sessionStorage.getItem('audit:card-shop-state');
    if (saved) Object.assign(fixture, JSON.parse(saved));
  }
  window.__counts = counts;
  window.__requests = fixture.requests;
  window.__calls = fixture.requests;
  const ownedCard = card => ({ ...card, ownedCount: fixture.buddieCounts[card.code] || 0, isOwned: !!fixture.buddieCounts[card.code], isDuplicate: fixture.buddieCounts[card.code] > 1 });
  const album = () => {
    const pages = rarities.map((rarity, pageIndex) => {
      const slots = definitions.filter(card => card.rarity === rarity).map((card, index) => ({ ...ownedCard(card), cardDefinitionId: card.id, slotIndex: index + 1,
        burnableCount: Math.max(0, (fixture.buddieCounts[card.code] || 0) - 1), burnableInstanceIds: [] }));
      const ownedUnique = slots.filter(slot => slot.isOwned).length;
      return { rarity, pageNumber: pageIndex + 1, label: rarity, title: rarity, totalSlots: slots.length, ownedUnique, missingCount: slots.length - ownedUnique,
        duplicateCopies: slots.reduce((sum, slot) => sum + slot.burnableCount, 0), completionPercent: 100 * ownedUnique / slots.length,
        isComplete: ownedUnique === slots.length, rewardStatus: 'locked', rewardOptions: [], burnOffer: null, slots, duplicateGroups: [] };
    });
    const ownedUnique = Object.values(fixture.buddieCounts).filter(Boolean).length;
    const copies = Object.values(fixture.buddieCounts).reduce((sum, count) => sum + count, 0);
    return { collectionId: 'buddies', collectionCode: 'HEMP_HEROES_2026', collectionTitle: 'Buddies', isActive: !params.has('closed'), pageOrder: rarities, pages, availableClaims: [], generatedAt: date,
      summary: { totalCards: 52, ownedUnique, totalOwnedCopies: copies, duplicateCopies: copies - ownedUnique, completionPercent: ownedUnique / 52 * 100, completedPages: 0, claimablePages: 0, availableClaims: 0 } };
  };
  const inventory = () => ({ collection: null, cards: definitions.map(ownedCard), totalCards: 52, uniqueOwned: album().summary.ownedUnique,
    totalOwnedCopies: album().summary.totalOwnedCopies, duplicateCopies: album().summary.duplicateCopies, completionPercent: album().summary.completionPercent,
    byRarity: [], availableClaims: [], earnedLines: [], recentLines: [], frozenLines: [] });
  const ticket = id => ({ id, userId: 'local-audit', ticketNumber: 'PACK ' + id, orderAmount: 0, status: 'available', createdAt: date });
  if (!params.has('empty') && !fixture.tickets.length) fixture.tickets.push(ticket('initial-buddie'));
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const failure = () => json({ error: 'Réponse interrompue. Vérifie ton achat.' }, 503);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href), path = url.pathname;
    if (!path.startsWith('/api/')) return nativeFetch(input, init);
    const method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : {};
    fixture.requests.push({ url: path, method, body });
    if (method !== 'GET') await new Promise(resolve => setTimeout(resolve, 100));
    if (fixture.failBeforeCommit === path) { fixture.failBeforeCommit = null; return failure(); }
    let result;
    if (path === '/api/arena/placard/collection' || path === '/api/arena/placard/bootstrap') {
      if (fixture.failCollection) return json({ error: 'Collection temporairement indisponible.' }, 503);
      result = { collection: { cards: Object.entries(fixture.supportCounts).map(([code, ownedCopies]) => ({ code, ownedCopies })) } };
    } else if (path === '/api/account/collection') {
      if (fixture.failCollection) return json({ error: 'Collection temporairement indisponible.' }, 503);
      result = album();
    } else if (path === '/api/arena/placard/boosters') {
      if (method === 'GET') result = { collectionActive: !params.has('closed'), costPerPack: 5, spendablePoints: fixture.points, welcomeClaimed: fixture.supportWelcomeClaimed, availableEntitlements: fixture.entitlements };
      else if (method === 'POST') {
        if (!body.requestKey) return json({ error: 'Clé requise.' }, 400);
        if (!fixture.supportPurchases[body.requestKey]) {
          if (fixture.points < 5) return json({ error: 'Points insuffisants.' }, 400);
          fixture.points -= 5; fixture.purchaseCommits.support++;
          fixture.entitlements.push({ id: 'support-purchase-' + fixture.purchaseCommits.support, source: 'points_purchase', cardCount: 10, createdAt: date });
          fixture.supportPurchases[body.requestKey] = { granted: 1 };
        }
        result = fixture.supportPurchases[body.requestKey];
      } else if (method === 'PATCH') {
        if (!fixture.supportOpens[body.entitlementId]) {
          const entitlement = fixture.entitlements.find(item => item.id === body.entitlementId);
          if (!entitlement) return json({ error: 'Pack inconnu.' }, 400);
          fixture.entitlements = fixture.entitlements.filter(item => item.id !== body.entitlementId);
          const choices = supportCards.filter(card => ['BOTTE-013', 'BOTTE-020', 'BOTTE-005'].includes(card.code));
          const cards = Array.from({ length: 10 }, (_, index) => choices[index % choices.length]);
          cards.forEach(card => { fixture.supportCounts[card.code] = (fixture.supportCounts[card.code] || 0) + 1; });
          fixture.supportOpens[body.entitlementId] = { cards };
        }
        result = fixture.supportOpens[body.entitlementId];
      } else if (method === 'PUT') { fixture.supportWelcomeClaimed = true; result = { granted: true }; }
    } else if (path === '/api/account/tickets') {
      if (method === 'GET') {
        if (fixture.failTickets) return failure();
        result = { tickets: fixture.tickets, inventory: inventory(), config: { isActive: !params.has('closed'), collectionTitle: 'Buddies' }, bonuses: [], loyalty: { spendablePoints: fixture.points, points: fixture.points } };
      } else if (method === 'POST') {
        if (fixture.points < 100 * body.packCount) return json({ error: 'Points insuffisants.' }, 400);
        const commit = () => {
          fixture.points -= 100 * body.packCount; fixture.purchaseCommits.buddies += body.packCount;
          for (let index = 0; index < body.packCount; index++) fixture.tickets.push(ticket('purchase-' + fixture.purchaseCommits.buddies + '-' + index));
        };
        if (fixture.deferNextBuddiePurchase) {
          fixture.deferNextBuddiePurchase = false;
          fixture.completeLateBuddiePurchase = commit;
          return failure();
        }
        commit();
        result = { granted: body.packCount };
      }
    } else if (path.endsWith('/scratch') && path.startsWith('/api/account/tickets/')) {
      const id = decodeURIComponent(path.split('/').at(-2));
      if (!fixture.buddieOpens[id]) {
        const existing = fixture.tickets.find(item => item.id === id);
        if (!existing) return json({ error: 'Pack inconnu.' }, 404);
        const drawn = definitions.filter(card => ['HH2026-001', 'HH2026-004', 'HH2026-020'].includes(card.code));
        drawn.forEach(card => { fixture.buddieCounts[card.code] = (fixture.buddieCounts[card.code] || 0) + 1; });
        existing.status = 'scratched';
        const cards = drawn.map(ownedCard);
        Object.assign(existing, { cards, card: cards[0], cardDefinitionId: cards[0].id, scratchedAt: date });
        fixture.buddieOpens[id] = { ticketId: id, ticketNumber: existing.ticketNumber, scratchedAt: date, card: cards[0], cards, inventory: inventory(), bonusPrize: null };
      }
      result = fixture.buddieOpens[id];
    } else if (path === '/api/account/welcome-pack') {
      if (method === 'GET') result = { eligible: !fixture.welcomeClaimed };
      else { const granted = !fixture.welcomeClaimed; fixture.welcomeClaimed = true; if (granted) fixture.tickets.push(ticket('welcome')); result = { granted }; }
    } else return json({ error: 'API non simulée : ' + path }, 404);
    const interrupted = fixture.failAfterCommit === path;
    if (interrupted) fixture.failAfterCommit = null;
    if (params.has('persist')) sessionStorage.setItem('audit:card-shop-state', JSON.stringify(fixture));
    if (interrupted) return failure();
    return json(result || {});
  };
}
