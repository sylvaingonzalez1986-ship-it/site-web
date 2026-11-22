import { isArenaPrelaunch } from "@/lib/arena-opening";
import { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer } from "@/lib/contest-feature-config";
import {
  areKqLaunchApprovalsComplete,
  getKqLaunchApprovals,
  getKqLaunchDossier,
} from "@/lib/kanab-quest-launch-approvals";

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isKqLocalPlayerPreviewEnabled() {
  return process.env.NODE_ENV === "development"
    && isExplicitlyEnabled(process.env.KQ_LOCAL_PLAYER_PREVIEW);
}

export function isKqPublicPlayerApiEnabled() {
  const playerAccessEnabled = isExplicitlyEnabled(process.env.KQ_PLAYER_API_LIVE);
  return playerAccessEnabled && areKqLaunchApprovalsComplete(
    getKqLaunchApprovals(),
    getKqLaunchDossier(),
  );
}

export function isKqPlayerApiEnabled() {
  return isKqLocalPlayerPreviewEnabled() || isKqPublicPlayerApiEnabled();
}

export function isKqGameOpen() {
  if (isArenaPrelaunch()) return false;
  return (isContestFeatureEnabledServer() && !isContestBetaAccessRestrictedServer()) || isKqPlayerApiEnabled();
}
