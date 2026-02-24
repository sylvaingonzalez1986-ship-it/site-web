import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { NewsletterSubscriber, NewsletterSubscriberStatus } from "@/types/newsletter";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const ALLOWED_STATUS: ReadonlyArray<NewsletterSubscriberStatus> = ["active", "unsubscribed"];

type NewsletterRow = {
  id: number;
  email: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
};

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

function sanitizeSource(value: string | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed) {
    return "application";
  }

  return trimmed.replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "application";
}

function mapSubscriberRow(row: NewsletterRow): NewsletterSubscriber {
  const safeStatus = ALLOWED_STATUS.includes(row.status as NewsletterSubscriberStatus)
    ? (row.status as NewsletterSubscriberStatus)
    : "active";

  return {
    id: String(row.id),
    email: row.email,
    status: safeStatus,
    source: row.source || "application",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastContactedAt: row.last_contacted_at ?? undefined,
  };
}

export async function subscribeNewsletterInSupabase(input: {
  email: string;
  source: string;
}): Promise<{ subscriber: NewsletterSubscriber; alreadySubscribed: boolean }> {
  const email = normalizeEmail(input.email);
  if (!email || !isValidEmail(email)) {
    throw new Error("Adresse e-mail invalide.");
  }

  const supabase = createSupabaseServiceClient();

  const existingResult = await supabase
    .from("newsletter_subscribers")
    .select("id,status")
    .eq("email_normalized", email)
    .maybeSingle();
  failIfError(existingResult.error, "read newsletter subscriber by email");

  const alreadySubscribed = existingResult.data?.status === "active";

  const upsertResult = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        email_normalized: email,
        status: "active",
        source: sanitizeSource(input.source),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    )
    .select("id,email,status,source,created_at,updated_at,last_contacted_at")
    .single();
  failIfError(upsertResult.error, "upsert newsletter subscriber");

  return {
    subscriber: mapSubscriberRow(upsertResult.data as NewsletterRow),
    alreadySubscribed,
  };
}

export async function listNewsletterSubscribersFromSupabase(): Promise<NewsletterSubscriber[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("newsletter_subscribers")
    .select("id,email,status,source,created_at,updated_at,last_contacted_at")
    .order("created_at", { ascending: false });

  failIfError(result.error, "list newsletter subscribers");

  return (result.data ?? []).map((row) => mapSubscriberRow(row as NewsletterRow));
}

export async function markNewsletterSubscriberContactedInSupabase(input: {
  email: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("newsletter_subscribers")
    .update({
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email_normalized", email);

  failIfError(result.error, "mark newsletter subscriber contacted");
}



