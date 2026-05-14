
-- Inspection type enum
DO $$ BEGIN
  CREATE TYPE public.inspection_type AS ENUM ('pickup','return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  type public.inspection_type NOT NULL,
  inspector_id UUID NOT NULL,
  inspector_role TEXT NOT NULL CHECK (inspector_role IN ('renter','owner')),
  mileage INTEGER,
  fuel_level TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  damage_notes TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  signature_name TEXT,
  signed_at TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, type)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_reservation ON public.vehicle_inspections(reservation_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle ON public.vehicle_inspections(vehicle_id);

ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inspections"
  ON public.vehicle_inspections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants view inspections"
  ON public.vehicle_inspections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE r.id = vehicle_inspections.reservation_id
        AND (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
    )
  );

CREATE POLICY "Renter creates pickup inspection"
  ON public.vehicle_inspections FOR INSERT TO authenticated
  WITH CHECK (
    type = 'pickup'
    AND inspector_role = 'renter'
    AND inspector_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = vehicle_inspections.reservation_id
        AND r.renter_id = auth.uid()
        AND r.status IN ('approved','active')
    )
  );

CREATE POLICY "Owner creates return inspection"
  ON public.vehicle_inspections FOR INSERT TO authenticated
  WITH CHECK (
    type = 'return'
    AND inspector_role = 'owner'
    AND inspector_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE r.id = vehicle_inspections.reservation_id
        AND v.owner_id = auth.uid()
        AND r.status IN ('active','completed')
    )
  );

CREATE TRIGGER trg_vehicle_inspections_updated
  BEFORE UPDATE ON public.vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos','inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout = {reservation_id}/{type}/{filename}
CREATE POLICY "Inspection photos: admins all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'inspection-photos' AND public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (bucket_id = 'inspection-photos' AND public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "Inspection photos: participants view"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
    )
  );

CREATE POLICY "Inspection photos: renter upload pickup"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[2] = 'pickup'
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.renter_id = auth.uid()
    )
  );

CREATE POLICY "Inspection photos: owner upload return"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[2] = 'return'
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE r.id::text = (storage.foldername(name))[1]
        AND v.owner_id = auth.uid()
    )
  );
