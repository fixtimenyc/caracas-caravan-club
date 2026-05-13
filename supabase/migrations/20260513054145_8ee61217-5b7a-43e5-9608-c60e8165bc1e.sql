ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_features text[] NOT NULL DEFAULT '{}';