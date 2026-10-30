"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Leaf, Coins, Handshake, Wrench, Check, ArrowLeft, ArrowRight, X, Shuffle, RotateCcw } from "lucide-react";
import { CHANVRIER_APPEARANCE_OPTIONS, getChanvrierAppearance, parseChanvrierProfile, CHANVRIER_CLOTHES, CHANVRIER_SKINS, CHANVRIER_STRENGTHS, type ChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ARENA_RELEVE_LETTER, ARENA_RELEVE_SCENES } from "@/lib/arena-releve";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import { KqChapterHeading } from "../placard/KqChapterHeading";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";
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
type Step = "inheritance" | "look" | "strength" | "review";
const STEP_LABELS: Record<Step, string> = { inheritance: "Héritage", look: "Personnage", strength: "Spécialité", review: "Départ" };

export function ChanvrierProfileEditor({ profile, onSaved, onClose }: { profile: ChanvrierProfile | null; onSaved: (profile: ChanvrierProfile) => void; onClose: () => void }) {
  const api = useKqTutorialApi();
  const isArrival = !profile && !api.isTutorial;
  const steps: Step[] = profile ? ["look", "review"] : isArrival ? ["inheritance", "look", "strength", "review"] : ["look", "strength", "review"];
  const [draft, setDraft] = useState<ChanvrierProfile>(profile ?? { nickname: "", gender: "male", clothing: "ochre", skin: "ivory", strength: "green-thumb", appearance: NEW_LOOK });
  const [portraitView, setPortraitView] = useState<"full" | "portrait">("portrait");
  const [step, setStep] = useState<Step>(isArrival ? "inheritance" : "look");
  const [lookTab, setLookTab] = useState<typeof LOOK_TABS[number]["code"]>("face");
  const [confirmedStrength, setConfirmedStrength] = useState(false);
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const titleId = useId();
  const nicknameHintId = useId();
  const nicknameErrorId = useId();
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === draft.strength)!;
  const appearance = getChanvrierAppearance(draft);
  const stepIndex = steps.indexOf(step);
  const validNickname = /^[A-Za-z0-9._-]{3,24}$/.test(draft.nickname.trim());
  const nicknameError = nicknameTouched && !validNickname;
  const selectLookTab = (tab: typeof LOOK_TABS[number]["code"]) => {
    setLookTab(tab);
    setPortraitView(tab === "outfit" ? "full" : "portrait");
  };
  const changeStep = (next: Step) => {
    if (inFlight.current) return;
    setStep(next);
    setError("");
    setPortraitView(next === "strength" || next === "review" || lookTab === "outfit" ? "full" : "portrait");
  };
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
  useEffect(() => {
    const modal = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    modal?.showModal();
    return () => { modal?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      dialog.current?.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    if (!error) return;
    errorMessage.current?.focus({ preventScroll: true });
    errorMessage.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [error]);

  const save = async () => {
    if (inFlight.current || step !== "review" || !validNickname || (!profile && !confirmedStrength)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.request("/api/arena/chanvrier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, nickname: draft.nickname.trim(), appearance }), signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible.");
      const saved = parseChanvrierProfile(body.profile);
      if (!saved) throw new Error("Le personnage enregistré n’a pas pu être chargé. Réessaie.");
      api.notify("kq:equipment-updated");
      api.notify("arena:profile-updated", saved);
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error && reason.name === "TimeoutError" ? "La connexion prend trop de temps. Tes choix sont conservés, réessaie." : reason instanceof Error ? reason.message : "Enregistrement impossible. Réessaie.");
    } finally { inFlight.current = false; setBusy(false); }
  };

  const title = step === "inheritance" ? "La maison de Grand-père" : step === "look" ? profile ? "Ton personnage" : "Qui s’installe au Quartier ?" : step === "strength" ? "Ton coup de pouce" : profile ? "Tes changements" : "Prêt à écrire la suite ?";
  const nextLabel = step === "inheritance" ? "Créer mon personnage" : step === "look" ? profile ? "Vérifier mes changements" : "Choisir ma spécialité" : step === "strength" ? "Vérifier mon départ" : profile ? "Enregistrer mon profil" : api.isTutorial ? "Créer mon personnage d’essai" : "Commencer mon histoire";

  return <dialog ref={dialog} className={styles.dialog} data-chanvrier-profile data-profile-step={step} aria-labelledby={titleId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}>
    <button className={styles.close} type="button" aria-label="Fermer le profil" onClick={onClose} disabled={busy}><X aria-hidden="true" /></button>
    <header className={styles.topbar}>
      <ol className={styles.progress} aria-label={profile ? "Modification du personnage" : "Création du personnage"}>
        {steps.map((item, index) => <li key={item} aria-current={step === item ? "step" : undefined} data-active={step === item || undefined} data-complete={index < stepIndex || undefined}>
          <span className={styles.stepNumber} aria-hidden="true">{index < stepIndex ? <Check size={15} /> : index + 1}</span>
          <span>{item === "review" && profile ? "Vérification" : STEP_LABELS[item]}</span>
        </li>)}
      </ol>
    </header>
    <div className={styles.layout} data-scene={step === "inheritance" || undefined}>
      {step === "inheritance" ? <aside className={styles.storyScene}>
        <Image className={styles.sceneImage} src={ARENA_RELEVE_SCENES.arrival} alt="Sylvain t’attend avec les clés devant la grange aux portes turquoise." width={1536} height={1024} sizes="(max-width: 680px) 100vw, 480px" loading="eager" />
        <p className={styles.sceneCaption}>Sylvain a gardé les clés. Il t’aidera à faire tes premiers pas.</p>
      </aside> : <aside className={styles.portrait} data-view={portraitView}>
        <ChanvrierAvatar profile={draft} className={styles.avatar} view={portraitView} />
        <div className={styles.viewControls} aria-label="Vue du personnage"><button type="button" aria-pressed={portraitView === "full"} onClick={() => setPortraitView("full")} disabled={busy}>En pied</button><button type="button" aria-pressed={portraitView === "portrait"} onClick={() => setPortraitView("portrait")} disabled={busy}>Zoom visage</button></div>
        <div className={styles.identity}><strong>{draft.nickname.trim() || "Ton personnage"}</strong><span>{strength.name} · {strength.badge}</span></div>
      </aside>}
      <section className={styles.controls}>
        <div ref={heading} className={styles.stepHeading} tabIndex={-1}>
          <KqChapterHeading art={step === "strength" ? "culture" : step === "review" ? "warehouse" : "quarter"} title={title} titleId={titleId}>
            <p>{step === "inheritance" ? "Ton grand-père t’a légué sa maison et la grange qui l’accompagne. Tu reviens au Quartier pour y créer ta ferme indoor." : step === "look" ? "Choisis le surnom et le visage que les voisins vont apprendre à connaître." : step === "strength" ? "Cultiver, gérer, vendre ou bricoler : choisis l’avantage qui t’aidera à faire vivre la ferme." : profile ? "Vérifie ton surnom et ton apparence avant d’enregistrer." : "Voici le personnage avec lequel tu vas commencer."}</p>
          </KqChapterHeading>
        </div>
        {step === "inheritance" ? <>
          <div className={styles.letter} aria-label="La lettre de Grand-père">
            {ARENA_RELEVE_LETTER.map((paragraph, index) => <p key={paragraph} className={index === ARENA_RELEVE_LETTER.length - 1 ? styles.signature : undefined}>{paragraph}</p>)}
          </div>
          <p className={styles.note}>Tu pourras retrouver Sylvain dans « La relève · Apprendre à jouer » pour découvrir la ferme et le Quartier.</p>
        </> : step === "look" ? <>
          <label className={styles.nickname}>Ton surnom
            <input autoComplete="nickname" autoCapitalize="none" spellCheck={false} value={draft.nickname} maxLength={24} placeholder="Ex. Sylvain29" aria-invalid={nicknameError || undefined} aria-describedby={`${nicknameHintId}${nicknameError ? ` ${nicknameErrorId}` : ""}`} onBlur={() => setNicknameTouched(true)} onChange={event => setDraft({ ...draft, nickname: event.target.value })} />
            <small id={nicknameHintId}>3 à 24 caractères : lettres sans accent, chiffres, . _ -</small>
            {nicknameError ? <span id={nicknameErrorId} className={styles.fieldError}>Choisis un surnom de 3 à 24 caractères autorisés pour continuer.</span> : null}
          </label>
          <fieldset><legend>Silhouette</legend><div className={styles.gender}>{([["male", "Masculine"], ["female", "Féminine"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={draft.gender === value} onClick={() => setDraft({ ...draft, appearance, gender: value })}>{label}{draft.gender === value ? <Check size={16} aria-hidden="true" /> : null}</button>)}</div></fieldset>
          <nav className={styles.lookTabs} aria-label="Personnaliser l’apparence">{LOOK_TABS.map(tab => <button key={tab.code} type="button" aria-pressed={lookTab === tab.code} onClick={() => selectLookTab(tab.code)}>{tab.label}</button>)}</nav>
          <div className={styles.lookTools}><button type="button" onClick={randomize}><Shuffle size={15} aria-hidden="true" />Au hasard</button><button type="button" onClick={() => setDraft(current => ({ ...current, gender: profile?.gender ?? "male", clothing: profile?.clothing ?? "ochre", skin: profile?.skin ?? "ivory", appearance: profile ? getChanvrierAppearance(profile) : NEW_LOOK }))}><RotateCcw size={15} aria-hidden="true" />Réinitialiser</button></div>
          {lookTab === "face" ? <fieldset><legend>Couleur de peau</legend><div className={styles.swatches}>{CHANVRIER_SKINS.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.skin === item.code} onClick={() => setDraft({ ...draft, skin: item.code })}>{draft.skin === item.code ? <Check aria-hidden="true" /> : null}</button>)}</div></fieldset> : null}
          {lookTab === "outfit" ? <fieldset><legend>Couleur du haut</legend><div className={styles.swatches}>{CHANVRIER_CLOTHES.map(item => <button key={item.code} type="button" style={{ backgroundColor: item.color }} title={item.name} aria-label={item.name} aria-pressed={draft.clothing === item.code} onClick={() => setDraft({ ...draft, clothing: item.code })}>{draft.clothing === item.code ? <Check aria-hidden="true" /> : null}</button>)}</div></fieldset> : null}
          {LOOK_FIELDS[lookTab].map(({ key, label }) => <fieldset key={key}><legend>{label}</legend><div className={"color" in CHANVRIER_APPEARANCE_OPTIONS[key][0] ? styles.swatches : styles.choices}>{CHANVRIER_APPEARANCE_OPTIONS[key].map(item => <button key={item.code} type="button" aria-label={`${label} : ${item.name}`} title={item.name} aria-pressed={appearance[key] === item.code} style={"color" in item ? { backgroundColor: item.color } : undefined} onClick={() => changeAppearance(key, item.code)}>{"color" in item ? appearance[key] === item.code ? <Check aria-hidden="true" /> : null : <>{item.name}{appearance[key] === item.code ? <Check size={14} aria-hidden="true" /> : null}</>}</button>)}</div></fieldset>)}
          <p className={styles.note}>Ton apparence ne change pas tes chances. Tu pourras la modifier, ainsi que ton surnom, plus tard.</p>
        </> : step === "strength" ? <>
          <div className={styles.strengths} aria-label="Choisir une spécialité">{CHANVRIER_STRENGTHS.map((choice, index) => { const Icon = ICONS[index]; return <button type="button" key={choice.code} aria-pressed={draft.strength === choice.code} onClick={() => { setDraft({ ...draft, strength: choice.code }); setConfirmedStrength(false); }}><Icon aria-hidden="true" /><span><small>{choice.stage}</small><strong>{choice.name}</strong><b>{choice.badge}</b></span>{draft.strength === choice.code ? <Check size={18} aria-hidden="true" /> : null}</button>; })}</div>
          <div className={styles.bonus} aria-live="polite"><strong>{strength.name}</strong><p>{strength.description}</p></div>
          <p className={styles.note}><strong>Ce choix est définitif.</strong> Tu pourras le vérifier à l’étape suivante avant de créer ton personnage. Un seul bonus par compte{api.isTutorial ? " d’essai" : ""}.</p>
        </> : <>
          <dl className={styles.reviewList}>
            <div><dt>Surnom</dt><dd>{draft.nickname.trim()}</dd></div>
            <div><dt>Spécialité{profile ? " · définitive" : ""}</dt><dd>{strength.name}</dd></div>
            <div><dt>Avantage</dt><dd>{strength.badge}</dd></div>
          </dl>
          <button type="button" className={styles.editLink} onClick={() => changeStep("look")} disabled={busy}>Modifier mon personnage</button>
          <details className={styles.bonus}><summary>Le détail de ma spécialité</summary><p>{strength.description}</p></details>
          {isArrival ? <div className={styles.starterKit}>
            <h3>De quoi démarrer dans la grange</h3>
            <dl className={styles.starterAreas}><div><dt>Culture</dt><dd>1 m²</dd></div><div><dt>Séchage</dt><dd>1 m²</dd></div><div><dt>Stockage</dt><dd>1 m²</dd></div></dl>
            <p>Ton kit de départ est offert, avec le matériel installé. Tu pourras agrandir ta ferme au fil de ton aventure.</p>
          </div> : null}
          {profile ? <p className={styles.note}>Ton surnom et ton apparence restent modifiables. Ta spécialité est conservée.</p> : <div className={styles.confirmation}>
            <label className={styles.confirmChoice}><input type="checkbox" name="confirm-strength" checked={confirmedStrength} disabled={busy} onChange={event => setConfirmedStrength(event.target.checked)} /><span>Je choisis <strong>{strength.name}</strong> et je comprends que ma spécialité sera définitive.</span></label>
            <p className={styles.note}>{api.isTutorial ? "Ce personnage appartient à ta partie d’essai." : "Ton surnom et ton apparence pourront toujours changer."}</p>
          </div>}
        </>}
        {error ? <p ref={errorMessage} role="alert" tabIndex={-1} className={styles.error}>{error}</p> : null}
      </section>
    </div>
    <footer className={styles.actions}>
      {stepIndex > 0 ? <button type="button" data-profile-back disabled={busy} onClick={() => changeStep(steps[stepIndex - 1])}><ArrowLeft size={17} aria-hidden="true" />Retour</button> : null}
      <button type="button" data-profile-next className={styles.primary} disabled={busy || (step !== "inheritance" && !validNickname) || (step === "review" && !profile && !confirmedStrength)} onClick={() => step === "review" ? void save() : changeStep(steps[stepIndex + 1])}>{busy ? "Enregistrement…" : nextLabel}<ArrowRight size={18} aria-hidden="true" /></button>
    </footer>
  </dialog>;
}
