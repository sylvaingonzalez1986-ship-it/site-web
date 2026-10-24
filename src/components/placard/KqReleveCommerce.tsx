"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CircleHelp, Clock3, Laptop, Package, X } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { formatKqCash } from '@/lib/kanab-quest-equipment';
import { createReleveCommerceTransport, getReleveCommerceCash, getReleveCommerceOutstanding, needsReleveCommerceSample, type KqReleveCommerceChapter, type KqReleveCommerceState } from '@/lib/kanab-quest-releve-commerce';
import { getReleveSocialLearning } from '@/lib/kanab-quest-releve-social';
import { KqMarketDesk, type KqMarketSection } from './KqMarketDesk';
import { KqSocialNetworks } from './KqSocialNetworks';
import { KqPrintedArt } from './KqPrintedArt';
import { KqTreasuryDesk } from './KqTreasuryDesk';
import { KqMissionCenter } from './KqMissionCenter';
import { KqHarvests } from './KqHarvests';
import { KqWarehouseEntry } from './KqWarehouseEntry';
import { createKqTutorialApi, KqTutorialApiProvider } from './KqTutorialApiContext';
import styles from './KqReleveCommerce.module.css';

export type KqReleveDestination = 'market' | 'social' | 'accounts' | 'missions' | 'storage' | 'equipment' | 'bank';
const socialDestinations: KqReleveDestination[] = ['social', 'accounts', 'bank'];
type Props = { chapter: KqReleveCommerceChapter; state: KqReleveCommerceState; onChange: (state: KqReleveCommerceState) => void; initialDestination?: KqReleveDestination; destination?: KqReleveDestination; onDestinationChange?: (destination: KqReleveDestination) => void };

/** Only the data and the practice clock differ from the player's real desks. */
export function KqReleveCommerce(props: Props) {
  return <CommerceVisit key={props.chapter} {...props} />;
}

