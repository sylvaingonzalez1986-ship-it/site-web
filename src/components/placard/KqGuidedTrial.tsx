"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, Check, Compass, Leaf, RotateCcw, X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { canActivateKqHeritage, getKqHandCodes, getKqSituation, getKqStageTarget, getKqZeroSuccessStageCount, isKqCultureDead, KQ_CARDS, KQ_STAGES, previewKqResolution, type KqSupportCard } from '@/lib/kanab-quest-game';
import { getKqSituationArtwork } from '@/lib/kanab-quest-situation-artwork';
import { getKqOutcomeArtwork, KQ_OUTCOME_LABELS } from '@/lib/kanab-quest-outcome-artwork';
import { getKqCardArtwork } from '@/lib/kanab-quest-artwork';
import { KQ_HERITAGE_CARDS } from '@/lib/kanab-quest-heritage';
import { getKqEquipmentDefinition } from '@/lib/kanab-quest-equipment';
import { KQ_ENERGY_MODES, quoteKqEnergy } from '@/lib/kanab-quest-energy';
import { KQ_CHANNELS, KQ_COMPUTER_PRICE_CENTS, KQ_SALES_CHANNELS, getKqCommerceReplenishment, quoteKqCommerce, type KqOnlinePrice, type KqSalesChannel } from '@/lib/kanab-quest-commerce';
import { KQ_SHOP_CREATION_CENTS, KQ_GAME_MONTH_MS, createKqBusinessPreview, isKqShopActive, previewKqBusinessPayment } from '@/lib/kanab-quest-business';
import { KQ_MARKET_ROUTES } from '@/lib/kanab-quest-market';
import { KQ_REPUTATION_TIERS } from '@/lib/kanab-quest-reputation';
import { canTrialContinue, canTrialResolve, canTrialRoll, createKqTrial, kqTrialStorageKey, KQ_TRIAL_BUDDIE, KQ_TRIAL_CHAPTERS, KQ_TRIAL_DECK, KQ_TRIAL_EQUIPMENT, KQ_TRIAL_VERSION, reduceKqTrial, restoreKqTrial, trialCardPermission, trialInstruction, trialQuality, trialRoutes, type KqTrialAction } from '@/lib/kanab-quest-trial';
import { KqBotteCardDetail } from './KqBotteCollection';
import styles from './KqGuidedTrial.module.css';

