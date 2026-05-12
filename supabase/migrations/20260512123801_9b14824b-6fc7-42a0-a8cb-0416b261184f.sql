
CREATE POLICY "Renters can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'renter-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
