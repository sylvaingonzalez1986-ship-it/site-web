import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyMailingSendError, getMailingSettings, renderMailingEmail, sendMailingEmail } from "@/lib/mailing-email";
import { createMailingUnsubscribeToken, readMailingUnsubscribeToken } from "@/lib/mailing-unsubscribe";

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "mailing-test-only-secret-32-characters-minimum");
  vi.stubEnv("NEWSLETTER_SMTP_HOST", "smtp.example.test");
  vi.stubEnv("NEWSLETTER_SMTP_PORT", "587");
  vi.stubEnv("NEWSLETTER_SMTP_USER", "user");
  vi.stubEnv("NEWSLETTER_SMTP_PASS", "test-secret-never-real");
  vi.stubEnv("NEWSLETTER_FROM_EMAIL", "sender@example.test");
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
  mocks.sendMail.mockResolvedValue({ accepted: ["client@example.test"] });
});
afterEach(() => vi.unstubAllEnvs());

describe("mailing unsubscribe signatures", () => {
  it("accepts its email token and rejects tampering, arbitrary values and other emails", () => {
    const token = createMailingUnsubscribeToken("CLIENT@example.test");
    expect(readMailingUnsubscribeToken(token)).toBe("client@example.test");
    expect(readMailingUnsubscribeToken(`a${token}`)).toBeNull();
    expect(readMailingUnsubscribeToken(token.replace(/.$/, "!"))).toBeNull();
    expect(readMailingUnsubscribeToken(null)).toBeNull();
    expect(readMailingUnsubscribeToken("a".repeat(513))).toBeNull();
    const otherPayload = Buffer.from("other@example.test").toString("base64url");
    expect(readMailingUnsubscribeToken(`${otherPayload}.${token.split(".")[1]}`)).toBeNull();
  });
  it("requires a usable signing secret to enable sending", () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "short");
    expect(getMailingSettings().configured).toBe(false);
    expect(getMailingSettings().error).toContain("32 caractères");
  });
});

describe("mailing SMTP messages", () => {
  it("escapes subject, body and personalized names in HTML while preserving plain text", () => {
    const result = renderMailingEmail({ subject: "<script>bad</script>", body: "Bonjour {{prenom}}\n<img src=x onerror=alert(1)>", firstName: "<b>Camille</b>", unsubscribeUrl: "https://example.test/unsubscribe?token=x&v=1" });
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("<img");
    expect(result.html).toContain("&lt;b&gt;Camille&lt;/b&gt;");
    expect(result.text).toContain("Bonjour <b>Camille</b>\n<img");
    expect(result.html).toContain("token=x&amp;v=1");
  });
  it("sends one recipient only with stable message ID and personal unsubscribe headers", async () => {
    await sendMailingEmail({ email: "client@example.test", firstName: "Camille", subject: "Bonjour", body: "Salut {{prenom}}", recipientId: "unique-recipient-id" });
    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.to).toEqual({ address: "client@example.test", name: "Camille" });
    expect(mail.cc).toBeUndefined();
    expect(mail.bcc).toBeUndefined();
    expect(mail.messageId).toContain("mailing-unique-recipient-id@");
    expect(mail.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail.text).toContain("/newsletter/desinscription?token=");
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.createTransport.mock.calls[0][0]).toMatchObject({ socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  });
  it("marks a test clearly and does not give it a live unsubscribe action", async () => {
    await sendMailingEmail({ email: "client@example.test", firstName: "Camille", subject: "Bonjour", body: "Test", test: true });
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({ subject: "[TEST] Bonjour" });
    expect(mocks.sendMail.mock.calls[0][0].headers).toBeUndefined();
    expect(mocks.sendMail.mock.calls[0][0].text).not.toContain("?token=");
  });
  it("closes transport on rejection and distinguishes unknown delivery from explicit SMTP refusal", async () => {
    mocks.sendMail.mockRejectedValue(Object.assign(new Error("socket closed"), { code: "ECONNECTION" }));
    await expect(sendMailingEmail({ email: "client@example.test", firstName: "", subject: "Bonjour", body: "Test" })).rejects.toThrow();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(classifyMailingSendError({ code: "ETIMEDOUT" }).status).toBe("uncertain");
    expect(classifyMailingSendError({ code: "EAUTH" }).status).toBe("failed");
    expect(classifyMailingSendError({ responseCode: 550 }).status).toBe("failed");
    expect(classifyMailingSendError({ responseCode: 550 }).pause).toBe(false);
    expect(classifyMailingSendError({ responseCode: 421 }).pause).toBe(true);
    expect(classifyMailingSendError({ code: "EAUTH" }).pause).toBe(true);
    expect(classifyMailingSendError({ code: "ETIMEDOUT" }).pause).toBe(true);
  });
});
