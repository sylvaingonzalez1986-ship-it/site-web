import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getChanvrierCareer, getChanvrierCareerError } from "./chanvrier-career-backend";

describe("authoritative chanvrier career", () => {
  beforeEach(() => rpc.mockReset());
  it("uses the session owner and derives the level from permanent experience", async () => {
    rpc.mockResolvedValue({ data: { xp: 700, level: 99, completedCultures: 7, processingPractice: { sifting: 3 } }, error: null });
    expect(await getChanvrierCareer("owner")).toMatchObject({ xp: 700, level: 4, completedCultures: 7, processingPractice: { sifting: 3, washing: 0, pressing: 0 } });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_chanvrier_career", { p_user_id: "owner" });
  });
  it.each([{ data: null, error: null }, { data: { xp: -1 }, error: null }, { data: { xp: 0 }, error: { message: "missing migration" } }])("does not invent progress when career is unavailable", async (response) => {
    rpc.mockResolvedValue(response);
    await expect(getChanvrierCareer("owner")).rejects.toThrow("unavailable");
  });
  it("explains server gates without leaking database errors", () => {
    expect(getChanvrierCareerError("equipment_career_level_required_4")).toContain("Niveau 4");
    expect(getChanvrierCareerError("production_career_level_required_10")).toContain("Niveau 10");
    expect(getChanvrierCareerError("equipment_career_practice_required")).toContain("pratique");
    expect(getChanvrierCareerError("equipment_career_unavailable")).toContain("acquis ou amélioré");
    expect(getChanvrierCareerError("equipment_not_owned")).toBeNull();
  });
});
