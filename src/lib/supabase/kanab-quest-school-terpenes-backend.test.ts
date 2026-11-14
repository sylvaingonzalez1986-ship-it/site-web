import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqSchoolTerpenes } from "./kanab-quest-school-terpenes-backend";
import { VERSION } from "../kanab-quest-school-terpenes";
const owner = "12345678-1234-4123-8123-123456789abc";
const snapshot = () => ({ version: 1, ownerId: owner, lessonIds: [], checkpointIds: [], activityIds: [], resumeLessonId: null, revision: 0, updatedAt: null, resumeConflict: false });
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: snapshot(), error: null }); });
describe("terpenes learning persistence", () => {
  it("reads the dedicated RPC without touching the wallet endpoint", async () => {
    expect(await getKqSchoolTerpenes(owner)).toEqual({ ...snapshot(), contentVersion: VERSION });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_terpenes", { p_user_id: owner, p_command: null });
  });
  it("saves one validated completion batch and its expected resume revision", async () => {
    const command = { lessonIds: ["terpenes-vocabulary-1"], checkpointIds: [], activityIds: ["terpenes-vocabulary-activity-1"], resumeLessonId: "terpenes-vocabulary-2", expectedRevision: 4 };
    await getKqSchoolTerpenes(owner, command);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_terpenes", { p_user_id: owner, p_command: command });
  });
  it("rejects unknown owners and legacy lesson IDs before RPC", async () => {
    await expect(getKqSchoolTerpenes("invented")).rejects.toMatchObject({ status: 401 });
    await expect(getKqSchoolTerpenes(owner, { lessonIds: ["molecules"], checkpointIds: [], activityIds: [] })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not accept a snapshot belonging to another player", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null });
    await expect(getKqSchoolTerpenes(owner)).rejects.toThrow("[school-terpenes] invalid snapshot");
  });
  it("returns resume conflicts as data while keeping database diagnostics private", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), revision: 5, resumeConflict: true }, error: null });
    expect((await getKqSchoolTerpenes(owner)).resumeConflict).toBe(true);
    rpc.mockResolvedValue({ data: null, error: { message: "private SQL connection details" } });
    await expect(getKqSchoolTerpenes(owner)).rejects.toThrow("[school-terpenes] storage unavailable");
  });
});
