import type { ReleveGuideStep } from './arena-releve-guide';
import { KQ_GAME_MONTH_MS } from './kanab-quest-business';
import { KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS } from './kanab-quest-merch';
import { createKqOnlinePreview, KQ_ONLINE_SITE_TIERS } from './kanab-quest-online';
import type { KqReleveCommerceState } from './kanab-quest-releve-commerce';

const paper = KQ_MERCH_MODULES.find(item => item.code === 'paper')!;
const stickers = KQ_MERCH_PRODUCTS.find(item => item.code === 'stickers')!;
const site = KQ_ONLINE_SITE_TIERS.find(item => item.level === paper.minimumLevel)!;
const mark = (state: KqReleveCommerceState, milestone: string) => {
  if (!state.milestones.includes(milestone)) state.milestones.push(milestone);
};

/** An explicitly borrowed eligibility dossier, never a grant or a player's sales history. */
export function prepareReleveCommerceMerch(input: KqReleveCommerceState): KqReleveCommerceState {
  const state = structuredClone(input);
  const { commerce, clock } = state.operations.trial;
  const now = new Date(clock).toISOString();
  const paidUntil = new Date(clock + KQ_GAME_MONTH_MS).toISOString();
  const online = createKqOnlinePreview(clock);
  commerce.computerOwned = true;
  Object.assign(commerce.business!.shop, {
    name: 'La collection de Sylvain · essai', createdAt: now, active: true,
    tier: site.code, monthlyCents: site.monthlyCents, paidUntil, renew: false,
  });
  Object.assign(online.site, { tier: site.code, createdAt: now, active: true, paidUntil, renew: false });
  online.upgrades.branding = true;
  if (online.studio) online.studio.levels.branding = 1;
  // The visible loan notice identifies these sample prerequisites. No receipts,
  // visitors, revenue or merch sales are fabricated from the starting count.
  online.stats.orders = paper.minimumOrders;
  online.confidence = Math.max(online.confidence, paper.minimumConfidence);
  commerce.online = online;
  mark(state, 'merch-dossier');
  mark(state, 'site-opened');
  return state;
}

/** Called only after the existing local commerce command has been validated. */
export function recordReleveMerchAction(state: KqReleveCommerceState, command: unknown, payload: unknown) {
  if (!state.milestones.includes('merch-dossier')) return;
  const row = state.operations.trial.commerce.online?.merch?.inventory.find(item => item.code === stickers.code);
  const values = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  if (command === 'update-merch' && values.code === stickers.code && values.active === true && row?.active && row.quantity > 0) {
    mark(state, 'merch-published');
  }
  if (command === 'advance-online-time' && state.milestones.includes('merch-published')) mark(state, 'merch-time');
}

export function canReadReleveMerchReport(state: KqReleveCommerceState): boolean {
  const merch = state.operations.trial.commerce.online?.merch;
  const row = merch?.inventory.find(item => item.code === stickers.code);
  return Boolean(merch?.version === 1 && merch.modules.includes(paper.code)
    && row && row.quantity + row.sold > 0 && state.milestones.includes('merch-published')
    && state.milestones.includes('merch-time'));
}

export function getReleveMerchProgress(state: KqReleveCommerceState) {
  const merch = state.operations.trial.commerce.online?.merch;
  const row = merch?.inventory.find(item => item.code === stickers.code);
  const complete = canReadReleveMerchReport(state) && state.milestones.includes('merch-report-read');
  const instruction = !merch || merch.version !== 1 ? 'Le stock de produits dérivés doit être disponible avant de poursuivre cet essai.'
    : !merch.modules.includes(paper.code) ? 'Dans Commerce, ouvre Développer puis Produits dérivés. Compare les prérequis prêtés et le coût de la papeterie avant de la débloquer.'
      : !row || row.quantity + row.sold === 0 ? 'Fabrique une petite série de stickers. La fabrication est payée maintenant ; les invendus restent à ta charge.'
        : !state.milestones.includes('merch-published') ? 'Compare le prix, la marge et la cadence estimée. Coche Proposer en vitrine, puis enregistre ton offre.'
          : !state.milestones.includes('merch-time') ? 'Avance de 24 heures fictives pour observer ton offre. Le nombre de ventes dépend de ton audience et de ton prix.'
            : !complete ? 'Dans Mon stock en vente, choisis Produits dérivés puis ouvre Stock, rythme et versements. Compare les articles restants et les montants réellement versés ; zéro vente reste un résultat possible.'
              : 'Tu as préparé et observé tes produits dérivés. Les versements ne sont pas un bénéfice : l’atelier et la fabrication ont été payés séparément.';
  return { complete, instruction };
}

const button = (id: string, title: string, instruction: string, selector: string): ReleveGuideStep => ({ id, title, instruction, selector, kind: 'button' });
const management = '[data-releve-commerce="merch"][data-releve-section]:not([data-releve-section="management"])';
const outsideDashboard = '[data-releve-commerce="merch"][data-releve-section]:not([data-releve-section="dashboard"])';
const editor = '[data-merch-editor="stickers"]';

