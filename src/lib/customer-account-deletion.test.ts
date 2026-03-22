import { describe, expect, it } from "vitest";
import {
  buildDeletedAccountEmail,
  normalizeDeletionConfirmationEmail,
} from "@/lib/customer-account-deletion";

describe("customer-account-deletion", () => {
  it("normalizes the confirmation email", () => {
    expect(normalizeDeletionConfirmationEmail("  USER@Example.com ")).toBe("user@example.com");
    expect(normalizeDeletionConfirmationEmail(null)).toBe("");
  });

  it("builds a deterministic anonymized email marker", () => {
    expect(buildDeletedAccountEmail("12345678-abcd-ef00-1234-abcdefabcdef")).toBe(
      "deleted+12345678@privacy.invalid",
    );
  });
});