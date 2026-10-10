import type { Ref } from "react";

export type ArenaProfileLauncherHandle = {
  open: (origin: HTMLElement) => void;
};

export type ArenaProfileAvailability = "loading" | "ready" | "error" | "blocked";

export type ArenaProfileLauncherProps = {
  launcherRef?: Ref<ArenaProfileLauncherHandle>;
  onProfileAvailabilityChange?: (state: ArenaProfileAvailability) => void;
};
