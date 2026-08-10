import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots metadata", () => {
  it("keeps public pages crawlable and explicitly allows ChatGPT Search", () => {
    const metadata = robots();
    const rules = Array.isArray(metadata.rules) ? metadata.rules : [metadata.rules];

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "*", allow: "/" }),
        expect.objectContaining({ userAgent: "OAI-SearchBot", allow: "/" }),
      ]),
    );
    expect(metadata.sitemap).toBe("https://leschanvriersbretons.com/sitemap.xml");
  });
});
