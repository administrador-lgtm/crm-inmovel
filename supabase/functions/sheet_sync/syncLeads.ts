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
  // Look up existing leads in batches — a single IN() over hundreds of sheet
  // ids would blow past the REST URL length limit.
  const LOOKUP_BATCH = 100;
  for (let i = 0; i < sheetIds.length; i += LOOKUP_BATCH) {
    const batch = sheetIds.slice(i, i + LOOKUP_BATCH);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, sheet_id, stage")
      .in("sheet_id", batch);
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

  // Build one payload per unique sheet_id (the Sheet can repeat a lead id; an
  // upsert batch must not contain the same conflict key twice, so last wins).
  const payloadBySheetId = new Map<string, Record<string, unknown>>();
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

    // Map the Inmovel lead fields onto the Atomic CRM display fields so the
    // contact name, phone and timeline render (otherwise it shows "null null").
    const fullName = (row.nombre_completo || row.nombre || "").trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      payload.first_name = parts[0];
      payload.last_name = parts.slice(1).join(" ") || null;
    }
    if (row.telefono) {
      payload.phone_jsonb = [{ number: row.telefono, type: "Work" }];
    }
    const firstSeen = row.created_at || row.fecha_ultimo_contacto || "";
    if (firstSeen && !Number.isNaN(Date.parse(firstSeen))) {
      payload.first_seen = new Date(firstSeen).toISOString();
    }
    const lastSeen = row.fecha_ultimo_contacto || row.created_at || "";
    if (lastSeen && !Number.isNaN(Date.parse(lastSeen))) {
      payload.last_seen = new Date(lastSeen).toISOString();
    }

    const existing = existingBySheetId.get(row.id);
    if (!existing) {
      // New lead: set the Sheet stage (defaults to S1 if absent).
      payload.stage = row.stage || "S1";
      result.inserted++;
    } else if (canSyncWriteStage(existing.stage)) {
      // Existing, still sync-owned: the Sheet may refresh the stage.
      if (row.stage) payload.stage = row.stage;
      result.updated++;
    } else {
      // CRM-owned (S6+): never send a stage — leave the advisor's value intact.
      result.stageSkipped++;
      result.updated++;
    }

    payloadBySheetId.set(row.id, payload);
  }

  // Upsert in batches keyed on sheet_id. Omitting `stage` for CRM-owned leads
  // preserves their existing stage (PostgREST only updates provided columns).
  const payloads = [...payloadBySheetId.values()];
  const UPSERT_BATCH = 200;
  for (let i = 0; i < payloads.length; i += UPSERT_BATCH) {
    const batch = payloads.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "sheet_id" });
    if (error) throw error;
  }

  return result;
}
