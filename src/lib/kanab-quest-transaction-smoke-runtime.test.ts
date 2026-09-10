import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(resolve("scripts/smoke-test-placard-transactions.mjs"), "utf8")
  .replace(/^import .+;\r?$/gm, "");
const flowerId = "99999999-9999-9999-9999-999999999999";
const cookie = "local-test-session=fixture-only";
const claimKey = "2026-09-07:clean-sweep";

// Execute the actual CLI with in-memory HTTP and filesystem substitutes.
// These tests cannot produce launch evidence or mutate any database.
async function rehearse(options: {
  malformedFlowers?: boolean;
  missingClaims?: boolean;
  duplicateCredit?: boolean;
  replayStatus?: number;
  remoteDatabase?: boolean;
} = {}) {
  const baseProgress = { seasonPoints: 20, arenaExperience: 1, burnedFlowers: 2, claimedChallengeCodes: [] };
  const credited = { seasonPoints: 35, arenaExperience: 1.1, burnedFlowers: 3, claimedChallengeCodes: [claimKey] };
  const finalProgress = {
    ...credited,
    seasonPoints: options.duplicateCredit ? 50 : 35,
    ...(options.missingClaims ? { claimedChallengeCodes: undefined } : {}),
  };
  const responses: Array<[string, number, unknown]> = [
    ["/bootstrap", 200, {}],
    ["/me", 200, { progress: baseProgress }],
    ["/flowers", 200, { flowers: [{ id: flowerId, status: "available" }] }],
    ["/bot-battles", 201, {
      playerFlower: { id: flowerId }, challengePoints: 15, experienceAwarded: 0.1,
      claimedChallengeCodes: ["clean-sweep"],
      completedChallenges: [{ code: "clean-sweep", points: 15 }],
    }],
    ["/me", 200, { progress: credited }],
    ["/flowers", 200, options.malformedFlowers ? {} : { flowers: [] }],
    ["/bot-battles", options.replayStatus ?? 409, { error: "Fleur indisponible." }],
    ["/me", 200, { progress: finalProgress }],
  ];
  const request = vi.fn(async (url: string, init: RequestInit) => {
    const expected = responses.shift();
    if (!expected) throw new Error("Unexpected request");
    expect(new URL(url).pathname).toBe(`/api/arena/placard${expected[0]}`);
    expect(init.redirect).toBe("manual");
    if (expected[0] === "/bot-battles") {
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({ flowerId });
    }
    return new Response(JSON.stringify(expected[2]), { status: expected[1] });
  });
  const writeFile = vi.fn();
  const fakeProcess = {
    cwd: () => process.cwd(), exitCode: 0,
    env: {
      PLACARD_SMOKE_ACTION: "bot-challenge", PLACARD_SMOKE_FLOWER_ID: flowerId,
      PLACARD_SMOKE_COOKIE: cookie, PLACARD_SMOKE_CONFIRM_BURNS: "LOCAL_BURNS_ONLY",
      PLACARD_SMOKE_CONFIRM_DATABASE: "LOCAL_SUPABASE_ONLY",
      NEXT_PUBLIC_SUPABASE_URL: options.remoteDatabase ? "https://remote.example.test" : "http://127.0.0.1:54321",
    },
  };
  const execution = runInNewContext(`(async () => {${script}\n})()`, {
    createHash, randomUUID, isAbsolute, relative, resolve, sep, URL, AbortSignal,
    performance, fetch: request, process: fakeProcess,
    mkdir: vi.fn(), writeFile, console: { log: vi.fn(), error: vi.fn() },
  });
  if (options.remoteDatabase) {
    await expect(execution).rejects.toThrow("base Supabase distante ou inconnue");
    expect(request).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    return null;
  }
  await execution;
  expect(writeFile).toHaveBeenCalledOnce();
  const serialized = String(writeFile.mock.calls[0][1]);
  expect(serialized).not.toContain(flowerId);
  expect(serialized).not.toContain(cookie);
  expect(serialized).not.toContain(claimKey);
  expect(writeFile.mock.calls[0][2]).toEqual({ encoding: "utf8", flag: "wx" });
  return { report: JSON.parse(serialized), exitCode: fakeProcess.exitCode };
}

describe("Placard bot challenge smoke execution", () => {
  it("checks the actual credit, burn, claim synchronization and refused replay", async () => {
    const result = await rehearse();
    expect(result?.exitCode).toBe(0);
    expect(result?.report).toMatchObject({ succeeded: true, checks: {
      challengePoints: 15, experienceConfirmed: true, flowerBurnConfirmed: true,
      challengeClaimsSynced: true, noDoubleCreditConfirmed: true,
    } });
  });

  it.each([
    { malformedFlowers: true }, { missingClaims: true },
    { duplicateCredit: true }, { replayStatus: 503 }, { replayStatus: 429 },
  ])("fails on incomplete or inconsistent responses: %j", async (options) => {
    const result = await rehearse(options);
    expect(result?.exitCode).toBe(1);
    expect(result?.report.succeeded).toBe(false);
  });

  it("refuses a remote database before making any request", async () => {
    await rehearse({ remoteDatabase: true });
  });
});
