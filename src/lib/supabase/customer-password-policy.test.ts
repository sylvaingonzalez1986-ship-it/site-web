import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOMER_PASSWORD_MIN_LENGTH } from "@/lib/customer-password-policy";

const mocks = vi.hoisted(() => ({
  server: vi.fn(), resetClient: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), revoke: vi.fn(), leak: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.resetClient }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://example.invalid", anonKey: "fixture" }) }));
vi.mock("@/lib/password-leak-check", () => ({ assertPasswordNotLeaked: mocks.leak }));
vi.mock("@/lib/admin-session-store", () => ({ revokeAdminSessionsForCustomer: mocks.revoke }));

import { loginSupabaseCustomer, registerSupabaseCustomerWithEmailVerification, resetSupabaseCustomerPassword } from "@/lib/supabase/customer-backend";

const registration = {
  email: "fixture@example.invalid", firstName: "Test", lastName: "Compte", dateOfBirth: "1990-01-01",
  emailRedirectTo: "https://example.invalid/auth/callback",
};
beforeEach(() => {
  vi.resetAllMocks();
  const identity = { data: { user: { id: "fixture-user", email: registration.email } }, error: null };
  mocks.server.mockResolvedValue({ auth: { signUp: mocks.signUp, signInWithPassword: mocks.signInWithPassword } });
  mocks.resetClient.mockReturnValue({ auth: mocks });
  for (const operation of [mocks.signUp, mocks.verifyOtp, mocks.getUser, mocks.updateUser]) operation.mockResolvedValue(identity);
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("new customer password policy", () => {
  it.each(["12345678", "12345678901"])("rejects a short registration before Auth or leak lookup (%s)", async password => {
    await expect(registerSupabaseCustomerWithEmailVerification({ ...registration, password })).rejects.toThrow("12 caractères");
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.leak).not.toHaveBeenCalled();
  });

  it.each(["12345678", "12345678901"])("rejects a short reset before recovery or revocation (%s)", async password => {
    await expect(resetSupabaseCustomerPassword({ password, tokenHash: "fixture" })).rejects.toThrow("12 caractères");
    expect(mocks.resetClient).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.leak).not.toHaveBeenCalled();
  });

  it("accepts exactly twelve characters for registration without trimming the password", async () => {
    const password = " abcdEFG123 ";
    expect(password.length).toBe(12);
    await expect(registerSupabaseCustomerWithEmailVerification({ ...registration, password })).resolves.toEqual({ needsEmailVerification: true, email: registration.email });
    expect(mocks.leak).toHaveBeenCalledWith(password);
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ password }));
  });

  it("accepts exactly twelve characters for a verified reset", async () => {
    await expect(resetSupabaseCustomerPassword({ password: "ValidPass123!", tokenHash: "fixture" })).resolves.toEqual({ email: registration.email });
    expect(mocks.leak).toHaveBeenCalledWith("ValidPass123!");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "ValidPass123!" });
  });

  it("still sends existing eight-character passwords to Auth during login", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Email not confirmed" } });
    await expect(loginSupabaseCustomer({ email: registration.email, password: "OldPass8" })).resolves.toEqual({ error: "email_not_confirmed" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: registration.email, password: "OldPass8" });
    expect(mocks.leak).not.toHaveBeenCalled();
  });

  it("keeps the Supabase development Auth minimum aligned with the shared policy", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(Number(config.match(/^minimum_password_length\s*=\s*(\d+)$/m)?.[1])).toBe(CUSTOMER_PASSWORD_MIN_LENGTH);
  });
});
