import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";
import { formatEmailSender, getTransporter, type SmtpConfig } from "@/lib/email-smtp";
import { renderMailingEmail } from "@/lib/mailing-email";

// Real Nodemailer, with in-memory transports only. The SMTP transport is only
// constructed to check our options; no test calls its sendMail() or verify().
const config: SmtpConfig = {
  host: "smtp.example.invalid", port: 587, secure: false,
  user: "local-smoke", pass: "synthetic-password",
  fromEmail: "sender@example.invalid", fromName: "Les Chanvriers Bretons",
  replyTo: "reply@example.invalid",
};
const unsubscribeUrl = "https://example.invalid/newsletter/desinscription?token=synthetic";

describe("real Nodemailer local transport compatibility", () => {
  it("constructs and caches our SMTP configuration without opening a connection", () => {
    const transporter = getTransporter(config);
    expect(transporter.options).toMatchObject({
      host: config.host, port: 587, secure: false,
      auth: { user: config.user, pass: config.pass },
    });
    expect(getTransporter(config)).toBe(transporter);
    expect(typeof transporter.sendMail).toBe("function");
    expect(typeof transporter.close).toBe("function");
    transporter.close();
  });

  it("compiles the actual mailing template and unsubscribe headers into MIME in memory", async () => {
    const transporter = nodemailer.createTransport({
      streamTransport: true, buffer: true, newline: "windows",
      disableFileAccess: true, disableUrlAccess: true,
    });
    const message = renderMailingEmail({
      subject: "Bonjour {{prenom}}", body: "Une sélection pour {{prenom}}.\nÀ bientôt !",
      firstName: "Élodie", unsubscribeUrl,
    });
    const messageId = "<mailing-local-smoke@example.invalid>";
    try {
      const result = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: { name: "Élodie", address: "client@example.invalid" },
        replyTo: config.replyTo, ...message, messageId,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      expect(result.envelope).toEqual({ from: config.fromEmail, to: ["client@example.invalid"] });
      expect(result.messageId).toBe(messageId);
      expect(Buffer.isBuffer(result.message)).toBe(true);
      const mime = result.message.toString().replace(/\r\n[ \t]+/g, " ");
      expect(mime).toContain(`Message-ID: ${messageId}`);
      expect(mime).toContain(`Reply-To: ${config.replyTo}`);
      expect(mime).toContain("Content-Type: multipart/alternative;");
      expect(mime).toContain("Content-Type: text/plain; charset=utf-8");
      expect(mime).toContain("Content-Type: text/html; charset=utf-8");
      expect(mime).toContain(`List-Unsubscribe: <${unsubscribeUrl}>`);
      expect(mime).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
      expect(mime).not.toMatch(/^(?:Cc|Bcc):/m);
    } finally {
      transporter.close();
    }
  });

  it("preserves sender parsing, personalization and accents with the real JSON transport", async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true, skipEncoding: true });
    const message = renderMailingEmail({ subject: "Merci {{prenom}}", body: "À bientôt {{prenom}} !", firstName: "Élodie", unsubscribeUrl });
    try {
      const result = await transporter.sendMail({
        from: formatEmailSender(config), to: "client@example.invalid", ...message,
      });
      expect(result.message.from).toEqual({ name: config.fromName, address: config.fromEmail });
      expect(result.message.subject).toBe("Merci Élodie");
      expect(result.message.text).toBe(message.text);
      expect(result.message.html).toBe(message.html);
      expect(result.envelope.to).toEqual(["client@example.invalid"]);
    } finally {
      transporter.close();
    }
  });
});
