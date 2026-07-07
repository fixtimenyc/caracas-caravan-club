
CREATE OR REPLACE FUNCTION public.get_reservation_renter_info(_reservation_id uuid)
RETURNS TABLE (
  full_name text,
  document_type text,
  document_number text,
  driving_license_number text,
  driving_license_expiry date,
  address text,
  city text,
  state text,
  country text,
  phone text,
  birth_date date,
  nationality text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _renter_id uuid;
  _owner_id uuid;
BEGIN
  SELECT r.renter_id, v.owner_id
    INTO _renter_id, _owner_id
  FROM public.reservations r
  JOIN public.vehicles v ON v.id = r.vehicle_id
  WHERE r.id = _reservation_id;

  IF _renter_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() <> _renter_id
     AND auth.uid() <> _owner_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT rv.full_name,
         rv.document_type,
         rv.document_number,
         rv.driving_license_number,
         rv.driving_license_expiry,
         rv.address,
         rv.city,
         rv.state,
         rv.country,
         rv.phone,
         rv.birth_date,
         rv.nationality
  FROM public.renter_verifications rv
  WHERE rv.user_id = _renter_id
  ORDER BY rv.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_renter_info(uuid) TO authenticated;
