
REVOKE EXECUTE ON FUNCTION public.get_pricing_config() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_pricing_config() TO authenticated, service_role;
