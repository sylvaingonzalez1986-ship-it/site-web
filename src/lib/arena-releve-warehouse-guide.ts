import type { ReleveGuideStep } from './arena-releve-guide';
import { getKqRelevePlanReview, type KqReleveProductionState } from './kanab-quest-releve-production';
import { getKqBuddieRotationRemaining } from './kanab-quest-buddie-rotation';
import { isKqWarehouseZoneOperational, KQ_WAREHOUSE_UNLIT_CODE } from './kanab-quest-warehouse';

export function getReleveWarehouseGuide(chapter: 'plan' | 'buddies' | 'expansion', state: KqReleveProductionState): ReleveGuideStep[] {
  const scope = `[data-releve-production="${chapter}"]`, steps: ReleveGuideStep[] = [];
  const add = (id: string, instruction: string, selector: string, kind: ReleveGuideStep['kind'] = 'button') => steps.push({ id: `${chapter}:${id}`, title: chapter === 'buddies' ? 'Tes Buddies dans la ferme' : 'Aménager ton entrepôt', instruction, selector, kind, scope });
  const marked = (milestone: string) => state.milestones.includes(milestone);
  const dirty = JSON.stringify(state.warehouse) !== JSON.stringify(state.draftWarehouse);
  if (chapter === 'buddies') {
    for (const [id, label, instruction] of [
      ['pack-open', 'Ouvrir le pack', 'Ouvre le pack que je te prête pour cette aventure.'],
      ['pack-reveal', 'Révéler la carte', 'Retourne la carte pour découvrir ton Buddie.'],
      ['pack-next', 'Carte suivante', 'Découvre le Buddie suivant.'],
      ['pack-loot', 'Voir les cartes', 'Tes trois cartes sont révélées. Ouvre le récapitulatif.'],
      ['pack-store', 'Terminer', 'Retrouve le plan pour affecter tes Buddies.'],
    ]) steps.push({ id: `${chapter}:${id}`, title: 'Le pack de Loïc', instruction, text: label, scope: `${scope} .contest-pack-opening-modal` });
    if (state.ownedBuddies.length < 3) { add('pack', 'Reprends l’ouverture de ton pack prêté.', '[data-releve-guide="buddie-pack"]'); return steps; }
    steps.push({ id: 'buddies:choose-profile', title: 'La fiche du Buddie', instruction: 'Lis sa fiche, puis choisis « Placer ce Buddie ».', selector: '[data-buddie-variety-choose]' });
    steps.push({ id: 'buddies:close-profile', title: 'La fiche du Buddie', instruction: 'Ce Buddie attend sa rotation. Ferme sa fiche et choisis une variété disponible.', selector: '[data-buddie-variety-close]' });
    const destination = state.draftWarehouse.zones.find(zone => isKqWarehouseZoneOperational(zone) && !zone.buddieCode);
    if (destination) add('place', 'Choisis cette zone pour y placer le Buddie.',
      `[data-grow-room]:has([data-buddie-target=true]) [data-warehouse-zone-chip=${JSON.stringify(destination.id)}]`);
    if (dirty) { add('save', 'Enregistre le plan pour valider les Buddies placés.', '[data-warehouse-campaign-action="save"], [data-warehouse-action="save"]'); return steps; }
    add('cultures', 'Passe aux cultures pour retrouver tes Buddies au pied du plan.', '[data-warehouse-managing] [aria-label="Actions du plan"] > button[aria-pressed=false]');
    add('open-dock', 'Ouvre les Buddies de ton album.', '[data-warehouse-buddie-toggle][aria-expanded=false]');
    const code = state.ownedBuddies.find(item => !getKqBuddieRotationRemaining(item, state.recentBuddieCodes) && !state.warehouse.zones.some(zone => zone.buddieCode === item));
    if (code) add('profile', 'Touche cette carte : sa fiche permet de choisir le Buddie à placer.', `[data-warehouse-buddie-card="${code}"]`);
    return steps;
  }
  const review = getKqRelevePlanReview(state);
  const cultures = state.draftWarehouse.zones.filter(isKqWarehouseZoneOperational);
  const services = state.draftWarehouse.serviceZones ?? [];
  const unfinished = state.draftWarehouse.zones.find(zone => zone.lightingCode === KQ_WAREHOUSE_UNLIT_CODE);
  const needed = cultures.length < (chapter === 'expansion' ? 2 : 1)
    ? unfinished ? { category: 'lighting', code: 'MH-TS1000', label: 'un éclairage' }
      : { category: 'substrate', code: 'SIM-SUBSTRATE-01', label: 'un support' }
    : !services.some(zone => zone.kind === 'drying') ? { category: 'drying', code: 'SJ-DRYIT90', label: 'un séchoir' }
    : !services.some(zone => zone.kind === 'storage') ? { category: 'storage', code: 'LP-SUPER-1L', label: 'un contenant' } : null;
  if (needed) {
    const placement = `[data-warehouse-placement="${needed.code}"]`;
    if (needed.category === 'lighting' && unfinished) {
      add('place-lighting', 'Installe cet éclairage sur le support que tu viens de placer.',
        `${placement} [data-warehouse-build-target=${JSON.stringify(unfinished.id)}]`);
    } else {
      add(`place-${needed.category}`, 'Touche une case libre pour placer 1 m² sur le plan.',
        `[data-warehouse-managing]:has(${placement}) [data-warehouse-map]`, 'element');
    }
    add(`choose-${needed.category}`, `Choisis ${needed.label} dans le catalogue.`, `[data-warehouse-shop-choose="${needed.code}"]`);
    add(`category-${needed.category}`, `Ouvre le rayon pour choisir ${needed.label}.`, `[data-warehouse-shop-category="${needed.category}"][aria-selected=false]`);
    add('manage', `Ouvre Aménager pour choisir ${needed.label}.`, '[data-warehouse-build-shop]');
    return steps;
  }
  if (!marked('quote-read')) add('quote', 'Ouvre le détail : matériel, pose et coût par mètre carré.', '[data-warehouse-quote-details] > summary', 'summary');
  add('confirm-zone', 'Vérifie le total, puis valide cette zone.', '[data-warehouse-zone-dialog] [data-warehouse-action="save"]');
  if (dirty) {
    add('save', 'Installe le plan après avoir vérifié son coût.', '[data-warehouse-action="save"]');
    return steps;
  }
  if (!marked('quote-read')) add('inspect', 'Choisis un équipement pour créer un brouillon et consulter son devis.', '[data-warehouse-build-shop]');
  if (!marked('charges-read')) {
    add('dashboard', 'Ouvre les chiffres de ton entrepôt pour vérifier les charges et les capacités.', '[data-warehouse-dashboard]:not([open]) > summary', 'summary');
    add('charges', 'Consulte les coûts par cycle avant de préparer la culture.', '[data-warehouse-summary-tab="costs"]');
  }
  if (review.summary && (review.summary.dryingCapacityGrams < review.summary.estimatedHarvestGrams || review.summary.storageCapacityGrams < review.summary.estimatedHarvestGrams)) {
    add('capacity', 'Agrandis le séchage ou le stockage pour accueillir toute la récolte estimée.', '[data-warehouse-action="configure"], [data-warehouse-action="configure-selected"]');
  }
  return steps;
}
