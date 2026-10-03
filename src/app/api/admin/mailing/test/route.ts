import { guardMailingRequest, mailingApiError, mailingJson, readMailingJson } from "@/lib/mailing-api";
import { classifyMailingSendError, getMailingSettings, sendMailingEmail } from "@/lib/mailing-email";
import { isValidMailingEmail, MailingValidationError, normalizeMailingEmail, parseMailingMessage } from "@/lib/mailing-policy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const denied = await guardMailingRequest(request, "test");
    if (denied) return denied;
    const input = await readMailingJson(request);
    const message = parseMailingMessage(input);
    const email = normalizeMailingEmail(input.email);
    if (!isValidMailingEmail(email)) throw new MailingValidationError("Renseigne une seule adresse e-mail valide pour le test.");
    const settings = getMailingSettings();
    if (!settings.configured) return mailingJson({ error: settings.error }, 503);
    try {
      await sendMailingEmail({ ...message, email, firstName: "Camille", test: true });
    } catch (error) {
      return mailingJson({ error: classifyMailingSendError(error).message }, 502);
    }
    return mailingJson({ ok: true });
  } catch (error) { return mailingApiError(error); }
}
