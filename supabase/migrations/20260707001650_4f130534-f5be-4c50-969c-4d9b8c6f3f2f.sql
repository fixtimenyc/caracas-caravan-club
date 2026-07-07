CREATE OR REPLACE FUNCTION public.handle_application_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  photo_urls TEXT[] := '{}';
  cleaned_photos TEXT[] := '{}';
  p TEXT;
  v_location TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    photo_urls := COALESCE(NEW.vehicle_photos, '{}');

    -- Keep only browser-renderable images and deduplicate while preserving order.
    FOREACH p IN ARRAY photo_urls LOOP
      IF p IS NOT NULL
         AND p ~* '\.(jpe?g|png|webp|gif|avif)$'
         AND NOT (cleaned_photos @> ARRAY[p]) THEN
        cleaned_photos := cleaned_photos || p;
      END IF;
    END LOOP;

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
      owner_id, brand, model, year, location, price_per_day, photos, description, active, available
    ) VALUES (
      NEW.user_id, NEW.vehicle_brand, NEW.vehicle_model, NEW.vehicle_year,
      v_location, NEW.suggested_price_per_day, cleaned_photos,
      'Vehículo ' || NEW.vehicle_brand || ' ' || NEW.vehicle_model || ' ' || NEW.vehicle_year ||
        '. Color: ' || COALESCE(NEW.vehicle_color, 'N/A') ||
        '. Transmisión: ' || COALESCE(NEW.transmission, 'N/A') ||
        '. Combustible: ' || COALESCE(NEW.fuel_type, 'N/A'),
      true, true
    );

    UPDATE public.profiles SET verified = true WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Clean existing vehicle rows: keep only web-renderable image paths, deduped.
UPDATE public.vehicles v
SET photos = sub.cleaned
FROM (
  SELECT id, ARRAY(
    SELECT DISTINCT ON (photo) photo
    FROM unnest(photos) WITH ORDINALITY AS t(photo, ord)
    WHERE photo ~* '\.(jpe?g|png|webp|gif|avif)$'
    ORDER BY photo, ord
  ) AS cleaned
  FROM public.vehicles
  WHERE photos IS NOT NULL AND array_length(photos, 1) > 0
) AS sub
WHERE v.id = sub.id AND v.photos IS DISTINCT FROM sub.cleaned;