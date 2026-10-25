import { afterEach, describe, expect, it, vi } from "vitest";
import { getContestNotebookAccessDeniedResponse, isContestNotebookEnabledServer } from "./contest-notebook-access";

afterEach(() => vi.unstubAllEnvs());

describe("Public notebook access", () => {
  it("is public by default independently of game and beta flags", async () => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "false");
    vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
    expect(isContestNotebookEnabledServer()).toBe(true);
    expect(await getContestNotebookAccessDeniedResponse()).toBeNull();
  });

  it.each(["0", "false", "off", "no", " FALSE "])("supports an independent emergency shutdown: %s", async value => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", value);
    expect(isContestNotebookEnabledServer()).toBe(false);
    expect((await getContestNotebookAccessDeniedResponse())?.status).toBe(404);
  });
});
