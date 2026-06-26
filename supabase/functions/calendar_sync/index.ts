// Mirrors Google Calendar (the source of truth for scheduled visits) back into
// `visitas`. Reads administrador@inmovel.net (the all-copy host that holds every
// visit event), keeps only our events (extendedProperties.private.lead_id), and
// upserts them by gcal_event_id — reflecting reschedules and cancellations. It
// only writes the calendar-owned fields (fecha, estado, the lead/propiedad link);
// resultado/notas/asesor_id are CRM-owned and never touched. Called by pg_cron;
// guarded by a shared secret.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_CAL = "administrador@inmovel.net";

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
  const secret = Deno.env.get("SHEET_SYNC_SECRET");
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = await googleToken();

    const now = Date.now();
    const timeMin = new Date(now - 30 * 86_400_000).toISOString();
    const timeMax = new Date(now + 120 * 86_400_000).toISOString();

    const active: Record<string, unknown>[] = [];
    const cancelled: string[] = [];
    let pageToken = "";
    do {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ADMIN_CAL)}/events`,
      );
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      const j = await r.json();
      if (j.error) return json({ error: "calendar list", detail: j.error }, 502);
      for (const ev of j.items ?? []) {
        const leadId = ev.extendedProperties?.private?.lead_id;
        if (!leadId) continue; // not one of our visit events
        if (ev.status === "cancelled") {
          cancelled.push(ev.id);
        } else {
          active.push({
            gcal_event_id: ev.id,
            lead_id: Number(leadId),
            propiedad_id: ev.extendedProperties?.private?.propiedad_id || null,
            fecha: ev.start?.dateTime || ev.start?.date,
            estado: "confirmada",
          });
        }
      }
      pageToken = j.nextPageToken || "";
    } while (pageToken);

    // Upsert active visits (consistent column set -> resultado/notas/asesor_id,
    // which are never in the payload, are preserved on update).
    if (active.length) {
      const { error } = await supabase
        .from("visitas")
        .upsert(active, { onConflict: "gcal_event_id" });
      if (error) return json({ error: "upsert", detail: error.message }, 500);
    }
    // Mark cancellations (update only; never insert a phantom).
    if (cancelled.length) {
      await supabase
        .from("visitas")
        .update({ estado: "cancelada" })
        .in("gcal_event_id", cancelled);
    }

    return json({ ok: true, active: active.length, cancelled: cancelled.length });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
