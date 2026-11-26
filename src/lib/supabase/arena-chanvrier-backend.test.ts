import { beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CHANVRIER_APPEARANCE } from "../arena-chanvrier";
import { saveChanvrierProfile } from "./arena-chanvrier-backend";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
const profile = {
  nickname: "Mael", gender: "male", clothing: "teal", skin: "honey", strength: "treasurer",
  appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, dyes: { accent: "#cd8a44" } },
};
beforeEach(() => { rpc.mockReset(); });

it("keeps the new stripe out of an older editor's acknowledgement", async () => {
  rpc.mockResolvedValue({ data: { profile: { ...profile, appearance: {
    ...profile.appearance, dyes: { ...profile.appearance.dyes, stripe: "#346a76" },
  } } } });
  const { profile: response } = await saveChanvrierProfile("owner", profile);
  expect(rpc.mock.calls[0][1].p_profile).not.toHaveProperty("supportsStripe");
  expect(response.appearance?.dyes).toEqual({ accent: "#cd8a44" });
});

it("forwards explicit support when resetting the stripe to its automatic colour", async () => {
  rpc.mockResolvedValue({ data: { profile } });
  await saveChanvrierProfile("owner", { ...profile, supportsStripe: true });
  expect(rpc.mock.calls[0][1].p_profile).toMatchObject({ supportsStripe: true, appearance: profile.appearance });
});
