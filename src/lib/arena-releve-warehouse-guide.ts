import type { ReleveGuideStep } from './arena-releve-guide';
import { getKqRelevePlanReview, type KqReleveProductionState } from './kanab-quest-releve-production';
import { getKqBuddieRotationRemaining } from './kanab-quest-buddie-rotation';

export function getReleveWarehouseGuide(chapter: 'plan' | 'buddies' | 'expansion', state: KqReleveProductionState): ReleveGuideStep[] {
  const scope = `[data-releve-production="${chapter}"]`, steps: ReleveGuideStep[] = [];
  const add = (id: string, instruction: string, selector: string, kind: ReleveGuideStep['kind'] = 'button') => steps.push({ id: `${chapter}:${id}`, title: chapter === 'buddies' ? 'Tes Buddies dans la ferme' : 'Aménager ton entrepôt', instruction, selector, kind, scope });
  const text = (id: string, instruction: string, label: string) => steps.push({ id: `${chapter}:${id}`, title: 'À toi de jouer', instruction, text: label, scope });
  const marked = (milestone: string) => state.milestones.includes(milestone);
  const dirty = JSON.stringify(state.warehouse) !== JSON.stringify(state.draftWarehouse);
  if (chapter === 'buddies') {
    for (const [id, label, instruction] of [
      ['pack-open', 'Ouvrir le pack', 'Ouvre le pack que je te prête pour cette aventure.'],
      ['pack-reveal', 'Révéler la carte', 'Retourne la carte pour découvrir ton Buddie.'],
      ['pack-next', 'Carte suivante', 'Découvre le Buddie suivant.'],
      ['pack-loot', 'Voir mon butin', 'Tes trois cartes sont révélées. Regarde ton butin.'],
      ['pack-store', 'Ranger dans mon album', 'Range tes Buddies dans ton album, puis retrouve le plan.'],
    ]) steps.push({ id: `${chapter}:${id}`, title: 'Le pack de Sylvain', instruction, text: label, scope: `${scope} .contest-pack-opening-modal` });
    if (state.ownedBuddies.length < 3) { add('pack', 'Reprends l’ouverture de ton pack prêté.', '[data-releve-guide="buddie-pack"]'); return steps; }
    steps.push({ id: 'buddies:choose-profile', title: 'La fiche du Buddie', instruction: 'Lis sa fiche, puis choisis « Placer ce Buddie ».', selector: '[data-buddie-variety-choose]' });
    steps.push({ id: 'buddies:close-profile', title: 'La fiche du Buddie', instruction: 'Ce Buddie attend sa rotation. Ferme sa fiche et choisis une variété disponible.', selector: '[data-buddie-variety-close]' });
    add('place', 'Clique dans la zone de culture pour y placer ce Buddie.', '[data-zone-kind="culture"][data-buddie-target=true]', 'element');
    if (dirty) { add('save', 'Enregistre le plan pour valider les Buddies placés.', '[data-warehouse-campaign-action="save"], [data-warehouse-action="save"]'); return steps; }
    add('cultures', 'Passe en mode Cultures pour retrouver tes Buddies au pied du plan.', '[aria-label="Mode du plan"] > button:last-child[aria-pressed=false]');
    add('open-dock', 'Ouvre les Buddies de ton album.', '[data-warehouse-buddie-toggle][aria-expanded=false]');
    const code = state.ownedBuddies.find(item => !getKqBuddieRotationRemaining(item, state.recentBuddieCodes) && !state.warehouse.zones.some(zone => zone.buddieCode === item));
    if (code) add('profile', 'Touche cette carte : sa fiche permet de choisir le Buddie à placer.', `[data-warehouse-buddie-card="${code}"]`);
    return steps;
  }
  const review = getKqRelevePlanReview(state);
  const cultures = state.draftWarehouse.zones.filter(zone => zone.active);
  const services = state.draftWarehouse.serviceZones ?? [];
  if (!marked('quote-read')) add('quote', 'Ouvre le détail : matériel, pose et coût par mètre carré.', '[data-warehouse-quote-details] > summary', 'summary');
  add('confirm-zone', 'Vérifie le total, puis valide cette zone.', '[data-warehouse-zone-dialog] [data-warehouse-action="save"]');
  if (dirty) {
    add('configure', 'Ouvre la vraie fenêtre d’équipement de ta zone.', '[data-warehouse-action="configure"], [data-warehouse-action="configure-selected"]');
    add('save', 'Installe le plan après avoir vérifié son coût.', '[data-warehouse-action="save"]');
    return steps;
  }
  const needed = cultures.length < (chapter === 'expansion' ? 2 : 1) ? 'culture'
    : !services.some(zone => zone.kind === 'drying') ? 'drying'
      : !services.some(zone => zone.kind === 'storage') ? 'storage' : null;
  if (needed) {
    const label = { culture: 'culture', drying: 'séchage', storage: 'stockage' }[needed];
    add(`trace-${needed}`, `Trace un petit carré de 1 m² pour le ${label}, sur une case libre.`, '[data-warehouse-map-viewport]:has([data-drawing=true])', 'element');
    add(`draw-${needed}`, `Choisis ${label}, puis trace sa zone sur le plan.`, `[data-warehouse-draw-kind="${needed}"]`);
    text('manage', 'Passe en mode Aménager pour tracer tes zones.', 'Aménager');
    return steps;
  }
  if (!marked('quote-read')) add('inspect', 'Configure une zone pour consulter son devis détaillé.', '[data-warehouse-action="configure"], [data-warehouse-action="configure-selected"]');
  if (!marked('charges-read')) {
    add('dashboard', 'Ouvre les chiffres de ton entrepôt pour vérifier les charges et les capacités.', '[data-warehouse-dashboard]:not([open]) > summary', 'summary');
    add('charges', 'Consulte les coûts par cycle avant de préparer la culture.', '[data-warehouse-summary-tab="costs"]');
  }
  if (review.summary && (review.summary.dryingCapacityGrams < review.summary.estimatedHarvestGrams || review.summary.storageCapacityGrams < review.summary.estimatedHarvestGrams)) {
    add('capacity', 'Agrandis le séchage ou le stockage pour accueillir toute la récolte estimée.', '[data-warehouse-action="configure"], [data-warehouse-action="configure-selected"]');
  }
  return steps;
}
