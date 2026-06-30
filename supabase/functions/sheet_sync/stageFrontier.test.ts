import { describe, it, expect } from "vitest";
import { canSyncWriteStage, isSyncOwnedStage } from "./stageFrontier.ts";

// Runs under the Node-based "functions" vitest project (the rest of the suite
// can't host Deno.test / jsr: imports), so this mirrors the original Deno test
// in vitest form.
describe("stageFrontier", () => {
  it("treats S1..S5 as sync-owned", () => {
    for (const stage of ["S1", "S2", "S3", "S4", "S5"]) {
      expect(isSyncOwnedStage(stage)).toBe(true);
    }
  });

  it("treats S6..S10 and descartado as CRM-owned", () => {
    for (const stage of ["S6", "S7", "S8", "S9", "S10", "descartado"]) {
      expect(isSyncOwnedStage(stage)).toBe(false);
    }
  });

  it("treats a missing stage as sync-owned (new lead)", () => {
    expect(isSyncOwnedStage(null)).toBe(true);
    expect(isSyncOwnedStage(undefined)).toBe(true);
    expect(isSyncOwnedStage("")).toBe(true);
  });

  it("allows the sync to write while DB stage is S1..S5", () => {
    expect(canSyncWriteStage("S3")).toBe(true);
    expect(canSyncWriteStage(null)).toBe(true);
  });

  it("blocks the sync from writing once DB stage reaches S6+", () => {
    expect(canSyncWriteStage("S6")).toBe(false);
    expect(canSyncWriteStage("S8")).toBe(false);
    expect(canSyncWriteStage("descartado")).toBe(false);
  });
});
