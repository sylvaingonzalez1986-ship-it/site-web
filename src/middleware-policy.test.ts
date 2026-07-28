import { describe, expect, it } from "vitest";
import { isAdminRestrictedPage, shouldEnforceAgeGate, shouldValidateMutativeOrigin } from "../middleware";

describe("middleware policy helpers", () => {
  it("enforces the age gate on contest pages", () => {
    expect(shouldEnforceAgeGate("/arene")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/profils/testeur")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/profils/testeur")).toBe(true);
  });

  it("validates origins for mutative contest API requests", () => {
    expect(shouldValidateMutativeOrigin("/api/contest/reviews", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/contest/reviews/review-1/vote", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/contest/profile", "GET")).toBe(false);
  });

  it("keeps checkout webhooks exempt from browser origin validation", () => {
    expect(shouldValidateMutativeOrigin("/api/checkout/viva", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/checkout/viva/webhook", "POST")).toBe(false);
  });

  it("protects both the admin Placard and its legacy local entry page", () => {
    expect(isAdminRestrictedPage("/admin/placard")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard/card-back.webp")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard/characters/sylvain.webp")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard-preview")).toBe(false);
    expect(isAdminRestrictedPage("/arene")).toBe(false);
  });
});
