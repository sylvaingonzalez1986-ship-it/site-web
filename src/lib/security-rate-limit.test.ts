import { describe, expect, it } from "vitest";
import { getRequestIp } from "@/lib/security-rate-limit";

describe("request IP normalization", () => {
  it.each([
    ["2001:db8::1", "2001:db8::1"], ["2001:db8::2", "2001:db8::2"],
    ["2001:0DB8:0:0:0:0:0:1", "2001:db8::1"], ["[2001:db8::1]:443", "2001:db8::1"],
    ["::ffff:192.0.2.1", "192.0.2.1"], ["192.0.2.1:443", "192.0.2.1"],
    ["invalid", "unknown"], ["fe80::1%eth0", "unknown"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(getRequestIp(new Request("https://example.invalid", { headers: { "x-real-ip": input } }))).toBe(expected);
  });
  it("reads the first valid forwarded IP", () => {
    expect(getRequestIp(new Request("https://example.invalid", { headers: { "x-forwarded-for": "unknown, 203.0.113.5, 198.51.100.8" } }))).toBe("203.0.113.5");
  });
});
