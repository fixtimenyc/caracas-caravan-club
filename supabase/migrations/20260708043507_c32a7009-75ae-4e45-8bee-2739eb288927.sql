
-- 1. Config table
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_config TO authenticated;
GRANT ALL ON public.system_config TO service_role;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert system_config"
  ON public.system_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update system_config"
  ON public.system_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete system_config"
  ON public.system_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed defaults matching what the trigger used before (keeps existing totals stable).
INSERT INTO public.system_config (key, value)
VALUES ('pricing', jsonb_build_object('commission_pct', 10, 'insurance_per_day', 8))
ON CONFLICT (key) DO NOTHING;

-- 2. Helper (security definer so the trigger and app can read without admin RLS)
CREATE OR REPLACE FUNCTION public.get_pricing_config()
RETURNS TABLE(commission_pct NUMERIC, insurance_per_day NUMERIC)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((value->>'commission_pct')::NUMERIC, 10) AS commission_pct,
    COALESCE((value->>'insurance_per_day')::NUMERIC, 8) AS insurance_per_day
  FROM public.system_config
  WHERE key = 'pricing'
  UNION ALL
  SELECT 10::NUMERIC, 8::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'pricing')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pricing_config() TO authenticated, anon, service_role;

-- 3. Updated trigger — reads commission % and insurance/day from system_config
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
  v_commission_pct NUMERIC;
  v_insurance_per_day NUMERIC;
BEGIN
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
  v_service := ROUND(v_subtotal * (v_commission_pct / 100.0), 2);
  v_insurance := v_days * v_insurance_per_day;
  NEW.total_price := v_subtotal + v_service + v_insurance;
  RETURN NEW;
END;
$$;
