import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const app = "https://quartier.example.test";
const database = "https://database.example.test";
const request = new Request(app + "/api/arena/placard/test-target");

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PLACARD_TEST_APP_ORIGIN", app);
  vi.stubEnv("PLACARD_TEST_DATABASE_ORIGIN", database);
  vi.stubEnv("PLACARD_TEST_VERSION", "recette-1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", database);
});
afterEach(() => vi.unstubAllEnvs());

it("identifies the configured test deployment and its actual database", async () => {
  const response = GET(request);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    origin: app, version: "recette-1", databaseHash: createHash("sha256").update(database).digest("hex"),
  });
});

it.each([
  ["VERCEL_ENV", "production"],
  ["PLACARD_TEST_APP_ORIGIN", "https://other.example.test"],
  ["NEXT_PUBLIC_SUPABASE_URL", "https://other-database.example.test"],
  ["NEXT_PUBLIC_SUPABASE_URL", ""],
  ["NEXT_PUBLIC_SUPABASE_URL", "invalid"],
  ["PLACARD_TEST_VERSION", ""],
])("keeps the target private when %s is %s", (name, value) => {
  vi.stubEnv(name, value);
  expect(GET(request).status).toBe(404);
});
