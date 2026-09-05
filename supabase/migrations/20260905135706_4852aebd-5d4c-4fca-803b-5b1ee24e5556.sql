REVOKE ALL ON public.demand_signals FROM anon;
REVOKE ALL ON public.demand_signals FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_signals TO authenticated;
GRANT ALL ON public.demand_signals TO service_role;