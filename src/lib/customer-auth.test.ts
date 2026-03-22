import { afterEach, describe, expect, it } from "vitest";
import { CUSTOMER_COOKIE_NAME, getCustomerCookieOptions } from "@/lib/customer-auth";

const mutableEnv = process.env as Record<string, string | undefined>;
const originalNodeEnv = mutableEnv.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(mutableEnv, "NODE_ENV");
    return;
  }

  mutableEnv.NODE_ENV = originalNodeEnv;
});

describe("customer-auth", () => {
  it("returns secure cookies in production", () => {
    mutableEnv.NODE_ENV = "production";

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
    mutableEnv.NODE_ENV = "development";

    expect(getCustomerCookieOptions(600)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 600,
    });
  });
});