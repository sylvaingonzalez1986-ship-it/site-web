import { describe, expect, it } from "vitest";
import { isMailingContactEligible, isValidMailingEmail, parseMailingDraft, personalizeMailingText } from "@/lib/mailing-policy";

const draft = {
  id: "e1edeb22-d00f-4086-bba6-19d9d9482e44", name: "Octobre", subject: "Bonjour", body: "Bonjour {{prenom}} !",
  kind: "marketing", recipientEmails: [" TEST@example.com ", "test@example.com"],
};

describe("mailing recipient and content policy", () => {
  it("deduplicates and normalizes selected addresses without widening the audience", () => {
    expect(parseMailingDraft(draft).recipientEmails).toEqual(["test@example.com"]);
    expect(parseMailingDraft({ ...draft, recipientEmails: [] }).recipientEmails).toEqual([]);
  });
  it.each(["a@example.com,b@example.com", "Name <a@example.com>", "a@example.com\r\nBcc: b@example.com", "a@example.com;evil@example.com", "bad", "@example.com"])("rejects multiple recipients and header injection: %s", (email) => {
    expect(isValidMailingEmail(email)).toBe(false);
    expect(() => parseMailingDraft({ ...draft, recipientEmails: [email] })).toThrow();
  });
  it("bounds content and rejects injected subject headers", () => {
    expect(() => parseMailingDraft({ ...draft, subject: "Hello\nBcc: attacker@example.com" })).toThrow();
    expect(() => parseMailingDraft({ ...draft, body: "a".repeat(20001) })).toThrow();
    expect(() => parseMailingDraft({ ...draft, id: "not-a-uuid" })).toThrow();
    expect(() => parseMailingDraft({ ...draft, kind: "anything" })).toThrow();
    expect(() => parseMailingDraft({ ...draft, recipientEmails: Array(10001).fill("one@example.com") })).toThrow();
  });
  it("does not treat customer registration as marketing subscription and always honors opt-out", () => {
    const contact = { email: "a@example.com", firstName: "", lastName: "", customer: true, subscribed: false, unsubscribed: false };
    expect(isMailingContactEligible(contact, "marketing")).toBe(false);
    expect(isMailingContactEligible(contact, "information")).toBe(true);
    for (const kind of ["marketing", "information"] as const) {
      expect(isMailingContactEligible({ ...contact, subscribed: true, unsubscribed: true }, kind)).toBe(false);
    }
    expect(isMailingContactEligible({ ...contact, customer: false, subscribed: true }, "information")).toBe(false);
  });
  it("personalizes literally without interpreting replacement metacharacters", () => {
    expect(personalizeMailingText("Bonjour {{prenom}} {{ prenom }}", "$&")).toBe("Bonjour $& $&");
    expect(personalizeMailingText("Bonjour {{prenom}}", "")).toBe("Bonjour cher client");
    expect(personalizeMailingText("Bonjour {{prenom}}", "Camille\nBcc:")).toBe("Bonjour Camille Bcc:");
  });
});
