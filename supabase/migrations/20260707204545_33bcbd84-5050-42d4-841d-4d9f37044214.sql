-- Allow owners to mark a reservation as completed at any time while it's active
-- (e.g. renter returned the car early). Keep other transitions unchanged.
DROP POLICY IF EXISTS "Owners can update reservation status" ON public.reservations;

CREATE POLICY "Owners can update reservation status"
ON public.reservations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = reservations.vehicle_id AND v.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = reservations.vehicle_id AND v.owner_id = auth.uid()
  )
  AND (
    status = public.current_reservation_status(id)
    OR (
      public.current_reservation_status(id) = 'pending'::public.reservation_status
      AND status = ANY (ARRAY[
        'awaiting_payment'::public.reservation_status,
        'rejected'::public.reservation_status,
        'cancelled'::public.reservation_status
      ])
    )
    OR (
      public.current_reservation_status(id) = 'awaiting_payment'::public.reservation_status
      AND status = 'cancelled'::public.reservation_status
    )
    OR (
      public.current_reservation_status(id) = 'approved'::public.reservation_status
      AND (
        status = 'cancelled'::public.reservation_status
        OR (status = 'active'::public.reservation_status AND public.reservation_has_completed_payment(id))
      )
    )
    OR (
      public.current_reservation_status(id) = 'active'::public.reservation_status
      AND status = ANY (ARRAY[
        'cancelled'::public.reservation_status,
        'completed'::public.reservation_status
      ])
    )
  )
);