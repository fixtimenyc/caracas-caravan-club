// Edge function: verifies a Meta (Facebook/Instagram) identity by running the
// OAuth "code" exchange server-side and returning basic profile info plus a
// uniqueness check against renter_verifications.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

const StartSchema = z.object({
  action: z.literal("start"),
  provider: z.enum(["facebook", "instagram"]),
  redirectUri: z.string().url(),
});

const ExchangeSchema = z.object({
  action: z.literal("exchange"),
  provider: z.enum(["facebook", "instagram"]),
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url(),
});

const BodySchema = z.union([StartSchema, ExchangeSchema]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmac(state: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(META_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(state),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signState(userId: string, provider: string): Promise<string> {
  const payload = `${userId}.${provider}.${Date.now()}.${crypto.randomUUID()}`;
  const sig = await hmac(payload);
  return `${btoa(payload)}.${sig}`;
}

async function verifyState(
  state: string,
  userId: string,
  provider: string,
): Promise<boolean> {
  const [b64, sig] = state.split(".");
  if (!b64 || !sig) return false;
  let payload: string;
  try {
    payload = atob(b64);
  } catch {
    return false;
  }
  const expected = await hmac(payload);
  if (expected !== sig) return false;
  const [uid, prov, tsStr] = payload.split(".");
  if (uid !== userId || prov !== provider) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  // 10 minutes max
  return Date.now() - ts < 10 * 60 * 1000;
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // NOTE: When META_APP_ID / META_APP_SECRET are not configured yet the
  // function runs in DEMO MODE — no real Meta call is made, the "authorize"
  // popup lands directly on our own callback with a synthetic code, and the
  // exchange returns a fake identity. Set both secrets and this branch turns
  // off automatically; the rest of the code below is the real integration
  // point and does not need to change.
  const DEMO_MODE = !META_APP_ID || !META_APP_SECRET;

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    const user = await getUserFromRequest(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // ---- START: build the authorization URL ----
    if (body.action === "start") {
      if (DEMO_MODE) {
        // Fake authorize URL: send the popup straight back to our own
        // callback with a synthetic code + a signed state so the exchange
        // step still validates state correctly.
        const state = await signStateDemo(user.id, body.provider);
        const params = new URLSearchParams({
          code: `demo_${crypto.randomUUID()}`,
          state,
        });
        return json({
          authUrl: `${body.redirectUri}?${params.toString()}`,
          demo: true,
        });
      }

      const scopes =
        body.provider === "instagram"
          ? [
              "public_profile",
              "email",
              "instagram_basic",
              "pages_show_list",
            ].join(",")
          : ["public_profile", "email"].join(",");

      const state = await signState(user.id, body.provider);
      const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: body.redirectUri,
        state,
        response_type: "code",
        scope: scopes,
        auth_type: "rerequest",
      });
      return json({
        authUrl: `${OAUTH_DIALOG}?${params.toString()}`,
      });
    }

    // ---- EXCHANGE: swap code for token, load profile, check uniqueness ----
    if (DEMO_MODE) {
      const okState = await verifyStateDemo(body.state, user.id, body.provider);
      if (!okState) return json({ error: "invalid_state" }, 400);
      const label = body.provider === "instagram" ? "Instagram" : "Facebook";
      const identity = {
        provider: body.provider,
        providerUserId: `demo-${body.provider}-${user.id.slice(0, 8)}`,
        name: user.user_metadata?.full_name || user.email || `Usuario ${label}`,
        email: user.email || "",
        picture: "",
      };
      return json({ ok: true, identity, demo: true });
    }


    // ---- EXCHANGE: swap code for token, load profile, check uniqueness ----
    const okState = await verifyState(body.state, user.id, body.provider);
    if (!okState) return json({ error: "invalid_state" }, 400);

    const tokenParams = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: body.redirectUri,
      code: body.code,
    });
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?${tokenParams.toString()}`,
    );
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("Meta token exchange failed", tokenRes.status, t);
      return json(
        { error: "token_exchange_failed", details: t },
        tokenRes.status,
      );
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return json({ error: "no_access_token" }, 500);
    }

    // Basic profile
    const meRes = await fetch(
      `${GRAPH}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
        accessToken,
      )}`,
    );
    if (!meRes.ok) {
      const t = await meRes.text();
      console.error("Meta /me failed", meRes.status, t);
      return json({ error: "profile_fetch_failed", details: t }, meRes.status);
    }
    const me = (await meRes.json()) as {
      id: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };

    let providerUserId = me.id;
    let providerName = me.name ?? "";
    let providerEmail = me.email ?? "";
    let providerPicture = me.picture?.data?.url ?? "";

    // For Instagram, try to find a linked IG-Business account.
    if (body.provider === "instagram") {
      const pagesRes = await fetch(
        `${GRAPH}/me/accounts?fields=instagram_business_account{id,username,profile_picture_url,name}&access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      if (!pagesRes.ok) {
        const t = await pagesRes.text();
        console.error("Meta /me/accounts failed", pagesRes.status, t);
        return json(
          { error: "instagram_pages_failed", details: t },
          pagesRes.status,
        );
      }
      const pages = (await pagesRes.json()) as {
        data?: Array<{
          instagram_business_account?: {
            id: string;
            username?: string;
            profile_picture_url?: string;
            name?: string;
          };
        }>;
      };
      const ig = pages.data
        ?.map((p) => p.instagram_business_account)
        .find((x) => !!x);
      if (!ig) {
        return json(
          {
            error: "instagram_not_business",
            message:
              "Tu cuenta de Instagram debe estar enlazada a una página de Facebook como cuenta Business/Creator. Prueba con Facebook.",
          },
          400,
        );
      }
      providerUserId = ig.id;
      providerName = ig.name ?? ig.username ?? providerName;
      providerPicture = ig.profile_picture_url ?? providerPicture;
    }

    // Uniqueness: this provider+id must not be used by another user.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: existing, error: exErr } = await admin
      .from("renter_verifications")
      .select("user_id")
      .eq("own_social_provider", body.provider)
      .eq("own_social_provider_user_id", providerUserId)
      .maybeSingle();
    if (exErr) {
      console.error("uniqueness check failed", exErr);
    } else if (existing && existing.user_id !== user.id) {
      return json(
        {
          error: "social_already_used",
          message:
            "Esta cuenta ya fue usada para verificar a otro usuario en RuedaVe.",
        },
        409,
      );
    }

    return json({
      ok: true,
      identity: {
        provider: body.provider,
        providerUserId,
        name: providerName,
        email: providerEmail,
        picture: providerPicture,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("meta-oauth-verify error", err);
    return json({ error: msg }, 500);
  }
});
