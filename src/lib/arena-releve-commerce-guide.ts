import type { ReleveGuideStep } from './arena-releve-guide';
import { getKqCommerceStockQuality } from './kanab-quest-commerce';
import { needsReleveCommerceSample, type KqReleveCommerceChapter, type KqReleveCommerceState } from './kanab-quest-releve-commerce';

const store = '[aria-label="Préparer des paquets pour la vente en ligne"]';
const confirmation = 'dialog[open][aria-labelledby="commerce-confirm-title"], dialog[open][aria-labelledby="treasury-management-title"]';

function button(id: string, title: string, instruction: string, text: string, scope?: string): ReleveGuideStep {
  return { id, title, instruction, kind: 'button', text, ...(scope ? { scope } : {}) };
}

function target(id: string, title: string, instruction: string, selector: string, kind: ReleveGuideStep['kind'] = 'button'): ReleveGuideStep {
  return { id, title, instruction, selector, kind };
}

function confirm(instruction: string): ReleveGuideStep[] {
  return [
    button('commerce-refresh-quote', 'L’offre a expiré', 'Recalcule le devis pour vérifier le prix actuel.', 'Recalculer l’offre', confirmation),
    button('commerce-confirm', 'Vérifie avant de confirmer', instruction, 'Confirmer', confirmation),
  ];
}

function navigate(section: 'sales' | 'management' | 'dashboard', title: string, instruction: string): ReleveGuideStep[] {
  const elsewhere = `[data-releve-commerce][data-releve-section]:not([data-releve-section="${section}"])`;
  return [
    target(`commerce-open-${section}`, title, instruction, `${elsewhere} button[role="tab"][id$="-${section}-tab"]`),
    button(`commerce-menu-${section}`, 'Ouvre les rubriques', `Ouvre « Rubriques », puis choisis « ${section === 'sales' ? 'Vendre ma production' : section === 'dashboard' ? 'Mes ventes' : 'Développer ma boutique'} ».`, 'Rubriques', elsewhere),
  ];
}

function prepareFlowers(): ReleveGuideStep[] {
  return [
    target('commerce-whole-flowers', 'Garde les fleurs entières', 'Choisis « Fleurs entières » pour ta première vente.', '[data-screen="preparation"] select:not(:has(option[value="raw"]:checked))', 'select'),
    button('commerce-prepare', 'Prépare ta récolte', 'Prépare le lot entier. Tu choisiras la quantité à vendre ensuite ; le reste restera en réserve.', 'Préparer les fleurs', '[data-screen="preparation"]'),
  ];
}

