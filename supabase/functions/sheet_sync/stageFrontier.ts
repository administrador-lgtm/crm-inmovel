// The stage-ownership frontier — the single most important invariant of the
// Inmovel sync. A lead's pipeline stage is computed by the bot (and mirrored
// from the Sheet) ONLY while it is in the sync-owned range S1..S5. Once an
// advisor accepts the handoff (stage = S6) the stage becomes CRM-owned and the
// sync must NEVER overwrite it again.
//
// This module is the guard. It is intentionally pure and unit-testable: given
// the existing DB stage and the incoming Sheet stage, it decides whether the
// stage field may be written.

/** Stages whose value is owned by the sync (computed by the bot). */
export const SYNC_OWNED_STAGES = ["S1", "S2", "S3", "S4", "S5"] as const;

export type SyncOwnedStage = (typeof SYNC_OWNED_STAGES)[number];

/** True when `stage` is in the sync-owned range (S1..S5). */
export function isSyncOwnedStage(stage: string | null | undefined): boolean {
  if (!stage) return true; // a brand-new lead with no stage is still bot-owned
  return SYNC_OWNED_STAGES.includes(stage as SyncOwnedStage);
}

/**
 * Decide whether the sync may write the `stage` column for a lead.
 *
 * The frontier rule:
 *  - If the lead's CURRENT (DB) stage is already CRM-owned (>= S6 or
 *    descartado), the sync must not touch the stage — return false.
 *  - Otherwise (DB stage is still S1..S5 or absent), the sync owns it and may
 *    write the incoming value.
 *
 * Note the decision keys off the DB stage, not the incoming Sheet stage: once a
 * lead has crossed into CRM territory the Sheet can say whatever it wants and
 * we ignore the stage field for that row.
 */
export function canSyncWriteStage(
  currentDbStage: string | null | undefined,
): boolean {
  return isSyncOwnedStage(currentDbStage);
}

/**
 * Advisor-owned columns the sync must NEVER write, regardless of stage. These
 * are produced inside the CRM and have no Sheet counterpart (or must not be
 * clobbered by it): visits, notes, the discard reason, and the manually-set
 * handoff trigger all live only in Supabase.
 */
export const ADVISOR_OWNED_LEAD_COLUMNS = [
  "motivo_descarte",
  "handoff_trigger",
] as const;
