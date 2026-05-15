-- Restrict anonymous (public, unauthenticated) read access to sensitive vehicle columns
-- such as license plate, VIN and legal document URLs. Authenticated users (owners,
-- renters, admins) keep their access governed by existing RLS policies.

REVOKE SELECT (plate, vin, soat_doc_url, circulation_doc_url, insurance_doc_url, internal_notes)
  ON public.vehicles FROM anon;

-- Make sure authenticated keeps full column access (no-op if already granted).
GRANT SELECT ON public.vehicles TO authenticated;