/** Candidates follow the actual desk: its current screen determines the next visible control. */
export function getReleveCommerceGuide(chapter: KqReleveCommerceChapter, state: KqReleveCommerceState): ReleveGuideStep[] {
  const has = (milestone: string) => state.milestones.includes(milestone);
  const steps = confirm(chapter === 'delivery'
    ? 'Vérifie le TTC, la TVA et le net versé, puis confirme si cette offre te convient.'
    : 'Vérifie l’opération et son montant. Confirme si les conditions te conviennent.');

  if (chapter === 'ledger') {
    if (!has('ledger-read')) steps.push(
      target('commerce-ledger-entry', 'Examine une opération', 'Ouvre une opération du journal : retrouve les comptes débités et crédités et le montant réellement disponible.', '#treasury-panel-journal details:not([open]) > summary', 'summary'),
      target('commerce-ledger', 'Retrouve les opérations de ta ferme', 'Choisis « Journal » dans le dossier comptable pour suivre tes dépenses et tes ventes.', '#treasury-dossier:not(:has(option[value="journal"]:checked))', 'select'),
      button('commerce-accounts', 'Ouvre le registre de grand-père', 'Choisis Comptabilité détaillée pour retrouver le bilan et le journal de ta campagne.', 'Comptabilité détaillée'),
      button('commerce-back-accounts', 'Reviens au Bureau', 'Retrouve le journal de la ferme avant de récupérer ta récompense.', 'Le Bureau', '[data-releve-commerce-toolbar]'),
    );
    else if (!has('first-harvest')) steps.push(
      button('commerce-reward', 'Ta première récolte est reconnue', 'Récupère la récompense de la mission Ta première récolte. Ses 50 € fictifs rejoignent ton disponible.', 'Récupérer ma récompense', 'section[aria-label="Culture & Buddies"]'),
      target('commerce-missions', 'Retrouve les missions du quartier', 'Ta première récolte a accompli une mission. Va chercher sa récompense au quartier.', '[data-releve-guide="open-missions"][aria-pressed="false"]'),
    );
    return steps;
  }

  if (chapter === 'delivery') {
    if (!has('mature')) return [...steps, target('commerce-mature', 'La récolte prend son temps', 'Avance l’horloge de six heures fictives pour terminer l’affinage de ton lot.', '[data-releve-guide="mature"]')];
    if (has('delivered')) {
      if (!has('receipt-read')) steps.push(target('commerce-receipt', 'Suis l’argent de ta livraison', 'Lis le reçu du comptoir : vente, TVA, factures réglées et montant ajouté à ta caisse.', '[data-screen="receipt"] [role="status"]', 'element'), ...navigate('sales', 'Retrouve ton reçu', 'Ouvre Vendre ma production pour retrouver le reçu de cette livraison.'));
      return steps;
    }
    steps.push(
      target('commerce-quantity', 'Vends une petite quantité', 'Saisis 10 g si tu peux garder au moins 10 g en réserve pour tes futurs paquets.', '[data-screen="offer"] input[type="number"]:is(:placeholder-shown, :invalid)', 'input'),
      target('commerce-adjust-quantity', 'Garde du stock pour la boutique', 'Ouvre le réglage de quantité : garde au moins 10 g pour ta boutique.', '[data-screen="offer"] details:not([open]):has(input[type="number"]:is(:placeholder-shown, :invalid)) > summary', 'summary'),
      button('commerce-sell', 'Vérifie cette livraison', 'Ouvre le devis de vente pour vérifier la quantité, les retenues et le stock restant.', 'Vendre ce lot', '[data-screen="offer"]'),
      target('commerce-wholesaler', 'Compare le circuit grossiste', 'Ouvre l’offre du grossiste : compare son prix et la quantité qu’il peut reprendre.', '[data-screen="distribution"] button[aria-label="Voir l’offre Grossistes"]:not([data-unavailable="true"])'),
      ...prepareFlowers(),
      button('commerce-harvest', 'Retrouve le fruit de ta culture', 'Ouvre ta récolte : tu retrouves ici sa quantité, son verdict et sa conservation.', 'Préparer ou vendre', '[aria-label="Tes lots"]'),
      button('commerce-prepared-harvest', 'Ouvre ton lot préparé', 'Ce lot est déjà prêt. Ouvre-le pour choisir son circuit de vente.', 'Vendre', '[aria-label="Tes lots"]'),
      ...navigate('sales', 'Passe au comptoir', 'Choisis « Vendre ma production » pour retrouver ta récolte.'),
      target('commerce-return-shop', 'Retourne au comptoir', 'Reviens à la boutique pour retrouver ta récolte et les offres de livraison.', '[data-releve-guide="return-shop"]'),
    );
    if (state.operations.trial.commerce.wholesale?.remainingEquivalentUnits === 0) steps.push(target('commerce-next-slot', 'Le grossiste a rempli son créneau', 'Avance au prochain créneau fictif pour retrouver des offres disponibles.', '[data-releve-guide="next-slot"]'));
    return steps;
  }

  if (!state.operations.trial.commerce.computerOwned) return [...steps, target('commerce-computer', 'Installe-toi à l’ordinateur', 'Accepte mon ordinateur en prêt pour gérer ta boutique et ses commandes.', '[data-releve-guide="borrow-computer"]')];
  if (!has('site-opened')) {
    return [...steps,
      button('commerce-create-site', 'Ouvre ta boutique', 'Ouvre gratuitement ta boutique. Les frais seront prélevés sur les ventes.', 'Ouvrir gratuitement', '[aria-label="Développer ma boutique en ligne"]'),
      target('commerce-brand', 'Donne un nom à la ferme', 'Donne un nom à ta boutique : entre 3 et 40 caractères.', 'input[placeholder="Ton nom de marque"]', 'input'),
      ...navigate('management', 'Rejoins ton bureau', 'Choisis « Développer ma boutique » pour créer ton enseigne.'),
      target('commerce-return-shop', 'Retrouve ta boutique', 'Reviens à la boutique pour poursuivre sa création.', '[data-releve-guide="return-shop"]'),
    ];
  }

  if (!has('published')) {
    if (needsReleveCommerceSample(state) && !has('sample-loaned')) {
      steps.push(target('commerce-sample', 'Je te prête un lot pour cet essai', 'Accepte 30 g et un bocal prêtés pour cet essai. Ta propre récolte reste conservée.', '[data-releve-guide="borrow-sample"]'));
    }
    const online = state.operations.trial.commerce.online!;
    const stocked = online.packaging.some(pack => pack.quantity > 0);
    const buy = target('commerce-packaging', 'Équipe ton poste de conditionnement', 'Achète les emballages choisis : ils sont payés avant les ventes. Le kraft de 5 g convient.', `${store} article[data-selected="true"] button`);
    if (!stocked) steps.push(buy);
    steps.push(
      target('commerce-packet-count', 'Ajuste le nombre de paquets', 'Choisis la quantité : deux paquets de 5 g suffisent si ton lot contient au moins 10 g.', `${store} input[inputmode="numeric"]:not([aria-label]):invalid`, 'input'),
      target('commerce-packet-price-invalid', 'Fixe un prix valable', 'Saisis un prix positif par paquet. Le prix repère peut t’aider.', `${store} input[inputmode="decimal"]:invalid`, 'input'),
      button('commerce-reference-price', 'Compare ton prix au repère', 'Essaie le prix repère et regarde la TVA, les frais et le montant restant.', '/ paquet', `${store}:has(input[inputmode="decimal"][value=""])`),
      button('commerce-publish', 'Prépare tes premiers paquets', 'Prépare et publie les paquets au prix choisi. Leur contenu sera retiré du stock en vrac.', 'et mettre en vente', store),
    );
    if (stocked) steps.push(buy);
    steps.push(
      target('commerce-online-channel', 'Choisis ta boutique en ligne', 'Choisis ta boutique en ligne pour préparer des paquets destinés à tes clients.', '[data-screen="distribution"] button[aria-label="Préparer des paquets pour ma boutique en ligne"]'),
      ...prepareFlowers(),
    );
    const prepared = state.operations.trial.commerce.stocks.find(stock => stock.route !== 'biomass' && stock.remainingUnits >= 100 && getKqCommerceStockQuality(stock) >= 5.8)
      ?? state.operations.trial.commerce.stocks.find(stock => stock.route !== 'biomass' && stock.remainingUnits >= 50 && getKqCommerceStockQuality(stock) >= 5.8);
    const raw = state.lots.find(lot => !lot.prepared && lot.storage.baseline.juryScore >= 5.8 && lot.storage.capacity!.totalUnits >= 100);
    if (prepared || raw) steps.push(button('commerce-online-lot', 'Choisis le lot à mettre en rayon', 'Ouvre ce lot pour préparer tes premiers paquets.', (prepared ?? raw)!.name, '[aria-label="Tes lots"]'));
    steps.push(
      ...navigate('sales', 'Retourne à ta réserve', 'Choisis « Vendre ma production » pour préparer les paquets de ta boutique.'),
      target('commerce-return-shop', 'Retrouve ta boutique', 'Reviens à la boutique pour préparer tes paquets.', '[data-releve-guide="return-shop"]'),
    );
    return steps;
  }

  if (chapter === 'business' && !has('campaign')) {
    steps.push(
      button('commerce-first-campaign', 'Fais connaître ton enseigne', 'Prépare ton premier lancement offert. Vérifie le public, les prévisions et ton stock.', 'Préparer mon premier lancement'),
      target('commerce-accessible-audience', 'Choisis un public adapté', 'Essaie le public « Accessible », adapté à un prix proche du repère.', '[aria-label="Préparer une campagne"] input[type="radio"][value="value"]:not(:checked)', 'input'),
      button('commerce-communication', 'Ouvre le bureau des campagnes', 'Choisis « Communication » pour préparer le lancement de ton enseigne.', 'Communication', '[role="tablist"][aria-label="Gérer ma boutique"]'),
      ...navigate('management', 'Rejoins le bureau de ta boutique', 'Retourne dans « Développer ma boutique » pour préparer une campagne.'),
      target('commerce-return-shop', 'Retrouve ta boutique', 'Reviens à la boutique pour préparer ta campagne.', '[data-releve-guide="return-shop"]'),
    );
    return steps;
  }
  if (!has('online-time')) steps.push(target('commerce-advance-sales', 'Laisse vivre ta boutique', 'Simule 24 heures de ventes. Prix, qualité, stock et audience influenceront les commandes.', '[data-releve-guide="advance-sales"]'));
  else if (!has('report-read')) steps.push(...navigate('dashboard', 'Regarde le résultat', 'Choisis « Mes ventes » pour retrouver tes commandes et les montants encaissés.'));
  return steps;
}

