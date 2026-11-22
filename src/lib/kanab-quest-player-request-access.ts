import "server-only";
import { isArenaPrelaunch } from "@/lib/arena-opening";

import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { loadContestBetaTesterEnabled } from "@/lib/supabase/customer-backend";

/** The public scoreboards can be consulted from the lobby before a prize season opens. */
export async function isArenaRankingRequestEnabled(): Promise<boolean> {
  if (!isArenaPrelaunch() && isContestFeatureEnabledServer() && !isContestBetaAccessRestrictedServer()) return true;
  return isKqPlayerRequestEnabled();
}

/** Same access rules, using a verified identity without creating a customer profile. */
export async function isKqPlayerIdentityEnabled(session: { customerId: string; customer: { email: string } } | null): Promise<boolean> {
  if (!isArenaPrelaunch() && isKqPlayerApiEnabled()) return true;
  if (!isContestFeatureEnabledServer() || !session) return false;
  return isAllowedAdminEmail(session.customer.email) || await loadContestBetaTesterEnabled(session.customerId);
}

/** Private production preview uses the existing, server-verified customer roles.
 * Public launch approvals remain independent. Never cache this across requests.
 * Player routes still require an identity and use its customerId for every action.
 */
export async function isKqPlayerRequestEnabled(): Promise<boolean> {
  if (!isArenaPrelaunch() && isKqPlayerApiEnabled()) return true;
  if (!isContestFeatureEnabledServer()) return false;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return false;
  return isAllowedAdminEmail(session.customer.email)
    || session.customer.contestBetaEnabled === true;
}
