import { guardMailingRequest, mailingApiError, mailingJson, readMailingJson } from "@/lib/mailing-api";
import { listMailingCampaigns, listMailingContacts, saveMailingDraft } from "@/lib/mailing-backend";
import { getMailingSettings } from "@/lib/mailing-email";
import { parseMailingDraft } from "@/lib/mailing-policy";

export const runtime = "nodejs";

export async function GET() {
  try {
    const denied = await guardMailingRequest();
    if (denied) return denied;
    const [contacts, campaigns] = await Promise.all([listMailingContacts(), listMailingCampaigns()]);
    return mailingJson({ contacts, campaigns, settings: getMailingSettings() });
  } catch (error) { return mailingApiError(error); }
}

export async function POST(request: Request) {
  try {
    const denied = await guardMailingRequest(request, "save");
    if (denied) return denied;
    const campaign = await saveMailingDraft(parseMailingDraft(await readMailingJson(request)));
    return mailingJson({ campaign });
  } catch (error) { return mailingApiError(error); }
}
