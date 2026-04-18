-- Make vehicle-photos bucket safer: keep public read but no listing
-- (already public, fine for displaying images via getPublicUrl)

-- Trigger: when an owner application is approved, create the vehicle and grant owner role
CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  photo_urls TEXT[] := '{}';
  photo_path TEXT;
  public_url TEXT;
  base_url TEXT;
BEGIN
  -- Only act when status transitions to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Ensure user has 'owner' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Build public URLs for the vehicle photos (private bucket -> store paths)
    -- We store the storage paths; frontend will create signed URLs on demand
    photo_urls := COALESCE(NEW.vehicle_photos, '{}');

    -- Create the vehicle
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
      NEW.city,
      NEW.suggested_price_per_day,
      photo_urls,
      'Vehículo ' || NEW.vehicle_brand || ' ' || NEW.vehicle_model || ' ' || NEW.vehicle_year ||
        '. Color: ' || COALESCE(NEW.vehicle_color, 'N/A') ||
        '. Transmisión: ' || COALESCE(NEW.transmission, 'N/A') ||
        '. Combustible: ' || COALESCE(NEW.fuel_type, 'N/A'),
      true,
      true
    );

    -- Mark profile as verified
    UPDATE public.profiles SET verified = true WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Need a unique constraint for the ON CONFLICT to work
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

DROP TRIGGER IF EXISTS on_owner_application_approved ON public.owner_applications;
CREATE TRIGGER on_owner_application_approved
  AFTER UPDATE ON public.owner_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_application_approval();