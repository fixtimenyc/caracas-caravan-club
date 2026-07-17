
-- Permitir que total_price venga calculado desde el cliente (systemSettings del admin)
-- en lugar de ser recalculado por la BD con una fórmula distinta.
-- Mantenemos un fallback seguro sólo si el cliente no envía nada.

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
  -- Si el cliente ya calculó y envió total_price, respetarlo tal cual.
  -- Esto permite que la única fuente de verdad sean los ajustes del admin
  -- (renter_commission, insurance, etc.) leídos desde el frontend.
  IF NEW.total_price IS NOT NULL AND NEW.total_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Fallback: si por alguna razón no vino un total, calcular uno mínimo
  -- para no romper inserts (ej. scripts internos / edge functions viejas).
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
