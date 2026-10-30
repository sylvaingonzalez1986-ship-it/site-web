"use client";

import { useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { createArenaCharacterPreviewRequest } from "@/lib/arena-character-preview";
import { createKqTutorialApi, KqTutorialApiProvider } from "../placard/KqTutorialApiContext";
import { KqChapterHeading } from "../placard/KqChapterHeading";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./ArenaCharacterPreview.module.css";

function CharacterSession({ onReset }: { onReset: () => void }) {
  // Keep the full creation flow, with in-memory requests and private events.
  // This never replaces the signed-in account's profile or grants a real bonus.
  const [api] = useState(() => ({ ...createKqTutorialApi(createArenaCharacterPreviewRequest()), isTutorial: false }));
  const [profile, setProfile] = useState<ChanvrierProfile | null>(null);
  const [open, setOpen] = useState(true);
  const strength = CHANVRIER_STRENGTHS.find(choice => choice.code === profile?.strength);
  return <KqTutorialApiProvider api={api}>
    <section className={styles.sheet}>
      {profile ? <div className={styles.result}>
        <ChanvrierAvatar profile={profile} className={styles.avatar} />
        <div role="status"><h2>{profile.nickname}</h2><p>{strength?.name} · {strength?.badge}</p><p>Ton personnage de test est créé. Tu peux modifier son apparence ou recommencer pour essayer une autre spécialité.</p></div>
      </div> : <p>Cette session démarre avec un personnage vierge et la lettre de Grand-père.</p>}
      <div className={styles.actions}>
        <button type="button" data-preview-open onClick={() => setOpen(true)}>{profile ? "Modifier ce personnage" : "Ouvrir la création"}</button>
        <button type="button" data-preview-reset onClick={onReset}>Recommencer à zéro</button>
        <Link href="/arene">Retour au Quartier</Link>
      </div>
      <p className={styles.note}>Test local : tes choix restent dans cette page. Ton compte admin, ta progression et tes bonus en ligne sont conservés.</p>
    </section>
    {open ? <ChanvrierProfileEditor profile={profile} onClose={() => setOpen(false)} onSaved={saved => { setProfile(saved); setOpen(false); }} /> : null}
  </KqTutorialApiProvider>;
}

export function ArenaCharacterPreview() {
  const [session, setSession] = useState(0);
  return <main className={styles.page} data-character-preview>
    <div className={styles.content}>
      <KqChapterHeading art="quarter" title="Tester la création du personnage" level={1}>
        <p>Session locale réservée à l’admin. Le parcours complet peut être recommencé autant de fois que tu veux.</p>
      </KqChapterHeading>
      <CharacterSession key={session} onReset={() => setSession(value => value + 1)} />
    </div>
  </main>;
}
