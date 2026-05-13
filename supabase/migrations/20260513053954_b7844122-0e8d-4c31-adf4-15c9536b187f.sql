-- Replace SECURITY DEFINER view with a SECURITY INVOKER view backed by
-- a SECURITY DEFINER function that only exposes safe public columns.

CREATE OR REPLACE FUNCTION public._safe_public_profiles()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  verified boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, full_name, avatar_url, verified, created_at
  FROM public.profiles;
$$;

REVOKE ALL ON FUNCTION public._safe_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._safe_public_profiles() TO anon, authenticated;

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT user_id, full_name, avatar_url, verified, created_at
  FROM public._safe_public_profiles();

GRANT SELECT ON public.profiles_public TO anon, authenticated;