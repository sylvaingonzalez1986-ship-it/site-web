import { afterEach, describe, expect, it, vi } from "vitest";

const mutableEnv = process.env as Record<string, string | undefined>;
const originalContestFeatureEnabled = mutableEnv.CONTEST_FEATURE_ENABLED;
const originalContestFeatureAllowProduction = mutableEnv.CONTEST_FEATURE_ALLOW_PRODUCTION;
const originalContestBetaAccessEnabled = mutableEnv.CONTEST_BETA_ACCESS_ENABLED;
const originalNodeEnv = mutableEnv.NODE_ENV;

async function loadContestFeatureModule() {
  vi.resetModules();
  return import("@/lib/contest-feature");
}

afterEach(() => {
  if (originalContestFeatureEnabled === undefined) {
    Reflect.deleteProperty(mutableEnv, "CONTEST_FEATURE_ENABLED");
  } else {
    mutableEnv.CONTEST_FEATURE_ENABLED = originalContestFeatureEnabled;
  }
  if (originalContestFeatureAllowProduction === undefined) {
    Reflect.deleteProperty(mutableEnv, "CONTEST_FEATURE_ALLOW_PRODUCTION");
  } else {
    mutableEnv.CONTEST_FEATURE_ALLOW_PRODUCTION = originalContestFeatureAllowProduction;
  }
  if (originalContestBetaAccessEnabled === undefined) {
    Reflect.deleteProperty(mutableEnv, "CONTEST_BETA_ACCESS_ENABLED");
  } else {
    mutableEnv.CONTEST_BETA_ACCESS_ENABLED = originalContestBetaAccessEnabled;
  }
  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(mutableEnv, "NODE_ENV");
  } else {
    mutableEnv.NODE_ENV = originalNodeEnv;
  }

  vi.resetModules();
});

describe("contest-feature", () => {
  it("stays disabled by default", async () => {
    Reflect.deleteProperty(mutableEnv, "CONTEST_FEATURE_ENABLED");

    const { isContestFeatureEnabledServer } = await loadContestFeatureModule();

    expect(isContestFeatureEnabledServer()).toBe(false);
  });

  it.each(["1", "true", "on", "yes"])("accepts %s as an explicit enabled value", async (value) => {
    mutableEnv.CONTEST_FEATURE_ENABLED = value;

    const { isContestFeatureEnabledServer } = await loadContestFeatureModule();

    expect(isContestFeatureEnabledServer()).toBe(true);
  });

  it.each(["0", "false", "off", "no"])("can be disabled explicitly with %s", async (value) => {
    mutableEnv.CONTEST_FEATURE_ENABLED = value;

    const { isContestFeatureEnabledServer } = await loadContestFeatureModule();

    expect(isContestFeatureEnabledServer()).toBe(false);
  });

  it("requires an explicit production launch flag in production", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.CONTEST_FEATURE_ENABLED = "true";
    Reflect.deleteProperty(mutableEnv, "CONTEST_FEATURE_ALLOW_PRODUCTION");

    const { isContestFeatureEnabledServer } = await loadContestFeatureModule();

    expect(isContestFeatureEnabledServer()).toBe(false);

    mutableEnv.CONTEST_FEATURE_ALLOW_PRODUCTION = "true";

    expect(isContestFeatureEnabledServer()).toBe(true);
  });

  it("keeps beta access restricted to admins and selected customers", async () => {
    mutableEnv.CONTEST_FEATURE_ENABLED = "true";
    mutableEnv.CONTEST_BETA_ACCESS_ENABLED = "true";

    const { canCustomerAccessContestFeatureServer } = await loadContestFeatureModule();

    expect(canCustomerAccessContestFeatureServer(null)).toBe(false);
    expect(
      canCustomerAccessContestFeatureServer({
        email: "client@example.com",
        contestBetaEnabled: false,
      }),
    ).toBe(false);
    expect(
      canCustomerAccessContestFeatureServer({
        email: "client@example.com",
        contestBetaEnabled: true,
      }),
    ).toBe(true);
    expect(canCustomerAccessContestFeatureServer(null, { adminAuthorized: true })).toBe(true);
  });
});
