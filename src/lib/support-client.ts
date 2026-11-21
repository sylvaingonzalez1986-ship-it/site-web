import { parseSupportForm, parseSupportIdentity, SUPPORT_STORAGE_KEY, SUPPORT_UUID, SUPPORT_VIVA_ORDER_CODE, type SupportAttempt, type SupportProvider, type SupportStatus, type SupportSummary } from "./support-campaign";

export const SUPPORT_GAME_HOME = "/arene/placard";
export const SUPPORT_PROVIDER_LABELS: Record<SupportProvider, string> = {
  viva: "Carte bancaire",
  "swiss-bitcoin-pay": "Bitcoin Lightning",
};
const gameReturnStorageKey = "lcb-support-game-return-v1";

function isProvider(value: unknown): value is SupportProvider {
  return value === "viva" || value === "swiss-bitcoin-pay";
}

export function supportGameReturnHref(value: unknown): string {
  if (typeof value !== "string" || !/^\/arene\/placard(?:\?|$)/.test(value)) return SUPPORT_GAME_HOME;
  const url = new URL(value, "https://support.local");
  url.searchParams.delete("support");
  url.searchParams.delete("token");
  return url.pathname + url.search;
}

export function readSupportGameReturnHref(id: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(gameReturnStorageKey) ?? "null");
    return saved?.id === id ? supportGameReturnHref(saved.href) : SUPPORT_GAME_HOME;
  } catch {
    return SUPPORT_GAME_HOME;
  }
}

export function readSupportAttempt(): SupportAttempt | null {
  const stored = sessionStorage.getItem(SUPPORT_STORAGE_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  if (!parsed || typeof parsed !== "object" || (parsed.provider !== undefined && !isProvider(parsed.provider))) {
    throw new Error("La fiche de soutien enregistrée est invalide.");
  }
  return { ...parseSupportIdentity(parsed), ...parseSupportForm(parsed), provider: parsed.provider ?? "viva" };
}
export function rememberSupportAttempt(attempt: SupportAttempt, gameReturnHref?: string) {
  sessionStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify(attempt));
  if (readSupportAttempt()?.id !== attempt.id) throw new Error("Impossible de conserver la fiche dans ce navigateur.");
  if (gameReturnHref) sessionStorage.setItem(gameReturnStorageKey, JSON.stringify({ id: attempt.id, href: supportGameReturnHref(gameReturnHref) }));
}
export function clearSupportAttempt() {
  sessionStorage.removeItem(gameReturnStorageKey);
  sessionStorage.removeItem(SUPPORT_STORAGE_KEY);
}

export function supportReturnIdentity(attempt: SupportAttempt, supportId: unknown, transactionId: unknown, orderCode?: unknown) {
  const identity = { id: attempt.id, token: attempt.token };
  if (attempt.provider === "swiss-bitcoin-pay") {
    return transactionId === undefined && orderCode === undefined && typeof supportId === "string" && SUPPORT_UUID.test(supportId)
      && supportId.toLowerCase() === attempt.id ? identity : null;
  }
  if (supportId !== undefined) return null;
  if (transactionId !== undefined && (typeof transactionId !== "string" || !SUPPORT_UUID.test(transactionId))) return null;
  if (orderCode !== undefined && (typeof orderCode !== "string" || !SUPPORT_VIVA_ORDER_CODE.test(orderCode))) return null;
  return { ...identity, ...(transactionId === undefined ? {} : { transactionId }), ...(orderCode === undefined ? {} : { orderCode }) };
}

const statusStates = ["creating", "ready", "uncertain", "cancelled", "expired", "paid", "refunded", "review"];

export function validateSupportStatus(value: SupportStatus, attempt: SupportAttempt): SupportStatus {
  const provider = attempt.provider ?? "viva";
  const reportedProvider = value.provider === undefined ? "viva" : value.provider;
  if (value.id !== attempt.id || reportedProvider !== provider || value.amountCents !== attempt.amountCents
    || !statusStates.includes(value.state) || !Number.isSafeInteger(value.refundedCents) || value.refundedCents < 0
    || (value.checkoutUrl !== null && typeof value.checkoutUrl !== "string")) {
    throw new Error("L’état reçu ne correspond pas à ta fiche de soutien.");
  }
  return value;
}

export function supportStatusIsFinal(status: SupportStatus | null) {
  return status !== null && ["paid", "refunded", "cancelled", "expired"].includes(status.state);
}

export function supportStatusMessage(status: SupportStatus): string {
  switch (status.state) {
    case "creating": return "Préparation du paiement en cours.";
    case "ready": return status.checkoutUrl ? "En attente de confirmation du paiement."
      : "Le lien de paiement est indisponible. Vérifie l’état de ton versement.";
    case "uncertain": return "Ton paiement reste à vérifier. Garde cette référence et évite un second versement.";
    case "cancelled": return "Cette session de paiement a été annulée.";
    case "expired": return "Cette session de paiement a expiré.";
    case "paid": return "Paiement confirmé. Merci pour ton soutien !";
    case "refunded": return "Le remboursement de ton soutien est confirmé.";
    case "review": return "Ton versement est en cours de rapprochement par l’équipe.";
  }
}
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
    || (value.providers !== undefined && (!Array.isArray(value.providers) || value.providers.some(provider => !isProvider(provider))))
    || !number(value.campaign.minCents) || !number(value.campaign.maxCents)
    || (value.campaign.goalCents !== null && (!number(value.campaign.goalCents) || value.campaign.goalCents === 0))
    || !Array.isArray(value.contributions) || value.contributions.some(item => !item || typeof item.id !== "string" || typeof item.pseudonym !== "string"
      || !Number.isFinite(Date.parse(item.paidAt)) || (item.amountCents !== null && !number(item.amountCents)))
    || (value.nextOffset !== null && !number(value.nextOffset))) throw new Error("Le suivi de la cagnotte est momentanément indisponible.");
  return value;
}
export function supportCheckoutUrl(status: SupportStatus): string | null {
  if (status.state !== "ready" || !status.checkoutUrl) return null;
  let url: URL;
  try { url = new URL(status.checkoutUrl); }
  catch { throw new Error("Le lien de paiement reçu est invalide."); }
  if (url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash) {
    if (status.provider === "swiss-bitcoin-pay") {
      if (url.hostname === "app.swiss-bitcoin-pay.ch" && /^\/invoice\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(url.pathname)
        && !url.search) return url.href;
    } else if ((status.provider === undefined || status.provider === "viva") && ["www.vivapayments.com", "demo.vivapayments.com"].includes(url.hostname)
      && url.pathname === "/web/checkout") {
      const reference = url.searchParams.get("ref");
      if (reference && SUPPORT_VIVA_ORDER_CODE.test(reference) && url.searchParams.toString() === `ref=${reference}`) return url.href;
    }
  }
  throw new Error("Le lien de paiement reçu est invalide.");
}

export function goToSupportPayment(status: SupportStatus) {
  const url = supportCheckoutUrl(status);
  if (!url) return false;
  window.location.assign(url);
  return true;
}
