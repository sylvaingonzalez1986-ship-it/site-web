import { guardMailingRequest, mailingApiError, mailingJson, readMailingJson } from "@/lib/mailing-api";
import { renderMailingEmail } from "@/lib/mailing-email";
import { parseMailingMessage } from "@/lib/mailing-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const denied = await guardMailingRequest(request, "preview");
    if (denied) return denied;
    return mailingJson(renderMailingEmail({ ...parseMailingMessage(await readMailingJson(request)), firstName: "Camille" }));
  } catch (error) { return mailingApiError(error); }
}
