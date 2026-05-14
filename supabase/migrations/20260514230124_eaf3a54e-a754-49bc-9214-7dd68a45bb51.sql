-- Extend vehicle_maintenance to support full inspections & maintenance module
ALTER TABLE public.vehicle_maintenance
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'maintenance',
  ADD COLUMN IF NOT EXISTS inspection_type text,
  ADD COLUMN IF NOT EXISTS inspector_name text,
  ADD COLUMN IF NOT EXISTS workshop text,
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS next_date date,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS problems text,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS signature text;

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_status ON public.vehicle_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_scheduled ON public.vehicle_maintenance(scheduled_date);