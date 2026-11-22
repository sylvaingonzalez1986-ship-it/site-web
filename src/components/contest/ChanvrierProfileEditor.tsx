"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Leaf, Coins, Handshake, Wrench, Check, ArrowLeft, ArrowRight, X } from "lucide-react";
import { getChanvrierAppearance, parseChanvrierProfile, CHANVRIER_OWNER_HEADER, CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ARENA_RELEVE_LETTER, ARENA_RELEVE_SCENES } from "@/lib/arena-releve";
import { NEW_CHANVRIER_PROFILE, clearChanvrierDraft, readChanvrierDraft, writeChanvrierDraft, type ChanvrierDraft, type ChanvrierDraftScope, type ChanvrierProfileStep as Step } from "@/lib/chanvrier-profile-draft";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ChanvrierWorkshopPreview } from "./ChanvrierWorkshopPreview";
import { ChanvrierWardrobe, useChanvrierWardrobe } from "./ChanvrierWardrobe";
import type { ChanvrierWorkshopView } from "./chanvrier-workshop-renderer";
import { KqChapterHeading } from "../placard/KqChapterHeading";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";
import styles from "./ChanvrierProfileEditor.module.css";

const ICONS = [Leaf, Coins, Handshake, Wrench];
const STEP_LABELS: Record<Step, string> = { inheritance: "Héritage", look: "Personnage", strength: "Spécialité", review: "Départ" };
const subscribeHydration = () => () => undefined;
const narrowPortrait = "(max-width: 680px) and (orientation: portrait)";

