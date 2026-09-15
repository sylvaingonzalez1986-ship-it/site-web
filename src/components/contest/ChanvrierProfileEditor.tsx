"use client";
import { useEffect, useRef, useState } from "react";
import { Leaf, Coins, Handshake, Wrench, Check, ArrowRight, X } from "lucide-react";
import { CHANVRIER_CLOTHES, CHANVRIER_SKINS, CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./ChanvrierProfileEditor.module.css";
const ICONS = [Leaf, Coins, Handshake, Wrench];
export function ChanvrierProfileEditor({ profile, onSaved, onClose }: { profile: ChanvrierProfile | null; onSaved: (profile: ChanvrierProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ChanvrierProfile>(profile ?? { nickname: "", gender: "male", clothing: "teal", skin: "peach", strength: "green-thumb" });
  const [step, setStep] = useState<"look" | "strength">("look");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === draft.strength)!;
  useBodyScrollLock(true);
  useEffect(() => { const modal = dialog.current; const previous = document.activeElement as HTMLElement | null; modal?.showModal(); return () => { modal?.close(); previous?.focus?.(); }; }, []);
  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/arena/chanvrier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft), signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible.");
      window.dispatchEvent(new Event("kq:equipment-updated"));
      window.dispatchEvent(new CustomEvent("arena:profile-updated", { detail: body.profile }));
      onSaved(body.profile);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Enregistrement impossible. Réessaie."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} className={styles.dialog} data-chanvrier-profile aria-labelledby="chanvrier-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button className={styles.close} type="button" aria-label="Fermer le profil" onClick={onClose} disabled={busy}><X /></button>
    <div className={styles.layout}>
      <aside className={styles.portrait}>
        <span className={styles.stamp}>LA GUILDE DES CHANVRIERS</span>
        <ChanvrierAvatar profile={draft} className={styles.avatar} />
        <div className={styles.identity}><small>{draft.gender === "female" ? "Chanvrière" : "Chanvrier"} de l’Arène</small><strong>{draft.nickname || "Ton histoire commence ici"}</strong><span>{strength.name} · {strength.badge}</span></div>
      </aside>
      <section className={styles.controls}>
        <small className={styles.eyebrow}>{profile ? "Ton profil de joueur" : "Bienvenue dans l’Arène"} · {step === "look" ? "1 / 2" : "2 / 2"}</small>
        <h2 id="chanvrier-title">{step === "look" ? "Qui entre dans l’arène ?" : "À chacun sa force."}</h2>
        <p>{step === "look" ? "Un surnom, un style, puis ta spécialité. Donne vie à ton personnage." : "Quatre façons de construire ton aventure. Choisis l’avantage qui te ressemble."}</p>
        {step === "look" ? <>
          <label className={styles.nickname}>Ton surnom<input autoComplete="nickname" value={draft.nickname} maxLength={24} placeholder="Ex. Sylvain29" onChange={event => setDraft({ ...draft, nickname: event.target.value })} /><small>3 à 24 caractères : lettres sans accent, chiffres, . _ -</small></label>
          <fieldset><legend>Ton personnage</legend><div className={styles.gender}>{([ ["male", "Masculin"], ["female", "Féminin"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={draft.gender === value} onClick={() => setDraft({ ...draft, gender: value })}>{label}{draft.gender === value ? <Check size={16} /> : null}</button>)}</div></fieldset>
          <fieldset><legend>Couleur des vêtements</legend><div className={styles.swatches}>{CHANVRIER_CLOTHES.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.clothing === item.code} onClick={() => setDraft({ ...draft, clothing: item.code })}>{draft.clothing === item.code ? <Check /> : null}</button>)}</div></fieldset>
          <fieldset><legend>Couleur de peau</legend><div className={styles.swatches}>{CHANVRIER_SKINS.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.skin === item.code} onClick={() => setDraft({ ...draft, skin: item.code })}>{draft.skin === item.code ? <Check /> : null}</button>)}</div></fieldset>
          <p className={styles.note}>L’apparence ne change pas tes chances. Tu pourras la modifier plus tard.</p>
        </> : <>
          <div className={styles.strengths}>{CHANVRIER_STRENGTHS.map((choice, index) => { const Icon = ICONS[index]; return <button type="button" key={choice.code} disabled={!!profile && choice.code !== profile.strength} aria-pressed={draft.strength === choice.code} onClick={() => setDraft({ ...draft, strength: choice.code })}><Icon /><span><small>{choice.stage}</small><strong>{choice.name}</strong><b>{choice.badge}</b></span>{draft.strength === choice.code ? <Check size={18} /> : null}</button>; })}</div>
          <div className={styles.bonus} aria-live="polite"><strong>{strength.name}</strong><p>{strength.description}</p></div>
          <p className={styles.note}>{profile ? "Ta spécialité est définitive. Ton surnom et ton apparence restent modifiables." : "Ta spécialité est définitive dès la création du profil. Un seul bonus par compte."}</p>
        </>}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <footer className={styles.actions}>
          {step === "strength" ? <button type="button" disabled={busy} onClick={() => setStep("look")}>Mon apparence</button> : null}
          <button type="button" className={styles.primary} disabled={busy || !/^[A-Za-z0-9._-]{3,24}$/.test(draft.nickname.trim())} onClick={() => step === "look" ? setStep("strength") : void save()}>{busy ? "Enregistrement…" : step === "look" ? "Choisir ma force" : profile ? "Enregistrer mon profil" : "Créer mon chanvrier"}<ArrowRight size={18} /></button>
        </footer>
      </section>
    </div>
  </dialog>;
}
