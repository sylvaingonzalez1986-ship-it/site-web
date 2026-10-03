import { guardMailingRequest, mailingApiError, mailingJson, readMailingJson, requireMailingId } from "@/lib/mailing-api";
import { startMailingCampaign } from "@/lib/mailing-backend";
import { getMailingSettings } from "@/lib/mailing-email";
import { MailingValidationError } from "@/lib/mailing-policy";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await guardMailingRequest(request, "start");
    if (denied) return denied;
    const input = await readMailingJson(request);
    if (input.confirmed !== true) throw new MailingValidationError("Confirme l’envoi de cette campagne.");
    if (typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
      throw new MailingValidationError("Vérifie le récapitulatif de la campagne avant de confirmer.");
    }
    const settings = getMailingSettings();
    if (!settings.configured) return mailingJson({ error: settings.error }, 503);
    return mailingJson({ campaign: await startMailingCampaign(requireMailingId((await context.params).id), input.expectedUpdatedAt) });
  } catch (error) { return mailingApiError(error); }
}
