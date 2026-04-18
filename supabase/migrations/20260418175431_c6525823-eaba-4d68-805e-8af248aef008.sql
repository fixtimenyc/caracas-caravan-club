-- Enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

-- Table for owner onboarding applications
CREATE TABLE public.owner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Personal data
  cedula TEXT NOT NULL,
  birth_date DATE,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- Vehicle data
  vehicle_brand TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_color TEXT,
  fuel_type TEXT,
  transmission TEXT,
  mileage INTEGER,
  -- Pricing & availability
  suggested_price_per_day NUMERIC NOT NULL,
  availability_notes TEXT,
  -- Documents (storage paths)
  cedula_doc_url TEXT,
  title_doc_url TEXT,
  insurance_doc_url TEXT,
  vehicle_photos TEXT[] DEFAULT '{}',
  -- Status
  status public.application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own application"
  ON public.owner_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own application"
  ON public.owner_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update pending application"
  ON public.owner_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all applications"
  ON public.owner_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_owner_applications_updated_at
  BEFORE UPDATE ON public.owner_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for owner documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-documents', 'owner-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners can view their own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can upload their own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all owner documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'owner-documents' AND public.has_role(auth.uid(), 'admin'));