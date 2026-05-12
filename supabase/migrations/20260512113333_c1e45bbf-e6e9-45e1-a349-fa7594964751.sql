-- Status enum
DO $$ BEGIN
  CREATE TYPE public.renter_verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.renter_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Personal data
  full_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'cedula' | 'pasaporte'
  document_number TEXT NOT NULL,
  birth_date DATE NOT NULL,
  nationality TEXT,
  gender TEXT,
  -- Contact
  phone TEXT NOT NULL,
  phone_secondary TEXT,
  contact_email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'Venezuela',
  -- Background
  occupation TEXT,
  employer TEXT,
  driving_license_number TEXT,
  driving_license_expiry DATE,
  has_medical_condition BOOLEAN NOT NULL DEFAULT false,
  -- Emergency contact
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_relationship TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  -- Documents (storage paths in renter-documents bucket)
  identity_doc_url TEXT NOT NULL,
  driving_license_doc_url TEXT NOT NULL,
  medical_certificate_url TEXT,
  selfie_url TEXT NOT NULL,
  -- Personal social network (1+ year active)
  own_social_platform TEXT NOT NULL,
  own_social_url TEXT NOT NULL,
  own_social_age_months INTEGER NOT NULL CHECK (own_social_age_months >= 12),
  -- Personal reference + their social
  reference_name TEXT NOT NULL,
  reference_relationship TEXT NOT NULL,
  reference_phone TEXT NOT NULL,
  reference_social_platform TEXT NOT NULL,
  reference_social_url TEXT NOT NULL,
  reference_social_age_months INTEGER NOT NULL CHECK (reference_social_age_months >= 12),
  -- Meta
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  status public.renter_verification_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.renter_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own verification"
  ON public.renter_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own verification"
  ON public.renter_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their pending verification"
  ON public.renter_verifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins manage all verifications"
  ON public.renter_verifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Updated-at trigger
CREATE TRIGGER update_renter_verifications_updated_at
  BEFORE UPDATE ON public.renter_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When approved, set verified=true on profile
CREATE OR REPLACE FUNCTION public.handle_renter_verification_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles SET verified = true WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_renter_verification_status_change
  AFTER UPDATE ON public.renter_verifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_renter_verification_approved();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('renter-documents', 'renter-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: user owns folder named after their uid
CREATE POLICY "Renters upload their own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'renter-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Renters view their own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'renter-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Renters update their own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'renter-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins delete renter documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'renter-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );