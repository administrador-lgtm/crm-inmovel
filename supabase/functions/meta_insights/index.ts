// Live Meta (Facebook) ad insights for the dashboard "Vista Marketing" panel.
// Pulls adset-level metrics straight from the Graph API on demand — spend, CPM,
// CTR, FR (messaging conversations started = the "result"/lead) and CPL — for a
// preset window (today / this week / this month). Mirrors the numbers the
// monitor-marketing job reports, but live instead of the 3x/day snapshot.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const ACCT = Deno.env.get("META_ADS_ACCOUNT") ?? "act_26234667602886912";
const TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
// Messaging conversations started (7d) — the campaigns optimise for WA messages.
const FR_ACTION = "onsite_conversion.messaging_conversation_started_7d";

const PRESETS: Record<string, string> = {
  today: "today",
  week: "this_week_mon_today",
  month: "this_month",
};

type Action = { action_type: string; value: string };

function frOf(actions: Action[] | undefined): number {
  const a = (actions ?? []).find((x) => x.action_type === FR_ACTION);
  return a ? Number(a.value) : 0;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    // Only an authenticated CRM user may read marketing numbers.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: "unauthorized" }, 401);

    if (!TOKEN) return json({ error: "META_ACCESS_TOKEN not set" }, 500);

    const body = await req.json().catch(() => ({}));
    const preset = PRESETS[body?.preset as string] ?? "today";

    const params = new URLSearchParams({
      level: "adset",
      date_preset: preset,
      fields: "adset_id,adset_name,spend,impressions,cpm,ctr,actions",
      limit: "200",
      access_token: TOKEN,
    });
    const res = await fetch(`${GRAPH}/${ACCT}/insights?${params}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      return json({ error: "graph", detail: data.error ?? data }, 502);
    }

    const adsets = (data.data ?? []).map(
      (a: Record<string, unknown>) => {
        const spend = Number(a.spend ?? 0);
        const fr = frOf(a.actions as Action[]);
        return {
          adset_id: a.adset_id as string,
          name: a.adset_name as string,
          spend: +spend.toFixed(2),
          impressions: Number(a.impressions ?? 0),
          cpm: +Number(a.cpm ?? 0).toFixed(1),
          ctr: +Number(a.ctr ?? 0).toFixed(2),
          fr,
          cpl: fr ? +(spend / fr).toFixed(2) : 0,
        };
      },
    );
    adsets.sort((x: { spend: number }, y: { spend: number }) => y.spend - x.spend);

    const totalSpend = adsets.reduce(
      (s: number, a: { spend: number }) => s + a.spend,
      0,
    );
    const totalFr = adsets.reduce((s: number, a: { fr: number }) => s + a.fr, 0);
    const totals = {
      spend: +totalSpend.toFixed(2),
      fr: totalFr,
      cpl: totalFr ? +(totalSpend / totalFr).toFixed(2) : 0,
    };

    return json({ preset, adsets, totals, fetched_at: new Date().toISOString() });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
