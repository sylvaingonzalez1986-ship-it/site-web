import { describe, expect, it } from "vitest";
import { parseArenaFeedbackOffset, parseArenaFeedbackReview, parseArenaFeedbackSubmission } from "./arena-feedback";

const id = "12345678-1234-1234-1234-123456789012";
const submission = { requestId: id, kind: "bug", subject: "Le bouton reste bloqué", message: "Après mon lancer, le bouton ne répond plus.", pagePath: "/le-placard" };

describe("mailbox validation", () => {
  it("normalizes plain text while discarding forged identity and rewards", () => {
    expect(parseArenaFeedbackSubmission({ ...submission, subject: "  Mon souci  ", message: "  Première étape terminée\r\nPuis tout est bloqué.  ", userId: "victim", rewardPacks: 5 }))
      .toEqual({ ...submission, subject: "Mon souci", message: "Première étape terminée\nPuis tout est bloqué." });
  });
  it.each([null, [], {}, { ...submission, requestId: "a" }, { ...submission, kind: "reward" },
    { ...submission, subject: "abc" }, { ...submission, subject: "a".repeat(121) }, { ...submission, subject: "Titre\nSuite" },
    { ...submission, message: "a".repeat(19) }, { ...submission, message: "a".repeat(4001) }, { ...submission, message: "Texte assez long mais \0 interdit" },
    { ...submission, pagePath: "//attacker.test" }, { ...submission, pagePath: "/account?token=secret" },
    { ...submission, pagePath: "/account#secret" }, { ...submission, pagePath: "/\\attacker.test" }])("rejects malformed message %#", value => {
    expect(() => parseArenaFeedbackSubmission(value)).toThrow();
  });
  it("accepts a bare home path and missing optional path", () => {
    expect(parseArenaFeedbackSubmission({ ...submission, pagePath: "/" }).pagePath).toBe("/");
    expect(parseArenaFeedbackSubmission({ ...submission, pagePath: undefined }).pagePath).toBeNull();
  });
  it("keeps an exact database timestamp for optimistic review and defaults to no reward", () => {
    const expectedUpdatedAt = "2026-11-08T13:02:04.123456+00:00";
    expect(parseArenaFeedbackReview({ id, status: "reviewing", reply: "  Merci !  ", expectedUpdatedAt }))
      .toEqual({ id, status: "reviewing", reply: "Merci !", rewardPacks: 0, expectedUpdatedAt });
  });
  it.each([-1, 1.5, 6, "2", null, Infinity])("rejects invalid reward %s", rewardPacks => {
    expect(() => parseArenaFeedbackReview({ id, status: "resolved", reply: "", rewardPacks })).toThrow();
  });
  it.each(["new", "declined"])("requires an eligible review before rewarding %s", status => {
    expect(() => parseArenaFeedbackReview({ id, status, reply: "", rewardPacks: 1 })).toThrow();
  });
  it("rejects unknown status, oversized reply, missing reply and invalid versions", () => {
    for (const patch of [{ status: "__proto__" }, { reply: "a".repeat(2001) }, { reply: undefined }, { expectedUpdatedAt: "yesterday" }]) {
      expect(() => parseArenaFeedbackReview({ id, status: "resolved", reply: "", ...patch })).toThrow();
    }
  });
  it("bounds pagination without accepting partial numbers", () => {
    expect(parseArenaFeedbackOffset(null)).toBe(0);
    expect(parseArenaFeedbackOffset("30")).toBe(30);
    for (const value of ["-1", "2.5", "30x", "99999999"]) expect(() => parseArenaFeedbackOffset(value)).toThrow();
  });
});