function CommerceVisit({ chapter, state, onChange, initialDestination, destination, onDestinationChange }: Props) {
  const shopChapter = chapter === 'shop' || chapter === 'business';
  const merchChapter = chapter === 'merch';
  const current = useRef(state), change = useRef(onChange), workspace = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { current.current = state; change.current = onChange; }, [state, onChange]);
  const api = useMemo(() => createKqTutorialApi(createReleveCommerceTransport({ getState: () => current.current, setState: next => { current.current = next; change.current(next); } }), { nativeWarehouse: true, onOpenCulture: () => setNotice('Cette campagne est terminée. Reviens au quartier pour retrouver le parcours de culture.') }), []);
  const [section, setSection] = useState<KqMarketSection>(shopChapter || merchChapter ? 'management' : state.milestones.includes('delivered') ? 'sales' : 'overview');
  const [localPlace, setLocalPlace] = useState<KqReleveDestination>(initialDestination ?? (chapter === 'ledger' ? 'accounts' : chapter === 'social' ? 'social' : 'market'));
  const requestedPlace = destination ?? localPlace;
  const place = chapter === 'social' && !socialDestinations.includes(requestedPlace) ? 'social' : requestedPlace;
  const setPlace = useCallback((next: KqReleveDestination) => {
    if (chapter === 'social' && !socialDestinations.includes(next)) { setNotice('Retrouve cette activité dans sa rencontre dédiée ; ton essai Réseaux reste ici.'); return; }
    setLocalPlace(next); onDestinationChange?.(next);
  }, [chapter, onDestinationChange]);
  const [harvestSection, setHarvestSection] = useState<'overview' | 'storage'>('storage');
  const [equipmentCode, setEquipmentCode] = useState<string>();
  const [flowerId, setFlowerId] = useState<string>();
  const equipmentOrigin = useRef<KqReleveDestination>('market');
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const commerce = state.operations.trial.commerce, due = getReleveCommerceOutstanding(state);
  const socialLearning = getReleveSocialLearning(state);
  const has = (key: string) => state.milestones.includes(key);
  function openEquipment(code?: string) { equipmentOrigin.current = place; setEquipmentCode(code); setPlace('equipment'); }
  function openHarvests(next: 'overview' | 'storage' = 'storage') { setHarvestSection(next); setPlace('storage'); }
  const record = useCallback(async (name: string, values: Record<string, unknown> = {}) => {
    const response = await api.request('/api/releve/commerce', { method: 'POST', body: JSON.stringify({ action: name, ...values }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Action indisponible.');
  }, [api]);
  // A milestone is earned when the corresponding real screen is actually seen.
  // No duplicate tutorial receipt, report, ledger or reward button is rendered.
  useEffect(() => {
    if (chapter === 'social') return;
    const milestone = chapter === 'delivery' ? 'receipt-read' : chapter === 'ledger' ? 'ledger-read' : chapter === 'merch' ? 'merch-report-read' : 'report-read';
    if (state.milestones.includes(milestone) || (milestone === 'receipt-read' && !state.milestones.includes('delivered')) || (milestone === 'report-read' && !state.milestones.includes('online-time')) || (milestone === 'merch-report-read' && !state.milestones.includes('merch-time'))) return;
    const selector = milestone === 'receipt-read' ? '[data-screen="receipt"] [role="status"]' : milestone === 'ledger-read' ? '#treasury-panel-journal details[open]' : chapter === 'merch' ? '[data-merch-activity] details[open]' : chapter === 'business' ? '[data-marketing-history][open] [data-marketing-report]' : '[data-screen="dashboard"]';
    let recorded = false;
    const seen = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting && entry.intersectionRect.height > 0);
      if (recorded || !visible) return;
      recorded = true;
      void record(milestone === 'receipt-read' ? 'read-receipt' : milestone === 'ledger-read' ? 'read-ledger' : milestone === 'merch-report-read' ? 'read-merch-report' : 'read-report', chapter === 'business' ? { reportId: visible.target.getAttribute('data-marketing-report') } : {}).catch(error => { recorded = false; setNotice(error instanceof Error ? error.message : 'La lecture n’a pas été enregistrée.'); });
    });
    const elements = new Set<Element>();
    const sync = () => workspace.current?.querySelectorAll(selector).forEach(element => { if (!elements.has(element)) { elements.add(element); seen.observe(element); } });
    const observer = new MutationObserver(sync);
    if (workspace.current) observer.observe(workspace.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-screen', 'open'] });
    sync();
    return () => { observer.disconnect(); seen.disconnect(); };
  }, [chapter, record, state.milestones]);
  async function action(name: string, endpoint = '/api/releve/commerce', values: Record<string, unknown> = {}) {
    setBusy(true); setNotice('');
    try {
      const response = await api.request(endpoint, { method: 'POST', body: JSON.stringify({ action: name, ...values }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Action indisponible.');
      for (const event of ['kq:commerce-updated', 'kq:equipment-updated', 'kq:treasury-updated', 'kq:social-updated']) api.notify(event);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Action indisponible.'); }
    finally { setBusy(false); }
  }
  function localLink(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!target) return;
    const url = new URL(target.href, window.location.href);
    if (!url.pathname.startsWith('/arene')) return;
    event.preventDefault(); event.stopPropagation();
    if (url.searchParams.get('view') === 'treasury') setPlace(url.searchParams.get('pole') === 'bank' ? 'bank' : 'accounts');
    else if (url.searchParams.get('view') === 'harvests') openHarvests(url.searchParams.get('section') === 'storage' ? 'storage' : 'overview');
    else if (url.searchParams.get('view') === 'workshop' && url.searchParams.get('section') === 'storage') openHarvests();
    else if (url.searchParams.get('view') === 'workshop' || url.searchParams.get('view') === 'shop') openEquipment(url.searchParams.get('equipment') ?? undefined);
    else if (url.searchParams.get('view') === 'social' || (url.searchParams.get('view') === 'market' && url.searchParams.get('section') === 'social')) setPlace('social');
    else if (url.searchParams.get('view') === 'market') {
      const next = url.searchParams.get('section');
      setPlace('market'); setSection(['overview', 'demands', 'sales', 'dashboard', 'management'].includes(next ?? '') ? next as KqMarketSection : 'overview');
    } else setNotice('Sylvain a prévu cette rencontre plus loin dans la visite. Ta campagne fictive reste ici.');
  }
  return <KqTutorialApiProvider api={api}><div ref={workspace} className={styles.visit} data-releve-commerce={chapter} data-releve-section={section} data-releve-destination={place} onClickCapture={localLink} onAuxClickCapture={localLink}>
    <div className={styles.toolbar} aria-label="Commandes de l’essai" data-releve-commerce-toolbar>
      <div className={styles.actions}>
        {chapter === 'delivery' && !has('mature') ? <button type="button" data-releve-guide="mature" disabled={busy} onClick={() => void action('mature')}><Clock3 size={20} aria-hidden="true" /><span>Passer les 6 heures d’affinage<small>Horloge de l’essai · +6 h</small></span></button> : null}
        {chapter === 'delivery' && has('mature') && !has('delivered') && commerce.wholesale?.remainingEquivalentUnits === 0 ? <button type="button" data-releve-guide="next-slot" disabled={busy} onClick={() => void action('online', '/api/arena/placard/commerce', { command: 'advance-online-time', payload: { hours: 24 } })}><Clock3 size={20} aria-hidden="true" />Prochain créneau · +24 h</button> : null}
        {shopChapter && !commerce.computerOwned ? <button type="button" data-releve-guide="borrow-computer" disabled={busy} onClick={() => void action('borrow-computer')}><Laptop size={22} aria-hidden="true" />Accepter l’ordinateur prêté</button> : null}
        {shopChapter && needsReleveCommerceSample(state) && !has('sample-loaned') ? <button type="button" data-releve-guide="borrow-sample" disabled={busy} onClick={() => void action('borrow-sample')}><Package size={20} aria-hidden="true" />Accepter le lot de démonstration</button> : null}
        {shopChapter || merchChapter ? <button type="button" data-releve-guide="advance-sales" disabled={busy} onClick={() => void action('online', '/api/arena/placard/commerce', { command: 'advance-online-time', payload: { hours: 24 } })}><Clock3 size={20} aria-hidden="true" />Avancer de 24 h fictives</button> : null}
        {shopChapter && destination === undefined ? <button type="button" aria-pressed={place === 'social'} onClick={() => setPlace('social')}><span style={{ width: 28, flexShrink: 0 }}><KqPrintedArt kind="social" sizes="28px" /></span>Réseaux</button> : null}
        {chapter === 'social' ? <button type="button" data-releve-guide="advance-social-time" disabled={busy} onClick={() => void action('advance-social-time')}><Clock3 size={20} aria-hidden="true" /><span>Avancer de 5 min fictives<small>Repos du fil et récupération du mental</small></span></button> : null}
        {chapter === 'ledger' ? <nav aria-label="Lieux de cette étape"><button type="button" aria-pressed={place === 'accounts'} onClick={() => setPlace('accounts')}>Le Bureau</button><button type="button" data-releve-guide="open-missions" aria-pressed={place === 'missions'} onClick={() => setPlace('missions')}>Les missions du quartier</button></nav> : null}
        {place !== 'market' && chapter !== 'ledger' && chapter !== 'social' ? <button type="button" data-releve-guide="return-shop" onClick={() => setPlace('market')}><ArrowLeft size={17} aria-hidden="true" />Revenir à la boutique</button> : null}
        {chapter === 'social' && place !== 'social' ? <button type="button" data-releve-guide="return-social" onClick={() => setPlace('social')}>Revenir aux réseaux</button> : null}
      </div>
      <button type="button" className={styles.help} aria-label="Comprendre les comptes et les règles de cette étape" title="Les conseils de Sylvain" aria-haspopup="dialog" onClick={() => setHelpOpen(true)}><CircleHelp size={20} aria-hidden="true" /></button>
    </div>
    {merchChapter ? <p className={styles.notice} data-releve-merch-loan>Dossier merch prêté : 5 000 € fictifs au départ, un ordinateur, une boutique de niveau 2 avec sa première période payée, une identité de marque et 5 commandes d’exemple. Ces prérequis sont fournis pour l’essai ; tu paies ici l’atelier et la fabrication.</p> : null}
    {chapter === 'social' ? <ol className={styles.socialObjectives} aria-label="Objectifs de la rencontre Réseaux" data-releve-social-objectives>{socialLearning.platforms.map(platform => <li key={platform.platform} data-complete={platform.read}><strong>{platform.platform === 'instagram' ? 'Instagram' : 'X'}</strong><span>{platform.read ? 'Résultat lu ✓' : platform.published ? 'Résultat à lire' : 'À publier'}</span></li>)}<li data-complete={socialLearning.partnershipsRead}><strong>Partenariats</strong><span>{socialLearning.partnershipsRead ? 'Conditions lues ✓' : 'À découvrir'}</span></li></ol> : null}
    {notice ? <p className={styles.notice} role="status">{notice}<button type="button" aria-label="Fermer le message" onClick={() => setNotice('')}><X size={18} aria-hidden="true" /></button></p> : null}
    {place === 'missions' ? <KqMissionCenter onOpen={() => setNotice('Les autres parcours se découvrent dans la rencontre Missions du quartier.')} />
      : place === 'social' ? <KqSocialNetworks busy={busy} initialTutorialResultId={chapter === 'social' ? socialLearning.pendingResultId : undefined} onTutorialResultRead={chapter === 'social' ? entryId => record('read-social-result', { entryId }) : undefined} onTutorialPartnershipRead={chapter === 'social' && !socialLearning.partnershipsRead && socialLearning.platforms.every(platform => platform.published && platform.read) ? sponsorId => record('read-social-partnerships', { sponsorId }) : undefined} />
      : place === 'accounts' || place === 'bank' ? <KqTreasuryDesk key={place} onOpenShop={openEquipment} initialPole={place === 'bank' ? 'bank' : 'accounting'} onPoleChange={pole => setPlace(pole === 'bank' ? 'bank' : 'accounts')} />
        : place === 'equipment' ? <KqWarehouseEntry embedded initialShopOpen initialEquipmentCode={equipmentCode} onOpenShop={openEquipment} onClose={() => setPlace(equipmentOrigin.current)} />
          : place === 'storage' ? <KqHarvests section={harvestSection} onSectionChange={setHarvestSection} onOpenArena={() => setNotice('Les verdicts de cette campagne sont terminés. Tes lots sont prêts pour la conservation et la vente.')} onOpenMarket={id => { setFlowerId(id); setSection('sales'); setPlace('market'); }} onOpenGame={() => setNotice('Reviens au quartier pour retrouver le parcours de culture.')} />
            : <KqMarketDesk section={section} onSectionChange={setSection} initialFlowerId={flowerId} initialReceipt={chapter === 'delivery' ? commerce.receipts.at(-1) : undefined} onOpenShop={openEquipment} onOpenTreasury={() => setPlace('accounts')} onOpenStorage={() => openHarvests()} onOpenCulture={() => setNotice('Ta récolte vient de la campagne que tu viens de terminer.')} />}
    {helpOpen ? createPortal(<AppDialog open onClose={() => setHelpOpen(false)} title="Les repères de Sylvain" className={styles.helpDialog} dialogProps={{ 'data-releve-commerce-help': true }}>
      <dl className={styles.helpBudget}><div><dt>Disponible fictif</dt><dd>{formatKqCash(getReleveCommerceCash(state))}</dd></div><div><dt>Factures restant à payer</dt><dd>{formatKqCash(due.totalCents)}</dd></div><div><dt>TVA réservée</dt><dd>{formatKqCash(commerce.business!.vat.reservedCents)}</dd></div></dl>
      {chapter === 'business' ? <p>Dossier d’entreprise séparé : une récolte déjà affinée, une réserve équipée et 5 000 € fictifs sont prêtés.</p> : null}
      {merchChapter ? <p>La papeterie et la fabrication sont payées séparément dans cet essai. Les articles ont leur propre stock. Compare ton prix, les frais et la cadence estimée avant la mise en vitrine ; les versements réels du rayon ne sont pas un bénéfice.</p> : null}
      {chapter === 'social' ? <p>Dossier Réseaux séparé : l’ordinateur, le site de base, la récolte et 5 000 € fictifs sont prêtés. Ton audience commence à zéro. Publie un brouillon sur Instagram et sur X, lis chaque résultat avec Continuer, puis découvre les conditions d’une marque sans signer de contrat. L’horloge avance de 5 minutes à ta demande.</p> : null}
      {chapter === 'delivery' ? <p>La préparation utilise le lot entier. La quantité se choisit lors de la vente : garde au moins 10 g pour publier tes premiers paquets. Lis ensuite le reçu du comptoir.</p> : null}
      {shopChapter ? <p>L’ordinateur est prêté. Le site de base ouvre gratuitement, sans abonnement. Les emballages, la TVA et les frais de vente figurent dans les mêmes écrans que dans ta partie.</p> : null}
      {chapter === 'ledger' ? <p>Ouvre Comptabilité détaillée, choisis Journal, puis examine une opération. Ta récompense Première récolte t’attend ensuite dans les missions du quartier.</p> : null}
      <p>Les prêts et l’horloge concernent uniquement cet essai. Ton compte de jeu conserve son budget, son stock et son rythme.</p>
    </AppDialog>, document.body) : null}
  </div></KqTutorialApiProvider>;
}
