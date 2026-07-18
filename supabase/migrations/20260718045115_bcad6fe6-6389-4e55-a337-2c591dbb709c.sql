ALTER TABLE public.renter_verifications
  ADD COLUMN IF NOT EXISTS utility_bill_url text,
  ADD COLUMN IF NOT EXISTS bank_reference_url text;