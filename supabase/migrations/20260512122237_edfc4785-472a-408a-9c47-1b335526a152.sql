-- Add zone + precise address fields to owner applications
ALTER TABLE public.owner_applications
  ADD COLUMN IF NOT EXISTS vehicle_zone TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_address_detail TEXT;

-- Update approval handler to use zone + detail for the vehicle location
CREATE OR REPLACE FUNCTION public.handle_application_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  photo_urls TEXT[] := '{}';
  v_location TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    photo_urls := COALESCE(NEW.vehicle_photos, '{}');

    -- Build location: prefer zone (+ optional precise detail), fall back to city
    IF NEW.vehicle_zone IS NOT NULL AND length(trim(NEW.vehicle_zone)) > 0 THEN
      IF NEW.vehicle_address_detail IS NOT NULL AND length(trim(NEW.vehicle_address_detail)) > 0 THEN
        v_location := trim(NEW.vehicle_address_detail) || ', ' || trim(NEW.vehicle_zone) || ', ' || COALESCE(NEW.city, 'Caracas');
      ELSE
        v_location := trim(NEW.vehicle_zone) || ', ' || COALESCE(NEW.city, 'Caracas');
      END IF;
    ELSE
      v_location := COALESCE(NEW.city, 'Caracas');
    END IF;

    INSERT INTO public.vehicles (
      owner_id,
      brand,
      model,
      year,
      location,
      price_per_day,
      photos,
      description,
      active,
      available
    ) VALUES (
      NEW.user_id,
      NEW.vehicle_brand,
      NEW.vehicle_model,
      NEW.vehicle_year,
      v_location,
      NEW.suggested_price_per_day,
      photo_urls,
      'Vehículo ' || NEW.vehicle_brand || ' ' || NEW.vehicle_model || ' ' || NEW.vehicle_year ||
        '. Color: ' || COALESCE(NEW.vehicle_color, 'N/A') ||
        '. Transmisión: ' || COALESCE(NEW.transmission, 'N/A') ||
        '. Combustible: ' || COALESCE(NEW.fuel_type, 'N/A'),
      true,
      true
    );

    UPDATE public.profiles SET verified = true WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;