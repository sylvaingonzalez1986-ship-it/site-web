import "server-only";
import { ArenaFeedbackError } from "@/lib/arena-feedback";
import { isKqSameOriginRequest } from "@/lib/kanab-quest-request-origin";

/** Browser writes require their Origin; reuse the game's LAN development support. */
export function assertArenaFeedbackOrigin(request: Request) {
  if (!request.headers.get("origin") || !isKqSameOriginRequest(request)) {
    throw new ArenaFeedbackError("Origine de la requête invalide.", 403);
  }
}

export async function readArenaFeedbackBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ArenaFeedbackError("Le contenu doit être au format JSON.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ArenaFeedbackError("Demande vide.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 24 * 1024) {
        await reader.cancel();
        throw new ArenaFeedbackError("Message trop volumineux.", 413);
      }
      content += decoder.decode(chunk.value, { stream: true });
    }
    content += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(content); } catch { throw new ArenaFeedbackError("Demande JSON invalide."); }
}
