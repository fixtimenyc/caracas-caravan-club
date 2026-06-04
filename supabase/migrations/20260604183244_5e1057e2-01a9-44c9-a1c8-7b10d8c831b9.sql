
-- ============ ENUMS ============
CREATE TYPE public.consent_type AS ENUM ('telemetry', 'dynamic_pricing', 'fraud_prevention', 'ai_training');
CREATE TYPE public.telemetry_event_type AS ENUM ('harsh_brake', 'harsh_accel', 'speeding', 'night_drive', 'phone_use', 'trip_segment');
CREATE TYPE public.fraud_signal_type AS ENUM ('multi_account', 'cancel_pattern', 'identity_mismatch', 'dispute', 'device_reuse', 'ip_burst');

-- ============ user_data_consents ============
CREATE TABLE public.user_data_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type public.consent_type NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type)
);
GRANT SELECT, INSERT, UPDATE ON public.user_data_consents TO authenticated;
GRANT ALL ON public.user_data_consents TO service_role;
ALTER TABLE public.user_data_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consents"
  ON public.user_data_consents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all consents"
  ON public.user_data_consents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_consents_updated_at
  BEFORE UPDATE ON public.user_data_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ has_consent helper ============
CREATE OR REPLACE FUNCTION public.has_consent(_user_id UUID, _consent public.consent_type)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_data_consents
    WHERE user_id = _user_id AND consent_type = _consent AND granted = true
  );
$$;

-- ============ telemetry_events ============
CREATE TABLE public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.telemetry_event_type NOT NULL,
  value NUMERIC,
  speed_kmh NUMERIC,
  lat NUMERIC(8,3),
  lng NUMERIC(8,3),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telemetry_reservation ON public.telemetry_events(reservation_id);
CREATE INDEX idx_telemetry_user_time ON public.telemetry_events(user_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.telemetry_events TO authenticated;
GRANT ALL ON public.telemetry_events TO service_role;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own telemetry with consent"
  ON public.telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_consent(auth.uid(), 'telemetry'::public.consent_type)
  );

CREATE POLICY "Users view own telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ trip_summaries ============
CREATE TABLE public.trip_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  distance_km NUMERIC DEFAULT 0,
  avg_speed_kmh NUMERIC DEFAULT 0,
  max_speed_kmh NUMERIC DEFAULT 0,
  harsh_brake_count INT DEFAULT 0,
  harsh_accel_count INT DEFAULT 0,
  speeding_count INT DEFAULT 0,
  night_minutes INT DEFAULT 0,
  phone_use_count INT DEFAULT 0,
  risk_score INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.trip_summaries TO authenticated;
GRANT ALL ON public.trip_summaries TO service_role;
ALTER TABLE public.trip_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trip summaries"
  ON public.trip_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Vehicle owners view their vehicle trip summaries"
  ON public.trip_summaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = trip_summaries.vehicle_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all trip summaries"
  ON public.trip_summaries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_trip_summaries_updated_at
  BEFORE UPDATE ON public.trip_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ demand_signals ============
CREATE TABLE public.demand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone TEXT NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  searches INT DEFAULT 0,
  reservations_created INT DEFAULT 0,
  reservations_completed INT DEFAULT 0,
  occupancy_rate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (zone, hour_bucket)
);
CREATE INDEX idx_demand_hour ON public.demand_signals(hour_bucket DESC);

GRANT ALL ON public.demand_signals TO service_role;
GRANT SELECT ON public.demand_signals TO authenticated;
ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage demand signals"
  ON public.demand_signals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ fraud_signals ============
CREATE TABLE public.fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type public.fraud_signal_type NOT NULL,
  device_fingerprint_hash TEXT,
  ip_hash TEXT,
  geo_country TEXT,
  risk_score INT NOT NULL DEFAULT 0,
  details JSONB,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_user ON public.fraud_signals(user_id);
CREATE INDEX idx_fraud_fingerprint ON public.fraud_signals(device_fingerprint_hash);
CREATE INDEX idx_fraud_created ON public.fraud_signals(created_at DESC);

GRANT SELECT, INSERT ON public.fraud_signals TO authenticated;
GRANT ALL ON public.fraud_signals TO service_role;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can insert their own fraud signals"
  ON public.fraud_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins manage fraud signals"
  ON public.fraud_signals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ ai_training_datasets ============
