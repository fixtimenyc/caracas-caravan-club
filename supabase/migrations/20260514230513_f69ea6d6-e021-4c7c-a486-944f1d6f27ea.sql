ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS start_mileage integer,
  ADD COLUMN IF NOT EXISTS end_mileage integer;

ALTER TABLE public.vehicle_maintenance
  ADD COLUMN IF NOT EXISTS mileage integer;