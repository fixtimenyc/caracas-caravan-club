-- Remove blanket SELECT (which includes sensitive columns) and re-grant only safe columns
REVOKE SELECT ON public.vehicles FROM anon;
REVOKE SELECT ON public.vehicles FROM authenticated;

GRANT SELECT (
  id, owner_id, brand, model, year, location, price_per_day, available, photos,
  description, active, created_at, updated_at, house_rules, features, custom_features,
  color, fuel_type, transmission, seats, soat_expiry, circulation_expiry, insurance_expiry,
  weekend_price, weekly_price, monthly_price, zone, gps_lat, gps_lng
) ON public.vehicles TO anon, authenticated;

GRANT ALL ON public.vehicles TO service_role;

-- Bulk accessor for admins (all vehicles) and owners (their own vehicles)
CREATE OR REPLACE FUNCTION public.list_vehicle_private_fields()
RETURNS TABLE(
  vehicle_id uuid,
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
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::public.app_role);

  RETURN QUERY
    SELECT v.id, v.plate, v.vin, v.soat_doc_url, v.circulation_doc_url,
           CASE WHEN v_is_admin THEN v.internal_notes ELSE NULL END
    FROM public.vehicles v
    WHERE v_is_admin OR v.owner_id = v_caller;
END;
$$;

REVOKE ALL ON FUNCTION public.list_vehicle_private_fields() FROM public;
GRANT EXECUTE ON FUNCTION public.list_vehicle_private_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_private_fields(uuid) TO authenticated;