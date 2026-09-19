import "server-only";
import { isArenaPrelaunch } from "@/lib/arena-opening";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";

/** This exception permits only the authenticated character GET/POST endpoint. */
export async function isArenaCharacterRequestEnabled(): Promise<boolean> {
  return isArenaPrelaunch() || await isKqPlayerRequestEnabled();
}
