import { describe, expect, it } from "vitest";
import {
  buildKqRetroPreviewFingerprint,
  isKqRetroExecutionAllowed,
  KQ_RETRO_EXECUTION_CONFIRMATION,
} from "@/lib/kanab-quest-retro-execution";

describe("Kanab Quest retro-attribution write gate", () => {
  it("stays closed by default", () => {
    expect(isKqRetroExecutionAllowed({})).toBe(false);
    expect(isKqRetroExecutionAllowed({ KQ_RETRO_ADMIN_WRITES_ALLOWED: "false" })).toBe(false);
  });

  it("requires an explicit true value and a stable confirmation phrase", () => {
    expect(isKqRetroExecutionAllowed({ KQ_RETRO_ADMIN_WRITES_ALLOWED: " TRUE " })).toBe(true);
    expect(KQ_RETRO_EXECUTION_CONFIRMATION).toBe("EXECUTE_RETRO_BATCH");
  });

  it("binds an execution to the exact preview cursor and counters", () => {
    expect(buildKqRetroPreviewFingerprint("notebook", 120, {
      processed: 9,
      pending: 7,
      alreadyGranted: 2,
      nextCursor: null,
    })).toBe("notebook:120:9:7:2:end");
    expect(buildKqRetroPreviewFingerprint("heritage", 250, {
      processedItems: 25,
      eligibleUnits: 8,
      pendingUnits: 6,
      alreadyAwarded: 2,
      nextCursor: 280,
    })).toBe("heritage:250:25:8:6:2:280");
    expect(buildKqRetroPreviewFingerprint("producer", 50, {
      processed: 50,
      eligibleReviews: 12,
      pendingFlowerBoosters: 20,
      pendingHeritages: 3,
      alreadyComplete: 7,
      nextCursor: 100,
    })).toBe("producer:50:50:12:20:3:7:100");
  });
});
