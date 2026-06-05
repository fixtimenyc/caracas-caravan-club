
-- 1) Remove public photos policy on owner-documents bucket
DROP POLICY IF EXISTS "Public can view vehicle photos in owner-documents" ON storage.objects;

-- 2) Revoke SELECT on sensitive vehicle columns from anon/authenticated.
--    Owners and admins continue to read these via the broader SELECT policies
--    that exist for them ("Owners can view their own vehicles", admin policy)
--    and through SECURITY DEFINER functions when needed.
REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM anon;
REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM authenticated;
REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM PUBLIC;
-- service_role keeps full access (used by edge functions / admin paths).
GRANT SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles TO service_role;

-- 3) Harden compute_trip_risk_score: require caller is renter or admin
CREATE OR REPLACE FUNCTION public.compute_trip_risk_score(_reservation_id uuid)
 RETURNS public.trip_summaries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT renter_id, vehicle_id INTO v_res FROM public.reservations WHERE id = _reservation_id;
  IF v_res IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  IF v_res.renter_id <> v_caller AND NOT public.has_role(v_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_trip_risk_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_trip_risk_score(uuid) TO authenticated, service_role;

-- 4) Restrict _safe_public_profiles to users who have at least one active vehicle listing
CREATE OR REPLACE FUNCTION public._safe_public_profiles()
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, verified boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.full_name, p.avatar_url, p.verified, p.created_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.owner_id = p.user_id AND v.active = true
  );
$function$;

-- 5) Notifications: add content validation trigger so authenticated users
--    cannot send arbitrary phishing-style notifications to counterparties.
CREATE OR REPLACE FUNCTION public.validate_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Admins and trusted server contexts (service_role, definer triggers) bypass.
  IF v_caller IS NULL OR public.has_role(v_caller, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Length limits
  IF length(COALESCE(NEW.title, '')) > 140 THEN
    RAISE EXCEPTION 'Notification title too long';
  END IF;
  IF length(COALESCE(NEW.message, '')) > 600 THEN
    RAISE EXCEPTION 'Notification message too long';
  END IF;

  -- Restrict type to a known whitelist
  IF NEW.type NOT IN (
    'message','reservation','reservation_request','reservation_approved',
    'reservation_rejected','reservation_cancelled','payment','review',
    'inspection','application','system'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;

  -- Action URL must be a relative internal path (no external phishing links)
  IF NEW.action_url IS NOT NULL AND NEW.action_url <> '' AND left(NEW.action_url, 1) <> '/' THEN
    RAISE EXCEPTION 'Invalid notification action_url';
  END IF;

  -- Strip control characters that could be used to forge UI
  NEW.title := regexp_replace(NEW.title, '[\u0000-\u001F\u007F]', '', 'g');
  NEW.message := regexp_replace(NEW.message, '[\u0000-\u001F\u007F]', '', 'g');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_notification_insert_trg ON public.notifications;
CREATE TRIGGER validate_notification_insert_trg
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_notification_insert();
