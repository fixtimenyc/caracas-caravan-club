import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasFingerprint(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 30;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("RuedaVe.fp", 2, 2);
    return c.toDataURL();
  } catch {
    return "";
  }
}

async function buildFingerprint() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.hardwareConcurrency,
    (navigator as any).deviceMemory,
    canvasFingerprint(),
  ].join("||");
  return sha256(parts);
}

/**
 * Records device fingerprint on login. Backend trigger / admin review
 * surfaces multi-account and burst patterns.
 */
export function useFraudFingerprint() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const fp = await buildFingerprint();
      if (cancelled) return;
      const sessionKey = `ruedave_fp_logged_${user.id}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");

      // Look up how many distinct users share this fingerprint
      const { count } = await supabase
        .from("fraud_signals")
        .select("user_id", { count: "exact", head: true })
        .eq("device_fingerprint_hash", fp)
        .neq("user_id", user.id);

      const risk = Math.min(100, (count ?? 0) * 25);
      if ((count ?? 0) > 0) {
        await supabase.from("fraud_signals").insert({
          user_id: user.id,
          signal_type: "device_reuse",
          device_fingerprint_hash: fp,
          risk_score: risk,
          details: { shared_with: count },
        });
      } else {
        // Still record an anchor row (low score) so future detection works
        await supabase.from("fraud_signals").insert({
          user_id: user.id,
          signal_type: "device_reuse",
          device_fingerprint_hash: fp,
          risk_score: 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
}
