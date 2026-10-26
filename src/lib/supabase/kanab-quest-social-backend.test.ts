import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, random } = vi.hoisted(() => ({ rpc: vi.fn(), random: vi.fn(() => 50) }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock("node:crypto", () => ({ randomInt: random }));
import { getKqSocial, getKqSocialCulture, KqSocialError } from "./kanab-quest-social-backend";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSponsorOffers, type KqSocialCommand, type KqSocialSnapshot } from "../kanab-quest-social";
import { getKqSocialAdventure } from "../kanab-quest-social-adventure";
import { projectKqSocialCultureContext } from "../kanab-quest-social-culture";
import { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS } from "../kanab-quest-social-stories";
import { getKqSocialProducerNarrative } from "../kanab-quest-social-producer";
import { createKqSocialSnapshot as createV1 } from "../kanab-quest-social-v1";
const id = "12345678-1234-4123-8123-123456789abc", now = Date.parse("2026-10-23T12:00:00Z");
function serverState() {
  const state = createKqSocialSnapshot(now, 80);
  for (const scene of KQ_SOCIAL_SCENARIOS.filter(scene => scene.episode === 1 && scene.id.includes("-debate-"))) state.platforms[scene.platform].memory[scene.id] = scene.choices[0].id;
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
function sponsorReady() {
  const state = createKqSocialSnapshot(now, 5000), sponsor = KQ_SOCIAL_SPONSORS[0];
  Object.assign(state.platforms[sponsor.platform], { followers: 5000, trust: 90, haters: 40 });
  state.socialFollowers = 5000;
  const quote = getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!;
  const accept: KqSocialCommand = { modelVersion: 2, requestKey: id, expectedRevision: 0, action: "sponsor-accept", sponsorId: sponsor.id, expectedRewardCents: quote.rewardCents! };
  return { state, sponsor, accept, rewardCents: quote.rewardCents! };
}
function completedSponsor() {
  const { state, sponsor, accept, rewardCents } = sponsorReady();
  let signed = applyKqSocialCommand(state, accept, now);
  for (const [index, tag] of sponsor.requiredTags.entries()) signed = applyKqSocialCommand(signed, { modelVersion: 2, requestKey: `96000000-0000-4000-8000-00000000000${index + 1}`, expectedRevision: signed.revision, action: "sponsor-post", tag }, now + index * 86_400_000);
  const claim: KqSocialCommand = { modelVersion: 2, requestKey: "96000000-0000-4000-8000-000000000003", expectedRevision: signed.revision, action: "sponsor-claim" };
  return { state: signed, sponsor, claim, rewardCents };
}
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
    expect(persisted).toMatchObject({ cadenceVersion: 1, publicationNow: new Date(now).toISOString(),
      platforms: { instagram: { publishedDay: "2026-10-23", nextPostAt: "2026-10-23T22:00:00.000Z" } } });
    expect(result.culture?.runs[0].id).toBe("run-one");
    rpc.mockClear();
    await expect(getKqSocial(id, { ...command, rewardCents: 9000 } as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a second publication using database time before committing, regardless of a client clock", async () => {
    const state = serverState();
    state.cadenceVersion = 1; state.publicationNow = new Date(now - 86_400_000).toISOString();
    state.platforms.instagram.publishedDay = "2026-10-23"; state.platforms.x.publishedDay = null;
    state.platforms.instagram.nextPostAt = null;
    rpc.mockResolvedValueOnce({ data: envelope(state), error: null });
    await expect(getKqSocial(id, command)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("déjà publié") });
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
    rpc.mockClear();
    await expect(getKqSocial(id, { ...command, publicationNow: now + 86_400_000 } as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a committed retry without rerolling, mutating or paying again", async () => {
    rpc.mockResolvedValueOnce({ data: envelope(createKqSocialSnapshot(now), true), error: null });
    const result = await getKqSocial(id, command);
    expect(result.replayed).toBe(true); expect(result.culture?.source).toBe("own");
    expect(rpc).toHaveBeenCalledTimes(2); expect(random).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["rpc_kq_social_v2_read", "rpc_kq_social_culture"]);
  });
  it("signs the server's dynamic offer and never accepts a different requested fee", async () => {
    const { state, accept, rewardCents } = sponsorReady();
    rpc.mockResolvedValueOnce({ data: envelope(state), error: null });
    const signed = await getKqSocial(id, accept);
    expect(signed.sponsors.active).toMatchObject({ rewardCents, pricing: { version: 1, followers: 5000, trust: 90, haters: 40 } });
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_social_v2_commit", expect.objectContaining({ p_reward_cents: 0,
      p_next_state: expect.objectContaining({ sponsors: expect.objectContaining({ active: signed.sponsors.active }) }) }));
    rpc.mockClear(); rpc.mockResolvedValueOnce({ data: envelope(state), error: null });
    await expect(getKqSocial(id, { ...accept, expectedRewardCents: rewardCents + 500 } as KqSocialCommand)).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
    rpc.mockClear();
    await expect(getKqSocial(id, { ...accept, pricing: signed.sponsors.active!.pricing } as unknown as KqSocialCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rechecks a quoted fee after server pressure decay even when the revision did not change", async () => {
    const { state, accept } = sponsorReady();
    state.serverNow = new Date(now + 2 * 3_600_000).toISOString();
    rpc.mockResolvedValueOnce({ data: envelope(state), error: null });
    await expect(getKqSocial(id, accept)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("montant") });
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
  });
  it("pays the frozen fee above the old cap and a committed retry never pays it twice", async () => {
    const { state, sponsor, claim, rewardCents } = completedSponsor();
    expect(rewardCents).toBeGreaterThan(18_000);
    state.platforms[sponsor.platform].trust = 1;
    rpc.mockResolvedValueOnce({ data: envelope(state), error: null });
    const paid = await getKqSocial(id, claim);
    expect(paid.sponsors).toMatchObject({ active: null, earnedCents: rewardCents, paidRewardsCents: { [sponsor.id]: rewardCents } });
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_social_v2_commit", expect.objectContaining({ p_reward_cents: rewardCents }));
    rpc.mockClear(); random.mockClear(); rpc.mockResolvedValueOnce({ data: envelope(paid, true), error: null });
    expect((await getKqSocial(id, claim)).sponsors.earnedCents).toBe(rewardCents);
    expect(random).not.toHaveBeenCalled();
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
  });
  it("rejects a dynamic payment above the wallet limit without consuming its contract", async () => {
    const { state, claim, rewardCents } = completedSponsor(), before = structuredClone(state);
    rpc.mockResolvedValueOnce({ data: { ...envelope(state), cashCents: 2_147_483_647 - rewardCents + 1 }, error: null });
    await expect(getKqSocial(id, claim)).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(call => call[0].endsWith("commit"))).toBe(false);
    expect(state).toEqual(before);
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
