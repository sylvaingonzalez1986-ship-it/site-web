export function previewPreparations(snapshot, init, { catalog, packFor, gameClock, dayMs, dailyHours, entrance, save, now = Date.now() }) {
  const iso = ms => new Date(ms).toISOString();
  const calendarOrigin = snapshot.previewCalendarOrigin ?? iso(now);
  const stock = snapshot.previewInputInventory ?? {};
  const receipts = snapshot.previewPackReceipts ?? {};
  const cleaning = {};
  for (const step of ['vacuum', 'mop']) {
    const record = snapshot.previewCleaning?.[step] ?? { completedAt: null, expiresAt: null, pending: null };
    if (record.pending && Date.parse(record.pending.endsAt) <= now) {
      cleaning[step] = { completedAt: record.pending.endsAt, expiresAt: iso(Date.parse(record.pending.endsAt) + 7 * dayMs), pending: null };
    } else cleaning[step] = record;
  }
  const result = () => {
    const inventory = snapshot.previewInputInventory ?? {};
    const items = Object.entries(catalog).map(([code, item]) => {
      const pack = packFor(code);
      return { ...item, code, ...(pack && { packPriceCents: pack.packPriceCents, chargesPerPack: pack.chargesPerPack }),
        availableQuantity: inventory[code] ?? 0, reservedQuantity: 0 };
    });
    const entranceAirlock = snapshot.state.stationPlacements?.some(s => s.code === 'SIM-HYGIENE-03' && s.x === entrance.x && s.y === entrance.y) ?? false;
    return Response.json({ cashCents: snapshot.cashCents, items, runs: [], coverage: [], programs: [], entranceAirlock, cleaning, calendarOrigin, serverNow: iso(now) });
  };
  if (!init.method || init.method === 'GET') return result();
  const reject = (error, status = 409) => Response.json({ error }, { status });
  if (init.method !== 'POST') return reject('Méthode invalide.', 405);
  const order = JSON.parse(init.body);
  if (!order || typeof order.requestKey !== 'string') return reject('Commande invalide.', 400);
  let signature;
  if (order.action === 'clean') {
    if (!['vacuum', 'mop'].includes(order.step) || !['auto', 'player'].includes(order.workChoice)) {
      return reject('Aucun salarié disponible dans cette partie locale.', 400);
    }
    signature = JSON.stringify(['clean', order.step, order.workChoice]);
  } else {
    if (!Number.isSafeInteger(order.quantity) || order.quantity < 1 || order.quantity > 100) return reject('Quantité invalide.', 400);
    const pack = packFor(order.code);
    const item = catalog[order.code];
    const tool = item?.kind === 'equipment' && order.action === 'purchase' && order.quantity === 1;
    if (!tool && !(pack && order.action === 'purchasePack')) return reject('Achat invalide.', 400);
    const total = (tool ? item.priceCents : pack.packPriceCents) * order.quantity;
    if (order.expectedCents !== total) return reject('Le prix a changé.');
    // Keep the signature of pack orders already stored in browser sessions.
    signature = JSON.stringify([order.code, order.quantity, total]);
  }
  if (Object.hasOwn(receipts, order.requestKey)) {
    return receipts[order.requestKey] === signature ? result() : reject('Cette commande a déjà été utilisée.');
  }
  let update;
  if (order.action === 'clean') {
    const vacuum = order.step === 'vacuum';
    if (stock[vacuum ? 'WAREHOUSE-VACUUM' : 'WAREHOUSE-MOP'] !== 1) return reject('Achète d’abord l’outil nécessaire.');
    if (cleaning.vacuum.pending || cleaning.mop.pending) return reject('Un nettoyage est déjà en cours.');
    const hours = vacuum ? 0.5 : 1;
    const finish = now + hours * dayMs / 24;
    if (!vacuum && !(Date.parse(cleaning.vacuum.expiresAt) >= finish)) return reject('Termine une aspiration valide jusqu’à la fin du lavage.');
    const clock = gameClock(calendarOrigin, now);
    const usedHours = snapshot.previewCleaningWorkday?.day === clock.day ? snapshot.previewCleaningWorkday.usedHours : 0;
    if (finish > Date.parse(clock.nextDayAt) || usedHours + hours > dailyHours) return reject('Ton temps de travail disponible est insuffisant pour ce passage.');
    // This isolated workshop has no staff account. Auto therefore books the player.
    cleaning[order.step] = { ...cleaning[order.step], pending: { workChoice: 'player', startsAt: iso(now), endsAt: iso(finish) } };
    update = { previewCleaning: cleaning, previewCleaningWorkday: { day: clock.day, usedHours: usedHours + hours } };
  } else {
    if (order.action === 'purchase' && stock[order.code] > 0) return reject('Cet outil est déjà en réserve.');
    if (order.expectedCents > snapshot.cashCents) return reject('Trésorerie insuffisante.');
    const units = (packFor(order.code)?.chargesPerPack ?? 1) * order.quantity;
    update = { cashCents: snapshot.cashCents - order.expectedCents, previewInputInventory: { ...stock, [order.code]: (stock[order.code] ?? 0) + units } };
  }
  snapshot = { ...snapshot, ...update, previewCalendarOrigin: calendarOrigin, previewPackReceipts: { ...receipts, [order.requestKey]: signature } };
  save(snapshot);
  return result();
}
