import { DEFAULT_CHANVRIER_APPEARANCE, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqStaffCandidate } from "@/lib/kanab-quest-staff-types";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";

const avatar = (gender: ChanvrierAvatarProfile["gender"], skin: ChanvrierAvatarProfile["skin"], clothing: ChanvrierAvatarProfile["clothing"], appearance: Partial<typeof DEFAULT_CHANVRIER_APPEARANCE>): ChanvrierAvatarProfile => ({ gender, skin, clothing, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, ...appearance } });
const STAFF_AVATARS: Record<string, ChanvrierAvatarProfile> = {
  anna: avatar("female", "ivory", "sage", { hair: "ponytail", hairColor: "ginger", face: "round", top: "overalls" }),
  mael: avatar("male", "peach", "blue", { hair: "curls", hairColor: "chestnut", face: "square", top: "tee" }),
  lucie: avatar("female", "honey", "ochre", { hair: "bun", hairColor: "black", accessory: "round-glasses", top: "shirt" }),
  samira: avatar("female", "brown", "teal", { hair: "braids", hairColor: "black", top: "jacket" }),
  yann: avatar("male", "ivory", "sage", { hair: "quiff", hairColor: "silver", facialHair: "moustache", top: "overalls" }),
  nora: avatar("female", "copper", "berry", { hair: "bob", hairColor: "black", top: "apron" }),
  jo: avatar("male", "peach", "ochre", { hair: "buzz", hairColor: "chestnut", facialHair: "stubble", top: "apron" }),
  ines: avatar("female", "honey", "violet", { hair: "long", hairColor: "chestnut", top: "shirt" }),
  hugo: avatar("male", "ivory", "blue", { hair: "quiff", hairColor: "blond", top: "hoodie" }),
  lea: avatar("female", "peach", "teal", { hair: "bob", hairColor: "silver", accessory: "glasses", top: "shirt" }),
  malik: avatar("male", "ebony", "ochre", { hair: "crop", hairColor: "black", accessory: "round-glasses", top: "jacket" }),
};

/** One portrait identity across recruitment, the work plan and the workshop. */
export function KqStaffPortrait({ person, view = "portrait" }: { person: Pick<KqStaffCandidate, "code" | "portraitCode">; view?: "full" | "portrait" }) {
  return <ChanvrierAvatar profile={STAFF_AVATARS[person.portraitCode ?? person.code] ?? STAFF_AVATARS.anna} view={view} />;
}
