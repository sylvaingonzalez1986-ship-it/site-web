import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: vi.fn(() => "127.0.0.1"),
  hitRateLimit: vi.fn(async () => ({ allowed: true })),
  logRateLimitRejection: vi.fn(),
}));

import { GET } from "@/app/api/relay/points/route";

const fetchMock = vi.fn();

function lookup(country?: string, postalCode = "1000") {
  const url = new URL("http://localhost/api/relay/points");
  url.searchParams.set("postalCode", postalCode);
  if (country !== undefined) url.searchParams.set("country", country);
  return GET(new Request(url));
}

function relayXml(country = "BE", id = "relay-1") {
  return `<PointRelais_Details><Num>${id}</Num><LgAdr1>Librairie du centre</LgAdr1><LgAdr3>2 rue du Centre</LgAdr3><CP>1000</CP><Ville>Bruxelles</Ville><Pays>${country}</Pays></PointRelais_Details>`;
}

describe("GET /api/relay/points countries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MONDIAL_RELAY_API1_ENSEIGNE", "TEST");
    vi.stubEnv("MONDIAL_RELAY_API1_PRIVATE_KEY", "test-key");
    fetchMock.mockResolvedValue(new Response(`<STAT>0</STAT>${relayXml("Belgique")}`));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["BE", "Belgique", "Belgium", "België", "Belgien"])(
    "searches Belgium with a four-digit postcode and normalizes returned countries: %s",
    async (country) => {
      const response = await lookup(country);

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("<Pays>BE</Pays>"),
      }));
      expect(fetchMock.mock.calls[0][1].body).toContain("<CP>1000</CP>");
      expect(await response.json()).toMatchObject({
        statusCode: "0",
        points: [{ id: "relay-1", country: "BE", postalCode: "1000" }],
      });
    },
  );

  it.each([undefined, "", "France", "FR"])("preserves France and the missing-country default: %s", async (country) => {
    fetchMock.mockResolvedValue(new Response(`<STAT>0</STAT>${relayXml("France")}`));

    const response = await lookup(country, "35000");

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].body).toContain("<Pays>FR</Pays>");
    expect((await response.json()).points[0].country).toBe("FR");
  });

  it.each(["Brazil", "B-E", "B", "BE123"])("rejects unrecognized countries instead of truncating them: %s", async (country) => {
    expect((await lookup(country)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only returns relays in the requested destination country", async () => {
    fetchMock.mockResolvedValue(new Response(`<STAT>0</STAT>${relayXml("FR", "relay-fr")}${relayXml("BE")}`));

    const response = await lookup("Belgique");

    expect(response.status).toBe(200);
    expect((await response.json()).points).toEqual([expect.objectContaining({ id: "relay-1", country: "BE" })]);
  });

  it("uses the requested country when the carrier omits it", async () => {
    fetchMock.mockResolvedValue(new Response(`<STAT>0</STAT>${relayXml("")}`));

    expect((await (await lookup("BE")).json()).points[0].country).toBe("BE");
  });
});
