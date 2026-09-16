"use client";

import dynamic from "next/dynamic";
import { Check, Compass, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { ARENA_JOURNEY_STEP_COUNT, advanceArenaJourney, arenaJourneyStorageKey, parseArenaJourneyProgress, type ArenaJourneyAction, type ArenaJourneyProgress } from "@/lib/arena-journey";
import styles from "./ArenaJourneyTour.module.css";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierPlayerCard } from "./ChanvrierPlayerCard";

const Trial=dynamic(()=>import("../placard/KqGuidedTrial").then(module=>module.KqGuidedTrial),{ssr:false,loading:()=> <p role="status">Chargement de la partie d’essai…</p>});

type SavedJourney = {progress:ArenaJourneyProgress;pending:boolean};
function readSaved(userId:string):SavedJourney|null {
  try { const row=JSON.parse(localStorage.getItem(arenaJourneyStorageKey(userId))??"null");const progress=parseArenaJourneyProgress(row?.progress);return progress?{progress,pending:row.pending===true}:null; } catch { return null; }
}
function remember(userId:string,progress:ArenaJourneyProgress,pending:boolean) {
  try { localStorage.setItem(arenaJourneyStorageKey(userId),JSON.stringify({progress,pending}));return true; } catch { return false; }
}
export function ArenaJourneyTour({ isArenaHome }: { isArenaHome: boolean }) {
  const [chanvrier,setChanvrier]=useState<ChanvrierProfile|null>(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const {showBanner}=useCookieConsent();
  const [progress,setProgress]=useState<ArenaJourneyProgress|null>(null);
  const [userId,setUserId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [loading,setLoading]=useState(true);
  const replay=useRef<HTMLButtonElement|null>(null);
  const inFlight=useRef(false);
  const alive=useRef(true);
  const active=!!progress && (progress.status==="new"||progress.status==="active") && !showBanner && !profileOpen;

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
          if(body.chanvrier===null&&isArenaHome)setProfileOpen(true);
        }
      } catch { if(!cancelled)setError("Le guide est momentanément indisponible."); }
      finally {clearTimeout(timer);if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[retry,isArenaHome]);

  const act=useCallback(async(action:ArenaJourneyAction|"complete")=>{
    if(!progress||!userId||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError("");
    const next: ArenaJourneyProgress=action==="complete"?{step:ARENA_JOURNEY_STEP_COUNT,status:"completed"}:advanceArenaJourney(progress,action);
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
  },[progress,userId]);

  useEffect(()=>{
    if(!active)return;
    document.documentElement.dataset.arenaJourney="active";
    return ()=>{delete document.documentElement.dataset.arenaJourney;};
  },[active]);

  if(showBanner)return null;
  return <>
    {isArenaHome&&!active&&userId&&!profileOpen?(chanvrier?<ChanvrierPlayerCard profile={chanvrier} onEdit={()=>setProfileOpen(true)}/>:<button type="button" className={styles.profileButton} onClick={()=>setProfileOpen(true)}><UserRound size={17}/>Créer mon chanvrier</button>):null}
    {isArenaHome&&profileOpen&&userId?<ChanvrierProfileEditor profile={chanvrier} onClose={()=>setProfileOpen(false)} onSaved={profile=>{setChanvrier(profile);setProfileOpen(false);}}/>:null}
    {isArenaHome&&!active&&userId?<button ref={replay} type="button" className={styles.replay} data-arena-guide-trigger disabled={busy} onClick={()=>void act("restart")}><Compass size={17}/>Guide{progress?.status==="completed"?<Check size={15}/>:null}</button>:null}
    {isArenaHome&&!progress&&error?<div className={styles.loadError} role="status"><p>{loading?"Chargement du profil et du guide…":error}</p><button type="button" disabled={loading} aria-busy={loading} onClick={()=>{setLoading(true);setRetry(value=>value+1);}}>{loading?"Chargement…":"Réessayer"}</button></div>:null}
    {active&&userId?createPortal(<Trial key={userId} userId={userId} busy={busy} error={error} onPause={()=>void act("skip")} onComplete={()=>void act("complete")}/>,document.body):null}
  </>;
}
