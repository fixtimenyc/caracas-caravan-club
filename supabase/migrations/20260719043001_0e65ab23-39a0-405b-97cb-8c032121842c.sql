
ALTER TABLE public.owner_applications
  ADD COLUMN IF NOT EXISTS driving_license_number TEXT,
  ADD COLUMN IF NOT EXISTS driving_license_expiry DATE,
  ADD COLUMN IF NOT EXISTS driving_license_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS utility_bill_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_reference_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS has_medical_condition BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS own_social_provider TEXT,
  ADD COLUMN IF NOT EXISTS own_social_provider_user_id TEXT,
  ADD COLUMN IF NOT EXISTS own_social_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS own_social_verified_name TEXT,
  ADD COLUMN IF NOT EXISTS own_social_verified_email TEXT,
  ADD COLUMN IF NOT EXISTS own_social_verified_picture TEXT,
  ADD COLUMN IF NOT EXISTS own_social_declared_age_months INTEGER,
  ADD COLUMN IF NOT EXISTS personal_reference_email TEXT;
