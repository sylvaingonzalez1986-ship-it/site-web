import { guardMailingRequest, mailingApiError, mailingJson, requireMailingId } from "@/lib/mailing-api";
import { claimNextMailingRecipient, finishMailingRecipient, getMailingCampaign, isMailingRecipientEligible } from "@/lib/mailing-backend";
import { classifyMailingSendError, getMailingSettings, sendMailingEmail } from "@/lib/mailing-email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await guardMailingRequest(request, "process");
    if (denied) return denied;
    const id = requireMailingId((await context.params).id);
    const settings = getMailingSettings();
    if (!settings.configured) return mailingJson({ error: settings.error }, 503);
    const claimed = await claimNextMailingRecipient(id);
    if (claimed) {
      const { campaign, recipient } = claimed;
      // If the eligibility lookup fails, leave the claim in place: it will be
      // marked uncertain, never sent on incomplete subscription information.
      const eligible = await isMailingRecipientEligible(recipient.email, campaign.kind);
      if (!eligible) {
        await finishMailingRecipient(recipient.id, "skipped", "Contact supprimé, désinscrit ou ne correspondant plus à cette campagne.");
      } else {
        let result: { status: "sent" | "failed" | "uncertain"; message?: string; pause?: boolean } = { status: "sent" };
        try {
          await sendMailingEmail({ email: recipient.email, firstName: recipient.firstName, subject: campaign.subject, body: campaign.body, recipientId: recipient.id });
        } catch (error) {
          result = classifyMailingSendError(error);
        }
        // A persistence error after SMTP must not be mistaken for a delivery
        // failure, otherwise resuming could deliver the same message twice.
        await finishMailingRecipient(recipient.id, result.status, result.message);
        if (result.pause) return mailingJson({ error: result.message }, 502);
      }
    }
    return mailingJson(await getMailingCampaign(id));
  } catch (error) { return mailingApiError(error); }
}
