"use client";
import Image from 'next/image';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Check,Circle,Clock,Diamond,RotateCcw,Sparkles,Square,Triangle,Trophy,X} from 'lucide-react';
import {KQ_SCHOOL_CHALLENGE_VERSION,parseKqSchoolChallengeCommand,getKqSchoolChallengePoints,type KqSchoolChallengeCommand,type KqSchoolChallengeSnapshot,type KqSchoolChallengeFeedback} from '@/lib/kanab-quest-school-challenge';
import {HEMP_QUIZ_BANK_SIZE,HEMP_QUIZ_LEVELS,HEMP_QUIZ_TOPICS} from '@/lib/kanab-quest-hemp-quiz-meta';
import {KqAllocationBar,KqProgressMeter} from './KqVisuals';
import styles from './KqSchoolChallenge.module.css';

const pendingKey=(owner:string)=>'kq-school-challenge-pending:v1:'+owner;
function restorePending(owner:string){try{return parseKqSchoolChallengeCommand(JSON.parse(sessionStorage.getItem(pendingKey(owner))||'null'));}catch{return null;}}
function restorePendingVersion(owner:string){try{return sessionStorage.getItem(pendingKey(owner)+':version');}catch{return null;}}
function clearStoredPending(owner:string){try{sessionStorage.removeItem(pendingKey(owner));sessionStorage.removeItem(pendingKey(owner)+':version');}catch{}}
const points=(value:number)=>value.toLocaleString('fr-FR')+' pts';
const answerShapes=[Triangle,Diamond,Circle,Square];
function References({feedback,onOpen}:{feedback:KqSchoolChallengeFeedback;onOpen:(module:string,passage:string)=>void}){
 return <details className={styles.references}><summary>Fiche et sources</summary><button type="button" onClick={()=>onOpen(feedback.lessonId,feedback.sectionId)}><BookOpen size={18} aria-hidden/>Lire la fiche dans l’encyclopédie</button><ul>{feedback.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.organization} · vérifié le {source.verifiedAt}</small></li>)}</ul></details>;
}
function RoundHeading({round}:{round:NonNullable<KqSchoolChallengeSnapshot['round']>}){
 const level=HEMP_QUIZ_LEVELS.find(item=>item.id===round.level);
 const topic=HEMP_QUIZ_TOPICS.find(item=>item.id===(round.question?.themeId||round.feedback?.question.themeId));
 return <header className={styles.roundHeading}><div className={styles.questionTop}><span>Question <b>{round.questionNumber}</b> / 20</span><strong key={round.score} className={round.status==='feedback'?styles.scoreReveal:undefined}><Trophy size={24} aria-hidden/><span className={styles.srOnly}>Score : </span>{points(round.score)}</strong></div><div className={styles.position}><span>{topic?.title||'Le chanvre'}</span><strong>Niveau {round.level} · {level?.label}</strong></div><ol className={styles.levels} aria-label="Quatre niveaux de cinq questions">{HEMP_QUIZ_LEVELS.map(item=><li key={item.id} data-active={item.id===round.level} data-done={item.id<round.level} aria-current={item.id===round.level?'step':undefined}><span className={styles.levelNumber}>{item.id}</span><span className={styles.levelName} aria-hidden>{item.label}</span><span className={styles.levelDots} aria-hidden>{Array.from({length:5},(_,index)=><i key={index} data-done={(item.id-1)*5+index<round.answeredCount} data-current={(item.id-1)*5+index===round.questionNumber-1}/>)}</span><span className={styles.srOnly}>{item.label}, questions {(item.id-1)*5+1} à {item.id*5}</span></li>)}</ol></header>;
}
function StageArt(){
 return <div className={styles.stageArt} aria-hidden><Image src="/placard/school/quiz-stage-v1.webp" alt="" width={1200} height={800} unoptimized sizes="(max-width:700px) 95vw,50vw"/><span className={styles.stageLight}/><span className={styles.stageLight}/></div>;
}
function Celebration(){
 return <div className={styles.celebration} aria-hidden>{Array.from({length:16},(_,index)=><i key={index}/>)}</div>;
}
function AnswerReveal({feedback}:{feedback:KqSchoolChallengeFeedback}){
 return <ul className={`${styles.options} ${styles.revealedOptions}`} aria-label="Correction des quatre réponses">{feedback.question.options.map((option,index)=>{
  const Shape=answerShapes[index]||Square,correct=option.id===feedback.correctOptionId,selected=option.id===feedback.optionId;
  return <li key={option.id} className={styles.option} data-tone={index+1} data-outcome={correct?'correct':selected?'incorrect':'unused'}><span className={styles.answerMarker} aria-hidden><Shape size={24}/><span>{index+1}</span></span><span>{option.text}{correct||selected?<small className={styles.answerOutcome}>{correct?<Check size={17} aria-hidden/>:<X size={17} aria-hidden/>}{correct?(selected?'Ta réponse · juste':'Bonne réponse'):'Ta réponse · incorrecte'}</small>:null}</span></li>;
 })}</ul>;
}
function AnswerComparison({feedback}:{feedback:KqSchoolChallengeFeedback}){
 return <dl className={styles.answerComparison}><div data-correct={feedback.isCorrect}><dt>{feedback.isCorrect?'Ta réponse est la bonne':'Ta réponse'}</dt><dd>{feedback.question.options.find(option=>option.id===feedback.optionId)?.text}</dd></div>{!feedback.isCorrect?<div data-correct="true"><dt>La bonne réponse</dt><dd>{feedback.question.options.find(option=>option.id===feedback.correctOptionId)?.text}</dd></div>:null}</dl>;
}
export function KqSchoolChallenge({ownerId,onEncyclopedia,onOpen}:{ownerId?:string;onEncyclopedia:()=>void;onOpen:(module:string,passage:string)=>void}){
 const [snapshot,setSnapshot]=useState<KqSchoolChallengeSnapshot|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [pending,setPending]=useState<KqSchoolChallengeCommand|null>(()=>ownerId?restorePending(ownerId):null);
 const [pendingVersion,setPendingVersion]=useState<string|null>(()=>ownerId?restorePendingVersion(ownerId):null);
 const [confirmRestart,setConfirmRestart]=useState(false),[now,setNow]=useState(0);
 const [rejected,setRejected]=useState(false);
 const [reviewFilter,setReviewFilter]=useState<'incorrect'|'all'>('incorrect');
 const [animations,setAnimations]=useState(true);
 const clock=useRef({client:0,server:0}),inFlight=useRef(false),focus=useRef<HTMLDivElement>(null),questionFocus=useRef<HTMLDivElement>(null),feedbackFocus=useRef<HTMLDivElement>(null),migrationFocus=useRef<HTMLDivElement>(null);
 const accept=useCallback((value:KqSchoolChallengeSnapshot)=>{
  if(value.ownerId!==ownerId)throw new Error('Le compte a changé. Recharge l’école pour reprendre avec le bon joueur.');
  clock.current={client:Date.now(),server:Date.parse(value.serverNow)};setNow(Date.now());setSnapshot(value);
 },[ownerId]);
 const load=useCallback(async()=>{
  if(!ownerId){setLoading(false);return;}
  setLoading(true);setError('');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch('/api/arena/placard/school/challenge',{cache:'no-store',signal:controller.signal});const value=await response.json();if(!response.ok)throw new Error(value.error||'La salle de quiz est momentanément indisponible.');accept(value);}catch(cause){setError(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'Connexion interrompue. Ta partie reste conservée.');}finally{clearTimeout(timer);setLoading(false);}
 },[ownerId,accept]);
 useEffect(()=>{void load();},[load]);
 const round=snapshot?.round,question=round?.question,feedback=round?.feedback;
 const obsoleteRound=Boolean(round&&round.contentVersion!==KQ_SCHOOL_CHALLENGE_VERSION);
 const obsoletePending=Boolean(pending&&pendingVersion!==KQ_SCHOOL_CHALLENGE_VERSION);
 const migrationRequired=obsoleteRound||obsoletePending;
 const retryablePending=pending&&!obsoletePending&&(!obsoleteRound||(pending.action==='start'&&pending.replaceRoundId===round?.id))?pending:null;
 useEffect(()=>{if(round?.status!=='question'||migrationRequired)return;const timer=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(timer);},[round?.status,migrationRequired]);
 useEffect(()=>{const target=migrationRequired?migrationFocus.current:round?.status==='complete'?focus.current:round?.status==='feedback'?feedbackFocus.current:questionFocus.current;target?.focus({preventScroll:true});target?.scrollIntoView({block:'start',behavior:'instant'});},[round?.id,round?.questionNumber,round?.status,migrationRequired]);
 const submit=async(command:KqSchoolChallengeCommand)=>{
  if(!ownerId||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setRejected(false);setPending(command);setPendingVersion(KQ_SCHOOL_CHALLENGE_VERSION);
  try{sessionStorage.setItem(pendingKey(ownerId),JSON.stringify(command));sessionStorage.setItem(pendingKey(ownerId)+':version',KQ_SCHOOL_CHALLENGE_VERSION);}catch{}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch('/api/arena/placard/school/challenge',{method:'POST',headers:{'Content-Type':'application/json','X-Kq-School-Owner':ownerId},body:JSON.stringify(command),signal:controller.signal,cache:'no-store'});const value=await response.json();if(!response.ok){setRejected([400,409,422].includes(response.status));throw new Error(value.error||'Cette action n’a pas été confirmée. Réessaie pour retrouver son résultat.');}accept(value);setPending(null);setPendingVersion(null);setConfirmRestart(false);clearStoredPending(ownerId);}catch(cause){setError(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'Connexion interrompue. Ton choix est conservé ; réessaie la même réponse.');}finally{clearTimeout(timer);inFlight.current=false;setBusy(false);}
 };
 const start=()=>{if(!ownerId||inFlight.current)return;if(obsoletePending){clearStoredPending(ownerId);setPending(null);setPendingVersion(null);}void submit({action:'start',requestKey:crypto.randomUUID(),...(round?{replaceRoundId:round.id}:{})});};
 const serverNow=clock.current.server+Math.max(0,now-clock.current.client);
 const elapsed=round?Math.max(0,serverNow-Date.parse(round.openedAt)):0;
 const bonus=Number.isFinite(elapsed)?getKqSchoolChallengePoints(true,elapsed).bonusPoints:0;
 const choice=retryablePending?.action==='answer'&&retryablePending.questionId===question?.id?retryablePending.optionId:'';
 const complete=round?.status==='complete';
 return <section className={styles.challenge} data-school-challenge data-motion={animations?'on':'off'} aria-label="Salle de quiz">
  {error?<div className={styles.error} role="alert"><p>{error}</p>{rejected&&!obsoletePending?<button type="button" disabled={busy} data-challenge-recover onClick={()=>{setPending(null);setPendingVersion(null);setRejected(false);if(ownerId)clearStoredPending(ownerId);void load();}}>Retrouver la partie enregistrée</button>:retryablePending&&snapshot&&!loading?<button type="button" disabled={busy} data-challenge-retry onClick={()=>void submit(retryablePending)}>Retrouver cette validation</button>:<button type="button" disabled={loading} onClick={()=>void load()}>Réessayer la connexion</button>}</div>:null}
  {retryablePending&&snapshot&&!loading&&!error?<p className={styles.pending} role="status">{busy?'Enregistrement…':'Une action attend sa confirmation.'}{!busy?<button type="button" data-challenge-retry onClick={()=>void submit(retryablePending)}>Reprendre l’envoi</button>:null}</p>:null}
  {loading&&!snapshot?<p role="status">Ouverture de la salle de quiz…</p>:null}
  {snapshot&&migrationRequired?<div ref={migrationFocus} tabIndex={-1} className={styles.migration} data-challenge-migration aria-labelledby="challenge-migration-title"><h2 id="challenge-migration-title">Le quiz a changé</h2><p>Une nouvelle banque de {HEMP_QUIZ_BANK_SIZE} questions sur le chanvre t’attend. Commence une nouvelle série ; tes scores de parties terminées restent conservés.</p><button type="button" className={styles.primary} disabled={!ownerId||busy||Boolean(retryablePending)} data-challenge-start data-challenge-migrate onClick={start}>Commencer une nouvelle série<ArrowRight size={20} aria-hidden/></button></div>:null}
  {!round&&!loading&&!migrationRequired?<div className={styles.welcome} data-challenge-lobby>
   <h2>Le grand quiz du chanvre</h2><p className={styles.lobbyFormat}>20 questions · {HEMP_QUIZ_TOPICS.length} thèmes · 4 niveaux</p>
   <StageArt/>
   <div className={styles.lobbyAction}><div className={styles.rules}><span><Check size={20} aria-hidden/><strong>100 pts</strong> par réponse juste</span><span><Clock size={20} aria-hidden/><strong>0 à 50 pts</strong> de bonus en 20 s</span></div><button type="button" className={styles.primary} disabled={!ownerId||busy||Boolean(pending)} data-challenge-start onClick={start}>Commencer les 20 questions<ArrowRight size={20} aria-hidden/></button><p className={styles.small}>Aucune élimination. Tu peux toujours répondre après la fin du bonus.</p><ol className={styles.lobbyLevels} aria-label="Cinq questions par niveau">{HEMP_QUIZ_LEVELS.map(level=><li key={level.id}><span>{level.id}</span>{level.label}</li>)}</ol><p className={styles.small}>{HEMP_QUIZ_BANK_SIZE} questions dans la banque.</p></div>
   <button type="button" className={styles.libraryLink} onClick={onEncyclopedia}><BookOpen size={24} aria-hidden/><span><strong>L’encyclopédie du chanvre</strong><small>Plante, variétés, arômes, graines et usages.</small></span><ArrowRight size={20} aria-hidden/></button>
  </div>:null}
  {round&&!migrationRequired?<>
   {complete?<div ref={focus} tabIndex={-1} className={styles.result} data-challenge-result>
    <StageArt/><div className={styles.resultTitle}><Trophy size={42} aria-hidden/><h2>Partie terminée</h2></div><p className={styles.total}>{points(round.score)}</p><KqProgressMeter label="Bonnes réponses" value={round.correctCount} max={20} valueLabel={round.correctCount+' / 20'}/>
    <ol className={styles.resultTrail} aria-label="Tes vingt réponses">{round.answers.map((answer,index)=><li key={answer.questionId} data-correct={answer.isCorrect}><span>{index+1}</span>{answer.isCorrect?<Check size={17} aria-hidden/>:<X size={17} aria-hidden/>}<span className={styles.srOnly}>{answer.isCorrect?'Bonne réponse':'Réponse incorrecte'}</span></li>)}</ol>
    <dl className={styles.pointTotals}><div><dt>Réponses justes</dt><dd>{points(round.answers.reduce((sum,a)=>sum+a.basePoints,0))}</dd></div><div><dt>Bonus rapidité</dt><dd>{points(round.answers.reduce((sum,a)=>sum+a.bonusPoints,0))}</dd></div></dl>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||Boolean(pending)} data-challenge-replay onClick={start}>Une nouvelle série<RotateCcw size={18} aria-hidden/></button><button type="button" onClick={onEncyclopedia}>Explorer l’encyclopédie</button></div>
    <details className={styles.review}><summary>Revoir mes réponses · {20-round.correctCount} à revoir</summary><div className={styles.reviewFilters} role="group" aria-label="Réponses à revoir"><button type="button" aria-pressed={reviewFilter==='incorrect'} onClick={()=>setReviewFilter('incorrect')}>Mes erreurs ({20-round.correctCount})</button><button type="button" aria-pressed={reviewFilter==='all'} onClick={()=>setReviewFilter('all')}>Les 20 réponses</button></div>{reviewFilter==='incorrect'&&round.correctCount===20?<p>Toutes tes réponses sont justes. Les 20 corrections restent disponibles.</p>:null}{round.answers.map((answer,index)=>reviewFilter==='incorrect'&&answer.isCorrect?null:<details key={answer.questionId} data-challenge-review={answer.questionId}><summary>{answer.isCorrect?<Check size={18} aria-label="Juste"/>:<X size={18} aria-label="Incorrecte"/>}{index+1}. {answer.question.prompt}<strong>{points(answer.awardedPoints)}</strong></summary><AnswerComparison feedback={answer}/><p>{answer.explanation}</p><References feedback={answer} onOpen={onOpen}/></details>)}</details>
    <details className={styles.references}><summary>Voir la répartition des points</summary><KqAllocationBar label="Tes points" items={[{label:'Bonnes réponses',value:round.answers.reduce((sum,a)=>sum+a.basePoints,0),displayValue:points(round.answers.reduce((sum,a)=>sum+a.basePoints,0)),tone:'teal'},{label:'Rapidité',value:round.answers.reduce((sum,a)=>sum+a.bonusPoints,0),displayValue:points(round.answers.reduce((sum,a)=>sum+a.bonusPoints,0)),tone:'gold'}]} emptyLabel="Aucun point cette fois. Tu peux tenter une nouvelle série."/></details>
   </div>:<>
    {question&&round.status==='question'?<div key={question.id} ref={questionFocus} tabIndex={-1} className={styles.questionPanel} data-challenge-question={question.id} aria-label={`Question ${round.questionNumber} sur 20, ${question.prompt}`}>
     <RoundHeading round={round}/>
     <div className={styles.timer} data-challenge-timer data-urgent={bonus>0&&elapsed>=15000} data-expired={bonus===0} aria-live="off"><div><Clock size={18} aria-hidden/><span>{bonus>0?<>Bonus rapidité : jusqu’à <strong>{bonus} pts</strong></>:'Bonus écoulé · 100 pts si la réponse est juste'}</span><span className={styles.seconds}>{Math.max(0,Math.ceil((20000-elapsed)/1000))} s</span></div><div className={styles.timerTrack} aria-hidden><span style={{width:Math.max(0,100-elapsed/200)+'%'}}/></div></div>
     <h2 id="challenge-question-title" className={styles.prompt}>{question.prompt}</h2>
     <p className={styles.answerHint}>Choisis une réponse pour la valider.</p>
     <fieldset aria-labelledby="challenge-question-title" disabled={busy||Boolean(pending)}><legend className={styles.srOnly}>Quatre réponses possibles</legend><div className={styles.options}>{question.options.map((option,index)=>{
      const Shape=answerShapes[index]||Square;
      return <button key={option.id} type="button" className={styles.option} data-challenge-option={option.id} data-challenge-answer data-tone={index+1} data-state={choice===option.id?'selected':'neutral'} disabled={busy||Boolean(pending)} onClick={()=>{if(!busy&&!pending)void submit({action:'answer',requestKey:crypto.randomUUID(),roundId:round.id,questionId:question.id,optionId:option.id});}}><span className={styles.answerMarker} aria-hidden><Shape size={24} strokeWidth={2.5}/><span>{index+1}</span></span><span><span className={styles.srOnly}>Réponse {index+1} : </span>{option.text}{choice===option.id?<small className={styles.choiceLabel}>Réponse envoyée</small>:null}</span></button>;
     })}</div></fieldset>
    </div>:null}
    {feedback?<div key={feedback.questionId} ref={feedbackFocus} tabIndex={-1} className={styles.feedback} data-challenge-feedback={feedback.isCorrect?'correct':'incorrect'} aria-labelledby="challenge-feedback-title"><RoundHeading round={round}/><div className={styles.verdict}>{feedback.isCorrect?<Celebration/>:null}<h2 id="challenge-feedback-title">{feedback.isCorrect?<Check size={30} aria-hidden/>:<X size={30} aria-hidden/>}{feedback.isCorrect?'Bonne réponse !':'Réponse incorrecte'}</h2><strong>+{feedback.awardedPoints} pts</strong></div><p className={styles.reminder}>{feedback.question.prompt}</p><AnswerReveal feedback={feedback}/><p className={styles.explanation}>{feedback.explanation}</p><small className={styles.award}>{feedback.basePoints} pts pour la réponse · {feedback.bonusPoints} pts de rapidité</small><button className={styles.primary} type="button" disabled={busy||Boolean(pending)} data-challenge-next onClick={()=>void submit({action:'next',requestKey:crypto.randomUUID(),roundId:round.id,questionId:feedback.questionId})}>{round.questionNumber===20?'Voir mon résultat':'Question suivante'}<ArrowRight size={19} aria-hidden/></button><small>La prochaine question commence quand tu continues.</small><References feedback={feedback} onOpen={onOpen}/></div>:null}
   </>}
  </>:null}
  {snapshot&&(!round||complete||migrationRequired)?<p className={styles.small}>Meilleur score : {snapshot.completedCount?points(snapshot.bestScore):'aucune partie terminée'} · {snapshot.completedCount} partie{snapshot.completedCount>1?'s':''} terminée{snapshot.completedCount>1?'s':''}.</p>:null}
  <details className={styles.rulesDetails}><summary>Barème et rythme de la partie</summary><p>Une bonne réponse vaut 100 points. Pendant les 20 premières secondes de chaque question, un bonus pouvant atteindre 50 points diminue avec le temps. Une réponse incorrecte vaut zéro. Le bonus est arrondi au point inférieur.</p><p>Tu peux répondre après la fin du bonus et prendre ton temps pour lire les corrections. Une question déjà ouverte garde son chronomètre lorsque tu quittes ou recharges l’école. Ces points ne sont pas la monnaie du Quartier.</p><p>Cinq questions par niveau : {HEMP_QUIZ_LEVELS.map(level=>level.label.toLowerCase()).join(', ')}.</p>{round&&!complete&&!migrationRequired?<button type="button" disabled={busy||Boolean(pending)} onClick={()=>setConfirmRestart(true)}>Abandonner cette série et recommencer</button>:null}</details>
  <button type="button" className={styles.motionToggle} data-challenge-motion aria-pressed={animations} onClick={()=>setAnimations(value=>!value)}><Sparkles size={17} aria-hidden/>Animations {animations?'activées':'coupées'}</button>
  {confirmRestart&&!migrationRequired?<div className={styles.confirm} role="group" aria-label="Confirmer une nouvelle série"><p>Remplacer cette série en cours ? Elle ne comptera pas parmi les parties terminées. Tes anciens scores restent conservés.</p><button type="button" onClick={()=>setConfirmRestart(false)}>Garder ma partie</button><button type="button" disabled={busy} onClick={start}>Commencer une nouvelle série</button></div>:null}
 </section>;
}
