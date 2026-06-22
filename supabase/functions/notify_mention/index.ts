// Sends the approved `crm_aviso_nota` WhatsApp template to the recipient of a
// note @mention. Invoked by the note_mentions AFTER INSERT trigger (pg_net),
// guarded by a shared secret. Skips silently when the recipient has no number.
import { createClient } from "jsr:@supabase/supabase-js@2";

const WA_VERSION = "v19.0";
const TEMPLATE = "crm_aviso_nota";

Deno.serve(async (req) => {
  const expected = Deno.env.get("NOTIFY_SECRET");
  if (expected && req.headers.get("x-notify-secret") !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mentionId = body.mention_id ?? body.record?.id;
  if (!mentionId) {
    return new Response("missing mention_id", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: mention } = await supabase
    .from("note_mentions_inbox")
    .select("recipient_id, sender_name, lead_name, note_text, contact_id")
    .eq("id", mentionId)
    .single();
  if (!mention) {
    return new Response("mention not found", { status: 404 });
  }

  const { data: recipient } = await supabase
    .from("sales")
    .select("whatsapp")
    .eq("id", mention.recipient_id)
    .single();
  const to = recipient?.whatsapp;
  if (!to) {
    // No number on file — in-app notification still stands; nothing to send.
    return new Response(JSON.stringify({ skipped: "no whatsapp" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
  const phoneId = Deno.env.get("WA_PHONE_NUMBER_ID")!;
  const noteText = (mention.note_text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: TEMPLATE,
      language: { code: "es_MX" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: mention.sender_name || "Alguien" },
            { type: "text", text: mention.lead_name || "un lead" },
            { type: "text", text: noteText || "(sin texto)" },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: String(mention.contact_id) }],
        },
      ],
    },
  };

  const wa = await fetch(
    `https://graph.facebook.com/${WA_VERSION}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const waBody = await wa.text();
  return new Response(
    JSON.stringify({ ok: wa.ok, status: wa.status, wa: waBody.slice(0, 400) }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
