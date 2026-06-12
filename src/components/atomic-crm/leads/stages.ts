import type { LeadStage } from "../types";

/**
 * Inmovel lead pipeline stages, mutually exclusive, one per lead.
 *
 * The stage lives on the lead (a contact), not on a separate deal entity.
 * S1..S5 are owned by the WhatsApp-bot sync and are READ-ONLY in the CRM;
 * S6..S10 and "descartado" are advisor-set (manual). See the ADR for the
 * stage-ownership frontier rationale.
 */
export const LEAD_STAGES: LeadStage[] = [
  { value: "S1", label: "Contacto" },
  { value: "S2", label: "En conversación" },
  { value: "S3", label: "Perfilando" },
  { value: "S4", label: "Handoff ready" },
  { value: "S5", label: "Handoff enviado" },
  { value: "S6", label: "Asesor aceptó" },
  { value: "S7", label: "Visita agendada" },
  { value: "S8", label: "Visita realizada" },
  { value: "S9", label: "Negociación" },
  { value: "S10", label: "Cierre" },
  { value: "descartado", label: "Descartado" },
];

/**
 * Stages whose value is computed and overwritten by the bot->Supabase sync.
 * Dragging a lead card into one of these columns is a no-op in the CRM.
 */
export const READ_ONLY_STAGES = ["S1", "S2", "S3", "S4", "S5"] as const;

/** The default stage assigned to a lead with an unknown/missing stage. */
export const DEFAULT_LEAD_STAGE = "S1";

/**
 * Whether a lead in the given stage can be moved by an advisor in the CRM.
 * Read-only stages (S1..S5) are sync-owned and cannot be set from the board.
 */
export const isStageEditable = (stage: string): boolean =>
  !READ_ONLY_STAGES.includes(stage as (typeof READ_ONLY_STAGES)[number]);

export const findLeadStageLabel = (
  stages: LeadStage[],
  value: string,
): string | undefined => stages.find((stage) => stage.value === value)?.label;
