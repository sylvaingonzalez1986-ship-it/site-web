import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqSchoolCultivation } from "./kanab-quest-school-cultivation-backend";
import { VERSION } from "../kanab-quest-school-cultivation";
const owner = "12345678-1234-4123-8123-123456789abc";
const snapshot = () => ({ version: 1, ownerId: owner, lessonIds: [], checkpointIds: [], activityIds: [], resumeLessonId: null, revision: 0, updatedAt: null, resumeConflict: false });
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: snapshot(), error: null }); });
describe("cultivation learning persistence", () => {
  it("reads the dedicated RPC without touching the wallet endpoint", async () => {
    expect(await getKqSchoolCultivation(owner)).toEqual({ ...snapshot(), contentVersion: VERSION });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_cultivation", { p_user_id: owner, p_command: null });
  });
  it("saves one validated completion batch and its expected resume revision", async () => {
    const command = { lessonIds: ["cultivation-axes-1"], checkpointIds: [], activityIds: ["cultivation-axes-activity-1"], resumeLessonId: "cultivation-axes-2", expectedRevision: 4 };
    await getKqSchoolCultivation(owner, command);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_cultivation", { p_user_id: owner, p_command: command });
  });
  it("rejects unknown owners and legacy lesson IDs before RPC", async () => {
    await expect(getKqSchoolCultivation("invented")).rejects.toMatchObject({ status: 401 });
    await expect(getKqSchoolCultivation(owner, { lessonIds: ["genetics"], checkpointIds: [], activityIds: [] })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not accept a snapshot belonging to another player", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null });
    await expect(getKqSchoolCultivation(owner)).rejects.toThrow("[school-cultivation] invalid snapshot");
  });
  it("returns resume conflicts as data while keeping database diagnostics private", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot(), revision: 5, resumeConflict: true }, error: null });
    expect((await getKqSchoolCultivation(owner)).resumeConflict).toBe(true);
    rpc.mockResolvedValue({ data: null, error: { message: "private SQL connection details" } });
    await expect(getKqSchoolCultivation(owner)).rejects.toThrow("[school-cultivation] storage unavailable");
  });
});
