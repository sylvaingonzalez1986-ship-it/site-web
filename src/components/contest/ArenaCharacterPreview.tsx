"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "@/components/navigation/NavigationLink";
import { CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { createArenaCharacterPreviewRequest } from "@/lib/arena-character-preview";
import { clearChanvrierDraft, getChanvrierPreviewScope, readChanvrierPreviewProfile, writeChanvrierPreviewProfile } from "@/lib/chanvrier-profile-draft";
import { createKqTutorialApi, KqTutorialApiProvider } from "../placard/KqTutorialApiContext";
import { KqChapterHeading } from "../placard/KqChapterHeading";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./ArenaCharacterPreview.module.css";

const subscribeHydration = () => () => undefined;

function CharacterSession({ ownerId, onReset }: { ownerId: string; onReset: () => void }) {
  // Keep the full creation flow, with in-memory requests and private events.
  // This never replaces the signed-in account's profile or grants a real bonus.
  const profileScope = getChanvrierPreviewScope(ownerId, "profile");
  const [profile, setProfile] = useState(() => readChanvrierPreviewProfile(profileScope));
  const [api] = useState(() => ({ ...createKqTutorialApi(createArenaCharacterPreviewRequest(profile)), isTutorial: false }));
  const [open, setOpen] = useState(!profile);
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === profile?.strength);
  const draftScope = getChanvrierPreviewScope(ownerId, profile ? "edit" : "create");
  const reset = () => {
    for (const slot of ["create", "edit", "profile"] as const) clearChanvrierDraft(getChanvrierPreviewScope(ownerId, slot));
    onReset();
  };
  const savePreview = (saved: ChanvrierProfile) => {
    writeChanvrierPreviewProfile(profileScope, saved);
    setProfile(saved);
    setOpen(false);
  };
  return <KqTutorialApiProvider api={api}>
    <section className={styles.sheet}>
      {profile ? <div className={styles.result}>
        <ChanvrierAvatar profile={profile} className={styles.avatar} />
        <div role="status"><h2>{profile.nickname}</h2><p>{strength?.name} · {strength?.badge}</p><p>Ton personnage de test est créé. Tu peux modifier son apparence ou recommencer pour essayer une autre spécialité.</p></div>
      </div> : <p>Cette session démarre avec un personnage vierge et la lettre de Grand-père.</p>}
      <div className={styles.actions}>
        <button type="button" data-preview-open onClick={() => setOpen(true)}>{profile ? "Modifier ce personnage" : "Ouvrir la création"}</button>
        <button type="button" data-preview-reset onClick={reset}>Recommencer à zéro</button>
        <Link href="/arene">Retour au Quartier</Link>
      </div>
      <p className={styles.note}>Tes choix d’essai restent dans cet onglet, même après rechargement.</p>
    </section>
    {open ? <ChanvrierProfileEditor profile={profile} draftScope={draftScope} onClose={() => setOpen(false)} onSaved={savePreview} /> : null}
  </KqTutorialApiProvider>;
}

export function ArenaCharacterPreview({ ownerId }: { ownerId: string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [session, setSession] = useState(0);
  return <main className={styles.page} data-character-preview>
    <div className={styles.content}>
      <KqChapterHeading title="Tester la création du personnage" level={1}>
        <p>Session locale réservée à l’admin. Le parcours complet peut être recommencé autant de fois que tu veux.</p>
      </KqChapterHeading>
      {hydrated && <CharacterSession key={`${ownerId}:${session}`} ownerId={ownerId} onReset={() => setSession(value => value + 1)} />}
    </div>
  </main>;
}
