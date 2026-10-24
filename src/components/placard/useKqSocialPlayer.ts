"use client";

import { useEffect, useState } from "react";
import { DEFAULT_KQ_SOCIAL_PLAYER, getKqSocialPlayer } from "@/lib/kanab-quest-social-player";
import { useKqTutorialApi } from "./KqTutorialApiContext";

/** Presentation-only identity; never submitted with social commands or stored in their history. */
export function useKqSocialPlayer() {
  const api = useKqTutorialApi();
  const [identity, setIdentity] = useState({ api, player: DEFAULT_KQ_SOCIAL_PLAYER });
  useEffect(() => {
    let active = true, generation = 0;
    let controller: AbortController | undefined;
    const load = async () => {
      const current = ++generation;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await api.request("/api/arena/placard/social/player", { cache: "no-store", signal: controller.signal });
        const player = response.ok ? getKqSocialPlayer(await response.json()) : DEFAULT_KQ_SOCIAL_PLAYER;
        if (active && current === generation) setIdentity({ api, player });
      } catch {
        if (active && current === generation) setIdentity({ api, player: DEFAULT_KQ_SOCIAL_PLAYER });
      }
    };
    void load();
    const unsubscribe = api.subscribe(["arena:profile-updated"], () => void load());
    const resume = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; controller?.abort(); unsubscribe(); document.removeEventListener("visibilitychange", resume); };
  }, [api]);
  return identity.api === api ? identity.player : DEFAULT_KQ_SOCIAL_PLAYER;
}
