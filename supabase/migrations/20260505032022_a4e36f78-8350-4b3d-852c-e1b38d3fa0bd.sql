
-- 1) Profiles: restrict SELECT and add safe public view ----------------------
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Safe public view exposing only non-sensitive fields
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT user_id, full_name, avatar_url, verified, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2) Notifications: restrict who can insert ---------------------------------
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Restricted notification creation"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Self notifications
    auth.uid() = user_id
    -- Admins can notify anyone
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    -- Counterparties of a real reservation can notify each other
    OR (
      reservation_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.reservations r
        LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
        WHERE r.id = reservation_id
          AND (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
          AND (notifications.user_id = r.renter_id OR notifications.user_id = v.owner_id)
      )
    )
  );

-- 3) Reservations: server-side price + locked fields ------------------------
CREATE OR REPLACE FUNCTION public.enforce_reservation_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price NUMERIC;
  v_days INTEGER;
  v_subtotal NUMERIC;
  v_service NUMERIC;
  v_insurance NUMERIC;
BEGIN
  SELECT price_per_day INTO v_price
  FROM public.vehicles WHERE id = NEW.vehicle_id;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found for reservation';
  END IF;

  v_days := GREATEST((NEW.end_date - NEW.start_date), 1);
  v_subtotal := v_price * v_days;
  v_service := ROUND(v_subtotal * 0.10);
  v_insurance := v_days * 8;
  NEW.total_price := v_subtotal + v_service + v_insurance;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_enforce_price ON public.reservations;
CREATE TRIGGER reservations_enforce_price
  BEFORE INSERT OR UPDATE OF start_date, end_date, vehicle_id, total_price
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reservation_price();

-- Lock immutable fields on UPDATE
DROP POLICY IF EXISTS "Owners can update reservation status" ON public.reservations;
DROP POLICY IF EXISTS "Renters can update their reservations" ON public.reservations;

CREATE POLICY "Owners can update reservation status"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE vehicles.id = reservations.vehicle_id
        AND vehicles.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE vehicles.id = reservations.vehicle_id
        AND vehicles.owner_id = auth.uid()
    )
  );

CREATE POLICY "Renters can cancel their pending reservations"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = renter_id AND status = 'pending'::reservation_status)
  WITH CHECK (auth.uid() = renter_id);

CREATE OR REPLACE FUNCTION public.protect_reservation_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.renter_id IS DISTINCT FROM OLD.renter_id
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Cannot modify immutable reservation fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_protect_immutable ON public.reservations;
CREATE TRIGGER reservations_protect_immutable
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_reservation_immutable_fields();

-- 4) Vehicles INSERT requires approved application --------------------------
DROP POLICY IF EXISTS "Owners can insert their own vehicles" ON public.vehicles;

CREATE POLICY "Owners can insert their own vehicles"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.owner_applications
        WHERE owner_applications.user_id = auth.uid()
          AND owner_applications.status = 'approved'::application_status
      )
    )
  );

-- 5) Signup never grants owner role -----------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  -- Always start as renter; owner role is granted only via approved application
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'renter'::public.app_role);

  RETURN NEW;
END;
$$;

-- 6) Payments: explicit admin-only INSERT -----------------------------------
CREATE POLICY "Only admins can create payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
