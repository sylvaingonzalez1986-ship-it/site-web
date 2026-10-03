import { guardMailingRequest, mailingApiError, mailingJson, requireMailingId } from "@/lib/mailing-api";
import { getMailingCampaign } from "@/lib/mailing-backend";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await guardMailingRequest();
    if (denied) return denied;
    return mailingJson(await getMailingCampaign(requireMailingId((await context.params).id)));
  } catch (error) { return mailingApiError(error); }
}
