import { getKqCommerceCapacity, getKqCommerceStockQuality, isKqCommerceStockMature } from './kanab-quest-commerce';
import { KQ_GAME_MONTH_MS, type previewKqBusinessPayment } from './kanab-quest-business';
import { calculateKqMarketReputation, getKqRouteExpertiseBonusReputation } from './kanab-quest-market';
import { projectKqStorageLot } from './kanab-quest-storage';
import { KQ_ONLINE_MARKETING_MISSIONS, KQ_ONLINE_PACKAGING, KQ_ONLINE_SITE_TIERS, KQ_ONLINE_UPGRADES, createKqOnlinePreview, estimateKqOnlineOffer } from './kanab-quest-online';
import type { KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqCustomerDemandSnapshot, getKqCustomerDemandPeriod, KQ_CUSTOMER_DEMAND_CHANNELS, type KqAppliedCustomerDemand, type KqCustomerDemandChannel } from './kanab-quest-customer-demand';

const HOUR = 3_600_000;
type Payment = ReturnType<typeof previewKqBusinessPayment>;
type Online = ReturnType<typeof createKqOnlinePreview>;

/** Kept in the replayable local state, independently for each period and circuit. */
export function getKqOperationsCustomerDemand(state: KqOperationsLessonState) {
  const period = getKqCustomerDemandPeriod(state.trial.clock);
  const consumed = Object.fromEntries(KQ_CUSTOMER_DEMAND_CHANNELS.map(channel => [channel, state.customerDemandUsage?.[`${period}:${channel}`] ?? 0]));
  return createKqCustomerDemandSnapshot(state.trial.clock, consumed);
}

export function consumeKqOperationsCustomerDemand(state: KqOperationsLessonState, channel: KqCustomerDemandChannel, applied: KqAppliedCustomerDemand | undefined) {
  if (!applied) return;
  const request = getKqOperationsCustomerDemand(state).requests.find(request => request.channel === channel)!;
  check(applied.id === request.id && applied.period === request.period && applied.units > 0 && applied.units <= request.remainingUnits, 'La demande a changé. Recalcule l’offre.');
  const usage = state.customerDemandUsage ??= {};
  usage[request.id] = (usage[request.id] ?? 0) + applied.units;
  state.trial.commerce.customerDemand = getKqOperationsCustomerDemand(state);
}
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function positiveInteger(value: unknown, maximum: number) {
  check(typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= maximum, 'Montant ou quantité invalide.');
  return value;
}

