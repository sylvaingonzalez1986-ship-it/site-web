import "server-only";

import { applySupportTransaction, beginSupportCheckout, findSupportByOrder, findSupportForReconciliation, getOwnedSupport, getSupportVivaConfig, setSupportCheckoutState, supportStatus, verifiedSupportVivaSource, type SupportRecord } from "@/lib/support-backend";
import { SupportError, SUPPORT_UUID, type SupportAttempt, type SupportStatus } from "@/lib/support-campaign";
import { refreshOwnedSwissBitcoinSupport } from "@/lib/support-swiss-bitcoin-pay";
import { cancelVivaPaymentOrder, createVivaCheckoutOrder, getVivaAccessToken, retrieveVivaTransaction, type VivaVerifiedTransaction } from "@/lib/viva-payment";

/** One persisted attempt owns exactly one provider order, including ambiguous failures. */
export async function startSupportPayment(attempt: SupportAttempt): Promise<SupportStatus> {
  const config = getSupportVivaConfig();
  if (!config.isConfigured) throw new SupportError("Les contributions ne sont pas encore ouvertes.", 503);
  // Failure before Create Order is unambiguous and may safely be retried.
  let accessToken: string;
  try { accessToken = await getVivaAccessToken(config, config.endpoint, AbortSignal.timeout(8_000)); }
  catch { throw new SupportError("Viva est momentanément indisponible. Tu peux réessayer avec la même fiche.", 503); }
  const started = await beginSupportCheckout(attempt, config.sourceCode);
  if (!started.created) return supportStatus(await getOwnedSupport(attempt.id, attempt.token));
  let orderCode: string;
  try {
    orderCode = await createVivaCheckoutOrder({ config, accessToken, amount: attempt.amountCents / 100,
      merchantTrns: `SOUTIEN:${attempt.id}`, customerTrns: "Soutien volontaire aux producteurs, sans contrepartie",
      tags: ["SOUTIEN", "KANAB-QUEST"], exactEuroAmount: true, signal: AbortSignal.timeout(8_000) });
  } catch {
    await setSupportCheckoutState(attempt.id, "uncertain");
    throw new SupportError("La préparation du paiement n’a pas pu être confirmée. Ta référence est conservée ; aucun nouveau paiement ne sera créé automatiquement.", 503);
  }
  // Retry the local binding, never the provider order creation.
  for (let index = 0; ; index++) {
    try { await setSupportCheckoutState(attempt.id, "ready", orderCode); break; }
    catch {
      if (index < 2) continue;
      await setSupportCheckoutState(attempt.id, "uncertain").catch(() => {});
      throw new SupportError("La référence du paiement est en cours de rapprochement. Ne recommence pas le versement.", 503);
    }
  }
  return supportStatus(await getOwnedSupport(attempt.id, attempt.token));
}

async function retrieveSupportTransaction(transactionId: string) {
  if (!SUPPORT_UUID.test(transactionId)) throw new SupportError("Référence de paiement invalide.");
  const config = getSupportVivaConfig();
  if (!config.isConfigured) throw new SupportError("Vérification Viva momentanément indisponible.", 503);
  let verified;
  try { verified = await retrieveVivaTransaction({ config, transactionId, includeReversals: true }); }
  catch { throw new SupportError("Vérification Viva momentanément indisponible.", 503); }
  if (verified.transactionId.toLowerCase() !== transactionId.toLowerCase()) throw new SupportError("Transaction Viva incohérente.", 409);
  return verified;
}

async function recoverSupportVivaBinding(record: SupportRecord, verified: VivaVerifiedTransaction) {
  if (record.provider === "swiss-bitcoin-pay" || verified.merchantTrns !== `SOUTIEN:${record.id}`
    || verifiedSupportVivaSource(record, verified) !== record.source_code || !["EUR", "978"].includes(verified.currencyCode.toUpperCase())
    || verified.amountInMinorUnits !== record.amount_cents || verified.parentTransactionId) {
    throw new SupportError("Cette transaction ne correspond pas à la référence de soutien.", 409);
  }
  await setSupportCheckoutState(record.id, "ready", verified.orderCode);
  await applySupportTransaction({ ...record, order_code: verified.orderCode }, verified);
}

