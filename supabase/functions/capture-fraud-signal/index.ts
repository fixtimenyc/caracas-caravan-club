// Captures fraud-prevention signals automatically (IP, device, UA, geo).
// Called silently from the client on reservation / payment events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (token) {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) userId = data.claims.sub as string;
    }
    if (!userId) {
      // Fraud capture is best-effort; never break the caller.
      return new Response(JSON.stringify({ ok: true, skipped: "no_session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: userId };

    const body = await req.json().catch(() => ({}));
    const {
      event = "reservation",
      reservation_id = null,
      device_fingerprint_hash = null,
      device = {},
    } = body ?? {};

    // Real IP from edge headers
    const ipRaw =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ??
      "";
    const country =
      req.headers.get("cf-ipcountry") ??
      req.headers.get("x-vercel-ip-country") ??
      null;
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = ipRaw ? await sha256(`ruedave|${ipRaw}`) : null;

    const enrichedDevice = {
      ...device,
      user_agent: ua,
      ip_country: country,
      captured_at: new Date().toISOString(),
      event,
      reservation_id,
    };

    // Look up reuse signals (server-side, bypasses RLS)
    let risk = 0;
    const reasons: string[] = [];

    if (device_fingerprint_hash) {
      const { count } = await supabase
        .from("fraud_signals")
        .select("user_id", { count: "exact", head: true })
        .eq("device_fingerprint_hash", device_fingerprint_hash)
        .neq("user_id", user.id);
      if ((count ?? 0) > 0) {
        risk += Math.min(60, (count ?? 0) * 25);
        reasons.push(`device_shared_with_${count}_users`);
      }
    }

    if (ipHash) {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await supabase
        .from("fraud_signals")
        .select("user_id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .neq("user_id", user.id)
        .gte("created_at", since);
      if ((count ?? 0) >= 3) {
        risk += 30;
        reasons.push("ip_burst_24h");
      }
    }

    const signalType =
      reasons.includes("ip_burst_24h") ? "ip_burst"
      : device_fingerprint_hash ? "device_reuse"
      : "multi_account";

    const { error } = await supabase.from("fraud_signals").insert({
      user_id: user.id,
      signal_type: signalType,
      device_fingerprint_hash,
      ip_hash: ipHash,
      geo_country: country,
      risk_score: Math.min(100, risk),
      details: { ...enrichedDevice, reasons },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, risk_score: risk, signal_type: signalType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