/** The exercise owns its clock and wallet. No server or live request is used here. */
export function applyKqOperationsOnline(state: KqOperationsLessonState, command: unknown, value: unknown, callbacks: {
  spend: (cents: number) => void;
  collect: (cents: number) => Payment;
  releaseStorage: () => void;
}) {
  check(typeof command === 'string' && value && typeof value === 'object' && !Array.isArray(value), 'Opération de boutique invalide.');
  const input = value as Record<string, unknown>;
  const commerce = state.trial.commerce;
  const online = commerce.online ??= createKqOnlinePreview(state.trial.clock);
  const simulation = state.onlineSimulation ??= { packedQualities: {}, promotedFlowerIds: [], clientDay: '', clientsStart: commerce.clients, clientsGained: 0, clientsLost: 0, loyaltyProgress: 0, churnProgress: 0 };
  const now = () => new Date(state.trial.clock).toISOString();
  const listing = () => {
    const row = online.listings.find(item => item.id === input.listingId);
    check(row, 'Annonce indisponible dans cet essai.');
    return row;
  };
  if (command === 'buy-packaging') {
    const packaging = KQ_ONLINE_PACKAGING.find(item => item.code === input.code);
    check(packaging, 'Emballage inconnu.');
    check(!packaging.requiresBranding || online.upgrades.branding, 'Fais créer ton identité de marque avant cet achat.');
    const quantity = positiveInteger(input.quantity, 100_000);
    callbacks.spend(packaging.unitCostCents * quantity);
    const inventory = online.packaging.find(item => item.code === packaging.code);
    if (inventory) inventory.quantity += quantity;
    else online.packaging.push({ code: packaging.code, quantity, unitCostCents: packaging.unitCostCents });
  } else if (command === 'create-listing') {
    check(online.site.active, 'Réactive ton site avant de publier.');
    const stock = commerce.stocks.find(item => item.id === input.stockId);
    check(stock && stock.route !== 'biomass', 'Choisis un stock commercial disponible.');
    check(isKqCommerceStockMature(stock, state.trial.clock) && !stock.storage?.capacity?.overflowUnits, 'Termine le curing et stocke le surplus avant de publier.');
    const qualityScore = getKqCommerceStockQuality(stock);
    check(qualityScore >= 5.8, 'Qualité insuffisante pour la vente en ligne.');
    check(input.formatGrams === 5 || input.formatGrams === 10, 'Choisis un paquet de 5 g ou 10 g.');
    const packaging = KQ_ONLINE_PACKAGING.find(item => item.code === input.packagingCode);
    check(packaging && packaging.formatGrams === input.formatGrams, 'L’emballage ne correspond pas au format choisi.');
    check(!packaging.requiresBranding || online.upgrades.branding, 'Fais créer ton identité de marque avant de publier.');
    const packets = positiveInteger(input.packets, 100_000);
    const packetPriceCents = positiveInteger(input.packetPriceCents, 1_000_000);
    const inventory = online.packaging.find(item => item.code === packaging.code);
    check(inventory && inventory.quantity >= packets, 'Achète suffisamment d’emballages pour ces paquets.');
    check(stock.remainingUnits >= packets * input.formatGrams * 10, 'La quantité de vrac est insuffisante.');
    inventory.quantity -= packets;
    stock.remainingUnits -= packets * input.formatGrams * 10;
    online.listings.push({ id: `operations-listing-${online.listings.length + 1}`, stockId: stock.id, varietyCode: stock.varietyCode, name: stock.name, route: stock.route,
      formatGrams: input.formatGrams, packagingCode: packaging.code, packetPriceCents, initialPackets: packets, remainingPackets: packets,
      status: 'active', qualityScore, baseUnitCents: stock.baseUnitCents, createdAt: now(), soldPackets: 0 });
    simulation.packedQualities[online.listings.at(-1)!.id] = qualityScore;
    callbacks.releaseStorage();
    state.events.push('online-listing');
  } else if (command === 'update-listing') {
    const row = listing();
    check(row.remainingPackets > 0, 'Cette annonce est épuisée.');
    row.packetPriceCents = positiveInteger(input.packetPriceCents, 1_000_000);
  } else if (command === 'pause-listing' || command === 'close-listing') {
    const row = listing();
    check(row.remainingPackets > 0, 'Cette annonce est épuisée.');
    row.status = command === 'pause-listing' ? 'paused' : 'closed';
  } else if (command === 'discard-listing') {
    const row = listing();
    check(row.remainingPackets > 0 || row.status === 'discarded', 'Cette annonce est épuisée.');
    row.remainingPackets = 0;
    row.status = 'discarded';
    if (state.onlineOrderCredits) delete state.onlineOrderCredits[row.id];
  } else if (command === 'resume-listing') {
    const row = listing();
    check(row.remainingPackets > 0 && row.qualityScore >= 5.8, 'Ces paquets ne peuvent plus être proposés en ligne.');
    check(online.site.active, 'Réactive ton site avant de publier.');
    row.status = 'active';
  } else if (command === 'upgrade-site') {
    const target = KQ_ONLINE_SITE_TIERS.find(item => item.code === input.tier);
    const previous = KQ_ONLINE_SITE_TIERS.find(item => item.code === online.site.tier);
    check(target && previous, 'Formule inconnue.');
    check(target.code !== previous.code, 'Cette formule est déjà active.');
    check(online.stats.orders >= target.minimumOrders && online.confidence >= target.minimumConfidence, 'Développe encore ton commerce avant cette amélioration.');
    callbacks.spend(Math.max(0, target.acquisitionCents - previous.acquisitionCents));
    online.site.tier = target.code;
    online.site.active = true;
    online.site.paidUntil = target.monthlyCents ? new Date(state.trial.clock + KQ_GAME_MONTH_MS).toISOString() : null;
  } else if (command === 'buy-upgrade') {
    const upgrade = KQ_ONLINE_UPGRADES.find(item => item.code === input.code);
    check(upgrade, 'Amélioration inconnue.');
    check(!online.upgrades[upgrade.code], 'Cette amélioration est déjà acquise.');
    callbacks.spend(upgrade.costCents);
    online.upgrades[upgrade.code] = true;
  } else if (command === 'start-marketing') {
    const mission = KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === input.code);
    check(mission && typeof input.angle === 'string' && ['value', 'craft', 'premium'].includes(input.angle), 'Mission ou angle invalide.');
    check(!online.marketing.active, 'Une mission commerciale est déjà en cours.');
    check(mission.code !== 'introduction' || !online.marketing.completedCodes.includes(mission.code), 'Cette présentation est déjà publiée.');
    check(!online.marketing.cooldowns[mission.code] || Date.parse(online.marketing.cooldowns[mission.code]) <= state.trial.clock, 'Laisse passer un peu de temps avant cette nouvelle publication.');
    check(online.stats.orders >= mission.minimumOrders, 'Réalise quelques commandes avant de demander des avis.');
    check(online.site.active, 'Réactive ton site avant de lancer cette mission.');
    if (mission.requiresStock) {
      const stock = commerce.stocks.find(stock => stock.id === input.stockId);
      check(stock && isKqCommerceStockMature(stock, state.trial.clock), 'Choisis un stock mûr à présenter.');
      check(!simulation.promotedFlowerIds.includes(stock.flowerId), 'Cette récolte a déjà été présentée.');
      simulation.promotedFlowerIds.push(stock.flowerId);
    }
    online.marketing.active = { id: `operations-marketing-${state.events.length}`, code: mission.code,
      angle: input.angle as 'value' | 'craft' | 'premium', startedAt: now(), endsAt: new Date(state.trial.clock + mission.durationHours * HOUR).toISOString() };
    state.events.push('online-marketing');
  } else if (command === 'advance-online-time') {
    const hours = positiveInteger(input.hours, 24);
    advanceLessonOnline(state, online, hours, callbacks.collect);
  } else throw new Error('Opération de boutique inconnue dans cet essai.');
  online.serverNow = now();
  if (commerce.business) Object.assign(commerce.business.shop, { tier: online.site.tier, active: online.site.active, paidUntil: online.site.paidUntil,
    renew: online.site.renew, monthlyCents: KQ_ONLINE_SITE_TIERS.find(tier => tier.code === online.site.tier)!.monthlyCents });
  commerce.revision++;
  return { action: command, cashAfterCents: commerce.cashCents, online };
}

