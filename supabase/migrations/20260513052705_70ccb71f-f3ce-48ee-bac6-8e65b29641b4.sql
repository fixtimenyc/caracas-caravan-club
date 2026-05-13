ALTER VIEW public.profiles_public SET (security_invoker = off);
GRANT SELECT ON public.profiles_public TO anon, authenticated;