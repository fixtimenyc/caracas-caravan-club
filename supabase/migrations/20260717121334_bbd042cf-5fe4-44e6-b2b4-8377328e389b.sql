
CREATE TABLE public.owner_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  gross NUMERIC NOT NULL DEFAULT 0,
  commission NUMERIC NOT NULL DEFAULT 0,
  refunds NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  proof_url TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_payouts TO authenticated;
GRANT ALL ON public.owner_payouts TO service_role;

ALTER TABLE public.owner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payouts"
ON public.owner_payouts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can view their payouts"
ON public.owner_payouts FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE TRIGGER update_owner_payouts_updated_at
BEFORE UPDATE ON public.owner_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins can upload payout proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payout-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payout proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payout-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payout proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payout-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and owners can read payout proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payout-proofs' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.owner_payouts op
      WHERE op.proof_url = storage.objects.name
      AND op.owner_id = auth.uid()
    )
  )
);
