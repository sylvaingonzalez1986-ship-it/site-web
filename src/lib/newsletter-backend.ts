import "server-only";

import {
  listNewsletterSubscribersFromSupabase,
  markNewsletterSubscriberContactedInSupabase,
  subscribeNewsletterInSupabase,
} from "@/lib/supabase/newsletter-backend";
import type { NewsletterSubscriber } from "@/types/newsletter";

export async function subscribeNewsletterByBackend(input: {
  email: string;
  source: string;
}): Promise<{ subscriber: NewsletterSubscriber; alreadySubscribed: boolean }> {
  return subscribeNewsletterInSupabase(input);
}

export async function listNewsletterSubscribersByBackend(): Promise<NewsletterSubscriber[]> {
  return listNewsletterSubscribersFromSupabase();
}

export async function markNewsletterSubscriberContactedByBackend(input: {
  email: string;
}): Promise<void> {
  return markNewsletterSubscriberContactedInSupabase(input);
}


