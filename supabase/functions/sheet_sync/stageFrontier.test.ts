import { assertEquals } from "jsr:@std/assert";
import { canSyncWriteStage, isSyncOwnedStage } from "./stageFrontier.ts";

Deno.test("isSyncOwnedStage treats S1..S5 as sync-owned", () => {
  for (const stage of ["S1", "S2", "S3", "S4", "S5"]) {
    assertEquals(isSyncOwnedStage(stage), true);
  }
});

Deno.test("isSyncOwnedStage treats S6..S10 and descartado as CRM-owned", () => {
  for (const stage of ["S6", "S7", "S8", "S9", "S10", "descartado"]) {
    assertEquals(isSyncOwnedStage(stage), false);
  }
});

Deno.test("a missing stage is sync-owned (new lead)", () => {
  assertEquals(isSyncOwnedStage(null), true);
  assertEquals(isSyncOwnedStage(undefined), true);
  assertEquals(isSyncOwnedStage(""), true);
});

Deno.test("canSyncWriteStage allows writing while DB stage is S1..S5", () => {
  assertEquals(canSyncWriteStage("S3"), true);
  assertEquals(canSyncWriteStage(null), true);
});

Deno.test("canSyncWriteStage blocks writing once DB stage reaches S6+", () => {
  assertEquals(canSyncWriteStage("S6"), false);
  assertEquals(canSyncWriteStage("S8"), false);
  assertEquals(canSyncWriteStage("descartado"), false);
});
