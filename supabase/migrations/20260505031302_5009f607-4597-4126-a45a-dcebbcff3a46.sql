CREATE POLICY "Public can view vehicle photos in owner-documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'owner-documents'
  AND (storage.foldername(name))[2] = 'photos'
);