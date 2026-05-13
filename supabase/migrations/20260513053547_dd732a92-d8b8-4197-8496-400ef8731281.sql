ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS house_rules jsonb NOT NULL DEFAULT jsonb_build_object(
    'noSmoking', true,
    'smokingFine', 50,
    'noPets', true,
    'returnSameFuel', true,
    'noOffRoad', true,
    'maxKmPerDay', null,
    'additional', ''
  );