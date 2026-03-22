import "server-only";

import { getCustomerByIdFullByBackend } from "@/lib/customer-backend";
import { getLotteryTicketsForCustomerByBackend } from "@/lib/lottery-backend";
import { getReferralPendingRewardsByBackend, getCustomerMissionsByBackend } from "@/lib/missions-backend";
import { getCustomerOrdersForLoyaltyByBackend } from "@/lib/order-backend";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { AdminCustomer } from "@/types/customer";
import type { LotteryTicket } from "@/types/lottery";
import type { MissionWithUserStatus, ReferralPendingReward } from "@/types/missions";
import type { NewsletterSubscriber } from "@/types/newsletter";
import type { CmsOrder } from "@/types/store";

export type CustomerDataExport = {
  exportedAt: string;
  customerId: string;
  customer: AdminCustomer;
  orders: CmsOrder[];
  lotteryTickets: LotteryTicket[];
  referralPendingRewards: ReferralPendingReward[];
  missions: MissionWithUserStatus[];
  newsletterSubscription: NewsletterSubscriber | null;
};

type NewsletterRow = {
  id: number;
  email: string;
  status: "active" | "unsubscribed";
  source: string;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
};

function mapNewsletterRow(row: NewsletterRow): NewsletterSubscriber {
  return {
    id: String(row.id),
    email: row.email,
    status: row.status,
    source: row.source || "application",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastContactedAt: row.last_contacted_at ?? undefined,
  };
}

async function getNewsletterSubscriptionByEmail(
  email: string,
): Promise<NewsletterSubscriber | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("newsletter_subscribers")
    .select("id,email,status,source,created_at,updated_at,last_contacted_at")
    .eq("email_normalized", normalizedEmail)
    .maybeSingle();

  if (result.error) {
    throw new Error(`[supabase:read newsletter subscriber by email] ${result.error.message}`);
  }

  if (!result.data) {
    return null;
  }

  return mapNewsletterRow(result.data as NewsletterRow);
}

export async function exportCustomerData(customerId: string): Promise<CustomerDataExport | null> {
  const customer = await getCustomerByIdFullByBackend(customerId);
  if (!customer) {
    return null;
  }

  const [orders, lotteryTickets, referralPendingRewards, missions, newsletterSubscription] =
    await Promise.all([
      getCustomerOrdersForLoyaltyByBackend({
        customerId,
        customerEmail: customer.email,
      }),
      getLotteryTicketsForCustomerByBackend(customerId),
      getReferralPendingRewardsByBackend(customerId),
      getCustomerMissionsByBackend(customerId),
      getNewsletterSubscriptionByEmail(customer.email),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    customerId,
    customer,
    orders,
    lotteryTickets,
    referralPendingRewards,
    missions,
    newsletterSubscription,
  };
}