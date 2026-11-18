import type { Group } from "three";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqTournamentPlayer } from "@/lib/kanab-quest-school-tournament";
import { createGrowWorker } from "../kq-grow-worker-model";
import { QUIZZSHOW_SEATS } from "./quizzshow-set";

// Older entrants can have a name and no saved Chanvrier. They get the house costume.
const houseProfile: ChanvrierAvatarProfile = { gender: "male", clothing: "teal", skin: "honey" };

export function createQuizzShowCandidates(group: Group) {
  const actors = new Map<number, {
    model: ReturnType<typeof createGrowWorker>; appearance: string;
    userId: string; active: boolean; answered: boolean; buzzedAt: number;
  }>();
  function update(seats: readonly (KqTournamentPlayer | null)[]) {
    QUIZZSHOW_SEATS.forEach(({ position, yaw }, index) => {
      const player = seats[index];
      let actor = actors.get(index);
      if (!player) {
        actor?.model.dispose();
        actors.delete(index);
        return;
      }
      const profile = player.avatar ?? houseProfile;
      const appearance = JSON.stringify(profile);
      if (!actor) {
        const model = createGrowWorker(profile, { tools: false });
        model.object.position.fromArray(position);
        model.object.rotation.y = yaw;
        group.add(model.object);
        actor = { model, appearance, userId: player.userId, active: player.isActive, answered: player.answered, buzzedAt: -Infinity };
        actors.set(index, actor);
      } else if (actor.appearance !== appearance) {
        actor.model.updateAppearance(profile);
        actor.appearance = appearance;
      }
      if (actor.userId !== player.userId || !player.answered) actor.buzzedAt = -Infinity;
      else if (!actor.answered) actor.buzzedAt = performance.now() / 1000;
      actor.userId = player.userId;
      actor.answered = player.answered;
      actor.active = player.isActive;
      actor.model.object.name = `pupitre-${index + 1}-${player.userId}`;
    });
  }
  return {
    update,
    pose(time?: number) {
      for (const [index, actor] of actors) {
        const phase = time === undefined ? 1 : (time - actor.buzzedAt) / .65;
        const pressing = actor.active && phase >= 0 && phase < 1;
        actor.model.pose(0, 0, pressing ? "card" : null, pressing ? phase : 0, null, undefined, time === undefined || !actor.active ? undefined : time + index * 1.37);
      }
    },
    get moving() { return Array.from(actors.values()).some(actor => actor.active); },
    dispose() {
      actors.forEach(actor => actor.model.dispose());
      actors.clear();
    },
  };
}