/** The workshop owns its saved state; its phase is exposed on the real workspace. */
export function getReleveWorkshopGuide(): ReleveGuideStep[] {
  return [
    ...confirm('Vérifie le coût, la durée et la quantité obtenue avant de confirmer la transformation.'),
    target('workshop-career-sheet', 'Compare les gammes de la machine', 'Lis les conditions métier affichées sur la vraie fiche. Le tamis compact de cet essai t’est prêté.', '[data-releve-workshop="career"][data-releve-workshop-place="catalog"] [data-workshop-tiers]', 'element'),
    button('workshop-career', 'Découvre les conditions du métier', 'Ouvre le catalogue de l’atelier pour consulter la fiche et les gammes de cette machine.', 'Matériel de l’atelier commun', '[data-releve-workshop="career"]'),
    target('workshop-route', 'Choisis ce que tu veux produire', 'Choisis « Hash tamisé » pour découvrir son rendement et son devis.', '[data-releve-workshop="route"] [data-screen="preparation"] select:not(:has(option[value="dry-sift"]:checked))', 'select'),
    button('workshop-transform', 'Compare puis lance la machine', 'Ouvre le devis de transformation pour comparer les quantités et les frais.', 'Transformer et continuer', '[data-releve-workshop="route"] [data-screen="preparation"]:has(select option[value="dry-sift"]:checked)'),
    target('workshop-close-sheet', 'Rejoins le comptoir', 'Ferme la fiche de la machine, puis retourne transformer ton lot prêté.', '[data-releve-workshop="route"] button:is([aria-label="Fermer la fiche"],[aria-label="Fermer la fiche de la machine"])'),
    target('workshop-counter', 'Rejoins le comptoir', 'Ouvre le lot prêté pour comparer ses filières de transformation.', '[data-releve-workshop="route"] [data-releve-guide="workshop-counter"][aria-pressed="false"]'),
    target('workshop-finish', 'La machine travaille', 'Avance l’horloge jusqu’à la fin de cette transformation fictive.', '[data-releve-workshop="processing"] [data-releve-guide="workshop-finish"]'),
    target('workshop-condition', 'Lis le compteur de la machine', 'Une utilisation a été ajoutée. Repère la prochaine maintenance et son coût sur la fiche de ta machine.', '[data-releve-workshop="maintenance"] [aria-label="Entretien de la machine"]', 'element'),
    target('workshop-open-machine', 'Ouvre la fiche du tamis', 'Sélectionne le tamis dans la pièce pour retrouver son niveau et son compteur d’entretien.', '[data-releve-workshop="maintenance"] [data-workshop-machine="SIFT-TRAY"]'),
    target('workshop-maintenance', 'Vérifie la machine après usage', 'Retrouve Mes machines : une utilisation a été ajoutée au tamis compact.', '[data-releve-workshop="maintenance"] [data-releve-guide="workshop-maintenance"][aria-pressed="false"]'),
    target('workshop-retry', 'Reprends un lot pour la démonstration', 'Recommence ce dossier prêté pour essayer le hash tamisé avec le tamis compact.', '[data-releve-workshop="retry"] [data-releve-guide="workshop-restart"]'),
  ];
}
