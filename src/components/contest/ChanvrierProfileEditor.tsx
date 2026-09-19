"use client";
import { useEffect, useRef, useState } from "react";
import { Leaf, Coins, Handshake, Wrench, Check, ArrowRight, X, Shuffle, RotateCcw } from "lucide-react";
import { CHANVRIER_APPEARANCE_OPTIONS, getChanvrierAppearance, CHANVRIER_CLOTHES, CHANVRIER_SKINS, CHANVRIER_STRENGTHS, type ChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./ChanvrierProfileEditor.module.css";
const ICONS = [Leaf, Coins, Handshake, Wrench];
const LOOK_TABS = [{ code: "face", label: "Visage" }, { code: "hair", label: "Cheveux" }, { code: "outfit", label: "Tenue" }, { code: "details", label: "Accessoires" }] as const;
const LOOK_FIELDS: Record<typeof LOOK_TABS[number]["code"], { key: keyof ChanvrierAppearance; label: string }[]> = {
  face: [{ key: "face", label: "Forme du visage" }, { key: "eyes", label: "Forme des yeux" }, { key: "eyeColor", label: "Couleur des yeux" }, { key: "eyebrows", label: "Sourcils" }, { key: "nose", label: "Nez" }, { key: "mouth", label: "Expression" }],
  hair: [{ key: "hair", label: "Coupe de cheveux" }, { key: "hairColor", label: "Couleur des cheveux et de la barbe" }, { key: "facialHair", label: "Barbe et moustache" }],
  outfit: [{ key: "top", label: "Haut" }, { key: "bottom", label: "Bas" }, { key: "bottomColor", label: "Couleur du bas" }, { key: "shoes", label: "Chaussures" }, { key: "shoeColor", label: "Couleur des chaussures" }],
  details: [{ key: "accessory", label: "Accessoire" }],
};
const NEW_LOOK: ChanvrierAppearance = { ...getChanvrierAppearance({ gender: "male" }), hairColor: "black", mouth: "grin", top: "tee", bottomColor: "teal", shoes: "work" };
export function ChanvrierProfileEditor({ profile, onSaved, onClose }: { profile: ChanvrierProfile | null; onSaved: (profile: ChanvrierProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ChanvrierProfile>(profile ?? { nickname: "", gender: "male", clothing: "ochre", skin: "ivory", strength: "green-thumb", appearance: NEW_LOOK });
  const [portraitView, setPortraitView] = useState<"full" | "portrait">("full");
  const [step, setStep] = useState<"look" | "strength">("look");
  const [lookTab, setLookTab] = useState<typeof LOOK_TABS[number]["code"]>("face");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === draft.strength)!;
  const appearance = getChanvrierAppearance(draft);
  const changeAppearance = (key: keyof ChanvrierAppearance, value: string) => setDraft(current => ({ ...current, appearance: { ...getChanvrierAppearance(current), [key]: value } }));
  const randomize = () => {
    const next = { ...appearance };
    for (const key of Object.keys(CHANVRIER_APPEARANCE_OPTIONS) as (keyof ChanvrierAppearance)[]) {
      const choices = CHANVRIER_APPEARANCE_OPTIONS[key];
      Object.assign(next, { [key]: choices[Math.floor(Math.random() * choices.length)].code });
    }
    setDraft(current => ({ ...current, appearance: next, skin: CHANVRIER_SKINS[Math.floor(Math.random() * CHANVRIER_SKINS.length)].code, clothing: CHANVRIER_CLOTHES[Math.floor(Math.random() * CHANVRIER_CLOTHES.length)].code }));
  };
  useBodyScrollLock(true);
  useEffect(() => { const modal = dialog.current; const previous = document.activeElement as HTMLElement | null; modal?.showModal(); return () => { modal?.close(); previous?.focus?.(); }; }, []);
  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/arena/chanvrier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, appearance }), signal: AbortSignal.timeout(15000) });
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
        <ChanvrierAvatar profile={draft} className={styles.avatar} view={portraitView} />
        <div className={styles.viewControls} aria-label="Vue du personnage"><button type="button" aria-pressed={portraitView === "full"} onClick={() => setPortraitView("full")}>En pied</button><button type="button" aria-pressed={portraitView === "portrait"} onClick={() => setPortraitView("portrait")}>Zoom visage</button></div>
        <div className={styles.identity}><small>{draft.gender === "female" ? "Chanvrière" : "Chanvrier"} de l’Arène</small><strong>{draft.nickname || "Ton histoire commence ici"}</strong><span>{strength.name} · {strength.badge}</span></div>
      </aside>
      <section className={styles.controls}>
        <small className={styles.eyebrow}>{profile ? "Ton profil de joueur" : "Bienvenue dans l’Arène"} · {step === "look" ? "1 / 2" : "2 / 2"}</small>
        <h2 id="chanvrier-title">{step === "look" ? "Qui entre dans l’arène ?" : "À chacun sa force."}</h2>
        <p>{step === "look" ? "Un surnom, un style, puis ta spécialité. Donne vie à ton personnage." : "Quatre façons de construire ton aventure. Choisis l’avantage qui te ressemble."}</p>
        {step === "look" ? <>
          <label className={styles.nickname}>Ton surnom<input autoComplete="nickname" value={draft.nickname} maxLength={24} placeholder="Ex. Sylvain29" onChange={event => setDraft({ ...draft, nickname: event.target.value })} /><small>3 à 24 caractères : lettres sans accent, chiffres, . _ -</small></label>
          <fieldset><legend>Silhouette</legend><div className={styles.gender}>{([ ["male", "Masculine"], ["female", "Féminine"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={draft.gender === value} onClick={() => setDraft({ ...draft, appearance, gender: value })}>{label}{draft.gender === value ? <Check size={16} /> : null}</button>)}</div></fieldset>
          <nav className={styles.lookTabs} aria-label="Personnaliser l’apparence">{LOOK_TABS.map(tab => <button key={tab.code} type="button" aria-pressed={lookTab === tab.code} onClick={() => setLookTab(tab.code)}>{tab.label}</button>)}</nav>
          <div className={styles.lookTools}><button type="button" onClick={randomize}><Shuffle size={15} />Au hasard</button><button type="button" onClick={() => setDraft(current => ({ ...current, gender: profile?.gender ?? "male", clothing: profile?.clothing ?? "ochre", skin: profile?.skin ?? "ivory", appearance: profile ? getChanvrierAppearance(profile) : NEW_LOOK }))}><RotateCcw size={15} />Réinitialiser</button></div>
          {lookTab === "face" ? <fieldset><legend>Couleur de peau</legend><div className={styles.swatches}>{CHANVRIER_SKINS.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.skin === item.code} onClick={() => setDraft({ ...draft, skin: item.code })}>{draft.skin === item.code ? <Check /> : null}</button>)}</div></fieldset> : null}
          {lookTab === "outfit" ? <fieldset><legend>Couleur du haut</legend><div className={styles.swatches}>{CHANVRIER_CLOTHES.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.clothing === item.code} onClick={() => setDraft({ ...draft, clothing: item.code })}>{draft.clothing === item.code ? <Check /> : null}</button>)}</div></fieldset> : null}
          {LOOK_FIELDS[lookTab].map(({ key, label }) => <fieldset key={key}><legend>{label}</legend><div className={"color" in CHANVRIER_APPEARANCE_OPTIONS[key][0] ? styles.swatches : styles.choices}>{CHANVRIER_APPEARANCE_OPTIONS[key].map(item => <button key={item.code} type="button" aria-label={`${label} : ${item.name}`} title={item.name} aria-pressed={appearance[key] === item.code} style={"color" in item ? { backgroundColor: item.color } : undefined} onClick={() => changeAppearance(key, item.code)}>{"color" in item ? appearance[key] === item.code ? <Check /> : null : <>{item.name}{appearance[key] === item.code ? <Check size={14} /> : null}</>}</button>)}</div></fieldset>)}
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
