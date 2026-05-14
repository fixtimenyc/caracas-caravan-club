-- Add optional columns to vehicles for admin detail page
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS plate TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS transmission TEXT,
  ADD COLUMN IF NOT EXISTS seats INTEGER,
  ADD COLUMN IF NOT EXISTS soat_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS soat_expiry DATE,
  ADD COLUMN IF NOT EXISTS circulation_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS circulation_expiry DATE,
  ADD COLUMN IF NOT EXISTS insurance_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
  ADD COLUMN IF NOT EXISTS weekend_price NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_price NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Backfill from approved owner_applications (best-effort match: same owner, brand/model/year/plate)
UPDATE public.vehicles v
SET
  plate = COALESCE(v.plate, oa.vehicle_plate),
  color = COALESCE(v.color, oa.vehicle_color),
  fuel_type = COALESCE(v.fuel_type, oa.fuel_type),
  transmission = COALESCE(v.transmission, oa.transmission),
  zone = COALESCE(v.zone, oa.vehicle_zone),
  soat_doc_url = COALESCE(v.soat_doc_url, oa.insurance_doc_url),
  circulation_doc_url = COALESCE(v.circulation_doc_url, oa.title_doc_url)
FROM public.owner_applications oa
WHERE oa.user_id = v.owner_id
  AND oa.status = 'approved'
  AND oa.vehicle_brand = v.brand
  AND oa.vehicle_model = v.model
  AND oa.vehicle_year = v.year;