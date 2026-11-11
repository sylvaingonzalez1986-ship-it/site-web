import { parseSupportForm, parseSupportIdentity, SUPPORT_STORAGE_KEY, type SupportAttempt, type SupportStatus, type SupportSummary } from "./support-campaign";

export function readSupportAttempt(): SupportAttempt | null {
  const stored = sessionStorage.getItem(SUPPORT_STORAGE_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  return { ...parseSupportIdentity(parsed), ...parseSupportForm(parsed) };
}
export function rememberSupportAttempt(attempt: SupportAttempt) {
  sessionStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify(attempt));
  if (readSupportAttempt()?.id !== attempt.id) throw new Error("Impossible de conserver la fiche dans ce navigateur.");
}
export function clearSupportAttempt() { sessionStorage.removeItem(SUPPORT_STORAGE_KEY); }
export function createSupportToken() { return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); }
export async function supportRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") throw new Error(payload?.error || "La cagnotte est momentanément indisponible.");
  return payload as T;
}
export function validateSupportSummary(value: SupportSummary): SupportSummary {
  const number = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
  if (!value.campaign || typeof value.campaign.title !== "string" || !number(value.collectedCents) || !number(value.contributionCount)
    || !Number.isFinite(Date.parse(value.campaign.createdAt)) || (value.feesCents !== null && !number(value.feesCents))
    || typeof value.needsReconciliation !== "boolean" || typeof value.checkoutAvailable !== "boolean"
    || !number(value.campaign.minCents) || !number(value.campaign.maxCents)
    || (value.campaign.goalCents !== null && (!number(value.campaign.goalCents) || value.campaign.goalCents === 0))
    || !Array.isArray(value.contributions) || value.contributions.some(item => typeof item.id !== "string" || typeof item.pseudonym !== "string"
      || !Number.isFinite(Date.parse(item.paidAt)) || (item.amountCents !== null && !number(item.amountCents)))
    || (value.nextOffset !== null && !number(value.nextOffset))) throw new Error("Le suivi de la cagnotte est momentanément indisponible.");
  return value;
}
export function goToSupportPayment(status: SupportStatus) {
  if (!status.checkoutUrl) return false;
  const url = new URL(status.checkoutUrl);
  if (url.protocol !== "https:" || !["www.vivapayments.com", "demo.vivapayments.com"].includes(url.hostname)
    || url.pathname !== "/web/checkout" || !/^\d{1,32}$/.test(url.searchParams.get("ref") ?? "") || url.username || url.password || url.port) {
    throw new Error("Le lien de paiement reçu est invalide.");
  }
  window.location.assign(url.href);
  return true;
}
