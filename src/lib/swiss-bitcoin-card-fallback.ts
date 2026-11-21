import "server-only";

import { normalizeShippingCountryCode } from "@/lib/shipping-country";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { buildVivaCheckoutUrl, createVivaCheckoutOrder, getVivaAccessToken, getVivaConfig } from "@/lib/viva-payment";
import type { CmsOrder } from "@/types/store";

export async function switchSwissBitcoinOrderToViva(order: CmsOrder): Promise<string> {
  const config = getVivaConfig();
  if (!config.isConfigured) throw new Error("Paiement par carte indisponible.");
  // Token retrieval creates no chargeable session, so a failure keeps both
  // options available. Claim the order only before the provider creation.
  const accessToken = await getVivaAccessToken(config, config.endpoint, AbortSignal.timeout(8_000));
  const supabase = createSupabaseServiceClient();
  const claim = await supabase.rpc("rpc_claim_swiss_bitcoin_card_fallback", { p_order_id: order.id });
  if (claim.error || claim.data !== true) throw new Error("Bascule carte indisponible.");

  const orderCode = await createVivaCheckoutOrder({
    config,
    accessToken,
    amount: order.totalAmount,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.shippingPhone,
    customerCountryCode: order.shippingCountry ? normalizeShippingCountryCode(order.shippingCountry) : undefined,
    merchantTrns: `Commande ${order.id}`,
    customerTrns: `Commande ${order.id}`,
    exactEuroAmount: true,
    signal: AbortSignal.timeout(8_000),
  });
  // The same code can be attached after a transient write failure. Never
  // repeat the external POST when its outcome is unknown.
  const args = { p_order_id: order.id, p_viva_order_code: orderCode };
  let attached = await supabase.rpc("rpc_attach_swiss_bitcoin_card_fallback", args);
  if (attached.error) attached = await supabase.rpc("rpc_attach_swiss_bitcoin_card_fallback", args);
  if (attached.error || attached.data !== true) throw new Error("Session carte à vérifier.");
  const checkoutUrl = buildVivaCheckoutUrl(orderCode, config);
  if (!checkoutUrl) throw new Error("Session carte indisponible.");
  return checkoutUrl;
}
