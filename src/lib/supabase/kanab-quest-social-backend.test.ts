import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, random } = vi.hoisted(() => ({ rpc: vi.fn(), random: vi.fn(() => 50) }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock("node:crypto", () => ({ randomInt: random }));
import { getKqSocial, getKqSocialCulture, KqSocialError } from "./kanab-quest-social-backend";
import { createKqSocialSnapshot, type KqSocialCommand, type KqSocialSnapshot } from "../kanab-quest-social";
import { getKqSocialAdventure } from "../kanab-quest-social-adventure";
import { projectKqSocialCultureContext } from "../kanab-quest-social-culture";
import { KQ_SOCIAL_SCENARIOS } from "../kanab-quest-social-stories";
import { getKqSocialProducerNarrative } from "../kanab-quest-social-producer";
import { createKqSocialSnapshot as createV1 } from "../kanab-quest-social-v1";
const id = "12345678-1234-4123-8123-123456789abc", now = Date.parse("2026-10-23T12:00:00Z");
function serverState() {
  const state = createKqSocialSnapshot(now, 80);
  state.platforms.instagram.chapter = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === 'instagram')
    .findIndex(scene => scene.episode === 1 && getKqSocialProducerNarrative(scene.id).requirement === 'culture');
  return state;
}
const envelope = (state = serverState(), replayed = false) => ({ state, reputation: 0, cashCents: 10000, replayed });
const culture = () => ({ runs: [{ id: "run-one", updatedAt: new Date(now).toISOString(), state: {
  varietyCode: "BUD-001", varietyName: "Ma variété plantée", phase: "prepare", stageIndex: 2,
  warehouse: { version: 2, zoneId: "zone-one", zones: [{ id: "zone-one", name: "Mon placard" }] },
  seed: 98765, situationCodes: ["FUTURE-PRIVATE"],
} }], lots: [] });
function choose(snapshot: KqSocialSnapshot = { ...serverState(), culture: projectKqSocialCultureContext(culture(), now, "own") }) {
  const adventure = getKqSocialAdventure(snapshot, "instagram");
  return { modelVersion: 2, action: "choose", requestKey: id, expectedRevision: snapshot.revision,
    platform: "instagram", scenarioId: adventure.scene.id, choiceId: adventure.scene.choices[0].id,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey } as const;
}
let command: ReturnType<typeof choose>;
beforeEach(() => { vi.clearAllMocks(); command = choose(); rpc.mockImplementation(async (name, args) => ({ error: null, data: name.endsWith("commit") ? envelope(args.p_next_state)
  : name === "rpc_kq_social_culture" ? culture() : envelope() })); });
describe("trusted social server engine and atomic persistence", () => {
  it("reads only the authenticated identity and returns a validated projection", async () => {
    const result = await getKqSocial(id);
    expect(result).toMatchObject({ version: 2, audienceFollowers: 80, culture: { source: "own", runs: [{ varietyName: "Ma variété plantée", cultivation: "indoor" }] } });
    expect(rpc).toHaveBeenNthCalledWith(1, "rpc_kq_social_v2_read", { p_user_id: id, p_command: null });
    expect(rpc).toHaveBeenNthCalledWith(2, "rpc_kq_social_culture", { p_user_id: id });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toMatch(/FUTURE-PRIVATE|seed|situationCodes/);
  });
  it("migrates legacy saves without resetting their audience", async () => {
    rpc.mockResolvedValueOnce({ error: null, data: { ...envelope(), state: createV1(now, 90) } });
    expect(await getKqSocial(id)).toMatchObject({ version: 2, audienceFollowers: 90, socialFollowers: 0 });
  });
  it("calculates the outcome on the server, passes CAS revision/audience and never trusts reward input", async () => {
    const result = await getKqSocial(id, command);
    expect(random).toHaveBeenCalledWith(0, 101);
    expect(result.socialFollowers).toBeGreaterThan(0);
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_social_v2_commit", expect.objectContaining({ p_user_id: id, p_command: command, p_expected_revision: 0, p_expected_audience: 80, p_reward_cents: 0,
      p_next_state: expect.objectContaining({ revision: 1, socialFollowers: result.socialFollowers }) }));
    const persisted = rpc.mock.calls.at(-1)![1].p_next_state as KqSocialSnapshot;
    expect(persisted).not.toHaveProperty("culture");
    expect(persisted.history[0]).toMatchObject({ narrativeVersion: 3, subject: { id: "run:run-one", variety: "Ma variété plantée" } });
    expect(result.culture?.runs[0].id).toBe("run-one");
    rpc.mockClear();
    await expect(getKqSocial(id, { ...command, rewardCents: 9000 } as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a committed retry without rerolling, mutating or paying again", async () => {
    rpc.mockResolvedValueOnce({ data: envelope(createKqSocialSnapshot(now), true), error: null });
    const result = await getKqSocial(id, command);
    expect(result.replayed).toBe(true); expect(result.culture?.source).toBe("own");
    expect(rpc).toHaveBeenCalledTimes(2); expect(random).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["rpc_kq_social_v2_read", "rpc_kq_social_culture"]);
  });
  it("never commits a stale or exhausted choice", async () => {
    const s = createKqSocialSnapshot(now); s.energy = 0;
    rpc.mockResolvedValueOnce({ data: envelope(s), error: null });
    await expect(getKqSocial(id, command)).rejects.toMatchObject({ status: 409 });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("surfaces a concurrent commit conflict without retrying another publication", async () => {
    rpc.mockResolvedValueOnce({ data: envelope(), error: null }).mockResolvedValueOnce({ data: culture(), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "social_changed" } });
    await expect(getKqSocial(id, command)).rejects.toMatchObject({ status: 409 });
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("rejects invalid ownership and missing state instead of inventing zero metrics", async () => {
    await expect(getKqSocial("victim")).rejects.toBeInstanceOf(KqSocialError);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { ...envelope(), state: {} }, error: null });
    await expect(getKqSocial(id)).rejects.toMatchObject({ status: 503 });
  });
  it.each([["social_invalid", 400], ["social_profile", 403], ["social_changed", 409], ["social_wallet_limit", 409], ["social_request_mismatch", 409]])("maps %s to a bounded error", async (message, status) => {
    rpc.mockResolvedValue({ data: null, error: { message } }); await expect(getKqSocial(id)).rejects.toMatchObject({ status });
  });
  it("never exposes private database details", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private schema credential" } });
    await expect(getKqSocial(id)).rejects.toMatchObject({ status: 503 });
    await expect(getKqSocial(id)).rejects.not.toThrow("credential");
  });
  it("revalidates the actual culture instead of trusting a stale preview or stored projection", async () => {
    const stale = { ...serverState(), culture: projectKqSocialCultureContext(culture(), now, "own") };
    rpc.mockResolvedValueOnce({ data: envelope(stale), error: null });
    const changed = culture(); changed.runs[0].state.varietyName = "Une autre culture";
    rpc.mockResolvedValueOnce({ data: changed, error: null });
    await expect(getKqSocial(id, choose(stale))).rejects.toMatchObject({ status: 409 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
  });
  it("does not accept client context facts even with a valid preview key", async () => {
    await expect(getKqSocial(id, { ...command, culture: culture() } as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["subjectId", "contextKey"] as const)("rejects a mismatched %s before any commit", async field => {
    await expect(getKqSocial(id, { ...command, [field]: field === "contextKey" ? "v3-stale" : "run:invented" })).rejects.toMatchObject({ status: 409 });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed or incomplete preview bindings before database access", async () => {
    for (const invalid of [{ ...command, contextKey: "unbounded-client-text" }, { ...command, subjectId: undefined }]) {
      await expect(getKqSocial(id, invalid as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("culture read availability", () => {
  it.each([
    { data: null, error: { message: "private schema credential" } },
    { data: { runs: [{}], lots: [] }, error: null },
  ])("keeps unavailable facts unknown rather than asserting an empty farm", async response => {
    rpc.mockResolvedValue(response);
    expect(await getKqSocialCulture(id, now)).toEqual({ version: 1, source: "unknown", observedAt: new Date(now).toISOString(), runs: [], lots: [] });
  });
  it("handles transport failures without leaking details and distinguishes confirmed empty accounts", async () => {
    rpc.mockRejectedValueOnce(new Error("private credentials"));
    expect((await getKqSocialCulture(id, now)).source).toBe("unknown");
    rpc.mockResolvedValueOnce({ data: { runs: [], lots: [] }, error: null });
    expect((await getKqSocialCulture(id, now)).source).toBe("own");
  });
  it("validates identity before reading private culture data", async () => {
    await expect(getKqSocialCulture("another-account", now)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
