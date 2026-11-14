import { describe, expect, it, vi } from "vitest";
import { KqHistoryProgressController, emptyKqHistoryProgressState, type KqHistoryTransport } from "./kanab-quest-school-history-outbox";
import type { KqSchoolHistoryProgressCommand as Command, KqSchoolHistorySnapshot as Snapshot } from "./kanab-quest-school-history-progress";

const owner = "12345678-1234-4123-8123-123456789abc", other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const one = "history-evidence-1", two = "history-evidence-2";
const snapshot = (revision = 0, options: Partial<Snapshot> = {}): Snapshot => ({ version: 1, ownerId: owner, contentVersion: "2026-11-12.history1", revision,
  lessonIds: [], checkpointIds: [], activityIds: [], resumeLessonId: null, updatedAt: null, resumeConflict: false, ...options });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};
const brokenStorage = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); }, removeItem: () => { throw Error("blocked"); } };
function setup(transport: KqHistoryTransport, options: ConstructorParameters<typeof KqHistoryProgressController>[3] = {}, user = owner) {
  let state = emptyKqHistoryProgressState();
  const controller = new KqHistoryProgressController(user, transport, next => { state = next; }, { memory: new Map(), storage: storage(), ...options });
  return { controller, state: () => state };
}
describe("history outbox under actual asynchronous request orderings", () => {
  it.each([{ course: "terpenes", first: "vocabulary" }, { course: "cannabinoids", first: "origins" }, { course: "cultivation", first: "axes" }, { course: "health", first: "observation" }, { course: "soil", first: "physical" }, { course: "products", first: "seeds" }, { course: "harvest", first: "outcomes" }] as const)("isolates $course from the other courses through a lost response and reload", async ({ course, first }) => {
    const disk = storage(), tabMemory = new Map(), sent: Command[] = [];
    const before = setup(async method => { if (method === "GET") return snapshot(); throw Error("response lost"); }, { memory: tabMemory, storage: disk, course });
    await before.controller.load();
    await before.controller.save({ lessonIds: [`${course}-${first}-1`], activityIds: [`${course}-${first}-activity-1`], resumeLessonId: `${course}-${first}-2` });
    expect(before.state().waiting).toBe(true); before.controller.dispose();
    for (const otherCourse of ["history", "botany", "terpenes", "cannabinoids", "cultivation", "health", "soil", "products", "harvest"] as const) {
      if (otherCourse === course) continue;
      const different = setup(async () => snapshot(), { memory: tabMemory, storage: disk, course: otherCourse });
      await different.controller.load(); expect(different.state().waiting).toBe(false); different.controller.dispose();
    }
    const after = setup(async (method, command) => { if (method === "POST") sent.push(command!); return snapshot(1); }, { storage: disk, course });
    await after.controller.load(); expect(after.state().waiting).toBe(true); expect(sent).toHaveLength(0);
    await after.controller.save({});
    expect(sent[0]).toEqual({ lessonIds: [`${course}-${first}-1`], activityIds: [`${course}-${first}-activity-1`], checkpointIds: [], resumeLessonId: `${course}-${first}-2`, expectedRevision: 0 });
    expect(after.state().waiting).toBe(false); after.controller.dispose();
  });
  it("isolates botany and history for the same owner in memory and after a disk reload", async () => {
    const disk = storage(), tabMemory = new Map();
    const before = setup(async method => { if (method === "GET") return snapshot(); throw Error("offline"); }, { memory: tabMemory, storage: disk });
    await before.controller.load(); await before.controller.save({ lessonIds: [one] }); before.controller.dispose();
    const botany = setup(async method => { if (method === "GET") return snapshot(); throw Error("offline"); }, { memory: tabMemory, storage: disk, course: "botany" });
    await botany.controller.load(); expect(botany.state().waiting).toBe(false);
    await botany.controller.save({ lessonIds: [one] }); expect(botany.state().waiting).toBe(false);
    await botany.controller.save({ lessonIds: ["botany-anatomy-1"], resumeLessonId: "botany-anatomy-2" });
    expect(botany.state().waiting).toBe(true); botany.controller.dispose();
    for (const course of ["history", "botany"] as const) {
      const sent: Command[] = [];
      const after = setup(async (method, command) => { if (method === "POST") sent.push(command!); return snapshot(1); }, { storage: disk, course });
      await after.controller.load(); expect(after.state().waiting).toBe(true); await after.controller.save({});
      expect(sent[0].lessonIds).toEqual(course === "history" ? [one] : ["botany-anatomy-1"]);
      expect(after.state().waiting).toBe(false); after.controller.dispose();
    }
  });
  it("serializes botany activity and checkpoint completion added during an in-flight lesson save", async () => {
    const first = deferred<Snapshot>(), sent: Command[] = [];
    const test = setup(async (method, command) => {
      if (method === "GET") return snapshot();
      sent.push(command!); return sent.length === 1 ? first.promise : snapshot(2);
    }, { course: "botany" });
    await test.controller.load(); const running = test.controller.save({ lessonIds: ["botany-anatomy-1"] });
    await test.controller.save({ activityIds: ["botany-anatomy-activity-1"], checkpointIds: ["botany-anatomy-checkpoint"] });
    expect(sent).toHaveLength(1); first.resolve(snapshot(1)); await running;
    expect(sent).toHaveLength(2); expect(sent[1]).toEqual({ lessonIds: [], activityIds: ["botany-anatomy-activity-1"], checkpointIds: ["botany-anatomy-checkpoint"] });
    expect(test.state().waiting).toBe(false); test.controller.dispose();
  });
  it("retains the complete failed batch in tab memory when browser storage is unavailable", async () => {
    const sent: Command[] = [];
    const test = setup(async (method, command) => {
      if (method === "GET") return snapshot();
      sent.push(command!); if (sent.length === 1) throw Error("network lost");
      return snapshot(1, { lessonIds: [one], resumeLessonId: one });
    }, { storage: brokenStorage });
    await test.controller.load(); await test.controller.save({ lessonIds: [one], resumeLessonId: one });
    expect(test.state().waiting).toBe(true); expect(test.state().notice).toContain("mémoire"); expect(sent).toHaveLength(1);
    await test.controller.save({});
    expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
    expect(test.state().waiting).toBe(false); expect(test.state().snapshot?.lessonIds).toEqual([one]);
    test.controller.dispose();
  });
  it("serializes requests and preserves new steps and latest resume added while the first request is pending", async () => {
    const first = deferred<Snapshot>(), sent: Command[] = [];
    const test = setup(async (method, command) => {
      if (method === "GET") return snapshot();
      sent.push(command!);
      return sent.length === 1 ? first.promise : snapshot(2, { lessonIds: [one, two], resumeLessonId: two });
    });
    await test.controller.load();
    const running = test.controller.save({ lessonIds: [one], resumeLessonId: one });
    await test.controller.save({ lessonIds: [two], resumeLessonId: two });
    expect(sent).toHaveLength(1); expect(test.state().busy).toBe(true);
    first.resolve(snapshot(1, { lessonIds: [one], resumeLessonId: one })); await running;
    expect(sent).toHaveLength(2); expect(sent[1]).toEqual({ lessonIds: [two], checkpointIds: [], activityIds: [], resumeLessonId: two, expectedRevision: 1 });
    expect(test.state().snapshot?.resumeLessonId).toBe(two); expect(test.state().waiting).toBe(false);
    test.controller.dispose();
  });
  it("shows restored pending work after reload and only retries upon an explicit action", async () => {
    const disk = storage();
    const before = setup(async method => { if (method === "GET") return snapshot(); throw Error("offline"); }, { storage: disk });
    await before.controller.load(); await before.controller.save({ lessonIds: [one] }); before.controller.dispose();
    const sent: Command[] = [];
    const after = setup(async (method, command) => {
      if (method === "GET") return snapshot();
      sent.push(command!); return snapshot(1, { lessonIds: [one] });
    }, { storage: disk });
    await after.controller.load();
    expect(after.state().waiting).toBe(true); expect(after.state().error).toBe(""); expect(sent).toHaveLength(0);
    await after.controller.save({}); expect(sent[0].lessonIds).toEqual([one]); expect(after.state().waiting).toBe(false);
    after.controller.dispose();
  });
  it("isolates owners and keeps an old owner's unfinished queue after navigation even without storage", async () => {
    const tabMemory = new Map();
    const before = setup(async method => { if (method === "GET") return snapshot(); throw Error("offline"); }, { memory: tabMemory, storage: brokenStorage });
    await before.controller.load(); await before.controller.save({ lessonIds: [one] }); before.controller.dispose();
    const different = setup(async () => snapshot(0, { ownerId: other }), { memory: tabMemory, storage: brokenStorage }, other);
    await different.controller.load(); expect(different.state().waiting).toBe(false); expect(different.state().snapshot?.ownerId).toBe(other);
    different.controller.dispose();
    const returned = setup(async () => snapshot(), { memory: tabMemory, storage: brokenStorage });
    await returned.controller.load(); expect(returned.state().waiting).toBe(true); returned.controller.dispose();
  });
  it("rejects a response from another owner and ignores late responses after unmount", async () => {
    const mismatch = setup(async () => snapshot(0, { ownerId: other }));
    await mismatch.controller.load(); expect(mismatch.state().snapshot).toBeNull(); expect(mismatch.state().error).toContain("compte"); mismatch.controller.dispose();
    const late = deferred<Snapshot>(), tabMemory = new Map();
    const test = setup(async method => method === "GET" ? snapshot() : late.promise, { memory: tabMemory });
    await test.controller.load(); const running = test.controller.save({ lessonIds: [one] }); test.controller.dispose();
    const beforeLate = test.state(); late.resolve(snapshot(1, { lessonIds: [one] })); await running;
    expect(test.state()).toBe(beforeLate);
    const returned = setup(async () => snapshot(1, { lessonIds: [one] }), { memory: tabMemory });
    await returned.controller.load(); expect(returned.state().waiting).toBe(true); returned.controller.dispose();
  });
  it("does not let a stale GET roll back a newer acknowledged POST", async () => {
    const lateRead = deferred<Snapshot>(); let reads = 0;
    const test = setup(async method => method === "GET" ? (++reads === 1 ? snapshot() : lateRead.promise) : snapshot(1, { lessonIds: [one] }));
    await test.controller.load(); const runningRead = test.controller.load();
    await test.controller.save({ lessonIds: [one] }); lateRead.resolve(snapshot()); await runningRead;
    expect(test.state().snapshot?.revision).toBe(1); expect(test.state().snapshot?.lessonIds).toEqual([one]); test.controller.dispose();
  });
  it("refreshes the resume base for a new intent after an uncertain write, while keeping the queued completions", async () => {
    const sent: Command[] = []; let reads = 0;
    const test = setup(async (method, command) => {
      if (method === "GET") return ++reads === 1 ? snapshot() : snapshot(1, { lessonIds: [one], resumeLessonId: one });
      sent.push(command!); if (sent.length === 1) throw Error("response lost after commit");
      return snapshot(2, { lessonIds: [one, two], resumeLessonId: two });
    });
    await test.controller.load(); await test.controller.save({ lessonIds: [one], resumeLessonId: one });
    await test.controller.save({ lessonIds: [two], resumeLessonId: two });
    expect(reads).toBe(2); expect(sent[1].expectedRevision).toBe(1); expect(sent[1].lessonIds).toEqual([one, two]);
    expect(test.state().snapshot?.resumeLessonId).toBe(two); test.controller.dispose();
  });
  it("leaves an aborted request pending without an automatic retry loop", async () => {
    vi.useFakeTimers();
    try {
      let posts = 0;
      const test = setup(async (method, _command, signal) => {
        if (method === "GET") return snapshot();
        posts++;
        return new Promise<Snapshot>((_resolve, reject) => signal.addEventListener("abort", () => reject(Error("aborted")), { once: true }));
      }, { timeoutMs: 10 });
      await test.controller.load(); const running = test.controller.save({ lessonIds: [one] });
      await vi.advanceTimersByTimeAsync(20); await running;
      expect(posts).toBe(1); expect(test.state().waiting).toBe(true); expect(test.state().busy).toBe(false);
      expect(test.state().error).toContain("interrompue"); test.controller.dispose();
    } finally { vi.useRealTimers(); }
  });
});
