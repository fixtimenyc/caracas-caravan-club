
CREATE TABLE public.owner_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  method_type TEXT NOT NULL,
  bank_name TEXT,
  account_holder TEXT,
  holder_document TEXT,
  account_number TEXT,
  account_type TEXT,
  currency TEXT NOT NULL DEFAULT 'VES',
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own payout methods"
ON public.owner_payout_methods FOR SELECT TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners insert own payout methods"
ON public.owner_payout_methods FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners update own payout methods"
ON public.owner_payout_methods FOR UPDATE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners delete own payout methods"
ON public.owner_payout_methods FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_owner_payout_methods_updated_at
BEFORE UPDATE ON public.owner_payout_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_owner_payout_methods_owner ON public.owner_payout_methods(owner_id);
