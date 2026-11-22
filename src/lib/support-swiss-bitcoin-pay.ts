import "server-only";

import {
  createSwissBitcoinSupportInvoice, fetchSwissBitcoinInvoice, inspectSwissBitcoinInvoice, isSwissBitcoinSupportEnabled,
  isSwissBitcoinSupportInvoice, SwissBitcoinCreationError, swissBitcoinInvoiceId, swissBitcoinInvoiceReference, swissBitcoinSupportPurpose,
} from "@/lib/swiss-bitcoin-pay";
import {
  beginSupportCheckout, claimSupportSwissChecks, findSupportBySwissInvoice, findSupportForReconciliation,
  getOwnedSupport, observeSupportSwissInvoice, recordSupportSwissCreationRefusal, setSupportSwissCheckout, supportStatus, type SupportRecord,
} from "@/lib/support-backend";
import { SupportError, type SupportAttempt } from "@/lib/support-campaign";

export async function startSwissBitcoinSupport(attempt: SupportAttempt) {
  if (!isSwissBitcoinSupportEnabled()) throw new SupportError("Le soutien via Lightning est momentanément indisponible.", 503);
  const started = await beginSupportCheckout({ ...attempt, provider: "swiss-bitcoin-pay" }, swissBitcoinSupportPurpose);
  if (!started.created) return supportStatus(await getOwnedSupport(attempt.id, attempt.token));

  const invoice = await createSwissBitcoinSupportInvoice(attempt.id, attempt.amountCents).catch(async error => {
    if (error instanceof SwissBitcoinCreationError && error.definitive) {
      await recordSupportSwissCreationRefusal(attempt.id);
      return null;
    }
    // The provider may have created an invoice before the connection failed.
    await setSupportSwissCheckout(attempt.id, null).catch(() => {});
    throw new SupportError("La préparation du paiement n’a pas pu être confirmée. Ta référence est conservée et aucun nouveau paiement ne sera créé automatiquement.", 503);
  });
  if (invoice) {
    await setSupportSwissCheckout(attempt.id, invoice.invoiceId).catch(() => setSupportSwissCheckout(attempt.id, invoice.invoiceId));
  }
  return supportStatus(await getOwnedSupport(attempt.id, attempt.token));
}

type SwissSupportBinding = { id: string; amount_cents: number; invoice_id?: string | null };

async function observeInvoice(record: SwissSupportBinding, invoiceId: string, invoice: unknown) {
  if (record.invoice_id && record.invoice_id !== invoiceId) return null;
  const observation = inspectSwissBitcoinInvoice(invoice, invoiceId, record.id, record.amount_cents, swissBitcoinSupportPurpose);
  if (!record.invoice_id && !observation.associationVerified) return null;
  await observeSupportSwissInvoice(record.id, invoiceId, observation);
  return observation;
}

export async function refreshOwnedSwissBitcoinSupport(record: SupportRecord, token: string) {
  if (!record.invoice_id || record.paid_at || (record.last_checked_at && Date.now() - Date.parse(record.last_checked_at) < 5_000)) {
    return supportStatus(record);
  }
  let invoice: unknown;
  try { invoice = await fetchSwissBitcoinInvoice(record.invoice_id); }
  catch { throw new SupportError("La vérification Lightning est momentanément indisponible. Tu peux vérifier à nouveau dans quelques instants.", 503); }
  await observeInvoice(record, record.invoice_id, invoice);
  return supportStatus(await getOwnedSupport(record.id, token));
}

export async function receiveSwissBitcoinSupportNotification(invoiceId: string) {
  const known = await findSupportBySwissInvoice(invoiceId);
  const invoice = await fetchSwissBitcoinInvoice(invoiceId);
  if (known) {
    await observeInvoice(known, invoiceId, invoice);
    return;
  }

  // Use the provider's verified invoice to recover a local binding after an ambiguous POST.
  const id = swissBitcoinInvoiceReference(invoice);
  if (!id || swissBitcoinInvoiceId(invoice) !== invoiceId || !isSwissBitcoinSupportInvoice(invoice)) return;
  const record = await findSupportForReconciliation(id);
  if (record?.provider === "swiss-bitcoin-pay") await observeInvoice(record, invoiceId, invoice);
}

export async function reconcileAdminSwissBitcoinSupport(record: SupportRecord, invoiceId: string) {
  if (record.invoice_id && record.invoice_id !== invoiceId) throw new SupportError("Cette facture ne correspond pas à la référence de soutien.", 409);
  let invoice: unknown;
  try { invoice = await fetchSwissBitcoinInvoice(invoiceId); }
  catch { throw new SupportError("Vérification Swiss Bitcoin Pay momentanément indisponible.", 503); }
  const observed = await observeInvoice(record, invoiceId, invoice);
  if (!observed?.associationVerified) throw new SupportError("Cette facture ne correspond pas à la référence de soutien.", 409);
  return observed;
}

export async function reconcileSwissBitcoinSupport() {
  const records = await claimSupportSwissChecks();
  let failed = 0;
  for (let offset = 0; offset < records.length; offset += 4) {
    const checked = await Promise.allSettled(records.slice(offset, offset + 4).map(async record => {
      const invoice = await fetchSwissBitcoinInvoice(record.invoice_id);
      await observeInvoice(record, record.invoice_id, invoice);
    }));
    failed += checked.filter(result => result.status === "rejected").length;
  }
  return { checked: records.length, failed };
}
