
ALTER TABLE public.renter_verifications
  ALTER COLUMN own_social_platform DROP NOT NULL,
  ALTER COLUMN own_social_url DROP NOT NULL,
  ALTER COLUMN own_social_age_months DROP NOT NULL,
  ALTER COLUMN reference_name DROP NOT NULL,
  ALTER COLUMN reference_relationship DROP NOT NULL,
  ALTER COLUMN reference_phone DROP NOT NULL,
  ALTER COLUMN reference_social_platform DROP NOT NULL,
  ALTER COLUMN reference_social_url DROP NOT NULL,
  ALTER COLUMN reference_social_age_months DROP NOT NULL;