import type { Contact, LeadStage } from "../types";
import { DEFAULT_LEAD_STAGE } from "./stages";

export type LeadsByStage = Record<string, Contact[]>;

/**
 * Group leads (contacts) into a column-per-stage map, ordered for the kanban.
 *
 * A lead whose `stage` is missing or not present in the configured stages is
 * bucketed into the default stage so it is never dropped from the board.
 * Each column is capped at `maxPerColumn` cards; the default matches the
 * board's `perPage` (200) so the cap never hides leads below what was fetched
 * and the column count stays accurate (e.g. an advisor's full S5 cartera).
 */
export const getLeadsByStage = (
  unorderedLeads: Contact[],
  leadStages: LeadStage[],
  maxPerColumn = 200,
): LeadsByStage => {
  if (!leadStages || leadStages.length === 0) return {};

  const empty = leadStages.reduce<LeadsByStage>(
    (acc, stage) => ({ ...acc, [stage.value]: [] }),
    {},
  );

  const fallbackStage = leadStages.find((s) => s.value === DEFAULT_LEAD_STAGE)
    ? DEFAULT_LEAD_STAGE
    : leadStages[0].value;

  const leadsByStage = unorderedLeads.reduce<LeadsByStage>((acc, lead) => {
    const stage = leadStages.find((s) => s.value === lead.stage)
      ? (lead.stage as string)
      : fallbackStage;
    acc[stage].push(lead);
    return acc;
  }, empty);

  // Cap each column to bound render cost on large pipelines.
  leadStages.forEach((stage) => {
    leadsByStage[stage.value] = leadsByStage[stage.value].slice(
      0,
      maxPerColumn,
    );
  });

  return leadsByStage;
};
