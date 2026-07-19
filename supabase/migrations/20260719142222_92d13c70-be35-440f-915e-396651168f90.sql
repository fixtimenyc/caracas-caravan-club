
-- 1. Fix client-controlled price: always recompute total_price server-side
CREATE OR REPLACE FUNCTION public.enforce_reservation_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_price NUMERIC;
  v_days INTEGER;
  v_subtotal NUMERIC;
  v_commission_pct NUMERIC;
  v_insurance_per_day NUMERIC;
BEGIN
  -- Always recompute from trusted server data; ignore any client-supplied total_price.
  SELECT price_per_day INTO v_price
  FROM public.vehicles WHERE id = NEW.vehicle_id;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found for reservation';
  END IF;

  SELECT commission_pct, insurance_per_day
    INTO v_commission_pct, v_insurance_per_day
    FROM public.get_pricing_config();

  v_days := GREATEST((NEW.end_date - NEW.start_date), 1);
  v_subtotal := v_price * v_days;
  NEW.total_price := v_subtotal
    + ROUND(v_subtotal * (COALESCE(v_commission_pct, 10) / 100.0), 2)
    + v_days * COALESCE(v_insurance_per_day, 8);
  RETURN NEW;
END;
$function$;

-- Enforce payment amount matches the reservation's authoritative total_price
CREATE OR REPLACE FUNCTION public.enforce_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT total_price INTO v_total FROM public.reservations WHERE id = NEW.reservation_id;
  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Reservation not found for payment';
  END IF;
  -- Always overwrite amount with the authoritative reservation total.
  NEW.amount := v_total;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_amount_trg ON public.payments;
CREATE TRIGGER enforce_payment_amount_trg
BEFORE INSERT OR UPDATE OF amount, reservation_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_amount();

-- 2. Fix user enumeration in request_personal_reference: uniform behavior
CREATE OR REPLACE FUNCTION public.request_personal_reference(_verification_id uuid, _email text, _message text DEFAULT NULL::text)
RETURNS renter_reference_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_verification RECORD;
  v_referent_id uuid;
  v_row public.renter_reference_requests;
  v_requester_name text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'Email requerido';
  END IF;

  SELECT id, user_id INTO v_verification
    FROM public.renter_verifications
   WHERE id = _verification_id;
  IF v_verification IS NULL OR v_verification.user_id <> v_caller THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  SELECT id INTO v_referent_id
    FROM auth.users
   WHERE lower(email) = lower(trim(_email))
   LIMIT 1;

  -- Do not leak whether the email is registered. Prevent self-reference generically.
  IF v_referent_id IS NOT NULL AND v_referent_id = v_caller THEN
    -- Treat as unregistered to avoid oracle behavior for self-lookup
    v_referent_id := NULL;
  END IF;

  IF v_referent_id IS NULL THEN
    -- Silent no-op: return an empty row so the caller cannot distinguish
    -- registered from unregistered emails.
    RETURN NULL;
  END IF;

  INSERT INTO public.renter_reference_requests
    (verification_id, requester_user_id, referent_user_id, referent_email, message)
  VALUES
    (_verification_id, v_caller, v_referent_id, lower(trim(_email)), _message)
  ON CONFLICT (verification_id, referent_user_id) DO UPDATE
    SET status = 'pending',
        responded_at = NULL,
        message = COALESCE(EXCLUDED.message, public.renter_reference_requests.message),
        updated_at = now()
  RETURNING * INTO v_row;

  SELECT COALESCE(NULLIF(full_name, ''), 'Un usuario')
    INTO v_requester_name FROM public.profiles WHERE user_id = v_caller;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    v_referent_id,
    'system',
    'Te pidieron una referencia',
    COALESCE(v_requester_name, 'Un usuario') || ' te agregó como referencia personal en RuedaVe. Confirma o rechaza.',
    '/perfil/referencias'
  );

  RETURN v_row;
END;
$function$;

-- 3. Support ticket user_id spoofing: enforce user_id must match caller (or be null for anon)
DROP POLICY IF EXISTS "Anyone can create support tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create support tickets"
ON public.support_tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- 4. Remove public storage policy that exposes owner-documents bucket
DROP POLICY IF EXISTS "Public can view referenced vehicle photos in owner-documents" ON storage.objects;

-- 5. Block anonymous read of sensitive vehicle columns (plate, vin, docs, internal notes)
REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM anon;
REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM authenticated;

-- Provide a SECURITY DEFINER RPC so owners, admins, and reservation participants
-- can still read the private fields for their own vehicles/trips.
CREATE OR REPLACE FUNCTION public.get_vehicle_private_fields(_vehicle_id uuid)
RETURNS TABLE(
  plate text,
  vin text,
  soat_doc_url text,
  circulation_doc_url text,
  insurance_doc_url text,
  internal_notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  SELECT owner_id INTO v_owner FROM public.vehicles WHERE id = _vehicle_id;
  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  IF v_owner = v_caller
     OR public.has_role(v_caller, 'admin'::public.app_role)
     OR EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.vehicle_id = _vehicle_id
          AND r.renter_id = v_caller
          AND r.status IN ('approved','active','completed','awaiting_payment')
     )
  THEN
    RETURN QUERY
      SELECT v.plate, v.vin, v.soat_doc_url, v.circulation_doc_url, v.insurance_doc_url, v.internal_notes
      FROM public.vehicles v WHERE v.id = _vehicle_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_private_fields(uuid) TO authenticated;
