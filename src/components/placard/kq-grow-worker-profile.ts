import { DEFAULT_CHANVRIER_APPEARANCE, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";

/** The visiting worker in the grow room, including its illustrated projection. */
export const GROW_ROOM_VISITOR: ChanvrierAvatarProfile = {
  gender: "male", clothing: "sage", skin: "peach",
  appearance: {
    ...DEFAULT_CHANVRIER_APPEARANCE, face: "pear", eyes: "relaxed", nose: "round",
    hair: "crop", headwear: "sailor-cap", headwearColor: "sage", top: "overalls",
  },
};
