import readyCodes from "./buddie-artwork-ready.json";

const modernCodes = new Set<string>(readyCodes);

/** Only approved, locally available scenes replace the original catalog image. */
export function hasModernBuddieArtwork(code: string): boolean {
  return modernCodes.has(code);
}

/** Scene-only assets are also usable inside the separate harvest-card frame. */
export function getBuddieArtwork(code: string, fallbackImageUrl = ""): string {
  return hasModernBuddieArtwork(code)
    ? `/app/kanab-quest/buddies/${code.toLowerCase()}-scene-v2.webp`
    : fallbackImageUrl;
}
