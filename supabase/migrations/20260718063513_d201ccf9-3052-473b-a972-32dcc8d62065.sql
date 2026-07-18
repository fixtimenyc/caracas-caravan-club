
ALTER TABLE public.renter_verifications
  ADD COLUMN IF NOT EXISTS own_social_verified_picture TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS renter_verifications_social_provider_unique
  ON public.renter_verifications (own_social_provider, own_social_provider_user_id)
  WHERE own_social_provider IS NOT NULL
    AND own_social_provider_user_id IS NOT NULL;
