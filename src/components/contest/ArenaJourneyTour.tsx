"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Compass, UserRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_JOURNEY_STEPS, ARENA_JOURNEY_STEP_COUNT, advanceArenaJourney, arenaJourneyStorageKey, parseArenaJourneyProgress, type ArenaJourneyAction, type ArenaJourneyProgress } from "@/lib/arena-journey";
import styles from "./ArenaJourneyTour.module.css";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierPlayerCard } from "./ChanvrierPlayerCard";

type SavedJourney = {progress:ArenaJourneyProgress;pending:boolean};
function readSaved(userId:string):SavedJourney|null {
  try { const row=JSON.parse(localStorage.getItem(arenaJourneyStorageKey(userId))??"null");const progress=parseArenaJourneyProgress(row?.progress);return progress?{progress,pending:row.pending===true}:null; } catch { return null; }
}
function remember(userId:string,progress:ArenaJourneyProgress,pending:boolean) {
  try { localStorage.setItem(arenaJourneyStorageKey(userId),JSON.stringify({progress,pending}));return true; } catch { return false; }
}
function isAtStep(href:string) {
  const destination=new URL(href,location.origin);
  const current=new URLSearchParams(location.search);
  return location.pathname===destination.pathname && ["view","catalog"].every(key=>current.get(key)===destination.searchParams.get(key));
}