CREATE TABLE public.ai_training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  row_count INT NOT NULL DEFAULT 0,
  source_tables TEXT[] DEFAULT '{}',
  content_hash TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_training_datasets TO authenticated;
GRANT ALL ON public.ai_training_datasets TO service_role;
ALTER TABLE public.ai_training_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai datasets"
  ON public.ai_training_datasets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ record_consent RPC ============
CREATE OR REPLACE FUNCTION public.record_consent(
  _consent_type public.consent_type,
  _granted BOOLEAN,
  _ip_hash TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
) RETURNS public.user_data_consents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.user_data_consents;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_data_consents (user_id, consent_type, granted, granted_at, revoked_at, ip_hash, user_agent)
  VALUES (v_user, _consent_type, _granted,
    CASE WHEN _granted THEN now() ELSE NULL END,
    CASE WHEN _granted THEN NULL ELSE now() END,
    _ip_hash, _user_agent)
  ON CONFLICT (user_id, consent_type) DO UPDATE
    SET granted = EXCLUDED.granted,
        granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE public.user_data_consents.granted_at END,
        revoked_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE now() END,
        ip_hash = COALESCE(EXCLUDED.ip_hash, public.user_data_consents.ip_hash),
        user_agent = COALESCE(EXCLUDED.user_agent, public.user_data_consents.user_agent),
        updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- ============ compute_trip_risk_score ============
CREATE OR REPLACE FUNCTION public.compute_trip_risk_score(_reservation_id UUID)
RETURNS public.trip_summaries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res RECORD;
  v_summary public.trip_summaries;
  v_harsh_brake INT := 0;
  v_harsh_accel INT := 0;
  v_speeding INT := 0;
  v_phone INT := 0;
  v_night INT := 0;
  v_avg NUMERIC := 0;
  v_max NUMERIC := 0;
  v_score INT := 0;
BEGIN
  SELECT renter_id, vehicle_id INTO v_res FROM public.reservations WHERE id = _reservation_id;
  IF v_res IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  SELECT
    COUNT(*) FILTER (WHERE event_type = 'harsh_brake'),
    COUNT(*) FILTER (WHERE event_type = 'harsh_accel'),
    COUNT(*) FILTER (WHERE event_type = 'speeding'),
    COUNT(*) FILTER (WHERE event_type = 'phone_use'),
    COUNT(*) FILTER (WHERE event_type = 'night_drive'),
    COALESCE(AVG(speed_kmh) FILTER (WHERE speed_kmh IS NOT NULL), 0),
    COALESCE(MAX(speed_kmh) FILTER (WHERE speed_kmh IS NOT NULL), 0)
  INTO v_harsh_brake, v_harsh_accel, v_speeding, v_phone, v_night, v_avg, v_max
  FROM public.telemetry_events
  WHERE reservation_id = _reservation_id;

  v_score := LEAST(100,
    (v_harsh_brake * 5) + (v_harsh_accel * 4) + (v_speeding * 6) + (v_phone * 8) + (v_night * 2)
  );

  INSERT INTO public.trip_summaries (
    reservation_id, user_id, vehicle_id,
    avg_speed_kmh, max_speed_kmh,
    harsh_brake_count, harsh_accel_count, speeding_count, night_minutes, phone_use_count,
    risk_score
  ) VALUES (
    _reservation_id, v_res.renter_id, v_res.vehicle_id,
    ROUND(v_avg, 2), ROUND(v_max, 2),
    v_harsh_brake, v_harsh_accel, v_speeding, v_night, v_phone,
    v_score
  )
  ON CONFLICT (reservation_id) DO UPDATE
    SET avg_speed_kmh = EXCLUDED.avg_speed_kmh,
        max_speed_kmh = EXCLUDED.max_speed_kmh,
        harsh_brake_count = EXCLUDED.harsh_brake_count,
        harsh_accel_count = EXCLUDED.harsh_accel_count,
        speeding_count = EXCLUDED.speeding_count,
        night_minutes = EXCLUDED.night_minutes,
        phone_use_count = EXCLUDED.phone_use_count,
        risk_score = EXCLUDED.risk_score,
        updated_at = now()
  RETURNING * INTO v_summary;

  RETURN v_summary;
END;
$$;
