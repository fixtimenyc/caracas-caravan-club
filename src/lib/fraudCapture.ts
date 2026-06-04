// Automatic fraud-signal capture. Runs silently on key events
// (reservation, payment). No user prompt — uses only data the
// browser/edge already exposes to us.
import { supabase } from "@/integrations/supabase/client";

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

function collectDevice() {
  const nav: any = navigator;
  return {
    user_agent: navigator.userAgent,
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    language: navigator.language,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixel_ratio: window.devicePixelRatio,
    hardware_concurrency: navigator.hardwareConcurrency ?? null,
    device_memory: nav.deviceMemory ?? null,
    touch_points: navigator.maxTouchPoints ?? 0,
    connection: nav.connection
      ? { effectiveType: nav.connection.effectiveType, downlink: nav.connection.downlink }
      : null,
    cookies_enabled: navigator.cookieEnabled,
    do_not_track: navigator.doNotTrack ?? null,
    referrer: document.referrer || null,
    app_version: (import.meta as any).env?.VITE_APP_VERSION ?? "1.0.0",
  };
}

export async function captureFraudSignal(opts: {
  event: "reservation" | "payment" | "login" | "signup";
  reservation_id?: string;
}) {
  try {
    const device = collectDevice();
    const fpSeed = [
      device.user_agent,
      device.language,
      device.timezone,
      device.screen,
      device.hardware_concurrency,
      device.device_memory,
      canvasFingerprint(),
    ].join("||");
    const device_fingerprint_hash = await sha256(fpSeed);

    await supabase.functions.invoke("capture-fraud-signal", {
      body: {
        event: opts.event,
        reservation_id: opts.reservation_id ?? null,
        device_fingerprint_hash,
        device,
      },
    });
  } catch (e) {
    // Silent — fraud capture must never block the user flow
    console.warn("[fraud] capture failed", e);
  }
}
