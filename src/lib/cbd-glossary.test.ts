import { describe, expect, it } from "vitest";
import {
  CBD_GLOSSARY_ENTRIES,
  CBD_GLOSSARY_LAST_REVIEWED,
  CBD_GLOSSARY_SOURCES,
} from "@/lib/cbd-glossary";

describe("CBD glossary", () => {
  it("provides unique stable anchors for citation", () => {
    const slugs = CBD_GLOSSARY_ENTRIES.map(({ slug }) => slug);

    expect(CBD_GLOSSARY_ENTRIES).toHaveLength(15);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("cbd-naturel");
    expect(slugs).toContain("novel-food");
  });

  it("only cites declared public sources", () => {
    const declaredSources = new Set(Object.keys(CBD_GLOSSARY_SOURCES));

    for (const entry of CBD_GLOSSARY_ENTRIES) {
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of entry.sourceIds) {
        expect(declaredSources.has(sourceId)).toBe(true);
      }
    }
  });

  it("avoids medical promises in definitions", () => {
    const copy = CBD_GLOSSARY_ENTRIES
      .flatMap(({ definition, practicalCheck }) => [definition, practicalCheck])
      .join(" ");

    expect(copy).not.toMatch(/gu[ée]rit|traite?\s+(?:la|le|les)|soulage|effet relaxant|anti-douleur/i);
  });

  it("exposes a stable ISO review date", () => {
    expect(CBD_GLOSSARY_LAST_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
