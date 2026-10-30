import { KQ_MISSION_TRACKS, type KqMission, type KqMissionSnapshot } from "./kanab-quest-missions";

export function isKqMissionRewardUnavailable(mission: KqMission, collectionActive: boolean) {
  const kind = mission.reward?.kind ?? "pack";
  return mission.rewardAvailable === false || (mission.rewardAvailable === undefined && kind !== "cash" && !collectionActive);
}

/** Rank the current step of each track, never a later step whose target is already met. */
export function getKqMissionOverview(snapshot: KqMissionSnapshot) {
  const tracks = KQ_MISSION_TRACKS.flatMap(track => {
    const missions = snapshot.missions.filter(mission => mission.track === track).sort((a, b) => a.step - b.step);
    if (!missions.length) return [];
    const current = missions.find(mission => !mission.claimed);
    const state = !current ? "complete" : !current.unlocked ? "locked" : !current.claimable ? "active"
      : isKqMissionRewardUnavailable(current, snapshot.collectionActive) ? "unavailable" : "ready";
    return [{ track, missions, current, state }];
  });
  const priority: Record<string, number> = { ready: 0, active: 1, unavailable: 2, locked: 3, complete: 4 };
  tracks.sort((a, b) => priority[a.state] - priority[b.state]);
  return {
    tracks,
    claimed: snapshot.missions.filter(mission => mission.claimed).length,
    ready: tracks.filter(track => track.state === "ready").length,
    unavailable: tracks.filter(track => track.state === "unavailable").length,
    total: snapshot.missions.length,
  };
}
