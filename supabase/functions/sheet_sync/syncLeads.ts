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
  "desarrollo_activo",
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

/** Normalize an advisor name for matching: lowercase, no accents, single spaces. */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a normalized-name -> sales.id map so the Sheet's advisor NAME can be
 * resolved to the bigint id the CRM keys everything on (ownership + RLS). This
 * is the ONLY place a name is matched; downstream the lead is assigned by id.
 */
async function buildAdvisorMap(
  supabase: SupabaseClient,
): Promise<{ nameToId: Map<string, number>; idToName: Map<number, string> }> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, first_name, last_name");
  if (error) throw error;
  const nameToId = new Map<string, number>();
  // Canonical display name per advisor id. asesor_nombre is set from this (never
  // from the raw Sheet value) so a corrupt asesor_asignado can't leak into it.
  const idToName = new Map<number, string>();
  for (const s of data ?? []) {
    const full = `${s.first_name ?? ""} ${s.last_name ?? ""}`;
    idToName.set(s.id, full.replace(/\s+/g, " ").trim());
    // Key by full name and by first_name alone so "Luis Gerardo" or "Luis" hit.
    for (const key of [
      normalizeName(full),
      normalizeName(s.first_name ?? ""),
    ]) {
      if (key) nameToId.set(key, s.id);
    }
  }
  return { nameToId, idToName };
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

  // Resolve advisor names to ids once for the whole run.
  const { nameToId: advisorMap, idToName } = await buildAdvisorMap(supabase);

  // sheet_id -> sales.id assignments, applied in a SEPARATE targeted update
  // after the bulk upsert. Assignment must NOT ride in the bulk upsert: a
  // heterogeneous upsert batch unions its columns and nulls the ones a given
  // row omits, which would wipe sales_id on the CRM-owned rows that omit it.
  const assignmentByAdvisor = new Map<string, number>();

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
    // Phone: the bot normally writes the 10 national digits to `telefono`, but a
    // batch of older WhatsApp leads only kept the full sender id (521XXXXXXXXXX)
    // as the Sheet row id, leaving `telefono` empty. Fall back to the 10 digits
    // after the 521 prefix so the number is never lost.
    let phone = (row.telefono || "").trim();
    if (!phone && /^521\d{10}$/.test(row.id)) {
      phone = row.id.slice(3);
    }
    payload.telefono = phone || null;
    if (phone) {
      payload.phone_jsonb = [{ number: phone, type: "Work" }];
    }
    // The Sheet stores the advisor as a NAME; resolve it to the bigint sales.id
    // so the lead is assigned BY ID — the lockstep trigger mirrors sales_id ->
    // asesor_asignado, which is what the RLS reads. asesor_nombre is NOT written
    // here: the handoff pipeline sometimes writes the lead's own message text
    // into asesor_asignado, so the raw value is unsafe to mirror as a display
    // name. It is set from the canonical sales name in the assignment update
    // below, only for resolved advisors. sales_id itself is applied there too,
    // gated by the stage-ownership frontier.
    let advisorId: number | null = null;
    if (row.asesor_asignado) {
      advisorId = advisorMap.get(normalizeName(row.asesor_asignado)) ?? null;
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
      if (advisorId != null) assignmentByAdvisor.set(row.id, advisorId);
      result.inserted++;
    } else if (canSyncWriteStage(existing.stage)) {
      // Existing, still sync-owned: the Sheet may refresh stage and assignment.
      if (row.stage) payload.stage = row.stage;
      if (advisorId != null) assignmentByAdvisor.set(row.id, advisorId);
      result.updated++;
    } else {
      // CRM-owned (S6+): never send a stage or reassign — the advisor/CRM owns
      // both once the handoff has been accepted.
      result.stageSkipped++;
      result.updated++;
    }

    payloadBySheetId.set(row.id, payload);
  }

  // Upsert in batches keyed on sheet_id. sales_id is intentionally NOT in any
  // payload here so the bulk upsert never touches it (assignment is applied
  // separately below). Omitting `stage` for CRM-owned leads preserves it.
  const payloads = [...payloadBySheetId.values()];
  const UPSERT_BATCH = 200;
  for (let i = 0; i < payloads.length; i += UPSERT_BATCH) {
    const batch = payloads.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "sheet_id" });
    if (error) throw error;
  }

  // Apply advisor assignment in a separate targeted update (only sync-owned
  // leads with a resolved advisor). Grouped by advisor so it's a handful of
  // `IN (...)` updates, never a full-table write — CRM-owned rows are untouched.
  // The zz_sync_advisor_id trigger mirrors sales_id -> asesor_asignado.
  const sheetIdsByAdvisor = new Map<number, string[]>();
  for (const [sheetId, advisorId] of assignmentByAdvisor) {
    const list = sheetIdsByAdvisor.get(advisorId) ?? [];
    list.push(sheetId);
    sheetIdsByAdvisor.set(advisorId, list);
  }
  const ASSIGN_BATCH = 100;
  for (const [advisorId, ids] of sheetIdsByAdvisor) {
    // Set asesor_nombre from the canonical sales name here (not in the bulk
    // upsert) so it is always a real advisor name, never a stray Sheet value.
    const advisorName = idToName.get(advisorId) ?? null;
    for (let i = 0; i < ids.length; i += ASSIGN_BATCH) {
      const batch = ids.slice(i, i + ASSIGN_BATCH);
      const { error } = await supabase
        .from("contacts")
        .update({ sales_id: advisorId, asesor_nombre: advisorName })
        .in("sheet_id", batch);
      if (error) throw error;
    }
  }

  return result;
}
