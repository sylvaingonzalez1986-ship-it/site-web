import { afterEach, describe, expect, it, vi } from "vitest";
import { createArenaCharacterPreviewRequest } from "./arena-character-preview";
import type { ChanvrierProfile } from "./arena-chanvrier";

const character: ChanvrierProfile = {
  nickname: "Mon_Essai", gender: "female", clothing: "teal", skin: "honey", strength: "treasurer",
};
const save = (request: typeof fetch, value: unknown) => request("/api/arena/chanvrier", {
  method: "POST", body: JSON.stringify(value),
});

afterEach(() => vi.unstubAllGlobals());

describe("local character creation preview", () => {
  it("creates a validated character without granting a wallet bonus", async () => {
    const request = createArenaCharacterPreviewRequest();
    const result = await save(request, { ...character, nickname: " Mon_Essai " });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ profile: character, created: true, startingBonusCents: 0, localPreview: true });
  });

  it("rejects malformed JSON and invalid characters without consuming creation", async () => {
    const request = createArenaCharacterPreviewRequest();
    expect((await request("/api/arena/chanvrier", { method: "POST", body: "{" })).status).toBe(400);
    for (const value of [null, { ...character, nickname: "!" }, { ...character, appearance: { hair: "unknown" } }]) {
      expect((await save(request, value)).status).toBe(400);
    }
    expect((await (await save(request, character)).json()).created).toBe(true);
  });

  it("keeps the specialty fixed while persisting nickname and appearance changes", async () => {
    const request = createArenaCharacterPreviewRequest();
    await save(request, character);
    const refused = await save(request, { ...character, strength: "green-thumb" });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toContain("Ta spécialité est définitive");

    const updated = await (await save(request, { ...character, nickname: "Nouveau_Nom", clothing: "ochre" })).json();
    expect(updated).toMatchObject({ created: false, startingBonusCents: 0, profile: { ...character, nickname: "Nouveau_Nom", clothing: "ochre" } });
    expect((await (await save(request, updated.profile)).json()).profile).toEqual(updated.profile);
  });

  it("starts fresh when the preview is restarted with a new request adapter", async () => {
    const request = createArenaCharacterPreviewRequest();
    await save(request, character);
    const restarted = createArenaCharacterPreviewRequest();
    const result = await (await save(restarted, { ...character, strength: "green-thumb" })).json();
    expect(result).toMatchObject({ created: true, profile: { strength: "green-thumb" } });
    expect((await save(request, { ...character, strength: "green-thumb" })).status).toBe(400);
  });

  it("supports Request inputs and does not save aborted requests", async () => {
    const request = createArenaCharacterPreviewRequest();
    const controller = new AbortController();
    controller.abort();
    await expect(request("/api/arena/chanvrier", {
      method: "POST", body: JSON.stringify(character), signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    const result = await request(new Request("http://localhost/api/arena/chanvrier", {
      method: "POST", body: JSON.stringify(character),
    }));
    expect((await result.json()).created).toBe(true);
  });

  it("rejects unsupported operations without network, storage or global events", async () => {
    const network = vi.fn(() => { throw new Error("Unexpected network request"); });
    const dispatchEvent = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal("fetch", network);
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("localStorage", { setItem });
    const request = createArenaCharacterPreviewRequest();
    await save(request, character);
    for (const [path, method] of [["/api/arena/chanvrier", "GET"], ["/api/arena/chanvrier", "DELETE"], ["/api/arena/placard/bank", "POST"], ["https://example.test/api/account/delete", "POST"]]) {
      expect((await request(path, { method, body: method === "GET" ? undefined : "{}" })).status).toBe(404);
    }
    expect(network).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
