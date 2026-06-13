import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  ADVISOR_OWNED_LEAD_COLUMNS,
  canSyncWriteStage,
} from "./stageFrontier.ts";

type Row = Record<string, string>;

/** Lead columns the sync mirrors from the Sheet Leads tab onto contacts. */
const SHEET_LEAD_COLUMNS = [
  "canal",
  "fuente",
  "nombre",
  "nombre_completo",
  "telefono",
  "estado",
  "ad_id",
  "zona_interes",
  "presupuesto",
  "tipo_busqueda",
  "ventana_compra",
  "forma_compra",
  "credito_status",
  "fecha_visita_propuesta",
  "asesor_asignado",
  "resumen_sales",
  "fecha_transicion_consultor",
  "fecha_ultimo_contacto",
] as const;

const NUMERIC_COLUMNS = new Set([
  "total_mensajes",
  "mensajes_post_handoff",
  "renta_seleccion_pendiente",
]);
const BOOLEAN_COLUMNS = new Set([
  "intencion_visita",
  "renta_seleccion_confirmada",
  "alerta_broker_externo_enviada",
]);

function coerce(column: string, value: string): unknown {
  if (value === "") return null;
  if (NUMERIC_COLUMNS.has(column)) return Number(value) || 0;
  if (BOOLEAN_COLUMNS.has(column)) return value.toLowerCase() === "true";
  return value;
}

export interface SyncResult {
  processed: number;
  inserted: number;
  updated: number;
  stageSkipped: number;
}

/**
 * Upsert leads from the Sheet into the contacts table, honoring the
 * stage-ownership frontier:
 *  - New leads are inserted with their Sheet stage.
 *  - Existing leads have their Sheet-owned columns refreshed, but the `stage`
 *    column is written ONLY when the lead is still sync-owned (DB stage <= S5).
 *    Once an advisor has moved it to S6+ the stage is left untouched.
 *  - Advisor-owned columns (motivo_descarte, handoff_trigger) are never written.
 *
 * Leads are keyed by `id` (the Sheet's lead id, stored verbatim on contacts so
 * the sync is idempotent).
 */
export async function syncLeads(
  supabase: SupabaseClient,
  rows: Row[],
): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    inserted: 0,
    updated: 0,
    stageSkipped: 0,
  };

  // Map existing leads by their Sheet id so we know the current DB stage.
  const sheetIds = rows.map((r) => r.id).filter(Boolean);
  const existingBySheetId = new Map<
    string,
    { id: number; stage: string | null }
  >();
  if (sheetIds.length > 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, sheet_id, stage")
      .in("sheet_id", sheetIds);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.sheet_id) {
        existingBySheetId.set(String(row.sheet_id), {
          id: row.id,
          stage: row.stage,
        });
      }
    }
  }

  for (const row of rows) {
    if (!row.id) continue;
    result.processed++;

    const payload: Record<string, unknown> = { sheet_id: row.id };
    for (const column of SHEET_LEAD_COLUMNS) {
      if (column in row) payload[column] = coerce(column, row[column]);
    }
    for (const column of NUMERIC_COLUMNS) {
      if (column in row) payload[column] = coerce(column, row[column]);
    }
    for (const column of BOOLEAN_COLUMNS) {
      if (column in row) payload[column] = coerce(column, row[column]);
    }

    // Advisor-owned columns are never written by the sync.
    for (const column of ADVISOR_OWNED_LEAD_COLUMNS) {
      delete payload[column];
    }

    const existing = existingBySheetId.get(row.id);

    if (!existing) {
      // New lead: insert with the Sheet stage (defaults to S1 if absent).
      payload.stage = row.stage || "S1";
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) throw error;
      result.inserted++;
      continue;
    }

    // Existing lead: apply the frontier guard before touching the stage.
    if (canSyncWriteStage(existing.stage)) {
      if (row.stage) payload.stage = row.stage;
    } else {
      result.stageSkipped++;
      // Defensive: ensure we never send a stage for a CRM-owned lead.
      delete payload.stage;
    }

    const { error } = await supabase
      .from("contacts")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    result.updated++;
  }

  return result;
}