function advanceLessonOnline(state: KqOperationsLessonState, online: Online, hours: number, collect: (cents: number) => Payment) {
  const commerce = state.trial.commerce;
  const credits = state.onlineOrderCredits ??= {};
  const simulation = state.onlineSimulation!;
  for (let elapsed = 0; elapsed < hours; elapsed++) {
    state.trial.clock += HOUR;
    const now = new Date(state.trial.clock).toISOString();
    online.serverNow = now;
    if (simulation.clientDay !== now.slice(0, 10)) {
      simulation.clientDay = now.slice(0, 10); simulation.clientsStart = commerce.clients;
      simulation.clientsGained = 0; simulation.clientsLost = 0;
    }
    if (commerce.business) {
      commerce.business.serverNow = now;
      commerce.business.lab.overdueCents = commerce.business.lab.invoices.reduce((sum, invoice) => sum + (Date.parse(invoice.dueAt) <= state.trial.clock ? invoice.remainingCents : 0), 0);
    }
    const paidUntil = online.site.paidUntil ? Date.parse(online.site.paidUntil) : Infinity;
    if (online.site.tier !== 'basic' && state.trial.clock >= paidUntil) {
      const tier = KQ_ONLINE_SITE_TIERS.find(item => item.code === online.site.tier)!;
      if (online.site.renew && commerce.cashCents >= tier.monthlyCents) {
        commerce.cashCents -= tier.monthlyCents;
        online.site.paidUntil = new Date(paidUntil + KQ_GAME_MONTH_MS).toISOString();
      } else online.site.active = false;
    }
    const active = online.listings.filter(row => row.status === 'active' && row.remainingPackets > 0);
    for (const row of online.listings) {
      if (!row.remainingPackets) continue;
      const packaging = KQ_ONLINE_PACKAGING.find(item => item.code === row.packagingCode)!;
      // Forward-only preservation in the exercise; packaging never restores quality.
      const packedQuality = simulation.packedQualities[row.id] ??= row.qualityScore;
      row.qualityScore = Math.max(0, packedQuality - Math.floor((state.trial.clock - Date.parse(row.createdAt)) / (4 * HOUR)) * 0.01 * packaging.protectionRate);
      if (row.qualityScore < 5.8) row.status = 'quality-blocked';
      if (row.status !== 'active' || !online.site.active) continue;
      const source = commerce.stocks.find(stock => stock.id === row.stockId);
      if (!source || !isKqCommerceStockMature(source, state.trial.clock) || (source.processingReadyAt && Date.parse(source.processingReadyAt) > state.trial.clock)) continue;
      const quote = () => estimateKqOnlineOffer({ route: row.route, varietyCode: row.varietyCode, customerDemand: getKqOperationsCustomerDemand(state), quality: row.qualityScore, baseUnitCents: row.baseUnitCents, formatGrams: row.formatGrams,
        packagingCode: row.packagingCode, packetPriceCents: row.packetPriceCents, reputation: commerce.reputation,
        clients: commerce.clients, online, activeListingCount: active.length });
      const offer = quote();
      online.stats.visitors += offer.visitorsPerDay / 24 / Math.max(1, active.length);
      credits[row.id] = (credits[row.id] ?? 0) + offer.ordersPerDay / 24;
      const packets = Math.min(row.remainingPackets, Math.floor(credits[row.id] + 1e-9));
      if (!packets) continue;
      let soldPackets = 0;
      for (let packet = 0; packet < packets; packet++) {
        // Earlier packets or another listing may have used the final allowance.
        const offer = quote();
        if (offer.ordersPerDay <= 0) break;
        const feesCents = Math.round(row.packetPriceCents * 0.025);
        const payment = collect(row.packetPriceCents);
        consumeKqOperationsCustomerDemand(state, 'online', offer.customerDemand);
        soldPackets++;
        commerce.cashCents -= feesCents;
        const netPayoutCents = payment.netPayoutCents - feesCents;
        online.stats.orders++;
        online.stats.revenueCents += row.packetPriceCents;
        online.stats.netRevenueCents += netPayoutCents;
        online.stats.feesCents += feesCents;
        online.stats.packagingCostCents += packaging.unitCostCents;
        online.stats.soldGrams += row.formatGrams;
        online.confidence = Math.max(0, Math.min(100, online.confidence + Math.max(-2, Math.min(1, (offer.satisfaction - 70) / 40)) * row.formatGrams / 10));
        if (offer.satisfaction >= 75) {
          simulation.loyaltyProgress += row.formatGrams / 50;
          const gained = Math.min(5 - simulation.clientsGained, Math.floor(simulation.loyaltyProgress + 1e-9));
          commerce.clients = Math.min(getKqCommerceCapacity(commerce.reputation).maxClients, commerce.clients + gained);
          simulation.clientsGained += gained; simulation.loyaltyProgress = Math.min(1, simulation.loyaltyProgress - gained);
        } else if (offer.satisfaction < 60) {
          simulation.churnProgress += row.formatGrams / 10 * (60 - offer.satisfaction) / 20;
          const lost = Math.min(Math.max(0, Math.ceil(simulation.clientsStart * .25) - simulation.clientsLost), Math.floor(simulation.churnProgress + 1e-9));
          commerce.clients = Math.max(0, commerce.clients - lost);
          simulation.clientsLost += lost; simulation.churnProgress -= lost;
        }
        const equivalentSold = row.formatGrams * 10 * source.equivalentUnits / source.initialUnits;
        let baseReputation = calculateKqMarketReputation(row.route, row.qualityScore);
        if (offer.satisfaction < 60) baseReputation = Math.min(-1, baseReputation);
        source.repExact += baseReputation * equivalentSold / source.originalUnits;
        const roundedReputation = Math.sign(source.repExact) * Math.floor(Math.abs(source.repExact) + .5);
        commerce.reputation = Math.max(0, commerce.reputation + roundedReputation - source.repRounded);
        source.repRounded = roundedReputation;
        if (offer.satisfaction >= 75 && source.route === source.batchRoute) {
          source.professionalUnits += equivalentSold;
          if (!source.counted && source.professionalUnits >= source.originalUnits / 2) {
            source.counted = true;
            commerce.routeSales[source.route] = (commerce.routeSales[source.route] ?? 0) + 1;
            commerce.reputation += getKqRouteExpertiseBonusReputation(source.route, commerce.routeSales[source.route]!);
          }
        }
        online.recentSales.unshift({ id: `operations-online-sale-${online.stats.orders}`, listingId: row.id, name: row.name,
          soldAt: now, packets: 1, formatGrams: row.formatGrams, packetPriceCents: row.packetPriceCents, payoutCents: row.packetPriceCents,
          netPayoutCents, feesCents, packagingCostCents: packaging.unitCostCents, satisfaction: offer.satisfaction });
        state.events.push('sell');
      }
      credits[row.id] -= soldPackets;
      row.remainingPackets -= soldPackets; row.soldPackets += soldPackets;
      if (!row.remainingPackets) row.status = 'sold-out';
    }
    const mission = online.marketing.active;
    if (mission && Date.parse(mission.endsAt) <= state.trial.clock) {
      const definition = KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === mission.code)!;
      online.followers += definition.followersReward;
      if (!online.marketing.completedCodes.includes(mission.code)) online.marketing.completedCodes.push(mission.code);
      online.marketing.cooldowns[mission.code] = new Date(Date.parse(mission.startedAt) + definition.cooldownHours * HOUR).toISOString();
      online.marketing.active = null;
    }
    online.settledUntil = now;
  }
  online.recentSales = online.recentSales.slice(0, 20);
  const storage = projectKqStorageLot(state.storage.lot, state.trial.clock);
  commerce.stocks.forEach(stock => { stock.storage = storage; });
  commerce.customerDemand = getKqOperationsCustomerDemand(state);
  state.events.push('online-time');
}
