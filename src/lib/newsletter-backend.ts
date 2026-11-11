import "server-only";

import {
  listNewsletterSubscribersFromSupabase,
  markNewsletterSubscriberContactedInSupabase,
} from "@/lib/supabase/newsletter-backend";
import type { NewsletterSubscriber } from "@/types/newsletter";

export async function listNewsletterSubscribersByBackend(): Promise<NewsletterSubscriber[]> {
  return listNewsletterSubscribersFromSupabase();
}

export async function markNewsletterSubscriberContactedByBackend(input: {
  email: string;
}): Promise<void> {
  return markNewsletterSubscriberContactedInSupabase(input);
}


