"use client";

import { UserRound } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./LeaderboardAvatar.module.css";

export function LeaderboardAvatar({ profile, pseudo }: { profile?: ChanvrierAvatarProfile | null; pseudo: string }) {
  return (
    <span className={styles.frame} role="img" aria-label={`Avatar de ${pseudo}`}>
      <span className={styles.content} aria-hidden="true">
        <UserRound className={styles.fallback} strokeWidth={1.6} />
        {profile ? <ChanvrierAvatar profile={profile} view="portrait" className={styles.portrait} /> : null}
      </span>
    </span>
  );
}
