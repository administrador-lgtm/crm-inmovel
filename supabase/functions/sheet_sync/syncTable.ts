import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type Row = Record<string, string>;

/**
 * Generic one-way upsert for the read-only reference tables (propiedades,
 * conversaciones, anuncios, asesores->sales metadata, nocnok_raw). These have
 * no ownership frontier — the Sheet (or NocNok feed) is the source of truth, so
 * we upsert every row on its primary key. Columns absent from `allowedColumns`
 * are ignored so a Sheet schema drift can't write unexpected fields.
 */
export async function upsertTable(
  supabase: SupabaseClient,
  table: string,
  conflictKey: string,
  allowedColumns: string[],
  numericColumns: Set<string>,
  booleanColumns: Set<string>,
  rows: Row[],
): Promise<number> {
  const payloads = rows
    .filter((row) => row[conflictKey])
    .map((row) => {
      const payload: Record<string, unknown> = {};
      for (const column of allowedColumns) {
        if (!(column in row)) continue;
        const value = row[column];
        if (value === "") {
          payload[column] = null;
        } else if (numericColumns.has(column)) {
          payload[column] = Number(value) || 0;
        } else if (booleanColumns.has(column)) {
          payload[column] = value.toLowerCase() === "true";
        } else {
          payload[column] = value;
        }
      }
      return payload;
    });

  if (payloads.length === 0) return 0;

  // Upsert in batches to stay well under statement limits.
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < payloads.length; i += BATCH) {
    const batch = payloads.slice(i, i + BATCH);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictKey });
    if (error) throw error;
    written += batch.length;
  }
  return written;
}
