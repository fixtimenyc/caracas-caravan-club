
-- Block edits to a signed inspection (admins bypass)
CREATE OR REPLACE FUNCTION public.protect_signed_inspection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.checklist IS DISTINCT FROM OLD.checklist
       OR NEW.photos IS DISTINCT FROM OLD.photos
       OR NEW.mileage IS DISTINCT FROM OLD.mileage
       OR NEW.fuel_level IS DISTINCT FROM OLD.fuel_level
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.damage_notes IS DISTINCT FROM OLD.damage_notes
       OR NEW.signature_name IS DISTINCT FROM OLD.signature_name
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.accepted_terms IS DISTINCT FROM OLD.accepted_terms THEN
      RAISE EXCEPTION 'La inspección ya fue firmada y no puede modificarse';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_inspection ON public.vehicle_inspections;
CREATE TRIGGER trg_protect_signed_inspection
  BEFORE UPDATE ON public.vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_inspection();

-- Storage: allow deleting inspection photos only while inspection is not yet signed
CREATE POLICY "Inspection photos: renter delete pickup pre-sign"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[2] = 'pickup'
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.renter_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicle_inspections vi
      WHERE vi.reservation_id::text = (storage.foldername(name))[1]
        AND vi.type = 'pickup'
    )
  );

CREATE POLICY "Inspection photos: owner delete return pre-sign"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[2] = 'return'
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE r.id::text = (storage.foldername(name))[1]
        AND v.owner_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicle_inspections vi
      WHERE vi.reservation_id::text = (storage.foldername(name))[1]
        AND vi.type = 'return'
    )
  );
