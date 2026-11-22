import { DEFAULT_CHANVRIER_APPEARANCE, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqStaffCandidate } from "@/lib/kanab-quest-staff-types";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";

const avatar = (gender: ChanvrierAvatarProfile["gender"], skin: ChanvrierAvatarProfile["skin"], clothing: ChanvrierAvatarProfile["clothing"], appearance: Partial<typeof DEFAULT_CHANVRIER_APPEARANCE>): ChanvrierAvatarProfile => ({ gender, skin, clothing, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, ...appearance } });
const STAFF_AVATARS: Record<string, ChanvrierAvatarProfile> = {
  anna: avatar("female", "ivory", "sage", {
    hair: "ponytail", hairColor: "ginger", face: "round", eyes: "bright", eyeColor: "green", nose: "round", top: "overalls",
  }),
  mael: avatar("male", "peach", "blue", {
    hair: "curls", hairColor: "chestnut", face: "square", eyebrows: "thick", nose: "wide", mouth: "grin", top: "tee",
  }),
  lucie: avatar("female", "honey", "ochre", {
    hair: "bun", hairColor: "black", face: "heart", eyes: "round", eyeColor: "hazel", mouth: "calm", accessory: "round-glasses", top: "shirt",
  }),
  samira: avatar("female", "brown", "teal", {
    hair: "braids", hairColor: "black", face: "cheeked", eyebrows: "arched", nose: "wide", eyeColor: "amber", top: "jacket",
  }),
  yann: avatar("male", "ivory", "sage", {
    hair: "quiff", hairColor: "silver", face: "long", eyes: "relaxed", eyeColor: "grey", nose: "round", facialHair: "moustache", top: "overalls",
  }),
  nora: avatar("female", "copper", "berry", {
    hair: "bob", hairColor: "black", face: "pear", eyes: "bright", eyebrows: "thick", nose: "round", mouth: "grin", top: "apron",
  }),
  jo: avatar("male", "peach", "ochre", {
    hair: "buzz", hairColor: "chestnut", face: "angular", eyes: "relaxed", eyeColor: "hazel", nose: "wide", facialHair: "stubble", top: "apron",
  }),
  ines: avatar("female", "honey", "violet", {
    hair: "long", hairColor: "chestnut", face: "oval", eyebrows: "arched", mouth: "grin", eyeColor: "amber", top: "shirt",
  }),
  hugo: avatar("male", "ivory", "blue", {
    hair: "quiff", hairColor: "blond", face: "heart", eyes: "round", eyeColor: "blue", nose: "round", top: "hoodie",
  }),
  lea: avatar("female", "peach", "teal", {
    hair: "bob", hairColor: "silver", face: "long", eyes: "almond", eyebrows: "arched", eyeColor: "grey", mouth: "calm", accessory: "glasses", top: "shirt",
  }),
  malik: avatar("male", "ebony", "ochre", {
    hair: "crop", hairColor: "black", face: "square", eyes: "relaxed", eyebrows: "thick", nose: "round", accessory: "round-glasses", top: "jacket",
  }),
};

type StaffIdentity = Pick<KqStaffCandidate, "code" | "portraitCode">;

/** One portrait identity across recruitment, the work plan and the workshop. */
export function getKqStaffAvatarProfile(person: StaffIdentity) {
  return STAFF_AVATARS[person.portraitCode ?? person.code] ?? STAFF_AVATARS.anna;
}

export function KqStaffPortrait({ person, view = "portrait" }: { person: StaffIdentity & Pick<KqStaffCandidate, "name">; view?: "full" | "portrait" }) {
  return <ChanvrierAvatar profile={getKqStaffAvatarProfile(person)} view={view} label={person.name} />;
}
