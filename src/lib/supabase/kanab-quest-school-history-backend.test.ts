import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqSchoolHistory } from "./kanab-quest-school-history-backend";
import { VERSION } from "../kanab-quest-school-history";
const owner = "12345678-1234-4123-8123-123456789abc";
const snapshot = () => ({ version: 1, ownerId: owner, lessonIds: [], checkpointIds: [], activityIds: [], resumeLessonId: null, revision: 0, updatedAt: null, resumeConflict: false });
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: snapshot(), error: null }); });
describe("history learning persistence", () => {
  it("reads the dedicated RPC without touching the wallet endpoint", async () => {
    expect(await getKqSchoolHistory(owner)).toEqual({ ...snapshot(), contentVersion: VERSION });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_history", { p_user_id: owner, p_command: null });
  });
  it("saves one validated completion batch and its expected resume revision", async () => {
    const command = { lessonIds: ["history-evidence-1"], checkpointIds: [], activityIds: ["history-evidence-activity-1"], resumeLessonId: "history-evidence-2", expectedRevision: 4 };
    await getKqSchoolHistory(owner, command);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_history", { p_user_id: owner, p_command: command });
  });
  it("rejects unknown owners and legacy lesson IDs before RPC", async () => {
    await expect(getKqSchoolHistory("invented")).rejects.toMatchObject({ status: 401 });
    await expect(getKqSchoolHistory(owner, { lessonIds: ["history"], checkpointIds: [], activityIds: [] })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not accept a snapshot belonging to another player", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null });
    await expect(getKqSchoolHistory(owner)).rejects.toThrow("[school-history] invalid snapshot");
  });
  it("returns resume conflicts as data while keeping database diagnostics private", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), revision: 5, resumeConflict: true }, error: null });
    expect((await getKqSchoolHistory(owner)).resumeConflict).toBe(true);
    rpc.mockResolvedValue({ data: null, error: { message: "private SQL connection details" } });
    await expect(getKqSchoolHistory(owner)).rejects.toThrow("[school-history] storage unavailable");
  });
});
