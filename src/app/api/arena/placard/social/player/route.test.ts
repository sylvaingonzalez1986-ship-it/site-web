import { beforeEach, describe, expect, it, vi } from "vitest";

const { enabled, session, profile } = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/supabase/arena-chanvrier-backend", () => ({ getChanvrierProfile: profile }));

import { GET } from "./route";

const character = { nickname: "elodie.atelier", gender: "female", skin: "brown", clothing: "berry", strength: "green-thumb" };
const identity = { customerId: "signed-in-owner", id: "session-token", customer: { id: "not-the-session-owner", firstName: "Élodie", lastName: "PrivateSurname", email: "private@example.invalid" } };
const expectPrivate = (response: Response) => expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockResolvedValue(true);
  session.mockResolvedValue(identity);
  profile.mockResolvedValue(character);
});

describe("private social player presentation endpoint", () => {
  it("keeps the feature hidden before looking up an account or character", async () => {
    enabled.mockResolvedValue(false);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Introuvable." });
    expectPrivate(response);
    expect(session).not.toHaveBeenCalled();
    expect(profile).not.toHaveBeenCalled();
  });

  it("requires authentication and never reads a character for an anonymous request", async () => {
    session.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Connecte-toi pour retrouver ton personnage." });
    expectPrivate(response);
    expect(profile).not.toHaveBeenCalled();
  });

  it("uses only authenticated session ownership and returns precisely the allowed identity fields", async () => {
    const request = new Request("http://localhost/api/arena/placard/social/player?customerId=victim&userId=victim", {
      headers: { "x-customer-id": "victim" },
    });
    // Next invokes the handler with a request; this read-only handler intentionally accepts no ownership input.
    const response: Response = await Reflect.apply(GET, undefined, [request]);
    expect(response.status).toBe(200);
    expect(profile).toHaveBeenCalledExactlyOnceWith("signed-in-owner");
    const body = await response.json();
    expect(body).toEqual({ firstName: "Élodie", profile: character });
    expect(Object.keys(body).sort()).toEqual(["firstName", "profile"]);
    expect(JSON.stringify(body)).not.toMatch(/PrivateSurname|private@example|session-token|not-the-session-owner|signed-in-owner|victim/);
    expectPrivate(response);
  });

  it("preserves a missing character without substituting a mascot or another account", async () => {
    profile.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ firstName: "Élodie", profile: null });
    expect(profile).toHaveBeenCalledExactlyOnceWith("signed-in-owner");
    expectPrivate(response);
  });

  it("returns the same bounded private error when an access, session or character backend fails", async () => {
    for (const failingBackend of [enabled, session, profile]) {
      enabled.mockResolvedValue(true);
      session.mockResolvedValue(identity);
      profile.mockResolvedValue(character);
      failingBackend.mockRejectedValueOnce(new Error("private database credentials and personal account information"));
      const response = await GET();
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body).toEqual({ error: "Ton personnage est momentanément indisponible." });
      expect(body.error.length).toBeLessThan(100);
      expectPrivate(response);
    }
  });
});
