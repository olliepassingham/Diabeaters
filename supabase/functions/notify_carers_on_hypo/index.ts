/**
 * Supabase Edge Function: after a hypo is logged, notify all patient carers with receive_hypo_alerts.
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 * - SUPABASE_URL (often auto)
 * - SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 * - PUSH_NOTIFICATION_API_URL — POST JSON { to, title, body, data }
 * - PUSH_NOTIFICATION_API_KEY — Bearer token for that API
 *
 * Invoke with user's JWT; body: { hypo_id, user_id } must match the hypo row and JWT sub.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  hypo_id?: string;
  user_id?: string;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "server_misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Body;
    const hypoId = typeof body.hypo_id === "string" ? body.hypo_id.trim() : "";
    const bodyUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";

    if (!hypoId || !isUuid(hypoId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_hypo_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bodyUserId || !isUuid(bodyUserId) || bodyUserId !== callerId) {
      return new Response(JSON.stringify({ success: false, error: "user_mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hypo, error: hypoErr } = await userClient
      .from("hypo_logs")
      .select("id, user_id, blood_glucose, treatment, notes, created_at")
      .eq("id", hypoId)
      .maybeSingle();

    if (hypoErr || !hypo) {
      return new Response(JSON.stringify({ success: false, error: "hypo_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hypo.user_id !== callerId) {
      return new Response(JSON.stringify({ success: false, error: "hypo_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", hypo.user_id)
      .maybeSingle();

    const patientLabel =
      (profile as { full_name?: string } | null)?.full_name?.trim() || "Your contact";

    const { data: carerRows, error: carersErr } = await admin
      .from("carers")
      .select("id, carer_name, contact_method, contact_value, receive_hypo_alerts")
      .eq("user_id", hypo.user_id)
      .eq("receive_hypo_alerts", true);

    if (carersErr) {
      console.error("[notify_carers_on_hypo] carers query", carersErr);
      return new Response(
        JSON.stringify({ success: false, error: "carers_fetch_failed", detail: carersErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const carers = (carerRows ?? []) as {
      id: string;
      carer_name: string;
      contact_method: string;
      contact_value: string;
      receive_hypo_alerts: boolean;
    }[];

    const hypoPayload = {
      hypo_id: hypo.id,
      patient_user_id: hypo.user_id,
      blood_glucose: hypo.blood_glucose,
      treatment: hypo.treatment,
      notes: hypo.notes,
      created_at: hypo.created_at,
    };

    const title = "Hypo Treated";
    const bodyText = `${patientLabel} has treated a hypo`;

    let pushDelivered = 0;
    let inappDelivered = 0;
    const pushUrl = Deno.env.get("PUSH_NOTIFICATION_API_URL")?.trim();
    const pushKey = Deno.env.get("PUSH_NOTIFICATION_API_KEY")?.trim();

    for (const c of carers) {
      if (c.contact_method === "push" && c.contact_value.trim()) {
        if (pushUrl) {
          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (pushKey) headers["Authorization"] = `Bearer ${pushKey}`;
            const res = await fetch(pushUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                to: c.contact_value.trim(),
                title,
                body: bodyText,
                data: hypoPayload,
              }),
            });
            if (res.ok) pushDelivered += 1;
            else console.warn("[notify_carers_on_hypo] push API status", res.status, await res.text());
          } catch (e) {
            console.error("[notify_carers_on_hypo] push fetch", e);
          }
        } else {
          console.info("[notify_carers_on_hypo] PUSH_NOTIFICATION_API_URL not set; skip push for carer", c.id);
        }
      }

      if (c.contact_method === "inapp") {
        const targetUser = c.contact_value.trim();
        if (!isUuid(targetUser)) {
          console.warn("[notify_carers_on_hypo] inapp contact_value not a uuid", c.id);
          continue;
        }
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: targetUser,
          title,
          body: bodyText,
          data: { ...hypoPayload, carer_row_id: c.id, carer_name: c.carer_name },
          read: false,
        });
        if (insErr) console.error("[notify_carers_on_hypo] notification insert", insErr);
        else inappDelivered += 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eligible_carers: carers.length,
        delivered_push: pushDelivered,
        delivered_inapp: inappDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_carers_on_hypo]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
