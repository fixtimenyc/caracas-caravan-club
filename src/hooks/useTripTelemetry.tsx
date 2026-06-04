import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsents } from "@/hooks/useConsents";

type EventType = "harsh_brake" | "harsh_accel" | "speeding" | "night_drive" | "phone_use" | "trip_segment";

interface QueuedEvent {
  event_type: EventType;
  value?: number;
  speed_kmh?: number;
  lat?: number;
  lng?: number;
  recorded_at: string;
}

const SPEED_LIMIT_KMH = 80; // Caracas urban limit (approx)
const HARSH_THRESHOLD = 4.0; // m/s^2
const FLUSH_INTERVAL_MS = 60_000;

export function useTripTelemetry(reservationId: string | null, enabled = true) {
  const { user } = useAuth();
  const { consents } = useConsents();
  const [active, setActive] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const queueRef = useRef<QueuedEvent[]>([]);
  const lastSpeedRef = useRef<number>(0);
  const lastTouchAt = useRef<number>(0);

  const consentActive = consents.telemetry?.granted === true;

  useEffect(() => {
    if (!enabled || !reservationId || !user || !consentActive) {
      setActive(false);
      return;
    }
    setActive(true);

    const push = (e: QueuedEvent) => {
      queueRef.current.push(e);
      setEventCount((c) => c + 1);
    };

    // GPS
    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const speed = (pos.coords.speed ?? 0) * 3.6;
          const hour = new Date().getHours();
          const base: Partial<QueuedEvent> = {
            speed_kmh: Math.round(speed),
            lat: Math.round(pos.coords.latitude * 1000) / 1000,
            lng: Math.round(pos.coords.longitude * 1000) / 1000,
            recorded_at: new Date().toISOString(),
          };
          push({ event_type: "trip_segment", value: speed, ...base } as QueuedEvent);
          if (speed > SPEED_LIMIT_KMH) {
            push({ event_type: "speeding", value: speed - SPEED_LIMIT_KMH, ...base } as QueuedEvent);
          }
          if (hour >= 22 || hour < 5) {
            push({ event_type: "night_drive", value: 1, ...base } as QueuedEvent);
          }
          lastSpeedRef.current = speed;
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
    }

    // Motion / harsh braking & accel
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      if (mag > HARSH_THRESHOLD) {
        const isBrake = (a.x ?? 0) < -HARSH_THRESHOLD;
        push({
          event_type: isBrake ? "harsh_brake" : "harsh_accel",
          value: Number(mag.toFixed(2)),
          recorded_at: new Date().toISOString(),
        });
      }
    };
    window.addEventListener("devicemotion", onMotion);

    // Phone use detection: any touch while moving > 10 km/h
    const onTouch = () => {
      const now = Date.now();
      if (now - lastTouchAt.current < 3000) return;
      lastTouchAt.current = now;
      if (lastSpeedRef.current > 10) {
        push({
          event_type: "phone_use",
          value: lastSpeedRef.current,
          recorded_at: new Date().toISOString(),
        });
      }
    };
    window.addEventListener("touchstart", onTouch);

    const flush = async () => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0);
      const rows = batch.map((e) => ({
        reservation_id: reservationId,
        user_id: user.id,
        ...e,
      }));
      await supabase.from("telemetry_events").insert(rows);
    };
    const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      setActive(false);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("touchstart", onTouch);
      window.clearInterval(interval);
      void flush();
    };
  }, [enabled, reservationId, user, consentActive]);

  return { active, eventCount, consentActive };
}
