// Schedules a visit: creates a Google Calendar event (the source of truth) and
// mirrors it into `visitas`. Hosted on administrador@inmovel.net (the all-copy —
// admin sees every visit), with the assigned advisor's calendar as an attendee
// (so it lands on their own agenda; Josafat-advisor -> josafat@). The event
// carries extendedProperties.private.lead_id so the Calendar<->CRM sync can link
// it. The WhatsApp confirmation to the lead is sent separately (see step 6).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_CAL = "administrador@inmovel.net"; // all-copy host (sees every visit)
const TZ = "America/Mexico_City";
const CRM_BASE = "https://crm-web-production-6d3c.up.railway.app";

async function googleToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("google token: " + JSON.stringify(j));
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const {
      lead_id,
      propiedad_id,
      fecha,
      duracion = 60,
      enviar_confirmacion = false,
      // Optional snapshot for external / "URL libre" properties (not in the
      // propiedades table). When present, these override the propiedades lookup.
      fuente,
      propiedad_nombre,
      propiedad_direccion,
      propiedad_url_maps,
      propiedad_url,
    } = body;
    if (!lead_id || !propiedad_id || !fecha) {
      return json({ error: "lead_id, propiedad_id, fecha required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only an authenticated CRM user may schedule (not anon).
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Gather lead + property + advisor.
    const { data: lead } = await supabase
      .from("contacts")
      .select(
        "id, nombre, first_name, telefono, presupuesto, zona_interes, ventana_compra, forma_compra, resumen_sales, asesor_asignado, asesor_nombre",
      )
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "lead not found" }, 404);

    const { data: prop } = await supabase
      .from("propiedades")
      .select("id, nombre, direccion, url_maps")
      .eq("id", propiedad_id)
      .single();

    // Resolve display fields: own property (propiedades) wins; otherwise fall
    // back to the client-provided snapshot (external "URL libre").
    const propNombreResolved =
      prop?.nombre || propiedad_nombre || String(propiedad_id);
    const direccionResolved = prop?.direccion || propiedad_direccion || null;
    const urlMapsResolved = prop?.url_maps || propiedad_url_maps || null;
    const propFuenteResolved = prop ? "propia" : fuente || "externa";

    let advisorCal: string | null = null;
    let advisorWa: string | null = null;
    if (lead.asesor_asignado) {
      const { data: adv } = await supabase
        .from("sales")
        .select("calendario, email, whatsapp")
        .eq("id", lead.asesor_asignado)
        .single();
      advisorCal = adv?.calendario || adv?.email || null;
      advisorWa = adv?.whatsapp || null;
    }

    const leadName = lead.nombre || lead.first_name || "Lead";
    const propNombre = propNombreResolved;
    const start = new Date(fecha);
    const end = new Date(start.getTime() + Number(duracion) * 60_000);

    // Invite body — templated from CRM data, only the fields that exist.
    const lines: string[] = [`Lead: ${leadName}`];
    if (lead.telefono) lines.push(`Tel: ${lead.telefono}`);
    lines.push(`Propiedad: ${propNombre}`);
    if (direccionResolved) lines.push(`Dirección: ${direccionResolved}`);
    if (propiedad_url) lines.push(`Anuncio: ${propiedad_url}`);
    if (lead.presupuesto) lines.push(`Presupuesto: ${lead.presupuesto}`);
    if (lead.zona_interes) lines.push(`Zona: ${lead.zona_interes}`);
    if (lead.ventana_compra) lines.push(`Ventana de compra: ${lead.ventana_compra}`);
    if (lead.forma_compra) lines.push(`Forma de pago: ${lead.forma_compra}`);
    if (lead.resumen_sales) lines.push(`\nResumen: ${lead.resumen_sales}`);
    lines.push(`\nFicha: ${CRM_BASE}/l/${lead_id}`);

    const event: Record<string, unknown> = {
      summary: `Visita — ${leadName} — ${propNombre}`,
      location: direccionResolved || undefined,
      description: lines.join("\n"),
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      extendedProperties: {
        private: { lead_id: String(lead_id), propiedad_id: String(propiedad_id) },
      },
      reminders: { useDefault: true },
    };
    if (advisorCal) event.attendees = [{ email: advisorCal }];

    const token = await googleToken();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ADMIN_CAL)}/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );
    const ev = await calRes.json();
    if (!calRes.ok || ev.error) {
      return json({ error: "calendar insert", detail: ev.error ?? ev }, 502);
    }

    // Mirror into visitas (keyed on the event id).
    const { error: vErr } = await supabase.from("visitas").upsert(
      {
        lead_id,
        propiedad_id,
        fecha: start.toISOString(),
        asesor_id: lead.asesor_asignado ?? null,
        gcal_event_id: ev.id,
        propiedad_fuente: propFuenteResolved,
        propiedad_nombre: propNombreResolved,
        propiedad_url: propiedad_url ?? null,
        propiedad_url_maps: urlMapsResolved,
      },
      { onConflict: "gcal_event_id" },
    );
    if (vErr) return json({ error: "visita upsert", detail: vErr.message }, 500);

    // WhatsApp confirmation to the lead — UTILITY template `confirmacion_cita`.
    // Only when the advisor opted in (toggle) and the lead has a phone.
    let wa: unknown = null;
    if (enviar_confirmacion && lead.telefono) {
      const to = "521" + String(lead.telefono).replace(/\D/g, "").slice(-10);
      const fmtUTC = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const fechaTxt = start.toLocaleString("es-MX", {
        timeZone: TZ,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
      });
      const address = direccionResolved || propNombre;
      // Maps button base in the template is `https://maps.google.com/?q=` (the
      // format that opens reliably). Pass the suffix from the property's url_maps
      // when present, else the encoded address.
      const mapsParam =
        urlMapsResolved && urlMapsResolved.includes("?q=")
          ? urlMapsResolved.split("?q=")[1]
          : encodeURIComponent(address);
      const waBody = `wa.me/${advisorWa ?? "5215540203511"}`;
      const calParam =
        `text=${encodeURIComponent("Visita " + propNombre)}` +
        `&dates=${fmtUTC(start)}/${fmtUTC(end)}` +
        `&location=${encodeURIComponent(address)}`;
      const waRes = await fetch(
        `https://graph.facebook.com/v19.0/${Deno.env.get("WA_PHONE_NUMBER_ID")}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: "confirmacion_cita",
              language: { code: "es_MX" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: leadName },
                    { type: "text", text: propNombre },
                    { type: "text", text: fechaTxt },
                    { type: "text", text: lead.asesor_nombre || "tu asesor" },
                    { type: "text", text: waBody },
                  ],
                },
                {
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [{ type: "text", text: mapsParam }],
                },
                {
                  type: "button",
                  sub_type: "url",
                  index: "1",
                  parameters: [{ type: "text", text: calParam }],
                },
              ],
            },
          }),
        },
      );
      wa = {
        ok: waRes.ok,
        status: waRes.status,
        body: (await waRes.text()).slice(0, 300),
      };
    }

    return json({ ok: true, gcal_event_id: ev.id, htmlLink: ev.htmlLink, wa });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