/** All callers (webhook, owned return, admin reconciliation) share the same checks. */
export async function verifySupportTransaction(record: SupportRecord, transactionId: string, parentHint?: string, orderHint?: string) {
  const verified = await retrieveSupportTransaction(transactionId);
  if (orderHint && orderHint !== verified.orderCode) throw new SupportError("Ce retour Viva ne correspond pas à ta fiche de soutien.", 409);
  if (!record.order_code) return recoverSupportVivaBinding(record, verified);
  if (verified.amountInMinorUnits < 0) {
    const parentId = verified.parentTransactionId || record.transaction_id || parentHint;
    if (!parentId || !SUPPORT_UUID.test(parentId)) throw new SupportError("Transaction d’origine en attente de rapprochement.", 503);
    const parent = await retrieveSupportTransaction(parentId);
    if (parent.orderCode !== verified.orderCode || parent.orderCode !== record.order_code || verifiedSupportVivaSource(record, parent) !== record.source_code
      || parent.amountInMinorUnits !== record.amount_cents || !["EUR", "978"].includes(parent.currencyCode.toUpperCase())
      || !["F", "C", "R", "M", "MA", "MI", "ML", "MS", "MW"].includes(parent.statusId)
      || (record.transaction_id && record.transaction_id.toLowerCase() !== parentId.toLowerCase())) {
      throw new SupportError("Le remboursement ne correspond pas au paiement d’origine.", 409);
    }
    // Refunds can be issued on Viva's Default source. The independently retrieved
    // parent authenticates the support source; the negative entry must share its order.
    await applySupportTransaction(record, { ...verified, parentTransactionId: parentId.toLowerCase() }, parent);
    await applySupportTransaction(record, parent);
  } else await applySupportTransaction(record, verified);
}

export async function refreshOwnedSupport(id: string, token: string, transactionId?: string, orderCode?: string): Promise<SupportStatus> {
  const record = await getOwnedSupport(id, token);
  if (record.provider === "swiss-bitcoin-pay") {
    if (orderCode || transactionId) throw new SupportError("Ce retour Viva ne correspond pas à ta fiche de soutien.", 409);
    return refreshOwnedSwissBitcoinSupport(record, token);
  }
  if (orderCode && orderCode !== record.order_code && (record.order_code || !transactionId)) {
    throw new SupportError("Ce retour Viva ne correspond pas à ta fiche de soutien.", 409);
  }
  // A browser-provided transaction is only a hint, never proof of payment.
  if (transactionId) await verifySupportTransaction(record, transactionId, undefined, orderCode);
  return supportStatus(await getOwnedSupport(id, token));
}

export async function cancelOwnedSupport(id: string, token: string): Promise<SupportStatus> {
  const record = await getOwnedSupport(id, token);
  if (record.provider === "swiss-bitcoin-pay") throw new SupportError("La facture Lightning doit expirer avant de créer une autre tentative.", 409);
  if (record.paid_at || record.transaction_id) throw new SupportError("Ce soutien est déjà payé ou en cours de rapprochement.", 409);
  if (record.checkout_state === "cancelled") return supportStatus(record);
  if (!record.order_code) throw new SupportError("L’équipe doit vérifier cette tentative avant de la remplacer.", 409);
  try { await cancelVivaPaymentOrder({ config: getSupportVivaConfig(), orderCode: record.order_code }); }
  catch { throw new SupportError("Viva n’a pas confirmé l’annulation. Reprends la vérification avant de recommencer.", 409); }
  await setSupportCheckoutState(id, "cancelled", record.order_code);
  return supportStatus(await getOwnedSupport(id, token));
}

export async function reconcileAdminSupport(record: SupportRecord, transactionId: string) {
  await verifySupportTransaction(record, transactionId);
}

export async function handleSupportWebhook(orderCode: string, transactionId: string, sourceCode: string, parentHint?: string) {
  const record = await findSupportByOrder(orderCode);
  if (!record) {
    // Viva may deliver events for every source to each subscribed endpoint.
    if (sourceCode && sourceCode !== getSupportVivaConfig().sourceCode) return;
    const verified = await retrieveSupportTransaction(transactionId);
    const prefix = "SOUTIEN:";
    const reference = verified.merchantTrns?.startsWith(prefix) ? verified.merchantTrns.slice(prefix.length) : "";
    if (!SUPPORT_UUID.test(reference) || verified.orderCode !== orderCode) {
      throw new SupportError("Soutien pas encore disponible. Réessayer la notification.", 503);
    }
    const pending = await findSupportForReconciliation(reference);
    if (!pending) throw new SupportError("Soutien pas encore disponible. Réessayer la notification.", 503);
    await recoverSupportVivaBinding(pending, verified);
    return;
  }
  await verifySupportTransaction(record, transactionId, parentHint);
}
