import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { saveMissionProofUpload, listMissionProofPathsForUser } from "@/lib/mission-proof-storage";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ storage: { from: () => ({ upload: mocks.upload, list: mocks.list }) } }) }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });
describe("private mission screenshots", () => {
  it("decodes and re-encodes the image, strips EXIF and chooses a private server path", async () => {
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#126052" } }).jpeg().withExif({ IFD0: { Artist: "Private player identity" } }).toBuffer();
    const result = await saveMissionProofUpload(new File([new Uint8Array(bytes)], "../../secret.jpg", { type: "image/jpeg" }), user);
    expect(result.storagePath).toMatch(new RegExp("^" + user + "/[0-9a-f-]+\\.webp$"));
    const normalized = mocks.upload.mock.calls[0][1] as Buffer;
    const metadata = await sharp(normalized).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.exif).toBeUndefined();
    expect(result.fileSize).toBe(normalized.length);
    expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: "image/webp", upsert: false });
  });
  it("rejects forged PNG headers instead of storing undecodable content", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await expect(saveMissionProofUpload(new File([bytes], "forged.png", { type: "image/png" }), user)).rejects.toMatchObject({ status: 415 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects mismatched MIME types and unsupported SVG", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(saveMissionProofUpload(new File([new Uint8Array(png)], "fake.jpg", { type: "image/jpeg" }), user)).rejects.toMatchObject({ status: 415 });
    await expect(saveMissionProofUpload(new File(["<svg/>"], "proof.svg", { type: "image/svg+xml" }), user)).rejects.toMatchObject({ status: 415 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects images exceeding the decoded pixel budget", async () => {
    const png = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(saveMissionProofUpload(new File([new Uint8Array(png)], "large.png", { type: "image/png" }), user)).rejects.toMatchObject({ status: 415 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not disclose storage provider failures", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "private service token" } });
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(saveMissionProofUpload(new File([new Uint8Array(png)], "proof.png", { type: "image/png" }), user)).rejects.toThrow("Impossible");
  });
});

describe("account deletion proof inventory", () => {
  it("lists old revisions and orphan uploads only within the exact owner folder", async () => {
    const names = Array.from({ length: 100 }, (_, index) => ({ id: String(index), name: String(index).padStart(8, "0") + "-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp" }));
    mocks.list.mockResolvedValueOnce({ data: names, error: null }).mockResolvedValueOnce({ data: [{ id: "extra", name: "ffffffff-ffff-4fff-8fff-ffffffffffff.webp" }], error: null });
    const paths = await listMissionProofPathsForUser(user);
    expect(paths).toHaveLength(101);
    expect(paths.every(path => path.startsWith(user + "/"))).toBe(true);
    expect(mocks.list.mock.calls.map(call => [call[0], call[1].offset])).toEqual([[user, 0], [user, 100]]);
  });
  it("rejects invalid owner IDs and traversal-like storage rows before deletion", async () => {
    await expect(listMissionProofPathsForUser("../another-user")).rejects.toMatchObject({ status: 400 });
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue({ data: [{ id: "bad", name: "../another-user/proof.webp" }], error: null });
    await expect(listMissionProofPathsForUser(user)).rejects.toMatchObject({ status: 503 });
  });
  it("stops on storage enumeration errors instead of claiming all private proofs were found", async () => {
    mocks.list.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(listMissionProofPathsForUser(user)).rejects.toMatchObject({ status: 503 });
  });
});