/** Points to the real Merch controls. Prices, stock, confirmations and sales stay native. */
export function getReleveMerchGuide(state: KqReleveCommerceState): ReleveGuideStep[] {
  const merch = state.operations.trial.commerce.online?.merch;
  const row = merch?.inventory.find(item => item.code === stickers.code);
  const has = (milestone: string) => state.milestones.includes(milestone);
  const steps: ReleveGuideStep[] = [{
    id: 'merch-confirm', title: 'Vérifie avant de confirmer',
    instruction: 'Lis le montant débité, la quantité et les conditions. L’atelier et la fabrication sont deux dépenses distinctes dans ton budget fictif.',
    text: 'Confirmer', scope: 'dialog[open][aria-labelledby="treasury-management-title"]', kind: 'button',
  }];
  if (!merch?.modules.includes(paper.code)) {
    steps.push(button('merch-module', 'Ouvre la papeterie de ta marque', 'Le site, l’identité et les commandes d’exemple te sont prêtés. Vérifie le prix de cet atelier permanent ; le stock se paie ensuite à part.', '[data-merch-buy-module="paper"]'));
  } else if (!row || row.quantity + row.sold === 0) {
    steps.push(button('merch-stock', 'Fabrique ta première série', 'La quantité proposée est de dix stickers. Vérifie le prix par article et le total à payer maintenant ; tu peux choisir une autre petite quantité.', `${editor} [data-merch-buy-stock]`));
  } else if (!has('merch-published')) {
    steps.push({ id: 'merch-valid-price', title: 'Choisis un prix valable', instruction: 'Saisis ton prix par article. La marge et la cadence restent des estimations, avant TVA et autres charges.', selector: `${editor} [data-merch-price][aria-invalid="true"]`, kind: 'input' },
      { id: 'merch-activate', title: 'Prépare la mise en vitrine', instruction: 'Compare le prix proposé et la marge, puis coche Proposer en vitrine. Le stock et le nombre de places restent affichés.', selector: `${editor} [data-merch-active]:not(:checked)`, kind: 'input' },
      button('merch-publish', 'Enregistre ton offre', 'Vérifie le prix et la place utilisée. Enregistre la mise en vitrine pour permettre les ventes de cet article.', `${editor} [data-merch-save]`));
  } else if (!has('merch-time')) {
    steps.push(button('merch-time', 'Laisse vivre ta collection', 'Avance de 24 heures fictives. Le prix, ton audience et le stock déterminent les ventes ; aucune quantité vendue n’est promise.', '[data-releve-guide="advance-sales"]'));
  } else if (!has('merch-report-read')) {
    steps.push({ id: 'merch-report', title: 'Lis les résultats du rayon', instruction: 'Ouvre Stock, rythme et versements : retrouve ce qui reste en stock et ce qui a rejoint la trésorerie. Les coûts de fabrication et d’atelier sont déjà payés séparément.', selector: '[data-merch-activity] details:not([open]) > summary', kind: 'summary' },
      { id: 'merch-report-read', title: 'Compare le stock et les versements', instruction: 'Lis le bilan ouvert : distingue le stock restant, le rythme estimé et les versements déjà reçus. Les frais de fabrication restent à ta charge.', selector: '[data-merch-activity] details[open]', kind: 'element' },
      { id: 'merch-report-read', title: 'Compare le stock et les versements', instruction: 'Lis le bilan ouvert : distingue le stock restant, le rythme estimé et les versements déjà reçus. Les frais de fabrication restent à ta charge.', selector: '[data-merch-activity] details[open]', kind: 'element' },
      button('merch-activity', 'Retrouve tes articles', 'Dans Mon stock en vente, choisis Produits dérivés pour retrouver les stocks et les versements de ta collection.', '[data-screen="dashboard"] [data-online-rayon="merch"]:not([aria-pressed="true"])'),
      button('merch-dashboard', 'Retrouve le suivi des ventes', 'Choisis Mon stock en vente pour consulter les résultats de ta collection.', `${outsideDashboard} [data-market-section="dashboard"]`));
  }
  if (!has('merch-published')) {
    steps.push(button('merch-stickers', 'Commence par les stickers', 'Choisis Stickers pour essayer une petite série de papeterie.', '[data-merch-product="stickers"][aria-pressed="false"]'),
      button('merch-open', 'Retrouve les collections de ta marque', 'Dans Développer, choisis Produits dérivés. Les articles disposent de leur propre stock, distinct des fleurs.', '[data-shop-view="merch"][aria-selected="false"]'));
  }
  if (!has('merch-published')) steps.push(
    button('merch-management', 'Retrouve l’atelier de ta marque', 'Choisis Développer, puis Produits dérivés pour fabriquer ta collection et préparer sa mise en vitrine.', `${management} [data-market-section="management"]`),
  );
  if (!has('merch-report-read')) steps.push(
    button('merch-return', 'Retourne à ta boutique', 'Reviens au commerce pour poursuivre cette collection d’essai.', '[data-releve-guide="return-shop"]'),
  );
  return steps;
}
