CREATE POLICY "Public can view referenced vehicle photos in owner-documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'owner-documents'
  AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.active = true
      AND storage.objects.name = ANY(v.photos)
  )
);