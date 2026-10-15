import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { syncKqOrderCashRewards } from "./kanab-quest-order-cash-backend";
import { syncContestBundleRewards } from "./contest-bundle-rewards-backend";

const cashWarning = "Order cash reward synchronization temporarily unavailable.";
const bundleWarning = "Contest bundle reward synchronization temporarily unavailable.";

export async function reconcileKqBootstrapRewards(customerId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
    throw new Error("Compte Kanab Quest invalide.");
  }
  const supabase = createSupabaseServiceClient();
  // Separate transactions release cash/order locks before bundle reconciliation.
  // Payment triggers use their own lock order; never combine both repairs in SQL.
  for (const kind of ["cash", "bundle"] as const) {
    const warning = kind === "cash" ? cashWarning : bundleWarning;
    try {
      const result = await supabase.rpc("rpc_kq_sync_bootstrap_reward", {
        p_user_id: customerId, p_kind: kind,
      });
      if (result.error && ["PGRST202", "42883"].includes(result.error.code ?? "")) {
        // Rolling deployment: preserve this category's existing repair path.
        await (kind === "cash" ? syncKqOrderCashRewards(customerId) : syncContestBundleRewards(customerId));
        continue;
      }
      if (result.error || (result.data as { ok?: boolean } | null)?.ok !== true) console.warn(warning);
    } catch {
      console.warn(warning);
    }
  }
}
