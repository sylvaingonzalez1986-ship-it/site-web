import { describe, expect, it } from "vitest";
import { resolveKqSchoolSection } from "./kanab-quest-school-navigation";

describe("QuizzShow section navigation", () => {
  it("opens the room for a bare or unknown destination", () => {
    expect(resolveKqSchoolSection(null)).toBe("home");
    expect(resolveKqSchoolSection(undefined)).toBe("home");
    expect(resolveKqSchoolSection("unknown")).toBe("home");
    expect(resolveKqSchoolSection("home", "reference", "plant")).toBe("home");
  });

  it("keeps tournament links and retired quiz destinations working", () => {
    for (const section of ["tournament", "quiz", "workshops"]) {
      expect(resolveKqSchoolSection(section)).toBe("tournament");
      expect(resolveKqSchoolSection(section, "plant", "anatomy")).toBe("tournament");
    }
  });

  it("preserves encyclopedia and Buddy reading destinations", () => {
    expect(resolveKqSchoolSection("learn")).toBe("learn");
    expect(resolveKqSchoolSection("learn", "plant", "anatomy")).toBe("learn");
    expect(resolveKqSchoolSection(null, "reference")).toBe("learn");
    expect(resolveKqSchoolSection(null, undefined, "library-theme-botany")).toBe("learn");
  });

  it("restores the ranking page directly without falling back to the room or encyclopedia", () => {
    expect(resolveKqSchoolSection("ranking")).toBe("ranking");
    expect(resolveKqSchoolSection("ranking", "reference", "plant")).toBe("ranking");
  });
});
