
-- 1. Extend renter_verifications with OAuth-verified social identity fields
ALTER TABLE public.renter_verifications
  ADD COLUMN IF NOT EXISTS own_social_provider text,
  ADD COLUMN IF NOT EXISTS own_social_provider_user_id text,
  ADD COLUMN IF NOT EXISTS own_social_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS own_social_verified_name text,
  ADD COLUMN IF NOT EXISTS own_social_verified_email text,
  ADD COLUMN IF NOT EXISTS own_social_declared_age_months integer,
  ADD COLUMN IF NOT EXISTS personal_reference_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personal_reference_confirmed_at timestamptz;

-- Prevent same social account being reused across different verifications
CREATE UNIQUE INDEX IF NOT EXISTS renter_verifications_social_provider_unique
  ON public.renter_verifications (own_social_provider, own_social_provider_user_id)
  WHERE own_social_provider IS NOT NULL AND own_social_provider_user_id IS NOT NULL;

-- 2. Personal reference requests table
CREATE TABLE IF NOT EXISTS public.renter_reference_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES public.renter_verifications(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL,
  referent_user_id uuid NOT NULL,
  referent_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined')),
  message text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verification_id, referent_user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.renter_reference_requests TO authenticated;
GRANT ALL ON public.renter_reference_requests TO service_role;

ALTER TABLE public.renter_reference_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reference_requests_select"
  ON public.renter_reference_requests FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR referent_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Direct writes forbidden; only SECURITY DEFINER functions may write.
CREATE POLICY "reference_requests_no_direct_insert"
  ON public.renter_reference_requests FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "reference_requests_no_direct_update"
  ON public.renter_reference_requests FOR UPDATE TO authenticated
  USING (false);

CREATE TRIGGER trg_reference_requests_updated_at
  BEFORE UPDATE ON public.renter_reference_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Request personal reference
CREATE OR REPLACE FUNCTION public.request_personal_reference(
  _verification_id uuid,
  _email text,
  _message text DEFAULT NULL
) RETURNS public.renter_reference_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_referent_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no registrado en RuedaVe';
  END IF;
  IF v_referent_id = v_caller THEN
    RAISE EXCEPTION 'No puedes referirte a ti mismo';
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
$$;

-- 4. Confirm / decline personal reference (only the referent may call)
CREATE OR REPLACE FUNCTION public.confirm_personal_reference(_request_id uuid, _accept boolean)
RETURNS public.renter_reference_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.renter_reference_requests;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_row FROM public.renter_reference_requests WHERE id = _request_id;
  IF v_row IS NULL OR v_row.referent_user_id <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Solicitud ya respondida';
  END IF;

  UPDATE public.renter_reference_requests
    SET status = CASE WHEN _accept THEN 'confirmed' ELSE 'declined' END,
        responded_at = now(),
        updated_at = now()
    WHERE id = _request_id
    RETURNING * INTO v_row;

  IF _accept THEN
    UPDATE public.renter_verifications
      SET personal_reference_user_id = v_caller,
          personal_reference_confirmed_at = now(),
          updated_at = now()
      WHERE id = v_row.verification_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    v_row.requester_user_id,
    'system',
    CASE WHEN _accept THEN 'Tu referencia fue confirmada' ELSE 'Tu referencia fue rechazada' END,
    CASE WHEN _accept THEN 'La persona que agregaste confirmó ser tu referencia.' ELSE 'La persona que agregaste rechazó ser tu referencia.' END,
    '/verificacion-arrendatario'
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_personal_reference(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_personal_reference(uuid, boolean) TO authenticated;