function subscribeNarrowPortrait(update: () => void) {
  const media = window.matchMedia(narrowPortrait);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

type EditorProps = {
  profile: ChanvrierProfile | null; onSaved: (profile: ChanvrierProfile, createdAt?: string) => void; onClose: () => void;
  onDiscard?: () => void; open?: boolean; skipInheritance?: boolean; draftScope?: ChanvrierDraftScope; ownerId?: string;
};

export function ChanvrierProfileEditor({ open = true, ...props }: EditorProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return hydrated && open ? <ProfileDialog key={props.draftScope?.key ?? `${props.ownerId ?? "local"}:${props.profile ? "edit" : "create"}`} {...props} /> : null;
}

function ProfileDialog({ profile, onSaved, onClose, onDiscard, draftScope, ownerId, skipInheritance = false }: EditorProps) {
  const api = useKqTutorialApi();
  const mobilePortrait = useSyncExternalStore(subscribeNarrowPortrait, () => window.matchMedia(narrowPortrait).matches);
  const isArrival = !profile && !api.isTutorial;
  const showInheritance = isArrival && !skipInheritance;
  const steps: Step[] = profile ? ["look", "review"] : showInheritance ? ["inheritance", "look", "strength", "review"] : ["look", "strength", "review"];
  const initial = profile ?? NEW_CHANVRIER_PROFILE;
  const [editor, setEditor] = useState<ChanvrierDraft & { hasDraft: boolean }>(() => {
    const saved = draftScope && readChanvrierDraft(draftScope, profile);
    return { profile: saved ? saved.profile : initial, step: saved && steps.includes(saved.step) ? saved.step : steps[0], hasDraft: Boolean(saved) };
  });
  const latest = useRef(editor);
  const { profile: draft, step } = editor;
  const [view, setView] = useState<ChanvrierWorkshopView>(step === "look" || step === "inheritance" ? "portrait" : "full");
  const [confirmedStrength, setConfirmedStrength] = useState(false);
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const saveController = useRef<AbortController | null>(null);
  const titleId = useId();
  const nicknameHintId = useId();
  const nicknameErrorId = useId();
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === (profile?.strength ?? draft.strength))!;
  const { gender, clothing, skin, appearance } = draft;
  const look = useMemo(() => ({ gender, clothing, skin, appearance }), [gender, clothing, skin, appearance]);
  const updateEditor = (changes: Partial<ChanvrierProfile>, nextStep?: Step) => {
    const next = { profile: { ...latest.current.profile, ...changes }, step: nextStep ?? latest.current.step };
    if (draftScope) writeChanvrierDraft(draftScope, next);
    latest.current = { ...next, hasDraft: true };
    setEditor(latest.current);
  };
  const wardrobe = useChanvrierWardrobe(look, initial, updateEditor);
  const stepIndex = steps.indexOf(step);
  const validNickname = /^[A-Za-z0-9._-]{3,24}$/.test(draft.nickname.trim());
  const nicknameError = nicknameTouched && !validNickname;
  const changeStep = (next: Step) => {
    if (inFlight.current) return;
    updateEditor({}, next);
    setError("");
    setView(next === "look" ? wardrobe.category.view : "full");
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
      controls.current?.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    if (!error) return;
    errorMessage.current?.focus({ preventScroll: true });
    errorMessage.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [error]);
  useEffect(() => () => saveController.current?.abort(), []);

  const save = async () => {
    if (inFlight.current || step !== "review" || !validNickname || (!profile && !confirmedStrength)) return;
    inFlight.current = true;
    const controller = new AbortController();
    saveController.current = controller;
    setBusy(true);
    setError("");
    const identityHeaders: Record<string, string> = ownerId ? { [CHANVRIER_OWNER_HEADER]: ownerId } : {};
    try {
      const response = await api.request("/api/arena/chanvrier", { method: "POST", headers: { ...identityHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, nickname: draft.nickname.trim(), strength: strength.code, appearance: getChanvrierAppearance(draft) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible.");
      const saved = parseChanvrierProfile(body.profile);
      if (!saved) throw new Error("Le personnage enregistré n’a pas pu être chargé. Réessaie.");
      if (draftScope) clearChanvrierDraft(draftScope);
      let createdAt = typeof body.profile.createdAt === "string" ? body.profile.createdAt : undefined;
      if (!profile && draftScope?.storage === "localStorage" && !createdAt) {
        // The save RPC omits the creation date. A failed reread never undoes a successful save.
        try {
          const current = await api.request("/api/arena/chanvrier", { headers: identityHeaders, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]) });
          const data = current.ok ? await current.json() : null;
          if (data?.profile?.nickname === saved.nickname && typeof data.profile.createdAt === "string") createdAt = data.profile.createdAt;
        } catch { /* The next profile load will recover the creation date. */ }
      }
      if (controller.signal.aborted) return;
      api.notify("kq:equipment-updated");
      api.notify("arena:profile-updated", ownerId ? { ...saved, ownerId } : saved);
      onSaved(saved, createdAt);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error && reason.name === "TimeoutError" ? "La connexion prend trop de temps. Tes choix sont conservés, réessaie." : reason instanceof Error ? reason.message : "Enregistrement impossible. Réessaie.");
    } finally { inFlight.current = false; setBusy(false); }
  };
  const discard = () => {
    if (inFlight.current) return;
    if (draftScope) clearChanvrierDraft(draftScope);
    (onDiscard ?? onClose)();
  };

  const title = step === "inheritance" ? "La maison de Grand-père" : step === "look" ? "Atelier du personnage" : step === "strength" ? "Ton coup de pouce" : profile ? "Tes changements" : "Prêt à écrire la suite ?";
  const nextLabel = step === "inheritance" ? "Créer mon personnage" : step === "look" ? profile ? "Vérifier mes changements" : "Choisir ma spécialité" : step === "strength" ? "Vérifier mon départ" : profile ? "Enregistrer mon profil" : api.isTutorial ? "Créer mon personnage d’essai" : skipInheritance ? "Terminer mon personnage" : "Commencer mon histoire";
  const stepHeading = <div ref={heading} className={styles.stepHeading} tabIndex={-1}>
    <KqChapterHeading title={title} titleId={titleId}>
      {step === "look" ? null : <p>{step === "inheritance" ? "Ton grand-père t’a légué sa maison et la grange qui l’accompagne. Tu reviens au Quartier pour y créer ta ferme indoor." : step === "strength" ? "Cultiver, gérer, vendre ou bricoler : choisis l’avantage qui t’aidera à faire vivre la ferme." : profile ? "Vérifie ton surnom et ton apparence avant d’enregistrer." : "Voici le personnage avec lequel tu vas commencer."}</p>}
    </KqChapterHeading>
  </div>;

  const nicknameField = <label className={styles.nickname} key="nickname">Ton surnom
    <input autoComplete="nickname" autoCapitalize="none" spellCheck={false} value={draft.nickname} maxLength={24} placeholder="Ex. Loic29" aria-invalid={nicknameError || undefined} aria-describedby={`${nicknameHintId}${nicknameError ? ` ${nicknameErrorId}` : ""}`} onBlur={() => setNicknameTouched(true)} onChange={event => updateEditor({ nickname: event.target.value })} />
    <small id={nicknameHintId}>3 à 24 caractères : lettres sans accent, chiffres, . _ -</small>
    {nicknameError ? <span id={nicknameErrorId} className={styles.fieldError}>Choisis un surnom de 3 à 24 caractères autorisés pour continuer.</span> : null}
  </label>;
  const lookEditor = <ChanvrierWardrobe key="wardrobe" wardrobe={wardrobe} profile={look} onViewChange={next => setView(current => current === "village" ? current : next)} />;

  return <dialog ref={dialog} className={styles.dialog} data-chanvrier-profile data-profile-step={step} aria-labelledby={titleId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}>
    <div data-farm-guide-host />
    <header className={styles.topbar}>
      <ol className={styles.progress} aria-label={profile ? "Modification du personnage" : "Création du personnage"}>
        {steps.map((item, index) => <li key={item} aria-current={step === item ? "step" : undefined} data-active={step === item || undefined} data-complete={index < stepIndex || undefined}>
          <span className={styles.stepNumber} aria-hidden="true">{index < stepIndex ? <Check size={15} /> : index + 1}</span>
          <span>{item === "review" && profile ? "Vérification" : STEP_LABELS[item]}</span>
        </li>)}
      </ol>
      <button className={styles.close} type="button" aria-label="Fermer le profil" onClick={onClose} disabled={busy}><X aria-hidden="true" /></button>
    </header>
    <div className={styles.layout} data-scene={step === "inheritance" || undefined} data-workshop={step === "look" || undefined}>
      {step === "look" && stepHeading}
      {step === "inheritance" ? <aside className={styles.storyScene}>
        <Image className={styles.sceneImage} src={ARENA_RELEVE_SCENES.arrival} alt="Loïc t’attend avec les clés devant la grange aux portes turquoise." width={1536} height={1024} sizes="(max-width: 680px) 100vw, 480px" loading="eager" />
        <p className={styles.sceneCaption}>Loïc a gardé les clés. Il t’aidera à faire tes premiers pas.</p>
      </aside> : <ChanvrierWorkshopPreview profile={look} view={view} onViewChange={setView} disabled={busy} />}
      <section ref={controls} className={styles.controls} aria-label={step === "look" ? "Surnom et apparence" : undefined}>
        {step !== "look" && stepHeading}
        {step === "inheritance" ? <>
          <div className={styles.letter} aria-label="La lettre de Grand-père">
            {ARENA_RELEVE_LETTER.map((paragraph, index) => <p key={paragraph} className={index === ARENA_RELEVE_LETTER.length - 1 ? styles.signature : undefined}>{paragraph}</p>)}
          </div>
          <p className={styles.note}>Au début de l’aventure, Loïc te guide pas à pas dans les écrans de ta ferme et du quartier.</p>
        </> : step === "look" ? <>
          {profile && mobilePortrait ? [lookEditor, nicknameField] : [nicknameField, lookEditor]}
          <p className={styles.note}>Ton apparence ne change pas tes chances. Tu pourras la modifier, ainsi que ton surnom, plus tard.</p>
        </> : step === "strength" ? <>
          <div className={styles.strengths} aria-label="Choisir une spécialité">{CHANVRIER_STRENGTHS.map((choice, index) => { const Icon = ICONS[index]; return <button type="button" key={choice.code} aria-pressed={draft.strength === choice.code} onClick={() => { updateEditor({ strength: choice.code }); setConfirmedStrength(false); }}><Icon aria-hidden="true" /><span><small>{choice.stage}</small><strong>{choice.name}</strong><b>{choice.badge}</b></span>{draft.strength === choice.code ? <Check size={18} aria-hidden="true" /> : null}</button>; })}</div>
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
        {(draftScope || onDiscard) && <button type="button" className={styles.editLink} data-profile-discard disabled={busy} onClick={discard}>Abandonner les modifications</button>}
        {draftScope && editor.hasDraft ? <p className={styles.note} data-profile-draft>Brouillon local · à valider</p> : null}
        {error ? <p ref={errorMessage} role="alert" tabIndex={-1} className={styles.error}>{error}</p> : null}
      </section>
    </div>
    <footer className={styles.actions}>
      {stepIndex > 0 ? <button type="button" data-profile-back disabled={busy} onClick={() => changeStep(steps[stepIndex - 1])}><ArrowLeft size={17} aria-hidden="true" />Retour</button> : null}
      <button type="button" data-profile-next className={styles.primary} disabled={busy || (step !== "inheritance" && !validNickname) || (step === "review" && !profile && !confirmedStrength)} onClick={() => step === "review" ? void save() : changeStep(steps[stepIndex + 1])}>{busy ? "Enregistrement…" : nextLabel}<ArrowRight size={18} aria-hidden="true" /></button>
    </footer>
  </dialog>;
}
