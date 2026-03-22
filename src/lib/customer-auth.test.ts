import { afterEach, describe, expect, it } from "vitest";
import { CUSTOMER_COOKIE_NAME, getCustomerCookieOptions } from "@/lib/customer-auth";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = originalNodeEnv;
});

describe("customer-auth", () => {
  it("returns secure cookies in production", () => {
    process.env.NODE_ENV = "production";

    expect(CUSTOMER_COOKIE_NAME).toBe("lcb_customer_session");
    expect(getCustomerCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it("returns non-secure cookies outside production and accepts a custom max age", () => {
    process.env.NODE_ENV = "development";

    expect(getCustomerCookieOptions(600)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 600,
    });
  });
});