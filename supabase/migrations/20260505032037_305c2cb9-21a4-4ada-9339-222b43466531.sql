
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT user_id, full_name, avatar_url, verified, created_at
FROM public.profiles;

-- Allow any (authenticated) user to read this safe projection
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public safe profile fields visible to all authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Wait, that re-exposes everything. Drop and use a different approach:
DROP POLICY "Public safe profile fields visible to all authenticated" ON public.profiles;

GRANT SELECT (user_id, full_name, avatar_url, verified, created_at) ON public.profiles TO authenticated, anon;