const euro=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const number=(value:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(value);
const SATISFACTION={satisfied:'Acheteurs satisfaits',neutral:'Acheteurs neutres',disappointed:'Acheteurs déçus','not-applicable':'Reprise sans fidélisation'};
const INTRO=[
 'Avant de cultiver, repère les deux activités : le Carnet garde tes dégustations réelles ; le Placard est le jeu. Cette partie d’essai reste entièrement fictive.',
 'Choisis une variété avec ton Buddie, prépare tes soutiens La Botte, puis équipe un Héritage permanent. Découvre les trois avant de continuer.',
 'Les packs de cartes coûtent des points. Le matériel durable coûte des euros du jeu. Achète cette LED avec ton budget de démonstration.',
 'Acheter ne suffit pas : installe le matériel dans son emplacement. La LED, le séchoir et le tamis prêtés serviront à cette culture.',
 '',
 'Ta culture est terminée. La quantité vient de tes résultats et de ton installation. La qualité de culture sera ensuite évaluée par le jury.',
 'Engage ta fleur d’essai contre Sylvain, un adversaire simulé. Découvre les trois manches : gagner le duel et obtenir une bonne note sont deux choses différentes.',
 'D’abord, choisis ce que devient ton lot. Une transformation peut donner moins de grammes mais un produit mieux valorisé. Le matériel et la qualité limitent les possibilités.',
 'Ensuite, compare les débouchés. Vends tout ton stock fictif, en une ou plusieurs commandes. Tu peux mélanger les circuits ou faire avancer l’horloge de cet essai.',
 'Tu as parcouru toute la boucle. Les cartes, les ventes, les clients et les gains de cet essai restent fictifs : ton aventure réelle commence avec ton propre inventaire.',
];
function load(userId:string) {
 try{return restoreKqTrial(JSON.parse(sessionStorage.getItem(kqTrialStorageKey(userId))??'null'));}catch{return restoreKqTrial(null);}
}
export function KqGuidedTrial({userId,onPause,onComplete,busy,error}:{userId:string;onPause:()=>void;onComplete:()=>void;busy:boolean;error:string}) {
 const [saved,dispatch]=useReducer((current:ReturnType<typeof load>,action:KqTrialAction|{type:'restart'})=>{
  if(action.type==='restart')return {state:createKqTrial(),actions:[]};
  const state=reduceKqTrial(current.state,action);
  return state===current.state?current:{state,actions:[...current.actions,action]};
 },userId,load);
 const s=saved.state,g=s.game,c=s.commerce;
 const cultureDead=!!g&&isKqCultureDead(g);
 const outcomeArtwork=g?getKqOutcomeArtwork(g):null;
 const [detail,setDetail]=useState<KqSupportCard|null>(null);
 const [policy,setPolicy]=useState<KqOnlinePrice>('advised');
 const [channel,setChannel]=useState<KqSalesChannel>('online');
 const [stockId,setStockId]=useState('');
 const [restartPrompt,setRestartPrompt]=useState(false);
 const [storageWarning,setStorageWarning]=useState(false);
 const [scenario,setScenario]=useState('normal');
 const dialog=useRef<HTMLDialogElement>(null), heading=useRef<HTMLHeadingElement>(null);
 useBodyScrollLock(true);
 useEffect(()=>{const element=dialog.current,previous=document.activeElement;element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 // A failed browser-storage write is an external I/O result that must be shown to the player.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try{sessionStorage.setItem(kqTrialStorageKey(userId),JSON.stringify({version:KQ_TRIAL_VERSION,actions:saved.actions}));}catch{setStorageWarning(true);}},[saved.actions,userId]);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});},[s.chapter,g?.stageIndex,g?.phase]);
 const heritage=KQ_HERITAGE_CARDS.find(h=>h.code==='HERITAGE-007')!;
 const stock=c.stocks.find(item=>item.id===stockId&&item.remainingUnits>0)??c.stocks.find(item=>item.remainingUnits>0);
 const offer=stock?quoteKqCommerce(c,stock,channel,policy,undefined,s.clock):null;
 const previewBusiness=c.business??createKqBusinessPreview(s.clock);
 const salePayment=offer?previewKqBusinessPayment(offer.payoutCents,previewBusiness,s.electricity):null;
 const comparisonBusiness={...previewBusiness,shop:{name:'Le shop d’essai',createdAt:new Date(s.clock).toISOString(),paidUntil:new Date(s.clock+KQ_GAME_MONTH_MS).toISOString(),active:true,renew:true}};
 const shopActive=Boolean(c.business&&isKqShopActive(c.business,s.clock));
 const comparison=stock?quoteKqCommerce({...c,business:comparisonBusiness,computerOwned:true,reputation:scenario==='reputation'?1500:c.reputation,campaign:c.campaign?{...c.campaign,internetPaid:true,reputation:scenario==='reputation'?1500:c.campaign.reputation,event:scenario==='promotion'?'promotion':c.campaign.event}:null}, {...stock,juryScore:scenario==='quality'?4:stock.juryScore},'online',policy,undefined,s.clock):null;
 const last=s.receipts.at(-1);
 const situation=g?getKqSituation(g):null;
 const situationArtwork=situation&&(g?.phase==='prepare'||g?.phase==='rolled')?getKqSituationArtwork(situation.code,Boolean(g?.powerOutage)):null;
 const prediction=g?.phase==='rolled'?previewKqResolution(g):null;
 const cardButton=(card:KqSupportCard,playing=false)=>{
  const art=getKqCardArtwork(card.code), permission=trialCardPermission(s,card.code);
  return <article key={card.code} className={styles.card}>
   <button className={styles.art} type="button" onClick={()=>setDetail(card)} aria-haspopup="dialog" aria-label={`Lire ${card.name}`}>{art?<Image src={art} alt={card.name} width={240} height={360} sizes="200px"/>:null}</button>
   <h3>{card.name}</h3><small>{card.xpCost} XP · {card.timing==='before-roll'?'Préparation':'Réaction'}</small><p>{card.description}</p>
   {playing?<><button type="button" data-trial-card={card.code} disabled={!permission.allowed} onClick={()=>dispatch({type:'play',code:card.code})}>Jouer cette copie d’essai</button>{!permission.allowed?<small>{permission.reason}</small>:null}</>:null}
  </article>;
 };
 return <dialog ref={dialog} className={styles.dialog} data-arena-journey-ui data-trial-chapter={s.chapter} aria-labelledby="trial-title" onCancel={event=>{event.preventDefault();if(!detail)onPause();}}>
  <header className={styles.top}><span><Compass aria-hidden="true"/> LE PLACARD · PARTIE D’ESSAI</span><button type="button" disabled={busy} onClick={onPause} aria-label="Mettre l’essai en pause"><X aria-hidden="true"/> <span>Pause</span></button></header>
  <div className={styles.layout}>
   <aside className={styles.coach}>
    <Image src="/contest/mascot/arena-scene-carnet-v1.png" alt="Sylvain t’accompagne dans l’arène" width={640} height={360} sizes="(max-width: 760px) 100vw, 320px"/>
    <span className={styles.kicker}>AVEC SYLVAIN · {s.chapter+1} / {KQ_TRIAL_CHAPTERS.length}</span>
    <h2 id="trial-title" ref={heading} tabIndex={-1}>{KQ_TRIAL_CHAPTERS[s.chapter]}</h2>
    <p className={styles.instruction}>{s.chapter===4?trialInstruction(s):INTRO[s.chapter]}</p>
    <progress aria-label="Avancement de l’essai" value={s.chapter} max={9}/>
    <p className={styles.sandbox}>Matériel, cartes et euros fictifs. Aucun classement, badge ni récompense réelle.</p>
    <details><summary>Retrouver les étapes</summary><ol>{KQ_TRIAL_CHAPTERS.map((label,index)=><li key={label} aria-current={index===s.chapter?'step':undefined}>{index<s.chapter?'✓ ':''}{label}</li>)}</ol></details>
    {s.chapter>0&&s.chapter<9?<button type="button" className={styles.subtle} onClick={()=>setRestartPrompt(true)}><RotateCcw size={16}/> Recommencer l’essai</button>:null}
    {restartPrompt?<div role="alert"><p>Repartir du début efface uniquement la progression de cet essai.</p><button type="button" onClick={()=>{dispatch({type:'restart'});setRestartPrompt(false);}}>Recommencer</button><button type="button" onClick={()=>setRestartPrompt(false)}>Continuer cet essai</button></div>:null}
   </aside>
   <main className={styles.main}>
    <div className={styles.wallet} aria-label="Compte de démonstration"><span>Budget fictif <strong>{euro(c.cashCents)}</strong></span><span>Réputation <strong>{c.reputation}</strong></span><span>Clients <strong>{c.clients}</strong></span><span>Shops <strong>{c.shopPartners}</strong></span></div>
    {storageWarning?<p role="status">La sauvegarde locale est indisponible. Garde cette page ouverte pour terminer l’essai.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {s.chapter===0?<section className={styles.panel}>
     <h3>Un tour complet, à ton rythme</h3><p>Prépare tes cartes, achète et installe une LED, joue les six étapes de culture, rencontre le jury, transforme puis vends ton lot.</p>
     <p>Le scénario et les premières mains sont préparés pour apprendre. Les cartes et les calculs utilisent les règles du jeu. Les résultats d’une vraie partie varieront.</p>
     <p>Pour comparer les débouchés, l’essai te prête aussi 200 points de réputation, 8 clients et 2 shops. Ce ne sont pas les valeurs de départ de ton vrai compte.</p>
     <h3>Le Carnet reste lié à tes vraies dégustations</h3><p>Tu y notes uniquement les fleurs réellement goûtées. Les objectifs du Carnet et les missions du Placard peuvent rapporter des récompenses selon leurs conditions.</p>
     <button type="button" onClick={()=>dispatch({type:'check',value:'notebook'})}>{s.checked.includes('notebook')?'✓ Compris':'J’ai compris : Carnet réel, essai fictif'}</button>
     <p><small>Tu peux mettre l’essai en pause et le reprendre avec Guide dans l’arène, depuis ce même onglet.</small></p>
    </section>:null}
    {s.chapter===1?<>
     <div className={styles.grid}>
      <article className={styles.panel}><Leaf size={52} aria-hidden="true"/><h3>{KQ_TRIAL_BUDDIE.name}</h3><strong>Rareté Or · +{KQ_TRIAL_BUDDIE.advantageLevel} XP au départ</strong><p>Le Buddie détermine ta variété et son bonus initial. Commun : +0 ; Argent : +1 ; Or : +2 ; Épique : +3 ; Légendaire : +4 XP.</p><button type="button" data-trial-check="buddie" onClick={()=>dispatch({type:'check',value:'buddie'})}>{s.checked.includes('buddie')?'✓ Buddie choisi':'Choisir le Buddie fictif'}</button></article>
      <article className={styles.panel}><Image src={getKqCardArtwork(heritage.code)!} alt="Héritage de démonstration" width={160} height={240}/><h3>{heritage.name}</h3><p>{heritage.description}</p><p>Un seul Héritage équipé, hors de la main. Celui-ci s’active une fois par culture, sans brûler la carte.</p><button type="button" data-trial-check="heritage" onClick={()=>dispatch({type:'check',value:'heritage'})}>{s.checked.includes('heritage')?'✓ Héritage équipé':'Équiper l’Héritage prêté'}</button></article>
     </div>
     <h3>9 cartes La Botte + une réserve anti-ravageurs</h3><p>Une main contient jusqu’à 5 cartes. Seules les copies jouées sont consommées. Clique sur une carte pour lire son coût, son timing et ses limites. La Chrysope reste en réserve, hors du deck, jusqu’au diagnostic.</p>
     <div className={styles.cards}>{[...KQ_TRIAL_DECK,'BOTTE-002'].map(code=>cardButton(KQ_CARDS.find(card=>card.code===code)!))}</div>
     <button type="button" data-trial-check="deck" onClick={()=>dispatch({type:'check',value:'deck'})}>{s.checked.includes('deck')?'✓ Deck prêt':'Préparer ce deck d’essai'}</button>
    </>:null}
    {s.chapter===2?<>
     <Image className={styles.scene} src="/placard/booster-shop-counter-v5.webp" alt="Le comptoir de la boutique La Botte" width={1000} height={650} sizes="(max-width: 760px) 100vw, 800px"/>
     <section className={styles.panel}><h3>{getKqEquipmentDefinition('LED-300')!.name}</h3><p>{getKqEquipmentDefinition('LED-300')!.benefit}</p><p>{getKqEquipmentDefinition('LED-300')!.tradeoff} La qualité maximale n’est pas garantie : tes réussites en culture comptent aussi.</p><button type="button" disabled={s.bought} onClick={()=>dispatch({type:'buy'})}>{s.bought?'✓ LED achetée':`Acheter pour ${euro(getKqEquipmentDefinition('LED-300')!.priceCents)} fictifs`}</button></section>
     <details><summary>Packs, collection, niveaux et prérequis</summary><p>Les packs La Botte enrichissent ta collection. Les filtres aident à choisir les cartes adaptées. Les doublons fournissent des copies consommables ; les Héritages sont permanents.</p><p>Le catalogue matériel affiche les bonus, les charges, les prérequis et les améliorations. Les niveaux supérieurs coûtent davantage ; une machine achetée doit être installée pour servir.</p></details>
    </>:null}
    {s.chapter===3?<>
     <Image className={styles.scene} src="/placard/warehouse-v2/room.webp" alt="L’entrepôt et ses espaces de culture, de transformation et de séchage" width={1774} height={887} sizes="(max-width: 760px) 100vw, 800px"/>
     <div className={styles.grid}>{['LED-300','DRYING-ROOM','SIFT-TRAY'].map(code=>{const item=getKqEquipmentDefinition(code)!;return <article className={styles.panel} key={code}><h3>{item.name}</h3><p>{item.benefit}</p><small>{code==='LED-300'?'Remplace la lampe de départ.':'Prêté gratuitement pour cet essai.'}</small><button type="button" data-trial-install={code} disabled={s.installed.includes(code)} onClick={()=>dispatch({type:'install',code})}>{s.installed.includes(code)?'✓ Installé':'Installer'}</button></article>;})}</div>
     <fieldset><legend>Choisis ton régime d’énergie</legend>{Object.entries(KQ_ENERGY_MODES).map(([mode,value])=><label key={mode}><input type="radio" name="trial-energy" checked={s.mode===mode} onChange={()=>dispatch({type:'mode',mode:mode as typeof s.mode})}/>{value.name} · {value.label}</label>)}</fieldset>
     <p>Facture estimée de cette culture : <strong>{euro(quoteKqEnergy(KQ_TRIAL_EQUIPMENT,{},s.mode).totalCents)}</strong>. Les installations s’appliquent à la prochaine culture.</p>
     <details><summary>Charges, entretien et sécurité</summary><p>L’électricité dépend de ton installation et du mode choisi. Les factures peuvent être prélevées progressivement sur les ventes. Le site coûte 1 000 € à créer, puis 100 € tous les 30 jours de jeu (5 jours réels), premier mois inclus. Une journée de jeu dure 4 heures réelles et le temps continue hors connexion. L’analyse coûte 45 € par tente et par culture terminée, à payer sous 5 jours réels. Dans ton entrepôt, tu peux passer à 2, 3 ou 4 tentes, puis ouvrir un second entrepôt pour atteindre 8 tentes. La récolte et les frais de matériel, d’amélioration, de remplacement, d’électricité, de soins et d’analyse sont multipliés par le nombre de tentes. La qualité reste liée à ta culture. La TVA de jeu à 20 % est incluse dans les prix et mise de côté sur les ventes.</p><p>Le matériel de culture s’use définitivement : l’éco le préserve, l’intensif l’use davantage, surtout sous 30 % d’état. À 0 %, il termine sa culture puis perd ses bonus. Rachète-le dans l’entrepôt pour le remettre à neuf en conservant ses niveaux. Ce remplacement reste payant pour le Bricoleur. Le kit de départ permet de continuer à cultiver.</p><p>Les machines de transformation demandent un entretien périodique distinct : leurs réparations sont gratuites pour le Bricoleur. Les protections limitent les pertes ; le chien a des frais de nourriture et un vétérinaire tous les 10 cycles.</p><p>Le séchoir améliore la régularité et, à certains niveaux, le potentiel de qualité. Il consomme aussi de l’électricité.</p></details>
    </>:null}
    {s.chapter===4&&g&&situation?<>
     <div className={styles.stages}>{KQ_STAGES.map((name,i)=><span key={name} data-active={i===g.stageIndex}>{i<g.stageIndex?'✓ ':''}{name}</span>)}</div>
     <section className={styles.panel}><span className={styles.kicker}>ÉTAPE {g.stageIndex+1} / 6 · {g.phase==='prepare'?'AVANT LES DÉS':g.phase==='rolled'?'APRÈS LES DÉS':'VERDICT'}</span><div className={styles.cultureScene} data-has-art={!!situationArtwork}>{situationArtwork?<Image key={situationArtwork.src} data-trial-situation={situation.code} src={situationArtwork.src} alt={situationArtwork.alt} width={768} height={768} sizes="(max-width: 760px) calc(100vw - 56px), 320px" loading="eager"/>:null}<div><h3>{situation.name}</h3><p>{situation.story}</p></div></div><p><strong>{getKqStageTarget(g)} réussites demandées</strong> · XP disponibles : {g.xp} · Qualité : {g.quality} · Pression : {g.pressure}/4</p><p>1 = Danger · 2–3 = neutre · 4–5 = réussite · 6 = Étincelle, une réussite et +1 XP au verdict. À partir de 3 Pression, la difficulté augmente.</p>
      <p>Étapes à 0 réussite : <strong>{getKqZeroSuccessStageCount(g)}/2</strong>. La culture meurt dès la deuxième, même si elles ne se suivent pas.</p>
      {g.dice?<div className={styles.dice} aria-label={`Dés : ${g.dice.join(', ')}`}>{g.dice.map((die,i)=><span key={i} data-value={die}>{die}<small>{die===1?'Danger':die===6?'Étincelle':die>=4?'Réussite':'Neutre'}</small></span>)}</div>:null}
      {prediction?<p role="status">Prévision : <strong>{KQ_OUTCOME_LABELS[prediction.outcome]}</strong> · {prediction.total}/{prediction.target} réussites · {prediction.dangers} Danger non protégé</p>:null}
      {g.phase==='prepare'?<button type="button" data-trial-action="roll" disabled={!canTrialRoll(s)} onClick={()=>dispatch({type:'roll'})}>Lancer les dés</button>:null}
      {g.phase==='rolled'?<><button type="button" data-trial-action="heritage" disabled={!canActivateKqHeritage(g).allowed} onClick={()=>dispatch({type:'heritage'})}>{g.heritageUsed?'Héritage déjà utilisé':'Activer mon Héritage'}</button><button type="button" data-trial-action="resolve" disabled={!canTrialResolve(s)} onClick={()=>dispatch({type:'resolve'})}>Valider le résultat</button></>:null}
      {g.phase==='resolved'&&outcomeArtwork&&outcomeArtwork.outcome!=='dead'?<>
       <div className={styles.outcome} data-outcome={outcomeArtwork.outcome} data-outcome-stage={outcomeArtwork.stage} role="status">
        <span key={outcomeArtwork.src} className={styles.outcomeArtwork}><Image src={outcomeArtwork.src} alt={outcomeArtwork.alt} fill sizes="(max-width: 760px) 170px, 220px"/></span>
        <div><h3>{KQ_OUTCOME_LABELS[outcomeArtwork.outcome]}</h3><p>{g.history.at(-1)?.trait} · +{g.history.at(-1)?.xpGain??0} XP · {g.history.at(-1)?.qualityDelta??0} Qualité</p></div>
       </div>
       <button type="button" data-trial-action="advance" onClick={()=>dispatch({type:'advance'})}>{g.stageIndex===5?'Découvrir ma récolte':'Passer à l’étape suivante'}</button>
      </>:null}
      {cultureDead?<>
       <div className={styles.outcome} data-outcome="dead" data-outcome-stage={outcomeArtwork?.stage} role="status">
        {outcomeArtwork?.outcome==='dead'?<span className={styles.outcomeArtwork}><Image src={outcomeArtwork.src} alt={outcomeArtwork.alt} fill sizes="(max-width: 760px) 240px, 280px"/></span>:null}
        <div><h3>Culture morte</h3><p>Deux étapes à 0 réussite : ta culture est terminée, sans récolte. Recommence avec ton installation d’essai pour poursuivre le tutoriel.</p></div>
       </div>
       <button type="button" data-trial-action="restart-culture" onClick={()=>dispatch({type:'restart-culture'})}>Recommencer la culture d’essai</button>
      </>:null}
     </section>
     {g.effectNotices?.length?<ul className={styles.notices} aria-live="polite">{g.effectNotices.slice(-3).map((notice,i)=><li key={`${i}-${notice}`}>{notice}</li>)}</ul>:null}
     {g.phase==='prepare'||g.phase==='rolled'?<><h3>Ta main · une préparation, puis une réaction au maximum</h3><p>{g.stageIndex<3?'Les premières actions sont guidées ; les choix seront libres dès la Floraison.':'Tu peux conserver tes cartes. Lis les limites avant de dépenser ton XP.'}</p>
      <div className={styles.cards}>{[...new Set(getKqHandCodes(g))].map(code=>cardButton(KQ_CARDS.find(card=>card.code===code)!,true))}</div>
      {g.stageIndex>=3&&g.phase==='prepare'?<button type="button" disabled={!!g.preparationPlayed||(g.handRedrawsUsed??0)>=1} onClick={()=>dispatch({type:'redraw'})}>Changer de main · 1 fois par culture</button>:null}
      {g.revealedPest?<><h3>Diagnostic : pucerons · réserve anti-ravageurs</h3><div className={styles.cards}>{cardButton(KQ_CARDS.find(card=>card.code==='BOTTE-002')!,true)}</div></>:null}
     </>:null}
    </>:null}
    {s.chapter===5&&g?<section className={styles.panel}><Leaf size={50} aria-hidden="true"/><h3>{g.varietyName} · récolte fictive</h3><div className={styles.wallet}><span>Quantité <strong>{number(g.harvestGrams??0)} g</strong></span><span>Qualité de culture <strong>{g.quality}</strong></span><span>Facture d’énergie <strong>{euro(s.electricity)}</strong></span></div><p>Ce score de culture n’est pas encore la note commerciale sur 10. Le jury compare les caractéristiques de ta fleur.</p><ul>{g.history.map(h=><li key={h.stage}>{h.stage} : {KQ_OUTCOME_LABELS[h.outcome]} · {h.trait}</li>)}</ul><p>{g.usedCards.length} copies fictives jouées. Les copies conservées restent disponibles en vraie partie ; le Buddie et l’Héritage ne sont pas consommés.</p></section>:null}
    {s.chapter===6?<section className={styles.panel}><h3>Ta fleur face à Sylvain</h3><p>En entraînement, pas d’adversaire à attendre et aucun effet sur le classement. Ici, les deux fleurs sont fictives.</p>{!s.battle?<button type="button" data-trial-action="duel" onClick={()=>dispatch({type:'duel'})}>Engager le duel d’entraînement</button>:<>
     {s.battle.rounds.slice(0,s.rounds).map(round=><article className={styles.round} key={round.code}><h3>{round.label}</h3><p>{round.explanation}</p><strong>Toi {number(round.playerScore)} · Sylvain {number(round.opponentScore)}</strong><p>{round.winner==='player'?'Tu remportes cette manche.':'Sylvain remporte cette manche.'}</p></article>)}
     {s.rounds<3?<button type="button" data-trial-action="round" onClick={()=>dispatch({type:'round'})}>Découvrir la manche {s.rounds+1}</button>:<><h3>{s.battle.winner==='player'?'Duel gagné !':'Sylvain gagne ce duel.'}</h3><p>Note de ton lot : <strong>{number(trialQuality(s))}/10</strong>. Elle détermine les filières accessibles et l’accueil de tes acheteurs.</p><p>La carte Fleur ne peut servir qu’à un duel. Son lot reste disponible pour la valorisation et la vente.</p></>}
    </>}</section>:null}
    {s.chapter===7?<><p className={styles.highlight}>Qualité du lot : {number(trialQuality(s))}/10 · {number(g?.harvestGrams??0)} g récoltés</p><div className={styles.grid}>{trialRoutes(s).map(q=><article className={styles.panel} key={q.route}><h3>{q.name}</h3><p>{q.description}</p><p>Seuil : {number(q.minimumJuryScore)}/10 · Produit obtenu : {number(q.productGrams)} g</p>{q.remainderGrams>0?<p>Reste : {number(q.remainderGrams)} g en {q.remainderDestination==='raw'?'fleurs brutes':'biomasse'}, à vendre séparément.</p>:null}<button type="button" data-trial-route={q.route} disabled={!q.available} onClick={()=>dispatch({type:'transform',route:q.route})}>Choisir cette valorisation</button>{q.blockedReason?<small>{q.blockedReason}</small>:null}</article>)}</div><p>Les grammes perdus à l’extraction ne sont pas des invendus. Le prix final dépend ensuite du circuit, de la qualité et de la demande.</p></>:null}
    {s.chapter===8?<>
     <section className={styles.panel}><h3>Ton accès à la vente directe</h3><button type="button" disabled={c.computerOwned} onClick={()=>dispatch({type:'computer'})}>{c.computerOwned?'✓ Ordinateur acheté':`Acheter l’ordinateur · ${euro(KQ_COMPUTER_PRICE_CENTS)} fictifs`}</button><button type="button" disabled={!c.computerOwned||shopActive||c.cashCents<KQ_SHOP_CREATION_CENTS} onClick={()=>dispatch({type:'internet'})}>{shopActive?'✓ Shop d’essai ouvert':`Créer le site · ${euro(KQ_SHOP_CREATION_CENTS)} fictifs`}</button><p>Dans ta vraie partie, tu économises auprès des professionnels avant d’ouvrir ton shop. Le site coûte ensuite 100 € tous les 5 jours réels, premier mois inclus. Ton shop d’essai reçoit un nom fictif ; tu choisiras celui de ta vraie boutique.</p></section>
     {stock?<>
      <label className={styles.stock}>Lot à vendre<select value={stock.id} onChange={event=>setStockId(event.target.value)}>{c.stocks.filter(stock=>stock.remainingUnits>0).map(stock=><option key={stock.id} value={stock.id}>{KQ_MARKET_ROUTES.find(route=>route.code===stock.route)?.name} · {number(stock.remainingUnits/10)} g · {number(stock.juryScore)}/10</option>)}</select></label>
      <p className={styles.highlight}>Qualité : {number(stock.juryScore)}/10 · Stock restant : {number(stock.remainingUnits/10)} g</p>
      <fieldset><legend>Ton prix en ligne</legend>{(['discovery','advised','premium'] as const).map(value=><label key={value}><input type="radio" name="trial-price" checked={policy===value} onChange={()=>setPolicy(value)}/>{value==='discovery'?'Découverte : prix réduit, plus de demande':value==='premium'?'Premium : prix élevé, moins de demande':'Conseillé : équilibre prix / commandes'}</label>)}</fieldset>
      <div className={styles.grid}>{KQ_SALES_CHANNELS.map(code=>{const info=KQ_CHANNELS[code],q=quoteKqCommerce(c,stock,code,policy,undefined,s.clock),demand=getKqCommerceReplenishment(c,code,s.clock);return <article key={code} className={styles.channel} data-selected={channel===code}><Image src={info.image} alt="" width={320} height={200} sizes="(max-width:760px) 100vw, 280px"/><div><h3>{info.name}</h3><p>{info.description}</p><strong>{euro(q.unitCents)}/g · {number(q.units/10)} g repris</strong><p>{euro(q.payoutCents)} TTC avant charges</p>{demand?<p>Commandes disponibles : {Math.round(demand.availableFraction*100)} %</p>:null}<button type="button" aria-pressed={channel===code} onClick={()=>setChannel(code)}>{channel===code?'Circuit choisi':'Comparer ce circuit'}</button>{q.reason?<small>{q.reason}</small>:null}</div></article>;})}</div>
      {offer?<section className={styles.panel}><h3>Offre · {KQ_CHANNELS[channel].name}</h3><p>{offer.message}</p><p>{number(offer.units/10)} g pour {euro(offer.payoutCents)} TTC. TVA mise de côté : {euro(salePayment?.vatCents??0)}. Analyses échues réglées : {euro(salePayment?.labPaidCents??0)}. Électricité réglée : {euro(salePayment?.electricityPaidCents??0)}. Net versé : {euro(salePayment?.netPayoutCents??0)}.</p><button type="button" data-trial-action="sell" disabled={!!offer.reason||offer.units<=0} onClick={()=>dispatch({type:'sell',stockId:stock.id,channel,policy})}>Confirmer cette vente fictive</button></section>:null}
      <button type="button" className={styles.subtle} onClick={()=>dispatch({type:'wait'})}>Simuler 4 heures d’attente</button><p><small>Horloge accélérée uniquement dans l’essai. En jeu, les commandes se reconstituent progressivement : 4 h en ligne, 12 h pour les shops. Le grossiste n’a pas de quota.</small></p>
     </>:<p className={styles.highlight}><Check aria-hidden="true"/> Tout le stock d’essai est vendu.</p>}
     {last?<section className={styles.receipt} role="status"><h3>{SATISFACTION[last.satisfaction]}</h3><p>Vente TTC : {euro(last.payoutCents)} · TVA réservée : {euro(last.vatCents??0)} · Analyses réglées : {euro(last.labPaidCents??0)} · Électricité réglée : {euro(last.electricity)} · Net : <strong>{euro(last.net)}</strong></p><p>Clients : {last.clientsBefore} → {last.clientsAfter} · Shops : {last.shopPartnersBefore} → {last.shopPartnersAfter} · Réputation : {last.reputationDelta>=0?'+':''}{last.reputationDelta}</p><p>Un acheteur satisfait ne crée pas forcément un client ou un shop à chaque petite vente : les volumes et les plafonds de progression comptent.</p></section>:null}
     {stock&&comparison?<details><summary>Essaie aussi un autre contexte de vente</summary><p>Comparaison pédagogique, sans modifier ton lot ni tes ventes. L’ordinateur et le shop sont supposés actifs dans cet aperçu.</p><label>Scénario<select value={scenario} onChange={event=>setScenario(event.target.value)}><option value="normal">Conditions actuelles</option><option value="quality">Qualité faible : 4/10</option><option value="promotion">Concurrents en promotion</option><option value="reputation">Réputation à 1 500</option></select></label><p role="status">{comparison.reason??`${number(comparison.units/10)} g commandés à ${euro(comparison.unitCents)}/g. ${SATISFACTION[comparison.satisfaction]}. Clients : ${comparison.clientsBefore} → ${comparison.clientsAfter}.`}</p><p>Compare le prix et le volume : monter sa réputation n’efface pas une mauvaise qualité, et baisser son prix ne garantit pas de tout vendre.</p></details>:null}
     <details><summary>Réputation, saturation et fidélisation</summary><p>Une qualité insuffisante peut entraîner un refus, une baisse de prix ou des départs. Les shops prennent davantage mais paient moins ; leur barème évolue avec la qualité et le réseau. Les grossistes reprennent tout à prix réduit.</p><p>La réputation progresse par paliers, pas à chaque clic. Elle améliore les prix en ligne ; aux hauts paliers le prix est mieux protégé, mais tout vendre n’est jamais garanti. Les événements et la saturation changent aussi la demande.</p><ul>{KQ_REPUTATION_TIERS.map(tier=><li key={tier.minimum}>{tier.minimum} · {tier.name}</li>)}</ul><p>Les gains de clientèle et de partenaires sont limités sur 24 h. Recommencer une culture ne recharge pas immédiatement le marché.</p></details>
    </>:null}
    {s.chapter===9?<section className={styles.panel}><Check size={48} aria-hidden="true"/><h3>Première boucle accomplie</h3><p>Préparer → installer → cultiver → passer devant le jury → valoriser → vendre → investir.</p><p>{number(g?.harvestGrams??0)} g récoltés · {number(trialQuality(s))}/10 au jury · {s.receipts.length} ventes fictives.</p><p>Ton budget de démonstration finit à {euro(c.cashCents)}. Facture d’énergie encore due : {euro(s.electricity)}. Un chiffre d’affaires élevé n’est pas un bénéfice : pense aux achats et aux charges.</p><h3>Choisis ton prochain objectif</h3><p>Dans les Missions, retrouve les objectifs et les packs à gagner. Ta carte de chanvrier dans l’arène rassemble ton parcours, tes succès et tes badges. Un triple 6, une belle culture ou un bon duel peuvent faire progresser différents succès.</p><p>Ton avantage personnel s’applique dans ta vraie partie : Main Verte +2 XP par culture, Trésorier 1 000 € au départ et un livret à 5 % toutes les 24 h, Commercial pour une capacité de vente et des recettes ×1,5, Bricoleur pour les réparations gratuites.</p><button type="button" disabled={busy} onClick={onComplete}>{busy?'Enregistrement…':'Terminer le tutoriel'}</button><button type="button" className={styles.subtle} onClick={()=>dispatch({type:'restart'})}>Rejouer l’essai</button></section>:null}
    {canTrialContinue(s)?<footer className={styles.next}><button type="button" data-trial-action="next" onClick={()=>dispatch({type:'next'})}>{s.chapter===3?'Lancer ma culture d’essai':s.chapter===8?'Découvrir mon bilan':'Continuer'}<ArrowRight size={18}/></button></footer>:null}
    {s.chapter===9?<p><Link href="/arene/placard" onClick={onPause}>Retrouver mon vrai Placard</Link></p>:null}
   </main>
  </div>
  {detail?<KqBotteCardDetail card={detail} copies={1} onClose={()=>setDetail(null)}/>:null}
 </dialog>;
}
