
CREATE OR REPLACE FUNCTION public.get_renter_profile_for_owner(_renter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_allowed boolean;
  v_profile RECORD;
  v_ver RECORD;
  v_rating RECORD;
  v_reviews jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- caller must be owner in a conversation with this renter (or admin)
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE owner_id = v_caller AND renter_id = _renter_id
  ) OR public.has_role(v_caller, 'admin'::public.app_role)
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to view this profile';
  END IF;

  SELECT user_id, full_name, avatar_url, verified, created_at
    INTO v_profile
    FROM public.profiles
   WHERE user_id = _renter_id;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    (contact_email IS NOT NULL AND length(trim(contact_email)) > 0 AND status = 'approved') AS email_verified,
    (phone IS NOT NULL AND length(trim(phone)) > 0 AND status = 'approved') AS phone_verified,
    (own_social_url IS NOT NULL AND length(trim(own_social_url)) > 0 AND status = 'approved') AS social_verified,
    own_social_platform,
    own_social_age_months,
    status::text AS verification_status
    INTO v_ver
    FROM public.renter_verifications
   WHERE user_id = _renter_id
   ORDER BY created_at DESC
   LIMIT 1;

  SELECT * INTO v_rating FROM public.user_rating_summary(_renter_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rating', rating,
    'comment', comment,
    'created_at', created_at,
    'renter_responsibility', renter_responsibility,
    'punctuality', punctuality
  ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_reviews
    FROM (
      SELECT rating, comment, created_at, renter_responsibility, punctuality
        FROM public.reviews
       WHERE subject_user_id = _renter_id
         AND reviewer_type = 'owner'
         AND public.is_review_public(reservation_id)
       ORDER BY created_at DESC
       LIMIT 5
    ) r;

  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'avatar_url', v_profile.avatar_url,
    'verified', v_profile.verified,
    'member_since', v_profile.created_at,
    'email_verified', COALESCE(v_ver.email_verified, false),
    'phone_verified', COALESCE(v_ver.phone_verified, false),
    'social_verified', COALESCE(v_ver.social_verified, false),
    'social_platform', v_ver.own_social_platform,
    'social_age_months', v_ver.own_social_age_months,
    'verification_status', v_ver.verification_status,
    'avg_rating', v_rating.avg_rating,
    'review_count', v_rating.review_count,
    'reviews', v_reviews
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_renter_profile_for_owner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_renter_profile_for_owner(uuid) TO authenticated;
