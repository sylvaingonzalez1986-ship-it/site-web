import { describe, expect, it } from "vitest";
import robots, { PUBLIC_CRAWLER_USER_AGENTS } from "@/app/robots";

describe("robots metadata", () => {
  it("keeps public pages crawlable for every declared answer engine", () => {
    const metadata = robots();
    const rules = Array.isArray(metadata.rules) ? metadata.rules : [metadata.rules];

    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ userAgent: "*", allow: "/" }),
    ]));
    for (const userAgent of PUBLIC_CRAWLER_USER_AGENTS) {
      expect(rules).toEqual(expect.arrayContaining([
        expect.objectContaining({ userAgent, allow: "/", disallow: expect.arrayContaining(["/admin/", "/api/"]) }),
      ]));
    }
    expect(metadata.sitemap).toBe("https://www.leschanvriersbretons.com/sitemap.xml");
  });
});
