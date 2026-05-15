-- Helper: returns the current (pre-update) status of a reservation, bypassing RLS recursion.
CREATE OR REPLACE FUNCTION public.current_reservation_status(_reservation_id uuid)
RETURNS public.reservation_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.reservations WHERE id = _reservation_id
$$;

-- Helper: checks whether a reservation has at least one completed payment.
CREATE OR REPLACE FUNCTION public.reservation_has_completed_payment(_reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payments
    WHERE reservation_id = _reservation_id
      AND status = 'completed'::public.payment_status
  )
$$;

-- Replace the owner update policy with a stricter, transition-aware one.
DROP POLICY IF EXISTS "Owners can update reservation status" ON public.reservations;

CREATE POLICY "Owners can update reservation status"
ON public.reservations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = reservations.vehicle_id
      AND v.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = reservations.vehicle_id
      AND v.owner_id = auth.uid()
  )
  AND (
    -- No-op (status unchanged): still allow other column writes by owner.
    status = public.current_reservation_status(reservations.id)
    -- pending -> approved | rejected | cancelled
    OR (
      public.current_reservation_status(reservations.id) = 'pending'::public.reservation_status
      AND status IN (
        'approved'::public.reservation_status,
        'rejected'::public.reservation_status,
        'cancelled'::public.reservation_status
      )
    )
    -- approved -> active (only with confirmed payment) | cancelled
    OR (
      public.current_reservation_status(reservations.id) = 'approved'::public.reservation_status
      AND (
        status = 'cancelled'::public.reservation_status
        OR (
          status = 'active'::public.reservation_status
          AND public.reservation_has_completed_payment(reservations.id)
        )
      )
    )
    -- active -> completed (only after end_date) | cancelled
    OR (
      public.current_reservation_status(reservations.id) = 'active'::public.reservation_status
      AND (
        status = 'cancelled'::public.reservation_status
        OR (
          status = 'completed'::public.reservation_status
          AND end_date <= CURRENT_DATE
        )
      )
    )
  )
);