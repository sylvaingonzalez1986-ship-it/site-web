import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ assign: vi.fn(), dispatchEvent: vi.fn(), request: vi.fn() }));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: <T>(initial: T) => [initial, vi.fn()],
}));

import { AgeGatePageClient } from "./AgeGatePageClient";

function confirmationHandler(node: ReactNode): (() => Promise<void>) | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(child)) continue;
    if (child.type === "button" && child.props.onClick) return child.props.onClick;
    const handler = confirmationHandler(child.props.children);
    if (handler) return handler;
  }
}

async function confirm(nextPathParam: string) {
  const handler = confirmationHandler(AgeGatePageClient({ nextPathParam }));
  expect(handler).toBeDefined();
  await handler!();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.request);
  vi.stubGlobal("window", { location: { assign: mocks.assign }, dispatchEvent: mocks.dispatchEvent });
  mocks.request.mockResolvedValue(Response.json({ success: true }));
});

afterEach(() => vi.unstubAllGlobals());

describe("age verification return navigation", () => {
  it.each(["/\\audit.invalid", "/%255caudit.invalid", "//audit.invalid"])(
    "blocks an external return after age verification: %s", async (next) => {
      await confirm(next);
      expect(mocks.assign).toHaveBeenCalledExactlyOnceWith("/");
    },
  );

  it("preserves the intended shop destination and its encoded filters", async () => {
    const next = "/boutique?filtre=huile%26bio#catalogue";
    await confirm(next);
    expect(mocks.assign).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("does not navigate when age verification fails", async () => {
    mocks.request.mockResolvedValue(Response.json({ error: "Refus" }, { status: 400 }));
    await confirm("/boutique");
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});
