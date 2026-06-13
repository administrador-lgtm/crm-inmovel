// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

// One-way Google Sheet -> Supabase sync for Inmovel. Invoked on a cron schedule
// (every 1-2 min). The bot keeps writing to the Sheet; this function mirrors the
// Sheet into Supabase. It NEVER writes back to the Sheet and NEVER overwrites a
// lead's stage once it has crossed the S6 ownership frontier (see syncLeads.ts).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { readTab } from "./sheetClient.ts";
import { syncLeads } from "./syncLeads.ts";
import { upsertTable } from "./syncTable.ts";
import { mintAccessToken } from "./googleAuth.ts";

const SPREADSHEET_ID = Deno.env.get("INMOVEL_SHEET_ID") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
// A shared secret so only the cron caller can trigger the sync (the function is
// deployed with verify_jwt = false to allow cron/service callers).
const SYNC_SECRET = Deno.env.get("SHEET_SYNC_SECRET") ?? "";

async function runSync() {
  if (
    !SPREADSHEET_ID ||
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      "Missing INMOVEL_SHEET_ID or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN",
    );
  }

  // Mint a fresh Sheets access token from the long-lived refresh token.
  const SHEETS_TOKEN = await mintAccessToken(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
  );

  const summary: Record<string, unknown> = {};

  // 1. Leads — special-cased for the stage-ownership frontier.
  const leadRows = await readTab(SPREADSHEET_ID, "Leads", SHEETS_TOKEN);
  summary.leads = await syncLeads(supabaseAdmin, leadRows);

  // 2. Propiedades — full reference upsert (keyed on id).
  const propiedadRows = await readTab(
    SPREADSHEET_ID,
    "Propiedades",
    SHEETS_TOKEN,
  );
  summary.propiedades = await upsertTable(
    supabaseAdmin,
    "propiedades",
    "id",
    [
      "id", "tipo", "nombre", "estatus", "operacion", "direccion", "colonia",
      "alcaldia", "precio", "metros", "recamaras", "banos", "estacionamiento",
      "pet_friendly", "argumento1", "argumento2", "argumento3", "lista_precios",
      "url_anuncio", "url_maps", "tipos_unidades", "precios_por_tipo",
      "caracteristicas", "amenidades", "argumentos_zona", "esquema_pago",
      "creditos", "objeciones", "precio_desde", "precio_hasta", "m2_desde",
      "m2_hasta", "recamaras_min", "recamaras_max", "unidades_disponibles",
      "fecha_entrega", "enganche_minimo_pct", "features", "destacado",
      "url_ficha", "codigo_fuente", "fuente", "broker_nombre", "broker_telefono",
      "broker_wa", "comision", "activa", "orden", "fecha_carga", "account_name",
      "account_id", "shared_commission", "status_days", "is_exclusive",
      "share_type",
    ],
    new Set([
      "precio", "metros", "recamaras", "banos", "estacionamiento",
      "precio_desde", "precio_hasta", "m2_desde", "m2_hasta", "recamaras_min",
      "recamaras_max", "orden",
    ]),
    new Set(["activa", "is_exclusive"]),
    propiedadRows,
  );

  // Build a sheet-lead-id -> contacts.id map. The Sheet's child tables
  // reference a lead by its Sheet id, but our FKs point at contacts.id, so we
  // resolve them here (paginated to cover all leads).
  const sheetToContactId = new Map<string, number>();
  {
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select("id, sheet_id")
        .not("sheet_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.sheet_id) sheetToContactId.set(String(row.sheet_id), row.id);
      }
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
  }

  // 3. Conversaciones — append-only transcript. Resolve the Sheet lead id to
  // contacts.id and drop messages whose lead isn't in the CRM.
  const conversacionRows = (
    await readTab(SPREADSHEET_ID, "Conversaciones", SHEETS_TOKEN)
  )
    .map((row) => {
      const contactId = sheetToContactId.get(row.lead_id);
      return contactId ? { ...row, lead_id: String(contactId) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  summary.conversaciones = await upsertTable(
    supabaseAdmin,
    "conversaciones",
    "id",
    ["id", "lead_id", "rol", "texto", "timestamp", "nombre_lead"],
    new Set(["id", "lead_id"]),
    new Set(),
    conversacionRows,
  );

  // 4. Anuncios — Meta ad -> property mapping.
  const anuncioRows = await readTab(SPREADSHEET_ID, "Anuncios", SHEETS_TOKEN);
  summary.anuncios = await upsertTable(
    supabaseAdmin,
    "anuncios",
    "ad_id",
    ["ad_id", "ad_name", "propiedad_id", "activo", "created_at"],
    new Set(),
    new Set(["activo"]),
    anuncioRows,
  );

  // 5. NocNok raw feed.
  const nocnokRows = await readTab(SPREADSHEET_ID, "NocNok_Raw", SHEETS_TOKEN);
  summary.nocnok_raw = await upsertTable(
    supabaseAdmin,
    "nocnok_raw",
    "codigo",
    [
      "codigo", "nocnok_id", "operacion", "precio", "category", "type",
      "type_text", "recamaras", "full_bathrooms", "half_bathrooms", "m2",
      "lot_size", "colonia", "alcaldia", "estado", "cp", "estacionamiento",
      "year_built", "levels", "title", "url_ficha", "lat", "lon",
      "account_name", "account_id", "account_plan", "shared_commission",
      "is_exclusive", "share_type", "status_days", "status_date", "fotos",
      "activa", "orden", "fecha_carga", "broker_tel", "broker_wa",
    ],
    new Set([
      "precio", "recamaras", "full_bathrooms", "half_bathrooms", "m2",
      "lot_size", "estacionamiento", "fotos", "orden",
    ]),
    new Set(["is_exclusive", "activa"]),
    nocnokRows,
  );

  return summary;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only an authorized cron caller may trigger the sync.
  const provided = req.headers.get("x-sync-secret") ?? "";
  if (!SYNC_SECRET || provided !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const summary = await runSync();
    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
    return new Response(
      JSON.stringify({ ok: false, error: detail }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
