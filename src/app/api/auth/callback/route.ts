import { NextResponse } from "next/server";
import {
  bindSupabaseReferralCodeSafe,
  clearSupabaseSignupTransientMetadata,
  ensureSupabaseProfileRow,
} from "@/lib/supabase/customer-backend";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectUrl = new URL("/compte/connexion", url.origin);

  if (!code) {
    redirectUrl.searchParams.set("error", "verification_invalide");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeResult.error) {
      redirectUrl.searchParams.set("error", "verification_invalide");
      return NextResponse.redirect(redirectUrl);
    }

    const user = exchangeResult.data.user;
    if (!user) {
      redirectUrl.searchParams.set("error", "verification_invalide");
      return NextResponse.redirect(redirectUrl);
    }

    const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
    const firstName = toStringValue(metadata.firstName);
    const lastName = toStringValue(metadata.lastName);
    const dateOfBirth = toStringValue(metadata.dateOfBirth);
    const phone = toStringValue(metadata.phone);
    const address = toStringValue(metadata.address);
    const city = toStringValue(metadata.city);
    const postalCode = toStringValue(metadata.postalCode);
    const country = toStringValue(metadata.country);
    const referralCode = toStringValue(metadata.referralCode);

    await ensureSupabaseProfileRow({
      userId: user.id,
      firstName,
      lastName,
      dateOfBirth,
      phone,
      address,
      city,
      postalCode,
      country,
    });

    if (referralCode) {
      try {
        await bindSupabaseReferralCodeSafe({
          refereeId: user.id,
          referralCode,
        });
      } catch {
        // Ignore referral bind failures during callback to keep email verification path resilient.
      }
    }

    await clearSupabaseSignupTransientMetadata(user.id);
    await supabase.auth.signOut();

    redirectUrl.searchParams.set("verified", "true");
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set("error", "verification_invalide");
    return NextResponse.redirect(redirectUrl);
  }
}

