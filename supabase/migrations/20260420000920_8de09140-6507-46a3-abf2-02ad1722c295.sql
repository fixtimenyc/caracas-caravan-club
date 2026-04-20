-- 1. Extend reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'renter' CHECK (reviewer_type IN ('renter','owner')),
  ADD COLUMN IF NOT EXISTS subject_user_id UUID,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID,
  ADD COLUMN IF NOT EXISTS car_condition INT CHECK (car_condition BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS owner_communication INT CHECK (owner_communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS listing_accuracy INT CHECK (listing_accuracy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS renter_responsibility INT CHECK (renter_responsibility BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS punctuality INT CHECK (punctuality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS vehicle_returned_condition INT CHECK (vehicle_returned_condition BETWEEN 1 AND 5);

-- One review per (reservation, reviewer)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reservation_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_reviewer_per_reservation
  ON public.reviews(reservation_id, author_id);

CREATE INDEX IF NOT EXISTS idx_reviews_vehicle ON public.reviews(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_subject ON public.reviews(subject_user_id);

-- 2. Visibility function: a review is "public" when its counterpart from the other party
-- exists OR 7 days have passed since the reservation end_date.
CREATE OR REPLACE FUNCTION public.is_review_public(_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.id = _reservation_id
      AND (
        -- Both parties have submitted
        (
          (SELECT COUNT(DISTINCT reviewer_type) FROM public.reviews WHERE reservation_id = _reservation_id) >= 2
        )
        OR
        -- 7 days passed since trip end
        (r.end_date < (CURRENT_DATE - INTERVAL '7 days'))
      )
  );
$$;

-- 3. Replace SELECT policies on reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authors can view their own review" ON public.reviews;
DROP POLICY IF EXISTS "Public can view released reviews" ON public.reviews;

CREATE POLICY "Public can view released reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (public.is_review_public(reservation_id));

CREATE POLICY "Authors can view their own review"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

-- 4. Tighten INSERT: only after status='completed' AND author is renter or owner of that reservation
DROP POLICY IF EXISTS "Users can create reviews for their completed reservations" ON public.reviews;

CREATE POLICY "Users can create reviews for their completed reservations"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reviews.reservation_id
        AND r.status = 'completed'::reservation_status
        AND (
          (reviews.reviewer_type = 'renter' AND r.renter_id = auth.uid())
          OR
          (reviews.reviewer_type = 'owner' AND EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id = r.vehicle_id AND v.owner_id = auth.uid()
          ))
        )
    )
  );

-- 5. Average rating helpers (security definer for safe public reads)
CREATE OR REPLACE FUNCTION public.vehicle_rating_summary(_vehicle_id UUID)
RETURNS TABLE(avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
    COUNT(*)::BIGINT AS review_count
  FROM public.reviews
  WHERE vehicle_id = _vehicle_id
    AND reviewer_type = 'renter'
    AND public.is_review_public(reservation_id);
$$;

CREATE OR REPLACE FUNCTION public.user_rating_summary(_user_id UUID)
RETURNS TABLE(avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
    COUNT(*)::BIGINT AS review_count
  FROM public.reviews
  WHERE subject_user_id = _user_id
    AND public.is_review_public(reservation_id);
$$;