export function ArenaJourneyTour() {
  const [chanvrier,setChanvrier]=useState<ChanvrierProfile|null>(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const {showBanner}=useCookieConsent();
  const [progress,setProgress]=useState<ArenaJourneyProgress|null>(null);
  const [userId,setUserId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [blocked,setBlocked]=useState(false);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);
  const [rect,setRect]=useState<{top:number;left:number;width:number;height:number}|null>(null);
  const [atStep,setAtStep]=useState(false);
  const [retry,setRetry]=useState(0);
  const [loading,setLoading]=useState(true);
  const target=useRef<HTMLElement|null>(null);
  const dialog=useRef<HTMLDialogElement|null>(null);
  const replay=useRef<HTMLButtonElement|null>(null);
  const inFlight=useRef(false);
  const alive=useRef(true);
  const announcedStep=useRef<number|null>(null);
  const step=ARENA_JOURNEY_STEPS[progress?.step??0];
  const active=!!progress && (progress.status==="new"||progress.status==="active") && !showBanner && !profileOpen;
  useBodyScrollLock(active && !blocked && progress?.step===0);

  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let cancelled=false;
    void (async()=>{
      try {
        const response=await fetch("/api/arena/tutorial",{cache:"no-store",signal:controller.signal});
        if(response.status===401||response.status===404)return;
        if(!response.ok)throw new Error("Le guide est momentanément indisponible.");
        const body=await response.json();const remote=parseArenaJourneyProgress(body.progress);
        if(!remote||typeof body.userId!=="string")throw new Error("Le guide est momentanément indisponible.");
        if(cancelled)return;
        const local=readSaved(body.userId);
        const next=local&&(local.pending||!body.persisted)?local.progress:remote;
        if(local?.pending&&body.persisted){
          try {
            const sync=await fetch("/api/arena/tutorial",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next),signal:controller.signal});
            if(sync.ok&&(await sync.json()).persisted)remember(body.userId,next,false);
          } catch { /* Keep the pending browser copy for the next visit. */ }
        }
        if(!cancelled){
          setUserId(body.userId);setProgress(next);setError("");
          const profile=parseChanvrierProfile(body.chanvrier);setChanvrier(profile);
          if(body.chanvrier===null&&location.pathname.startsWith("/arene"))setProfileOpen(true);
        }
      } catch { if(!cancelled)setError("Le guide est momentanément indisponible."); }
      finally {clearTimeout(timer);if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[retry]);

  const act=useCallback(async(action:ArenaJourneyAction)=>{
    if(!progress||!userId||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError("");
    const next=advanceArenaJourney(progress,action);
    const localSaved=remember(userId,next,true);
    let saved=localSaved;
    try {
      const response=await fetch("/api/arena/tutorial",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next),signal:AbortSignal.timeout(5000)});
      if(response.status===401||response.status===404){if(alive.current){setProgress(null);setUserId(null);}return;}
      if(response.ok){const body=await response.json();if(body.persisted){saved=true;remember(userId,next,false);}}
      if(!saved)throw new Error("Impossible de mémoriser cette étape. Réessaie.");
    } catch {
      if(!saved){if(alive.current)setError("Impossible de mémoriser cette étape. Réessaie.");return;}
    } finally {inFlight.current=false;if(alive.current)setBusy(false);}
    if(!alive.current)return;
    setProgress(next);
    if(next.status==="completed"||next.status==="skipped"){requestAnimationFrame(()=>replay.current?.focus());return;}
    if(action!=="restart"&&next.step>0){
      const href=ARENA_JOURNEY_STEPS[next.step].href;
      // A full navigation also resets the Placard's local view, while saved cultures remain on the server.
      if(!isAtStep(href))location.assign(href);
    }
  },[progress,userId]);

  useEffect(()=>{
    if(!active)return;
    document.documentElement.dataset.arenaJourney="active";
    return ()=>{delete document.documentElement.dataset.arenaJourney;};
  },[active]);

  useEffect(()=>{
    if(!active)return;
    let scrolled=false;
    let frame=0;
    const update=()=>{
      const shop=document.querySelector<HTMLElement>("[data-arena-tour-surface='shop']");
      const catalog=document.querySelector<HTMLElement>("[data-arena-tour-surface='catalog']");
      const warehouse=document.querySelector<HTMLElement>("[data-arena-tour-surface='warehouse']");
      const host=step.id==="installation"?warehouse:step.id==="shop"?shop:step.id==="equipment"?catalog??shop:null;
      setPortalHost(host);
      const otherModal=Array.from(document.querySelectorAll("dialog[open],[role='dialog'][aria-modal='true'],[role='alertdialog'][aria-modal='true']"))
        .some((element)=>!element.closest("[data-arena-journey-ui]")&&element!==host&&!(host&&element.contains(host))&&element.getBoundingClientRect().height>0);
      setBlocked(otherModal||!!host?.closest("[data-arena-tour-blocked='true']"));
      const matches=isAtStep(step.href);setAtStep(matches);
      const candidate=matches&&step.target?document.querySelector<HTMLElement>(step.target):null;
      target.current=candidate;
      if(candidate&&!scrolled&&!otherModal){scrolled=true;candidate.scrollIntoView({block:"center",behavior:"instant"});}
      const bounds=candidate?.getBoundingClientRect();
      const next=bounds&&bounds.width>0&&bounds.height>0?{top:Math.max(2,bounds.top-4),left:Math.max(2,bounds.left-4),width:Math.min(innerWidth-4,bounds.width+8),height:Math.min(innerHeight-4,bounds.height+8)}:null;
      setRect(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["open","hidden","aria-hidden","aria-modal","data-placard-view","data-arena-tour-blocked"]});
    window.addEventListener("resize",schedule);window.addEventListener("scroll",schedule,true);window.addEventListener("popstate",schedule);update();
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener("resize",schedule);window.removeEventListener("scroll",schedule,true);window.removeEventListener("popstate",schedule);};
  },[active,step]);

  useEffect(()=>{
    const modal=dialog.current;
    if(!active||blocked||progress?.step!==0||!modal)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modal.showModal();
    return ()=>{modal.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[active,blocked,progress?.step]);

  useEffect(()=>{
    if(!active||blocked||!progress?.step||announcedStep.current===progress.step)return;
    announcedStep.current=progress.step;
    document.getElementById("arena-journey-title")?.focus({preventScroll:true});
  },[active,blocked,progress?.step]);

  if(showBanner)return null;
  const navigation=<footer className={styles.actions}>
    {progress&&progress.step>0?<button type="button" disabled={busy} onClick={()=>void act("previous")} aria-label="Étape précédente"><ArrowLeft size={18}/></button>:null}
    <button type="button" className={styles.primary} disabled={busy} onClick={()=>{
      if(progress?.step&& !atStep){location.assign(step.href);return;}
      void act(progress?.step===0?"start":"next");
    }}>{busy?"Un instant…":progress?.step&&!atStep?"Rejoindre cette étape":step.action}<ArrowRight size={18}/></button>
  </footer>;
  const overlay=active&&!blocked?(progress?.step===0?
    <dialog ref={dialog} className={styles.welcome} data-arena-journey-ui aria-labelledby="arena-journey-title" onCancel={(event)=>{event.preventDefault();void act("skip");}}>
      <Image src="/contest/mascot/arena-scene-carnet-v1.png" alt="" width={640} height={360} className={styles.scene}/>
      <button type="button" className={styles.close} disabled={busy} onClick={()=>void act("skip")} aria-label="Passer le tutoriel"><X size={20}/></button>
      <div className={styles.copy}><span>Bienvenue dans l’Arène</span><h2 id="arena-journey-title">{step.title}</h2><p>{step.text}</p><small>{step.hint}</small>{error?<p role="alert">{error}</p>:null}{navigation}<button type="button" className={styles.skip} disabled={busy} onClick={()=>void act("skip")}>Passer pour le moment</button></div>
    </dialog>:
    <div data-arena-journey-ui data-arena-journey-step={step.id} onKeyDown={(event)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();void act("skip");return;}
      if(event.key!=="Tab"||!portalHost)return;
      const controls=Array.from(portalHost.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href],[tabindex="0"]')).filter(node=>!node.closest('[inert]')&&node.getClientRects().length>0);
      if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
      else if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
    }}>
      {rect?<div className={styles.spotlight} style={rect} aria-hidden="true"/>:null}
      <section className={styles.card} data-position={step.id==="shop"?"top":undefined} aria-labelledby="arena-journey-title">
        <header><span><Compass size={16}/>Parcours guidé · {progress!.step} / {ARENA_JOURNEY_STEP_COUNT}</span><button type="button" disabled={busy} onClick={()=>void act("skip")} aria-label="Passer le tutoriel"><X size={18}/></button></header>
        <div className={styles.progress} aria-label={`Étape ${progress!.step} sur ${ARENA_JOURNEY_STEP_COUNT}`}>{Array.from({length:ARENA_JOURNEY_STEP_COUNT},(_,index)=><i key={index} data-complete={index<progress!.step}/>)}</div>
        <h2 id="arena-journey-title" tabIndex={-1}>{step.title}</h2><p>{step.text}</p>
        {step.highlights?<ul className={styles.highlights}>{step.highlights.map(item=><li key={item}>{item}</li>)}</ul>:null}
        <small>{step.hint}</small>
        {atStep&&target.current instanceof HTMLButtonElement?<button type="button" className={styles.try} onClick={()=>target.current?.click()}>Ouvrir ici · essayer</button>:null}
        {error?<p role="alert">{error}</p>:null}{navigation}
      </section>
    </div>):null;
  return <>
    {!active&&userId&&!profileOpen?(chanvrier?<ChanvrierPlayerCard profile={chanvrier} onEdit={()=>setProfileOpen(true)}/>:<button type="button" className={styles.profileButton} onClick={()=>setProfileOpen(true)}><UserRound size={17}/>Créer mon chanvrier</button>):null}
    {profileOpen&&userId?<ChanvrierProfileEditor profile={chanvrier} onClose={()=>setProfileOpen(false)} onSaved={profile=>{setChanvrier(profile);setProfileOpen(false);}}/>:null}
    {!active&&userId?<button ref={replay} type="button" className={styles.replay} data-arena-guide-trigger disabled={busy} onClick={()=>void act("restart")}><Compass size={17}/>Guide{progress?.status==="completed"?<Check size={15}/>:null}</button>:null}
    {!progress&&error?<div className={styles.loadError} role="status"><p>{loading?"Chargement du profil et du guide…":error}</p><button type="button" disabled={loading} aria-busy={loading} onClick={()=>{setLoading(true);setRetry(value=>value+1);}}>{loading?"Chargement…":"Réessayer"}</button></div>:null}
    {overlay?createPortal(overlay,progress?.step?portalHost??document.body:document.body):null}
  </>;
}
