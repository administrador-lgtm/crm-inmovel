// Daily logical backup of the critical tables to Google Drive as NDJSON.
// This is redundancy layer 2 (independent of Supabase) for the Sheet->Supabase
// migration: once the Sheet is retired, Supabase is the single source of truth,
// so we mirror it out to Drive on a cron. NDJSON (not CSV) is used so jsonb and
// array columns (historial_json, phone_jsonb, zonas, ...) survive losslessly.
//
// Invoked on a daily cron with the shared x-sync-secret (same as sheet_sync).
// Layout in Drive: <root>/inmovel-supabase-backups/<YYYY-MM-DD>/<table>.ndjson
// Retention: dated folders older than RETENTION_DAYS are deleted.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { mintAccessToken } from "./googleAuth.ts";
import {
  deleteFile,
  ensureFolder,
  listChildFolders,
  uploadFile,
} from "./drive.ts";

// Drive-scoped Google OAuth. The sheet_sync/calendar_sync GOOGLE_* token only
// carries Sheets/Calendar scope; uploading to Drive needs a token with the
// drive scope, kept in dedicated EXPORT_GOOGLE_* secrets (falls back to the
// shared GOOGLE_* if those ever gain drive scope).
const GOOGLE_CLIENT_ID =
  Deno.env.get("EXPORT_GOOGLE_CLIENT_ID") ?? Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET =
  Deno.env.get("EXPORT_GOOGLE_CLIENT_SECRET") ?? Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REFRESH_TOKEN =
  Deno.env.get("EXPORT_GOOGLE_REFRESH_TOKEN") ?? Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
const SYNC_SECRET = Deno.env.get("SHEET_SYNC_SECRET") ?? "";

const ROOT_FOLDER = "inmovel-supabase-backups";
const RETENTION_DAYS = 30;
const TABLES = ["contacts", "conversaciones", "propiedades", "anuncios", "sales"];
const PAGE = 1000;

/** Read an entire table as an array of rows (paginated). */
async function dumpTable(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** Delete dated backup folders older than RETENTION_DAYS. */
async function pruneOld(token: string, rootId: string, todayMs: number): Promise<string[]> {
  const pruned: string[] = [];
  const folders = await listChildFolders(token, rootId);
  const cutoff = todayMs - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const f of folders) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.name)) continue;
    const ts = Date.parse(f.name + "T00:00:00Z");
    if (!Number.isNaN(ts) && ts < cutoff) {
      await deleteFile(token, f.id);
      pruned.push(f.name);
    }
  }
  return pruned;
}

async function runExport() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN");
  }
  const token = await mintAccessToken(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
  );

  const now = new Date();
  const dateName = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const rootId = await ensureFolder(token, ROOT_FOLDER);
  const dayId = await ensureFolder(token, dateName, rootId);

  const summary: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = await dumpTable(table);
    const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");
    await uploadFile(token, dayId, `${table}.ndjson`, ndjson);
    summary[table] = rows.length;
  }

  const pruned = await pruneOld(token, rootId, now.getTime());
  return { date: dateName, rows: summary, pruned };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const provided = req.headers.get("x-sync-secret") ?? "";
  if (!SYNC_SECRET || provided !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const summary = await runExport();
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
    return new Response(JSON.stringify({ ok: false, error: detail }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
