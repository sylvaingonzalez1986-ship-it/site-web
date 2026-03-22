import { describe, expect, it } from "vitest";
import { isSupportedMissionProofMimeType } from "@/lib/mission-proof-policy";

describe("mission-proof-policy", () => {
  it("accepts the supported mission proof mime types", () => {
    expect(isSupportedMissionProofMimeType("image/jpeg")).toBe(true);
    expect(isSupportedMissionProofMimeType("image/png")).toBe(true);
    expect(isSupportedMissionProofMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported mime types", () => {
    expect(isSupportedMissionProofMimeType("image/gif")).toBe(false);
    expect(isSupportedMissionProofMimeType("application/pdf")).toBe(false);
  });
});