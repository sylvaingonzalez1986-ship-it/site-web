import { afterEach, describe, expect, it, vi } from "vitest";
import VillagePrototypePage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("village shortcut", () => {
  it("redirects development visits into the canonical game's authentication and profile gates", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(VillagePrototypePage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/arene/placard?world=3d;307;",
    });
  });

  it("retains activity context and encoded repeated values while forcing one 3D choice", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const error = await VillagePrototypePage({ searchParams: Promise.resolve({ view: "workshop", flower: ["one & two", "three"], world: ["2d", "invalid"], guide: "1", absent: undefined }) }).catch(error => error);
    const destination = new URL(error.digest.split(";")[2], "https://example.test");
    expect(destination.pathname).toBe("/arene/placard");
    expect(destination.searchParams.get("view")).toBe("workshop");
    expect(destination.searchParams.getAll("flower")).toEqual(["one & two", "three"]);
    expect(destination.searchParams.getAll("world")).toEqual(["3d"]);
    expect(destination.searchParams.get("guide")).toBe("1");
    expect(destination.searchParams.has("absent")).toBe(false);
  });

  it("keeps the development shortcut unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(VillagePrototypePage({ searchParams: Promise.resolve({ world: "3d" }) })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});
