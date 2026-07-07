-- Extend _safe_public_profiles so authors of publicly-released reviews are also exposed.
-- Previously only owners with active vehicles were listed, which hid renter names in review cards.
CREATE OR REPLACE FUNCTION public._safe_public_profiles()
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, verified boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.full_name, p.avatar_url, p.verified, p.created_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.owner_id = p.user_id AND v.active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.author_id = p.user_id
      AND public.is_review_public(r.reservation_id)
  );
$function$;