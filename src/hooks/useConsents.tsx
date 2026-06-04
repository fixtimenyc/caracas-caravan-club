import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ConsentType = "telemetry" | "dynamic_pricing" | "fraud_prevention" | "ai_training";

export interface ConsentRecord {
  consent_type: ConsentType;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  updated_at: string;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useConsents() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Record<ConsentType, ConsentRecord | null>>({
    telemetry: null,
    dynamic_pricing: null,
    fraud_prevention: null,
    ai_training: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_data_consents")
      .select("consent_type,granted,granted_at,revoked_at,updated_at")
      .eq("user_id", user.id);
    const map: Record<ConsentType, ConsentRecord | null> = {
      telemetry: null,
      dynamic_pricing: null,
      fraud_prevention: null,
      ai_training: null,
    };
    (data ?? []).forEach((r: any) => {
      map[r.consent_type as ConsentType] = r as ConsentRecord;
    });
    setConsents(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      if (!user) return;
      const ipHash = await sha256(`${user.id}|${navigator.userAgent}`);
      const { error } = await supabase.rpc("record_consent", {
        _consent_type: type,
        _granted: granted,
        _ip_hash: ipHash,
        _user_agent: navigator.userAgent.slice(0, 200),
      });
      if (!error) await load();
      return !error;
    },
    [user, load],
  );

  return { consents, loading, setConsent, reload: load };
}
